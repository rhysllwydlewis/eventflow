/**
 * Search API Routes
 * Advanced search endpoints for messages
 */

'use strict';

const express = require('express');
const { searchLimiter } = require('../middleware/rateLimits');

// Dependencies injected by server.js
let authRequired;
let csrfProtection;
let logger;
let mongoDb;

const router = express.Router();

// Service will be initialized when MongoDB is available
let searchService;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Search routes: dependencies object is required');
  }

  const required = ['authRequired', 'csrfProtection', 'logger', 'mongoDb'];
  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Search routes: missing required dependencies: ${missing.join(', ')}`);
  }

  authRequired = deps.authRequired;
  csrfProtection = deps.csrfProtection;
  logger = deps.logger;
  mongoDb = deps.mongoDb;

  // Service will be initialized lazily on first request
}

/**
 * Deferred middleware wrappers
 * These are safe to reference in route definitions at require() time
 * because they defer the actual middleware call to request time,
 * when dependencies are guaranteed to be initialized.
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

/**
 * Middleware to ensure services are initialized
 * Lazily initializes the service with database instance on first request
 */
async function ensureServices(req, res, next) {
  if (!searchService && mongoDb) {
    try {
      // Get database instance (not module) and initialize service
      const SearchService = require('../services/SearchService');
      const db = await mongoDb.getDb();
      searchService = new SearchService(db);
      if (logger) {
        logger.info('Search service initialized');
      }
    } catch (error) {
      if (logger) {
        logger.error('Failed to initialize search service:', error);
      }
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Failed to initialize search service',
      });
    }
  }

  if (!searchService) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Search service not initialized',
    });
  }
  next();
}

// =========================
// Search Operations
// =========================

/**
 * GET /api/v2/search
 * Execute search query
 *
 * Query parameters:
 * - q: Search query string with operators
 * - page: Page number (default: 1)
 * - pageSize: Results per page (default: 25)
 * - sortBy: Sort method (relevance, date, sender)
 *
 * Example queries:
 * - from:john@example.com subject:meeting
 * - is:unread has:attachment
 * - after:2025-01-01 before:2025-12-31
 */
router.get('/', searchLimiter, applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q: query, page = 1, pageSize = 25, sortBy = 'relevance' } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Validate query
    const validation = searchService.validateQuery(query);
    if (!validation.isValid) {
      return res.status(400).json({
        error: 'Invalid query',
        errors: validation.errors,
      });
    }

    // Execute search
    const result = await searchService.search(userId, query, {
      page: parseInt(page, 10),
      pageSize: parseInt(pageSize, 10),
      sortBy,
    });

    // Log search for analytics
    await searchService.logSearch(userId, query, result.totalCount);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error('Search API error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Search failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/search/autocomplete
 * Get search suggestions
 *
 * Query parameters:
 * - q: Current search prefix
 */
router.get('/autocomplete', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { q: prefix } = req.query;

    if (!prefix) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const suggestions = await searchService.searchAutocomplete(userId, prefix);

    res.json({
      success: true,
      suggestions,
      count: suggestions.length,
    });
  } catch (error) {
    logger.error('Search autocomplete API error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Autocomplete failed',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/search/validate
 * Validate search query
 *
 * Body:
 * - query: Search query string
 */
router.post('/validate', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const validation = searchService.validateQuery(query);

    res.json({
      success: true,
      isValid: validation.isValid,
      errors: validation.errors,
    });
  } catch (error) {
    logger.error('Validate query API error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Validation failed',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/search/operators
 * Get list of available search operators
 */
router.get('/operators', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const operators = [
      {
        operator: 'from:',
        description: 'Search by sender email',
        example: 'from:john@example.com',
        category: 'Sender/Recipient',
      },
      {
        operator: 'to:',
        description: 'Search by recipient email',
        example: 'to:jane@example.com',
        category: 'Sender/Recipient',
      },
      {
        operator: 'subject:',
        description: 'Search in message subject',
        example: 'subject:meeting',
        category: 'Content',
      },
      {
        operator: 'body:',
        description: 'Search in message body',
        example: 'body:report',
        category: 'Content',
      },
      {
        operator: 'before:',
        description: 'Messages before date (YYYY-MM-DD)',
        example: 'before:2025-01-01',
        category: 'Date',
      },
      {
        operator: 'after:',
        description: 'Messages after date (YYYY-MM-DD)',
        example: 'after:2025-01-01',
        category: 'Date',
      },
      {
        operator: 'date:',
        description: 'Messages on specific date (YYYY-MM-DD)',
        example: 'date:2025-01-15',
        category: 'Date',
      },
      {
        operator: 'older:',
        description: 'Messages older than duration (e.g., 30d, 2w)',
        example: 'older:30d',
        category: 'Date',
      },
      {
        operator: 'newer:',
        description: 'Messages newer than duration (e.g., 7d, 1w)',
        example: 'newer:7d',
        category: 'Date',
      },
      {
        operator: 'is:',
        description: 'Filter by status (read, unread, starred, archived, sent, draft)',
        example: 'is:unread',
        category: 'Status',
      },
      {
        operator: 'has:',
        description: 'Filter by attachment type (attachment, file, image, document)',
        example: 'has:attachment',
        category: 'Attachments',
      },
      {
        operator: 'filename:',
        description: 'Search by attachment filename',
        example: 'filename:*.pdf',
        category: 'Attachments',
      },
      {
        operator: 'larger:',
        description: 'Attachments larger than size (e.g., 10mb)',
        example: 'larger:10mb',
        category: 'Attachments',
      },
      {
        operator: 'smaller:',
        description: 'Attachments smaller than size (e.g., 1mb)',
        example: 'smaller:1mb',
        category: 'Attachments',
      },
      {
        operator: 'folder:',
        description: 'Search in specific folder',
        example: 'folder:Work',
        category: 'Organization',
      },
      {
        operator: 'label:',
        description: 'Search by label',
        example: 'label:Urgent',
        category: 'Organization',
      },
      {
        operator: 'thread:',
        description: 'Search in specific thread',
        example: 'thread:abc123',
        category: 'Organization',
      },
    ];

    res.json({
      success: true,
      operators,
      count: operators.length,
    });
  } catch (error) {
    logger.error('Get operators API error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to get operators',
      message: error.message,
    });
  }
});

// Export router and initialization function
module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
