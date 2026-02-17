/**
 * Labels API Routes
 * RESTful endpoints for message labels and tags
 */

'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');

// Dependencies injected by server.js
let authRequired;
let logger;
let mongoDb;

const router = express.Router();

// Service will be initialized when MongoDB is available
let labelService;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Labels routes: dependencies object is required');
  }

  const required = ['authRequired', 'logger', 'mongoDb'];
  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Labels routes: missing required dependencies: ${missing.join(', ')}`);
  }

  authRequired = deps.authRequired;
  logger = deps.logger;
  mongoDb = deps.mongoDb;

  // Initialize service
  const LabelService = require('../services/LabelService');
  labelService = new LabelService(mongoDb);
}

/**
 * Middleware to ensure services are initialized
 */
function ensureServices(req, res, next) {
  if (!labelService) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Label service not initialized',
    });
  }
  next();
}

// Apply auth middleware to all routes
const applyAuthRequired = (req, res, next) => {
  if (authRequired) {
    return authRequired(req, res, next);
  }
  next();
};

// =========================
// Label CRUD Operations
// =========================

/**
 * POST /api/v2/labels
 * Create a new label
 */
router.post('/', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, color, backgroundColor, icon } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Label name is required' });
    }

    const label = await labelService.createLabel(userId, name, color, backgroundColor, icon);

    logger.info('Label created via API', { userId, labelId: label._id.toString() });

    res.status(201).json({
      success: true,
      label,
    });
  } catch (error) {
    logger.error('Create label API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to create label',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/labels
 * List all labels for current user
 */
router.get('/', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;

    const labels = await labelService.getUserLabels(userId);

    res.json({
      success: true,
      labels,
      count: labels.length,
    });
  } catch (error) {
    logger.error('Get labels API error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to fetch labels',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/labels/initialize
 * Initialize default labels for current user
 */
router.post('/initialize', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;

    const labels = await labelService.initializeDefaultLabels(userId);

    logger.info('Default labels initialized via API', { userId, count: labels.length });

    res.json({
      success: true,
      message: 'Default labels initialized',
      labels,
      count: labels.length,
    });
  } catch (error) {
    logger.error('Initialize labels API error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to initialize labels',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/labels/:id
 * Get label details
 */
router.get('/:id', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const label = await labelService.getLabel(userId, id);

    res.json({
      success: true,
      label,
    });
  } catch (error) {
    logger.error('Get label API error', { error: error.message, userId: req.user.id });
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      error: 'Failed to fetch label',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v2/labels/:id
 * Update label
 */
router.put('/:id', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    const label = await labelService.updateLabel(userId, id, updates);

    logger.info('Label updated via API', { userId, labelId: id });

    res.json({
      success: true,
      label,
    });
  } catch (error) {
    logger.error('Update label API error', { error: error.message, userId: req.user.id });
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({
      error: 'Failed to update label',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v2/labels/:id
 * Delete label
 */
router.delete('/:id', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await labelService.deleteLabel(userId, id);

    logger.info('Label deleted via API', { userId, labelId: id });

    res.json({
      success: true,
      message: 'Label deleted successfully',
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    logger.error('Delete label API error', { error: error.message, userId: req.user.id });
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({
      error: 'Failed to delete label',
      message: error.message,
    });
  }
});

// =========================
// Label Assignment
// =========================

/**
 * POST /api/v2/labels/:id/messages/:messageId
 * Add label to message
 */
router.post('/:id/messages/:messageId', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, messageId } = req.params;

    const result = await labelService.addLabelToMessage(userId, messageId, id);

    logger.info('Label added to message via API', { userId, labelId: id, messageId });

    res.json({
      success: true,
      message: result.alreadyApplied ? 'Label already applied' : 'Label added successfully',
      modified: result.modified || false,
    });
  } catch (error) {
    logger.error('Add label to message API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to add label',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v2/labels/:id/messages/:messageId
 * Remove label from message
 */
router.delete('/:id/messages/:messageId', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, messageId } = req.params;

    const result = await labelService.removeLabelFromMessage(userId, messageId, id);

    logger.info('Label removed from message via API', { userId, labelId: id, messageId });

    res.json({
      success: true,
      message: result.modified ? 'Label removed successfully' : 'Label was not applied',
      modified: result.modified,
    });
  } catch (error) {
    logger.error('Remove label from message API error', {
      error: error.message,
      userId: req.user.id,
    });
    res.status(400).json({
      error: 'Failed to remove label',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/labels/:id/apply-to-messages
 * Bulk apply label to messages
 */
router.post('/:id/apply-to-messages', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ error: 'messageIds array is required' });
    }

    const result = await labelService.addLabelToMessages(userId, messageIds, id);

    logger.info('Label applied to messages via API', {
      userId,
      labelId: id,
      count: result.modifiedCount,
    });

    res.json({
      success: true,
      message: `Label applied to ${result.modifiedCount} message(s)`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    logger.error('Bulk apply label API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to apply label',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/labels/:id/remove-from-messages
 * Bulk remove label from messages
 */
router.post('/:id/remove-from-messages', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ error: 'messageIds array is required' });
    }

    const result = await labelService.removeLabelFromMessages(userId, messageIds, id);

    logger.info('Label removed from messages via API', {
      userId,
      labelId: id,
      count: result.modifiedCount,
    });

    res.json({
      success: true,
      message: `Label removed from ${result.modifiedCount} message(s)`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    logger.error('Bulk remove label API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to remove label',
      message: error.message,
    });
  }
});

// =========================
// Label Management
// =========================

/**
 * POST /api/v2/labels/:id/merge
 * Merge label with another label
 */
router.post('/:id/merge', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { targetId } = req.body;

    if (!targetId) {
      return res.status(400).json({ error: 'targetId is required' });
    }

    const result = await labelService.mergeLabels(userId, id, targetId);

    logger.info('Labels merged via API', { userId, sourceId: id, targetId });

    res.json({
      success: true,
      message: `Merged "${result.sourceLabel}" into "${result.targetLabel}"`,
      mergedCount: result.mergedCount,
    });
  } catch (error) {
    logger.error('Merge labels API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to merge labels',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/labels/:id/stats
 * Get label statistics
 */
router.get('/:id/stats', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const stats = await labelService.labelStatistics(userId, id);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Get label stats API error', { error: error.message, userId: req.user.id });
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      error: 'Failed to fetch label stats',
      message: error.message,
    });
  }
});

// Export router and initialization function
module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
