/**
 * MessageFolder Model
 * MongoDB schema for custom message folders
 */

'use strict';

const { ObjectId } = require('mongodb');

/**
 * MessageFolder Schema
 * Stores user-created folders for organizing messages
 */
const MessageFolderSchema = {
  _id: ObjectId,
  userId: String, // Owner of the folder
  name: String, // Folder name
  parentId: String, // For nested folders (null if root level)
  color: String, // Hex color code
  icon: String, // Emoji or icon identifier
  isSystemFolder: Boolean, // Inbox, Sent, Drafts, etc. (cannot be deleted)
  messageCount: Number, // Number of messages in folder
  unreadCount: Number, // Number of unread messages
  order: Number, // Display order
  isShared: Boolean, // Whether folder is shared
  sharedWith: [
    {
      userId: String,
      permission: String, // 'view', 'manage', 'admin'
      sharedAt: Date,
    },
  ],
  rules: [
    {
      _id: ObjectId,
      name: String, // Rule name
      condition: Object, // Query condition for auto-filing
      action: String, // 'move', 'copy', 'label'
      isActive: Boolean,
      appliedCount: Number, // How many times rule has been applied
      createdAt: Date,
      updatedAt: Date,
    },
  ],
  settings: {
    autoArchiveAfterDays: Number, // Auto-archive messages after N days
    notificationEnabled: Boolean, // Receive notifications for this folder
    isCollapsed: Boolean, // UI state - collapsed in sidebar
    sortBy: String, // 'date', 'sender', 'subject'
  },
  metadata: {
    createdAt: Date,
    updatedAt: Date,
    deletedAt: Date, // Soft delete
    lastMessageAt: Date, // Timestamp of last message
    messageSize: Number, // Total size of messages in bytes
  },
};

/**
 * Collection names
 */
const COLLECTIONS = {
  MESSAGE_FOLDERS: 'messageFolders',
};

/**
 * System folder types
 */
const SYSTEM_FOLDERS = {
  INBOX: 'inbox',
  SENT: 'sent',
  DRAFTS: 'drafts',
  STARRED: 'starred',
  ARCHIVED: 'archived',
  TRASH: 'trash',
};

/**
 * Folder permissions
 */
const FOLDER_PERMISSIONS = {
  VIEW: 'view',
  MANAGE: 'manage',
  ADMIN: 'admin',
};

/**
 * Create a new folder object
 * @param {Object} folderData - Folder data
 * @returns {Object} Folder object
 */
function createFolder(folderData) {
  const now = new Date();

  return {
    _id: new ObjectId(),
    userId: folderData.userId,
    name: folderData.name,
    parentId: folderData.parentId || null,
    color: folderData.color || '#3B82F6',
    icon: folderData.icon || '📁',
    isSystemFolder: folderData.isSystemFolder || false,
    messageCount: 0,
    unreadCount: 0,
    order: folderData.order || 0,
    isShared: false,
    sharedWith: [],
    rules: [],
    settings: {
      autoArchiveAfterDays: folderData.settings?.autoArchiveAfterDays || null,
      notificationEnabled: folderData.settings?.notificationEnabled !== false,
      isCollapsed: folderData.settings?.isCollapsed || false,
      sortBy: folderData.settings?.sortBy || 'date',
    },
    metadata: {
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastMessageAt: null,
      messageSize: 0,
    },
  };
}

/**
 * Validate folder data
 * @param {Object} folderData - Folder data to validate
 * @returns {Object} Validation result
 */
function validateFolder(folderData) {
  const errors = [];

  // Name validation
  if (!folderData.name || typeof folderData.name !== 'string') {
    errors.push('Folder name is required');
  } else if (folderData.name.length < 1 || folderData.name.length > 100) {
    errors.push('Folder name must be between 1 and 100 characters');
  }

  // User ID validation
  if (!folderData.userId || typeof folderData.userId !== 'string') {
    errors.push('User ID is required');
  }

  // Color validation (hex code)
  if (folderData.color && !/^#[0-9A-F]{6}$/i.test(folderData.color)) {
    errors.push('Invalid color format (must be hex code like #3B82F6)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create system folders for a new user
 * @param {string} userId - User ID
 * @returns {Array} Array of system folder objects
 */
function createSystemFolders(userId) {
  const systemFolders = [
    {
      userId,
      name: 'Inbox',
      icon: '📥',
      color: '#3B82F6',
      isSystemFolder: true,
      order: 1,
    },
    {
      userId,
      name: 'Sent',
      icon: '📤',
      color: '#10B981',
      isSystemFolder: true,
      order: 2,
    },
    {
      userId,
      name: 'Drafts',
      icon: '📝',
      color: '#F59E0B',
      isSystemFolder: true,
      order: 3,
    },
    {
      userId,
      name: 'Starred',
      icon: '⭐',
      color: '#EF4444',
      isSystemFolder: true,
      order: 4,
    },
    {
      userId,
      name: 'Archived',
      icon: '📦',
      color: '#6B7280',
      isSystemFolder: true,
      order: 5,
    },
    {
      userId,
      name: 'Trash',
      icon: '🗑️',
      color: '#9CA3AF',
      isSystemFolder: true,
      order: 6,
    },
  ];

  return systemFolders.map(folder => createFolder(folder));
}

module.exports = {
  MessageFolderSchema,
  COLLECTIONS,
  SYSTEM_FOLDERS,
  FOLDER_PERMISSIONS,
  createFolder,
  validateFolder,
  createSystemFolders,
};
