/**
 * Messenger v4 Service - Unified Business Logic Layer
 * Gold Standard messaging system with comprehensive features
 */

'use strict';

const { ObjectId } = require('mongodb');
const { validateConversation, validateMessage } = require('../models/ConversationV4');
const contentSanitizer = require('../utils/contentSanitizer');
const spamDetection = require('../utils/spamDetection');
const messagingLimits = require('../config/messagingLimits');

class MessengerV4Service {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger || console;
    this.conversationsCollection = db.collection('conversations_v4');
    this.messagesCollection = db.collection('chat_messages_v4');
  }

  /**
   * Create a new conversation (with deduplication)
   * @param {Object} data - Conversation data
   * @param {string} data.type - Conversation type
   * @param {Array} data.participants - Array of participant objects
   * @param {Object} data.context - Optional context information
   * @param {Object} data.metadata - Optional metadata
   * @returns {Object} Created or existing conversation
   */
  async createConversation(data) {
    // Validate input
    const validationErrors = validateConversation({
      ...data,
      status: data.status || 'active',
    });

    if (validationErrors.length > 0) {
      throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
    }

    // Deduplicate: Check if conversation already exists between same participants
    const participantIds = data.participants.map((p) => p.userId).sort();

    // For direct conversations, check if one already exists
    if (data.type === 'direct' && participantIds.length === 2) {
      const existingConversation = await this.conversationsCollection.findOne({
        type: 'direct',
        'participants.userId': { $all: participantIds },
        status: 'active',
        $expr: { $eq: [{ $size: '$participants' }, 2] },
      });

      if (existingConversation) {
        this.logger.info('Found existing direct conversation', {
          conversationId: existingConversation._id,
        });
        return existingConversation;
      }
    }

    // For context-based conversations, check for existing conversation with same context
    if (data.context && data.context.referenceId) {
      const existingContextConversation = await this.conversationsCollection.findOne({
        'participants.userId': { $all: participantIds },
        'context.type': data.context.type,
        'context.referenceId': data.context.referenceId,
        status: 'active',
      });

      if (existingContextConversation) {
        this.logger.info('Found existing context-based conversation', {
          conversationId: existingContextConversation._id,
          contextType: data.context.type,
        });
        return existingContextConversation;
      }
    }

    // Create new conversation
    const now = new Date();
    const conversation = {
      type: data.type,
      participants: data.participants.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        avatar: p.avatar || null,
        role: p.role,
        isPinned: false,
        isMuted: false,
        isArchived: false,
        unreadCount: 0,
        lastReadAt: null,
      })),
      context: data.context || null,
      lastMessage: null,
      metadata: data.metadata || {},
      status: 'active',
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const result = await this.conversationsCollection.insertOne(conversation);
    conversation._id = result.insertedId;

    this.logger.info('Created new conversation', {
      conversationId: conversation._id,
      type: conversation.type,
      participantCount: conversation.participants.length,
    });

    return conversation;
  }

  /**
   * Get conversations for a user with filtering
   * @param {string} userId - User ID
   * @param {Object} filters - Optional filters (unread, pinned, archived, search)
   * @param {number} limit - Number of conversations to return
   * @param {number} skip - Number of conversations to skip
   * @returns {Array} Array of conversations
   */
  async getConversations(userId, filters = {}, limit = 50, skip = 0) {
    const query = {
      'participants.userId': userId,
    };

    // Apply status filter
    if (filters.status) {
      query.status = filters.status;
    } else {
      query.status = 'active'; // Default to active conversations
    }

    // Build participant-specific filters
    const participantFilters = [];

    if (filters.unread) {
      participantFilters.push({
        'participants': {
          $elemMatch: {
            userId: userId,
            unreadCount: { $gt: 0 },
          },
        },
      });
    }

    if (filters.pinned) {
      participantFilters.push({
        'participants': {
          $elemMatch: {
            userId: userId,
            isPinned: true,
          },
        },
      });
    }

    if (filters.archived !== undefined) {
      participantFilters.push({
        'participants': {
          $elemMatch: {
            userId: userId,
            isArchived: filters.archived,
          },
        },
      });
    } else {
      // Default: exclude archived
      participantFilters.push({
        'participants': {
          $elemMatch: {
            userId: userId,
            isArchived: { $ne: true },
          },
        },
      });
    }

    if (participantFilters.length > 0) {
      query.$and = participantFilters;
    }

    // Search filter (in participant names or last message)
    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { 'participants.displayName': searchRegex },
        { 'lastMessage.content': searchRegex },
        { 'context.referenceTitle': searchRegex },
      ];
    }

    const conversations = await this.conversationsCollection
      .find(query)
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return conversations;
  }

  /**
   * Get a single conversation by ID
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for permission check)
   * @returns {Object} Conversation object
   */
  async getConversation(conversationId, userId) {
    const conversation = await this.conversationsCollection.findOne({
      _id: new ObjectId(conversationId),
      'participants.userId': userId,
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    return conversation;
  }

  /**
   * Update conversation settings
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {Object} updates - Updates to apply (pin, mute, archive, markRead)
   * @returns {Object} Updated conversation
   */
  async updateConversation(conversationId, userId, updates) {
    const conversation = await this.getConversation(conversationId, userId);

    const updateOps = {};
    const now = new Date();

    // Update participant-specific settings
    const participantIndex = conversation.participants.findIndex((p) => p.userId === userId);

    if (participantIndex === -1) {
      throw new Error('User not a participant in this conversation');
    }

    if (updates.isPinned !== undefined) {
      updateOps[`participants.${participantIndex}.isPinned`] = updates.isPinned;
    }

    if (updates.isMuted !== undefined) {
      updateOps[`participants.${participantIndex}.isMuted`] = updates.isMuted;
    }

    if (updates.isArchived !== undefined) {
      updateOps[`participants.${participantIndex}.isArchived`] = updates.isArchived;
    }

    if (updates.markRead) {
      updateOps[`participants.${participantIndex}.unreadCount`] = 0;
      updateOps[`participants.${participantIndex}.lastReadAt`] = now;
    }

    updateOps.updatedAt = now;

    await this.conversationsCollection.updateOne(
      { _id: new ObjectId(conversationId) },
      { $set: updateOps }
    );

    return await this.getConversation(conversationId, userId);
  }

  /**
   * Soft delete a conversation (mark as archived for the user)
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {boolean} Success
   */
  async deleteConversation(conversationId, userId) {
    await this.updateConversation(conversationId, userId, { isArchived: true });
    return true;
  }

  /**
   * Send a message in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} messageData - Message data
   * @param {string} messageData.senderId - Sender user ID
   * @param {string} messageData.senderName - Sender display name
   * @param {string} messageData.content - Message content
   * @param {string} messageData.type - Message type (text, image, file, system)
   * @param {Array} messageData.attachments - Optional attachments
   * @param {Object} messageData.replyTo - Optional reply-to message
   * @returns {Object} Created message
   */
  async sendMessage(conversationId, messageData) {
    // Get conversation and verify sender is a participant
    const conversation = await this.conversationsCollection.findOne({
      _id: new ObjectId(conversationId),
      'participants.userId': messageData.senderId,
    });

    if (!conversation) {
      throw new Error('Conversation not found or sender is not a participant');
    }

    // Validate message
    const validationErrors = validateMessage({
      ...messageData,
      conversationId,
      type: messageData.type || 'text',
    });

    if (validationErrors.length > 0) {
      throw new Error(`Message validation failed: ${validationErrors.join(', ')}`);
    }

    // Sanitize content
    const sanitizedContent = contentSanitizer.sanitize(messageData.content);

    // Check for spam
    const isSpam = await spamDetection.isSpam(sanitizedContent, messageData.senderId);
    if (isSpam) {
      throw new Error('Message flagged as spam');
    }

    // Check rate limits based on user's subscription tier
    const rateLimitCheck = await this.checkRateLimit(messageData.senderId);
    if (!rateLimitCheck.allowed) {
      throw new Error(`Rate limit exceeded. ${rateLimitCheck.message}`);
    }

    // Create message
    const now = new Date();
    const message = {
      conversationId: new ObjectId(conversationId),
      senderId: messageData.senderId,
      senderName: messageData.senderName,
      senderAvatar: messageData.senderAvatar || null,
      content: sanitizedContent,
      type: messageData.type || 'text',
      attachments: messageData.attachments || [],
      replyTo: messageData.replyTo || null,
      reactions: [],
      readBy: [
        {
          userId: messageData.senderId,
          readAt: now,
        },
      ],
      editedAt: null,
      isDeleted: false,
      createdAt: now,
    };

    const result = await this.messagesCollection.insertOne(message);
    message._id = result.insertedId;

    // Update conversation's lastMessage and increment message count
    const updateOps = {
      lastMessage: {
        content: sanitizedContent.substring(0, 100),
        senderId: messageData.senderId,
        senderName: messageData.senderName,
        sentAt: now,
        type: message.type,
      },
      updatedAt: now,
    };

    // Increment unread count for all participants except sender
    const bulkOps = conversation.participants.map((participant, index) => {
      if (participant.userId !== messageData.senderId) {
        return {
          updateOne: {
            filter: { _id: new ObjectId(conversationId) },
            update: { $inc: { [`participants.${index}.unreadCount`]: 1 } },
          },
        };
      }
      return null;
    }).filter(Boolean);

    await this.conversationsCollection.updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $set: updateOps,
        $inc: { messageCount: 1 },
      }
    );

    if (bulkOps.length > 0) {
      await this.conversationsCollection.bulkWrite(bulkOps);
    }

    this.logger.info('Message sent', {
      messageId: message._id,
      conversationId,
      senderId: messageData.senderId,
    });

    return message;
  }

  /**
   * Get messages for a conversation with cursor pagination
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for permission check)
   * @param {Object} options - Pagination options
   * @param {string} options.cursor - Cursor for pagination (message ID)
   * @param {number} options.limit - Number of messages to return
   * @returns {Object} Messages and pagination info
   */
  async getMessages(conversationId, userId, options = {}) {
    // Verify user is a participant
    await this.getConversation(conversationId, userId);

    const limit = Math.min(options.limit || 50, 100);
    const query = {
      conversationId: new ObjectId(conversationId),
      isDeleted: false,
    };

    // Cursor-based pagination
    if (options.cursor) {
      const cursorMessage = await this.messagesCollection.findOne({
        _id: new ObjectId(options.cursor),
      });

      if (cursorMessage) {
        query.createdAt = { $lt: cursorMessage.createdAt };
      }
    }

    const messages = await this.messagesCollection
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .toArray();

    const hasMore = messages.length > limit;
    if (hasMore) {
      messages.pop();
    }

    return {
      messages: messages.reverse(), // Return in chronological order
      hasMore,
      nextCursor: hasMore && messages.length > 0 ? messages[0]._id.toString() : null,
    };
  }

  /**
   * Edit a message (within 15-minute window)
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID
   * @param {string} newContent - New message content
   * @returns {Object} Updated message
   */
  async editMessage(messageId, userId, newContent) {
    const message = await this.messagesCollection.findOne({
      _id: new ObjectId(messageId),
      senderId: userId,
      isDeleted: false,
    });

    if (!message) {
      throw new Error('Message not found or access denied');
    }

    // Check 15-minute edit window
    const fifteenMinutes = 15 * 60 * 1000;
    if (Date.now() - message.createdAt.getTime() > fifteenMinutes) {
      throw new Error('Edit window expired (15 minutes)');
    }

    const sanitizedContent = contentSanitizer.sanitize(newContent);

    await this.messagesCollection.updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          content: sanitizedContent,
          editedAt: new Date(),
        },
      }
    );

    // Update conversation's lastMessage if this was the last message
    const conversation = await this.conversationsCollection.findOne({
      _id: message.conversationId,
      'lastMessage.sentAt': message.createdAt,
    });

    if (conversation) {
      await this.conversationsCollection.updateOne(
        { _id: message.conversationId },
        {
          $set: {
            'lastMessage.content': sanitizedContent.substring(0, 100),
          },
        }
      );
    }

    return await this.messagesCollection.findOne({ _id: new ObjectId(messageId) });
  }

  /**
   * Delete a message (soft delete)
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID
   * @returns {boolean} Success
   */
  async deleteMessage(messageId, userId) {
    const message = await this.messagesCollection.findOne({
      _id: new ObjectId(messageId),
      senderId: userId,
    });

    if (!message) {
      throw new Error('Message not found or access denied');
    }

    await this.messagesCollection.updateOne(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          content: 'This message was deleted',
          isDeleted: true,
          attachments: [],
        },
      }
    );

    return true;
  }

  /**
   * Toggle emoji reaction on a message
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID
   * @param {string} userName - User display name
   * @param {string} emoji - Emoji character
   * @returns {Object} Updated message
   */
  async toggleReaction(messageId, userId, userName, emoji) {
    const message = await this.messagesCollection.findOne({
      _id: new ObjectId(messageId),
    });

    if (!message) {
      throw new Error('Message not found');
    }

    // Check if user already reacted with this emoji
    const existingReaction = message.reactions.find(
      (r) => r.userId === userId && r.emoji === emoji
    );

    if (existingReaction) {
      // Remove reaction
      await this.messagesCollection.updateOne(
        { _id: new ObjectId(messageId) },
        {
          $pull: {
            reactions: { userId, emoji },
          },
        }
      );
    } else {
      // Add reaction
      await this.messagesCollection.updateOne(
        { _id: new ObjectId(messageId) },
        {
          $push: {
            reactions: { emoji, userId, userName },
          },
        }
      );
    }

    return await this.messagesCollection.findOne({ _id: new ObjectId(messageId) });
  }

  /**
   * Mark conversation as read
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {boolean} Success
   */
  async markAsRead(conversationId, userId) {
    const conversation = await this.getConversation(conversationId, userId);
    const participantIndex = conversation.participants.findIndex((p) => p.userId === userId);

    if (participantIndex === -1) {
      throw new Error('User not a participant');
    }

    const now = new Date();

    await this.conversationsCollection.updateOne(
      { _id: new ObjectId(conversationId) },
      {
        $set: {
          [`participants.${participantIndex}.unreadCount`]: 0,
          [`participants.${participantIndex}.lastReadAt`]: now,
        },
      }
    );

    // Update readBy for all unread messages
    await this.messagesCollection.updateMany(
      {
        conversationId: new ObjectId(conversationId),
        'readBy.userId': { $ne: userId },
      },
      {
        $push: {
          readBy: { userId, readAt: now },
        },
      }
    );

    return true;
  }

  /**
   * Get unread count for a user
   * @param {string} userId - User ID
   * @returns {number} Total unread count
   */
  async getUnreadCount(userId) {
    const conversations = await this.conversationsCollection
      .find({
        'participants.userId': userId,
        status: 'active',
      })
      .toArray();

    let totalUnread = 0;
    conversations.forEach((conv) => {
      const participant = conv.participants.find((p) => p.userId === userId);
      if (participant && !participant.isArchived && !participant.isMuted) {
        totalUnread += participant.unreadCount || 0;
      }
    });

    return totalUnread;
  }

  /**
   * Search for contacts (users the current user can message)
   * @param {string} currentUserId - Current user ID
   * @param {string} query - Search query
   * @param {Object} filters - Optional filters (role, etc.)
   * @param {number} limit - Number of results
   * @returns {Array} Array of users
   */
  async searchContacts(currentUserId, query, filters = {}, limit = 20) {
    const usersCollection = this.db.collection('users');
    const searchQuery = {
      _id: { $ne: currentUserId }, // Exclude current user
    };

    if (query) {
      const searchRegex = new RegExp(query, 'i');
      searchQuery.$or = [
        { displayName: searchRegex },
        { email: searchRegex },
        { businessName: searchRegex },
      ];
    }

    if (filters.role) {
      searchQuery.role = filters.role;
    }

    const users = await usersCollection
      .find(searchQuery)
      .limit(limit)
      .project({
        _id: 1,
        displayName: 1,
        email: 1,
        role: 1,
        avatar: 1,
        businessName: 1,
      })
      .toArray();

    return users.map((user) => ({
      userId: user._id,
      displayName: user.displayName || user.businessName || user.email,
      role: user.role || 'customer',
      avatar: user.avatar || null,
    }));
  }

  /**
   * Full-text search across all user's messages
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {number} limit - Number of results
   * @returns {Array} Array of messages with conversation info
   */
  async searchMessages(userId, query, limit = 50) {
    // Get user's conversation IDs
    const conversations = await this.conversationsCollection
      .find({
        'participants.userId': userId,
      })
      .project({ _id: 1 })
      .toArray();

    const conversationIds = conversations.map((c) => c._id);

    // Full-text search
    const messages = await this.messagesCollection
      .find({
        conversationId: { $in: conversationIds },
        $text: { $search: query },
        isDeleted: false,
      })
      .limit(limit)
      .toArray();

    // Enrich with conversation data
    const enrichedMessages = await Promise.all(
      messages.map(async (msg) => {
        const conv = await this.conversationsCollection.findOne({
          _id: msg.conversationId,
        });
        return {
          ...msg,
          conversation: {
            _id: conv._id,
            type: conv.type,
            participants: conv.participants,
          },
        };
      })
    );

    return enrichedMessages;
  }

  /**
   * Check rate limits for messaging
   * @param {string} userId - User ID
   * @returns {Object} Rate limit check result
   */
  async checkRateLimit(userId) {
    // Get user's subscription tier
    const usersCollection = this.db.collection('users');
    const user = await usersCollection.findOne({ _id: userId });

    const tier = user?.subscriptionTier || 'free';
    const limits = messagingLimits[tier] || messagingLimits.free;

    // Check messages sent in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentMessageCount = await this.messagesCollection.countDocuments({
      senderId: userId,
      createdAt: { $gte: oneHourAgo },
    });

    if (recentMessageCount >= limits.messagesPerHour) {
      return {
        allowed: false,
        message: `Rate limit: ${limits.messagesPerHour} messages per hour for ${tier} tier`,
      };
    }

    return { allowed: true };
  }
}

module.exports = MessengerV4Service;
