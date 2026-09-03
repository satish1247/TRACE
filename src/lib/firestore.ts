import type { State } from "./types";

/**
 * Firestore backend, server side, via the Admin SDK.
 * Loaded lazily by persist.ts and only when FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and
 * FIREBASE_PRIVATE_KEY are all set, so the app runs unchanged with no Firebase account.
 *
 * Document: demo/live — the whole State object plus a savedAt epoch-ms field.
 */

const COLLECTION = "demo";
const DOC = "live";

type FirestoreLike = {
  collection: (c: string) => {
    doc: (d: string) => {
      set: (data: Record<string, unknown>) => Promise<unknown>;
      get: () => Promise<{ exists: boolean; data: () => Record<string, unknown> | undefined }>;
    };
  };
};

let db: FirestoreLike | null = null;

async function getDb(): Promise<FirestoreLike> {
  if (db) return db;
  const admin = (await import("firebase-admin")) as unknown as {
    apps: unknown[];
    initializeApp: (o: unknown) => unknown;
    credential: { cert: (o: unknown) => unknown };
    firestore: (app?: unknown) => FirestoreLike;
  };
  const app = admin.apps?.length
    ? admin.apps[0]
    : admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // .env files escape newlines on Windows; restore them
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
  db = admin.firestore(app);
  return db;
}

export async function saveToFirestore(state: State): Promise<void> {
  const d = await getDb();
  // Firestore rejects undefined; a JSON round-trip strips it and any class instances
  const clean = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  await d.collection(COLLECTION).doc(DOC).set({ ...clean, savedAt: Date.now() });
}

export async function loadFromFirestore(): Promise<State | null> {
  const d = await getDb();
  const snap = await d.collection(COLLECTION).doc(DOC).get();
  if (!snap.exists) return null;
  const data = snap.data();
  if (!data) return null;
  delete data.savedAt;
  return data as unknown as State;
}
