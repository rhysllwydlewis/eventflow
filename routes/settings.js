/**
 * User Settings Routes
 * Handles user notification preferences and settings
 */

'use strict';

const express = require('express');
const { authRequired } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const dbUnified = require('../db-unified');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/me/settings
 * Get user notification settings
 */
router.get('/', authRequired, async (req, res) => {
  try {
    const users = await dbUnified.read('users');
    const i = users.findIndex(u => u.id === req.user.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json({ notify: users[i].notify !== false });
  } catch (error) {
    logger.error('Error fetching user settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

/**
 * POST /api/me/settings
 * Update user notification settings
 */
router.post('/', authRequired, csrfProtection, async (req, res) => {
  try {
    const users = await dbUnified.read('users');
    const i = users.findIndex(u => u.id === req.user.id);
    if (i < 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    users[i].notify = !!(req.body && req.body.notify);
    await dbUnified.write('users', users);
    res.json({ ok: true, notify: users[i].notify });
  } catch (error) {
    logger.error('Error updating user settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
