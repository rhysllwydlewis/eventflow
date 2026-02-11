/**
 * BlockedUser Model
 * MongoDB schema for user blocking functionality
 */

'use strict';

const { ObjectId } = require('mongodb');

/**
 * BlockedUser Schema
 * Stores user blocking relationships
 */
const BlockedUserSchema = {
  _id: ObjectId,
  userId: String, // User who blocked someone
  blockedUserId: String, // User who was blocked
  reason: String, // Optional reason for blocking
  createdAt: Date, // When the block was created
  metadata: Object, // Additional metadata
};

/**
 * Collection name
 */
const COLLECTION = 'blockedUsers';

/**
 * Create indexes for optimal query performance
 */
async function createIndexes(db) {
  const collection = db.collection(COLLECTION);

  // Compound index for checking if user A blocked user B
  await collection.createIndex({ userId: 1, blockedUserId: 1 }, { unique: true });
  // Index for finding all users blocked by a user
  await collection.createIndex({ userId: 1, createdAt: -1 });
  // Index for finding who blocked a specific user
  await collection.createIndex({ blockedUserId: 1 });

  console.log('✅ BlockedUser indexes created');
}

/**
 * Validate blocked user data
 */
function validateBlockedUser(data) {
  const errors = [];

  if (!data.userId) {
    errors.push('userId is required');
  }
  if (!data.blockedUserId) {
    errors.push('blockedUserId is required');
  }
  if (data.userId === data.blockedUserId) {
    errors.push('Cannot block yourself');
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Create a new blocked user entry
 */
function createBlockedUser(data) {
  return {
    _id: new ObjectId(),
    userId: data.userId,
    blockedUserId: data.blockedUserId,
    reason: data.reason || '',
    createdAt: new Date(),
    metadata: data.metadata || {},
  };
}

module.exports = {
  BlockedUserSchema,
  COLLECTION,
  createIndexes,
  validateBlockedUser,
  createBlockedUser,
};
