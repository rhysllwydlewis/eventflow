/**
 * Messages Routes
 * Handles customer-supplier messaging functionality
 */

'use strict';

const express = require('express');
const { authRequired } = require('../middleware/auth');
const { auditLog, AUDIT_ACTIONS } = require('../middleware/audit');
const dbUnified = require('../db-unified');
const { uid } = require('../store');

const router = express.Router();

/**
 * GET /api/messages/threads
 * List all conversation threads for the current user
 * Query params: status (open/closed/archived), unreadOnly (boolean)
 */
router.get('/threads', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status, unreadOnly } = req.query;

    let threads = await dbUnified.read('threads');

    // Filter threads based on user role
    if (userRole === 'customer') {
      threads = threads.filter(t => t.customerId === userId);
    } else if (userRole === 'supplier') {
      threads = threads.filter(t => t.supplierId === userId);
    } else if (userRole === 'admin') {
      // Admins can see all threads
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Filter by status if provided
    if (status) {
      threads = threads.filter(t => (t.status || 'open') === status);
    }

    // Filter unread only if requested
    if (unreadOnly === 'true') {
      threads = threads.filter(t => {
        const unread = t.unreadCount || {};
        return (unread[userId] || 0) > 0;
      });
    }

    // Sort by last activity (most recent first)
    threads.sort((a, b) => {
      const aTime = new Date(a.lastMessageAt || a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.lastMessageAt || b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });

    res.json({ threads });
  } catch (error) {
    console.error('Error fetching threads:', error);
    res.status(500).json({ error: 'Failed to fetch threads', details: error.message });
  }
});

/**
 * GET /api/messages/threads/:threadId
 * Get details of a specific thread
 */
router.get('/threads/:threadId', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { threadId } = req.params;

    const threads = await dbUnified.read('threads');
    const thread = threads.find(t => t.id === threadId);

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Check access permissions
    const hasAccess =
      userRole === 'admin' ||
      (userRole === 'customer' && thread.customerId === userId) ||
      (userRole === 'supplier' && thread.supplierId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ thread });
  } catch (error) {
    console.error('Error fetching thread:', error);
    res.status(500).json({ error: 'Failed to fetch thread', details: error.message });
  }
});

/**
 * POST /api/messages/threads
 * Create a new conversation thread
 * Body: { supplierId, packageId?, subject?, eventType?, eventDate?, eventLocation?, guests? }
 */
router.post('/threads', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    if (userRole !== 'customer') {
      return res.status(403).json({ error: 'Only customers can initiate threads' });
    }

    const { supplierId, packageId, subject, eventType, eventDate, eventLocation, guests } =
      req.body;

    if (!supplierId) {
      return res.status(400).json({ error: 'supplierId is required' });
    }

    // Check if there's already an open thread with this supplier
    const threads = await dbUnified.read('threads');
    const existingThread = threads.find(
      t => t.customerId === userId && t.supplierId === supplierId && (t.status || 'open') === 'open'
    );

    if (existingThread) {
      return res.json({ thread: existingThread, isExisting: true });
    }

    // Get supplier and customer names
    const users = await dbUnified.read('users');
    const suppliers = await dbUnified.read('suppliers');

    const customer = users.find(u => u.id === userId);
    const supplier =
      suppliers.find(s => s.id === supplierId) || users.find(u => u.id === supplierId);

    const now = new Date().toISOString();
    const newThread = {
      id: uid(),
      customerId: userId,
      customerName: customer?.name || 'Customer',
      supplierId,
      supplierName: supplier?.name || 'Supplier',
      packageId: packageId || null,
      subject: subject || 'New Inquiry',
      status: 'open',
      eventType: eventType || null,
      eventDate: eventDate || null,
      eventLocation: eventLocation || null,
      guests: guests || null,
      lastMessageAt: null,
      lastMessagePreview: null,
      unreadCount: {},
      createdAt: now,
      updatedAt: now,
    };

    threads.push(newThread);
    await dbUnified.write('threads', threads);

    // Audit log
    auditLog({
      adminId: userId,
      adminEmail: req.user.email,
      action: AUDIT_ACTIONS.CREATE || 'THREAD_CREATED',
      targetType: 'thread',
      targetId: newThread.id,
      details: { supplierId, packageId },
    });

    res.status(201).json({ thread: newThread, isExisting: false });
  } catch (error) {
    console.error('Error creating thread:', error);
    res.status(500).json({ error: 'Failed to create thread', details: error.message });
  }
});

/**
 * GET /api/messages/threads/:threadId/messages
 * Get all messages in a thread
 */
router.get('/threads/:threadId/messages', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { threadId } = req.params;

    // Verify access to thread
    const threads = await dbUnified.read('threads');
    const thread = threads.find(t => t.id === threadId);

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const hasAccess =
      userRole === 'admin' ||
      (userRole === 'customer' && thread.customerId === userId) ||
      (userRole === 'supplier' && thread.supplierId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Get messages
    let messages = await dbUnified.read('messages');
    messages = messages.filter(m => m.threadId === threadId && !m.isDraft);

    // Sort by creation time (oldest first)
    messages.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return aTime - bTime;
    });

    res.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages', details: error.message });
  }
});

/**
 * POST /api/messages/threads/:threadId/messages
 * Send a new message in a thread
 * Body: { text, isDraft? }
 */
router.post('/threads/:threadId/messages', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { threadId } = req.params;
    const { text, isDraft } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Message text is required' });
    }

    // Verify access to thread
    const threads = await dbUnified.read('threads');
    const threadIndex = threads.findIndex(t => t.id === threadId);

    if (threadIndex === -1) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const thread = threads[threadIndex];
    const hasAccess =
      userRole === 'admin' ||
      (userRole === 'customer' && thread.customerId === userId) ||
      (userRole === 'supplier' && thread.supplierId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date().toISOString();
    const messages = await dbUnified.read('messages');

    const newMessage = {
      id: uid(),
      threadId,
      fromUserId: userId,
      fromRole: userRole,
      text: text.trim(),
      isDraft: isDraft === true,
      sentAt: isDraft ? null : now,
      readBy: [userId], // Sender has already "read" their own message
      createdAt: now,
      updatedAt: now,
    };

    messages.push(newMessage);
    await dbUnified.write('messages', messages);

    // Update thread if not a draft
    if (!isDraft) {
      thread.lastMessageAt = now;
      thread.lastMessagePreview = text.trim().substring(0, 100);
      thread.updatedAt = now;

      // Increment unread count for the recipient
      if (!thread.unreadCount) {
        thread.unreadCount = {};
      }
      const recipientId = userRole === 'customer' ? thread.supplierId : thread.customerId;
      thread.unreadCount[recipientId] = (thread.unreadCount[recipientId] || 0) + 1;

      threads[threadIndex] = thread;
      await dbUnified.write('threads', threads);
    }

    res.status(201).json({ message: newMessage });
  } catch (error) {
    console.error('Error creating message:', error);
    res.status(500).json({ error: 'Failed to create message', details: error.message });
  }
});

/**
 * PUT /api/messages/:messageId
 * Update a message (for editing drafts)
 * Body: { text, isDraft? }
 */
router.put('/:messageId', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;
    const { text, isDraft } = req.body;

    const messages = await dbUnified.read('messages');
    const messageIndex = messages.findIndex(m => m.id === messageId);

    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messages[messageIndex];

    // Only the sender can edit their message
    if (message.fromUserId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only drafts can be edited
    if (!message.isDraft) {
      return res.status(400).json({ error: 'Only draft messages can be edited' });
    }

    const now = new Date().toISOString();

    if (text !== undefined) {
      message.text = text.trim();
    }

    if (isDraft === false) {
      // Convert draft to sent message
      message.isDraft = false;
      message.sentAt = now;

      // Update thread
      const threads = await dbUnified.read('threads');
      const threadIndex = threads.findIndex(t => t.id === message.threadId);
      if (threadIndex !== -1) {
        const thread = threads[threadIndex];
        thread.lastMessageAt = now;
        thread.lastMessagePreview = message.text.substring(0, 100);
        thread.updatedAt = now;

        // Increment unread count for the recipient
        if (!thread.unreadCount) {
          thread.unreadCount = {};
        }
        const userRole = req.user.role;
        const recipientId = userRole === 'customer' ? thread.supplierId : thread.customerId;
        thread.unreadCount[recipientId] = (thread.unreadCount[recipientId] || 0) + 1;

        threads[threadIndex] = thread;
        await dbUnified.write('threads', threads);
      }
    }

    message.updatedAt = now;
    messages[messageIndex] = message;
    await dbUnified.write('messages', messages);

    res.json({ message });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message', details: error.message });
  }
});

/**
 * POST /api/messages/threads/:threadId/mark-read
 * Mark all messages in a thread as read for the current user
 */
router.post('/threads/:threadId/mark-read', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { threadId } = req.params;

    // Verify access to thread
    const threads = await dbUnified.read('threads');
    const threadIndex = threads.findIndex(t => t.id === threadId);

    if (threadIndex === -1) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    const thread = threads[threadIndex];
    const hasAccess =
      userRole === 'admin' ||
      (userRole === 'customer' && thread.customerId === userId) ||
      (userRole === 'supplier' && thread.supplierId === userId);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Mark all messages as read
    const messages = await dbUnified.read('messages');
    let updatedCount = 0;

    messages.forEach((message, index) => {
      if (message.threadId === threadId && !message.isDraft) {
        if (!message.readBy) {
          message.readBy = [];
        }
        if (!message.readBy.includes(userId)) {
          message.readBy.push(userId);
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      await dbUnified.write('messages', messages);
    }

    // Reset unread count for this user
    if (thread.unreadCount && thread.unreadCount[userId]) {
      thread.unreadCount[userId] = 0;
      threads[threadIndex] = thread;
      await dbUnified.write('threads', threads);
    }

    res.json({ success: true, markedRead: updatedCount });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read', details: error.message });
  }
});

/**
 * GET /api/messages/drafts
 * Get all draft messages for the current user
 */
router.get('/drafts', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    let messages = await dbUnified.read('messages');
    messages = messages.filter(m => m.fromUserId === userId && m.isDraft === true);

    // Sort by updated time (most recent first)
    messages.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt).getTime();
      return bTime - aTime;
    });

    res.json({ drafts: messages });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    res.status(500).json({ error: 'Failed to fetch drafts', details: error.message });
  }
});

/**
 * DELETE /api/messages/:messageId
 * Delete a draft message
 */
router.delete('/:messageId', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const { messageId } = req.params;

    const messages = await dbUnified.read('messages');
    const messageIndex = messages.findIndex(m => m.id === messageId);

    if (messageIndex === -1) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const message = messages[messageIndex];

    // Only the sender can delete their message
    if (message.fromUserId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only drafts can be deleted
    if (!message.isDraft) {
      return res.status(400).json({ error: 'Only draft messages can be deleted' });
    }

    messages.splice(messageIndex, 1);
    await dbUnified.write('messages', messages);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message', details: error.message });
  }
});

module.exports = router;
