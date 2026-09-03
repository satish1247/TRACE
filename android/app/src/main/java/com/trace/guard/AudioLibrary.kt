package com.trace.guard

import android.content.ContentUris
import android.content.Context
import android.net.Uri
import android.provider.MediaStore

/**
 * Finds recordings already on the phone.
 *
 * The stock voice recorder, and on many Indian handsets the dialer's own call recorder, are
 * system apps with privileges a third-party app does not get. Whatever they save, we can read.
 * That is the reliable way to get real call audio into TRACE.
 */
object AudioLibrary {

    data class Item(val uri: Uri, val name: String, val sizeKb: Long, val added: Long, val folder: String) {
        /** Folders the OEM dialers and recorders actually use. */
        val looksLikeCall: Boolean
            get() {
                val f = folder.lowercase()
                val n = name.lowercase()
                return f.contains("call") || f.contains("record") || f.contains("sound_recorder") ||
                    n.startsWith("call") || n.contains("call_rec")
            }

        fun describe(): String {
            val ago = (System.currentTimeMillis() / 1000) - added
            val whenText = when {
                ago < 60 -> "${ago}s ago"
                ago < 3600 -> "${ago / 60} min ago"
                ago < 86400 -> "${ago / 3600} h ago"
                else -> "${ago / 86400} d ago"
            }
            return "$sizeKb KB · $whenText" + if (folder.isNotEmpty()) " · $folder" else ""
        }
    }

    /** Most recent audio files, newest first. Anything that looks like a recording floats up. */
    fun recent(context: Context, limit: Int = 12): List<Item> {
        val out = mutableListOf<Item>()
        val projection = arrayOf(
            MediaStore.Audio.Media._ID,
            MediaStore.Audio.Media.DISPLAY_NAME,
            MediaStore.Audio.Media.SIZE,
            MediaStore.Audio.Media.DATE_ADDED,
            MediaStore.Audio.Media.RELATIVE_PATH
        )
        try {
            context.contentResolver.query(
                MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,
                projection,
                null,
                null,
                "${MediaStore.Audio.Media.DATE_ADDED} DESC"
            )?.use { c ->
                val idCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media._ID)
                val nameCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DISPLAY_NAME)
                val sizeCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.SIZE)
                val dateCol = c.getColumnIndexOrThrow(MediaStore.Audio.Media.DATE_ADDED)
                val pathCol = c.getColumnIndex(MediaStore.Audio.Media.RELATIVE_PATH)
                var seen = 0
                while (c.moveToNext() && seen < limit * 4) {
                    seen++
                    val id = c.getLong(idCol)
                    out.add(
                        Item(
                            uri = ContentUris.withAppendedId(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, id),
                            name = c.getString(nameCol) ?: "recording",
                            sizeKb = c.getLong(sizeCol) / 1024,
                            added = c.getLong(dateCol),
                            folder = if (pathCol >= 0) c.getString(pathCol) ?: "" else ""
                        )
                    )
                }
            }
        } catch (_: Exception) {
            // no permission, or an OEM that hides its recordings: the file picker still works
        }
        return out
            .sortedWith(compareByDescending<Item> { it.looksLikeCall }.thenByDescending { it.added })
            .take(limit)
    }
}
