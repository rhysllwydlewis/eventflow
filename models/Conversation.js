/**
 * Conversation Model
 * Schema and index definitions for messenger v3 conversations collection
 */

'use strict';

/**
 * Conversation Schema Definition
 *
 * @typedef {Object} Conversation
 * @property {ObjectId} _id - Unique conversation identifier
 * @property {string} type - Conversation type: 'direct', 'marketplace', 'enquiry', 'support'
 * @property {Array<Participant>} participants - Array of conversation participants
 * @property {Object} context - Optional context linking conversation to a package/listing/etc
 * @property {Object} lastMessage - Last message preview for conversation list
 * @property {Object} metadata - Additional metadata (subject, event details, etc)
 * @property {string} status - Conversation status: 'active', 'closed'
 * @property {number} messageCount - Total message count
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * Participant Schema
 *
 * @typedef {Object} Participant
 * @property {string} userId - User ID
 * @property {string} displayName - User's display name
 * @property {string} avatar - Avatar URL or initial
 * @property {string} role - User role: 'customer', 'supplier', 'admin'
 * @property {Date} joinedAt - When user joined the conversation
 * @property {Date} lastReadAt - Last time user read messages
 * @property {boolean} isPinned - User has pinned this conversation
 * @property {boolean} isMuted - User has muted notifications
 * @property {boolean} isArchived - User has archived this conversation
 * @property {number} unreadCount - Number of unread messages for this user
 */

/**
 * Message Schema Definition
 *
 * @typedef {Object} ChatMessage
 * @property {ObjectId} _id - Unique message identifier
 * @property {ObjectId} conversationId - Reference to parent conversation
 * @property {string} senderId - User ID of sender
 * @property {string} senderName - Sender's display name
 * @property {string} senderAvatar - Sender's avatar URL
 * @property {string} content - Message text content
 * @property {string} type - Message type: 'text', 'image', 'file', 'system'
 * @property {Array<Attachment>} attachments - Array of file attachments
 * @property {Array<Reaction>} reactions - Array of emoji reactions
 * @property {Array<ReadReceipt>} readBy - Array of read receipts
 * @property {Object} replyTo - Optional reference to replied message
 * @property {Array<Object>} editHistory - History of edits
 * @property {boolean} isEdited - Whether message has been edited
 * @property {boolean} isDeleted - Whether message has been soft-deleted
 * @property {string} status - Delivery status: 'sent', 'delivered', 'read'
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} updatedAt - Last update timestamp
 */

/**
 * Create required indexes for conversations collection
 * @param {Object} db - MongoDB database instance
 */
async function createConversationIndexes(db) {
  const collection = db.collection('conversations');

  // Index for finding user's conversations sorted by activity
  await collection.createIndex(
    { 'participants.userId': 1, updatedAt: -1 },
    { name: 'user_conversations_by_activity' }
  );

  // Index for finding archived/active conversations per user
  await collection.createIndex(
    { 'participants.userId': 1, 'participants.isArchived': 1 },
    { name: 'user_conversations_by_archive_status' }
  );

  // Index for finding conversations by context (package, listing, etc)
  await collection.createIndex(
    { 'context.referenceId': 1, 'context.type': 1 },
    { name: 'conversations_by_context' }
  );

  // Index for filtering by status
  await collection.createIndex({ status: 1 }, { name: 'conversations_by_status' });

  console.log('✅ Conversation indexes created successfully');
}

/**
 * Create required indexes for chat_messages collection
 * @param {Object} db - MongoDB database instance
 */
async function createMessageIndexes(db) {
  const collection = db.collection('chat_messages');

  // Index for retrieving messages in a conversation (most common query)
  await collection.createIndex(
    { conversationId: 1, createdAt: -1 },
    { name: 'conversation_messages_by_date' }
  );

  // Index for finding messages by sender
  await collection.createIndex(
    { conversationId: 1, senderId: 1 },
    { name: 'conversation_messages_by_sender' }
  );

  // Index for user's sent messages
  await collection.createIndex({ senderId: 1 }, { name: 'messages_by_sender' });

  // Text search index for message content
  await collection.createIndex({ content: 'text' }, { name: 'message_text_search' });

  // Index for filtering deleted messages
  await collection.createIndex({ isDeleted: 1 }, { name: 'messages_by_deleted_status' });

  console.log('✅ Chat message indexes created successfully');
}

/**
 * Initialize all conversation and message indexes
 * @param {Object} db - MongoDB database instance
 */
async function initializeIndexes(db) {
  try {
    await createConversationIndexes(db);
    await createMessageIndexes(db);
    return true;
  } catch (error) {
    console.error('Failed to create messenger indexes:', error);
    throw error;
  }
}

/**
 * Validate conversation document
 * @param {Object} conversation - Conversation document to validate
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
function validateConversation(conversation) {
  if (
    !conversation.type ||
    !['direct', 'marketplace', 'enquiry', 'support'].includes(conversation.type)
  ) {
    throw new Error('Invalid conversation type');
  }

  if (
    !conversation.participants ||
    !Array.isArray(conversation.participants) ||
    conversation.participants.length === 0
  ) {
    throw new Error('Conversation must have at least one participant');
  }

  for (const participant of conversation.participants) {
    if (!participant.userId || !participant.displayName || !participant.role) {
      throw new Error('Participant missing required fields');
    }
  }

  if (!conversation.status || !['active', 'closed'].includes(conversation.status)) {
    throw new Error('Invalid conversation status');
  }

  return true;
}

/**
 * Validate message document
 * @param {Object} message - Message document to validate
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
function validateMessage(message) {
  if (!message.conversationId) {
    throw new Error('Message must have conversationId');
  }

  if (!message.senderId || !message.senderName) {
    throw new Error('Message must have sender information');
  }

  if (!message.content && (!message.attachments || message.attachments.length === 0)) {
    throw new Error('Message must have content or attachments');
  }

  if (!message.type || !['text', 'image', 'file', 'system'].includes(message.type)) {
    throw new Error('Invalid message type');
  }

  return true;
}

module.exports = {
  createConversationIndexes,
  createMessageIndexes,
  initializeIndexes,
  validateConversation,
  validateMessage,
};
