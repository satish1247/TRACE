package com.trace.guard

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.MediaPlayer
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import java.io.File

/**
 * TRACE Guard.
 *
 * Answer a call, watch the words appear as they are spoken, read them, then send them to the
 * website with one tap. Nothing leaves the phone until that tap.
 */
class MainActivity : Activity() {

    // palette, matching the web app
    private val bg = Color.parseColor("#0C1316")
    private val surface = Color.parseColor("#131D21")
    private val surface2 = Color.parseColor("#1B282D")
    private val hairline = Color.parseColor("#2B383E")
    private val ink = Color.parseColor("#DFE7E9")
    private val muted = Color.parseColor("#8798A0")
    private val accent = Color.parseColor("#E0A252")
    private val safe = Color.parseColor("#59AD9C")
    private val critical = Color.parseColor("#DE7C6C")

    private var d = 1f
    private lateinit var statusPill: TextView
    private lateinit var setupLine: TextView
    private lateinit var serverField: EditText
    private lateinit var riskNumber: TextView
    private lateinit var riskCaption: TextView
    private lateinit var markerLine: TextView
    private lateinit var partialLine: TextView
    private lateinit var transcriptField: EditText
    private lateinit var sendButton: Button
    private lateinit var verdictCard: LinearLayout
    private lateinit var verdictTitle: TextView
    private lateinit var verdictBody: TextView

    private lateinit var recLine: TextView
    private lateinit var playButton: Button
    private lateinit var transcribeButton: Button
    private lateinit var meterFill: View
    private lateinit var meterLine: TextView
    private val main = Handler(Looper.getMainLooper())
    private var lastTranscriptShown = ""
    private var sending = false
    private var player: MediaPlayer? = null
    private var selected: File? = null
    private var selectedUri: Uri? = null
    private var selectedName: String = ""
    private lateinit var libraryBox: LinearLayout

    private val needed: Array<String> = mutableListOf(
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.MODIFY_AUDIO_SETTINGS
    ).apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) add(Manifest.permission.POST_NOTIFICATIONS)
    }.toTypedArray()

    private val updates = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) = render()
    }

    // ------------------------------------------------------------------ small view helpers

    private fun dp(v: Int) = (v * d).toInt()

    private fun rounded(color: Int, radius: Int = 12) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = radius * d
    }

    private fun card(): LinearLayout = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        background = rounded(surface)
        setPadding(dp(16), dp(16), dp(16), dp(16))
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { bottomMargin = dp(12) }
    }

    private fun label(text: String) = TextView(this).apply {
        this.text = text.uppercase()
        setTextColor(muted)
        textSize = 10f
        letterSpacing = 0.14f
        setPadding(0, 0, 0, dp(8))
    }

    private fun body(text: String, color: Int = ink, size: Float = 14f) = TextView(this).apply {
        this.text = text
        setTextColor(color)
        textSize = size
    }

    private fun button(text: String, filled: Boolean = false, tint: Int = accent) = Button(this).apply {
        this.text = text
        isAllCaps = false
        textSize = 15f
        setTextColor(if (filled) Color.parseColor("#0C1316") else ink)
        background = rounded(if (filled) tint else surface2, 10)
        setPadding(dp(16), dp(12), dp(16), dp(12))
        layoutParams = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(8) }
    }

    // ------------------------------------------------------------------ screen

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        d = resources.displayMetrics.density
        Uplink.load(this)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(20), dp(16), dp(28))
            setBackgroundColor(bg)
        }

        // --- header
        root.addView(LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            addView(TextView(this@MainActivity).apply {
                text = "TRACE"
                setTextColor(Color.WHITE)
                textSize = 30f
                setTypeface(typeface, Typeface.BOLD)
                letterSpacing = 0.02f
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            })
            statusPill = TextView(this@MainActivity).apply {
                textSize = 11f
                setPadding(dp(10), dp(5), dp(10), dp(5))
                background = rounded(surface2, 20)
                setTextColor(muted)
                text = "Idle"
            }
            addView(statusPill)
        })
        root.addView(body("Banks check whether the payment is correct.\nTRACE checks whether the person is free.", muted, 13f).apply {
            setPadding(0, dp(6), 0, dp(18))
        })

        // --- setup card
        val setup = card()
        setup.addView(label("Setup"))
        setupLine = body("", muted, 13f)
        setup.addView(setupLine)
        setup.addView(button("Grant microphone and phone access") {
            requestPermissions(needed, 1)
        })
        setup.addView(button("Allow warning over the call screen") {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            } else {
                toast("Already allowed")
            }
        })
        setup.addView(body("Website address", muted, 12f).apply { setPadding(0, dp(14), 0, dp(6)) })
        serverField = EditText(this).apply {
            setText(Uplink.serverUrl.ifEmpty { "http://172.16.135.118:3000" })
            setTextColor(ink)
            setHintTextColor(Color.parseColor("#5C6A70"))
            hint = "http://<laptop-ip>:3000"
            textSize = 14f
            setSingleLine()
            inputType = InputType.TYPE_TEXT_VARIATION_URI
            background = rounded(surface2, 8)
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }
        setup.addView(serverField)
        setup.addView(button("Save and test connection") {
            Uplink.save(this, serverField.text.toString())
            toast("Testing...")
            Uplink.test { ok ->
                toast(if (ok) "Website reachable" else Uplink.lastStatus)
                render()
            }
        })
        root.addView(setup)

        // --- call card
        val callCard = card()
        callCard.addView(label("Capture"))
        callCard.addView(body("Listen live works when no call is in progress and shows words as they are spoken. Record is for an actual call: Android only lets one of the two hold the microphone, never both.", muted, 12f))
        callCard.addView(button("Listen live (no call)", filled = true, tint = safe) { start(CallGuardService.MODE_LISTEN) })
        callCard.addView(button("Record a call") { start(CallGuardService.MODE_RECORD) })

        // microphone level meter: silence should look like silence, not like a mystery
        callCard.addView(body("Microphone level", muted, 12f).apply { setPadding(0, dp(14), 0, dp(6)) })
        val meterTrack = LinearLayout(this).apply {
            background = rounded(surface2, 4)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(10))
        }
        meterFill = View(this).apply {
            background = rounded(safe, 4)
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        meterTrack.addView(meterFill)
        callCard.addView(meterTrack)
        meterLine = body("Not capturing", muted, 12f).apply { setPadding(0, dp(6), 0, 0) }
        callCard.addView(meterLine)

        callCard.addView(button("Play a scripted scam call") { startListening(true) })
        callCard.addView(button("Stop and save the recording") {
            startService(Intent(this, CallGuardService::class.java).apply { action = CallGuardService.ACTION_STOP })
            main.postDelayed({
                selected = Recorder.list(this).firstOrNull()
                render()
                if (selected != null) toast("Recording saved. Play it to check the audio.")
                else Recorder.lastError?.let { toast("Recording failed: $it") }
            }, 1400)
        })
        root.addView(callCard)

        // --- risk card
        val riskCard = card()
        riskCard.addView(label("Risk on this phone"))
        riskNumber = TextView(this).apply {
            text = "0"
            setTextColor(ink)
            textSize = 46f
            setTypeface(typeface, Typeface.BOLD)
        }
        riskCard.addView(riskNumber)
        riskCaption = body("Nothing heard yet", muted, 13f)
        riskCard.addView(riskCaption)
        markerLine = body("", critical, 12f).apply { setPadding(0, dp(6), 0, 0) }
        riskCard.addView(markerLine)
        root.addView(riskCard)

        // --- recording card
        val recCard = card()
        recCard.addView(label("Recording"))
        recLine = body("No recording chosen", muted, 13f)
        recCard.addView(recLine)
        recCard.addView(button("Choose a recording from the phone", filled = true) { pickFile() })
        recCard.addView(body("Use your phone's own voice recorder or its call recorder, then pick the file here. Those are system apps and can capture what this app cannot.", muted, 12f).apply {
            setPadding(0, dp(6), 0, dp(6))
        })
        libraryBox = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        recCard.addView(libraryBox)
        recCard.addView(button("Refresh recent recordings") { loadLibrary() })
        playButton = button("Play it back") { togglePlay() }
        recCard.addView(playButton)
        transcribeButton = button("Transcribe this recording", filled = true) { transcribe() }
        recCard.addView(transcribeButton)
        recCard.addView(body("Play it first. If you hear both voices, the capture worked.", muted, 12f).apply {
            setPadding(0, dp(8), 0, 0)
        })
        root.addView(recCard)

        // --- transcript card
        val tCard = card()
        tCard.addView(label("Transcript"))
        partialLine = body("", accent, 13f).apply {
            setPadding(0, 0, 0, dp(8))
            setTypeface(typeface, Typeface.ITALIC)
        }
        tCard.addView(partialLine)
        transcriptField = EditText(this).apply {
            setTextColor(ink)
            setHintTextColor(Color.parseColor("#5C6A70"))
            hint = "The words appear here as they are spoken. You can correct them before sending."
            textSize = 14f
            gravity = Gravity.TOP
            background = rounded(surface2, 8)
            setPadding(dp(12), dp(12), dp(12), dp(12))
            minLines = 5
            maxLines = 12
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
        tCard.addView(transcriptField)
        sendButton = button("Send to the website", filled = true) { send() }
        tCard.addView(sendButton)
        tCard.addView(button("Clear") {
            transcriptField.setText("")
            lastTranscriptShown = ""
        })
        root.addView(tCard)

        // --- verdict card
        verdictCard = card().apply { visibility = View.GONE }
        verdictCard.addView(label("What the website found"))
        verdictTitle = TextView(this).apply {
            setTextColor(critical)
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
        }
        verdictCard.addView(verdictTitle)
        verdictBody = body("", ink, 14f).apply { setPadding(0, dp(8), 0, 0) }
        verdictCard.addView(verdictBody)
        root.addView(verdictCard)

        root.addView(body("Every rail in this prototype is simulated. No real money moves.", Color.parseColor("#5C6A70"), 11f).apply {
            setPadding(0, dp(8), 0, 0)
        })

        setContentView(ScrollView(this).apply {
            setBackgroundColor(bg)
            addView(root)
        })
        loadLibrary()
        render()
    }

    companion object {
        private const val REQ_PICK = 77
    }

    private fun button(text: String, filled: Boolean = false, tint: Int = accent, onClick: () -> Unit) =
        button(text, filled, tint).apply { setOnClickListener { onClick() } }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    // ------------------------------------------------------------------ recordings

    private fun pickFile() {
        val i = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "audio/*"
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        try {
            startActivityForResult(i, REQ_PICK)
        } catch (_: Exception) {
            toast("No file picker on this phone")
        }
    }

    @Deprecated("plain Activity, no androidx result API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_PICK || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        try {
            contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (_: Exception) {
        }
        selectedUri = uri
        selected = null
        selectedName = uri.lastPathSegment?.substringAfterLast('/') ?: "chosen recording"
        toast("Selected $selectedName")
        render()
    }

    /** Lists what the phone's own recorder and dialer have saved. */
    private fun loadLibrary() {
        libraryBox.removeAllViews()
        val items = AudioLibrary.recent(this, 6)
        if (items.isEmpty()) {
            libraryBox.addView(body("No recordings found. Use the Choose button above, or record one with your phone's voice recorder first.", muted, 12f))
            return
        }
        for (item in items) {
            libraryBox.addView(Button(this).apply {
                text = (if (item.looksLikeCall) "[call]  " else "") + item.name + "\n" + item.describe()
                isAllCaps = false
                textSize = 12f
                setTextColor(if (item.looksLikeCall) accent else ink)
                background = rounded(surface2, 8)
                setPadding(dp(12), dp(10), dp(12), dp(10))
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dp(6) }
                setOnClickListener {
                    selectedUri = item.uri
                    selected = null
                    selectedName = item.name
                    toast("Selected ${item.name}")
                    render()
                }
            })
        }
    }

    private fun togglePlay() {
        val p = player
        if (p != null) {
            try {
                p.stop()
                p.release()
            } catch (_: Exception) {
            }
            player = null
            render()
            return
        }
        val uri = currentUri()
        if (uri == null) {
            toast("Choose a recording first")
            return
        }
        try {
            val mp = MediaPlayer()
            mp.setDataSource(this, uri)
            mp.prepare()
            mp.setOnCompletionListener {
                try {
                    it.release()
                } catch (_: Exception) {
                }
                player = null
                render()
            }
            mp.start()
            player = mp
            toast("Playing $selectedName")
        } catch (e: Exception) {
            toast("Could not play: ${e.javaClass.simpleName}")
        }
        render()
    }

    /** Whatever is selected: a picked file, a library item, or the app's own last recording. */
    private fun currentUri(): Uri? {
        selectedUri?.let { return it }
        val f = selected ?: Recorder.list(this).firstOrNull() ?: return null
        selected = f
        if (selectedName.isEmpty()) selectedName = f.name
        return Uri.fromFile(f)
    }

    private fun transcribe() {
        if (Transcriber.running) {
            Transcriber.stop()
            render()
            return
        }
        val uri = currentUri()
        if (uri == null) {
            toast("Choose a recording first")
            return
        }
        transcriptField.setText("")
        lastTranscriptShown = ""
        Transcriber.start(this, uri) {
            val t = Transcriber.text
            if (t.isNotEmpty() && t != lastTranscriptShown) {
                transcriptField.setText(t)
                transcriptField.setSelection(t.length)
                lastTranscriptShown = t
            }
            render()
        }
        render()
    }

    // ------------------------------------------------------------------ actions

    private fun start(mode: String) {
        if (!granted()) {
            toast("Grant microphone and phone access first")
            return
        }
        startForegroundService(Intent(this, CallGuardService::class.java).apply {
            action = CallGuardService.ACTION_START
            putExtra(CallGuardService.EXTRA_NUMBER, if (mode == CallGuardService.MODE_RECORD) "Call" else "Room")
            putExtra(CallGuardService.EXTRA_MODE, mode)
        })
        main.postDelayed({ render() }, 500)
    }

    private fun startListening(scripted: Boolean) {
        if (!granted()) {
            toast("Grant microphone and phone access first")
            return
        }
        startForegroundService(Intent(this, CallGuardService::class.java).apply {
            action = CallGuardService.ACTION_START
            putExtra(CallGuardService.EXTRA_NUMBER, if (scripted) "+91 11 2345 6789" else "Live call")
            putExtra(CallGuardService.EXTRA_SIMULATED, scripted)
        })
        if (scripted) playScript()
        main.postDelayed({ render() }, 400)
    }

    private fun send() {
        val text = transcriptField.text.toString().trim()
        if (text.isEmpty()) {
            toast("Nothing to send yet")
            return
        }
        if (Uplink.serverUrl.isBlank()) Uplink.save(this, serverField.text.toString())
        sending = true
        sendButton.text = "Sending..."
        sendButton.isEnabled = false
        Uplink.sendTranscript(
            text,
            CallGuardService.caller,
            onProgress = { i, n -> sendButton.text = "Sending $i of $n..." },
            onDone = { verdict ->
                sending = false
                sendButton.isEnabled = true
                sendButton.text = "Send to the website"
                if (verdict == null) {
                    toast(Uplink.lastStatus)
                    verdictCard.visibility = View.GONE
                } else {
                    verdictCard.visibility = View.VISIBLE
                    verdictTitle.text = verdict.label ?: "No known scam matched"
                    verdictTitle.setTextColor(if (verdict.risk >= 45) critical else safe)
                    verdictBody.text = buildString {
                        append("Risk ${verdict.risk}/100 on the website.")
                        if (verdict.markers.isNotEmpty()) append("\nMarkers: " + verdict.markers.joinToString(", "))
                        verdict.attestation?.let { append("\n\n$it") }
                        verdict.rebuttal?.let { append("\n\n$it") }
                    }
                }
                render()
            }
        )
    }

    /** Feeds the detector a scripted scam call so the demo works without placing one. */
    private fun playScript() {
        val lines = listOf(
            "Hello, am I speaking to Lakshmi madam? This is Inspector Rajesh Kumar from Delhi Police Cyber Cell.",
            "Madam, a case has been registered. Your Aadhaar number was used for money laundering.",
            "An arrest warrant has been issued in your name. You will be arrested today unless we verify you.",
            "Stay on this call. Do not tell anyone, not your family. This is a confidential investigation.",
            "To prove your innocence, transfer fifty thousand rupees to the RBI verification account.",
            "Do not call your bank. If the app shows any warning, ignore it, it is a system error."
        )
        for ((i, line) in lines.withIndex()) {
            main.postDelayed({
                DemoBridge.feed(this, line)
                render()
            }, 1500L * (i + 1))
        }
    }

    // ------------------------------------------------------------------ state

    override fun onResume() {
        super.onResume()
        val filter = IntentFilter(CallGuardService.BROADCAST_UPDATE)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(updates, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(updates, filter)
        }
        render()
    }

    override fun onPause() {
        super.onPause()
        try {
            unregisterReceiver(updates)
        } catch (_: Exception) {
        }
    }

    override fun onDestroy() {
        try {
            player?.release()
        } catch (_: Exception) {
        }
        player = null
        if (Transcriber.running) Transcriber.stop()
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        render()
    }

    private fun granted() = needed.all { checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }

    private fun canOverlay() =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(this)

    private fun render() {
        val listening = CallGuardService.running
        statusPill.text = if (listening) "Listening" else "Idle"
        statusPill.setTextColor(if (listening) safe else muted)
        statusPill.background = rounded(if (listening) Color.parseColor("#102623") else surface2, 20)

        setupLine.text = buildString {
            append(if (granted()) "Microphone and phone access: on" else "Microphone and phone access: needed")
            append("\n")
            append(if (canOverlay()) "Warning over calls: allowed" else "Warning over calls: not allowed yet")
            append("\n")
            append("Website: ${Uplink.lastStatus}")
        }

        val r = CallGuardService.risk
        riskNumber.text = r.toString()
        riskNumber.setTextColor(if (r >= ScamDetector.WARN_THRESHOLD) critical else if (r > 0) accent else ink)
        riskCaption.text = when {
            r >= ScamDetector.WARN_THRESHOLD -> CallGuardService.scam?.label ?: "Scam pattern detected"
            r > 0 -> "Some pressure signs"
            listening -> "Listening, nothing suspicious yet"
            else -> "Nothing heard yet"
        }
        markerLine.text = CallGuardService.markersFound.joinToString(" · ") { it.label }
        partialLine.text = if (Transcriber.running) Transcriber.partial else CallGuardService.partial

        // microphone level meter
        val capturing = Recorder.recording
        val lvl = if (capturing) Recorder.level else 0f
        meterFill.layoutParams = LinearLayout.LayoutParams(
            (resources.displayMetrics.widthPixels * 0.8f * lvl).toInt().coerceAtLeast(if (capturing) dp(2) else 0),
            dp(10)
        )
        meterFill.background = rounded(if (Recorder.peak < 0.04f && Recorder.durationSeconds() > 3) critical else safe, 4)
        meterFill.requestLayout()
        meterLine.text = when {
            capturing && Recorder.peak < 0.04f && Recorder.durationSeconds() > 3 ->
                "No sound reaching the microphone. Android is blocking it during this call. Try the speaker button, or use Listen live outside a call."
            capturing -> "Capturing via ${Recorder.sourceUsed} · peak ${(Recorder.peak * 100).toInt()}%"
            CallGuardService.running && CallGuardService.mode == CallGuardService.MODE_LISTEN -> "Listening live"
            else -> "Not capturing"
        }
        meterLine.setTextColor(
            if (capturing && Recorder.peak < 0.04f && Recorder.durationSeconds() > 3) critical else muted
        )

        // recording card
        val have = selectedUri != null || selected != null || Recorder.list(this).isNotEmpty()
        recLine.text = when {
            Recorder.recording -> "Recording now · ${Recorder.durationSeconds()} s"
            selectedUri != null -> "Selected: $selectedName"
            selected != null -> "Selected: ${selected!!.name}\n${Recorder.describe(selected!!)}"
            Recorder.list(this).isNotEmpty() -> "Latest from this app: ${Recorder.list(this).first().name}"
            Recorder.lastError != null -> "Recording failed: ${Recorder.lastError}"
            else -> "No recording chosen"
        }
        recLine.setTextColor(if (Recorder.recording) safe else if (have) ink else muted)
        playButton.text = if (player != null) "Stop playing" else "Play it back"
        playButton.isEnabled = have && !Transcriber.running
        transcribeButton.text = when {
            Transcriber.running -> "Stop transcribing"
            Transcriber.status.isNotEmpty() -> "Transcribe again"
            else -> "Transcribe this recording"
        }
        transcribeButton.isEnabled = have && player == null
        if (Transcriber.status.isNotEmpty()) riskCaption.text = Transcriber.status

        // keep the field in step with new speech, without fighting the user's own edits
        val t = if (Transcriber.running || Transcriber.text.isNotEmpty()) Transcriber.text else CallGuardService.transcript
        if (t.isNotEmpty() && t != lastTranscriptShown && (transcriptField.text.toString() == lastTranscriptShown || transcriptField.text.isEmpty())) {
            transcriptField.setText(t)
            transcriptField.setSelection(t.length)
            lastTranscriptShown = t
        }
        if (!sending) {
            val n = transcriptField.text.toString().split("\n").count { it.isNotBlank() }
            sendButton.text = if (n > 0) "Send $n line${if (n == 1) "" else "s"} to the website" else "Send to the website"
        }
    }
}
