package com.trace.guard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Listens to a live call, transcribes it on the device, scores every sentence against the
 * five scam markers, and floats a warning over the call screen when risk crosses the line.
 *
 * Android blocks third-party apps from tapping the call audio stream directly, so this turns on
 * the speakerphone: the microphone then hears both people. That needs only RECORD_AUDIO and works
 * on every Android version.
 */
class CallGuardService : Service() {

    companion object {
        const val ACTION_START = "com.trace.guard.START"
        const val ACTION_STOP = "com.trace.guard.STOP"
        const val EXTRA_NUMBER = "number"
        const val EXTRA_SIMULATED = "simulated"

        /**
         * "record"  - MediaRecorder only. Use during a real call: the live recogniser is denied
         *             the microphone there, and running both makes them fight over it.
         * "listen"  - SpeechRecognizer only. Live transcript, for when no call is in progress.
         */
        const val EXTRA_MODE = "mode"
        const val MODE_RECORD = "record"
        const val MODE_LISTEN = "listen"

        @Volatile
        var mode = MODE_LISTEN
            private set
        const val BROADCAST_UPDATE = "com.trace.guard.UPDATE"
        private const val CHANNEL = "trace_guard"
        private const val NOTIF_ID = 4471

        @Volatile
        var running = false
            private set

        @Volatile
        var transcript = ""
            private set

        @Volatile
        var risk = 0
            private set

        @Volatile
        var markersFound: LinkedHashSet<ScamDetector.Marker> = LinkedHashSet()
            private set

        @Volatile
        var scam: ScamDetector.Scam? = null
            private set

        /** What is being said right now, before the recogniser commits it. Shown live in the app. */
        @Volatile
        var partial = ""
            private set

        /** The file the last call was recorded to, ready to play back and transcribe. */
        @Volatile
        var lastRecording: java.io.File? = null
            private set

        @Volatile
        var caller = "Unknown number"
            private set
    }

    private var recognizer: SpeechRecognizer? = null
    private var overlay: View? = null
    private var riskLabel: TextView? = null
    private var scamLabel: TextView? = null
    private var markerLabel: TextView? = null
    private val main = Handler(Looper.getMainLooper())
    private val hits = mutableListOf<ScamDetector.Hit>()
    private var stopped = false
    private var simulated = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopEverything()
                return START_NOT_STICKY
            }
            DemoBridge.ACTION_FEED -> {
                intent.getStringExtra(DemoBridge.EXTRA_LINE)?.let { pushLine(it) }
                return START_STICKY
            }
        }

        startForeground(NOTIF_ID, buildNotification("Listening for scam patterns"))
        reset()
        running = true
        stopped = false
        caller = intent?.getStringExtra(EXTRA_NUMBER) ?: "Unknown number"
        simulated = intent?.getBooleanExtra(EXTRA_SIMULATED, false) ?: false
        mode = intent?.getStringExtra(EXTRA_MODE) ?: MODE_LISTEN
        if (!simulated) {
            enableSpeakerphone()
            // exactly one of these: they cannot share the microphone
            if (mode == MODE_RECORD) {
                if (!Recorder.start(this)) {
                    pushLine("[could not open the microphone: ${Recorder.lastError ?: "unknown"}]")
                }
                startLevelMeter()
            } else {
                startListening()
            }
        }
        broadcast()
        return START_STICKY
    }

    /** Drives the on-screen level meter, so silence is visible rather than mysterious. */
    private fun startLevelMeter() {
        val tick = object : Runnable {
            override fun run() {
                if (stopped || !Recorder.recording) return
                Recorder.sampleLevel()
                broadcast()
                main.postDelayed(this, 150)
            }
        }
        main.postDelayed(tick, 300)
    }

    private fun reset() {
        hits.clear()
        transcript = ""
        partial = ""
        risk = 0
        markersFound = LinkedHashSet()
        scam = null
        main.post { hideOverlay() }
    }

    // ------------------------------------------------------------------ audio routing

    /** Speakerphone is what lets the microphone hear the caller too. */
    private fun enableSpeakerphone() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val speaker = am.availableCommunicationDevices.firstOrNull {
                    it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                }
                if (speaker != null) am.setCommunicationDevice(speaker)
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = true
            }
        } catch (_: Exception) {
            // some OEMs restrict this; the user can press the speaker button, detection still works
        }
    }

    // ------------------------------------------------------------------ transcription

    private fun startListening() {
        if (stopped) return
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            pushLine("[speech recognition unavailable on this device]")
            return
        }
        try {
            recognizer?.destroy()
        } catch (_: Exception) {
        }
        val rec = SpeechRecognizer.createSpeechRecognizer(this)
        rec.setRecognitionListener(listener)
        recognizer = rec

        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
        }
        try {
            rec.startListening(intent)
        } catch (_: Exception) {
            restartSoon()
        }
    }

    /** The recogniser stops after each utterance, so it is restarted for the whole call. */
    private fun restartSoon() {
        if (stopped) return
        main.postDelayed({ if (!stopped) startListening() }, 400)
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}

        override fun onError(error: Int) {
            // NO_MATCH and SPEECH_TIMEOUT are normal during silence: just listen again
            restartSoon()
        }

        override fun onResults(results: Bundle?) {
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            partial = ""
            if (!text.isNullOrBlank()) pushLine(text)
            restartSoon()
        }

        override fun onPartialResults(bundle: Bundle?) {
            val text = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            if (!text.isNullOrBlank()) {
                partial = text
                score(text, provisional = true)
            }
        }
    }

    /** Also used by DemoBridge, so a scripted line goes through the identical scoring path. */
    fun pushLine(line: String) {
        transcript = if (transcript.isEmpty()) line else transcript + "\n" + line
        score(line, provisional = false)
    }

    private fun score(line: String, provisional: Boolean) {
        val found = ScamDetector.detect(line)
        if (found.isNotEmpty() && !provisional) {
            hits.addAll(found)
            val next = LinkedHashSet(markersFound)
            found.forEach { next.add(it.marker) }
            markersFound = next
        }
        val considered = if (provisional) hits + found else hits
        val r = ScamDetector.risk(considered)
        if (r > risk) risk = r
        if (risk >= ScamDetector.WARN_THRESHOLD) {
            scam = ScamDetector.classify(transcript + "\n" + line)
            main.post { showOverlay() }
        }
        main.post { updateOverlay() }
        broadcast()
    }

    private fun broadcast() {
        sendBroadcast(Intent(BROADCAST_UPDATE).setPackage(packageName))
    }

    // ------------------------------------------------------------------ overlay warning

    private fun showOverlay() {
        if (overlay != null || stopped) return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) return

        val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        val d = resources.displayMetrics.density
        val pad = (16 * d).toInt()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#A63A2E"))
                cornerRadius = 8 * d
            }
        }
        root.addView(TextView(this).apply {
            text = "TRACE  ·  SCAM CALL DETECTED"
            setTextColor(Color.WHITE)
            textSize = 12f
        })
        val sl = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 20f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(0, pad / 2, 0, 0)
        }
        scamLabel = sl
        root.addView(sl)
        val ml = TextView(this).apply {
            setTextColor(Color.parseColor("#F0DAD6"))
            textSize = 13f
            setPadding(0, pad / 3, 0, 0)
        }
        markerLabel = ml
        root.addView(ml)
        val rl = TextView(this).apply {
            setTextColor(Color.WHITE)
            textSize = 13f
            setPadding(0, pad / 3, 0, 0)
        }
        riskLabel = rl
        root.addView(rl)
        root.addView(Button(this).apply {
            text = "I understand, dismiss"
            setOnClickListener { hideOverlay() }
        })

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val lp = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP
            y = (48 * d).toInt()
        }
        try {
            wm.addView(root, lp)
            overlay = root
            updateOverlay()
        } catch (_: Exception) {
        }
    }

    private fun updateOverlay() {
        scamLabel?.text = scam?.label ?: "Pressure detected on this call"
        markerLabel?.text = markersFound.joinToString(" · ") { it.label }
        riskLabel?.text = "Risk $risk/100.  " + (scam?.rebuttal ?: "")
    }

    private fun hideOverlay() {
        val v = overlay ?: return
        try {
            (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(v)
        } catch (_: Exception) {
        }
        overlay = null
    }

    // ------------------------------------------------------------------ lifecycle

    private fun stopEverything() {
        stopped = true
        running = false
        partial = ""
        if (Recorder.recording) {
            val f = Recorder.stop()
            if (f != null) lastRecording = f
        }
        try {
            recognizer?.stopListening()
            recognizer?.destroy()
        } catch (_: Exception) {
        }
        recognizer = null
        main.post { hideOverlay() }
        broadcast()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        stopped = true
        running = false
        try {
            recognizer?.destroy()
        } catch (_: Exception) {
        }
        main.post { hideOverlay() }
        super.onDestroy()
    }

    private fun buildNotification(text: String): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(
                NotificationChannel(CHANNEL, "Call protection", NotificationManager.IMPORTANCE_LOW)
            )
        }
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val b = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return b.setContentTitle("TRACE is protecting this call")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_lock_idle_lock)
            .setContentIntent(open)
            .setOngoing(true)
            .build()
    }
}
