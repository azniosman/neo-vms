module.exports = {
  testEnvironment: 'node',
  collectCoverageFrom: [
    'server/**/*.js',
    '!server/index.js',
    '!server/**/*.test.js',
    '!server/node_modules/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/server/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testTimeout: 30000,
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};