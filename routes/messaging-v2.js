/**
 * Messaging API v2 Routes
 * RESTful endpoints for real-time messaging and notifications
 */

'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const { writeLimiter } = require('../middleware/rateLimits');
const { createDeprecationMiddleware } = require('../middleware/legacyMessaging');

// Dependencies injected by server.js
let authRequired;
let roleRequired;
let csrfProtection;
let logger;
let mongoDb;
let wsServerV2;

// Service classes (imported directly as they're not instantiated until we have mongoDb)
const MessagingService = require('../services/messagingService');
const { NotificationService } = require('../services/notificationService');
const { PresenceService } = require('../services/presenceService');

const router = express.Router();

// Services will be initialized when MongoDB is available
let messagingService;
let notificationService;
let presenceService;

// Configure multer for message attachments
const attachmentStorage = multer.memoryStorage();

const attachmentFileFilter = (req, file, cb) => {
  // Allow images, PDFs, and common document types
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images, PDFs, and office documents are allowed.'), false);
  }
};

const attachmentUpload = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Max 10 files per message
  },
});

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Messaging v2 routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = ['authRequired', 'roleRequired', 'csrfProtection', 'logger', 'mongoDb'];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Messaging v2 routes: missing required dependencies: ${missing.join(', ')}`);
  }

  authRequired = deps.authRequired;
  roleRequired = deps.roleRequired;
  csrfProtection = deps.csrfProtection;
  logger = deps.logger;
  mongoDb = deps.mongoDb;
  // wsServerV2 is optional (may not be available in all environments)
  wsServerV2 = deps.wsServerV2;
}

/**
 * Initialize router and create required directories
 * @param {Object} deps - Dependencies object
 */
async function initializeRouter(deps) {
  initializeDependencies(deps);

  // Services will be initialized lazily on first request to avoid blocking
  // MongoDB connection during startup

  // Ensure attachments directory exists for development/fallback use
  // In production with MongoDB available, attachments are stored in the database
  if (process.env.NODE_ENV !== 'production') {
    const fs = require('fs').promises;
    const uploadsDir = path.join(__dirname, '..', 'uploads', 'attachments');
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      if (logger) {
        logger.info('Attachments directory ready (dev fallback):', uploadsDir);
      }
    } catch (err) {
      if (err.code !== 'EEXIST') {
        if (logger) {
          logger.error('Failed to initialize attachments directory:', err);
        }
        // Non-fatal in production since MongoDB is used instead
        if (logger) {
          logger.warn('Could not create attachments directory; relying on MongoDB storage');
        }
      }
    }
  }
}

/**
 * Deferred middleware wrappers
 * These are safe to reference in route definitions at require() time
 * because they defer the actual middleware call to request time,
 * when dependencies are guaranteed to be initialized.
 */
function applyAuthRequired(req, res, next) {
  if (!authRequired) {
    return res.status(503).json({ error: 'Auth service not initialized' });
  }
  return authRequired(req, res, next);
}

function applyRoleRequired(role) {
  return (req, res, next) => {
    if (!roleRequired) {
      return res.status(503).json({ error: 'Role service not initialized' });
    }
    return roleRequired(role)(req, res, next);
  };
}

function applyCsrfProtection(req, res, next) {
  if (!csrfProtection) {
    return res.status(503).json({ error: 'CSRF service not initialized' });
  }
  return csrfProtection(req, res, next);
}

// Initialize services with database instance
async function initializeServices() {
  if (mongoDb && !messagingService) {
    try {
      // Get database instance (not module)
      const db = await mongoDb.getDb();
      messagingService = new MessagingService(db);
      notificationService = new NotificationService(db, wsServerV2);
      presenceService = new PresenceService();
      if (logger) {
        logger.info('Messaging v2 services initialized');
      }
    } catch (error) {
      if (logger) {
        logger.error('Failed to initialize messaging services:', error);
      }
      throw error;
    }
  }
}

/**
 * Helper function to store attachment files
 * Stores attachments in MongoDB when available (persists across deployments).
 * Falls back to local filesystem when MongoDB is not available (development only).
 */
async function storeAttachment(file) {
  const fs = require('fs').promises;
  const crypto = require('crypto');

  // Sanitize original filename to prevent path traversal and special chars
  const sanitizedOriginalName = file.originalname
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace special chars with underscore
    .replace(/\.{2,}/g, '_') // Replace multiple dots with underscore
    .substring(0, 255); // Limit length

  // Generate unique ID for storage
  const hash = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const ext = path.extname(sanitizedOriginalName).toLowerCase();
  const filename = `${timestamp}-${hash}${ext}`;

  // Use MongoDB cloud storage when available (persists across deployments)
  if (mongoDb) {
    try {
      const db = await mongoDb.getDb();
      const attachmentId = `att_${timestamp}_${hash}`;
      await db.collection('attachments').insertOne({
        _id: attachmentId,
        data: file.buffer.toString('base64'),
        mimeType: file.mimetype,
        filename: sanitizedOriginalName || 'attachment',
        size: file.size,
        createdAt: new Date().toISOString(),
      });
      if (logger) {
        logger.info('Attachment stored in MongoDB', { attachmentId, size: file.size });
      }
      return {
        type: file.mimetype.startsWith('image/') ? 'image' : 'document',
        url: `/api/v2/messages/attachments/${attachmentId}`,
        filename: sanitizedOriginalName || 'attachment',
        size: file.size,
        mimeType: file.mimetype,
        metadata: {},
      };
    } catch (dbError) {
      if (logger) {
        logger.error('Failed to store attachment in MongoDB, falling back to filesystem:', dbError);
      }
      // Fall through to filesystem storage
    }
  }

  // Fallback: local filesystem (development or when MongoDB unavailable)
  if (logger) {
    logger.warn(
      'Attachment stored to local filesystem — files will be lost on redeployment. ' +
        'Configure MongoDB for production attachment storage.'
    );
  }

  // Store in uploads/attachments directory
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'attachments');

  // Ensure directory exists with proper error handling
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    // Only ignore if directory already exists
    if (err.code !== 'EEXIST') {
      if (logger) {
        logger.error('Failed to create attachments directory:', err);
      }
      throw new Error('Storage system unavailable');
    }
  }

  const filepath = path.join(uploadsDir, filename);

  // Write file
  await fs.writeFile(filepath, file.buffer);

  // Return attachment object with sanitized original filename
  return {
    type: file.mimetype.startsWith('image/') ? 'image' : 'document',
    url: `/uploads/attachments/${filename}`,
    filename: sanitizedOriginalName || 'attachment',
    size: file.size,
    mimeType: file.mimetype,
    metadata: {},
  };
}

// Middleware to ensure services are initialized
// Lazily initializes services with database instance on first request
async function ensureServices(req, res, next) {
  if (!messagingService && mongoDb) {
    try {
      await initializeServices();
    } catch (error) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Failed to initialize messaging services',
      });
    }
  }

  if (!messagingService) {
    return res.status(503).json({
      error: 'Messaging service not available',
      message: 'Database connection required',
    });
  }

  next();
}

/**
 * Helper function to build thread query for both v1 (thd_*) and v2 (ObjectId) thread IDs
 * @param {string} threadId - Thread ID (either ObjectId or v1 string like 'thd_xxx')
 * @returns {Object} MongoDB query object
 */
function buildThreadQuery(threadId) {
  if (ObjectId.isValid(threadId)) {
    return { _id: new ObjectId(threadId) };
  } else {
    // v1 threads use string IDs like 'thd_xxxxx' stored in an 'id' field
    return { $or: [{ _id: threadId }, { id: threadId }] };
  }
}

/**
 * Helper function to check if a user is a participant in a thread
 * Handles both v1 threads (customerId/supplierId/recipientId) and v2 threads (participants array)
 * @param {Object} thread - Thread object
 * @param {string} userId - User ID to check
 * @param {Object} db - MongoDB database instance (optional, for supplier owner lookup)
 * @returns {Promise<boolean>} True if user is a participant
 */
async function isThreadParticipant(thread, userId, db = null) {
  if (!thread || !userId) {
    return false;
  }

  // v2 threads have a participants array
  if (thread.participants && Array.isArray(thread.participants)) {
    return thread.participants.includes(userId);
  }

  // v1 threads use customerId/supplierId/recipientId fields
  if (thread.customerId === userId) {
    return true;
  }
  if (thread.recipientId === userId) {
    return true;
  }

  // Note: supplierId is a supplier DB ID (like sup_xxxxx), NOT a user ID
  // We need to check if the userId is the owner of the supplier
  if (thread.supplierId && db) {
    try {
      const suppliersCollection = db.collection('suppliers');
      const supplier = await suppliersCollection.findOne({ id: thread.supplierId });
      if (supplier && supplier.ownerUserId === userId) {
        return true;
      }
    } catch (error) {
      logger.error('Error checking supplier ownership:', error);
      // Fall through to return false
    }
  }

  return false;
}

// =========================
// Deprecation Enforcement Middleware
// =========================

/**
 * Deprecation enforcement middleware for v2 Messaging API.
 * Behaviour is controlled by LEGACY_MESSAGING_MODE env var (off|read-only|on).
 * Write endpoints return HTTP 410 when mode is "off" or "read-only".
 */
router.use(
  createDeprecationMiddleware({
    version: 'v2',
    sunset: '2026-12-31',
    logger: msg => logger && logger.warn(msg),
  })
);

// =========================
// Thread Management
// =========================

/**
 * POST /api/v2/messages/threads
 * Create a new conversation thread
 * @deprecated Use POST /api/v4/messenger/conversations instead
 */
router.post(
  '/threads',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { participants, subject, metadata } = req.body;

      if (!participants || !Array.isArray(participants) || participants.length < 1) {
        return res.status(400).json({
          error: 'participants must be an array with at least one user',
        });
      }

      // Add current user to participants if not included
      const allParticipants = [...new Set([req.user.id, ...participants])];

      // Get user's subscription tier
      const subscriptionTier = req.user.subscriptionTier || 'free';

      const thread = await messagingService.createThread(
        allParticipants,
        {
          subject,
          ...metadata,
          createdBy: req.user.id,
        },
        subscriptionTier
      );

      res.status(201).json({
        success: true,
        thread: {
          id: thread._id.toString(),
          participants: thread.participants,
          metadata: thread.metadata,
          createdAt: thread.createdAt,
        },
      });
    } catch (error) {
      logger.error('Create thread error', { error: error.message, userId: req.user.id });

      // Handle limit-specific errors with proper status code
      if (error.message.includes('limit reached')) {
        return res.status(429).json({
          error: 'Thread limit reached',
          message: error.message,
          upgradeUrl: '/pricing.html',
        });
      }

      res.status(500).json({
        error: 'Failed to create thread',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v2/messages/threads
 * List threads for logged-in user
 */
router.get('/threads', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;

    const threads = await messagingService.getUserThreads(req.user.id, {
      status,
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
    });

    // Transform for response, including v1 thread fields for compatibility
    const threadsData = threads.map(thread => ({
      id: thread._id ? thread._id.toString() : thread.id,
      participants: thread.participants || [],
      lastMessageAt: thread.lastMessageAt,
      unreadCount: thread.unreadCount?.[req.user.id] || 0,
      status: thread.status,
      metadata: thread.metadata,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      // Include v1 thread fields for frontend compatibility
      ...(thread.supplierName !== undefined && { supplierName: thread.supplierName }),
      ...(thread.customerName !== undefined && { customerName: thread.customerName }),
      ...(thread.recipientName !== undefined && { recipientName: thread.recipientName }),
      ...(thread.subject !== undefined && { subject: thread.subject }),
      ...(thread.supplierId && { supplierId: thread.supplierId }),
      ...(thread.customerId && { customerId: thread.customerId }),
      ...(thread.recipientId && { recipientId: thread.recipientId }),
    }));

    res.json({
      success: true,
      threads: threadsData,
      count: threadsData.length,
    });
  } catch (error) {
    logger.error('List threads error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to list threads',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/messages/threads/:id
 * Get thread details
 */
router.get('/threads/:id', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { id } = req.params;

    const thread = await messagingService.getThread(id);

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Get database instance for participant check and name resolution
    const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;

    // Check if user is a participant (now async)
    const isParticipant = await isThreadParticipant(thread, req.user.id, db);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Always resolve and include name fields, even for v1 threads
    // This ensures the frontend always receives name fields (even if null) for proper fallback handling
    let resolvedSupplierName = thread.supplierName || null;
    let resolvedCustomerName = thread.customerName || null;
    let resolvedRecipientName = thread.recipientName || null;

    // Attempt to resolve null/missing names by looking up user data
    if (db) {
      const usersToLookup = [];

      // If v1 thread with null names, look up based on thread fields
      if (!resolvedCustomerName && thread.customerId) {
        usersToLookup.push(thread.customerId);
      }
      if (!resolvedRecipientName && thread.recipientId) {
        usersToLookup.push(thread.recipientId);
      }

      // For v2 threads or when names are missing, look up all participants
      // Use Set for O(n) complexity instead of includes() for O(n²)
      if (thread.participants && thread.participants.length > 0) {
        const usersSet = new Set(usersToLookup);
        thread.participants.forEach(p => {
          if (!usersSet.has(p)) {
            usersToLookup.push(p);
            usersSet.add(p);
          }
        });
      }

      if (usersToLookup.length > 0) {
        try {
          const usersCollection = db.collection('users');
          const participantUsers = await usersCollection
            .find({ id: { $in: usersToLookup } })
            .toArray();

          // Map participant IDs to names
          const participantNames = {};
          participantUsers.forEach(user => {
            participantNames[user.id] = user.name;
          });

          // Resolve names based on thread type
          if (thread.customerId && !resolvedCustomerName) {
            resolvedCustomerName = participantNames[thread.customerId] || null;
          }
          if (thread.recipientId && !resolvedRecipientName) {
            resolvedRecipientName = participantNames[thread.recipientId] || null;
          }

          // For v2 threads without explicit roles, map other participants to names
          if (!thread.supplierId && thread.participants) {
            const otherParticipants = thread.participants.filter(p => p !== req.user.id);
            if (otherParticipants.length > 0 && !resolvedCustomerName) {
              resolvedCustomerName = participantNames[otherParticipants[0]] || null;
            }
            if (otherParticipants.length > 1 && !resolvedRecipientName) {
              resolvedRecipientName = participantNames[otherParticipants[1]] || null;
            }
          }

          // If thread has supplierId, look up supplier name if not already set
          if (thread.supplierId && !resolvedSupplierName) {
            const suppliersCollection = db.collection('suppliers');
            const supplier = await suppliersCollection.findOne({ id: thread.supplierId });
            if (supplier) {
              resolvedSupplierName = supplier.name || null;
            }
          }
        } catch (error) {
          logger.error('Error looking up participant names:', error);
          // Continue with existing names - don't block the response
        }
      }
    }

    res.json({
      success: true,
      thread: {
        id: thread._id ? thread._id.toString() : thread.id,
        participants: thread.participants || [],
        lastMessageId: thread.lastMessageId,
        lastMessageAt: thread.lastMessageAt,
        unreadCount: thread.unreadCount?.[req.user.id] || 0,
        status: thread.status,
        metadata: thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        // Always include v1 thread fields (even if null) for proper frontend fallback
        supplierName: resolvedSupplierName,
        customerName: resolvedCustomerName,
        recipientName: resolvedRecipientName,
        ...(thread.supplierId && { supplierId: thread.supplierId }),
        ...(thread.customerId && { customerId: thread.customerId }),
        ...(thread.recipientId && { recipientId: thread.recipientId }),
        ...(thread.subject && { subject: thread.subject }),
      },
    });
  } catch (error) {
    logger.error('Get thread error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to get thread',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v2/messages/threads/:id
 * Delete/archive thread
 */
router.delete(
  '/threads/:id',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { id } = req.params;

      await messagingService.archiveThread(id, req.user.id);

      res.json({
        success: true,
        message: 'Thread archived successfully',
      });
    } catch (error) {
      logger.error('Delete thread error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to delete thread',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v2/messages/threads/:threadId/archive
 * Archive a thread
 */
router.post(
  '/threads/:threadId/archive',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { threadId } = req.params;
      await messagingService.archiveThread(threadId, req.user.id);
      res.json({ success: true, message: 'Thread archived successfully' });
    } catch (error) {
      logger.error('Archive thread error', { error: error.message, userId: req.user.id });
      res.status(500).json({ error: 'Failed to archive thread', message: error.message });
    }
  }
);

// =========================
// Specific Message Routes (must come before generic parameter routes)
// =========================

/**
 * GET /api/v2/messages/unread
 * Get total unread message count for current user
 */
router.get('/unread', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const threads = await messagingService.getUserThreads(userId);

    let totalUnread = 0;
    threads.forEach(t => {
      if (t.unreadCount && t.unreadCount[userId]) {
        totalUnread += t.unreadCount[userId];
      }
    });

    res.json({ count: totalUnread });
  } catch (error) {
    logger.error('Get unread count error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to fetch unread count',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/messages/drafts
 * Get all draft messages for current user
 */
router.get('/drafts', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const messages = await messagingService.messagesCollection
      .find({
        senderId: userId,
        isDraft: true,
        deletedAt: null,
      })
      .sort({ updatedAt: -1 })
      .toArray();

    res.json({ success: true, drafts: messages });
  } catch (error) {
    logger.error('Get drafts error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to fetch drafts',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/messages/sent
 * Get all sent messages for current user
 */
router.get('/sent', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const messages = await messagingService.messagesCollection
      .find({
        senderId: userId,
        isDraft: false,
        deletedAt: null,
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ success: true, messages });
  } catch (error) {
    logger.error('Get sent messages error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to fetch sent messages',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/messages/conversations
 * Alias for GET /threads - List all conversations/threads
 * Provides backward compatibility with v1 API
 */
router.get('/conversations', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const threads = await messagingService.getUserThreads(userId);
    res.json({ success: true, conversations: threads });
  } catch (error) {
    logger.error('Get conversations error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to fetch conversations',
      message: error.message,
    });
  }
});

// =========================
// Messaging (Generic Routes - must come after specific routes)
// =========================

// ============================================
// PHASE 1: BULK OPERATIONS & MANAGEMENT
// ============================================

/**
 * Bulk delete messages
 * POST /api/v2/messages/bulk-delete
 */
router.post(
  '/bulk-delete',
  writeLimiter,
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { messageIds, threadId, reason } = req.body;
      const userId = req.user.id;

      // Enhanced validation with detailed error messages
      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({
          error: 'messageIds array is required and must not be empty',
          retriable: false,
          code: 'INVALID_MESSAGE_IDS',
          hint: 'Provide an array of message IDs to delete',
        });
      }

      if (messageIds.length > 100) {
        return res.status(400).json({
          error: 'Cannot delete more than 100 messages at once',
          retriable: false,
          code: 'TOO_MANY_MESSAGES',
          limit: 100,
          provided: messageIds.length,
          hint: 'Split into smaller batches of 100 or fewer messages',
        });
      }

      // Validate all message IDs are valid ObjectIds
      const invalidIds = messageIds.filter(id => !ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          error: 'Invalid message IDs provided',
          retriable: false,
          code: 'INVALID_OBJECT_IDS',
          invalidIds: invalidIds.slice(0, 5), // Only show first 5 to avoid huge response
          invalidCount: invalidIds.length,
        });
      }

      if (!threadId) {
        return res.status(400).json({
          error: 'threadId is required',
          retriable: false,
          code: 'MISSING_THREAD_ID',
        });
      }

      if (!ObjectId.isValid(threadId)) {
        return res.status(400).json({
          error: 'Invalid threadId format',
          retriable: false,
          code: 'INVALID_THREAD_ID',
          threadId,
        });
      }

      // Verify user has access to the thread
      const thread = await messagingService.getThread(threadId, userId);
      if (!thread) {
        return res.status(404).json({
          error: 'Thread not found or access denied',
          retriable: false,
          code: 'THREAD_NOT_FOUND_OR_ACCESS_DENIED',
          threadId,
        });
      }

      // Perform bulk delete with timeout protection
      const startTime = Date.now();
      const result = await Promise.race([
        messagingService.bulkDeleteMessages(messageIds, userId, threadId, reason),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), 30000)),
      ]);
      const duration = Date.now() - startTime;

      logger.info('Bulk delete completed', {
        userId,
        threadId,
        deletedCount: result.deletedCount,
        duration,
      });

      res.json({
        success: true,
        deletedCount: result.deletedCount,
        operationId: result.operationId,
        undoToken: result.undoToken,
        message: `${result.deletedCount} message(s) deleted successfully`,
        duration,
      });
    } catch (error) {
      logger.error('Bulk delete error', {
        error: error.message,
        userId: req.user.id,
        threadId: req.body.threadId,
        messageCount: req.body.messageIds?.length,
      });

      const isTimeout = error.message === 'Operation timeout';
      res.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'Operation timed out' : 'Failed to delete messages',
        message: error.message,
        retriable: isTimeout,
        code: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
        hint: isTimeout ? 'Try with fewer messages or retry later' : undefined,
      });
    }
  }
);

/**
 * Bulk mark messages as read/unread
 * POST /api/v2/messages/bulk-mark-read
 */
router.post(
  '/bulk-mark-read',
  writeLimiter,
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { messageIds, isRead } = req.body;
      const userId = req.user.id;

      // Enhanced validation with detailed error messages
      if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({
          error: 'messageIds array is required and must not be empty',
          retriable: false,
          code: 'INVALID_MESSAGE_IDS',
          hint: 'Provide an array of message IDs',
        });
      }

      if (messageIds.length > 100) {
        return res.status(400).json({
          error: 'Cannot mark more than 100 messages at once',
          retriable: false,
          code: 'TOO_MANY_MESSAGES',
          limit: 100,
          provided: messageIds.length,
          hint: 'Split into smaller batches of 100 or fewer messages',
        });
      }

      // Validate all message IDs are valid ObjectIds
      const invalidIds = messageIds.filter(id => !ObjectId.isValid(id));
      if (invalidIds.length > 0) {
        return res.status(400).json({
          error: 'Invalid message IDs provided',
          retriable: false,
          code: 'INVALID_OBJECT_IDS',
          invalidIds: invalidIds.slice(0, 5),
          invalidCount: invalidIds.length,
        });
      }

      if (typeof isRead !== 'boolean') {
        return res.status(400).json({
          error: 'isRead must be a boolean',
          retriable: false,
          code: 'INVALID_IS_READ',
          received: typeof isRead,
          hint: 'Use true to mark as read, false to mark as unread',
        });
      }

      // Perform bulk mark read with timeout protection
      const startTime = Date.now();
      const result = await Promise.race([
        messagingService.bulkMarkRead(messageIds, userId, isRead),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), 30000)),
      ]);
      const duration = Date.now() - startTime;

      logger.info('Bulk mark read completed', {
        userId,
        updatedCount: result.updatedCount,
        isRead,
        duration,
      });

      res.json({
        success: true,
        updatedCount: result.updatedCount,
        message: `${result.updatedCount} message(s) marked as ${isRead ? 'read' : 'unread'}`,
        duration,
      });
    } catch (error) {
      logger.error('Bulk mark read error', {
        error: error.message,
        userId: req.user.id,
        messageCount: req.body.messageIds?.length,
        isRead: req.body.isRead,
      });

      const isTimeout = error.message === 'Operation timeout';
      res.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'Operation timed out' : 'Failed to mark messages',
        message: error.message,
        retriable: isTimeout,
        code: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
        hint: isTimeout ? 'Try with fewer messages or retry later' : undefined,
      });
    }
  }
);

/**
 * Undo an operation
 * POST /api/v2/messages/operations/:operationId/undo
 */
router.post(
  '/operations/:operationId/undo',
  writeLimiter,
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { operationId } = req.params;
      const { undoToken } = req.body;
      const userId = req.user.id;

      // Enhanced validation
      if (!operationId) {
        return res.status(400).json({
          error: 'operationId is required',
          retriable: false,
          code: 'MISSING_OPERATION_ID',
          hint: 'Provide the operationId from the original delete operation',
        });
      }

      if (!undoToken || typeof undoToken !== 'string') {
        return res.status(400).json({
          error: 'undoToken is required and must be a string',
          retriable: false,
          code: 'INVALID_UNDO_TOKEN',
          hint: 'Provide the undoToken from the original delete operation',
        });
      }

      // Perform undo with timeout protection
      const startTime = Date.now();
      const result = await Promise.race([
        messagingService.undoOperation(operationId, undoToken, userId),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), 30000)),
      ]);
      const duration = Date.now() - startTime;

      if (!result.success) {
        // Check if it's an expired undo window
        const isExpired =
          result.error?.includes('expired') || result.error?.includes('Undo window');
        return res.status(isExpired ? 410 : 400).json({
          error: result.error,
          retriable: false,
          code: isExpired ? 'UNDO_EXPIRED' : 'UNDO_FAILED',
          operationId,
        });
      }

      logger.info('Undo operation completed', {
        userId,
        operationId,
        restoredCount: result.restoredCount,
        duration,
      });

      res.json({
        success: true,
        restoredCount: result.restoredCount,
        message: `${result.restoredCount} message(s) restored successfully`,
        operationId,
        duration,
      });
    } catch (error) {
      logger.error('Undo operation error', {
        error: error.message,
        userId: req.user.id,
        operationId: req.params.operationId,
      });

      const isTimeout = error.message === 'Operation timeout';
      res.status(isTimeout ? 504 : 500).json({
        error: isTimeout ? 'Undo operation timed out' : 'Failed to undo operation',
        message: error.message,
        retriable: isTimeout,
        code: isTimeout ? 'TIMEOUT' : 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * Flag/unflag a message
 * POST /api/v2/messages/:id/flag
 */
router.post(
  '/:id/flag',
  writeLimiter,
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isFlagged } = req.body;
      const userId = req.user.id;

      // Validation
      if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid message ID' });
      }

      if (typeof isFlagged !== 'boolean') {
        return res.status(400).json({ error: 'isFlagged must be a boolean' });
      }

      // Perform flag
      const result = await messagingService.flagMessage(id, userId, isFlagged);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Flag message error', { error: error.message, userId: req.user.id });
      res.status(500).json({ error: 'Failed to flag message', message: error.message });
    }
  }
);

/**
 * Archive/restore a message
 * POST /api/v2/messages/:id/archive
 */
router.post(
  '/:id/archive',
  writeLimiter,
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { action } = req.body;
      const userId = req.user.id;

      // Validation
      if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid message ID' });
      }

      if (!action || !['archive', 'restore'].includes(action)) {
        return res.status(400).json({ error: 'action must be "archive" or "restore"' });
      }

      // Perform archive
      const result = await messagingService.archiveMessage(id, userId, action);

      res.json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      logger.error('Archive message error', { error: error.message, userId: req.user.id });
      res.status(500).json({ error: 'Failed to archive message', message: error.message });
    }
  }
);

/**
 * GET /api/v2/messages/attachments/:id
 * Serve a message attachment stored in MongoDB
 */
router.get('/attachments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Validate attachment ID format
    if (!id || !/^att_\d+_[a-f0-9]+$/.test(id)) {
      return res.status(400).json({ error: 'Invalid attachment ID' });
    }

    if (!mongoDb) {
      return res.status(503).json({ error: 'Storage not available' });
    }

    const db = await mongoDb.getDb();
    const attachment = await db.collection('attachments').findOne({ _id: id });

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const buffer = Buffer.from(attachment.data, 'base64');
    const safeFilename = (attachment.filename || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(buffer);
  } catch (error) {
    if (logger) {
      logger.error('Error serving attachment:', error);
    }
    res.status(500).json({ error: 'Failed to retrieve attachment' });
  }
});

/**
 * GET /api/v2/messages/:threadId
 * Get message history for a thread
 */
router.get('/:threadId', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { threadId } = req.params;
    const {
      limit = 100,
      skip = 0,
      before,
      // Phase 1: Sorting and filtering options
      sortBy,
      filterBy,
      dateFrom,
      dateTo,
      hasAttachments,
      status,
      page,
    } = req.query;

    // Verify access
    const thread = await messagingService.getThread(threadId);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Get database instance for participant check
    const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;
    const isParticipant = await isThreadParticipant(thread, req.user.id, db);
    if (!isParticipant) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Phase 1: Use new filtering/sorting method if params provided
    let messages, total, pageNum, pageSize;
    if (sortBy || filterBy || dateFrom || dateTo || hasAttachments !== undefined || status) {
      const result = await messagingService.getMessagesWithFilters(threadId, {
        sortBy,
        filterBy,
        dateFrom,
        dateTo,
        hasAttachments:
          hasAttachments === 'true' ? true : hasAttachments === 'false' ? false : null,
        status,
        page: page ? parseInt(page, 10) : 1,
        pageSize: limit ? parseInt(limit, 10) : 50,
      });
      messages = result.messages;
      total = result.total;
      pageNum = result.page;
      pageSize = result.pageSize;
    } else {
      // Legacy behavior
      messages = await messagingService.getThreadMessages(threadId, {
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
        before,
        thread, // Pass thread to avoid extra lookup
      });
    }

    // Transform for response
    const messagesData = messages.map(msg => ({
      id: msg._id.toString(),
      threadId: msg.threadId,
      senderId: msg.senderId,
      content: msg.content,
      text: msg.content, // Alias for backward compatibility
      attachments: msg.attachments,
      reactions: msg.reactions,
      status: msg.status,
      readBy: msg.readBy,
      deliveredTo: msg.deliveredTo || [],
      sentAt: msg.sentAt || msg.createdAt,
      createdAt: msg.createdAt,
      updatedAt: msg.updatedAt,
      // Phase 1 fields
      isStarred: msg.isStarred || false,
      isArchived: msg.isArchived || false,
      messageStatus: msg.messageStatus || 'new',
    }));

    const response = {
      success: true,
      messages: messagesData,
      count: messagesData.length,
    };

    // Add pagination info if using new method
    if (total !== undefined) {
      response.total = total;
      response.page = pageNum;
      response.pageSize = pageSize;
    }

    res.json(response);
  } catch (error) {
    logger.error('Get messages error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to get messages',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/messages/:threadId
 * Send message in thread
 * Supports both JSON and multipart/form-data (for attachments)
 */
router.post(
  '/:threadId',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  // Use multer middleware to handle file uploads
  (req, res, next) => {
    attachmentUpload.array('attachments', 10)(req, res, err => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              error: 'File too large',
              message: 'Maximum file size is 10MB per file',
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              error: 'Too many files',
              message: 'Maximum 10 files per message',
            });
          }
        }
        return res.status(400).json({
          error: 'File upload error',
          message: err.message,
        });
      }
      next();
    });
  },
  // Validate total file size and file contents
  (req, res, next) => {
    if (req.files && req.files.length > 0) {
      // Check for zero-byte files
      const emptyFiles = req.files.filter(f => f.size === 0);
      if (emptyFiles.length > 0) {
        return res.status(400).json({
          error: 'Empty files detected',
          message: `The following files are empty (0 bytes): ${emptyFiles.map(f => f.originalname).join(', ')}`,
        });
      }

      // Check total size across all files
      const totalSize = req.files.reduce((sum, f) => sum + f.size, 0);
      const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total

      if (totalSize > MAX_TOTAL_SIZE) {
        const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);
        return res.status(413).json({
          error: 'Total size too large',
          message: `Total attachment size (${totalSizeMB}MB) exceeds maximum of 25MB`,
        });
      }
    }
    next();
  },
  async (req, res) => {
    try {
      const { threadId } = req.params;
      // Support both 'content' (v2) and 'message' (legacy v1) for backward compatibility
      let content;
      const { message: legacyMessage } = req.body;
      content = req.body.content;

      // If 'message' is provided but not 'content', use 'message' as 'content'
      if (!content && legacyMessage) {
        content = legacyMessage;
      }

      // Process uploaded files
      const attachments = [];
      if (req.files && req.files.length > 0) {
        // Store files and create attachment objects
        for (const file of req.files) {
          try {
            const attachment = await storeAttachment(file);
            attachments.push(attachment);
          } catch (fileError) {
            logger.error('Failed to store attachment', {
              error: fileError.message,
              filename: file.originalname,
            });
            // Continue with other files, don't fail the whole request
          }
        }
      }

      if (!content && attachments.length === 0) {
        return res.status(400).json({
          error: 'content or attachments required',
        });
      }

      // Verify access
      const thread = await messagingService.getThread(threadId);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;
      if (!(await isThreadParticipant(thread, req.user.id, db))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Compute recipientIds with v1 fallback
      let recipientIds;
      if (thread.participants && Array.isArray(thread.participants)) {
        recipientIds = thread.participants.filter(p => p !== req.user.id);
      } else {
        // v1 thread: determine the other party
        recipientIds = [thread.customerId, thread.recipientId, thread.supplierId].filter(
          id => id && id !== req.user.id
        );
      }

      // Get user's subscription tier
      const subscriptionTier = req.user.subscriptionTier || 'free';

      const message = await messagingService.sendMessage(
        {
          threadId,
          senderId: req.user.id,
          recipientIds,
          content: content || '',
          attachments: attachments,
        },
        subscriptionTier
      );

      // Create notifications for recipients
      // Note: NotificationService.notifyNewMessage() automatically handles WebSocket
      // emission via the websocketServer it was initialized with, so no need to
      // emit notification:new events here
      if (notificationService && recipientIds && recipientIds.length > 0) {
        const senderName = req.user.name || req.user.username || 'Someone';
        const messagePreview = content ? content.substring(0, 100) : 'Sent an attachment';

        for (const recipientId of recipientIds) {
          try {
            await notificationService.notifyNewMessage(
              recipientId,
              senderName,
              threadId,
              messagePreview
            );
          } catch (notifError) {
            // Log but don't fail the message send if notification fails
            logger.error('Failed to create notification for message', {
              error: notifError.message,
              recipientId,
              threadId,
            });
          }
        }
      }

      res.status(201).json({
        success: true,
        message: {
          id: message._id.toString(),
          threadId: message.threadId,
          senderId: message.senderId,
          content: message.content,
          attachments: message.attachments,
          status: message.status,
          createdAt: message.createdAt,
        },
      });
    } catch (error) {
      logger.error('Send message error', { error: error.message, userId: req.user.id });

      // Handle limit-specific errors with proper status code
      if (error.message.includes('limit reached')) {
        return res.status(429).json({
          error: 'Message limit reached',
          message: error.message,
          upgradeUrl: '/pricing.html',
        });
      }

      res.status(500).json({
        error: 'Failed to send message',
        message: error.message,
      });
    }
  }
);

/**
 * PUT /api/v2/messages/:messageId
 * Update/edit a message (drafts only for now, expand later for edit feature)
 */
router.put(
  '/:messageId',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { messageId } = req.params;
      const { content } = req.body;

      if (!content || typeof content !== 'string') {
        return res.status(400).json({ error: 'Message content is required' });
      }

      const message = await messagingService.messagesCollection.findOne({
        _id: ObjectId.isValid(messageId) ? new ObjectId(messageId) : messageId,
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Only the sender can edit their message
      if (message.senderId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // For now, only allow editing drafts
      if (!message.isDraft) {
        return res.status(400).json({
          error: 'Only draft messages can be edited',
          hint: 'Full message editing feature coming soon',
        });
      }

      const updatedMessage = await messagingService.messagesCollection.findOneAndUpdate(
        {
          _id: message._id,
          senderId: userId,
        },
        {
          $set: {
            content,
            updatedAt: new Date(),
          },
        },
        { returnDocument: 'after' }
      );

      res.json({ success: true, message: updatedMessage.value });
    } catch (error) {
      logger.error('Update message error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to update message',
        message: error.message,
      });
    }
  }
);

/**
 * DELETE /api/v2/messages/:messageId
 * Delete a message (soft delete)
 */
router.delete(
  '/:messageId',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { messageId } = req.params;

      const message = await messagingService.messagesCollection.findOne({
        _id: ObjectId.isValid(messageId) ? new ObjectId(messageId) : messageId,
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Only the sender can delete their message
      if (message.senderId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Soft delete the message
      await messagingService.messagesCollection.updateOne(
        { _id: message._id },
        {
          $set: {
            deletedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      res.json({ success: true });
    } catch (error) {
      logger.error('Delete message error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to delete message',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v2/messages/:id/reactions
 * Add reaction to message
 */
router.post(
  '/:id/reactions',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ error: 'emoji required' });
      }

      const message = await messagingService.addReaction(id, req.user.id, emoji);

      res.json({
        success: true,
        reactions: message.reactions,
      });
    } catch (error) {
      logger.error('Add reaction error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to add reaction',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v2/messages/:id/read
 * Mark message as read
 */
router.post(
  '/:id/read',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { id } = req.params;

      await messagingService.markMessageAsRead(id, req.user.id);

      res.json({
        success: true,
        message: 'Message marked as read',
      });
    } catch (error) {
      logger.error('Mark as read error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to mark as read',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v2/messages/threads/:threadId/read
 * Mark all messages in thread as read
 */
router.post(
  '/threads/:threadId/read',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { threadId } = req.params;

      // Enhanced validation
      if (!threadId) {
        return res.status(400).json({
          error: 'Thread ID is required',
          retriable: false,
          code: 'MISSING_THREAD_ID',
        });
      }

      // Verify access
      const thread = await messagingService.getThread(threadId);
      if (!thread) {
        return res.status(404).json({
          error: 'Thread not found',
          retriable: false,
          code: 'THREAD_NOT_FOUND',
          threadId,
        });
      }

      const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;
      if (!(await isThreadParticipant(thread, req.user.id, db))) {
        return res.status(403).json({
          error: 'Access denied',
          retriable: false,
          code: 'ACCESS_DENIED',
        });
      }

      const count = await messagingService.markThreadAsRead(threadId, req.user.id);

      res.json({
        success: true,
        message: 'Thread marked as read',
        markedCount: count,
        threadId,
      });
    } catch (error) {
      logger.error('Mark thread as read error', {
        error: error.message,
        userId: req.user.id,
        threadId: req.params.threadId,
      });
      res.status(500).json({
        error: 'Failed to mark thread as read',
        message: error.message,
        retriable: true,
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

/**
 * POST /api/v2/messages/conversations/:conversationId/read
 * Alias for /threads/:threadId/read - for consistency with conversations nomenclature
 * Mark all messages in conversation as read
 */
router.post(
  '/conversations/:conversationId/read',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const conversationId = req.params.conversationId;

      // Enhanced validation
      if (!conversationId) {
        return res.status(400).json({
          error: 'Conversation ID is required',
          retriable: false,
          code: 'MISSING_CONVERSATION_ID',
        });
      }

      // Verify access
      const thread = await messagingService.getThread(conversationId);
      if (!thread) {
        return res.status(404).json({
          error: 'Conversation not found',
          retriable: false,
          code: 'CONVERSATION_NOT_FOUND',
          conversationId,
        });
      }

      const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;
      if (!(await isThreadParticipant(thread, req.user.id, db))) {
        return res.status(403).json({
          error: 'Access denied',
          retriable: false,
          code: 'ACCESS_DENIED',
        });
      }

      const count = await messagingService.markThreadAsRead(conversationId, req.user.id);

      res.json({
        success: true,
        message: 'Conversation marked as read',
        markedCount: count,
        conversationId,
      });
    } catch (error) {
      logger.error('Mark conversation as read error', {
        error: error.message,
        userId: req.user.id,
        conversationId: req.params.conversationId,
      });
      res.status(500).json({
        error: 'Failed to mark conversation as read',
        message: error.message,
        retriable: true,
        code: 'INTERNAL_ERROR',
      });
    }
  }
);

// =========================
// User Presence
// =========================

/**
 * GET /api/v2/presence/:userId
 * Get user presence
 */
router.get('/presence/:userId', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { userId } = req.params;

    const presence = await presenceService.getPresence(userId);

    res.json({
      success: true,
      userId,
      state: presence.state,
      lastSeen: presence.lastSeen,
    });
  } catch (error) {
    logger.error('Get presence error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get presence',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/presence
 * Get presence for current user's contacts
 */
router.get('/presence', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { userIds } = req.query;

    if (!userIds) {
      return res.status(400).json({ error: 'userIds query parameter required' });
    }

    const userIdArray = Array.isArray(userIds) ? userIds : userIds.split(',');
    const presence = await presenceService.getBulkPresence(userIdArray);

    res.json({
      success: true,
      presence,
    });
  } catch (error) {
    logger.error('Get bulk presence error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get presence',
      message: error.message,
    });
  }
});

// =========================
// Notifications
// =========================

/**
 * GET /api/v2/notifications
 * List notifications for current user
 */
router.get('/notifications', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { unreadOnly, limit = 50, skip = 0 } = req.query;

    const notifications = await notificationService.getUserNotifications(req.user.id, {
      unreadOnly: unreadOnly === 'true',
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
    });

    res.json({
      success: true,
      notifications,
      count: notifications.length,
    });
  } catch (error) {
    logger.error('Get notifications error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to get notifications',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/notifications
 * Send notification (admin only)
 */
router.post(
  '/notifications',
  applyAuthRequired,
  applyRoleRequired('admin'),
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { userId, type, title, message, data, channels } = req.body;

      if (!userId || !type || !title || !message) {
        return res.status(400).json({
          error: 'userId, type, title, and message are required',
        });
      }

      const notification = await notificationService.sendNotification(userId, {
        type,
        title,
        message,
        data,
        channels,
      });

      res.status(201).json({
        success: true,
        notification: {
          id: notification._id.toString(),
          ...notification,
        },
      });
    } catch (error) {
      logger.error('Send notification error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to send notification',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v2/notifications/preferences
 * Update notification preferences
 */
router.post(
  '/notifications/preferences',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { preferences } = req.body;

      if (!preferences || typeof preferences !== 'object') {
        return res.status(400).json({
          error: 'preferences object required',
        });
      }

      const updated = await notificationService.updateUserPreferences(req.user.id, preferences);

      res.json({
        success: true,
        preferences: updated,
      });
    } catch (error) {
      logger.error('Update preferences error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to update preferences',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v2/notifications/preferences
 * Get notification preferences
 */
router.get('/notifications/preferences', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const preferences = await notificationService.getUserPreferences(req.user.id);

    res.json({
      success: true,
      preferences,
    });
  } catch (error) {
    logger.error('Get preferences error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to get preferences',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/notifications/:id/read
 * Mark notification as read
 */
router.post(
  '/notifications/:id/read',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { id } = req.params;

      const success = await notificationService.markAsRead(id, req.user.id);

      if (!success) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      logger.error('Mark notification as read error', {
        error: error.message,
        userId: req.user.id,
      });
      res.status(500).json({
        error: 'Failed to mark as read',
        message: error.message,
      });
    }
  }
);

/**
 * DELETE /api/v2/notifications/:id
 * Delete notification
 */
router.delete(
  '/notifications/:id',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { id } = req.params;

      const success = await notificationService.deleteNotification(id, req.user.id);

      if (!success) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      res.json({
        success: true,
        message: 'Notification deleted',
      });
    } catch (error) {
      logger.error('Delete notification error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to delete notification',
        message: error.message,
      });
    }
  }
);

// =========================
// Performance Monitoring
// =========================

/**
 * GET /api/v2/messaging/status
 * Get WebSocket server health and statistics (admin only)
 */
router.get('/messaging/status', applyAuthRequired, applyRoleRequired('admin'), async (req, res) => {
  try {
    const wsServer = req.app.get('wsServerV2') || global.wsServerV2;

    if (!wsServer) {
      return res.json({
        success: true,
        status: 'not_initialized',
        message: 'WebSocket server not initialized',
      });
    }

    const stats = wsServer.getStats();
    const onlineCount = await presenceService.getOnlineCount();

    res.json({
      success: true,
      status: 'healthy',
      stats: {
        ...stats,
        onlineUsersActual: onlineCount,
      },
      timestamp: new Date(),
    });
  } catch (error) {
    logger.error('Get messaging status error', { error: error.message });
    res.status(500).json({
      error: 'Failed to get status',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/messages/limits
 * Get remaining message and thread limits for the current user
 */
router.get('/limits', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const subscriptionTier = req.user.subscriptionTier || 'free';

    const messageLimits = await messagingService.checkMessageLimit(req.user.id, subscriptionTier);
    const threadLimits = await messagingService.checkThreadLimit(req.user.id, subscriptionTier);

    res.json({
      success: true,
      subscription: subscriptionTier,
      messages: messageLimits,
      threads: threadLimits,
    });
  } catch (error) {
    logger.error('Get limits error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to check limits',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/messages/threads/:threadId/mark-unread
 * Mark a thread as unread for the current user
 */
router.post(
  '/threads/:threadId/mark-unread',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { threadId } = req.params;

      const thread = await messagingService.threadsCollection.findOne({
        _id: ObjectId.isValid(threadId) ? new ObjectId(threadId) : threadId,
      });

      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      // Verify user is a participant
      const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;
      if (!(await isThreadParticipant(thread, userId, db))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Increment unread count for this user
      await messagingService.threadsCollection.updateOne(
        { _id: thread._id },
        {
          $inc: { [`unreadCount.${userId}`]: 1 },
          $set: { updatedAt: new Date() },
        }
      );

      res.json({ success: true });
    } catch (error) {
      logger.error('Mark thread unread error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to mark thread as unread',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v2/messages/threads/:threadId/unarchive
 * Unarchive a thread
 */
router.post(
  '/threads/:threadId/unarchive',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { threadId } = req.params;
      await messagingService.unarchiveThread(threadId, req.user.id);
      res.json({ success: true, message: 'Thread unarchived successfully' });
    } catch (error) {
      logger.error('Unarchive thread error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to unarchive thread',
        message: error.message,
      });
    }
  }
);

/**
 * ============================================
 * MESSAGE QUEUE ENDPOINTS
 * ============================================
 */

/**
 * Add message to queue (offline support)
 * POST /api/v2/messages/queue
 */
router.post('/queue', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;

    if (!message || typeof message !== 'object') {
      return res.status(400).json({ error: 'Message object is required' });
    }

    const MessageQueue = require('../models/MessageQueue');
    const queueEntry = MessageQueue.createQueueEntry({
      userId,
      message,
      metadata: { userAgent: req.headers['user-agent'] },
    });

    await mongoDb.db.collection(MessageQueue.COLLECTION).insertOne(queueEntry);

    res.json({
      success: true,
      queueId: queueEntry._id.toString(),
      status: queueEntry.status,
    });
  } catch (error) {
    logger.error('Queue message error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to queue message', message: error.message });
  }
});

/**
 * Get pending messages from queue
 * GET /api/v2/messages/queue
 */
router.get('/queue', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const MessageQueue = require('../models/MessageQueue');

    const queuedMessages = await mongoDb.db
      .collection(MessageQueue.COLLECTION)
      .find({
        userId,
        status: { $in: [MessageQueue.QUEUE_STATUS.PENDING, MessageQueue.QUEUE_STATUS.FAILED] },
      })
      .sort({ createdAt: 1 })
      .toArray();

    res.json({ messages: queuedMessages, count: queuedMessages.length });
  } catch (error) {
    logger.error('Get queue error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to get queue', message: error.message });
  }
});

/**
 * Retry failed message from queue
 * POST /api/v2/messages/queue/:id/retry
 */
router.post('/queue/:id/retry', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const queueId = req.params.id;

    if (!ObjectId.isValid(queueId)) {
      return res.status(400).json({ error: 'Invalid queue ID' });
    }

    const MessageQueue = require('../models/MessageQueue');
    const queueEntry = await mongoDb.db
      .collection(MessageQueue.COLLECTION)
      .findOne({ _id: new ObjectId(queueId), userId });

    if (!queueEntry) {
      return res.status(404).json({ error: 'Queue entry not found' });
    }

    if (queueEntry.retryCount >= MessageQueue.MAX_RETRIES) {
      return res.status(400).json({ error: 'Max retries exceeded' });
    }

    // Update queue entry for retry
    const nextRetry = MessageQueue.calculateNextRetry(queueEntry.retryCount);
    await mongoDb.db.collection(MessageQueue.COLLECTION).updateOne(
      { _id: new ObjectId(queueId) },
      {
        $set: {
          status: MessageQueue.QUEUE_STATUS.PENDING,
          nextRetry,
        },
        $inc: { retryCount: 1 },
      }
    );

    res.json({ success: true, nextRetry });
  } catch (error) {
    logger.error('Retry queue message error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to retry message', message: error.message });
  }
});

/**
 * Remove message from queue
 * DELETE /api/v2/messages/queue/:id
 */
router.delete('/queue/:id', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const queueId = req.params.id;

    if (!ObjectId.isValid(queueId)) {
      return res.status(400).json({ error: 'Invalid queue ID' });
    }

    const MessageQueue = require('../models/MessageQueue');
    const result = await mongoDb.db
      .collection(MessageQueue.COLLECTION)
      .deleteOne({ _id: new ObjectId(queueId), userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Queue entry not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Delete queue message error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to delete message', message: error.message });
  }
});

/**
 * ============================================
 * SEARCH ENDPOINTS
 * ============================================
 */

/**
 * Search messages with filters
 * GET /api/v2/messages/search?q=query&participant=userId&startDate=...
 */
router.get('/search', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      q,
      participant,
      startDate,
      endDate,
      status,
      hasAttachments,
      page = 1,
      limit = 20,
    } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const skip = (pageNum - 1) * limitNum;

    // Build search query
    const searchQuery = {
      $text: { $search: q },
      $or: [{ senderId: userId }, { recipientIds: userId }],
      deletedAt: null,
    };

    // Add filters
    if (participant) {
      searchQuery.$or = [
        { senderId: participant, recipientIds: userId },
        { senderId: userId, recipientIds: participant },
      ];
    }

    if (startDate || endDate) {
      searchQuery.createdAt = {};
      if (startDate) {
        searchQuery.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        searchQuery.createdAt.$lte = new Date(endDate);
      }
    }

    if (status === 'read') {
      searchQuery['readBy.userId'] = userId;
    } else if (status === 'unread') {
      searchQuery['readBy.userId'] = { $ne: userId };
    }

    if (hasAttachments === 'true') {
      searchQuery['attachments.0'] = { $exists: true };
    }

    // Execute search
    const [results, total] = await Promise.all([
      mongoDb.db
        .collection('messages')
        .find(searchQuery, { projection: { score: { $meta: 'textScore' } } })
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .toArray(),
      mongoDb.db.collection('messages').countDocuments(searchQuery),
    ]);

    res.json({
      results,
      total,
      page: pageNum,
      hasMore: skip + results.length < total,
    });
  } catch (error) {
    logger.error('Search messages error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to search messages', message: error.message });
  }
});

/**
 * ============================================
 * MESSAGE EDITING ENDPOINTS
 * ============================================
 */

/**
 * Edit message content
 * PUT /api/v2/messages/:messageId/edit
 */
router.put('/:messageId/edit', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // SECURITY: Sanitize content before processing
    const { sanitizeContent } = require('../services/contentSanitizer');
    const sanitizedContent = sanitizeContent(content, false);

    if (!ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    // Get message
    const message = await mongoDb.db
      .collection('messages')
      .findOne({ _id: new ObjectId(messageId) });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is the sender
    if (message.senderId !== userId) {
      return res.status(403).json({ error: 'Only message sender can edit' });
    }

    // Check edit window (15 minutes default)
    const editWindowMinutes = parseInt(process.env.MESSAGE_EDIT_WINDOW_MINUTES || '15', 10);
    const editDeadline = new Date(message.createdAt.getTime() + editWindowMinutes * 60 * 1000);
    const now = new Date();

    if (now > editDeadline) {
      return res.status(403).json({
        error: `Message can only be edited within ${editWindowMinutes} minutes of sending`,
      });
    }

    // Save current content to edit history
    const editHistory = message.editHistory || [];
    editHistory.push({
      content: message.content,
      editedAt: now,
    });

    // Update message
    await mongoDb.db.collection('messages').updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          content: sanitizedContent,
          editedAt: now,
          editHistory,
          updatedAt: now,
        },
      }
    );

    // Broadcast edit to WebSocket clients
    if (wsServerV2) {
      wsServerV2.to(message.threadId).emit('message:edited', {
        messageId,
        content: sanitizedContent,
        editedAt: now,
        senderId: userId,
      });
    }

    res.json({
      success: true,
      editedAt: now,
      content: sanitizedContent,
    });
  } catch (error) {
    logger.error('Edit message error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to edit message', message: error.message });
  }
});

/**
 * Get message edit history
 * GET /api/v2/messages/:messageId/history
 */
router.get('/:messageId/history', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    if (!ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    const message = await mongoDb.db
      .collection('messages')
      .findOne({ _id: new ObjectId(messageId) });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check if user is a participant
    if (message.senderId !== userId && !message.recipientIds.includes(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const history = message.editHistory || [];
    res.json({
      history,
      currentContent: message.content,
      editedAt: message.editedAt,
    });
  } catch (error) {
    logger.error('Get edit history error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to get edit history', message: error.message });
  }
});

/**
 * ============================================
 * BLOCKING & REPORTING ENDPOINTS
 * ============================================
 */

/**
 * Report a message
 * POST /api/v2/messages/:id/report
 */
router.post('/:id/report', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;
    const { reason, details } = req.body;

    const ReportedMessage = require('../models/ReportedMessage');
    const errors = ReportedMessage.validateReportedMessage({
      messageId,
      reportedBy: userId,
      reason,
    });

    if (errors) {
      return res.status(400).json({ errors });
    }

    const report = ReportedMessage.createReportedMessage({
      messageId,
      reportedBy: userId,
      reason,
      details,
    });

    await mongoDb.db.collection(ReportedMessage.COLLECTION).insertOne(report);

    res.json({ success: true, reportId: report._id.toString() });
  } catch (error) {
    logger.error('Report message error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to report message', message: error.message });
  }
});

/**
 * Block a user
 * POST /api/v2/users/:id/block
 */
router.post('/users/:id/block', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const blockedUserId = req.params.id;
    const { reason } = req.body;

    if (userId === blockedUserId) {
      return res.status(400).json({ error: 'Cannot block yourself' });
    }

    const BlockedUser = require('../models/BlockedUser');
    const blockedUser = BlockedUser.createBlockedUser({
      userId,
      blockedUserId,
      reason,
    });

    try {
      await mongoDb.db.collection(BlockedUser.COLLECTION).insertOne(blockedUser);
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ error: 'User already blocked' });
      }
      throw err;
    }

    res.json({ success: true, blockedAt: blockedUser.createdAt });
  } catch (error) {
    logger.error('Block user error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to block user', message: error.message });
  }
});

/**
 * Unblock a user
 * POST /api/v2/users/:id/unblock
 */
router.post('/users/:id/unblock', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const blockedUserId = req.params.id;

    const BlockedUser = require('../models/BlockedUser');
    const result = await mongoDb.db
      .collection(BlockedUser.COLLECTION)
      .deleteOne({ userId, blockedUserId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Block not found' });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Unblock user error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to unblock user', message: error.message });
  }
});

/**
 * Get blocked users list
 * GET /api/v2/users/blocked
 */
router.get('/users/blocked', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const BlockedUser = require('../models/BlockedUser');

    const blockedUsers = await mongoDb.db
      .collection(BlockedUser.COLLECTION)
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    res.json({ blockedUsers, count: blockedUsers.length });
  } catch (error) {
    logger.error('Get blocked users error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to get blocked users', message: error.message });
  }
});

/**
 * ============================================
 * THREAD MANAGEMENT ENDPOINTS
 * ============================================
 */

/**
 * Pin a thread
 * POST /api/v2/threads/:id/pin
 */
router.post('/threads/:id/pin', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const threadId = req.params.id;

    const query = buildThreadQuery(threadId);
    const thread = await messagingService.threadsCollection.findOne(query);

    const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;
    if (!thread || !(await isThreadParticipant(thread, userId, db))) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Check max pinned threads limit
    const maxPinned = parseInt(process.env.MAX_PINNED_THREADS || '10', 10);
    const pinnedCount = await messagingService.threadsCollection.countDocuments({
      participants: userId,
      [`pinnedAt.${userId}`]: { $exists: true, $ne: null },
    });

    if (pinnedCount >= maxPinned) {
      return res.status(400).json({
        error: `Maximum ${maxPinned} threads can be pinned`,
      });
    }

    // Use thread._id (MongoDB always creates _id field even for v1 threads)
    await messagingService.threadsCollection.updateOne(
      { _id: thread._id },
      { $set: { [`pinnedAt.${userId}`]: new Date() } }
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Pin thread error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to pin thread', message: error.message });
  }
});

/**
 * Unpin a thread
 * POST /api/v2/threads/:id/unpin
 */
router.post('/threads/:id/unpin', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const threadId = req.params.id;

    if (!ObjectId.isValid(threadId)) {
      return res.status(400).json({ error: 'Invalid thread ID' });
    }

    await messagingService.threadsCollection.updateOne(
      { _id: new ObjectId(threadId), participants: userId },
      { $unset: { [`pinnedAt.${userId}`]: '' } }
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Unpin thread error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to unpin thread', message: error.message });
  }
});

/**
 * Mute a thread
 * POST /api/v2/threads/:id/mute
 */
router.post('/threads/:id/mute', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const threadId = req.params.id;
    const { duration } = req.body; // '1h', '8h', '1d', 'forever'

    const query = buildThreadQuery(threadId);
    const thread = await messagingService.threadsCollection.findOne(query);

    const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;
    if (!thread || !(await isThreadParticipant(thread, userId, db))) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Calculate mute until date
    let mutedUntil;
    if (duration === 'forever') {
      mutedUntil = new Date('2099-12-31');
    } else {
      const now = Date.now();
      const durationMap = {
        '1h': 60 * 60 * 1000,
        '8h': 8 * 60 * 60 * 1000,
        '1d': 24 * 60 * 60 * 1000,
      };
      const ms = durationMap[duration] || durationMap['1h'];
      mutedUntil = new Date(now + ms);
    }

    // Use thread._id (MongoDB always creates _id field even for v1 threads)
    await messagingService.threadsCollection.updateOne(
      { _id: thread._id },
      { $set: { [`mutedUntil.${userId}`]: mutedUntil } }
    );

    res.json({ success: true, mutedUntil });
  } catch (error) {
    logger.error('Mute thread error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to mute thread', message: error.message });
  }
});

/**
 * Unmute a thread
 * POST /api/v2/threads/:id/unmute
 */
router.post('/threads/:id/unmute', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const threadId = req.params.id;

    const query = buildThreadQuery(threadId);
    const thread = await messagingService.threadsCollection.findOne(query);

    const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;
    if (!thread || !(await isThreadParticipant(thread, userId, db))) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Use thread._id (MongoDB always creates _id field even for v1 threads)
    await messagingService.threadsCollection.updateOne(
      { _id: thread._id },
      { $unset: { [`mutedUntil.${userId}`]: '' } }
    );

    res.json({ success: true });
  } catch (error) {
    logger.error('Unmute thread error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to unmute thread', message: error.message });
  }
});

/**
 * Forward a message to new recipients
 * POST /api/v2/messages/:id/forward
 */
router.post('/:id/forward', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const messageId = req.params.id;
    const { recipientIds, note } = req.body;

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({ error: 'Recipient IDs required' });
    }

    if (!ObjectId.isValid(messageId)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    // Get original message
    const originalMessage = await mongoDb.db
      .collection('messages')
      .findOne({ _id: new ObjectId(messageId) });

    if (!originalMessage) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Check access
    if (originalMessage.senderId !== userId && !originalMessage.recipientIds.includes(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Create forwarded messages for each recipient
    const forwardedMessages = [];
    for (const recipientId of recipientIds) {
      // Find or create thread
      const thread = await messagingService.findOrCreateThread([userId, recipientId]);

      // Create forwarded message
      const Message = require('../models/Message');
      const forwardContent = note
        ? `${note}\n\n---\nForwarded from ${req.user.name || 'Unknown'}:\n${originalMessage.content}`
        : `Forwarded from ${req.user.name || 'Unknown'}:\n${originalMessage.content}`;

      const message = Message.createMessage({
        threadId: thread._id.toString(),
        senderId: userId,
        recipientIds: [recipientId],
        content: forwardContent,
        attachments: originalMessage.attachments || [],
        metadata: {
          isForwarded: true,
          originalMessageId: messageId,
        },
      });

      await mongoDb.db.collection('messages').insertOne(message);

      // Update thread
      await messagingService.threadsCollection.updateOne(
        { _id: thread._id },
        {
          $set: {
            lastMessageId: message._id.toString(),
            lastMessageAt: message.createdAt,
          },
          $inc: { [`unreadCount.${recipientId}`]: 1 },
        }
      );

      // Send via WebSocket
      if (wsServerV2) {
        wsServerV2.to(recipientId).emit('message:received', message);
      }

      forwardedMessages.push(message);
    }

    res.json({
      success: true,
      forwardedCount: forwardedMessages.length,
      messages: forwardedMessages,
    });
  } catch (error) {
    logger.error('Forward message error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to forward message', message: error.message });
  }
});

/**
 * ============================================
 * LINK PREVIEW ENDPOINT
 * ============================================
 */

/**
 * Fetch link preview metadata
 * POST /api/v2/messages/preview-link
 */
router.post('/preview-link', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    const LinkPreview = require('../models/LinkPreview');
    const normalizedUrl = LinkPreview.normalizeUrl(url);

    if (!normalizedUrl) {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Check cache first
    const cached = await mongoDb.db.collection(LinkPreview.COLLECTION).findOne({
      normalizedUrl,
      expiresAt: { $gt: new Date() },
    });

    if (cached) {
      return res.json(cached);
    }

    // Fetch new preview
    const { getLinkPreview } = require('link-preview-js');
    try {
      const preview = await getLinkPreview(url, {
        timeout: 5000,
        headers: {
          'user-agent': 'EventFlow-LinkPreview/1.0',
        },
      });

      const linkPreview = LinkPreview.createLinkPreview({
        url,
        title: preview.title || '',
        description: preview.description || '',
        image: preview.images?.[0] || preview.favicons?.[0] || '',
        siteName: preview.siteName || '',
        favicon: preview.favicons?.[0] || '',
        mediaType: preview.mediaType || 'website',
        metadata: preview,
      });

      // Save to cache
      await mongoDb.db
        .collection(LinkPreview.COLLECTION)
        .updateOne({ normalizedUrl }, { $set: linkPreview }, { upsert: true });

      res.json(linkPreview);
    } catch (fetchError) {
      // Save failed attempt to prevent repeated failures
      const failedPreview = LinkPreview.createLinkPreview({
        url,
        fetchError: fetchError.message,
      });

      await mongoDb.db
        .collection(LinkPreview.COLLECTION)
        .updateOne({ normalizedUrl }, { $set: failedPreview }, { upsert: true });

      res.status(400).json({ error: 'Failed to fetch link preview', details: fetchError.message });
    }
  } catch (error) {
    logger.error('Link preview error', { error: error.message, userId: req.user.id });
    res.status(500).json({ error: 'Failed to generate preview', message: error.message });
  }
});

/**
 * ============================================
 * ADMIN MODERATION ENDPOINTS
 * ============================================
 */

/**
 * Get all reported messages (admin only)
 * GET /api/v2/admin/reports
 */
router.get(
  '/admin/reports',
  applyAuthRequired,
  applyRoleRequired('admin'),
  ensureServices,
  async (req, res) => {
    try {
      const { status, reason, page = 1, limit = 50 } = req.query;

      const pageNum = parseInt(page, 10);
      const limitNum = Math.min(parseInt(limit, 10), 100);
      const skip = (pageNum - 1) * limitNum;

      const ReportedMessage = require('../models/ReportedMessage');
      const query = {};

      if (status) {
        query.status = status;
      }
      if (reason) {
        query.reason = reason;
      }

      const [reports, total] = await Promise.all([
        mongoDb.db
          .collection(ReportedMessage.COLLECTION)
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .toArray(),
        mongoDb.db.collection(ReportedMessage.COLLECTION).countDocuments(query),
      ]);

      res.json({
        reports,
        total,
        page: pageNum,
        hasMore: skip + reports.length < total,
      });
    } catch (error) {
      logger.error('Get reports error', { error: error.message, userId: req.user.id });
      res.status(500).json({ error: 'Failed to get reports', message: error.message });
    }
  }
);

/**
 * Update report status (admin only)
 * PUT /api/v2/admin/reports/:id
 */
router.put(
  '/admin/reports/:id',
  applyAuthRequired,
  applyRoleRequired('admin'),
  ensureServices,
  async (req, res) => {
    try {
      const reportId = req.params.id;
      const { status, reviewNotes } = req.body;

      if (!ObjectId.isValid(reportId)) {
        return res.status(400).json({ error: 'Invalid report ID' });
      }

      const ReportedMessage = require('../models/ReportedMessage');
      if (status && !Object.values(ReportedMessage.REPORT_STATUS).includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      const update = {
        updatedAt: new Date(),
      };

      if (status) {
        update.status = status;
        update.reviewedAt = new Date();
        update.reviewedBy = req.user.id;
      }

      if (reviewNotes) {
        update.reviewNotes = reviewNotes;
      }

      const result = await mongoDb.db
        .collection(ReportedMessage.COLLECTION)
        .updateOne({ _id: new ObjectId(reportId) }, { $set: update });

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Report not found' });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error('Update report error', { error: error.message, userId: req.user.id });
      res.status(500).json({ error: 'Failed to update report', message: error.message });
    }
  }
);

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
module.exports.initializeRouter = initializeRouter;
