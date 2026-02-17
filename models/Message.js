/**
 * Message Model
 * MongoDB schema for real-time messaging system
 */

'use strict';

const { ObjectId } = require('mongodb');

/**
 * Message Schema
 * Stores individual messages in conversation threads
 */
const MessageSchema = {
  _id: ObjectId,
  threadId: String, // Reference to Thread
  senderId: String, // User ID of sender
  recipientIds: [String], // Array of recipient user IDs
  content: String, // Message text content
  attachments: [
    {
      type: String, // 'image', 'video', 'document'
      url: String, // URL to the file
      filename: String, // Original filename
      size: Number, // File size in bytes
      mimeType: String, // MIME type
      metadata: Object, // Additional metadata (dimensions, duration, etc.)
    },
  ],
  reactions: [
    {
      emoji: String, // Emoji reaction
      userId: String, // User who reacted
      createdAt: Date,
    },
  ],
  status: String, // 'sent', 'delivered', 'read'
  readBy: [
    {
      userId: String,
      readAt: Date,
    },
  ],
  deliveredTo: [
    {
      userId: String,
      deliveredAt: Date,
    },
  ],
  isDraft: Boolean, // Draft messages not yet sent
  parentMessageId: String, // For threaded replies
  editedAt: Date, // When message was last edited
  editHistory: [
    {
      content: String, // Previous content
      editedAt: Date, // When this edit was made
    },
  ],
  // Phase 1: Bulk operations and management fields
  isStarred: Boolean, // Flagged/starred status
  isArchived: Boolean, // Archive status
  archivedAt: Date, // When message was archived
  messageStatus: String, // 'new', 'waiting_response', 'resolved'
  lastActionedBy: String, // User ID who last performed action
  lastActionedAt: Date, // When last action was performed
  metadata: Object, // Additional metadata
  createdAt: Date,
  updatedAt: Date,
  deletedAt: Date, // Soft delete
};

/**
 * Thread Schema
 * Stores conversation threads between users
 */
const ThreadSchema = {
  _id: ObjectId,
  participants: [String], // Array of user IDs in the thread
  lastMessageId: String, // Reference to last message
  lastMessageAt: Date, // Timestamp of last message
  unreadCount: Object, // { userId: count } mapping
  status: String, // 'active', 'archived', 'deleted'
  pinnedAt: Object, // { userId: Date } mapping for pinned threads
  mutedUntil: Object, // { userId: Date } mapping for muted threads
  metadata: Object, // Additional metadata (subject, context, etc.)
  createdAt: Date,
  updatedAt: Date,
};

/**
 * Message Operation Schema
 * Stores audit trail and undo information for bulk operations
 */
const MessageOperationSchema = {
  _id: ObjectId,
  operationId: String, // Unique operation ID (UUID)
  userId: String, // User who performed the operation
  operationType: String, // 'delete', 'restore', 'flag', 'archive', 'restore_archive', 'mark_read'
  messageIds: [String], // Array of affected message IDs
  threadId: String, // Thread ID for context
  previousState: Object, // Stored state for undo { messages: [{_id, isStarred, isArchived, messageStatus, deletedAt}] }
  action: String, // Description of action
  reason: String, // Optional reason
  createdAt: Date,
  undoExpiresAt: Date, // Undo window expiration (30 seconds)
  undoTokenHash: String, // SHA-256 hash of undo token for security
  isUndone: Boolean, // Whether operation was undone
  undoneAt: Date, // When it was undone
  ipAddress: String, // Client IP for audit
  userAgent: String, // Client user agent
};

/**
 * Message Folder Schema
 * Stores custom folders for message organization
 */
const MessageFolderSchema = {
  _id: ObjectId,
  userId: String, // Owner of the folder
  name: String, // Folder name
  color: String, // Color code (hex)
  icon: String, // Emoji icon
  messageCount: Number, // Number of messages in folder
  isDefault: Boolean, // System folder (Inbox, Sent, etc.)
  createdAt: Date,
  updatedAt: Date,
};

/**
 * Collection names
 */
const COLLECTIONS = {
  MESSAGES: 'messages',
  THREADS: 'threads',
  MESSAGE_OPERATIONS: 'messageOperations',
  MESSAGE_FOLDERS: 'messageFolders',
};

/**
 * Message status values
 */
const MESSAGE_STATUS = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
};

/**
 * Message workflow status values (Phase 1)
 */
const MESSAGE_WORKFLOW_STATUS = {
  NEW: 'new',
  WAITING_RESPONSE: 'waiting_response',
  RESOLVED: 'resolved',
};

/**
 * Operation types for message operations (Phase 1)
 */
const OPERATION_TYPES = {
  DELETE: 'delete',
  RESTORE: 'restore',
  FLAG: 'flag',
  UNFLAG: 'unflag',
  ARCHIVE: 'archive',
  RESTORE_ARCHIVE: 'restore_archive',
  MARK_READ: 'mark_read',
  MARK_UNREAD: 'mark_unread',
};

/**
 * Thread status values
 */
const THREAD_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived',
  DELETED: 'deleted',
};

/**
 * Create indexes for optimal query performance
 */
async function createIndexes(db) {
  const messagesCollection = db.collection(COLLECTIONS.MESSAGES);
  const threadsCollection = db.collection(COLLECTIONS.THREADS);
  const operationsCollection = db.collection(COLLECTIONS.MESSAGE_OPERATIONS);
  const foldersCollection = db.collection(COLLECTIONS.MESSAGE_FOLDERS);

  // Message indexes
  await messagesCollection.createIndex({ threadId: 1, createdAt: -1 });
  await messagesCollection.createIndex({ senderId: 1 });
  await messagesCollection.createIndex({ recipientIds: 1 });
  await messagesCollection.createIndex({ status: 1 });
  await messagesCollection.createIndex({ createdAt: -1 });
  await messagesCollection.createIndex({ isDraft: 1 });
  // Phase 1 indexes
  await messagesCollection.createIndex({ isStarred: 1 });
  await messagesCollection.createIndex({ isArchived: 1 });
  await messagesCollection.createIndex({ messageStatus: 1 });
  await messagesCollection.createIndex({ lastActionedAt: -1 });
  // Text search index for message content
  await messagesCollection.createIndex({ content: 'text' }, { default_language: 'english' });

  // Thread indexes
  await threadsCollection.createIndex({ participants: 1 });
  await threadsCollection.createIndex({ lastMessageAt: -1 });
  await threadsCollection.createIndex({ status: 1 });
  await threadsCollection.createIndex({ unreadCount: 1 });

  // Message Operations indexes (Phase 1)
  await operationsCollection.createIndex({ operationId: 1 }, { unique: true });
  await operationsCollection.createIndex({ userId: 1 });
  await operationsCollection.createIndex({ operationType: 1 });
  await operationsCollection.createIndex({ createdAt: -1 });
  await operationsCollection.createIndex({ undoExpiresAt: 1 });
  await operationsCollection.createIndex({ isUndone: 1 });
  // TTL index to auto-delete operations after 30 days
  await operationsCollection.createIndex(
    { createdAt: 1 },
    { expireAfterSeconds: 2592000 } // 30 days
  );

  // Message Folders indexes (Phase 1)
  await foldersCollection.createIndex({ userId: 1 });
  await foldersCollection.createIndex({ name: 1 });

  console.log('✅ Message and Thread indexes created');
}

/**
 * Validate message data
 */
function validateMessage(data) {
  const errors = [];

  if (!data.threadId) {
    errors.push('threadId is required');
  }
  if (!data.senderId) {
    errors.push('senderId is required');
  }
  if (!data.recipientIds || !Array.isArray(data.recipientIds) || data.recipientIds.length === 0) {
    errors.push('recipientIds must be a non-empty array');
  }
  if (!data.content && (!data.attachments || data.attachments.length === 0)) {
    errors.push('content or attachments required');
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Validate thread data
 */
function validateThread(data) {
  const errors = [];

  if (!data.participants || !Array.isArray(data.participants) || data.participants.length < 2) {
    errors.push('participants must be an array with at least 2 users');
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Create a new message document
 */
function createMessage(data) {
  const now = new Date();

  return {
    _id: new ObjectId(),
    threadId: data.threadId,
    senderId: data.senderId,
    recipientIds: data.recipientIds || [],
    content: data.content || '',
    attachments: data.attachments || [],
    reactions: data.reactions || [],
    status: data.isDraft ? MESSAGE_STATUS.SENT : data.status || MESSAGE_STATUS.SENT,
    readBy: data.readBy || [],
    deliveredTo: data.deliveredTo || [],
    isDraft: data.isDraft || false,
    parentMessageId: data.parentMessageId || null,
    editedAt: null,
    editHistory: [],
    // Phase 1 fields with defaults
    isStarred: data.isStarred || false,
    isArchived: data.isArchived || false,
    archivedAt: null,
    messageStatus: data.messageStatus || MESSAGE_WORKFLOW_STATUS.NEW,
    lastActionedBy: null,
    lastActionedAt: null,
    metadata: data.metadata || {},
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

/**
 * Create a new thread document
 */
function createThread(data) {
  const now = new Date();

  return {
    _id: new ObjectId(),
    participants: data.participants || [],
    lastMessageId: data.lastMessageId || null,
    lastMessageAt: data.lastMessageAt || null,
    unreadCount: data.unreadCount || {},
    status: data.status || THREAD_STATUS.ACTIVE,
    pinnedAt: data.pinnedAt || {},
    mutedUntil: data.mutedUntil || {},
    metadata: data.metadata || {},
    createdAt: now,
    updatedAt: now,
  };
}

module.exports = {
  MessageSchema,
  ThreadSchema,
  MessageOperationSchema,
  MessageFolderSchema,
  COLLECTIONS,
  MESSAGE_STATUS,
  MESSAGE_WORKFLOW_STATUS,
  OPERATION_TYPES,
  THREAD_STATUS,
  createIndexes,
  validateMessage,
  validateThread,
  createMessage,
  createThread,
};
