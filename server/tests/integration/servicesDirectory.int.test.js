/**
 * tests/integration/servicesDirectory.int.test.js
 *
 * Integration tests for the public services-directory API (Task 8) behind the
 * SEO landing pages: GET /api/services-directory (professions grouped by
 * group_label, only those with >=1 active service category) and
 * GET /api/services-directory/:profession (profession + active services,
 * description-or-template-fallback; 404 when unknown/inactive/empty).
 */

jest.mock('../../config/supabase', () => require('./helpers').makeSbMock());

const request = require('supertest');
const express = require('express');
const { supabaseAdmin } = require('../../config/supabase');
const servicesDirectoryRoutes = require('../../routes/servicesDirectoryRoutes');

const app = express();
app.use(express.json());
app.use('/api/services-directory', servicesDirectoryRoutes);

// Awaitable chain stub: every listed fluent method returns `this`, and awaiting
// the object resolves `resolved`.
const awaitable = (resolved, methods = ['select', 'eq', 'not', 'order', 'limit']) => {
  const obj = {};
  methods.forEach((m) => { obj[m] = jest.fn().mockReturnValue(obj); });
  obj.then = (resolve, reject) => Promise.resolve(resolved).then(resolve, reject);
  return obj;
};

afterEach(() => jest.clearAllMocks());
beforeEach(() => require('../../services/responseCache').clear());

// ── GET /api/services-directory (index) ──────────────────────────────────────
describe('GET /api/services-directory', () => {
  test('groups professions by group_label, excludes professions with zero active services', async () => {
    const profs = [
      { slug: 'photographer', label: 'Photographer', group_label: 'Creative', sort_order: 0 },
      { slug: 'makeup-artist', label: 'Makeup Artist', group_label: 'Creative', sort_order: 1 },
      { slug: 'yoga-instructor', label: 'Yoga Instructor', group_label: 'Wellness', sort_order: 2 },
      { slug: 'empty-prof', label: 'Empty Prof', group_label: 'Wellness', sort_order: 3 },
    ];
    const cats = [
      { primary_category: 'photographer' },
      { primary_category: 'photographer' },
      { primary_category: 'yoga-instructor' },
      // makeup-artist and empty-prof have zero active service_categories rows
    ];

    supabaseAdmin.from
      .mockReturnValueOnce(awaitable({ data: profs, error: null }))
      .mockReturnValueOnce(awaitable({ data: cats, error: null }));

    const res = await request(app).get('/api/services-directory');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toMatch(/max-age=300/);

    const { groups } = res.body;
    const labels = groups.map((g) => g.group_label);
    expect(labels).toEqual(['Creative', 'Wellness']);

    const creative = groups.find((g) => g.group_label === 'Creative');
    expect(creative.professions).toEqual([
      { slug: 'photographer', label: 'Photographer', serviceCount: 2 },
    ]);

    const wellness = groups.find((g) => g.group_label === 'Wellness');
    expect(wellness.professions).toEqual([
      { slug: 'yoga-instructor', label: 'Yoga Instructor', serviceCount: 1 },
    ]);
  });

  test('second request is served from cache (single DB round-trip pair)', async () => {
    const profs = [{ slug: 'photographer', label: 'Photographer', group_label: 'Creative', sort_order: 0 }];
    const cats = [{ primary_category: 'photographer' }];

    supabaseAdmin.from
      .mockReturnValueOnce(awaitable({ data: profs, error: null }))
      .mockReturnValueOnce(awaitable({ data: cats, error: null }));

    const res1 = await request(app).get('/api/services-directory');
    const res2 = await request(app).get('/api/services-directory');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res2.body.groups[0].professions[0].slug).toBe('photographer');
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(2); // profs + cats, once total
  });
});

// ── GET /api/services-directory/:profession ──────────────────────────────────
describe('GET /api/services-directory/:profession', () => {
  test('returns services with fallback descriptions', async () => {
    const prof = { slug: 'photographer', label: 'Photographer', group_label: 'Creative' };
    const services = [{ name: 'Wedding Photography', slug: 'wedding-photography', description: null, icon: null }];

    supabaseAdmin.from
      .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: prof, error: null }) })
      .mockReturnValueOnce(awaitable({ data: services, error: null }));

    const res = await request(app).get('/api/services-directory/photographer');

    expect(res.status).toBe(200);
    expect(res.body.profession.label).toBe('Photographer');
    expect(res.body.services[0].description).toBe(
      'Book trusted Photographer professionals for Wedding Photography on Book A Sloth.'
    );
    expect(res.headers['cache-control']).toMatch(/max-age=300/);
  });

  test('uses the stored description when present (no fallback)', async () => {
    const prof = { slug: 'photographer', label: 'Photographer', group_label: 'Creative' };
    const services = [{
      name: 'Wedding Photography', slug: 'wedding-photography',
      description: 'Capture your big day with a pro.', icon: 'camera',
    }];

    supabaseAdmin.from
      .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: prof, error: null }) })
      .mockReturnValueOnce(awaitable({ data: services, error: null }));

    const res = await request(app).get('/api/services-directory/photographer');

    expect(res.status).toBe(200);
    expect(res.body.services[0].description).toBe('Capture your big day with a pro.');
    expect(res.body.services[0].icon).toBe('camera');
  });

  test('unknown profession → 404', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });

    const res = await request(app).get('/api/services-directory/nope');

    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBeUndefined();
  });

  test('profession with zero active services → 404 (thin-content guard)', async () => {
    const prof = { slug: 'empty-prof', label: 'Empty Prof', group_label: 'Wellness' };

    supabaseAdmin.from
      .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: prof, error: null }) })
      .mockReturnValueOnce(awaitable({ data: [], error: null }));

    const res = await request(app).get('/api/services-directory/empty-prof');

    expect(res.status).toBe(404);
  });

  test('falls back to pre-migration select when description/icon columns are missing', async () => {
    const prof = { slug: 'photographer', label: 'Photographer', group_label: 'Creative' };
    const legacy = [{ name: 'Wedding Photography', slug: 'wedding-photography' }];

    supabaseAdmin.from
      .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: prof, error: null }) })
      .mockReturnValueOnce(awaitable({ data: null, error: { message: 'column service_categories.description does not exist' } }))
      .mockReturnValueOnce(awaitable({ data: legacy, error: null }));

    const res = await request(app).get('/api/services-directory/photographer');

    expect(res.status).toBe(200);
    expect(res.body.services[0].description).toBe(
      'Book trusted Photographer professionals for Wedding Photography on Book A Sloth.'
    );
  });

  test('second request for the same profession is served from cache', async () => {
    const prof = { slug: 'photographer', label: 'Photographer', group_label: 'Creative' };
    const services = [{ name: 'Wedding Photography', slug: 'wedding-photography', description: null, icon: null }];

    supabaseAdmin.from
      .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: prof, error: null }) })
      .mockReturnValueOnce(awaitable({ data: services, error: null }));

    const res1 = await request(app).get('/api/services-directory/photographer');
    const res2 = await request(app).get('/api/services-directory/photographer');

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res2.body.services[0].slug).toBe('wedding-photography');
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(3); // profession lookup + services + hosts, once total (cache serves the 2nd request)
  });

  test('a cached notFound marker keeps returning 404 without re-querying', async () => {
    supabaseAdmin.from
      .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }) });

    const res1 = await request(app).get('/api/services-directory/nope');
    const res2 = await request(app).get('/api/services-directory/nope');

    expect(res1.status).toBe(404);
    expect(res2.status).toBe(404);
    expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
  });
});

// ── Cache-bust integration with serviceCategoryController ────────────────────
describe('svcdir: cache is busted by service-category admin mutations', () => {
  test('bustCategoryCaches (already wired in serviceCategoryController) clears svcdir: entries', async () => {
    const prof = { slug: 'photographer', label: 'Photographer', group_label: 'Creative' };
    const services = [{ name: 'Wedding Photography', slug: 'wedding-photography', description: null, icon: null }];

    supabaseAdmin.from
      .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: prof, error: null }) })
      .mockReturnValueOnce(awaitable({ data: services, error: null }));

    const primed = await request(app).get('/api/services-directory/photographer');
    expect(primed.status).toBe(200);

    const responseCache = require('../../services/responseCache');
    await responseCache.bust('svcdir:');

    const services2 = [
      { name: 'Wedding Photography', slug: 'wedding-photography', description: null, icon: null },
      { name: 'Portrait Photography', slug: 'portrait-photography', description: null, icon: null },
    ];
    supabaseAdmin.from
      .mockReturnValueOnce({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue({ data: prof, error: null }) })
      .mockReturnValueOnce(awaitable({ data: services2, error: null }));

    const after = await request(app).get('/api/services-directory/photographer');
    expect(after.body.services).toHaveLength(2);
  });
});
