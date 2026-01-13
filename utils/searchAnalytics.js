/**
 * Search Analytics and Tracking
 * Tracks search behavior, aggregates metrics, and provides insights
 */

'use strict';

const dbUnified = require('../db-unified');
const cache = require('../cache');

// Constants
const TRENDING_TIME_RANGES = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

const TRENDING_MIN_SEARCHES = 5; // Minimum searches to appear in trending
const POPULAR_CACHE_TTL = 30 * 60; // 30 minutes

/**
 * Track a search query
 * @param {Object} searchData - Search tracking data
 * @returns {Promise<void>}
 */
async function trackSearch(searchData) {
  try {
    const searchHistory = (await dbUnified.read('searchHistory')) || [];

    const historyEntry = {
      id: `search_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: searchData.userId || null,
      sessionId: searchData.sessionId || null,
      queryText: searchData.queryText || '',
      filters: searchData.filters || {},
      resultsCount: searchData.resultsCount || 0,
      resultClicked: searchData.resultClicked || null,
      clickPosition: searchData.clickPosition || null,
      durationMs: searchData.durationMs || 0,
      timestamp: new Date().toISOString(),
      userAgent: searchData.userAgent || null,
      cached: searchData.cached || false,
    };

    searchHistory.push(historyEntry);

    // Keep only last 10000 entries to prevent unbounded growth
    if (searchHistory.length > 10000) {
      searchHistory.splice(0, searchHistory.length - 10000);
    }

    await dbUnified.write('searchHistory', searchHistory);

    // Update popular searches asynchronously
    updatePopularSearches(searchData.queryText).catch(err =>
      console.error('Failed to update popular searches:', err)
    );
  } catch (error) {
    console.error('Failed to track search:', error);
    // Don't throw - tracking should not break the search flow
  }
}

/**
 * Track a click on a search result
 * @param {string} searchId - Search history ID
 * @param {string} resultId - Clicked result ID
 * @param {number} position - Position in results (1-indexed)
 * @returns {Promise<void>}
 */
async function trackClick(searchId, resultId, position) {
  try {
    const searchHistory = (await dbUnified.read('searchHistory')) || [];
    const index = searchHistory.findIndex(s => s.id === searchId);

    if (index !== -1) {
      searchHistory[index].resultClicked = resultId;
      searchHistory[index].clickPosition = position;
      await dbUnified.write('searchHistory', searchHistory);
    }
  } catch (error) {
    console.error('Failed to track click:', error);
  }
}

/**
 * Update popular searches aggregation
 * @param {string} queryText - Search query
 * @returns {Promise<void>}
 */
async function updatePopularSearches(queryText) {
  if (!queryText || queryText.trim().length === 0) {
    return;
  }

  const normalizedQuery = queryText.toLowerCase().trim();
  const popularSearches = (await dbUnified.read('popularSearches')) || [];

  let popularEntry = popularSearches.find(p => p.normalizedQuery === normalizedQuery);

  if (popularEntry) {
    popularEntry.searchCount++;
    popularEntry.lastSearched = new Date().toISOString();
  } else {
    popularEntry = {
      id: `popular_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      queryText,
      normalizedQuery,
      searchCount: 1,
      uniqueUsers: 0,
      clickThroughRate: 0,
      avgResultsCount: 0,
      lastSearched: new Date().toISOString(),
      trendScore: 0,
    };
    popularSearches.push(popularEntry);
  }

  await dbUnified.write('popularSearches', popularSearches);

  // Clear popular queries cache
  await cache.del('search:popular:queries');
}

/**
 * Get popular search queries
 * @param {number} limit - Number of queries to return
 * @returns {Promise<Array>} Popular queries
 */
async function getPopularQueries(limit = 20) {
  const cacheKey = `search:popular:queries:${limit}`;

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const popularSearches = (await dbUnified.read('popularSearches')) || [];

  const popular = popularSearches
    .filter(p => p.searchCount >= TRENDING_MIN_SEARCHES)
    .sort((a, b) => b.searchCount - a.searchCount)
    .slice(0, limit)
    .map(p => ({
      text: p.queryText,
      type: 'search',
      frequency: p.searchCount,
      popular: true,
    }));

  // Cache for 30 minutes
  await cache.set(cacheKey, popular, POPULAR_CACHE_TTL);

  return popular;
}

/**
 * Get trending searches based on time range
 * @param {string} timeRange - Time range (1h, 24h, 7d, 30d)
 * @param {number} limit - Number of searches to return
 * @returns {Promise<Array>} Trending searches
 */
async function getTrendingSearches(timeRange = '24h', limit = 20) {
  const cacheKey = `search:trending:${timeRange}:${limit}`;

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const rangeMs = TRENDING_TIME_RANGES[timeRange] || TRENDING_TIME_RANGES['24h'];
  const cutoffTime = new Date(Date.now() - rangeMs).toISOString();
  const previousCutoff = new Date(Date.now() - rangeMs * 2).toISOString();

  const searchHistory = (await dbUnified.read('searchHistory')) || [];

  // Count searches in current period
  const currentPeriod = {};
  const previousPeriod = {};

  searchHistory.forEach(search => {
    const query = (search.queryText || '').toLowerCase().trim();
    if (!query) {
      return;
    }

    if (search.timestamp >= cutoffTime) {
      currentPeriod[query] = (currentPeriod[query] || 0) + 1;
    } else if (search.timestamp >= previousCutoff) {
      previousPeriod[query] = (previousPeriod[query] || 0) + 1;
    }
  });

  // Calculate trend scores
  const trending = Object.entries(currentPeriod)
    .map(([query, currentCount]) => {
      const previousCount = previousPeriod[query] || 0;
      const growthRate = previousCount > 0 ? currentCount / previousCount : currentCount;
      const trendScore = growthRate * currentCount;

      return {
        text: query,
        type: 'search',
        frequency: currentCount,
        growthRate: Math.round(growthRate * 100) / 100,
        trendScore,
        trending: growthRate > 1.5,
      };
    })
    .filter(t => t.frequency >= TRENDING_MIN_SEARCHES)
    .sort((a, b) => b.trendScore - a.trendScore)
    .slice(0, limit);

  // Cache for 10 minutes
  await cache.set(cacheKey, trending, 600);

  return trending;
}

/**
 * Get autocomplete suggestions
 * @param {string} prefix - Query prefix
 * @param {number} limit - Number of suggestions
 * @returns {Promise<Array>} Suggestions
 */
async function getAutocompleteSuggestions(prefix, limit = 10) {
  if (!prefix || prefix.length < 2) {
    return [];
  }

  const prefixLower = prefix.toLowerCase();
  const cacheKey = `search:autocomplete:${prefixLower}:${limit}`;

  // Try cache first
  const cached = await cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const suggestions = [];

  // Get from popular searches
  const popularSearches = (await dbUnified.read('popularSearches')) || [];
  const matchingSearches = popularSearches
    .filter(p => p.normalizedQuery.startsWith(prefixLower))
    .sort((a, b) => b.searchCount - a.searchCount)
    .slice(0, limit)
    .map(p => ({
      text: p.queryText,
      type: 'search',
      frequency: p.searchCount,
    }));

  suggestions.push(...matchingSearches);

  // Get from categories
  const suppliers = await dbUnified.read('suppliers');
  const categories = new Set();
  suppliers
    .filter(s => s.approved && s.category)
    .forEach(s => {
      if (s.category.toLowerCase().includes(prefixLower)) {
        categories.add(s.category);
      }
    });

  const categoryCount = {};
  suppliers.forEach(s => {
    if (categories.has(s.category)) {
      categoryCount[s.category] = (categoryCount[s.category] || 0) + 1;
    }
  });

  const categorySuggestions = Array.from(categories)
    .map(cat => ({
      text: cat,
      type: 'category',
      frequency: categoryCount[cat] || 0,
    }))
    .slice(0, 3);

  suggestions.push(...categorySuggestions);

  // Get from supplier names
  const matchingSuppliers = suppliers
    .filter(s => s.approved && s.name && s.name.toLowerCase().includes(prefixLower))
    .sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0))
    .slice(0, 3)
    .map(s => ({
      text: s.name,
      type: 'supplier',
      supplierId: s.id,
      frequency: s.reviewCount || 0,
    }));

  suggestions.push(...matchingSuppliers);

  // Sort by relevance and limit
  const sorted = suggestions
    .sort((a, b) => {
      // Prioritize exact prefix matches
      const aExact = a.text.toLowerCase().startsWith(prefixLower) ? 1 : 0;
      const bExact = b.text.toLowerCase().startsWith(prefixLower) ? 1 : 0;
      if (aExact !== bExact) {
        return bExact - aExact;
      }

      // Then by frequency
      return b.frequency - a.frequency;
    })
    .slice(0, limit);

  // Cache for 1 hour
  await cache.set(cacheKey, sorted, 3600);

  return sorted;
}

/**
 * Get search analytics for admin dashboard
 * @returns {Promise<Object>} Analytics data
 */
async function getSearchAnalytics() {
  const searchHistory = (await dbUnified.read('searchHistory')) || [];
  const popularSearches = (await dbUnified.read('popularSearches')) || [];

  // Last 24 hours
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const searches24h = searchHistory.filter(s => s.timestamp >= last24h);
  const searches7d = searchHistory.filter(s => s.timestamp >= last7d);

  // Unique users
  const uniqueUsers24h = new Set(searches24h.filter(s => s.userId).map(s => s.userId)).size;
  const uniqueUsers7d = new Set(searches7d.filter(s => s.userId).map(s => s.userId)).size;

  // Click-through rate
  const clickedSearches24h = searches24h.filter(s => s.resultClicked).length;
  const ctr24h = searches24h.length > 0 ? clickedSearches24h / searches24h.length : 0;

  // Average results
  const avgResults24h =
    searches24h.reduce((sum, s) => sum + (s.resultsCount || 0), 0) / (searches24h.length || 1);

  // Average search time
  const avgDuration24h =
    searches24h.reduce((sum, s) => sum + (s.durationMs || 0), 0) / (searches24h.length || 1);

  // Cache hit rate
  const cachedSearches24h = searches24h.filter(s => s.cached).length;
  const cacheHitRate24h = searches24h.length > 0 ? cachedSearches24h / searches24h.length : 0;

  // Top searches
  const topSearches = popularSearches
    .sort((a, b) => b.searchCount - a.searchCount)
    .slice(0, 10)
    .map(p => ({
      query: p.queryText,
      count: p.searchCount,
      lastSearched: p.lastSearched,
    }));

  // Zero result searches
  const zeroResultSearches = searches24h.filter(s => s.resultsCount === 0).length;

  return {
    overview: {
      totalSearches24h: searches24h.length,
      totalSearches7d: searches7d.length,
      uniqueUsers24h,
      uniqueUsers7d,
      avgResultsPerSearch: Math.round(avgResults24h * 10) / 10,
      avgSearchTime: Math.round(avgDuration24h),
      zeroResultSearches,
    },
    performance: {
      cacheHitRate: Math.round(cacheHitRate24h * 100),
      avgResponseTime: Math.round(avgDuration24h),
    },
    engagement: {
      clickThroughRate: Math.round(ctr24h * 100),
      searchesWithClicks: clickedSearches24h,
    },
    topSearches,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get user search behavior insights
 * @returns {Promise<Object>} User behavior data
 */
async function getUserBehaviorInsights() {
  const searchHistory = (await dbUnified.read('searchHistory')) || [];
  const last30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const recentSearches = searchHistory.filter(s => s.timestamp >= last30d);

  // Bounce rate (searches with 0 results or no clicks)
  const bounces = recentSearches.filter(
    s => s.resultsCount === 0 || (s.resultsCount > 0 && !s.resultClicked)
  ).length;
  const bounceRate = recentSearches.length > 0 ? bounces / recentSearches.length : 0;

  // Popular filters
  const filterUsage = {};
  recentSearches.forEach(s => {
    if (s.filters) {
      Object.keys(s.filters).forEach(key => {
        filterUsage[key] = (filterUsage[key] || 0) + 1;
      });
    }
  });

  // Average click position
  const clickedSearches = recentSearches.filter(s => s.clickPosition);
  const avgClickPosition =
    clickedSearches.reduce((sum, s) => sum + s.clickPosition, 0) / (clickedSearches.length || 1);

  return {
    bounceRate: Math.round(bounceRate * 100),
    avgClickPosition: Math.round(avgClickPosition * 10) / 10,
    popularFilters: Object.entries(filterUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([filter, count]) => ({ filter, count })),
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  trackSearch,
  trackClick,
  getPopularQueries,
  getTrendingSearches,
  getAutocompleteSuggestions,
  getSearchAnalytics,
  getUserBehaviorInsights,
};
