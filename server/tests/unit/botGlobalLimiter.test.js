// botGlobalLimiter uses a CONSTANT key, so all requests share one bucket
// regardless of IP — this is what bounds volume under IP rotation.
const request = require('supertest');
const express = require('express');
const { botGlobalLimiter } = require('../../middleware/security');

function appWith() {
  const app = express();
  app.post('/t', botGlobalLimiter, (req, res) => res.json({ ok: true }));
  return app;
}

beforeEach(() => { process.env.BOT_GLOBAL_MAX_PER_MIN = '2'; });
afterEach(() => { delete process.env.BOT_GLOBAL_MAX_PER_MIN; });

test('caps total requests across differing IPs (constant key)', async () => {
  const app = appWith();
  // Different X-Forwarded-For each time — a per-IP limiter would let all through;
  // the global limiter must 429 the 3rd because the key is constant.
  const r1 = await request(app).post('/t').set('X-Forwarded-For', '1.1.1.1');
  const r2 = await request(app).post('/t').set('X-Forwarded-For', '2.2.2.2');
  const r3 = await request(app).post('/t').set('X-Forwarded-For', '3.3.3.3');
  expect(r1.status).toBe(200);
  expect(r2.status).toBe(200);
  expect(r3.status).toBe(429);
});
