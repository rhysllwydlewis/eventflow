/**
 * ChatMessage Model (v5)
 * MongoDB schemas and utilities for the unified chat system
 * Collections: chat_conversations, chat_messages
 */

'use strict';

// Conversation types
const CONVERSATION_TYPES = {
  DIRECT: 'direct',
  MARKETPLACE: 'marketplace',
  ENQUIRY: 'enquiry',
  SUPPORT: 'support',
};

// Participant roles
const PARTICIPANT_ROLES = {
  CUSTOMER: 'customer',
  SUPPLIER: 'supplier',
  ADMIN: 'admin',
};

// Message types
const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  SYSTEM: 'system',
};

// Message status
const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
};

// Conversation status
const CONVERSATION_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
};

// Context types
const CONTEXT_TYPES = {
  SUPPLIER_PROFILE: 'supplier_profile',
  PACKAGE: 'package',
  MARKETPLACE_LISTING: 'marketplace_listing',
  FIND_A_SUPPLIER: 'find_a_supplier',
};

/**
 * Create indexes for chat_conversations collection
 * @param {Object} db - MongoDB database instance
 */
async function createConversationIndexes(db) {
  const collection = db.collection('chat_conversations');

  await Promise.all([
    // Query by participant
    collection.createIndex({ 'participants.userId': 1, status: 1, updatedAt: -1 }),

    // Query by participant with filters
    collection.createIndex({
      'participants.userId': 1,
      'participants.isArchived': 1,
      'participants.isPinned': 1,
    }),

    // Unread conversations
    collection.createIndex({ 'participants.userId': 1, 'participants.unreadCount': 1 }),

    // Context lookups
    collection.createIndex({ 'context.type': 1, 'context.entityId': 1 }),

    // Prevent duplicate conversations
    collection.createIndex({ type: 1, 'participants.userId': 1 }, { unique: false }),

    // Sort by last activity
    collection.createIndex({ updatedAt: -1 }),

    // Status filter
    collection.createIndex({ status: 1 }),
  ]);
}

/**
 * Create indexes for chat_messages collection
 * @param {Object} db - MongoDB database instance
 */
async function createMessageIndexes(db) {
  const collection = db.collection('chat_messages');

  await Promise.all([
    // Query messages by conversation
    collection.createIndex({ conversationId: 1, createdAt: -1 }),

    // Query by sender
    collection.createIndex({ senderId: 1, createdAt: -1 }),

    // Full-text search
    collection.createIndex({ content: 'text', 'attachments.filename': 'text' }),

    // Status filters
    collection.createIndex({ conversationId: 1, status: 1, createdAt: -1 }),

    // Deleted messages
    collection.createIndex({ deletedAt: 1 }),

    // Reply threading
    collection.createIndex({ 'replyTo.messageId': 1 }),
  ]);
}

/**
 * Factory function to create a new conversation document
 * @param {Object} params - Conversation parameters
 * @returns {Object} Conversation document
 */
function createConversation({
  type,
  participants, // Array of { userId, displayName, avatar, role }
  context = null, // { type, entityId, entityName, entityImage }
  metadata = {},
}) {
  const now = new Date();

  return {
    type,
    participants: participants.map(p => ({
      userId: p.userId,
      displayName: p.displayName,
      avatar: p.avatar || null,
      role: p.role,
      joinedAt: now,
      lastReadAt: null,
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      isArchived: false,
    })),
    context,
    lastMessage: null,
    metadata,
    status: CONVERSATION_STATUS.ACTIVE,
    messageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Factory function to create a new message document
 * @param {Object} params - Message parameters
 * @returns {Object} Message document
 */
function createMessage({
  conversationId,
  senderId,
  senderName,
  senderAvatar = null,
  content,
  type = MESSAGE_TYPES.TEXT,
  attachments = [],
  replyTo = null,
}) {
  const now = new Date();

  return {
    conversationId,
    senderId,
    senderName,
    senderAvatar,
    content,
    type,
    attachments,
    replyTo,
    reactions: [],
    readBy: [{ userId: senderId, readAt: now }],
    editedAt: null,
    deletedAt: null,
    status: MESSAGE_STATUS.SENT,
    createdAt: now,
  };
}

/**
 * Validate conversation participant
 * @param {Object} participant - Participant object
 * @returns {Object} Validation result
 */
function validateParticipant(participant) {
  if (!participant.userId || typeof participant.userId !== 'string') {
    return { valid: false, error: 'Participant userId is required' };
  }
  if (!participant.displayName || typeof participant.displayName !== 'string') {
    return { valid: false, error: 'Participant displayName is required' };
  }
  if (!participant.role || !Object.values(PARTICIPANT_ROLES).includes(participant.role)) {
    return { valid: false, error: 'Invalid participant role' };
  }
  return { valid: true };
}

/**
 * Validate conversation type
 * @param {string} type - Conversation type
 * @returns {boolean}
 */
function isValidConversationType(type) {
  return Object.values(CONVERSATION_TYPES).includes(type);
}

/**
 * Validate message type
 * @param {string} type - Message type
 * @returns {boolean}
 */
function isValidMessageType(type) {
  return Object.values(MESSAGE_TYPES).includes(type);
}

module.exports = {
  // Constants
  CONVERSATION_TYPES,
  PARTICIPANT_ROLES,
  MESSAGE_TYPES,
  MESSAGE_STATUS,
  CONVERSATION_STATUS,
  CONTEXT_TYPES,

  // Index creation
  createConversationIndexes,
  createMessageIndexes,

  // Factory functions
  createConversation,
  createMessage,

  // Validation
  validateParticipant,
  isValidConversationType,
  isValidMessageType,
};
