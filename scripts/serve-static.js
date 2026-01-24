#!/usr/bin/env node

/**
 * Lightweight static server for E2E tests
 * Serves the /public directory with a stub /api/health endpoint
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

// Stub /api/health endpoint for Playwright health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', mode: 'static' });
});

// Serve homepage
app.get('/', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Redirect non-canonical index URL to canonical
app.get('/index.html', (req, res) => {
  res.redirect(301, '/');
});

// Serve marketplace page
app.get('/marketplace', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'marketplace.html'));
});

// Redirect non-canonical marketplace URL to canonical
app.get('/marketplace.html', (req, res) => {
  res.redirect(301, '/marketplace');
});

// Serve suppliers page
app.get('/suppliers', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'suppliers.html'));
});

// Redirect non-canonical suppliers URL to canonical
app.get('/suppliers.html', (req, res) => {
  res.redirect(301, '/suppliers');
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
