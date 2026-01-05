const express = require('express');
const path = require('path');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Rate limiter for static pages (lenient - 100 requests per 15 minutes)
const staticPageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests, please try again later.',
});

// Import sub-routes (will be expanded in future iterations)
// These routes are already extracted in the routes/ directory
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const messagesRoutes = require('./messages');
const paymentsRoutes = require('./payments');
const pexelsRoutes = require('./pexels');
const profileRoutes = require('./profile');
const reportsRoutes = require('./reports');
const ticketsRoutes = require('./tickets');
const webhooksRoutes = require('./webhooks');

// Mount API sub-routes
router.use('/api/auth', authRoutes);
router.use('/api/admin', adminRoutes);
router.use('/api/messages', messagesRoutes);
router.use('/api/payments', paymentsRoutes);
router.use('/api/pexels', pexelsRoutes);
router.use('/api/profile', profileRoutes);
router.use('/api/reports', reportsRoutes);
router.use('/api/tickets', ticketsRoutes);
router.use('/api/webhooks', webhooksRoutes);

// Static HTML pages (main public pages)
const staticPages = [
  { route: '/marketplace', file: 'marketplace.html' },
  { route: '/verify', file: 'verify.html' },
];

staticPages.forEach(({ route, file }) => {
  router.get(route, staticPageLimiter, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', file));
  });
});

module.exports = router;
