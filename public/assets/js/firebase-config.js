/**
 * Firebase Configuration Stub
 *
 * NOTE: This project uses MongoDB as the database and Cloudinary for image storage.
 * Firebase/Firestore is NOT in use. This file exists only to prevent module import
 * errors in legacy code that hasn't been migrated yet.
 *
 * All exports are non-functional stubs that log warnings when called.
 */

// Firebase is not configured - all functions are stubs
const isFirebaseAvailable = false;
const db = null;

// Stub functions that log warnings
const warnNotConfigured = feature => {
  console.warn(
    `Firebase ${feature} is not configured. This project uses MongoDB/Cloudinary instead.`
  );
};

// Firestore stubs
const collection = () => {
  warnNotConfigured('Firestore');
  return null;
};
const doc = () => {
  warnNotConfigured('Firestore');
  return null;
};
const addDoc = () => {
  warnNotConfigured('Firestore');
  return Promise.reject(new Error('Firebase not configured - use MongoDB API instead'));
};
const getDoc = () => {
  warnNotConfigured('Firestore');
  return Promise.reject(new Error('Firebase not configured - use MongoDB API instead'));
};
const getDocs = () => {
  warnNotConfigured('Firestore');
  return Promise.reject(new Error('Firebase not configured - use MongoDB API instead'));
};
const updateDoc = () => {
  warnNotConfigured('Firestore');
  return Promise.reject(new Error('Firebase not configured - use MongoDB API instead'));
};
const query = () => {
  warnNotConfigured('Firestore');
  return null;
};
const where = () => {
  warnNotConfigured('Firestore');
  return null;
};
const orderBy = () => {
  warnNotConfigured('Firestore');
  return null;
};
const onSnapshot = () => {
  warnNotConfigured('Firestore');
  return () => {};
};
const serverTimestamp = () => {
  warnNotConfigured('Firestore');
  return new Date();
};
const Timestamp = {
  now: () => {
    warnNotConfigured('Firestore');
    return { seconds: Math.floor(Date.now() / 1000) };
  },
};
const arrayUnion = (...items) => {
  warnNotConfigured('Firestore');
  return items;
};

// Storage stubs
const storage = null;
const ref = () => {
  warnNotConfigured('Storage');
  return null;
};
const uploadBytes = () => {
  warnNotConfigured('Storage');
  return Promise.reject(new Error('Firebase Storage not configured - use Cloudinary API instead'));
};
const getDownloadURL = () => {
  warnNotConfigured('Storage');
  return Promise.reject(new Error('Firebase Storage not configured - use Cloudinary API instead'));
};
const deleteObject = () => {
  warnNotConfigured('Storage');
  return Promise.reject(new Error('Firebase Storage not configured - use Cloudinary API instead'));
};

// Auth stubs
const auth = null;
const onAuthStateChanged = () => {
  warnNotConfigured('Auth');
  return () => {};
};

// Export all stubs to prevent import errors
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
