/**
 * Unified Database Layer for EventFlow
 * Provides a single interface that works with Firebase Firestore, MongoDB, or local files
 * Automatically selects the best available option
 */

'use strict';

const { initializeFirebaseAdmin, isFirebaseAvailable, getFirestore } = require('./firebase-admin');
const db = require('./db');
const store = require('./store');

let dbType = null;
let firestore = null;
let mongodb = null;

/**
 * Initialize the database layer
 * Tries Firestore first, then MongoDB, then falls back to local files
 */
async function initializeDatabase() {
  if (dbType) {
    return dbType;
  }

  // Try Firebase Firestore first
  try {
    const { db } = initializeFirebaseAdmin();
    if (db) {
      firestore = db;
      dbType = 'firestore';
      console.log('✅ Using Firebase Firestore for data storage');
      return dbType;
    }
  } catch (error) {
    console.log('Firebase Firestore not available:', error.message);
  }

  // Try MongoDB next
  try {
    if (db.isMongoAvailable()) {
      mongodb = await db.connect();
      dbType = 'mongodb';
      console.log('✅ Using MongoDB for data storage');
      return dbType;
    }
  } catch (error) {
    console.log('MongoDB not available:', error.message);
  }

  // Fallback to local files
  dbType = 'local';
  console.log('⚠️  Using local file storage (not suitable for production)');
  console.log('   Set FIREBASE_PROJECT_ID or MONGODB_URI for cloud storage');
  return dbType;
}

/**
 * Read all documents from a collection
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<Array>} Array of documents
 */
async function read(collectionName) {
  await initializeDatabase();

  try {
    if (dbType === 'firestore') {
      const snapshot = await firestore.collection(collectionName).get();
      const docs = [];
      snapshot.forEach(doc => {
        docs.push({ id: doc.id, ...doc.data() });
      });
      return docs;
    } else if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      return await collection.find({}).toArray();
    } else {
      return store.read(collectionName);
    }
  } catch (error) {
    console.error(`Error reading from ${collectionName}:`, error.message);
    // Fallback to local storage on error
    if (dbType !== 'local') {
      console.log(`Falling back to local storage for ${collectionName}`);
      return store.read(collectionName);
    }
    return [];
  }
}

/**
 * Write (replace) all documents in a collection
 * WARNING: Destructive operation - use with caution
 * @param {string} collectionName - Name of the collection
 * @param {Array} data - Array of documents to write
 * @returns {Promise<boolean>} Success status
 */
async function write(collectionName, data) {
  await initializeDatabase();

  try {
    if (dbType === 'firestore') {
      // For Firestore, we should update individual documents
      // But for compatibility with existing code, we'll handle this carefully
      console.warn(`write() called on Firestore for ${collectionName} - use individual document operations instead`);
      
      // Get existing docs
      const snapshot = await firestore.collection(collectionName).get();
      const batch = firestore.batch();
      
      // Delete all existing
      snapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // Add new docs
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.id) {
            const docRef = firestore.collection(collectionName).doc(item.id);
            batch.set(docRef, item);
          }
        });
      }
      
      await batch.commit();
      return true;
    } else if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      await collection.deleteMany({});
      if (Array.isArray(data) && data.length > 0) {
        await collection.insertMany(data);
      }
      return true;
    } else {
      store.write(collectionName, data);
      return true;
    }
  } catch (error) {
    console.error(`Error writing to ${collectionName}:`, error.message);
    // Fallback to local storage on error
    if (dbType !== 'local') {
      console.log(`Falling back to local storage for ${collectionName}`);
      store.write(collectionName, data);
      return true;
    }
    return false;
  }
}

/**
 * Find one document by filter
 * @param {string} collectionName - Name of the collection
 * @param {Object|Function} filter - Filter object or function
 * @returns {Promise<Object|null>} Found document or null
 */
async function findOne(collectionName, filter) {
  await initializeDatabase();

  try {
    if (dbType === 'firestore') {
      if (typeof filter === 'function') {
        // For function filters, get all and filter in memory
        const all = await read(collectionName);
        return all.find(filter) || null;
      } else if (filter.id) {
        // If filtering by ID, use direct doc get
        const docRef = firestore.collection(collectionName).doc(filter.id);
        const doc = await docRef.get();
        return doc.exists ? { id: doc.id, ...doc.data() } : null;
      } else {
        // For object filters, get all and filter in memory
        // TODO: Convert to Firestore queries for better performance
        const all = await read(collectionName);
        return all.find(item => {
          return Object.keys(filter).every(key => item[key] === filter[key]);
        }) || null;
      }
    } else if (dbType === 'mongodb') {
      if (typeof filter === 'function') {
        const all = await read(collectionName);
        return all.find(filter) || null;
      }
      const collection = mongodb.collection(collectionName);
      return await collection.findOne(filter);
    } else {
      const all = store.read(collectionName);
      if (typeof filter === 'function') {
        return all.find(filter) || null;
      }
      return all.find(item => {
        return Object.keys(filter).every(key => item[key] === filter[key]);
      }) || null;
    }
  } catch (error) {
    console.error(`Error finding in ${collectionName}:`, error.message);
    return null;
  }
}

/**
 * Update a single document
 * @param {string} collectionName - Name of the collection
 * @param {string} id - Document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<boolean>} Success status
 */
async function updateOne(collectionName, id, updates) {
  await initializeDatabase();

  try {
    if (dbType === 'firestore') {
      const docRef = firestore.collection(collectionName).doc(id);
      await docRef.update(updates);
      return true;
    } else if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      const result = await collection.updateOne({ id }, { $set: updates });
      return result.modifiedCount > 0;
    } else {
      const all = store.read(collectionName);
      const index = all.findIndex(item => item.id === id);
      if (index >= 0) {
        all[index] = { ...all[index], ...updates };
        store.write(collectionName, all);
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error(`Error updating in ${collectionName}:`, error.message);
    return false;
  }
}

/**
 * Insert a new document
 * @param {string} collectionName - Name of the collection
 * @param {Object} document - Document to insert
 * @returns {Promise<Object|null>} Inserted document or null
 */
async function insertOne(collectionName, document) {
  await initializeDatabase();

  try {
    if (dbType === 'firestore') {
      const id = document.id || firestore.collection(collectionName).doc().id;
      const docRef = firestore.collection(collectionName).doc(id);
      await docRef.set(document);
      return { id, ...document };
    } else if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      await collection.insertOne(document);
      return document;
    } else {
      const all = store.read(collectionName);
      all.push(document);
      store.write(collectionName, all);
      return document;
    }
  } catch (error) {
    console.error(`Error inserting into ${collectionName}:`, error.message);
    return null;
  }
}

/**
 * Delete a document
 * @param {string} collectionName - Name of the collection
 * @param {string} id - Document ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteOne(collectionName, id) {
  await initializeDatabase();

  try {
    if (dbType === 'firestore') {
      const docRef = firestore.collection(collectionName).doc(id);
      await docRef.delete();
      return true;
    } else if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      const result = await collection.deleteOne({ id });
      return result.deletedCount > 0;
    } else {
      const all = store.read(collectionName);
      const filtered = all.filter(item => item.id !== id);
      if (filtered.length < all.length) {
        store.write(collectionName, filtered);
        return true;
      }
      return false;
    }
  } catch (error) {
    console.error(`Error deleting from ${collectionName}:`, error.message);
    return false;
  }
}

/**
 * Generate a unique ID
 * @param {string} prefix - ID prefix
 * @returns {string} Unique ID
 */
function uid(prefix = 'id') {
  return store.uid(prefix);
}

/**
 * Get the current database type
 * @returns {string} 'firestore', 'mongodb', or 'local'
 */
function getDatabaseType() {
  return dbType || 'unknown';
}

module.exports = {
  initializeDatabase,
  read,
  write,
  findOne,
  updateOne,
  insertOne,
  deleteOne,
  uid,
  getDatabaseType
};
