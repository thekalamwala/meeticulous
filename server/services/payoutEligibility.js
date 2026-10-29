/**
 * payoutEligibility.js — the single source of truth for "can this host receive an
 * automatic Route payout right now?".
 *
 * Before this, three code paths each answered the question differently (booking
 * creation checked a KYC row with any PAN; manual payout checked kyc.status; the
 * transfer services checked only that a razorpay_account_id existed). None of them
 * checked whether the host's Route LINKED ACCOUNT is actually ACTIVATED — so a host
 * whose account sits at 'needs_clarification' / 'under_review' passed the gate and
 * every transfer to them was rejected by Razorpay and left owed with no retry.
 *
 * A Route transfer can only land when ALL of:
 *   • KYC approved                          (kyc_submissions.status = 'approved')
 *   • a linked account exists               (razorpay_account_id present)
 *   • Razorpay has ACTIVATED that account   (route_activation_status = 'activated')
 *
 * This gate is for the AUTOMATIC Route rail only. The manual payout-request rail may
 * still be settled out-of-band (markPayoutPaid), so it keeps its looser kyc-approved
 * gate — do NOT wire this in there.
 *
 * Fail-safe: any error, a missing row, or a missing column (v3.97 not applied on a
 * given DB) resolves to NOT eligible, so we never attempt a doomed transfer.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');

// Razorpay's Route product activation states (v3.97). Only 'activated' can receive.
const ACTIVATED = 'activated';

const isMissingColumn = (err) => {
  const msg = (err?.message || err?.details || '').toLowerCase();
  return err?.code === '42703' || /column .* does not exist|could not find the .* column/.test(msg);
};

/**
 * Read the host's Route/KYC state in one query.
 * @returns {Promise<{kycStatus:string|null, accountId:string|null, activation:string|null}>}
 */
async function getPayoutAccount(hostId) {
  if (!hostId) return { kycStatus: null, accountId: null, activation: null };
  let sel = 'status, razorpay_account_id, route_activation_status';
  let { data, error } = await supabaseAdmin
    .from('kyc_submissions').select(sel).eq('user_id', hostId).maybeSingle();
  if (error && isMissingColumn(error)) {
    // v3.97 not applied here — read what we can, treat activation as unknown (=> not eligible).
    ({ data } = await supabaseAdmin
      .from('kyc_submissions').select('status, razorpay_account_id').eq('user_id', hostId).maybeSingle());
    return { kycStatus: data?.status || null, accountId: data?.razorpay_account_id || null, activation: null };
  }
  if (error) throw new Error(`payoutEligibility: kyc read failed: ${error.message}`);
  return {
    kycStatus: data?.status || null,
    accountId: data?.razorpay_account_id || null,
    activation: data?.route_activation_status || null,
  };
}

/**
 * Is the host eligible for an automatic Route transfer?
 * @returns {Promise<{eligible:boolean, accountId:string|null, activation:string|null, reasons:string[]}>}
 *   reasons is empty when eligible; otherwise lists every failing condition
 *   ('kyc_not_approved' | 'no_linked_account' | 'not_activated').
 */
async function isPayoutEligible(hostId) {
  const { kycStatus, accountId, activation } = await getPayoutAccount(hostId);
  const reasons = [];
  if (kycStatus !== 'approved') reasons.push('kyc_not_approved');
  if (!accountId) reasons.push('no_linked_account');
  if (activation !== ACTIVATED) reasons.push('not_activated');
  return { eligible: reasons.length === 0, accountId, activation, reasons };
}

module.exports = { isPayoutEligible, getPayoutAccount, ACTIVATED };
