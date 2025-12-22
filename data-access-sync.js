/**
 * Synchronous Data Access Wrapper for EventFlow
 *
 * DEPRECATED: This wrapper always reads from local storage, not MongoDB.
 * Server.js should use db-unified.js directly with async/await instead.
 *
 * Kept for backward compatibility only. Will be removed in future version.
 */

const { read: readLocal, write: writeLocal, uid, DATA_DIR } = require('./store');

console.warn('⚠️  WARNING: data-access-sync.js is deprecated');
console.warn('   This module always uses local storage, bypassing MongoDB');
console.warn('   Update your code to use db-unified.js with async/await');

/**
 * @deprecated Use db-unified.read() with await instead
 */
function read(collectionName) {
  return readLocal(collectionName);
}

/**
 * @deprecated Use db-unified.write() with await instead
 */
function write(collectionName, data) {
  writeLocal(collectionName, data);
}

module.exports = {
  read,
  write,
  uid,
  DATA_DIR,
};
