/**
 * Unified Data Access Layer for EventFlow
 * Provides a single interface for reading/writing data that works with both:
 * - Firebase Firestore (when configured)
 * - Local JSON files (fallback)
 * 
 * This allows gradual migration from local storage to Firebase.
 */

const { read: readLocal, write: writeLocal, uid, DATA_DIR } = require('./store');
const { 
  initializeFirebaseAdmin, 
  isFirebaseAvailable, 
  getCollection, 
  getDocument, 
  setDocument, 
  deleteDocument,
  queryDocuments
} = require('./firebase-admin');

// Initialize Firebase on module load
initializeFirebaseAdmin();

// Track whether Firebase is available
const FIREBASE_ENABLED = isFirebaseAvailable();

if (FIREBASE_ENABLED) {
  console.log('✅ Data Access Layer: Firebase is available, will use Firestore');
} else {
  console.log('⚠️  Data Access Layer: Firebase not available, using local storage');
}

/**
 * Read all documents from a collection
 * @param {string} collectionName - Name of the collection (e.g., 'users', 'packages')
 * @returns {Promise<Array>} - Array of documents
 */
async function read(collectionName) {
  if (FIREBASE_ENABLED) {
    try {
      const docs = await getCollection(collectionName);
      return docs;
    } catch (error) {
      console.error(`Firebase read error for ${collectionName}, falling back to local:`, error.message);
      return readLocal(collectionName);
    }
  }
  return readLocal(collectionName);
}

/**
 * Write all documents to a collection
 * 
 * WARNING: This does NOT perform a true collection replacement in Firebase.
 * It only updates/creates the documents provided. Existing documents not in
 * the array will remain in Firebase. For true replacement, use remove() to
 * delete documents first, or manage documents individually with create/update.
 * 
 * This behavior is intentional for backward compatibility and safety.
 * Local storage is always fully replaced.
 * 
 * @param {string} collectionName - Name of the collection
 * @param {Array} data - Array of documents to write
 * @returns {Promise<void>}
 */
async function write(collectionName, data) {
  // Always write to local storage for backward compatibility (full replacement)
  writeLocal(collectionName, data);
  
  if (FIREBASE_ENABLED) {
    try {
      // Update/create documents in Firebase (does NOT delete existing docs not in array)
      const promises = data.map(doc => {
        if (!doc.id) {
          console.warn(`[data-access] Skipping document without ID in ${collectionName} for Firebase write`);
          return Promise.resolve();
        }
        return setDocument(collectionName, doc.id, doc);
      });
      await Promise.all(promises);
    } catch (error) {
      console.error(`Firebase write error for ${collectionName}:`, error.message);
      // Local write already succeeded, so don't throw
    }
  }
}

/**
 * Get a single document by ID
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @returns {Promise<Object|null>} - Document or null if not found
 */
async function getById(collectionName, docId) {
  if (FIREBASE_ENABLED) {
    try {
      const doc = await getDocument(collectionName, docId);
      return doc;
    } catch (error) {
      console.error(`Firebase getById error for ${collectionName}/${docId}, falling back to local:`, error.message);
      const items = readLocal(collectionName);
      return items.find(item => item.id === docId) || null;
    }
  }
  const items = readLocal(collectionName);
  return items.find(item => item.id === docId) || null;
}

/**
 * Update a single document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} - Updated document
 */
async function update(collectionName, docId, updates) {
  // Update in local storage
  const items = readLocal(collectionName);
  const index = items.findIndex(item => item.id === docId);
  
  if (index === -1) {
    throw new Error(`Document ${docId} not found in ${collectionName}`);
  }
  
  items[index] = { ...items[index], ...updates };
  writeLocal(collectionName, items);
  
  // Update in Firebase if available
  if (FIREBASE_ENABLED) {
    try {
      await setDocument(collectionName, docId, items[index]);
    } catch (error) {
      console.error(`Firebase update error for ${collectionName}/${docId}:`, error.message);
      // Local update succeeded, continue
    }
  }
  
  return items[index];
}

/**
 * Create a new document
 * @param {string} collectionName - Name of the collection
 * @param {Object} data - Document data (id will be generated if not provided)
 * @returns {Promise<Object>} - Created document with ID
 */
async function create(collectionName, data) {
  const doc = { ...data };
  
  // Generate ID if not provided
  if (!doc.id) {
    const prefix = collectionName.slice(0, 3);
    doc.id = uid(prefix);
  }
  
  // Add timestamps if not present
  if (!doc.createdAt) {
    doc.createdAt = new Date().toISOString();
  }
  
  // Create in local storage
  const items = readLocal(collectionName);
  items.push(doc);
  writeLocal(collectionName, items);
  
  // Create in Firebase if available
  if (FIREBASE_ENABLED) {
    try {
      await setDocument(collectionName, doc.id, doc);
    } catch (error) {
      console.error(`Firebase create error for ${collectionName}:`, error.message);
      // Local create succeeded, continue
    }
  }
  
  return doc;
}

/**
 * Delete a document
 * @param {string} collectionName - Name of the collection
 * @param {string} docId - Document ID to delete
 * @returns {Promise<boolean>} - True if deleted, false if not found
 */
async function remove(collectionName, docId) {
  // Delete from local storage
  const items = readLocal(collectionName);
  const filteredItems = items.filter(item => item.id !== docId);
  
  if (filteredItems.length === items.length) {
    return false; // Not found
  }
  
  writeLocal(collectionName, filteredItems);
  
  // Delete from Firebase if available
  if (FIREBASE_ENABLED) {
    try {
      await deleteDocument(collectionName, docId);
    } catch (error) {
      console.error(`Firebase delete error for ${collectionName}/${docId}:`, error.message);
      // Local delete succeeded, continue
    }
  }
  
  return true;
}

/**
 * Find documents matching a condition
 * @param {string} collectionName - Name of the collection
 * @param {Function} predicate - Filter function
 * @returns {Promise<Array>} - Matching documents
 */
async function find(collectionName, predicate) {
  const items = await read(collectionName);
  return items.filter(predicate);
}

/**
 * Find a single document matching a condition
 * @param {string} collectionName - Name of the collection
 * @param {Function} predicate - Filter function
 * @returns {Promise<Object|null>} - First matching document or null
 */
async function findOne(collectionName, predicate) {
  const items = await read(collectionName);
  return items.find(predicate) || null;
}

/**
 * Query documents with Firebase-style filters (when Firebase is available)
 * Falls back to in-memory filtering for local storage
 * @param {string} collectionName - Name of the collection
 * @param {Object} filters - Query filters { where: [[field, op, value]], orderBy: {field, direction}, limit: n }
 * @returns {Promise<Array>} - Matching documents
 */
async function query(collectionName, filters = {}) {
  if (FIREBASE_ENABLED) {
    try {
      return await queryDocuments(collectionName, filters);
    } catch (error) {
      console.error(`Firebase query error for ${collectionName}, falling back to local:`, error.message);
      // Fall through to local query
    }
  }
  
  // Local storage query implementation
  let items = readLocal(collectionName);
  
  // Apply where filters
  if (filters.where) {
    for (const [field, operator, value] of filters.where) {
      items = items.filter(item => {
        const fieldValue = item[field];
        switch (operator) {
          case '==': return fieldValue === value;
          case '!=': return fieldValue !== value;
          case '<': return fieldValue < value;
          case '<=': return fieldValue <= value;
          case '>': return fieldValue > value;
          case '>=': return fieldValue >= value;
          case 'in': return Array.isArray(value) && value.includes(fieldValue);
          case 'array-contains': return Array.isArray(fieldValue) && fieldValue.includes(value);
          default: return true;
        }
      });
    }
  }
  
  // Apply orderBy
  if (filters.orderBy) {
    const { field, direction = 'asc' } = filters.orderBy;
    items.sort((a, b) => {
      const aVal = a[field];
      const bVal = b[field];
      const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return direction === 'desc' ? -comparison : comparison;
    });
  }
  
  // Apply limit
  if (filters.limit) {
    items = items.slice(0, filters.limit);
  }
  
  return items;
}

module.exports = {
  read,
  write,
  getById,
  update,
  create,
  remove,
  find,
  findOne,
  query,
  uid,
  DATA_DIR,
  isFirebaseEnabled: () => FIREBASE_ENABLED,
  
  /**
   * Replace entire collection (DANGEROUS - deletes all existing docs)
   * Use with caution. Only available when Firebase is enabled.
   * @param {string} collectionName - Name of the collection
   * @param {Array} data - Array of documents to write
   * @returns {Promise<void>}
   */
  async replaceCollection(collectionName, data) {
    if (!FIREBASE_ENABLED) {
      writeLocal(collectionName, data);
      return;
    }
    
    try {
      // Get all existing documents
      const existing = await getCollection(collectionName);
      
      // Delete all existing documents
      const deletePromises = existing.map(doc => deleteDocument(collectionName, doc.id));
      await Promise.all(deletePromises);
      
      // Write new documents
      const createPromises = data.map(doc => {
        if (!doc.id) {
          console.warn(`[data-access] Skipping document without ID in ${collectionName}`);
          return Promise.resolve();
        }
        return setDocument(collectionName, doc.id, doc);
      });
      await Promise.all(createPromises);
      
      // Update local storage
      writeLocal(collectionName, data);
    } catch (error) {
      console.error(`Firebase replaceCollection error for ${collectionName}:`, error.message);
      throw error;
    }
  }
};
