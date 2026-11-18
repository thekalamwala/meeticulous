/**
 * Creator Intelligence — Revenue and Overview.
 * Design: docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §8.1, §8.2, §12.3
 *
 * Phase 3: the half that needs no event store. Every figure here comes from
 * `bookings`, live, so these two endpoints work the day they ship rather than
 * waiting 14 days for events to accrue.
 *
 * TENANT ISOLATION: every query filters `host_id = req.user.id`, taken from the
 * verified session and never from a parameter. intelligenceTenancy.test.js reads
 * this file and fails if any Supabase query in it lacks that filter — a test
 * rather than a convention, because one missing `.eq` here would serve one
 * host's revenue to another.
 *
 * GATING happens in exactly one place, gate.applyGate, after the payload is
 * built. The builders never know who is asking. That is what makes "a free
 * host's response contains none of the gated figures" checkable in one test
 * instead of re-proved at every branch.
 */
const { supabaseAdmin } = require('../config/supabase');
const { resolveVendorPlan } = require('../services/planService');
const money = require('../services/intel/money');
const { buildOverview } = require('../services/intel/overview');
const { applyGate, hasInsights } = require('../services/intel/gate');
const { buildAudience } = require('../services/intel/audience');
const { buildDemand } = require('../services/intel/demand');
const { safeError } = require('../utils/httpError');

// The snapshot columns the Revenue page reconciles from. Listed explicitly
// rather than `*`: this payload is a host's commercial data, and a future
// column should have to be added here deliberately.
const BOOKING_COLUMNS = [
  'id', 'status', 'payment_status', 'created_at', 'paid_at',
  'customer_total', 'platform_fee_amount', 'platform_fee_gst',
  'commission_applied', 'commission_gst',
  'razorpay_fee_actual', 'razorpay_tax_actual',
  'tds_amount', 'tcs_amount', 'refunded_amount', 'vendor_amount',
  'settlement_status', 'settled_at',
  'client_id', 'guest_name', 'guest_email', 'guest_phone',
  'services(title)',
].join(', ');

/** Every booking for the signed-in host. One read, reused by both endpoints. */
async function hostBookings(hostId, { from, to } = {}) {
  let q = supabaseAdmin
    .from('bookings')
    .select(BOOKING_COLUMNS)
    .eq('host_id', hostId);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/**
 * The host's effective plan.
 *
 * resolveVendorPlan takes a PROFILE, not an id, and is synchronous — it reads
 * `plan` and downgrades to free when `plan_expires_at` has passed. req.user
 * carries only id and email, so the profile has to be read. Doing it here keeps
 * the expiry rule in one place rather than re-implementing "is this plan still
 * valid" at the gate.
 */
async function planOf(hostId) {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('id', hostId)
    .maybeSingle();
  // No profile row is not a reason to hand out Pro. resolveVendorPlan on
  // undefined yields the free slug, which is the direction to fail.
  return resolveVendorPlan(data || {});
}

/** Freshness envelope every Intelligence response carries (§12.3). */
const envelope = (range) => ({
  asOf: new Date().toISOString(),
  // "live" is the honest word here and is the point of Phase 3: these numbers
  // are read from the ledger on every request, so they cannot be stale.
  freshness: 'live',
  range: range || 'all',
});

/**
 * GET /api/host/intelligence/money
 * Ungated in full, deliberately — see gate.js. Free hosts are already promised
 * earnings and commission history, and /dashboard/earnings gives it to them.
 */
const getMoney = async (req, res) => {
  try {
    const { from, to } = req.query;
    const rows = await hostBookings(req.user.id, { from, to });

    return res.json({
      ...envelope(req.query.range),
      locked: false,
      summary: money.summarise(rows),
      settlement: money.settlement(rows),
      byService: money.byService(rows),
      byMonth: money.byMonth(rows),
      concentration: money.concentration(rows),
      upcoming: money.upcoming(rows),
      // FY-scoped and measured-only, per the CA ruling: an all-time withholding
      // total reconciles to no statutory record, and a derived one is a guess
      // about money the government is holding.
      withholding: money.withholding(rows),
    });
  } catch (error) {
    return safeError(res, error);
  }
};

/**
 * GET /api/host/intelligence/overview
 * Commission leak and headline tiles are free; forecast, win-back, benchmarks,
 * cohorts and moves are gated and are REMOVED from the payload, not hidden.
 */
const getOverview = async (req, res) => {
  try {
    const hostId = req.user.id;
    const rows = await hostBookings(hostId);
    const plan = await planOf(hostId);

    const full = buildOverview(rows, { now: Date.now() });
    const gated = await applyGate(plan, full);

    return res.json({ ...envelope(req.query.range), ...gated });
  } catch (error) {
    return safeError(res, error);
  }
};

// Pro-gated deep analytics: locked hosts get the envelope and nothing else.
const gatedBlock = (build) => async (req, res) => {
  try {
    const hostId = req.user.id;
    const rows = await hostBookings(hostId);
    const plan = await planOf(hostId);
    if (!(await hasInsights(plan))) return res.json({ ...envelope(req.query.range), locked: true });
    return res.json({ ...envelope(req.query.range), locked: false, ...build(rows) });
  } catch (error) {
    return safeError(res, error);
  }
};
const getAudience = gatedBlock(buildAudience);
const getDemand = gatedBlock(buildDemand);

module.exports = { getMoney, getOverview, getAudience, getDemand, hostBookings, planOf, BOOKING_COLUMNS };
