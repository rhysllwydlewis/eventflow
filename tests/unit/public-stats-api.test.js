/**
 * Tests for GET /api/public/stats endpoint
 */

const request = require('supertest');
const express = require('express');

// Mock database
let mockSuppliers = [];
let mockPackages = [];
let mockListings = [];
let mockReviews = [];

// Mock dbUnified
const mockDbUnified = {
  read: jest.fn(async collection => {
    switch (collection) {
      case 'suppliers':
        return mockSuppliers;
      case 'packages':
        return mockPackages;
      case 'marketplace_listings':
        return mockListings;
      case 'reviews':
        return mockReviews;
      default:
        return [];
    }
  }),
};

// Create a minimal Express app for testing
function createTestApp() {
  const app = express();

  // Mock logger and sentry
  const logger = {
    error: jest.fn(),
  };
  const sentry = {
    captureException: jest.fn(),
  };

  // Add the stats endpoint
  app.get('/api/public/stats', async (_req, res) => {
    try {
      res.set('Cache-Control', 'public, max-age=300');

      const suppliers = await mockDbUnified.read('suppliers');
      const suppliersVerified = suppliers.filter(s => s.approved || s.verified).length;

      const packages = await mockDbUnified.read('packages');
      const packagesApproved = packages.filter(p => p.approved === true).length;

      const listings = await mockDbUnified.read('marketplace_listings');
      const marketplaceListingsActive = listings.filter(
        l => l.approved === true && l.status === 'active'
      ).length;

      const reviews = await mockDbUnified.read('reviews');
      const reviewsApproved = reviews.filter(r => r.approved === true).length;

      res.json({
        suppliersVerified,
        packagesApproved,
        marketplaceListingsActive,
        reviewsApproved,
      });
    } catch (error) {
      logger.error('Error fetching public stats:', error);
      sentry.captureException(error);
      res.status(500).json({
        error: 'Failed to fetch statistics',
        suppliersVerified: 0,
        packagesApproved: 0,
        marketplaceListingsActive: 0,
        reviewsApproved: 0,
      });
    }
  });

  return app;
}

describe('GET /api/public/stats', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    // Reset mocks
    mockSuppliers = [];
    mockPackages = [];
    mockListings = [];
    mockReviews = [];
    jest.clearAllMocks();
  });

  it('should return correct counts with mixed data', async () => {
    mockSuppliers = [
      { id: '1', approved: true },
      { id: '2', verified: true },
      { id: '3', approved: false, verified: false },
    ];
    mockPackages = [
      { id: '1', approved: true },
      { id: '2', approved: false },
      { id: '3', approved: true },
    ];
    mockListings = [
      { id: '1', approved: true, status: 'active' },
      { id: '2', approved: true, status: 'inactive' },
      { id: '3', approved: false, status: 'active' },
    ];
    mockReviews = [
      { id: '1', approved: true },
      { id: '2', approved: false },
    ];

    const response = await request(app).get('/api/public/stats').expect(200);

    expect(response.body).toEqual({
      suppliersVerified: 2,
      packagesApproved: 2,
      marketplaceListingsActive: 1,
      reviewsApproved: 1,
    });
  });

  it('should return zero counts when collections are empty', async () => {
    const response = await request(app).get('/api/public/stats').expect(200);

    expect(response.body).toEqual({
      suppliersVerified: 0,
      packagesApproved: 0,
      marketplaceListingsActive: 0,
      reviewsApproved: 0,
    });
  });

  it('should set cache-control header', async () => {
    const response = await request(app).get('/api/public/stats').expect(200);

    expect(response.headers['cache-control']).toBe('public, max-age=300');
  });

  it('should return correct shape on success', async () => {
    mockSuppliers = [{ id: '1', approved: true }];

    const response = await request(app).get('/api/public/stats').expect(200);

    expect(response.body).toHaveProperty('suppliersVerified');
    expect(response.body).toHaveProperty('packagesApproved');
    expect(response.body).toHaveProperty('marketplaceListingsActive');
    expect(response.body).toHaveProperty('reviewsApproved');
    expect(typeof response.body.suppliersVerified).toBe('number');
  });

  it('should handle database errors gracefully', async () => {
    mockDbUnified.read = jest.fn().mockRejectedValue(new Error('DB error'));

    const response = await request(app).get('/api/public/stats').expect(500);

    expect(response.body).toHaveProperty('error');
    expect(response.body.suppliersVerified).toBe(0);
    expect(response.body.packagesApproved).toBe(0);
    expect(response.body.marketplaceListingsActive).toBe(0);
    expect(response.body.reviewsApproved).toBe(0);
  });
});
