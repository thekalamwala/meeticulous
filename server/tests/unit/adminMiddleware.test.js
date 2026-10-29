/**
 * tests/unit/adminMiddleware.test.js
 * RBAC route guard — token verification + permission gating. Uses real signed
 * tokens from adminAuthService (no mocks) so the integration is genuinely tested.
 */
process.env.SUPER_ADMIN_JWT_SECRET = 'unit-test-admin-secret';

const { jwtSign } = require('../../services/adminAuthService');
const { requireAdmin, requireSuperAdmin } = require('../../middleware/adminMiddleware');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};
const reqWith = (token) => ({ headers: token ? { authorization: `Bearer ${token}` } : {} });

const adminToken = (permissions, role = 'operations') =>
  jwtSign({ type: 'admin', sub: 'a1', email: 'a@x.com', username: 'a', name: 'A', role, permissions });

describe('requireAdmin', () => {
  test('401 when no Authorization header', () => {
    const res = mockRes(); const next = jest.fn();
    requireAdmin('ops.view')(reqWith(null), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('401 on a malformed/invalid token', () => {
    const res = mockRes(); const next = jest.fn();
    requireAdmin('ops.view')(reqWith('garbage'), res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 when the token is not an admin token', () => {
    const res = mockRes(); const next = jest.fn();
    const vendorish = jwtSign({ type: 'vendor', sub: 'v1', permissions: ['*'] });
    requireAdmin('ops.view')(reqWith(vendorish), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('403 when the admin lacks the required permission', () => {
    const res = mockRes(); const next = jest.fn();
    requireAdmin('users.delete')(reqWith(adminToken(['users.view'])), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('next() + req.admin populated when permission is granted', () => {
    const req = reqWith(adminToken(['users.view', 'users.delete'])); const res = mockRes(); const next = jest.fn();
    requireAdmin('users.delete')(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.admin).toMatchObject({ id: 'a1', role: 'operations' });
    expect(req.admin.permissions).toContain('users.delete');
  });

  test('wildcard permission satisfies any required permission', () => {
    const res = mockRes(); const next = jest.fn();
    requireAdmin('users.delete')(reqWith(adminToken(['*'], 'super')), res, next);
    expect(next).toHaveBeenCalled();
  });

  test('no-arg requireAdmin() just needs a valid admin session', () => {
    const res = mockRes(); const next = jest.fn();
    requireAdmin()(reqWith(adminToken(['ops.view'])), res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireSuperAdmin', () => {
  test('403 for a non-super admin', () => {
    const res = mockRes(); const next = jest.fn();
    requireSuperAdmin(reqWith(adminToken(['ops.view', 'finance.view'], 'finance')), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('next() for a super admin (wildcard)', () => {
    const res = mockRes(); const next = jest.fn();
    requireSuperAdmin(reqWith(adminToken(['*'], 'super')), res, next);
    expect(next).toHaveBeenCalled();
  });
});
