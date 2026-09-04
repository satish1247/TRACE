/**
 * Dual-Layer Reactive Store for TRACE Agent Module.
 * Provides instant in-memory reactive state with zero latency,
 * and seamlessly synchronizes with Firestore (with automatic graceful fallback
 * if Firestore permissions or connectivity are restricted).
 */
import { db } from "./firebase.js";
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { validatePayment } from "./engine.js";

const AGENT_TASKS = "agentTasks";
const USERS = "users";

// ─── Local In-Memory & LocalStorage State ──────────────────────────────
const memoryUsers = new Map([
  [
    "lakshmi",
    {
      id: "lakshmi",
      name: "Lakshmi Devi",
      vpa: "lakshmi@upi",
      balance: 12000,
      guardianUid: "guardian_priya",
      agentLimit: 2000,
      thresholdShift: 0,
      isFrozen: false,
    },
  ],
  [
    "guardian_priya",
    {
      id: "guardian_priya",
      name: "Priya (Daughter)",
      vpa: "priya@upi",
      balance: 50000,
      guardianUid: null,
      agentLimit: 99999,
      thresholdShift: 0,
    },
  ],
]);

const memoryTasks = new Map();
const userListeners = new Map(); // uid -> Set of callbacks
const taskListeners = new Map(); // taskId -> Set of callbacks
const allTasksListeners = new Set(); // Set of callbacks

function notifyUserListeners(uid) {
  const user = memoryUsers.get(uid);
  if (!user) return;
  const listeners = userListeners.get(uid);
  if (listeners) {
    listeners.forEach((cb) => {
      try {
        cb({ ...user });
      } catch (err) {
        console.error("User listener error:", err);
      }
    });
  }
}

function notifyTaskListeners(taskId) {
  const task = memoryTasks.get(taskId);
  if (!task) return;
  const listeners = taskListeners.get(taskId);
  if (listeners) {
    listeners.forEach((cb) => {
      try {
        cb({ ...task });
      } catch (err) {
        console.error("Task listener error:", err);
      }
    });
  }
  notifyAllTasksListeners();
}

function notifyAllTasksListeners() {
  const tasks = Array.from(memoryTasks.values()).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
  allTasksListeners.forEach((cb) => {
    try {
      cb([...tasks]);
    } catch (err) {
      console.error("All tasks listener error:", err);
    }
  });
}

// ─── Seed Users ──────────────────────────────────────────────────────
export async function seedUsers() {
  // Ensure local memory users exist
  notifyUserListeners("lakshmi");
  notifyUserListeners("guardian_priya");

  // Attempt Firestore sync in background
  try {
    const userRef = doc(db, USERS, "lakshmi");
    const guardianRef = doc(db, USERS, "guardian_priya");

    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      await setDoc(userRef, memoryUsers.get("lakshmi"));
    } else {
      memoryUsers.set("lakshmi", { id: userSnap.id, ...userSnap.data() });
      notifyUserListeners("lakshmi");
    }

    const guardianSnap = await getDoc(guardianRef);
    if (!guardianSnap.exists()) {
      await setDoc(guardianRef, memoryUsers.get("guardian_priya"));
    } else {
      memoryUsers.set("guardian_priya", { id: guardianSnap.id, ...guardianSnap.data() });
      notifyUserListeners("guardian_priya");
    }
  } catch (err) {
    // Gracefully continue with in-memory state if permission denied
    console.info("Firestore seed skipped (using in-memory fallback):", err.message || err);
  }
}

// ─── Read & Subscribe User ───────────────────────────────────────────
export async function getUser(uid) {
  const local = memoryUsers.get(uid);
  if (local) return { ...local };

  try {
    const snap = await getDoc(doc(db, USERS, uid));
    if (snap.exists()) {
      const data = { id: snap.id, ...snap.data() };
      memoryUsers.set(uid, data);
      return data;
    }
  } catch (err) {
    // Fallback to memory
  }
  return memoryUsers.get(uid) || null;
}

export function subscribeUser(uid, callback) {
  if (!userListeners.has(uid)) {
    userListeners.set(uid, new Set());
  }
  userListeners.get(uid).add(callback);

  // Immediately notify with current state
  const current = memoryUsers.get(uid);
  if (current) {
    callback({ ...current });
  }

  // Also hook into Firestore with graceful error handler
  let fsUnsub = null;
  try {
    fsUnsub = onSnapshot(
      doc(db, USERS, uid),
      (snap) => {
        if (snap.exists()) {
          const updated = { id: snap.id, ...snap.data() };
          memoryUsers.set(uid, updated);
          callback(updated);
        }
      },
      (err) => {
        // Suppress uncaught permission error and rely on local state
      }
    );
  } catch (e) {}

  return () => {
    const set = userListeners.get(uid);
    if (set) set.delete(callback);
    if (fsUnsub) {
      try {
        fsUnsub();
      } catch (e) {}
    }
  };
}

/** Update senior's spending limit remotely (from Guardian or Senior) */
export async function updateUserLimit(uid, newLimit) {
  const limitVal = Number(newLimit);
  const user = memoryUsers.get(uid) || { id: uid };
  user.agentLimit = limitVal;
  memoryUsers.set(uid, user);
  notifyUserListeners(uid);

  try {
    const userRef = doc(db, USERS, uid);
    await updateDoc(userRef, { agentLimit: limitVal });
  } catch (err) {
    // Local state already updated
  }
}

/** Toggle emergency freeze on senior's account */
export async function toggleUserFreeze(uid, isFrozen) {
  const user = memoryUsers.get(uid) || { id: uid };
  user.isFrozen = Boolean(isFrozen);
  memoryUsers.set(uid, user);
  notifyUserListeners(uid);

  try {
    const userRef = doc(db, USERS, uid);
    await updateDoc(userRef, { isFrozen: Boolean(isFrozen) });
  } catch (err) {
    // Local state already updated
  }
}

/** Reset demo balance to ₹12,000 for easy repeated testing */
export async function resetDemoBalance(uid = "lakshmi") {
  const user = memoryUsers.get(uid) || { id: uid };
  user.balance = 12000;
  user.isFrozen = false;
  memoryUsers.set(uid, user);
  notifyUserListeners(uid);

  try {
    const userRef = doc(db, USERS, uid);
    await updateDoc(userRef, { balance: 12000, isFrozen: false });
  } catch (err) {
    // Local state already updated
  }
}

// ─── Agent Task CRUD ─────────────────────────────────────────────────
export async function createTask({
  uid,
  request,
  limit,
  category = "booking",
  merchant = null,
  officialSite = null,
  reference = null,
  isPredatoryLoan = false,
}) {
  const taskId = "task_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
  const taskData = {
    id: taskId,
    createdAt: Date.now(),
    uid,
    request,
    category,
    merchant,
    officialSite,
    reference,
    isPredatoryLoan,
    steps: [],
    price: 0,
    limit,
    status: "searching",
    approverUid: null,
  };

  // Store in memory first for zero-latency UI responsiveness
  memoryTasks.set(taskId, taskData);
  notifyTaskListeners(taskId);

  // Sync to Firestore in background
  try {
    const ref = await addDoc(collection(db, AGENT_TASKS), {
      ...taskData,
    });
    // If Firestore provides an ID, link it
    if (ref.id && ref.id !== taskId) {
      const fsData = { ...taskData, id: ref.id };
      memoryTasks.set(ref.id, fsData);
      notifyTaskListeners(ref.id);
      return ref.id;
    }
  } catch (err) {
    console.info("Firestore addDoc task skipped (using local task):", err.message || err);
  }

  return taskId;
}

export async function addStep(taskId, text, meta = {}) {
  const task = memoryTasks.get(taskId);
  if (task) {
    task.steps = [...(task.steps || []), { at: Date.now(), text, ...meta }];
    memoryTasks.set(taskId, task);
    notifyTaskListeners(taskId);
  }

  try {
    const ref = doc(db, AGENT_TASKS, taskId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const steps = [...(data.steps || []), { at: Date.now(), text, ...meta }];
      await updateDoc(ref, { steps });
    }
  } catch (err) {}
}

export async function updateTaskStatus(taskId, status, extra = {}) {
  const task = memoryTasks.get(taskId);
  if (task) {
    Object.assign(task, { status, ...extra });
    memoryTasks.set(taskId, task);
    notifyTaskListeners(taskId);
  }

  try {
    await updateDoc(doc(db, AGENT_TASKS, taskId), { status, ...extra });
  } catch (err) {}
}

export async function setTaskPrice(taskId, price) {
  const task = memoryTasks.get(taskId);
  if (task) {
    task.price = price;
    memoryTasks.set(taskId, task);
    notifyTaskListeners(taskId);
  }

  try {
    await updateDoc(doc(db, AGENT_TASKS, taskId), { price });
  } catch (err) {}
}

/**
 * Pay — enforces limit at write time, not only UI.
 * Returns { success, reason, newBalance }
 */
export async function payTask(taskId, guardianApproved = false) {
  const task = memoryTasks.get(taskId) || {};
  const user = memoryUsers.get(task.uid || "lakshmi") || {};

  // 1. Emergency freeze check
  if (user && user.isFrozen) {
    return { success: false, reason: "Account is emergency frozen by Guardian" };
  }

  // 2. Strict limit validation
  const { allowed, reason } = validatePayment(
    task.price || 0,
    task.limit || 0,
    guardianApproved,
    task.isPredatoryLoan
  );
  if (!allowed) return { success: false, reason };

  // 3. Deduct senior balance
  let newBalance = user.balance || 0;
  if ((task.price || 0) > 0 && user) {
    newBalance = Math.max(0, user.balance - task.price);
    user.balance = newBalance;
    memoryUsers.set(user.id || "lakshmi", user);
    notifyUserListeners(user.id || "lakshmi");
  }

  // 4. Update task to paid
  task.status = "paid";
  task.paidAt = Date.now();
  memoryTasks.set(taskId, task);
  notifyTaskListeners(taskId);

  // Background Firestore sync
  try {
    const userRef = doc(db, USERS, task.uid || "lakshmi");
    await updateDoc(userRef, { balance: newBalance });
    await updateDoc(doc(db, AGENT_TASKS, taskId), {
      status: "paid",
      paidAt: Date.now(),
    });
  } catch (err) {}

  return { success: true, reason: "Payment complete", newBalance };
}

/** Guardian approves a task */
export async function approveTask(taskId) {
  return payTask(taskId, true);
}

/** Guardian declines a task */
export async function declineTask(taskId) {
  const task = memoryTasks.get(taskId);
  if (task) {
    task.status = "declined";
    task.decidedAt = Date.now();
    memoryTasks.set(taskId, task);
    notifyTaskListeners(taskId);
  }

  try {
    await updateDoc(doc(db, AGENT_TASKS, taskId), {
      status: "declined",
      decidedAt: Date.now(),
    });
  } catch (err) {}

  return { success: true, reason: "Declined by guardian" };
}

// ─── Realtime Subscriptions ──────────────────────────────────────────
export function subscribeTask(taskId, callback) {
  if (!taskListeners.has(taskId)) {
    taskListeners.set(taskId, new Set());
  }
  taskListeners.get(taskId).add(callback);

  // Immediately notify if cached
  const current = memoryTasks.get(taskId);
  if (current) {
    callback({ ...current });
  }

  let fsUnsub = null;
  try {
    fsUnsub = onSnapshot(
      doc(db, AGENT_TASKS, taskId),
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          memoryTasks.set(taskId, data);
          callback(data);
        }
      },
      () => {}
    );
  } catch (e) {}

  return () => {
    const set = taskListeners.get(taskId);
    if (set) set.delete(callback);
    if (fsUnsub) {
      try {
        fsUnsub();
      } catch (e) {}
    }
  };
}

export function subscribeGuardianTasks(callback) {
  allTasksListeners.add(callback);

  // Immediately notify with existing cached tasks
  const tasks = Array.from(memoryTasks.values()).sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  );
  callback([...tasks]);

  let fsUnsub = null;
  try {
    fsUnsub = onSnapshot(
      collection(db, AGENT_TASKS),
      (snapshot) => {
        snapshot.forEach((docSnap) => {
          const data = { id: docSnap.id, ...docSnap.data() };
          memoryTasks.set(docSnap.id, data);
        });
        const currentTasks = Array.from(memoryTasks.values()).sort(
          (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
        );
        callback(currentTasks);
      },
      () => {}
    );
  } catch (e) {}

  return () => {
    allTasksListeners.delete(callback);
    if (fsUnsub) {
      try {
        fsUnsub();
      } catch (e) {}
    }
  };
}
