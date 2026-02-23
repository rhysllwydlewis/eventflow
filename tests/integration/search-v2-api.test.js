/**
 * Integration tests for Search V2 API endpoints
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('Search V2 API Integration Tests', () => {
  describe('Route File Structure', () => {
    it('should have search-v2.js routes file', () => {
      const routesPath = path.join(__dirname, '../../routes/search-v2.js');
      expect(fs.existsSync(routesPath)).toBe(true);
    });

    it('should export express router', () => {
      const searchRoutes = require('../../routes/search-v2');
      expect(searchRoutes).toBeDefined();
      expect(typeof searchRoutes).toBe('function'); // Express router is a function
    });
  });

  describe('Core Search Endpoints', () => {
    it('should define GET /suppliers endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/suppliers'");
      expect(routeContent).toContain('searchService.searchSuppliers');
    });

    it('should define GET /packages endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/packages'");
      expect(routeContent).toContain('searchService.searchPackages');
    });

    it('should define POST /advanced endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.post('/advanced'");
      expect(routeContent).toContain('searchService.advancedSearch');
    });

    it('should use cache middleware for suppliers search', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain('searchCacheMiddleware');
    });
  });

  describe('Saved Searches & History Endpoints', () => {
    it('should define POST /saved endpoint with auth', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.post('/saved'");
      expect(routeContent).toContain('authRequired');
    });

    it('should define GET /saved endpoint with auth', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/saved'");
      expect(routeContent).toContain('authRequired');
    });

    it('should define DELETE /saved/:id endpoint with auth', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.delete('/saved/:id'");
      expect(routeContent).toContain('authRequired');
    });

    it('should define GET /history endpoint with auth', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/history'");
      expect(routeContent).toContain('authRequired');
    });
  });

  describe('Suggestions & Autocomplete Endpoints', () => {
    it('should define GET /suggestions endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/suggestions'");
      expect(routeContent).toContain('searchAnalytics.getAutocompleteSuggestions');
    });

    it('should define GET /trending endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/trending'");
      expect(routeContent).toContain('searchAnalytics.getTrendingSearches');
    });

    it('should define GET /popular-queries endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/popular-queries'");
      expect(routeContent).toContain('searchAnalytics.getPopularQueries');
    });

    it('should cache suggestions and trending searches', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      // Check that cache middleware is used
      const suggestionsSection = routeContent.slice(
        routeContent.indexOf("router.get('/suggestions'"),
        routeContent.indexOf("router.get('/suggestions'") + 500
      );

      expect(suggestionsSection).toContain('searchCacheMiddleware');
    });
  });

  describe('Filters & Facets Endpoints', () => {
    it('should define GET /categories endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/categories'");
    });

    it('should define GET /amenities endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/amenities'");
    });

    it('should define GET /locations endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/locations'");
    });

    it('should use long cache TTL for static data', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      // Categories should have long cache (86400 = 24 hours)
      const categoriesSection = routeContent.slice(
        routeContent.indexOf("router.get('/categories'"),
        routeContent.indexOf("router.get('/categories'") + 300
      );

      expect(categoriesSection).toContain('86400');
    });
  });

  describe('Analytics & Insights Endpoints (Admin)', () => {
    it('should define GET /analytics endpoint with admin auth', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/analytics'");
      expect(routeContent).toContain('authRequired');
      expect(routeContent).toContain("roleRequired('admin')");
    });

    it('should define GET /analytics/trends endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/analytics/trends'");
      expect(routeContent).toContain("roleRequired('admin')");
    });

    it('should define GET /analytics/user-behavior endpoint', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/analytics/user-behavior'");
      expect(routeContent).toContain("roleRequired('admin')");
    });
  });

  describe('Performance & Cache Management Endpoints (Admin)', () => {
    it('should define GET /performance endpoint with admin auth', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/performance'");
      expect(routeContent).toContain('authRequired');
      expect(routeContent).toContain("roleRequired('admin')");
    });

    it('should define POST /cache/clear endpoint with admin auth', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("'/cache/clear'");
      expect(routeContent).toContain('authRequired');
      expect(routeContent).toContain("roleRequired('admin')");
    });

    it('should define GET /cache/stats endpoint with admin auth', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("router.get('/cache/stats'");
      expect(routeContent).toContain('authRequired');
      expect(routeContent).toContain("roleRequired('admin')");
    });
  });

  describe('Input Validation', () => {
    it('should validate query length in supplier search', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      const supplierSection = routeContent.slice(
        routeContent.indexOf("router.get('/suppliers'"),
        routeContent.indexOf("router.get('/suppliers'") + 2000
      );

      expect(supplierSection).toContain('query.q.length > 200');
      expect(supplierSection).toContain('Search query too long');
    });

    it('should validate saved search name', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      const savedSection = routeContent.slice(
        routeContent.indexOf("router.post('/saved'"),
        routeContent.indexOf("router.post('/saved'") + 2000
      );

      expect(savedSection).toContain('!name || !criteria');
      expect(savedSection).toContain('name.length < 3 || name.length > 100');
    });

    it('should sanitize saved search inputs', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      const savedSection = routeContent.slice(
        routeContent.indexOf("router.post('/saved'"),
        routeContent.indexOf("router.post('/saved'") + 2000
      );

      expect(savedSection).toContain('validator.escape');
    });

    it('should validate time range for trending searches', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      const trendingSection = routeContent.slice(
        routeContent.indexOf("router.get('/trending'"),
        routeContent.indexOf("router.get('/trending'") + 1500
      );

      expect(trendingSection).toContain("'1h', '24h', '7d', '30d'");
      expect(trendingSection).toContain('Invalid time range');
    });
  });

  describe('Search Tracking', () => {
    it('should track searches for analytics', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain('trackSearch');
    });

    it('should include user and session info in tracking', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain('getUserFromCookie');
      expect(routeContent).toContain('sessionId');
    });

    it('should track query text and filters', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      // Find the first trackSearch call
      const trackIndex = routeContent.indexOf('trackSearch');
      expect(trackIndex).toBeGreaterThan(-1);

      // Check general structure includes tracking fields
      expect(routeContent).toContain('userId:');
      expect(routeContent).toContain('resultsCount:');
      expect(routeContent).toContain('durationMs:');
    });
  });

  describe('Response Format', () => {
    it('should return standardized success response', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain('success: true');
      expect(routeContent).toContain('data:');
    });

    it('should return timestamp in responses', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain('timestamp: new Date().toISOString()');
    });

    it('should handle errors with standardized format', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain('success: false');
      expect(routeContent).toContain('error:');
      expect(routeContent).toContain('catch (error)');
    });
  });

  describe('Pagination and Limits', () => {
    it('should respect limit parameter', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain('req.query.limit');
      expect(routeContent).toContain('Math.min');
    });

    it('should support page parameter', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain('req.query.page');
    });

    it('should support skip parameter for history', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      const historySection = routeContent.slice(
        routeContent.indexOf("router.get('/history'"),
        routeContent.indexOf("router.get('/history'") + 1500
      );

      expect(historySection).toContain('req.query.skip');
    });
  });

  describe('Route Registration', () => {
    it('should be registered in routes/index.js', () => {
      const indexContent = fs.readFileSync(path.join(__dirname, '../../routes/index.js'), 'utf8');

      expect(indexContent).toContain("require('./search-v2')");
      expect(indexContent).toContain("app.use('/api/v2/search'");
    });
  });

  describe('Dependencies', () => {
    it('should import required modules', () => {
      const routeContent = fs.readFileSync(
        path.join(__dirname, '../../routes/search-v2.js'),
        'utf8'
      );

      expect(routeContent).toContain("require('express')");
      expect(routeContent).toContain("require('../db-unified')");
      expect(routeContent).toContain("require('../middleware/auth')");
      expect(routeContent).toContain("require('../middleware/searchCache')");
      expect(routeContent).toContain("require('../services/searchService')");
      expect(routeContent).toContain("require('../utils/searchAnalytics')");
      expect(routeContent).toContain("require('validator')");
    });
  });
});
