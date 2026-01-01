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

  // Load and update hero collage images from admin-uploaded category photos
  loadHeroCollageImages();

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

  // Load spotlight packages (same logic as featured but different endpoint)
  fetch('/api/packages/spotlight')
    .then(res => res.json())
    .then(data => {
      const container = document.getElementById('spotlight-packages');
      if (!container) {
        console.warn('Spotlight packages container not found');
        return;
      }

      if (!data.items || data.items.length === 0) {
        container.innerHTML = '<p class="small">No spotlight packages available yet.</p>';
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
        const carousel = new Carousel('spotlight-packages', {
          itemsPerView: 3,
          itemsPerViewTablet: 2,
          itemsPerViewMobile: 1,
          autoScroll: true,
          autoScrollInterval: 5000,
        });
        carousel.setItems(data.items);
      } catch (error) {
        console.error('Failed to initialize spotlight carousel:', error);
        // Fallback to simple list on error
        container.innerHTML =
          '<p class="small">Spotlight packages are temporarily unavailable.</p>';
      }
    })
    .catch(error => {
      console.error('Failed to load spotlight packages:', error);
      const container = document.getElementById('spotlight-packages');
      if (container) {
        container.innerHTML =
          '<p class="small">Unable to load spotlight packages. Please try again later.</p>';
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

/**
 * Load hero collage images from category heroImages
 * Allows admin to override default images with custom uploads
 */
async function loadHeroCollageImages() {
  try {
    const response = await fetch('/api/admin/homepage/hero-images-public');
    if (!response.ok) {
      console.warn('Failed to load hero collage images from settings, using defaults');
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
      console.warn('No collage frames found in DOM');
      return;
    }

    Object.keys(categoryMapping).forEach(category => {
      const imageUrl = heroImages[category];

      // Validate URL exists and is a non-empty string
      if (!imageUrl || typeof imageUrl !== 'string' || imageUrl.trim() === '') {
        console.warn(`No valid image URL for category: ${category}`);
        return;
      }

      const frameIndex = categoryMapping[category];
      const frame = collageFrames[frameIndex];

      // Ensure frame element exists
      if (!frame) {
        console.warn(`Frame not found for category: ${category} at index ${frameIndex}`);
        return;
      }

      // Find the img element within this frame
      const imgElement = frame.querySelector('img');
      const pictureElement = frame.querySelector('picture');

      // Ensure both elements exist before attempting update
      if (!imgElement) {
        console.warn(`Image element not found for category: ${category}`);
        return;
      }

      if (!pictureElement) {
        console.warn(`Picture element not found for category: ${category}`);
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
        console.log(`Image already correct for ${category}, skipping update`);
        return;
      }

      try {
        // Add cache busting to force fresh load of custom images
        const cacheBustedUrl =
          isCustomImage && imageUrl.includes('?')
            ? `${imageUrl}&t=${cacheBustTimestamp}`
            : isCustomImage
              ? `${imageUrl}?t=${cacheBustTimestamp}`
              : imageUrl;

        // Update the image source
        imgElement.src = cacheBustedUrl;
        imgElement.alt = `${category.charAt(0).toUpperCase() + category.slice(1)} - ${isCustomImage ? 'custom uploaded' : 'default'} hero image`;

        // Handle <source> element for responsive images
        const sourceElement = pictureElement.querySelector('source');
        if (isCustomImage) {
          // For custom images, remove source element to use single img
          if (sourceElement) {
            sourceElement.remove();
            console.log(`Removed <source> element for ${category} (using custom image)`);
          }
        } else if (!sourceElement) {
          // For default images, recreate the source element if it was removed
          const newSource = document.createElement('source');
          newSource.type = 'image/webp';
          // Convert .jpg to .webp for the source
          newSource.srcset = imageUrl.replace('.jpg', '.webp');
          pictureElement.insertBefore(newSource, imgElement);
          console.log(`Restored <source> element for ${category} (using default image)`);
        }

        console.log(
          `Updated hero collage image for ${category} with ${isCustomImage ? 'custom upload' : 'default image'}: ${imageUrl}`
        );
      } catch (updateError) {
        console.error(`Failed to update image for category ${category}:`, updateError);
      }
    });
  } catch (error) {
    console.error('Error loading hero collage images:', error);
    // Default images will remain if there's an error
  }
}
