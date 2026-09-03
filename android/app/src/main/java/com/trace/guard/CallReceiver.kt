package com.trace.guard

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager

/**
 * Starts protection the moment a call is answered, and stops it when the call ends.
 * Registered in the manifest, so it fires even when the app is not open.
 */
class CallReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        @Suppress("DEPRECATION")
        val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER) ?: "Unknown number"

        when (state) {
            // OFFHOOK means the call is connected: start listening then, not while it is ringing
            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                val svc = Intent(context, CallGuardService::class.java).apply {
                    action = CallGuardService.ACTION_START
                    putExtra(CallGuardService.EXTRA_NUMBER, number)
                    // during a real call only the recorder can hold the microphone
                    putExtra(CallGuardService.EXTRA_MODE, CallGuardService.MODE_RECORD)
                }
                context.startForegroundService(svc)
            }
            TelephonyManager.EXTRA_STATE_IDLE -> {
                context.startService(
                    Intent(context, CallGuardService::class.java).apply {
                        action = CallGuardService.ACTION_STOP
                    }
                )
            }
        }
    }
}
