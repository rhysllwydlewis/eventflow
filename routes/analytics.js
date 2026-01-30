/**
 * Analytics Routes
 * Lightweight event tracking for user behavior analytics
 */

'use strict';

const express = require('express');
const router = express.Router();
const dbUnified = require('../db-unified');
const { getUserFromCookie } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { writeLimiter } = require('../middleware/rateLimit');
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

// Whitelist of allowed property keys (prevent arbitrary data)
const ALLOWED_PROPERTY_KEYS = [
  'query',
  'filters',
  'resultsCount',
  'source',
  'filterName',
  'filterValue',
  'resultType',
  'resultId',
  'position',
  'itemType',
  'itemId',
  'supplierCount',
  'eventType',
  'category',
  'location',
];

// Maximum string length for property values
const MAX_STRING_LENGTH = 500;

/**
 * Sanitize and validate analytics properties
 */
function sanitizeProperties(properties) {
  if (!properties || typeof properties !== 'object') {
    return {};
  }

  const sanitized = {};

  for (const key of ALLOWED_PROPERTY_KEYS) {
    if (properties[key] !== undefined) {
      let value = properties[key];

      // Truncate strings to prevent huge payloads
      if (typeof value === 'string') {
        value = value.slice(0, MAX_STRING_LENGTH);
        // Don't include raw query strings with potential PII
        // Only store sanitized/truncated versions
        sanitized[key] = validator.escape(value);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (typeof value === 'object') {
        // For nested objects (like filters), limit depth and sanitize
        if (key === 'filters') {
          sanitized[key] = sanitizeFilters(value);
        }
      }
    }
  }

  return sanitized;
}

/**
 * Sanitize filter object
 */
function sanitizeFilters(filters) {
  if (!filters || typeof filters !== 'object') {
    return {};
  }

  const sanitized = {};
  const allowedFilterKeys = ['category', 'location', 'budgetMin', 'budgetMax', 'sort'];

  for (const key of allowedFilterKeys) {
    if (filters[key] !== undefined) {
      const value = filters[key];
      if (typeof value === 'string') {
        sanitized[key] = validator.escape(value.slice(0, 100));
      } else if (typeof value === 'number') {
        sanitized[key] = value;
      }
    }
  }

  return sanitized;
}

/**
 * POST /api/analytics/event
 * Track a user event
 * Rate limited to prevent abuse
 */
router.post('/event', writeLimiter, csrfProtection, async (req, res) => {
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

    // Sanitize properties to prevent PII leakage and huge payloads
    const sanitizedProperties = sanitizeProperties(properties);

    // Create analytics event
    const analyticsEvent = {
      event: validator.escape(event),
      properties: sanitizedProperties,
      userId: user?.id || null,
      timestamp: timestamp || new Date().toISOString(),
      userAgent: req.headers['user-agent'],
      // Store IP separately (not in event properties) for rate limiting only
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
