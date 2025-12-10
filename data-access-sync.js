/**
 * Synchronous Data Access Wrapper for EventFlow
 * 
 * This module provides synchronous versions of the data-access functions
 * for compatibility with existing server.js code.
 * 
 * IMPORTANT: This uses synchronous wrappers around async functions, which
 * means Firebase operations will fall back to local storage. For true Firebase
 * integration, endpoints should be converted to async/await.
 * 
 * This is a transition layer to maintain compatibility while migrating.
 */

const dataAccess = require('./data-access');
const { read: readLocal, write: writeLocal, uid, DATA_DIR } = require('./store');

// Check Firebase availability once at module initialization
const FIREBASE_ENABLED = dataAccess.isFirebaseEnabled();

// Track if we've warned about sync usage
let hasWarnedAboutSync = false;

function warnAboutSync() {
  if (!hasWarnedAboutSync && FIREBASE_ENABLED) {
    console.warn('⚠️  Using synchronous data access - Firebase writes will be delayed');
    console.warn('   For better Firebase integration, convert endpoints to async/await');
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
 * Firebase sync happens in background if available
 */
function write(collectionName, data) {
  warnAboutSync();
  
  // Write to local storage immediately
  writeLocal(collectionName, data);
  
  // Sync to Firebase in background (fire and forget)
  if (FIREBASE_ENABLED) {
    dataAccess.write(collectionName, data).catch(err => {
      console.error(`Background Firebase write error for ${collectionName}:`, err.message);
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
  
  // Utility to check if Firebase is enabled
  isFirebaseEnabled: dataAccess.isFirebaseEnabled
};
