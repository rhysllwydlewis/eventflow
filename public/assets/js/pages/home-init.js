/**
 * Homepage initialization script
 * Handles featured packages, stats counters, notifications, and interactive elements
 */

// Set page identifier
window.__EF_PAGE__ = 'home';

/**
 * Check if debug logging is enabled
 * Checks both explicit window.DEBUG flag and development environment
 * @returns {boolean} True if debug logging should be enabled
 */
function isDebugEnabled() {
  return window.DEBUG || isDevelopmentEnvironment();
}

// Initialize homepage components on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize category grid
  if (typeof CategoryGrid !== 'undefined') {
    const categoryGrid = new CategoryGrid('category-grid-home');
    categoryGrid.loadCategories();
  }

  // Hide version label unless ?debug=1 is present
  const versionContainer = document.querySelector('.version');
  if (versionContainer) {
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.has('debug') || urlParams.get('debug') !== '1') {
      versionContainer.style.display = 'none';
    } else {
      // If debug mode, show version
      const versionLabel = document.getElementById('ef-version-label');
      if (versionLabel) {
        versionLabel.textContent = 'v17.0.0';
      }
    }
  }

  // Load and update hero collage images from admin-uploaded category photos
  loadHeroCollageImages();

  // Load featured packages
  loadPackagesCarousel({
    endpoint: '/api/packages/featured',
    containerId: 'featured-packages',
    emptyMessage: 'No featured packages available yet.',
  });

  // Load spotlight packages
  loadPackagesCarousel({
    endpoint: '/api/packages/spotlight',
    containerId: 'spotlight-packages',
    emptyMessage: 'No spotlight packages available yet.',
  });

  // Show notification bell for logged-in users using AuthStateManager
  const authState = window.__authState || window.AuthStateManager;
  if (authState) {
    // Subscribe to auth state changes
    authState.onchange(user => {
      const notificationBell = document.getElementById('notification-bell');
      if (notificationBell) {
        notificationBell.style.display = user ? 'block' : 'none';
      }

      // Initialize WebSocket connection for real-time notifications (only when logged in)
      if (user && typeof WebSocketClient !== 'undefined') {
        // WebSocket client is initialized here for real-time notification updates
        const _wsClient = new WebSocketClient({
          onNotification: _notification => {
            // Update notification badge
            const badge = document.querySelector('.notification-badge');
            if (badge) {
              badge.style.display = 'block';
              const current = parseInt(badge.textContent) || 0;
              badge.textContent = current + 1;
            }
          },
        });
        // Store reference if needed for cleanup
        window.__notificationWsClient = _wsClient;
      }
    });
  }

  // Fetch and render public stats
  fetchPublicStats();

  // Fetch and render marketplace preview
  fetchMarketplacePreview();

  // Fetch and render guides
  fetchGuides();

  // Fetch and render testimonials
  fetchTestimonials();

  // Initialize hero search with autocomplete
  initHeroSearch();

  // Initialize newsletter form
  initNewsletterForm();

  // Add parallax effect to collage
  initParallaxCollage();

  // Animate stat counters when they come into view (only if Counter and IntersectionObserver are available)
  if (typeof Counter === 'function' && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !entry.target.dataset.counted) {
            const target = parseInt(entry.target.dataset.counter);
            if (target > 0) {
              entry.target.dataset.counted = 'true';
              const counter = new Counter(entry.target, {
                target: target,
                duration: 2000,
                suffix: entry.target.dataset.suffix || '',
              });
              counter.animate();
            }
          }
        });
      },
      { threshold: 0.5 }
    );

    document.querySelectorAll('[data-counter]').forEach(el => {
      observer.observe(el);
    });
  }

  // Add ripple effect to CTA buttons (only if createRipple is available)
  if (typeof createRipple === 'function') {
    document.querySelectorAll('.cta').forEach(button => {
      if (!button.classList.contains('ripple-container')) {
        button.addEventListener('click', createRipple);
      }
    });
  }

  // Cleanup Pexels collage on page unload to prevent memory leaks
  window.addEventListener('beforeunload', () => {
    if (typeof cleanupPexelsCollage === 'function') {
      cleanupPexelsCollage();
    }
  });

  // Defensive fallback: Re-invoke collage initialization if it hasn't started
  // This handles cases where the initial DOMContentLoaded call returned early
  // or was skipped. The loadHeroCollageImages function is idempotent and will
  // guard against double initialization via window.__collageWidgetInitialized
  setTimeout(() => {
    if (!window.__collageWidgetInitialized) {
      if (isDebugEnabled()) {
        console.log('[Collage Debug] Initial load did not initialize, retrying...');
      }
      loadHeroCollageImages();
    }
  }, 1000);
});

/**
 * Shared helper to load packages carousel with skeleton, timeout, and retry
 * @param {Object} options - Configuration options
 * @param {string} options.endpoint - API endpoint to fetch packages from
 * @param {string} options.containerId - DOM container ID for carousel
 * @param {string} options.emptyMessage - Message to show when no packages found
 */
async function loadPackagesCarousel({ endpoint, containerId, emptyMessage }) {
  const container = document.getElementById(containerId);
  if (!container) {
    if (isDevelopmentEnvironment()) {
      console.warn(`Container ${containerId} not found`);
    }
    return;
  }

  // Show skeleton cards while loading
  container.innerHTML = `
    <div class="skeleton-carousel">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;

  // Create AbortController for timeout (8 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      // Silently handle 404s (endpoint not available in static/dev mode)
      if (response.status === 404) {
        container.innerHTML = `<p class="small">${emptyMessage}</p>`;
        return;
      }
      // Log other errors only in development
      if (isDevelopmentEnvironment()) {
        console.error(`Failed to load packages from ${endpoint} (HTTP ${response.status})`);
      }
      container.innerHTML = `<p class="small">${emptyMessage}</p>`;
      return;
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      container.innerHTML = `<p class="small">${emptyMessage}</p>`;
      return;
    }

    // Check if Carousel class is available
    if (typeof Carousel === 'undefined') {
      if (isDevelopmentEnvironment()) {
        console.error('Carousel class not loaded. Rendering fallback.');
      }
      renderPackageFallback(container, data.items);
      return;
    }

    // Initialize carousel
    try {
      const carousel = new Carousel(containerId, {
        itemsPerView: 3,
        itemsPerViewTablet: 2,
        itemsPerViewMobile: 1,
        autoScroll: true,
        autoScrollInterval: 5000,
      });
      carousel.setItems(data.items);
    } catch (error) {
      if (isDevelopmentEnvironment()) {
        console.error('Failed to initialize carousel:', error);
      }
      renderPackageFallback(container, data.items);
    }
  } catch (error) {
    clearTimeout(timeoutId);

    // Only log timeout errors and network errors, not expected 404s
    if (isDevelopmentEnvironment() && error.name !== 'AbortError') {
      console.error(`Failed to load packages from ${endpoint}:`, error);
    }

    // Show error with retry button for timeout/network errors
    const errorMessage =
      error.name === 'AbortError' ? 'Request timed out' : 'Unable to load packages';
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem;">
        <p class="small">${errorMessage}. Please try again.</p>
        <button class="cta secondary retry-packages-btn" aria-label="Retry loading packages">
          Retry
        </button>
      </div>
    `;

    // Attach retry handler
    const retryBtn = container.querySelector('.retry-packages-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => location.reload());
    }
  }
}

/**
 * Render packages in fallback grid format (when Carousel is unavailable)
 * @param {HTMLElement} container - Container element
 * @param {Array} items - Package items to render
 */
function renderPackageFallback(container, items) {
  // Helper to safely escape HTML
  const escape = text => {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  };

  // Validate and sanitize URLs to prevent XSS
  const sanitizeUrl = url => {
    if (!url) {
      return '/assets/images/placeholder-package.jpg';
    }
    const urlStr = String(url);
    // Block javascript:, data:, vbscript:, and file: URLs
    if (/^(javascript|data|vbscript|file):/i.test(urlStr)) {
      return '/assets/images/placeholder-package.jpg';
    }
    return escape(urlStr);
  };

  // Validate slug for URL safety
  const validateSlug = (value, fallbackId) => {
    const slugStr = String(value || '');
    // Only allow alphanumeric, hyphens, and underscores
    const cleaned = slugStr.replace(/[^a-zA-Z0-9_-]/g, '');
    // Fall back to provided id if slug becomes empty after cleaning
    return cleaned || String(fallbackId || 'unknown');
  };

  // Format price with £ symbol if it's a number
  const formatPrice = priceDisplay => {
    if (!priceDisplay) {
      return 'Contact for pricing';
    }
    const priceStr = String(priceDisplay);
    // If it's a plain number (integer or decimal), format as £X
    if (/^\d+(\.\d+)?$/.test(priceStr)) {
      return `£${priceStr}`;
    }
    // Otherwise return as-is
    return priceStr;
  };

  container.innerHTML = items
    .map(item => {
      const title = escape(item.title || 'Untitled Package');
      const supplierName = escape(item.supplier_name || '');
      const description = escape(item.description || '');
      const truncDesc =
        description.length > 100 ? `${description.substring(0, 100)}...` : description;
      const price = escape(formatPrice(item.price_display || item.price));
      const imgSrc = sanitizeUrl(item.image);
      const slug = encodeURIComponent(validateSlug(item.slug, item.id));

      return `
        <div class="card featured-fallback-card">
          <a href="/package.html?slug=${slug}" class="featured-fallback-link">
            <img src="${imgSrc}" alt="${title}" class="featured-fallback-img">
            <div class="featured-fallback-content">
              <h3 class="featured-fallback-title">${title}</h3>
              ${supplierName ? `<p class="featured-fallback-supplier">${supplierName}</p>` : ''}
              <p class="featured-fallback-desc">${truncDesc}</p>
              <div class="featured-fallback-price">${price}</div>
            </div>
          </a>
        </div>
      `;
    })
    .join('');
}

/**
 * Detect if running in a development environment
 * @returns {boolean} true if hostname matches common development patterns, false otherwise
 *
 * Development environments include:
 * - localhost and loopback addresses (127.0.0.1, ::1)
 * - mDNS .local domains
 * - Private IP ranges (10.x, 172.16-31.x, 192.168.x)
 * - Link-local addresses (169.254.x)
 */
function isDevelopmentEnvironment() {
  const hostname = window.location.hostname;

  // Quick checks for common cases
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local')
  ) {
    return true;
  }

  // Private IP ranges
  if (hostname.startsWith('192.168.') || hostname.startsWith('10.')) {
    return true;
  }

  // 172.16.0.0/12 range (172.16.x.x to 172.31.x.x)
  const PRIVATE_172_RANGE_START = 16;
  const PRIVATE_172_RANGE_END = 31;
  if (hostname.startsWith('172.')) {
    const parts = hostname.split('.');
    if (parts.length >= 2) {
      const secondOctet = parseInt(parts[1], 10);
      if (secondOctet >= PRIVATE_172_RANGE_START && secondOctet <= PRIVATE_172_RANGE_END) {
        return true;
      }
    }
  }

  // Link-local address range
  if (hostname.startsWith('169.254.')) {
    return true;
  }

  return false;
}

async function loadHeroCollageImages() {
  // Check if collage widget is enabled via /api/public/homepage-settings endpoint
  // Guard against double initialization
  if (window.__collageWidgetInitialized) {
    return;
  }

  try {
    // Add AbortController with 2 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const settingsResponse = await fetch('/api/public/homepage-settings', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (settingsResponse?.ok) {
      const settings = await settingsResponse.json();

      // Check new collageWidget format first, fallback to legacy pexelsCollageEnabled
      const collageWidget = settings.collageWidget;
      const legacyEnabled = settings.pexelsCollageEnabled === true;

      // Debug logging to help diagnose issues
      if (isDebugEnabled()) {
        console.log('[Collage Debug] Settings received:', {
          collageWidgetEnabled: collageWidget?.enabled,
          legacyEnabled: legacyEnabled,
          source: collageWidget?.source,
          hasQueries: !!collageWidget?.pexelsQueries,
          hasUploadGallery: !!collageWidget?.uploadGallery?.length,
        });
      }

      // Determine if collage should be enabled (matches backend logic)
      // If collageWidget.enabled is explicitly set, use it; otherwise use legacy flag
      const collageEnabled =
        collageWidget?.enabled !== undefined ? collageWidget.enabled : legacyEnabled;

      // Validate JSON structure - check if collage is enabled
      if (settings && typeof settings === 'object' && collageEnabled === true) {
        if (isDebugEnabled()) {
          console.log('[Collage Debug] Collage widget enabled, initializing dynamic collage');
        }
        window.__collageWidgetInitialized = true;

        // Initialize collage with new widget format or legacy format
        // Use collageWidget if it's explicitly enabled, otherwise use legacy
        if (collageWidget?.enabled === true) {
          if (isDebugEnabled()) {
            console.log('[Collage Debug] Using new collageWidget format');
          }
          await initCollageWidget(collageWidget);
        } else {
          // Legacy Pexels format
          if (isDebugEnabled()) {
            console.log('[Collage Debug] Using legacy Pexels format', {
              hasSettings: !!settings.pexelsCollageSettings,
              queries: settings.pexelsCollageSettings?.queries,
              intervalSeconds: settings.pexelsCollageSettings?.intervalSeconds,
            });
          }
          await initPexelsCollage(settings.pexelsCollageSettings);
        }
        return; // Skip static image loading
      }
    }
  } catch (error) {
    // Fall back to static images on error, timeout, or invalid JSON
    // Only log in debug mode to avoid console spam
    if (window.DEBUG) {
      console.log('Collage widget check failed, falling back to static images');
    }
  }

  // If collage widget is not enabled or failed, load static images
  try {
    const response = await fetch('/api/admin/homepage/hero-images-public');
    if (!response.ok) {
      // Silently use defaults if endpoint not available
      return;
    }

    const heroImages = await response.json();

    // Validate API response
    if (!heroImages || typeof heroImages !== 'object') {
      console.error('Invalid hero images data received from API');
      return;
    }

    // Generate a single timestamp for cache busting all images in this execution
    const cacheBustTimestamp = Date.now();

    // Map category keys to their collage frame elements
    const categoryMapping = {
      venues: 0,
      catering: 1,
      entertainment: 2,
      photography: 3,
    };

    // Get all collage frames
    const collageFrames = document.querySelectorAll('.collage .frame');

    // Validate DOM elements exist
    if (!collageFrames || collageFrames.length === 0) {
      return;
    }

    Object.keys(categoryMapping).forEach(category => {
      const imageUrl = heroImages[category];

      // Validate URL exists and is a non-empty string
      if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
        return;
      }

      const frameIndex = categoryMapping[category];
      const frame = collageFrames[frameIndex];

      // Ensure frame element exists
      if (!frame) {
        return;
      }

      // Find the img element within this frame
      const imgElement = frame.querySelector('img');
      const pictureElement = frame.querySelector('picture');

      // Ensure both elements exist before attempting update
      if (!imgElement) {
        return;
      }

      if (!pictureElement) {
        return;
      }

      // Check if this is a custom uploaded image (not default)
      // Additional safety check before calling includes()
      const isCustomImage =
        imageUrl && typeof imageUrl === 'string' && !imageUrl.includes('/assets/images/collage-');

      // Get the current image URL (without query params for comparison)
      const currentImageUrl = imgElement.src ? imgElement.src.split('?')[0] : '';
      const normalizedImageUrl = imageUrl ? imageUrl.split('?')[0] : '';

      // Determine if we need to update based on URL comparison
      // Add null checks before accessing string methods
      const needsUpdate =
        normalizedImageUrl && currentImageUrl
          ? !currentImageUrl.endsWith((normalizedImageUrl.split('/').pop() ?? '') || '')
          : false;

      // Skip update if URL matches and it's a default image
      if (!needsUpdate && !isCustomImage) {
        return;
      }

      try {
        // Add cache busting to force fresh load of custom images
        let cacheBustedUrl;
        if (isCustomImage) {
          // For custom images, add cache busting timestamp
          cacheBustedUrl = imageUrl.includes('?')
            ? `${imageUrl}&t=${cacheBustTimestamp}`
            : `${imageUrl}?t=${cacheBustTimestamp}`;
        } else {
          // For default images, use URL as-is
          cacheBustedUrl = imageUrl;
        }

        // Update the image source
        imgElement.src = cacheBustedUrl;
        imgElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - ${isCustomImage ? 'custom uploaded' : 'default'} hero image`;

        // Add onerror handler to fallback gracefully if the image fails to load
        imgElement.onerror = function () {
          // Fallback to default image for this category
          const defaultImages = {
            venues: '/assets/images/collage-venue.jpg',
            catering: '/assets/images/collage-catering.jpg',
            entertainment: '/assets/images/collage-entertainment.jpg',
            photography: '/assets/images/collage-photography.jpg',
          };

          // Unique gradient colors per category (matching HTML onerror handlers)
          const gradientFallbacks = {
            venues: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            catering: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            entertainment: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            photography: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
          };

          // Only attempt fallback once to prevent infinite loop
          // Use endsWith for more robust URL comparison
          if (!this.src || !this.src.endsWith(defaultImages[category])) {
            this.src = defaultImages[category];
          } else {
            // If even the default fails, show a gradient placeholder
            this.style.background = gradientFallbacks[category] || gradientFallbacks.venues;
            this.style.minHeight = '200px';
            this.src = '';
            this.onerror = null;
          }
        };

        // Handle <source> element for responsive images
        const sourceElement = pictureElement.querySelector('source');
        if (isCustomImage) {
          // For custom images, remove source element to use single img
          if (sourceElement) {
            sourceElement.remove();
          }
        } else if (!sourceElement) {
          // For default images, recreate the source element if it was removed
          const newSource = document.createElement('source');
          newSource.type = 'image/webp';
          // Convert .jpg to .webp for the source
          newSource.srcset = imageUrl.replace('.jpg', '.webp');
          pictureElement.insertBefore(newSource, imgElement);
        }
      } catch (updateError) {
        // Only log errors in development mode
        if (isDevelopmentEnvironment()) {
          console.error(`Failed to update image for category ${category}:`, updateError);
        }
      }
    });
  } catch (error) {
    // Default images will remain if there's an error
  }
}

/**
 * Initialize Pexels dynamic collage
 * Fetches images from Pexels API and cycles them with crossfade transitions
 */

// Crossfade transition duration (must match CSS transition in index.html)
const PEXELS_TRANSITION_DURATION_MS = 1000;
// Preload timeout to prevent hanging
const PEXELS_PRELOAD_TIMEOUT_MS = 5000;
// Delay before restoring transition after instant hide (allows time for reflow)
const TRANSITION_RESTORE_DELAY_MS = 50;

// Store interval ID for cleanup
let pexelsCollageIntervalId = null;

/**
 * Validate Pexels photographer URL
 * Only allows HTTPS URLs from pexels.com domain for security
 * @param {string} url - URL to validate
 * @returns {string} Validated URL or fallback
 */
function validatePexelsUrl(url) {
  if (!url || typeof url !== 'string') {
    return 'https://www.pexels.com';
  }
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === 'https:' && urlObj.hostname.endsWith('pexels.com')) {
      return url;
    }
  } catch (e) {
    // Invalid URL
  }
  return 'https://www.pexels.com';
}

/**
 * Restore default image for a collage frame
 * Sets opacity to 1 and restores original src if available
 * @param {HTMLImageElement} imgElement - Image element to restore
 */
function restoreDefaultImage(imgElement) {
  if (!imgElement) {
    return;
  }
  // Restore default image from stored original src
  if (imgElement.dataset.originalSrc) {
    imgElement.src = imgElement.dataset.originalSrc;
  }
  // Restore full opacity
  imgElement.style.opacity = '1';
}

/**
 * Display a Pexels image in a collage frame
 * Helper function to avoid code duplication in preload success/timeout handlers
 * @param {HTMLImageElement} imgElement - Image element to update
 * @param {HTMLElement} frame - Frame element containing the image
 * @param {Object} imageData - Image data with url and photographer
 * @param {string} category - Category name for alt text
 */
function displayPexelsImage(imgElement, frame, imageData, category) {
  imgElement.src = imageData.url;
  imgElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Photo by ${imageData.photographer}`;
  imgElement.style.opacity = '1';
  frame.classList.remove('loading-pexels');
  addPhotographerCredit(frame, imageData);
}

/**
 * Restore default image for a frame that failed to load Pexels image
 * Helper function to avoid code duplication in error handling paths
 * @param {HTMLElement} frame - Frame element
 * @param {Object} categoryMapping - Mapping of categories to frame indices
 * @param {string} category - Category name
 */
function restoreFrameDefault(collageFrames, categoryMapping, category) {
  const frameIndex = categoryMapping[category];
  const frame = collageFrames[frameIndex];
  if (frame) {
    const imgElement = frame.querySelector('img');
    if (imgElement) {
      restoreDefaultImage(imgElement);
      frame.classList.remove('loading-pexels');
    }
  }
}

async function initPexelsCollage(settings) {
  // Use intervalSeconds from settings, fallback to old 'interval' property for backwards compatibility, default to 2.5 seconds
  const intervalSeconds = settings?.intervalSeconds ?? settings?.interval ?? 2.5;
  const intervalMs = intervalSeconds * 1000;

  // Map category keys to their collage frame elements
  const categoryMapping = {
    venues: 0,
    catering: 1,
    entertainment: 2,
    photography: 3,
  };

  // Get all collage frames
  const collageFrames = document.querySelectorAll('.collage .frame');

  if (!collageFrames || collageFrames.length === 0) {
    if (isDevelopmentEnvironment()) {
      console.warn('No collage frames found for Pexels collage');
    }
    return;
  }

  // Add loading states to frames and clear default images
  collageFrames.forEach(frame => {
    frame.classList.add('loading-pexels');
    // Hide default images immediately when switching to Pexels mode
    const imgElement = frame.querySelector('img');
    if (imgElement) {
      // Store original src for fallback (only if it has a valid src)
      if (!imgElement.dataset.originalSrc && imgElement.src) {
        imgElement.dataset.originalSrc = imgElement.src;
      }
      // Disable transition temporarily for instant hide
      const originalTransition = imgElement.style.transition;
      imgElement.style.transition = 'none';
      // Clear the image to prevent default from showing under loading state
      imgElement.style.opacity = '0';
      // Force reflow to ensure transition:none is applied before opacity changes
      // This prevents the CSS transition from affecting the opacity change
      void imgElement.offsetHeight;
      // Restore transition after a brief delay
      setTimeout(() => {
        imgElement.style.transition = originalTransition;
      }, TRANSITION_RESTORE_DELAY_MS);
    }
  });

  // Cache for storing fetched images per category
  const imageCache = {};
  const currentImageIndex = {};

  // Fetch images for each category
  try {
    const categories = Object.keys(categoryMapping);
    for (const category of categories) {
      try {
        // Use the public Pexels collage endpoint (in admin routes but publicly accessible)
        const response = await fetch(
          `/api/admin/public/pexels-collage?category=${encodeURIComponent(category)}`
        );

        if (!response.ok) {
          // Parse error response for better logging with safer error handling
          let errorInfo = `HTTP ${response.status}`;
          try {
            const errorData = await response.json();
            // Safely extract error info with validation
            if (errorData && typeof errorData === 'object') {
              errorInfo = String(errorData.message || errorData.error || errorInfo);
            }

            // Only warn in development mode
            if (isDevelopmentEnvironment()) {
              console.warn(`⚠️  Failed to fetch Pexels images for ${category}: ${errorInfo}`);
              if (errorData.errorType) {
                console.warn(`   Error type: ${String(errorData.errorType)}`);
              }
            }
          } catch (e) {
            // Response wasn't valid JSON, use status text
            if (isDevelopmentEnvironment()) {
              console.warn(
                `⚠️  Failed to fetch Pexels images for ${category}: ${response.statusText}`
              );
            }
          }
          // Restore default for this category since fetch failed
          restoreFrameDefault(collageFrames, categoryMapping, category);
          continue;
        }

        const data = await response.json();

        // Validate response structure
        if (!data || typeof data !== 'object') {
          if (isDevelopmentEnvironment()) {
            console.warn(`⚠️  Invalid response structure for ${category}`);
          }
          // Restore default for this category since response is invalid
          restoreFrameDefault(collageFrames, categoryMapping, category);
          continue;
        }

        // Log if using fallback mode (only in development)
        if (isDevelopmentEnvironment() && data.usingFallback) {
          console.log(`📦 Using fallback photos for ${category} (source: ${data.source})`);
        }

        if (data.photos && Array.isArray(data.photos) && data.photos.length > 0) {
          // Validate and map photo data with null safety
          imageCache[category] = data.photos
            .filter(photo => {
              // Validate photo has required fields
              return (
                photo &&
                typeof photo === 'object' &&
                photo.src &&
                (photo.src.large || photo.src.original) &&
                photo.photographer
              );
            })
            .map(photo => ({
              url: photo.src.large || photo.src.original,
              photographer: String(photo.photographer),
              photographerUrl: validatePexelsUrl(photo.photographer_url),
            }));

          if (imageCache[category].length === 0) {
            if (isDevelopmentEnvironment()) {
              console.warn(`⚠️  No valid photos after filtering for ${category}`);
            }
            // Restore default for this category since no valid photos
            restoreFrameDefault(collageFrames, categoryMapping, category);
            continue;
          }

          currentImageIndex[category] = 0;

          // Set initial image
          const frameIndex = categoryMapping[category];
          const frame = collageFrames[frameIndex];
          const imgElement = frame.querySelector('img');

          if (imgElement && imageCache[category][0]) {
            // Preload the first image before displaying it to prevent default image flash
            const firstImage = new Image();
            const imageData = imageCache[category][0];
            firstImage.src = imageData.url;

            // Set timeout for preload to prevent hanging
            const preloadTimeout = setTimeout(() => {
              // If preload takes too long, show the image anyway
              if (isDevelopmentEnvironment()) {
                console.warn(
                  `⚠️  Initial image preload timeout for ${category}, displaying anyway`
                );
              }
              displayPexelsImage(imgElement, frame, imageData, category);
            }, PEXELS_PRELOAD_TIMEOUT_MS);

            firstImage.onload = () => {
              clearTimeout(preloadTimeout);
              // Image is preloaded, now set it and make visible
              displayPexelsImage(imgElement, frame, imageData, category);
            };

            firstImage.onerror = () => {
              clearTimeout(preloadTimeout);
              // Failed to load Pexels image, restore default
              if (isDevelopmentEnvironment()) {
                console.warn(
                  `⚠️  Failed to load initial image for ${category}: ${imageCache[category][0].url}`
                );
              }
              restoreDefaultImage(imgElement);
              frame.classList.remove('loading-pexels');
            };
          }
        }
      } catch (error) {
        // Only log errors in development mode
        if (isDevelopmentEnvironment()) {
          console.error(`❌ Error fetching Pexels images for ${category}:`, error);
        }
        // Restore default for this category since an error occurred
        restoreFrameDefault(collageFrames, categoryMapping, category);
      }
    }

    // Note: We don't do a cleanup loop here because the preload operations above are async.
    // Each frame's loading state and opacity will be handled by its respective
    // onload/onerror/timeout handlers in the preload logic above.

    // Start cycling images
    if (Object.keys(imageCache).length > 0) {
      // Clear any existing interval to prevent memory leaks
      if (pexelsCollageIntervalId) {
        clearInterval(pexelsCollageIntervalId);
      }

      pexelsCollageIntervalId = setInterval(() => {
        cyclePexelsImages(imageCache, currentImageIndex, collageFrames, categoryMapping);
      }, intervalMs);

      // Expose interval ID on window for debugging
      window.pexelsCollageIntervalId = pexelsCollageIntervalId;

      // Only log in development mode
      if (isDevelopmentEnvironment()) {
        console.log(
          `Pexels collage initialized with ${intervalSeconds}s interval (${Object.keys(imageCache).length} categories)`
        );
      }
    } else {
      // Only warn in development mode
      if (isDevelopmentEnvironment()) {
        console.warn('No Pexels images loaded, falling back to static images');
      }
      // Restore default images for all frames
      collageFrames.forEach(frame => {
        const imgElement = frame.querySelector('img');
        if (imgElement) {
          restoreDefaultImage(imgElement);
        }
      });
      // Note: Default images are now showing. We don't recursively call
      // loadHeroCollageImages() here to avoid the initialization guard issue.
      // The defaults are sufficient fallback.
    }
  } catch (error) {
    // Remove loading states from all frames on error
    collageFrames.forEach(frame => {
      frame.classList.remove('loading-pexels');
      // Restore default images on error
      const imgElement = frame.querySelector('img');
      if (imgElement) {
        restoreDefaultImage(imgElement);
      }
    });

    // Only log errors in development mode
    if (isDevelopmentEnvironment()) {
      console.error('Error initializing Pexels collage:', error);
    }
    // Note: Default images are now showing. We don't recursively call
    // loadHeroCollageImages() here to avoid the initialization guard issue.
    // The defaults are sufficient fallback.
  }
}

/**
 * Initialize Collage Widget with configurable source (Pexels or Uploads)
 * Supports both photos and videos with accessibility features
 * @param {Object} widgetConfig - Configuration from backend
 */
async function initCollageWidget(widgetConfig) {
  const { source, mediaTypes, intervalSeconds, pexelsQueries, uploadGallery, fallbackToPexels } =
    widgetConfig;

  const intervalMs = (intervalSeconds || 2.5) * 1000;

  // Debug logging
  if (isDebugEnabled()) {
    console.log('[Collage Widget] Initializing with config:', {
      source,
      hasMediaTypes: !!mediaTypes,
      intervalSeconds,
      hasQueries: !!pexelsQueries,
      uploadGalleryCount: uploadGallery?.length || 0,
      fallbackToPexels,
    });
  }

  // Map category keys to their collage frame elements
  const categoryMapping = {
    venues: 0,
    catering: 1,
    entertainment: 2,
    photography: 3,
  };

  // Get all collage frames
  const collageFrames = document.querySelectorAll('.collage .frame');

  if (!collageFrames || collageFrames.length === 0) {
    if (isDevelopmentEnvironment()) {
      console.warn('No collage frames found for collage widget');
    }
    return;
  }

  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion && isDevelopmentEnvironment()) {
    console.log('User prefers reduced motion, animations will be minimal');
  }

  try {
    const mediaCache = {};
    const currentMediaIndex = {};

    // Load media based on source
    if (source === 'uploads' && uploadGallery && uploadGallery.length > 0) {
      // Use uploaded media
      if (isDevelopmentEnvironment()) {
        console.log(`Loading ${uploadGallery.length} uploaded media files`);
      }

      // Distribute media across categories
      const categories = Object.keys(categoryMapping);
      categories.forEach((category, index) => {
        // Assign media to categories in a round-robin fashion
        mediaCache[category] = uploadGallery
          .filter((_, i) => i % categories.length === index)
          .map(url => {
            // Remove query parameters for extension detection
            const urlWithoutParams = url.split('?')[0];
            const isVideo = /\.(mp4|webm|mov)$/i.test(urlWithoutParams);
            return {
              url,
              type: isVideo ? 'video' : 'photo',
              category,
            };
          });
        currentMediaIndex[category] = 0;
      });
    } else if (source === 'pexels' || (fallbackToPexels && source === 'uploads')) {
      // Use Pexels API (fallback or primary)
      if (source === 'uploads' && fallbackToPexels) {
        if (isDebugEnabled()) {
          console.log('[Collage Widget] Upload gallery empty, falling back to Pexels');
        }
      }

      // Fetch from Pexels (reuse existing Pexels logic)
      const categories = Object.keys(categoryMapping);
      for (const category of categories) {
        try {
          const response = await fetch(
            `/api/admin/public/pexels-collage?category=${encodeURIComponent(category)}`
          );

          if (!response.ok) {
            if (isDebugEnabled()) {
              console.warn(
                `[Collage Widget] Failed to fetch Pexels media for ${category}: ${response.status}`
              );
            }
            restoreFrameDefault(collageFrames, categoryMapping, category);
            continue;
          }

          const data = await response.json();

          if (isDebugEnabled()) {
            console.log(
              `[Collage Widget] Fetched ${data.photos?.length || 0} photos for ${category} (source: ${data.source || 'unknown'})`
            );
          }

          if (data.photos && Array.isArray(data.photos) && data.photos.length > 0) {
            mediaCache[category] = data.photos
              .filter(photo => photo && photo.src && photo.photographer)
              .map(photo => ({
                url: photo.src.large || photo.src.original,
                type: 'photo',
                photographer: String(photo.photographer),
                photographerUrl: validatePexelsUrl(photo.photographer_url),
              }));

            if (mediaCache[category].length === 0) {
              if (isDebugEnabled()) {
                console.warn(`[Collage Widget] No valid photos after filtering for ${category}`);
              }
              restoreFrameDefault(collageFrames, categoryMapping, category);
              continue;
            }

            currentMediaIndex[category] = 0;

            if (isDebugEnabled()) {
              console.log(
                `[Collage Widget] Cached ${mediaCache[category].length} valid photos for ${category}`
              );
            }
          }
        } catch (error) {
          if (isDebugEnabled()) {
            console.error(`[Collage Widget] Error fetching Pexels media for ${category}:`, error);
          }
          restoreFrameDefault(collageFrames, categoryMapping, category);
        }
      }
    } else {
      // No valid source, restore defaults
      if (isDebugEnabled()) {
        console.warn('[Collage Widget] No valid media source configured');
      }
      collageFrames.forEach(frame => {
        const imgElement = frame.querySelector('img');
        if (imgElement) {
          restoreDefaultImage(imgElement);
        }
      });
      return;
    }

    // Initialize collage display
    const categories = Object.keys(mediaCache);
    if (categories.length === 0) {
      if (isDebugEnabled()) {
        console.warn('[Collage Widget] No media loaded, falling back to defaults');
      }
      collageFrames.forEach(frame => {
        const imgElement = frame.querySelector('img');
        if (imgElement) {
          restoreDefaultImage(imgElement);
        }
      });
      return;
    }

    // Set initial media for each category
    for (const category of categories) {
      const media = mediaCache[category];
      if (!media || media.length === 0) {
        continue;
      }

      const frameIndex = categoryMapping[category];
      const frame = collageFrames[frameIndex];
      const imgElement = frame.querySelector('img');

      if (imgElement && media[0]) {
        frame.classList.add('loading-pexels');

        // Hide default image
        const originalTransition = imgElement.style.transition;
        imgElement.style.transition = 'none';
        imgElement.style.opacity = '0';
        void imgElement.offsetHeight;
        setTimeout(() => {
          imgElement.style.transition = originalTransition;
        }, TRANSITION_RESTORE_DELAY_MS);

        // Load first media item
        await loadMediaIntoFrame(frame, imgElement, media[0], category, prefersReducedMotion);
      }
    }

    // Start cycling media
    if (Object.keys(mediaCache).length > 0) {
      if (pexelsCollageIntervalId) {
        clearInterval(pexelsCollageIntervalId);
      }

      pexelsCollageIntervalId = setInterval(() => {
        cycleWidgetMedia(
          mediaCache,
          currentMediaIndex,
          collageFrames,
          categoryMapping,
          prefersReducedMotion
        );
      }, intervalMs);

      // Expose interval ID on window for debugging
      window.pexelsCollageIntervalId = pexelsCollageIntervalId;

      if (isDevelopmentEnvironment()) {
        console.log(
          `Collage widget initialized with ${intervalSeconds}s interval (${Object.keys(mediaCache).length} categories)`
        );
      }
    }
  } catch (error) {
    if (isDevelopmentEnvironment()) {
      console.error('Error initializing collage widget:', error);
    }
    // Restore defaults on error
    collageFrames.forEach(frame => {
      frame.classList.remove('loading-pexels');
      const imgElement = frame.querySelector('img');
      if (imgElement) {
        restoreDefaultImage(imgElement);
      }
    });
  }
}

/**
 * Load media (photo or video) into a collage frame
 * @param {HTMLElement} frame - Frame element
 * @param {HTMLElement} mediaElement - Current media element (img)
 * @param {Object} media - Media object with url, type, etc.
 * @param {string} category - Category name
 * @param {boolean} prefersReducedMotion - User motion preference
 */
async function loadMediaIntoFrame(frame, mediaElement, media, category, prefersReducedMotion) {
  return new Promise(resolve => {
    const isVideo = media.type === 'video';

    if (isVideo) {
      // Clean up existing video if present
      const existingVideo = frame.querySelector('video');
      if (existingVideo) {
        existingVideo.pause();
        existingVideo.removeAttribute('src');
        existingVideo.load();
      }

      // Replace img with video element
      const video = document.createElement('video');
      video.src = media.url;
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.className = mediaElement.className;
      video.style.cssText = mediaElement.style.cssText;
      video.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Video`;

      // Accessibility: respect reduced motion
      if (prefersReducedMotion) {
        video.autoplay = false;
        video.loop = false;
      }

      // Use named functions for easier cleanup
      const handleLoadedData = () => {
        mediaElement.replaceWith(video);
        video.style.opacity = '1';
        frame.classList.remove('loading-pexels');

        // Add credit if from Pexels
        if (media.photographer) {
          addPhotographerCredit(frame, media);
        }

        resolve();
      };

      const handleError = () => {
        if (isDevelopmentEnvironment()) {
          console.warn(`Failed to load video: ${media.url}`);
        }
        restoreDefaultImage(mediaElement);
        frame.classList.remove('loading-pexels');
        resolve();
      };

      video.addEventListener('loadeddata', handleLoadedData, { once: true });
      video.addEventListener('error', handleError, { once: true });

      // Set timeout for video loading
      setTimeout(() => {
        if (frame.classList.contains('loading-pexels')) {
          if (isDevelopmentEnvironment()) {
            console.warn(`Video load timeout for ${category}`);
          }
          restoreDefaultImage(mediaElement);
          frame.classList.remove('loading-pexels');
          resolve();
        }
      }, PEXELS_PRELOAD_TIMEOUT_MS);
    } else {
      // Load photo
      const img = new Image();
      img.src = media.url;

      const preloadTimeout = setTimeout(() => {
        if (isDevelopmentEnvironment()) {
          console.warn(`Image preload timeout for ${category}`);
        }
        mediaElement.src = media.url;
        mediaElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Photo`;
        mediaElement.style.opacity = '1';
        frame.classList.remove('loading-pexels');

        if (media.photographer) {
          addPhotographerCredit(frame, media);
        }

        resolve();
      }, PEXELS_PRELOAD_TIMEOUT_MS);

      img.onload = () => {
        clearTimeout(preloadTimeout);
        mediaElement.src = media.url;
        mediaElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Photo`;
        mediaElement.style.opacity = '1';
        frame.classList.remove('loading-pexels');

        if (media.photographer) {
          addPhotographerCredit(frame, media);
        }

        resolve();
      };

      img.onerror = () => {
        clearTimeout(preloadTimeout);
        if (isDevelopmentEnvironment()) {
          console.warn(`Failed to load image: ${media.url}`);
        }
        restoreDefaultImage(mediaElement);
        frame.classList.remove('loading-pexels');
        resolve();
      };
    }
  });
}

/**
 * Cycle through widget media with transitions
 * Supports both photos and videos
 */
function cycleWidgetMedia(
  mediaCache,
  currentMediaIndex,
  collageFrames,
  categoryMapping,
  prefersReducedMotion
) {
  Object.keys(mediaCache).forEach(category => {
    const mediaList = mediaCache[category];
    if (!mediaList || !Array.isArray(mediaList) || mediaList.length === 0) {
      return;
    }

    // Move to next media
    currentMediaIndex[category] = (currentMediaIndex[category] + 1) % mediaList.length;
    const nextMedia = mediaList[currentMediaIndex[category]];

    if (!nextMedia || !nextMedia.url) {
      if (isDevelopmentEnvironment()) {
        console.warn(`Invalid next media for ${category}, skipping cycle`);
      }
      return;
    }

    const frameIndex = categoryMapping[category];
    const frame = collageFrames[frameIndex];
    const currentElement = frame.querySelector('img, video');

    if (!currentElement) {
      return;
    }

    // Clean up old video element if switching away from video
    if (currentElement.tagName === 'VIDEO' && nextMedia.type !== 'video') {
      currentElement.pause();
      currentElement.removeAttribute('src');
      currentElement.load();
    }

    // Fade out current element
    if (!prefersReducedMotion) {
      currentElement.classList.add('fading');
    }

    setTimeout(
      async () => {
        // Verify element still exists in DOM (safety check)
        if (!document.body.contains(currentElement)) {
          if (isDevelopmentEnvironment()) {
            console.warn(`Element removed from DOM during transition for ${category}`);
          }
          return;
        }

        // Create new element based on media type
        if (nextMedia.type === 'video') {
          const video = document.createElement('video');
          video.src = nextMedia.url;
          video.muted = true;
          video.loop = true;
          video.playsInline = true;
          video.autoplay = !prefersReducedMotion;
          video.className = currentElement.className.replace('fading', '');
          video.style.cssText = currentElement.style.cssText;
          video.style.opacity = '0';
          video.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Video`;

          const handleLoadedData = () => {
            currentElement.replaceWith(video);
            if (!prefersReducedMotion) {
              setTimeout(() => {
                video.style.opacity = '1';
              }, 50);
            } else {
              video.style.opacity = '1';
            }

            if (nextMedia.photographer) {
              addPhotographerCredit(frame, nextMedia);
            }
          };

          const handleError = () => {
            if (isDevelopmentEnvironment()) {
              console.warn(`Failed to load video: ${nextMedia.url}`);
            }
            currentElement.classList.remove('fading');
            currentElement.style.opacity = '1';
          };

          video.addEventListener('loadeddata', handleLoadedData, { once: true });
          video.addEventListener('error', handleError, { once: true });
        } else {
          // Preload photo
          const img = new Image();
          img.src = nextMedia.url;

          img.onload = () => {
            if (currentElement.tagName === 'VIDEO') {
              // Clean up video before replacing
              currentElement.pause();
              currentElement.removeAttribute('src');
              currentElement.load();

              // Replace video with img
              const newImg = document.createElement('img');
              newImg.src = nextMedia.url;
              newImg.className = currentElement.className.replace('fading', '');
              newImg.style.cssText = currentElement.style.cssText;
              newImg.style.opacity = '0';
              newImg.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Photo`;

              currentElement.replaceWith(newImg);

              if (!prefersReducedMotion) {
                setTimeout(() => {
                  newImg.style.opacity = '1';
                }, 50);
              } else {
                newImg.style.opacity = '1';
              }
            } else {
              // Update existing img
              currentElement.src = nextMedia.url;
              currentElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Photo`;
              currentElement.classList.remove('fading');
              if (!prefersReducedMotion) {
                setTimeout(() => {
                  currentElement.style.opacity = '1';
                }, 50);
              } else {
                currentElement.style.opacity = '1';
              }
            }

            if (nextMedia.photographer) {
              addPhotographerCredit(frame, nextMedia);
            }
          };

          img.onerror = () => {
            if (isDevelopmentEnvironment()) {
              console.warn(`Failed to load image: ${nextMedia.url}`);
            }
            currentElement.classList.remove('fading');
            currentElement.style.opacity = '1';
          };
        }
      },
      prefersReducedMotion ? 0 : PEXELS_TRANSITION_DURATION_MS
    );
  });
}

/**
 * Cleanup function for collage widget (call on page unload or widget disable)
 * Clears intervals and removes event listeners to prevent memory leaks
 */
function cleanupPexelsCollage() {
  if (pexelsCollageIntervalId) {
    clearInterval(pexelsCollageIntervalId);
    pexelsCollageIntervalId = null;
    if (isDevelopmentEnvironment()) {
      console.log('Collage widget interval cleared');
    }
  }

  // Clean up video elements to prevent memory leaks
  const collageFrames = document.querySelectorAll('.collage .frame');
  if (collageFrames) {
    collageFrames.forEach(frame => {
      const video = frame.querySelector('video');
      if (video) {
        // Pause video and remove source to free memory
        video.pause();
        video.removeAttribute('src');
        video.load();
      }
    });
  }
}

/**
 * Cycle through Pexels images with crossfade transition
 * Handles preload failures gracefully by falling back to direct replacement
 */
function cyclePexelsImages(imageCache, currentImageIndex, collageFrames, categoryMapping) {
  Object.keys(imageCache).forEach(category => {
    const images = imageCache[category];
    if (!images || !Array.isArray(images) || images.length === 0) {
      return;
    }

    // Move to next image
    currentImageIndex[category] = (currentImageIndex[category] + 1) % images.length;
    const nextImage = images[currentImageIndex[category]];

    // Validate next image has required data
    if (!nextImage || !nextImage.url) {
      if (isDevelopmentEnvironment()) {
        console.warn(`⚠️  Invalid next image for ${category}, skipping cycle`);
      }
      return;
    }

    const frameIndex = categoryMapping[category];
    const frame = collageFrames[frameIndex];
    const imgElement = frame.querySelector('img');

    if (!imgElement) {
      return;
    }

    // Preload next image for smooth transition
    const nextImg = new Image();
    nextImg.src = nextImage.url;

    // Set timeout for preload to prevent hanging
    const preloadTimeout = setTimeout(() => {
      // If preload takes too long, just swap directly without fade
      if (isDevelopmentEnvironment()) {
        console.warn(`⚠️  Image preload timeout for ${category}, swapping directly`);
      }
      imgElement.src = nextImage.url;
      imgElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Photo by ${nextImage.photographer}`;
      addPhotographerCredit(frame, nextImage);
    }, PEXELS_PRELOAD_TIMEOUT_MS);

    nextImg.onload = () => {
      // Clear timeout since image loaded successfully
      clearTimeout(preloadTimeout);

      // Add fading class for transition
      imgElement.classList.add('fading');

      // After fade out, change image and fade in
      setTimeout(() => {
        imgElement.src = nextImage.url;
        imgElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Photo by ${nextImage.photographer}`;
        imgElement.classList.remove('fading');

        // Update photographer credit
        addPhotographerCredit(frame, nextImage);
      }, PEXELS_TRANSITION_DURATION_MS);
    };

    nextImg.onerror = () => {
      // Clear timeout on error
      clearTimeout(preloadTimeout);

      // Skip this image and move to next
      if (isDevelopmentEnvironment()) {
        console.warn(`⚠️  Failed to load image for ${category}: ${nextImage.url}`);
      }

      // Try next image in sequence
      currentImageIndex[category] = (currentImageIndex[category] + 1) % images.length;
      // Don't recurse to avoid infinite loop - just skip this cycle
    };
  });
}

/**
 * Add photographer credit to collage frame
 * Safely escapes HTML to prevent XSS
 */
function addPhotographerCredit(frame, photo) {
  // Validate inputs
  if (!frame || !photo || !photo.photographer) {
    return;
  }

  // Remove existing credit if present
  const existingCredit = frame.querySelector('.pexels-credit');
  if (existingCredit) {
    existingCredit.remove();
  }

  // Create credit element safely
  const credit = document.createElement('div');
  credit.className = 'pexels-credit';

  // Create text node for "Photo by "
  credit.appendChild(document.createTextNode('Photo by '));

  // Create link element safely with validated URL
  const link = document.createElement('a');
  link.href = validatePexelsUrl(photo.photographerUrl);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = photo.photographer;

  credit.appendChild(link);
  frame.appendChild(credit);
}

/**
 * Fetch and render public stats with graceful fallback
 */
async function fetchPublicStats() {
  try {
    const response = await fetch('/api/public/stats');
    if (!response.ok) {
      // Silently handle 404s (endpoint not available in static/dev mode)
      if (response.status === 404) {
        return;
      }
      // Log other errors only in development
      if (isDevelopmentEnvironment()) {
        console.error(`Failed to load public stats (HTTP ${response.status})`);
      }
      return;
    }

    const stats = await response.json();

    // Update stat counters with real data
    const statItems = document.querySelectorAll('.stat-item');
    if (statItems.length >= 4) {
      // Update counters with real data
      const counters = [
        { value: stats.suppliersVerified, suffix: '+' },
        { value: stats.packagesApproved, suffix: '+' },
        { value: stats.marketplaceListingsActive, suffix: '+' },
        { value: stats.reviewsApproved, suffix: '+' },
      ];

      statItems.forEach((item, index) => {
        const counterEl = item.querySelector('.stat-number');
        if (counterEl && counters[index]) {
          counterEl.setAttribute('data-counter', counters[index].value);
          counterEl.setAttribute('data-suffix', counters[index].suffix);
        }
      });
    }
  } catch (error) {
    // Only log network errors and parse errors, not 404s
    if (isDevelopmentEnvironment() && error.name !== 'AbortError') {
      console.error('Failed to load public stats:', error);
    }
    // Graceful fallback: Use copy-only approach
    // Stats will show 0 or the data-counter defaults, which is acceptable
  }
}

/**
 * Fetch and render marketplace preview items
 */
async function fetchMarketplacePreview() {
  const container = document.getElementById('marketplace-preview');
  if (!container) {
    return;
  }

  const MARKETPLACE_PREVIEW_LIMIT = 4;

  // Show loading skeleton
  container.innerHTML = `
    <div class="skeleton-carousel">
      ${Array(MARKETPLACE_PREVIEW_LIMIT).fill('<div class="skeleton-card"></div>').join('')}
    </div>
  `;

  try {
    const response = await fetch(`/api/marketplace/listings?limit=${MARKETPLACE_PREVIEW_LIMIT}`);
    if (!response.ok) {
      // Silently handle 404s (endpoint not available in static/dev mode)
      if (response.status === 404) {
        container.innerHTML = '<p class="small">Marketplace not available yet.</p>';
        return;
      }
      // Log other errors only in development
      if (isDevelopmentEnvironment()) {
        console.error(`Failed to load marketplace preview (HTTP ${response.status})`);
      }
      container.innerHTML = '<p class="small">Unable to load marketplace items.</p>';
      return;
    }

    const data = await response.json();
    const listings = data.listings || [];

    if (listings.length === 0) {
      container.innerHTML = '<p class="small">No marketplace items available yet.</p>';
      return;
    }

    // Helper to safely escape HTML
    const escape = text => {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    };

    // Render marketplace items
    container.innerHTML = `
      <div class="cards">
        ${listings
          .map(
            listing => `
          <div class="card card-hover">
            ${
              listing.images && listing.images[0]
                ? `<img src="${escape(listing.images[0])}" alt="${escape(listing.title)}" style="width: 100%; height: 180px; object-fit: cover; border-radius: 8px 8px 0 0;" />`
                : ''
            }
            <div style="padding: 1rem;">
              <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">${escape(listing.title)}</h3>
              <p class="small" style="margin: 0 0 0.5rem 0; font-weight: 600; color: var(--ink, #0b8073);">£${escape(String(listing.price))}</p>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                ${listing.category ? `<span class="badge badge-secondary">${escape(listing.category)}</span>` : ''}
                ${listing.condition ? `<span class="badge badge-info">${escape(listing.condition)}</span>` : ''}
                ${listing.location ? `<span class="badge badge-secondary">${escape(listing.location)}</span>` : ''}
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
  } catch (error) {
    // Only log network errors and parse errors, not expected 404s
    if (isDevelopmentEnvironment() && error.name !== 'AbortError') {
      console.error('Failed to load marketplace preview:', error);
    }
    // Hide the entire section gracefully
    const section = document.getElementById('marketplace-preview-section');
    if (section) {
      section.style.display = 'none';
    }
  }
}

/**
 * Fetch and render guides
 */
async function fetchGuides() {
  const container = document.getElementById('guides-list');
  const section = document.getElementById('guides-section');

  if (!container || !section) {
    return;
  }

  // Show loading placeholder
  container.innerHTML =
    '<p class="small" style="text-align: center; padding: 2rem;">Loading guides...</p>';

  try {
    const response = await fetch('/assets/data/guides.json');
    if (!response.ok) {
      // Silently handle 404s (guides.json not available)
      if (response.status === 404) {
        section.style.display = 'none';
        return;
      }
      // Log other errors only in development
      if (isDevelopmentEnvironment()) {
        console.error(`Failed to load guides (HTTP ${response.status})`);
      }
      section.style.display = 'none';
      return;
    }

    const guides = await response.json();

    if (!Array.isArray(guides) || guides.length === 0) {
      throw new Error('No guides available');
    }

    // Helper to safely escape HTML
    const escape = text => {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    };

    // Render guides (limit to 3 for homepage)
    container.innerHTML = guides
      .slice(0, 3)
      .map(
        guide => `
        <div class="card card-hover">
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">
            <a href="${escape(guide.href)}" style="text-decoration: none; color: inherit;">${escape(guide.title)}</a>
          </h3>
          <p class="small" style="margin: 0 0 0.5rem 0; color: var(--color-text-secondary, #6c757d);">
            ${escape(guide.description || '')}
          </p>
          <div style="display: flex; gap: 0.5rem; align-items: center; margin-top: 0.5rem;">
            <span class="badge badge-info">${escape(guide.category)}</span>
            <span class="small" style="color: var(--color-text-secondary, #6c757d);">
              ${escape(String(guide.readingMins))} min read
            </span>
          </div>
        </div>
      `
      )
      .join('');

    // Show the section
    section.style.display = 'block';
  } catch (error) {
    // Only log parse errors and network errors, not expected 404s
    if (isDevelopmentEnvironment() && error.name !== 'AbortError') {
      console.error('Failed to load guides:', error);
    }
    // Hide the entire section gracefully
    section.style.display = 'none';
  }
}

async function fetchTestimonials() {
  const section = document.getElementById('testimonials-section');
  const container = document.getElementById('testimonials-carousel');

  if (!container || !section) {
    return;
  }

  // NOTE: Reviews endpoint not yet deployed - hiding section until /api/reviews is available
  // When the backend endpoint is ready, uncomment the code below to enable testimonials
  section.style.display = 'none';

  /* DISABLED - Reviews/testimonials fetch
  try {
    const response = await fetch('/api/reviews?limit=6&approved=true&sort=rating').catch(() => {
      return null;
    });

    if (!response || response.status === 404 || response.status === 403 || !response.ok) {
      section.style.display = 'none';
      return;
    }

    const data = await response.json();
    const reviews = data.reviews || [];

    if (reviews.length === 0) {
      section.style.display = 'none';
      return;
    }

    // Helper to safely escape HTML
    const escape = text => {
      const div = document.createElement('div');
      div.textContent = text || '';
      return div.innerHTML;
    };

    // Render testimonials in a grid
    container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px;">
        ${reviews
          .slice(0, 3)
          .map(
            review => `
          <div class="card" style="padding: 24px; background: white; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
              ${'⭐'.repeat(review.rating || 5)}
            </div>
            <p style="font-style: italic; color: #374151; margin-bottom: 16px; line-height: 1.6;">
              "${escape((review.comment || '').substring(0, 150))}${(review.comment || '').length > 150 ? '...' : ''}"
            </p>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: var(--ink, #0b8073); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600;">
                ${escape((review.customerName || 'A').charAt(0).toUpperCase())}
              </div>
              <div>
                <div style="font-weight: 600; color: #111827;">${escape(review.customerName || 'Anonymous')}</div>
                <div class="small" style="color: #6b7280;">${escape(review.supplierName || '')}</div>
              </div>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

    section.style.display = 'block';
  } catch (error) {
    section.style.display = 'none';
  }
  */
}

/**
 * Initialize hero search with autocomplete
 */
function initHeroSearch() {
  const form = document.getElementById('hero-search-form');
  const input = document.getElementById('hero-search-input');
  const resultsContainer = document.getElementById('hero-search-results');

  if (!form || !input || !resultsContainer) {
    return;
  }

  let searchTimeout;

  // Handle input for autocomplete
  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = input.value.trim();

    if (query.length < 2) {
      resultsContainer.style.display = 'none';
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        const results = data.results || [];

        if (results.length === 0) {
          resultsContainer.innerHTML =
            '<div style="padding: 16px; text-align: center; color: #6b7280;">No results found</div>';
          resultsContainer.style.display = 'block';
          return;
        }

        // Helper to safely escape HTML
        const escape = text => {
          const div = document.createElement('div');
          div.textContent = text || '';
          return div.innerHTML;
        };

        resultsContainer.innerHTML = results
          .map(
            result => `
          <a 
            href="${escape(result.url || '#')}" 
            style="display: block; padding: 12px 16px; border-bottom: 1px solid #E7EAF0; text-decoration: none; color: inherit; transition: background 0.2s;"
            onmouseover="this.style.background='#f9fafb'"
            onmouseout="this.style.background='white'"
          >
            <div style="font-weight: 600; color: var(--ink, #0b8073);">${escape(result.title)}</div>
            <div class="small" style="color: #6b7280; margin-top: 4px;">${escape(result.type)} ${result.location ? `· ${escape(result.location)}` : ''}</div>
          </a>
        `
          )
          .join('');

        resultsContainer.style.display = 'block';
      } catch (error) {
        if (isDevelopmentEnvironment()) {
          console.error('Search error:', error);
        }
        resultsContainer.style.display = 'none';
      }
    }, 300);
  });

  // Handle form submission
  form.addEventListener('submit', e => {
    e.preventDefault();
    const query = input.value.trim();
    if (query) {
      window.location.href = `/suppliers.html?q=${encodeURIComponent(query)}`;
    }
  });

  // Close results when clicking outside
  document.addEventListener('click', e => {
    if (!form.contains(e.target)) {
      resultsContainer.style.display = 'none';
    }
  });
}

/**
 * Initialize newsletter signup form
 */
function initNewsletterForm() {
  const form = document.getElementById('newsletter-form');
  const emailInput = document.getElementById('newsletter-email');

  if (!form || !emailInput) {
    return;
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const email = emailInput.value.trim();
    if (!email) {
      return;
    }

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        throw new Error('Subscription failed');
      }

      // Show success message
      form.innerHTML = `
        <div style="text-align: center; padding: 20px;">
          <div style="font-size: 48px; margin-bottom: 12px;">✓</div>
          <div style="font-size: 18px; font-weight: 600; color: white;">Thank you for subscribing!</div>
          <p style="margin-top: 8px; color: rgba(255,255,255,0.9);">Check your inbox for a confirmation email.</p>
        </div>
      `;
    } catch (error) {
      if (isDevelopmentEnvironment()) {
        console.error('Newsletter subscription error:', error);
      }

      // Show error message
      const errorDiv = document.createElement('div');
      errorDiv.style.cssText =
        'margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.2); border-radius: 8px; color: white; text-align: center;';
      errorDiv.textContent = 'Something went wrong. Please try again.';
      form.appendChild(errorDiv);

      setTimeout(() => {
        errorDiv.remove();
      }, 3000);
    }
  });
}

/**
 * Initialize parallax effect on collage
 */
function initParallaxCollage() {
  const collage = document.querySelector('.collage');
  if (!collage) {
    return;
  }

  // Add parallax on scroll
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        const scrolled = window.pageYOffset;
        const rate = scrolled * 0.3;

        if (collage) {
          collage.style.transform = `translateY(${rate}px)`;
        }

        ticking = false;
      });

      ticking = true;
    }
  });
}
