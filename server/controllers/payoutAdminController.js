'use strict';
/**
 * payoutAdminController.js — admin payout approval workflow.
 * Statuses: pending -> approved -> paid (terminal) | pending -> rejected.
 * approve = authorization only (no money/ledger). pay = records the payment
 * reference AND posts a SETTLEMENT journal entry (Vendor Payables -> Bank)
 * BEFORE flipping to paid, so a ledger failure leaves the row approved for an
 * idempotent retry. reject reuses admin_note for the reason.
 */
const { safeError } = require('../utils/httpError');
const { supabaseAdmin } = require('../config/supabase');
const { audit } = require('../services/auditService');
const { post } = require('../services/ledger/postingService');
const { payoutEntry } = require('../services/ledger/journalTemplates');
const { inAppNotify } = require('../utils/inAppNotify');
const { computeAllSettlementBalances } = require('../services/settlementService');
const platformConfig = require('../services/platformConfig');
const routeTransferService = require('../services/routeTransferService');
const payoutReconciler = require('../services/payoutReconciler');

const now = () => new Date().toISOString();

// Minimum available balance a host can withdraw (mirrors vendorController.requestPayout).
const MIN_WITHDRAWAL = 1;

const fetchPayout = async (id) => {
  const { data } = await supabaseAdmin.from('payout_requests').select('*').eq('id', id).maybeSingle();
  return data;
};

// GET /admin/payouts?status=
const listPayouts = async (req, res) => {
  try {
    const { status } = req.query || {};
    let q = supabaseAdmin
      .from('payout_requests')
      .select('*, profiles:host_id(name, username, email)')
      .order('created_at', { ascending: false });
    if (status && status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (e) { safeError(res, e); }
};

// POST /admin/payouts/:id/approve
const approvePayout = async (req, res) => {
  try {
    const p = await fetchPayout(req.params.id);
    if (!p) return res.status(404).json({ message: 'Payout request not found' });
    if (p.status !== 'pending') return res.status(409).json({ message: `Cannot approve a ${p.status} request` });
    const { data, error } = await supabaseAdmin.from('payout_requests')
      .update({ status: 'approved', approved_by: req.admin.id, approved_at: now(), updated_at: now() })
      .eq('id', p.id).eq('status', 'pending').select().single();
    if (error) return safeError(res, error);
    await audit(req, { action: 'payout.approve', resource_type: 'payout_request', resource_id: p.id, before: { status: p.status }, after: { status: 'approved' } });
    inAppNotify({ userId: p.host_id, role: 'host', type: 'PAYOUT_UPDATE', title: 'Payout approved', link: '/dashboard/payments/payouts' });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// POST /admin/payouts/:id/reject  { reason }
const rejectPayout = async (req, res) => {
  try {
    const reason = ((req.body && req.body.reason) || '').trim();
    if (!reason) return res.status(400).json({ message: 'A rejection reason is required' });
    const p = await fetchPayout(req.params.id);
    if (!p) return res.status(404).json({ message: 'Payout request not found' });
    if (p.status !== 'pending') return res.status(409).json({ message: `Cannot reject a ${p.status} request` });
    const { data, error } = await supabaseAdmin.from('payout_requests')
      .update({ status: 'rejected', admin_note: reason, rejected_at: now(), updated_at: now() })
      .eq('id', p.id).eq('status', 'pending').select().single();
    if (error) return safeError(res, error);
    await audit(req, { action: 'payout.reject', resource_type: 'payout_request', resource_id: p.id, before: { status: p.status }, after: { status: 'rejected', reason } });
    inAppNotify({ userId: p.host_id, role: 'host', type: 'PAYOUT_UPDATE', title: 'Payout rejected', link: '/dashboard/payments/payouts' });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// POST /admin/payouts/:id/pay  { payment_reference }
const markPayoutPaid = async (req, res) => {
  try {
    const reference = ((req.body && req.body.payment_reference) || '').trim();
    if (!reference) return res.status(400).json({ message: 'A payment reference is required' });
    const p = await fetchPayout(req.params.id);
    if (!p) return res.status(404).json({ message: 'Payout request not found' });
    if (p.status !== 'approved') return res.status(409).json({ message: `Cannot pay a ${p.status} request` });

    // Segregation of duties (security audit M-3): the admin who approved a payout
    // may not also release it. Prevents a single compromised/rogue admin (or one
    // holding both payouts.approve + payouts.release) from self-dealing a payout
    // to a colluding host in one session. A superadmin can re-approve under a
    // different account if a true single-operator release is ever required.
    if (p.approved_by && p.approved_by === req.admin.id) {
      return res.status(403).json({ message: 'A different admin must release a payout you approved.' });
    }

    // Post the ledger entry FIRST (throwing). If it fails, the row stays
    // approved and the admin can retry — idempotent on (SETTLEMENT, p.id).
    await post({
      sourceType: 'SETTLEMENT', sourceId: p.id,
      journalDate: now().slice(0, 10), createdBy: req.admin.id,
      template: payoutEntry({ host_id: p.host_id, amount: Number(p.amount), reference }),
    });

    const { data, error } = await supabaseAdmin.from('payout_requests')
      .update({ status: 'paid', payment_reference: reference, paid_by: req.admin.id, paid_at: now(), updated_at: now() })
      .eq('id', p.id).eq('status', 'approved').select().single();
    if (error) return safeError(res, error);
    await audit(req, { action: 'payout.pay', resource_type: 'payout_request', resource_id: p.id, before: { status: p.status }, after: { status: 'paid', reference } });
    inAppNotify({ userId: p.host_id, role: 'host', type: 'PAYOUT_UPDATE', title: 'Payout paid', link: '/dashboard/payments/payouts' });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// POST /admin/payouts/:id/pay-route
// Phase 1: release an approved payout via a Razorpay Route transfer-from-balance
// to the host's linked account (replaces the manual markPayoutPaid reference).
// The ledger entry + approved→paid flip happen when the transfer is 'processed'
// (synchronously here, or via the transfer.* webhook). Dormant behind fee_only_mode.
const releasePayoutViaRoute = async (req, res) => {
  try {
    const p = await fetchPayout(req.params.id);
    if (!p) return res.status(404).json({ message: 'Payout request not found' });
    if (p.status !== 'approved') return res.status(409).json({ message: `Cannot pay a ${p.status} request` });

    // Same segregation of duties as markPayoutPaid — approver ≠ releaser.
    if (p.approved_by && p.approved_by === req.admin.id) {
      return res.status(403).json({ message: 'A different admin must release a payout you approved.' });
    }

    const { feeOnlyMode } = await platformConfig.getConfig();
    if (feeOnlyMode) {
      return res.status(409).json({ message: 'Route payouts are not enabled yet (fee-only mode). Use manual release.' });
    }

    const result = await routeTransferService.releasePayout(p, { actorId: req.admin.id });
    if (!result.ok) {
      return res.status(422).json({ message: `Route transfer failed: ${result.error || result.skipped}` });
    }

    const updated = await fetchPayout(p.id);
    await audit(req, {
      action: 'payout.pay_route', resource_type: 'payout_request', resource_id: p.id,
      before: { status: p.status }, after: { status: updated?.status, transfer_id: result.transferId },
    });
    inAppNotify({
      userId: p.host_id, role: 'host', type: 'PAYOUT_UPDATE',
      title: updated?.status === 'paid' ? 'Payout paid' : 'Payout processing',
      link: '/dashboard/payments/payouts',
    });
    res.json(updated);
  } catch (e) { safeError(res, e); }
};

// GET /admin/payouts/clearing
// Platform-wide settlement visibility: every host with money in the pipeline that
// is NOT yet a payout request — clearing (maturing), pending-completion, or matured
// but below the ₹1 withdrawal minimum. Gives admins sight of funds owed before
// they ever enter the Pending payout queue.
const listClearing = async (req, res) => {
  try {
    const { clearingDays } = await platformConfig.getConfig();
    const balances = await computeAllSettlementBalances(clearingDays);

    // Keep only hosts that have money not-yet-withdrawable or below the minimum.
    // (available >= MIN is already actionable via the normal payout flow.)
    const relevant = [];
    for (const [hostId, b] of balances) {
      const notYetWithdrawable = b.clearing + b.pendingCompletion;
      const belowMin = b.available > 0 && b.available < MIN_WITHDRAWAL;
      if (notYetWithdrawable > 0 || belowMin) relevant.push({ hostId, ...b });
    }

    if (relevant.length === 0) return res.json({ threshold: MIN_WITHDRAWAL, hosts: [] });

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name, username')
      .in('id', relevant.map(r => r.hostId));
    const pMap = new Map((profiles || []).map(p => [p.id, p]));

    const hosts = relevant
      .map(r => ({
        host_id: r.hostId,
        name: pMap.get(r.hostId)?.name || null,
        username: pMap.get(r.hostId)?.username || null,
        clearing: r.clearing,
        pendingCompletion: r.pendingCompletion,
        available: r.available,
        inflight: r.inflight,
        // Eligible to request a payout once available reaches the minimum.
        eligible: r.available >= MIN_WITHDRAWAL,
      }))
      // Most money-in-clearing first.
      .sort((a, b) => (b.clearing + b.pendingCompletion) - (a.clearing + a.pendingCompletion));

    res.json({ threshold: MIN_WITHDRAWAL, hosts });
  } catch (e) { safeError(res, e); }
};

// POST /admin/payouts/reconcile — run the payout reconciler on demand. Free-tier
// Render sleeps its crons (setInterval is frozen while the service is idle), so the
// 15-min payout cron can lag; this forces a run so an admin never has to wait. Honors
// platform_settings.payout_reconciler_mode: 'off' no-ops, 'observe' scans + syncs the
// bank-settlement leg (no money), 'live' also creates/finalizes transfers. Returns the
// run summary. Gated on payouts.release (it can move money in 'live').
const runReconcile = async (req, res) => {
  try {
    const summary = await payoutReconciler.reconcile();
    await audit(req, { action: 'payout.reconcile_run', resource_type: 'payout_reconcile', resource_id: null, after: summary });
    res.json(summary);
  } catch (e) { safeError(res, e); }
};

module.exports = { listPayouts, approvePayout, rejectPayout, markPayoutPaid, releasePayoutViaRoute, listClearing, runReconcile };
