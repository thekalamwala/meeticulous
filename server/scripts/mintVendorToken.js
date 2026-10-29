'use strict';
/**
 * Mint a Supabase access token for a seeded load-test vendor, so JMeter's
 * vendor-flow can hit authed endpoints. The app's vendor auth is Google-only,
 * but seedLoadTest.js gives the vendor a Supabase password, so we sign in via
 * the disposable-client helper (NEVER the shared admin — see supabase.js).
 *
 * Prints ONLY the token to stdout (so run.js can capture it):
 *   VENDOR_TOKEN=$(node server/scripts/mintVendorToken.js)
 */
require('dotenv').config();
const { signInWithPassword } = require('../config/supabase');
const { assertNotProd } = require('./lib/guard');

const EMAIL = process.env.LOADTEST_VENDOR_EMAIL || 'loadtest-vendor-rules@loadtest.bookasloth.local';
const PASSWORD = process.env.LOADTEST_VENDOR_PASSWORD || 'LoadTest!2026';

(async () => {
  assertNotProd('mintVendorToken');
  const { data, error } = await signInWithPassword(EMAIL, PASSWORD);
  const token = data && data.session && data.session.access_token;
  if (error || !token) {
    console.error('Failed to mint vendor token:', (error && error.message) || 'no session (is the vendor seeded?)');
    process.exit(1);
  }
  process.stdout.write(token);
})().catch((e) => { console.error(e); process.exit(1); });
