/**
 * financeAdminController.js — P1 ledger admin API.
 * Reads: summary metrics, chart of accounts, journal browser, per-account ledger.
 * Writes: manual journal entries ONLY (adjustment / reversal / bank transfer)
 * via postingService → RPC. No direct table writes, ever (immutability).
 */
'use strict';

const crypto = require('crypto');
const { safeError } = require('../utils/httpError');
const { supabaseAdmin } = require('../config/supabase');
const { audit } = require('../services/auditService');
const { adjustmentEntry, reversalEntry, bankTransferEntry } = require('../services/ledger/journalTemplates');
const { post } = require('../services/ledger/postingService');
const { recordBookingRefund } = require('../services/bookingCapture');
const { issueBookingRefund } = require('../services/refundService');

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const PAGE_LIMIT = 25;

// ── GET /admin/finance/summary ────────────────────────────────
const getSummary = async (req, res) => {
  try {
    const { data: balanceRows, error } = await supabaseAdmin
      .from('account_balances')
      .select('balance, chart_of_accounts(code, name, type)');
    if (error) return safeError(res, error);

    const balances = {};
    for (const row of balanceRows || []) {
      const acct = row.chart_of_accounts;
      if (acct) balances[acct.code] = { name: acct.name, type: acct.type, balance: Number(row.balance) };
    }
    const bal = (code) => balances[code]?.balance || 0;

    // Gross collection + order-gateway-charge metrics from snapshot rows.
    // PostgREST `.sum()` aggregate selects are fragile across versions, so we
    // fetch the columns and reduce in JS.
    // TODO(P4): move aggregation to an indexed SQL view.
    const { data: orderRows } = await supabaseAdmin
      .from('bookings')
      .select('customer_total, razorpay_fee_actual, razorpay_tax_actual')
      .eq('payment_status', 'paid');
    const { data: subRows } = await supabaseAdmin
      .from('subscription_payments')
      .select('total_charged')
      .eq('status', 'paid');

    let orderCollections = 0;
    let rzpChargesOrders = 0;
    for (const o of orderRows || []) {
      orderCollections += Number(o.customer_total || 0);
      rzpChargesOrders += Number(o.razorpay_fee_actual || 0) + Number(o.razorpay_tax_actual || 0);
    }
    let subCollections = 0;
    for (const s of subRows || []) subCollections += Number(s.total_charged || 0);

    // Order gateway charges are vendor-borne (account 5000 nets 0), so they are
    // excluded from net revenue; only subscription/settlement/refund losses bite.
    const netRevenue = round2(
      bal('4000') + bal('4100') + bal('4200')
      - bal('5100') - bal('5200') - bal('5300'),
    );
    const availableCash = round2(bal('1000') - bal('2000') - bal('2100'));

    res.json({
      balances,
      metrics: {
        gross_collections: round2(orderCollections + subCollections),
        outstanding_vendor_payables: bal('2000'),
        platform_fee_revenue: bal('4000'),
        commission_revenue: bal('4100'),
        subscription_revenue: bal('4200'),
        gst_liability: bal('2100'),
        razorpay_charges_orders: round2(rzpChargesOrders),
        razorpay_charges_subscriptions: bal('5100'),
        net_revenue: netRevenue,
        available_business_cash: availableCash,
        razorpay_receivable: bal('1100'),
        bank_balance: bal('1000'),
      },
    });
  } catch (e) {
    safeError(res, e);
  }
};

// ── GET /admin/finance/accounts ───────────────────────────────
const getAccounts = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('chart_of_accounts')
      .select('id, code, name, type, active, account_balances(balance)')
      .order('code');
    if (error) return safeError(res, error);
    res.json({ accounts: data || [] });
  } catch (e) {
    safeError(res, e);
  }
};

// ── GET /admin/finance/journals ───────────────────────────────
const listJournals = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    let q = supabaseAdmin
      .from('journal_entries')
      .select('id, journal_number, journal_date, source_type, source_id, description, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT - 1);
    if (req.query.source_type) q = q.eq('source_type', req.query.source_type);
    if (req.query.from) q = q.gte('journal_date', req.query.from);
    if (req.query.to) q = q.lte('journal_date', req.query.to);
    const { data, error, count } = await q;
    if (error) return safeError(res, error);
    res.json({ journals: data || [], total: count || 0, page, limit: PAGE_LIMIT });
  } catch (e) {
    safeError(res, e);
  }
};

// ── GET /admin/finance/journals/:id ───────────────────────────
const getJournal = async (req, res) => {
  try {
    const { data: entry, error } = await supabaseAdmin
      .from('journal_entries').select('*').eq('id', req.params.id).single();
    if (error || !entry) return res.status(404).json({ message: 'Journal entry not found' });
    const { data: lines } = await supabaseAdmin
      .from('journal_lines')
      .select('id, debit, credit, vendor_id, order_item_id, subscription_payment_id, chart_of_accounts(code, name, type)')
      .eq('journal_entry_id', entry.id)
      .order('created_at');
    res.json({ entry, lines: lines || [] });
  } catch (e) {
    safeError(res, e);
  }
};

// ── GET /admin/finance/ledger/:accountId ──────────────────────
const getLedger = async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const { data, error, count } = await supabaseAdmin
      .from('ledger_entries')
      .select('id, created_at, ledger_type, debit, credit, balance_after_account, vendor_id, order_item_id, journal_entries(journal_number, description, source_type)', { count: 'exact' })
      .eq('account_id', req.params.accountId)
      .order('created_at', { ascending: false })
      .range((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT - 1);
    if (error) return safeError(res, error);
    res.json({ entries: data || [], total: count || 0, page, limit: PAGE_LIMIT });
  } catch (e) {
    safeError(res, e);
  }
};

// ── Manual entry validation ───────────────────────────────────
const validateLines = (lines) => {
  if (!Array.isArray(lines) || lines.length < 2) return 'At least 2 lines required';
  let d = 0, c = 0;
  for (const l of lines) {
    const debit = Number(l.debit) || 0, credit = Number(l.credit) || 0;
    if (debit < 0 || credit < 0) return 'Amounts cannot be negative';
    if ((debit > 0) === (credit > 0)) return 'Each line needs exactly one of debit/credit';
    if (!l.account_code) return 'Each line needs an account_code';
    d += debit; c += credit;
  }
  if (round2(d) !== round2(c)) return `Lines do not balance (debits ₹${round2(d)} vs credits ₹${round2(c)})`;
  return null;
};

// ── POST /admin/finance/adjustment ────────────────────────────
const postAdjustment = async (req, res) => {
  try {
    const { description, lines } = req.body || {};
    const invalid = validateLines(lines);
    if (invalid) return res.status(400).json({ message: invalid });
    const sourceId = crypto.randomUUID();
    const entryId = await post({
      sourceType: 'ADJUSTMENT', sourceId, createdBy: req.admin?.id || null,
      template: adjustmentEntry({ description, lines }),
    });
    await audit(req, {
      action: 'FINANCE_ADJUSTMENT_POSTED',
      resource_type: 'journal_entry',
      resource_id: entryId,
      after: { description: description || 'Manual adjustment' },
    });
    res.json({ id: entryId });
  } catch (e) {
    safeError(res, e);
  }
};

// ── POST /admin/finance/reversal ──────────────────────────────
const postReversal = async (req, res) => {
  try {
    const { journal_entry_id } = req.body || {};
    if (!journal_entry_id) return res.status(400).json({ message: 'journal_entry_id is required' });
    const { data: entry } = await supabaseAdmin
      .from('journal_entries').select('id, journal_number').eq('id', journal_entry_id).single();
    if (!entry) return res.status(404).json({ message: 'Journal entry not found' });
    const { data: lines } = await supabaseAdmin
      .from('journal_lines')
      .select('debit, credit, vendor_id, order_item_id, subscription_payment_id, chart_of_accounts(code)')
      .eq('journal_entry_id', entry.id);
    const flat = (lines || []).map((l) => ({
      account_code: l.chart_of_accounts.code,
      debit: Number(l.debit), credit: Number(l.credit),
      vendor_id: l.vendor_id, order_item_id: l.order_item_id,
      subscription_payment_id: l.subscription_payment_id,
    }));
    const entryId = await post({
      sourceType: 'REVERSAL', sourceId: entry.id, createdBy: req.admin?.id || null,
      template: reversalEntry({ journal_number: entry.journal_number, lines: flat }),
    });
    await audit(req, {
      action: 'FINANCE_REVERSAL_POSTED',
      resource_type: 'journal_entry',
      resource_id: entryId,
      after: { reversed: entry.journal_number },
    });
    res.json({ id: entryId });
  } catch (e) {
    safeError(res, e);
  }
};

// ── POST /admin/finance/bank-transfer ─────────────────────────
const postBankTransfer = async (req, res) => {
  try {
    const amount = Number(req.body?.amount);
    const reference = (req.body?.reference || '').trim();
    if (!(amount > 0)) return res.status(400).json({ message: 'amount must be > 0' });
    const sourceId = crypto.randomUUID();
    const entryId = await post({
      sourceType: 'BANK_TRANSFER', sourceId, createdBy: req.admin?.id || null,
      template: bankTransferEntry({ amount, reference }),
    });
    await audit(req, {
      action: 'FINANCE_BANK_TRANSFER_POSTED',
      resource_type: 'journal_entry',
      resource_id: entryId,
      after: { amount, reference },
    });
    res.json({ id: entryId });
  } catch (e) {
    safeError(res, e);
  }
};

// ── POST /admin/finance/refund ────────────────────────────────
// Manually record a refund that was issued in the Razorpay dashboard (or where
// the refund.processed webhook was missed). Posts the balanced REFUND entry from
// the booking's snapshot (same waterfall as the webhook) and, unless opted out,
// reverses the held Route payout so a refunded booking never also pays the host.
// Idempotent on `reference` (a Razorpay refund id, or any admin-chosen key).
const postRefund = async (req, res) => {
  try {
    const bookingId = (req.body?.booking_id || '').trim();
    const amount = Number(req.body?.amount);
    const reference = (req.body?.reference || '').trim();
    const reverseTransfer = req.body?.reverse_payout !== false; // default on
    if (!bookingId) return res.status(400).json({ message: 'booking_id is required' });
    if (!(amount > 0)) return res.status(400).json({ message: 'amount must be > 0' });

    const r = await recordBookingRefund({
      bookingId,
      refundAmount: amount,
      refundId: reference || crypto.randomUUID(),  // dedupe on a real refund id; else one-shot
      reason: `manual admin refund${reference ? ` (${reference})` : ''}`,
      reverseTransfer,
    });
    if (!r.posted) {
      const msg = r.reason === 'booking_not_found' ? 'No booking with that id' : (r.reason || 'Could not record refund');
      return res.status(r.reason === 'booking_not_found' ? 404 : 400).json({ message: msg });
    }
    await audit(req, {
      action: 'FINANCE_REFUND_RECORDED',
      resource_type: 'booking',
      resource_id: bookingId,
      after: { amount, reference: reference || null, transfer_reversed: r.transferReversed },
    });
    res.json({ ok: true, transfer_reversed: r.transferReversed });
  } catch (e) {
    safeError(res, e);
  }
};

// ── POST /admin/finance/refund/execute ────────────────────────
// EXECUTE a real Razorpay refund (postRefund above only RECORDS a manual one),
// then post the ledger REFUND + reverse the held payout via recordBookingRefund.
//   mode 'tiered' — guest-initiated policy (Refund §1): refund the SERVICE PRICE
//                   scaled by time-to-start (≥24h 100%, 6–24h 50%, <6h/no-show 0);
//                   platform fee + GST + PG fee are non-refundable.
//   mode 'full'   — our/host fault (Refund §3): refund the entire customer_total.
// Never absorb: if the host's Route payout is already SETTLED (transfer_status
// 'processed'), the refund is BLOCKED — recover from the host first. A held payout
// is reversed by recordBookingRefund.
const executeRefund = async (req, res) => {
  try {
    const bookingId = (req.body?.booking_id || '').trim();
    const mode = req.body?.mode === 'full' ? 'full' : 'tiered';
    if (!bookingId) return res.status(400).json({ message: 'booking_id is required' });

    // The whole refund (guard → amount → Razorpay → ledger + transfer reversal →
    // booking-row reflection) lives in the shared issuer so the admin action and
    // the auto-refund-on-cancel path can't drift. This endpoint only maps the
    // result to admin-facing HTTP + writes the audit trail.
    const r = await issueBookingRefund({ bookingId, mode, reason: `admin ${mode} refund`, actorEmail: req.admin?.email });

    if (!r.ok) {
      if (r.reason === 'booking_not_found') return res.status(404).json({ message: 'No booking with that id' });
      if (r.reason === 'not_paid') return res.status(400).json({ message: 'Booking is not paid — nothing to refund' });
      if (r.reason === 'no_payment') return res.status(400).json({ message: 'Booking has no captured payment to refund' });
      if (r.blocked === 'payout_settled') {
        await audit(req, { action: 'FINANCE_REFUND_BLOCKED', resource_type: 'booking', resource_id: bookingId, after: { reason: 'payout_settled' } });
        return res.status(409).json({ message: 'Host already paid out for this booking. Recover the payout from the host before refunding.' });
      }
      if (r.reason === 'already_refunded') {
        return res.status(409).json({ message: `This payment was already refunded${r.amount ? ` (₹${r.amount})` : ''}. Use the Razorpay dashboard for any further refund.` });
      }
      if (r.reason === 'not_eligible') return res.status(400).json({ message: 'Not eligible: inside the no-refund window (under 6 hours to start), or a free booking.' });
      return res.status(500).json({ message: 'Refund failed. Check the Razorpay dashboard before retrying.' });
    }

    await audit(req, {
      action: 'FINANCE_REFUND_EXECUTED',
      resource_type: 'booking',
      resource_id: bookingId,
      after: { mode, amount: r.amount, refund_id: r.refundId, transfer_reversed: r.transferReversed, ledger_posted: r.ledgerPosted },
    });

    res.json({ ok: true, refund_id: r.refundId, amount: r.amount, transfer_reversed: r.transferReversed, payment_status: r.paymentStatus });
  } catch (e) {
    safeError(res, e);
  }
};

// ── POST /admin/finance/resend-subscription-receipt ───────────
// Re-send a host's subscription receipt email (amount + GST invoice PDF link)
// for one charge, by razorpay payment id. Mints the invoice first if missing.
// Delivery truth is email_logs — a 200 means "attempted", not "delivered".
const resendSubscriptionReceipt = async (req, res) => {
  try {
    const { payment_id } = req.body || {};
    if (!payment_id) return res.status(400).json({ message: 'payment_id is required' });
    const r = await require('../services/subscriptionService').resendReceiptForPayment(payment_id);
    if (!r.ok) return res.status(404).json({ message: r.reason || 'Could not resend receipt' });
    await audit(req, {
      action: 'SUBSCRIPTION_RECEIPT_RESENT',
      resource_type: 'subscription_payment',
      resource_id: payment_id,
      after: { event: r.event, vendor_id: r.vendorId },
    });
    res.json({ ok: true, event: r.event, vendor_id: r.vendorId });
  } catch (e) {
    safeError(res, e);
  }
};

module.exports = {
  getSummary, getAccounts, listJournals, getJournal, getLedger,
  postAdjustment, postReversal, postBankTransfer, postRefund, executeRefund,
  resendSubscriptionReceipt,
};
