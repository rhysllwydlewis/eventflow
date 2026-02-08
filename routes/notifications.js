/**
 * Notification API Routes
 * Handles notification endpoints for real-time user notifications
 */

'use strict';

const express = require('express');
const router = express.Router();

// Dependencies injected by server.js
let authRequired;
let logger;
let mongoDb;
let getWebSocketServer;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Notifications routes: dependencies object is required');
  }

  // Validate required dependencies
  const required = ['authRequired', 'logger', 'mongoDb', 'getWebSocketServer'];

  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Notifications routes: missing required dependencies: ${missing.join(', ')}`);
  }

  authRequired = deps.authRequired;
  logger = deps.logger;
  mongoDb = deps.mongoDb;
  getWebSocketServer = deps.getWebSocketServer;
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

/**
 * Get notification service instance with current DB and WebSocket
 * Creates service lazily to handle dynamic DB/WebSocket initialization
 */
async function getNotificationService() {
  // Get current DB connection
  let db = null;
  try {
    if (mongoDb.isConnected()) {
      db = await mongoDb.getDb();
    }
  } catch (error) {
    logger.warn('MongoDB not available for notifications', { error: error.message });
    throw new Error('Database not connected');
  }

  if (!db) {
    throw new Error('Database not connected');
  }

  // Get current WebSocket server (may be null if not initialized yet)
  const websocketServer = getWebSocketServer ? getWebSocketServer() : null;

  // Create and return notification service
  const NotificationService = require('../services/notification.service');
  return new NotificationService(db, websocketServer);
}

/**
 * Error handler middleware for notification routes
 * Handles database connection errors and logs other errors
 */
function handleNotificationError(error, res, logMessage) {
  if (error.message === 'Database not connected') {
    return res.status(503).json({
      error: 'Service temporarily unavailable - Database not connected',
    });
  }
  logger.error(logMessage, error);
  const errorMessage = logMessage.replace('Error ', 'Failed to ').replace(/ing$/, '');
  res.status(500).json({ error: errorMessage });
}

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
router.get('/', applyAuthRequired, async (req, res) => {
  try {
    const notificationService = await getNotificationService();
    const userId = req.user.id;
    const { limit = 50, skip = 0, unreadOnly = 'false', type = null, priority = null } = req.query;

    const result = await notificationService.getForUser(userId, {
      limit: parseInt(limit, 10),
      skip: parseInt(skip, 10),
      unreadOnly: unreadOnly === 'true',
      type,
      priority,
    });

    res.json(result);
  } catch (error) {
    handleNotificationError(error, res, 'Error fetching notifications');
  }
});

/**
 * GET /api/notifications/unread-count
 * Get unread notification count for the current user
 */
router.get('/unread-count', applyAuthRequired, async (req, res) => {
  try {
    const notificationService = await getNotificationService();
    const userId = req.user.id;
    const count = await notificationService.getUnreadCount(userId);

    res.json({ count });
  } catch (error) {
    handleNotificationError(error, res, 'Error fetching unread count');
  }
});

/**
 * PUT /api/notifications/:id/read
 * Mark a notification as read
 */
router.put('/:id/read', applyAuthRequired, async (req, res) => {
  try {
    const notificationService = await getNotificationService();
    const userId = req.user.id;
    const { id } = req.params;

    const success = await notificationService.markAsRead(id, userId);

    if (success) {
      res.json({ success: true, message: 'Notification marked as read' });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  } catch (error) {
    handleNotificationError(error, res, 'Error marking notification as read');
  }
});

/**
 * PUT /api/notifications/mark-all-read
 * Mark all notifications as read for the current user
 */
router.put('/mark-all-read', applyAuthRequired, async (req, res) => {
  try {
    const notificationService = await getNotificationService();
    const userId = req.user.id;
    const count = await notificationService.markAllAsRead(userId);

    res.json({ success: true, count, message: `${count} notifications marked as read` });
  } catch (error) {
    handleNotificationError(error, res, 'Error marking all notifications as read');
  }
});

/**
 * PUT /api/notifications/:id/dismiss
 * Dismiss a notification
 */
router.put('/:id/dismiss', applyAuthRequired, async (req, res) => {
  try {
    const notificationService = await getNotificationService();
    const userId = req.user.id;
    const { id } = req.params;

    const success = await notificationService.dismiss(id, userId);

    if (success) {
      res.json({ success: true, message: 'Notification dismissed' });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  } catch (error) {
    handleNotificationError(error, res, 'Error dismissing notification');
  }
});

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
router.delete('/:id', applyAuthRequired, async (req, res) => {
  try {
    const notificationService = await getNotificationService();
    const userId = req.user.id;
    const { id } = req.params;

    const success = await notificationService.delete(id, userId);

    if (success) {
      res.json({ success: true, message: 'Notification deleted' });
    } else {
      res.status(404).json({ error: 'Notification not found' });
    }
  } catch (error) {
    handleNotificationError(error, res, 'Error deleting notification');
  }
});

/**
 * DELETE /api/notifications
 * Delete all notifications for the current user
 */
router.delete('/', applyAuthRequired, async (req, res) => {
  try {
    const notificationService = await getNotificationService();
    const userId = req.user.id;
    const count = await notificationService.deleteAll(userId);

    res.json({ success: true, count, message: `${count} notifications deleted` });
  } catch (error) {
    handleNotificationError(error, res, 'Error deleting all notifications');
  }
});

/**
 * POST /api/notifications/test
 * Create a test notification (development only)
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/test', applyAuthRequired, async (req, res) => {
    try {
      const notificationService = await getNotificationService();
      const userId = req.user.id;
      const { type = 'system', title = 'Test Notification', message = 'This is a test' } = req.body;

      const notification = await notificationService.create({
        userId,
        type,
        title,
        message,
        priority: 'normal',
      });

      res.json({ success: true, notification });
    } catch (error) {
      handleNotificationError(error, res, 'Error creating test notification');
    }
  });
}

module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
