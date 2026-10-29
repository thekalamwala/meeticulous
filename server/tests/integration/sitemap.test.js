/**
 * tests/integration/sitemap.test.js
 * Root-mounted dynamic sitemap: index + children, pagination, content-type.
 * DB fetchers are mocked; the pure mappers + XML builders run for real.
 */
process.env.SITE_URL = 'https://bookasloth.com';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../services/sitemapService', () => {
  const actual = jest.requireActual('../../services/sitemapService');
  return {
    ...actual,
    fetchHosts: jest.fn(),
    fetchServices: jest.fn(),
    fetchProfessions: jest.fn(),
    fetchBlogs: jest.fn(),
  };
});

const request = require('supertest');
const express = require('express');
const sitemapRoutes = require('../../routes/sitemapRoutes');
const { fetchHosts, fetchServices, fetchProfessions, fetchBlogs } = require('../../services/sitemapService');
const { bustSitemapCache } = require('../../utils/sitemapCache');

const app = express();
app.use(sitemapRoutes);

beforeEach(() => {
  bustSitemapCache(); // singleton cache leaks across tests otherwise
  fetchHosts.mockResolvedValue([{ username: 'john-doe', updated_at: '2026-06-20T10:00:00Z' }]);
  fetchServices.mockResolvedValue([
    { slug: 'business-consultation', updated_at: '2026-06-20T10:00:00Z', profiles: { username: 'john-doe' } },
  ]);
  fetchProfessions.mockResolvedValue([
    { slug: 'therapy', updated_at: '2026-06-20T10:00:00Z' },
  ]);
  fetchBlogs.mockResolvedValue([
    { slug: 'zero-commission-bet', published_at: '2026-06-25T10:00:00Z', updated_at: '2026-06-28T10:00:00Z' },
  ]);
});

describe('GET /sitemap.xml (index)', () => {
  test('returns a sitemap index referencing the children, as XML', async () => {
    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('<sitemapindex');
    expect(res.text).toContain('https://bookasloth.com/sitemap-pages.xml');
    expect(res.text).toContain('https://bookasloth.com/sitemap-hosts-1.xml');
    expect(res.text).toContain('https://bookasloth.com/sitemap-services-1.xml');
    expect(res.text).toContain('https://bookasloth.com/sitemap-professions.xml');
    expect(res.text).toContain('https://bookasloth.com/sitemap-blog.xml');
  });
});

describe('child sitemaps', () => {
  test('blog sitemap lists one URL per published post', async () => {
    const res = await request(app).get('/sitemap-blog.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('<loc>https://bookasloth.com/blog/zero-commission-bet</loc>');
    expect(res.text).toContain('<lastmod>2026-06-28</lastmod>');
  });

  test('pages sitemap lists the homepage', async () => {
    const res = await request(app).get('/sitemap-pages.xml');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<urlset');
    expect(res.text).toContain('<loc>https://bookasloth.com/</loc>');
  });

  test('professions sitemap lists /services plus one URL per profession', async () => {
    const res = await request(app).get('/sitemap-professions.xml');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<urlset');
    expect(res.text).toContain('<loc>https://bookasloth.com/services</loc>');
    expect(res.text).toContain('<loc>https://bookasloth.com/services/therapy</loc>');
  });

  test('hosts sitemap lists the verified host profile URL', async () => {
    const res = await request(app).get('/sitemap-hosts-1.xml');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<loc>https://bookasloth.com/john-doe</loc>');
  });

  test('services sitemap lists the /username/slug URL', async () => {
    const res = await request(app).get('/sitemap-services-1.xml');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<loc>https://bookasloth.com/john-doe/business-consultation</loc>');
  });

  test('the non-numbered alias resolves to page 1', async () => {
    const res = await request(app).get('/sitemap-hosts.xml');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<loc>https://bookasloth.com/john-doe</loc>');
  });

  test('an out-of-range page is a 404', async () => {
    const res = await request(app).get('/sitemap-hosts-2.xml');
    expect(res.status).toBe(404);
  });
});
