"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getFirestore, type Firestore } from "firebase/firestore";

/**
 * One Firebase app for all three modules. Import `db` and use onSnapshot; never poll.
 * These keys are public by design: security comes from Firestore rules, not from hiding them.
 */
const firebaseConfig = {
  apiKey: "AIzaSyAC_YSGog9VIOMe1fXB0y-dHkVfoEuzE_A",
  authDomain: "trace-180.firebaseapp.com",
  projectId: "trace-180",
  storageBucket: "trace-180.firebasestorage.app",
  messagingSenderId: "713326451610",
  appId: "1:713326451610:web:e038eceb8661e6b11ef823",
  measurementId: "G-RPYH0GXMKZ",
};

export const app: FirebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db: Firestore = getFirestore(app);

/** Firestore document ids cannot contain '/', and '.' or '@' make paths awkward. */
export function vpaKey(vpa: string): string {
  return vpa.toLowerCase().replace(/[.@]/g, "_");
}
