/**
 * tests/unit/adminSessionRevocation.test.js
 *
 * Security audit F-02: an admin JWT carries a token_version (`tv`); the guard
 * rejects a token whose version is behind the DB (deactivate/demote/reset bumps
 * it). Critically FAIL-OPEN: reject ONLY on a confirmed higher DB version or
 * is_active=false; any uncertainty (no tv, missing column, DB error) must ALLOW,
 * so the feature can never lock admins out.
 *
 * A fresh subject id per case avoids the 30s in-memory revocation cache bleeding
 * between cases.
 */
const mockMaybeSingle = jest.fn();
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }),
  },
}));
jest.mock('../../services/adminAuthService', () => ({ jwtVerify: jest.fn() }));

const { jwtVerify } = require('../../services/adminAuthService');
const { requireAdmin } = require('../../middleware/adminMiddleware');

const run = async (sub, tokenTv, dbRow) => {
  jwtVerify.mockReturnValue({
    type: 'admin', sub, permissions: ['users.view'],
    ...(tokenTv !== undefined ? { tv: tokenTv } : {}),
  });
  mockMaybeSingle.mockResolvedValue(dbRow);
  const req = { headers: { authorization: 'Bearer x' } };
  const res = {
    statusCode: null, body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
  const next = jest.fn();
  await requireAdmin('users.view')(req, res, next);
  return { nexted: next.mock.calls.length > 0, status: res.statusCode };
};

describe('F-02 — admin session revocation (fail-open)', () => {
  test('token version matches DB → allowed', async () => {
    expect(await run('a1', 2, { data: { token_version: 2, is_active: true }, error: null }))
      .toEqual({ nexted: true, status: null });
  });

  test('token version BEHIND DB → revoked (401)', async () => {
    const r = await run('a2', 1, { data: { token_version: 3, is_active: true }, error: null });
    expect(r.nexted).toBe(false);
    expect(r.status).toBe(401);
  });

  test('account deactivated → revoked (401)', async () => {
    const r = await run('a3', 5, { data: { token_version: 5, is_active: false }, error: null });
    expect(r.nexted).toBe(false);
    expect(r.status).toBe(401);
  });

  test('DB error → FAIL-OPEN (allowed)', async () => {
    expect(await run('a4', 2, { data: null, error: { message: 'transient blip' } }))
      .toEqual({ nexted: true, status: null });
  });

  test('token with no tv (pre-feature session) → allowed without a DB read', async () => {
    mockMaybeSingle.mockClear();
    const r = await run('a5', undefined, { data: { token_version: 9, is_active: true }, error: null });
    expect(r).toEqual({ nexted: true, status: null });
    expect(mockMaybeSingle).not.toHaveBeenCalled(); // short-circuits before any read
  });
});
