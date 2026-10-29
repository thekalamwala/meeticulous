'use strict';
// Public invite routes. inviteService is mocked; we only assert routing + shaping.
jest.mock('../../services/inviteService', () => ({
  getPublicConfig: jest.fn(async (s) => (s === 'social' ? { label: 'Social Squad', active: true } : null)),
  recordVisit: jest.fn(async () => {}),
}));

const request = require('supertest');
const express = require('express');
const inviteRoutes = require('../../routes/inviteRoutes');
const inviteService = require('../../services/inviteService');

const app = express();
app.use(express.json());
app.use('/api/invite', inviteRoutes);

describe('GET /api/invite/:slug', () => {
  test('known slug returns landing config', async () => {
    const r = await request(app).get('/api/invite/social');
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ label: 'Social Squad', active: true });
  });

  test('unknown slug returns active:false (client redirects to /)', async () => {
    const r = await request(app).get('/api/invite/ghost');
    expect(r.status).toBe(200);
    expect(r.body.active).toBe(false);
  });
});

describe('POST /api/invite/:slug/visit', () => {
  test('returns 204 and forwards to recordVisit', async () => {
    const r = await request(app).post('/api/invite/social/visit').set('User-Agent', 'real-human');
    expect(r.status).toBe(204);
    // fire-and-forget: recordVisit invoked with (slug, ip, ua)
    expect(inviteService.recordVisit).toHaveBeenCalled();
    expect(inviteService.recordVisit.mock.calls[0][0]).toBe('social');
  });
});
