/**
 * Mention Model
 * MongoDB schema for @mentions in messages
 */

'use strict';
const logger = require('../utils/logger.js');

const { ObjectId } = require('mongodb');

/**
 * Mention Schema
 * Stores @mentions of users in messages
 */
const MentionSchema = {
  _id: ObjectId,
  messageId: String, // ID of message containing the mention
  threadId: String, // Thread ID for context
  mentionedUserId: String, // User who was mentioned
  mentionedBy: String, // User who mentioned
  read: Boolean, // Whether mention has been read
  createdAt: Date, // When mention was created
  readAt: Date, // When mention was read
  metadata: Object, // Additional metadata
};

/**
 * Collection name
 */
const COLLECTION = 'mentions';

/**
 * Create indexes for optimal query performance
 */
async function createIndexes(db) {
  const collection = db.collection(COLLECTION);

  // Index for getting all mentions for a user
  await collection.createIndex({ mentionedUserId: 1, read: 1, createdAt: -1 });
  // Index for getting mentions in a specific message
  await collection.createIndex({ messageId: 1 });
  // Index for getting mentions in a thread
  await collection.createIndex({ threadId: 1, createdAt: -1 });
  // Index for cleanup and statistics
  await collection.createIndex({ createdAt: -1 });

  logger.info('✅ Mention indexes created');
}

/**
 * Validate mention data
 */
function validateMention(data) {
  const errors = [];

  if (!data.messageId) {
    errors.push('messageId is required');
  }
  if (!data.threadId) {
    errors.push('threadId is required');
  }
  if (!data.mentionedUserId) {
    errors.push('mentionedUserId is required');
  }
  if (!data.mentionedBy) {
    errors.push('mentionedBy is required');
  }
  if (data.mentionedUserId === data.mentionedBy) {
    errors.push('Cannot mention yourself');
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Create a new mention entry
 */
function createMention(data) {
  return {
    _id: new ObjectId(),
    messageId: data.messageId,
    threadId: data.threadId,
    mentionedUserId: data.mentionedUserId,
    mentionedBy: data.mentionedBy,
    read: false,
    createdAt: new Date(),
    readAt: null,
    metadata: data.metadata || {},
  };
}

/**
 * Parse @mentions from message content
 * Returns array of user IDs mentioned
 */
function parseMentions(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  // Match @username patterns (alphanumeric, underscore, hyphen)
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const matches = content.matchAll(mentionRegex);
  const usernames = [];

  for (const match of matches) {
    if (match[1]) {
      usernames.push(match[1]);
    }
  }

  return [...new Set(usernames)]; // Remove duplicates
}

module.exports = {
  MentionSchema,
  COLLECTION,
  createIndexes,
  validateMention,
  createMention,
  parseMentions,
};
