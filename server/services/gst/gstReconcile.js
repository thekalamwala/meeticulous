'use strict';
/**
 * gstReconcile.js — internal reconciliation (gap G5): the invoices table (GST
 * legal record, source of truth) vs the ledger's GST Payable control account
 * (2100). They are computed independently from the same snapshot and nothing
 * cross-checks them today, so drift is invisible. This surfaces the delta per
 * period as an exception the finance team can act on.
 *
 * The framework is also the hook for a FUTURE external source (GST portal / GSP /
 * accounting software): `external` is null now, and the shape (ours/external/
 * difference/reason) is ready to carry imported figures. No external integration
 * is built (spec §7 "do not invent an external integration").
 */

const { round2 } = require('../../lib/pricingEngine');
const { summarize } = require('./gstEngine');

const GST_PAYABLE_CODE = '2100';

// Net movement on GST Payable (a LIABILITY) in [from,to): credits raise it (a
// sale), debits lower it (a refund reversal). Net = credits − debits.
async function ledgerGstMovement({ from, to } = {}) {
  const { supabaseAdmin } = require('../../config/supabase');
  const { data: acct } = await supabaseAdmin
    .from('chart_of_accounts').select('id').eq('code', GST_PAYABLE_CODE).single();
  if (!acct) return { movement: 0, found: false };

  let q = supabaseAdmin.from('ledger_entries').select('debit, credit, created_at').eq('account_id', acct.id);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lt('created_at', to);
  const { data, error } = await q;
  if (error) throw error;
  let credit = 0, debit = 0;
  for (const e of data || []) { credit += Number(e.credit) || 0; debit += Number(e.debit) || 0; }
  return { movement: round2(credit - debit), credit: round2(credit), debit: round2(debit), found: true };
}

/**
 * Reconcile invoice GST total vs ledger GST movement for a period.
 * NOTE: ledger includes refund reversals (GST debited back) while invoices are
 * never credit-noted (gap G2), so a period with refunds is EXPECTED to show
 * ledger < invoices by the refunded GST — surfaced as the `reason`, not a bug.
 */
async function reconcile({ from, to } = {}) {
  const { fetchInvoiceRows } = require('./gstEngine');
  const rows = await fetchInvoiceRows({ from, to });
  const ours = summarize(rows).totalGst;
  const ledger = await ledgerGstMovement({ from, to });

  const difference = round2(ours - ledger.movement);
  const matched = Math.abs(difference) <= 0.05;
  let reason = null;
  if (!matched) {
    reason = difference > 0
      ? 'Invoices exceed ledger GST — likely refunds reversed in the ledger but not credit-noted (G2), or unposted invoices.'
      : 'Ledger GST exceeds invoices — likely a posted transaction with no invoice row (backfill), or a manual GST journal.';
  }

  return {
    ours: { gst: ours, invoices: rows.length },
    ledger: { gst: ledger.movement, credit: ledger.credit, debit: ledger.debit, found: ledger.found },
    external: null, // hook for a future GST-portal/GSP import
    difference,
    status: matched ? 'matched' : 'mismatch',
    reason,
  };
}

module.exports = { reconcile, ledgerGstMovement, GST_PAYABLE_CODE };
