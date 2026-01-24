/**
 * Routes Index
 * Main router mounting point for all application routes
 */

'use strict';

const express = require('express');
const router = express.Router();

// Import route modules
const systemRoutes = require('./system');
const publicRoutes = require('./public');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const messagesRoutes = require('./messages');
const newsletterRoutes = require('./newsletter');
const paymentsRoutes = require('./payments');
const pexelsRoutes = require('./pexels');
const profileRoutes = require('./profile');
const reportsRoutes = require('./reports');
const reviewsV2Routes = require('./reviews-v2');
const ticketsRoutes = require('./tickets');
const webhooksRoutes = require('./webhooks');
const searchV2Routes = require('./search-v2');

/**
 * Mount all route modules
 * @param {Object} app - Express app instance
 * @param {Object} deps - Dependencies to inject into routes
 */
function mountRoutes(app, deps) {
  // System routes (health, config, meta) - must be first for health checks
  if (deps) {
    systemRoutes.initializeDependencies(deps);
  }
  app.use('/api', systemRoutes);

  // Public routes (no auth required) - mount early to avoid auth middleware
  app.use('/api/public', publicRoutes);

  // Auth routes (registration, login, logout, etc.)
  app.use('/api/auth', authRoutes);

  // Admin routes
  app.use('/api/admin', adminRoutes);

  // Messages routes
  app.use('/api/messages', messagesRoutes);

  // Newsletter routes (public, no auth required)
  app.use('/api/newsletter', newsletterRoutes);

  // Payment routes
  app.use('/api/payments', paymentsRoutes);

  // Pexels image search routes
  app.use('/api/pexels', pexelsRoutes);

  // Profile routes
  app.use('/api/profile', profileRoutes);

  // Reports routes
  app.use('/api/reports', reportsRoutes);

  // Reviews V2 routes (includes public endpoint for homepage testimonials)
  app.use('/api/reviews', reviewsV2Routes);
  app.use('/api/v2/reviews', reviewsV2Routes);

  // Tickets routes
  app.use('/api/tickets', ticketsRoutes);

  // Webhook routes
  app.use('/api/webhooks', webhooksRoutes);

  // Search V2 routes (advanced search with caching and analytics)
  app.use('/api/v2/search', searchV2Routes);
}

module.exports = {
  router,
  mountRoutes,
};
