// resolveProfileTabMeta — bot meta shell for /:username/products|courses|membership:
// own title/description/canonical (data-built templates), a CollectionPage +
// ItemList graph of slug URLs, a visible FAQ, and a 301 when the tab is empty.
process.env.PUBLIC_SITE_URL = 'https://meeticulous.com';
jest.mock('../../controllers/hostController', () => ({ buildHostProfile: jest.fn() }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/catalogOrder', () => ({ applyHostOrder: jest.fn(async (_t, _h, rows) => rows) }));
jest.mock('../../config/supabase', () => {
  const state = { result: { data: [], error: null } };
  const q = {};
  ['select', 'eq', 'order', 'limit'].forEach((k) => { q[k] = jest.fn(() => q); });
  q.maybeSingle = jest.fn(async () => state.result);
  q.then = (res, rej) => Promise.resolve(state.result).then(res, rej);
  return { supabaseAdmin: { from: jest.fn(() => q) }, __state: state };
});

const { buildHostProfile } = require('../../controllers/hostController');
const { isFeatureEnabled } = require('../../services/featureFlags');
const { __state } = require('../../config/supabase');
const { resolveProfileTabMeta, renderProfileTabMeta } = require('../../controllers/prerenderController');

const HOST = {
  payload: {
    host: { id: 'h1', username: 'jane', name: 'Jane Doe', profession: 'Designer', is_verified: true, social_links: { website: 'https://jane.design' } },
    services: [{ title: 'Call', slug: 'call', price: 500 }],
  },
};
const UUID = '3f2b8c1e-9d4a-4e6b-8f1a-2c3d4e5f6a7b';
const node = (ld, t) => ld['@graph'].find((n) => n['@type'] === t);

beforeEach(() => { jest.clearAllMocks(); __state.result = { data: [], error: null }; });

test('products tab: own title, description, canonical and CollectionPage + ItemList of slug URLs', async () => {
  buildHostProfile.mockResolvedValueOnce(HOST);
  __state.result = { data: [
    { id: UUID, slug: 'brand-kit', title: 'Brand kit', price: 499, type: 'template' },
    { id: 'p2', slug: 'logo-guide', title: 'Logo guide', price: 0, type: 'pdf' },
  ], error: null };
  const m = await resolveProfileTabMeta('jane', 'products');
  expect(m.status).toBe(200);
  expect(m.buildHtmlArgs.title).toBe('Digital products by Jane Doe (2)');
  expect(m.buildHtmlArgs.canonical).toBe('https://meeticulous.com/jane/products');
  expect(m.buildHtmlArgs.description.length).toBeGreaterThanOrEqual(140);
  expect(m.buildHtmlArgs.description.length).toBeLessThanOrEqual(160);
  const ld = m.buildHtmlArgs.jsonLd;
  expect(node(ld, 'CollectionPage')['@id']).toBe('https://meeticulous.com/jane/products');
  expect(node(ld, 'ItemList').itemListElement.map((i) => i.url)).toEqual([
    'https://meeticulous.com/jane/products/brand-kit', 'https://meeticulous.com/jane/products/logo-guide',
  ]);
  expect(node(ld, 'FAQPage').mainEntity.length).toBe(m.faqs.length);
  expect(node(ld, 'Person').sameAs).toEqual(['https://jane.design']);
  expect(JSON.stringify(ld)).not.toContain(UUID);
  expect(ld['@graph'].map((n) => n['@type'])).not.toContain('ProfilePage');
});

test('rendered tab shell: one h1, summary, item links, visible FAQ', async () => {
  buildHostProfile.mockResolvedValueOnce(HOST);
  __state.result = { data: [{ id: 'c1', slug: 'ux-101', title: 'UX 101', price: 999, course_lessons: [{ id: 'l1' }, { id: 'l2' }] }], error: null };
  const res = { set: jest.fn(), send: jest.fn(), status: jest.fn(() => res), redirect: jest.fn() };
  await renderProfileTabMeta({ params: { username: 'jane', tab: 'courses' } }, res);
  const html = res.send.mock.calls[0][0];
  expect(html.match(/<h1>/g)).toHaveLength(1);
  expect(html).toContain('<title>Online courses by Jane Doe (1)</title>');
  expect(html).toContain('href="https://meeticulous.com/jane/courses/ux-101"');
  expect(html).toContain('Frequently asked questions');
  expect(html).toContain('2 lessons');
  expect(html).toContain('<h3><a href="https://meeticulous.com/jane/courses/ux-101">UX 101</a></h3>');
  expect(html).toContain('<h2>How access works</h2>');
  // No "About {name}" stats block on profile pages (founder 2026-11-28).
  expect(html).not.toContain('<h2>About Jane Doe</h2>');
});

test('a tab the host does not have 301s to the profile', async () => {
  buildHostProfile.mockResolvedValueOnce(HOST);
  const m = await resolveProfileTabMeta('jane', 'courses');
  expect(m).toEqual({ status: 301, redirectTo: 'https://meeticulous.com/jane' });
});

test('membership tab is gone while community_memberships is off', async () => {
  buildHostProfile.mockResolvedValueOnce(HOST);
  isFeatureEnabled.mockResolvedValueOnce(false);
  const m = await resolveProfileTabMeta('jane', 'membership');
  expect(m.status).toBe(301);
});

test('membership tab: program title, a Product per live tier with a monthly price spec', async () => {
  buildHostProfile.mockResolvedValueOnce(HOST);
  isFeatureEnabled.mockResolvedValueOnce(true);
  __state.result = { data: { name: 'Design Circle', blurb: 'Monthly critiques.', tiers: [
    { id: 't1', name: 'Pro', type: 'paid', price_inr: 299, status: 'live', position: 1, perks: ['Critique'] },
    { id: 't2', name: 'Old', type: 'paid', price_inr: 99, status: 'archived', position: 0 },
  ] }, error: null };
  const m = await resolveProfileTabMeta('jane', 'membership');
  expect(m.buildHtmlArgs.title).toBe('Design Circle — membership by Jane Doe');
  const items = node(m.buildHtmlArgs.jsonLd, 'ItemList').itemListElement;
  expect(items).toHaveLength(1);
  expect(items[0].item.url).toBe('https://meeticulous.com/jane/membership#pro');
  expect(items[0].item.offers.priceSpecification).toMatchObject({ billingDuration: 'P1M', unitCode: 'MON' });
  expect(m.faqs.map((f) => f.q)).toContain('Can I cancel?');
});

test('a renamed host 301s to the new username, keeping the tab', async () => {
  buildHostProfile.mockResolvedValueOnce({ redirect: true, username: 'jane-new' });
  expect(await resolveProfileTabMeta('jane', 'products')).toEqual({ status: 301, redirectTo: 'https://meeticulous.com/jane-new/products' });
});

test('unknown host passes the 404 through', async () => {
  buildHostProfile.mockResolvedValueOnce({ notFound: true });
  expect((await resolveProfileTabMeta('ghost', 'products')).status).toBe(404);
});
