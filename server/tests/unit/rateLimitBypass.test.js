const express = require('express');
const request = require('supertest');
const rateLimit = require('express-rate-limit');

describe('rate-limit load-test bypass (skipWhenLoadTest)', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; });
  afterAll(() => { process.env = OLD; });

  const makeApp = () => {
    const { skipWhenLoadTest } = require('../../middleware/security');
    const app = express();
    app.use('/x', rateLimit({ windowMs: 60000, max: 1, skip: skipWhenLoadTest }),
      (req, res) => res.json({ ok: true }));
    return app;
  };

  test('limiter ACTIVE when flag off (2nd request 429)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    const app = makeApp();
    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(429);
  });

  test('limiter BYPASSED when flag on (no 429)', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    const app = makeApp();
    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(200);
    await request(app).get('/x').expect(200);
  });
});
