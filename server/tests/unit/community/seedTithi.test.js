'use strict';

jest.mock('../../../config/supabase', () => {
  const upsert = jest.fn().mockResolvedValue({ error: null });
  return {
    supabaseAdmin: {
      from: jest.fn((t) => (t === 'profiles'
        ? {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: { id: 'u1' }, error: null }) }) }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
        : { upsert })),
    },
    __upsert: upsert,
  };
});
jest.mock('../../../middleware/communityGate', () => ({ CURRENT_TERMS_VERSION: '2026-11-v1' }));

const { __upsert } = require('../../../config/supabase');
const { seedTithi } = require('../../../scripts/seedTithiCommunity');

afterEach(() => jest.clearAllMocks());

test('requires a user id', async () => {
  await expect(seedTithi()).rejects.toThrow(/user id required/i);
});

test('seeds Tithi as Chief of Staff with accepted terms', async () => {
  const res = await seedTithi('u1');
  expect(res).toEqual({ userId: 'u1', name: 'Tithi', title: 'Chief of Staff', titleApplied: true });
  expect(__upsert).toHaveBeenCalledWith(
    expect.objectContaining({ user_id: 'u1', badge: 'staff', early_access: true, title: 'Chief of Staff', terms_version: '2026-11-v1' }),
    { onConflict: 'user_id' },
  );
});
