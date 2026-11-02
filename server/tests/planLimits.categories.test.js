jest.mock('../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { FALLBACK_PLANS } = require('../services/planService');

// Caps mirror the published pricing matrix (migration v3.165). Categories are a
// discovery/SEO surface that costs us nothing, so they are uncapped on both
// plans — the fallback must not re-introduce a limit the live DB doesn't enforce.
describe('plan category caps (fallback)', () => {
  it('free (Starter) is unlimited (-1)', () => {
    expect(FALLBACK_PLANS.free.limits.categories).toBe(-1);
  });
  it('premium (Pro) is unlimited (-1)', () => {
    expect(FALLBACK_PLANS.premium.limits.categories).toBe(-1);
  });
  it('legacy paid rows carry Pro entitlements', () => {
    expect(FALLBACK_PLANS.creator.limits.categories).toBe(-1);
    expect(FALLBACK_PLANS.professional.limits.categories).toBe(-1);
  });
});

// The two limits with real marginal cost stay countable on the free plan.
describe('free plan keeps the cost-bearing caps', () => {
  it('digital products capped at 3 (storage)', () => {
    expect(FALLBACK_PLANS.free.limits.digital_products).toBe(3);
  });
  it('AI generations capped at 10 (model spend)', () => {
    expect(FALLBACK_PLANS.free.limits.ai_generations).toBe(10);
  });
  it('services and bookings are uncapped — they only ever earn us commission', () => {
    expect(FALLBACK_PLANS.free.limits.services).toBe(-1);
    expect(FALLBACK_PLANS.free.limits.bookings_per_year).toBe(-1);
  });
});
