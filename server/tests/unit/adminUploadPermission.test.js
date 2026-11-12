/**
 * tests/unit/adminUploadPermission.test.js
 *
 * Security audit F-14: POST /api/admin/upload/image was `requireAdmin()` (any
 * admin, incl. the read-only support role). Assert it now requires `cms.manage`.
 */
process.env.SUPER_ADMIN_JWT_SECRET = process.env.SUPER_ADMIN_JWT_SECRET || 'test-secret-f14';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'sb_secret_dummy';

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({}), auth: { getUser: jest.fn() } },
  supabase: {},
  signInWithPassword: jest.fn(),
  mintSessionForEmail: jest.fn(),
}));

const adminRoutes = require('../../routes/adminRoutes');
const { jwtSign } = require('../../services/adminAuthService');

const uploadGuard = () => {
  const layer = adminRoutes.stack.find(
    (l) => l.route && l.route.path === '/upload/image' && l.route.methods.post,
  );
  return layer.route.stack[0].handle; // the guard runs before multer + handler
};

const runGuard = (perms) =>
  new Promise((resolve) => {
    const req = { headers: { authorization: 'Bearer ' + jwtSign({ type: 'admin', sub: 'a1', permissions: perms }, 300) } };
    const res = { status: (code) => ({ json: () => resolve({ status: code }) }) };
    uploadGuard()(req, res, () => resolve({ next: true }));
  });

describe('F-14 — admin image upload requires cms.manage', () => {
  test('admin without cms.manage is forbidden (403)', async () => {
    expect(await runGuard(['users.view', 'bookings.view'])).toEqual({ status: 403 });
  });
  test('admin with cms.manage passes', async () => {
    expect(await runGuard(['cms.manage'])).toEqual({ next: true });
  });
  test('super admin (wildcard) passes', async () => {
    expect(await runGuard(['*'])).toEqual({ next: true });
  });
});
