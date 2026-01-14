/**
 * Pexels API Service
 * Integrates Pexels stock photo API for EventFlow
 * Used for category images, hero banners, and other site content
 * Suppliers still upload their own profile and package photos
 */

'use strict';

const https = require('https');

class PexelsService {
  constructor(apiKey) {
    this.apiKey = apiKey || process.env.PEXELS_API_KEY;
    this.baseUrl = 'api.pexels.com';

    if (!this.apiKey) {
      console.warn('⚠️  Pexels API key not configured. Stock photo features will be disabled.');
    }
  }

  /**
   * Check if Pexels API is configured
   */
  isConfigured() {
    return !!this.apiKey;
  }

  /**
   * Make HTTPS request to Pexels API
   */
  async makeRequest(path) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.baseUrl,
        path: path,
        method: 'GET',
        headers: {
          Authorization: this.apiKey,
        },
        timeout: 10000, // 10 second timeout
      };

      const req = https.request(options, res => {
        let data = '';

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              resolve(JSON.parse(data));
            } catch (e) {
              reject(new Error('Failed to parse response'));
            }
          } else {
            reject(new Error(`Pexels API error: ${res.statusCode} ${res.statusMessage}`));
          }
        });
      });

      req.on('error', error => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      req.end();
    });
  }

  /**
   * Search for photos by query
   * @param {string} query - Search term (e.g., "wedding", "catering", "venue")
   * @param {number} perPage - Number of results per page (default: 15, max: 80)
   * @param {number} page - Page number (default: 1)
   * @returns {Promise<Object>} Search results with photos array
   */
  async searchPhotos(query, perPage = 15, page = 1) {
    if (!this.isConfigured()) {
      throw new Error('Pexels API key not configured');
    }

    const path = `/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;
    const data = await this.makeRequest(path);

    // Transform response to include only relevant fields
    return {
      page: data.page,
      perPage: data.per_page,
      totalResults: data.total_results,
      photos: data.photos.map(photo => ({
        id: photo.id,
        width: photo.width,
        height: photo.height,
        url: photo.url,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        avgColor: photo.avg_color,
        src: {
          original: photo.src.original,
          large2x: photo.src.large2x,
          large: photo.src.large,
          medium: photo.src.medium,
          small: photo.src.small,
          portrait: photo.src.portrait,
          landscape: photo.src.landscape,
          tiny: photo.src.tiny,
        },
        alt: photo.alt || query,
      })),
      nextPage: data.next_page,
      prevPage: data.prev_page,
    };
  }

  /**
   * Get curated photos (editor's picks)
   * @param {number} perPage - Number of results per page (default: 15, max: 80)
   * @param {number} page - Page number (default: 1)
   * @returns {Promise<Object>} Curated photos
   */
  async getCuratedPhotos(perPage = 15, page = 1) {
    if (!this.isConfigured()) {
      throw new Error('Pexels API key not configured');
    }

    const path = `/v1/curated?per_page=${perPage}&page=${page}`;
    const data = await this.makeRequest(path);

    return {
      page: data.page,
      perPage: data.per_page,
      totalResults: data.total_results,
      photos: data.photos.map(photo => ({
        id: photo.id,
        width: photo.width,
        height: photo.height,
        url: photo.url,
        photographer: photo.photographer,
        photographerUrl: photo.photographer_url,
        avgColor: photo.avg_color,
        src: {
          original: photo.src.original,
          large2x: photo.src.large2x,
          large: photo.src.large,
          medium: photo.src.medium,
          small: photo.src.small,
          portrait: photo.src.portrait,
          landscape: photo.src.landscape,
          tiny: photo.src.tiny,
        },
        alt: photo.alt || 'Curated photo',
      })),
      nextPage: data.next_page,
      prevPage: data.prev_page,
    };
  }

  /**
   * Get photo by ID
   * @param {number} id - Photo ID
   * @returns {Promise<Object>} Photo details
   */
  async getPhotoById(id) {
    if (!this.isConfigured()) {
      throw new Error('Pexels API key not configured');
    }

    const path = `/v1/photos/${id}`;
    const photo = await this.makeRequest(path);

    return {
      id: photo.id,
      width: photo.width,
      height: photo.height,
      url: photo.url,
      photographer: photo.photographer,
      photographerUrl: photo.photographer_url,
      avgColor: photo.avg_color,
      src: {
        original: photo.src.original,
        large2x: photo.src.large2x,
        large: photo.src.large,
        medium: photo.src.medium,
        small: photo.src.small,
        portrait: photo.src.portrait,
        landscape: photo.src.landscape,
        tiny: photo.src.tiny,
      },
      alt: photo.alt || 'Photo',
    };
  }

  /**
   * Test Pexels API connection and validate API key
   * @returns {Promise<{success: boolean, message: string, details?: Object}>}
   */
  async testConnection() {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'Pexels API key not configured',
        details: {
          configured: false,
          error: 'PEXELS_API_KEY environment variable not set',
        },
      };
    }

    try {
      console.log('🔍 Testing Pexels API connection...');
      const startTime = Date.now();
      
      // Make a minimal request to test the API key
      // Use a common search term that's likely to have results
      const testResult = await this.searchPhotos('nature', 1, 1);
      
      const duration = Date.now() - startTime;
      console.log(`✅ Pexels API connection successful (${duration}ms)`);
      
      return {
        success: true,
        message: 'Pexels API is configured and working',
        details: {
          configured: true,
          responseTime: duration,
          totalResults: testResult.totalResults,
          apiVersion: 'v1',
        },
      };
    } catch (error) {
      console.error('❌ Pexels API connection failed:', error.message);
      
      // Parse error to provide helpful feedback
      let message = 'Pexels API connection failed';
      let errorType = 'unknown';
      
      if (error.message.includes('401') || error.message.includes('403')) {
        message = 'Invalid API key. Please check your PEXELS_API_KEY';
        errorType = 'authentication';
      } else if (error.message.includes('429')) {
        message = 'Rate limit exceeded. Please try again later';
        errorType = 'rate_limit';
      } else if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        message = 'Connection timeout. Pexels API may be unreachable';
        errorType = 'timeout';
      } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        message = 'Cannot reach Pexels API. Check network connection';
        errorType = 'network';
      }
      
      return {
        success: false,
        message,
        details: {
          configured: true,
          error: error.message,
          errorType,
        },
      };
    }
  }

  /**
   * Get suggested category search queries
   * @returns {Array<Object>} Category suggestions with search terms
   */
  static getCategorySuggestions() {
    return [
      { category: 'Venues', query: 'wedding venue elegant hall', icon: '🏛️' },
      { category: 'Catering', query: 'catering food buffet elegant', icon: '🍽️' },
      { category: 'Photography', query: 'wedding photography camera professional', icon: '📸' },
      { category: 'Entertainment', query: 'live band music event entertainment', icon: '🎵' },
      { category: 'Flowers & décor', query: 'wedding flowers decoration elegant', icon: '💐' },
      { category: 'Transport', query: 'luxury car wedding transport', icon: '🚗' },
      { category: 'Extras & add-ons', query: 'event planning decoration details', icon: '✨' },
    ];
  }
}

// Create singleton instance
let pexelsInstance = null;

function getPexelsService(apiKey) {
  if (!pexelsInstance) {
    pexelsInstance = new PexelsService(apiKey);
  }
  return pexelsInstance;
}

module.exports = {
  PexelsService,
  getPexelsService,
};
