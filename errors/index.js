/**
 * Error Classes Index
 * Central export point for all custom error classes
 */

'use strict';

const BaseError = require('./BaseError');
const ValidationError = require('./ValidationError');
const AuthenticationError = require('./AuthenticationError');
const AuthorizationError = require('./AuthorizationError');
const NotFoundError = require('./NotFoundError');
const ConflictError = require('./ConflictError');
const InternalError = require('./InternalError');

module.exports = {
  BaseError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  InternalError,
};
