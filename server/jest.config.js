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
  // A worker that lingers past Jest's shutdown grace makes Jest force-exit with
  // code 1 even when every suite passed — seen only on Render's slower build box:
  // the deploy build (`NODE_ENV=test npm run test:unit`) fails right after printing
  // "412 passed", while the same commit exits 0 locally and in GitHub CI. forceExit
  // exits on the run's result code (0 on pass) the moment tests finish; it never
  // masks a real failure (a failing suite still exits non-zero).
  forceExit: true,
};
