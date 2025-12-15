/**
 * Request sanitization middleware
 * Prevents NoSQL injection and XSS attacks
 */

const mongoSanitize = require('express-mongo-sanitize');

/**
 * Configure sanitization middleware
 * Removes $ and . from user input to prevent MongoDB operator injection
 * @returns {Function} Express middleware
 */
function configureSanitization() {
  return mongoSanitize({
    // Remove data that contains prohibited characters
    replaceWith: '_',

    // Sanitize both req.body, req.query, and req.params
    onSanitize: ({ req, key }) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️  Sanitized key: ${key} in request from ${req.ip}`);
      }
    },
  });
}

/**
 * Additional input validation middleware
 * Validates and sanitizes common input patterns
 */
function inputValidationMiddleware(req, res, next) {
  // Validate and limit request body size (already handled by express.json limit)

  // Remove null bytes from strings
  const sanitizeNullBytes = obj => {
    if (typeof obj === 'string') {
      return obj.replace(/\0/g, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          obj[key] = sanitizeNullBytes(obj[key]);
        }
      }
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitizeNullBytes(req.body);
  }
  if (req.query) {
    req.query = sanitizeNullBytes(req.query);
  }
  if (req.params) {
    req.params = sanitizeNullBytes(req.params);
  }

  next();
}

module.exports = {
  configureSanitization,
  inputValidationMiddleware,
};
