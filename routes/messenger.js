/**
 * Messenger v3 Routes - Unified Messenger API
 * Gold Standard messaging system with universal user-to-user communication
 */

'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { writeLimiter, uploadLimiter } = require('../middleware/rateLimits');
const MessengerService = require('../services/messenger.service');
const { createDeprecationMiddleware } = require('../middleware/legacyMessaging');

const router = express.Router();

// Dependencies injected by server.js
let authRequired;
let csrfProtection;
let db;
let wsServer;
let postmark;
let logger;

// Messenger service instance
let messengerService;

// Configure multer for attachments
const attachmentStorage = multer.memoryStorage();

const attachmentFileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const attachmentUpload = multer({
  storage: attachmentStorage,
  fileFilter: attachmentFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10, // Max 10 files per request
  },
});

/**
 * Initialize dependencies from server.js
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Messenger routes: dependencies object is required');
  }

  const required = ['authRequired', 'csrfProtection', 'db', 'logger'];
  const missing = required.filter(key => !deps[key]);

  if (missing.length > 0) {
    throw new Error(`Messenger routes: missing required dependencies: ${missing.join(', ')}`);
  }

  authRequired = deps.authRequired;
  csrfProtection = deps.csrfProtection;

  // db can be either mongoDb module or db instance
  db = deps.db;

  wsServer = deps.wsServer; // Optional
  postmark = deps.postmark; // Optional
  logger = deps.logger;

  // Service will be initialized lazily on first request
  messengerService = null;

  logger.info('✅ Messenger v3 routes initialized');
}

/**
 * Get database instance (handles both mongoDb module and db instance)
 */
async function getDbInstance() {
  if (db && typeof db.getDb === 'function') {
    // It's the mongoDb module
    return await db.getDb();
  }
  // It's already a db instance
  return db;
}

/**
 * Get or initialize messenger service
 */
async function getMessengerService() {
  if (!messengerService) {
    const dbInstance = await getDbInstance();
    messengerService = new MessengerService(dbInstance);
  }
  return messengerService;
}

/**
 * Deferred middleware wrappers
 */
function applyAuthRequired(req, res, next) {
  if (!authRequired) {
    return res.status(503).json({ error: 'Auth service not initialized' });
  }
  return authRequired(req, res, next);
}

function applyCsrfProtection(req, res, next) {
  if (!csrfProtection) {
    return res.status(503).json({ error: 'CSRF service not initialized' });
  }
  return csrfProtection(req, res, next);
}

function applyWriteLimiter(req, res, next) {
  if (!writeLimiter) {
    return next(); // Graceful degradation
  }
  return writeLimiter(req, res, next);
}

function applyUploadLimiter(req, res, next) {
  if (!uploadLimiter) {
    return next(); // Graceful degradation
  }
  return uploadLimiter(req, res, next);
}

/**
 * Ensure services are initialized
 */
function ensureServices(req, res, next) {
  if (!messengerService) {
    return res.status(503).json({
      error: 'Messenger service not initialized',
      code: 'SERVICE_UNAVAILABLE',
    });
  }
  next();
}

/**
 * Sanitize user input
 */
function sanitizeInput(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  // Basic HTML entity encoding
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .substring(0, 10000); // Max 10k chars
}

function isValidObjectId(id) {
  return typeof id === 'string' && /^[a-fA-F0-9]{24}$/.test(id);
}

/**
 * Store attachment file
 */
async function storeAttachment(file) {
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'attachments');

  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') {
      throw new Error('Storage system unavailable');
    }
  }

  // Generate unique filename
  const hash = crypto.createHash('sha256').update(file.buffer).digest('hex').substring(0, 16);
  const ext = path.extname(file.originalname);
  const filename = `${hash}${ext}`;
  const filepath = path.join(uploadsDir, filename);

  // Write file
  await fs.writeFile(filepath, file.buffer);

  // Return attachment object
  return {
    type: file.mimetype.startsWith('image/') ? 'image' : 'document',
    url: `/uploads/attachments/${filename}`,
    filename: file.originalname,
    size: file.size,
    mimeType: file.mimetype,
  };
}

// =========================
// Deprecation Enforcement Middleware
// =========================

/**
 * Deprecation enforcement middleware for v3 Messenger API.
 * Behaviour is controlled by LEGACY_MESSAGING_MODE env var (off|read-only|on).
 * Write endpoints return HTTP 410 when mode is "off" or "read-only".
 */
router.use(
  createDeprecationMiddleware({
    version: 'v3',
    sunset: '2027-03-31',
    logger: msg => logger && logger.warn(msg),
  })
);

// ===== CONVERSATION ROUTES =====

/**
 * POST /api/v3/messenger/conversations
 * Create a new conversation
 * @deprecated Use POST /api/v4/messenger/conversations instead
 */
router.post(
  '/conversations',
  applyAuthRequired,
  applyCsrfProtection,
  applyWriteLimiter,
  ensureServices,
  async (req, res) => {
    try {
      const { recipientId, context, initialMessage, metadata } = req.body;
      const userId = req.user.id;

      // Validation
      if (!recipientId) {
        return res.status(400).json({
          error: 'recipientId is required',
          code: 'MISSING_RECIPIENT',
        });
      }

      if (recipientId === userId) {
        return res.status(400).json({
          error: 'Cannot create conversation with yourself',
          code: 'INVALID_RECIPIENT',
        });
      }

      // Sanitize inputs
      const sanitizedMessage = initialMessage ? sanitizeInput(initialMessage) : null;
      const sanitizedMetadata = metadata || {};

      // Create conversation
      const result = await (
        await getMessengerService()
      ).createConversation(userId, recipientId, context, sanitizedMetadata, sanitizedMessage);

      // Emit WebSocket event if available
      if (wsServer && wsServer.emitToUser) {
        wsServer.emitToUser(recipientId, 'messenger:new-conversation', {
          conversationId: result.conversation._id.toString(),
        });
      }

      // Send email notification if recipient is offline and has notifications enabled
      if (postmark && result.message) {
        try {
          const recipient = await db.collection('users').findOne({ id: recipientId });
          if (recipient && recipient.notify_account !== false) {
            const conversationLink = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/messenger/?conversation=${result.conversation._id}`;
            await postmark.sendNotificationEmail(
              recipient,
              `New message from ${req.user.name || 'a user'}`,
              `You have a new message: "${sanitizedMessage?.substring(0, 100)}"`,
              {
                templateData: {
                  ctaText: 'View Message',
                  ctaLink: conversationLink,
                },
              }
            );
          }
        } catch (emailError) {
          logger.error('Failed to send conversation email notification:', emailError);
          // Don't fail the request if email fails
        }
      }

      res.status(result.isExisting ? 200 : 201).json({
        success: true,
        conversation: result.conversation,
        message: result.message,
        isExisting: result.isExisting,
      });
    } catch (error) {
      logger.error('Create conversation error:', error);
      res.status(500).json({
        error: 'Failed to create conversation',
        code: 'CREATION_FAILED',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v3/messenger/conversations
 * List user's conversations with filters
 */
router.get('/conversations', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, unreadOnly, pinned, archived, search } = req.query;

    const filters = {
      status: status || 'active',
      unreadOnly: unreadOnly === 'true',
      pinned: pinned === 'true',
      archived: archived === 'true',
      search: search || '',
    };

    const conversations = await (await getMessengerService()).getConversations(userId, filters);

    res.json({
      success: true,
      conversations,
      count: conversations.length,
    });
  } catch (error) {
    logger.error('Get conversations error:', error);
    res.status(500).json({
      error: 'Failed to fetch conversations',
      code: 'FETCH_FAILED',
      message: error.message,
    });
  }
});

/**
 * GET /api/v3/messenger/conversations/:id
 * Get conversation details
 */
router.get('/conversations/:id', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid conversation ID', code: 'INVALID_ID' });
    }
    const userId = req.user.id;

    const conversation = await (await getMessengerService()).getConversation(id, userId);

    res.json({
      success: true,
      conversation,
    });
  } catch (error) {
    logger.error('Get conversation error:', error);
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      error: error.message,
      code: status === 404 ? 'NOT_FOUND' : 'FETCH_FAILED',
    });
  }
});

/**
 * PATCH /api/v3/messenger/conversations/:id
 * Update conversation settings (pin, mute, archive)
 */
router.patch(
  '/conversations/:id',
  applyAuthRequired,
  applyCsrfProtection,
  applyWriteLimiter,
  ensureServices,
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: 'Invalid conversation ID', code: 'INVALID_ID' });
      }
      const userId = req.user.id;
      const { isPinned, isMuted, isArchived, markUnread } = req.body;

      const updates = {};
      if (isPinned !== undefined) {
        updates.isPinned = isPinned;
      }
      if (isMuted !== undefined) {
        updates.isMuted = isMuted;
      }
      if (isArchived !== undefined) {
        updates.isArchived = isArchived;
      }
      if (markUnread !== undefined) {
        updates.markUnread = markUnread;
      }

      const conversation = await (
        await getMessengerService()
      ).updateConversation(id, userId, updates);

      res.json({
        success: true,
        conversation,
      });
    } catch (error) {
      logger.error('Update conversation error:', error);
      res.status(500).json({
        error: 'Failed to update conversation',
        code: 'UPDATE_FAILED',
        message: error.message,
      });
    }
  }
);

/**
 * DELETE /api/v3/messenger/conversations/:id
 * Soft-delete conversation (archive for user)
 */
router.delete(
  '/conversations/:id',
  applyAuthRequired,
  applyCsrfProtection,
  applyWriteLimiter,
  ensureServices,
  async (req, res) => {
    try {
      const { id } = req.params;
      if (!isValidObjectId(id)) {
        return res.status(400).json({ error: 'Invalid conversation ID', code: 'INVALID_ID' });
      }
      const userId = req.user.id;

      await (await getMessengerService()).deleteConversation(id, userId);

      res.json({
        success: true,
        message: 'Conversation archived',
      });
    } catch (error) {
      logger.error('Delete conversation error:', error);
      res.status(500).json({
        error: 'Failed to delete conversation',
        code: 'DELETE_FAILED',
        message: error.message,
      });
    }
  }
);

// ===== MESSAGE ROUTES =====

/**
 * POST /api/v3/messenger/conversations/:id/messages
 * Send a message (with attachments support)
 */
router.post(
  '/conversations/:id/messages',
  applyAuthRequired,
  applyCsrfProtection,
  applyWriteLimiter,
  applyUploadLimiter,
  ensureServices,
  (req, res, next) => {
    // Apply multer middleware
    attachmentUpload.array('attachments', 10)(req, res, err => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              error: 'File too large',
              code: 'FILE_TOO_LARGE',
              message: 'Maximum file size is 10MB per file',
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              error: 'Too many files',
              code: 'TOO_MANY_FILES',
              message: 'Maximum 10 files per message',
            });
          }
        }
        return res.status(400).json({
          error: 'File upload error',
          code: 'UPLOAD_ERROR',
          message: err.message,
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id: conversationId } = req.params;
      if (!isValidObjectId(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversation ID', code: 'INVALID_ID' });
      }
      const userId = req.user.id;
      const { message: content, replyToId } = req.body;
      if (!content && (!req.files || req.files.length === 0)) {
        return res.status(400).json({
          error: 'Message must have content or attachments',
          code: 'EMPTY_MESSAGE',
        });
      }

      // Sanitize content
      const sanitizedContent = content ? sanitizeInput(content) : '';

      // Process attachments
      const attachments = [];
      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          try {
            const attachment = await storeAttachment(file);
            attachments.push(attachment);
          } catch (err) {
            logger.error('Failed to store attachment:', err);
            // Continue with other attachments
          }
        }
      }

      // Send message
      const message = await (
        await getMessengerService()
      ).sendMessage(conversationId, userId, sanitizedContent, attachments, replyToId);

      // Emit WebSocket event
      if (wsServer && wsServer.emitToRoom) {
        wsServer.emitToRoom(`messenger:${conversationId}`, 'messenger:new-message', {
          conversationId,
          message,
        });
      }

      // Send email notification to other participants if offline
      if (postmark) {
        try {
          const conversation = await (
            await getMessengerService()
          ).getConversation(conversationId, userId);
          const recipients = conversation.participants.filter(p => p.userId !== userId);

          for (const recipient of recipients) {
            const user = await db.collection('users').findOne({ id: recipient.userId });
            if (user && user.notify_account !== false && !recipient.isMuted) {
              const messageLink = `${process.env.APP_BASE_URL || 'http://localhost:3000'}/messenger/?conversation=${conversationId}`;
              await postmark.sendNotificationEmail(
                user,
                `New message from ${req.user.name || 'a user'}`,
                sanitizedContent.substring(0, 200),
                {
                  templateData: {
                    ctaText: 'View Message',
                    ctaLink: messageLink,
                  },
                }
              );
            }
          }
        } catch (emailError) {
          logger.error('Failed to send message email notification:', emailError);
          // Don't fail the request
        }
      }

      res.status(201).json({
        success: true,
        message,
      });
    } catch (error) {
      logger.error('Send message error:', error);
      res.status(500).json({
        error: 'Failed to send message',
        code: 'SEND_FAILED',
        message: error.message,
      });
    }
  }
);

/**
 * GET /api/v3/messenger/conversations/:id/messages
 * Get messages with cursor-based pagination
 */
router.get('/conversations/:id/messages', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    const userId = req.user.id;
    const { before, limit = 50 } = req.query;
    const clampedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);

    const result = await (
      await getMessengerService()
    ).getMessages(conversationId, userId, before, clampedLimit);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Get messages error:', error);
    res.status(500).json({
      error: 'Failed to fetch messages',
      code: 'FETCH_FAILED',
      message: error.message,
    });
  }
});

/**
 * PATCH /api/v3/messenger/messages/:id
 * Edit a message (within 15-minute window)
 */
router.patch(
  '/messages/:id',
  applyAuthRequired,
  applyCsrfProtection,
  applyWriteLimiter,
  ensureServices,
  async (req, res) => {
    try {
      const { id: messageId } = req.params;
      if (!isValidObjectId(messageId)) {
        return res.status(400).json({ error: 'Invalid message ID', code: 'INVALID_ID' });
      }
      const userId = req.user.id;
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({
          error: 'Content is required',
          code: 'MISSING_CONTENT',
        });
      }

      const sanitizedContent = sanitizeInput(content);
      const message = await (
        await getMessengerService()
      ).editMessage(messageId, userId, sanitizedContent);

      // Emit WebSocket event
      if (wsServer && wsServer.emitToRoom) {
        wsServer.emitToRoom(`messenger:${message.conversationId}`, 'messenger:message-edited', {
          messageId,
          content: sanitizedContent,
        });
      }

      res.json({
        success: true,
        message,
      });
    } catch (error) {
      logger.error('Edit message error:', error);
      const status = error.message.includes('window expired') ? 403 : 500;
      res.status(status).json({
        error: error.message,
        code: status === 403 ? 'EDIT_WINDOW_EXPIRED' : 'EDIT_FAILED',
      });
    }
  }
);

/**
 * DELETE /api/v3/messenger/messages/:id
 * Soft-delete a message
 */
router.delete(
  '/messages/:id',
  applyAuthRequired,
  applyCsrfProtection,
  applyWriteLimiter,
  ensureServices,
  async (req, res) => {
    try {
      const { id: messageId } = req.params;
      if (!isValidObjectId(messageId)) {
        return res.status(400).json({ error: 'Invalid message ID', code: 'INVALID_ID' });
      }
      const userId = req.user.id;

      // Get message first to retrieve conversationId for WebSocket
      const message = await db.collection('chat_messages').findOne({
        _id: new ObjectId(messageId),
        senderId: userId,
        isDeleted: false,
      });

      if (!message) {
        return res.status(404).json({
          error: 'Message not found or access denied',
          code: 'NOT_FOUND',
        });
      }

      const conversationId = message.conversationId;

      // Delete the message
      const success = await (await getMessengerService()).deleteMessage(messageId, userId);

      if (!success) {
        return res.status(404).json({
          error: 'Message not found or access denied',
          code: 'NOT_FOUND',
        });
      }

      // Emit WebSocket event using conversationId we retrieved earlier
      if (wsServer && wsServer.emitToRoom) {
        wsServer.emitToRoom(`messenger:${conversationId}`, 'messenger:message-deleted', {
          messageId,
        });
      }

      res.json({
        success: true,
        message: 'Message deleted',
      });
    } catch (error) {
      logger.error('Delete message error:', error);
      res.status(500).json({
        error: 'Failed to delete message',
        code: 'DELETE_FAILED',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v3/messenger/conversations/:id/read
 * Mark conversation as read
 */
router.post(
  '/conversations/:id/read',
  applyAuthRequired,
  applyCsrfProtection,
  applyWriteLimiter,
  ensureServices,
  async (req, res) => {
    try {
      const { id: conversationId } = req.params;
      if (!isValidObjectId(conversationId)) {
        return res.status(400).json({ error: 'Invalid conversation ID', code: 'INVALID_ID' });
      }
      const userId = req.user.id;

      const result = await (await getMessengerService()).markAsRead(conversationId, userId);

      // Emit WebSocket event
      if (wsServer && wsServer.emitToUser) {
        wsServer.emitToUser(userId, 'messenger:conversation-read', {
          conversationId,
        });
      }

      res.json(result);
    } catch (error) {
      logger.error('Mark as read error:', error);
      res.status(500).json({
        error: 'Failed to mark as read',
        code: 'MARK_READ_FAILED',
        message: error.message,
      });
    }
  }
);

/**
 * POST /api/v3/messenger/messages/:id/reactions
 * Toggle emoji reaction on a message
 */
router.post(
  '/messages/:id/reactions',
  applyAuthRequired,
  applyCsrfProtection,
  applyWriteLimiter,
  ensureServices,
  async (req, res) => {
    try {
      const { id: messageId } = req.params;
      if (!isValidObjectId(messageId)) {
        return res.status(400).json({ error: 'Invalid message ID', code: 'INVALID_ID' });
      }
      const userId = req.user.id;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({
          error: 'Emoji is required',
          code: 'MISSING_EMOJI',
        });
      }

      const message = await (await getMessengerService()).toggleReaction(messageId, userId, emoji);

      // Emit WebSocket event
      if (wsServer && wsServer.emitToRoom) {
        wsServer.emitToRoom(`messenger:${message.conversationId}`, 'messenger:reaction-updated', {
          messageId,
          reactions: message.reactions,
        });
      }

      res.json({
        success: true,
        message,
      });
    } catch (error) {
      logger.error('Toggle reaction error:', error);
      res.status(500).json({
        error: 'Failed to toggle reaction',
        code: 'REACTION_FAILED',
        message: error.message,
      });
    }
  }
);

// ===== SEARCH & UTILITY ROUTES =====

/**
 * GET /api/v3/messenger/search
 * Search messages across user's conversations
 */
router.get('/search', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q: query, conversationId } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        error: 'Search query must be at least 2 characters',
        code: 'INVALID_QUERY',
      });
    }

    const messages = await (
      await getMessengerService()
    ).searchMessages(userId, query.trim(), conversationId);

    res.json({
      success: true,
      messages,
      count: messages.length,
    });
  } catch (error) {
    logger.error('Search messages error:', error);
    res.status(500).json({
      error: 'Failed to search messages',
      code: 'SEARCH_FAILED',
      message: error.message,
    });
  }
});

/**
 * GET /api/v3/messenger/contacts
 * Get contactable users for new conversations
 */
router.get('/contacts', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q: searchQuery = '' } = req.query;

    const contacts = await (await getMessengerService()).getContacts(userId, searchQuery.trim());

    res.json({
      success: true,
      contacts,
      count: contacts.length,
    });
  } catch (error) {
    logger.error('Get contacts error:', error);
    res.status(500).json({
      error: 'Failed to fetch contacts',
      code: 'FETCH_FAILED',
      message: error.message,
    });
  }
});

/**
 * GET /api/v3/messenger/unread-count
 * Get total unread message count
 */
router.get('/unread-count', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const count = await (await getMessengerService()).getUnreadCount(userId);

    res.json({
      success: true,
      count,
    });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({
      error: 'Failed to get unread count',
      code: 'COUNT_FAILED',
      message: error.message,
    });
  }
});

/**
 * POST /api/v3/messenger/conversations/:id/typing
 * Send typing indicator (proxied through WebSocket)
 */
router.post('/conversations/:id/typing', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { id: conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation ID', code: 'INVALID_ID' });
    }
    const userId = req.user.id;
    const { isTyping } = req.body;

    // Verify user has access to this conversation
    await (await getMessengerService()).getConversation(conversationId, userId);

    // Emit WebSocket event
    if (wsServer && wsServer.emitToRoom) {
      wsServer.emitToRoom(`messenger:${conversationId}`, 'messenger:typing', {
        conversationId,
        userId,
        isTyping: !!isTyping,
      });
    }

    res.json({
      success: true,
    });
  } catch (error) {
    logger.error('Typing indicator error:', error);
    res.status(500).json({
      error: 'Failed to send typing indicator',
      code: 'TYPING_FAILED',
      message: error.message,
    });
  }
});

// Export router and initialization function
module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
