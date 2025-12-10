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
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, never use localhost
  if (isProduction) {
    if (!cloudUri) {
      throw new Error('Production error: MONGODB_URI must be set to a cloud MongoDB connection string');
    }
    if (cloudUri.includes('localhost') || cloudUri.includes('127.0.0.1')) {
      throw new Error('Production error: MONGODB_URI cannot point to localhost');
    }
    return cloudUri;
  }
  
  // In development, prefer cloud but allow local fallback
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
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Log connection attempt (without exposing credentials)
    const sanitizedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//<credentials>@');
    console.log(`Connecting to MongoDB...`);
    console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
    console.log(`URI: ${sanitizedUri}`);
    
    client = new MongoClient(uri, options);
    await client.connect();
    
    // Get database name from URI or use default
    const dbName = process.env.MONGODB_DB_NAME || 'eventflow';
    db = client.db(dbName);
    
    console.log(`✅ Connected to MongoDB database: ${dbName}`);
    
    // Test the connection
    await db.admin().ping();
    console.log('✅ MongoDB connection verified');
    
    return db;
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    
    // Provide helpful error messages
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('   → Network error: Cannot reach MongoDB server');
      console.error('   → Check your MONGODB_URI and network connectivity');
    } else if (error.message.includes('authentication')) {
      console.error('   → Authentication failed: Check username and password in MONGODB_URI');
    } else if (error.message.includes('timeout')) {
      console.error('   → Connection timeout: MongoDB server is not responding');
    }
    
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

/**
 * Check if MongoDB is available (has valid URI configuration)
 * @returns {boolean} Whether MongoDB can be used
 */
function isMongoAvailable() {
  // Check if we have a valid cloud MongoDB URI (not localhost)
  const cloudUri = process.env.MONGODB_URI;
  const localUri = process.env.MONGODB_LOCAL_URI;
  const isProduction = process.env.NODE_ENV === 'production';
  
  // In production, only accept cloud MongoDB URI
  if (isProduction) {
    return !!cloudUri && !cloudUri.includes('localhost') && !cloudUri.includes('127.0.0.1');
  }
  
  // In development, accept either cloud or local
  return !!(cloudUri || localUri);
}

// Handle application shutdown
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  console.log(`\nReceived ${signal}, closing MongoDB connection...`);
  await close();
  process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = {
  connect,
  getDb,
  getCollection,
  close,
  isConnected,
  isMongoAvailable,
};
