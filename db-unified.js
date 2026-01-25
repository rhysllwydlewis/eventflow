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

// Query performance monitoring
let queryMetrics = {
  totalQueries: 0,
  slowQueries: 0,
  avgQueryTime: 0,
  queryTimes: [],
};

const SLOW_QUERY_THRESHOLD = 1000; // 1 second

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
          // Remove MongoDB's _id and our internal id field from settings
          // eslint-disable-next-line no-unused-vars
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
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Settings data must be a non-null object');
        }
        await collection.deleteMany({});
        // Store settings as a single document with a fixed ID
        await collection.insertOne({ id: 'system', ...data });
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
      console.warn(
        `⚠️  MongoDB write failed for ${collectionName}, falling back to local storage. ` +
          `Data is saved locally but may not be replicated. Error: ${error.message}`
      );
      try {
        store.write(collectionName, data);
        // Return true because data was saved to fallback, but log the MongoDB failure
        return true;
      } catch (fallbackError) {
        console.error(
          `Critical: Both MongoDB and local storage failed for ${collectionName}. ` +
            `MongoDB error: ${error.message}, Local storage error: ${fallbackError.message}`
        );
        return false;
      }
    }
    return false;
  }
}

/**
 * Write data to a collection and verify it was persisted correctly
 * Provides stronger guarantees than write() alone by reading back the data
 * @param {string} collectionName - Name of the collection
 * @param {Array|Object} data - Array of documents or object (for settings) to write
 * @param {Object} options - Options for write and verify operation
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 2)
 * @param {number} options.retryDelayMs - Delay between retries in milliseconds (default: 100)
 * @returns {Promise<Object>} Result object with success, verified, data, and error
 */
async function writeAndVerify(collectionName, data, options = {}) {
  const { maxRetries = 2, retryDelayMs = 100 } = options;
  let lastError = null;

  // Enhanced logging for settings collection
  const isSettings = collectionName === 'settings';
  if (isSettings) {
    console.log(`[writeAndVerify] Starting write for ${collectionName}`);
    console.log(`[writeAndVerify] Data keys:`, Object.keys(data));
    if (data.collageWidget) {
      console.log(`[writeAndVerify] collageWidget.enabled:`, data.collageWidget.enabled);
    }
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(
          `[writeAndVerify] Retrying for ${collectionName}, attempt ${attempt + 1}/${maxRetries + 1}`
        );
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }

      // Perform the write operation
      if (isSettings) {
        console.log(`[writeAndVerify] Calling write() for ${collectionName} (attempt ${attempt + 1})`);
      }
      const writeSuccess = await write(collectionName, data);

      if (!writeSuccess) {
        lastError = new Error('Write operation returned false');
        if (isSettings) {
          console.error(`[writeAndVerify] Write returned false for ${collectionName}`);
        }
        continue; // Try again
      }

      if (isSettings) {
        console.log(`[writeAndVerify] Write succeeded, waiting 100ms before verification`);
      }

      // Longer delay to ensure write has propagated (especially important for distributed databases)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Read back the data to verify
      if (isSettings) {
        console.log(`[writeAndVerify] Reading back ${collectionName} for verification`);
      }
      const verifiedData = await read(collectionName);

      if (isSettings && verifiedData.collageWidget) {
        console.log(
          `[writeAndVerify] Verified data collageWidget.enabled:`,
          verifiedData.collageWidget.enabled
        );
      }

      // Verify the data matches what we wrote
      const isVerified = await verifyDataMatch(collectionName, data, verifiedData);

      if (isVerified) {
        if (isSettings) {
          console.log(`[writeAndVerify] Verification succeeded for ${collectionName}`);
        }
        return {
          success: true,
          verified: true,
          data: verifiedData,
        };
      } else {
        lastError = new Error('Data verification failed - written data does not match read data');
        if (isSettings) {
          console.error(`[writeAndVerify] Verification failed for ${collectionName}`);
        }
      }
    } catch (error) {
      lastError = error;
      console.error(
        `[writeAndVerify] Error in writeAndVerify for ${collectionName} (attempt ${attempt + 1}):`,
        error.message
      );
    }
  }

  // All retries exhausted
  console.error(
    `[writeAndVerify] Failed to write and verify ${collectionName} after ${maxRetries + 1} attempts. Last error: ${lastError?.message}`
  );

  return {
    success: false,
    verified: false,
    data: null,
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * Verify that written data matches read data
 * For settings collection, does deep comparison of key fields
 * For array collections, compares lengths and key properties
 * @param {string} collectionName - Name of the collection
 * @param {Array|Object} writtenData - Data that was written
 * @param {Array|Object} readData - Data that was read back
 * @returns {Promise<boolean>} True if data matches
 */
async function verifyDataMatch(collectionName, writtenData, readData) {
  try {
    // Handle settings collection (object comparison)
    if (collectionName === 'settings') {
      if (!readData || typeof readData !== 'object') {
        console.error('[verifyDataMatch] Read data is not an object');
        return false;
      }

      // Specific check for collageWidget.enabled field (critical for persistence fix)
      if (writtenData.collageWidget?.enabled !== undefined) {
        const writtenEnabled = writtenData.collageWidget.enabled;
        const readEnabled = readData.collageWidget?.enabled;
        
        if (writtenEnabled !== readEnabled) {
          console.error(
            `[verifyDataMatch] collageWidget.enabled mismatch: written=${writtenEnabled}, read=${readEnabled}`
          );
          return false;
        }
        console.log(
          `[verifyDataMatch] collageWidget.enabled verified: ${writtenEnabled} === ${readEnabled}`
        );
      }

      // Deep comparison of all nested properties
      return deepCompareObjects(writtenData, readData, collectionName);
    }

    // Handle array collections (length and basic content comparison)
    if (Array.isArray(writtenData) && Array.isArray(readData)) {
      // For array collections, length comparison is sufficient for most cases
      // as we typically replace the entire collection
      return writtenData.length === readData.length;
    }

    // Fallback: JSON comparison (less efficient but works for most cases)
    return JSON.stringify(writtenData) === JSON.stringify(readData);
  } catch (error) {
    console.error('[verifyDataMatch] Error in verifyDataMatch:', error.message);
    return false;
  }
}

/**
 * Deep compare two objects recursively
 * @param {Object} written - Written object
 * @param {Object} read - Read object
 * @param {string} path - Current path for error messages
 * @returns {boolean} True if objects match
 */
function deepCompareObjects(written, read, path = '') {
  // Compare all keys in written object
  for (const [key, writtenValue] of Object.entries(written)) {
    const readValue = read[key];
    const currentPath = path ? `${path}.${key}` : key;

    // Handle nested objects recursively
    if (
      writtenValue &&
      typeof writtenValue === 'object' &&
      !Array.isArray(writtenValue) &&
      !(writtenValue instanceof Date)
    ) {
      if (!readValue || typeof readValue !== 'object') {
        console.warn(`Verification mismatch at ${currentPath}: read value is not an object`);
        return false;
      }
      // Recursively compare nested objects
      if (!deepCompareObjects(writtenValue, readValue, currentPath)) {
        return false;
      }
    } else {
      // Compare primitive values, arrays, and dates using JSON serialization
      const writtenJson = JSON.stringify(writtenValue);
      const readJson = JSON.stringify(readValue);
      if (writtenJson !== readJson) {
        console.warn(
          `Verification mismatch at ${currentPath}: ` + `written=${writtenJson}, read=${readJson}`
        );
        return false;
      }
    }
  }
  return true;
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
 * Find multiple documents by filter
 * @param {string} collectionName - Name of the collection
 * @param {Object|Function} filter - Filter object or function
 * @returns {Promise<Array>} Array of found documents
 *
 * @note When using function filters with MongoDB, all documents are loaded into memory
 * before filtering. For large collections, prefer using object filters which are executed
 * on the database server for better performance and memory efficiency.
 */
async function find(collectionName, filter) {
  await initializeDatabase();

  try {
    if (dbType === 'mongodb') {
      if (typeof filter === 'function') {
        const all = await read(collectionName);
        return all.filter(filter);
      }
      const collection = mongodb.collection(collectionName);
      return await collection.find(filter).toArray();
    } else {
      const all = store.read(collectionName);
      if (typeof filter === 'function') {
        return all.filter(filter);
      }
      return all.filter(item => {
        return Object.keys(filter).every(key => item[key] === filter[key]);
      });
    }
  } catch (error) {
    console.error(`Error finding in ${collectionName}:`, error.message);
    return [];
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

/**
 * Track query performance
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 */
function trackQueryPerformance(operation, duration) {
  queryMetrics.totalQueries++;
  queryMetrics.queryTimes.push(duration);

  // Keep only last 1000 query times
  if (queryMetrics.queryTimes.length > 1000) {
    queryMetrics.queryTimes.shift();
  }

  // Calculate average
  const sum = queryMetrics.queryTimes.reduce((a, b) => a + b, 0);
  queryMetrics.avgQueryTime = sum / queryMetrics.queryTimes.length;

  // Track slow queries
  if (duration > SLOW_QUERY_THRESHOLD) {
    queryMetrics.slowQueries++;
    console.warn(`⚠️  Slow query detected: ${operation} took ${duration}ms`);
  }
}

/**
 * Get query performance metrics
 * @returns {Object} Performance metrics
 */
function getQueryMetrics() {
  return {
    ...queryMetrics,
    slowQueryPercentage:
      queryMetrics.totalQueries > 0
        ? ((queryMetrics.slowQueries / queryMetrics.totalQueries) * 100).toFixed(2)
        : 0,
  };
}

/**
 * Reset query metrics
 */
function resetQueryMetrics() {
  queryMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    avgQueryTime: 0,
    queryTimes: [],
  };
}

/**
 * Wrapper for MongoDB operations with performance tracking
 * @param {string} operation - Operation name
 * @param {Function} fn - Function to execute
 * @returns {Promise} Result of operation
 */
async function withPerformanceTracking(operation, fn) {
  const startTime = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - startTime;
    trackQueryPerformance(operation, duration);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    trackQueryPerformance(operation, duration);
    throw error;
  }
}

/**
 * Data validation schemas for collections
 */
const validationSchemas = {
  users: {
    email: { type: 'string', required: true },
    role: { type: 'string', enum: ['customer', 'supplier', 'admin'], required: true },
    createdAt: { type: 'date', required: true },
  },
  suppliers: {
    userId: { type: 'string', required: true },
    category: { type: 'string', required: true },
    approved: { type: 'boolean', required: true },
  },
  packages: {
    supplierId: { type: 'string', required: true },
    name: { type: 'string', required: true },
    price: { type: 'number', required: true },
  },
  messages: {
    userId: { type: 'string', required: true },
    threadId: { type: 'string', required: true },
    content: { type: 'string', required: true },
    createdAt: { type: 'date', required: true },
  },
};

/**
 * Validate document against schema
 * @param {string} collectionName - Collection name
 * @param {Object} document - Document to validate
 * @returns {Object} Validation result with isValid and errors
 */
function validateDocument(collectionName, document) {
  const schema = validationSchemas[collectionName];
  if (!schema) {
    return { isValid: true, errors: [] };
  }

  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = document[field];

    // Check required fields
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`Field '${field}' is required`);
      continue;
    }

    // Skip if value is not present and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Check type
    if (rules.type) {
      const actualType = rules.type === 'date' ? 'object' : typeof value;
      if (rules.type === 'date' && !(value instanceof Date)) {
        errors.push(`Field '${field}' must be a Date`);
      } else if (rules.type !== 'date' && actualType !== rules.type) {
        errors.push(`Field '${field}' must be of type ${rules.type}`);
      }
    }

    // Check enum
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Count documents in a collection (optionally with filter)
 * Uses MongoDB countDocuments for efficiency - doesn't load data into memory
 * @param {string} collectionName - Name of the collection
 * @param {Object} filter - MongoDB filter object (default: {})
 * @returns {Promise<number>} Count of documents matching the filter
 */
async function count(collectionName, filter = {}) {
  await initializeDatabase();

  try {
    if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      return await collection.countDocuments(filter);
    } else {
      // Fallback for local storage
      const all = store.read(collectionName);
      if (Object.keys(filter).length === 0) {
        return all.length;
      }
      // Apply filter with support for MongoDB operators
      return all.filter(item => matchesFilter(item, filter)).length;
    }
  } catch (error) {
    console.error(`Error counting in ${collectionName}:`, error.message);
    return 0;
  }
}

/**
 * Check if an item matches a MongoDB-style filter
 * Supports basic operators: $gte, $lte, $gt, $lt, $ne, $in, $or
 * @param {Object} item - The item to check
 * @param {Object} filter - The filter object
 * @returns {boolean} True if item matches filter
 */
function matchesFilter(item, filter) {
  return Object.keys(filter).every(key => {
    if (key === '$or' && Array.isArray(filter[key])) {
      return filter[key].some(orFilter => matchesFilter(item, orFilter));
    }

    const filterValue = filter[key];
    const itemValue = item[key];

    // Handle MongoDB operators
    if (typeof filterValue === 'object' && filterValue !== null && !Array.isArray(filterValue)) {
      return Object.keys(filterValue).every(operator => {
        const operatorValue = filterValue[operator];

        switch (operator) {
          case '$gte':
            return itemValue >= operatorValue;
          case '$lte':
            return itemValue <= operatorValue;
          case '$gt':
            return itemValue > operatorValue;
          case '$lt':
            return itemValue < operatorValue;
          case '$ne':
            return itemValue !== operatorValue;
          case '$in':
            return Array.isArray(operatorValue) && operatorValue.includes(itemValue);
          case '$regex': {
            const options = filterValue.$options || '';
            const regex = new RegExp(operatorValue, options);
            return regex.test(itemValue);
          }
          default:
            // Unknown operator - log warning and skip this condition
            console.warn(`Unsupported MongoDB operator: ${operator}`);
            return true; // Don't filter out items with unknown operators
        }
      });
    }

    // Simple equality check
    return itemValue === filterValue;
  });
}

/**
 * Run aggregation pipeline on a collection
 * For local storage, falls back to loading and processing in memory
 * @param {string} collectionName - Name of the collection
 * @param {Array} pipeline - MongoDB aggregation pipeline
 * @returns {Promise<Array>} Aggregation results
 */
async function aggregate(collectionName, pipeline) {
  await initializeDatabase();

  try {
    if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      return await collection.aggregate(pipeline).toArray();
    } else {
      // Fallback: load all and process (less efficient but functional)
      console.warn(`Aggregation on local storage for ${collectionName} - consider using MongoDB`);
      const all = store.read(collectionName);
      // Basic aggregation support for $match, $group, $count
      // This is a simplified fallback
      return processLocalAggregation(all, pipeline);
    }
  } catch (error) {
    console.error(`Error aggregating ${collectionName}:`, error.message);
    return [];
  }
}

/**
 * Process aggregation pipeline locally (simplified fallback for local storage)
 * @param {Array} data - Array of documents
 * @param {Array} pipeline - Aggregation pipeline
 * @returns {Array} Processed results
 */
function processLocalAggregation(data, pipeline) {
  let result = [...data];

  for (const stage of pipeline) {
    const stageType = Object.keys(stage)[0];

    switch (stageType) {
      case '$match': {
        const filter = stage.$match;
        result = result.filter(item => matchesFilter(item, filter));
        break;
      }
      case '$count': {
        const fieldName = stage.$count;
        result = [{ [fieldName]: result.length }];
        break;
      }
      case '$group': {
        // Basic grouping support
        console.warn('$group aggregation on local storage has limited support');
        break;
      }
      default:
        console.warn(`Unsupported aggregation stage: ${stageType}`);
    }
  }

  return result;
}

/**
 * Find documents with query options (limit, skip, sort)
 * @param {string} collectionName - Name of the collection
 * @param {Object} filter - Filter object (default: {})
 * @param {Object} options - Query options (limit, skip, sort)
 * @returns {Promise<Array>} Array of documents
 */
async function findWithOptions(collectionName, filter = {}, options = {}) {
  await initializeDatabase();

  const { limit = 50, skip = 0, sort = {} } = options;

  try {
    if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      let query = collection.find(filter);

      if (Object.keys(sort).length > 0) {
        query = query.sort(sort);
      }

      return await query.skip(skip).limit(limit).toArray();
    } else {
      // Fallback for local storage
      let all = store.read(collectionName);

      // Apply filter with MongoDB operator support
      if (Object.keys(filter).length > 0) {
        all = all.filter(item => matchesFilter(item, filter));
      }

      // Apply sorting
      if (Object.keys(sort).length > 0) {
        all = all.sort((a, b) => {
          for (const [field, direction] of Object.entries(sort)) {
            const aVal = a[field];
            const bVal = b[field];

            let comparison = 0;
            if (aVal < bVal) {
              comparison = -1;
            } else if (aVal > bVal) {
              comparison = 1;
            }

            if (comparison !== 0) {
              return direction === -1 ? -comparison : comparison;
            }
          }
          return 0;
        });
      }

      // Apply skip and limit
      return all.slice(skip, skip + limit);
    }
  } catch (error) {
    console.error(`Error finding in ${collectionName}:`, error.message);
    return [];
  }
}

module.exports = {
  initializeDatabase,
  read,
  write,
  writeAndVerify,
  find,
  findOne,
  updateOne,
  insertOne,
  deleteOne,
  uid,
  getDatabaseType,
  getDatabaseStatus,
  getQueryMetrics,
  resetQueryMetrics,
  validateDocument,
  withPerformanceTracking,
  count,
  aggregate,
  findWithOptions,
};
