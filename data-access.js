/**
 * Unified Data Access Layer for EventFlow
 * Provides a single interface for reading/writing data that works with:
 * - MongoDB (when configured)
 * - Local JSON files (fallback)
 *
 * MongoDB is the primary database; local storage is for development only.
 */

const { read: readLocal, write: writeLocal, uid, DATA_DIR } = require('./store');
const db = require('./db');

// Track whether MongoDB is available
let MONGODB_ENABLED = false;
let mongoClient = null;

// Check MongoDB availability
(async () => {
  try {
    if (db.isMongoAvailable()) {
      mongoClient = await db.connect();
      MONGODB_ENABLED = true;
      console.log('✅ Data Access Layer: MongoDB is available');
    } else {
      console.log('⚠️  Data Access Layer: MongoDB not available, using local storage');
    }
  } catch (error) {
    console.log('⚠️  Data Access Layer: MongoDB connection failed, using local storage');
  }
})();

/**
 * Read all documents from a collection
 * @param {string} collectionName - Name of the collection (e.g., 'users', 'packages')
 * @returns {Promise<Array>} - Array of documents
 */
async function read(collectionName) {
  if (MONGODB_ENABLED && mongoClient) {
    try {
      const collection = mongoClient.collection(collectionName);
      return await collection.find({}).toArray();
    } catch (error) {
      console.error(
        `MongoDB read error for ${collectionName}, falling back to local:`,
        error.message
      );
      return readLocal(collectionName);
    }
  }
  return readLocal(collectionName);
}

/**
 * Write all documents to a collection
 *
 * WARNING: This performs a full collection replacement.
 * Local storage is always fully replaced.
 * MongoDB deletes all existing documents and inserts new ones.
 *
 * @param {string} collectionName - Name of the collection
 * @param {Array} data - Array of documents to write
 * @returns {Promise<void>}
 */
async function write(collectionName, data) {
  // Always write to local storage for backward compatibility (full replacement)
  writeLocal(collectionName, data);

  if (MONGODB_ENABLED && mongoClient) {
    try {
      const collection = mongoClient.collection(collectionName);
      await collection.deleteMany({});
      if (Array.isArray(data) && data.length > 0) {
        await collection.insertMany(data);
      }
    } catch (error) {
      console.error(`MongoDB write error for ${collectionName}:`, error.message);
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
  if (MONGODB_ENABLED && mongoClient) {
    try {
      const collection = mongoClient.collection(collectionName);
      return await collection.findOne({ id: docId });
    } catch (error) {
      console.error(
        `MongoDB getById error for ${collectionName}/${docId}, falling back to local:`,
        error.message
      );
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

  // Update in MongoDB if available
  if (MONGODB_ENABLED && mongoClient) {
    try {
      const collection = mongoClient.collection(collectionName);
      await collection.updateOne({ id: docId }, { $set: updates });
    } catch (error) {
      console.error(`MongoDB update error for ${collectionName}/${docId}:`, error.message);
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

  // Create in MongoDB if available
  if (MONGODB_ENABLED && mongoClient) {
    try {
      const collection = mongoClient.collection(collectionName);
      await collection.insertOne(doc);
    } catch (error) {
      console.error(`MongoDB create error for ${collectionName}:`, error.message);
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

  // Delete from MongoDB if available
  if (MONGODB_ENABLED && mongoClient) {
    try {
      const collection = mongoClient.collection(collectionName);
      await collection.deleteOne({ id: docId });
    } catch (error) {
      console.error(`MongoDB delete error for ${collectionName}/${docId}:`, error.message);
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
 * Query documents with MongoDB-style filters
 * Falls back to in-memory filtering for local storage
 * @param {string} collectionName - Name of the collection
 * @param {Object} filters - Query filters { where: [[field, op, value]], orderBy: {field, direction}, limit: n }
 * @returns {Promise<Array>} - Matching documents
 */
async function query(collectionName, filters = {}) {
  if (MONGODB_ENABLED && mongoClient) {
    try {
      const collection = mongoClient.collection(collectionName);
      let cursor = collection.find({});

      // Apply where filters (convert to MongoDB query)
      if (filters.where) {
        const mongoQuery = {};
        for (const [field, operator, value] of filters.where) {
          switch (operator) {
            case '==':
              mongoQuery[field] = value;
              break;
            case '!=':
              mongoQuery[field] = { $ne: value };
              break;
            case '<':
              mongoQuery[field] = { $lt: value };
              break;
            case '<=':
              mongoQuery[field] = { $lte: value };
              break;
            case '>':
              mongoQuery[field] = { $gt: value };
              break;
            case '>=':
              mongoQuery[field] = { $gte: value };
              break;
            case 'in':
              mongoQuery[field] = { $in: value };
              break;
            case 'array-contains':
              mongoQuery[field] = value;
              break;
          }
        }
        cursor = collection.find(mongoQuery);
      }

      // Apply orderBy
      if (filters.orderBy) {
        const { field, direction = 'asc' } = filters.orderBy;
        cursor = cursor.sort({ [field]: direction === 'desc' ? -1 : 1 });
      }

      // Apply limit
      if (filters.limit) {
        cursor = cursor.limit(filters.limit);
      }

      return await cursor.toArray();
    } catch (error) {
      console.error(
        `MongoDB query error for ${collectionName}, falling back to local:`,
        error.message
      );
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
          case '==':
            return fieldValue === value;
          case '!=':
            return fieldValue !== value;
          case '<':
            return fieldValue < value;
          case '<=':
            return fieldValue <= value;
          case '>':
            return fieldValue > value;
          case '>=':
            return fieldValue >= value;
          case 'in':
            return Array.isArray(value) && value.includes(fieldValue);
          case 'array-contains':
            return Array.isArray(fieldValue) && fieldValue.includes(value);
          default:
            return true;
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
  isMongoDBEnabled: () => MONGODB_ENABLED,

  /**
   * Replace entire collection (DANGEROUS - deletes all existing docs)
   * Use with caution. Only available when MongoDB is enabled.
   * @param {string} collectionName - Name of the collection
   * @param {Array} data - Array of documents to write
   * @returns {Promise<void>}
   */
  async replaceCollection(collectionName, data) {
    if (!MONGODB_ENABLED || !mongoClient) {
      writeLocal(collectionName, data);
      return;
    }

    try {
      const collection = mongoClient.collection(collectionName);

      // Delete all existing documents
      await collection.deleteMany({});

      // Write new documents
      if (Array.isArray(data) && data.length > 0) {
        await collection.insertMany(data);
      }

      // Update local storage
      writeLocal(collectionName, data);
    } catch (error) {
      console.error(`MongoDB replaceCollection error for ${collectionName}:`, error.message);
      throw error;
    }
  },
};
