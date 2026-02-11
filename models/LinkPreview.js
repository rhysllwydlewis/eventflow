/**
 * LinkPreview Model
 * MongoDB schema for caching link preview metadata
 */

'use strict';

const { ObjectId } = require('mongodb');

/**
 * LinkPreview Schema
 * Stores cached metadata for URLs in messages
 */
const LinkPreviewSchema = {
  _id: ObjectId,
  url: String, // Original URL
  normalizedUrl: String, // Normalized URL for deduplication
  title: String, // Page title
  description: String, // Meta description
  image: String, // Preview image URL
  siteName: String, // Site name (Open Graph)
  favicon: String, // Site favicon
  mediaType: String, // 'article', 'video', 'image', etc.
  metadata: Object, // Additional Open Graph/Twitter Card data
  fetchedAt: Date, // When metadata was fetched
  expiresAt: Date, // When cache expires (30 days)
  fetchError: String, // Error if fetch failed
  createdAt: Date,
};

/**
 * Collection name
 */
const COLLECTION = 'linkPreviews';

/**
 * Cache TTL in days
 */
const CACHE_TTL_DAYS = 30;

/**
 * Create indexes for optimal query performance
 */
async function createIndexes(db) {
  const collection = db.collection(COLLECTION);

  // Unique index on normalized URL
  await collection.createIndex({ normalizedUrl: 1 }, { unique: true });
  // Index for cleanup of expired entries
  await collection.createIndex({ expiresAt: 1 });
  // Index for statistics and monitoring
  await collection.createIndex({ createdAt: -1 });

  console.log('✅ LinkPreview indexes created');
}

/**
 * Normalize URL for consistent caching
 */
function normalizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);
    // Remove trailing slashes, fragments, and tracking parameters
    parsed.hash = '';
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
    trackingParams.forEach((param) => parsed.searchParams.delete(param));

    let normalized = parsed.toString();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    return normalized.toLowerCase();
  } catch (error) {
    return null;
  }
}

/**
 * Validate link preview data
 */
function validateLinkPreview(data) {
  const errors = [];

  if (!data.url) {
    errors.push('url is required');
  }

  const normalized = normalizeUrl(data.url);
  if (!normalized) {
    errors.push('Invalid URL format');
  }

  return errors.length > 0 ? errors : null;
}

/**
 * Create a new link preview entry
 */
function createLinkPreview(data) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

  return {
    _id: new ObjectId(),
    url: data.url,
    normalizedUrl: normalizeUrl(data.url),
    title: data.title || '',
    description: data.description || '',
    image: data.image || '',
    siteName: data.siteName || '',
    favicon: data.favicon || '',
    mediaType: data.mediaType || 'website',
    metadata: data.metadata || {},
    fetchedAt: now,
    expiresAt: expiresAt,
    fetchError: data.fetchError || null,
    createdAt: now,
  };
}

/**
 * Extract URLs from message content
 */
function extractUrls(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  // Match URLs (http/https)
  const urlRegex = /https?:\/\/[^\s<>"]+/gi;
  const matches = content.match(urlRegex);

  if (!matches) {
    return [];
  }

  // Remove duplicates and normalize
  const urls = matches
    .map((url) => {
      // Remove trailing punctuation
      return url.replace(/[.,;!?]+$/, '');
    })
    .filter((url) => normalizeUrl(url)); // Only valid URLs

  return [...new Set(urls)];
}

module.exports = {
  LinkPreviewSchema,
  COLLECTION,
  CACHE_TTL_DAYS,
  createIndexes,
  normalizeUrl,
  validateLinkPreview,
  createLinkPreview,
  extractUrls,
};
