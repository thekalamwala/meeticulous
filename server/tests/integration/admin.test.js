/**
 * tests/integration/admin.test.js
 * Tests for /api/admin — role-gated CRUD for users, bookings,
 * services, settings, and the cleanup endpoint.
 */
jest.mock('../../config/supabase', () => require('./helpers').makeSbMock());
// adminRoutes guards every route with requireAdmin(permission) and a few with
// requireSuperAdmin. Both must be mocked: requireAdmin is a FACTORY returning a
// middleware. A request carrying 'admin-token' is treated as a full super admin.
jest.mock('../../middleware/adminMiddleware', () => ({
  requireAdmin: (_permission) => (req, res, next) => {
    if (!req.headers.authorization?.includes('admin-token'))
      return res.status(403).json({ message: 'Admin access required' });
    req.admin = { id: 'test-admin', email: 'admin@test', role: 'super', permissions: ['*'] };
    next();
  },
  requireSuperAdmin: (req, res, next) => {
    if (!req.headers.authorization?.includes('admin-token'))
      return res.status(403).json({ message: 'Super admin access required' });
    req.admin = { id: 'test-admin', email: 'admin@test', role: 'super', permissions: ['*'] };
    next();
  },
}));

// audit() is covered by its own unit test; stub it so the route-level mocks
// (which don't stub .insert) don't emit benign "[audit] failed" console noise.
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));

const request    = require('supertest');
const express    = require('express');
const { supabaseAdmin }             = require('../../config/supabase');
const adminRoutes                   = require('../../routes/adminRoutes');
const { VENDOR_PROFILE, BOOKING, SERVICE } = require('./helpers');

const app = express();
app.use(express.json());
app.use('/api/admin', adminRoutes);

const adminHeaders  = () => ({ Authorization: 'Bearer admin-token' });
const vendorHeaders = () => ({ Authorization: 'Bearer vendor-token' });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROLE GUARD — non-admin cannot access any /admin route
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('Admin role guard', () => {
  test('403 — vendor token rejected on /admin/stats', async () => {
    const res = await request(app).get('/api/admin/stats').set(vendorHeaders());
    expect(res.status).toBe(403);
  });

  test('403 — no token rejected on /admin/users', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(403);
  });

  test('200 — admin token accepted on /admin/stats', async () => {
    // Thenable fluent mocks: support .select().eq() chaining AND be directly awaitable.
    const makeThen = (val) => (res, rej) => Promise.resolve(val).then(res, rej);
    const countMock = (count, extra = {}) => ({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      neq:    jest.fn().mockReturnThis(),
      then:   makeThen({ count, data: null, error: null, ...extra }),
    });
    // getStats now queries bookings FIRST (with the snapshot columns), then the
    // three count queries: guests, hosts, services.
    supabaseAdmin.from
      .mockReturnValueOnce(countMock(0, { data: [], count: 0 })) // bookings
      .mockReturnValueOnce(countMock(5))                          // users (guests)
      .mockReturnValueOnce(countMock(3))                          // vendors (hosts)
      .mockReturnValueOnce(countMock(10));                        // services
    const res = await request(app).get('/api/admin/stats').set(adminHeaders());
    expect(res.status).toBe(200);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// USERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('GET /api/admin/users', () => {
  test('returns user list for admin', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [VENDOR_PROFILE], count: 1, error: null }),
      ilike: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
    });
    const res = await request(app).get('/api/admin/users').set(adminHeaders());
    expect(res.status).toBe(200);
  });
});

describe('GET /api/admin/users/:id', () => {
  test('404 — non-existent user', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });
    // valid UUID that doesn't exist → genuine not-found path (non-UUID ids are 400)
    const res = await request(app).get('/api/admin/users/00000000-0000-0000-0000-000000000000').set(adminHeaders());
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/admin/users/:id', () => {
  test('updates is_verified flag', async () => {
    supabaseAdmin.from.mockReturnValue({
      update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { ...VENDOR_PROFILE, is_verified: true }, error: null }),
    });
    const res = await request(app)
      .put('/api/admin/users/vendor-uuid')
      .set(adminHeaders())
      .send({ is_verified: true });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/admin/users/:id', () => {
  test('deletes user and returns message', async () => {
    // deleteUser pre-reads the profile's image URLs (select→eq→maybeSingle),
    // then deletes the row (delete→eq). The post-delete storage purge is
    // best-effort and safely no-ops without a storage mock.
    supabaseAdmin.from.mockReturnValue({
      select:      jest.fn().mockReturnThis(),
      delete:      jest.fn().mockReturnThis(),
      eq:          jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      then:        (resolve) => resolve({ error: null }), // delete().eq() awaits this
    });
    const res = await request(app)
      .delete('/api/admin/users/user-uuid')
      .set(adminHeaders());
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});

describe('PATCH /api/admin/users/:id/categories', () => {
  test('profession change clears categorised services and reports services_cleared', async () => {
    supabaseAdmin.from
      // 1) categories → active slugs
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockResolvedValue({ data: [{ slug: 'doctor' }, { slug: 'photographer' }], error: null }),
      })
      // 2) profiles select — prior profession (before)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { primary_category: 'photographer' }, error: null }),
      })
      // 3) profiles update — new profession (after)
      .mockReturnValueOnce({
        update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id: 'vendor-uuid', primary_category: 'doctor', categories: ['doctor'] }, error: null }),
      })
      // 4) services update — clears the (category, primary_category) pair
      .mockReturnValueOnce({
        update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [{ id: 's1' }, { id: 's2' }], error: null }),
      });

    const res = await request(app)
      .patch('/api/admin/users/vendor-uuid/categories')
      .set(adminHeaders())
      .send({ primary_category: 'doctor', categories: ['doctor'] });

    expect(res.status).toBe(200);
    expect(res.body.services_cleared).toBe(2);
    expect(res.body.primary_category).toBe('doctor');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BOOKINGS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('GET /api/admin/bookings', () => {
  test('returns booking list for admin', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(), order: jest.fn().mockReturnThis(),
      range: jest.fn().mockResolvedValue({ data: [BOOKING], count: 1, error: null }),
      eq:    jest.fn().mockReturnThis(),
    });
    const res = await request(app).get('/api/admin/bookings').set(adminHeaders());
    expect(res.status).toBe(200);
  });
});

describe('PUT /api/admin/bookings/:id', () => {
  test('updates booking status', async () => {
    supabaseAdmin.from.mockReturnValue({
      update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { ...BOOKING, status: 'cancelled' }, error: null }),
    });
    const res = await request(app)
      .put('/api/admin/bookings/booking-1')
      .set(adminHeaders())
      .send({ status: 'cancelled' });
    expect(res.status).toBe(200);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SERVICES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('GET /api/admin/services', () => {
  test('returns all services for admin', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      order:  jest.fn().mockReturnThis(),
      limit:  jest.fn().mockResolvedValue({ data: [SERVICE], error: null }),
    });
    const res = await request(app).get('/api/admin/services').set(adminHeaders());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('DELETE /api/admin/services/:id', () => {
  test('deletes service', async () => {
    supabaseAdmin.from.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockResolvedValue({ error: null }),
    });
    const res = await request(app)
      .delete('/api/admin/services/svc-1')
      .set(adminHeaders());
    expect(res.status).toBe(200);
  });
});

// NOTE: the POST /api/admin/cleanup-users endpoint (and its tests) were removed
// in M0 — a destructive mass-delete tool must not live on the admin API.
