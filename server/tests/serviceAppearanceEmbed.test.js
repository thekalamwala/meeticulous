'use strict';

jest.mock('../config/supabase', () => {
  const row = {
    backgrounds: {},
    default_background: null,
  };
  return {
    supabaseAdmin: {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: row, error: null }),
          }),
        }),
      }),
    },
  };
});

const { getPublicAppearanceData } = require('../controllers/appearanceController');

describe('getPublicAppearanceData', () => {
  it('returns empty backgrounds and null default', async () => {
    const out = await getPublicAppearanceData();
    expect(out.default_background).toBeNull();
    expect(out.backgrounds).toEqual([]);
  });
});
