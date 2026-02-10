/**
 * ConflictError Class
 * Used for resource conflict errors (409 Conflict)
 */

'use strict';

const BaseError = require('./BaseError');

class ConflictError extends BaseError {
  constructor(message) {
    super(message, 409);
  }
}

module.exports = ConflictError;
