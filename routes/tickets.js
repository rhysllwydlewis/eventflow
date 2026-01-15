/**
 * Tickets Routes
 * Handles support ticket functionality
 */

'use strict';

const express = require('express');
const { authRequired } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { writeLimiter } = require('../middleware/rateLimit');
const { featureRequired } = require('../middleware/features');
const { auditLog } = require('../middleware/audit');
const dbUnified = require('../db-unified');
const { uid } = require('../store');

const router = express.Router();

/**
 * POST /api/tickets
 * Create a new support ticket
 */
router.post(
  '/',
  featureRequired('supportTickets'),
  authRequired,
  csrfProtection,
  writeLimiter,
  async (req, res) => {
    try {
      const userId = req.user.id;
      const {
        senderId,
        senderType,
        senderName,
        senderEmail,
        subject,
        message,
        priority = 'medium',
      } = req.body;

      // Validation
      if (!subject || !message) {
        return res.status(400).json({ error: 'Subject and message are required' });
      }

      if (!senderType || !['customer', 'supplier'].includes(senderType)) {
        return res.status(400).json({ error: 'Invalid sender type' });
      }

      // Create ticket
      const now = new Date().toISOString();
      const tickets = await dbUnified.read('tickets');

      const newTicket = {
        id: uid(),
        senderId: senderId || userId,
        senderType: senderType,
        senderName: senderName || req.user.name || req.user.email,
        senderEmail: senderEmail || req.user.email,
        subject: subject,
        message: message,
        status: 'open', // 'open' | 'in_progress' | 'resolved' | 'closed'
        priority: priority, // 'low' | 'medium' | 'high'
        responses: [],
        createdAt: now,
        updatedAt: now,
      };

      tickets.push(newTicket);
      await dbUnified.write('tickets', tickets);

      // Audit log
      auditLog({
        adminId: userId,
        adminEmail: req.user.email,
        action: 'TICKET_CREATED',
        targetType: 'ticket',
        targetId: newTicket.id,
        details: { subject, priority },
      });

      res.status(201).json({ ticketId: newTicket.id, ticket: newTicket });
    } catch (error) {
      console.error('Error creating ticket:', error);
      res.status(500).json({ error: 'Failed to create ticket', details: error.message });
    }
  }
);

/**
 * GET /api/tickets
 * Get all tickets for the current user
 */
router.get('/', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { status } = req.query;

    let tickets = await dbUnified.read('tickets');

    // Filter based on user role
    if (userRole === 'customer') {
      tickets = tickets.filter(t => t.senderId === userId && t.senderType === 'customer');
    } else if (userRole === 'supplier') {
      tickets = tickets.filter(t => t.senderId === userId && t.senderType === 'supplier');
    } else if (userRole === 'admin') {
      // Admins can see all tickets
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Filter by status if provided
    if (status) {
      tickets = tickets.filter(t => t.status === status);
    }

    // Sort by creation date (newest first)
    tickets.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });

    res.json({ tickets });
  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets', details: error.message });
  }
});

/**
 * GET /api/tickets/:id
 * Get a specific ticket by ID
 */
router.get('/:id', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;

    const tickets = await dbUnified.read('tickets');
    const ticket = tickets.find(t => t.id === id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check access permissions
    const hasAccess =
      userRole === 'admin' || (ticket.senderId === userId && ticket.senderType === userRole);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ ticket });
  } catch (error) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({ error: 'Failed to fetch ticket', details: error.message });
  }
});

/**
 * PUT /api/tickets/:id
 * Update a ticket (status, add responses)
 */
router.put('/:id', authRequired, csrfProtection, writeLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;
    const { status, response } = req.body;

    const tickets = await dbUnified.read('tickets');
    const ticketIndex = tickets.findIndex(t => t.id === id);

    if (ticketIndex === -1) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = tickets[ticketIndex];

    // Check access permissions
    const hasAccess =
      userRole === 'admin' || (ticket.senderId === userId && ticket.senderType === userRole);

    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const now = new Date().toISOString();

    // Update status if provided (admins only)
    if (status && userRole === 'admin') {
      if (!['open', 'in_progress', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }
      ticket.status = status;
    }

    // Add response if provided
    if (response && response.trim()) {
      if (!ticket.responses) {
        ticket.responses = [];
      }
      ticket.responses.push({
        id: uid(),
        userId: userId,
        userName: req.user.name || req.user.email,
        userRole: userRole,
        message: response.trim(),
        createdAt: now,
      });
    }

    ticket.updatedAt = now;
    tickets[ticketIndex] = ticket;
    await dbUnified.write('tickets', tickets);

    // Audit log
    auditLog({
      adminId: userId,
      adminEmail: req.user.email,
      action: 'TICKET_UPDATED',
      targetType: 'ticket',
      targetId: ticket.id,
      details: { status, hasResponse: !!response },
    });

    res.json({ ticket });
  } catch (error) {
    console.error('Error updating ticket:', error);
    res.status(500).json({ error: 'Failed to update ticket', details: error.message });
  }
});

/**
 * DELETE /api/tickets/:id
 * Delete a ticket (admins only)
 */
router.delete('/:id', authRequired, csrfProtection, writeLimiter, async (req, res) => {
  try {
    const userRole = req.user.role;
    const { id } = req.params;

    // Only admins can delete tickets
    if (userRole !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete tickets' });
    }

    const tickets = await dbUnified.read('tickets');
    const ticketIndex = tickets.findIndex(t => t.id === id);

    if (ticketIndex === -1) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const ticket = tickets[ticketIndex];
    tickets.splice(ticketIndex, 1);
    await dbUnified.write('tickets', tickets);

    // Audit log
    auditLog({
      adminId: req.user.id,
      adminEmail: req.user.email,
      action: 'TICKET_DELETED',
      targetType: 'ticket',
      targetId: ticket.id,
      details: { subject: ticket.subject },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting ticket:', error);
    res.status(500).json({ error: 'Failed to delete ticket', details: error.message });
  }
});

module.exports = router;
