// resolveProfileTabMeta — bot meta shell for /:username/products|courses|membership.
jest.mock('../../controllers/hostController', () => ({ buildHostProfile: jest.fn() }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../config/supabase', () => {
  const q = { select: jest.fn(() => q), eq: jest.fn(() => q), limit: jest.fn(), then: undefined };
  return { supabaseAdmin: { from: jest.fn(() => q) }, __q: q };
});

const { buildHostProfile } = require('../../controllers/hostController');
const { isFeatureEnabled } = require('../../services/featureFlags');
const { __q: q } = require('../../config/supabase');
const { resolveProfileTabMeta, profileTabTitle } = require('../../controllers/prerenderController');

const HOST = { payload: { host: { id: 'h1', username: 'jane', name: 'Jane', is_verified: true }, services: [{ title: 'Call', slug: 'call' }] } };
// The count query ends on the last .eq(); make that call resolve to { count }.
const countIs = (n) => { q.eq.mockImplementationOnce(() => q).mockImplementationOnce(() => Promise.resolve({ count: n })); };

beforeEach(() => { jest.clearAllMocks(); q.eq.mockImplementation(() => q); });

test('products tab: own title, description and canonical', async () => {
  buildHostProfile.mockResolvedValueOnce(HOST);
  countIs(2);
  const m = await resolveProfileTabMeta('jane', 'products');
  expect(m.status).toBe(200);
  expect(m.buildHtmlArgs.title).toBe('Digital products by Jane | Meeticulous');
  expect(m.buildHtmlArgs.canonical).toBe('https://meeticulous.com/jane/products');
  expect(m.buildHtmlArgs.description).toMatch(/Jane/);
});

test('a tab the host does not have 301s to the profile', async () => {
  buildHostProfile.mockResolvedValueOnce(HOST);
  countIs(0);
  const m = await resolveProfileTabMeta('jane', 'courses');
  expect(m).toEqual({ status: 301, redirectTo: 'https://meeticulous.com/jane' });
});

test('membership tab is gone while community_memberships is off', async () => {
  buildHostProfile.mockResolvedValueOnce(HOST);
  isFeatureEnabled.mockResolvedValueOnce(false);
  const m = await resolveProfileTabMeta('jane', 'membership');
  expect(m.status).toBe(301);
});

test('unknown host passes the 404 through', async () => {
  buildHostProfile.mockResolvedValueOnce({ notFound: true });
  expect((await resolveProfileTabMeta('ghost', 'products')).status).toBe(404);
});

test('long names drop the brand suffix to stay within 60 chars', () => {
  expect(profileTabTitle('courses', 'A'.repeat(50))).toBe(`Courses by ${'A'.repeat(50)}`);
});
