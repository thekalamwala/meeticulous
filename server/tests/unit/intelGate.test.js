/**
 * The Intelligence gate.
 *
 * Phase 3's acceptance criteria, two of three, live here:
 *   · "a free host's API response provably contains none of the six gated figures"
 *   · "limits.insights read from subscription_plans, nothing hardcoded"
 *
 * The first is the one worth being strict about. A gate that merely sets a flag
 * and leaves the numbers in the payload is not a gate — it is a CSS blur with a
 * network tab behind it. So the leak test does not check the six keys; it builds
 * a Pro payload, collects every number and string inside the gated blocks, and
 * asserts that not one of them survives anywhere in the free payload. That
 * catches a figure copied into a summary, a headline, or a debug field.
 */
jest.mock('../../services/planService', () => ({ getLimit: jest.fn() }));

const { getLimit } = require('../../services/planService');
const { GATED, hasInsights, lockGatedBlocks, applyGate, gatedValues } = require('../../services/intel/gate');
const { buildOverview } = require('../../services/intel/overview');

const NOW = Date.parse('2026-11-17T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

// Enough history that every gated block has real numbers to leak.
const bookings = [
  { id: 'b1', payment_status: 'paid', customer_total: 2400, commission_applied: 120, commission_gst: 21.6,
    vendor_amount: 2100, paid_at: new Date(NOW - 200 * DAY).toISOString(), client_id: 'g1', guest_name: 'Meera' },
  { id: 'b2', payment_status: 'paid', customer_total: 1200, commission_applied: 60, commission_gst: 10.8,
    vendor_amount: 1050, paid_at: new Date(NOW - 120 * DAY).toISOString(), client_id: 'g2', guest_name: 'Arjun' },
  { id: 'b3', payment_status: 'paid', customer_total: 4500, commission_applied: 225, commission_gst: 40.5,
    vendor_amount: 4000, paid_at: new Date(NOW - 10 * DAY).toISOString(), client_id: 'g3', guest_name: 'Divya' },
  { id: 'b4', payment_status: 'paid', customer_total: 1200, commission_applied: 60, commission_gst: 10.8,
    vendor_amount: 1050, paid_at: new Date(NOW - 5 * DAY).toISOString(), client_id: 'g3', guest_name: 'Divya' },
  { id: 'b5', payment_status: 'paid', customer_total: 900, commission_applied: 45, commission_gst: 8.1,
    vendor_amount: 800, paid_at: new Date(NOW - 2 * DAY).toISOString(), client_id: 'g4', guest_name: 'Nikhil' },
  { id: 'b6', payment_status: 'unpaid', status: 'confirmed', customer_total: 3000 },
];

const build = () => buildOverview(bookings, { now: NOW });

beforeEach(() => jest.clearAllMocks());

describe('the limit comes from the plan row', () => {
  it('asks subscription_plans for insights, not for a plan slug', () => {
    // CLAUDE.md: limits ALWAYS come from subscription_plans.limits. An
    // isFreeSlug check here would hardcode the gate and strand the admin UI.
    getLimit.mockResolvedValue(1);
    return hasInsights('premium').then(() => {
      expect(getLimit).toHaveBeenCalledWith('premium', 'insights');
    });
  });

  it('locks when the key is missing, because getLimit returns 0', async () => {
    // Fails closed. A plan row nobody has updated yet is locked, not open.
    getLimit.mockResolvedValue(0);
    expect(await hasInsights('free')).toBe(false);
  });

  it('unlocks on any positive limit, and on -1 for unlimited', async () => {
    getLimit.mockResolvedValue(1);
    expect(await hasInsights('premium')).toBe(true);
    getLimit.mockResolvedValue(-1);
    expect(await hasInsights('supreme')).toBe(true);
  });
});

describe('a free host never receives a gated figure', () => {
  it('leaks nothing — checked by value, not by key', async () => {
    getLimit.mockResolvedValue(1);
    const pro = await applyGate('premium', build());

    getLimit.mockResolvedValue(0);
    const free = await applyGate('free', build());

    // Compare VALUES, not substrings: "60" is a substring of the free
    // payload's legitimate 601.8, which would be a false alarm.
    const valuesIn = (obj) => {
      const out = new Set();
      const walk = (v) => {
        if (v == null) return;
        if (Array.isArray(v)) return v.forEach(walk);
        if (typeof v === 'object') return Object.values(v).forEach(walk);
        out.add(v);
      };
      walk(obj);
      return out;
    };

    // A figure the free blocks are entitled to is not a leak even if a gated
    // block also contains it, so those are excluded before comparing.
    const allowed = valuesIn({ commissionLeak: pro.commissionLeak, headline: pro.headline, locked: true });
    const secrets = gatedValues(pro).filter((v) => !allowed.has(v) && (typeof v !== 'number' || Math.abs(v) > 1));

    // There must be something to leak, or this test proves nothing.
    expect(secrets.length).toBeGreaterThan(3);

    const leaked = [...valuesIn(free)].filter((v) => secrets.includes(v));
    expect(leaked).toEqual([]);
  });

  it('replaces each gated block with a marker rather than deleting the key', async () => {
    // The client renders a teaser in the right place without having to know the
    // gating rules; a reviewer sees the numbers are gone, not merely falsy.
    getLimit.mockResolvedValue(0);
    const free = await applyGate('free', build());
    for (const key of GATED) {
      if (key in free) expect(free[key]).toEqual({ locked: true });
    }
    expect(free.locked).toBe(true);
  });

  it('still gives a free host everything they are already promised', async () => {
    // The gate is on the intelligence, never the ledger. PLAN_MATRIX promises
    // free hosts commission tracking and earnings history, and /dashboard/
    // earnings already delivers it — paywalling it here would break a published
    // promise and be a weak gate besides.
    getLimit.mockResolvedValue(0);
    const free = await applyGate('free', build());
    expect(free.commissionLeak.commissionPaid).toBeGreaterThan(0);
    expect(free.headline.netRevenue).toBeGreaterThan(0);
    expect(free.headline.paidBookings).toBe(5);
  });
});

describe('a Pro host receives the real blocks', () => {
  it('unlocks win-back and forecast with numbers in them', async () => {
    getLimit.mockResolvedValue(1);
    const pro = await applyGate('premium', build());
    expect(pro.locked).toBe(false);
    expect(pro.winBack.guests.length).toBeGreaterThan(0);
    expect(pro.winBack.atStake).toBeGreaterThan(0);
    expect(pro.forecast.confirmedUnpaid.value).toBe(3000);
  });
});

describe('lockGatedBlocks', () => {
  it('touches nothing outside the six', () => {
    const out = lockGatedBlocks({ headline: { netRevenue: 5 }, winBack: { atStake: 99 } });
    expect(out.headline).toEqual({ netRevenue: 5 });
    expect(out.winBack).toEqual({ locked: true });
  });
});
