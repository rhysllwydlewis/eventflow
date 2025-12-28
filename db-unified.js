/**
 * Unified Database Layer for EventFlow
 * Provides a single interface that works with MongoDB or local storage
 * MongoDB is the primary database; local storage is fallback only
 */

'use strict';

const db = require('./db');
const store = require('./store');

let dbType = null;
let mongodb = null;

// Database initialization state tracking for health checks
let initializationState = 'not_started'; // 'not_started', 'in_progress', 'completed', 'failed'
let initializationError = null;

/**
 * Timeout wrapper for database operations
 * Prevents hanging during initialization
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @param {string} operationName - Name of operation for error message
 * @returns {Promise} Wrapped promise with timeout
 */
function withTimeout(promise, timeoutMs, operationName) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Initialize the database layer
 * Tries MongoDB first (PRIMARY), then falls back to local files
 * Includes 10 second timeout to prevent hanging
 */
async function initializeDatabase() {
  if (dbType) {
    // Database was already initialized, ensure state reflects this
    if (initializationState !== 'completed') {
      initializationState = 'completed';
    }
    return dbType;
  }

  // Mark initialization as in progress
  initializationState = 'in_progress';

  // Try MongoDB (with timeout) - PRIMARY DATABASE
  try {
    if (db.isMongoAvailable()) {
      mongodb = await withTimeout(db.connect(), 10000, 'MongoDB connection');
      dbType = 'mongodb';
      initializationState = 'completed';
      initializationError = null;
      console.log('✅ Using MongoDB for data storage (PRIMARY)');

      // Create indexes for better performance
      await createIndexes();

      return dbType;
    }
  } catch (error) {
    console.log('MongoDB not available:', error.message);
    initializationError = error.message;
  }

  // Fallback to local files
  dbType = 'local';
  initializationState = 'completed';
  initializationError = null;
  console.log('⚠️  Using local file storage (not suitable for production)');
  console.log('   Set MONGODB_URI for cloud database storage');
  return dbType;
}

/**
 * Create database indexes for better query performance
 * Only runs if MongoDB is available
 */
async function createIndexes() {
  if (dbType !== 'mongodb' || !mongodb) {
    return;
  }

  try {
    console.log('📊 Creating database indexes...');

    // Users collection indexes
    const usersCollection = mongodb.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ role: 1 });
    await usersCollection.createIndex({ createdAt: -1 });

    // Suppliers collection indexes
    const suppliersCollection = mongodb.collection('suppliers');
    await suppliersCollection.createIndex({ category: 1 });
    await suppliersCollection.createIndex({ userId: 1 });
    await suppliersCollection.createIndex({ featured: 1 });
    await suppliersCollection.createIndex({ approved: 1 });

    // Packages collection indexes
    const packagesCollection = mongodb.collection('packages');
    await packagesCollection.createIndex({ supplierId: 1 });
    await packagesCollection.createIndex({ category: 1 });
    await packagesCollection.createIndex({ price: 1 });

    // Messages collection indexes (compound index for better query performance)
    const messagesCollection = mongodb.collection('messages');
    await messagesCollection.createIndex({ userId: 1, createdAt: -1 });
    await messagesCollection.createIndex({ supplierId: 1, createdAt: -1 });
    await messagesCollection.createIndex({ threadId: 1 });

    // Plans collection indexes
    const plansCollection = mongodb.collection('plans');
    await plansCollection.createIndex({ userId: 1 });
    await plansCollection.createIndex({ eventDate: 1 });

    // Reviews collection indexes
    const reviewsCollection = mongodb.collection('reviews');
    await reviewsCollection.createIndex({ supplierId: 1 });
    await reviewsCollection.createIndex({ userId: 1 });
    await reviewsCollection.createIndex({ rating: -1 });

    console.log('✅ Database indexes created successfully');
  } catch (error) {
    // Log but don't fail - indexes may already exist
    console.log('ℹ️  Database indexes:', error.message);
  }
}

/**
 * Read all documents from a collection
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<Array|Object>} Array of documents or object (for settings)
 */
async function read(collectionName) {
  await initializeDatabase();

  try {
    if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);

      // Special handling for settings collection (stored as single object)
      if (collectionName === 'settings') {
        const doc = await collection.findOne({ id: 'system' });
        if (doc) {
          // Remove MongoDB's _id and our internal id field
          const { _id, id, ...settings } = doc;
          return settings;
        }
        return {};
      }

      // Standard handling for array-based collections
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
    return collectionName === 'settings' ? {} : [];
  }
}

/**
 * Write (replace) all documents in a collection
 * WARNING: Destructive operation - use with caution
 * @param {string} collectionName - Name of the collection
 * @param {Array|Object} data - Array of documents or object (for settings) to write
 * @returns {Promise<boolean>} Success status
 */
async function write(collectionName, data) {
  await initializeDatabase();

  try {
    if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);

      // Special handling for settings collection (stored as single object)
      if (collectionName === 'settings') {
        await collection.deleteMany({});
        if (data && typeof data === 'object' && !Array.isArray(data)) {
          // Store settings as a single document with a fixed ID
          await collection.insertOne({ id: 'system', ...data });
        }
        return true;
      }

      // Standard handling for array-based collections
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
    if (dbType === 'mongodb') {
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
      return (
        all.find(item => {
          return Object.keys(filter).every(key => item[key] === filter[key]);
        }) || null
      );
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
    if (dbType === 'mongodb') {
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
    if (dbType === 'mongodb') {
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
    if (dbType === 'mongodb') {
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
 * @returns {string} 'mongodb' or 'local'
 */
function getDatabaseType() {
  return dbType || 'unknown';
}

/**
 * Get the database initialization and connection status (for health checks)
 * Returns cached status without re-initializing the database
 * @returns {Object} Status object with state, type, and error information
 */
function getDatabaseStatus() {
  return {
    state: initializationState,
    type: dbType || 'unknown',
    connected: initializationState === 'completed' && dbType !== null,
    error: initializationError,
  };
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
  getDatabaseType,
  getDatabaseStatus,
};
