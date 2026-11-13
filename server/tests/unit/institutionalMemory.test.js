// Slice 6 — institutional memory recall (prior community answers as extra retrieval).
// supabase + featureFlags mocked.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const { isFeatureEnabled } = require('../../services/featureFlags');
const { recall } = require('../../services/bot/institutionalMemory');

function qb(result) {
  const b = {};
  ['select', 'eq', 'gt', 'is', 'textSearch', 'order', 'limit'].forEach((m) => { b[m] = () => b; });
  b.then = (res) => res(result);
  return b;
}
function wire(map) {
  supabaseAdmin.from.mockImplementation((t) => qb((map[t] || []).shift() || { data: [] }));
}

beforeEach(() => {
  jest.clearAllMocks();
  isFeatureEnabled.mockResolvedValue(true);
});

test('flag OFF → no recall, no query', async () => {
  isFeatureEnabled.mockResolvedValue(false);
  expect(await recall('how long do refunds take?')).toEqual([]);
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});

test('a very short query is ignored', async () => {
  expect(await recall('hi')).toEqual([]);
});

test('recalls an answered community question as a Q/A chunk', async () => {
  wire({
    community_posts: [{ data: [{ id: 'p1', title: 'Refund timing', body: 'how long do refunds take?', status: 'visible', comment_count: 1 }] }],
    community_comments: [{ data: [{ body: 'Usually 5–7 working days once issued.' }] }],
  });
  const out = await recall('when will my refund arrive');
  expect(out).toHaveLength(1);
  expect(out[0]).toMatchObject({ source_file: 'community', rank: 0.4 });
  expect(out[0].content).toMatch(/previously asked/);
  expect(out[0].content).toMatch(/5–7 working days/);
});

test('an answered post with no visible comment is skipped', async () => {
  wire({
    community_posts: [{ data: [{ id: 'p1', body: 'some real question text', status: 'visible', comment_count: 1 }] }],
    community_comments: [{ data: [] }],
  });
  expect(await recall('some real question text')).toEqual([]);
});

test('a query error degrades to [] (docs-only), never throws', async () => {
  supabaseAdmin.from.mockImplementationOnce(() => { throw new Error('boom'); });
  expect(await recall('a genuine question here')).toEqual([]);
});
