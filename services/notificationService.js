/**
 * Notification Service
 * Multi-channel notification delivery (in-app, email, push)
 */

'use strict';

const logger = require('../utils/logger');
const postmark = require('../utils/postmark');

// Notification types
const NOTIFICATION_TYPES = {
  MESSAGE: 'message',
  THREAD_CREATED: 'thread_created',
  MENTION: 'mention',
  REACTION: 'reaction',
  SYSTEM: 'system',
};

// Notification channels
const CHANNELS = {
  IN_APP: 'inApp',
  EMAIL: 'email',
  PUSH: 'push',
};

// Default preferences
const DEFAULT_PREFERENCES = {
  [CHANNELS.IN_APP]: true,
  [CHANNELS.EMAIL]: true,
  [CHANNELS.PUSH]: false,
};

class NotificationService {
  constructor(db, wsServer = null) {
    this.db = db;
    this.wsServer = wsServer;
    this.notificationsCollection = db.collection('notifications');
    this.preferencesCollection = db.collection('notification_preferences');
    this.queue = []; // In-memory queue for failed deliveries
  }

  /**
   * Send notification to user
   */
  async sendNotification(userId, notification) {
    try {
      const {
        type,
        title,
        message,
        data = {},
        channels = null, // null = use user preferences
        priority = 'normal', // 'low', 'normal', 'high'
      } = notification;

      // Get user preferences
      const preferences = await this.getUserPreferences(userId);

      // Determine which channels to use
      let activeChannels = channels || [];
      if (!channels) {
        // Use user preferences
        activeChannels = Object.keys(preferences).filter(channel => preferences[channel]);
      }

      // Save notification to database
      const notificationDoc = {
        userId,
        type,
        title,
        message,
        data,
        priority,
        read: false,
        createdAt: new Date(),
      };

      const result = await this.notificationsCollection.insertOne(notificationDoc);
      notificationDoc._id = result.insertedId;

      // Deliver through active channels
      const deliveryPromises = [];

      if (activeChannels.includes(CHANNELS.IN_APP)) {
        deliveryPromises.push(this.deliverInApp(userId, notificationDoc));
      }

      if (activeChannels.includes(CHANNELS.EMAIL)) {
        deliveryPromises.push(this.deliverEmail(userId, notificationDoc));
      }

      if (activeChannels.includes(CHANNELS.PUSH)) {
        deliveryPromises.push(this.deliverPush(userId, notificationDoc));
      }

      // Wait for all deliveries (but don't fail if some fail)
      await Promise.allSettled(deliveryPromises);

      logger.debug('Notification sent', {
        userId,
        type,
        channels: activeChannels,
      });

      return notificationDoc;
    } catch (error) {
      logger.error('Error sending notification', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Deliver notification via WebSocket (in-app)
   */
  async deliverInApp(userId, notification) {
    try {
      if (!this.wsServer) {
        logger.warn('WebSocket server not available for in-app notification');
        return;
      }

      this.wsServer.sendNotification(userId, {
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        createdAt: notification.createdAt,
      });

      logger.debug('In-app notification delivered', { userId });
    } catch (error) {
      logger.error('Error delivering in-app notification', {
        userId,
        error: error.message,
      });
      // Queue for retry
      this.queue.push({ userId, notification, channel: CHANNELS.IN_APP });
    }
  }

  /**
   * Deliver notification via email
   */
  async deliverEmail(userId, notification) {
    try {
      // Get user email from database
      const usersDb = await this.db.collection('users').findOne({ id: userId });
      if (!usersDb || !usersDb.email) {
        logger.warn('User email not found', { userId });
        return;
      }

      const email = usersDb.email;
      const userName = usersDb.name || 'there';

      // Send email based on notification type
      await postmark.sendMail({
        to: email,
        subject: notification.title,
        template: 'notification',
        templateData: {
          name: userName,
          title: notification.title,
          message: notification.message,
          actionUrl: notification.data.url || process.env.BASE_URL,
          actionText: notification.data.actionText || 'View Details',
        },
      });

      logger.debug('Email notification delivered', { userId, email });
    } catch (error) {
      logger.error('Error delivering email notification', {
        userId,
        error: error.message,
      });
      // Queue for retry
      this.queue.push({ userId, notification, channel: CHANNELS.EMAIL });
    }
  }

  /**
   * Deliver notification via push
   * Note: This is a placeholder - actual push implementation depends on
   * mobile app setup (Firebase, Apple Push Notification service, etc.)
   */
  async deliverPush(userId, _notification) {
    try {
      // TODO: Implement push notification delivery
      // This would typically involve:
      // 1. Get user's device tokens from database
      // 2. Send to FCM/APNS
      // 3. Handle delivery confirmations
      
      logger.debug('Push notification delivery not implemented', { userId });
    } catch (error) {
      logger.error('Error delivering push notification', {
        userId,
        error: error.message,
      });
    }
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId) {
    try {
      const prefs = await this.preferencesCollection.findOne({ userId });
      return prefs?.preferences || DEFAULT_PREFERENCES;
    } catch (error) {
      logger.error('Error getting user preferences', {
        userId,
        error: error.message,
      });
      return DEFAULT_PREFERENCES;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId, preferences) {
    try {
      await this.preferencesCollection.updateOne(
        { userId },
        {
          $set: {
            userId,
            preferences,
            updatedAt: new Date(),
          },
        },
        { upsert: true }
      );

      logger.info('User notification preferences updated', { userId });

      return preferences;
    } catch (error) {
      logger.error('Error updating user preferences', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId, options = {}) {
    try {
      const {
        unreadOnly = false,
        limit = 50,
        skip = 0,
      } = options;

      const query = { userId };
      if (unreadOnly) {
        query.read = false;
      }

      const notifications = await this.notificationsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      return notifications;
    } catch (error) {
      logger.error('Error getting user notifications', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    try {
      const { ObjectId } = require('mongodb');
      const result = await this.notificationsCollection.updateOne(
        {
          _id: typeof notificationId === 'string' ? new ObjectId(notificationId) : notificationId,
          userId,
        },
        {
          $set: {
            read: true,
            readAt: new Date(),
          },
        }
      );

      return result.modifiedCount > 0;
    } catch (error) {
      logger.error('Error marking notification as read', {
        notificationId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    try {
      const result = await this.notificationsCollection.updateMany(
        {
          userId,
          read: false,
        },
        {
          $set: {
            read: true,
            readAt: new Date(),
          },
        }
      );

      return result.modifiedCount;
    } catch (error) {
      logger.error('Error marking all notifications as read', {
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    try {
      const count = await this.notificationsCollection.countDocuments({
        userId,
        read: false,
      });

      return count;
    } catch (error) {
      logger.error('Error getting unread count', {
        userId,
        error: error.message,
      });
      return 0;
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    try {
      const { ObjectId } = require('mongodb');
      const result = await this.notificationsCollection.deleteOne({
        _id: typeof notificationId === 'string' ? new ObjectId(notificationId) : notificationId,
        userId,
      });

      return result.deletedCount > 0;
    } catch (error) {
      logger.error('Error deleting notification', {
        notificationId,
        userId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Process queued notifications (retry failed deliveries)
   */
  async processQueue() {
    if (this.queue.length === 0) {
      return;
    }

    logger.info('Processing notification queue', { count: this.queue.length });

    const itemsToRetry = [...this.queue];
    this.queue = [];

    for (const item of itemsToRetry) {
      try {
        const { userId, notification, channel } = item;

        if (channel === CHANNELS.IN_APP) {
          await this.deliverInApp(userId, notification);
        } else if (channel === CHANNELS.EMAIL) {
          await this.deliverEmail(userId, notification);
        } else if (channel === CHANNELS.PUSH) {
          await this.deliverPush(userId, notification);
        }
      } catch (error) {
        // If still failing, add back to queue (with max retry limit)
        if (!item.retries || item.retries < 3) {
          item.retries = (item.retries || 0) + 1;
          this.queue.push(item);
        }
      }
    }
  }
}

module.exports = {
  NotificationService,
  NOTIFICATION_TYPES,
  CHANNELS,
  DEFAULT_PREFERENCES,
};
