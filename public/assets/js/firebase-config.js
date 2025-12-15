/**
 * Firebase Configuration for EventFlow
 * Initializes Firebase SDK with Firestore, Storage, and Authentication
 *
 * SECURITY NOTE: Firebase API keys are safe to expose in client-side code.
 * They are not secret keys and are meant to be public. Security is enforced
 * through Firestore and Storage security rules, not API key protection.
 * See: https://firebase.google.com/docs/projects/api-keys
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp,
  serverTimestamp,
  writeBatch,
  arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

// Firebase configuration
// These values are safe to expose as security is enforced via Firestore rules
const firebaseConfig = {
  apiKey: 'AIzaSyAbFoGEvaAQcAvjL716cPSs1KDMkriahqc',
  authDomain: 'eventflow-ffb12.firebaseapp.com',
  projectId: 'eventflow-ffb12',
  storageBucket: 'eventflow-ffb12.firebasestorage.app',
  messagingSenderId: '253829522456',
  appId: '1:253829522456:web:3fae1bcec63932321bcf6d',
  measurementId: 'G-JRT11771YD',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);

// Export Firebase services and utilities
export {
  app,
  db,
  storage,
  auth,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  Timestamp,
  serverTimestamp,
  writeBatch,
  arrayUnion,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
};

// Helper functions for common Firebase operations

/**
 * Upload an image to Firebase Storage
 * @param {File} file - The image file to upload
 * @param {string} path - Storage path (e.g., 'packages/pkg123/image.jpg')
 * @returns {Promise<string>} Download URL of the uploaded image
 */
export async function uploadImage(file, path) {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
}

/**
 * Delete an image from Firebase Storage
 * @param {string} path - Storage path of the image to delete
 */
export async function deleteImage(path) {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
}

/**
 * Create or update a document in Firestore
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID (optional, auto-generated if not provided)
 * @param {Object} data - Document data
 * @returns {Promise<string>} Document ID
 */
export async function saveDocument(collectionName, docId, data) {
  try {
    if (docId) {
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, data, { merge: true });
      return docId;
    } else {
      const docRef = await addDoc(collection(db, collectionName), data);
      return docRef.id;
    }
  } catch (error) {
    console.error('Error saving document:', error);
    throw error;
  }
}

/**
 * Get a document from Firestore
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise<Object|null>} Document data or null if not found
 */
export async function getDocument(collectionName, docId) {
  try {
    const docRef = doc(db, collectionName, docId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
}

/**
 * Get all documents from a collection
 * @param {string} collectionName - Name of the collection
 * @param {Object} options - Query options (where, orderBy, etc.)
 * @returns {Promise<Array>} Array of documents
 */
export async function getDocuments(collectionName, options = {}) {
  try {
    const colRef = collection(db, collectionName);
    let q = colRef;

    if (options.where) {
      q = query(q, where(options.where.field, options.where.operator, options.where.value));
    }

    if (options.orderBy) {
      q = query(q, orderBy(options.orderBy.field, options.orderBy.direction || 'asc'));
    }

    const querySnapshot = await getDocs(q);
    const documents = [];
    querySnapshot.forEach(doc => {
      documents.push({ id: doc.id, ...doc.data() });
    });

    return documents;
  } catch (error) {
    console.error('Error getting documents:', error);
    throw error;
  }
}

/**
 * Listen to real-time updates on a collection
 * @param {string} collectionName - Name of the collection
 * @param {Function} callback - Callback function to handle updates
 * @param {Object} options - Query options
 * @returns {Function} Unsubscribe function
 */
export function listenToCollection(collectionName, callback, options = {}) {
  try {
    const colRef = collection(db, collectionName);
    let q = colRef;

    if (options.where) {
      q = query(q, where(options.where.field, options.where.operator, options.where.value));
    }

    if (options.orderBy) {
      q = query(q, orderBy(options.orderBy.field, options.orderBy.direction || 'asc'));
    }

    return onSnapshot(
      q,
      querySnapshot => {
        const documents = [];
        querySnapshot.forEach(doc => {
          documents.push({ id: doc.id, ...doc.data() });
        });
        callback(documents);
      },
      error => {
        console.error('Error listening to collection:', error);
      }
    );
  } catch (error) {
    console.error('Error setting up listener:', error);
    throw error;
  }
}

/**
 * Listen to real-time updates on a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @param {Function} callback - Callback function to handle updates
 * @returns {Function} Unsubscribe function
 */
export function listenToDocument(collectionName, docId, callback) {
  try {
    const docRef = doc(db, collectionName, docId);
    return onSnapshot(
      docRef,
      docSnap => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() });
        } else {
          callback(null);
        }
      },
      error => {
        console.error('Error listening to document:', error);
      }
    );
  } catch (error) {
    console.error('Error setting up listener:', error);
    throw error;
  }
}

/**
 * Delete a document from Firestore
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 */
export async function deleteDocument(collectionName, docId) {
  try {
    const docRef = doc(db, collectionName, docId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
}

console.log('Firebase initialized successfully');
