#!/usr/bin/env node

/**
 * Lightweight static server for E2E tests
 * Serves the /public directory with a stub /api/health endpoint
 *
 * NOTE: This server mirrors routing behavior from main server.js to ensure
 * E2E tests can verify canonical URL redirects. Express.static alone won't
 * provide 301 redirects - it would serve files directly without redirection.
 */

const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4173;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Disable caching for development/testing
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Add X-Robots-Tag: noindex, nofollow for private/authenticated pages
// This mirrors the behavior of middleware/seo.js in the main server
const noindexPatterns = [
  /^\/(auth|reset-password|dashboard|dashboard-customer|dashboard-supplier|messages|guests|checkout|my-marketplace-listings)(\.html)?($|\?)/,
  /^\/(admin)([-/].+)?(\.html)?($|\?)/,
];
app.use((req, res, next) => {
  const isNoindex = noindexPatterns.some(pattern => pattern.test(req.path));
  if (isNoindex) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }
  next();
});

// Stub /api/health endpoint for Playwright health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'static' });
});

// Canonical URL redirects (matching server.js behavior)
// These redirects are needed because express.static serves files directly without redirection
app.get('/index.html', (req, res) => {
  res.redirect(301, '/');
});

app.get('/marketplace', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'marketplace.html'));
});

app.get('/marketplace.html', (req, res) => {
  res.redirect(301, '/marketplace');
});

app.get('/suppliers', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'suppliers.html'));
});

app.get('/suppliers.html', (req, res) => {
  res.redirect(301, '/suppliers');
});

app.get('/messenger', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'messenger', 'index.html'));
});

app.get('/messenger/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'messenger', 'index.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'chat', 'index.html'));
});

app.get('/chat/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'chat', 'index.html'));
});

// Canonical routes for other pages (matching server.js behavior)
const canonicalPages = [
  'start',
  'blog',
  'pricing',
  'faq',
  'for-suppliers',
  'auth',
  'contact',
  'legal',
  'credits',
  'checkout',
  'privacy',
  'terms',
  'payment-success',
  'payment-cancel',
  'my-marketplace-listings',
  'budget',
  'plan',
  'settings',
  'timeline',
  'notifications',
  'guests',
  'messages',
  'category',
  'package',
];

canonicalPages.forEach(page => {
  // Serve the page at canonical URL
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, `${page}.html`));
  });
  // Redirect .html to canonical, preserving any query string
  app.get(`/${page}.html`, (req, res) => {
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    res.redirect(301, `/${page}${qs}`);
  });
});

// Serve static files from public directory
app.use(express.static(PUBLIC_DIR));

// Fallback to index.html for client-side routing
// Note: No rate-limiting needed - this is only used for E2E testing, not production
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Static server running at http://127.0.0.1:${PORT}`);
  console.log(`Serving directory: ${PUBLIC_DIR}`);
});
