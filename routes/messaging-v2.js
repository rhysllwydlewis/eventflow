/**
 * Messaging API v2 Routes
 * RESTful endpoints for real-time messaging and notifications
 */

'use strict';

const express = require('express');

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

// =========================
// Thread Management
// =========================

/**
 * POST /api/v2/messages/threads
 * Create a new conversation thread
 */
router.post('/threads', applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
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
});

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

    // Transform for response
    const threadsData = threads.map(thread => ({
      id: thread._id.toString(),
      participants: thread.participants,
      lastMessageAt: thread.lastMessageAt,
      unreadCount: thread.unreadCount?.[req.user.id] || 0,
      status: thread.status,
      metadata: thread.metadata,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
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

    // Check if user is a participant
    if (!thread.participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      thread: {
        id: thread._id.toString(),
        participants: thread.participants,
        lastMessageId: thread.lastMessageId,
        lastMessageAt: thread.lastMessageAt,
        unreadCount: thread.unreadCount?.[req.user.id] || 0,
        status: thread.status,
        metadata: thread.metadata,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
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
router.delete('/threads/:id', applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
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
});

// =========================
// Messaging
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

    if (!thread.participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await messagingService.getThreadMessages(threadId, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
      before,
    });

    // Transform for response
    const messagesData = messages.map(msg => ({
      id: msg._id.toString(),
      threadId: msg.threadId,
      senderId: msg.senderId,
      content: msg.content,
      attachments: msg.attachments,
      reactions: msg.reactions,
      status: msg.status,
      readBy: msg.readBy,
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
router.post('/:threadId', applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
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

    if (!thread.participants.includes(req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const recipientIds = thread.participants.filter(p => p !== req.user.id);

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
});

/**
 * POST /api/v2/messages/:id/reactions
 * Add reaction to message
 */
router.post('/:id/reactions', applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
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
});

/**
 * POST /api/v2/messages/:id/read
 * Mark message as read
 */
router.post('/:id/read', applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
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
});

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

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
