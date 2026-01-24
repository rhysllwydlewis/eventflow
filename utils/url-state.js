/**
 * URL State Management Utilities
 * Helpers for managing filter state in URL query parameters
 */

/**
 * Get filters from URL query parameters
 * @returns {Object} Filter values from URL
 */
export function getFiltersFromURL() {
  const params = new URLSearchParams(window.location.search);
  
  return {
    q: params.get('q') || '',
    location: params.get('location') || '',
    category: params.getAll('category').length > 0 ? params.getAll('category') : [],
    eventType: params.get('eventType') || '',
    budgetMin: params.get('budgetMin') || '',
    budgetMax: params.get('budgetMax') || '',
    sort: params.get('sort') || 'relevance',
    page: parseInt(params.get('page')) || 1,
  };
}

/**
 * Update URL with filter values (pushState)
 * @param {Object} filters - Filter values to encode in URL
 * @param {boolean} replace - Use replaceState instead of pushState
 */
export function updateURL(filters, replace = false) {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // Handle multiple values (e.g., categories)
      value.forEach(v => {
        if (v) params.append(key, v);
      });
    } else if (value) {
      // Only add non-empty values
      params.set(key, value);
    }
  });
  
  const newURL = `${window.location.pathname}?${params.toString()}`;
  
  if (replace) {
    window.history.replaceState({ filters }, '', newURL);
  } else {
    window.history.pushState({ filters }, '', newURL);
  }
}

/**
 * Build query string from filters object
 * @param {Object} filters - Filter values
 * @returns {string} Query string (without leading ?)
 */
export function buildQueryString(filters) {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => {
        if (v) params.append(key, v);
      });
    } else if (value) {
      params.set(key, value);
    }
  });
  
  return params.toString();
}

/**
 * Handle browser back/forward navigation
 * @param {Function} callback - Function to call with restored filters
 */
export function handlePopState(callback) {
  window.addEventListener('popstate', (event) => {
    const filters = event.state?.filters || getFiltersFromURL();
    callback(filters);
  });
}
