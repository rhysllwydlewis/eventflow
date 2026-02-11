/**
 * MessageQueue Model
 * MongoDB schema for offline message queue with retry logic
 */

'use strict';

const { ObjectId } = require('mongodb');

/**
 * MessageQueue Schema
 * Stores messages that failed to send and need retry
 */
const MessageQueueSchema = {
  _id: ObjectId,
  userId: String, // User ID of message sender
  message: Object, // Complete message object to be sent
  retryCount: Number, // Number of retry attempts (max 5)
  status: String, // 'pending' | 'sending' | 'failed' | 'sent'
  createdAt: Date, // When message was first queued
  lastAttempt: Date, // Last retry attempt timestamp
  nextRetry: Date, // When to try next (exponential backoff)
  error: String, // Last error message
  metadata: Object, // Additional metadata
};

/**
 * Queue status values
 */
const QUEUE_STATUS = {
  PENDING: 'pending',
  SENDING: 'sending',
  FAILED: 'failed',
  SENT: 'sent',
};

/**
 * Collection name
 */
const COLLECTION = 'messageQueue';

/**
 * Maximum retry attempts
 */
const MAX_RETRIES = 5;

/**
 * Retry intervals in seconds (exponential backoff)
 * [2s, 4s, 8s, 16s, 30s]
 */
const RETRY_INTERVALS = [2, 4, 8, 16, 30];

/**
 * Create indexes for optimal query performance
 */
async function createIndexes(db) {
  const collection = db.collection(COLLECTION);

  await collection.createIndex({ userId: 1, status: 1 });
  await collection.createIndex({ status: 1, nextRetry: 1 });
  await collection.createIndex({ createdAt: -1 });
  await collection.createIndex({ userId: 1, createdAt: -1 });

  console.log('✅ MessageQueue indexes created');
}

/**
 * Validate queue entry data
 */
function validateQueueEntry(data) {
  const errors = [];

  if (!data.userId) {
    errors.push('userId is required');
  }
  if (!data.message || typeof data.message !== 'object') {
    errors.push('message object is required');
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Create a new queue entry
 */
function createQueueEntry(data) {
  const now = new Date();

  return {
    _id: new ObjectId(),
    userId: data.userId,
    message: data.message,
    retryCount: 0,
    status: QUEUE_STATUS.PENDING,
    createdAt: now,
    lastAttempt: null,
    nextRetry: now, // Try immediately
    error: null,
    metadata: data.metadata || {},
  };
}

/**
 * Calculate next retry time based on retry count
 */
function calculateNextRetry(retryCount) {
  const intervalIndex = Math.min(retryCount, RETRY_INTERVALS.length - 1);
  const intervalSeconds = RETRY_INTERVALS[intervalIndex];
  return new Date(Date.now() + intervalSeconds * 1000);
}

module.exports = {
  MessageQueueSchema,
  COLLECTION,
  QUEUE_STATUS,
  MAX_RETRIES,
  RETRY_INTERVALS,
  createIndexes,
  validateQueueEntry,
  createQueueEntry,
  calculateNextRetry,
};
