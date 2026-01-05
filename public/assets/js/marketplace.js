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
    initMap();
    initFilters();
    initViewToggle();
    initQuickActions();
    initListItemButton();
  }

  // Check if user is logged in
  async function checkAuth() {
    try {
      const res = await fetch('/api/user', { credentials: 'include' });
      if (res.ok) {
        currentUser = await res.json();
        updateAuthUI();
      }
    } catch (error) {
      // User not logged in, that's fine
    }
  }

  // Update UI based on auth status
  function updateAuthUI() {
    const authCta = document.getElementById('auth-cta');
    const sellBtn = document.getElementById('sell-item-btn');

    if (currentUser) {
      if (authCta) {
        authCta.style.display = 'none';
      }
      if (sellBtn) {
        sellBtn.textContent = 'List an Item';
        sellBtn.onclick = () => showListItemModal();
      }
    } else {
      if (sellBtn) {
        sellBtn.onclick = () => {
          showToast('Please log in to list items');
          setTimeout(() => (window.location.href = '/auth.html'), 1500);
        };
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
          <p>No listings found. ${currentUser ? 'Be the first to list an item!' : 'Create an account to start listing.'}</p>
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

  // Show listing detail modal
  function showListingDetail(listing) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 600px;">
        <div class="modal-header">
          <h2>${escapeHtml(listing.title)}</h2>
          <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
        </div>
        <div class="modal-body">
          ${
            listing.images && listing.images[0]
              ? `
            <img src="${listing.images[0]}" alt="${escapeHtml(listing.title)}" 
                 style="width: 100%; max-height: 300px; object-fit: cover; border-radius: 8px; margin-bottom: 16px;">
          `
              : ''
          }
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div style="font-size: 24px; font-weight: 700; color: var(--ink, #0b8073);">£${listing.price.toFixed(2)}</div>
            <div style="padding: 4px 12px; background: #f3f4f6; border-radius: 12px; font-size: 13px;">
              ${formatCondition(listing.condition)}
            </div>
          </div>
          <p style="margin-bottom: 16px;">${escapeHtml(listing.description)}</p>
          <div style="display: flex; gap: 16px; flex-wrap: wrap; font-size: 14px; color: #6b7280; margin-bottom: 16px;">
            <span>📍 ${escapeHtml(listing.location || 'Location not specified')}</span>
            <span>📂 ${formatCategory(listing.category)}</span>
            <span>🕒 Listed ${getTimeAgo(listing.createdAt)}</span>
          </div>
          ${
            currentUser && currentUser.id !== listing.userId
              ? `
            <button class="cta" onclick="messageSeller('${listing.id}', '${escapeHtml(listing.title)}')">
              Message Seller
            </button>
          `
              : currentUser && currentUser.id === listing.userId
                ? `
            <p style="color: #6b7280; font-style: italic;">This is your listing</p>
          `
                : `
            <a href="/auth.html" class="cta">Log in to message seller</a>
          `
          }
        </div>
      </div>
    `;

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

    // Close on background click
    modal.addEventListener('click', e => {
      if (e.target === modal) {
        modal.remove();
      }
    });
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
        images: [],
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

  function toggleSave(btn, listing) {
    btn.classList.toggle('saved');
    btn.textContent = btn.classList.contains('saved') ? '♥' : '♡';
    showToast(btn.classList.contains('saved') ? 'Item saved' : 'Item unsaved');
  }

  // Initialize map functionality
  function initMap() {
    const useLocationBtn = document.getElementById('marketplace-map-use-location');
    const postcodeForm = document.getElementById('marketplace-map-postcode-form');
    const postcodeInput = document.getElementById('marketplace-map-postcode');
    const mapIframe = document.getElementById('marketplace-map');
    const mapStatus = document.getElementById('marketplace-map-status');

    if (!useLocationBtn || !postcodeForm || !mapIframe) {
      return;
    }

    // Use current location
    useLocationBtn.addEventListener('click', () => {
      if (!navigator.geolocation) {
        showMapStatus('Geolocation is not supported by your browser', 'error');
        return;
      }

      showMapStatus('Getting your location...', 'loading');
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          const query = `event+marketplace+items+near+${latitude},${longitude}`;
          mapIframe.src = `https://www.google.com/maps?q=${query}&output=embed`;
          showMapStatus(`Showing items near your location`, 'success');
        },
        error => {
          showMapStatus('Unable to get your location. Please try entering a postcode.', 'error');
          console.error('Geolocation error:', error);
        }
      );
    });

    // Search by postcode
    postcodeForm.addEventListener('submit', e => {
      e.preventDefault();
      const postcode = postcodeInput.value.trim();

      if (!postcode) {
        showMapStatus('Please enter a postcode', 'error');
        return;
      }

      showMapStatus(`Searching near ${postcode}...`, 'loading');
      const query = `event+marketplace+items+near+${encodeURIComponent(postcode)}+UK`;
      mapIframe.src = `https://www.google.com/maps?q=${query}&output=embed`;
      showMapStatus(`Showing items near ${postcode}`, 'success');
    });

    function showMapStatus(message, type) {
      if (!mapStatus) {
        return;
      }
      mapStatus.textContent = message;
      mapStatus.style.color =
        type === 'error' ? '#dc2626' : type === 'success' ? '#16a34a' : '#6b7280';
      mapStatus.style.marginTop = '8px';
    }
  }

  // Initialize filters
  function initFilters() {
    const categoryFilter = document.getElementById('marketplace-filter-category');
    const priceFilter = document.getElementById('marketplace-filter-price');
    const conditionFilter = document.getElementById('marketplace-filter-condition');
    const radiusFilter = document.getElementById('marketplace-filter-radius');
    const queryInput = document.getElementById('marketplace-filter-query');
    const sortSelect = document.getElementById('marketplace-sort');

    // Add change listeners
    [categoryFilter, priceFilter, conditionFilter, radiusFilter, sortSelect].forEach(element => {
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
        (radiusFilter && radiusFilter.value) ||
        (queryInput && queryInput.value.trim())
      );
    }
  }

  // Initialize view toggle (grid/list)
  function initViewToggle() {
    const toggleBtn = document.getElementById('marketplace-view-toggle');
    const resultsContainer = document.getElementById('marketplace-results');
    const viewIcon = document.getElementById('view-icon');

    if (!toggleBtn || !resultsContainer) {
      return;
    }

    let isGridView = true;

    toggleBtn.addEventListener('click', () => {
      isGridView = !isGridView;

      if (isGridView) {
        resultsContainer.className = 'marketplace-grid';
        if (viewIcon) {
          viewIcon.textContent = '⊞';
        }
        toggleBtn.textContent = '';
        const icon = document.createElement('span');
        icon.id = 'view-icon';
        icon.textContent = '⊞';
        toggleBtn.appendChild(icon);
        toggleBtn.appendChild(document.createTextNode(' Grid View'));
      } else {
        resultsContainer.className = 'marketplace-list';
        if (viewIcon) {
          viewIcon.textContent = '☰';
        }
        toggleBtn.textContent = '';
        const icon = document.createElement('span');
        icon.id = 'view-icon';
        icon.textContent = '☰';
        toggleBtn.appendChild(icon);
        toggleBtn.appendChild(document.createTextNode(' List View'));
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
