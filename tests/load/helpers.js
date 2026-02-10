/**
 * Artillery load test helper functions
 * Provides utilities for load testing scenarios
 */

/**
 * Add CSRF token to request (for authenticated endpoints)
 * In production, this would fetch a real CSRF token
 * @param {Object} requestParams - Request parameters
 * @param {Object} context - Artillery context
 * @param {Object} ee - Event emitter
 * @param {Function} next - Callback
 */
function addCsrfToken(requestParams, context, ee, next) {
  // In a real scenario, you would fetch CSRF token from session
  // For load testing, we'll use a mock or skip CSRF for specific endpoints
  if (!requestParams.headers) {
    requestParams.headers = {};
  }

  // Add CSRF token header (this would be fetched in real scenario)
  requestParams.headers['X-CSRF-Token'] = context.vars.csrfToken || 'test-csrf-token';

  return next();
}

/**
 * Add authentication header to request
 * @param {Object} context - Artillery context
 * @param {Object} events - Event emitter
 * @param {Function} done - Callback
 */
function addAuthHeader(context, events, done) {
  // If we have an auth token from a previous request, use it
  if (context.vars.authToken) {
    context.vars.authHeader = `Bearer ${context.vars.authToken}`;
  }

  return done();
}

/**
 * Log response for debugging
 * @param {Object} requestParams - Request parameters
 * @param {Object} response - Response object
 * @param {Object} context - Artillery context
 * @param {Object} ee - Event emitter
 * @param {Function} next - Callback
 */
function logResponse(requestParams, response, context, ee, next) {
  if (response.statusCode >= 400) {
    console.log(`Error response: ${response.statusCode} for ${requestParams.url}`);
  }
  return next();
}

/**
 * Generate random event data for AI requests
 * @param {Object} context - Artillery context
 * @param {Object} events - Event emitter
 * @param {Function} done - Callback
 */
function generateEventData(context, events, done) {
  const eventTypes = ['Wedding', 'Corporate Event', 'Birthday Party', 'Conference'];
  const locations = ['New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX'];

  context.vars.eventData = {
    eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
    guestCount: Math.floor(Math.random() * 300) + 50,
    budget: Math.floor(Math.random() * 50000) + 5000,
    location: locations[Math.floor(Math.random() * locations.length)],
    preferences: 'Modern and elegant',
  };

  return done();
}

/**
 * Validate response status
 * @param {Object} requestParams - Request parameters
 * @param {Object} response - Response object
 * @param {Object} context - Artillery context
 * @param {Object} ee - Event emitter
 * @param {Function} next - Callback
 */
function validateResponse(requestParams, response, context, ee, next) {
  // Check if response is successful
  if (response.statusCode >= 200 && response.statusCode < 300) {
    ee.emit('counter', 'responses.success', 1);
  } else if (response.statusCode >= 400 && response.statusCode < 500) {
    ee.emit('counter', 'responses.client_error', 1);
  } else if (response.statusCode >= 500) {
    ee.emit('counter', 'responses.server_error', 1);
  }

  return next();
}

module.exports = {
  addCsrfToken,
  addAuthHeader,
  logResponse,
  generateEventData,
  validateResponse,
};
