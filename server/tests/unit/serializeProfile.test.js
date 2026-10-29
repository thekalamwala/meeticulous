/**
 * tests/unit/serializeProfile.test.js
 * serializeProfile projects the is_host capability (Phase 0) and the Supreme
 * kill-switch-bypass hint (bypasses_flags + safety_keys, v3.36) the client uses
 * to keep gated UI visible for Supreme holders.
 */
// authController loads config/supabase at require-time (throws without env) —
// mock it minimally so the module loads.
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {},
  signInWithPassword: jest.fn(),
  mintSessionForEmail: jest.fn(),
}));
// serializeProfile resolves the caller's plan to derive bypasses_flags.
jest.mock('../../services/planService', () => ({
  getPlan: jest.fn(),
  resolveVendorPlan: jest.fn((p) => p?.plan || 'starter'),
}));

const planService = require('../../services/planService');
const { serializeProfile } = require('../../controllers/authController');
const { SAFETY_KEYS } = require('../../config/featureRegistry');

beforeEach(() => {
  jest.clearAllMocks();
  planService.getPlan.mockResolvedValue({ slug: 'starter', bypasses_kill_switches: false });
});

describe('serializeProfile', () => {
  test('projects is_host from the profile row', async () => {
    const out = await serializeProfile({ id: 'u1', role: 'host', is_host: true }, null);
    expect(out.is_host).toBe(true);
    expect(out.role).toBe('host'); // role still returned during shim phases
  });

  test('is_host defaults to false when absent', async () => {
    const out = await serializeProfile({ id: 'u2', role: 'guest' }, null);
    expect(out.is_host).toBe(false);
  });

  test('bypasses_flags is false for a normal plan; safety_keys is the denylist', async () => {
    const out = await serializeProfile({ id: 'u3', plan: 'creator' }, null);
    expect(out.bypasses_flags).toBe(false);
    expect(out.safety_keys).toEqual(SAFETY_KEYS);
  });

  test('bypasses_flags is true when the resolved plan bypasses kill-switches', async () => {
    planService.getPlan.mockResolvedValue({ slug: 'supreme', bypasses_kill_switches: true });
    const out = await serializeProfile({ id: 'u4', plan: 'supreme' }, null);
    expect(out.bypasses_flags).toBe(true);
  });

  test('bypasses_flags fails safe to false when the plan lookup throws', async () => {
    planService.getPlan.mockRejectedValue(new Error('db down'));
    const out = await serializeProfile({ id: 'u5', plan: 'supreme' }, null);
    expect(out.bypasses_flags).toBe(false);
  });
});
