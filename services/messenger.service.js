/**
 * Messenger Service - Business Logic Layer
 * Handles all messenger v3 operations with MongoDB native driver
 */

'use strict';

const { ObjectId } = require('mongodb');
const { validateConversation, validateMessage } = require('../models/Conversation');

class MessengerService {
  constructor(db) {
    if (!db) {
      throw new Error('MessengerService requires a database instance');
    }
    this.db = db;
  }

  /**
   * Create a new conversation
   * @param {string} creatorId - User ID of conversation creator
   * @param {string} recipientId - User ID of recipient
   * @param {Object} context - Optional context object
   * @param {Object} metadata - Optional metadata
   * @param {string} initialMessage - Optional initial message text
   * @returns {Promise<Object>} Created conversation with initial message if provided
   */
  async createConversation(creatorId, recipientId, context = null, metadata = {}, initialMessage = null) {
    // Check for existing direct conversation between these users with same context
    const existingConversation = await this._findExistingConversation(creatorId, recipientId, context);
    
    if (existingConversation) {
      // If there's an initial message, append it to existing conversation
      if (initialMessage) {
        const creator = await this._getUserInfo(creatorId);
        const message = await this.sendMessage(
          existingConversation._id.toString(),
          creatorId,
          initialMessage,
          [],
          null
        );
        return { conversation: existingConversation, message, isExisting: true };
      }
      return { conversation: existingConversation, isExisting: true };
    }

    // Get user information for both participants
    const [creator, recipient] = await Promise.all([
      this._getUserInfo(creatorId),
      this._getUserInfo(recipientId),
    ]);

    // Create new conversation
    const now = new Date();
    const conversation = {
      type: context ? 'marketplace' : 'direct',
      participants: [
        {
          userId: creatorId,
          displayName: creator.name || 'User',
          avatar: creator.avatar || creator.name?.[0]?.toUpperCase() || 'U',
          role: creator.role || 'customer',
          joinedAt: now,
          lastReadAt: now,
          isPinned: false,
          isMuted: false,
          isArchived: false,
          unreadCount: 0,
        },
        {
          userId: recipientId,
          displayName: recipient.name || 'User',
          avatar: recipient.avatar || recipient.name?.[0]?.toUpperCase() || 'U',
          role: recipient.role || 'supplier',
          joinedAt: now,
          lastReadAt: new Date(0), // Epoch to mark all messages as unread
          isPinned: false,
          isMuted: false,
          isArchived: false,
          unreadCount: 0,
        },
      ],
      context: context || null,
      lastMessage: null,
      metadata: metadata || {},
      status: 'active',
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    // Validate before insertion
    validateConversation(conversation);

    // Insert conversation
    const result = await this.db.collection('conversations').insertOne(conversation);
    conversation._id = result.insertedId;

    // Send initial message if provided
    let message = null;
    if (initialMessage) {
      message = await this.sendMessage(
        conversation._id.toString(),
        creatorId,
        initialMessage,
        [],
        null
      );
    }

    return { conversation, message, isExisting: false };
  }

  /**
   * Get conversations for a user with filters
   * @param {string} userId - User ID
   * @param {Object} filters - Filter options { status, unreadOnly, pinned, search }
   * @returns {Promise<Array>} Array of conversations
   */
  async getConversations(userId, filters = {}) {
    const query = {
      'participants.userId': userId,
    };

    // Apply filters
    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.pinned) {
      query.participants = {
        $elemMatch: {
          userId: userId,
          isPinned: true,
        },
      };
    }

    if (filters.archived !== undefined) {
      query.participants = {
        $elemMatch: {
          userId: userId,
          isArchived: filters.archived,
        },
      };
    }

    // Fetch conversations
    let conversations = await this.db
      .collection('conversations')
      .find(query)
      .sort({ updatedAt: -1 })
      .toArray();

    // Filter unread on application side (more complex logic)
    if (filters.unreadOnly) {
      conversations = conversations.filter(conv => {
        const participant = conv.participants.find(p => p.userId === userId);
        return participant && participant.unreadCount > 0;
      });
    }

    // Text search filter (client-side for simplicity)
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      conversations = conversations.filter(conv => {
        const otherParticipant = conv.participants.find(p => p.userId !== userId);
        const nameMatch = otherParticipant?.displayName.toLowerCase().includes(searchLower);
        const contentMatch = conv.lastMessage?.content?.toLowerCase().includes(searchLower);
        return nameMatch || contentMatch;
      });
    }

    return conversations;
  }

  /**
   * Get a specific conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for access control)
   * @returns {Promise<Object>} Conversation object
   */
  async getConversation(conversationId, userId) {
    const conversation = await this.db.collection('conversations').findOne({
      _id: new ObjectId(conversationId),
      'participants.userId': userId,
    });

    if (!conversation) {
      throw new Error('Conversation not found or access denied');
    }

    return conversation;
  }

  /**
   * Update conversation settings for a user
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {Object} updates - Updates object { pin, mute, archive }
   * @returns {Promise<Object>} Updated conversation
   */
  async updateConversation(conversationId, userId, updates) {
    // Build update query for specific participant
    const updateFields = {};
    
    if (updates.isPinned !== undefined) {
      updateFields['participants.$[participant].isPinned'] = updates.isPinned;
    }
    
    if (updates.isMuted !== undefined) {
      updateFields['participants.$[participant].isMuted'] = updates.isMuted;
    }
    
    if (updates.isArchived !== undefined) {
      updateFields['participants.$[participant].isArchived'] = updates.isArchived;
    }

    updateFields.updatedAt = new Date();

    const result = await this.db.collection('conversations').findOneAndUpdate(
      { _id: new ObjectId(conversationId), 'participants.userId': userId },
      { $set: updateFields },
      {
        arrayFilters: [{ 'participant.userId': userId }],
        returnDocument: 'after',
      }
    );

    if (!result.value) {
      throw new Error('Conversation not found or access denied');
    }

    return result.value;
  }

  /**
   * Soft-delete conversation for a user
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteConversation(conversationId, userId) {
    // Mark as archived for this user
    const result = await this.updateConversation(conversationId, userId, { isArchived: true });
    return !!result;
  }

  /**
   * Send a message in a conversation
   * @param {string} conversationId - Conversation ID
   * @param {string} senderId - Sender user ID
   * @param {string} content - Message content
   * @param {Array} attachments - Array of attachment objects
   * @param {string} replyToId - Optional message ID being replied to
   * @returns {Promise<Object>} Created message
   */
  async sendMessage(conversationId, senderId, content, attachments = [], replyToId = null) {
    // Verify conversation exists and user has access
    const conversation = await this.getConversation(conversationId, senderId);
    
    // Get sender info
    const sender = conversation.participants.find(p => p.userId === senderId);
    if (!sender) {
      throw new Error('Sender not a participant in conversation');
    }

    // Build message object
    const now = new Date();
    const message = {
      conversationId: new ObjectId(conversationId),
      senderId: senderId,
      senderName: sender.displayName,
      senderAvatar: sender.avatar,
      content: content || '',
      type: attachments.length > 0 && attachments[0].type === 'image' ? 'image' : 'text',
      attachments: attachments || [],
      reactions: [],
      readBy: [
        {
          userId: senderId,
          readAt: now,
        },
      ],
      replyTo: replyToId ? await this._getReplyToInfo(replyToId) : null,
      editHistory: [],
      isEdited: false,
      isDeleted: false,
      status: 'sent',
      createdAt: now,
      updatedAt: now,
    };

    // Validate message
    validateMessage(message);

    // Insert message
    const result = await this.db.collection('chat_messages').insertOne(message);
    message._id = result.insertedId;

    // Update conversation
    await this._updateConversationAfterMessage(conversationId, message, senderId);

    return message;
  }

  /**
   * Get messages in a conversation with cursor-based pagination
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (for access control)
   * @param {string} cursor - Optional cursor (message ID) for pagination
   * @param {number} limit - Number of messages to fetch (default: 50)
   * @returns {Promise<Object>} Object with messages array and pagination info
   */
  async getMessages(conversationId, userId, cursor = null, limit = 50) {
    // Verify access
    await this.getConversation(conversationId, userId);

    const query = {
      conversationId: new ObjectId(conversationId),
      isDeleted: false,
    };

    // Apply cursor if provided (for pagination)
    if (cursor) {
      query._id = { $lt: new ObjectId(cursor) };
    }

    const messages = await this.db
      .collection('chat_messages')
      .find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1) // Fetch one extra to check if there are more
      .toArray();

    const hasMore = messages.length > limit;
    const returnMessages = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? returnMessages[returnMessages.length - 1]._id.toString() : null;

    return {
      messages: returnMessages.reverse(), // Return in chronological order
      hasMore,
      nextCursor,
    };
  }

  /**
   * Edit a message (within 15-minute window)
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID (must be sender)
   * @param {string} newContent - New message content
   * @returns {Promise<Object>} Updated message
   */
  async editMessage(messageId, userId, newContent) {
    const message = await this.db.collection('chat_messages').findOne({
      _id: new ObjectId(messageId),
      senderId: userId,
      isDeleted: false,
    });

    if (!message) {
      throw new Error('Message not found or access denied');
    }

    // Check 15-minute edit window
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (message.createdAt < fifteenMinutesAgo) {
      throw new Error('Edit window expired (15 minutes)');
    }

    // Add to edit history
    const editHistory = message.editHistory || [];
    editHistory.push({
      content: message.content,
      editedAt: new Date(),
    });

    const result = await this.db.collection('chat_messages').findOneAndUpdate(
      { _id: new ObjectId(messageId) },
      {
        $set: {
          content: newContent,
          isEdited: true,
          editHistory: editHistory,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Soft-delete a message
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID (must be sender)
   * @returns {Promise<boolean>} Success status
   */
  async deleteMessage(messageId, userId) {
    const result = await this.db.collection('chat_messages').updateOne(
      {
        _id: new ObjectId(messageId),
        senderId: userId,
        isDeleted: false,
      },
      {
        $set: {
          isDeleted: true,
          content: '[Message deleted]',
          updatedAt: new Date(),
        },
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Mark conversation as read for a user
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Result with markedCount
   */
  async markAsRead(conversationId, userId) {
    const now = new Date();
    
    // Update participant's lastReadAt and reset unreadCount
    const result = await this.db.collection('conversations').updateOne(
      { _id: new ObjectId(conversationId), 'participants.userId': userId },
      {
        $set: {
          'participants.$[participant].lastReadAt': now,
          'participants.$[participant].unreadCount': 0,
          updatedAt: now,
        },
      },
      {
        arrayFilters: [{ 'participant.userId': userId }],
      }
    );

    // Also update readBy in messages
    await this.db.collection('chat_messages').updateMany(
      {
        conversationId: new ObjectId(conversationId),
        'readBy.userId': { $ne: userId },
      },
      {
        $push: {
          readBy: {
            userId: userId,
            readAt: now,
          },
        },
      }
    );

    return {
      success: true,
      markedCount: result.modifiedCount,
    };
  }

  /**
   * Toggle emoji reaction on a message
   * @param {string} messageId - Message ID
   * @param {string} userId - User ID
   * @param {string} emoji - Emoji character
   * @returns {Promise<Object>} Updated message
   */
  async toggleReaction(messageId, userId, emoji) {
    const message = await this.db.collection('chat_messages').findOne({
      _id: new ObjectId(messageId),
    });

    if (!message) {
      throw new Error('Message not found');
    }

    const reactions = message.reactions || [];
    const existingReactionIndex = reactions.findIndex(
      r => r.userId === userId && r.emoji === emoji
    );

    let updateOperation;
    if (existingReactionIndex >= 0) {
      // Remove reaction
      updateOperation = {
        $pull: {
          reactions: {
            userId: userId,
            emoji: emoji,
          },
        },
      };
    } else {
      // Add reaction
      const user = await this._getUserInfo(userId);
      updateOperation = {
        $push: {
          reactions: {
            emoji: emoji,
            userId: userId,
            userName: user.name || 'User',
            createdAt: new Date(),
          },
        },
      };
    }

    const result = await this.db.collection('chat_messages').findOneAndUpdate(
      { _id: new ObjectId(messageId) },
      updateOperation,
      { returnDocument: 'after' }
    );

    return result.value;
  }

  /**
   * Search messages across user's conversations
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {string} conversationId - Optional conversation ID to limit search
   * @returns {Promise<Array>} Array of matching messages
   */
  async searchMessages(userId, query, conversationId = null) {
    // Get user's conversation IDs
    const conversations = await this.getConversations(userId);
    const conversationIds = conversations.map(c => c._id);

    const searchQuery = {
      conversationId: conversationId ? new ObjectId(conversationId) : { $in: conversationIds },
      isDeleted: false,
      $text: { $search: query },
    };

    const messages = await this.db
      .collection('chat_messages')
      .find(searchQuery)
      .sort({ score: { $meta: 'textScore' } })
      .limit(50)
      .toArray();

    return messages;
  }

  /**
   * Get contactable users for starting new conversations
   * @param {string} userId - Current user ID
   * @param {string} searchQuery - Optional search query
   * @returns {Promise<Array>} Array of users
   */
  async getContacts(userId, searchQuery = '') {
    const query = {
      id: { $ne: userId }, // Exclude self
    };

    if (searchQuery) {
      query.$or = [
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } },
      ];
    }

    const users = await this.db
      .collection('users')
      .find(query)
      .project({ id: 1, name: 1, email: 1, role: 1, avatar: 1 })
      .limit(20)
      .toArray();

    return users;
  }

  /**
   * Get total unread message count for user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Total unread count
   */
  async getUnreadCount(userId) {
    const conversations = await this.db
      .collection('conversations')
      .find({
        'participants.userId': userId,
        'participants.isArchived': false,
      })
      .toArray();

    let total = 0;
    for (const conv of conversations) {
      const participant = conv.participants.find(p => p.userId === userId);
      if (participant && participant.unreadCount) {
        total += participant.unreadCount;
      }
    }

    return total;
  }

  // ===== PRIVATE HELPER METHODS =====

  /**
   * Find existing conversation between two users with same context
   * @private
   */
  async _findExistingConversation(userId1, userId2, context) {
    const query = {
      type: 'direct',
      'participants.userId': { $all: [userId1, userId2] },
      status: 'active',
    };

    // Only match context if provided
    if (context && context.referenceId) {
      query['context.referenceId'] = context.referenceId;
      query['context.type'] = context.type;
    } else if (!context) {
      query.context = null;
    }

    return await this.db.collection('conversations').findOne(query);
  }

  /**
   * Get user information
   * @private
   */
  async _getUserInfo(userId) {
    const user = await this.db.collection('users').findOne({ id: userId });
    return user || { id: userId, name: 'User', role: 'customer' };
  }

  /**
   * Get reply-to message info
   * @private
   */
  async _getReplyToInfo(messageId) {
    const message = await this.db.collection('chat_messages').findOne({
      _id: new ObjectId(messageId),
    });

    if (!message) {
      return null;
    }

    return {
      messageId: messageId,
      content: message.content.substring(0, 100), // Truncate for preview
      senderName: message.senderName,
    };
  }

  /**
   * Update conversation after a message is sent
   * @private
   */
  async _updateConversationAfterMessage(conversationId, message, senderId) {
    const now = new Date();
    
    // Prepare update for all participants except sender
    const updateOps = {
      $set: {
        lastMessage: {
          content: message.content.substring(0, 100),
          senderId: message.senderId,
          senderName: message.senderName,
          sentAt: message.createdAt,
          type: message.type,
        },
        messageCount: { $inc: 1 },
        updatedAt: now,
      },
      $inc: {
        'participants.$[other].unreadCount': 1,
      },
    };

    await this.db.collection('conversations').updateOne(
      { _id: new ObjectId(conversationId) },
      updateOps,
      {
        arrayFilters: [{ 'other.userId': { $ne: senderId } }],
      }
    );

    // Also increment messageCount
    await this.db.collection('conversations').updateOne(
      { _id: new ObjectId(conversationId) },
      { $inc: { messageCount: 1 } }
    );
  }
}

module.exports = MessengerService;
