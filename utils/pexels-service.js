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
