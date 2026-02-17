/**
 * MongoDB Helper Utilities
 * Transaction and operation helpers for MongoDB
 */

'use strict';

const logger = require('./logger');

/**
 * Execute a function within a MongoDB transaction
 * Automatically handles commit/rollback
 *
 * @param {Object} db - MongoDB database instance
 * @param {Function} operation - Async function to execute with session
 * @returns {Promise<any>} Result from operation
 */
async function withTransaction(db, operation) {
  // Check if we have access to the MongoDB client for sessions
  const client = db.client || db.s?.client;

  if (!client) {
    logger.warn('MongoDB client not available for transactions, executing without transaction');
    // Execute without transaction if client not available
    return await operation(null);
  }

  const session = client.startSession();

  try {
    await session.startTransaction();

    const result = await operation(session);

    await session.commitTransaction();

    return result;
  } catch (error) {
    await session.abortTransaction();
    logger.error('Transaction aborted', { error: error.message });
    throw error;
  } finally {
    await session.endSession();
  }
}

/**
 * Validate ObjectId and throw error if invalid
 * @param {string} id - ID to validate
 * @param {string} fieldName - Name of field for error message
 * @throws {Error} If ID is invalid
 */
function validateObjectId(id, fieldName = 'ID') {
  const { isValidObjectId } = require('./validators');

  if (!id) {
    throw new Error(`${fieldName} is required`);
  }

  if (!isValidObjectId(id)) {
    throw new Error(`Invalid ${fieldName} format`);
  }
}

/**
 * Validate multiple ObjectIds
 * @param {Object} ids - Object with id fields to validate
 * @throws {Error} If any ID is invalid
 */
function validateObjectIds(ids) {
  for (const [fieldName, id] of Object.entries(ids)) {
    if (id !== null && id !== undefined) {
      validateObjectId(id, fieldName);
    }
  }
}

/**
 * Create pagination parameters from request query
 * @param {Object} query - Request query object
 * @param {number} defaultLimit - Default items per page
 * @param {number} maxLimit - Maximum items per page
 * @returns {Object} Pagination parameters (page, limit, skip)
 */
function getPaginationParams(query, defaultLimit = 25, maxLimit = 100) {
  const { validatePagination } = require('./validators');

  const page = parseInt(query.page, 10) || 1;
  const limit = parseInt(query.limit, 10) || defaultLimit;

  const result = validatePagination(page, limit, maxLimit);

  if (!result.isValid) {
    throw new Error(result.error);
  }

  return {
    page: result.page,
    limit: result.limit,
    skip: result.skip,
  };
}

/**
 * Build sort parameters from request query
 * @param {Object} query - Request query object
 * @param {Object} allowedFields - Map of allowed sort fields
 * @param {Object} defaultSort - Default sort order
 * @returns {Object} MongoDB sort object
 */
function getSortParams(query, allowedFields, defaultSort = { createdAt: -1 }) {
  if (!query.sortBy) {
    return defaultSort;
  }

  const sortField = query.sortBy;
  const sortOrder = query.sortOrder === 'asc' ? 1 : -1;

  if (!allowedFields[sortField]) {
    throw new Error(`Invalid sort field: ${sortField}`);
  }

  return { [allowedFields[sortField]]: sortOrder };
}

module.exports = {
  withTransaction,
  validateObjectId,
  validateObjectIds,
  getPaginationParams,
  getSortParams,
};
