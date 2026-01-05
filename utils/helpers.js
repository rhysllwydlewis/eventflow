/**
 * Helper Functions
 * Common utility functions used across the application
 */

'use strict';

const path = require('path');
const fs = require('fs');

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
function generateUid() {
  const { uid } = require('../store');
  return uid();
}

/**
 * Check if supplier's Pro plan is currently active
 * @param {Object} supplier - Supplier object
 * @returns {boolean} True if Pro plan is active
 */
function supplierIsProActive(supplier) {
  if (!supplier || !supplier.isPro) {
    return false;
  }
  if (!supplier.proExpiresAt) {
    return !!supplier.isPro;
  }
  const t = Date.parse(supplier.proExpiresAt);
  if (!t || isNaN(t)) {
    return !!supplier.isPro;
  }
  return t > Date.now();
}

/**
 * Ensure directory exists
 * @param {string} dir - Directory path
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load and process email template
 * @param {string} templateName - Template name (without .html)
 * @param {Object} data - Template data
 * @returns {string|null} Processed HTML or null if not found
 */
function loadEmailTemplate(templateName, data) {
  const logger = require('./logger');
  try {
    const templatePath = path.join(__dirname, '..', 'email-templates', `${templateName}.html`);
    if (!fs.existsSync(templatePath)) {
      return null;
    }
    let html = fs.readFileSync(templatePath, 'utf8');

    // Simple template replacement
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, data[key] || '');
    });

    // Add current year
    html = html.replace(/{{year}}/g, new Date().getFullYear());

    // Add base URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    html = html.replace(/{{baseUrl}}/g, baseUrl);

    return html;
  } catch (err) {
    logger.error('Error loading email template:', err);
    return null;
  }
}

/**
 * Format date to readable string
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
function formatDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) {
    return 'Invalid Date';
  }
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format currency
 * @param {number} amount - Amount in cents or smallest unit
 * @param {string} currency - Currency code (default: GBP)
 * @returns {string} Formatted currency
 */
function formatCurrency(amount, currency = 'GBP') {
  const formatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency,
  });
  return formatter.format(amount / 100);
}

/**
 * Sleep/delay function
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Truncate string
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length
 * @returns {string} Truncated string
 */
function truncate(str, length = 100) {
  if (typeof str !== 'string') {
    return '';
  }
  if (str.length <= length) {
    return str;
  }
  return `${str.substring(0, length)}...`;
}

/**
 * Parse pagination parameters
 * @param {Object} query - Query parameters
 * @returns {Object} Pagination params {page, limit, skip}
 */
function parsePaginationParams(query) {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

module.exports = {
  generateUid,
  supplierIsProActive,
  ensureDir,
  loadEmailTemplate,
  formatDate,
  formatCurrency,
  sleep,
  truncate,
  parsePaginationParams,
};
