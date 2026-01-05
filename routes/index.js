const express = require('express');
const path = require('path');
const router = express.Router();

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
  router.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, '../public', file));
  });
});

module.exports = router;
