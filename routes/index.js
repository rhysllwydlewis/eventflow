/**
 * Routes Index
 * Main router mounting point for all application routes
 */

'use strict';

const express = require('express');
const router = express.Router();

// Import route modules
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const messagesRoutes = require('./messages');
const paymentsRoutes = require('./payments');
const pexelsRoutes = require('./pexels');
const profileRoutes = require('./profile');
const reportsRoutes = require('./reports');
const ticketsRoutes = require('./tickets');
const webhooksRoutes = require('./webhooks');

/**
 * Mount all route modules
 * @param {Object} app - Express app instance
 */
function mountRoutes(app) {
  // Auth routes (registration, login, logout, etc.)
  app.use('/api/auth', authRoutes);

  // Admin routes
  app.use('/api/admin', adminRoutes);

  // Messages routes
  app.use('/api/messages', messagesRoutes);

  // Payment routes
  app.use('/api/payments', paymentsRoutes);

  // Pexels image search routes
  app.use('/api/pexels', pexelsRoutes);

  // Profile routes
  app.use('/api/profile', profileRoutes);

  // Reports routes
  app.use('/api/reports', reportsRoutes);

  // Tickets routes
  app.use('/api/tickets', ticketsRoutes);

  // Webhook routes
  app.use('/api/webhooks', webhooksRoutes);
}

module.exports = {
  router,
  mountRoutes,
};
