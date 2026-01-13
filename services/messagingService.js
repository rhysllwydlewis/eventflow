/**
 * Messaging Service
 * Core business logic for real-time messaging
 */

'use strict';

const logger = require('../utils/logger');
const { ObjectId } = require('mongodb');
const {
  COLLECTIONS,
  MESSAGE_STATUS,
  THREAD_STATUS,
  validateMessage,
  validateThread,
  createMessage,
  createThread,
} = require('../models/Message');

class MessagingService {
  constructor(db) {
    this.db = db;
    this.messagesCollection = db.collection(COLLECTIONS.MESSAGES);
    this.threadsCollection = db.collection(COLLECTIONS.THREADS);
  }

  /**
   * Create a new conversation thread
   */
  async createThread(participants, metadata = {}) {
    try {
      // Validate participants
      const validationErrors = validateThread({ participants });
      if (validationErrors) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      // Check if thread already exists between these participants
      const existingThread = await this.threadsCollection.findOne({
        participants: { $all: participants, $size: participants.length },
        status: { $ne: THREAD_STATUS.DELETED },
      });

      if (existingThread) {
        return existingThread;
      }

      // Create new thread
      const thread = createThread({
        participants,
        metadata,
      });

      await this.threadsCollection.insertOne(thread);
      
      logger.info('Thread created', { threadId: thread._id, participants });
      
      return thread;
    } catch (error) {
      logger.error('Error creating thread', { error: error.message });
      throw error;
    }
  }

  /**
   * Get threads for a user
   */
  async getUserThreads(userId, options = {}) {
    try {
      const {
        status = THREAD_STATUS.ACTIVE,
        limit = 50,
        skip = 0,
      } = options;

      const query = {
        participants: userId,
      };

      if (status) {
        query.status = status;
      }

      const threads = await this.threadsCollection
        .find(query)
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      return threads;
    } catch (error) {
      logger.error('Error getting user threads', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get thread by ID
   */
  async getThread(threadId) {
    try {
      const thread = await this.threadsCollection.findOne({
        _id: typeof threadId === 'string' ? new ObjectId(threadId) : threadId,
      });

      return thread;
    } catch (error) {
      logger.error('Error getting thread', { threadId, error: error.message });
      throw error;
    }
  }

  /**
   * Send a message in a thread
   */
  async sendMessage(data) {
    try {
      // Validate message data
      const validationErrors = validateMessage(data);
      if (validationErrors) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      // Verify thread exists
      const thread = await this.getThread(data.threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      // Verify sender is a participant
      if (!thread.participants.includes(data.senderId)) {
        throw new Error('Sender is not a participant in this thread');
      }

      // Create message
      const message = createMessage(data);

      await this.messagesCollection.insertOne(message);

      // Update thread
      await this.updateThreadOnNewMessage(thread._id, message);

      logger.info('Message sent', { messageId: message._id, threadId: thread._id });

      return message;
    } catch (error) {
      logger.error('Error sending message', { error: error.message });
      throw error;
    }
  }

  /**
   * Get a single message by ID
   * @param {string|ObjectId} messageId - Message ID
   * @returns {Promise<Object>} Message object
   */
  async getMessage(messageId) {
    try {
      const message = await this.messagesCollection.findOne({
        _id: typeof messageId === 'string' ? new ObjectId(messageId) : messageId,
      });

      return message;
    } catch (error) {
      logger.error('Error getting message', { messageId, error: error.message });
      throw error;
    }
  }

  /**
   * Get messages in a thread
   * @param {string} threadId - Thread ID
   * @param {Object} options - Query options (limit, skip, before)
   * @returns {Promise<Array>} Array of messages
   */
  async getThreadMessages(threadId, options = {}) {
    try {
      const {
        limit = 100,
        skip = 0,
        before = null, // Get messages before this timestamp
      } = options;

      const query = {
        threadId: threadId,
        isDraft: false,
        deletedAt: null,
      };

      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }

      const messages = await this.messagesCollection
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      // Return in ascending order (oldest first)
      return messages.reverse();
    } catch (error) {
      logger.error('Error getting thread messages', { threadId, error: error.message });
      throw error;
    }
  }

  /**
   * Mark message as read
   */
  async markMessageAsRead(messageId, userId) {
    try {
      const message = await this.messagesCollection.findOne({
        _id: typeof messageId === 'string' ? new ObjectId(messageId) : messageId,
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Check if already marked as read by this user
      const alreadyRead = message.readBy.some(r => r.userId === userId);
      if (alreadyRead) {
        return message;
      }

      // Add to readBy array
      const update = {
        $push: {
          readBy: {
            userId,
            readAt: new Date(),
          },
        },
        $set: {
          updatedAt: new Date(),
        },
      };

      // If all recipients have read, update status
      const allRecipientsRead = message.recipientIds.every(
        recipientId =>
          recipientId === message.senderId ||
          message.readBy.some(r => r.userId === recipientId) ||
          recipientId === userId
      );

      if (allRecipientsRead) {
        update.$set.status = MESSAGE_STATUS.READ;
      }

      await this.messagesCollection.updateOne(
        { _id: message._id },
        update
      );

      // Update unread count in thread
      await this.updateThreadUnreadCount(message.threadId, userId);

      logger.debug('Message marked as read', { messageId, userId });

      return await this.messagesCollection.findOne({ _id: message._id });
    } catch (error) {
      logger.error('Error marking message as read', { messageId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Mark all messages in thread as read
   */
  async markThreadAsRead(threadId, userId) {
    try {
      const result = await this.messagesCollection.updateMany(
        {
          threadId,
          recipientIds: userId,
          'readBy.userId': { $ne: userId },
          isDraft: false,
          deletedAt: null,
        },
        {
          $push: {
            readBy: {
              userId,
              readAt: new Date(),
            },
          },
          $set: {
            updatedAt: new Date(),
          },
        }
      );

      // Update thread unread count
      await this.threadsCollection.updateOne(
        { _id: typeof threadId === 'string' ? new ObjectId(threadId) : threadId },
        {
          $set: {
            [`unreadCount.${userId}`]: 0,
            updatedAt: new Date(),
          },
        }
      );

      logger.debug('Thread marked as read', { threadId, userId, messagesUpdated: result.modifiedCount });

      return result.modifiedCount;
    } catch (error) {
      logger.error('Error marking thread as read', { threadId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Add reaction to message
   */
  async addReaction(messageId, userId, emoji) {
    try {
      const message = await this.messagesCollection.findOne({
        _id: typeof messageId === 'string' ? new ObjectId(messageId) : messageId,
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Check if user already reacted with this emoji
      const existingReactionIndex = message.reactions.findIndex(
        r => r.userId === userId && r.emoji === emoji
      );

      if (existingReactionIndex !== -1) {
        // Remove reaction (toggle)
        await this.messagesCollection.updateOne(
          { _id: message._id },
          {
            $pull: { reactions: { userId, emoji } },
            $set: { updatedAt: new Date() },
          }
        );
      } else {
        // Add reaction
        await this.messagesCollection.updateOne(
          { _id: message._id },
          {
            $push: {
              reactions: {
                userId,
                emoji,
                createdAt: new Date(),
              },
            },
            $set: { updatedAt: new Date() },
          }
        );
      }

      logger.debug('Reaction toggled', { messageId, userId, emoji });

      return await this.messagesCollection.findOne({ _id: message._id });
    } catch (error) {
      logger.error('Error adding reaction', { messageId, userId, emoji, error: error.message });
      throw error;
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId, userId) {
    try {
      const message = await this.messagesCollection.findOne({
        _id: typeof messageId === 'string' ? new ObjectId(messageId) : messageId,
      });

      if (!message) {
        throw new Error('Message not found');
      }

      // Only sender can delete their message
      if (message.senderId !== userId) {
        throw new Error('Unauthorized: only sender can delete message');
      }

      await this.messagesCollection.updateOne(
        { _id: message._id },
        {
          $set: {
            deletedAt: new Date(),
            updatedAt: new Date(),
          },
        }
      );

      logger.info('Message deleted', { messageId, userId });

      return true;
    } catch (error) {
      logger.error('Error deleting message', { messageId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Archive a thread
   */
  async archiveThread(threadId, userId) {
    try {
      const thread = await this.getThread(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      // Verify user is a participant
      if (!thread.participants.includes(userId)) {
        throw new Error('Unauthorized: user is not a participant');
      }

      await this.threadsCollection.updateOne(
        { _id: thread._id },
        {
          $set: {
            status: THREAD_STATUS.ARCHIVED,
            updatedAt: new Date(),
          },
        }
      );

      logger.info('Thread archived', { threadId, userId });

      return true;
    } catch (error) {
      logger.error('Error archiving thread', { threadId, userId, error: error.message });
      throw error;
    }
  }

  /**
   * Get unread message count for user
   */
  async getUnreadCount(userId) {
    try {
      const threads = await this.threadsCollection
        .find({
          participants: userId,
          status: THREAD_STATUS.ACTIVE,
        })
        .toArray();

      let totalUnread = 0;
      for (const thread of threads) {
        totalUnread += thread.unreadCount?.[userId] || 0;
      }

      return totalUnread;
    } catch (error) {
      logger.error('Error getting unread count', { userId, error: error.message });
      throw error;
    }
  }

  /**
   * Update thread after new message
   */
  async updateThreadOnNewMessage(threadId, message) {
    try {
      const thread = await this.getThread(threadId);
      if (!thread) {
        return;
      }

      // Calculate unread counts for recipients
      const unreadCount = { ...thread.unreadCount };
      for (const participantId of thread.participants) {
        if (participantId !== message.senderId) {
          unreadCount[participantId] = (unreadCount[participantId] || 0) + 1;
        }
      }

      await this.threadsCollection.updateOne(
        { _id: thread._id },
        {
          $set: {
            lastMessageId: message._id.toString(),
            lastMessageAt: message.createdAt,
            unreadCount,
            updatedAt: new Date(),
          },
        }
      );
    } catch (error) {
      logger.error('Error updating thread', { threadId, error: error.message });
    }
  }

  /**
   * Update thread unread count
   */
  async updateThreadUnreadCount(threadId, userId) {
    try {
      const unreadMessages = await this.messagesCollection.countDocuments({
        threadId,
        recipientIds: userId,
        'readBy.userId': { $ne: userId },
        isDraft: false,
        deletedAt: null,
      });

      await this.threadsCollection.updateOne(
        { _id: typeof threadId === 'string' ? new ObjectId(threadId) : threadId },
        {
          $set: {
            [`unreadCount.${userId}`]: unreadMessages,
            updatedAt: new Date(),
          },
        }
      );
    } catch (error) {
      logger.error('Error updating thread unread count', { threadId, userId, error: error.message });
    }
  }
}

module.exports = MessagingService;
