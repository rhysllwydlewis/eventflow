/**
 * Test helper functions
 * Common utilities for integration tests
 */

const request = require('supertest');

/**
 * Register a new user and return auth token
 * @param {Object} app - Express app instance
 * @param {Object} userData - User data for registration
 * @returns {Promise<{token: string, user: Object}>}
 */
async function registerUser(app, userData) {
  const res = await request(app).post('/api/v1/auth/register').send(userData).expect(201);

  return {
    token: res.body.token,
    user: res.body.user,
  };
}

/**
 * Login user and return auth token
 * @param {Object} app - Express app instance
 * @param {Object} credentials - User credentials
 * @returns {Promise<{token: string, user: Object}>}
 */
async function loginUser(app, credentials) {
  const res = await request(app).post('/api/v1/auth/login').send(credentials).expect(200);

  return {
    token: res.body.token,
    user: res.body.user,
  };
}

/**
 * Extract cookie from response
 * @param {Object} response - Supertest response
 * @returns {string} Cookie string
 */
function extractCookie(response) {
  const cookies = response.headers['set-cookie'];
  if (!cookies || cookies.length === 0) {
    return '';
  }
  return cookies[0].split(';')[0];
}

/**
 * Make authenticated request
 * @param {Object} app - Express app instance
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {string} token - Auth token
 * @param {Object} data - Request body data
 * @returns {Promise<Object>} Response
 */
async function authenticatedRequest(app, method, url, token, data = null) {
  const req = request(app)[method.toLowerCase()](url).set('Cookie', `token=${token}`);

  if (data) {
    req.send(data);
  }

  return req;
}

/**
 * Clean up test data (if needed)
 * @param {Object} db - Database instance
 */
async function cleanupTestData(db) {
  // Implementation depends on database structure
  // This is a placeholder for cleanup operations
  if (db && typeof db.collection === 'function') {
    // MongoDB cleanup example
    try {
      await db.collection('users').deleteMany({ email: /test.*@example\.com/ });
      await db.collection('packages').deleteMany({ title: /Test.*/ });
      await db.collection('suppliers').deleteMany({ name: /Test.*/ });
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }
}

/**
 * Wait for async operations
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise}
 */
function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random string
 * @param {number} length - Length of string
 * @returns {string}
 */
function randomString(length = 10) {
  return Math.random()
    .toString(36)
    .substring(2, 2 + length);
}

/**
 * Create CSRF token mock (for testing)
 * @returns {string}
 */
function mockCsrfToken() {
  return `test-csrf-token-${randomString()}`;
}

module.exports = {
  registerUser,
  loginUser,
  extractCookie,
  authenticatedRequest,
  cleanupTestData,
  wait,
  randomString,
  mockCsrfToken,
};
