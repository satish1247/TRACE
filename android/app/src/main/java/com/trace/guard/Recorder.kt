package com.trace.guard

import android.content.Context
import android.media.MediaRecorder
import android.os.Build
import java.io.File

/**
 * Records the call to a file.
 *
 * Uses the plain MIC source on purpose. VOICE_COMMUNICATION applies echo cancellation, which
 * would strip out exactly what we need: the caller's voice coming back out of the speaker.
 */
object Recorder {

    @Volatile
    var recording = false
        private set

    @Volatile
    var lastError: String? = null
        private set

    /** 0..1 microphone level, so you can see whether any sound is actually arriving. */
    @Volatile
    var level = 0f
        private set

    /** Highest level seen this recording. If this stays near zero, the mic is being denied. */
    @Volatile
    var peak = 0f
        private set

    @Volatile
    var sourceUsed = ""
        private set

    private var recorder: MediaRecorder? = null
    private var target: File? = null
    private var startedAt = 0L

    fun folder(context: Context): File =
        File(context.filesDir, "recordings").apply { if (!exists()) mkdirs() }

    fun list(context: Context): List<File> =
        folder(context).listFiles { f -> f.isFile && f.name.endsWith(".m4a") }
            ?.sortedByDescending { it.lastModified() } ?: emptyList()

    private fun sourceName(s: Int) = when (s) {
        MediaRecorder.AudioSource.MIC -> "MIC"
        MediaRecorder.AudioSource.VOICE_RECOGNITION -> "VOICE_RECOGNITION"
        MediaRecorder.AudioSource.VOICE_COMMUNICATION -> "VOICE_COMMUNICATION"
        else -> "DEFAULT"
    }

    fun start(context: Context): Boolean {
        if (recording) return true
        lastError = null
        level = 0f
        peak = 0f
        val file = File(folder(context), "call-${System.currentTimeMillis()}.m4a")
        // MIC first, then fall back if an OEM refuses it during a call
        for (source in intArrayOf(
            MediaRecorder.AudioSource.MIC,
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            MediaRecorder.AudioSource.DEFAULT
        )) {
            try {
                val r = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    MediaRecorder(context)
                } else {
                    @Suppress("DEPRECATION")
                    MediaRecorder()
                }
                r.setAudioSource(source)
                r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                r.setAudioSamplingRate(44100)
                r.setAudioEncodingBitRate(96000)
                r.setAudioChannels(1)
                r.setOutputFile(file.absolutePath)
                r.prepare()
                r.start()
                recorder = r
                target = file
                startedAt = System.currentTimeMillis()
                sourceUsed = sourceName(source)
                recording = true
                return true
            } catch (e: Exception) {
                lastError = "${e.javaClass.simpleName}: ${e.message}"
                try {
                    recorder?.release()
                } catch (_: Exception) {
                }
                recorder = null
                file.delete()
            }
        }
        return false
    }

    /** Stops and returns the finished file, or null if nothing usable was captured. */
    fun stop(): File? {
        val r = recorder ?: return null
        val f = target
        recording = false
        recorder = null
        target = null
        return try {
            // MediaRecorder throws if stopped before it has captured anything
            if (System.currentTimeMillis() - startedAt < 700) Thread.sleep(700)
            r.stop()
            r.release()
            if (f != null && f.exists() && f.length() > 1024) {
                f
            } else {
                f?.delete()
                null
            }
        } catch (e: Exception) {
            lastError = "stop failed: ${e.javaClass.simpleName}"
            try {
                r.release()
            } catch (_: Exception) {
            }
            f?.delete()
            null
        }
    }

    fun durationSeconds(): Int =
        if (recording) ((System.currentTimeMillis() - startedAt) / 1000).toInt() else 0

    /** Called a few times a second while recording, to drive the level meter. */
    fun sampleLevel() {
        val r = recorder ?: return
        try {
            val amp = r.maxAmplitude // 0..32767
            val v = (amp / 12000f).coerceIn(0f, 1f)
            level = v
            if (v > peak) peak = v
        } catch (_: Exception) {
        }
    }

    fun describe(f: File): String {
        val kb = f.length() / 1024
        val ago = (System.currentTimeMillis() - f.lastModified()) / 1000
        val whenText = when {
            ago < 60 -> "$ago s ago"
            ago < 3600 -> "${ago / 60} min ago"
            else -> "${ago / 3600} h ago"
        }
        return "$kb KB · $whenText"
    }
}
