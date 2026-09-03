package com.trace.guard

import android.content.Context
import android.content.Intent

/**
 * Feeds a scripted line into the running detector, so the stage demo works without placing a real
 * call. The line goes through exactly the same scoring path as live speech, which is the point:
 * nothing about the detection is faked, only the audio source.
 */
object DemoBridge {
    const val ACTION_FEED = "com.trace.guard.FEED"
    const val EXTRA_LINE = "line"

    fun feed(context: Context, line: String) {
        context.startService(
            Intent(context, CallGuardService::class.java).apply {
                action = ACTION_FEED
                putExtra(EXTRA_LINE, line)
            }
        )
    }
}
