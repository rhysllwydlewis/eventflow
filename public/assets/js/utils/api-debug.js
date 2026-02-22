/**
 * API call logging for debugging authentication and request issues
 */

function logApiCall(method, path, status, response) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${method} ${path} → ${status}`;

  if (status >= 200 && status < 300) {
    console.log(`✅ ${message}`, response);
  } else if (status >= 400 && status < 500) {
    console.warn(`⚠️ ${message}`, response);
  } else {
    console.error(`❌ ${message}`, response);
  }
}

// Intercept fetch calls to log API activity
const originalFetch = window.fetch;
window.fetch = function (...args) {
  const [resource] = args;

  // Only log API calls
  if (typeof resource === 'string' && resource.includes('/api/')) {
    return originalFetch
      .apply(this, args)
      .then(response => {
        logApiCall(args[1]?.method || 'GET', resource, response.status, response);
        return response;
      })
      .catch(error => {
        console.error(`❌ Network error for ${resource}:`, error);
        throw error;
      });
  }

  return originalFetch.apply(this, args);
};
