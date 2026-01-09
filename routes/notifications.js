/**
 * Notification API Routes
 * Handles notification endpoints for real-time user notifications
 */

'use strict';

const express = require('express');
const router = express.Router();
const { authRequired } = require('../middleware/auth');
const logger = require('../utils/logger');

module.exports = (db, websocketServer) => {
  const NotificationService = require('../services/notification.service');
  const notificationService = new NotificationService(db, websocketServer);

  /**
   * GET /api/notifications
   * Get notifications for the current user
   */
  router.get('/', authRequired, async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        limit = 50,
        skip = 0,
        unreadOnly = 'false',
        type = null,
        priority = null,
      } = req.query;

      const result = await notificationService.getForUser(userId, {
        limit: parseInt(limit, 10),
        skip: parseInt(skip, 10),
        unreadOnly: unreadOnly === 'true',
        type,
        priority,
      });

      res.json(result);
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  /**
   * GET /api/notifications/unread-count
   * Get unread notification count for the current user
   */
  router.get('/unread-count', authRequired, async (req, res) => {
    try {
      const userId = req.user.id;
      const count = await notificationService.getUnreadCount(userId);

      res.json({ count });
    } catch (error) {
      logger.error('Error fetching unread count:', error);
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  /**
   * PUT /api/notifications/:id/read
   * Mark a notification as read
   */
  router.put('/:id/read', authRequired, async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const success = await notificationService.markAsRead(id, userId);

      if (success) {
        res.json({ success: true, message: 'Notification marked as read' });
      } else {
        res.status(404).json({ error: 'Notification not found' });
      }
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  /**
   * PUT /api/notifications/mark-all-read
   * Mark all notifications as read for the current user
   */
  router.put('/mark-all-read', authRequired, async (req, res) => {
    try {
      const userId = req.user.id;
      const count = await notificationService.markAllAsRead(userId);

      res.json({ success: true, count, message: `${count} notifications marked as read` });
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  /**
   * PUT /api/notifications/:id/dismiss
   * Dismiss a notification
   */
  router.put('/:id/dismiss', authRequired, async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const success = await notificationService.dismiss(id, userId);

      if (success) {
        res.json({ success: true, message: 'Notification dismissed' });
      } else {
        res.status(404).json({ error: 'Notification not found' });
      }
    } catch (error) {
      logger.error('Error dismissing notification:', error);
      res.status(500).json({ error: 'Failed to dismiss notification' });
    }
  });

  /**
   * DELETE /api/notifications/:id
   * Delete a notification
   */
  router.delete('/:id', authRequired, async (req, res) => {
    try {
      const userId = req.user.id;
      const { id } = req.params;

      const success = await notificationService.delete(id, userId);

      if (success) {
        res.json({ success: true, message: 'Notification deleted' });
      } else {
        res.status(404).json({ error: 'Notification not found' });
      }
    } catch (error) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({ error: 'Failed to delete notification' });
    }
  });

  /**
   * DELETE /api/notifications
   * Delete all notifications for the current user
   */
  router.delete('/', authRequired, async (req, res) => {
    try {
      const userId = req.user.id;
      const count = await notificationService.deleteAll(userId);

      res.json({ success: true, count, message: `${count} notifications deleted` });
    } catch (error) {
      logger.error('Error deleting all notifications:', error);
      res.status(500).json({ error: 'Failed to delete all notifications' });
    }
  });

  /**
   * POST /api/notifications/test
   * Create a test notification (development only)
   */
  if (process.env.NODE_ENV !== 'production') {
    router.post('/test', authRequired, async (req, res) => {
      try {
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
        logger.error('Error creating test notification:', error);
        res.status(500).json({ error: 'Failed to create test notification' });
      }
    });
  }

  return router;
};
