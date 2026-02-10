/**
 * ValidationError Class
 * Used for input validation errors (400 Bad Request)
 */

'use strict';

const BaseError = require('./BaseError');

class ValidationError extends BaseError {
  constructor(message) {
    super(message, 400);
  }
}

module.exports = ValidationError;
