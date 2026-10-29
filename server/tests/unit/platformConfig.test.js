'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn(), auditLog: jest.fn(), logger: {} }));
const { supabaseAdmin } = require('../../config/supabase');
const { securityLog } = require('../../utils/logger');
const platformConfig = require('../../services/platformConfig');

const chain = (result) => {
  const c = {};
  for (const m of ['select', 'in']) c[m] = jest.fn(() => c);
  c.then = (resolve) => resolve(result);
  return c;
};

beforeEach(() => { jest.clearAllMocks(); platformConfig.clearCache(); });

test('getConfig returns settlement clearingDays from settings', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: [
    { key: 'settlement_clearing_days', value: '3' },
  ] }));
  const cfg = await platformConfig.getConfig();
  expect(cfg.clearingDays).toBe(3);
});

test('getConfig defaults clearingDays to 7 when unset', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: [] }));
  const cfg = await platformConfig.getConfig();
  expect(cfg.clearingDays).toBe(7);
});

test('getConfig clamps negative clearingDays to default', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: [
    { key: 'settlement_clearing_days', value: '-5' },
  ] }));
  const cfg = await platformConfig.getConfig();
  expect(cfg.clearingDays).toBe(7);
});

test('feeOnlyMode defaults to TRUE when unset (interim fail-safe)', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: [] }));
  const cfg = await platformConfig.getConfig();
  expect(cfg.feeOnlyMode).toBe(true);
});

test('feeOnlyMode reads false when explicitly disabled (Route go-live)', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: [
    { key: 'fee_only_mode', value: false },
  ] }));
  const cfg = await platformConfig.getConfig();
  expect(cfg.feeOnlyMode).toBe(false);
});

test('feeOnlyMode coerces string "false" / "0" to false', async () => {
  supabaseAdmin.from.mockImplementation(() => chain({ data: [
    { key: 'fee_only_mode', value: '"false"' },
  ] }));
  const cfg = await platformConfig.getConfig();
  expect(cfg.feeOnlyMode).toBe(false);
});

// COLD START only — no successful read has happened yet, so DEFAULTS are the
// best available answer. Needs a fresh module instance: once any read succeeds,
// the last-known-good path takes over (see the describe block below).
test('cold start with no prior good read falls back to safe defaults AND alerts', async () => {
  jest.resetModules();
  const { supabaseAdmin: sb } = require('../../config/supabase');
  const { securityLog: log } = require('../../utils/logger');
  const fresh = require('../../services/platformConfig');

  sb.from.mockImplementation(() => { throw new Error('db down'); });
  const cfg = await fresh.getConfig();

  expect(cfg.platformFee).toBe(10);
  expect(cfg.gstRate).toBe(0.18);
  expect(cfg.clearingDays).toBe(7);
  expect(cfg.feeOnlyMode).toBe(true);   // fail-safe: stays fee-only on DB error
  expect(log).toHaveBeenCalledWith(
    'platform_config_db_fallback',
    expect.objectContaining({ error: 'db down', served: 'defaults_cold_start' }),
  );
});

// ── Last-known-good on a failed read ────────────────────────────────────────
// supabase-js RETURNS errors rather than throwing, so `const { data } = ...`
// made a failed read indistinguishable from an empty table: every setting
// silently reverted to DEFAULTS and the securityLog never fired. On prod that
// meant a DB blip could flip fee_only_mode back ON (hosts stop being able to
// sell) with no alert. These pin that a blip can never change a live value.
describe('config never silently reverts on a failed read', () => {
  const LIVE = [
    { key: 'platform_fee', value: '25' },
    { key: 'platform_fee_gst_rate', value: '0.05' },
    { key: 'fee_only_mode', value: 'false' },
    { key: 'settlement_clearing_days', value: '3' },
  ];

  test('a returned error serves the last good config, not DEFAULTS', async () => {
    supabaseAdmin.from.mockImplementation(() => chain({ data: LIVE, error: null }));
    const good = await platformConfig.getConfig();
    expect(good.platformFee).toBe(25);
    expect(good.feeOnlyMode).toBe(false);

    platformConfig.clearCache();
    supabaseAdmin.from.mockImplementation(() => chain({ data: null, error: { message: 'connection terminated' } }));
    const after = await platformConfig.getConfig();

    expect(after.platformFee).toBe(25);
    expect(after.gstRate).toBe(0.05);
    expect(after.clearingDays).toBe(3);
    // The one that actually bites: reverting this stops hosts selling.
    expect(after.feeOnlyMode).toBe(false);
    expect(after.feeOnlyMode).not.toBe(platformConfig.DEFAULTS.feeOnlyMode);
  });

  test('the fallback is alerted, not silent', async () => {
    supabaseAdmin.from.mockImplementation(() => chain({ data: LIVE, error: null }));
    await platformConfig.getConfig();
    platformConfig.clearCache();
    jest.clearAllMocks();

    supabaseAdmin.from.mockImplementation(() => chain({ data: null, error: { message: 'boom' } }));
    await platformConfig.getConfig();

    expect(securityLog).toHaveBeenCalledWith('platform_config_db_fallback',
      expect.objectContaining({ served: 'last_known_good' }));
  });

  test('clearCache keeps last-known-good — an admin save then a blip must not revert', async () => {
    supabaseAdmin.from.mockImplementation(() => chain({ data: LIVE, error: null }));
    await platformConfig.getConfig();

    platformConfig.clearCache();              // what an admin edit triggers
    supabaseAdmin.from.mockImplementation(() => chain({ data: null, error: { message: 'blip' } }));
    const cfg = await platformConfig.getConfig();

    expect(cfg.platformFee).toBe(25);
    expect(cfg.feeOnlyMode).toBe(false);
  });

  test('a thrown error is handled the same as a returned one', async () => {
    supabaseAdmin.from.mockImplementation(() => chain({ data: LIVE, error: null }));
    await platformConfig.getConfig();

    platformConfig.clearCache();
    supabaseAdmin.from.mockImplementation(() => { throw new Error('network down'); });
    const cfg = await platformConfig.getConfig();

    expect(cfg.platformFee).toBe(25);
    expect(cfg.feeOnlyMode).toBe(false);
  });

  test('an empty table is a SUCCESSFUL read — defaults still apply', async () => {
    supabaseAdmin.from.mockImplementation(() => chain({ data: [], error: null }));
    const cfg = await platformConfig.getConfig();
    expect(cfg.platformFee).toBe(platformConfig.DEFAULTS.platformFee);
    expect(cfg.feeOnlyMode).toBe(true);
  });
});
