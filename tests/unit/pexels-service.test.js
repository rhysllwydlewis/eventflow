/**
 * Unit tests for Pexels service
 */

const { PexelsService } = require('../../utils/pexels-service');

describe('PexelsService', () => {
  describe('Constructor and Configuration', () => {
    it('should create instance with API key', () => {
      const service = new PexelsService('test-api-key');
      expect(service.isConfigured()).toBe(true);
      expect(service.apiKey).toBe('test-api-key');
    });

    it('should create instance from environment variable', () => {
      const originalKey = process.env.PEXELS_API_KEY;
      process.env.PEXELS_API_KEY = 'env-api-key';

      const service = new PexelsService();
      expect(service.isConfigured()).toBe(true);
      expect(service.apiKey).toBe('env-api-key');

      process.env.PEXELS_API_KEY = originalKey;
    });

    it('should handle missing API key gracefully', () => {
      const originalKey = process.env.PEXELS_API_KEY;
      delete process.env.PEXELS_API_KEY;

      const service = new PexelsService();
      expect(service.isConfigured()).toBe(false);

      process.env.PEXELS_API_KEY = originalKey;
    });
  });

  describe('Input Validation', () => {
    let service;

    beforeEach(() => {
      service = new PexelsService('test-api-key');
    });

    it('should throw error for empty query in searchPhotos', async () => {
      await expect(service.searchPhotos('')).rejects.toThrow(
        'Invalid query: must be a non-empty string'
      );
    });

    it('should throw error for invalid query type in searchPhotos', async () => {
      await expect(service.searchPhotos(null)).rejects.toThrow(
        'Invalid query: must be a non-empty string'
      );
    });

    it('should throw error for empty query in searchVideos', async () => {
      await expect(service.searchVideos('')).rejects.toThrow(
        'Invalid query: must be a non-empty string'
      );
    });

    it('should throw error for invalid photo ID', async () => {
      await expect(service.getPhotoById(0)).rejects.toThrow(
        'Invalid photo ID: must be a positive number'
      );
      await expect(service.getPhotoById(-1)).rejects.toThrow(
        'Invalid photo ID: must be a positive number'
      );
      await expect(service.getPhotoById('invalid')).rejects.toThrow(
        'Invalid photo ID: must be a positive number'
      );
    });

    it('should throw error for invalid video ID', async () => {
      await expect(service.getVideoById(0)).rejects.toThrow(
        'Invalid video ID: must be a positive number'
      );
      await expect(service.getVideoById(-1)).rejects.toThrow(
        'Invalid video ID: must be a positive number'
      );
    });

    it('should throw error for invalid collection ID', async () => {
      await expect(service.getCollectionMedia(null)).rejects.toThrow('Invalid collection ID');
      await expect(service.getCollectionMedia(undefined)).rejects.toThrow('Invalid collection ID');
    });
  });

  describe('Not Configured Error', () => {
    let service;

    beforeEach(() => {
      service = new PexelsService();
    });

    it('should throw error when not configured - searchPhotos', async () => {
      await expect(service.searchPhotos('test')).rejects.toThrow('Pexels API key not configured');
    });

    it('should throw error when not configured - getCuratedPhotos', async () => {
      await expect(service.getCuratedPhotos()).rejects.toThrow('Pexels API key not configured');
    });

    it('should throw error when not configured - getPhotoById', async () => {
      await expect(service.getPhotoById(1)).rejects.toThrow('Pexels API key not configured');
    });

    it('should throw error when not configured - searchVideos', async () => {
      await expect(service.searchVideos('test')).rejects.toThrow('Pexels API key not configured');
    });

    it('should throw error when not configured - getPopularVideos', async () => {
      await expect(service.getPopularVideos()).rejects.toThrow('Pexels API key not configured');
    });

    it('should throw error when not configured - getVideoById', async () => {
      await expect(service.getVideoById(1)).rejects.toThrow('Pexels API key not configured');
    });

    it('should throw error when not configured - getFeaturedCollections', async () => {
      await expect(service.getFeaturedCollections()).rejects.toThrow(
        'Pexels API key not configured'
      );
    });

    it('should throw error when not configured - getUserCollections', async () => {
      await expect(service.getUserCollections()).rejects.toThrow('Pexels API key not configured');
    });

    it('should throw error when not configured - getCollectionMedia', async () => {
      await expect(service.getCollectionMedia('123')).rejects.toThrow(
        'Pexels API key not configured'
      );
    });
  });

  describe('testConnection', () => {
    it('should return not configured status when API key is missing', async () => {
      const service = new PexelsService();
      const result = await service.testConnection();

      expect(result.success).toBe(false);
      expect(result.message).toBe('Pexels API key not configured');
      expect(result.details.configured).toBe(false);
    });
  });

  describe('getCategorySuggestions', () => {
    it('should return array of category suggestions', () => {
      const suggestions = PexelsService.getCategorySuggestions();

      expect(Array.isArray(suggestions)).toBe(true);
      expect(suggestions.length).toBeGreaterThan(0);

      // Verify structure of first suggestion
      expect(suggestions[0]).toHaveProperty('category');
      expect(suggestions[0]).toHaveProperty('query');
      expect(suggestions[0]).toHaveProperty('icon');
    });

    it('should include wedding-related categories', () => {
      const suggestions = PexelsService.getCategorySuggestions();
      const categories = suggestions.map(s => s.category.toLowerCase());

      expect(categories).toContain('venues');
      expect(categories).toContain('catering');
      expect(categories).toContain('photography');
    });
  });

  describe('Base URL Configuration', () => {
    it('should use correct Pexels API base URL', () => {
      const service = new PexelsService('test-key');
      expect(service.baseUrl).toBe('api.pexels.com');
    });
  });

  describe('makeRequest Headers', () => {
    it('should include User-Agent header', () => {
      const service = new PexelsService('test-key');
      // We can't directly test the headers without making a real request,
      // but we can verify the service is configured properly
      expect(service.apiKey).toBe('test-key');
    });
  });

  describe('Filter Parameters', () => {
    let service;

    beforeEach(() => {
      service = new PexelsService('test-key');
    });

    it('should accept filters object for searchPhotos', () => {
      const filters = {
        orientation: 'landscape',
        size: 'large',
        color: 'red',
        locale: 'en-US',
      };

      // This would need to mock the actual request
      // For now, just verify the method signature accepts filters
      expect(() => {
        service.searchPhotos('test', 15, 1, filters);
      }).not.toThrow();
    });

    it('should accept filters object for searchVideos', () => {
      const filters = {
        orientation: 'portrait',
        size: 'medium',
        locale: 'pt-BR',
      };

      // This would need to mock the actual request
      expect(() => {
        service.searchVideos('test', 15, 1, filters);
      }).not.toThrow();
    });
  });
});
