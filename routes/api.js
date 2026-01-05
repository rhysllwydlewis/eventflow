/**
 * General API Routes
 * Contains all API routes not in specialized route files
 * (auth, admin, messages, payments, pexels, profile, reports, tickets, webhooks)
 */

'use strict';

const express = require('express');
const router = express.Router();

// Dependencies will be injected by server.js to avoid circular dependencies
let dependencies = {};

/**
 * Initialize dependencies from server.js
 * @param {Object} deps - Dependencies object
 */
function initializeDependencies(deps) {
  dependencies = deps;
}

// Export both router and initialization function
module.exports = router;
module.exports.initializeDependencies = initializeDependencies;

// Import route modules after dependencies are set
// Routes will be added here
