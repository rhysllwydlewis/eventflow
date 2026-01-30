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
let initializationState = 'not_started';
let initializationError = null;

// Query performance monitoring
let queryMetrics = {
  totalQueries: 0,
  slowQueries: 0,
  avgQueryTime: 0,
  queryTimes: [],
};

const SLOW_QUERY_THRESHOLD = 1000;

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

async function initializeDatabase() {
  if (dbType) {
    if (initializationState !== 'completed') {
      initializationState = 'completed';
    }
    return dbType;
  }

  initializationState = 'in_progress';

  try {
    if (db.isMongoAvailable()) {
      mongodb = await withTimeout(db.connect(), 10000, 'MongoDB connection');
      dbType = 'mongodb';
      initializationState = 'completed';
      initializationError = null;
      console.log('✅ Using MongoDB for data storage (PRIMARY)');
      await createIndexes();
      return dbType;
    }
  } catch (error) {
    console.log('MongoDB not available:', error.message);
    initializationError = error.message;
  }

  dbType = 'local';
  initializationState = 'completed';
  initializationError = null;
  console.log('⚠️  Using local file storage (not suitable for production)');
  console.log('   Set MONGODB_URI for cloud database storage');
  return dbType;
}

async function createIndexes() {
  if (dbType !== 'mongodb' || !mongodb) {
    return;
  }

  try {
    console.log('📊 Creating database indexes...');
    const usersCollection = mongodb.collection('users');
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await usersCollection.createIndex({ role: 1 });
    await usersCollection.createIndex({ createdAt: -1 });
    const suppliersCollection = mongodb.collection('suppliers');
    await suppliersCollection.createIndex({ category: 1 });
    await suppliersCollection.createIndex({ userId: 1 });
    await suppliersCollection.createIndex({ featured: 1 });
    await suppliersCollection.createIndex({ approved: 1 });
    const packagesCollection = mongodb.collection('packages');
    await packagesCollection.createIndex({ supplierId: 1 });
    await packagesCollection.createIndex({ category: 1 });
    await packagesCollection.createIndex({ price: 1 });
    const messagesCollection = mongodb.collection('messages');
    await messagesCollection.createIndex({ userId: 1, createdAt: -1 });
    await messagesCollection.createIndex({ supplierId: 1, createdAt: -1 });
    await messagesCollection.createIndex({ threadId: 1 });
    const plansCollection = mongodb.collection('plans');
    await plansCollection.createIndex({ userId: 1 });
    await plansCollection.createIndex({ eventDate: 1 });
    const reviewsCollection = mongodb.collection('reviews');
    await reviewsCollection.createIndex({ supplierId: 1 });
    await reviewsCollection.createIndex({ userId: 1 });
    await reviewsCollection.createIndex({ rating: -1 });
    console.log('✅ Database indexes created successfully');
  } catch (error) {
    console.log('ℹ️  Database indexes:', error.message);
  }
}

async function read(collectionName) {
  await initializeDatabase();
  try {
    if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      if (collectionName === 'settings') {
        const doc = await collection.findOne({ id: 'system' });
        if (doc) {
          const { _id, id, ...settings } = doc;
          return settings;
        }
        return {};
      }
      return await collection.find({}).toArray();
    } else {
      return store.read(collectionName);
    }
  } catch (error) {
    console.error(`Error reading from ${collectionName}:`, error.message);
    if (dbType !== 'local') {
      console.log(`Falling back to local storage for ${collectionName}`);
      return store.read(collectionName);
    }
    return collectionName === 'settings' ? {} : [];
  }
}

async function write(collectionName, data) {
  await initializeDatabase();
  try {
    if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      if (collectionName === 'settings') {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('Settings data must be a non-null object');
        }
        await collection.deleteMany({});
        await collection.insertOne({ id: 'system', ...data });
        return true;
      }
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
    if (dbType !== 'local') {
      console.warn(
        `⚠️  MongoDB write failed for ${collectionName}, falling back to local storage. ` +
          `Data is saved locally but may not be replicated. Error: ${error.message}`
      );
      try {
        store.write(collectionName, data);
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

function uid(prefix = 'id') {
  return store.uid(prefix);
}

function getDatabaseType() {
  return dbType || 'unknown';
}

function getDatabaseStatus() {
  return {
    state: initializationState,
    type: dbType || 'unknown',
    connected: initializationState === 'completed' && dbType !== null,
    error: initializationError,
  };
}

function trackQueryPerformance(operation, duration) {
  queryMetrics.totalQueries++;
  queryMetrics.queryTimes.push(duration);
  if (queryMetrics.queryTimes.length > 1000) {
    queryMetrics.queryTimes.shift();
  }
  const sum = queryMetrics.queryTimes.reduce((a, b) => a + b, 0);
  queryMetrics.avgQueryTime = sum / queryMetrics.queryTimes.length;
  if (duration > SLOW_QUERY_THRESHOLD) {
    queryMetrics.slowQueries++;
    console.warn(`⚠️  Slow query detected: ${operation} took ${duration}ms`);
  }
}

function getQueryMetrics() {
  return {
    ...queryMetrics,
    slowQueryPercentage:
      queryMetrics.totalQueries > 0
        ? ((queryMetrics.slowQueries / queryMetrics.totalQueries) * 100).toFixed(2)
        : 0,
  };
}

function resetQueryMetrics() {
  queryMetrics = {
    totalQueries: 0,
    slowQueries: 0,
    avgQueryTime: 0,
    queryTimes: [],
  };
}

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

function validateDocument(collectionName, document) {
  const schema = validationSchemas[collectionName];
  if (!schema) {
    return { isValid: true, errors: [] };
  }
  const errors = [];
  for (const [field, rules] of Object.entries(schema)) {
    const value = document[field];
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`Field '${field}' is required`);
      continue;
    }
    if (value === undefined || value === null) {
      continue;
    }
    if (rules.type) {
      const actualType = rules.type === 'date' ? 'object' : typeof value;
      if (rules.type === 'date' && !(value instanceof Date)) {
        errors.push(`Field '${field}' must be a Date`);
      } else if (rules.type !== 'date' && actualType !== rules.type) {
        errors.push(`Field '${field}' must be of type ${rules.type}`);
      }
    }
    if (rules.enum && !rules.enum.includes(value)) {
      errors.push(`Field '${field}' must be one of: ${rules.enum.join(', ')}`);
    }
  }
  return {
    isValid: errors.length === 0,
    errors,
  };
}

async function count(collectionName, filter = {}) {
  await initializeDatabase();
  try {
    if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      return await collection.countDocuments(filter);
    } else {
      const all = store.read(collectionName);
      if (Object.keys(filter).length === 0) {
        return all.length;
      }
      return all.filter(item => matchesFilter(item, filter)).length;
    }
  } catch (error) {
    console.error(`Error counting in ${collectionName}:`, error.message);
    return 0;
  }
}

function matchesFilter(item, filter) {
  return Object.keys(filter).every(key => {
    if (key === '$or' && Array.isArray(filter[key])) {
      return filter[key].some(orFilter => matchesFilter(item, orFilter));
    }
    const filterValue = filter[key];
    const itemValue = item[key];
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
            console.warn(`Unsupported MongoDB operator: ${operator}`);
            return true;
        }
      });
    }
    return itemValue === filterValue;
  });
}

async function aggregate(collectionName, pipeline) {
  await initializeDatabase();
  try {
    if (dbType === 'mongodb') {
      const collection = mongodb.collection(collectionName);
      return await collection.aggregate(pipeline).toArray();
    } else {
      console.warn(`Aggregation on local storage for ${collectionName} - consider using MongoDB`);
      const all = store.read(collectionName);
      return processLocalAggregation(all, pipeline);
    }
  } catch (error) {
    console.error(`Error aggregating ${collectionName}:`, error.message);
    return [];
  }
}

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
        console.warn('$group aggregation on local storage has limited support');
        break;
      }
      default:
        console.warn(`Unsupported aggregation stage: ${stageType}`);
    }
  }
  return result;
}

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
      let all = store.read(collectionName);
      if (Object.keys(filter).length > 0) {
        all = all.filter(item => matchesFilter(item, filter));
      }
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
      return all.slice(skip, skip + limit);
    }
  } catch (error) {
    console.error(`Error finding in ${collectionName}:`, error.message);
    return [];
  }
}

/**
 * Write data and verify it was persisted correctly
 * This ensures data is actually stored in the database, not just in memory
 * @param {string} collectionName - Name of collection
 * @param {Object} data - Data to write
 * @returns {Promise<Object>} The verified data read back from database
 */
async function writeAndVerify(collectionName, data) {
  await initializeDatabase();
  try {
    // Write the data
    await write(collectionName, data);

    // Read it back to verify persistence
    const verified = await read(collectionName);

    // Return the verified data from database
    return verified;
  } catch (error) {
    console.error(`Error in writeAndVerify for ${collectionName}:`, error.message);
    throw error;
  }
}

/**
 * Check if MongoDB connection is healthy
 * @returns {Promise<boolean>} True if connected and responsive
 */
async function checkMongoConnection() {
  try {
    if (!mongodb) return false;
    await mongodb.admin().ping();
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get current database backend status
 * @returns {Promise<Object>} Status object with backend type and connection state
 */
async function getStatus() {
  const mongoConfigured = process.env.MONGODB_URI ? 'configured' : 'not configured';
  
  return {
    backend: dbType || 'not initialized',
    connected: dbType === 'mongodb' ? await checkMongoConnection() : true,
    database: mongoConfigured,
  };
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
  getStatus,
};
