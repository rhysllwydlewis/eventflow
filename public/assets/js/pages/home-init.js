/**
 * Homepage initialization script
 * Handles featured packages, stats counters, notifications, and interactive elements
 */

// Set page identifier
window.__EF_PAGE__ = 'home';

// Video performance metrics tracker
window.__videoMetrics__ = {
  heroVideoAttempts: 0,
  heroVideoSuccesses: 0,
  heroVideoFailures: 0,
  collageVideoAttempts: 0,
  collageVideoSuccesses: 0,
  collageVideoFailures: 0,
  lastError: null,
};

// Helper function to calculate success rate
function calculateSuccessRate(successes, attempts) {
  if (attempts === 0) {
    return 0;
  }
  return ((successes / attempts) * 100).toFixed(1);
}

// Helper function to log video metrics (useful for debugging)
window.logVideoMetrics = function () {
  console.group('📊 Video Performance Metrics');
  console.log('Hero Video:');
  console.log(`  Attempts: ${window.__videoMetrics__.heroVideoAttempts}`);
  console.log(`  Successes: ${window.__videoMetrics__.heroVideoSuccesses}`);
  console.log(`  Failures: ${window.__videoMetrics__.heroVideoFailures}`);
  console.log(
    `  Success Rate: ${calculateSuccessRate(window.__videoMetrics__.heroVideoSuccesses, window.__videoMetrics__.heroVideoAttempts)}%`
  );
  console.log('');
  console.log('Collage Videos:');
  console.log(`  Attempts: ${window.__videoMetrics__.collageVideoAttempts}`);
  console.log(`  Successes: ${window.__videoMetrics__.collageVideoSuccesses}`);
  console.log(`  Failures: ${window.__videoMetrics__.collageVideoFailures}`);
  console.log(
    `  Success Rate: ${calculateSuccessRate(window.__videoMetrics__.collageVideoSuccesses, window.__videoMetrics__.collageVideoAttempts)}%`
  );
  if (window.__videoMetrics__.lastError) {
    console.log('');
    console.log(`⚠️  Last Error: ${window.__videoMetrics__.lastError}`);
  }
  console.groupEnd();
};

/**
 * Detect user's connection speed for adaptive video quality
 * @returns {string} 'slow', 'medium', or 'fast'
 */
function detectConnectionSpeed() {
  // Check for Network Information API support
  if ('connection' in navigator && navigator.connection) {
    const connection = navigator.connection;
    const effectiveType = connection.effectiveType;

    // Map connection types to quality levels
    if (effectiveType === '4g') {
      return 'fast';
    } else if (effectiveType === '3g') {
      return 'medium';
    } else {
      return 'slow';
    }
  }

  // Default to medium quality if API not available
  return 'medium';
}

/**
 * Check if debug logging is enabled
 * Checks:
 * 1. Explicit window.DEBUG flag
 * 2. URL param ?debug=1, ?debug=true, ?debug=yes, or ?debug (case-insensitive)
 * 3. Development environment
 * @returns {boolean} True if debug logging should be enabled
 */
function isDebugEnabled() {
  // Check window.DEBUG first
  if (window.DEBUG) {
    return true;
  }

  // Check URL parameters for debug mode
  const urlParams = new URLSearchParams(window.location.search);
  const debugParam = urlParams.get('debug');
  if (debugParam !== null) {
    // Allow: ?debug, ?debug=1, ?debug=true, ?debug=yes (case-insensitive)
    const debugValue = debugParam.toLowerCase();
    if (debugValue === '' || debugValue === '1' || debugValue === 'true' || debugValue === 'yes') {
      return true;
    }
  }

  // Check if in development environment
  return isDevelopmentEnvironment();
}

// Log connection speed in debug mode
if (isDebugEnabled()) {
  const speed = detectConnectionSpeed();
  console.log(`[Video Quality] Detected connection speed: ${speed}`);
  if ('connection' in navigator && navigator.connection) {
    console.log(`[Video Quality] Effective type: ${navigator.connection.effectiveType}`);
  }
}

// Initialize homepage components on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize category grid
  if (typeof CategoryGrid !== 'undefined') {
    const categoryGrid = new CategoryGrid('category-grid-home');
    categoryGrid.loadCategories();
  }

  // Hide version label unless debug mode is enabled
  const versionContainer = document.querySelector('.version');
  if (versionContainer) {
    if (!isDebugEnabled()) {
      versionContainer.style.display = 'none';
    } else {
      // If debug mode, show version
      const versionLabel = document.getElementById('ef-version-label');
      if (versionLabel) {
        versionLabel.textContent = 'v18.0.2';
      }
    }
  }

  // Show video metrics panel in debug mode
  if (isDebugEnabled()) {
    // Create metrics panel
    const metricsPanel = document.createElement('div');
    metricsPanel.id = 'video-metrics-panel';
    metricsPanel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: rgba(15, 23, 42, 0.95);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;
    metricsPanel.innerHTML = `
      <div style="font-weight: bold; margin-bottom: 8px; color: #10b981;">📊 Video Metrics</div>
      <div id="metrics-content">Loading...</div>
      <div style="margin-top: 8px; font-size: 10px; opacity: 0.7;">
        Updates every 2s • <a href="#" id="metrics-log-link" style="color: #10b981;">Log to Console</a>
      </div>
    `;
    document.body.appendChild(metricsPanel);

    // Add event listener for log link (avoid inline onclick)
    const logLink = document.getElementById('metrics-log-link');
    if (logLink) {
      logLink.addEventListener('click', e => {
        e.preventDefault();
        window.logVideoMetrics();
      });
    }

    // Update metrics every 2 seconds
    const updateMetrics = () => {
      const m = window.__videoMetrics__;
      const heroRate = calculateSuccessRate(m.heroVideoSuccesses, m.heroVideoAttempts);
      const collageRate = calculateSuccessRate(m.collageVideoSuccesses, m.collageVideoAttempts);

      const content = document.getElementById('metrics-content');
      if (content) {
        content.innerHTML = `
          <div style="margin-bottom: 5px;">
            <strong>Hero:</strong> ${m.heroVideoSuccesses}/${m.heroVideoAttempts} (${heroRate}%)
          </div>
          <div style="margin-bottom: 5px;">
            <strong>Collage:</strong> ${m.collageVideoSuccesses}/${m.collageVideoAttempts} (${collageRate}%)
          </div>
          ${m.lastError ? `<div style="color: #ef4444; margin-top: 5px; font-size: 10px;">⚠️ ${m.lastError}</div>` : ''}
        `;
      }
    };

    // Initial update
    setTimeout(updateMetrics, 1000);
    // Update every 2 seconds
    setInterval(updateMetrics, 2000);
  }

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

  // Hero search is now handled by ef-search-bar.js
  // initHeroSearch(); // Removed - old search component

  // Initialize newsletter form
  initNewsletterForm();

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

  // Set up early fallback (5 seconds) before abort timeout
  const fallbackTimeoutId = setTimeout(() => {
    const skeletonStillShowing = container.querySelector('.skeleton-carousel');
    if (skeletonStillShowing) {
      // Still loading after 5 seconds, show fallback CTA
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 24px;">
          <p class="small" style="margin-bottom: 12px; color: #667085;">
            ${emptyMessage || 'Packages are taking longer to load than expected.'}
          </p>
          <a href="/marketplace.html" class="cta secondary" style="display: inline-block; text-decoration: none;">
            Browse Marketplace
          </a>
        </div>
      `;
    }
  }, 5000);

  // Create AbortController for timeout (8 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);
    clearTimeout(fallbackTimeoutId); // Clear early fallback since data arrived

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
    clearTimeout(fallbackTimeoutId); // Clear early fallback

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

/* ============================================
   RESPONSIVE IMAGE OPTIMIZATION FUNCTIONS
   ============================================ */

/**
 * Detect WebP support
 * @returns {Promise<boolean>} True if browser supports WebP
 */
async function supportsWebP() {
  if (window.__webpSupported !== undefined) {
    return window.__webpSupported;
  }

  return new Promise(resolve => {
    const webp = new Image();
    webp.onload = webp.onerror = () => {
      window.__webpSupported = webp.height === 2;
      resolve(window.__webpSupported);
    };
    webp.src =
      'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
}

/**
 * Get network-aware quality setting
 * Reduces image quality on slow connections
 * @returns {string} Quality setting: 'high', 'medium', or 'low'
 */
function getConnectionAwareQuality() {
  // Check for Save-Data header preference
  if (navigator.connection && navigator.connection.saveData === true) {
    return 'low';
  }

  // Check Network Information API
  if (navigator.connection && navigator.connection.effectiveType) {
    const effectiveType = navigator.connection.effectiveType;
    if (effectiveType === '2g' || effectiveType === 'slow-2g') {
      return 'low';
    }
    if (effectiveType === '3g') {
      return 'medium';
    }
  }

  return 'high';
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
        hideStatsSection();
        return;
      }
      // Log other errors only in development
      if (isDevelopmentEnvironment()) {
        console.error(`Failed to load public stats (HTTP ${response.status})`);
      }
      hideStatsSection();
      return;
    }

    const stats = await response.json();
    updateStatsUI(stats);
  } catch (error) {
    // Only log network errors and parse errors
    if (isDevelopmentEnvironment() && error.name !== 'AbortError') {
      console.error('Failed to load public stats:', error);
    }
    // Hide stats section on error
    hideStatsSection();
  }
}

/**
 * Hide stats section gracefully when data unavailable
 */
function hideStatsSection() {
  const section = document.getElementById('stats-section');
  if (section) {
    section.style.display = 'none';
  }
}

/**
 * Helper to update stats UI with given values
 */
function updateStatsUI(stats) {
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

  try {
    const response = await fetch('/api/reviews?limit=6&sort=rating');

    if (!response.ok) {
      // Gracefully hide section if endpoint fails
      section.style.display = 'none';
      if (isDevelopmentEnvironment()) {
        console.log('[Testimonials] API returned non-ok status, hiding section');
      }
      return;
    }

    const data = await response.json();
    const reviews = data.reviews || [];

    if (reviews.length === 0) {
      section.style.display = 'none';
      if (isDevelopmentEnvironment()) {
        console.log('[Testimonials] No reviews available, hiding section');
      }
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
    if (isDevelopmentEnvironment()) {
      console.error('[Testimonials] Failed to load:', error);
    }
    section.style.display = 'none';
  }
}

/**
 * OLD: Initialize hero search with autocomplete
 * NOTE: This function is no longer used. The new ef-search-bar component
 * is handled by ef-search-bar.js. Keeping this commented for reference.
 */
/*
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
*/

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

// Close the DOMContentLoaded event listener
});
