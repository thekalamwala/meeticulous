'use strict';
const { tierRank, requiredRank, isUnlocked, postToTeaser, maxTierRank, PAID_BASE } =
  require('../../../services/community/entitlement');

const free = { type: 'free', price_inr: null };
const pro = { type: 'paid', price_inr: 299 };
const premium = { type: 'paid', price_inr: 999 };
const tierById = { tf: free, tp: pro, tx: premium };

describe('tierRank ladder', () => {
  test('public < free < pro < premium', () => {
    expect(tierRank(null)).toBe(0);
    expect(tierRank(free)).toBeLessThan(tierRank(pro));
    expect(tierRank(pro)).toBeLessThan(tierRank(premium));
    expect(tierRank(free)).toBeLessThan(PAID_BASE); // any paid beats any free
  });
});

describe('requiredRank', () => {
  test('public=0, free_subscribers=free rank, tier=that tier rank', () => {
    expect(requiredRank({ audience: 'public' }, tierById)).toBe(0);
    expect(requiredRank({ audience: 'free_subscribers' }, tierById)).toBe(tierRank(free));
    expect(requiredRank({ audience: 'tier', audience_tier_id: 'tx' }, tierById)).toBe(tierRank(premium));
  });
  test('missing tier and unknown audience fail closed to paid floor', () => {
    expect(requiredRank({ audience: 'tier', audience_tier_id: 'gone' }, tierById)).toBe(PAID_BASE);
    expect(requiredRank({ audience: 'weird' }, tierById)).toBe(PAID_BASE);
  });
});

describe('isUnlocked matrix', () => {
  const premiumPost = { audience: 'tier', audience_tier_id: 'tx' };
  const freePost = { audience: 'free_subscribers' };
  const publicPost = { audience: 'public' };
  test('public viewer sees only public', () => {
    expect(isUnlocked(publicPost, 0, tierById)).toBe(true);
    expect(isUnlocked(freePost, 0, tierById)).toBe(false);
    expect(isUnlocked(premiumPost, 0, tierById)).toBe(false);
  });
  test('free subscriber unlocks public + free, not paid', () => {
    const r = tierRank(free);
    expect(isUnlocked(freePost, r, tierById)).toBe(true);
    expect(isUnlocked(premiumPost, r, tierById)).toBe(false);
  });
  test('pro member sees premium as LOCKED (below tier)', () => {
    expect(isUnlocked(premiumPost, tierRank(pro), tierById)).toBe(false);
  });
  test('premium member unlocks everything below incl. free + pro', () => {
    const r = tierRank(premium);
    expect(isUnlocked(publicPost, r, tierById)).toBe(true);
    expect(isUnlocked(freePost, r, tierById)).toBe(true);
    expect(isUnlocked({ audience: 'tier', audience_tier_id: 'tp' }, r, tierById)).toBe(true);
    expect(isUnlocked(premiumPost, r, tierById)).toBe(true);
  });
});

describe('postToTeaser withholds gated content', () => {
  const item = {
    id: '1', title: 'Secret', body: 'the real body text that must not leak',
    audience: 'tier', comment_count: 7,
    media: [{ url: 'https://cdn/secret.jpg' }],
  };
  const t = postToTeaser(item, { requiredTier: { name: 'Premium' }, teaserLine: 'Join to read' });
  test('no body, no media bytes reach the teaser', () => {
    expect(t.body).toBe('');
    expect(t.media).toEqual([]);
    expect(JSON.stringify(t)).not.toContain('the real body text');
    expect(JSON.stringify(t)).not.toContain('secret.jpg');
  });
  test('keeps lock chip + teaser preview, marks locked', () => {
    expect(t.locked).toBe(true);
    expect(t.lock.tier_name).toBe('Premium');
    expect(t.teaser).toBe('Join to read');
  });
  test('falls back to first 140 chars when no teaser line', () => {
    const t2 = postToTeaser(item, { requiredTier: { name: 'Premium' } });
    expect(t2.teaser).toBe(item.body.slice(0, 140));
  });
});

describe('maxTierRank query', () => {
  const fakeDb = (rows, error = null) => ({
    from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ in: () => ({ data: rows, error }) }) }) }) }),
  });
  test('returns highest current tier rank', async () => {
    const db = fakeDb([{ tier: free }, { tier: premium }]);
    expect(await maxTierRank(db, { hostId: 'h', viewerId: 'v' })).toBe(tierRank(premium));
  });
  test('no viewer, no rows, or error -> public rank 0 (fail closed)', async () => {
    expect(await maxTierRank(fakeDb([]), { hostId: 'h', viewerId: 'v' })).toBe(0);
    expect(await maxTierRank(fakeDb(null, { message: 'boom' }), { hostId: 'h', viewerId: 'v' })).toBe(0);
    expect(await maxTierRank(fakeDb([{ tier: premium }]), { hostId: 'h', viewerId: null })).toBe(0);
  });
});
