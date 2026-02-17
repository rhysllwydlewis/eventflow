/**
 * Folders API Routes
 * RESTful endpoints for custom message folders
 */

'use strict';

const express = require('express');
const { ObjectId } = require('mongodb');
const { writeLimiter } = require('../middleware/rateLimits');

// Dependencies injected by server.js
let authRequired;
let csrfProtection;
let logger;
let mongoDb;

const router = express.Router();

// Service will be initialized when MongoDB is available
let folderService;

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  if (!deps) {
    throw new Error('Folders routes: dependencies object is required');
  }

  const required = ['authRequired', 'csrfProtection', 'logger', 'mongoDb'];
  const missing = required.filter(key => deps[key] === undefined);
  if (missing.length > 0) {
    throw new Error(`Folders routes: missing required dependencies: ${missing.join(', ')}`);
  }

  authRequired = deps.authRequired;
  csrfProtection = deps.csrfProtection;
  logger = deps.logger;
  mongoDb = deps.mongoDb;

  // Initialize service
  const FolderService = require('../services/FolderService');
  folderService = new FolderService(mongoDb);
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
 */
function ensureServices(req, res, next) {
  if (!folderService) {
    return res.status(503).json({
      error: 'Service unavailable',
      message: 'Folder service not initialized',
    });
  }
  next();
}

// =========================
// Folder CRUD Operations
// =========================

/**
 * POST /api/v2/folders
 * Create a new folder
 */
router.post('/', writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, parentId, color, icon, settings } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }

    const folder = await folderService.createFolder(userId, name, parentId, {
      color,
      icon,
      settings,
    });

    logger.info('Folder created via API', { userId, folderId: folder._id.toString() });

    res.status(201).json({
      success: true,
      folder,
    });
  } catch (error) {
    logger.error('Create folder API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to create folder',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/folders
 * List all folders for current user
 */
router.get('/', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { tree } = req.query;

    let folders;
    if (tree === 'true') {
      folders = await folderService.getFolderTree(userId);
    } else {
      folders = await folderService.getUserFolders(userId);
    }

    res.json({
      success: true,
      folders,
      count: Array.isArray(folders) ? folders.length : 0,
    });
  } catch (error) {
    logger.error('Get folders API error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to fetch folders',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/folders/initialize
 * Initialize system folders for current user
 */
router.post("/initialize", writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;

    const folders = await folderService.initializeSystemFolders(userId);

    logger.info('System folders initialized via API', { userId, count: folders.length });

    res.json({
      success: true,
      message: 'System folders initialized',
      folders,
      count: folders.length,
    });
  } catch (error) {
    logger.error('Initialize folders API error', { error: error.message, userId: req.user.id });
    res.status(500).json({
      error: 'Failed to initialize folders',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/folders/:id
 * Get folder details
 */
router.get('/:id', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const folder = await folderService.getFolder(userId, id);

    res.json({
      success: true,
      folder,
    });
  } catch (error) {
    logger.error('Get folder API error', { error: error.message, userId: req.user.id });
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      error: 'Failed to fetch folder',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v2/folders/:id
 * Update folder
 */
router.put("/:id", writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const updates = req.body;

    const folder = await folderService.updateFolder(userId, id, updates);

    logger.info('Folder updated via API', { userId, folderId: id });

    res.json({
      success: true,
      folder,
    });
  } catch (error) {
    logger.error('Update folder API error', { error: error.message, userId: req.user.id });
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({
      error: 'Failed to update folder',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v2/folders/:id
 * Delete folder (soft delete)
 */
router.delete("/:id", writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const folder = await folderService.deleteFolder(userId, id);

    logger.info('Folder deleted via API', { userId, folderId: id });

    res.json({
      success: true,
      message: 'Folder deleted successfully',
      folder,
    });
  } catch (error) {
    logger.error('Delete folder API error', { error: error.message, userId: req.user.id });
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({
      error: 'Failed to delete folder',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/folders/:id/restore
 * Restore deleted folder
 */
router.post("/:id/restore", writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const folder = await folderService.restoreFolder(userId, id);

    logger.info('Folder restored via API', { userId, folderId: id });

    res.json({
      success: true,
      message: 'Folder restored successfully',
      folder,
    });
  } catch (error) {
    logger.error('Restore folder API error', { error: error.message, userId: req.user.id });
    const status = error.message.includes('not found') ? 404 : 400;
    res.status(status).json({
      error: 'Failed to restore folder',
      message: error.message,
    });
  }
});

// =========================
// Folder Operations
// =========================

/**
 * POST /api/v2/folders/:id/move
 * Move folder to new parent
 */
router.post("/:id/move", writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { newParentId } = req.body;

    const folder = await folderService.moveFolder(userId, id, newParentId);

    logger.info('Folder moved via API', { userId, folderId: id, newParentId });

    res.json({
      success: true,
      message: 'Folder moved successfully',
      folder,
    });
  } catch (error) {
    logger.error('Move folder API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to move folder',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/folders/reorder
 * Reorder multiple folders
 */
router.post('/reorder', writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { folders } = req.body;

    if (!folders || !Array.isArray(folders)) {
      return res.status(400).json({ error: 'folders array is required' });
    }

    const result = await folderService.reorderFolders(userId, folders);

    logger.info('Folders reordered via API', { userId, count: result.modifiedCount });

    res.json({
      success: true,
      message: `${result.modifiedCount} folder(s) reordered`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    logger.error('Reorder folders API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to reorder folders',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/folders/:id/messages
 * Move messages to folder
 */
router.post('/:id/messages', writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const { messageIds } = req.body;

    if (!messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ error: 'messageIds array is required' });
    }

    const result = await folderService.moveMessagesToFolder(userId, messageIds, id);

    logger.info('Messages moved to folder via API', {
      userId,
      folderId: id,
      count: result.modifiedCount,
    });

    res.json({
      success: true,
      message: `${result.modifiedCount} message(s) moved successfully`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    logger.error('Move messages to folder API error', {
      error: error.message,
      userId: req.user.id,
    });
    res.status(400).json({
      error: 'Failed to move messages',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/folders/:id/empty
 * Empty folder (delete all messages)
 */
router.post("/:id/empty", writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await folderService.emptyFolder(userId, id);

    logger.info('Folder emptied via API', { userId, folderId: id, count: result.deletedCount });

    res.json({
      success: true,
      message: `${result.deletedCount} message(s) deleted`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    logger.error('Empty folder API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to empty folder',
      message: error.message,
    });
  }
});

/**
 * GET /api/v2/folders/:id/stats
 * Get folder statistics
 */
router.get('/:id/stats', applyAuthRequired, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const stats = await folderService.getFolderStats(userId, id);

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('Get folder stats API error', { error: error.message, userId: req.user.id });
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({
      error: 'Failed to fetch folder stats',
      message: error.message,
    });
  }
});

// =========================
// Folder Rules
// =========================

/**
 * POST /api/v2/folders/:id/rules
 * Create a folder rule
 */
router.post("/:id/rules", writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const rule = req.body;

    if (!rule.name || !rule.condition) {
      return res.status(400).json({ error: 'Rule name and condition are required' });
    }

    const newRule = await folderService.createRule(userId, id, rule);

    logger.info('Folder rule created via API', { userId, folderId: id });

    res.status(201).json({
      success: true,
      rule: newRule,
    });
  } catch (error) {
    logger.error('Create rule API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to create rule',
      message: error.message,
    });
  }
});

/**
 * PUT /api/v2/folders/:id/rules/:ruleId
 * Update a folder rule
 */
router.put("/:id/rules/:ruleId", writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, ruleId } = req.params;
    const updates = req.body;

    const folder = await folderService.updateRule(userId, id, ruleId, updates);

    logger.info('Folder rule updated via API', { userId, folderId: id, ruleId });

    res.json({
      success: true,
      folder,
    });
  } catch (error) {
    logger.error('Update rule API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to update rule',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/v2/folders/:id/rules/:ruleId
 * Delete a folder rule
 */
router.delete("/:id/rules/:ruleId", writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, ruleId } = req.params;

    const folder = await folderService.deleteRule(userId, id, ruleId);

    logger.info('Folder rule deleted via API', { userId, folderId: id, ruleId });

    res.json({
      success: true,
      message: 'Rule deleted successfully',
      folder,
    });
  } catch (error) {
    logger.error('Delete rule API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to delete rule',
      message: error.message,
    });
  }
});

/**
 * POST /api/v2/folders/:id/rules/:ruleId/test
 * Test a folder rule
 */
router.post("/:id/rules/:ruleId/test", writeLimiter, applyAuthRequired, applyCsrfProtection, ensureServices, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id, ruleId } = req.params;

    const result = await folderService.testRule(userId, id, ruleId);

    res.json({
      success: true,
      result,
    });
  } catch (error) {
    logger.error('Test rule API error', { error: error.message, userId: req.user.id });
    res.status(400).json({
      error: 'Failed to test rule',
      message: error.message,
    });
  }
});

// Export router and initialization function
module.exports = router;
module.exports.initializeDependencies = initializeDependencies;
