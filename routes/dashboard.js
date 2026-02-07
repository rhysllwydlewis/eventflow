/**
 * Dashboard & Admin Page Routes
 * Handles dashboard redirects and admin page routes
 */

'use strict';

const express = require('express');
const path = require('path');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /dashboard/customer
 * Redirect customer to their dashboard
 */
router.get('/dashboard/customer', authRequired, async (req, res) => {
  if (req.user.role !== 'customer') {
    return res.redirect('/auth.html');
  }
  res.redirect('/dashboard-customer.html');
});

/**
 * GET /dashboard/supplier
 * Redirect supplier to their dashboard
 */
router.get('/dashboard/supplier', authRequired, async (req, res) => {
  if (req.user.role !== 'supplier') {
    return res.redirect('/auth.html');
  }
  res.redirect('/dashboard-supplier.html');
});

/**
 * GET /admin
 * Redirect to admin dashboard
 */
router.get('/admin', authRequired, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.redirect('/auth.html');
  }
  res.redirect('/admin.html');
});

module.exports = router;
