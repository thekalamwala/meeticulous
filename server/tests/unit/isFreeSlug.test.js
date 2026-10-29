jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { isFreeSlug } = require('../../services/planService');

describe('planService.isFreeSlug', () => {
  it('true for every free-tier variant (incl. grandfathered starter_legacy)', () => {
    ['starter', 'explorer', 'free', 'starter_legacy', 'STARTER_LEGACY', '  explorer  ']
      .forEach((s) => expect(isFreeSlug(s)).toBe(true));
  });
  it('false for paid + unknown', () => {
    ['creator', 'professional', 'supreme', 'random', '', null, undefined]
      .forEach((s) => expect(isFreeSlug(s)).toBe(false));
  });
});
