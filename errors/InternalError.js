/**
 * InternalError Class
 * Used for internal server errors (500 Internal Server Error)
 */

'use strict';

const BaseError = require('./BaseError');

class InternalError extends BaseError {
  constructor(message) {
    super(message, 500);
  }
}

module.exports = InternalError;
