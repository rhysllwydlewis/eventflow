require('dotenv').config();
/**
 * Firebase Admin SDK initialization for EventFlow backend
 * Provides server-side access to Firestore and Storage
 */

const admin = require('firebase-admin');

let db = null;
let storage = null;
let initialized = false;

/**
 * Initialize Firebase Admin SDK
 * Can be initialized with service account or application default credentials
 */
function initializeFirebaseAdmin() {
  if (initialized) {
    return { db, storage };
  }

  try {
    // Try to initialize with service account key if provided
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      const projectId =
        serviceAccount.project_id || process.env.FIREBASE_PROJECT_ID || 'eventflow-ffb12';
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: projectId,
        databaseURL: `https://${projectId}.firebaseio.com`,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'eventflow-ffb12.firebasestorage.app',
      });
      console.log('Firebase Admin initialized with service account');
    }
    // Fallback to application default credentials (for local development ONLY)
    else if (process.env.FIREBASE_PROJECT_ID && process.env.NODE_ENV !== 'production') {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      admin.initializeApp({
        projectId: projectId,
        databaseURL: `https://${projectId}.firebaseio.com`,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'eventflow-ffb12.firebasestorage.app',
      });
      console.log('Firebase Admin initialized with project ID (development mode)');
    }
    // If no credentials, don't initialize (no Firebase available)
    else {
      if (process.env.FIREBASE_PROJECT_ID && !process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        console.warn(
          '⚠️  Firebase Admin not initialized - FIREBASE_SERVICE_ACCOUNT_KEY required for production'
        );
        console.warn(
          '   Set FIREBASE_SERVICE_ACCOUNT_KEY environment variable with service account JSON'
        );
        console.warn('   Or use MongoDB instead by setting MONGODB_URI');
      }
      // No Firebase configuration at all - silently skip
      return { db: null, storage: null };
    }

    db = admin.firestore();
    storage = admin.storage();
    initialized = true;

    console.log('Firebase Admin SDK initialized successfully');
    return { db, storage };
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error.message);
    console.log('Firebase not available - backend will use local storage');
    return { db: null, storage: null };
  }
}

/**
 * Get Firestore instance
 */
function getFirestore() {
  if (!initialized) {
    initializeFirebaseAdmin();
  }
  return db;
}

/**
 * Get Storage instance
 */
function getStorage() {
  if (!initialized) {
    initializeFirebaseAdmin();
  }
  return storage;
}

/**
 * Check if Firebase Admin is available
 */
function isFirebaseAvailable() {
  return initialized && db !== null;
}

/**
 * Helper to get all documents from a collection
 */
async function getCollection(collectionName) {
  if (!isFirebaseAvailable()) {
    throw new Error('Firebase not available');
  }

  const snapshot = await db.collection(collectionName).get();
  const docs = [];
  snapshot.forEach(doc => {
    docs.push({ id: doc.id, ...doc.data() });
  });
  return docs;
}

/**
 * Helper to get a single document
 */
async function getDocument(collectionName, docId) {
  if (!isFirebaseAvailable()) {
    throw new Error('Firebase not available');
  }

  const doc = await db.collection(collectionName).doc(docId).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() };
}

/**
 * Helper to create or update a document
 */
async function setDocument(collectionName, docId, data) {
  if (!isFirebaseAvailable()) {
    throw new Error('Firebase not available');
  }

  if (docId) {
    await db.collection(collectionName).doc(docId).set(data, { merge: true });
    return docId;
  } else {
    const docRef = await db.collection(collectionName).add(data);
    return docRef.id;
  }
}

/**
 * Helper to delete a document
 */
async function deleteDocument(collectionName, docId) {
  if (!isFirebaseAvailable()) {
    throw new Error('Firebase not available');
  }

  await db.collection(collectionName).doc(docId).delete();
}

/**
 * Helper to query documents
 */
async function queryDocuments(collectionName, filters = {}) {
  if (!isFirebaseAvailable()) {
    throw new Error('Firebase not available');
  }

  let query = db.collection(collectionName);

  // Apply filters
  if (filters.where) {
    for (const [field, operator, value] of filters.where) {
      query = query.where(field, operator, value);
    }
  }

  if (filters.orderBy) {
    query = query.orderBy(filters.orderBy.field, filters.orderBy.direction || 'asc');
  }

  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const snapshot = await query.get();
  const docs = [];
  snapshot.forEach(doc => {
    docs.push({ id: doc.id, ...doc.data() });
  });
  return docs;
}

module.exports = {
  initializeFirebaseAdmin,
  getFirestore,
  getStorage,
  isFirebaseAvailable,
  getCollection,
  getDocument,
  setDocument,
  deleteDocument,
  queryDocuments,
  admin,
};
