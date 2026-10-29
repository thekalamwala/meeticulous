/**
 * routeTransferService.js — Razorpay Route Phase 1: pay a host their approved
 * payout via a TRANSFER-FROM-BALANCE to their Route linked account.
 *
 * Trigger model: an admin approves a payout_request, then clicks "Pay via Route"
 * (payoutAdminController.releasePayoutViaRoute). This service creates the transfer
 * and records its id; the ledger entry + the approved→paid flip happen when the
 * transfer is confirmed 'processed' — either synchronously (Razorpay often returns
 * status 'processed' on the create response) or via the transfer.* webhook.
 *
 * Guardrails:
 *   • DORMANT while fee_only_mode is true (the safe default). No transfer is ever
 *     created while fee-only mode is on — mirrors routeAccountService.
 *   • Idempotent finalize — the SETTLEMENT ledger entry is keyed on (SETTLEMENT,
 *     payout_id) and the status flip is guarded on status='approved', so release +
 *     any number of webhook retries settle a payout exactly once.
 *   • Money-safe ordering — post the ledger entry FIRST (throwing); only then flip
 *     to paid. A ledger failure leaves the row approved + the transfer recorded, so
 *     a webhook retry completes it.
 *   • Schema-fallback — the v3.98 columns may not be applied yet; a missing column
 *     degrades to a logged no-op on the bookkeeping write, never a crash.
 */
'use strict';

const razorpayConfig = require('./razorpayConfig');
const { supabaseAdmin } = require('../config/supabase');
const { post } = require('./ledger/postingService');
const { payoutEntry } = require('./ledger/journalTemplates');
const { securityLog } = require('../utils/logger');

const now = () => new Date().toISOString();
const toPaise = (rupees) => Math.round(Number(rupees) * 100);

const isMissingColumn = (err) => {
  const msg = (err?.message || err?.details || '').toLowerCase();
  return err?.code === '42703' || /column .* does not exist|could not find the .* column/.test(msg);
};

// The host's Route linked account id lives on their approved KYC row.
async function getLinkedAccountId(hostId) {
  const { data } = await supabaseAdmin
    .from('kyc_submissions')
    .select('razorpay_account_id')
    .eq('user_id', hostId)
    .maybeSingle();
  return data?.razorpay_account_id || null;
}

// Patch payout_requests, swallowing a missing-column error (v3.98 not applied yet).
async function patchPayout(payoutId, patch, { guardApproved = false } = {}) {
  let q = supabaseAdmin.from('payout_requests').update({ ...patch, updated_at: now() }).eq('id', payoutId);
  if (guardApproved) q = q.eq('status', 'approved');
  const { data, error } = await q.select().maybeSingle();
  if (error) {
    if (isMissingColumn(error)) {
      securityLog('route_transfer_schema_fallback', { payoutId, reason: 'v3.98 columns missing' });
      return null;
    }
    throw error;
  }
  return data;
}

/**
 * Finalize a processed transfer: post the SETTLEMENT ledger entry, then flip the
 * payout to paid. Idempotent — safe to call from release AND every webhook retry.
 * @returns {Promise<{ finalized: boolean }>}
 */
async function finalizeProcessedTransfer(payout, transferId, createdBy) {
  // Ledger FIRST (throws on failure) — idempotent on (SETTLEMENT, payout.id).
  await post({
    sourceType: 'SETTLEMENT', sourceId: payout.id,
    journalDate: now().slice(0, 10), createdBy: createdBy || payout.approved_by || null,
    template: payoutEntry({ host_id: payout.host_id, amount: Number(payout.amount), reference: transferId }),
  });
  // Then flip approved→paid. Guard on status so concurrent webhooks flip once.
  await patchPayout(payout.id, {
    status: 'paid', payment_reference: transferId, paid_by: createdBy || payout.paid_by || null,
    paid_at: now(), transfer_status: 'processed', transfer_error: null,
  }, { guardApproved: true });
  return { finalized: true };
}

/**
 * Create a Route transfer for an approved payout_request.
 * @param {object} payout  the payout_requests row (must be 'approved').
 * @param {object} [opts]  { actorId } — the admin releasing it (ledger createdBy).
 * @returns {Promise<{ ok, transferId?, status?, skipped?, error? }>}
 */
async function releasePayout(payout, { actorId } = {}) {
  try {
    if (!payout || !payout.id) return { ok: false, error: 'no_payout' };
    if (payout.status !== 'approved') return { ok: false, error: `cannot pay a ${payout.status} request` };
    if (payout.razorpay_transfer_id) return { ok: true, transferId: payout.razorpay_transfer_id, skipped: 'already_transferred' };

    // Dormant until payout go-live (per-host: a paid-enabled pilot host is live).
    if (await require('./paidMode').feeOnlyForHost(payout.host_id)) return { ok: false, skipped: 'fee_only_mode' };
    if (!(await razorpayConfig.isConfigured())) return { ok: false, error: 'razorpay_unconfigured' };

    const accountId = await getLinkedAccountId(payout.host_id);
    if (!accountId) return { ok: false, error: 'host_has_no_linked_account' };

    const amountPaise = toPaise(payout.amount);
    if (!Number.isFinite(amountPaise) || amountPaise <= 0) return { ok: false, error: 'invalid_amount' };

    const razorpay = await razorpayConfig.getClient();
    const transfer = await razorpay.transfers.create({
      account: accountId,
      amount: amountPaise,
      currency: 'INR',
      notes: { payout_request_id: String(payout.id), host_id: String(payout.host_id) },
    });
    const transferId = transfer?.id;
    if (!transferId) throw new Error('Razorpay transfer create returned no id');

    await patchPayout(payout.id, { razorpay_transfer_id: transferId, transfer_status: transfer.status || 'pending', transfer_error: null });

    // Razorpay frequently returns 'processed' synchronously; finalize now if so.
    // Otherwise the transfer.* webhook completes it.
    if (transfer.status === 'processed') {
      await finalizeProcessedTransfer(payout, transferId, actorId);
    }
    return { ok: true, transferId, status: transfer.status || 'pending' };
  } catch (err) {
    const reason = err?.error?.description || err?.message || 'unknown error';
    securityLog('route_transfer_error', { payoutId: payout?.id, reason });
    try { await patchPayout(payout.id, { transfer_status: 'failed', transfer_error: reason.slice(0, 500) }); } catch (_) { /* logged */ }
    return { ok: false, error: reason };
  }
}

/**
 * Apply a Route transfer.* webhook (transfer.processed / transfer.failed /
 * transfer.reversed). Finds the payout by transfer id and finalizes or marks it.
 * @param {object} transfer  event.payload.transfer.entity
 * @returns {Promise<{ handled: boolean, reason?: string }>}
 */
async function handleTransferWebhook(transfer) {
  const transferId = transfer?.id;
  if (!transferId) return { handled: false, reason: 'no_transfer_id' };

  const { data: payout } = await supabaseAdmin
    .from('payout_requests').select('*').eq('razorpay_transfer_id', transferId).maybeSingle();
  if (!payout) return { handled: false, reason: 'payout_not_found' };

  const status = transfer.status; // processed | failed | reversed | pending
  if (status === 'processed') {
    if (payout.status === 'paid') return { handled: true, reason: 'already_paid' };
    await finalizeProcessedTransfer(payout, transferId, null);
    return { handled: true };
  }
  if (status === 'failed' || status === 'reversed') {
    await patchPayout(payout.id, {
      transfer_status: status,
      transfer_error: transfer.error?.description || transfer.status_details?.reason || status,
    });
    return { handled: true };
  }
  return { handled: true, reason: `ignored_status_${status || 'none'}` };
}

module.exports = { releasePayout, handleTransferWebhook, finalizeProcessedTransfer, toPaise };
