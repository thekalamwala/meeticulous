/**
 * tests/unit/adminSuperGate.test.js
 *
 * Security audit F-03: the gateway-credential routes and the feature-flag routes
 * must be guarded by `requireSuperAdmin` (structural, wildcard-only), NOT by the
 * grantable `requireAdmin('settings.manage')`. Feature flags include the CRM
 * master send-switch and the payments kill-switch; the Razorpay secret lives on
 * the payment-settings routes. A future `admin_roles` edit that grants
 * `settings.manage` to a non-super role must not reach them.
 *
 * Pins the ROUTE WIRING by identity: requireSuperAdmin is an imported singleton,
 * whereas requireAdmin('x') returns a fresh closure — so a regression back to
 * the permission string fails this test.
 */
process.env.SUPER_ADMIN_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET || 'test-secret-f03';

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({}), auth: { getUser: jest.fn() } },
  supabase: {},
  signInWithPassword: jest.fn(),
  mintSessionForEmail: jest.fn(),
}));

const adminRoutes = require('../../routes/adminRoutes');
const { requireSuperAdmin } = require('../../middleware/adminMiddleware');

const guardsFor = (method, path) => {
  const layer = adminRoutes.stack.find(
    (l) => l.route && l.route.path === path && l.route.methods[method.toLowerCase()],
  );
  if (!layer) throw new Error(`route not found: ${method} ${path}`);
  return layer.route.stack.map((s) => s.handle);
};

describe('F-03 — gateway credentials + feature flags are super-admin-only', () => {
  const superOnly = [
    ['get',   '/settings/payment/razorpay'],
    ['put',   '/settings/payment/razorpay'],
    ['post',  '/settings/payment/razorpay/test'],
    ['get',   '/features'],
    ['post',  '/features'],
    ['patch', '/features/:key'],
  ];

  test.each(superOnly)('%s %s is guarded by requireSuperAdmin', (m, p) => {
    expect(guardsFor(m, p)).toContain(requireSuperAdmin);
  });

  // Guard against OVER-gating: ordinary platform settings stay on a granular
  // permission so a legitimate settings-admin role still works.
  test('PUT /settings is NOT super-gated (stays a granular permission)', () => {
    expect(guardsFor('put', '/settings')).not.toContain(requireSuperAdmin);
  });
});
