'use strict';
/**
 * gstExceptions.js — the GST action center (spec §4).
 *
 * Exceptions are COMPUTED on the fly from real data (never a stored count); the
 * gst_issue_status table is only an overlay that remembers the human resolution
 * state (open / under_review / resolved / ignored) keyed by
 * (issue_type, source_type, source_id). An unresolved computed issue with no
 * overlay row defaults to `open` — nothing ever disappears silently.
 *
 * detectRowIssues() is pure (unit-tested); buildIssues() adds the cross-table
 * checks (transaction-without-invoice, refund-without-credit-note) and the
 * status overlay.
 */

const { isValidGstin } = require('../stateService');
const { seller } = require('../../config/sellerIdentity');

const SEVERITY = { HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };

const num = (v) => Number(v) || 0;
const key = (issueType, sourceType, sourceId) => `${issueType}:${sourceType}:${sourceId}`;

/**
 * Pure per-invoice defect detection. Returns [] for a clean row.
 * `sellerStateCode` defaults to the configured seller state (Odisha 21).
 */
function detectRowIssues(row, sellerStateCode = seller.stateCode) {
  const issues = [];
  const add = (type, severity, message, amount = null) =>
    issues.push({ type, severity, message, amount, sourceType: 'invoice', sourceId: row.id, invoiceNumber: row.invoice_number });

  const cgst = num(row.cgst), sgst = num(row.sgst), igst = num(row.igst);
  const taxable = num(row.taxable_value), total = num(row.total);
  const pos = row.place_of_supply;

  if (row.buyer_gstin && !isValidGstin(row.buyer_gstin)) {
    add('INVALID_GSTIN', SEVERITY.HIGH, `Buyer GSTIN "${row.buyer_gstin}" is malformed`);
  }
  // A commission invoice bills the HOST; a missing GSTIN blocks the host's ITC.
  if (row.source_type === 'commission' && !row.buyer_gstin) {
    add('MISSING_GSTIN', SEVERITY.MEDIUM, 'Host commission invoice has no buyer GSTIN (blocks host ITC)');
  }
  const diff = Math.abs(total - (taxable + cgst + sgst + igst));
  if (diff > 0.05) {
    add('TAX_MISMATCH', SEVERITY.HIGH, `Total ₹${total} ≠ taxable+GST ₹${(taxable + cgst + sgst + igst).toFixed(2)}`, Math.round(diff * 100) / 100);
  }
  if (igst > 0 && (cgst > 0 || sgst > 0)) {
    add('HEAD_INCONSISTENCY', SEVERITY.HIGH, 'IGST present alongside CGST/SGST');
  }
  if (!pos) {
    add('MISSING_POS', SEVERITY.MEDIUM, 'No place of supply on the invoice');
  } else if (String(pos) === String(sellerStateCode) && igst > 0) {
    add('POS_HEAD_MISMATCH', SEVERITY.HIGH, 'Intra-state POS but IGST charged');
  } else if (pos && String(pos) !== String(sellerStateCode) && (cgst > 0 || sgst > 0)) {
    add('POS_HEAD_MISMATCH', SEVERITY.HIGH, 'Inter-state POS but CGST/SGST charged');
  }
  return issues;
}

// Roll a list of issues into the health/attention counters the overview shows.
function summarizeIssues(issues) {
  const out = { total: issues.length, high: 0, medium: 0, low: 0, byType: {} };
  for (const i of issues) {
    out[i.severity] = (out[i.severity] || 0) + 1;
    out.byType[i.type] = (out.byType[i.type] || 0) + 1;
  }
  return out;
}

/**
 * Full period scan: invoice-row defects + cross-table checks + status overlay.
 * Returns { issues, summary }. Each issue carries its resolution status.
 */
async function buildIssues({ from, to } = {}) {
  const { supabaseAdmin } = require('../../config/supabase');
  const { fetchInvoiceRows } = require('./gstEngine');

  const rows = await fetchInvoiceRows({ from, to });
  let issues = [];
  for (const r of rows) issues = issues.concat(detectRowIssues(r));

  // Refund-without-credit-note (gap G2): no credit_notes exist, so every refunded
  // booking in the period is flagged until the CA decides the treatment (§7).
  try {
    let rq = supabaseAdmin.from('bookings')
      .select('id, refunded_amount, paid_at')
      .gt('refunded_amount', 0);
    if (from) rq = rq.gte('paid_at', from);
    if (to) rq = rq.lt('paid_at', to);
    const { data: refunded } = await rq;
    for (const b of refunded || []) {
      issues.push({
        type: 'REFUND_NO_CREDIT_NOTE', severity: SEVERITY.MEDIUM,
        message: `Refund of ₹${num(b.refunded_amount)} has no GST credit note (treatment pending CA §7)`,
        amount: num(b.refunded_amount), sourceType: 'booking', sourceId: b.id,
      });
    }
  } catch (e) { console.error('[gstExceptions] refund scan failed (non-fatal):', e.message); }

  // Transaction-without-invoice: paid bookings/subscriptions with no invoice row
  // (generateInvoice is best-effort, so a captured payment can lack an invoice).
  try {
    const invoicedIds = new Set(rows.map((r) => `${r.source_type}:${r.source_id}`));
    let bq = supabaseAdmin.from('bookings').select('id, paid_at').eq('payment_status', 'paid');
    if (from) bq = bq.gte('paid_at', from);
    if (to) bq = bq.lt('paid_at', to);
    const { data: paidBookings } = await bq;
    for (const b of paidBookings || []) {
      if (!invoicedIds.has(`booking:${b.id}`) && !invoicedIds.has(`commission:${b.id}`)) {
        issues.push({
          type: 'TXN_WITHOUT_INVOICE', severity: SEVERITY.HIGH,
          message: 'Paid booking has no GST invoice row (needs backfill)',
          amount: null, sourceType: 'booking', sourceId: b.id,
        });
      }
    }
  } catch (e) { console.error('[gstExceptions] txn-without-invoice scan failed (non-fatal):', e.message); }

  // Overlay resolution status.
  let statusMap = new Map();
  try {
    const keys = issues.map((i) => key(i.type, i.sourceType, i.sourceId));
    if (keys.length) {
      const { data: statuses } = await supabaseAdmin
        .from('gst_issue_status')
        .select('issue_type, source_type, source_id, status, owner, note');
      statusMap = new Map((statuses || []).map((s) => [key(s.issue_type, s.source_type, s.source_id), s]));
    }
  } catch (e) { console.error('[gstExceptions] status overlay failed (non-fatal):', e.message); }

  const withStatus = issues.map((i) => {
    const s = statusMap.get(key(i.type, i.sourceType, i.sourceId));
    return { ...i, status: s?.status || 'open', owner: s?.owner || null, note: s?.note || null };
  });

  // "resolved"/"ignored" issues stay in the list (audit trail) but are not "open".
  const open = withStatus.filter((i) => i.status === 'open' || i.status === 'under_review');
  return { issues: withStatus, summary: summarizeIssues(open) };
}

module.exports = { SEVERITY, detectRowIssues, summarizeIssues, buildIssues, issueKey: key };
