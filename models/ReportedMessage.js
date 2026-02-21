/**
 * ReportedMessage Model
 * MongoDB schema for message reporting and moderation
 */

'use strict';
const logger = require('../utils/logger.js');

const { ObjectId } = require('mongodb');

/**
 * ReportedMessage Schema
 * Stores reports of inappropriate messages
 */
const ReportedMessageSchema = {
  _id: ObjectId,
  messageId: String, // ID of the reported message
  reportedBy: String, // User ID who reported
  reason: String, // 'spam' | 'harassment' | 'inappropriate' | 'other'
  details: String, // Optional detailed explanation
  status: String, // 'pending' | 'reviewed' | 'dismissed'
  createdAt: Date, // When report was created
  reviewedAt: Date, // When report was reviewed (if applicable)
  reviewedBy: String, // Admin user ID who reviewed
  reviewNotes: String, // Admin notes on the review
  metadata: Object, // Additional metadata
};

/**
 * Report reason values
 */
const REPORT_REASONS = {
  SPAM: 'spam',
  HARASSMENT: 'harassment',
  INAPPROPRIATE: 'inappropriate',
  OTHER: 'other',
};

/**
 * Report status values
 */
const REPORT_STATUS = {
  PENDING: 'pending',
  REVIEWED: 'reviewed',
  DISMISSED: 'dismissed',
};

/**
 * Collection name
 */
const COLLECTION = 'reportedMessages';

/**
 * Create indexes for optimal query performance
 */
async function createIndexes(db) {
  const collection = db.collection(COLLECTION);

  await collection.createIndex({ messageId: 1 });
  await collection.createIndex({ reportedBy: 1, createdAt: -1 });
  await collection.createIndex({ status: 1, createdAt: -1 });
  await collection.createIndex({ reason: 1, status: 1 });
  await collection.createIndex({ createdAt: -1 });

  logger.info('✅ ReportedMessage indexes created');
}

/**
 * Validate reported message data
 */
function validateReportedMessage(data) {
  const errors = [];

  if (!data.messageId) {
    errors.push('messageId is required');
  }
  if (!data.reportedBy) {
    errors.push('reportedBy is required');
  }
  if (!data.reason || !Object.values(REPORT_REASONS).includes(data.reason)) {
    errors.push('Valid reason is required (spam, harassment, inappropriate, other)');
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Create a new reported message entry
 */
function createReportedMessage(data) {
  return {
    _id: new ObjectId(),
    messageId: data.messageId,
    reportedBy: data.reportedBy,
    reason: data.reason,
    details: data.details || '',
    status: REPORT_STATUS.PENDING,
    createdAt: new Date(),
    reviewedAt: null,
    reviewedBy: null,
    reviewNotes: null,
    metadata: data.metadata || {},
  };
}

module.exports = {
  ReportedMessageSchema,
  REPORT_REASONS,
  REPORT_STATUS,
  COLLECTION,
  createIndexes,
  validateReportedMessage,
  createReportedMessage,
};
