/**
 * tests/unit/adminLoginEnum.test.js
 *
 * Security audit F-15: the admin-login unknown/inactive-account path returned a
 * generic 401 but WITHOUT running bcrypt, so a valid username was distinguishable
 * by response latency (real account ≈ one bcrypt compare slower). Assert the miss
 * path now runs a (throwaway) password compare so timing is equalized.
 */
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_dummy';

const mockVerifyPassword = jest.fn(async () => false);
jest.mock('../../services/adminAuthService', () => ({
  verifyPassword: mockVerifyPassword,
  hashPassword:   jest.fn(async () => '$2a$10$0123456789012345678901uGf0cZc4lqj8sWJ1xN2kqg3h4i5j6K'),
  jwtSign:        jest.fn(() => 'tok'),
  jwtVerify:      jest.fn(() => ({})),
  verifyPending:  jest.fn(() => ({})),
}));
jest.mock('../../lib/ipBlocklist', () => ({
  recordAdminLoginFailure: jest.fn(() => Promise.resolve()),
  resetAdminLoginFailures: jest.fn(),
}));
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
  },
}));

const { adminLogin } = require('../../controllers/adminAuthController');

const makeRes = () => {
  const r = {};
  r.status = jest.fn(() => r);
  r.json = jest.fn(() => r);
  return r;
};

beforeEach(() => mockVerifyPassword.mockClear());

describe('F-15 — admin login does not leak account existence by timing', () => {
  test('unknown account → generic 401 AND a password compare still runs', async () => {
    const res = makeRes();
    await adminLogin({ body: { identifier: 'ghost-admin', password: 'whatever' }, headers: {} }, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials.' });
    // The timing-equalizer: a compare runs even though the account doesn't exist.
    expect(mockVerifyPassword).toHaveBeenCalled();
  });
});
