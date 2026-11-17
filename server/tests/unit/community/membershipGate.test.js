'use strict';
// M4 acceptance: a below-tier viewer's hydrated response NEVER carries gated
// body/media; an entitled viewer and the author get the full post.

let mockData = { community_membership_tiers: [], community_membership_subscriptions: [] };
let mockThrow = false;
jest.mock('../../../config/supabase', () => {
  const makeBuilder = (table) => {
    const result = { data: mockData[table] || [], error: null };
    const q = {
      select: () => q, eq: () => q, in: () => q, order: () => q,
      then: (res, rej) => (mockThrow ? Promise.reject(new Error('db down')).then(res, rej)
                                     : Promise.resolve(result).then(res, rej)),
    };
    return q;
  };
  return { supabaseAdmin: { from: (t) => makeBuilder(t) } };
});

const store = require('../../../services/community/store');

const premium = { id: 'tx', name: 'Premium', type: 'paid', price_inr: 999 };
const publicItem = () => ({ id: 'p1', audience: 'public', body: 'public body', media: [{ url: 'pub.jpg' }], author: { id: 'host1' } });
const gatedItem = () => ({
  id: 'g1', audience: 'tier', audience_tier_id: 'tx', teaser_line: 'Join Premium',
  body: 'SECRET premium body', media: [{ url: 'secret.jpg' }], comment_count: 3,
  author: { id: 'host1' },
});

beforeEach(() => {
  mockData = { community_membership_tiers: [premium], community_membership_subscriptions: [] };
  mockThrow = false;
});

describe('gateItems', () => {
  test('below-tier viewer: gated post becomes a teaser, no body/media leak', async () => {
    const out = await store.gateItems([publicItem(), gatedItem()], 'viewer_below');
    expect(out[0].body).toBe('public body');            // public untouched
    const g = out[1];
    expect(g.locked).toBe(true);
    expect(g.body).toBe('');
    expect(g.media).toEqual([]);
    expect(g.lock.tier_name).toBe('Premium');
    expect(g.teaser).toBe('Join Premium');
    expect(JSON.stringify(g)).not.toContain('SECRET premium body');
    expect(JSON.stringify(g)).not.toContain('secret.jpg');
  });

  test('entitled viewer (active Premium sub) sees the full gated post', async () => {
    mockData.community_membership_subscriptions = [{ host_id: 'host1', tier: { type: 'paid', price_inr: 999 } }];
    const out = await store.gateItems([gatedItem()], 'viewer_premium');
    expect(out[0].locked).toBeUndefined();
    expect(out[0].body).toBe('SECRET premium body');
  });

  test('author always sees their own gated post', async () => {
    const out = await store.gateItems([gatedItem()], 'host1');
    expect(out[0].body).toBe('SECRET premium body');
  });

  test('public viewer (no viewerId) gets a teaser', async () => {
    const out = await store.gateItems([gatedItem()], null);
    expect(out[0].locked).toBe(true);
    expect(out[0].body).toBe('');
  });

  test('fail closed: a DB error still withholds the gated body', async () => {
    mockThrow = true;
    const out = await store.gateItems([gatedItem()], 'viewer_below');
    expect(out[0].locked).toBe(true);
    expect(out[0].body).toBe('');
    expect(JSON.stringify(out[0])).not.toContain('SECRET premium body');
  });
});
