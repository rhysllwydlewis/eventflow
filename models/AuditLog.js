/**
 * Audit Log Model (MongoDB)
 * Schema and indexes for audit log storage
 */

'use strict';

/**
 * Audit Log Schema Definition
 * Used when MongoDB is available for optimal storage and querying
 */
const AuditLogSchema = {
  // Unique identifier
  _id: String,

  // Actor (who performed the action)
  actor: {
    id: String,
    email: String,
    role: String,
  },

  // Action type
  action: String,

  // Resource affected
  resource: {
    type: String,
    id: String,
  },

  // Changes made (before/after)
  changes: Object,

  // Request metadata
  ipAddress: String,
  userAgent: String,

  // Additional details
  details: Object,

  // Timestamp
  timestamp: Date,
  createdAt: Date,
};

/**
 * Indexes for performance
 * Applied when MongoDB is available
 */
const AuditLogIndexes = [
  // Index on actor.id for user-specific queries
  {
    key: { 'actor.id': 1 },
    name: 'actor_id_index',
  },
  // Index on action for action-specific queries
  {
    key: { action: 1 },
    name: 'action_index',
  },
  // Index on resource type and ID for resource-specific queries
  {
    key: { 'resource.type': 1, 'resource.id': 1 },
    name: 'resource_index',
  },
  // Index on timestamp for time-based queries (descending for recent-first)
  {
    key: { timestamp: -1 },
    name: 'timestamp_index',
  },
  // Compound index for common query patterns
  {
    key: { 'actor.id': 1, timestamp: -1 },
    name: 'actor_timestamp_index',
  },
];

/**
 * TTL (Time To Live) configuration
 * Optional: Automatically delete old audit logs after specified time
 * Set to null to keep logs indefinitely
 * Example: 365 * 24 * 60 * 60 (1 year)
 */
const TTL_SECONDS = null; // Keep indefinitely by default

/**
 * Initialize audit log collection with schema and indexes
 * @param {Object} db - MongoDB database instance
 * @returns {Promise<Object>} Collection object
 */
async function initializeAuditLogCollection(db) {
  const collection = db.collection('audit_logs');

  // Create indexes
  for (const indexSpec of AuditLogIndexes) {
    await collection.createIndex(indexSpec.key, {
      name: indexSpec.name,
      background: true, // Create index in background
    });
  }

  // Create TTL index if configured
  if (TTL_SECONDS) {
    await collection.createIndex(
      { createdAt: 1 },
      {
        name: 'ttl_index',
        expireAfterSeconds: TTL_SECONDS,
        background: true,
      }
    );
  }

  return collection;
}

/**
 * Validate audit log document before insertion
 * @param {Object} doc - Audit log document
 * @returns {boolean} True if valid
 * @throws {Error} If validation fails
 */
function validateAuditLog(doc) {
  if (!doc._id) {
    throw new Error('Audit log must have an _id');
  }
  if (!doc.actor || !doc.actor.id) {
    throw new Error('Audit log must have an actor with id');
  }
  if (!doc.action) {
    throw new Error('Audit log must have an action');
  }
  if (!doc.resource || !doc.resource.type) {
    throw new Error('Audit log must have a resource with type');
  }
  if (!doc.timestamp) {
    throw new Error('Audit log must have a timestamp');
  }
  return true;
}

/**
 * Create audit log document
 * @param {Object} data - Audit log data
 * @returns {Object} Formatted audit log document
 */
function createAuditLogDocument(data) {
  const doc = {
    _id: data._id || data.id,
    actor: {
      id: data.actor.id,
      email: data.actor.email || 'unknown',
      role: data.actor.role || 'unknown',
    },
    action: data.action,
    resource: {
      type: data.resource.type,
      id: data.resource.id || 'unknown',
    },
    changes: data.changes || null,
    ipAddress: data.ipAddress || null,
    userAgent: data.userAgent || null,
    details: data.details || {},
    timestamp: new Date(data.timestamp),
    createdAt: new Date(data.createdAt || data.timestamp),
  };

  validateAuditLog(doc);
  return doc;
}

module.exports = {
  AuditLogSchema,
  AuditLogIndexes,
  TTL_SECONDS,
  initializeAuditLogCollection,
  validateAuditLog,
  createAuditLogDocument,
};
