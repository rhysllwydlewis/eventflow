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

  // Coverage thresholds – raised from baseline (15/17/20/20) as coverage grows
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 22,
      lines: 25,
      statements: 25,
    },
  },

  // Timeout for tests
  testTimeout: 10000,

  // Force Jest to exit after all tests complete; prevents hanging on open handles
  // Known issue: test-isolation open handle leaks remain unresolved (thresholds updated Feb 2026)
  forceExit: true,

  // Verbose output
  verbose: true,
};
