'use strict';
/**
 * paidMode — per-host override of the global fee_only_mode.
 * Rule: feeOnlyForHost(host) = global fee_only_mode AND NOT profiles.paid_enabled.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const platformConfig = require('../../services/platformConfig');
const paidMode = require('../../services/paidMode');

const wireProfile = (paid_enabled) => {
  supabaseAdmin.from.mockImplementation(() => {
    const c = {};
    c.select = jest.fn(() => c);
    c.eq = jest.fn(() => c);
    c.maybeSingle = jest.fn(() => Promise.resolve({ data: paid_enabled == null ? null : { paid_enabled }, error: null }));
    return c;
  });
};

beforeEach(() => { jest.clearAllMocks(); paidMode.clearCache(); });

test('global paid mode → nobody is fee-only (no profile lookup)', async () => {
  platformConfig.getConfig.mockResolvedValue({ feeOnlyMode: false });
  wireProfile(false);
  expect(await paidMode.feeOnlyForHost('h1')).toBe(false);
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});

test('global fee-only + host NOT paid-enabled → fee-only', async () => {
  platformConfig.getConfig.mockResolvedValue({ feeOnlyMode: true });
  wireProfile(false);
  expect(await paidMode.feeOnlyForHost('h1')).toBe(true);
});

test('global fee-only + host paid-enabled → NOT fee-only (pilot host is live)', async () => {
  platformConfig.getConfig.mockResolvedValue({ feeOnlyMode: true });
  wireProfile(true);
  expect(await paidMode.feeOnlyForHost('h1')).toBe(false);
});

test('missing column / no row → fail-safe fee-only', async () => {
  platformConfig.getConfig.mockResolvedValue({ feeOnlyMode: true });
  wireProfile(null);
  expect(await paidMode.feeOnlyForHost('h1')).toBe(true);
});
