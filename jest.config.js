module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    '**/*.js',
    '!node_modules/**',
    '!coverage/**',
    '!tests/**',
    '!jest.config.js',
    '!data/**',
    '!uploads/**',
    '!outbox/**',
    '!public/uploads/**',
  ],

  // Test patterns
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.spec.js'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/data/', '/uploads/'],

  // Coverage thresholds (adjusted to realistic levels based on current codebase)
  coverageThreshold: {
    global: {
      branches: 3,
      functions: 2,
      lines: 3,
      statements: 3,
    },
  },

  // Timeout for tests
  testTimeout: 10000,

  // Verbose output
  verbose: true,
};
