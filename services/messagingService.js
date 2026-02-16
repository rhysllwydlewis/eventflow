/**
 * Messaging Service
 * Core business logic for real-time messaging
 */

'use strict';

const logger = require('../utils/logger');
const { ObjectId } = require('mongodb');
const { MESSAGE_LIMITS } = require('../config/messagingLimits');
const {
  COLLECTIONS,
  MESSAGE_STATUS,
  THREAD_STATUS,
  validateMessage,
  validateThread,
  createMessage,
  createThread,
} = require('../models/Message');

// Import security services
const { sanitizeMessage } = require('./contentSanitizer');
const { checkSpam } = require('./spamDetection');

// Constants
const MESSAGE_PREVIEW_MAX_LENGTH = 100;

class MessagingService {
  constructor(db) {
    this.db = db;
    this.messagesCollection = db.collection(COLLECTIONS.MESSAGES);
    this.threadsCollection = db.collection(COLLECTIONS.THREADS);
  }

  /**
   * Check if a user is a participant in a thread (supports both v1 and v2 formats)
   * @param {Object} thread - Thread object
   * @param {string} userId - User ID to check
   * @returns {boolean} True if user is a participant
   */
  isParticipant(thread, userId) {
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
    if (thread.supplierId === userId) {
      return true;
    }

    return false;
  }

  /**
   * Get all participant IDs from a thread (supports both v1 and v2 formats)
   * @param {Object} thread - Thread object
   * @returns {Array<string>} Array of participant user IDs
   */
  getParticipantIds(thread) {
    if (!thread) {
      return [];
    }

    // v2 threads have a participants array
    if (thread.participants && Array.isArray(thread.participants)) {
      return thread.participants;
    }

    // v1 threads use customerId/supplierId/recipientId fields
    const participants = [];
    if (thread.customerId) {
      participants.push(thread.customerId);
    }
    if (thread.supplierId) {
      participants.push(thread.supplierId);
    }
    if (thread.recipientId && !participants.includes(thread.recipientId)) {
      participants.push(thread.recipientId);
    }

    return participants;
  }

  /**
   * Check if user has reached their message limit for the day
   * @param {string} userId - User ID
   * @param {string} subscriptionTier - Subscription tier (free, pro, pro_plus, enterprise)
   * @returns {Promise<Object>} Limit check result
   */
  async checkMessageLimit(userId, subscriptionTier = 'free') {
    try {
      const limits = MESSAGE_LIMITS[subscriptionTier] || MESSAGE_LIMITS.free;

      // Unlimited for pro/enterprise
      if (limits.messagesPerDay === -1) {
        return { allowed: true };
      }

      // Get start of today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count messages sent today
      const messageCount = await this.messagesCollection.countDocuments({
        senderId: userId,
        createdAt: { $gte: today },
      });

      return {
        allowed: messageCount < limits.messagesPerDay,
        current: messageCount,
        limit: limits.messagesPerDay,
        remaining: Math.max(0, limits.messagesPerDay - messageCount),
      };
    } catch (error) {
      logger.error('Error checking message limit', {
        userId,
        error: error.message,
      });
      // On error, allow the message to avoid blocking users due to technical issues
      return { allowed: true };
    }
  }

  /**
   * Check if user has reached their thread creation limit for the day
   * @param {string} userId - User ID
   * @param {string} subscriptionTier - Subscription tier (free, pro, pro_plus, enterprise)
   * @returns {Promise<Object>} Limit check result
   */
  async checkThreadLimit(userId, subscriptionTier = 'free') {
    try {
      const limits = MESSAGE_LIMITS[subscriptionTier] || MESSAGE_LIMITS.free;

      // Unlimited for pro/enterprise
      if (limits.threadsPerDay === -1) {
        return { allowed: true };
      }

      // Get start of today
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Count threads created today by this user (use metadata.createdBy field)
      const threadCount = await this.threadsCollection.countDocuments({
        'metadata.createdBy': userId,
        createdAt: { $gte: today },
      });

      return {
        allowed: threadCount < limits.threadsPerDay,
        current: threadCount,
        limit: limits.threadsPerDay,
        remaining: Math.max(0, limits.threadsPerDay - threadCount),
      };
    } catch (error) {
      logger.error('Error checking thread limit', { userId, error: error.message });
      // On error, allow the action to avoid blocking users due to technical issues
      return { allowed: true };
    }
  }

  /**
   * Create a new conversation thread
   * @param {Array<string>} participants - Array of participant user IDs
   * @param {Object} metadata - Thread metadata
   * @param {string} subscriptionTier - Creator's subscription tier
   * @returns {Promise<Object>} Created or existing thread
   */
  async createThread(participants, metadata = {}, subscriptionTier = 'free') {
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

      // Check thread creation limit only for new threads
      // Assuming first participant is the creator
      const creatorId = participants[0];
      const limitCheck = await this.checkThreadLimit(creatorId, subscriptionTier);
      if (!limitCheck.allowed) {
        throw new Error(
          `Daily thread creation limit reached (${limitCheck.limit}). Upgrade your plan for more conversations.`
        );
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
   * Supports both v2 threads (participants array) and v1 threads (customerId/recipientId fields)
   */
  async getUserThreads(userId, options = {}) {
    try {
      const { status = THREAD_STATUS.ACTIVE, limit = 50, skip = 0 } = options;

      // Query for threads where user is a participant in any format
      // This handles both v2 threads (participants array) and v1 threads (customerId/recipientId)
      const query = {
        $or: [
          { participants: userId }, // v2 threads
          { customerId: userId }, // v1 thread: user is customer
          { recipientId: userId }, // v1 thread: user is recipient (supplier owner or peer seller)
        ],
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
      let query;
      if (ObjectId.isValid(threadId)) {
        query = { _id: new ObjectId(threadId) };
      } else {
        // v1 threads use string IDs like 'thd_xxxxx' stored in an 'id' field
        query = { $or: [{ _id: threadId }, { id: threadId }] };
      }
      const thread = await this.threadsCollection.findOne(query);
      return thread;
    } catch (error) {
      logger.error('Error getting thread', { threadId, error: error.message });
      throw error;
    }
  }

  /**
   * Send a message in a thread
   * @param {Object} data - Message data
   * @param {string} subscriptionTier - User's subscription tier
   * @returns {Promise<Object>} Created message
   */
  async sendMessage(data, subscriptionTier = 'free') {
    try {
      // SECURITY: Sanitize message content before any processing
      const sanitizedData = sanitizeMessage(data, false);

      // SECURITY: Check for spam before processing
      if (sanitizedData.content) {
        const spamCheck = checkSpam(sanitizedData.senderId, sanitizedData.content, {
          maxUrlCount: 5,
          maxPerMinute: parseInt(process.env.MAX_MESSAGES_PER_MINUTE || '30', 10),
          checkDuplicates: true,
          checkKeywords: true,
        });

        if (spamCheck.isSpam) {
          logger.warn('Spam message blocked', {
            userId: sanitizedData.senderId,
            reason: spamCheck.reason,
            score: spamCheck.score,
          });
          throw new Error(`Message blocked: ${spamCheck.reason}`);
        }
      }

      // Check message limit
      const limitCheck = await this.checkMessageLimit(sanitizedData.senderId, subscriptionTier);
      if (!limitCheck.allowed) {
        throw new Error(
          `Daily message limit reached (${limitCheck.limit}). Upgrade your plan for more messages.`
        );
      }

      // Check message length
      const limits = MESSAGE_LIMITS[subscriptionTier] || MESSAGE_LIMITS.free;
      if (sanitizedData.content && sanitizedData.content.length > limits.maxMessageLength) {
        throw new Error(`Message too long. Maximum ${limits.maxMessageLength} characters allowed.`);
      }

      // Validate message data
      const validationErrors = validateMessage(sanitizedData);
      if (validationErrors) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }

      // Verify thread exists
      const thread = await this.getThread(sanitizedData.threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      // Verify sender is a participant
      if (!this.isParticipant(thread, sanitizedData.senderId)) {
        throw new Error('Sender is not a participant in this thread');
      }

      // Create message with sanitized data
      const message = createMessage(sanitizedData);

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
   * @param {Object} options - Query options (limit, skip, before, thread)
   * @returns {Promise<Array>} Array of messages
   */
  async getThreadMessages(threadId, options = {}) {
    try {
      const {
        limit = 100,
        skip = 0,
        before = null, // Get messages before this timestamp
        thread = null, // Optional: pass thread object to avoid extra lookup
      } = options;

      // For v1 threads, we need to use the thread's id field (thd_xxx) for message lookup
      // This ensures we query messages using the correct threadId format
      let effectiveThreadId = threadId;
      if (thread) {
        // Thread object provided, use its id field if available
        effectiveThreadId = thread.id || threadId;
      } else {
        // Fetch thread to get the correct id
        const fetchedThread = await this.getThread(threadId);
        effectiveThreadId = fetchedThread?.id || threadId;
      }

      const query = {
        threadId: effectiveThreadId,
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

      await this.messagesCollection.updateOne({ _id: message._id }, update);

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
      const threadQuery = ObjectId.isValid(threadId)
        ? { _id: new ObjectId(threadId) }
        : { $or: [{ _id: threadId }, { id: threadId }] };

      await this.threadsCollection.updateOne(threadQuery, {
        $set: {
          [`unreadCount.${userId}`]: 0,
          updatedAt: new Date(),
        },
      });

      logger.debug('Thread marked as read', {
        threadId,
        userId,
        messagesUpdated: result.modifiedCount,
      });

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
      if (!this.isParticipant(thread, userId)) {
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
   * Unarchive a thread
   */
  async unarchiveThread(threadId, userId) {
    try {
      const thread = await this.getThread(threadId);
      if (!thread) {
        throw new Error('Thread not found');
      }

      // Verify user is a participant
      if (!this.isParticipant(thread, userId)) {
        throw new Error('Unauthorized: user is not a participant');
      }

      await this.threadsCollection.updateOne(
        { _id: thread._id },
        {
          $set: {
            status: THREAD_STATUS.ACTIVE,
            updatedAt: new Date(),
          },
        }
      );

      logger.info('Thread unarchived', { threadId, userId });

      return true;
    } catch (error) {
      logger.error('Error unarchiving thread', { threadId, userId, error: error.message });
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
      const participantIds = this.getParticipantIds(thread);
      for (const participantId of participantIds) {
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
            lastMessageText: message.content ? message.content.substring(0, MESSAGE_PREVIEW_MAX_LENGTH) : '',
            lastMessageSenderId: message.senderId,
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

      const threadQuery = ObjectId.isValid(threadId)
        ? { _id: new ObjectId(threadId) }
        : { $or: [{ _id: threadId }, { id: threadId }] };

      await this.threadsCollection.updateOne(threadQuery, {
        $set: {
          [`unreadCount.${userId}`]: unreadMessages,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Error updating thread unread count', {
        threadId,
        userId,
        error: error.message,
      });
    }
  }
}

module.exports = MessagingService;
