package com.trace.guard

import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.net.Uri
import android.speech.SpeechRecognizer
import java.io.File

/**
 * Turns a recording into text, on the device, with no API key and no internet.
 *
 * Android has no API to transcribe an audio file: the speech recogniser only listens to the
 * microphone live. So this plays the recording out of the speaker and lets the recogniser hear
 * it. Crude, but it works offline, and it is honest: you hear exactly what the app heard.
 */
object Transcriber {

    @Volatile
    var running = false
        private set

    @Volatile
    var text = ""
        private set

    @Volatile
    var partial = ""
        private set

    @Volatile
    var status = ""
        private set

    private val main = Handler(Looper.getMainLooper())
    private var player: MediaPlayer? = null
    private var recognizer: SpeechRecognizer? = null
    private var onUpdate: (() -> Unit)? = null
    private var stopRequested = false

    fun start(context: Context, file: File, onUpdate: () -> Unit) =
        start(context, Uri.fromFile(file), onUpdate)

    fun start(context: Context, uri: Uri, onUpdate: () -> Unit) {
        if (running) return
        if (!SpeechRecognizer.isRecognitionAvailable(context)) {
            status = "No speech recogniser on this phone. Use Play to listen to the recording instead."
            onUpdate()
            return
        }
        this.onUpdate = onUpdate
        text = ""
        partial = ""
        stopRequested = false
        running = true
        status = "Playing the recording aloud and listening..."
        onUpdate()

        // loudspeaker at full volume, so the microphone can hear the playback
        try {
            val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0)
        } catch (_: Exception) {
        }

        try {
            val mp = MediaPlayer()
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            mp.setDataSource(context, uri)
            mp.prepare()
            mp.setOnCompletionListener {
                val lines = text.split("\n").count { l -> l.isNotBlank() }
                status = "Finished. $lines line(s) transcribed."
                main.postDelayed({ stop() }, 1500) // let the recogniser finish the last phrase
            }
            player = mp
            listenLoop(context)
            mp.start()
        } catch (e: Exception) {
            status = "Could not play the recording: ${e.javaClass.simpleName}"
            running = false
            onUpdate()
        }
    }

    private fun listenLoop(context: Context) {
        if (stopRequested) return
        try {
            recognizer?.destroy()
        } catch (_: Exception) {
        }
        val rec = SpeechRecognizer.createSpeechRecognizer(context)
        rec.setRecognitionListener(object : RecognitionListener {
            override fun onReadyForSpeech(params: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(rmsdB: Float) {}
            override fun onBufferReceived(buffer: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(eventType: Int, params: Bundle?) {}

            override fun onError(error: Int) {
                partial = ""
                if (!stopRequested) main.postDelayed({ listenLoop(context) }, 250)
            }

            override fun onResults(results: Bundle?) {
                val t = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                partial = ""
                if (!t.isNullOrBlank()) {
                    text = if (text.isEmpty()) t else text + "\n" + t
                    onUpdate?.invoke()
                }
                if (!stopRequested) main.postDelayed({ listenLoop(context) }, 200)
            }

            override fun onPartialResults(bundle: Bundle?) {
                val t = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
                if (!t.isNullOrBlank()) {
                    partial = t
                    onUpdate?.invoke()
                }
            }
        })
        recognizer = rec
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        }
        try {
            rec.startListening(intent)
        } catch (_: Exception) {
            if (!stopRequested) main.postDelayed({ listenLoop(context) }, 400)
        }
    }

    fun stop() {
        stopRequested = true
        running = false
        partial = ""
        try {
            player?.stop()
            player?.release()
        } catch (_: Exception) {
        }
        player = null
        try {
            recognizer?.stopListening()
            recognizer?.destroy()
        } catch (_: Exception) {
        }
        recognizer = null
        if (status.startsWith("Playing")) status = "Stopped."
        onUpdate?.invoke()
    }
}
