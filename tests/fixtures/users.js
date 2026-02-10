/**
 * User test fixtures
 * Provides sample user data for integration tests
 */

module.exports = {
  validUser: {
    email: 'testuser@example.com',
    password: 'SecurePassword123!',
    username: 'testuser',
    name: 'Test User',
  },

  validAdmin: {
    email: 'testadmin@example.com',
    password: 'AdminPassword123!',
    username: 'testadmin',
    name: 'Test Admin',
    role: 'admin',
  },

  validSupplier: {
    email: 'testsupplier@example.com',
    password: 'SupplierPassword123!',
    username: 'testsupplier',
    name: 'Test Supplier',
    role: 'supplier',
  },

  invalidEmail: {
    email: 'invalid-email',
    password: 'SecurePassword123!',
    username: 'testuser',
  },

  weakPassword: {
    email: 'testuser@example.com',
    password: '123',
    username: 'testuser',
  },

  // Generate unique user for each test
  generateUser: (suffix = Date.now()) => ({
    email: `user${suffix}@example.com`,
    password: 'SecurePassword123!',
    username: `user${suffix}`,
    name: `Test User ${suffix}`,
  }),

  // Generate unique admin
  generateAdmin: (suffix = Date.now()) => ({
    email: `admin${suffix}@example.com`,
    password: 'AdminPassword123!',
    username: `admin${suffix}`,
    name: `Test Admin ${suffix}`,
    role: 'admin',
  }),

  // Generate unique supplier
  generateSupplier: (suffix = Date.now()) => ({
    email: `supplier${suffix}@example.com`,
    password: 'SupplierPassword123!',
    username: `supplier${suffix}`,
    name: `Test Supplier ${suffix}`,
    role: 'supplier',
  }),
};
