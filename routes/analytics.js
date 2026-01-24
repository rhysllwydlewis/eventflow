/**
 * Analytics Routes
 * Lightweight event tracking for user behavior analytics
 */

'use strict';

const express = require('express');
const router = express.Router();
const dbUnified = require('../db-unified');
const { getUserFromCookie } = require('../middleware/auth');
const validator = require('validator');

// Whitelist of allowed event types
const ALLOWED_EVENTS = [
  'search_performed',
  'filter_changed',
  'result_clicked',
  'shortlist_add',
  'shortlist_remove',
  'quote_request_started',
  'quote_request_submitted',
];

/**
 * POST /api/analytics/event
 * Track a user event
 */
router.post('/event', async (req, res) => {
  try {
    const { event, properties, timestamp } = req.body;

    // Validate event type
    if (!event || !ALLOWED_EVENTS.includes(event)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid event type',
      });
    }

    // Get user if authenticated
    const user = await getUserFromCookie(req);

    // Create analytics event
    const analyticsEvent = {
      event: validator.escape(event),
      properties: properties || {},
      userId: user?.id || null,
      timestamp: timestamp || new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    };

    // Store event
    const analyticsEvents = (await dbUnified.read('analyticsEvents')) || [];
    analyticsEvents.push(analyticsEvent);

    // Keep only last N events to prevent unbounded growth
    // Configurable via env var, defaults to 10000
    const maxEvents = parseInt(process.env.MAX_ANALYTICS_EVENTS, 10) || 10000;
    if (analyticsEvents.length > maxEvents) {
      analyticsEvents.splice(0, analyticsEvents.length - maxEvents);
    }

    await dbUnified.write('analyticsEvents', analyticsEvents);

    // Respond immediately (don't block on write)
    res.json({
      success: true,
      message: 'Event tracked',
    });
  } catch (error) {
    // Fail silently - analytics should never break UX
    console.debug('Analytics tracking error:', error);
    res.json({
      success: true,
      message: 'Event received',
    });
  }
});

/**
 * GET /api/analytics/events
 * Get analytics events (admin only - will be protected by admin middleware in future)
 */
router.get('/events', async (req, res) => {
  try {
    const user = await getUserFromCookie(req);

    // Basic admin check - in production, use proper roleRequired middleware
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
      });
    }

    const limit = Math.min(Number(req.query.limit) || 100, 1000);
    const skip = Number(req.query.skip) || 0;
    const eventType = req.query.event;

    const analyticsEvents = (await dbUnified.read('analyticsEvents')) || [];
    let filteredEvents = analyticsEvents;

    // Filter by event type if specified
    if (eventType) {
      filteredEvents = filteredEvents.filter(e => e.event === eventType);
    }

    // Sort by timestamp descending
    filteredEvents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Paginate
    const paginatedEvents = filteredEvents.slice(skip, skip + limit);

    res.json({
      success: true,
      data: {
        events: paginatedEvents,
        total: filteredEvents.length,
        limit,
        skip,
      },
    });
  } catch (error) {
    console.error('Get analytics events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics events',
    });
  }
});

module.exports = router;
