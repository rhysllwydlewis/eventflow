/**
 * Firebase Configuration Stub
 * Provides fallback when Firebase is not configured
 */

// Check if Firebase is available
let db = null;
let isFirebaseAvailable = false;
let firestoreInstance = null;
let storageInstance = null;
let authInstance = null;

// Try to initialize Firebase if config exists
try {
  if (typeof firebase !== 'undefined' && window.__FIREBASE_CONFIG__) {
    firebase.initializeApp(window.__FIREBASE_CONFIG__);
    firestoreInstance = firebase.firestore();
    db = firestoreInstance;
    
    // Initialize storage if available
    if (firebase.storage) {
      storageInstance = firebase.storage();
    }
    
    // Initialize auth if available
    if (firebase.auth) {
      authInstance = firebase.auth();
    }
    
    isFirebaseAvailable = true;
  }
} catch (err) {
  console.warn('Firebase not available:', err.message);
}

// Provide stub implementations if Firebase is not available
const collection = isFirebaseAvailable
  ? (...args) => firestoreInstance.collection(...args)
  : () => null;
const doc = isFirebaseAvailable ? (...args) => firestoreInstance.doc(...args) : () => null;
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
const query = isFirebaseAvailable ? (...args) => firestoreInstance.query(...args) : () => null;
const where = isFirebaseAvailable ? (...args) => firestoreInstance.where(...args) : () => null;
const orderBy = isFirebaseAvailable ? (...args) => firestoreInstance.orderBy(...args) : () => null;
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

// Storage exports
const storage = storageInstance || null;
const ref = isFirebaseAvailable && storageInstance
  ? (storageRef, path) => storageRef.ref(path)
  : () => null;
const uploadBytes = isFirebaseAvailable && storageInstance
  ? (ref, data) => ref.put(data)
  : () => Promise.reject(new Error('Firebase Storage not configured'));
const getDownloadURL = isFirebaseAvailable && storageInstance
  ? ref => ref.getDownloadURL()
  : () => Promise.reject(new Error('Firebase Storage not configured'));
const deleteObject = isFirebaseAvailable && storageInstance
  ? ref => ref.delete()
  : () => Promise.reject(new Error('Firebase Storage not configured'));

// Auth exports
const auth = authInstance || null;
const onAuthStateChanged = isFirebaseAvailable && authInstance
  ? (callback) => authInstance.onAuthStateChanged(callback)
  : () => () => {};

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
  // Storage exports
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  // Auth exports
  auth,
  onAuthStateChanged,
};
