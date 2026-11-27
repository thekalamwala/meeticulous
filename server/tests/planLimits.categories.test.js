jest.mock('../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { FALLBACK_PLANS } = require('../services/planService');

// Caps mirror the pricing v2 matrix (migration v3.230): Starter is listed in 1
// category (its primary — founder ruling 2026-11-27), Pro is unlimited. The
// fallback must match what the DB enforces.
describe('plan category caps (fallback)', () => {
  it('free (Starter) is capped at 1', () => {
    expect(FALLBACK_PLANS.free.limits.categories).toBe(1);
  });
  it('premium (Pro) is unlimited (-1)', () => {
    expect(FALLBACK_PLANS.premium.limits.categories).toBe(-1);
  });
  it('legacy paid rows carry Pro entitlements', () => {
    expect(FALLBACK_PLANS.creator.limits.categories).toBe(-1);
    expect(FALLBACK_PLANS.professional.limits.categories).toBe(-1);
  });
});

// AI generations still cost model spend, so they stay capped on Starter. Digital
// products are uncapped in pricing v2 — they earn 12% commission instead.
describe('free plan keeps the cost-bearing caps', () => {
  it('digital products are uncapped (-1)', () => {
    expect(FALLBACK_PLANS.free.limits.digital_products).toBe(-1);
  });
  it('AI generations capped at 10 (model spend)', () => {
    expect(FALLBACK_PLANS.free.limits.ai_generations).toBe(10);
  });
  it('services and bookings are uncapped — they only ever earn us commission', () => {
    expect(FALLBACK_PLANS.free.limits.services).toBe(-1);
    expect(FALLBACK_PLANS.free.limits.bookings_per_year).toBe(-1);
  });
});
