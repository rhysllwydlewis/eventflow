/**
 * MessageLabel Model
 * MongoDB schema for message labels/tags
 */

'use strict';

const { ObjectId } = require('mongodb');

/**
 * MessageLabel Schema
 * Stores labels that can be applied to messages
 */
const MessageLabelSchema = {
  _id: ObjectId,
  userId: String, // Owner of the label
  name: String, // Label name
  color: String, // Text color
  backgroundColor: String, // Background color
  icon: String, // Emoji or icon identifier
  messageCount: Number, // Number of messages with this label
  category: String, // Optional category for grouping
  isShared: Boolean, // Whether label is shared
  sharedWith: [
    {
      userId: String,
      permission: String, // 'view', 'manage'
      sharedAt: Date,
    },
  ],
  autoRules: [
    {
      _id: ObjectId,
      name: String, // Rule name
      condition: Object, // Query condition for auto-labeling
      confidence: Number, // ML confidence score (0-1)
      isActive: Boolean,
      appliedCount: Number, // How many times rule has been applied
      createdAt: Date,
      updatedAt: Date,
    },
  ],
  metadata: {
    createdAt: Date,
    updatedAt: Date,
    lastUsed: Date, // Last time label was applied
    usageCount: Number, // Total times label has been used
    frequency: Number, // Usage frequency (uses per day)
  },
  mlModel: {
    isTrained: Boolean, // Whether ML model is trained for this label
    trainingDataPoints: Number, // Number of training examples
    accuracy: Number, // Model accuracy (0-1)
    lastTrainedAt: Date, // Last training date
  },
};

/**
 * Collection names
 */
const COLLECTIONS = {
  MESSAGE_LABELS: 'messageLabels',
};

/**
 * Label permissions
 */
const LABEL_PERMISSIONS = {
  VIEW: 'view',
  MANAGE: 'manage',
};

/**
 * Default label colors (Material Design palette)
 */
const DEFAULT_LABEL_COLORS = [
  { color: '#FFFFFF', backgroundColor: '#EF4444' }, // Red
  { color: '#FFFFFF', backgroundColor: '#F97316' }, // Orange
  { color: '#000000', backgroundColor: '#F59E0B' }, // Yellow
  { color: '#FFFFFF', backgroundColor: '#10B981' }, // Green
  { color: '#FFFFFF', backgroundColor: '#3B82F6' }, // Blue
  { color: '#FFFFFF', backgroundColor: '#8B5CF6' }, // Purple
  { color: '#FFFFFF', backgroundColor: '#EC4899' }, // Pink
  { color: '#FFFFFF', backgroundColor: '#6B7280' }, // Gray
];

/**
 * Create a new label object
 * @param {Object} labelData - Label data
 * @returns {Object} Label object
 */
function createLabel(labelData) {
  const now = new Date();
  const defaultColor = DEFAULT_LABEL_COLORS[0];

  return {
    _id: new ObjectId(),
    userId: labelData.userId,
    name: labelData.name,
    color: labelData.color || defaultColor.color,
    backgroundColor: labelData.backgroundColor || defaultColor.backgroundColor,
    icon: labelData.icon || '🏷️',
    messageCount: 0,
    category: labelData.category || null,
    isShared: false,
    sharedWith: [],
    autoRules: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      lastUsed: null,
      usageCount: 0,
      frequency: 0,
    },
    mlModel: {
      isTrained: false,
      trainingDataPoints: 0,
      accuracy: 0,
      lastTrainedAt: null,
    },
  };
}

/**
 * Validate label data
 * @param {Object} labelData - Label data to validate
 * @returns {Object} Validation result
 */
function validateLabel(labelData) {
  const errors = [];

  // Name validation
  if (!labelData.name || typeof labelData.name !== 'string') {
    errors.push('Label name is required');
  } else if (labelData.name.length < 1 || labelData.name.length > 50) {
    errors.push('Label name must be between 1 and 50 characters');
  }

  // User ID validation
  if (!labelData.userId || typeof labelData.userId !== 'string') {
    errors.push('User ID is required');
  }

  // Color validation (hex code)
  if (labelData.color && !/^#[0-9A-F]{6}$/i.test(labelData.color)) {
    errors.push('Invalid color format (must be hex code like #FFFFFF)');
  }

  if (labelData.backgroundColor && !/^#[0-9A-F]{6}$/i.test(labelData.backgroundColor)) {
    errors.push('Invalid background color format (must be hex code like #3B82F6)');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Create default labels for a new user
 * @param {string} userId - User ID
 * @returns {Array} Array of default label objects
 */
function createDefaultLabels(userId) {
  const defaultLabels = [
    {
      userId,
      name: 'Urgent',
      icon: '🚨',
      color: '#FFFFFF',
      backgroundColor: '#EF4444',
      category: 'Priority',
    },
    {
      userId,
      name: 'Important',
      icon: '⚠️',
      color: '#FFFFFF',
      backgroundColor: '#F97316',
      category: 'Priority',
    },
    {
      userId,
      name: 'Work',
      icon: '💼',
      color: '#FFFFFF',
      backgroundColor: '#3B82F6',
      category: 'Context',
    },
    {
      userId,
      name: 'Personal',
      icon: '👤',
      color: '#FFFFFF',
      backgroundColor: '#10B981',
      category: 'Context',
    },
    {
      userId,
      name: 'Finance',
      icon: '💰',
      color: '#FFFFFF',
      backgroundColor: '#F59E0B',
      category: 'Topic',
    },
    {
      userId,
      name: 'Follow Up',
      icon: '🔄',
      color: '#FFFFFF',
      backgroundColor: '#8B5CF6',
      category: 'Action',
    },
  ];

  return defaultLabels.map(label => createLabel(label));
}

module.exports = {
  MessageLabelSchema,
  COLLECTIONS,
  LABEL_PERMISSIONS,
  DEFAULT_LABEL_COLORS,
  createLabel,
  validateLabel,
  createDefaultLabels,
};
