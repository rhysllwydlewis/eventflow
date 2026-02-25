/**
 * Analytics Routes
 * Lightweight event tracking for user behavior analytics
 */

'use strict';

const express = require('express');
const logger = require('../utils/logger');
const router = express.Router();
const dbUnified = require('../db-unified');
const { getUserFromCookie, authRequired } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const { writeLimiter } = require('../middleware/rateLimits');
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
    await dbUnified.insertOne('analyticsEvents', analyticsEvent);

    // Keep only last N events to prevent unbounded growth in local storage
    // Configurable via env var, defaults to 10000
    const maxEvents = parseInt(process.env.MAX_ANALYTICS_EVENTS, 10) || 10000;
    if (analyticsEvents.length > maxEvents) {
      // Trim the oldest events - in MongoDB this is handled by TTL indexes
      analyticsEvents.splice(0, analyticsEvents.length - maxEvents);
      await dbUnified.write('analyticsEvents', analyticsEvents);
    }

    // Respond immediately (don't block on write)
    res.json({
      success: true,
      message: 'Event tracked',
    });
  } catch (error) {
    // Fail silently - analytics should never break UX
    logger.debug('Analytics tracking error:', error);
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
    logger.error('Get analytics events error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve analytics events',
    });
  }
});

/**
 * POST /api/analytics/lead-score (P4-04: Predictive Lead Scoring)
 * Calculate lead quality score for an enquiry
 */
router.post('/lead-score', authRequired, csrfProtection, async (req, res) => {
  try {
    const { enquiry } = req.body;

    if (!enquiry) {
      return res.status(400).json({ error: 'Enquiry data is required' });
    }

    let score = 0;
    const scoreBreakdown = {};

    // Message length (more detailed = higher intent)
    if (enquiry.message) {
      const messageLength = enquiry.message.length;
      if (messageLength > 200) {
        score += 20;
        scoreBreakdown.messageLength = { points: 20, reason: 'Detailed message (>200 chars)' };
      } else if (messageLength > 100) {
        score += 10;
        scoreBreakdown.messageLength = { points: 10, reason: 'Moderate message length' };
      } else {
        scoreBreakdown.messageLength = { points: 0, reason: 'Short message' };
      }
    }

    // Budget specified
    if (enquiry.budget) {
      score += 15;
      scoreBreakdown.budget = { points: 15, reason: 'Budget specified' };
    }

    // Event date specified (ready to book)
    if (enquiry.eventDate) {
      score += 25;
      scoreBreakdown.eventDate = { points: 25, reason: 'Event date provided' };

      // Urgency bonus (event within 3 months)
      const eventDate = new Date(enquiry.eventDate);
      const threeMonthsFromNow = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
      if (eventDate < threeMonthsFromNow) {
        score += 10;
        scoreBreakdown.urgency = { points: 10, reason: 'Event within 3 months' };
      }
    }

    // Response time (enquiry recency - how long ago was it created)
    if (enquiry.createdAt) {
      const hoursSinceCreation = (Date.now() - new Date(enquiry.createdAt)) / (1000 * 60 * 60);

      if (hoursSinceCreation < 1) {
        score += 30;
        scoreBreakdown.enquiryRecency = { points: 30, reason: 'Very recent enquiry (<1 hour)' };
      } else if (hoursSinceCreation < 24) {
        score += 20;
        scoreBreakdown.enquiryRecency = { points: 20, reason: 'Recent enquiry (<24 hours)' };
      } else {
        score += 5;
        scoreBreakdown.enquiryRecency = { points: 5, reason: 'Older enquiry' };
      }
    }

    // Previous interactions (repeat customer)
    if (enquiry.isRepeatCustomer) {
      score += 20;
      scoreBreakdown.repeatCustomer = { points: 20, reason: 'Returning customer' };
    }

    // Guest count specified (shows planning)
    if (enquiry.guests) {
      score += 5;
      scoreBreakdown.guestCount = { points: 5, reason: 'Guest count provided' };
    }

    // Venue/location specified
    if (enquiry.location || enquiry.venue) {
      score += 5;
      scoreBreakdown.location = { points: 5, reason: 'Location/venue specified' };
    }

    // Cap score at 100
    score = Math.min(score, 100);

    // Determine quality tier
    let quality = 'low';
    if (score >= 70) {
      quality = 'high';
    } else if (score >= 40) {
      quality = 'medium';
    }

    res.json({
      success: true,
      leadScore: score,
      quality,
      scoreBreakdown,
      recommendations: getLeadRecommendations(score, quality, enquiry),
    });
  } catch (error) {
    logger.error('Lead scoring error:', error);
    res.status(500).json({ error: 'Failed to calculate lead score', details: error.message });
  }
});

/**
 * Get recommendations based on lead score
 */
function getLeadRecommendations(score, quality, enquiry) {
  const recommendations = [];

  if (quality === 'high') {
    recommendations.push('Priority response recommended - high conversion potential');
    recommendations.push('Offer premium packages or personalized service');
  } else if (quality === 'medium') {
    recommendations.push('Follow up within 24 hours');
    recommendations.push('Request more details to qualify further');
  } else {
    recommendations.push('Standard response timeframe acceptable');
    recommendations.push('Send informational materials and FAQ');
  }

  // Specific recommendations based on missing data
  if (!enquiry.budget) {
    recommendations.push('Ask about budget to better qualify');
  }
  if (!enquiry.eventDate) {
    recommendations.push('Request event date to assess urgency');
  }
  if (!enquiry.guests) {
    recommendations.push('Inquire about guest count for package matching');
  }

  return recommendations;
}

module.exports = router;
