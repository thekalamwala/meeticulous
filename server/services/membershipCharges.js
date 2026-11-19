'use strict';
/**
 * membershipCharges.js — the record of membership money.
 *
 * Before this, a membership charge left no trace: the webhook moved
 * current_period_end forward and threw the payment entity away. Razorpay billed
 * the member monthly and we held no amount, no payment id, no commission, no
 * withholding — so membership revenue was invisible to the payout rail, the
 * settlement balance, and the TDS/TCS and GST reports, all of which read rows.
 *
 * This writes that row. It does NOT move money: payout is the next slice, and it
 * needs this record to exist before it can attach a Route transfer to anything.
 *
 * Two rules it must not break:
 *   IDEMPOTENT — Razorpay redelivers webhooks and the reconciler replays them.
 *     One payment is one row, enforced by a unique index, not by hope. A duplicate
 *     row would later become a duplicate payout.
 *   NEVER BLOCKING — entitlement is what the member paid for. If bookkeeping fails
 *     (missing table, bad config), it is logged and swallowed: the member keeps the
 *     access they bought and we reconcile the record later.
 *
 * Money math comes from lib/pricingEngine — the same engine bookings use — so the
 * same host gets the same commission and withholding whichever way they earned.
 * A membership adds no platform fee on top (the tier price IS what Razorpay bills),
 * so platformFee is 0 here and customer_total equals the amount charged.
 */

const { supabaseAdmin } = require('../config/supabase');
const { computeBreakdown, resolveWithholding } = require('../lib/pricingEngine');
const platformConfig = require('./platformConfig');
const planService = require('./planService');
const featureFlags = require('./featureFlags');
const { securityLog } = require('../utils/logger');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const paiseToRupees = (p) => round2((Number(p) || 0) / 100);

// Same schema-fallback convention as membershipController: until v3.225 is applied,
// writes degrade to a logged no-op rather than failing the webhook.
const MISSING_TABLE_RE = /relation .* does not exist|Could not find the table|schema cache/i;
const isMissingTable = (err) => err && MISSING_TABLE_RE.test(err.message || '');
const isUniqueViolation = (err) => err
  && (err.code === '23505' || /duplicate key|unique constraint/i.test(err.message || ''));

/**
 * The host's tax position, as the withholding engine wants it. Fails safe in the
 * same direction bookings do: an unreadable host is treated as having no PAN
 * exemption evidence, so we withhold rather than quietly not withholding.
 */
async function loadHostTaxContext(hostId) {
  const { data: host } = await supabaseAdmin
    .from('profiles')
    .select('id, plan, plan_expires_at, host_entity_type, billing_details')
    .eq('id', hostId).maybeSingle();

  const { data: panRow } = await supabaseAdmin
    .from('kyc_submissions')
    .select('user_id').eq('user_id', hostId).not('pan_number', 'is', null).maybeSingle();

  return { host: host || null, hasPan: !!panRow };
}

/**
 * Turn an amount actually charged into the full money snapshot for one charge.
 *
 * @param {object} p
 * @param {string} p.hostId
 * @param {number} p.grossInr          what the member paid (the tier price, or the
 *                                     prorated difference on an upgrade)
 * @param {number} [p.razorpayFeeInr]  actual gateway fee, host-borne
 * @param {number} [p.razorpayTaxInr]  GST on that fee
 */
async function buildChargeSnapshot({ hostId, grossInr, razorpayFeeInr = 0, razorpayTaxInr = 0 }) {
  const cfg = await platformConfig.getConfig();
  const { host, hasPan } = await loadHostTaxContext(hostId);

  // Commission % follows the host's own plan, exactly as a booking does. An expired
  // paid plan falls back to free — resolveVendorPlan owns that judgement.
  const planSlug = planService.resolveVendorPlan(host || {});
  const planRecord = await planService.getPlan(planSlug);
  const commissionPct = Number(planRecord?.commission_percentage) || 0;

  const withholdingEnabled = await featureFlags.isFeatureEnabled('tds_tcs_v2');
  const { tdsRate, tcsRate } = resolveWithholding({
    enabled: withholdingEnabled,
    entityType: host?.host_entity_type,
    hasPan,
    hasGstin: !!(host?.billing_details?.gstin),
    fyGrossToDate: null, // same as bookings: no FY tally yet, so it fails safe
    config: cfg,
  });

  const pricing = computeBreakdown({
    servicePrice: round2(grossInr),
    commissionPercentage: commissionPct,
    platformFee: 0,          // a tier price carries no fee on top
    gstRate: cfg.gstRate,
    razorpayFee: round2(razorpayFeeInr),
    tdsRate,
    tcsRate,
  });

  return {
    customer_total: round2(grossInr),
    platform_fee_amount: 0,
    platform_fee_gst: 0,
    commission_applied: pricing.commission,
    commission_gst: pricing.commissionGst,
    commission_taxable: pricing.commissionTaxable,
    commission_percentage: commissionPct,
    razorpay_fee_actual: round2(razorpayFeeInr),
    razorpay_tax_actual: round2(razorpayTaxInr),
    tds_amount: pricing.tds,
    tcs_amount: pricing.tcs,
    gst_rate: cfg.gstRate,
    vendor_amount: pricing.vendorPayout,
    host_plan_type: planSlug,
  };
}

/** Insert, treating "already there" as success — the unique index is the guard. */
async function insertCharge(row, context) {
  const { data, error } = await supabaseAdmin
    .from('membership_charges').insert(row).select('id').single();
  if (!error) return { recorded: true, id: data?.id || null };

  if (isUniqueViolation(error)) return { recorded: false, duplicate: true };
  if (isMissingTable(error)) {
    securityLog('membership_charge_schema_fallback', context);
    return { recorded: false, reason: 'missing_table' };
  }
  throw error;
}

/**
 * Record one recurring membership charge, from the signature-verified webhook.
 * `rzpPayment` is the payment entity Razorpay sends with subscription.charged —
 * it is where the real gateway fee comes from.
 */
async function recordSubscriptionCharge({ rzpSub, rzpPayment, subscriptionRow }) {
  try {
    const notes = rzpSub?.notes || {};
    if (!notes.host_id || !notes.member_id) return { recorded: false, reason: 'missing notes' };
    // subscription.activated carries no payment: nothing was charged, so there is
    // no money to record. The charge event that follows is the one that counts.
    if (!rzpPayment?.id) return { recorded: false, reason: 'no payment entity' };

    const grossInr = paiseToRupees(rzpPayment.amount);
    if (!(grossInr > 0)) return { recorded: false, reason: 'zero amount' };

    const snapshot = await buildChargeSnapshot({
      hostId: notes.host_id,
      grossInr,
      razorpayFeeInr: paiseToRupees(rzpPayment.fee),
      razorpayTaxInr: paiseToRupees(rzpPayment.tax),
    });

    return await insertCharge({
      member_id: notes.member_id, host_id: notes.host_id, tier_id: notes.tier_id || null,
      subscription_row_id: subscriptionRow?.id || null,
      kind: 'subscription',
      razorpay_subscription_id: rzpSub.id,
      razorpay_payment_id: rzpPayment.id,
      payment_status: 'paid',
      paid_at: rzpPayment.created_at ? new Date(rzpPayment.created_at * 1000).toISOString() : new Date().toISOString(),
      ...snapshot,
    }, { subscription_id: rzpSub?.id, payment_id: rzpPayment?.id });
  } catch (err) {
    // Bookkeeping must never cost the member the access they paid for.
    securityLog('membership_charge_record_failed', {
      subscription_id: rzpSub?.id, payment_id: rzpPayment?.id, error: err.message,
    });
    return { recorded: false, error: err.message };
  }
}

/**
 * Record the one-time prorated difference a member pays to move up a tier.
 * Keyed on the order id, which is minted once per upgrade attempt.
 */
async function recordUpgradeCharge({ notes, orderId, paymentId, amountInr, subscriptionRow }) {
  try {
    if (!notes?.host_id || !notes?.member_id) return { recorded: false, reason: 'missing notes' };
    const grossInr = round2(amountInr);
    if (!(grossInr > 0)) return { recorded: false, reason: 'zero amount' };

    // The gateway fee for a one-time order is not in hand at verify time (it lands
    // on the payment entity shortly after capture). Record the charge now so the
    // money is on the books; the payout slice reads the actual fee before it
    // transfers, the same way bookings finalise theirs at capture.
    const snapshot = await buildChargeSnapshot({ hostId: notes.host_id, grossInr });

    return await insertCharge({
      member_id: notes.member_id, host_id: notes.host_id, tier_id: notes.tier_id || null,
      subscription_row_id: subscriptionRow?.id || null,
      kind: 'upgrade',
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId || null,
      payment_status: 'paid',
      paid_at: new Date().toISOString(),
      ...snapshot,
    }, { order_id: orderId, payment_id: paymentId });
  } catch (err) {
    securityLog('membership_upgrade_charge_record_failed', { order_id: orderId, error: err.message });
    return { recorded: false, error: err.message };
  }
}

module.exports = { recordSubscriptionCharge, recordUpgradeCharge, buildChargeSnapshot };
