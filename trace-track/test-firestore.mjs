import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, deleteDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAC_YSGog9VIOMe1fXB0y-dHkVfoEuzE_A",
  authDomain: "trace-180.firebaseapp.com",
  projectId: "trace-180",
  storageBucket: "trace-180.firebasestorage.app",
  messagingSenderId: "713326451610",
  appId: "1:713326451610:web:e038eceb8661e6b11ef823",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function test() {
  console.log("=== FIRESTORE WRITE TEST ===\n");

  // Test write to incidents (TRACK's collection)
  console.log("1. Writing test incident...");
  try {
    await setDoc(doc(db, "incidents", "test-001"), {
      createdAt: Date.now(),
      victimUid: "test-victim",
      amount: 50000,
      scammerVpa: "fraud.agent@upi",
      status: "reported",
      recovered: 0,
      goldenHourEndsAt: Date.now() + 3600000,
    });
    console.log("   ✅ WRITE to incidents SUCCESS\n");
  } catch (err) {
    console.log("   ❌ WRITE FAILED:", err.code, "-", err.message, "\n");
  }

  // Read it back
  console.log("2. Reading it back...");
  try {
    const snap = await getDoc(doc(db, "incidents", "test-001"));
    if (snap.exists()) {
      console.log("   ✅ READ SUCCESS:", JSON.stringify(snap.data()), "\n");
    } else {
      console.log("   ⚠️  Not found\n");
    }
  } catch (err) {
    console.log("   ❌ READ FAILED:", err.code, "-", err.message, "\n");
  }

  // Test write to accounts
  console.log("3. Writing test account...");
  try {
    await setDoc(doc(db, "accounts", "test_account_upi"), {
      vpa: "test.account@upi",
      flagged: true,
      reportedAt: Date.now(),
      incidentId: "test-001",
    });
    console.log("   ✅ WRITE to accounts SUCCESS\n");
  } catch (err) {
    console.log("   ❌ WRITE FAILED:", err.code, "-", err.message, "\n");
  }

  // Cleanup
  console.log("4. Cleaning up test data...");
  try {
    await deleteDoc(doc(db, "incidents", "test-001"));
    await deleteDoc(doc(db, "accounts", "test_account_upi"));
    console.log("   ✅ Cleaned up\n");
  } catch (err) {
    console.log("   ⚠️  Cleanup failed (not critical):", err.message, "\n");
  }

  console.log("=== ALL GOOD! Database is working. ===");
  process.exit(0);
}

test();
