/**
 * tests/integration/exploreList.int.test.js
 *
 * Integration tests for the public Explore listing API:
 * GET /api/explore — lists SERVICES ranked by precomputed
 * service_scores.effective_score × search relevance. One DB read on
 * `from('services')` with embedded profiles!inner + service_scores; ranked and
 * paginated (12/page, 96-cap) in memory. Filters: `category` (host profession),
 * `service` (service slug — REQUIRES `category`), `q` (parsed + matched in memory
 * by lib/exploreSearch — never reaches SQL). Response shape: { services, meta, filters }.
 */

jest.mock('../../config/supabase', () => require('./helpers').makeSbMock());

const request = require('supertest');
const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const exploreRoutes = require('../../routes/exploreRoutes');

const app = express();
app.use(express.json());
app.use('/api/explore', exploreRoutes);

// Awaitable chain stub: every fluent method returns `this`; awaiting resolves
// `resolved`. `eq` records (col, val) pairs for assertion.
const awaitable = (resolved, methods = ['select', 'eq', 'not', 'or', 'limit', 'order', 'range']) => {
  const obj = {};
  obj.eq = jest.fn().mockReturnValue(obj);
  methods.filter(m => m !== 'eq').forEach((m) => { obj[m] = jest.fn().mockReturnValue(obj); });
  obj.then = (resolve, reject) => Promise.resolve(resolved).then(resolve, reject);
  return obj;
};

// Build a joined services row in the shape the PostgREST embed returns.
const row = (over = {}) => ({
  id: 'svc1', slug: 'wedding', title: 'Wedding Photography Package',
  description: 'Full day coverage', price: 999, currency: 'INR',
  category: 'wedding-photography', thumbnail_url: 'c.jpg', rating: 4.8, total_reviews: 12,
  profiles: {
    name: 'Asha', username: 'asha', profile_image: 'p.jpg', is_verified: true,
    is_banned: false, location: 'Pune', primary_category: 'photographer',
    created_at: '2020-01-01T00:00:00Z', role: 'host',
  },
  service_scores: [{ effective_score: 55, score_components: { E: { active_days: 5 } } }],
  ...over,
});

afterEach(() => jest.clearAllMocks());
// listServices is read-through cached (120s). Clear between tests so a shared
// filter+q key can't serve a stale payload into the next and desync the mock queue.
beforeEach(() => require('../../services/responseCache').clear());

describe('GET /api/explore', () => {
  test('service filter without category → 400, no DB query', async () => {
    const res = await request(app).get('/api/explore?service=wedding-photography');
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/requires.*category/i);
    expect(supabaseAdmin.from).not.toHaveBeenCalled();
  });

  test('category+service returns mapped, denormalized service cards', async () => {
    const mockQuery = awaitable({ data: [
      row(),
      // other profession / other service slug → filtered out in memory
      row({ id: 'x1', slug: 'x1', profiles: { ...row().profiles, primary_category: 'chef' } }),
      row({ id: 'x2', slug: 'x2', category: 'portrait-photography' }),
    ], error: null });
    supabaseAdmin.from.mockReturnValueOnce(mockQuery);

    const res = await request(app).get('/api/explore?category=photographer&service=wedding-photography');

    expect(res.status).toBe(200);
    expect(supabaseAdmin.from).toHaveBeenCalledWith('services');
    expect(res.body.services).toHaveLength(1);
    expect(res.body.services[0]).toMatchObject({
      slug: 'wedding', hostUsername: 'asha', hostName: 'Asha',
      price: 999, reviewCount: 12, avgRating: 4.8,
      category: 'wedding-photography', url: '/asha/wedding',
    });
    expect(res.body.services[0].badges.availableThisWeek).toBe(true); // active_days > 0
    expect(res.body.meta).toMatchObject({ total: 1, totalPages: 1, page: 1 });

    const eqCalls = mockQuery.eq.mock.calls;
    expect(eqCalls).toContainEqual(['is_active', true]);
    expect(eqCalls).toContainEqual(['profiles.is_verified', true]);
    expect(eqCalls).toContainEqual(['profiles.is_banned', false]);
  });

  test('no reviews → avgRating null', async () => {
    supabaseAdmin.from.mockReturnValueOnce(awaitable({
      data: [row({ rating: 0, total_reviews: 0 })], error: null,
    }));
    const res = await request(app).get('/api/explore?category=photographer');
    expect(res.status).toBe(200);
    expect(res.body.services[0].avgRating).toBeNull();
  });

  test('ranks by effective_score desc; relevance gate drops non-matching rows', async () => {
    const rows = [
      row({ id: 'a', slug: 'a', title: 'Yoga for beginners', description: 'calm', category: 'yoga',
            service_scores: [{ effective_score: 10 }] }),
      row({ id: 'b', slug: 'b', title: 'Advanced Yoga', description: 'flow', category: 'yoga',
            service_scores: [{ effective_score: 40 }] }),
      row({ id: 'c', slug: 'c', title: 'Cooking class', description: 'no match here', category: 'food',
            service_scores: [{ effective_score: 99 }] }), // high score but irrelevant to "yoga"
    ];
    supabaseAdmin.from.mockReturnValueOnce(awaitable({ data: rows, error: null }));

    const res = await request(app).get('/api/explore?q=yoga');

    expect(res.status).toBe(200);
    // 'c' excluded (no "yoga" in title/desc/category); 'b' before 'a' (40 > 10).
    expect(res.body.services.map(s => s.id)).toEqual(['b', 'a']);
    expect(res.body.meta.total).toBe(2);
  });

  test('q never reaches a PostgREST filter; metachars are just word breaks', async () => {
    const mockQuery = awaitable({ data: [row()], error: null });
    supabaseAdmin.from.mockReturnValueOnce(mockQuery);

    const res = await request(app).get('/api/explore?q=' + encodeURIComponent('wedding,(photo)%'));

    expect(res.status).toBe(200);
    expect(mockQuery.or).not.toHaveBeenCalled();
    expect(res.body.services.map(s => s.id)).toEqual(['svc1']);
    expect(res.body.filters.parsed).toEqual({ text: 'wedding photo', location: '', mode: '' });
    expect(res.body.meta.match).toBe('exact');
  });

  test('city + mode are parsed off the query and filter the results', async () => {
    supabaseAdmin.from.mockReturnValueOnce(awaitable({ data: [
      row({ id: 'pune-off', slug: 'a', meeting_mode: 'offline' }),
      row({ id: 'pune-on', slug: 'b', meeting_mode: 'online' }),
      row({ id: 'mum-off', slug: 'c', meeting_mode: 'offline', profiles: { ...row().profiles, location: 'Mumbai' } }),
    ], error: null }));
    const res = await request(app).get('/api/explore?q=' + encodeURIComponent('wedding photographer in person pune'));
    expect(res.status).toBe(200);
    expect(res.body.services.map(s => s.id)).toEqual(['pune-off']);
    expect(res.body.filters.parsed).toEqual({ text: 'wedding photographer', location: 'Pune', mode: 'offline' });
  });

  test('q under 2 chars is ignored (no ilike filter)', async () => {
    const mockQuery = awaitable({ data: [], error: null });
    supabaseAdmin.from.mockReturnValueOnce(mockQuery);

    const res = await request(app).get('/api/explore?q=a');

    expect(res.status).toBe(200);
    expect(res.body.filters.q).toBe('');
    expect(mockQuery.or).not.toHaveBeenCalled();
  });

  test('pagination: 96-cap, 12/page, page clamps to 8', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => row({
      id: `h${i}`, slug: `s${i}`, service_scores: [{ effective_score: 100 - i }],
    }));
    supabaseAdmin.from.mockReturnValueOnce(awaitable({ data: rows, error: null }));

    const res = await request(app).get('/api/explore?page=2');

    expect(res.status).toBe(200);
    expect(res.body.services).toHaveLength(12);       // page 2 of 30 → 12
    expect(res.body.services[0].slug).toBe('s12');    // 13th ranked item
    expect(res.body.meta).toMatchObject({ page: 2, limit: 12, total: 30, totalPages: 3, hasMore: true });
  });

  test('500 on unexpected error', async () => {
    supabaseAdmin.from.mockReturnValueOnce(awaitable({ data: null, error: { message: 'connection refused' } }));
    const res = await request(app).get('/api/explore');
    expect(res.status).toBe(500);
  });

  test('card carries description (short preferred) + meetingMode', async () => {
    supabaseAdmin.from.mockReturnValueOnce(awaitable({
      data: [row({ short_description: 'Short one.', description: 'Long one.', meeting_mode: 'offline' })],
      error: null,
    }));
    const res = await request(app).get('/api/explore?category=photographer');
    expect(res.status).toBe(200);
    expect(res.body.services[0].description).toBe('Short one.');
    expect(res.body.services[0].meetingMode).toBe('offline');
  });

  test('description falls back to the long field; meetingMode defaults to online', async () => {
    supabaseAdmin.from.mockReturnValueOnce(awaitable({
      data: [row({ short_description: null, description: 'Long one.', meeting_mode: null })],
      error: null,
    }));
    const res = await request(app).get('/api/explore?category=photographer');
    expect(res.status).toBe(200);
    expect(res.body.services[0].description).toBe('Long one.');
    expect(res.body.services[0].meetingMode).toBe('online');
  });
});
