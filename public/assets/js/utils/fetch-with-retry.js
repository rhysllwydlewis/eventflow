/**
 * Fetch with Retry Utility - Issue 7 Fix
 * Provides automatic retry logic for failed API calls
 */

/**
 * Fetch with automatic retry on failure
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} retryDelay - Initial delay between retries in ms (default: 1000)
 * @param {Function} onRetry - Optional callback called on each retry
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithRetry(
  url,
  options = {},
  maxRetries = 3,
  retryDelay = 1000,
  onRetry = null
) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal || AbortSignal.timeout(10000)
      });
      
      // Retry on 5xx server errors (but not on client errors like 404)
      if (response.status >= 500 && attempt < maxRetries) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      return response;
      
    } catch (error) {
      lastError = error;
      
      // Don't retry on abort/timeout errors
      if (error.name === 'AbortError') {
        throw error;
      }
      
      // Don't retry if we've exhausted all attempts
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calculate exponential backoff delay
      const delay = retryDelay * Math.pow(2, attempt);
      
      console.warn(
        `[Fetch Retry] Attempt ${attempt + 1}/${maxRetries + 1} failed for ${url}. ` +
        `Retrying in ${delay}ms...`,
        error.message
      );
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(attempt + 1, maxRetries, delay, error);
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Fetch JSON with automatic retry
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function fetchJsonWithRetry(url, options = {}, maxRetries = 3) {
  const response = await fetchWithRetry(url, options, maxRetries);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

// Make available globally
window.fetchWithRetry = fetchWithRetry;
window.fetchJsonWithRetry = fetchJsonWithRetry;
