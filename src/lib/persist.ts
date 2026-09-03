import type { State } from "./types";

/**
 * Durability for the live state.
 *
 * Two backends, chosen at runtime:
 *   - Firestore, when FIREBASE_* env vars are present: survives restarts, shared across devices.
 *   - A JSON snapshot on disk otherwise: survives restarts on this laptop, needs no account.
 *
 * Writes are debounced and always fire-and-forget: persistence must never slow down or break a
 * payment. If both backends fail the app keeps working from memory, which is why the demo is
 * safe even with the venue's wifi down.
 */

const SNAPSHOT = ".trace-state.json";
const DEBOUNCE_MS = 400;

let timer: NodeJS.Timeout | null = null;
let pending: State | null = null;
let mode: "firestore" | "file" | "memory" | null = null;

export function persistenceMode(): "firestore" | "file" | "memory" {
  return mode ?? "memory";
}

function firestoreConfigured(): boolean {
  return Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

/** Debounced save. Called by the reducer on every state change. */
export function persist(state: State): void {
  pending = state;
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    const s = pending;
    pending = null;
    if (s) void write(s);
  }, DEBOUNCE_MS);
}

async function write(state: State): Promise<void> {
  if (firestoreConfigured()) {
    try {
      const { saveToFirestore } = await import("./firestore");
      await saveToFirestore(state);
      mode = "firestore";
      return;
    } catch (e) {
      console.warn("[trace] firestore save failed, falling back to disk:", (e as Error).message);
    }
  }
  try {
    const { writeFile } = await import("node:fs/promises");
    await writeFile(SNAPSHOT, JSON.stringify(state), "utf8");
    mode = "file";
  } catch {
    mode = "memory";
  }
}

/** Called once at boot. Returns a saved state, or null to start fresh. */
export async function restore(): Promise<State | null> {
  if (firestoreConfigured()) {
    try {
      const { loadFromFirestore } = await import("./firestore");
      const s = await loadFromFirestore();
      if (s) {
        mode = "firestore";
        return s;
      }
    } catch (e) {
      console.warn("[trace] firestore restore failed:", (e as Error).message);
    }
  }
  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(SNAPSHOT, "utf8");
    mode = "file";
    return JSON.parse(raw) as State;
  } catch {
    mode = "memory";
    return null;
  }
}
