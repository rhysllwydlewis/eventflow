module.exports = {
  // Test environment
  testEnvironment: 'node',

  // Parallel test execution
  maxWorkers: '50%',

  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  collectCoverageFrom: [
    'routes/**/*.js',
    'services/**/*.js',
    'middleware/**/*.js',
    '*.js',
    '!node_modules/**',
    '!coverage/**',
    '!tests/**',
    '!jest.config.js',
    '!playwright.config.js',
    '!data/**',
    '!uploads/**',
    '!outbox/**',
    '!public/**',
    '!scripts/**',
    '!functions/**',
    '!e2e/**',
  ],

  // Test patterns
  testMatch: ['**/tests/**/*.test.js', '**/tests/**/*.spec.js'],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Ignore patterns
  testPathIgnorePatterns: ['/node_modules/', '/data/', '/uploads/'],

  // Coverage thresholds (target 70% for production-grade code)
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },

  // Timeout for tests
  testTimeout: 10000,

  // Verbose output
  verbose: true,
};
