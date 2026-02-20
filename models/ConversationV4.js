/**
 * Messenger v4 - Conversation Model
 * Unified conversation schema for the gold standard messaging system
 */

'use strict';

const { ObjectId } = require('mongodb');

/** Canonical list of valid conversation types — used by the route validator and service. */
const CONVERSATION_V4_TYPES = ['direct', 'marketplace', 'enquiry', 'supplier_network', 'support'];

/**
 * Conversation Schema for MongoDB
 */
const ConversationV4Schema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['type', 'participants', 'status', 'createdAt', 'updatedAt'],
      properties: {
        type: {
          bsonType: 'string',
          enum: ['direct', 'marketplace', 'enquiry', 'supplier_network', 'support'],
          description: 'Type of conversation',
        },
        participants: {
          bsonType: 'array',
          minItems: 1,
          items: {
            bsonType: 'object',
            required: ['userId', 'displayName', 'role'],
            properties: {
              userId: { bsonType: 'string' },
              displayName: { bsonType: 'string' },
              avatar: { bsonType: ['string', 'null'] },
              role: {
                bsonType: 'string',
                enum: ['customer', 'supplier', 'admin'],
              },
              isPinned: { bsonType: 'bool' },
              isMuted: { bsonType: 'bool' },
              isArchived: { bsonType: 'bool' },
              unreadCount: { bsonType: 'int' },
              lastReadAt: { bsonType: ['date', 'null'] },
            },
          },
        },
        context: {
          bsonType: ['object', 'null'],
          properties: {
            type: {
              bsonType: ['string', 'null'],
              enum: ['package', 'supplier_profile', 'marketplace_listing', 'find_a_supplier', null],
            },
            referenceId: { bsonType: ['string', 'null'] },
            referenceTitle: { bsonType: ['string', 'null'] },
            referenceImage: { bsonType: ['string', 'null'] },
          },
        },
        lastMessage: {
          bsonType: ['object', 'null'],
          properties: {
            content: { bsonType: 'string' },
            senderId: { bsonType: 'string' },
            senderName: { bsonType: 'string' },
            sentAt: { bsonType: 'date' },
            type: {
              bsonType: 'string',
              enum: ['text', 'image', 'file'],
            },
          },
        },
        metadata: {
          bsonType: 'object',
        },
        status: {
          bsonType: 'string',
          enum: ['active', 'closed'],
        },
        messageCount: {
          bsonType: 'int',
          minimum: 0,
        },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' },
      },
    },
  },
};

/**
 * Create indexes for optimal query performance
 */
async function createConversationV4Indexes(db) {
  const collection = db.collection('conversations_v4');

  await collection.createIndexes([
    // Compound index for participant lookups with status filtering
    {
      key: { 'participants.userId': 1, status: 1, updatedAt: -1 },
      name: 'participant_status_updated',
    },
    // Index for conversation type filtering
    {
      key: { type: 1, updatedAt: -1 },
      name: 'type_updated',
    },
    // Index for context reference lookups
    {
      key: { 'context.referenceId': 1, 'context.type': 1 },
      name: 'context_reference',
      sparse: true,
    },
    // Index for participant-specific settings
    {
      key: { 'participants.userId': 1, 'participants.isPinned': 1 },
      name: 'participant_pinned',
      sparse: true,
    },
    {
      key: { 'participants.userId': 1, 'participants.isArchived': 1 },
      name: 'participant_archived',
      sparse: true,
    },
    // Index for unread conversations
    {
      key: { 'participants.userId': 1, 'participants.unreadCount': 1 },
      name: 'participant_unread',
      sparse: true,
    },
    // Index for deduplication (prevent duplicate conversations)
    {
      key: { 'participants.userId': 1 },
      name: 'participants_dedup',
    },
  ]);
}

/**
 * Create indexes for chat messages collection
 */
async function createChatMessagesV4Indexes(db) {
  const collection = db.collection('chat_messages_v4');

  await collection.createIndexes([
    // Conversation messages sorted by time
    {
      key: { conversationId: 1, createdAt: -1 },
      name: 'conversation_created',
    },
    // Sender lookups
    {
      key: { senderId: 1, createdAt: -1 },
      name: 'sender_created',
    },
    // Read receipts
    {
      key: { 'readBy.userId': 1, 'readBy.readAt': -1 },
      name: 'read_by_user',
      sparse: true,
    },
    // Full-text search index
    {
      key: { content: 'text' },
      name: 'content_text',
      weights: { content: 10 },
      default_language: 'english',
    },
    // Reply threading
    {
      key: { 'replyTo.messageId': 1 },
      name: 'reply_to',
      sparse: true,
    },
    // Deleted messages filter
    {
      key: { conversationId: 1, isDeleted: 1, createdAt: -1 },
      name: 'conversation_deleted_created',
    },
  ]);
}

/**
 * Validate conversation data
 */
function validateConversation(data) {
  const errors = [];

  if (!data.type || !CONVERSATION_V4_TYPES.includes(data.type)) {
    errors.push('Invalid conversation type');
  }

  if (!Array.isArray(data.participants) || data.participants.length === 0) {
    errors.push('Participants array is required and must not be empty');
  }

  if (data.participants) {
    data.participants.forEach((p, i) => {
      if (!p.userId) errors.push(`Participant ${i}: userId is required`);
      if (!p.displayName) errors.push(`Participant ${i}: displayName is required`);
      if (!p.role || !['customer', 'supplier', 'admin'].includes(p.role)) {
        errors.push(`Participant ${i}: invalid role`);
      }
    });
  }

  if (!data.status || !['active', 'closed'].includes(data.status)) {
    errors.push('Invalid status');
  }

  return errors;
}

/**
 * Validate message data
 */
function validateMessage(data) {
  const errors = [];

  if (!data.conversationId) {
    errors.push('conversationId is required');
  }

  if (!data.senderId) {
    errors.push('senderId is required');
  }

  if (!data.senderName) {
    errors.push('senderName is required');
  }

  // Content is required unless the message has attachments (attachment-only messages are valid)
  const hasAttachments = Array.isArray(data.attachments) && data.attachments.length > 0;
  if (!hasAttachments && (!data.content || typeof data.content !== 'string' || data.content.trim().length === 0)) {
    errors.push('content is required and must be a non-empty string');
  }

  if (data.type && !['text', 'image', 'file', 'system'].includes(data.type)) {
    errors.push('Invalid message type');
  }

  return errors;
}

module.exports = {
  CONVERSATION_V4_TYPES,
  ConversationV4Schema,
  createConversationV4Indexes,
  createChatMessagesV4Indexes,
  validateConversation,
  validateMessage,
};
