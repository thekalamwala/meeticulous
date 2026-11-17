'use strict';
// M3 security branch: a host may gate a post ONLY to their OWN live tier.
// getOwnedLiveTier is the guard; everything else in createItem is thin branching.

let mockResult = { data: null, error: null };
jest.mock('../../../config/supabase', () => {
  const q = {
    select: () => q, eq: () => q,
    maybeSingle: async () => mockResult,
  };
  return { supabaseAdmin: { from: () => q } };
});

const store = require('../../../services/community/store');

beforeEach(() => { mockResult = { data: null, error: null }; });

const tier = (over) => ({ id: 't1', status: 'live', type: 'paid', price_inr: 100, program: { host_id: 'host1' }, ...over });

describe('getOwnedLiveTier', () => {
  test('returns the tier for the owning host when live', async () => {
    mockResult = { data: tier(), error: null };
    expect(await store.getOwnedLiveTier('host1', 't1')).toMatchObject({ id: 't1' });
  });
  test('rejects a tier owned by another host', async () => {
    mockResult = { data: tier({ program: { host_id: 'someone_else' } }), error: null };
    expect(await store.getOwnedLiveTier('host1', 't1')).toBeNull();
  });
  test('rejects a draft (not-live) tier', async () => {
    mockResult = { data: tier({ status: 'draft' }), error: null };
    expect(await store.getOwnedLiveTier('host1', 't1')).toBeNull();
  });
  test('null tierId -> null', async () => {
    expect(await store.getOwnedLiveTier('host1', null)).toBeNull();
  });
  test('missing membership table (v3.218 not applied) -> null, no throw', async () => {
    mockResult = { data: null, error: { code: '42P01', message: 'relation "community_membership_tiers" does not exist' } };
    expect(await store.getOwnedLiveTier('host1', 't1')).toBeNull();
  });
});
