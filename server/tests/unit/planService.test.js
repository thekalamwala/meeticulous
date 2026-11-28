jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn(() => ({ select: () => ({ order: () => Promise.resolve({ data: null, error: { message: 'relation "subscription_plans" does not exist' } }) }) })) } }));
const planService = require('../../services/planService');

test('followup_flows fallback: free 1 (day-3 rebook), premium/creator/professional unlimited', async () => {
  expect(await planService.getLimit('free', 'followup_flows')).toBe(1);
  expect(await planService.getLimit('premium', 'followup_flows')).toBe(-1);
  // Legacy paid rows were lifted to Pro entitlements in v3.165.
  expect(await planService.getLimit('creator', 'followup_flows')).toBe(-1);
  expect(await planService.getLimit('professional', 'followup_flows')).toBe(-1);
});

test('legacy free slugs alias onto the free row', async () => {
  expect(planService.normalizeSlug('explorer')).toBe('free');
  expect(planService.normalizeSlug('starter')).toBe('free');
  // starter_legacy deliberately reads its own row (v3.56 grandfathering).
  expect(planService.normalizeSlug('starter_legacy')).toBe('starter_legacy');
});

test('an unknown slug resolves to the free plan, never a paid one', async () => {
  const plan = await planService.getPlan('does_not_exist');
  expect(plan.slug).toBe('free');
  expect(Number(plan.commission_percentage)).toBe(5);
});

test('an expired paid plan falls back to free', () => {
  const past = new Date(Date.now() - 86400000).toISOString();
  expect(planService.resolveVendorPlan({ plan: 'premium', plan_expires_at: past })).toBe('free');
  const future = new Date(Date.now() + 86400000).toISOString();
  expect(planService.resolveVendorPlan({ plan: 'premium', plan_expires_at: future })).toBe('premium');
});

// Archived rows still RESOLVE (existing subscribers keep renewing) but must
// never be purchasable from the public upgrade page.
test('isSelfServable gates archived rows out of self-serve checkout', () => {
  expect(planService.isSelfServable({ slug: 'premium', active: true })).toBe(true);
  expect(planService.isSelfServable({ slug: 'free', active: true })).toBe(true);
  expect(planService.isSelfServable({ slug: 'creator', active: false })).toBe(false);
  expect(planService.isSelfServable({ slug: 'supreme', active: false })).toBe(false);
  expect(planService.isSelfServable(null)).toBe(false);
});

// Revenue floor: a ₹0 service earns nothing (0% of 0, and no booking fee on free
// services in prod), so the free plan MUST cap them. v3.165 briefly set this to
// -1 (unlimited), which let a host run a whole business at zero revenue; v3.166
// restored the cap. This pins it so a future "make free more generous" edit can't
// silently re-open the hole. Premium may be unlimited — those hosts already paid.
test('free plan caps free (₹0) services; premium does not', async () => {
  expect(await planService.getLimit('free', 'free_services')).toBe(2);
  expect(await planService.getLimit('premium', 'free_services')).toBe(-1);
});

// Free gets a CAPPED CRM view (50 most recent, pricing v2) — not a hard block
// (crm:0) and not unlimited. requireCrm lets any positive limit through;
// crmService.listClients enforces the cap. Premium is unlimited.
test('free plan gets a capped CRM (50); premium is unlimited', async () => {
  expect(await planService.getLimit('free', 'crm')).toBe(50);
  expect(await planService.getLimit('premium', 'crm')).toBe(-1);
});

// ── Pricing v2: per-surface commission (spec §2) ───────────────────────────
describe('getRate', () => {
  test('Starter and Pro read the rate map per surface', async () => {
    expect(await planService.getRate('free', 'appointments')).toBe(9);
    expect(await planService.getRate('free', 'products')).toBe(12);
    expect(await planService.getRate('free', 'memberships')).toBe(12);
    expect(await planService.getRate('premium', 'appointments')).toBe(0);
    expect(await planService.getRate('premium', 'courses')).toBe(4);
    expect(await planService.getRate('premium_founding', 'products')).toBe(4);
  });
  test('legacy free aliases read the free map', async () => {
    expect(await planService.getRate('explorer', 'appointments')).toBe(9);
  });
  test('a row with no map falls back to the commission_percentage scalar', async () => {
    // creator carries no commission_rates in the fallback (nor in v3.230).
    expect(await planService.getRate('creator', 'products')).toBe(0);
  });
});

describe('getRate on a partially-migrated DB (row has no commission_rates)', () => {
  const { supabaseAdmin } = require('../../config/supabase');
  afterEach(() => planService.clearCache());
  test('every surface prices at the scalar, exactly as before v3.229', async () => {
    supabaseAdmin.from.mockImplementationOnce(() => ({ select: () => ({ order: () => Promise.resolve({
      data: [{ slug: 'free', commission_percentage: '5.00', limits: {} }], error: null }) }) }));
    planService.clearCache();
    expect(await planService.getRate('free', 'appointments')).toBe(5);
    expect(await planService.getRate('free', 'courses')).toBe(5);
    expect(await planService.appointmentRateFor('free', 999999)).toBe(5);
  });
});

describe('appointmentRateFor — the Pro 25,000/month band (acceptance test 9)', () => {
  test('MTD-before below the band → 0%, even when this booking crosses it', async () => {
    expect(await planService.appointmentRateFor('premium', 24000)).toBe(0);
  });
  test('MTD-before at or above the band → 3% on the whole booking', async () => {
    expect(await planService.appointmentRateFor('premium', 25000)).toBe(3);
    expect(await planService.appointmentRateFor('premium', 26000)).toBe(3);
  });
  test('Starter has no band — 9% at any volume', async () => {
    expect(await planService.appointmentRateFor('free', 0)).toBe(9);
    expect(await planService.appointmentRateFor('free', 1e7)).toBe(9);
  });
});
