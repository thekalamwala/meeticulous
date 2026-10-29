'use strict';
/**
 * razorpayConfig — a DB read failure must not silently swap live credentials.
 *
 * Credentials live in platform_settings (secret encrypted). The reader destructured
 * only `data`, and supabase-js RETURNS errors rather than throwing — so a failed
 * read looked exactly like "nothing configured" and fell through to the env
 * credentials, with the securityLog never firing because nothing threw.
 *
 * On a host whose RAZORPAY_* env vars hold test keys that means charging on the
 * wrong account; on one where they are unset it means `enabled` flips false and
 * checkout stops. Either way, silently.
 */

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn(), auditLog: jest.fn(), logger: {} }));
jest.mock('../../utils/cryptoTokens', () => ({ encrypt: (v) => v, decrypt: (v) => v }));
jest.mock('razorpay', () => jest.fn(), { virtual: true });

const { supabaseAdmin } = require('../../config/supabase');
const { securityLog } = require('../../utils/logger');
const razorpayConfig = require('../../services/razorpayConfig');

const chain = (result) => {
  const c = {};
  for (const m of ['select', 'in']) c[m] = jest.fn(() => c);
  c.then = (resolve) => resolve(result);
  return c;
};

const DB_CREDS = [
  { key: 'razorpay_key_id', value: 'rzp_live_FROMDB' },
  { key: 'razorpay_key_secret', value: 'secret_from_db' },
  { key: 'razorpay_webhook_secret', value: 'whsec_from_db' },
  { key: 'razorpay_mode', value: 'live' },
  { key: 'razorpay_enabled', value: 'true' },
];

beforeEach(() => {
  jest.clearAllMocks();
  razorpayConfig.clearCache();
  process.env.RAZORPAY_KEY_ID = 'rzp_test_FROMENV';
  process.env.RAZORPAY_KEY_SECRET = 'secret_from_env';
});

test('reads live credentials from the DB, not env', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: DB_CREDS, error: null }));
  const cfg = await razorpayConfig.getConfig();
  expect(cfg.keyId).toBe('rzp_live_FROMDB');
  expect(cfg.mode).toBe('live');
});

test('a returned error serves the last good credentials, NOT the env test key', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: DB_CREDS, error: null }));
  await razorpayConfig.getConfig();

  razorpayConfig.clearCache();
  supabaseAdmin.from.mockImplementation(() => chain({ data: null, error: { message: 'connection terminated' } }));
  const cfg = await razorpayConfig.getConfig();

  expect(cfg.keyId).toBe('rzp_live_FROMDB');
  expect(cfg.keyId).not.toBe(process.env.RAZORPAY_KEY_ID);   // the actual hazard
  expect(cfg.keySecret).toBe('secret_from_db');
  expect(cfg.mode).toBe('live');
  expect(cfg.enabled).toBe(true);
});

test('the fallback is alerted, not silent', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: DB_CREDS, error: null }));
  await razorpayConfig.getConfig();
  razorpayConfig.clearCache();
  jest.clearAllMocks();

  supabaseAdmin.from.mockImplementation(() => chain({ data: null, error: { message: 'boom' } }));
  await razorpayConfig.getConfig();

  expect(securityLog).toHaveBeenCalledWith('razorpay_config_db_fallback',
    expect.objectContaining({ served: 'last_known_good' }));
});

test('an empty table is a SUCCESSFUL read — env fallback still applies', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: [], error: null }));
  const cfg = await razorpayConfig.getConfig();
  expect(cfg.keyId).toBe('rzp_test_FROMENV');
});

test('cold start with a failed read falls through to env and says so', async () => {
  jest.resetModules();
  const { supabaseAdmin: sb } = require('../../config/supabase');
  const { securityLog: log } = require('../../utils/logger');
  const fresh = require('../../services/razorpayConfig');

  sb.from.mockImplementation(() => chain({ data: null, error: { message: 'db down' } }));
  const cfg = await fresh.getConfig();

  expect(cfg.keyId).toBe('rzp_test_FROMENV');
  expect(log).toHaveBeenCalledWith('razorpay_config_db_fallback',
    expect.objectContaining({ served: 'env_cold_start' }));
});
