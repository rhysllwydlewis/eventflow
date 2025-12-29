/**
 * Firebase Configuration Stub
 * Provides fallback when Firebase is not configured
 */

// Check if Firebase is available
let db = null;
let isFirebaseAvailable = false;

// Try to initialize Firebase if config exists
try {
  if (typeof firebase !== 'undefined' && window.__FIREBASE_CONFIG__) {
    firebase.initializeApp(window.__FIREBASE_CONFIG__);
    db = firebase.firestore();
    isFirebaseAvailable = true;
  }
} catch (err) {
  console.warn('Firebase not available:', err.message);
}

// Provide stub implementations if Firebase is not available
const collection = isFirebaseAvailable ? firebase.firestore().collection : () => null;
const doc = isFirebaseAvailable ? firebase.firestore().doc : () => null;
const addDoc = isFirebaseAvailable
  ? (col, data) => col.add(data)
  : () => Promise.reject(new Error('Firebase not configured'));
const getDoc = isFirebaseAvailable
  ? ref => ref.get()
  : () => Promise.reject(new Error('Firebase not configured'));
const getDocs = isFirebaseAvailable
  ? ref => ref.get()
  : () => Promise.reject(new Error('Firebase not configured'));
const updateDoc = isFirebaseAvailable
  ? (ref, data) => ref.update(data)
  : () => Promise.reject(new Error('Firebase not configured'));
const query = isFirebaseAvailable ? firebase.firestore().query : () => null;
const where = isFirebaseAvailable ? firebase.firestore().where : () => null;
const orderBy = isFirebaseAvailable ? firebase.firestore().orderBy : () => null;
const onSnapshot = isFirebaseAvailable
  ? (ref, callback) => ref.onSnapshot(callback)
  : () => () => {};
const serverTimestamp = isFirebaseAvailable
  ? firebase.firestore.FieldValue.serverTimestamp
  : () => new Date();
const Timestamp = isFirebaseAvailable
  ? firebase.firestore.Timestamp
  : { now: () => ({ seconds: Date.now() / 1000 }) };
const arrayUnion = isFirebaseAvailable
  ? firebase.firestore.FieldValue.arrayUnion
  : (...items) => items;

export {
  db,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  arrayUnion,
  isFirebaseAvailable,
};
