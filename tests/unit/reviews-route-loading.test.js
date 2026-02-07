/**
 * Unit test for reviews route loading
 * Verifies that the routes/reviews.js module can be required without errors
 * This test specifically checks for the bug where roleRequired('admin') was
 * being called at require time instead of request time.
 */

'use strict';

describe('Reviews Routes Loading', () => {
  it('should load routes/reviews.js without TypeError', () => {
    // This will throw if there's a require-time error like "roleRequired is not a function"
    expect(() => {
      const reviewsRoutes = require('../../routes/reviews');
      expect(reviewsRoutes).toBeDefined();
      expect(typeof reviewsRoutes).toBe('function'); // It's an Express router
      expect(typeof reviewsRoutes.initializeDependencies).toBe('function');
    }).not.toThrow();
  });

  it('should have initializeDependencies function exported', () => {
    const reviewsRoutes = require('../../routes/reviews');
    expect(reviewsRoutes.initializeDependencies).toBeDefined();
    expect(typeof reviewsRoutes.initializeDependencies).toBe('function');
  });

  it('should be able to initialize dependencies without error', () => {
    const reviewsRoutes = require('../../routes/reviews');

    // Mock dependencies
    const mockDeps = {
      dbUnified: {},
      authRequired: jest.fn((req, res, next) => next()),
      roleRequired: jest.fn(role => (req, res, next) => next()),
      featureRequired: jest.fn(feature => (req, res, next) => next()),
      csrfProtection: jest.fn((req, res, next) => next()),
      reviewsSystem: {
        moderateReview: jest.fn(),
      },
    };

    expect(() => {
      reviewsRoutes.initializeDependencies(mockDeps);
    }).not.toThrow();
  });
});
