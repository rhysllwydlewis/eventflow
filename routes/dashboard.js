/**
 * Dashboard & Admin Page Routes
 * Handles dashboard redirects and admin page routes
 */

'use strict';

const express = require('express');
const path = require('path');
const { authRequired, roleRequired } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * GET /dashboard/customer
 * Serve customer dashboard HTML page
 */
router.get('/dashboard/customer', authLimiter, authRequired, roleRequired('customer'), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard-customer.html'));
});

/**
 * GET /dashboard/supplier
 * Serve supplier dashboard HTML page
 */
router.get('/dashboard/supplier', authLimiter, authRequired, roleRequired('supplier'), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard-supplier.html'));
});

/**
 * GET /admin
 * Serve admin dashboard HTML page
 */
router.get('/admin', authLimiter, authRequired, roleRequired('admin'), (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

module.exports = router;
