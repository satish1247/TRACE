/**
 * The ONLY file in SHIELD that imports `firebase/firestore`.
 *
 * SCHEMA.md (the shared team contract): "never write to a collection you do
 * not own." SHIELD owns `calls` and `detections` only. Funnelling every
 * Firestore write through this one module — with the collection names
 * hardcoded below, never passed in — is what makes that rule mechanically
 * enforceable instead of just a comment other files could ignore.
 *
 * Every write is validated against a `zod` schema mirroring `SCHEMA.md`'s
 * shapes before it reaches Firestore. `writeCall` is debounced ~300ms so a
 * fast-typing/fast-speaking session doesn't spam Firestore with one write
 * per keystroke or per transcript line.
 */
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { z } from "zod";
import { getShieldFirebaseApp } from "./firebase";
import type { Call, Detection } from "./types";

export type { Unsubscribe };

const CALLS_COLLECTION = "calls";
const DETECTIONS_COLLECTION = "detections";
const DEBOUNCE_MS = 300;

const SpeakerSchema = z.enum(["caller", "user"]);
const MarkerIdSchema = z.enum(["authority", "threat", "isolation", "demand", "blocking"]);
const DetectionKindSchema = z.enum(["voice", "face", "transcript"]);
const DetectionVerdictSchema = z.enum(["real", "fake", "uncertain"]);

const TranscriptLineSchema = z.object({
  speaker: SpeakerSchema,
  text: z.string(),
  at: z.number(),
});

const CallSchema = z.object({
  startedAt: z.number(),
  callerId: z.string(),
  callerName: z.string(),
  transcript: z.array(TranscriptLineSchema),
  markers: z.array(MarkerIdSchema),
  risk: z.number().min(0).max(100),
  scamType: z.string().nullable(),
  active: z.boolean(),
});

/** `writeCall` takes a partial patch — every field is still validated
 * against its full-shape rule when present. */
const CallPatchSchema = CallSchema.partial();

const DetectionSchema = z.object({
  at: z.number(),
  kind: DetectionKindSchema,
  verdict: DetectionVerdictSchema,
  confidence: z.number().min(0).max(1),
  model: z.string(),
  evidence: z.record(z.union([z.string(), z.number()])),
  callId: z.string().nullable(),
});

function toError(cause: unknown, fallbackMessage: string): Error {
  if (cause instanceof Error) return cause;
  return new Error(fallbackMessage);
}

interface PendingCallWrite {
  patch: Partial<Call>;
  timer: ReturnType<typeof setTimeout>;
  resolvers: Array<() => void>;
  rejecters: Array<(error: Error) => void>;
}

const pendingCallWrites = new Map<string, PendingCallWrite>();

async function flushCallWrite(callId: string): Promise<void> {
  const pending = pendingCallWrites.get(callId);
  if (!pending) return;
  pendingCallWrites.delete(callId);

  try {
    const db = getFirestore(getShieldFirebaseApp());
    await setDoc(doc(db, CALLS_COLLECTION, callId), pending.patch, { merge: true });
    pending.resolvers.forEach((resolve) => resolve());
  } catch (cause: unknown) {
    const error = toError(cause, "Unknown Firestore write error");
    console.error(`SHIELD: failed to write ${CALLS_COLLECTION}/${callId}`, error);
    pending.rejecters.forEach((reject) => reject(error));
  }
}

/**
 * Debounced (~300ms) partial write to `calls/{callId}`. Multiple calls
 * within the debounce window are merged into one Firestore write; every
 * caller's returned promise resolves/rejects together with that write.
 */
export function writeCall(callId: string, patch: Partial<Call>): Promise<void> {
  const validatedPatch = CallPatchSchema.parse(patch);

  return new Promise<void>((resolve, reject) => {
    const existing = pendingCallWrites.get(callId);
    if (existing) {
      clearTimeout(existing.timer);
      const merged: PendingCallWrite = {
        patch: { ...existing.patch, ...validatedPatch },
        resolvers: [...existing.resolvers, resolve],
        rejecters: [...existing.rejecters, reject],
        timer: setTimeout(() => {
          void flushCallWrite(callId);
        }, DEBOUNCE_MS),
      };
      pendingCallWrites.set(callId, merged);
      return;
    }

    const entry: PendingCallWrite = {
      patch: validatedPatch,
      resolvers: [resolve],
      rejecters: [reject],
      timer: setTimeout(() => {
        void flushCallWrite(callId);
      }, DEBOUNCE_MS),
    };
    pendingCallWrites.set(callId, entry);
  });
}

/** Immediate write of a new `detections/{id}` document. Returns the new
 * document's id. */
export async function writeDetection(detection: Detection): Promise<string> {
  const validated = DetectionSchema.parse(detection);
  try {
    const db = getFirestore(getShieldFirebaseApp());
    const ref = await addDoc(collection(db, DETECTIONS_COLLECTION), validated);
    return ref.id;
  } catch (cause: unknown) {
    const error = toError(cause, "Unknown Firestore write error");
    console.error(`SHIELD: failed to write ${DETECTIONS_COLLECTION}`, error);
    throw error;
  }
}

/**
 * Subscribe to live changes on `calls/{callId}`. Malformed documents (that
 * fail `CallSchema`) are logged and skipped rather than passed to `onChange`,
 * so the UI never renders a shape it doesn't expect.
 */
export function subscribeToCall(callId: string, onChange: (call: Call) => void): Unsubscribe {
  const db = getFirestore(getShieldFirebaseApp());
  return onSnapshot(
    doc(db, CALLS_COLLECTION, callId),
    (snapshot) => {
      if (!snapshot.exists()) return;
      const parsed = CallSchema.safeParse(snapshot.data());
      if (!parsed.success) {
        console.error(`SHIELD: malformed ${CALLS_COLLECTION}/${callId} document`, parsed.error);
        return;
      }
      onChange(parsed.data);
    },
    (cause: unknown) => {
      console.error(`SHIELD: subscribeToCall error for ${callId}`, toError(cause, "Unknown Firestore listen error"));
    },
  );
}
