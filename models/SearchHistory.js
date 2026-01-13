/**
 * Search History Schema
 * Tracks user search queries for analytics and autocomplete
 */

'use strict';

/**
 * SearchHistory Schema
 * Stores search queries, filters, and click tracking
 */
const searchHistorySchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'timestamp'],
      properties: {
        id: { bsonType: 'string', description: 'Unique search history identifier' },
        userId: { bsonType: 'string', description: 'User ID (optional for anonymous searches)' },
        sessionId: { bsonType: 'string', description: 'Session identifier for grouping searches' },
        queryText: { bsonType: 'string', description: 'Search query text' },
        filters: {
          bsonType: 'object',
          description: 'Applied search filters',
          properties: {
            category: { bsonType: 'string' },
            location: { bsonType: 'string' },
            minPrice: { bsonType: 'number' },
            maxPrice: { bsonType: 'number' },
            minRating: { bsonType: 'number' },
            amenities: {
              bsonType: 'array',
              items: { bsonType: 'string' },
            },
            proOnly: { bsonType: 'bool' },
            featuredOnly: { bsonType: 'bool' },
            verifiedOnly: { bsonType: 'bool' },
          },
        },
        resultsCount: { bsonType: 'int', description: 'Number of results returned' },
        resultClicked: { bsonType: 'string', description: 'ID of clicked result (if any)' },
        clickPosition: { bsonType: 'int', description: 'Position of clicked result (1-indexed)' },
        durationMs: { bsonType: 'int', description: 'Search execution time in milliseconds' },
        timestamp: { bsonType: 'string', description: 'Search timestamp ISO 8601' },
        userAgent: { bsonType: 'string', description: 'User agent string' },
        cached: { bsonType: 'bool', description: 'Whether result was served from cache' },
      },
    },
  },
};

/**
 * SavedSearch Schema
 * User-saved search filters for quick access
 */
const savedSearchSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'userId', 'name', 'criteria', 'createdAt'],
      properties: {
        id: { bsonType: 'string', description: 'Unique saved search identifier' },
        userId: { bsonType: 'string', description: 'User ID who saved the search' },
        name: { bsonType: 'string', description: 'User-defined name for the search' },
        description: { bsonType: 'string', description: 'Optional description' },
        criteria: {
          bsonType: 'object',
          description: 'Search criteria and filters',
          properties: {
            q: { bsonType: 'string' },
            category: { bsonType: 'string' },
            location: { bsonType: 'string' },
            minPrice: { bsonType: 'number' },
            maxPrice: { bsonType: 'number' },
            minRating: { bsonType: 'number' },
            amenities: {
              bsonType: 'array',
              items: { bsonType: 'string' },
            },
            sortBy: { bsonType: 'string' },
          },
        },
        notificationsEnabled: {
          bsonType: 'bool',
          description: 'Notify user of new matching results',
        },
        createdAt: { bsonType: 'string', description: 'Creation timestamp' },
        lastUsedAt: { bsonType: 'string', description: 'Last time this search was used' },
        useCount: { bsonType: 'int', description: 'Number of times this search was used' },
      },
    },
  },
};

/**
 * PopularSearch Schema
 * Aggregated popular search queries
 */
const popularSearchSchema = {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['id', 'queryText', 'searchCount', 'lastSearched'],
      properties: {
        id: { bsonType: 'string', description: 'Unique identifier' },
        queryText: { bsonType: 'string', description: 'Search query text' },
        normalizedQuery: { bsonType: 'string', description: 'Normalized query for grouping' },
        searchCount: { bsonType: 'int', description: 'Total number of searches' },
        uniqueUsers: { bsonType: 'int', description: 'Number of unique users' },
        clickThroughRate: { bsonType: 'double', description: 'CTR percentage' },
        avgResultsCount: { bsonType: 'double', description: 'Average number of results' },
        lastSearched: { bsonType: 'string', description: 'Last search timestamp' },
        trendScore: { bsonType: 'double', description: 'Trending score calculation' },
        category: { bsonType: 'string', description: 'Associated category (if applicable)' },
      },
    },
  },
};

module.exports = {
  searchHistorySchema,
  savedSearchSchema,
  popularSearchSchema,
};
