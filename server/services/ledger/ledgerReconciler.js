/**
 * ledgerReconciler.js — self-heal cron. Finds paid bookings and subscription
 * payments that have NO journal entry (posting failed at capture time) and
 * reposts them. Safe to run repeatedly: posting is idempotent on
 * (source_type, source_id). Scans a bounded recent window each run.
 */
'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { orderPaymentEntry, subscriptionPaymentEntry, productPaymentEntry } = require('./journalTemplates');
const { postSafe } = require('./postingService');

const SCAN_LIMIT = 200;

/**
 * Map a paid `bookings` row to the snapshot orderPaymentEntry() expects.
 *
 * LOOPHOLE FIX (v4): this heal previously dropped `tds_amount`, `tcs_amount`
 * and `commission_taxable`. Without them orderPaymentEntry booked no TDS/TCS
 * credit and booked commission at its GROSS (GST-inclusive) value, so the entry
 * came out unbalanced by (tds + tcs) − commissionGst — e.g. ₹20.00 short on a
 * 0%-commission paid-plan booking. post_journal_entry() rejects an unbalanced
 * entry, so the repost threw and the booking's money NEVER reached the books:
 * money moved (guest charged, host paid), the ledger stayed empty, and the
 * reconciler could never heal it. Selecting and passing the three v4 columns
 * makes the healed entry reproduce the capture-time entry exactly.
 * Pure + exported so the balance is unit-tested without a DB.
 */
function orderSnapshotFromBooking(b) {
  return {
    booking_id: b.id,
    host_id: b.host_id,
    service_price: b.services?.price || 0,
    platform_fee_amount: b.platform_fee_amount,
    platform_fee_gst: b.platform_fee_gst,
    commission_applied: b.commission_applied,
    commission_gst: b.commission_gst,
    commission_taxable: b.commission_taxable,   // v4: commission books at ex-GST value
    tds_amount: b.tds_amount,                    // v4: 194-O withheld from host (govt's)
    tcs_amount: b.tcs_amount,                    // v4: §52 collected from host (govt's)
    razorpay_fee_actual: b.razorpay_fee_actual,
    razorpay_tax_actual: b.razorpay_tax_actual,
    vendor_amount: b.vendor_amount,
    customer_total: b.customer_total,
  };
}

async function missingSourceIds(sourceType, ids) {
  if (!ids.length) return new Set();
  const { data, error } = await supabaseAdmin
    .from('journal_entries')
    .select('source_id')
    .in('source_id', ids)
    .eq('source_type', sourceType);
  if (error) throw new Error(`reconciler journal lookup failed: ${error.message}`);
  const posted = new Set((data || []).map((r) => r.source_id));
  return new Set(ids.filter((id) => !posted.has(id)));
}

async function reconcile() {
  let reposted = 0;

  // ── Paid bookings without an ORDER_PAYMENT entry ──
  const { data: bookings, error: bErr } = await supabaseAdmin
    .from('bookings')
    .select('id, host_id, paid_at, customer_total, vendor_amount, platform_fee_amount, platform_fee_gst, commission_applied, commission_gst, commission_taxable, tds_amount, tcs_amount, razorpay_fee_actual, razorpay_tax_actual, services(price)')
    .eq('payment_status', 'paid')
    .gt('customer_total', 0)
    .not('paid_at', 'is', null)
    .order('paid_at', { ascending: false })
    .limit(SCAN_LIMIT);
  if (bErr) throw new Error(`reconciler booking scan failed: ${bErr.message}`);

  const missingBookings = await missingSourceIds('ORDER_PAYMENT', (bookings || []).map((b) => b.id));
  for (const b of bookings || []) {
    if (!missingBookings.has(b.id)) continue;
    // Per-row guard: a poison-pill row (template build throws on a non-finite
    // amount) must not abort the whole run — log and skip it.
    try {
      const id = await postSafe({
        sourceType: 'ORDER_PAYMENT',
        sourceId: b.id,
        journalDate: (b.paid_at || '').slice(0, 10) || null,
        template: orderPaymentEntry(orderSnapshotFromBooking(b)),
      });
      if (id) reposted += 1;
    } catch (err) {
      console.error(`Reconciler skipped booking ${b.id}:`, err.message);
    }
  }

  // ── Subscription payments without a SUBSCRIPTION_PAYMENT entry ──
  const { data: subs, error: sErr } = await supabaseAdmin
    .from('subscription_payments')
    .select('*')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(SCAN_LIMIT);
  if (sErr) throw new Error(`reconciler subscription scan failed: ${sErr.message}`);

  const missingSubs = await missingSourceIds('SUBSCRIPTION_PAYMENT', (subs || []).map((s) => s.id));
  for (const s of subs || []) {
    if (!missingSubs.has(s.id)) continue;
    try {
      const id = await postSafe({
        sourceType: 'SUBSCRIPTION_PAYMENT',
        sourceId: s.id,
        journalDate: (s.paid_at || '').slice(0, 10) || null,
        template: subscriptionPaymentEntry(s),
      });
      if (id) reposted += 1;
    } catch (err) {
      console.error(`Reconciler skipped subscription ${s.id}:`, err.message);
    }
  }

  // ── Paid product purchases without a PRODUCT_PAYMENT entry ──
  // Wrapped in its own try/catch so a pre-v3.37 DB (snapshot columns absent)
  // can't abort the booking/subscription heal that already ran above.
  try {
    const { data: products, error: pErr } = await supabaseAdmin
      .from('product_purchases')
      .select('id, host_id, created_at, amount_paid, platform_fee, customer_total, vendor_amount, razorpay_fee_actual, razorpay_tax_actual')
      .eq('payment_status', 'paid')
      .gt('amount_paid', 0)            // free products move no money → no entry
      .order('created_at', { ascending: false })
      .limit(SCAN_LIMIT);
    if (pErr) throw new Error(`reconciler product scan failed: ${pErr.message}`);

    const missingProducts = await missingSourceIds('PRODUCT_PAYMENT', (products || []).map((p) => p.id));
    for (const p of products || []) {
      if (!missingProducts.has(p.id)) continue;
      try {
        const id = await postSafe({
          sourceType: 'PRODUCT_PAYMENT',
          sourceId: p.id,
          journalDate: (p.created_at || '').slice(0, 10) || null,
          template: productPaymentEntry({
            purchase_id: p.id, host_id: p.host_id,
            product_price: p.amount_paid, platform_fee: p.platform_fee,
            customer_total: p.customer_total, vendor_amount: p.vendor_amount,
            razorpay_fee_actual: p.razorpay_fee_actual, razorpay_tax_actual: p.razorpay_tax_actual,
          }),
        });
        if (id) reposted += 1;
      } catch (err) {
        console.error(`Reconciler skipped product purchase ${p.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Reconciler product scan skipped:', err.message);
  }

  return { reposted };
}

module.exports = { reconcile, orderSnapshotFromBooking };
