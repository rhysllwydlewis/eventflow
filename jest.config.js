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

  // Coverage thresholds – set to current baseline; increase as test coverage grows
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 17,
      lines: 20,
      statements: 20,
    },
  },

  // Timeout for tests
  testTimeout: 10000,

  // Force Jest to exit after all tests complete; prevents hanging on open handles
  forceExit: true,

  // Verbose output
  verbose: true,
};
