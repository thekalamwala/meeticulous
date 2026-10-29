/**
 * tests/integration/vendor.test.js
 * Tests for /api/host (public profile, service by slug) and
 * /api/services (vendor CRUD — requires auth).
 */
jest.mock('../../config/supabase', () => require('./helpers').makeSbMock());
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, _res, next) => { req.user = { id: 'vendor-uuid' }; next(); },
  requireHost: (_req, _res, next) => next(),
}));
jest.mock('../../middleware/planMiddleware', () => ({
  attachPlan:        (_r, _s, n) => n(),
  checkServiceLimit: (_r, _s, n) => n(),
  enforceMinPrice:   (_r, _s, n) => n(),
}));
// These tests validate normal-mode service CRUD (with real prices), so run with
// fee-only mode OFF. Mocking getConfig also keeps it from consuming a queued
// supabase mock response mid-flow. (Fee-only price-forcing is covered separately.)
jest.mock('../../services/platformConfig', () => ({
  getConfig: jest.fn().mockResolvedValue({ platformFee: 10, gstRate: 0.18, clearingDays: 7, feeOnlyMode: false }),
  clearCache: jest.fn(),
}));

const request      = require('supertest');
const express      = require('express');
const { supabaseAdmin }             = require('../../config/supabase');
const hostRoutes                    = require('../../routes/hostRoutes');
const serviceRoutes                 = require('../../routes/serviceRoutes');
const { VENDOR_PROFILE, SERVICE }   = require('./helpers');
const planService                   = require('../../services/planService');

const app = express();
app.use(express.json());
app.use('/api/host',     hostRoutes);
app.use('/api/services', serviceRoutes);

const mockHostProfile = (profile = VENDOR_PROFILE, services = [SERVICE]) => {
  supabaseAdmin.from
    .mockReturnValueOnce({ // profiles
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { ...profile }, error: null }),
    })
    .mockReturnValue({ // services + availability (parallel)
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
  // Override the services parallel query
  jest.spyOn(Promise, 'all').mockImplementationOnce(() =>
    Promise.resolve([{ data: services }, { data: null }])
  );
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC PROFILE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('GET /api/host/:username', () => {
  test('404 — unknown username', async () => {
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });
    const res = await request(app).get('/api/host/ghost-user');
    expect(res.status).toBe(404);
  });

  test('200 — returns host + services, strips sensitive fields', async () => {
    const withSecrets = { ...VENDOR_PROFILE, google_access_token: 'secret', google_refresh_token: 'secret2' };
    supabaseAdmin.from
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: withSecrets, error: null }),
      })
      .mockReturnValue({
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        limit:  jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

    const res = await request(app).get('/api/host/jane-vendor');
    expect(res.status).toBe(200);
    expect(res.body.host).not.toHaveProperty('google_access_token');
    expect(res.body.host).not.toHaveProperty('google_refresh_token');
    expect(Array.isArray(res.body.services)).toBe(true);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC SERVICE BY SLUG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('GET /api/host/:username/:slug', () => {
  test('404 — host not found', async () => {
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    const res = await request(app).get('/api/host/ghost/svc');
    expect(res.status).toBe(404);
  });

  test('200 — returns host + service + availability', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce({ // host
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: VENDOR_PROFILE, error: null }),
      })
      .mockReturnValueOnce({ // service
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: SERVICE, error: null }),
      })
      .mockReturnValueOnce({ // availability
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { timezone: 'Asia/Kolkata' }, error: null }),
      });

    const res = await request(app).get('/api/host/jane-vendor/consultation');
    expect(res.status).toBe(200);
    expect(res.body.host.name).toBe('Jane Vendor');
    expect(res.body.service.slug).toBe('consultation');
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUBLIC SERVICE BY PROFILE + SERVICE SLUG (clean URL)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('GET /api/services/public/:profileSlug/:serviceSlug', () => {
  test('404 — unknown vendor slug', async () => {
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    });
    const res = await request(app).get('/api/services/public/ghost/svc');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/host/i);
  });

  test('404 — service slug not owned by vendor', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce({ // vendor found
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: VENDOR_PROFILE, error: null }),
      })
      .mockReturnValue({ // service not found
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { message: 'no rows' } }),
      });

    const res = await request(app).get('/api/services/public/jane-vendor/ghost-svc');
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/service/i);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VENDOR SERVICE CRUD (protected)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('POST /api/services (create)', () => {
  test('400 — missing title', async () => {
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', 'Bearer vendor-token')
      .send({ price: 500, duration: 30 });
    expect(res.status).toBe(400);
  });

  test('201 — creates service with auto-generated slug', async () => {
    supabaseAdmin.from.mockReturnValue({
      select:  jest.fn().mockReturnThis(),
      insert:  jest.fn().mockReturnThis(),
      eq:      jest.fn().mockReturnThis(),
      neq:     jest.fn().mockReturnThis(),
      single:  jest.fn().mockResolvedValue({ data: { ...SERVICE, slug: 'consultation' }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    });
    const res = await request(app)
      .post('/api/services')
      .set('Authorization', 'Bearer vendor-token')
      .send({ title: 'Consultation', price: 500, duration: 45, meeting_mode: 'online' });
    expect(res.status).toBe(201);
    expect(res.body.slug).toBeDefined();
  });
});

describe('PUT /api/services/:id (update)', () => {
  test('updates service for authenticated vendor', async () => {
    supabaseAdmin.from.mockReturnValue({
      select:  jest.fn().mockReturnThis(),
      update:  jest.fn().mockReturnThis(),
      eq:      jest.fn().mockReturnThis(),
      neq:     jest.fn().mockReturnThis(),
      single:  jest.fn().mockResolvedValue({ data: { ...SERVICE, price: 750 }, error: null }),
      maybeSingle: jest.fn().mockResolvedValue({ data: null }),
    });
    const res = await request(app)
      .put('/api/services/svc-1')
      .set('Authorization', 'Bearer vendor-token')
      .send({ price: 750 });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/services/:id (delete)', () => {
  test('deletes service for authenticated vendor', async () => {
    // Controller uses .delete().eq(id).eq(host_id) — two chained eq calls
    supabaseAdmin.from.mockReturnValue({
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockResolvedValue({ error: null }),
      })),
    });
    const res = await request(app)
      .delete('/api/services/svc-1')
      .set('Authorization', 'Bearer vendor-token');
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });
});

describe('PUT /api/services/:id/toggle (toggle active)', () => {
  test('404 — service not found', async () => {
    supabaseAdmin.from.mockReturnValue({
      select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    });
    const res = await request(app)
      .put('/api/services/ghost/toggle')
      .set('Authorization', 'Bearer vendor-token');
    expect(res.status).toBe(404);
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PUT /api/host/categories — profession change de-categorises services (Task 5)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
describe('PUT /api/host/categories (profession change)', () => {
  // planService caches subscription_plans for 60s in-process; without clearing,
  // the second test's getLimit() call would skip supabaseAdmin.from('subscription_plans')
  // entirely, shifting the mock queue by one and breaking the "call order" mocks below.
  beforeEach(() => planService.clearCache());

  test('changing primary_category clears categorised services and reports count', async () => {
    supabaseAdmin.from
      // 1) planService.getLimit → subscription_plans (fallback plans used; no chain needed
      //    beyond the mock default, but we still consume the .from() call slot explicitly
      //    so later mockReturnValueOnce calls line up with the controller's real order).
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: null, error: null }),
      })
      // 2) categories → active slugs
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({
          data: [{ slug: 'doctor' }, { slug: 'photographer' }], error: null,
        }),
      })
      // 3) profiles select — prior profession (before)
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { primary_category: 'photographer' }, error: null }),
      })
      // 4) profiles update — new profession (after)
      .mockReturnValueOnce({
        update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { primary_category: 'doctor', categories: ['doctor'] }, error: null }),
      })
      // 5) services update — clears category + primary_category on the host's rows
      .mockReturnValueOnce({
        update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue({ data: [{ id: 's1' }, { id: 's2' }], error: null }),
      });

    const res = await request(app)
      .put('/api/host/categories')
      .set('Authorization', 'Bearer vendor-token')
      .send({ primary_category: 'doctor', categories: ['doctor'] });

    expect(res.status).toBe(200);
    expect(res.body.services_cleared).toBe(2);
    expect(res.body.primary_category).toBe('doctor');
  });

  test('re-saving the same primary_category clears nothing and does not touch services', async () => {
    const servicesUpdate = jest.fn();
    supabaseAdmin.from
      // 1) planService.getLimit → subscription_plans
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(), order: jest.fn().mockResolvedValue({ data: null, error: null }),
      })
      // 2) categories → active slugs
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({
          data: [{ slug: 'photographer' }], error: null,
        }),
      })
      // 3) profiles select — prior profession (before) — same as after
      .mockReturnValueOnce({
        select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { primary_category: 'photographer' }, error: null }),
      })
      // 4) profiles update — unchanged profession
      .mockReturnValueOnce({
        update: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { primary_category: 'photographer', categories: ['photographer'] }, error: null }),
      })
      // No 5th queued mock — if the controller calls .from('services') it will fall
      // through to the default fluent() stub, which we assert against below via
      // the servicesUpdate spy never having been invoked.
      .mockImplementation((table) => {
        if (table === 'services') servicesUpdate();
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), update: jest.fn().mockReturnThis(), not: jest.fn().mockReturnThis(), single: jest.fn().mockResolvedValue({ data: null, error: null }) };
      });

    const res = await request(app)
      .put('/api/host/categories')
      .set('Authorization', 'Bearer vendor-token')
      .send({ primary_category: 'photographer', categories: ['photographer'] });

    expect(res.status).toBe(200);
    expect(res.body.services_cleared).toBe(0);
    expect(servicesUpdate).not.toHaveBeenCalled();
  });
});
