/**
 * EventFlow Hero Bento Grid Controller
 * Handles video playback, media loading, and interaction observers
 */

class BentoHeroController {
  constructor() {
    this.videoElement = null;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1 second between retries
    this.intersectionObserver = null;
    this.visibilityHandler = null;
    this.isVideoPlaying = false;
    this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Backend proxy endpoints for secure API access (no API key needed on client)
    this.apiTimeout = 8000; // 8 second timeout for API requests

    // Collage widget settings from backend
    this.settings = null;

    // Category queries for Pexels
    this.categoryQueries = {
      venues: 'wedding venue elegant',
      catering: 'elegant catering food',
      entertainment: 'live music band',
      photography: 'wedding photographer',
    };

    // Fallback images for when API is unavailable
    this.fallbackImages = {
      venues: '/assets/images/collage-venue.jpg',
      catering: '/assets/images/collage-catering.jpg',
      entertainment: '/assets/images/collage-entertainment.jpg',
      photography: '/assets/images/collage-photography.jpg',
    };
  }

  /**
   * Fetch collage widget settings from backend
   */
  async fetchSettings() {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);

      const response = await fetch('/api/public/homepage-settings', {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn('[Bento Hero] Failed to fetch settings, widget will be disabled');
        return { enabled: false }; // Safe default: disable widget
      }

      const data = await response.json();
      const settings = data.collageWidget || { enabled: false };
      console.log('[Bento Hero] Settings loaded:', settings);
      return settings;
    } catch (error) {
      console.warn('[Bento Hero] Error fetching settings, widget will be disabled:', error);
      return { enabled: false }; // Safe default: disable widget on error
    }
  }

  /**
   * Initialize the bento grid with video and images
   */
  async init() {
    console.log('[Bento Hero] Initializing...');

    // Fetch settings from backend first
    this.settings = await this.fetchSettings();

    // Find the hero cell
    const heroCell = document.querySelector('.ef-bento-hero');
    if (!heroCell) {
      console.warn('[Bento Hero] Hero cell not found');
      return;
    }

    this.videoElement = heroCell.querySelector('video');

    if (!this.videoElement) {
      console.warn('[Bento Hero] Video element not found');
      return;
    }

    // Check if collage widget is enabled (default to false if not set)
    const isEnabled = this.settings?.enabled === true;
    const source = this.settings?.source || 'pexels';

    console.log('[Bento Hero] Widget enabled:', isEnabled, 'Source:', source);

    if (!isEnabled) {
      console.log('[Bento Hero] Collage widget is disabled, using static images');
      this.showFallbackImages();
      return;
    }

    // Load images based on source
    if (source === 'pexels') {
      // Setup video playback
      await this.initializeVideo();

      // Load category images from Pexels
      await this.loadCategoryImages();
    } else if (source === 'uploads') {
      console.log('[Bento Hero] Source is uploads, loading uploaded media');
      await this.loadUploadedMedia();
    } else {
      console.log('[Bento Hero] Unknown source, using fallback images');
      this.showFallbackImages();
    }

    // Setup observers for performance (regardless of source)
    this.setupIntersectionObserver();
    this.setupVisibilityObserver();

    console.log('[Bento Hero] Initialization complete');
  }

  /**
   * Initialize video with retry logic and fallback handling
   */
  async initializeVideo() {
    // If user prefers reduced motion, show static poster instead
    if (this.prefersReducedMotion) {
      console.log('[Bento Hero] Reduced motion preference detected, showing static poster');
      this.showVideoPoster();
      return;
    }

    // Add loading state
    const heroCell = this.videoElement.closest('.ef-bento-hero');
    if (heroCell) {
      heroCell.classList.add('loading');
    }

    try {
      // Fetch hero video from Pexels
      const videoUrl = await this.fetchHeroVideo();

      if (!videoUrl) {
        console.warn('[Bento Hero] No video URL received, using fallback');
        this.showVideoPoster();
        return;
      }

      // Set video source
      const source = this.videoElement.querySelector('source') || document.createElement('source');
      source.src = videoUrl;
      source.type = 'video/mp4';

      if (!this.videoElement.querySelector('source')) {
        this.videoElement.appendChild(source);
      }

      // Attempt to load and play video
      await this.attemptVideoPlayback();
    } catch (error) {
      console.error('[Bento Hero] Video initialization failed:', error);
      this.showVideoPoster();
    } finally {
      if (heroCell) {
        heroCell.classList.remove('loading');
      }
    }
  }

  /**
   * Attempt to load and play video with retry logic
   */
  async attemptVideoPlayback() {
    return new Promise((resolve, reject) => {
      let resolved = false;

      const onSuccess = () => {
        if (resolved) {
          return;
        }
        resolved = true;
        this.videoElement.classList.add('loaded');
        this.isVideoPlaying = true;
        console.log('[Bento Hero] Video loaded successfully');
        resolve();
      };

      const onError = error => {
        if (resolved) {
          return;
        }

        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`[Bento Hero] Retry attempt ${this.retryCount}/${this.maxRetries}`);

          setTimeout(() => {
            this.videoElement.load();
          }, this.retryDelay);
        } else {
          resolved = true;
          console.error('[Bento Hero] Video failed after retries:', error);
          this.setupPlayOnInteraction();
          reject(error);
        }
      };

      // Setup event listeners
      this.videoElement.addEventListener('canplay', onSuccess, { once: true });
      this.videoElement.addEventListener('loadeddata', onSuccess, { once: true });
      this.videoElement.addEventListener('error', onError, { once: true });

      // Try to load the video
      this.videoElement.load();

      // Try to play (may require user interaction in some browsers)
      const playPromise = this.videoElement.play();

      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            onSuccess();
          })
          .catch(error => {
            // Autoplay was prevented (common on mobile)
            console.log('[Bento Hero] Autoplay prevented, will play on interaction');
            this.setupPlayOnInteraction();
            resolve(); // Don't reject, just setup interaction handler
          });
      }

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          console.warn('[Bento Hero] Video load timeout');
          this.setupPlayOnInteraction();
          resolve();
        }
      }, 10000);
    });
  }

  /**
   * Setup play-on-interaction as fallback for restrictive browsers
   */
  setupPlayOnInteraction() {
    console.log('[Bento Hero] Setting up play-on-interaction');

    const heroCell = this.videoElement.closest('.ef-bento-hero');
    if (!heroCell) {
      return;
    }

    const playOnClick = () => {
      this.videoElement
        .play()
        .then(() => {
          this.videoElement.classList.add('loaded');
          this.isVideoPlaying = true;
          console.log('[Bento Hero] Video playing after user interaction');
          heroCell.removeEventListener('click', playOnClick);
        })
        .catch(error => {
          console.error('[Bento Hero] Play on interaction failed:', error);
          this.showVideoPoster();
        });
    };

    heroCell.addEventListener('click', playOnClick, { once: true });
    heroCell.style.cursor = 'pointer';
  }

  /**
   * Show video poster as fallback
   */
  showVideoPoster() {
    const heroCell = this.videoElement.closest('.ef-bento-hero');
    if (heroCell) {
      heroCell.classList.remove('loading');
    }

    // Video will show poster attribute automatically
    this.videoElement.style.display = 'none';

    // If there's a fallback image element, show it
    const fallback = heroCell?.querySelector('.video-fallback');
    if (fallback) {
      fallback.style.display = 'block';
    }
  }

  /**
   * Fetch hero video from Pexels API via backend proxy
   */
  async fetchHeroVideo() {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);

      const response = await fetch(
        `/api/public/pexels/video?query=wedding+celebration&orientation=landscape`,
        {
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error('[Bento Hero] Backend proxy error:', response.status);
        return null;
      }

      const data = await response.json();

      if (!data.success) {
        console.error('[Bento Hero] Proxy returned error:', data.message);
        return null;
      }

      if (data.fallback || !data.video || !data.video.url) {
        console.warn('[Bento Hero] No video URL received or fallback mode, using static poster');
        return null;
      }

      console.log('[Bento Hero] Video URL fetched:', data.video.url);
      return data.video.url;
    } catch (error) {
      console.error('[Bento Hero] Failed to fetch video:', error);
      return null;
    }
  }

  /**
   * Load category images from Pexels API via backend proxy with fallback handling
   */
  async loadCategoryImages() {
    const categories = ['venues', 'catering', 'entertainment', 'photography'];

    // Use Promise.allSettled to handle all requests even if some fail
    const imagePromises = categories.map(async category => {
      try {
        const cell = document.querySelector(`.ef-bento-${category}`);
        if (!cell) {
          return { category, success: false, reason: 'Cell not found' };
        }

        const imageUrl = await this.fetchCategoryImage(category);

        if (imageUrl) {
          const img = cell.querySelector('img');
          if (img) {
            img.src = imageUrl;
            img.classList.add('loaded');
            return { category, success: true };
          }
        }

        // If no image URL, show fallback
        const img = cell.querySelector('img');
        if (img && this.fallbackImages[category]) {
          img.src = this.fallbackImages[category];
          img.classList.add('loaded');
          console.log(`[Bento Hero] Using fallback image for ${category}`);
          return { category, success: true, fallback: true };
        }

        return { category, success: false, reason: 'No image available' };
      } catch (_error) {
        console.error(`[Bento Hero] Failed to load ${category} image:`, _error);

        // Show fallback on error
        const cell = document.querySelector(`.ef-bento-${category}`);
        if (cell) {
          const img = cell.querySelector('img');
          if (img && this.fallbackImages[category]) {
            img.src = this.fallbackImages[category];
            img.classList.add('loaded');
            console.log(`[Bento Hero] Using fallback image for ${category} after error`);
          }
        }

        return { category, success: false, error: _error.message };
      }
    });

    const results = await Promise.allSettled(imagePromises);

    // Log results
    const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    console.log(`[Bento Hero] Loaded ${successCount}/${categories.length} category images`);
  }

  /**
   * Fetch a single category image from Pexels via backend proxy
   */
  async fetchCategoryImage(category) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.apiTimeout);

      // Use custom query from settings if available, otherwise use default
      const customQueries = this.settings?.pexelsQueries || {};
      const query = customQueries[category] || this.categoryQueries[category] || category;

      const response = await fetch(
        `/api/public/pexels/photo?query=${encodeURIComponent(query)}&category=${category}`,
        {
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[Bento Hero] Backend proxy error for ${category}:`, response.status);
        return null;
      }

      const data = await response.json();

      if (!data.success) {
        console.error(`[Bento Hero] Proxy returned error for ${category}:`, data.message);
        return null;
      }

      if (data.fallback && data.photo?.src?.large) {
        console.log(`[Bento Hero] Using fallback photo for ${category}`);
        return data.photo.src.large;
      }

      if (!data.photo || !data.photo.src) {
        console.warn(`[Bento Hero] No photo found for ${category}`);
        return null;
      }

      // Return large size image
      return data.photo.src.large || data.photo.src.original;
    } catch (error) {
      console.error(`[Bento Hero] Failed to fetch ${category} image:`, error);
      return null;
    }
  }

  /**
   * Show fallback images for all categories
   * Used when API is unavailable or disabled
   */
  showFallbackImages() {
    console.log('[Bento Hero] Showing fallback images for all categories');

    const categories = ['venues', 'catering', 'entertainment', 'photography'];

    categories.forEach(category => {
      const cell = document.querySelector(`.ef-bento-${category}`);
      if (!cell) {
        return;
      }

      const img = cell.querySelector('img');
      if (img && this.fallbackImages[category]) {
        img.src = this.fallbackImages[category];
        img.classList.add('loaded');
        console.log(`[Bento Hero] Set fallback image for ${category}`);
      }
    });
  }

  /**
   * Load uploaded media from settings
   * Used when source is 'uploads' instead of 'pexels'
   */
  async loadUploadedMedia() {
    console.log('[Bento Hero] Loading uploaded media from settings');

    const uploadGallery = this.settings?.uploadGallery || [];

    if (uploadGallery.length === 0) {
      console.warn('[Bento Hero] No uploaded media found in settings');
      this.showFallbackImages();
      return;
    }

    const categories = ['venues', 'catering', 'entertainment', 'photography'];

    // Distribute uploaded media across categories
    categories.forEach((category, index) => {
      const cell = document.querySelector(`.ef-bento-${category}`);
      if (!cell) {
        return;
      }

      // Use modulo to cycle through uploaded media if there are fewer than 4 items
      const mediaIndex = index % uploadGallery.length;
      const mediaUrl = uploadGallery[mediaIndex];

      const img = cell.querySelector('img');
      if (img && mediaUrl) {
        img.src = mediaUrl;
        img.classList.add('loaded');
        console.log(`[Bento Hero] Set uploaded media for ${category}: ${mediaUrl}`);
      }
    });
  }

  /**
   * Setup Intersection Observer to pause video when out of viewport
   */
  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window) || !this.videoElement) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Video is visible, resume if it was playing
            if (this.isVideoPlaying && this.videoElement.paused) {
              this.videoElement.play().catch(() => {
                // Ignore play errors when resuming
              });
            }
          } else {
            // Video is not visible, pause to save resources
            if (!this.videoElement.paused) {
              this.videoElement.pause();
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    const heroCell = this.videoElement.closest('.ef-bento-hero');
    if (heroCell) {
      this.intersectionObserver.observe(heroCell);
    }
  }

  /**
   * Setup Visibility API observer to pause when tab is hidden
   */
  setupVisibilityObserver() {
    if (!this.videoElement) {
      return;
    }

    this.visibilityHandler = () => {
      if (document.hidden) {
        // Tab is hidden, pause video
        if (!this.videoElement.paused) {
          this.videoElement.pause();
        }
      } else {
        // Tab is visible again, resume if it was playing
        if (this.isVideoPlaying && this.videoElement.paused) {
          this.videoElement.play().catch(() => {
            // Ignore play errors when resuming
          });
        }
      }
    };

    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  /**
   * Cleanup observers and event listeners
   */
  cleanup() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }

    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
    }
  }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Only initialize if bento grid exists on page
  const bentoGrid = document.querySelector('.ef-hero-bento');
  if (!bentoGrid) {
    console.log('[Bento Hero] Not found on this page, skipping initialization');
    return;
  }

  const bentoController = new BentoHeroController();
  bentoController.init();

  // Store reference for cleanup
  window.__bentoHeroController = bentoController;
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (window.__bentoHeroController) {
    window.__bentoHeroController.cleanup();
  }
});
