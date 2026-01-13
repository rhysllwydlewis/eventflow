/**
 * Pagination Utilities
 * Standard pagination response formatting for API endpoints
 */

'use strict';

/**
 * Format a paginated response with metadata
 * @param {Array} data - Array of items for current page
 * @param {Object} options - Pagination options
 * @param {number} options.page - Current page number
 * @param {number} options.limit - Items per page
 * @param {number} options.total - Total number of items
 * @param {Object} [options.meta] - Additional metadata
 * @returns {Object} Formatted response with data and pagination metadata
 */
function paginatedResponse(data, options) {
  const { page = 1, limit = 30, total = 0, meta = {} } = options;

  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    data,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total: parseInt(total, 10),
      pages: totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
    },
    ...meta,
  };
}

/**
 * Express middleware to parse pagination parameters from query string
 * Adds parsed values to req.pagination
 * @param {Object} defaults - Default values for pagination
 * @returns {Function} Express middleware
 */
function parsePaginationQuery(defaults = {}) {
  const defaultPage = defaults.page || 1;
  const defaultLimit = defaults.limit || 30;
  const maxLimit = defaults.maxLimit || 100;

  return (req, res, next) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || defaultPage);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit, 10) || defaultLimit));
    const skip = (page - 1) * limit;

    req.pagination = {
      page,
      limit,
      skip,
      maxLimit,
    };

    next();
  };
}

/**
 * Calculate pagination metadata from array
 * @param {Array} items - Full array of items
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} Paginated data and metadata
 */
function paginateArray(items, page = 1, limit = 30) {
  const total = items.length;
  const start = (page - 1) * limit;
  const end = start + limit;
  const data = items.slice(start, end);

  return paginatedResponse(data, { page, limit, total });
}

module.exports = {
  paginatedResponse,
  parsePaginationQuery,
  paginateArray,
};
