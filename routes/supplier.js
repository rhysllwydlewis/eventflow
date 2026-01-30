/**
 * Supplier Routes
 * Handles supplier-specific functionality (trial activation, analytics, etc.)
 */

'use strict';

const express = require('express');
const { authRequired } = require('../middleware/auth');
const { csrfProtection } = require('../middleware/csrf');
const dbUnified = require('../db-unified');

const router = express.Router();

/**
 * POST /api/supplier/trial/activate
 * Activate free trial for supplier
 */
router.post('/trial/activate', authRequired, csrfProtection, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a supplier
    if (req.user.role !== 'supplier') {
      return res.status(403).json({ error: 'Only suppliers can activate trials' });
    }

    // Get supplier record
    const suppliers = await dbUnified.read('suppliers');
    const supplierIndex = suppliers.findIndex(s => s.ownerUserId === userId);

    if (supplierIndex === -1) {
      return res.status(404).json({ error: 'Supplier profile not found' });
    }

    const supplier = suppliers[supplierIndex];

    // Check if trial already used
    if (supplier.trialUsed) {
      return res.status(400).json({ error: 'Trial has already been used' });
    }

    // Check if already on trial or active subscription
    if (supplier.subscriptionStatus === 'trial' || supplier.subscriptionStatus === 'active') {
      return res.status(400).json({ error: 'Already on an active subscription or trial' });
    }

    // Set trial
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days

    supplier.subscriptionStatus = 'trial';
    supplier.trialStartedAt = now.toISOString();
    supplier.trialEndsAt = trialEndsAt.toISOString();
    supplier.trialUsed = true;
    supplier.updatedAt = now.toISOString();

    suppliers[supplierIndex] = supplier;
    await dbUnified.write('suppliers', suppliers);

    res.json({
      success: true,
      message: 'Trial activated successfully',
      trial: {
        status: 'trial',
        startedAt: supplier.trialStartedAt,
        endsAt: supplier.trialEndsAt,
        daysRemaining: 14,
      },
    });
  } catch (error) {
    console.error('Error activating trial:', error);
    res.status(500).json({ error: 'Failed to activate trial', details: error.message });
  }
});

/**
 * GET /api/supplier/analytics
 * Get real analytics for supplier
 */
router.get('/analytics', authRequired, async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user is a supplier
    if (req.user.role !== 'supplier') {
      return res.status(403).json({ error: 'Only suppliers can access analytics' });
    }

    // Get supplier record
    const suppliers = await dbUnified.read('suppliers');
    const supplier = suppliers.find(s => s.ownerUserId === userId);

    if (!supplier) {
      return res.status(404).json({ error: 'Supplier profile not found' });
    }

    const supplierId = supplier.id;

    // Count enquiries from message threads
    const threads = await dbUnified.read('threads');
    const enquiries = threads.filter(t => t.supplierId === supplierId);
    const enquiryCount = enquiries.length;

    // Count views from analytics events
    const analyticsEvents = await dbUnified.read('analyticsEvents');
    const viewEvents = analyticsEvents.filter(
      e => e.event === 'supplier_view' && e.supplierId === supplierId
    );
    const viewCount = viewEvents.length;

    // Count bookings (from bookings or orders)
    let bookingCount = 0;
    try {
      const bookings = await dbUnified.read('bookings');
      bookingCount = bookings.filter(b => b.supplierId === supplierId).length;
    } catch (e) {
      // bookings collection may not exist
    }

    // Generate chart data for last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const last30DaysViews = viewEvents.filter(e => {
      const eventDate = new Date(e.timestamp || e.createdAt);
      return eventDate >= thirtyDaysAgo;
    });

    const last30DaysEnquiries = enquiries.filter(e => {
      const eventDate = new Date(e.createdAt);
      return eventDate >= thirtyDaysAgo;
    });

    // Group by date
    const viewsByDate = {};
    const enquiriesByDate = {};

    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      viewsByDate[dateKey] = 0;
      enquiriesByDate[dateKey] = 0;
    }

    last30DaysViews.forEach(e => {
      const dateKey = new Date(e.timestamp || e.createdAt).toISOString().split('T')[0];
      if (viewsByDate[dateKey] !== undefined) {
        viewsByDate[dateKey]++;
      }
    });

    last30DaysEnquiries.forEach(e => {
      const dateKey = new Date(e.createdAt).toISOString().split('T')[0];
      if (enquiriesByDate[dateKey] !== undefined) {
        enquiriesByDate[dateKey]++;
      }
    });

    // Convert to chart data format
    const dates = Object.keys(viewsByDate).sort();
    const chartData = dates.map(date => ({
      date,
      views: viewsByDate[date],
      enquiries: enquiriesByDate[date],
    }));

    // Calculate conversion rate
    const conversionRate = viewCount > 0 ? ((enquiryCount / viewCount) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      analytics: {
        enquiries: enquiryCount,
        views: viewCount,
        bookings: bookingCount,
        conversionRate: parseFloat(conversionRate),
        chartData: chartData.reverse(), // Most recent first
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics', details: error.message });
  }
});

module.exports = router;
