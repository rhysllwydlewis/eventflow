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
const shortlistRoutes = require('./shortlist');
const quoteRequestsRoutes = require('./quote-requests');
const analyticsRoutes = require('./analytics');
const plansRoutes = require('./plans');
const guestsRoutes = require('./guests');
const savedRoutes = require('./saved');
const supplierRoutes = require('./supplier');

// New extracted route modules
const suppliersRoutes = require('./suppliers');
const categoriesRoutes = require('./categories');
const plansLegacyRoutes = require('./plans-legacy');
const threadsRoutes = require('./threads');
const marketplaceRoutes = require('./marketplace');
const discoveryRoutes = require('./discovery');
const searchRoutes = require('./search');
const reviewsRoutes = require('./reviews');
const photosRoutes = require('./photos');
const metricsRoutes = require('./metrics');
const cacheRoutes = require('./cache');
const miscRoutes = require('./misc');

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

  // Reviews routes (public endpoint at /api/reviews for homepage testimonials)
  // Note: /api/v2/reviews is mounted separately in server.js for v2 API endpoints
  app.use('/api/reviews', reviewsV2Routes);

  // Tickets routes
  app.use('/api/tickets', ticketsRoutes);

  // Webhook routes
  app.use('/api/webhooks', webhooksRoutes);

  // Search V2 routes (advanced search with caching and analytics)
  app.use('/api/v2/search', searchV2Routes);

  // Shortlist routes (user favorites)
  app.use('/api/shortlist', shortlistRoutes);

  // Quote request routes (customer to supplier inquiries)
  app.use('/api/quote-requests', quoteRequestsRoutes);

  // Analytics routes (event tracking)
  app.use('/api/analytics', analyticsRoutes);

  // Plans routes (user wedding/event plans)
  app.use('/api/me/plans', plansRoutes);

  // Guests routes (guest list management for plans)
  app.use('/api/me/plans', guestsRoutes);

  // Saved items routes (user favorites)
  app.use('/api/me/saved', savedRoutes);

  // Supplier routes (trial activation, analytics)
  app.use('/api/supplier', supplierRoutes);

  // ===== NEW EXTRACTED ROUTES (from server.js refactor) =====

  // Suppliers & Packages routes (Phase 1)
  if (deps && suppliersRoutes.initializeDependencies) {
    suppliersRoutes.initializeDependencies(deps);
  }
  app.use('/api', suppliersRoutes);

  // Categories routes (Phase 2)
  if (deps && categoriesRoutes.initializeDependencies) {
    categoriesRoutes.initializeDependencies(deps);
  }
  app.use('/api/categories', categoriesRoutes);

  // Plans Legacy & Notes routes (Phase 3)
  if (deps && plansLegacyRoutes.initializeDependencies) {
    plansLegacyRoutes.initializeDependencies(deps);
  }
  app.use('/api', plansLegacyRoutes);

  // Threads routes (Phase 4)
  if (deps && threadsRoutes.initializeDependencies) {
    threadsRoutes.initializeDependencies(deps);
  }
  app.use('/api/threads', threadsRoutes);

  // Marketplace routes (Phase 4)
  if (deps && marketplaceRoutes.initializeDependencies) {
    marketplaceRoutes.initializeDependencies(deps);
  }
  app.use('/api/marketplace', marketplaceRoutes);

  // Discovery routes (Phase 5)
  if (deps && discoveryRoutes.initializeDependencies) {
    discoveryRoutes.initializeDependencies(deps);
  }
  app.use('/api/discovery', discoveryRoutes);

  // Search routes (Phase 5)
  if (deps && searchRoutes.initializeDependencies) {
    searchRoutes.initializeDependencies(deps);
  }
  app.use('/api/search', searchRoutes);

  // Reviews routes (Phase 5)
  if (deps && reviewsRoutes.initializeDependencies) {
    reviewsRoutes.initializeDependencies(deps);
  }
  app.use('/api', reviewsRoutes);

  // Photos routes (Phase 6)
  if (deps && photosRoutes.initializeDependencies) {
    photosRoutes.initializeDependencies(deps);
  }
  app.use('/api', photosRoutes);

  // Metrics routes (Phase 7)
  if (deps && metricsRoutes.initializeDependencies) {
    metricsRoutes.initializeDependencies(deps);
  }
  app.use('/api', metricsRoutes);

  // Cache routes (Phase 7)
  if (deps && cacheRoutes.initializeDependencies) {
    cacheRoutes.initializeDependencies(deps);
  }
  app.use('/api/admin/cache', cacheRoutes);
  app.use('/api/admin', cacheRoutes); // For /database/metrics route

  // Miscellaneous routes (Phase 7)
  if (deps && miscRoutes.initializeDependencies) {
    miscRoutes.initializeDependencies(deps);
  }
  app.use('/api', miscRoutes);
}

module.exports = {
  router,
  mountRoutes,
};
