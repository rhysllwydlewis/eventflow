/**
 * Messaging API v2 Routes
 * RESTful endpoints for real-time messaging and notifications
 */

'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');

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

// Initialize services
function initializeServices(db, wsServer) {
  if (db && !messagingService) {
    messagingService = new MessagingService(db);
    notificationService = new NotificationService(db, wsServer);
    presenceService = new PresenceService();
    if (logger) {
      logger.info('Messaging v2 services initialized');
    }
  }
}

// Middleware to ensure services are initialized
function ensureServices(req, res, next) {
  const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;
  const wsServer = req.app.get('wsServerV2') || wsServerV2 || global.wsServerV2;

  if (db) {
    initializeServices(db, wsServer);
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
      console.error('Error checking supplier ownership:', error);
      // Fall through to return false
    }
  }

  return false;
}

// =========================
// Thread Management
// =========================

/**
 * POST /api/v2/messages/threads
 * Create a new conversation thread
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
          console.error('Error looking up participant names:', error);
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

/**
 * GET /api/v2/messages/:threadId
 * Get message history for a thread
 */
router.get('/:threadId', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { threadId } = req.params;
    const { limit = 100, skip = 0, before } = req.query;

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

    const messages = await messagingService.getThreadMessages(threadId, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
      before,
      thread, // Pass thread to avoid extra lookup
    });

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
    }));

    res.json({
      success: true,
      messages: messagesData,
      count: messagesData.length,
    });
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
 */
router.post(
  '/:threadId',
  applyAuthRequired,
  applyCsrfProtection,
  ensureServices,
  async (req, res) => {
    try {
      const { threadId } = req.params;
      const { content, attachments } = req.body;

      if (!content && (!attachments || attachments.length === 0)) {
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
          content,
          attachments: attachments || [],
        },
        subscriptionTier
      );

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

      // Verify access
      const thread = await messagingService.getThread(threadId);
      if (!thread) {
        return res.status(404).json({ error: 'Thread not found' });
      }

      const db = req.app.locals.db || mongoDb?.db || global.mongoDb?.db;
      if (!(await isThreadParticipant(thread, req.user.id, db))) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const count = await messagingService.markThreadAsRead(threadId, req.user.id);

      res.json({
        success: true,
        message: 'Thread marked as read',
        markedCount: count,
      });
    } catch (error) {
      logger.error('Mark thread as read error', { error: error.message, userId: req.user.id });
      res.status(500).json({
        error: 'Failed to mark thread as read',
        message: error.message,
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
