/**
 * Unit tests for GET /api/public/auth-photos
 * Covers the no-auth endpoint that serves event photos for the auth page
 * left-panel Pexels slideshow.
 */

const request = require('supertest');
const express = require('express');

// ---------------------------------------------------------------------------
// Minimal mock setup — no real Pexels API calls in unit tests
// ---------------------------------------------------------------------------

const mockFallbackPhoto = {
  id: 'fb-1',
  photographer: 'Alice',
  alt: 'Wedding flowers',
  src: {
    large:
      'https://images.pexels.com/photos/111/pexels-photo-111.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
  },
};

const mockGetRandomFallbackPhotos = jest.fn(count =>
  Array.from({ length: count }, (_, i) => ({
    ...mockFallbackPhoto,
    id: `fb-${i + 1}`,
  }))
);

const mockPexelsService = {
  isConfigured: jest.fn(() => false),
  searchPhotos: jest.fn(async () => ({ photos: [] })),
};

jest.mock('../../utils/pexels-service', () => ({
  getPexelsService: jest.fn(() => mockPexelsService),
}));

jest.mock('../../config/pexels-fallback', () => ({
  getRandomFallbackPhotos: mockGetRandomFallbackPhotos,
}));

jest.mock('../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createApp() {
  const app = express();
  app.use(express.json());
  const publicRouter = require('../../routes/public');
  app.use('/api/public', publicRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/public/auth-photos', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: Pexels not configured — uses fallback
    mockPexelsService.isConfigured.mockReturnValue(false);
    mockGetRandomFallbackPhotos.mockImplementation(count =>
      Array.from({ length: count }, (_, i) => ({
        ...mockFallbackPhoto,
        id: `fb-${i + 1}`,
      }))
    );
    app = createApp();
  });

  it('returns 200 with fallback source when Pexels is not configured', async () => {
    const res = await request(app).get('/api/public/auth-photos');

    expect(res.status).toBe(200);
    expect(res.body.source).toBe('fallback');
    expect(Array.isArray(res.body.photos)).toBe(true);
    expect(res.body.photos.length).toBeGreaterThan(0);
  });

  it('returns 8 photos in fallback mode', async () => {
    const res = await request(app).get('/api/public/auth-photos');

    expect(res.status).toBe(200);
    expect(res.body.photos).toHaveLength(8);
  });

  it('all photos have required shape: url, photographer, photographerUrl, alt', async () => {
    const res = await request(app).get('/api/public/auth-photos');

    for (const photo of res.body.photos) {
      expect(photo).toHaveProperty('url');
      expect(photo).toHaveProperty('photographer');
      expect(photo).toHaveProperty('photographerUrl');
      expect(photo).toHaveProperty('alt');
      expect(typeof photo.url).toBe('string');
      expect(photo.url.startsWith('https://images.pexels.com/')).toBe(true);
    }
  });

  it('returns Cache-Control: public, max-age=300 header', async () => {
    const res = await request(app).get('/api/public/auth-photos');

    expect(res.headers['cache-control']).toMatch(/public.*max-age=300/i);
  });

  it('requires no authentication (no 401/403 for unauthenticated request)', async () => {
    const res = await request(app).get('/api/public/auth-photos');

    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it('filters out fallback photos with non-Pexels URLs', async () => {
    // Override the fallback mock to include one photo with an invalid URL.
    mockGetRandomFallbackPhotos.mockReturnValue([
      {
        id: 'good',
        photographer: 'Alice',
        alt: 'Good photo',
        src: {
          large:
            'https://images.pexels.com/photos/111/pexels-photo-111.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750',
        },
      },
      {
        id: 'bad',
        photographer: 'Evil',
        alt: 'Bad photo',
        // Not a Pexels domain — should be filtered out by isSafeAuthPexelsUrl.
        src: { large: 'https://evil.com/photo.jpg' },
        url: 'https://evil.com/photo.jpg',
      },
    ]);

    const res = await request(app).get('/api/public/auth-photos');

    expect(res.status).toBe(200);
    const urls = res.body.photos.map(p => p.url);
    expect(urls.every(u => u.startsWith('https://images.pexels.com/'))).toBe(true);
    // Only the good photo should survive
    expect(urls).toHaveLength(1);
  });
});
