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
 * Validate MongoDB URI format
 * @param {string} uri - MongoDB connection string to validate
 * @returns {Object} - { valid: boolean, error: string }
 */
function validateMongoUri(uri) {
  if (!uri || typeof uri !== 'string') {
    return { valid: false, error: 'MongoDB URI is empty or invalid' };
  }
  
  // Check for placeholder/example URIs
  const placeholderPatterns = [
    'username:password@cluster',
    'your-cluster',
    'YourCluster',
    'example.com',
  ];
  
  for (const pattern of placeholderPatterns) {
    if (uri.includes(pattern)) {
      return { 
        valid: false, 
        error: 'MongoDB URI contains placeholder values - you must replace these with your actual MongoDB Atlas credentials'
      };
    }
  }
  
  // Validate URI scheme
  if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
    return { 
      valid: false, 
      error: 'Invalid scheme, expected connection string to start with "mongodb://" or "mongodb+srv://"'
    };
  }
  
  // Check for credentials in cloud URIs
  if (uri.startsWith('mongodb+srv://') || uri.startsWith('mongodb://')) {
    // For mongodb+srv, we need credentials unless it's localhost
    if (uri.startsWith('mongodb+srv://') && !uri.includes('@')) {
      return {
        valid: false,
        error: 'MongoDB Atlas URI is missing credentials (username:password@...)'
      };
    }
  }
  
  return { valid: true };
}

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
      console.error('');
      console.error('='.repeat(70));
      console.error('❌ MONGODB CONFIGURATION ERROR');
      console.error('='.repeat(70));
      console.error('');
      console.error('Production deployment requires a cloud MongoDB database.');
      console.error('');
      console.error('You need to:');
      console.error('  1. Create a free MongoDB Atlas account');
      console.error('  2. Set up a cluster');
      console.error('  3. Get your connection string');
      console.error('  4. Set the MONGODB_URI environment variable');
      console.error('');
      console.error('📚 Step-by-step guide:');
      console.error('   → See MONGODB_SETUP_SIMPLE.md for detailed instructions');
      console.error('   → Or visit: https://github.com/rhysllwydlewis/eventflow#mongodb-setup');
      console.error('');
      console.error('='.repeat(70));
      console.error('');
      throw new Error('Production error: MONGODB_URI must be set to a cloud MongoDB connection string');
    }
    
    // Validate URI format
    const validation = validateMongoUri(cloudUri);
    if (!validation.valid) {
      console.error('');
      console.error('='.repeat(70));
      console.error('❌ INVALID MONGODB_URI');
      console.error('='.repeat(70));
      console.error('');
      console.error(`Error: ${validation.error}`);
      console.error('');
      console.error('Your MONGODB_URI should look like:');
      console.error('  mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority');
      console.error('');
      console.error('Common issues:');
      console.error('  ✗ Using the example/placeholder from .env.example');
      console.error('  ✗ Missing "mongodb://" or "mongodb+srv://" prefix');
      console.error('  ✗ Missing credentials (username:password)');
      console.error('  ✗ Not replacing "username", "password", "cluster" placeholders');
      console.error('');
      console.error('📚 Get your actual connection string:');
      console.error('   → See MONGODB_SETUP_SIMPLE.md for step-by-step guide');
      console.error('   → MongoDB Atlas: https://cloud.mongodb.com/');
      console.error('');
      console.error('='.repeat(70));
      console.error('');
      throw new Error(`Invalid MONGODB_URI: ${validation.error}`);
    }
    
    if (cloudUri.includes('localhost') || cloudUri.includes('127.0.0.1')) {
      console.error('');
      console.error('='.repeat(70));
      console.error('❌ MONGODB LOCALHOST NOT ALLOWED IN PRODUCTION');
      console.error('='.repeat(70));
      console.error('');
      console.error('Your MONGODB_URI points to localhost, which won\'t work in production.');
      console.error('');
      console.error('You need a cloud MongoDB database (MongoDB Atlas):');
      console.error('  → Free tier available at https://cloud.mongodb.com/');
      console.error('  → See MONGODB_SETUP_SIMPLE.md for setup instructions');
      console.error('');
      console.error('='.repeat(70));
      console.error('');
      throw new Error('Production error: MONGODB_URI cannot point to localhost');
    }
    return cloudUri;
  }
  
  // In development, prefer cloud but allow local fallback
  const uri = cloudUri || localUri;
  
  // Still validate format even in development
  if (cloudUri) {
    const validation = validateMongoUri(cloudUri);
    if (!validation.valid) {
      console.warn('');
      console.warn('⚠️  Warning: Invalid MONGODB_URI format');
      console.warn(`   ${validation.error}`);
      console.warn('   Falling back to local MongoDB');
      console.warn('');
      return localUri;
    }
  }
  
  return uri;
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
    console.error('');
    console.error('='.repeat(70));
    console.error('❌ Failed to connect to MongoDB');
    console.error('='.repeat(70));
    console.error('');
    console.error(`Error: ${error.message}`);
    console.error('');
    
    // Provide helpful error messages based on error type
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      console.error('🔍 Diagnosis: Network error - Cannot reach MongoDB server');
      console.error('');
      console.error('This usually means:');
      console.error('  • Your MongoDB cluster hostname is incorrect');
      console.error('  • The cluster is not accessible from your network');
      console.error('  • Your IP address is not whitelisted in MongoDB Atlas');
      console.error('');
      console.error('What to check:');
      console.error('  1. Verify your MONGODB_URI connection string is correct');
      console.error('  2. In MongoDB Atlas, go to Network Access and add your IP');
      console.error('     (or use 0.0.0.0/0 to allow all IPs for testing)');
      console.error('  3. Check that your cluster is running and not paused');
      console.error('');
    } else if (error.message.includes('authentication') || error.message.includes('AuthenticationFailed')) {
      console.error('🔍 Diagnosis: Authentication failed');
      console.error('');
      console.error('This means your username or password is incorrect.');
      console.error('');
      console.error('What to do:');
      console.error('  1. Go to MongoDB Atlas → Database Access');
      console.error('  2. Check your database user exists');
      console.error('  3. If needed, create a new user with a strong password');
      console.error('  4. Update MONGODB_URI with the correct credentials:');
      console.error('     mongodb+srv://USERNAME:PASSWORD@cluster...');
      console.error('');
      console.error('⚠️  Note: The password should be URL-encoded if it contains');
      console.error('   special characters like @, :, /, ?, #, [, ], @');
      console.error('');
    } else if (error.message.includes('timeout')) {
      console.error('🔍 Diagnosis: Connection timeout');
      console.error('');
      console.error('The MongoDB server is not responding.');
      console.error('');
      console.error('What to check:');
      console.error('  1. Your internet connection is working');
      console.error('  2. MongoDB Atlas cluster is not paused');
      console.error('  3. Network Access settings allow your IP address');
      console.error('  4. No firewall is blocking the connection');
      console.error('');
    } else if (error.message.includes('Invalid scheme')) {
      console.error('🔍 Diagnosis: Invalid connection string format');
      console.error('');
      console.error('Your MONGODB_URI must start with:');
      console.error('  • mongodb:// for standard connection');
      console.error('  • mongodb+srv:// for MongoDB Atlas (recommended)');
      console.error('');
    }
    
    console.error('📚 Need help?');
    console.error('   → See MONGODB_SETUP_SIMPLE.md for detailed setup guide');
    console.error('   → MongoDB Atlas: https://cloud.mongodb.com/');
    console.error('   → Documentation: https://github.com/rhysllwydlewis/eventflow#troubleshooting');
    console.error('');
    console.error('='.repeat(70));
    console.error('');
    
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
