package com.trace.guard

import android.content.Context
import android.os.Handler
import android.os.Looper
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Sends a reviewed transcript to the TRACE web app, where the analysis happens and appears on
 * the stage screen. Nothing is sent automatically: the user reads the transcript first and
 * presses Send, so nobody's conversation leaves the phone without a deliberate tap.
 */
object Uplink {

    private const val PREFS = "trace_guard"
    private const val KEY_URL = "server_url"
    private val main = Handler(Looper.getMainLooper())

    data class Verdict(
        val risk: Int,
        val label: String?,
        val rebuttal: String?,
        val markers: List<String>,
        val attestation: String?
    )

    @Volatile
    var serverUrl: String = ""

    @Volatile
    var lastStatus: String = "not connected yet"
        private set

    fun load(context: Context) {
        serverUrl = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_URL, "") ?: ""
    }

    fun save(context: Context, url: String) {
        serverUrl = url.trim()
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY_URL, serverUrl).apply()
    }

    /** Quick reachability check for the Test button. */
    fun test(onDone: (Boolean) -> Unit) {
        Thread {
            val ok = request("start", "connection test from TRACE Guard", null) != null
            lastStatus = if (ok) "connected to the website" else lastStatus
            main.post { onDone(ok) }
        }.start()
    }

    /**
     * Sends the whole transcript, one line at a time with a small gap, so the stage screen
     * reveals it progressively and the markers light up in order. Returns the final verdict.
     */
    fun sendTranscript(text: String, caller: String, onProgress: (Int, Int) -> Unit, onDone: (Verdict?) -> Unit) {
        val lines = text.split("\n").map { it.trim() }.filter { it.isNotEmpty() }
        if (lines.isEmpty()) {
            main.post { onDone(null) }
            return
        }
        Thread {
            request("start", null, caller)
            var last: Verdict? = null
            for ((i, line) in lines.withIndex()) {
                last = request("line", line, caller)
                main.post { onProgress(i + 1, lines.size) }
                try {
                    Thread.sleep(320)
                } catch (_: InterruptedException) {
                }
            }
            request("end", null, null)
            val verdict = last
            main.post { onDone(verdict) }
        }.start()
    }

    private fun request(event: String, text: String?, caller: String?): Verdict? {
        val base = serverUrl.trim().trimEnd('/')
        if (base.isEmpty()) {
            lastStatus = "no website address set"
            return null
        }
        var conn: HttpURLConnection? = null
        return try {
            conn = URL("$base/api/phone").openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            val body = JSONObject().apply {
                put("event", event)
                if (text != null) put("text", text)
                if (caller != null) put("caller", caller)
            }.toString()
            conn.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            val code = conn.responseCode
            if (code !in 200..299) {
                lastStatus = "website replied HTTP $code"
                return null
            }
            val reply = conn.inputStream.bufferedReader().use { it.readText() }
            lastStatus = "sent to the website"
            parse(reply)
        } catch (e: Exception) {
            lastStatus = "cannot reach the website (${e.javaClass.simpleName})"
            null
        } finally {
            try {
                conn?.disconnect()
            } catch (_: Exception) {
            }
        }
    }

    private fun parse(json: String): Verdict? = try {
        val o = JSONObject(json)
        val arr = o.optJSONArray("markers")
        val markers = mutableListOf<String>()
        if (arr != null) for (i in 0 until arr.length()) markers.add(arr.getString(i))
        Verdict(
            risk = o.optInt("risk", 0),
            label = o.optString("label").takeIf { it.isNotEmpty() && it != "null" },
            rebuttal = o.optString("rebuttal").takeIf { it.isNotEmpty() && it != "null" },
            markers = markers,
            attestation = o.optString("attestation").takeIf { it.isNotEmpty() && it != "null" }
        )
    } catch (_: Exception) {
        null
    }
}
