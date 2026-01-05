/**
 * Stripe Configuration
 * Handles Stripe client initialization
 */

'use strict';

const logger = require('../utils/logger');

let STRIPE_ENABLED = false;
let stripeClient = null;

/**
 * Initialize Stripe client
 * Lazy-loads Stripe library to avoid errors if not configured
 */
function initializeStripe() {
  try {
    const secret = process.env.STRIPE_SECRET_KEY;
    if (secret) {
      // Lazy-load Stripe so the app still runs if the dependency is missing
      // eslint-disable-next-line global-require, node/no-missing-require
      const stripeLib = require('stripe');
      stripeClient = stripeLib(secret);
      STRIPE_ENABLED = true;
      logger.info('✅ Stripe: Configured');
    } else {
      logger.info('ℹ️  Stripe: Not configured (optional)');
    }
  } catch (err) {
    logger.warn('Stripe is not configured:', err.message);
  }

  return STRIPE_ENABLED;
}

/**
 * Get Stripe client instance
 * @returns {Object|null} Stripe client or null if not configured
 */
function getStripeClient() {
  return stripeClient;
}

/**
 * Check if Stripe is enabled
 * @returns {boolean} True if Stripe is configured
 */
function isStripeEnabled() {
  return STRIPE_ENABLED;
}

module.exports = {
  initializeStripe,
  getStripeClient,
  isStripeEnabled,
};
