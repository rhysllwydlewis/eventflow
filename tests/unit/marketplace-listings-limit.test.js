/**
 * Tests for marketplace listings limit parameter
 */

const request = require('supertest');
const express = require('express');

// Mock database
let mockListings = [];

// Mock dbUnified
const mockDbUnified = {
  read: jest.fn(async collection => {
    if (collection === 'marketplace_listings') {
      return mockListings;
    }
    return [];
  }),
};

// Create a minimal Express app for testing
function createTestApp() {
  const app = express();

  // Mock logger and sentry
  const logger = {
    info: jest.fn(),
    error: jest.fn(),
  };
  const sentry = {
    captureException: jest.fn(),
  };

  // Add the marketplace listings endpoint
  app.get('/api/marketplace/listings', async (req, res) => {
    try {
      const { category, condition, minPrice, maxPrice, search, sort, limit } = req.query;
      let listings = await mockDbUnified.read('marketplace_listings');

      // Filter by approved and active status
      listings = listings.filter(l => l.approved && l.status === 'active');

      // Apply filters
      if (category) {
        listings = listings.filter(l => l.category === category);
      }
      if (condition) {
        listings = listings.filter(l => l.condition === condition);
      }
      if (minPrice) {
        listings = listings.filter(l => l.price >= parseFloat(minPrice));
      }
      if (maxPrice) {
        listings = listings.filter(l => l.price <= parseFloat(maxPrice));
      }
      if (search) {
        const searchLower = search.toLowerCase();
        listings = listings.filter(
          l =>
            l.title.toLowerCase().includes(searchLower) ||
            l.description.toLowerCase().includes(searchLower)
        );
      }

      // Sort listings
      if (sort === 'price-low') {
        listings.sort((a, b) => a.price - b.price);
      } else if (sort === 'price-high') {
        listings.sort((a, b) => b.price - a.price);
      } else {
        // Default: most recent
        listings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      // Apply limit parameter (default 12, cap at 24)
      let resultLimit = 12; // default
      if (limit) {
        const parsedLimit = parseInt(limit, 10);
        if (!isNaN(parsedLimit) && parsedLimit > 0) {
          resultLimit = Math.min(parsedLimit, 24); // cap at 24
        }
      }
      listings = listings.slice(0, resultLimit);

      logger.info('Marketplace listings fetched', {
        count: listings.length,
        filters: { category, condition, minPrice, maxPrice, search, sort, limit: resultLimit },
      });

      res.json({ listings });
    } catch (error) {
      logger.error('Error fetching marketplace listings:', error);
      sentry.captureException(error);
      res.status(500).json({
        error: 'Failed to fetch marketplace listings',
        message: 'Unable to load listings at this time. Please try again later.',
      });
    }
  });

  return app;
}

// Helper to create mock listings
function createMockListings(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `listing-${i + 1}`,
    title: `Test Listing ${i + 1}`,
    description: `Description for listing ${i + 1}`,
    price: 100 + i * 10,
    category: 'Decor',
    condition: 'Good',
    approved: true,
    status: 'active',
    createdAt: new Date(Date.now() - i * 1000).toISOString(),
  }));
}

describe('GET /api/marketplace/listings - limit parameter', () => {
  let app;

  beforeEach(() => {
    app = createTestApp();
    mockListings = [];
    jest.clearAllMocks();
  });

  it('should default to 12 items when no limit specified', async () => {
    mockListings = createMockListings(20);

    const response = await request(app).get('/api/marketplace/listings').expect(200);

    expect(response.body.listings).toHaveLength(12);
  });

  it('should respect limit parameter when less than cap', async () => {
    mockListings = createMockListings(20);

    const response = await request(app).get('/api/marketplace/listings?limit=4').expect(200);

    expect(response.body.listings).toHaveLength(4);
  });

  it('should cap limit at 24 even if higher value requested', async () => {
    mockListings = createMockListings(50);

    const response = await request(app).get('/api/marketplace/listings?limit=100').expect(200);

    expect(response.body.listings).toHaveLength(24);
  });

  it('should return all items if limit exceeds available items', async () => {
    mockListings = createMockListings(5);

    const response = await request(app).get('/api/marketplace/listings?limit=10').expect(200);

    expect(response.body.listings).toHaveLength(5);
  });

  it('should ignore invalid limit values and use default', async () => {
    mockListings = createMockListings(20);

    const response = await request(app).get('/api/marketplace/listings?limit=invalid').expect(200);

    expect(response.body.listings).toHaveLength(12);
  });

  it('should ignore negative limit values and use default', async () => {
    mockListings = createMockListings(20);

    const response = await request(app).get('/api/marketplace/listings?limit=-5').expect(200);

    expect(response.body.listings).toHaveLength(12);
  });

  it('should apply limit after filtering', async () => {
    mockListings = createMockListings(20);
    // Add some non-approved items
    mockListings.push(
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `unapproved-${i}`,
        title: `Unapproved ${i}`,
        description: 'Not approved',
        price: 50,
        category: 'Other',
        condition: 'Fair',
        approved: false,
        status: 'active',
        createdAt: new Date().toISOString(),
      }))
    );

    const response = await request(app).get('/api/marketplace/listings?limit=5').expect(200);

    // Should only return 5 approved items
    expect(response.body.listings).toHaveLength(5);
    expect(response.body.listings.every(l => l.approved)).toBe(true);
  });

  it('should apply limit after sorting', async () => {
    mockListings = createMockListings(20);

    const response = await request(app)
      .get('/api/marketplace/listings?limit=3&sort=price-low')
      .expect(200);

    expect(response.body.listings).toHaveLength(3);
    // Check that items are sorted by price (lowest first)
    expect(response.body.listings[0].price).toBeLessThanOrEqual(response.body.listings[1].price);
  });

  it('should handle zero as limit by using default', async () => {
    mockListings = createMockListings(20);

    const response = await request(app).get('/api/marketplace/listings?limit=0').expect(200);

    expect(response.body.listings).toHaveLength(12);
  });
});
