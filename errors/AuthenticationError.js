/**
 * AuthenticationError Class
 * Used for authentication failures (401 Unauthorized)
 */

'use strict';

const BaseError = require('./BaseError');

class AuthenticationError extends BaseError {
  constructor(message) {
    super(message, 401);
  }
}

module.exports = AuthenticationError;
