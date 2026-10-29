const express = require('express');
const request = require('supertest');

jest.mock('../../config/supabase', () => require('../integration/helpers').makeSbMock());

const { supabaseAdmin } = require('../../config/supabase');
const ops = require('../../controllers/opsController');
const metrics = require('../../utils/metrics');

const app = express();
app.get('/ready', ops.readiness);
app.get('/metrics', ops.exposeMetrics);

const okDbChain = () => ({
  select: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue({ error: null, count: 3 }),
});

afterEach(() => { jest.clearAllMocks(); metrics._reset(); delete process.env.METRICS_TOKEN; });

describe('GET /ready', () => {
  test('200 ready:true when the DB check succeeds', async () => {
    supabaseAdmin.from.mockReturnValueOnce(okDbChain());
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.ready).toBe(true);
  });

  test('503 ready:false when the DB check errors', async () => {
    supabaseAdmin.from.mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ error: { message: 'no connection' } }),
    });
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.ready).toBe(false);
    expect(res.body.error).toMatch(/no connection/);
  });
});

describe('GET /metrics', () => {
  test('404 when METRICS_TOKEN is unset (opt-in only)', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(404);
  });

  test('401 with a wrong token', async () => {
    process.env.METRICS_TOKEN = 'secret';
    const res = await request(app).get('/metrics?token=nope');
    expect(res.status).toBe(401);
  });

  test('200 Prometheus text with the correct bearer token', async () => {
    process.env.METRICS_TOKEN = 'secret';
    const res = await request(app).get('/metrics').set('Authorization', 'Bearer secret');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toMatch(/bas_uptime_seconds/);
    expect(res.text).toMatch(/bas_http_requests_total/);
  });
});

describe('metrics.render', () => {
  test('reflects recorded HTTP requests by status class', () => {
    metrics.recordHttp(200, 10);
    metrics.recordHttp(404, 5);
    metrics.recordHttp(500, 1200); // slow
    const out = metrics.render();
    expect(out).toMatch(/bas_http_requests_total 3/);
    expect(out).toMatch(/bas_http_slow_requests_total 1/);
    expect(out).toMatch(/bas_http_requests_by_status\{class="2xx"\} 1/);
    expect(out).toMatch(/bas_http_requests_by_status\{class="5xx"\} 1/);
  });
});
