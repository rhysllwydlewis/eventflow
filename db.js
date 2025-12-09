/**
 * MongoDB Database Configuration
 * Handles connection pooling, error handling, and supports both local and cloud MongoDB
 */

'use strict';

const { MongoClient } = require('mongodb');

let client = null;
let db = null;

// Connection options for better reliability
const options = {
  maxPoolSize: 10,
  minPoolSize: 2,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  retryWrites: true,
  retryReads: true,
};

/**
 * Get MongoDB connection URI from environment
 * Falls back to local MongoDB if cloud URI is not set
 */
function getConnectionUri() {
  const cloudUri = process.env.MONGODB_URI;
  const localUri = process.env.MONGODB_LOCAL_URI || 'mongodb://localhost:27017/eventflow';
  
  return cloudUri || localUri;
}

/**
 * Connect to MongoDB database
 * @returns {Promise<Object>} Database instance
 */
async function connect() {
  if (db) {
    return db;
  }

  try {
    const uri = getConnectionUri();
    
    console.log('Connecting to MongoDB...');
    client = new MongoClient(uri, options);
    await client.connect();
    
    // Get database name from URI or use default
    const dbName = process.env.MONGODB_DB_NAME || 'eventflow';
    db = client.db(dbName);
    
    console.log(`Connected to MongoDB database: ${dbName}`);
    
    // Test the connection
    await db.admin().ping();
    console.log('MongoDB connection verified');
    
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

/**
 * Get database instance (creates connection if needed)
 * @returns {Promise<Object>} Database instance
 */
async function getDb() {
  if (!db) {
    await connect();
  }
  return db;
}

/**
 * Get a collection from the database
 * @param {string} collectionName - Name of the collection
 * @returns {Promise<Object>} Collection instance
 */
async function getCollection(collectionName) {
  const database = await getDb();
  return database.collection(collectionName);
}

/**
 * Close database connection
 * Should be called on application shutdown
 */
async function close() {
  if (client) {
    console.log('Closing MongoDB connection...');
    await client.close();
    client = null;
    db = null;
    console.log('MongoDB connection closed');
  }
}

/**
 * Check if MongoDB is connected
 * @returns {boolean} Connection status
 */
function isConnected() {
  return !!db;
}

// Handle application shutdown
process.on('SIGINT', async () => {
  await close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await close();
  process.exit(0);
});

module.exports = {
  connect,
  getDb,
  getCollection,
  close,
  isConnected,
};
