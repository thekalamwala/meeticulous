jest.mock('../../config/supabase', () => require('./helpers').makeSbMock());
jest.mock('../../middleware/authMiddleware', () => ({
  protect: (req, _res, next) => { req.user = { id: 'vendor-uuid' }; next(); },
  requireHost: (_req, _res, next) => next(),
}));
jest.mock('../../middleware/planMiddleware', () => ({
  attachPlan:        (_r, _s, n) => n(),
  checkServiceLimit: (_r, _s, n) => n(),
  enforceMinPrice:   (_r, _s, n) => n(),
  // Plan gates the controllers call directly — no-op so this suite isolates
  // category logic and doesn't consume the supabase `from` mock queue.
  canActivateMore:   async () => ({ ok: true }),
  canAddFreeService: async () => ({ ok: true }),
}));
jest.mock('../../middleware/requireFeature', () => ({
  requireFeature: () => (_r, _s, n) => n(),
}));
// Isolate category logic under normal-mode pricing (fee-only OFF) and keep the
// controllers' getConfig() call from consuming a queued supabase `from` response.
jest.mock('../../services/platformConfig', () => ({
  getConfig: jest.fn().mockResolvedValue({ platformFee: 10, gstRate: 0.18, clearingDays: 7, feeOnlyMode: false }),
  clearCache: jest.fn(),
}));

const request  = require('supertest');
const express  = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const serviceRoutes = require('../../routes/serviceRoutes');
const hostRoutes = require('../../routes/hostRoutes');

const app = express();
app.use(express.json());
app.use('/api/services', serviceRoutes);
app.use('/api/host', hostRoutes);

// chainable stub whose terminal (single/maybeSingle) resolves `resolved`
const chain = (resolved) => ({
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq:     jest.fn().mockReturnThis(),
  neq:    jest.fn().mockReturnThis(),
  order:  jest.fn().mockReturnThis(),
  single:      jest.fn().mockResolvedValue(resolved),
  maybeSingle: jest.fn().mockResolvedValue(resolved),
});

// awaitable list stub (no terminal single) — resolves when awaited directly
const list = (resolved) => {
  const obj = {};
  ['select', 'eq', 'order'].forEach((m) => { obj[m] = jest.fn().mockReturnValue(obj); });
  obj.then = (resolve, reject) => Promise.resolve(resolved).then(resolve, reject);
  return obj;
};

afterEach(() => jest.clearAllMocks());

describe('POST /api/services — service category validation', () => {
  test('201 — persists a category valid for the host profession', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce(chain({ data: { primary_category: 'photographer' }, error: null }))       // profiles load
      .mockReturnValueOnce(list({ data: [{ slug: 'wedding-photography' }], error: null }))            // service_categories list
      .mockReturnValueOnce(chain({ data: null, error: null }))                                        // uniqueSlug check (slug free)
      .mockReturnValueOnce(chain({ data: { id: 'svc-9', category: 'wedding-photography' }, error: null })); // insert
    const res = await request(app).post('/api/services')
      .send({ title: 'Wedding Shoot', category: 'wedding-photography', price: 500, duration: 30 });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('wedding-photography');
  });

  test('400 — category not valid for the host profession', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce(chain({ data: { primary_category: 'photographer' }, error: null }))
      .mockReturnValueOnce(list({ data: [{ slug: 'wedding-photography' }], error: null }));
    const res = await request(app).post('/api/services')
      .send({ title: 'Tattoo', category: 'tribal-tattoo', price: 500, duration: 30 });
    expect(res.status).toBe(400);
  });
});

// #534: POST /api/host/services is retired (410) — the live create path is
// POST /api/services, whose category validation is covered by the block above.
