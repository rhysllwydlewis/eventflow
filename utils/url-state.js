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
  
  // Parse page with validation
  const pageParam = params.get('page');
  let page = 1;
  if (pageParam) {
    const parsed = parseInt(pageParam, 10);
    page = !isNaN(parsed) && parsed > 0 ? parsed : 1;
  }
  
  // Parse budget with validation
  const budgetMin = params.get('budgetMin');
  const budgetMax = params.get('budgetMax');
  let validBudgetMin = '';
  let validBudgetMax = '';
  
  if (budgetMin && budgetMax) {
    const min = parseInt(budgetMin, 10);
    const max = parseInt(budgetMax, 10);
    
    // Only use if both are valid numbers and min <= max
    if (!isNaN(min) && !isNaN(max) && min <= max) {
      validBudgetMin = budgetMin;
      validBudgetMax = budgetMax;
    }
  }
  
  // Handle multi-select categories (support both comma and repeated params)
  let categories = params.getAll('category');
  if (categories.length === 0) {
    // Try comma-separated
    const categoryParam = params.get('category');
    if (categoryParam) {
      categories = categoryParam.split(',').map(c => c.trim()).filter(c => c);
    }
  }
  
  return {
    q: params.get('q') || '',
    location: params.get('location') || '',
    category: categories,
    eventType: params.get('eventType') || '',
    budgetMin: validBudgetMin,
    budgetMax: validBudgetMax,
    sort: params.get('sort') || 'relevance',
    page,
  };
}

// Debounce timer for URL updates
let updateURLTimer = null;

/**
 * Update URL with filter values (pushState)
 * Debounced to prevent tight loops
 * @param {Object} filters - Filter values to encode in URL
 * @param {boolean} replace - Use replaceState instead of pushState
 */
export function updateURL(filters, replace = false) {
  // Clear existing timer
  if (updateURLTimer) {
    clearTimeout(updateURLTimer);
  }
  
  // Debounce URL updates by 100ms to prevent tight loops
  updateURLTimer = setTimeout(() => {
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
    
    updateURLTimer = null;
  }, 100);
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
