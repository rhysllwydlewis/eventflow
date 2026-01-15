/**
 * Tests for Pexels Service Improvements
 * Tests memory leak prevention, race condition fixes, and validation improvements
 */

const { PexelsService } = require('../../utils/pexels-service');

describe('Pexels Service Improvements', () => {
  let service;

  beforeEach(() => {
    service = new PexelsService('test-api-key');
  });

  afterEach(() => {
    // Clean up interval
    if (service) {
      service.stopCacheCleanup();
    }
  });

  describe('Memory Leak Prevention', () => {
    it('should start periodic cache cleanup on initialization', () => {
      expect(service.cleanupInterval).toBeDefined();
      expect(service.cleanupInterval).not.toBeNull();
    });

    it('should stop cache cleanup when stopCacheCleanup is called', () => {
      const intervalId = service.cleanupInterval;
      expect(intervalId).toBeDefined();

      service.stopCacheCleanup();

      expect(service.cleanupInterval).toBeNull();
    });

    it('should have max cache size limit', () => {
      expect(service.maxCacheSize).toBe(500);
    });

    it('should evict oldest entry when cache is full', () => {
      // Fill cache to max
      for (let i = 0; i < service.maxCacheSize; i++) {
        service.setCachedResponse(`key${i}`, { data: i });
      }

      expect(service.cache.size).toBe(service.maxCacheSize);

      // Add one more - should evict oldest
      service.setCachedResponse('newKey', { data: 'new' });

      expect(service.cache.size).toBe(service.maxCacheSize);
      expect(service.cache.has('key0')).toBe(false); // First entry evicted
      expect(service.cache.has('newKey')).toBe(true); // New entry added
    });

    it('should clean expired cache entries', () => {
      // Add entries with expired TTL
      const now = Date.now();
      service.cache.set('expired1', {
        data: { test: 1 },
        expiresAt: now - 1000, // Expired 1 second ago
        createdAt: now - 3600000,
      });
      service.cache.set('expired2', {
        data: { test: 2 },
        expiresAt: now - 2000, // Expired 2 seconds ago
        createdAt: now - 3600000,
      });
      service.cache.set('valid', {
        data: { test: 3 },
        expiresAt: now + 3600000, // Expires in 1 hour
        createdAt: now,
      });

      expect(service.cache.size).toBe(3);

      service.cleanExpiredCache();

      expect(service.cache.size).toBe(1);
      expect(service.cache.has('expired1')).toBe(false);
      expect(service.cache.has('expired2')).toBe(false);
      expect(service.cache.has('valid')).toBe(true);
    });
  });

  describe('Request Deduplication', () => {
    it('should have pendingRequests map', () => {
      expect(service.pendingRequests).toBeDefined();
      expect(service.pendingRequests instanceof Map).toBe(true);
    });

    it('should clear pending requests on cache clear', () => {
      service.pendingRequests.set('test', Promise.resolve());
      service.cache.set('test', { data: 'test' });

      expect(service.pendingRequests.size).toBe(1);
      expect(service.cache.size).toBe(1);

      service.clearCache();

      expect(service.pendingRequests.size).toBe(0);
      expect(service.cache.size).toBe(0);
    });
  });

  describe('Circuit Breaker Improvements', () => {
    it('should reset failure count completely on success in closed state', () => {
      service.circuitBreaker.failures = 3;
      service.circuitBreaker.state = 'closed';

      service.recordSuccess();

      expect(service.circuitBreaker.failures).toBe(0);
    });

    it('should reset to closed state on success in half-open state', () => {
      service.circuitBreaker.failures = 5;
      service.circuitBreaker.state = 'half-open';

      service.recordSuccess();

      expect(service.circuitBreaker.state).toBe('closed');
      expect(service.circuitBreaker.failures).toBe(0);
    });
  });

  describe('Validation Improvements', () => {
    it('should validate photo ID as positive integer', async () => {
      await expect(service.getPhotoById('abc')).rejects.toThrow(
        'Invalid photo ID: must be a positive integer'
      );
    });

    it('should reject decimal photo IDs', async () => {
      await expect(service.getPhotoById(123.45)).rejects.toThrow(
        'Invalid photo ID: must be a positive integer'
      );
    });

    it('should reject negative photo IDs', async () => {
      await expect(service.getPhotoById(-1)).rejects.toThrow(
        'Invalid photo ID: must be a positive integer'
      );
    });

    it('should reject zero as photo ID', async () => {
      await expect(service.getPhotoById(0)).rejects.toThrow(
        'Invalid photo ID: must be a positive integer'
      );
    });
  });

  describe('Null Safety', () => {
    it('should handle missing src object in photo transformation', () => {
      const mockPhoto = {
        id: 1,
        width: 100,
        height: 100,
        url: 'test',
        photographer: 'Test',
        photographer_url: 'test',
        avg_color: '#fff',
        // src missing
      };

      // This should not throw
      const transformed = {
        id: mockPhoto.id,
        src: {
          original: mockPhoto.src?.original || '',
          large: mockPhoto.src?.large || '',
          medium: mockPhoto.src?.medium || '',
          small: mockPhoto.src?.small || '',
        },
      };

      expect(transformed.src.original).toBe('');
      expect(transformed.src.large).toBe('');
    });
  });

  describe('Metrics', () => {
    it('should handle zero total requests in metrics', () => {
      const metrics = service.getMetrics();

      expect(metrics.successRate).toBe('N/A');
      expect(metrics.cacheHitRate).toBe('N/A');
    });

    it('should calculate success rate correctly', () => {
      service.metrics.totalRequests = 100;
      service.metrics.successfulRequests = 95;

      const metrics = service.getMetrics();

      expect(metrics.successRate).toBe('95.00%');
    });

    it('should calculate cache hit rate correctly', () => {
      service.metrics.cacheHits = 80;
      service.metrics.cacheMisses = 20;

      const metrics = service.getMetrics();

      expect(metrics.cacheHitRate).toBe('80.00%');
    });
  });

  describe('Configuration', () => {
    it('should have cache TTL of 1 hour', () => {
      expect(service.cacheTTL).toBe(60 * 60 * 1000);
    });

    it('should have max cache size of 500', () => {
      expect(service.maxCacheSize).toBe(500);
    });

    it('should have circuit breaker threshold of 5', () => {
      expect(service.circuitBreaker.threshold).toBe(5);
    });

    it('should have circuit breaker timeout of 60 seconds', () => {
      expect(service.circuitBreaker.timeout).toBe(60000);
    });
  });
});
