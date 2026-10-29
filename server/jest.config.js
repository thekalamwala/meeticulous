/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'controllers/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'routes/**/*.js',
    'lib/**/*.js',
    '!utils/sendEmail.js',
    '!utils/notify.js',
    '!utils/logger.js',
  ],
  coverageThreshold: { global: { lines: 32, functions: 30 } },
  setupFilesAfterEnv: [],
  // bcryptjs (pure-JS, cost 10) and speakeasy are CPU-bound. On a saturated or
  // slow CI runner, a test that hashes several values (e.g. generateRecoveryCodes
  // → Promise.all of N hashes) can exceed Jest's 5s default and flake. 15s gives
  // headroom without slowing passing tests (the timeout only caps a hang).
  testTimeout: 15000,
  clearMocks: true,
  restoreMocks: true,
};
