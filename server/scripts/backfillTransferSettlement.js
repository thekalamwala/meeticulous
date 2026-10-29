'use strict';
/**
 * backfillTransferSettlement.js — one-shot: record the bank-settlement leg (v3.124)
 * for transfers that were already 'processed' before settlement tracking existed
 * (e.g. the reconciler's 26-Aug backfill batch). For each un-settled transfer it
 * fetches the transfer from Razorpay and applies its settlement_status onto the
 * booking. READS from Razorpay; writes only the new status columns — no money moves.
 * Idempotent (transfer_settled_at is stamped once), so safe to re-run any time.
 *
 * Run after v3.124 is applied on the target DB, against that DB's server/.env:
 *   node -r dotenv/config scripts/backfillTransferSettlement.js
 */
const { supabaseAdmin } = require('../config/supabase');
const razorpayConfig = require('../services/razorpayConfig');
const { applyTransferSettlement } = require('../services/routeAutoPayoutService');

(async () => {
  const { data: rows, error } = await supabaseAdmin
    .from('bookings')
    .select('id, razorpay_transfer_id')
    .not('razorpay_transfer_id', 'is', null)
    .is('transfer_settled_at', null)
    .in('transfer_status', ['pending', 'processed']);
  if (error) { console.error('query failed:', error.message); process.exit(1); }

  console.log(`scanning ${rows?.length || 0} transfers with no settlement record…`);
  const rz = await razorpayConfig.getClient();
  let settled = 0, unsettled = 0, failed = 0;
  for (const b of rows || []) {
    try {
      const t = await rz.transfers.fetch(b.razorpay_transfer_id);   // read
      const r = await applyTransferSettlement(t);
      if (r.firstSettle) settled++; else unsettled++;
      console.log(`  ${b.razorpay_transfer_id} → settlement_status=${t.settlement_status || 'null'}`);
    } catch (e) {
      failed++;
      console.error(`  ${b.razorpay_transfer_id} ERROR ${e.error?.description || e.message}`);
    }
  }
  console.log(`done: ${settled} newly settled, ${unsettled} not-yet-settled, ${failed} errors`);
  process.exit(failed ? 1 : 0);
})();
