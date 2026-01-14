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
    // Store explicit API key if provided, otherwise read dynamically from env
    this.explicitApiKey = apiKey;
    this.baseUrl = 'api.pexels.com';

    if (!this.getApiKey()) {
      console.warn('⚠️  Pexels API key not configured. Stock photo features will be disabled.');
    }
  }

  /**
   * Get API key - reads dynamically from environment if not explicitly set
   * This allows the API key to be updated without restarting the application
   */
  getApiKey() {
    return this.explicitApiKey || process.env.PEXELS_API_KEY;
  }

  /**
   * Check if Pexels API is configured
   */
  isConfigured() {
    return !!this.getApiKey();
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
          Authorization: this.getApiKey(),
          'User-Agent': 'EventFlow/5.2.0 (https://github.com/rhysllwydlewis/eventflow)',
        },
        timeout: 10000, // 10 second timeout
      };

      console.log(`🌐 Pexels API Request: GET ${path}`);
      const startTime = Date.now();

      const req = https.request(options, res => {
        let data = '';
        const duration = Date.now() - startTime;

        // Parse rate limit headers
        const rateLimit = {
          remaining: res.headers['x-ratelimit-remaining'],
          limit: res.headers['x-ratelimit-limit'],
          reset: res.headers['x-ratelimit-reset'],
        };

        console.log(`📊 Pexels API Response: ${res.statusCode} (${duration}ms)`);
        if (rateLimit.remaining) {
          console.log(
            `⏱️  Rate Limit: ${rateLimit.remaining}/${rateLimit.limit} remaining (resets: ${rateLimit.reset})`
          );
        }

        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 200) {
            try {
              const parsedData = JSON.parse(data);
              // Include rate limit info in response
              resolve({
                data: parsedData,
                rateLimit,
              });
            } catch (e) {
              console.error('❌ Failed to parse Pexels API response:', e.message);
              reject(new Error('Failed to parse response'));
            }
          } else {
            // Enhanced error messages based on status code
            let errorMessage = `Pexels API error: ${res.statusCode}`;
            let errorDetails = data;

            try {
              const errorData = JSON.parse(data);
              errorDetails = errorData.error || errorData.message || data;
            } catch (e) {
              // Keep raw data if not JSON
            }

            if (res.statusCode === 401) {
              errorMessage = 'Unauthorized: Invalid API key';
              console.error('❌ Pexels API: Invalid API key');
            } else if (res.statusCode === 403) {
              errorMessage = 'Forbidden: API key lacks required permissions';
              console.error('❌ Pexels API: Insufficient permissions');
            } else if (res.statusCode === 404) {
              errorMessage = 'Not Found: Resource does not exist';
              console.error('❌ Pexels API: Resource not found');
            } else if (res.statusCode === 429) {
              errorMessage = 'Rate Limit Exceeded: Too many requests';
              console.error(`❌ Pexels API: Rate limit exceeded (resets: ${rateLimit.reset})`);
            } else if (res.statusCode >= 500) {
              errorMessage = 'Server Error: Pexels API is experiencing issues';
              console.error('❌ Pexels API: Server error');
            }

            console.error(`📝 Error details: ${errorDetails}`);
            reject(new Error(`${errorMessage} - ${errorDetails}`));
          }
        });
      });

      req.on('error', error => {
        console.error('❌ Pexels API request error:', error.message);
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        console.error('❌ Pexels API request timeout');
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
   * @param {Object} filters - Optional filters (orientation, size, color, locale)
   * @returns {Promise<Object>} Search results with photos array
   */
  async searchPhotos(query, perPage = 15, page = 1, filters = {}) {
    if (!this.isConfigured()) {
      throw new Error('Pexels API key not configured');
    }

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Invalid query: must be a non-empty string');
    }

    // Build query parameters
    let path = `/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;

    // Add optional filters
    if (filters.orientation) {
      path += `&orientation=${encodeURIComponent(filters.orientation)}`;
    }
    if (filters.size) {
      path += `&size=${encodeURIComponent(filters.size)}`;
    }
    if (filters.color) {
      path += `&color=${encodeURIComponent(filters.color)}`;
    }
    if (filters.locale) {
      path += `&locale=${encodeURIComponent(filters.locale)}`;
    }

    const response = await this.makeRequest(path);
    const data = response.data;

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
      rateLimit: response.rateLimit,
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
    const response = await this.makeRequest(path);
    const data = response.data;

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
      rateLimit: response.rateLimit,
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

    // Validate ID
    if (!id || isNaN(id) || id <= 0) {
      throw new Error('Invalid photo ID: must be a positive number');
    }

    const path = `/v1/photos/${id}`;
    const response = await this.makeRequest(path);
    const photo = response.data;

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
      rateLimit: response.rateLimit,
    };
  }

  /**
   * Search for videos by query
   * @param {string} query - Search term (e.g., "wedding", "celebration")
   * @param {number} perPage - Number of results per page (default: 15, max: 80)
   * @param {number} page - Page number (default: 1)
   * @param {Object} filters - Optional filters (orientation, size, locale)
   * @returns {Promise<Object>} Search results with videos array
   */
  async searchVideos(query, perPage = 15, page = 1, filters = {}) {
    if (!this.isConfigured()) {
      throw new Error('Pexels API key not configured');
    }

    // Validate input
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new Error('Invalid query: must be a non-empty string');
    }

    // Build query parameters
    let path = `/v1/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;

    // Add optional filters
    if (filters.orientation) {
      path += `&orientation=${encodeURIComponent(filters.orientation)}`;
    }
    if (filters.size) {
      path += `&size=${encodeURIComponent(filters.size)}`;
    }
    if (filters.locale) {
      path += `&locale=${encodeURIComponent(filters.locale)}`;
    }

    const response = await this.makeRequest(path);
    const data = response.data;

    // Transform response to include relevant fields
    return {
      page: data.page,
      perPage: data.per_page,
      totalResults: data.total_results,
      videos: data.videos.map(video => ({
        id: video.id,
        width: video.width,
        height: video.height,
        url: video.url,
        image: video.image,
        duration: video.duration,
        user: {
          id: video.user.id,
          name: video.user.name,
          url: video.user.url,
        },
        videoFiles: video.video_files.map(file => ({
          id: file.id,
          quality: file.quality,
          fileType: file.file_type,
          width: file.width,
          height: file.height,
          link: file.link,
        })),
        videoPictures: video.video_pictures.map(pic => ({
          id: pic.id,
          picture: pic.picture,
          nr: pic.nr,
        })),
      })),
      nextPage: data.next_page,
      prevPage: data.prev_page,
      rateLimit: response.rateLimit,
    };
  }

  /**
   * Get popular videos
   * @param {number} perPage - Number of results per page (default: 15, max: 80)
   * @param {number} page - Page number (default: 1)
   * @returns {Promise<Object>} Popular videos
   */
  async getPopularVideos(perPage = 15, page = 1) {
    if (!this.isConfigured()) {
      throw new Error('Pexels API key not configured');
    }

    const path = `/v1/videos/popular?per_page=${perPage}&page=${page}`;
    const response = await this.makeRequest(path);
    const data = response.data;

    return {
      page: data.page,
      perPage: data.per_page,
      totalResults: data.total_results,
      videos: data.videos.map(video => ({
        id: video.id,
        width: video.width,
        height: video.height,
        url: video.url,
        image: video.image,
        duration: video.duration,
        user: {
          id: video.user.id,
          name: video.user.name,
          url: video.user.url,
        },
        videoFiles: video.video_files.map(file => ({
          id: file.id,
          quality: file.quality,
          fileType: file.file_type,
          width: file.width,
          height: file.height,
          link: file.link,
        })),
        videoPictures: video.video_pictures.map(pic => ({
          id: pic.id,
          picture: pic.picture,
          nr: pic.nr,
        })),
      })),
      nextPage: data.next_page,
      prevPage: data.prev_page,
      rateLimit: response.rateLimit,
    };
  }

  /**
   * Get video by ID
   * @param {number} id - Video ID
   * @returns {Promise<Object>} Video details
   */
  async getVideoById(id) {
    if (!this.isConfigured()) {
      throw new Error('Pexels API key not configured');
    }

    // Validate ID
    if (!id || isNaN(id) || id <= 0) {
      throw new Error('Invalid video ID: must be a positive number');
    }

    const path = `/v1/videos/${id}`;
    const response = await this.makeRequest(path);
    const video = response.data;

    return {
      id: video.id,
      width: video.width,
      height: video.height,
      url: video.url,
      image: video.image,
      duration: video.duration,
      user: {
        id: video.user.id,
        name: video.user.name,
        url: video.user.url,
      },
      videoFiles: video.video_files.map(file => ({
        id: file.id,
        quality: file.quality,
        fileType: file.file_type,
        width: file.width,
        height: file.height,
        link: file.link,
      })),
      videoPictures: video.video_pictures.map(pic => ({
        id: pic.id,
        picture: pic.picture,
        nr: pic.nr,
      })),
      rateLimit: response.rateLimit,
    };
  }

  /**
   * Get featured collections
   * @param {number} perPage - Number of results per page (default: 15, max: 80)
   * @param {number} page - Page number (default: 1)
   * @returns {Promise<Object>} Featured collections
   */
  async getFeaturedCollections(perPage = 15, page = 1) {
    if (!this.isConfigured()) {
      throw new Error('Pexels API key not configured');
    }

    const path = `/v1/collections/featured?per_page=${perPage}&page=${page}`;
    const response = await this.makeRequest(path);
    const data = response.data;

    return {
      page: data.page,
      perPage: data.per_page,
      totalResults: data.total_results,
      collections: data.collections.map(collection => ({
        id: collection.id,
        title: collection.title,
        description: collection.description,
        private: collection.private,
        mediaCount: collection.media_count,
        photosCount: collection.photos_count,
        videosCount: collection.videos_count,
      })),
      nextPage: data.next_page,
      prevPage: data.prev_page,
      rateLimit: response.rateLimit,
    };
  }

  /**
   * Get user's collections (requires auth)
   * @param {number} perPage - Number of results per page (default: 15, max: 80)
   * @param {number} page - Page number (default: 1)
   * @returns {Promise<Object>} User collections
   */
  async getUserCollections(perPage = 15, page = 1) {
    if (!this.isConfigured()) {
      throw new Error('Pexels API key not configured');
    }

    const path = `/v1/collections?per_page=${perPage}&page=${page}`;
    const response = await this.makeRequest(path);
    const data = response.data;

    return {
      page: data.page,
      perPage: data.per_page,
      totalResults: data.total_results,
      collections: data.collections.map(collection => ({
        id: collection.id,
        title: collection.title,
        description: collection.description,
        private: collection.private,
        mediaCount: collection.media_count,
        photosCount: collection.photos_count,
        videosCount: collection.videos_count,
      })),
      nextPage: data.next_page,
      prevPage: data.prev_page,
      rateLimit: response.rateLimit,
    };
  }

  /**
   * Get media from a collection
   * @param {string} id - Collection ID
   * @param {number} perPage - Number of results per page (default: 15, max: 80)
   * @param {number} page - Page number (default: 1)
   * @param {string} type - Media type filter ('photos', 'videos', or undefined for all)
   * @returns {Promise<Object>} Collection media
   */
  async getCollectionMedia(id, perPage = 15, page = 1, type) {
    if (!this.isConfigured()) {
      throw new Error('Pexels API key not configured');
    }

    // Validate ID
    if (!id || (typeof id !== 'string' && typeof id !== 'number')) {
      throw new Error('Invalid collection ID');
    }

    let path = `/v1/collections/${id}?per_page=${perPage}&page=${page}`;
    if (type) {
      path += `&type=${encodeURIComponent(type)}`;
    }

    const response = await this.makeRequest(path);
    const data = response.data;

    return {
      page: data.page,
      perPage: data.per_page,
      totalResults: data.total_results,
      id: data.id,
      media: data.media.map(item => {
        if (item.type === 'Photo') {
          return {
            type: 'Photo',
            id: item.id,
            width: item.width,
            height: item.height,
            url: item.url,
            photographer: item.photographer,
            photographerUrl: item.photographer_url,
            avgColor: item.avg_color,
            src: item.src,
            alt: item.alt,
          };
        } else if (item.type === 'Video') {
          return {
            type: 'Video',
            id: item.id,
            width: item.width,
            height: item.height,
            url: item.url,
            image: item.image,
            duration: item.duration,
            user: item.user,
            videoFiles: item.video_files,
            videoPictures: item.video_pictures,
          };
        }
        return item;
      }),
      nextPage: data.next_page,
      prevPage: data.prev_page,
      rateLimit: response.rateLimit,
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
          rateLimit: testResult.rateLimit,
        },
      };
    } catch (error) {
      console.error('❌ Pexels API connection failed:', error.message);

      // Parse error to provide helpful feedback
      let message = 'Pexels API connection failed';
      let errorType = 'unknown';

      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        message = 'Invalid API key. Please check your PEXELS_API_KEY';
        errorType = 'authentication';
      } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
        message = 'API key lacks required permissions';
        errorType = 'authentication';
      } else if (error.message.includes('429') || error.message.includes('Rate Limit')) {
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
