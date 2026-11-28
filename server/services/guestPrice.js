/**
 * guestPrice — what a guest pays for a catalog item, for the HOST's own lists.
 *
 * The Kept Catalog shows each item's price "incl. fees" (founder call,
 * 2026-11-26). That figure must come from the server and must match checkout,
 * so this file adds NO money maths of its own: it calls the same pricingEngine
 * functions, with the same inputs, as the code that charges the guest:
 *
 *   service  bookingController.createBooking — price_on_request books as a ₹0
 *            enquiry with no fee; under fee-only mode a ₹0 service still owes the
 *            booking fee (chargeFeeOnFree), except price-on-request.
 *   product  paymentController.createProductOrder / productController public read
 *   course   courseController.createCourseOrder
 *            — no platform fee at all since pricing v2 (the guest fee is a
 *              BOOKING fee); the guest pays the listed price.
 *
 * A coupon is applied per booking, so it is never in this figure. Display only:
 * nothing here is stored or charged. Best-effort: if config can't be read, the
 * rows go back untouched and the client shows the listed price alone.
 */
'use strict';

const { calculatePlatformFee, splitInclusiveFee, calculateCommission, round2 } = require('../lib/pricingEngine');
const { supabaseAdmin } = require('../config/supabase');
const platformConfig = require('./platformConfig');
const planService = require('./planService');
const { feeOnlyForHost } = require('./paidMode');

/** Pure. `price` + the GST-inclusive booking fee, as checkout computes it. */
function guestPrice(price, { platformFee, gstRate, chargeFeeOnFree = false } = {}) {
  const p = Math.max(0, Number(price) || 0);
  const { gross } = splitInclusiveFee(calculatePlatformFee(p, { platformFee, chargeFeeOnFree }), { gstRate });
  return { guest_total: round2(p + gross), booking_fee: gross };
}

/** Pure. A service row → its guest price under the host's mode. */
function serviceGuestPrice(svc, cfg, feeOnly) {
  const onRequest = svc?.price_on_request === true;
  return guestPrice(onRequest ? 0 : svc?.price, {
    platformFee: cfg.platformFee, gstRate: cfg.gstRate, chargeFeeOnFree: !!feeOnly && !onRequest,
  });
}

/**
 * Pure. What the host gets from one service booking ("You'll get ₹X" on the
 * Catalog card, founder call 2026-11-27): the price less Meeticulous's
 * commission at the host's plan rate, and nothing else. TDS/TCS and the gateway
 * fee are deliberately NOT in this figure. Price on request has no price yet.
 */
function serviceHostEarnings(svc, commissionPct) {
  if (svc?.price_on_request === true) return { host_earnings: null };
  const p = Math.max(0, Number(svc?.price) || 0);
  return { host_earnings: round2(p - calculateCommission(p, commissionPct)) };
}

/**
 * The host's commission %, read exactly as bookingController.createBooking reads
 * it: the plan resolveVendorPlan picks (an expired paid plan falls back to free),
 * then that plan's `appointments` rate (commission_rates, scalar fallback). Never
 * hard-coded. Shows the base rate (a plan's monthly band, if one is ever set, is
 * applied per booking at checkout and is not reflected in this display figure).
 */
async function hostCommissionPct(hostId) {
  const { data: host } = await supabaseAdmin
    .from('profiles').select('plan, plan_expires_at').eq('id', hostId).maybeSingle();
  return planService.getRate(planService.resolveVendorPlan(host || {}), 'appointments');
}

/**
 * Add guest_total + booking_fee to each row of a host's own list
 * (services also get host_earnings).
 * kind: 'service' | 'product' | 'course'.
 */
async function withGuestPrices(rows, kind, hostId) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];
  try {
    const cfg = await platformConfig.getConfig();
    const feeOnly = kind === 'service' ? await feeOnlyForHost(hostId) : false;
    // Best-effort on its own: a failed plan read drops only host_earnings, so the
    // card falls back to the listed price instead of losing the guest total too.
    const pct = kind === 'service' ? await hostCommissionPct(hostId).catch(() => null) : null;
    return rows.map((r) => ({
      ...r,
      ...(kind === 'service'
        ? { ...serviceGuestPrice(r, cfg, feeOnly), ...(pct === null ? {} : serviceHostEarnings(r, pct)) }
        // Products and courses carry no platform fee (pricing v2 §2.1 Change A).
        : guestPrice(r.price, { platformFee: 0, gstRate: cfg.gstRate })),
    }));
  } catch (_) {
    return rows;
  }
}

module.exports = { guestPrice, serviceGuestPrice, serviceHostEarnings, withGuestPrices };
