/**
 * Analytics Utility
 * Client-side event tracking for user behavior analytics
 */

/**
 * Track an analytics event
 * @param {string} event - Event name (e.g., 'search_performed')
 * @param {Object} properties - Event properties/data
 * @returns {Promise<void>}
 */
export async function trackEvent(event, properties = {}) {
  try {
    // Get CSRF token from cookie
    const token = getCsrfToken();
    
    await fetch('/api/analytics/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'X-CSRF-Token': token }),
      },
      body: JSON.stringify({
        event,
        properties,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch (error) {
    // Fail silently - analytics should never block UX
    console.debug('Analytics tracking failed:', error);
  }
}

/**
 * Get CSRF token from cookie
 */
function getCsrfToken() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split('=');
    if (name === 'csrf') {
      return value;
    }
  }
  return null;
}

/**
 * Track a search event
 * @param {string} query - Search query text
 * @param {Object} filters - Applied filters
 * @param {number} resultsCount - Number of results returned
 */
export function trackSearch(query, filters = {}, resultsCount = 0) {
  return trackEvent('search_performed', {
    query,
    filters,
    resultsCount,
  });
}

/**
 * Track a filter change event
 * @param {string} filterName - Name of changed filter
 * @param {*} filterValue - New filter value
 */
export function trackFilterChange(filterName, filterValue) {
  return trackEvent('filter_changed', {
    filterName,
    filterValue,
  });
}

/**
 * Track a result click event
 * @param {string} resultType - Type of result ('supplier' or 'listing')
 * @param {string} resultId - ID of clicked result
 * @param {number} position - Position in results list
 */
export function trackResultClick(resultType, resultId, position) {
  return trackEvent('result_clicked', {
    resultType,
    resultId,
    position,
  });
}

/**
 * Track shortlist add event
 * @param {string} itemType - Type of item ('supplier' or 'listing')
 * @param {string} itemId - ID of item
 */
export function trackShortlistAdd(itemType, itemId) {
  return trackEvent('shortlist_add', {
    itemType,
    itemId,
  });
}

/**
 * Track shortlist remove event
 * @param {string} itemType - Type of item ('supplier' or 'listing')
 * @param {string} itemId - ID of item
 */
export function trackShortlistRemove(itemType, itemId) {
  return trackEvent('shortlist_remove', {
    itemType,
    itemId,
  });
}

/**
 * Track quote request started event
 * @param {number} supplierCount - Number of suppliers in request
 */
export function trackQuoteRequestStarted(supplierCount) {
  return trackEvent('quote_request_started', {
    supplierCount,
  });
}

/**
 * Track quote request submitted event
 * @param {number} supplierCount - Number of suppliers in request
 * @param {string} eventType - Type of event
 */
export function trackQuoteRequestSubmitted(supplierCount, eventType) {
  return trackEvent('quote_request_submitted', {
    supplierCount,
    eventType,
  });
}
