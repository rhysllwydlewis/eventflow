/**
 * Synchronous Data Access Wrapper for EventFlow
 *
 * This module provides synchronous versions of the data-access functions
 * for compatibility with existing server.js code.
 *
 * IMPORTANT: This uses synchronous wrappers around async functions, which
 * means MongoDB operations will fall back to local storage. For true MongoDB
 * integration, endpoints should be converted to async/await.
 *
 * This is a transition layer to maintain compatibility while migrating.
 */

const dataAccess = require('./data-access');
const { read: readLocal, write: writeLocal, uid, DATA_DIR } = require('./store');

// Check MongoDB availability once at module initialization
const MONGODB_ENABLED = dataAccess.isMongoDBEnabled();

// Track if we've warned about sync usage
let hasWarnedAboutSync = false;

function warnAboutSync() {
  if (!hasWarnedAboutSync && MONGODB_ENABLED) {
    console.warn('⚠️  Using synchronous data access - MongoDB writes will be delayed');
    console.warn('   For better MongoDB integration, convert endpoints to async/await');
    hasWarnedAboutSync = true;
  }
}

/**
 * Synchronous read from collection
 * Always returns local storage data immediately
 */
function read(collectionName) {
  warnAboutSync();
  return readLocal(collectionName);
}

/**
 * Synchronous write to collection
 * Writes to local storage immediately
 * MongoDB sync happens in background if available
 */
function write(collectionName, data) {
  warnAboutSync();

  // Write to local storage immediately
  writeLocal(collectionName, data);

  // Sync to MongoDB in background (fire and forget)
  if (MONGODB_ENABLED) {
    dataAccess.write(collectionName, data).catch(err => {
      console.error(`Background MongoDB write error for ${collectionName}:`, err.message);
    });
  }
}

module.exports = {
  read,
  write,
  uid,
  DATA_DIR,

  // Export async versions for endpoints that want to convert
  async: dataAccess,

  // Utility to check if MongoDB is enabled
  isMongoDBEnabled: dataAccess.isMongoDBEnabled,
};
