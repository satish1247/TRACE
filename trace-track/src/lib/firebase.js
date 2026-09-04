import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, getDocs, getDoc, addDoc, serverTimestamp, writeBatch, where } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAC_YSGog9VIOMe1fXB0y-dHkVfoEuzE_A",
  authDomain: "trace-180.firebaseapp.com",
  projectId: "trace-180",
  storageBucket: "trace-180.firebasestorage.app",
  messagingSenderId: "713326451610",
  appId: "1:713326451610:web:e038eceb8661e6b11ef823",
  measurementId: "G-RPYH0GXMKZ"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// --- AUTH ---
export { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged };

// vpaKey: replace . and @ with _ so Firestore paths don't break
export function vpaKey(vpa) {
  return vpa.replace(/[.@]/g, '_');
}

// --- INCIDENTS ---
export function subscribeIncidents(callback) {
  const q = query(collection(db, 'incidents'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export function subscribeIncident(incidentId, callback) {
  return onSnapshot(doc(db, 'incidents', incidentId), (snap) => {
    if (snap.exists()) {
      callback({ id: snap.id, ...snap.data() });
    }
  });
}

export async function createIncident(data) {
  const ref = doc(collection(db, 'incidents'));
  await setDoc(ref, { ...data, createdAt: Date.now() });
  return ref.id;
}

export async function updateIncident(incidentId, data) {
  await updateDoc(doc(db, 'incidents', incidentId), data);
}

// --- HOPS ---
export function subscribeHops(incidentId, callback) {
  const q = query(collection(db, 'incidents', incidentId, 'hops'), orderBy('hop', 'asc'));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}

export async function addHop(incidentId, hopData) {
  const ref = doc(collection(db, 'incidents', incidentId, 'hops'));
  await setDoc(ref, hopData);
  return ref.id;
}

// --- ACCOUNTS ---
export async function flagAccount(vpa, incidentId) {
  const key = vpaKey(vpa);
  await setDoc(doc(db, 'accounts', key), {
    vpa,
    flagged: true,
    reportedAt: Date.now(),
    incidentId
  });
}

export async function isAccountFlagged(vpa) {
  try {
    const key = vpaKey(vpa);
    const snap = await getDoc(doc(db, 'accounts', key));
    return snap.exists() && snap.data().flagged;
  } catch (err) {
    console.warn('isAccountFlagged check failed (Firestore may not be ready):', err.message);
    return false;
  }
}

export { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, getDocs, getDoc, addDoc, writeBatch, where };
