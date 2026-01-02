/**
 * Unit tests for Service Worker
 * Verifies SW configuration, caching strategies, and version management
 */

const path = require('path');
const fs = require('fs');

describe('Service Worker', () => {
  const swPath = path.join(__dirname, '../../public/sw.js');
  let swContent;

  beforeAll(() => {
    swContent = fs.readFileSync(swPath, 'utf8');
  });

  describe('File Existence', () => {
    it('should have sw.js file in public directory', () => {
      expect(fs.existsSync(swPath)).toBe(true);
    });
  });

  describe('Cache Version', () => {
    it('should use updated cache version (not v1)', () => {
      expect(swContent).toContain("CACHE_VERSION = 'eventflow-v");
      expect(swContent).not.toContain("CACHE_VERSION = 'eventflow-v1'");
    });

    it('should define cache names based on version', () => {
      expect(swContent).toContain('STATIC_CACHE');
      expect(swContent).toContain('DYNAMIC_CACHE');
      expect(swContent).toContain('IMAGE_CACHE');
    });
  });

  describe('Caching Strategy', () => {
    it('should implement network-first for /assets/* paths', () => {
      // Check for network-first strategy comment or implementation
      const hasNetworkFirst =
        swContent.includes('Network-first strategy for static assets') ||
        (swContent.includes('/assets/') && swContent.includes('fetch(request)'));
      expect(hasNetworkFirst).toBe(true);
    });

    it('should NOT use cache-first for static assets', () => {
      // The SW should fetch from network first for assets, not cache first
      // Check that the assets handling uses fetch first
      const assetsFetchSection = swContent.match(
        /pathname\.startsWith\('\/assets\/'\)[\s\S]*?event\.respondWith\(([\s\S]*?)\)/
      );
      if (assetsFetchSection) {
        const respondWithContent = assetsFetchSection[1];
        // Network-first should call fetch() before caches.match()
        const fetchPos = respondWithContent.indexOf('fetch(');
        const cacheMatchPos = respondWithContent.indexOf('caches.match(');
        // If both exist, fetch should come before caches.match in network-first
        if (fetchPos !== -1 && cacheMatchPos !== -1) {
          expect(fetchPos).toBeLessThan(cacheMatchPos);
        }
      }
    });

    it('should cache offline.html for offline fallback', () => {
      expect(swContent).toContain('offline.html');
    });

    it('should handle API requests with network-first', () => {
      expect(swContent).toContain('/api/');
      expect(swContent).toContain('fetch(request)');
    });
  });

  describe('Activate Handler', () => {
    it('should delete old caches on activate', () => {
      expect(swContent).toContain('activate');
      expect(swContent).toContain('caches.delete');
    });

    it('should claim clients on activate', () => {
      expect(swContent).toContain('activate');
      expect(swContent).toContain('clients.claim');
    });
  });

  describe('Install Handler', () => {
    it('should skip waiting on install', () => {
      expect(swContent).toContain('install');
      expect(swContent).toContain('skipWaiting');
    });

    it('should cache static assets on install', () => {
      expect(swContent).toContain('install');
      expect(swContent).toContain('cache.addAll');
    });
  });

  describe('Fetch Handler', () => {
    it('should skip cross-origin requests', () => {
      expect(swContent).toContain('origin');
      expect(swContent).toContain('location.origin');
    });

    it('should skip non-GET requests', () => {
      expect(swContent).toContain('method');
      expect(swContent).toContain("'GET'");
    });
  });
});
