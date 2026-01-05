/**
 * EventFlow Marketplace - Interactive features
 * Handles map, filters, search, view toggling, and real listings
 */

(function () {
  'use strict';

  let allListings = [];
  let currentUser = null;

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  async function init() {
    await checkAuth();
    await loadListings();
    initLocationModal();
    initFilters();
    initViewToggle();
    initQuickActions();
    initListItemButton();
    initMobileFilters();
    loadSavedLocation();
  }

  // Check if user is logged in
  async function checkAuth() {
    try {
      const res = await fetch('/api/user', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        // Handle both wrapped ({user: ...}) and unwrapped response formats
        currentUser = data.user || data;
        updateAuthUI();
      } else if (res.status === 401) {
        // User not logged in - this is expected, not an error
        currentUser = null;
      }
    } catch (error) {
      // Network error or other issue - treat as not logged in
      currentUser = null;
    }
  }

  // Update UI based on auth status
  function updateAuthUI() {
    const authCta = document.getElementById('auth-cta');
    const sellBtn = document.getElementById('sell-item-btn');
    const myListingsLink = document.getElementById('my-listings-link');
    const ctaSection = document.getElementById('marketplace-cta-section');

    if (currentUser) {
      // Hide entire CTA section for logged-in users
      if (ctaSection) {
        ctaSection.style.display = 'none';
      }
      if (authCta) {
        authCta.style.display = 'none';
      }
      if (sellBtn) {
        sellBtn.textContent = 'List an Item';
        sellBtn.onclick = () => showListItemModal();
      }
      if (myListingsLink) {
        myListingsLink.style.display = 'flex';
      }
    } else {
      // Show CTA section for logged-out users
      if (ctaSection) {
        ctaSection.style.display = 'block';
      }
      if (authCta) {
        authCta.style.display = 'inline-flex';
      }
      if (sellBtn) {
        sellBtn.onclick = () => {
          showToast('Please log in to list items');
          setTimeout(() => (window.location.href = '/auth.html'), 1500);
        };
      }
      if (myListingsLink) {
        myListingsLink.style.display = 'none';
      }
    }
  }

  // Load marketplace listings
  async function loadListings() {
    try {
      const params = new URLSearchParams();
      const categoryFilter = document.getElementById('marketplace-filter-category');
      const priceFilter = document.getElementById('marketplace-filter-price');
      const conditionFilter = document.getElementById('marketplace-filter-condition');
      const queryInput = document.getElementById('marketplace-filter-query');
      const sortSelect = document.getElementById('marketplace-sort');

      if (categoryFilter && categoryFilter.value) {
        params.append('category', categoryFilter.value);
      }
      if (conditionFilter && conditionFilter.value) {
        params.append('condition', conditionFilter.value);
      }
      if (queryInput && queryInput.value) {
        params.append('search', queryInput.value);
      }
      if (sortSelect && sortSelect.value) {
        params.append('sort', sortSelect.value);
      }

      // Handle price filter
      if (priceFilter && priceFilter.value) {
        const priceRange = priceFilter.value;
        if (priceRange === '0-50') {
          params.append('minPrice', '0');
          params.append('maxPrice', '50');
        } else if (priceRange === '50-100') {
          params.append('minPrice', '50');
          params.append('maxPrice', '100');
        } else if (priceRange === '100-250') {
          params.append('minPrice', '100');
          params.append('maxPrice', '250');
        } else if (priceRange === '250-500') {
          params.append('minPrice', '250');
          params.append('maxPrice', '500');
        } else if (priceRange === '500-plus') {
          params.append('minPrice', '500');
        }
      }

      const res = await fetch(`/api/marketplace/listings?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to fetch listings');
      }

      const data = await res.json();
      allListings = data.listings || [];
      renderListings();
      updateResultCount();
    } catch (error) {
      console.error('Error loading listings:', error);
      const resultsContainer = document.getElementById('marketplace-results');
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div class="card" style="text-align: center; padding: 2rem;">
            <p>Unable to load listings. Please try again later.</p>
          </div>
        `;
      }
    }
  }

  // Render listings
  function renderListings() {
    const resultsContainer = document.getElementById('marketplace-results');
    if (!resultsContainer) {
      return;
    }

    if (allListings.length === 0) {
      resultsContainer.innerHTML = `
        <div class="card" style="text-align: center; padding: 2rem; grid-column: 1 / -1;">
          <p>No listings found. ${currentUser ? 'Be the first to list an item!' : 'Check back soon for new listings.'}</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = allListings.map(listing => createListingCard(listing)).join('');

    // Re-attach event listeners
    document.querySelectorAll('.marketplace-item-card').forEach((card, index) => {
      card.addEventListener('click', () => showListingDetail(allListings[index]));
    });

    document.querySelectorAll('.marketplace-save-btn').forEach((btn, index) => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        toggleSave(btn, allListings[index]);
      });
    });
  }

  // Create listing card HTML
  function createListingCard(listing) {
    const timeAgo = getTimeAgo(listing.createdAt);
    const defaultImage = '/assets/images/collage-venue.jpg';
    const image = listing.images && listing.images[0] ? listing.images[0] : defaultImage;

    return `
      <div class="marketplace-item-card" data-listing-id="${listing.id}">
        <div class="marketplace-item-image">
          <img src="${image}" alt="${escapeHtml(listing.title)}" loading="lazy" onerror="this.src='${defaultImage}'">
          <button class="marketplace-save-btn" aria-label="Save item">♡</button>
        </div>
        <div class="marketplace-item-details">
          <div class="marketplace-item-price">£${listing.price.toFixed(2)}</div>
          <h3 class="marketplace-item-title">${escapeHtml(listing.title)}</h3>
          <div class="marketplace-item-meta">
            <span class="marketplace-item-location">📍 ${escapeHtml(listing.location || 'Location not specified')}</span>
            <span class="marketplace-item-condition">${formatCondition(listing.condition)}</span>
          </div>
          <div class="marketplace-item-time">Listed ${timeAgo}</div>
        </div>
      </div>
    `;
  }

  // Show listing detail modal (Facebook-style split-pane)
  function showListingDetail(listing) {
    const overlay = document.createElement('div');
    overlay.className = 'listing-detail-overlay';

    const images =
      listing.images && listing.images.length > 0
        ? listing.images
        : ['/assets/images/collage-venue.jpg'];

    const thumbnailsHTML =
      images.length > 1
        ? `<div class="listing-detail-thumbnails">
          ${images
            .map(
              (img, idx) => `
            <div class="listing-detail-thumbnail ${idx === 0 ? 'active' : ''}" data-index="${idx}">
              <img src="${img}" alt="Image ${idx + 1}">
            </div>
          `
            )
            .join('')}
         </div>`
        : '';

    overlay.innerHTML = `
      <div class="listing-detail-container">
        <div class="listing-detail-gallery">
          <div class="listing-detail-main-image">
            <img id="main-listing-image" src="${images[0]}" alt="${escapeHtml(listing.title)}">
          </div>
          ${thumbnailsHTML}
        </div>
        <div class="listing-detail-sidebar">
          <div class="listing-detail-header">
            <div style="flex: 1;">
              <div class="listing-detail-price">£${listing.price.toFixed(2)}</div>
              <h2 class="listing-detail-title">${escapeHtml(listing.title)}</h2>
            </div>
            <button class="listing-detail-close" aria-label="Close">&times;</button>
          </div>
          <div class="listing-detail-body">
            <div class="listing-detail-meta">
              <div class="listing-detail-meta-item">
                <span class="listing-detail-meta-label">Condition:</span>
                <span>${formatCondition(listing.condition)}</span>
              </div>
              <div class="listing-detail-meta-item">
                <span class="listing-detail-meta-label">Category:</span>
                <span>${formatCategory(listing.category)}</span>
              </div>
              <div class="listing-detail-meta-item">
                <span class="listing-detail-meta-label">Location:</span>
                <span>📍 ${escapeHtml(listing.location || 'Location not specified')}</span>
              </div>
              <div class="listing-detail-meta-item">
                <span class="listing-detail-meta-label">Listed:</span>
                <span>${getTimeAgo(listing.createdAt)}</span>
              </div>
            </div>
            <div class="listing-detail-description">
              <h4>Description</h4>
              <p>${escapeHtml(listing.description)}</p>
            </div>
          </div>
          <div class="listing-detail-actions">
            ${
              currentUser && currentUser.id !== listing.userId
                ? `<button class="cta" onclick="messageSeller('${listing.id}', '${escapeHtml(listing.title).replace(/'/g, "\\'")}')">
                     Message Seller
                   </button>`
                : currentUser && currentUser.id === listing.userId
                  ? `<div class="listing-own-notice">This is your listing</div>`
                  : `<a href="/auth.html" class="cta">Log in to message seller</a>`
            }
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Trigger animation
    setTimeout(() => overlay.classList.add('active'), 10);

    // Close button
    const closeBtn = overlay.querySelector('.listing-detail-close');
    closeBtn.addEventListener('click', () => closeModal(overlay));

    // Background click
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });

    // Escape key
    const handleEscape = e => {
      if (e.key === 'Escape') {
        closeModal(overlay);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Thumbnail clicks
    const thumbnails = overlay.querySelectorAll('.listing-detail-thumbnail');
    const mainImage = overlay.querySelector('#main-listing-image');
    thumbnails.forEach((thumb, idx) => {
      thumb.addEventListener('click', () => {
        thumbnails.forEach(t => t.classList.remove('active'));
        thumb.classList.add('active');
        mainImage.src = images[idx];
      });
    });
  }

  function closeModal(overlay) {
    overlay.classList.remove('active');
    setTimeout(() => overlay.remove(), 300);
  }

  // Message seller function
  window.messageSeller = async function (listingId, listingTitle) {
    if (!currentUser) {
      window.location.href = '/auth.html';
      return;
    }

    try {
      // Get listing to find seller ID
      const res = await fetch(`/api/marketplace/listings/${listingId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch listing');
      }
      const { listing } = await res.json();

      // Start a thread with the seller
      const threadRes = await fetch('/api/threads/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          recipientId: listing.userId,
          initialMessage: `Hi, I'm interested in your listing: ${listingTitle}`,
        }),
      });

      if (!threadRes.ok) {
        throw new Error('Failed to start conversation');
      }
      const { threadId } = await threadRes.json();

      // Redirect to conversation
      window.location.href = `/conversation.html?id=${threadId}`;
    } catch (error) {
      console.error('Error messaging seller:', error);
      showToast('Failed to start conversation', 'error');
    }
  };

  // Show list item modal
  function showListItemModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h2>List an Item</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          <form id="list-item-form">
            <div style="margin-bottom: 16px;">
              <label for="item-title">Title *</label>
              <input type="text" id="item-title" required maxlength="100" 
                     placeholder="e.g. Ivory Wedding Dress, Size 10">
            </div>
            <div style="margin-bottom: 16px;">
              <label for="item-description">Description *</label>
              <textarea id="item-description" required maxlength="1000" rows="4"
                        placeholder="Describe your item in detail..."></textarea>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div>
                <label for="item-price">Price (£) *</label>
                <input type="number" id="item-price" required min="0" step="0.01" placeholder="0.00">
              </div>
              <div>
                <label for="item-location">Location</label>
                <input type="text" id="item-location" maxlength="100" placeholder="e.g. London">
              </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
              <div>
                <label for="item-category">Category *</label>
                <select id="item-category" required>
                  <option value="">Select category</option>
                  <option value="attire">Attire</option>
                  <option value="decor">Décor</option>
                  <option value="av-equipment">AV Equipment</option>
                  <option value="photography">Photography</option>
                  <option value="party-supplies">Party Supplies</option>
                  <option value="florals">Florals</option>
                </select>
              </div>
              <div>
                <label for="item-condition">Condition *</label>
                <select id="item-condition" required>
                  <option value="">Select condition</option>
                  <option value="new">New / Unused</option>
                  <option value="like-new">Like New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                </select>
              </div>
            </div>
            <div style="margin-bottom: 16px;">
              <label for="item-images">Images (Optional)</label>
              <input type="file" id="item-images" accept="image/*" multiple style="margin-bottom: 8px;">
              <p class="small" style="color: #6b7280; margin: 0;">
                Upload up to 5 images (JPG, PNG, max 5MB each). First image will be the main photo.
              </p>
              <div id="image-preview" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px;"></div>
            </div>
            <p class="small" style="color: #6b7280; margin-bottom: 16px;">
              Your listing will be reviewed by our team before it appears on the marketplace.
            </p>
            <div style="display: flex; gap: 8px;">
              <button type="submit" class="cta">Submit Listing</button>
              <button type="button" class="cta secondary" onclick="this.closest('.modal-overlay').remove()">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // Apply styles
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 20px;
    `;

    const modalContent = modal.querySelector('.modal-content');
    modalContent.style.cssText = `
      background: white;
      border-radius: 12px;
      max-width: 600px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
    `;

    const modalHeader = modal.querySelector('.modal-header');
    modalHeader.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      border-bottom: 1px solid #e5e7eb;
    `;

    const modalBody = modal.querySelector('.modal-body');
    modalBody.style.cssText = 'padding: 20px;';

    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 28px;
      cursor: pointer;
      color: #6b7280;
      line-height: 1;
      padding: 0;
      width: 32px;
      height: 32px;
    `;

    document.body.appendChild(modal);

    // Handle image upload and preview
    const imageInput = document.getElementById('item-images');
    const imagePreview = document.getElementById('image-preview');
    let selectedImages = [];

    imageInput.addEventListener('change', async e => {
      const files = Array.from(e.target.files).slice(0, 5); // Max 5 images
      selectedImages = [];
      imagePreview.innerHTML = '';

      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
          showToast('Image must be under 5MB', 'error');
          continue;
        }

        // Convert to base64 for preview and storage
        const reader = new FileReader();
        reader.onload = function (event) {
          const base64 = event.target.result;
          selectedImages.push(base64);

          // Create preview
          const preview = document.createElement('div');
          preview.style.cssText = `
            position: relative;
            width: 80px;
            height: 80px;
            border-radius: 4px;
            overflow: hidden;
            border: 1px solid #e5e7eb;
          `;
          preview.innerHTML = `
            <img src="${base64}" style="width: 100%; height: 100%; object-fit: cover;">
            <button type="button" style="position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.5); color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; line-height: 1;" onclick="this.parentElement.remove()">×</button>
          `;
          imagePreview.appendChild(preview);
        };
        reader.readAsDataURL(file);
      }
    });

    // Handle form submission
    const form = document.getElementById('list-item-form');
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const listing = {
        title: document.getElementById('item-title').value,
        description: document.getElementById('item-description').value,
        price: parseFloat(document.getElementById('item-price').value),
        location: document.getElementById('item-location').value,
        category: document.getElementById('item-category').value,
        condition: document.getElementById('item-condition').value,
        images: selectedImages,
      };

      try {
        const res = await fetch('/api/marketplace/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(listing),
        });

        if (!res.ok) {
          const error = await res.json();
          throw new Error(error.error || 'Failed to create listing');
        }

        modal.remove();
        showToast('Listing submitted! It will appear after admin approval.');
        setTimeout(() => loadListings(), 1500);
      } catch (error) {
        console.error('Error creating listing:', error);
        showToast(error.message || 'Failed to create listing', 'error');
      }
    });

    // Close on background click
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }

  // Helper functions
  function getTimeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    const intervals = {
      year: 31536000,
      month: 2592000,
      week: 604800,
      day: 86400,
      hour: 3600,
      minute: 60,
    };

    for (const [name, secondsInInterval] of Object.entries(intervals)) {
      const interval = Math.floor(seconds / secondsInInterval);
      if (interval >= 1) {
        return `${interval} ${name}${interval > 1 ? 's' : ''} ago`;
      }
    }
    return 'Just now';
  }

  function formatCondition(condition) {
    const map = {
      new: 'New / Unused',
      'like-new': 'Like New',
      good: 'Good',
      fair: 'Fair',
    };
    return map[condition] || condition;
  }

  function formatCategory(category) {
    const map = {
      attire: 'Attire',
      decor: 'Décor',
      'av-equipment': 'AV Equipment',
      photography: 'Photography',
      'party-supplies': 'Party Supplies',
      florals: 'Florals',
    };
    return map[category] || category;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function toggleSave(btn, _listing) {
    btn.classList.toggle('saved');
    btn.textContent = btn.classList.contains('saved') ? '♥' : '♡';
    showToast(btn.classList.contains('saved') ? 'Item saved' : 'Item unsaved');
  }

  // Initialize location modal
  function initLocationModal() {
    const changeLocationBtn = document.getElementById('btn-change-location');
    if (!changeLocationBtn) {
      return;
    }

    changeLocationBtn.addEventListener('click', showLocationModal);
  }

  function showLocationModal() {
    const overlay = document.createElement('div');
    overlay.className = 'location-modal-overlay';

    const savedLocation = JSON.parse(localStorage.getItem('marketplaceLocation') || '{}');

    overlay.innerHTML = `
      <div class="location-modal">
        <div class="location-modal-header">
          <h3>Change Location</h3>
          <button class="location-modal-close" aria-label="Close">&times;</button>
        </div>
        <div class="location-modal-body">
          <div class="location-modal-group">
            <label for="location-postcode">Postcode or City</label>
            <input 
              type="text" 
              id="location-postcode" 
              placeholder="e.g. SW1A 1AA or London"
              value="${savedLocation.postcode || ''}"
            >
          </div>
          <div class="location-modal-group">
            <label for="location-radius">Search Radius</label>
            <select id="location-radius">
              <option value="">Any distance</option>
              <option value="5" ${savedLocation.radius === '5' ? 'selected' : ''}>Within 5 miles</option>
              <option value="10" ${savedLocation.radius === '10' ? 'selected' : ''}>Within 10 miles</option>
              <option value="25" ${savedLocation.radius === '25' ? 'selected' : ''}>Within 25 miles</option>
              <option value="50" ${savedLocation.radius === '50' ? 'selected' : ''}>Within 50 miles</option>
              <option value="100" ${savedLocation.radius === '100' ? 'selected' : ''}>Within 100 miles</option>
            </select>
          </div>
          <div class="location-modal-actions">
            <button class="cta secondary" id="use-my-location">Use My Location</button>
            <button class="cta" id="apply-location">Apply</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('active'), 10);

    // Close handlers
    const closeBtn = overlay.querySelector('.location-modal-close');
    closeBtn.addEventListener('click', () => closeModal(overlay));

    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        closeModal(overlay);
      }
    });

    const handleEscape = e => {
      if (e.key === 'Escape') {
        closeModal(overlay);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Use my location
    const useLocationBtn = overlay.querySelector('#use-my-location');
    useLocationBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showToast('Geolocation is not supported', 'error');
        return;
      }

      useLocationBtn.textContent = 'Getting location...';
      useLocationBtn.disabled = true;

      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          const postcodeInput = overlay.querySelector('#location-postcode');
          postcodeInput.value = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
          useLocationBtn.textContent = 'Use My Location';
          useLocationBtn.disabled = false;
          showToast('Location detected');
        },
        _error => {
          showToast('Unable to get location', 'error');
          useLocationBtn.textContent = 'Use My Location';
          useLocationBtn.disabled = false;
        }
      );
    });

    // Apply location
    const applyBtn = overlay.querySelector('#apply-location');
    applyBtn.addEventListener('click', () => {
      const postcode = overlay.querySelector('#location-postcode').value.trim();
      const radius = overlay.querySelector('#location-radius').value;

      // Save to localStorage
      localStorage.setItem('marketplaceLocation', JSON.stringify({ postcode, radius }));

      // Update UI
      updateLocationSummary(postcode, radius);

      // Close modal
      closeModal(overlay);

      // Reload listings (in future, could filter by location)
      loadListings();

      showToast('Location updated');
    });
  }

  function loadSavedLocation() {
    const saved = JSON.parse(localStorage.getItem('marketplaceLocation') || '{}');
    if (saved.postcode || saved.radius) {
      updateLocationSummary(saved.postcode, saved.radius);
    }
  }

  function updateLocationSummary(postcode, radius) {
    const locationText = document.querySelector('.location-text');
    if (!locationText) {
      return;
    }

    let text = '📍 ';
    if (postcode && radius) {
      text += `${postcode}, ${radius} miles`;
    } else if (postcode) {
      text += postcode;
    } else if (radius) {
      text += `Within ${radius} miles`;
    } else {
      text += 'All UK';
    }

    locationText.textContent = text;
  }

  // Initialize mobile filters toggle
  function initMobileFilters() {
    const toggleBtn = document.getElementById('mobile-filter-toggle');
    const sidebar = document.querySelector('.marketplace-sidebar');

    if (!toggleBtn || !sidebar) {
      return;
    }

    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
    });

    // Close on filter selection (mobile)
    const filterInputs = sidebar.querySelectorAll('select, input[type="text"]');
    filterInputs.forEach(input => {
      input.addEventListener('change', () => {
        if (window.innerWidth <= 768) {
          setTimeout(() => {
            sidebar.classList.remove('active');
            document.body.style.overflow = '';
          }, 300);
        }
      });
    });
  }

  // Initialize filters
  function initFilters() {
    const categoryFilter = document.getElementById('marketplace-filter-category');
    const priceFilter = document.getElementById('marketplace-filter-price');
    const conditionFilter = document.getElementById('marketplace-filter-condition');
    const queryInput = document.getElementById('marketplace-filter-query');
    const sortSelect = document.getElementById('marketplace-sort');

    // Add change listeners
    [categoryFilter, priceFilter, conditionFilter, sortSelect].forEach(element => {
      if (element) {
        element.addEventListener('change', applyFilters);
      }
    });

    if (queryInput) {
      // Debounce search input
      let searchTimeout;
      queryInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(applyFilters, 300);
      });
    }

    function applyFilters() {
      // Reload listings with new filters
      loadListings();

      // Show filtering feedback
      const tips = document.getElementById('marketplace-results-tips');
      if (tips && hasActiveFilters()) {
        tips.style.display = 'none';
      } else if (tips) {
        tips.style.display = 'block';
      }
    }

    function hasActiveFilters() {
      return (
        (categoryFilter && categoryFilter.value) ||
        (priceFilter && priceFilter.value) ||
        (conditionFilter && conditionFilter.value) ||
        (queryInput && queryInput.value.trim())
      );
    }
  }

  // Initialize view toggle (grid/list)
  function initViewToggle() {
    const toggleBtn = document.getElementById('marketplace-view-toggle');
    const resultsContainer = document.getElementById('marketplace-results');

    if (!toggleBtn || !resultsContainer) {
      return;
    }

    let isGridView = true;

    toggleBtn.addEventListener('click', () => {
      isGridView = !isGridView;

      if (isGridView) {
        resultsContainer.className = 'marketplace-grid';
        toggleBtn.innerHTML = '<span id="view-icon">⊞</span> Grid';
      } else {
        resultsContainer.className = 'marketplace-list';
        toggleBtn.innerHTML = '<span id="view-icon">☰</span> List';
      }
    });
  }

  // Initialize quick action buttons
  function initQuickActions() {
    // Quick search buttons
    const searchButtons = document.querySelectorAll('[data-marketplace-search]');
    searchButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const searchTerm = btn.getAttribute('data-marketplace-search');
        const queryInput = document.getElementById('marketplace-filter-query');
        if (queryInput) {
          queryInput.value = searchTerm;
          queryInput.dispatchEvent(new Event('input'));
        }
      });
    });

    // Quick category buttons
    const categoryButtons = document.querySelectorAll('[data-marketplace-category]');
    categoryButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const category = btn.getAttribute('data-marketplace-category');
        const categoryFilter = document.getElementById('marketplace-filter-category');
        if (categoryFilter) {
          categoryFilter.value = category;
          categoryFilter.dispatchEvent(new Event('change'));
        }
      });
    });
  }

  // Initialize list item button
  function initListItemButton() {
    const sellBtn = document.getElementById('sell-item-btn');
    if (sellBtn && !sellBtn.onclick) {
      // onclick was set in updateAuthUI
      if (!currentUser) {
        sellBtn.onclick = () => {
          showToast('Please log in to list items');
          setTimeout(() => (window.location.href = '/auth.html'), 1500);
        };
      }
    }
  }

  // Update result count
  function updateResultCount() {
    const resultCount = document.getElementById('marketplace-result-count');

    if (resultCount) {
      if (allListings.length === 0) {
        resultCount.textContent = 'No listings found';
      } else {
        resultCount.textContent = `Showing ${allListings.length} listing${allListings.length !== 1 ? 's' : ''}`;
      }
    }
  }

  // Show toast notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'marketplace-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? 'rgba(220, 38, 38, 0.95)' : 'rgba(15, 23, 42, 0.95)'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      z-index: 10000;
      animation: slideUp 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Add animation styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
    }
    @keyframes slideDown {
      from {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
      }
      to {
        opacity: 0;
        transform: translateX(-50%) translateY(20px);
      }
    }
  `;
  document.head.appendChild(style);
})();
