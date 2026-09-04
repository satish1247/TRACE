/**
 * Firebase client app initialization for SHIELD.
 *
 * This file only touches `firebase/app` (config + app instance). Firestore
 * itself is only ever imported from `src/lib/shield/firestore.ts` — see that
 * file's header for why that boundary is a hard constraint, not a style
 * choice (SCHEMA.md: never write to a collection you do not own, enforced
 * here by having exactly one place writes can happen at all).
 *
 * Config values are `NEXT_PUBLIC_*` — public by design for Firebase web
 * apps; access is controlled by Firestore security rules, not by hiding
 * this key.
 */
import { getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function buildFirebaseConfig(): FirebaseOptions {
  return {
    apiKey: readRequiredEnv("NEXT_PUBLIC_FIREBASE_API_KEY"),
    authDomain: readRequiredEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"),
    projectId: readRequiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID"),
    storageBucket: readRequiredEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: readRequiredEnv("NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"),
    appId: readRequiredEnv("NEXT_PUBLIC_FIREBASE_APP_ID"),
  };
}

let cachedApp: FirebaseApp | null = null;

/** Returns the shared Firebase app instance, initializing it once. Safe to
 * call repeatedly (Next.js Fast Refresh re-executes modules in dev). */
export function getShieldFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  const existing = getApps();
  cachedApp = existing.length > 0 ? existing[0] : initializeApp(buildFirebaseConfig());
  return cachedApp;
}
