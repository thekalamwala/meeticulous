/**
 * tests/unit/requireHost.test.js — role guard for host-capability routes.
 */
jest.mock('../../config/supabase', () => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn(),
  };
  return { supabaseAdmin: { from: jest.fn(() => chain), __chain: chain } };
});

const { supabaseAdmin } = require('../../config/supabase');
const { requireHost } = require('../../middleware/authMiddleware');

const res = () => {
  const r = {};
  r.status = jest.fn().mockReturnValue(r);
  r.json   = jest.fn().mockReturnValue(r);
  return r;
};
const setRole = (role) =>
  supabaseAdmin.__chain.single.mockResolvedValue({ data: role ? { role } : null, error: null });
const setProfile = (data) =>
  supabaseAdmin.__chain.single.mockResolvedValue({ data, error: null });

beforeEach(() => jest.clearAllMocks());

test('401 when no authenticated user', async () => {
  const r = res(); const next = jest.fn();
  await requireHost({ user: null }, r, next);
  expect(r.status).toHaveBeenCalledWith(401);
  expect(next).not.toHaveBeenCalled();
});

test('host → next()', async () => {
  setRole('host');
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'u1' } }, r, next);
  expect(next).toHaveBeenCalled();
  expect(r.status).not.toHaveBeenCalled();
});

test('superadmin → next()', async () => {
  setRole('superadmin');
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'a1' } }, r, next);
  expect(next).toHaveBeenCalled();
});

test('guest → 403, no next()', async () => {
  setRole('guest');
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'g1' } }, r, next);
  expect(r.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test('missing profile → 403 (fail closed)', async () => {
  setRole(null);
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'x' } }, r, next);
  expect(r.status).toHaveBeenCalledWith(403);
});

test('uses req.user.role if already attached (no DB read)', async () => {
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'u1', role: 'host' } }, r, next);
  expect(next).toHaveBeenCalled();
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});

// ── is_host capability (v3.34) — the new source of truth, role is the shim ──
test('is_host:true capability (no role) → next()', async () => {
  setProfile({ is_host: true });
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'h1' } }, r, next);
  expect(next).toHaveBeenCalled();
  expect(r.status).not.toHaveBeenCalled();
});

test('is_host:false + role guest → 403', async () => {
  setProfile({ is_host: false, role: 'guest' });
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'g2' } }, r, next);
  expect(r.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

test('uses req.user.is_host if already attached (no DB read)', async () => {
  const r = res(); const next = jest.fn();
  await requireHost({ user: { id: 'h2', is_host: true } }, r, next);
  expect(next).toHaveBeenCalled();
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});
