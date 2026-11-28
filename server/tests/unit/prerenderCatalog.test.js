// Product / course pages in the bot shell (/:username/products|courses/:key) and
// the old singular URLs: the canonical slug URL serves 200 with its own meta +
// Product/Course graph; an old id, a legacy slug or the old path 301s to it.
process.env.PUBLIC_SITE_URL = 'https://meeticulous.com';
jest.mock('../../controllers/hostController', () => ({ buildHostProfile: jest.fn() }));
jest.mock('../../services/catalogSlug', () => ({ resolveCatalogItem: jest.fn() }));

const { buildHostProfile } = require('../../controllers/hostController');
const { resolveCatalogItem } = require('../../services/catalogSlug');
const { resolveCatalogMeta, renderCatalogMeta, renderLegacyCatalogRedirect } = require('../../controllers/prerenderController');

const UUID = '3f2b8c1e-9d4a-4e6b-8f1a-2c3d4e5f6a7b';
const HOST = { payload: { host: { id: 'h1', username: 'jane', name: 'Jane Doe', profession: 'Designer', is_verified: true }, services: [{ title: 'Call', slug: 'call' }] } };
const PRODUCT = { id: UUID, slug: 'brand-kit', title: 'Brand kit', type: 'template', price: 499, description: 'Fonts, colours and logo rules in one Figma file. Ready in a day.', thumbnail_url: 'https://img/kit.webp', created_at: '2026-10-01T09:00:00Z', updated_at: '2026-11-20T09:00:00Z' };
const COURSE = { id: 'c1', slug: 'ux-101', title: 'UX 101', price: 0, description: 'Learn UX basics.', course_lessons: [{ id: 'b', title: 'Two', sort_order: 2 }, { id: 'a', title: 'One', sort_order: 1 }] };
const res = () => { const r = { set: jest.fn(), send: jest.fn(), status: jest.fn(() => r), redirect: jest.fn() }; return r; };
const node = (ld, t) => ld['@graph'].find((n) => n['@type'] === t);

beforeEach(() => { jest.clearAllMocks(); buildHostProfile.mockResolvedValue(HOST); });

describe('resolveCatalogMeta — slug canonical, everything else 301s', () => {
  test('canonical slug → 200 with title, description, canonical, Product graph, host robots', async () => {
    resolveCatalogItem.mockResolvedValueOnce({ data: PRODUCT });
    const m = await resolveCatalogMeta('products', 'jane', 'brand-kit');
    expect(m.status).toBe(200);
    expect(m.buildHtmlArgs.title).toBe('Brand kit — Template by Jane Doe');
    expect(m.buildHtmlArgs.canonical).toBe('https://meeticulous.com/jane/products/brand-kit');
    expect(m.buildHtmlArgs.image).toBe('https://img/kit.webp');
    expect(m.buildHtmlArgs.robots).toBe('index,follow');
    const d = m.buildHtmlArgs.description;
    expect(d.length).toBeGreaterThanOrEqual(140);
    expect(d.length).toBeLessThanOrEqual(160);
    const p = node(m.buildHtmlArgs.jsonLd, 'Product');
    expect(p.offers).toMatchObject({ price: '499', priceCurrency: 'INR', seller: { '@id': 'https://meeticulous.com/jane#person' } });
    expect(JSON.stringify(m.buildHtmlArgs.jsonLd)).not.toContain(UUID);
  });

  test('an old id → 301 to the slug URL', async () => {
    resolveCatalogItem.mockResolvedValueOnce({ data: PRODUCT });
    expect(await resolveCatalogMeta('products', 'jane', UUID))
      .toEqual({ status: 301, redirectTo: 'https://meeticulous.com/jane/products/brand-kit' });
  });

  test('a legacy (demo-) slug → 301 to the current slug', async () => {
    resolveCatalogItem.mockResolvedValueOnce({ data: COURSE });
    expect(await resolveCatalogMeta('courses', 'jane', 'demo-ux-101'))
      .toEqual({ status: 301, redirectTo: 'https://meeticulous.com/jane/courses/ux-101' });
  });

  test('unknown key or a row with no slug → 404 (never a UUID URL)', async () => {
    resolveCatalogItem.mockResolvedValueOnce({ data: null });
    expect((await resolveCatalogMeta('products', 'jane', 'nope')).status).toBe(404);
    resolveCatalogItem.mockResolvedValueOnce({ data: { ...PRODUCT, slug: null } });
    expect((await resolveCatalogMeta('products', 'jane', UUID)).status).toBe(404);
  });

  test('renamed host → ONE 301 to the canonical URL under the new username', async () => {
    buildHostProfile
      .mockResolvedValueOnce({ redirect: true, username: 'jane-new' })
      .mockResolvedValueOnce({ payload: { ...HOST.payload, host: { ...HOST.payload.host, username: 'jane-new' } } });
    resolveCatalogItem.mockResolvedValueOnce({ data: COURSE });
    // old username AND a legacy slug: still a single hop to the canonical slug URL
    expect(await resolveCatalogMeta('courses', 'jane', 'demo-ux-101'))
      .toEqual({ status: 301, redirectTo: 'https://meeticulous.com/jane-new/courses/ux-101' });
  });

  test('course: lessons sorted, Course graph, free → category Free, no thumbnail → host card', async () => {
    resolveCatalogItem.mockResolvedValueOnce({ data: COURSE });
    const m = await resolveCatalogMeta('courses', 'jane', 'ux-101');
    expect(m.item.course_lessons.map((l) => l.title)).toEqual(['One', 'Two']);
    expect(m.buildHtmlArgs.title).toBe('UX 101 — course by Jane Doe');
    const c = node(m.buildHtmlArgs.jsonLd, 'Course');
    expect(c.offers.category).toBe('Free');
    expect(c.hasCourseInstance.courseMode).toBe('online');
    expect(m.buildHtmlArgs.cardImage).toBe(true);
  });
});

describe('handlers', () => {
  test('renderCatalogMeta: one h1, summary, visible FAQ, JSON-LD in head', async () => {
    resolveCatalogItem.mockResolvedValueOnce({ data: PRODUCT });
    const r = res();
    await renderCatalogMeta({ params: { username: 'jane', kind: 'products', key: 'brand-kit' } }, r);
    const html = r.send.mock.calls[0][0];
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<link rel="canonical" href="https://meeticulous.com/jane/products/brand-kit">');
    expect(html).toContain('"@type":"Product"');
    expect(html).toContain('Frequently asked questions');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    // Headed sections (same blocks as the SPA) + visible and JSON-LD freshness.
    expect(html).toContain("<h2>What's included</h2>");
    expect(html).toContain('<h2>Who made it</h2>');
    expect(html).toContain('<h2>How you get it</h2>');
    expect(html).toContain('<p>Updated 20 Nov 2026</p>');
    expect(html).toContain('"@type":"ItemPage"');
    expect(html).toContain('"dateModified":"2026-11-20T09:00:00Z"');
  });

  test('renderCatalogMeta: non-canonical key answers 301', async () => {
    resolveCatalogItem.mockResolvedValueOnce({ data: PRODUCT });
    const r = res();
    await renderCatalogMeta({ params: { username: 'jane', kind: 'products', key: UUID } }, r);
    expect(r.redirect).toHaveBeenCalledWith(301, 'https://meeticulous.com/jane/products/brand-kit');
  });

  test('old /:u/product/:key always 301s to the slug URL (even when the key IS the slug)', async () => {
    resolveCatalogItem.mockResolvedValueOnce({ data: PRODUCT });
    const r = res();
    await renderLegacyCatalogRedirect({ params: { username: 'jane', kind: 'product', key: 'brand-kit' } }, r);
    expect(r.redirect).toHaveBeenCalledWith(301, 'https://meeticulous.com/jane/products/brand-kit');
  });

  test('old /:u/course/:key with an unknown key → 404', async () => {
    resolveCatalogItem.mockResolvedValueOnce({ data: null });
    const r = res();
    await renderLegacyCatalogRedirect({ params: { username: 'jane', kind: 'course', key: 'gone' } }, r);
    expect(r.status).toHaveBeenCalledWith(404);
  });
});
