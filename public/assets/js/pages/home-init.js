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

  // Load featured packages
  fetch('/api/packages/featured')
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById('featured-packages');
      if (!container) {
        console.warn('Featured packages container not found');
        return;
      }

      if (!data.items || data.items.length === 0) {
        container.innerHTML = '<p class="small">No featured packages available yet.</p>';
        return;
      }

      // Check if Carousel class is available
      if (typeof Carousel === 'undefined') {
        console.error('Carousel class not loaded. Rendering fallback.');
        // Fallback: render simple grid without carousel functionality
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
        const formatPrice = (priceDisplay) => {
          if (!priceDisplay) {
            return 'Contact for pricing';
          }
          const priceStr = String(priceDisplay);
          // If it's a plain number, format as £X
          if (/^\d+$/.test(priceStr)) {
            return `£${priceStr}`;
          }
          // Otherwise return as-is
          return priceStr;
        };

        container.innerHTML = data.items
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
        return;
      }

      // Initialize carousel
      try {
        const carousel = new Carousel('featured-packages', {
          itemsPerView: 3,
          itemsPerViewTablet: 2,
          itemsPerViewMobile: 1,
          autoScroll: true,
          autoScrollInterval: 5000,
        });
        carousel.setItems(data.items);
      } catch (error) {
        console.error('Failed to initialize carousel:', error);
        // Fallback to simple list on error
        container.innerHTML = '<p class="small">Featured packages are temporarily unavailable.</p>';
      }
    })
    .catch(error => {
      console.error('Failed to load featured packages:', error);
      const container = document.getElementById('featured-packages');
      if (container) {
        container.innerHTML =
          '<p class="small">Unable to load featured packages. Please try again later.</p>';
      }
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
      const wsClient = new WebSocketClient({
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
