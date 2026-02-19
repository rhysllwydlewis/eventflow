/**
 * Jest setup file
 * Runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-only-minimum-32-characters-long';
process.env.EMAIL_ENABLED = 'false';
// Enable legacy messaging APIs in test environment so integration tests for
// v1/v2 routes remain testable. The deprecation headers are still added.
process.env.LEGACY_MESSAGING_MODE = process.env.LEGACY_MESSAGING_MODE || 'on';

// Mock console methods to reduce test noise (optional)
// Uncomment if you want cleaner test output
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Set longer timeout for integration tests
jest.setTimeout(10000);
