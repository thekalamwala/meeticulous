'use strict';

/**
 * Single source of truth for load-test mode.
 *
 * Load mode skips the Razorpay signature + amount re-checks, so it must NEVER be
 * active outside an explicitly-safe environment. Fail-closed (audit P3-8): the
 * flag is honoured ONLY when NODE_ENV is 'development' or 'test'. Any other value
 * — 'production', 'staging', or unset — ignores it, so a misconfigured host (e.g.
 * NODE_ENV never set) can't accidentally accept the payment bypass.
 * Read live at call time so tests and runtime can toggle env freely.
 */
function isLoadTestMode() {
  if (process.env.LOAD_TEST_MODE !== 'true') return false;
  const env = process.env.NODE_ENV;
  if (env === 'development' || env === 'test') return true;
  console.warn(`[loadTestMode] LOAD_TEST_MODE ignored: NODE_ENV=${env || '(unset)'} is not development/test`);
  return false;
}

module.exports = { isLoadTestMode };
