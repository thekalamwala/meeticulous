/**
 * tests/unit/publicHardeningWiring.test.js
 *
 * Audit F-13: POST /api/payment/create-order must run optionalProtect so the
 *   account-ownership branch works (was email-only; the authed branch was dead).
 * Audit F-21: the opening OTP routes must stack otpContactLimiter (per-contact)
 *   on top of the per-IP otpLimiter.
 */
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({}), auth: {} },
  supabase: {},
  signInWithPassword: jest.fn(),
  mintSessionForEmail: jest.fn(),
}));

const paymentRoutes = require('../../routes/paymentRoutes');
const openingRoutes = require('../../routes/openingRoutes');
const { optionalProtect } = require('../../middleware/authMiddleware');
const { otpContactLimiter } = require('../../middleware/security');

const handles = (routes, method, path) => {
  const l = routes.stack.find((x) => x.route && x.route.path === path && x.route.methods[method]);
  if (!l) throw new Error(`route not found: ${method} ${path}`);
  return l.route.stack.map((s) => s.handle);
};

test('F-13 — create-order is guarded by optionalProtect', () => {
  expect(handles(paymentRoutes, 'post', '/create-order')).toContain(optionalProtect);
});

test('F-21 — opening OTP routes stack otpContactLimiter', () => {
  expect(handles(openingRoutes, 'post', '/verify/start')).toContain(otpContactLimiter);
  expect(handles(openingRoutes, 'post', '/verify/confirm')).toContain(otpContactLimiter);
});
