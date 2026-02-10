/**
 * Middleware Index
 * Central export point for all middleware modules
 */

'use strict';

const auth = require('./auth');
const security = require('./security');
const errorHandler = require('./errorHandler');
const validation = require('./validation');
const rateLimits = require('./rateLimits');
const csrf = require('./csrf');
const apiVersioning = require('./api-versioning');
const pagination = require('./pagination');
const compression = require('./compression');
const logging = require('./logging');
const sanitize = require('./sanitize');
const maintenance = require('./maintenance');
const audit = require('./audit');
const token = require('./token');
const cache = require('./cache');

module.exports = {
  // Authentication & Authorization
  ...auth,

  // Security
  ...security,

  // Error Handling
  ...errorHandler,

  // Validation
  ...validation,

  // Rate Limiting
  ...rateLimits,

  // CSRF Protection
  ...csrf,

  // API Versioning
  ...apiVersioning,

  // Pagination
  ...pagination,

  // Compression
  compression,

  // Logging
  ...logging,

  // Sanitization
  ...sanitize,

  // Maintenance
  ...maintenance,

  // Audit
  ...audit,

  // Token
  ...token,

  // Cache
  ...cache,
};
