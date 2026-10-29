/**
 * tests/unit/becomeHost.test.js — POST /api/auth/become-host (unified identity).
 * Flips is_host on the current account + seeds onboarding; never resets a host
 * who already finished onboarding.
 */
jest.mock('../../config/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return {
    supabaseAdmin: { from: jest.fn(() => chain), __chain: chain },
    signInWithPassword: jest.fn(),
    mintSessionForEmail: jest.fn(),
  };
});

const { supabaseAdmin } = require('../../config/supabase');
const { becomeHost } = require('../../controllers/authController');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};

beforeEach(() => jest.clearAllMocks());

test('flips is_host and seeds onboarding for a guest', async () => {
  const guest = { id: 'g1', username: 'user-99', is_host: false, onboarding_slug: null, onboarding_step_completed: 0, onboarding_completed: false };
  supabaseAdmin.__chain.single
    .mockResolvedValueOnce({ data: guest, error: null })                                   // SELECT
    .mockResolvedValueOnce({ data: { ...guest, is_host: true, role: 'host' }, error: null }); // UPDATE
  const r = res();
  await becomeHost({ user: { id: 'g1' } }, r);
  expect(supabaseAdmin.__chain.update).toHaveBeenCalledWith(
    expect.objectContaining({ is_host: true, onboarding_step_completed: 1, onboarding_slug: 'user-99' })
  );
  expect(r.json.mock.calls[0][0].is_host).toBe(true);
});

test('404 when the profile is missing', async () => {
  supabaseAdmin.__chain.single.mockResolvedValueOnce({ data: null, error: null });
  const r = res();
  await becomeHost({ user: { id: 'x' } }, r);
  expect(r.status).toHaveBeenCalledWith(404);
});

test('does not reset a host who already completed onboarding', async () => {
  const host = { id: 'h1', username: 'doc', is_host: true, onboarding_slug: 'doc', onboarding_step_completed: 6, onboarding_completed: true };
  supabaseAdmin.__chain.single
    .mockResolvedValueOnce({ data: host, error: null })
    .mockResolvedValueOnce({ data: host, error: null });
  const r = res();
  await becomeHost({ user: { id: 'h1' } }, r);
  const patch = supabaseAdmin.__chain.update.mock.calls[0][0];
  expect(patch.is_host).toBe(true);
  expect(patch).not.toHaveProperty('onboarding_completed');
  expect(patch).not.toHaveProperty('onboarding_step_completed');
});
