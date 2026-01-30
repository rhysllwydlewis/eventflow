/**
 * Suppliers Page Initialization
 * URL-driven filters, search integration, shortlist and quote features
 */

import { getFiltersFromURL, updateURL, handlePopState } from '../../../utils/url-state.js';
import {
  trackSearch,
  trackFilterChange,
  trackResultClick,
  trackShortlistAdd,
} from '../../../utils/analytics.js';
import shortlistManager from '../utils/shortlist-manager.js';

// HTML escaping utility
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') {
    return '';
  }
  const div = document.createElement('div');
  div.textContent = unsafe;
  return div.innerHTML;
}

// Generate gradient for supplier avatars
function generateSupplierGradient(name) {
  const colors = [
    ['#13B6A2', '#0B8073'],
    ['#8B5CF6', '#6D28D9'],
    ['#F59E0B', '#D97706'],
    ['#10B981', '#059669'],
    ['#3B82F6', '#2563EB'],
    ['#EC4899', '#DB2777'],
  ];
  const index = name ? name.charCodeAt(0) % colors.length : 0;
  return `linear-gradient(135deg, ${colors[index][0]} 0%, ${colors[index][1]} 100%)`;
}

// Enhanced supplier card with shortlist and quote features
function createSupplierCard(supplier, position) {
  const supplierInitial = supplier.name ? supplier.name.charAt(0).toUpperCase() : 'S';
  const avatarHtml = supplier.logo
    ? `<img src="${escapeHtml(supplier.logo)}" alt="${escapeHtml(supplier.name)} logo" class="supplier-card-avatar" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
       <div class="supplier-card-avatar-fallback" style="display: none; background: ${generateSupplierGradient(supplier.name)};">${supplierInitial}</div>`
    : `<div class="supplier-card-avatar-fallback" style="background: ${generateSupplierGradient(supplier.name)};">${supplierInitial}</div>`;

  const isInShortlist = shortlistManager.hasItem('supplier', supplier.id);
  const shortlistBtnClass = isInShortlist ? 'btn-shortlist-active' : '';
  const shortlistBtnText = isInShortlist ? '❤️ Saved' : '♡ Save';

  // Build badges
  const badges = [];
  if (supplier.verified) {
    badges.push('<span class="badge badge-verified">✓ Verified</span>');
  }
  if (supplier.isPro) {
    badges.push('<span class="badge badge-pro">Pro</span>');
  }
  if (supplier.featuredSupplier) {
    badges.push('<span class="badge badge-featured">Featured</span>');
  }

  const rating = supplier.rating ? `⭐ ${supplier.rating}` : '';
  const priceDisplay = supplier.price_display || 'Contact for quote';

  return `
    <div class="card supplier-card" data-supplier-id="${escapeHtml(supplier.id)}">
      ${avatarHtml}
      <div class="supplier-card-content">
        <h3 class="supplier-card-name">
          <a href="/supplier.html?id=${encodeURIComponent(supplier.id)}" 
             data-position="${position}"
             class="supplier-card-link">
            ${escapeHtml(supplier.name)}
          </a>
        </h3>
        <div class="supplier-card-meta">
          ${escapeHtml(supplier.category || '')}
          ${supplier.location ? `• ${escapeHtml(supplier.location)}` : ''}
          ${rating ? `• ${rating}` : ''}
        </div>
        <p class="supplier-card-description">${escapeHtml(supplier.description_short || '')}</p>
        <div class="supplier-card-badges">${badges.join('')}</div>
        <div class="supplier-card-price">${priceDisplay}</div>
        <div class="supplier-card-actions">
          <button class="btn btn-primary btn-quote" data-supplier-id="${escapeHtml(supplier.id)}">
            Request Quote
          </button>
          <button class="btn btn-secondary btn-shortlist ${shortlistBtnClass}" 
                  data-supplier-id="${escapeHtml(supplier.id)}"
                  data-supplier-name="${escapeHtml(supplier.name)}"
                  data-supplier-category="${escapeHtml(supplier.category || '')}"
                  data-supplier-location="${escapeHtml(supplier.location || '')}"
                  data-supplier-image="${escapeHtml(supplier.logo || '')}"
                  data-supplier-price="${escapeHtml(priceDisplay)}"
                  data-supplier-rating="${supplier.rating || ''}">
            ${shortlistBtnText}
          </button>
          <a href="/supplier.html?id=${encodeURIComponent(supplier.id)}" 
             class="btn btn-tertiary">
            View Profile
          </a>
        </div>
      </div>
    </div>
  `;
}

// Skeleton loading cards
function createSkeletonCards(count = 3) {
  return Array(count)
    .fill()
    .map(
      () => `
    <div class="card skeleton-card" style="height: 250px; margin-bottom: 20px;"></div>
  `
    )
    .join('');
}

// Empty state
function createEmptyState(filters) {
  const hasFilters =
    filters.q || filters.category || filters.location || filters.budgetMin || filters.budgetMax;

  return `
    <div class="empty-state">
      <div class="empty-state-icon">🔍</div>
      <h2>No suppliers found</h2>
      <p>${hasFilters ? 'No suppliers match your current filters.' : 'No suppliers available at the moment.'}</p>
      <div class="empty-state-actions">
        ${hasFilters ? '<button class="btn btn-secondary" id="clear-filters-btn">Clear filters</button>' : ''}
        <a href="/start.html" class="btn btn-primary">Start planning</a>
      </div>
    </div>
  `;
}

// Search suppliers using the v2 API
async function searchSuppliers(filters, page = 1) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.location) {
    params.set('location', filters.location);
  }
  if (filters.category) {
    params.set('category', filters.category);
  }
  if (filters.eventType) {
    params.set('eventType', filters.eventType);
  }
  if (filters.budgetMin) {
    params.set('minPrice', filters.budgetMin);
  }
  if (filters.budgetMax) {
    params.set('maxPrice', filters.budgetMax);
  }
  if (filters.sort) {
    params.set('sortBy', filters.sort);
  }
  params.set('page', page);
  params.set('limit', 20);

  try {
    const response = await fetch(`/api/v2/search/suppliers?${params.toString()}`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Search failed');
    }

    const result = await response.json();
    return result.data || { results: [], pagination: { total: 0, page: 1, totalPages: 1 } };
  } catch (error) {
    console.error('Search error:', error);
    return { results: [], pagination: { total: 0, page: 1, totalPages: 1 } };
  }
}

// Initialize suppliers page
async function initSuppliersPage() {
  const resultsContainer = document.getElementById('results');
  const resultCountEl = document.getElementById('resultCount');
  const filterCategoryEl = document.getElementById('filterCategory');
  const filterPriceEl = document.getElementById('filterPrice');
  const filterQueryEl = document.getElementById('filterQuery');

  if (!resultsContainer) {
    console.warn('Results container not found, skipping suppliers init');
    return;
  }

  let currentFilters = getFiltersFromURL();
  let isLoading = false;

  // Populate filter inputs from URL
  function populateFiltersFromURL() {
    if (filterQueryEl && currentFilters.q) {
      filterQueryEl.value = currentFilters.q;
    }
    if (filterCategoryEl && currentFilters.category) {
      filterCategoryEl.value = currentFilters.category;
    }
    if (filterPriceEl && currentFilters.budgetMin && currentFilters.budgetMax) {
      // Map budget to price range
      const priceMap = {
        1000: '£',
        2000: '££',
        5000: '£££',
      };
      filterPriceEl.value = priceMap[currentFilters.budgetMax] || '';
    }
  }

  // Render results
  async function renderResults() {
    if (isLoading) {
      return;
    }
    isLoading = true;

    // Show skeleton loading
    resultsContainer.innerHTML = createSkeletonCards();

    try {
      const data = await searchSuppliers(currentFilters, currentFilters.page);
      const { results, pagination } = data;

      // Track search
      trackSearch(currentFilters.q || '', currentFilters, pagination.total);

      // Update result count
      if (resultCountEl) {
        resultCountEl.textContent = `${pagination.total} supplier${pagination.total !== 1 ? 's' : ''} found`;
      }

      // Render results or empty state
      if (results.length === 0) {
        resultsContainer.innerHTML = createEmptyState(currentFilters);
        attachEmptyStateHandlers();
      } else {
        resultsContainer.innerHTML = results
          .map((supplier, index) => createSupplierCard(supplier, index + 1))
          .join('');
        attachCardHandlers();
      }

      // TODO: Add pagination controls
    } catch (error) {
      console.error('Render error:', error);
      resultsContainer.innerHTML =
        '<div class="card"><p>Error loading suppliers. Please try again.</p></div>';
    } finally {
      isLoading = false;
    }
  }

  // Attach handlers to supplier cards
  function attachCardHandlers() {
    // Shortlist buttons
    resultsContainer.querySelectorAll('.btn-shortlist').forEach(btn => {
      btn.addEventListener('click', async e => {
        e.preventDefault();
        const supplierId = btn.dataset.supplierId;
        const isActive = btn.classList.contains('btn-shortlist-active');

        if (isActive) {
          await shortlistManager.removeItem('supplier', supplierId);
          btn.classList.remove('btn-shortlist-active');
          btn.textContent = '♡ Save';
        } else {
          const item = {
            type: 'supplier',
            id: supplierId,
            name: btn.dataset.supplierName,
            category: btn.dataset.supplierCategory,
            location: btn.dataset.supplierLocation,
            imageUrl: btn.dataset.supplierImage,
            priceHint: btn.dataset.supplierPrice,
            rating: btn.dataset.supplierRating ? parseFloat(btn.dataset.supplierRating) : null,
          };
          await shortlistManager.addItem(item);
          btn.classList.add('btn-shortlist-active');
          btn.textContent = '❤️ Saved';
          trackShortlistAdd('supplier', supplierId);
        }
      });
    });

    // Quote buttons
    resultsContainer.querySelectorAll('.btn-quote').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        const supplierId = btn.dataset.supplierId;
        const card = btn.closest('.supplier-card');
        const shortlistBtn = card.querySelector('.btn-shortlist');

        // Get supplier data from card
        const supplier = {
          id: supplierId,
          name: shortlistBtn.dataset.supplierName,
          category: shortlistBtn.dataset.supplierCategory,
        };

        // Dispatch event to open quote modal
        window.dispatchEvent(
          new CustomEvent('openQuoteRequestModal', {
            detail: { items: [supplier] },
          })
        );
      });
    });

    // Track result clicks
    resultsContainer.querySelectorAll('.supplier-card-link').forEach(link => {
      link.addEventListener('click', e => {
        const supplierId = link.closest('.supplier-card').dataset.supplierId;
        const position = parseInt(link.dataset.position, 10);
        trackResultClick('supplier', supplierId, position);
      });
    });
  }

  // Attach handlers to empty state
  function attachEmptyStateHandlers() {
    const clearBtn = document.getElementById('clear-filters-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        currentFilters = { sort: 'relevance', page: 1 };
        updateURL(currentFilters, true);
        if (filterQueryEl) {
          filterQueryEl.value = '';
        }
        if (filterCategoryEl) {
          filterCategoryEl.value = '';
        }
        if (filterPriceEl) {
          filterPriceEl.value = '';
        }
        renderResults();
      });
    }
  }

  // Handle filter changes
  if (filterQueryEl) {
    let debounceTimer;
    filterQueryEl.addEventListener('input', e => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        currentFilters.q = e.target.value;
        currentFilters.page = 1;
        updateURL(currentFilters);
        renderResults();
        trackFilterChange('query', e.target.value);
      }, 500);
    });
  }

  if (filterCategoryEl) {
    filterCategoryEl.addEventListener('change', e => {
      currentFilters.category = e.target.value;
      currentFilters.page = 1;
      updateURL(currentFilters);
      renderResults();
      trackFilterChange('category', e.target.value);
    });
  }

  if (filterPriceEl) {
    filterPriceEl.addEventListener('change', e => {
      // Map price range to budget
      const priceMap = {
        '£': { min: '0', max: '1000' },
        '££': { min: '1000', max: '2000' },
        '£££': { min: '2000', max: '5000' },
      };
      const range = priceMap[e.target.value];
      if (range) {
        currentFilters.budgetMin = range.min;
        currentFilters.budgetMax = range.max;
      } else {
        delete currentFilters.budgetMin;
        delete currentFilters.budgetMax;
      }
      currentFilters.page = 1;
      updateURL(currentFilters);
      renderResults();
      trackFilterChange('price', e.target.value);
    });
  }

  // Handle browser back/forward
  handlePopState(filters => {
    currentFilters = filters;
    populateFiltersFromURL();
    renderResults();
  });

  // Quick category shortcuts
  document.querySelectorAll('[data-quick-category]').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-quick-category');
      currentFilters.category = category;
      currentFilters.page = 1;
      if (filterCategoryEl) {
        filterCategoryEl.value = category;
      }
      updateURL(currentFilters);
      renderResults();
    });
  });

  // Initial render
  populateFiltersFromURL();
  renderResults();
}

// Auto-initialize when DOM is ready, only on suppliers page
function shouldInit() {
  // Check if we're on the suppliers page by looking for the results container
  // and verifying the page context
  return document.getElementById('results') && window.location.pathname.includes('suppliers');
}

if (shouldInit()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSuppliersPage);
  } else {
    initSuppliersPage();
  }
}

export default initSuppliersPage;
