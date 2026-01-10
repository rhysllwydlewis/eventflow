/**
 * Homepage initialization script
 * Handles featured packages, stats counters, notifications, and interactive elements
 */

// Set page identifier
window.__EF_PAGE__ = 'home';

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

  // Show notification bell for logged-in users
  const user = localStorage.getItem('user');
  if (user) {
    const notificationBell = document.getElementById('notification-bell');
    if (notificationBell) {
      notificationBell.style.display = 'block';
    }

    // Initialize WebSocket connection for real-time notifications
    if (typeof WebSocketClient !== 'undefined') {
      // eslint-disable-next-line no-unused-vars
      const wsClient = new WebSocketClient({
        // eslint-disable-next-line no-unused-vars
        onNotification: notification => {
          // Update notification badge
          const badge = document.querySelector('.notification-badge');
          if (badge) {
            badge.style.display = 'block';
            const current = parseInt(badge.textContent) || 0;
            badge.textContent = current + 1;
          }
        },
      });
    }
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
      throw new Error(`HTTP ${response.status}`);
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
    if (isDevelopmentEnvironment()) {
      console.error(`Failed to load packages from ${endpoint}:`, error);
    }

    // Show error with retry button
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
  // First, check if Pexels collage is enabled
  try {
    const settingsResponse = await fetch('/api/public/homepage-settings').catch(() => {
      // Silent fail - network errors are expected when offline or endpoint not available
      // No logging even in development to reduce console noise
      return null;
    });

    // If fetch failed (network error), continue to static images
    if (!settingsResponse) {
      // Continue to load static images (silent)
    } else if (settingsResponse.status === 404 || settingsResponse.status === 403) {
      // Silently handle 404/403 - endpoint may not be deployed or configured yet
      // Continue to load static images (silent)
    } else if (settingsResponse.ok) {
      const settings = await settingsResponse.json();
      if (settings.pexelsCollageEnabled) {
        // Only log if in development mode
        if (isDevelopmentEnvironment()) {
          console.log('Pexels collage enabled, initializing dynamic collage');
        }
        await initPexelsCollage(settings.pexelsCollageSettings);
        return; // Skip static image loading
      }
    }
    // If non-200 and non-404/403, just continue to static images
  } catch (error) {
    // JSON parsing or other error - continue to static images silently
    // No logging to keep production console clean
  }

  // If Pexels is not enabled or failed, load static images
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
      const isCustomImage = !imageUrl.includes('/assets/images/collage-');

      // Get the current image URL (without query params for comparison)
      const currentImageUrl = imgElement.src.split('?')[0];
      const normalizedImageUrl = imageUrl.split('?')[0];

      // Determine if we need to update based on URL comparison
      const needsUpdate = !currentImageUrl.endsWith(normalizedImageUrl.split('/').pop());

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

  // Cache for storing fetched images per category
  const imageCache = {};
  const currentImageIndex = {};

  // Fetch images for each category
  try {
    const categories = Object.keys(categoryMapping);
    for (const category of categories) {
      try {
        // Use the public Pexels collage endpoint
        const response = await fetch(
          `/api/public/pexels-collage?category=${encodeURIComponent(category)}`
        );

        if (!response.ok) {
          // Only warn in development mode
          if (isDevelopmentEnvironment()) {
            console.warn(`Failed to fetch Pexels images for ${category}, falling back to static`);
          }
          continue;
        }

        const data = await response.json();

        if (data.photos && data.photos.length > 0) {
          imageCache[category] = data.photos.map(photo => ({
            url: photo.src.large || photo.src.original,
            photographer: photo.photographer,
            photographerUrl: photo.photographer_url,
          }));
          currentImageIndex[category] = 0;

          // Set initial image
          const frameIndex = categoryMapping[category];
          const frame = collageFrames[frameIndex];
          const imgElement = frame.querySelector('img');

          if (imgElement) {
            imgElement.src = imageCache[category][0].url;
            imgElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - Photo by ${imageCache[category][0].photographer}`;

            // Add photographer attribution
            addPhotographerCredit(frame, imageCache[category][0]);
          }
        }
      } catch (error) {
        // Only log errors in development mode
        if (isDevelopmentEnvironment()) {
          console.error(`Error fetching Pexels images for ${category}:`, error);
        }
      }
    }

    // Start cycling images
    if (Object.keys(imageCache).length > 0) {
      setInterval(() => {
        cyclePexelsImages(imageCache, currentImageIndex, collageFrames, categoryMapping);
      }, intervalMs);

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
      // Fall back to loading static hero images
      await loadHeroCollageImages();
    }
  } catch (error) {
    // Only log errors in development mode
    if (isDevelopmentEnvironment()) {
      console.error('Error initializing Pexels collage:', error);
    }
    // Fall back to loading static hero images
    await loadHeroCollageImages();
  }
}

/**
 * Cycle through Pexels images with crossfade transition
 */
function cyclePexelsImages(imageCache, currentImageIndex, collageFrames, categoryMapping) {
  Object.keys(imageCache).forEach(category => {
    const images = imageCache[category];
    if (!images || images.length === 0) {
      return;
    }

    // Move to next image
    currentImageIndex[category] = (currentImageIndex[category] + 1) % images.length;
    const nextImage = images[currentImageIndex[category]];

    const frameIndex = categoryMapping[category];
    const frame = collageFrames[frameIndex];
    const imgElement = frame.querySelector('img');

    if (!imgElement) {
      return;
    }

    // Preload next image for smooth transition
    const nextImg = new Image();
    nextImg.src = nextImage.url;

    nextImg.onload = () => {
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
  });
}

/**
 * Add photographer credit to collage frame
 */
function addPhotographerCredit(frame, photo) {
  // Remove existing credit if present
  const existingCredit = frame.querySelector('.pexels-credit');
  if (existingCredit) {
    existingCredit.remove();
  }

  // Add new credit
  const credit = document.createElement('div');
  credit.className = 'pexels-credit';
  credit.innerHTML = `Photo by <a href="${photo.photographerUrl}" target="_blank" rel="noopener">${photo.photographer}</a>`;
  frame.appendChild(credit);
}

/**
 * Fetch and render public stats with graceful fallback
 */
async function fetchPublicStats() {
  try {
    const response = await fetch('/api/public/stats');
    if (!response.ok) {
      throw new Error('Stats fetch failed');
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
    if (isDevelopmentEnvironment()) {
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

  try {
    const response = await fetch('/api/marketplace/listings?limit=4');
    if (!response.ok) {
      throw new Error('Marketplace fetch failed');
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
    if (isDevelopmentEnvironment()) {
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

  try {
    const response = await fetch('/assets/data/guides.json');
    if (!response.ok) {
      throw new Error('Guides fetch failed');
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
    if (isDevelopmentEnvironment()) {
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

  try {
    const response = await fetch('/api/reviews?limit=6&approved=true&sort=rating').catch(() => {
      // Silent fail - network errors don't need logging
      // Reviews are optional content
      return null;
    });

    // If fetch failed (network error), hide section
    if (!response) {
      section.style.display = 'none';
      return;
    }

    // Silently handle 404, 403, and other non-200 responses - reviews endpoint may not be deployed yet
    if (response.status === 404 || response.status === 403 || !response.ok) {
      section.style.display = 'none';
      return;
    }

    const data = await response.json();
    const reviews = data.reviews || [];

    if (reviews.length === 0) {
      // Hide section if no reviews
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

    // Show the section
    section.style.display = 'block';
  } catch (error) {
    // Silently handle errors and hide section - this is optional content
    section.style.display = 'none';
  }
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
