/**
 * Chat API Routes (v5)
 * RESTful API for the unified chat system
 */

'use strict';

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const ChatV5Service = require('../services/chat-v5.service');

let chatService;
let authRequired;
let csrfProtection;
let logger;
let writeRateLimiter;

/**
 * Initialize dependencies
 */
function initialize(deps) {
  if (!deps.authRequired) {
    throw new Error('authRequired middleware is required');
  }
  if (!deps.csrfProtection) {
    throw new Error('csrfProtection middleware is required');
  }
  if (!deps.logger) {
    throw new Error('logger is required');
  }

  authRequired = deps.authRequired;
  csrfProtection = deps.csrfProtection;
  logger = deps.logger;
  writeRateLimiter = deps.writeRateLimiter;

  // Initialize service with database connection
  const getDb = () => {
    if (deps.db && typeof deps.db.getDb === 'function') {
      return deps.db.getDb();
    }
    if (deps.db && deps.db.collection) {
      return deps.db;
    }
    throw new Error('Database not available');
  };

  chatService = new ChatV5Service(getDb(), logger);

  return router;
}

/**
 * POST /api/v5/chat/conversations - Create a new conversation
 */
router.post('/conversations', authRequired, csrfProtection, writeRateLimiter, async (req, res) => {
  try {
    const { type, participantIds, context, metadata } = req.body;
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!type) {
      return res.status(400).json({ error: 'Conversation type is required' });
    }

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'At least one participant is required' });
    }

    // Build participants array
    // Note: In a real implementation, you'd fetch user details from the database
    // For now, we'll use a simplified version
    const participants = [
      {
        userId,
        displayName: req.user?.name || req.user?.email || 'You',
        avatar: req.user?.avatar || null,
        role: req.user?.role || 'customer',
      },
    ];

    // Add other participants
    for (const participantId of participantIds) {
      if (participantId !== userId) {
        participants.push({
          userId: participantId,
          displayName: 'User', // TODO: Fetch from user service
          avatar: null,
          role: 'customer', // TODO: Fetch from user service
        });
      }
    }

    const conversation = await chatService.createConversation({
      type,
      participants,
      context: context || null,
      metadata: metadata || {},
      userId,
    });

    res.status(201).json({
      success: true,
      conversation,
    });
  } catch (error) {
    logger.error('Error creating conversation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v5/chat/conversations - Get user's conversations
 */
router.get('/conversations', authRequired, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const {
      status,
      unreadOnly,
      pinned,
      archived,
      search,
      limit = 50,
      skip = 0,
    } = req.query;

    const result = await chatService.getConversations({
      userId,
      status,
      unreadOnly: unreadOnly === 'true',
      pinned: pinned === 'true' ? true : pinned === 'false' ? false : null,
      archived: archived === 'true' ? true : archived === 'false' ? false : null,
      search,
      limit: Math.min(parseInt(limit, 10) || 50, 100),
      skip: parseInt(skip, 10) || 0,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error getting conversations', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v5/chat/conversations/:id - Get a single conversation
 */
router.get('/conversations/:id', authRequired, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const conversation = await chatService.getConversation(id, userId);

    res.json({
      success: true,
      conversation,
    });
  } catch (error) {
    logger.error('Error getting conversation', { error: error.message });
    if (error.message === 'Conversation not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/v5/chat/conversations/:id - Update conversation settings
 */
router.patch('/conversations/:id', authRequired, csrfProtection, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const { isPinned, isMuted, isArchived } = req.body;
    const updates = {};

    if (typeof isPinned === 'boolean') updates.isPinned = isPinned;
    if (typeof isMuted === 'boolean') updates.isMuted = isMuted;
    if (typeof isArchived === 'boolean') updates.isArchived = isArchived;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates provided' });
    }

    const conversation = await chatService.updateConversation(id, userId, updates);

    res.json({
      success: true,
      conversation,
    });
  } catch (error) {
    logger.error('Error updating conversation', { error: error.message });
    if (error.message === 'Conversation not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v5/chat/conversations/:id - Delete a conversation
 */
router.delete('/conversations/:id', authRequired, csrfProtection, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    await chatService.deleteConversation(id, userId);

    res.json({
      success: true,
      message: 'Conversation deleted',
    });
  } catch (error) {
    logger.error('Error deleting conversation', { error: error.message });
    if (error.message === 'Conversation not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v5/chat/conversations/:id/messages - Send a message
 */
router.post('/conversations/:id/messages', authRequired, csrfProtection, writeRateLimiter, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;
    const { content, type, attachments, replyTo } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const message = await chatService.sendMessage({
      conversationId: id,
      senderId: userId,
      senderName: req.user?.name || req.user?.email || 'User',
      senderAvatar: req.user?.avatar || null,
      content,
      type: type || 'text',
      attachments: attachments || [],
      replyTo: replyTo || null,
    });

    res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    logger.error('Error sending message', { error: error.message });
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v5/chat/conversations/:id/messages - Get messages
 */
router.get('/conversations/:id/messages', authRequired, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;
    const { before, limit = 50 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    const result = await chatService.getMessages(id, userId, {
      before,
      limit: Math.min(parseInt(limit, 10) || 50, 100),
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error getting messages', { error: error.message });
    if (error.message.includes('not found') || error.message.includes('access denied')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * PATCH /api/v5/chat/messages/:id - Edit a message
 */
router.patch('/messages/:id', authRequired, csrfProtection, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;
    const { content } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const message = await chatService.editMessage(id, userId, content);

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    logger.error('Error editing message', { error: error.message });
    if (error.message.includes('not found') || error.message.includes('not yours')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/v5/chat/messages/:id - Delete a message
 */
router.delete('/messages/:id', authRequired, csrfProtection, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    await chatService.deleteMessage(id, userId);

    res.json({
      success: true,
      message: 'Message deleted',
    });
  } catch (error) {
    logger.error('Error deleting message', { error: error.message });
    if (error.message.includes('not found') || error.message.includes('not yours')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v5/chat/conversations/:id/read - Mark conversation as read
 */
router.post('/conversations/:id/read', authRequired, csrfProtection, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    await chatService.markAsRead(id, userId);

    res.json({
      success: true,
      message: 'Conversation marked as read',
    });
  } catch (error) {
    logger.error('Error marking as read', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v5/chat/messages/:id/reactions - Toggle emoji reaction
 */
router.post('/messages/:id/reactions', authRequired, csrfProtection, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;
    const { emoji } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid message ID' });
    }

    if (!emoji || typeof emoji !== 'string') {
      return res.status(400).json({ error: 'Emoji is required' });
    }

    const message = await chatService.toggleReaction(
      id,
      userId,
      req.user?.name || req.user?.email || 'User',
      emoji
    );

    res.json({
      success: true,
      message,
    });
  } catch (error) {
    logger.error('Error toggling reaction', { error: error.message });
    if (error.message === 'Message not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/v5/chat/conversations/:id/typing - Send typing indicator
 * (This is handled via WebSocket, but keeping the endpoint for compatibility)
 */
router.post('/conversations/:id/typing', authRequired, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID' });
    }

    // Typing indicators are primarily handled via WebSocket
    // This endpoint just acknowledges the request
    res.json({
      success: true,
      message: 'Typing indicator sent',
    });
  } catch (error) {
    logger.error('Error sending typing indicator', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v5/chat/contacts - Get messageable contacts
 */
router.get('/contacts', authRequired, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { search, limit = 20 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await chatService.getContacts(userId, {
      search,
      limit: Math.min(parseInt(limit, 10) || 20, 100),
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error getting contacts', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v5/chat/unread-count - Get total unread count
 */
router.get('/unread-count', authRequired, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await chatService.getUnreadCount(userId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error getting unread count', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/v5/chat/search - Search messages
 */
router.get('/search', authRequired, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { q, limit = 20 } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const result = await chatService.searchMessages(userId, q, {
      limit: Math.min(parseInt(limit, 10) || 20, 100),
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Error searching messages', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = { router, initialize };
