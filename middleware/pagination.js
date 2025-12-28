/**
 * Pagination Middleware
 * Provides cursor-based and offset-based pagination support
 */

'use strict';

/**
 * Parse pagination parameters from query string
 * @param {Request} req - Express request object
 * @returns {Object} Pagination parameters
 */
function parsePaginationParams(req) {
  const { page = '1', limit = '20', cursor, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  return {
    page: pageNum,
    limit: limitNum,
    skip,
    cursor: cursor || null,
    sortBy,
    sortOrder: sortOrder.toLowerCase() === 'asc' ? 1 : -1,
  };
}

/**
 * Pagination middleware - adds pagination helpers to request
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware function
 */
function paginationMiddleware(req, res, next) {
  req.pagination = parsePaginationParams(req);

  // Add helper function to response for sending paginated data
  res.paginate = function (data, total, options = {}) {
    const { page, limit } = req.pagination;
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrevious = page > 1;

    const response = {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrevious,
      },
    };

    // Add cursor information if cursor-based pagination is used
    if (options.cursor) {
      response.pagination.cursor = {
        next: hasNext ? options.cursor.next : null,
        previous: hasPrevious ? options.cursor.previous : null,
      };
    }

    // Add links for HATEOAS
    if (options.baseUrl) {
      const links = {};
      const url = new URL(options.baseUrl);

      if (hasNext) {
        url.searchParams.set('page', page + 1);
        url.searchParams.set('limit', limit);
        links.next = url.toString();
      }

      if (hasPrevious) {
        url.searchParams.set('page', page - 1);
        url.searchParams.set('limit', limit);
        links.previous = url.toString();
      }

      url.searchParams.set('page', 1);
      links.first = url.toString();

      url.searchParams.set('page', totalPages);
      links.last = url.toString();

      response.links = links;
    }

    return this.json(response);
  };

  next();
}

/**
 * Build MongoDB sort object from pagination params
 * @param {Object} pagination - Pagination parameters
 * @returns {Object} MongoDB sort object
 */
function buildSortObject(pagination) {
  return {
    [pagination.sortBy]: pagination.sortOrder,
  };
}

/**
 * Build cursor-based query for MongoDB
 * @param {string} cursor - Base64 encoded cursor
 * @param {string} sortField - Field to sort by
 * @param {number} sortOrder - Sort order (1 for asc, -1 for desc)
 * @returns {Object} MongoDB query object
 */
function buildCursorQuery(cursor, sortField, sortOrder) {
  if (!cursor) {
    return {};
  }

  try {
    const decodedCursor = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));

    const operator = sortOrder === 1 ? '$gt' : '$lt';
    return {
      [sortField]: { [operator]: decodedCursor.value },
    };
  } catch (err) {
    return {};
  }
}

/**
 * Encode cursor from document
 * @param {Object} doc - MongoDB document
 * @param {string} sortField - Field to use for cursor
 * @returns {string} Base64 encoded cursor
 */
function encodeCursor(doc, sortField) {
  if (!doc) {
    return null;
  }

  const cursorData = {
    value: doc[sortField],
    id: doc._id || doc.id,
  };

  return Buffer.from(JSON.stringify(cursorData)).toString('base64');
}

/**
 * Validate pagination parameters
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 * @param {Function} next - Next middleware function
 */
function validatePagination(req, res, next) {
  const { page, limit } = req.query;

  if (page && (isNaN(page) || parseInt(page, 10) < 1)) {
    return res.status(400).json({
      error: 'Invalid pagination parameter',
      message: 'Page must be a positive integer',
    });
  }

  if (limit && (isNaN(limit) || parseInt(limit, 10) < 1 || parseInt(limit, 10) > 100)) {
    return res.status(400).json({
      error: 'Invalid pagination parameter',
      message: 'Limit must be between 1 and 100',
    });
  }

  next();
}

module.exports = {
  paginationMiddleware,
  parsePaginationParams,
  buildSortObject,
  buildCursorQuery,
  encodeCursor,
  validatePagination,
};
