/**
 * Search Service
 * Advanced search functionality with query parsing and operators
 */

'use strict';

const logger = require('../utils/logger');
const { COLLECTIONS: MESSAGE_COLLECTIONS } = require('../models/Message');

class SearchService {
  constructor(db) {
    this.db = db;
    this.messagesCollection = db.collection(MESSAGE_COLLECTIONS.MESSAGES);
    this.threadsCollection = db.collection(MESSAGE_COLLECTIONS.THREADS);
  }

  /**
   * Parse search query with operators
   * Supported operators:
   * - from:email@example.com
   * - to:email@example.com
   * - subject:keyword
   * - body:keyword
   * - before:2025-01-01
   * - after:2025-01-01
   * - is:read/unread/starred/archived
   * - has:attachment
   * - folder:FolderName
   * - label:LabelName
   * - larger:10mb
   * - smaller:1mb
   *
   * @param {string} queryString - Search query
   * @returns {Object} Parsed query object
   */
  parseQuery(queryString) {
    const query = {
      filters: {},
      textSearch: [],
      operators: [],
    };

    if (!queryString || typeof queryString !== 'string') {
      return query;
    }

    // Extract operators and text
    const operatorPattern = /(\w+):(?:"([^"]+)"|(\S+))/g;
    let match;
    let lastIndex = 0;

    while ((match = operatorPattern.exec(queryString)) !== null) {
      // Add text before this operator
      if (match.index > lastIndex) {
        const text = queryString.substring(lastIndex, match.index).trim();
        if (text) {
          query.textSearch.push(text);
        }
      }

      const operator = match[1].toLowerCase();
      const value = match[2] || match[3]; // Quoted or unquoted value

      query.operators.push({ operator, value });

      lastIndex = operatorPattern.lastIndex;
    }

    // Add remaining text after last operator
    if (lastIndex < queryString.length) {
      const text = queryString.substring(lastIndex).trim();
      if (text) {
        query.textSearch.push(text);
      }
    }

    // Build MongoDB filter from operators
    this.buildFiltersFromOperators(query);

    return query;
  }

  /**
   * Build MongoDB filters from parsed operators
   * @param {Object} query - Parsed query object
   */
  buildFiltersFromOperators(query) {
    for (const { operator, value } of query.operators) {
      switch (operator) {
        case 'from':
          query.filters.senderId = value;
          break;

        case 'to':
          query.filters.recipientIds = value;
          break;

        case 'subject':
          // Subject is in metadata
          query.filters['metadata.subject'] = {
            $regex: value,
            $options: 'i',
          };
          break;

        case 'body':
        case 'text':
          // Add to text search
          query.textSearch.push(value);
          break;

        case 'before':
          query.filters.createdAt = query.filters.createdAt || {};
          query.filters.createdAt.$lt = new Date(value);
          break;

        case 'after':
          query.filters.createdAt = query.filters.createdAt || {};
          query.filters.createdAt.$gt = new Date(value);
          break;

        case 'date': {
          // Exact date (start and end of day)
          const startDate = new Date(value);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(value);
          endDate.setHours(23, 59, 59, 999);
          query.filters.createdAt = {
            $gte: startDate,
            $lte: endDate,
          };
          break;
        }

        case 'older': {
          // Relative date (e.g., "30d" means older than 30 days)
          const olderDays = this.parseDuration(value);
          if (olderDays) {
            const olderDate = new Date();
            olderDate.setDate(olderDate.getDate() - olderDays);
            query.filters.createdAt = query.filters.createdAt || {};
            query.filters.createdAt.$lt = olderDate;
          }
          break;
        }

        case 'newer': {
          // Relative date (e.g., "7d" means newer than 7 days)
          const newerDays = this.parseDuration(value);
          if (newerDays) {
            const newerDate = new Date();
            newerDate.setDate(newerDate.getDate() - newerDays);
            query.filters.createdAt = query.filters.createdAt || {};
            query.filters.createdAt.$gt = newerDate;
          }
          break;
        }

        case 'is':
          this.applyStatusFilter(query, value.toLowerCase());
          break;

        case 'has':
          if (value === 'attachment' || value === 'file') {
            query.filters.attachments = { $exists: true, $ne: [] };
          } else if (value === 'image') {
            query.filters['attachments.type'] = 'image';
          } else if (value === 'document') {
            query.filters['attachments.type'] = 'document';
          }
          break;

        case 'filename':
          query.filters['attachments.filename'] = {
            $regex: value.replace(/\*/g, '.*'),
            $options: 'i',
          };
          break;

        case 'larger': {
          const largerBytes = this.parseSize(value);
          if (largerBytes) {
            query.filters['attachments.size'] = { $gt: largerBytes };
          }
          break;
        }

        case 'smaller': {
          const smallerBytes = this.parseSize(value);
          if (smallerBytes) {
            query.filters['attachments.size'] = {
              ...(query.filters['attachments.size'] || {}),
              $lt: smallerBytes,
            };
          }
          break;
        }

        case 'folder':
          // Search by folder name or ID
          query.filters.$or = query.filters.$or || [];
          query.filters.$or.push(
            { folderId: value },
            { folderName: { $regex: value, $options: 'i' } }
          );
          break;

        case 'label':
          // Search by label ID or name
          query.filters.labels = value;
          break;

        case 'thread':
          query.filters.threadId = value;
          break;
      }
    }
  }

  /**
   * Apply status filters (is:read, is:unread, etc.)
   * @param {Object} query - Query object
   * @param {string} status - Status value
   */
  applyStatusFilter(query, status) {
    switch (status) {
      case 'read':
        query.filters.readBy = { $exists: true, $ne: [] };
        break;

      case 'unread':
        query.filters.$or = query.filters.$or || [];
        query.filters.$or.push({ readBy: { $exists: false } }, { readBy: { $size: 0 } });
        break;

      case 'starred':
      case 'flagged':
        query.filters.isStarred = true;
        break;

      case 'archived':
        query.filters.isArchived = true;
        break;

      case 'sent':
        query.filters.isDraft = false;
        break;

      case 'draft':
        query.filters.isDraft = true;
        break;
    }
  }

  /**
   * Parse duration string (e.g., "30d", "2w", "6m")
   * @param {string} duration - Duration string
   * @returns {number} Days
   */
  parseDuration(duration) {
    const match = duration.match(/^(\d+)([dwmy])$/i);
    if (!match) {
      return null;
    }

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'd':
        return value;
      case 'w':
        return value * 7;
      case 'm':
        return value * 30;
      case 'y':
        return value * 365;
      default:
        return null;
    }
  }

  /**
   * Parse size string (e.g., "10mb", "1gb", "500kb")
   * @param {string} size - Size string
   * @returns {number} Bytes
   */
  parseSize(size) {
    const match = size.match(/^(\d+(?:\.\d+)?)(kb|mb|gb)$/i);
    if (!match) {
      return null;
    }

    const value = parseFloat(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'kb':
        return value * 1024;
      case 'mb':
        return value * 1024 * 1024;
      case 'gb':
        return value * 1024 * 1024 * 1024;
      default:
        return null;
    }
  }

  /**
   * Execute search
   * @param {string} userId - User ID
   * @param {string} queryString - Search query
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results
   */
  async search(userId, queryString, options = {}) {
    try {
      const { page = 1, pageSize = 25, sortBy = 'relevance' } = options;

      // Parse query
      const parsedQuery = this.parseQuery(queryString);

      // Build MongoDB query
      const mongoQuery = {
        ...parsedQuery.filters,
        $or: [{ senderId: userId }, { recipientIds: userId }],
        deletedAt: null,
      };

      // Add text search if present
      if (parsedQuery.textSearch.length > 0) {
        const textQuery = parsedQuery.textSearch.join(' ');
        mongoQuery.$text = { $search: textQuery };
      }

      // Build sort
      let sort = {};
      if (sortBy === 'relevance' && mongoQuery.$text) {
        sort = { score: { $meta: 'textScore' } };
      } else if (sortBy === 'date') {
        sort = { createdAt: -1 };
      } else if (sortBy === 'sender') {
        sort = { senderId: 1, createdAt: -1 };
      }

      // Execute query
      const skip = (page - 1) * pageSize;
      const messages = await this.messagesCollection
        .find(mongoQuery, {
          ...(mongoQuery.$text && { score: { $meta: 'textScore' } }),
        })
        .sort(sort)
        .skip(skip)
        .limit(pageSize)
        .toArray();

      // Count total results
      const totalCount = await this.messagesCollection.countDocuments(mongoQuery);

      logger.info('Search executed', {
        userId,
        query: queryString,
        resultCount: messages.length,
        totalCount,
      });

      return {
        results: messages,
        count: messages.length,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
        query: queryString,
        parsedQuery,
      };
    } catch (error) {
      logger.error('Search error', { error: error.message, userId, query: queryString });
      throw error;
    }
  }

  /**
   * Get search suggestions (autocomplete)
   * @param {string} userId - User ID
   * @param {string} prefix - Search prefix
   * @returns {Promise<Array>} Suggestions
   */
  async searchAutocomplete(userId, prefix) {
    try {
      const suggestions = [];

      // Operator suggestions
      const operators = [
        'from:',
        'to:',
        'subject:',
        'body:',
        'before:',
        'after:',
        'is:read',
        'is:unread',
        'is:starred',
        'is:archived',
        'has:attachment',
        'folder:',
        'label:',
      ];

      const matchingOperators = operators.filter(op => op.startsWith(prefix.toLowerCase()));

      suggestions.push(
        ...matchingOperators.map(op => ({
          type: 'operator',
          value: op,
          description: `Search operator: ${op}`,
        }))
      );

      return suggestions;
    } catch (error) {
      logger.error('Search autocomplete error', { error: error.message, userId, prefix });
      throw error;
    }
  }

  /**
   * Validate search query
   * @param {string} queryString - Query string
   * @returns {Object} Validation result
   */
  validateQuery(queryString) {
    const errors = [];

    if (!queryString) {
      errors.push('Query string is required');
      return { isValid: false, errors };
    }

    // Try to parse query
    try {
      this.parseQuery(queryString);
    } catch (error) {
      errors.push(`Invalid query syntax: ${error.message}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Log search for analytics
   * @param {string} userId - User ID
   * @param {string} query - Search query
   * @param {number} resultCount - Number of results
   */
  async logSearch(userId, query, resultCount) {
    try {
      // Log to analytics (could be stored in a separate collection)
      logger.info('Search logged', { userId, query, resultCount, timestamp: new Date() });
    } catch (error) {
      logger.error('Log search error', { error: error.message, userId });
    }
  }
}

module.exports = SearchService;
