import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  collection,
  getDocs,
  increment,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBPtmnwZX-GjMqYQ7lG8rBeiFEwl-GA6hg",
  authDomain: "raizen-b31ce.firebaseapp.com",
  projectId: "raizen-b31ce",
  storageBucket: "raizen-b31ce.firebasestorage.app",
  messagingSenderId: "57228578905",
  appId: "1:57228578905:web:09b5fc124315d06ef16148",
  measurementId: "G-T1XHCPQ7E4",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

export { signInWithEmailAndPassword, signOut, onAuthStateChanged };

const ROOT = "raizenRoyale";

/* ---------- Single small document (settings only) ---------- */
export async function loadDoc(key, fallback) {
  try {
    const snap = await getDoc(doc(db, ROOT, key));
    if (snap.exists()) return snap.data().value;
    return fallback;
  } catch (e) {
    console.error("Firebase load error", e);
    return fallback;
  }
}

export async function saveDoc(key, value) {
  try {
    await setDoc(doc(db, ROOT, key), { value });
    return true;
  } catch (e) {
    console.error("Firebase save error", e);
    return false;
  }
}

export function watchDoc(key, callback) {
  return onSnapshot(doc(db, ROOT, key), (snap) => {
    if (snap.exists()) callback(snap.data().value);
  });
}

/* ---------- Collections: each item (game / payment method) gets its own document ---------- */
export async function loadCollection(name, fallback) {
  try {
    const snap = await getDocs(collection(db, ROOT + "_" + name));
    if (snap.empty) return fallback;
    return snap.docs.map((d) => d.data());
  } catch (e) {
    console.error("Firebase collection load error", e);
    return fallback;
  }
}

export async function saveItem(name, item) {
  try {
    await setDoc(doc(db, ROOT + "_" + name, item.id), item);
    return true;
  } catch (e) {
    console.error("Firebase item save error", e);
    return false;
  }
}

export async function deleteItem(name, id) {
  try {
    await deleteDoc(doc(db, ROOT + "_" + name, id));
    return true;
  } catch (e) {
    console.error("Firebase item delete error", e);
    return false;
  }
}

export function watchCollection(name, callback) {
  return onSnapshot(collection(db, ROOT + "_" + name), (snap) => {
    callback(snap.docs.map((d) => d.data()));
  });
}

/* ---------- Analytics counters (site visits, per-game download clicks) ---------- */
export async function incrementCounter(key) {
  try {
    await setDoc(doc(db, ROOT + "_stats", key), { count: increment(1) }, { merge: true });
    return true;
  } catch (e) {
    console.error("Firebase counter error", e);
    return false;
  }
}

export function watchCounters(callback) {
  return onSnapshot(collection(db, ROOT + "_stats"), (snap) => {
    const stats = {};
    snap.docs.forEach((d) => {
      stats[d.id] = d.data().count || 0;
    });
    callback(stats);
  });
}