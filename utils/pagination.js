/**
 * Pagination Utilities
 * Standardized pagination response format
 */

'use strict';

/**
 * Create standardized pagination metadata
 * @param {number} page - Current page (1-indexed)
 * @param {number} limit - Items per page
 * @param {number} total - Total items
 * @returns {Object} Pagination metadata
 */
function createPaginationMeta(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1;

  return {
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages,
      hasNextPage,
      hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
    },
  };
}

/**
 * Apply pagination to array
 * @param {Array} items - Items to paginate
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Items per page
 * @returns {Object} Paginated result with metadata
 */
function paginate(items, page = 1, limit = 20) {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  
  const total = items.length;
  const offset = (pageNum - 1) * limitNum;
  const paginatedItems = items.slice(offset, offset + limitNum);

  return {
    data: paginatedItems,
    ...createPaginationMeta(pageNum, limitNum, total),
  };
}

/**
 * Parse pagination params from request
 * @param {Object} query - Request query object
 * @returns {Object} Parsed pagination params
 */
function parsePaginationParams(query) {
  return {
    page: Math.max(1, parseInt(query.page, 10) || 1),
    limit: Math.max(1, Math.min(100, parseInt(query.limit, 10) || 20)),
  };
}

module.exports = {
  createPaginationMeta,
  paginate,
  parsePaginationParams,
};
