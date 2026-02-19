/**
 * Chat Service (v5)
 * Business logic for the unified chat system
 */

'use strict';

const { ObjectId } = require('mongodb');
const contentSanitizer = require('./contentSanitizer');
const spamDetection = require('./spamDetection');
const {
  CONVERSATION_TYPES,
  CONVERSATION_STATUS,
  MESSAGE_TYPES,
  MESSAGE_STATUS,
  createConversation,
  createMessage,
  validateParticipant,
  isValidConversationType,
  isValidMessageType,
} = require('../models/ChatMessage');

class ChatV5Service {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
    this.conversationsCollection = db.collection('chat_conversations');
    this.messagesCollection = db.collection('chat_messages');
  }

  /**
   * Create a new conversation
   * Includes deduplication check for direct messages
   */
  async createConversation({ type, participants, context, metadata, userId }) {
    try {
      // Validate type
      if (!isValidConversationType(type)) {
        throw new Error(`Invalid conversation type: ${type}`);
      }

      // Validate participants
      if (!Array.isArray(participants) || participants.length < 2) {
        throw new Error('At least 2 participants are required');
      }

      for (const participant of participants) {
        const validation = validateParticipant(participant);
        if (!validation.valid) {
          throw new Error(validation.error);
        }
      }

      // Check for duplicate direct conversations
      if (type === CONVERSATION_TYPES.DIRECT && participants.length === 2) {
        const participantIds = participants.map(p => p.userId).sort();
        const existing = await this.conversationsCollection.findOne({
          type: CONVERSATION_TYPES.DIRECT,
          status: { $ne: CONVERSATION_STATUS.DELETED },
          'participants.userId': { $all: participantIds },
          $expr: { $eq: [{ $size: '$participants' }, 2] },
        });

        if (existing) {
          this.logger.info('Found existing direct conversation', { conversationId: existing._id });
          return existing;
        }
      }

      // Create new conversation
      const conversation = createConversation({ type, participants, context, metadata });
      const result = await this.conversationsCollection.insertOne(conversation);
      conversation._id = result.insertedId;

      this.logger.info('Created new conversation', {
        conversationId: conversation._id,
        type,
        participantCount: participants.length,
      });

      return conversation;
    } catch (error) {
      this.logger.error('Error creating conversation', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get conversations for a user
   */
  async getConversations({
    userId,
    status = CONVERSATION_STATUS.ACTIVE,
    unreadOnly = false,
    pinned = null,
    archived = null,
    search = null,
    limit = 50,
    skip = 0,
  }) {
    try {
      const query = {
        'participants.userId': userId,
        status,
      };

      // Filter by archived status
      if (archived !== null) {
        query['participants'] = {
          $elemMatch: {
            userId,
            isArchived: archived,
          },
        };
      }

      // Filter by pinned status
      if (pinned !== null) {
        if (!query['participants']) {
          query['participants'] = { $elemMatch: { userId } };
        }
        query['participants'].$elemMatch.isPinned = pinned;
      }

      // Filter by unread
      if (unreadOnly) {
        if (!query['participants']) {
          query['participants'] = { $elemMatch: { userId } };
        }
        query['participants'].$elemMatch.unreadCount = { $gt: 0 };
      }

      // Search in last message content or participant names
      if (search) {
        query.$or = [
          { 'lastMessage.content': { $regex: search, $options: 'i' } },
          { 'participants.displayName': { $regex: search, $options: 'i' } },
        ];
      }

      const conversations = await this.conversationsCollection
        .find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      const total = await this.conversationsCollection.countDocuments(query);

      return { conversations, total, hasMore: skip + conversations.length < total };
    } catch (error) {
      this.logger.error('Error getting conversations', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get a single conversation
   */
  async getConversation(conversationId, userId) {
    try {
      const conversation = await this.conversationsCollection.findOne({
        _id: new ObjectId(conversationId),
        'participants.userId': userId,
        status: { $ne: CONVERSATION_STATUS.DELETED },
      });

      if (!conversation) {
        throw new Error('Conversation not found');
      }

      return conversation;
    } catch (error) {
      this.logger.error('Error getting conversation', {
        error: error.message,
        conversationId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Update conversation settings for a user
   */
  async updateConversation(conversationId, userId, updates) {
    try {
      const allowedUpdates = ['isPinned', 'isMuted', 'isArchived'];
      const updateObj = {};

      for (const [key, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(key)) {
          updateObj[`participants.$.${key}`] = value;
        }
      }

      if (Object.keys(updateObj).length === 0) {
        throw new Error('No valid updates provided');
      }

      const result = await this.conversationsCollection.updateOne(
        {
          _id: new ObjectId(conversationId),
          'participants.userId': userId,
        },
        {
          $set: {
            ...updateObj,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Conversation not found');
      }

      return await this.getConversation(conversationId, userId);
    } catch (error) {
      this.logger.error('Error updating conversation', {
        error: error.message,
        conversationId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Delete a conversation (soft delete)
   */
  async deleteConversation(conversationId, userId) {
    try {
      const result = await this.conversationsCollection.updateOne(
        {
          _id: new ObjectId(conversationId),
          'participants.userId': userId,
        },
        {
          $set: {
            status: CONVERSATION_STATUS.DELETED,
            updatedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Conversation not found');
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting conversation', {
        error: error.message,
        conversationId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Send a message
   */
  async sendMessage({
    conversationId,
    senderId,
    senderName,
    senderAvatar,
    content,
    type = MESSAGE_TYPES.TEXT,
    attachments = [],
    replyTo = null,
  }) {
    try {
      // Verify conversation exists and user is a participant
      const conversation = await this.conversationsCollection.findOne({
        _id: new ObjectId(conversationId),
        'participants.userId': senderId,
        status: { $ne: CONVERSATION_STATUS.DELETED },
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      // Validate message type
      if (!isValidMessageType(type)) {
        throw new Error(`Invalid message type: ${type}`);
      }

      // Sanitize content for text messages
      let sanitizedContent = content;
      if (type === MESSAGE_TYPES.TEXT) {
        sanitizedContent = contentSanitizer.sanitizeContent(content);

        // Check for spam
        const spamCheck = spamDetection.checkSpam(senderId, sanitizedContent);
        if (spamCheck.isSpam) {
          throw new Error(`Message rejected: ${spamCheck.reason}`);
        }
      }

      // Create message
      const message = createMessage({
        conversationId,
        senderId,
        senderName,
        senderAvatar,
        content: sanitizedContent,
        type,
        attachments,
        replyTo,
      });

      const result = await this.messagesCollection.insertOne(message);
      message._id = result.insertedId;

      // Update conversation
      await this.conversationsCollection.updateOne(
        { _id: new ObjectId(conversationId) },
        {
          $set: {
            lastMessage: {
              content: sanitizedContent,
              senderId,
              senderName,
              sentAt: message.createdAt,
              type,
            },
            updatedAt: new Date(),
          },
          $inc: { messageCount: 1 },
        }
      );

      // Increment unread count for other participants
      await this.conversationsCollection.updateMany(
        {
          _id: new ObjectId(conversationId),
          'participants.userId': { $ne: senderId },
        },
        {
          $inc: { 'participants.$.unreadCount': 1 },
        }
      );

      this.logger.info('Message sent', {
        messageId: message._id,
        conversationId,
        senderId,
        type,
      });

      return message;
    } catch (error) {
      this.logger.error('Error sending message', {
        error: error.message,
        conversationId,
        senderId,
      });
      throw error;
    }
  }

  /**
   * Get messages for a conversation
   */
  async getMessages(conversationId, userId, { before = null, limit = 50 } = {}) {
    try {
      // Verify access
      const conversation = await this.conversationsCollection.findOne({
        _id: new ObjectId(conversationId),
        'participants.userId': userId,
        status: { $ne: CONVERSATION_STATUS.DELETED },
      });

      if (!conversation) {
        throw new Error('Conversation not found or access denied');
      }

      const query = {
        conversationId,
        deletedAt: null,
      };

      if (before) {
        query.createdAt = { $lt: new Date(before) };
      }

      const messages = await this.messagesCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      const hasMore = messages.length === limit;

      return {
        messages: messages.reverse(),
        hasMore,
        before: hasMore ? messages[0].createdAt.toISOString() : null,
      };
    } catch (error) {
      this.logger.error('Error getting messages', { error: error.message, conversationId, userId });
      throw error;
    }
  }

  /**
   * Edit a message
   */
  async editMessage(messageId, userId, newContent) {
    try {
      // Sanitize content
      const sanitizedContent = contentSanitizer.sanitizeContent(newContent);

      // Check spam
      const spamCheck = spamDetection.checkSpam(userId, sanitizedContent);
      if (spamCheck.isSpam) {
        throw new Error(`Message rejected: ${spamCheck.reason}`);
      }

      const now = new Date();
      const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

      const result = await this.messagesCollection.updateOne(
        {
          _id: new ObjectId(messageId),
          senderId: userId,
          createdAt: { $gte: fifteenMinutesAgo },
          deletedAt: null,
        },
        {
          $set: {
            content: sanitizedContent,
            editedAt: now,
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Message not found, not yours, too old to edit, or already deleted');
      }

      return await this.messagesCollection.findOne({ _id: new ObjectId(messageId) });
    } catch (error) {
      this.logger.error('Error editing message', { error: error.message, messageId, userId });
      throw error;
    }
  }

  /**
   * Delete a message (soft delete)
   */
  async deleteMessage(messageId, userId) {
    try {
      const result = await this.messagesCollection.updateOne(
        {
          _id: new ObjectId(messageId),
          senderId: userId,
          deletedAt: null,
        },
        {
          $set: {
            content: '[deleted]',
            deletedAt: new Date(),
          },
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('Message not found, not yours, or already deleted');
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error deleting message', { error: error.message, messageId, userId });
      throw error;
    }
  }

  /**
   * Mark conversation as read
   */
  async markAsRead(conversationId, userId) {
    try {
      const now = new Date();

      // Update conversation
      await this.conversationsCollection.updateOne(
        {
          _id: new ObjectId(conversationId),
          'participants.userId': userId,
        },
        {
          $set: {
            'participants.$.lastReadAt': now,
            'participants.$.unreadCount': 0,
          },
        }
      );

      // Mark all unread messages as read
      const messages = await this.messagesCollection
        .find({
          conversationId,
          senderId: { $ne: userId },
          'readBy.userId': { $ne: userId },
        })
        .toArray();

      if (messages.length > 0) {
        await this.messagesCollection.updateMany(
          {
            conversationId,
            senderId: { $ne: userId },
            'readBy.userId': { $ne: userId },
          },
          {
            $push: {
              readBy: { userId, readAt: now },
            },
            $set: {
              status: MESSAGE_STATUS.READ,
            },
          }
        );
      }

      return { success: true };
    } catch (error) {
      this.logger.error('Error marking as read', { error: error.message, conversationId, userId });
      throw error;
    }
  }

  /**
   * Toggle emoji reaction on a message
   */
  async toggleReaction(messageId, userId, userName, emoji) {
    try {
      const message = await this.messagesCollection.findOne({ _id: new ObjectId(messageId) });

      if (!message) {
        throw new Error('Message not found');
      }

      // Check if user already reacted with this emoji
      const existingReaction = message.reactions.find(
        r => r.userId === userId && r.emoji === emoji
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
              reactions: {
                emoji,
                userId,
                userName,
                createdAt: new Date(),
              },
            },
          }
        );
      }

      return await this.messagesCollection.findOne({ _id: new ObjectId(messageId) });
    } catch (error) {
      this.logger.error('Error toggling reaction', { error: error.message, messageId, userId });
      throw error;
    }
  }

  /**
   * Get total unread count for a user
   */
  async getUnreadCount(userId) {
    try {
      const conversations = await this.conversationsCollection
        .find({
          'participants.userId': userId,
          status: CONVERSATION_STATUS.ACTIVE,
        })
        .toArray();

      let totalUnread = 0;
      for (const conv of conversations) {
        const participant = conv.participants.find(p => p.userId === userId);
        if (participant && !participant.isMuted && !participant.isArchived) {
          totalUnread += participant.unreadCount || 0;
        }
      }

      return { unreadCount: totalUnread };
    } catch (error) {
      this.logger.error('Error getting unread count', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Search messages across all conversations
   */
  async searchMessages(userId, query, { limit = 20 } = {}) {
    try {
      // Get user's conversation IDs
      const conversations = await this.conversationsCollection
        .find({
          'participants.userId': userId,
          status: { $ne: CONVERSATION_STATUS.DELETED },
        })
        .project({ _id: 1 })
        .toArray();

      const conversationIds = conversations.map(c => c._id.toString());

      // Search messages
      const messages = await this.messagesCollection
        .find({
          conversationId: { $in: conversationIds },
          deletedAt: null,
          $text: { $search: query },
        })
        .sort({ score: { $meta: 'textScore' }, createdAt: -1 })
        .limit(limit)
        .toArray();

      return { messages, total: messages.length };
    } catch (error) {
      this.logger.error('Error searching messages', { error: error.message, userId, query });
      throw error;
    }
  }

  /**
   * Get contacts for starting a new conversation
   */
  async getContacts(userId, { search = null, limit = 20 } = {}) {
    try {
      // This is a placeholder - you'll need to implement based on your user model
      // For now, return users from existing conversations
      const conversations = await this.conversationsCollection
        .find({
          'participants.userId': userId,
        })
        .toArray();

      const contacts = new Map();

      conversations.forEach(conv => {
        conv.participants.forEach(p => {
          if (p.userId !== userId && !contacts.has(p.userId)) {
            contacts.set(p.userId, {
              userId: p.userId,
              displayName: p.displayName,
              avatar: p.avatar,
              role: p.role,
            });
          }
        });
      });

      let contactList = Array.from(contacts.values());

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        contactList = contactList.filter(c => c.displayName.toLowerCase().includes(searchLower));
      }

      return {
        contacts: contactList.slice(0, limit),
        total: contactList.length,
      };
    } catch (error) {
      this.logger.error('Error getting contacts', { error: error.message, userId });
      throw error;
    }
  }
}

module.exports = ChatV5Service;
