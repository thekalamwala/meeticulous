/**
 * tests/integration/hostGuard.test.js
 * Proves requireHost is actually wired: a guest token is rejected (403) on a
 * real host route (POST /api/services) before any controller logic runs.
 */
jest.mock('../../middleware/authMiddleware', () => {
  const actual = jest.requireActual('../../middleware/authMiddleware');
  return {
    ...actual,
    protect: (req, _res, next) => { req.user = { id: 'guest-uuid' }; next(); },
  };
});
jest.mock('../../config/supabase', () => {
  const make = () => ({
    select: jest.fn().mockReturnThis(),
    eq:     jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: { role: 'guest' }, error: null }),
  });
  return { supabaseAdmin: { from: jest.fn(() => make()) } };
});
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn().mockResolvedValue(true) }));

const request = require('supertest');
const express = require('express');
const serviceRoutes = require('../../routes/serviceRoutes');

const app = express();
app.use(express.json());
app.use('/api/services', serviceRoutes);

test('guest token is 403 on POST /api/services', async () => {
  const res = await request(app).post('/api/services').send({ title: 'X', price: 0 });
  expect(res.status).toBe(403);
  expect(res.body.host_required).toBe(true);
});
