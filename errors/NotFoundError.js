/**
 * NotFoundError Class
 * Used for resource not found errors (404 Not Found)
 */

'use strict';

const BaseError = require('./BaseError');

class NotFoundError extends BaseError {
  constructor(message) {
    super(message, 404);
  }
}

module.exports = NotFoundError;
