/**
 * URL State Management Utility
 * Manages filter state in URL parameters for shareable search results
 */

/**
 * Read filters from URL parameters
 * @returns {Object} Filter object with category, location, budgetMin, budgetMax, q, eventType, sort, page
 */
export function getFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);

  // Support both priceMin/Max and budgetMin/Max for backward compatibility
  const budgetMin = params.get('budgetMin') || params.get('priceMin') || '';
  const budgetMax = params.get('budgetMax') || params.get('priceMax') || '';

  return {
    category: params.get('category') || '',
    location: params.get('location') || '',
    budgetMin: budgetMin,
    budgetMax: budgetMax,
    q: params.get('q') || '',
    eventType: params.get('eventType') || '',
    sort: params.get('sort') || 'relevance',
    page: parseInt(params.get('page'), 10) || 1,
  };
}

/**
 * Update URL with current filter state
 * @param {Object} filters - Filter object
 * @param {boolean} replace - If true, use replaceState instead of pushState
 */
export function updateURL(filters, replace = false) {
  const params = new URLSearchParams();

  // Add non-empty filter parameters
  if (filters.category) {
    params.set('category', filters.category);
  }
  if (filters.location) {
    params.set('location', filters.location);
  }
  // Use priceMin/Max as canonical names (requirement specifies these)
  if (filters.budgetMin) {
    params.set('priceMin', filters.budgetMin);
  }
  if (filters.budgetMax) {
    params.set('priceMax', filters.budgetMax);
  }
  if (filters.q) {
    params.set('q', filters.q);
  }
  if (filters.eventType) {
    params.set('eventType', filters.eventType);
  }
  if (filters.sort && filters.sort !== 'relevance') {
    params.set('sort', filters.sort);
  }
  if (filters.page && filters.page > 1) {
    params.set('page', filters.page);
  }

  const queryString = params.toString();
  const newUrl = queryString
    ? `${window.location.pathname}?${queryString}`
    : window.location.pathname;

  if (replace) {
    window.history.replaceState({}, '', newUrl);
  } else {
    window.history.pushState({}, '', newUrl);
  }
}

/**
 * Handle browser back/forward navigation
 * @param {Function} callback - Function to call with updated filters
 */
export function handlePopState(callback) {
  window.addEventListener('popstate', () => {
    const filters = getFiltersFromURL();
    callback(filters);
  });
}
