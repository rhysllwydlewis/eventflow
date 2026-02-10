/**
 * AuthorizationError Class
 * Used for authorization/permission failures (403 Forbidden)
 */

'use strict';

const BaseError = require('./BaseError');

class AuthorizationError extends BaseError {
  constructor(message) {
    super(message, 403);
  }
}

module.exports = AuthorizationError;
