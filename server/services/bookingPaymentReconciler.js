/**
 * bookingPaymentReconciler.js — safety net for missed one-off booking webhooks.
 *
 * The Razorpay webhook flips a booking unpaid→paid, and on a processing error it
 * returns 500 so Razorpay retries. But if every retry exhausts (or the webhook
 * was never delivered) a genuinely-paid booking is left stuck `unpaid` — money
 * taken, slot not confirmed, guest in limbo. This scans such bookings and asks
 * Razorpay directly whether their order was actually captured, then completes
 * the same idempotent transition the webhook does.
 *
 * Mirrors subscriptionReconciler. Idempotent (only the unpaid→paid row matches),
 * so it is safe to run repeatedly and safe alongside a late webhook. Wired to a
 * setInterval in server.js.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const razorpayConfig = require('./razorpayConfig');
const { trackServer } = require('../utils/trackServer');
const { resolveGuestId } = require('../utils/posthog');
const { finalizeBookingCapture } = require('./bookingCapture');
const { sendBookingConfirmation } = require('./bookingConfirmation');
// Same GST/commission invoice generators the verify + webhook paths use, so a
// reconciler-healed booking mints a real invoice instead of the dashboard fallback.
const { generateBookingInvoice, generateCommissionInvoice } = require('../controllers/paymentController');

// Only touch bookings whose order is old enough that the normal capture→webhook
// path should already have completed — avoids racing a webhook that's in flight.
const GRACE_MIN = Number(process.env.BOOKING_RECONCILE_GRACE_MIN || 15);
// Don't chase abandoned checkouts forever; cap how far back we look.
const LOOKBACK_HOURS = Number(process.env.BOOKING_RECONCILE_LOOKBACK_HOURS || 48);

async function reconcile() {
  const now = Date.now();
  const upper = new Date(now - GRACE_MIN * 60 * 1000).toISOString();
  const lower = new Date(now - LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  const { data: stuck } = await supabaseAdmin
    .from('bookings')
    .select('id, razorpay_order_id, host_id, guest_id, guest_email, customer_total, commission_applied, commission_gst, platform_fee_amount, platform_fee_gst, billing_details, services(title, price)')
    .eq('payment_status', 'unpaid')
    .not('razorpay_order_id', 'is', null)
    .neq('status', 'cancelled')
    .lt('updated_at', upper)
    .gt('updated_at', lower)
    .limit(100);

  let checked = 0;
  let healed = 0;
  if (!stuck || !stuck.length) return { checked, healed };

  let client;
  try {
    client = await razorpayConfig.getClient();
  } catch (e) {
    console.error('booking reconcile: razorpay client unavailable —', e.message);
    return { checked, healed };
  }

  for (const b of stuck) {
    checked++;
    try {
      const res = await client.orders.fetchPayments(b.razorpay_order_id);
      const captured = (res.items || []).find((p) => p.status === 'captured');
      if (!captured) continue; // not actually paid — leave it

      // Single source of truth (security audit H-3): flip unpaid→paid/confirmed
      // AND finalise the vendor payout (subtracting the fee from the captured
      // payment) AND post the ORDER_PAYMENT ledger entry — previously this only
      // flipped the status flags. Idempotent: a late webhook that already won the
      // transition yields no row here (no double-fire).
      const { updated: paid } = await finalizeBookingCapture({
        bookingId: b.id,
        paymentId: captured.id,
        feePaise: captured.fee,
        taxPaise: captured.tax,
        pricing: {
          commission_applied: b.commission_applied,
          commission_gst: b.commission_gst,
          platform_fee_amount: b.platform_fee_amount,
          platform_fee_gst: b.platform_fee_gst,
          customer_total: b.customer_total,
          host_id: b.host_id,
          service_price: b.services?.price || 0,
        },
      });
      if (!paid) continue; // someone else won the transition

      healed++;
      // Mint the GST tax invoice (platform fee) + commission invoice, exactly like
      // the verify + webhook paths — then hand the tokenized ref to the confirmation
      // email so the healed booking links a real invoice instead of falling back to
      // the dashboard. Best-effort + idempotent (generateBookingInvoice no-ops when
      // the invoice already exists). billing_details carries the buyer's GST details.
      let invoiceRef = null;
      try {
        const inv = await generateBookingInvoice({ ...paid, billing_details: b.billing_details });
        if (inv) invoiceRef = { id: inv.id, token: inv.access_token };
      } catch (e) { console.error('booking reconcile: invoice error (non-fatal)', paid.id, e.message); }
      try { await generateCommissionInvoice(paid); } catch (e) { console.error('booking reconcile: commission invoice error (non-fatal)', paid.id, e.message); }

      // Confirmation side-effects (calendar/Meet + BOOKING_CONFIRMED + reminder),
      // shared with verify + webhook so a reconciler-healed booking is confirmed too.
      sendBookingConfirmation({ bookingId: paid.id, invoiceRef })
        .catch((e) => console.error('booking reconcile: confirmation error (non-fatal)', paid.id, e.message));
      // Mirror the webhook's analytics so booking_paid fires exactly once.
      try {
        trackServer(
          resolveGuestId({ guestId: paid.guest_id, guestEmail: paid.guest_email }),
          'booking_paid',
          {
            booking_id: paid.id,
            service_title: paid.services?.title,
            host_id: paid.host_id,
            amount: Number(paid.customer_total) || 0,
            currency: 'INR',
            razorpay_payment_id: captured.id,
            source: 'reconciler',
          },
          {
            value: Number(paid.customer_total) || 0,
            currency: 'INR',
            email: paid.guest_email,
            eventId: captured.id, // same id the pixel/webhook used → de-dupe
          },
        );
      } catch (trackErr) {
        console.error('booking reconcile: analytics error (non-fatal)', paid.id, trackErr.message);
      }
    } catch (e) {
      console.error('booking reconcile error', b.id, e.message);
    }
  }

  return { checked, healed };
}

module.exports = { reconcile };
