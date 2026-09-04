// Watches SHIELD's `calls` collection for an active, flagged call so TRACK
// can link an incident back to it instead of always simulating one blind.
// SHIELD owns `calls`; this only reads it (SCHEMA.md: never write to a
// collection you do not own — read-only here, same as PRD-2-TRACK.md expects).
//
// Deliberately a single equality filter (`active == true`) with no `orderBy`,
// so Firestore never needs a composite index — "most recent" is picked
// client-side instead, which is fine at hackathon-demo scale (one active
// call at a time in practice).
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from './firebase';

/** PRD-1-SHIELD.md: "Warn at 45." Mirrors SHIELD's own WARN_THRESHOLD. */
export const SHIELD_WARN_THRESHOLD = 45;

/**
 * Subscribes to the most recently started `calls/{callId}` document with
 * `active === true`. Calls `callback(null)` when there is none, or on any
 * subscription error (never throws into the caller).
 */
export function subscribeActiveShieldCall(callback) {
  const q = query(collection(db, 'calls'), where('active', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        callback(null);
        return;
      }
      let latest = null;
      snap.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        if (!latest || (data.startedAt || 0) > (latest.startedAt || 0)) {
          latest = data;
        }
      });
      callback(latest);
    },
    (err) => {
      console.warn('shieldCallWatcher: subscription failed', err.message);
      callback(null);
    },
  );
}
