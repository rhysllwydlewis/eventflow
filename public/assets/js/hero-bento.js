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
    
    // Pexels API configuration
    this.pexelsApiKey = 'QGmVgdOKJwPPKOSRIcXr2eJGUbyRb5GEeHzv9y9Zg5LMDQBmKEqZD9RJ';
    this.pexelsBaseUrl = 'https://api.pexels.com/v1';
    
    // Category queries for Pexels
    this.categoryQueries = {
      venues: 'wedding venue elegant',
      catering: 'elegant catering food',
      entertainment: 'live music band',
      photography: 'wedding photographer'
    };
  }

  /**
   * Initialize the bento grid with video and images
   */
  async init() {
    console.log('[Bento Hero] Initializing...');
    
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

    // Setup video playback
    await this.initializeVideo();
    
    // Setup observers for performance
    this.setupIntersectionObserver();
    this.setupVisibilityObserver();
    
    // Load category images from Pexels
    await this.loadCategoryImages();
    
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
        if (resolved) return;
        resolved = true;
        this.videoElement.classList.add('loaded');
        this.isVideoPlaying = true;
        console.log('[Bento Hero] Video loaded successfully');
        resolve();
      };

      const onError = (error) => {
        if (resolved) return;
        
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
          .catch((error) => {
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
    if (!heroCell) return;

    const playOnClick = () => {
      this.videoElement.play()
        .then(() => {
          this.videoElement.classList.add('loaded');
          this.isVideoPlaying = true;
          console.log('[Bento Hero] Video playing after user interaction');
          heroCell.removeEventListener('click', playOnClick);
        })
        .catch((error) => {
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
   * Fetch hero video from Pexels API
   */
  async fetchHeroVideo() {
    try {
      const response = await fetch(
        `${this.pexelsBaseUrl}/videos/search?query=wedding+celebration&per_page=15&orientation=landscape`,
        {
          headers: {
            'Authorization': this.pexelsApiKey
          }
        }
      );

      if (!response.ok) {
        console.error('[Bento Hero] Pexels API error:', response.status);
        return null;
      }

      const data = await response.json();
      
      if (!data.videos || data.videos.length === 0) {
        console.warn('[Bento Hero] No videos found');
        return null;
      }

      // Get a random video from the results
      const randomIndex = Math.floor(Math.random() * Math.min(5, data.videos.length));
      const video = data.videos[randomIndex];

      // Find HD video file
      const hdVideo = video.video_files.find(file => 
        file.quality === 'hd' && file.width <= 1920
      ) || video.video_files[0];

      console.log('[Bento Hero] Video URL fetched:', hdVideo.link);
      return hdVideo.link;
      
    } catch (error) {
      console.error('[Bento Hero] Failed to fetch video:', error);
      return null;
    }
  }

  /**
   * Load category images from Pexels API
   */
  async loadCategoryImages() {
    const categories = ['venues', 'catering', 'entertainment', 'photography'];
    
    for (const category of categories) {
      try {
        const cell = document.querySelector(`.ef-bento-${category}`);
        if (!cell) continue;

        const imageUrl = await this.fetchCategoryImage(category);
        
        if (imageUrl) {
          const img = cell.querySelector('img');
          if (img) {
            img.src = imageUrl;
            img.classList.add('loaded');
          }
        }
      } catch (error) {
        console.error(`[Bento Hero] Failed to load ${category} image:`, error);
      }
    }
  }

  /**
   * Fetch a single category image from Pexels
   */
  async fetchCategoryImage(category) {
    try {
      const query = this.categoryQueries[category] || category;
      const response = await fetch(
        `${this.pexelsBaseUrl}/search?query=${encodeURIComponent(query)}&per_page=15&orientation=landscape`,
        {
          headers: {
            'Authorization': this.pexelsApiKey
          }
        }
      );

      if (!response.ok) {
        console.error(`[Bento Hero] Pexels API error for ${category}:`, response.status);
        return null;
      }

      const data = await response.json();
      
      if (!data.photos || data.photos.length === 0) {
        console.warn(`[Bento Hero] No photos found for ${category}`);
        return null;
      }

      // Get a random photo from the results
      const randomIndex = Math.floor(Math.random() * Math.min(10, data.photos.length));
      const photo = data.photos[randomIndex];

      // Return large size image
      return photo.src.large || photo.src.original;
      
    } catch (error) {
      console.error(`[Bento Hero] Failed to fetch ${category} image:`, error);
      return null;
    }
  }

  /**
   * Setup Intersection Observer to pause video when out of viewport
   */
  setupIntersectionObserver() {
    if (!('IntersectionObserver' in window) || !this.videoElement) {
      return;
    }

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
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
    if (!this.videoElement) return;

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
