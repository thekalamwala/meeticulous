// Razorpay payment controller — bookings + product purchases + plan subscriptions
const { safeError } = require('../utils/httpError');
const { hostOf } = require("../utils/hostOf");
const crypto = require("crypto");
const { supabaseAdmin } = require("../config/supabase");
const { securityLog, auditLog } = require("../utils/logger");
const sendEmail = require("../utils/sendEmail");
const { adminAlert } = require("../utils/adminAlert");
const NotificationEngine = require("../services/notificationEngine");
const { computeBreakdown, calculateVendorPayout, calculatePlatformFee, calculateGst, computeSubscriptionBreakdown, round2 } = require("../lib/pricingEngine");
const planService = require("../services/planService");
const platformConfig = require("../services/platformConfig");
const stateService = require("../services/stateService");
const razorpaySubscriptions = require("../services/razorpaySubscriptions");
const subscriptionService = require("../services/subscriptionService");
const razorpayConfig = require("../services/razorpayConfig");
const { cadencePrice, cadenceGross, cadencePeriodDays, computeSwitch, normCadence } = require("../lib/subscriptionPricing");
const { createCalendarEvent } = require("../config/google");
const { decrypt: decryptToken } = require("../utils/cryptoTokens");
const profileSecrets = require("../utils/profileSecrets");
const { verifySignature } = require("../utils/razorpaySignature");
const { finalizeBookingCapture, recordBookingRefund } = require("../services/bookingCapture");
const { sendBookingConfirmation } = require("../services/bookingConfirmation");
const routeTransferService = require("../services/routeTransferService");
const routeAutoPayoutService = require("../services/routeAutoPayoutService");
const { capture: phCapture, resolveGuestId } = require("../utils/posthog");
const { trackServer } = require("../utils/trackServer");
const manageBookingToken = require("../utils/manageBookingToken");
const { runInBackground } = require("../utils/background");
const otpStore = require("../utils/otpStore");
const { identifierOf } = require("../utils/bookingGrant");
const { sendProductDownloadEmail } = require("../utils/productEmail");
const { generateInvoice } = require("../services/invoiceService");

// Mint the platform-fee tax invoice for a paid booking (best-effort, idempotent).
// `bk` must carry billing_details + guest fields + fee snapshot.
async function generateBookingInvoice(bk) {
  const fee = Number(bk.platform_fee_amount) || 0;
  if (fee <= 0) return null; // nothing of BAS's own supply to invoice
  const b = bk.billing_details || {};
  return generateInvoice({
    sourceType: 'booking',
    sourceId: bk.id,
    paymentId: bk.razorpay_payment_id || bk.payment_id || null,
    issuedAt: bk.paid_at || new Date().toISOString(),
    buyer: {
      name: b.name || bk.guest_name || 'Customer',
      address: b.address || null,
      stateCode: b.state_code || null,
      stateName: b.state || null,
      gstin: b.gstin || null,
      pan: b.pan || null,
    },
    taxableValue: fee,
    gstAmount: Number(bk.platform_fee_gst) || 0,
  });
}

// Mint the commission tax invoice — BAS's platform service TO the host (v4).
// Only when commission was charged (free-plan bookings). Best-effort, idempotent
// (one COM row per booking id). buyer = the host; POS is the host's billing state
// (from profiles.billing_details) so a registered host's GSTIN drives their ITC
// and the CGST/SGST-vs-IGST split, falling back to the seller state only when the
// host has no billing state on record.
async function generateCommissionInvoice(bk) {
  const taxable = Number(bk.commission_taxable) || 0;
  if (taxable <= 0) return null; // paid plans have no commission → nothing to invoice
  let hostName = 'Host';
  let hostBilling = {};
  try {
    const { data: h } = await supabaseAdmin
      .from('profiles').select('*').eq('id', bk.host_id).single();
    hostName = h?.business_name || h?.name || h?.full_name || 'Host';
    hostBilling = h?.billing_details || {};
  } catch (_) { /* non-fatal — fall back to 'Host' + seller-state POS */ }
  return generateInvoice({
    sourceType: 'commission',
    sourceId: bk.id,
    paymentId: bk.razorpay_payment_id || bk.payment_id || null,
    issuedAt: bk.paid_at || new Date().toISOString(),
    buyer: {
      name: hostName,
      address: hostBilling.address || null,
      stateCode: hostBilling.state_code || null,
      stateName: hostBilling.state || null,
      gstin: hostBilling.gstin || null,
      pan: hostBilling.pan || null,
    },
    taxableValue: taxable,
    gstAmount: Number(bk.commission_gst) || 0,
  });
}

// Annual plan price in paise, read from subscription_plans (DB-driven, spec v1.1)
const getPlanPricePaise = async (slug) => {
  const plan = await planService.getPlan(slug);
  if (!plan || plan.slug !== planService.normalizeSlug(slug)) return null;
  const price = Number(plan.annual_price);
  return price > 0 ? Math.round(price * 100) : null;
};

// Email helpers (same as bookingController)
const emailHtml = (body) => `
  <div style="max-width:520px;margin:0 auto;padding:26px;border-radius:24px;background:#ffffff;font-family:'Plus Jakarta Sans','Poppins',sans-serif;color:#111827;box-shadow:0 24px 60px rgba(15,23,42,0.08);">
    ${body}
    <div style="margin-top:24px;padding:18px;border-radius:18px;background:#f8fafc;color:#6b7280;font-size:14px;">Book A Sloth — calm booking for busy hosts.</div>
  </div>`;
const row = (label, value) =>
  `<p style="margin:0 0 12px;font-size:15px;color:#374151;"><strong>${label}:</strong> ${value}</p>`;

// Shared order builder — everything from the paid/cancelled guard through order
// creation, so the session create-order and the token-authorized manage-booking
// "complete payment" path (manageBookingController.payByToken) can never drift on
// the money logic. The CALLER owns AUTHORIZATION (session email/user match, or a
// signed manage token); this function assumes the caller has already proven the
// requester may pay for `booking`. Returns { status, body } for the caller to send.
//   `booking` must be selected with services(price, title, duration, grace_period_minutes).
async function buildBookingOrder(booking, { billingFromRequest } = {}) {
  const booking_id = booking.id;
  if (booking.payment_status === "paid") return { status: 400, body: { message: "Already paid" } };
  if (booking.status === "cancelled") return { status: 400, body: { message: "Booking was cancelled" } };

  // Re-validate the slot BEFORE taking money (excluding this booking itself —
  // its pending row is what holds the slot). Catches conflicts that appeared
  // between booking creation and checkout (e.g. a new Google Calendar event).
  try {
    const availabilityService = require("../services/availabilityService");
    const { data: payHost } = await supabaseAdmin
      .from("profiles")
      .select("id, google_calendar_connected")
      .eq("id", booking.host_id).single();
    await profileSecrets.attachGoogleTokens(payHost);
    const { data: payAvail } = await supabaseAdmin
      .from("availability").select("*").eq("host_id", booking.host_id).maybeSingle();
    const slotCheck = await availabilityService.validateSlot({
      host: payHost,
      service: booking.services,
      availability: payAvail,
      scheduledAtUTC: booking.scheduled_at,
      excludeBookingId: booking.id,
    });
    if (!slotCheck.ok) {
      securityLog("PAYMENT_SLOT_CONFLICT", { booking_id, reason: slotCheck.reason });
      return { status: 409, body: {
        message: "This slot is no longer available. Your booking was not charged — please pick another time.",
      } };
    }
  } catch (revalidateErr) {
    // Fail-open: a validation infrastructure error must not block checkout
    console.error("buildBookingOrder slot re-validation error (non-fatal):", revalidateErr.message);
  }

  const servicePrice = booking.services?.price || 0;

  // Customer pays service + platform fee + GST. Use the immutable snapshot
  // captured at booking creation; recompute only for legacy rows without it.
  let customerTotal = Number(booking.customer_total) || 0;
  let platformFee   = Number(booking.platform_fee_amount) || 0;
  let gst           = Number(booking.platform_fee_gst) || 0;
  if (customerTotal <= 0) {
    const { platformFee: feeSetting, gstRate } = await platformConfig.getConfig();
    const feeOnlyMode = await require("../services/paidMode").feeOnlyForHost(booking.host_id);
    const b = computeBreakdown({ servicePrice, commissionPercentage: 0, platformFee: feeSetting, gstRate, chargeFeeOnFree: feeOnlyMode });
    customerTotal = b.customerTotal; platformFee = b.platformFee; gst = b.gst;
  }

  // Nothing payable (a genuinely free booking, fee-only mode off) → no order.
  // In fee-only mode even a ₹0 service owes the booking fee, so customerTotal > 0.
  if (customerTotal <= 0) return { status: 400, body: { message: "Cannot create order for a free booking" } };

  // GST gate: a paid booking issues a platform-fee tax invoice, so a valid
  // billing STATE must be captured before money moves — otherwise the invoice's
  // place of supply silently defaults to the seller state. Prefer the billing
  // snapshotted on the booking; allow the pay request to supply/complete it
  // (older pending rows, or a pay-time billing step). Backend re-validates —
  // a frontend-supplied state is never trusted for the tax determination.
  if (platformFee > 0) {
    let billing = booking.billing_details;
    if (billingFromRequest) {
      const n = stateService.normalizeBilling(billingFromRequest, { requireState: false });
      if (!n.ok) return { status: 400, body: { message: n.error, field: 'billing_details' } };
      if (n.billing) {
        billing = n.billing;
        await supabaseAdmin.from("bookings")
          .update({ billing_details: billing, updated_at: new Date().toISOString() })
          .eq("id", booking_id);
      }
    }
    const billingCheck = stateService.normalizeBilling(billing || {}, { requireState: true });
    if (!billingCheck.ok) {
      return { status: 400, body: { message: billingCheck.error, field: 'billing_details', code: 'BILLING_STATE_REQUIRED' } };
    }
  }

  const totalPaise = Math.round(customerTotal * 100);
  const razorpay = await razorpayConfig.getClient();

  // Idempotency: a rapid re-click (or a re-opened checkout) must not mint a
  // second live order for the same booking. If we already have an open order
  // for the same amount, reuse it instead of creating a new one.
  let order = null;
  if (booking.razorpay_order_id) {
    try {
      const existing = await razorpay.orders.fetch(booking.razorpay_order_id);
      if (existing) {
        // A payment already captured on this booking's order (webhook/reconciler
        // will finalize shortly): do NOT mint a second order, or a guest paying in
        // two tabs/devices could be charged twice for one booking (P2-11).
        if (existing.status === "paid" || Number(existing.amount_paid) > 0) {
          return { status: 409, body: { message: "Payment already received for this booking — finalizing. Please refresh in a moment." } };
        }
        // Reuse the still-open order for a rapid re-click / re-opened checkout.
        if (Number(existing.amount) === totalPaise && (existing.status === "created" || existing.status === "attempted")) {
          order = existing;
        }
      }
    } catch (_) {
      // Stale/unfetchable id — fall through and create a fresh order.
    }
  }
  if (!order) {
    order = await razorpay.orders.create({
      amount: totalPaise, currency: "INR",
      receipt: `bkg_${String(booking_id).slice(0, 20)}`,
      notes: { booking_id, service: booking.services?.title, platform_fee: platformFee, gst },
    });
  }

  // Only update razorpay_order_id — the fee/GST snapshot is immutable
  await supabaseAdmin.from("bookings")
    .update({ razorpay_order_id: order.id, updated_at: new Date().toISOString() })
    .eq("id", booking_id);

  auditLog('PAYMENT_ORDER_CREATED', booking.guest_id, { booking_id, amount: totalPaise });

  return { status: 200, body: {
    razorpay_order_id: order.id, amount: order.amount, currency: order.currency,
    key: await razorpayConfig.getKeyId(),
    service_price: servicePrice, platform_fee: platformFee, gst, total: customerTotal,
  } };
}

// ── POST /api/payment/create-order ───────────────────────────
// SECURITY FIX: validate guest identity against the booking before creating order
const createOrder = async (req, res) => {
  try {
    const { booking_id, guest_email } = req.body;
    if (!booking_id) return res.status(400).json({ message: "booking_id is required" });

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("*, services(price, title, duration, grace_period_minutes)")
      .eq("id", booking_id).single();

    if (error || !booking) return res.status(404).json({ message: "Booking not found" });

    // SECURITY: Verify the requester matches the booking guest — either the email
    // matches, or the authenticated user is the guest. (The manage-booking token
    // path proves ownership differently; both then share buildBookingOrder.)
    const isAuthenticatedGuest = req.user?.id && req.user.id === booking.guest_id;
    const isEmailGuest = guest_email && booking.guest_email &&
      guest_email.toLowerCase().trim() === booking.guest_email.toLowerCase().trim();

    if (!isAuthenticatedGuest && !isEmailGuest) {
      securityLog('PAYMENT_UNAUTHORIZED', { booking_id, ip: req.ip, userId: req.user?.id });
      return res.status(403).json({ message: "Not authorized to pay for this booking." });
    }

    const r = await buildBookingOrder(booking, { billingFromRequest: req.body.billing_details });
    return res.status(r.status).json(r.body);
  } catch (error) {
    securityLog('PAYMENT_ORDER_ERROR', { error: error.message });
    res.status(500).json({ message: "Payment initiation failed. Please try again." });
  }
};

const { isLoadTestMode } = require("../config/loadTestMode");
// Razorpay signature gate. Bypassed ONLY under LOAD_TEST_MODE (off by default,
// never trusted in production) so JMeter — which can't run a real client-side
// checkout to produce a real signature — can exercise the verify path.
const signatureValid = (orderId, paymentId, sig, secret) =>
  isLoadTestMode() || verifySignature(orderId, paymentId, sig, secret);

// ── POST /api/payment/verify ─────────────────────────────────
const verifyPayment = async (req, res) => {
  try {
    const { booking_id, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    // Verify the order_id matches what we stored (replay attack prevention)
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("razorpay_order_id, payment_status, commission_applied, commission_gst, platform_fee_amount, platform_fee_gst, customer_total, meeting_link, scheduled_at, guest_name, guest_email, notes, host_id, service_id, billing_details, services(price, title, duration, meeting_mode)")
      .eq("id", booking_id).single();

    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.payment_status === "paid") return res.status(400).json({ message: "Already paid" });
    if (booking.razorpay_order_id !== razorpay_order_id) {
      securityLog('PAYMENT_ORDER_MISMATCH', { booking_id, provided: razorpay_order_id, stored: booking.razorpay_order_id, ip: req.ip });
      return res.status(400).json({ message: "Payment verification failed." });
    }

    const keySecret = await razorpayConfig.getKeySecret();
    if (!signatureValid(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret)) {
      securityLog('PAYMENT_SIGNATURE_INVALID', { booking_id, ip: req.ip });
      return res.status(400).json({ message: "Payment verification failed — invalid signature." });
    }

    // M-8: bind the captured amount to the order we created — belt-and-suspenders
    // on top of the server-generated + signature-verified order id above. Skipped
    // under load-test mode (no real Razorpay order behind the stubbed signature).
    if (!isLoadTestMode()) {
      try {
        const rzp = await razorpayConfig.getClient();
        const rzpOrder = await rzp.orders.fetch(razorpay_order_id);
        const expectedPaise = Math.round((Number(booking.customer_total) || 0) * 100);
        if (expectedPaise > 0 && Number(rzpOrder.amount) !== expectedPaise) {
          securityLog('PAYMENT_AMOUNT_MISMATCH', { booking_id, expected: expectedPaise, order: rzpOrder.amount, ip: req.ip });
          return res.status(400).json({ message: "Payment verification failed." });
        }
      } catch (ordErr) {
        // A transient orders.fetch failure must not block a signature-valid payment.
        console.error("verifyPayment: order amount re-check skipped:", ordErr.message);
      }
    }

    // Fetch the ACTUAL Razorpay fee + tax (vendor-borne). Razorpay's `fee` (paise)
    // INCLUDES `tax`. Retry a few times so a transient blip doesn't silently
    // finalise the payout with fee=0 (M-4); if it still fails, alert an admin and
    // proceed (the booking must not be left stuck).
    let feePaise = null, taxPaise = null;
    if (!isLoadTestMode()) {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const rzp = await razorpayConfig.getClient();
          const payment = await rzp.payments.fetch(razorpay_payment_id);
          if (payment && payment.fee != null) feePaise = Number(payment.fee);
          if (payment && payment.tax != null) taxPaise = Number(payment.tax);
          break;
        } catch (feeErr) {
          if (attempt === 3) {
            adminAlert({
              key: 'rzp_fee_fetch_failed',
              subject: `Razorpay fee fetch failed for booking ${booking_id}`,
              lines: [
                `Could not fetch the gateway fee for payment ${razorpay_payment_id} after 3 tries.`,
                `The payout was finalised WITHOUT subtracting the fee — post a manual ADJUSTMENT once the real fee is known.`,
                `Error: ${feeErr.message}`,
              ],
            });
          }
        }
      }
    }

    // Single source of truth for paid→confirmed + payout finalisation + ledger
    // (shared with the webhook + reconciler so the money logic can't drift).
    let updated;
    try {
      const r = await finalizeBookingCapture({
        bookingId: booking_id,
        paymentId: razorpay_payment_id,
        feePaise, taxPaise,
        pricing: {
          commission_applied: booking.commission_applied,
          commission_gst: booking.commission_gst,
          platform_fee_amount: booking.platform_fee_amount,
          platform_fee_gst: booking.platform_fee_gst,
          customer_total: booking.customer_total,
          host_id: booking.host_id,
          service_price: booking.services?.price || 0,
        },
      });
      updated = r.updated;
    } catch (error) {
      return safeError(res, error);
    }
    if (!updated) return res.status(400).json({ message: "Already paid" });

    // v3.67: GST tax invoice for the platform fee (best-effort; idempotent).
    let invoiceRef = null;
    try {
      const inv = await generateBookingInvoice({ ...updated, billing_details: booking.billing_details });
      if (inv) invoiceRef = { id: inv.id, token: inv.access_token };
    } catch (_) { /* non-fatal */ }
    // v4: commission tax invoice to the host (best-effort; only when commission charged).
    try { await generateCommissionInvoice(updated); } catch (_) { /* non-fatal */ }

    // Calendar event (+ Meet link) + BOOKING_CONFIRMED notifications + catch-up
    // reminder now live in sendBookingConfirmation (fired below), so the webhook
    // and reconciler capture paths get them too — not just this client verify.

    auditLog('PAYMENT_VERIFIED', null, { booking_id, razorpay_payment_id });

    // Payment is now durably recorded. Respond immediately; analytics fan-out
    // (server GA4/Meta CAPI) and confirmation emails (WhatsApp + SMTP) are
    // best-effort and ran synchronously before — they were the bulk of the ~6s.
    res.json({ message: "Payment verified", booking: updated, invoice: invoiceRef });

    runInBackground("verifyPayment:analytics", () =>
      trackServer(resolveGuestId({ guestId: req.user?.id, guestEmail: booking.guest_email }), "booking_paid", {
        booking_id,
        service_title: booking.services?.title,
        host_id: booking.host_id,
        amount: Number(booking.customer_total) || 0,
        currency: "INR",
        razorpay_payment_id,
      }, {
        value: Number(booking.customer_total) || 0,
        currency: "INR",
        email: booking.guest_email,
        req,                                    // EMQ match keys: IP/UA/fbp/fbc
        eventId: razorpay_payment_id,           // de-dupe vs browser pixel
        gaClientId: req.body?.ga_client_id,     // browser _ga id if client forwarded it
      }));

    // Calendar event + confirmation notifications (email + WhatsApp) + catch-up
    // reminder. Shared with the webhook + reconciler capture paths so a booking
    // paid via redirect/UPI (client tab dead before /verify) still gets confirmed.
    runInBackground("verifyPayment:confirmation", () =>
      sendBookingConfirmation({ bookingId: booking_id, invoiceRef }));
  } catch (error) {
    // Success response is sent at L302 before the best-effort background fan-out.
    // A throw after that point must not attempt a second send (ERR_HTTP_HEADERS_SENT).
    if (!res.headersSent) res.status(500).json({ message: "Payment verification failed." });
  }
};

// ── POST /api/payment/subscribe ──────────────────────────────
const subscribePlan = async (req, res) => {
  try {
    const { plan } = req.body;
    const planRecord = await planService.getPlan(plan);
    if (!planRecord || planRecord.slug !== planService.normalizeSlug(plan) || !(Number(planRecord.annual_price) > 0)) {
      return res.status(400).json({ message: "Invalid or free plan — nothing to purchase." });
    }
    // Archived rows (legacy partner price, internal Supreme) still renew for
    // their existing subscribers but are never self-serve purchasable.
    if (!planService.isSelfServable(planRecord)) {
      return res.status(404).json({ message: "Plan not found" });
    }
    // GST is charged ON TOP of the plan price (PRD §5.2) — never embedded.
    const { gstRate } = await platformConfig.getConfig();
    const breakdown = computeSubscriptionBreakdown({ planPrice: Number(planRecord.annual_price), gstRate });
    const amountPaise = Math.round(breakdown.totalCharged * 100);
    const razorpay = await razorpayConfig.getClient();
    const order = await razorpay.orders.create({
      amount: amountPaise, currency: "INR",
      receipt: `plan_${plan}_${req.user.id.slice(0, 10)}`,
      notes: { vendor_id: req.user.id, plan, plan_price: breakdown.planPrice, gst: breakdown.gstAmount },
    });
    auditLog('SUBSCRIPTION_ORDER_CREATED', req.user.id, { plan, amount: amountPaise });
    res.json({
      razorpay_order_id: order.id, amount: order.amount, currency: order.currency, plan,
      plan_price: breakdown.planPrice, gst_amount: breakdown.gstAmount, total: breakdown.totalCharged,
    });
  } catch (error) {
    safeError(res, error);
  }
};

// ── POST /api/payment/verify-subscription ───────────────────
const verifySubscription = async (req, res) => {
  try {
    const { plan, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

    const keySecret = await razorpayConfig.getKeySecret();
    if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret)) {
      securityLog('SUBSCRIPTION_SIGNATURE_INVALID', { userId: req.user.id, ip: req.ip });
      return res.status(400).json({ message: "Payment verification failed." });
    }

    // SECURITY: the signature only proves the order/payment pair is genuine — not
    // WHICH plan it was for. Fetch the order and confirm it was created for THIS
    // vendor and the claimed plan, else a vendor could pay for a cheap plan and
    // activate an expensive one.
    let rzpOrder;
    try {
      const razorpay = await razorpayConfig.getClient();
      rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
    } catch (_) {
      return res.status(400).json({ message: "Order not found." });
    }
    if (String(rzpOrder?.notes?.vendor_id) !== String(req.user.id) ||
        String(rzpOrder?.notes?.plan) !== String(plan)) {
      securityLog('SUBSCRIPTION_ORDER_MISMATCH', { userId: req.user.id, order_id: razorpay_order_id, claimedPlan: plan, ip: req.ip });
      return res.status(400).json({ message: "Payment does not match this plan." });
    }

    // Idempotency: if this payment was already processed, return success without
    // re-activating / re-inserting / re-posting (prevents double subscription revenue).
    const { data: priorPayment } = await supabaseAdmin
      .from("subscription_payments")
      .select("id")
      .eq("razorpay_payment_id", razorpay_payment_id)
      .maybeSingle();
    if (priorPayment) {
      const { data: existingProfile } = await supabaseAdmin
        .from("profiles").select("id, name, email, plan, plan_expires_at").eq("id", req.user.id).single();
      return res.json({ message: `Subscription already active`, profile: existingProfile });
    }

    // Annual billing per spec v1.1 (was incorrectly 30 days)
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update({ plan, plan_expires_at: expiresAt.toISOString(), plan_updated_at: new Date().toISOString(), plan_activated_at: new Date().toISOString() })
      .eq("id", req.user.id).select("id, name, email, plan, plan_expires_at").single();

    if (error) return safeError(res, error);

    await supabaseAdmin.from("plan_purchases").insert({
      vendor_id: req.user.id, plan, amount_paid: await getPlanPricePaise(plan),
      razorpay_order_id, razorpay_payment_id,
      activated_at: new Date().toISOString(), expires_at: expiresAt.toISOString(),
    });

    // ── v2.8: subscription payment record + SUBSCRIPTION_PAYMENT ledger entry ──
    try {
      const planRecord2 = await planService.getPlan(plan);
      const { gstRate } = await platformConfig.getConfig();
      const breakdown = computeSubscriptionBreakdown({ planPrice: Number(planRecord2?.annual_price) || 0, gstRate });

      // Actual gateway fee+tax — PLATFORM-borne for subscriptions (PRD §5.3)
      let subFeeTotal = 0, subTax = 0;
      try {
        const razorpay = await razorpayConfig.getClient();
        const payment = await razorpay.payments.fetch(razorpay_payment_id);
        if (payment && payment.fee != null) subFeeTotal = Number(payment.fee) / 100;
        if (payment && payment.tax != null) subTax = Number(payment.tax) / 100;
      } catch (feeErr) {
        console.error("Subscription fee fetch failed (recorded 0):", feeErr.message);
      }
      subTax = Math.min(subTax, subFeeTotal);
      const subFeeExclTax = Math.max(0, Math.round((subFeeTotal - subTax) * 100) / 100);

      const nowIso = new Date().toISOString();
      const { data: subPayment, error: subErr } = await supabaseAdmin
        .from("subscription_payments").insert({
          vendor_id: req.user.id, plan_type: plan,
          plan_price: breakdown.planPrice, gst_amount: breakdown.gstAmount, total_charged: breakdown.totalCharged,
          razorpay_fee: subFeeExclTax, razorpay_tax: subTax,
          razorpay_payment_id, razorpay_order_id,
          paid_at: nowIso, revenue_recognized_at: nowIso,
          billing_period_start: nowIso.slice(0, 10),
          billing_period_end: expiresAt.toISOString().slice(0, 10),
          status: "paid",
        }).select().single();

      if (subErr) {
        if (subErr.code === "23505" || /duplicate key|unique constraint/i.test(subErr.message || "")) {
          console.log("subscription_payments duplicate (replay) — skipping ledger post:", razorpay_payment_id);
        } else {
          console.error("subscription_payments insert failed (reconciler cannot heal this — investigate):", subErr.message);
        }
      } else {
        const { subscriptionPaymentEntry } = require("../services/ledger/journalTemplates");
        const { postSafe } = require("../services/ledger/postingService");
        await postSafe({
          sourceType: "SUBSCRIPTION_PAYMENT",
          sourceId: subPayment.id,
          journalDate: nowIso.slice(0, 10),
          template: subscriptionPaymentEntry(subPayment),
        });

        // v3.67: GST tax invoice for the subscription (best-effort, idempotent).
        try {
          const { generateInvoice } = require("../services/invoiceService");
          const { data: prof2 } = await supabaseAdmin
            .from('profiles').select('name, billing_details').eq('id', req.user.id).maybeSingle();
          const bd = prof2?.billing_details || {};
          await generateInvoice({
            sourceType: 'subscription', sourceId: subPayment.id, paymentId: razorpay_payment_id,
            issuedAt: nowIso,
            buyer: { name: bd.name || prof2?.name || 'Customer', address: bd.address || null,
              stateCode: bd.state_code || null, stateName: bd.state || null, gstin: bd.gstin || null, pan: bd.pan || null },
            taxableValue: breakdown.planPrice, gstAmount: breakdown.gstAmount,
          });
        } catch (e) { console.error('subscription invoice error (non-fatal):', e.message); }
      }
    } catch (subLedgerErr) {
      console.error("Subscription ledger error (non-fatal):", subLedgerErr.message);
    }

    auditLog('SUBSCRIPTION_ACTIVATED', req.user.id, { plan, expires_at: expiresAt });

    // CRM: real-time "became a customer" event + immediate paid promotion (the
    // annual one-time path never flows through the webhook/renewal hook).
    try {
      await require('../services/crm/leadService').recordAccountEvent({
        profileId: req.user.id, type: 'subscription_started',
        title: `Subscribed — ${plan} (annual)`,
        meta: { plan, cadence: 'annual', payment_id: razorpay_payment_id },
        promoteToPaid: true, wonAt: new Date().toISOString(),
      });
    } catch (crmErr) { console.error('[crm] subscription event hook failed (non-fatal):', crmErr.message); }

    trackServer(req.user.id, "subscription_purchased", {
      plan,
      cadence: "annual",
      expires_at: expiresAt.toISOString(),
    }, {
      value: Number(breakdown?.totalCharged) || 0,
      currency: "INR",
      email: profile.email,
      req,
      eventId: razorpay_payment_id,
      gaClientId: req.body?.ga_client_id,
    });

    // Premium activated email (queued, non-blocking)
    try {
      const planRecord = await planService.getPlan(plan);
      NotificationEngine.send({
        event: 'SUBSCRIPTION_PURCHASED',
        data: {
          email: profile.email,
          emailUser: { name: profile.name, email: profile.email },
          emailData: {
            plan_name: planRecord?.name || plan,
            expiry_date: new Date(expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
          },
          recipientUserId: req.user.id,
        },
      }).catch((e) => console.error('subscription email error:', e.message));
      // Founder alert (legacy one-time annual path). Auto-renew charges are
      // alerted in subscriptionService.sendSubscriptionReceiptEmail instead.
      adminAlert({
        key: `sub_charge:${razorpay_payment_id || req.user.id}`,
        category: 'Payment Receipt',
        subject: `New subscription: ${planRecord?.name || plan}`,
        lines: [
          `${profile.name || 'A host'} (${profile.email || 'no email'})`,
          `Plan: ${planRecord?.name || plan} (annual)`,
          `Amount: ₹${(Number(breakdown?.totalCharged) || 0).toLocaleString('en-IN')}`,
          'New purchase / upgrade.',
        ],
        link: `${process.env.CLIENT_URL || 'https://meeticulous.com'}/admin/host360/${req.user.id}`,
      });
    } catch (_) { /* non-fatal */ }

    res.json({ message: `Successfully upgraded to ${plan}!`, profile });
  } catch (error) {
    safeError(res, error);
  }
};

// ══ Auto-renewing subscriptions (Razorpay Subscriptions API) ══════════════════

// ── POST /api/payment/subscription/create  { plan, cadence } ──────────────────
// Creates a Razorpay subscription (mandate). Access is NOT granted here — the
// subscription.activated/charged webhook (or the sync endpoint) activates it.
const createVendorSubscription = async (req, res) => {
  try {
    const { plan } = req.body;
    const cadence = normCadence(req.body.cadence);
    if (!['monthly', 'annual'].includes(cadence)) {
      return res.status(400).json({ message: "cadence must be 'monthly' or 'annual'" });
    }
    const planRecord = await planService.getPlan(plan);
    if (!planRecord || planRecord.slug !== planService.normalizeSlug(plan)) {
      return res.status(404).json({ message: "Plan not found" });
    }
    // Archived rows (legacy partner price, internal Supreme) still renew for
    // their existing subscribers but are never self-serve purchasable. Without
    // this, anyone who guessed an archived slug could buy at its old price.
    if (!planService.isSelfServable(planRecord)) {
      return res.status(404).json({ message: "Plan not found" });
    }
    if (!(cadencePrice(planRecord, cadence) > 0)) {
      return res.status(400).json({ message: `This plan has no ${cadence} price.` });
    }

    // ── Proration / switch context (Phase C) ──────────────────────────────
    // A SWITCH is when a vendor on a settled paid plan (status='active', period
    // still in future) changes tier/cadence. Unused value becomes FREE DAYS on
    // the new plan via a deferred subscription start_at — single mandate, no
    // second payment. Excess credit beyond one new period is forfeited (#4).
    // Legacy one-time annual vendors (no razorpay_subscription_id) are migrated
    // by the SAME path: their remaining paid days seed the credit.
    const { data: prof } = await supabaseAdmin.from("profiles")
      .select("plan, subscription_status, current_period_end, plan_expires_at, plan_activated_at, razorpay_subscription_id, billing_cadence, billing_details")
      .eq("id", req.user.id).single();

    const nowIso = new Date().toISOString();
    // Canonicalize + persist any billing sent with this checkout. Backend is
    // authoritative: the typed state is rewritten to its GST code and a malformed
    // GSTIN is rejected. Reflect it onto `prof` so the require-state gate below
    // sees this request's billing without a re-read.
    if (req.body.billing && typeof req.body.billing === 'object') {
      const nb = stateService.normalizeBilling(req.body.billing, { requireState: false });
      if (!nb.ok) return res.status(400).json({ message: nb.error, field: 'billing' });
      if (nb.billing) {
        await supabaseAdmin.from('profiles')
          .update({ billing_details: nb.billing, updated_at: nowIso })
          .eq('id', req.user.id);
        if (prof) prof.billing_details = nb.billing;
      }
    }
    const nowMs = Date.now();
    const periodEndMs = prof?.current_period_end ? new Date(prof.current_period_end).getTime()
      : prof?.plan_expires_at ? new Date(prof.plan_expires_at).getTime() : 0;
    const onPaidPlan = prof && !planService.isFreeSlug(prof.plan);
    const isSwitch = !!(onPaidPlan && prof.subscription_status === "active" && periodEndMs > nowMs);

    // ── Idempotency guard: prevent double-charge on re-click ──────────────────
    // If the host already has a PENDING mandate and clicks the SAME paid plan +
    // cadence again (e.g. during webhook lag in onboarding, before the first
    // subscription's authorization charge is confirmed), do NOT cancel+recreate.
    // cancel+create would mint a SECOND Razorpay mandate, and if the first one
    // already captured its authorization charge the host is charged twice.
    //
    // We can't rely on profiles.plan/billing_cadence to know which plan the
    // pending mandate is for: a fresh free→paid upgrade keeps profiles.plan on the
    // free tier until the mandate ACTIVATES (no access pre-authorization), so the
    // target plan lives only in the Razorpay subscription's notes. So we fetch the
    // existing subscription and compare its notes (vendor_id/plan/cadence) — the
    // authoritative record of what it's for. When it still matches and is in a
    // pre-authorization state, return the EXISTING subscription_id so the client's
    // syncSubscription re-checks the one already in flight instead of creating a
    // duplicate. Genuine switches (status='active', via isSwitch) or a DIFFERENT
    // plan/cadence fall through to the cancel+create path below. (Mirrors
    // verifySubscription's "already processed → return success" idempotency.)
    if (prof?.razorpay_subscription_id && prof.subscription_status === "pending") {
      try {
        const existingSub = await razorpaySubscriptions.fetchSubscription(prof.razorpay_subscription_id);
        // Razorpay subscription states before the first successful charge.
        const PRE_AUTH_STATES = ["created", "authenticated", "pending"];
        const n = existingSub?.notes || {};
        const sameTarget =
          PRE_AUTH_STATES.includes(existingSub?.status) &&
          String(n.vendor_id) === String(req.user.id) &&
          planService.normalizeSlug(n.plan) === planRecord.slug &&
          normCadence(n.cadence) === cadence;
        if (sameTarget) {
          auditLog('SUBSCRIPTION_CREATE_IDEMPOTENT', req.user.id, {
            plan: planRecord.slug, cadence, subscription_id: existingSub.id, status: existingSub.status,
          });
          return res.json({
            subscription_id: existingSub.id,
            key: await razorpayConfig.getKeyId(),
            plan: planRecord.slug,
            cadence,
          });
        }
      } catch (fetchErr) {
        // Can't confirm the existing mandate → fall through to cancel+create. The
        // cancel step below tolerates an "already gone" subscription, so this is
        // safe; the only cost is recreating a mandate we couldn't verify.
        console.warn(`pending-subscription idempotency fetch failed for vendor ${req.user.id} (sub ${prof.razorpay_subscription_id}):`, fetchErr.message);
      }
    }

    // GST gate: creating/replacing a mandate leads to a charge → BAS issues a
    // subscription tax invoice. Require a valid billing state (from this request or
    // already on the profile) before the mandate exists, so the invoice POS can't
    // default to the seller state. The idempotent re-click above returns earlier —
    // its billing was validated on the first click.
    const billingState = stateService.normalizeBilling(prof?.billing_details || {}, { requireState: true });
    if (!billingState.ok) {
      return res.status(400).json({ message: billingState.error, field: 'billing', code: 'BILLING_STATE_REQUIRED' });
    }

    let switchInfo = null, startAt;
    if (isSwitch) {
      const { gstRate } = await platformConfig.getConfig();
      const newGross = cadenceGross(planRecord, cadence, gstRate);

      // Determine amount paid + period for the current plan (subscription first,
      // then legacy plan_purchases for one-time annual vendors).
      let amountPaid = 0, periodStart = prof.plan_activated_at, periodEnd = prof.current_period_end || prof.plan_expires_at;
      const { data: lastPay } = await supabaseAdmin.from("subscription_payments")
        .select("total_charged, billing_period_start, billing_period_end")
        .eq("vendor_id", req.user.id).order("paid_at", { ascending: false }).limit(1).maybeSingle();
      if (lastPay) {
        amountPaid = Number(lastPay.total_charged) || 0;
        periodStart = lastPay.billing_period_start; periodEnd = lastPay.billing_period_end;
      } else {
        const { data: lastPurchase } = await supabaseAdmin.from("plan_purchases")
          .select("amount_paid, activated_at, expires_at")
          .eq("vendor_id", req.user.id).order("activated_at", { ascending: false }).limit(1).maybeSingle();
        if (lastPurchase) {
          amountPaid = (Number(lastPurchase.amount_paid) || 0) / 100; // stored in paise
          periodStart = lastPurchase.activated_at; periodEnd = lastPurchase.expires_at;
        }
      }

      if (amountPaid > 0 && periodStart && periodEnd) {
        switchInfo = computeSwitch({ amountPaid, periodStart, periodEnd, now: nowIso, newPeriodGross: newGross, newCadence: cadence });
        if (switchInfo.creditDays > 0) startAt = switchInfo.startAtUnix;
      } else {
        console.warn(`Switch detected for vendor ${req.user.id} but no prior payment found — proceeding without proration credit.`);
      }
    }

    // Cancel any prior Razorpay subscription BEFORE creating the replacement, so
    // a switch (or an abandoned pending setup) never leaves two live mandates →
    // double-charge. A real failure here is fatal; "already gone" is tolerated.
    if (prof?.razorpay_subscription_id) {
      try {
        await razorpaySubscriptions.cancelSubscription(prof.razorpay_subscription_id, false);
      } catch (e) {
        const msg = e?.error?.description || e?.message || "";
        const alreadyGone = /not found|already cancelled|already canceled|cancelled|completed|does not exist/i.test(msg);
        if (!alreadyGone) {
          console.error("cancel old subscription failed (fatal — aborting to avoid double mandate):", msg);
          return res.status(502).json({ message: "Could not switch plans right now. Please try again." });
        }
      }
    }

    const planId = await razorpaySubscriptions.ensureRazorpayPlan(planRecord, cadence);
    const subscription = await razorpaySubscriptions.createSubscription({
      planId, cadence,
      notes: { vendor_id: req.user.id, plan: planRecord.slug, cadence },
      startAt,
    });

    if (isSwitch) {
      // Grant the new tier + free days immediately (vendor already paid for the
      // old period) but keep status 'pending' until the mandate is authorized.
      const grantedEnd = new Date(nowMs + ((switchInfo?.creditDays || 0) + cadencePeriodDays(cadence)) * 86400000).toISOString();
      const { error: upErr } = await supabaseAdmin.from("profiles").update({
        plan: planRecord.slug, billing_cadence: cadence, subscription_status: "pending",
        razorpay_subscription_id: subscription.id, current_period_end: grantedEnd, plan_expires_at: grantedEnd,
        plan_updated_at: nowIso, updated_at: nowIso,
      }).eq("id", req.user.id);
      // Razorpay subscription already created — a silent profile-update failure
      // would charge the vendor without granting access. Fail loud for reconciliation.
      if (upErr) {
        console.error(`subscription switch: profile update failed for vendor ${req.user.id} (sub ${subscription.id}):`, upErr.message);
        return res.status(502).json({ message: "Subscription created but activation failed. Please contact support." });
      }
    } else {
      // Fresh upgrade from free/expired — no access until the mandate activates.
      const { error: upErr } = await supabaseAdmin.from("profiles")
        .update({ razorpay_subscription_id: subscription.id, subscription_status: "pending", updated_at: nowIso })
        .eq("id", req.user.id);
      if (upErr) {
        console.error(`subscription create: profile update failed for vendor ${req.user.id} (sub ${subscription.id}):`, upErr.message);
        return res.status(502).json({ message: "Subscription created but activation failed. Please contact support." });
      }
    }

    auditLog('SUBSCRIPTION_CREATED', req.user.id, { plan: planRecord.slug, cadence, subscription_id: subscription.id, switch: isSwitch });
    res.json({
      subscription_id: subscription.id, key: await razorpayConfig.getKeyId(), plan: planRecord.slug, cadence,
      ...(switchInfo ? { credit_applied: switchInfo.creditApplied, forfeited: switchInfo.forfeited, free_days: switchInfo.creditDays } : {}),
    });
  } catch (error) {
    safeError(res, error);
  }
};

// ── POST /api/payment/subscription/sync ───────────────────────────────────────
// On-return fallback for webhook latency: pull live status from Razorpay and
// activate immediately so the vendor isn't stuck waiting on a webhook.
const syncVendorSubscription = async (req, res) => {
  try {
    const { data: prof } = await supabaseAdmin.from("profiles")
      .select("razorpay_subscription_id").eq("id", req.user.id).single();
    if (!prof?.razorpay_subscription_id) {
      return res.json({ status: "none" });
    }
    const rzpSub = await razorpaySubscriptions.fetchSubscription(prof.razorpay_subscription_id);
    if (subscriptionService.ACTIVE_STATES.includes(rzpSub.status)) {
      await subscriptionService.activateFromSubscription({ rzpSub });
    } else if (rzpSub.status === "halted") {
      await subscriptionService.markHalted(rzpSub);
    } else if (["cancelled", "expired", "completed"].includes(rzpSub.status)) {
      await subscriptionService.markCancelled(rzpSub);
    }
    const { data: updated } = await supabaseAdmin.from("profiles")
      .select("id, plan, plan_expires_at, billing_cadence, subscription_status, current_period_end")
      .eq("id", req.user.id).single();
    res.json({ status: rzpSub.status, profile: updated });
  } catch (error) {
    safeError(res, error);
  }
};

// ── POST /api/payment/subscription/cancel ─────────────────────────────────────
// Cancel at cycle end — vendor keeps access until current_period_end.
const cancelVendorSubscription = async (req, res) => {
  try {
    const { data: prof } = await supabaseAdmin.from("profiles")
      .select("razorpay_subscription_id, subscription_status").eq("id", req.user.id).single();
    if (!prof?.razorpay_subscription_id) {
      return res.status(400).json({ message: "No active subscription to cancel." });
    }
    await razorpaySubscriptions.cancelSubscription(prof.razorpay_subscription_id, true);
    await supabaseAdmin.from("profiles")
      .update({ subscription_status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", req.user.id);
    auditLog('SUBSCRIPTION_CANCELLED', req.user.id, { subscription_id: prof.razorpay_subscription_id });
    // Churn: host cancelled their own subscription. PostHog-only.
    phCapture(req.user.id, "subscription_cancelled", { subscription_id: prof.razorpay_subscription_id, source: "user" });
    res.json({ message: "Subscription cancelled. You keep access until the end of the current period." });
  } catch (error) {
    safeError(res, error);
  }
};

// ── POST /api/payment/create-product-order ───────────────────
const createProductOrder = async (req, res) => {
  try {
    const { product_id, buyer_name, buyer_phone, otp } = req.body;
    // Email ownership is proven HERE, before any money moves: the buyer must
    // present a valid OTP for buyer_email. The verified identity AND the price
    // at order time are then baked into the Razorpay order notes, which
    // verify-product and the webhook treat as the source of truth. This closes
    // the hole where verify-product trusted an unverified buyer_email from the
    // request body, and pins the charged amount so a mid-checkout price edit
    // can't reject (or mischarge) a genuine payment.
    const buyerEmail = String(req.body.buyer_email || '').toLowerCase().trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(buyerEmail)) {
      return res.status(400).json({ message: 'A valid email is required' });
    }
    // Verify against the SAME identifier the OTP was issued under. send-otp is
    // phone-first (normalizePhone(phone) || email), so the product page's
    // WhatsApp-keyed code must be verified phone-first too — verifying by email
    // alone broke every purchase where the buyer supplied a phone.
    const otpResult = await otpStore.verify(identifierOf({ email: buyerEmail, phone: buyer_phone }), otp);
    if (!otpResult.valid) {
      return res.status(400).json({ message: otpResult.reason || 'Invalid or expired code' });
    }

    const { data: product } = await supabaseAdmin
      .from("products").select("id, title, price, host_id, is_active").eq("id", product_id).single();

    if (!product || !product.is_active) return res.status(404).json({ message: "Product not found" });
    if (product.price === 0) return res.status(400).json({ message: "This product is free" });

    // Config-driven fee + GST-on-fee (mirrors bookings/services); customer pays
    // price + fee + gst. buyer_state / buyer_gstin are optional place-of-supply.
    const cfg = await platformConfig.getConfig();
    const productFee = calculatePlatformFee(product.price, { platformFee: cfg.platformFee });
    const gstOnFee = calculateGst(productFee, { gstRate: cfg.gstRate });
    const totalPaise = Math.round((product.price + productFee + gstOnFee) * 100);
    const buyerState = String(req.body.buyer_state || '');
    const buyerGstin = String(req.body.buyer_gstin || '');
    const razorpay = await razorpayConfig.getClient();
    const order = await razorpay.orders.create({
      amount: totalPaise, currency: "INR",
      receipt: `prd_${product_id.slice(0, 20)}`,
      notes: {
        product_id, title: product.title,
        platform_fee: productFee, platform_fee_gst: gstOnFee, gst_rate: cfg.gstRate,
        product_price: product.price,
        buyer_name: buyer_name || '', buyer_email: buyerEmail, buyer_phone: buyer_phone || '',
        buyer_state: buyerState, buyer_gstin: buyerGstin,
      },
    });
    res.json({ razorpay_order_id: order.id, amount: order.amount, currency: order.currency,
      key: await razorpayConfig.getKeyId(),
      product_price: product.price, platform_fee: productFee,
      platform_fee_gst: gstOnFee, gst_rate: cfg.gstRate,
      total: round2(product.price + productFee + gstOnFee) });
  } catch (error) {
    safeError(res, error);
  }
};

// ── POST /api/payment/reschedule-fee/create-order ────────────
const createRescheduleFeeOrder = async (req, res) => {
  try {
    const { booking_id } = req.body;
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, guest_id, reschedule_count, profiles!bookings_host_id_fkey(reschedule_fee)")
      .eq("id", booking_id).single();
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (req.user?.id !== booking.guest_id) return res.status(403).json({ message: "Not authorized" });
    const featureFlags = require('../services/featureFlags');
    if (!(await featureFlags.isFeatureEnabled('reschedule_fee'))) {
      return res.status(400).json({ message: 'Reschedule fee is not enabled', fee: 0 });
    }
    const fee = Number(booking["profiles!bookings_host_id_fkey"]?.reschedule_fee) || 0;
    if (fee <= 0 || (Number(booking.reschedule_count) || 0) < 1) {
      return res.status(400).json({ message: "No reschedule fee due", fee: 0 });
    }
    const razorpay = await razorpayConfig.getClient();
    const order = await razorpay.orders.create({
      amount: Math.round(fee * 100), currency: "INR",
      receipt: `rsf_${booking_id.slice(0, 20)}`,
      notes: { booking_id, kind: "reschedule_fee" },
    });
    res.json({ razorpay_order_id: order.id, amount: order.amount, currency: order.currency, fee,
      key: await razorpayConfig.getKeyId() });
  } catch (e) {
    res.status(500).json({ message: "Could not start reschedule fee payment" });
  }
};

// Materialize a paid product purchase from a verified Razorpay order. Idempotent
// on razorpay_order_id so verify-product and the webhook can both run without
// double-issuing. `notes` is the order's notes (buyer + price snapshot, set at
// order creation). Mints the download token and bumps purchase_count atomically.
// Returns { reused, downloadToken, purchase }. Throws on insert error.
const materializeProductPurchase = async ({ product, notes, orderId, paymentId, buyerId }) => {
  const { data: existing } = await supabaseAdmin
    .from("product_purchases")
    .select("id, download_token, buyer_email")
    .eq("razorpay_order_id", orderId).limit(1).maybeSingle();
  if (existing) return { reused: true, downloadToken: existing.download_token, purchase: existing };

  const downloadToken = crypto.randomUUID();
  const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const productPrice = Number(notes.product_price);
  const price = Number.isFinite(productPrice) ? productPrice : 0;
  const platformFee = Number(notes.platform_fee) || 0;
  const gstOnFee = Number(notes.platform_fee_gst) || 0;

  // Actual Razorpay gateway fee+tax — VENDOR-borne for products (mirrors
  // bookings). Razorpay's `fee` (paise) INCLUDES `tax`. Best-effort: a fetch
  // failure records 0 (the reconciler / a manual ADJUSTMENT can correct it) and
  // never blocks delivery of a captured purchase.
  let feeTotal = 0, tax = 0;
  if (paymentId && !isLoadTestMode()) {
    try {
      const rzp = await razorpayConfig.getClient();
      const payment = await rzp.payments.fetch(paymentId);
      if (payment && payment.fee != null) feeTotal = Number(payment.fee) / 100;
      if (payment && payment.tax != null) tax = Number(payment.tax) / 100;
    } catch (feeErr) {
      console.error("Product fee fetch failed (recorded 0):", feeErr.message);
    }
  }
  tax = Math.min(tax, feeTotal);
  const feeExclTax = Math.max(0, round2(feeTotal - tax));
  const gatewayTotal = round2(feeExclTax + tax);
  const customerTotal = round2(price + platformFee + gstOnFee);
  const vendorAmount = round2(price - gatewayTotal);

  const baseRow = {
    product_id: product.id, host_id: product.host_id,
    buyer_id: buyerId || null,
    buyer_name: notes.buyer_name || null,
    buyer_email: String(notes.buyer_email || '').toLowerCase().trim() || null,
    buyer_phone: notes.buyer_phone || null,
    amount_paid: price,
    platform_fee: platformFee,
    payment_status: "paid",
    razorpay_order_id: orderId, razorpay_payment_id: paymentId,
    download_token: downloadToken,
    download_token_expires_at: tokenExpires.toISOString(),
  };
  // v3.37 money-snapshot columns — dropped via schema fallback until applied.
  const fullRow = {
    ...baseRow,
    customer_total: customerTotal,
    vendor_amount: vendorAmount,
    razorpay_fee_actual: feeExclTax,
    razorpay_tax_actual: tax,
    // v3.171 GST-on-fee + place-of-supply snapshot (schema-fallback safe).
    platform_fee_gst: gstOnFee,
    gst_rate: Number(notes.gst_rate) || null,
    buyer_state: notes.buyer_state || null,
    buyer_gstin: notes.buyer_gstin || null,
  };

  const insertRow = (body) =>
    supabaseAdmin.from("product_purchases").insert(body).select().single();
  let { data: purchase, error } = await insertRow(fullRow);
  if (error && /Could not find the|column.*does not exist/i.test(error.message || '')) {
    ({ data: purchase, error } = await insertRow(baseRow));
  }
  if (error) {
    // Lost the race with the other writer (verify vs webhook). The unique index
    // on razorpay_order_id (v1.10) guarantees exactly one winner — re-read its
    // row and treat this as a no-op so neither path double-issues or errors.
    if (error.code === '23505') {
      const { data: winner } = await supabaseAdmin
        .from("product_purchases").select("id, download_token, buyer_email")
        .eq("razorpay_order_id", orderId).limit(1).maybeSingle();
      if (winner) return { reused: true, downloadToken: winner.download_token, purchase: winner };
    }
    throw error;
  }

  // Atomic increment to avoid a race under concurrent purchases (BUG-15).
  await supabaseAdmin.rpc("increment_product_purchase_count", { row_id: product.id });

  // Double-entry ledger (PRODUCT_PAYMENT), idempotent on (source_type, id).
  // postSafe never throws — a captured payment must not fail on a ledger miss;
  // the hourly reconciler self-heals any gap.
  try {
    const { productPaymentEntry } = require("../services/ledger/journalTemplates");
    const { postSafe } = require("../services/ledger/postingService");
    await postSafe({
      sourceType: "PRODUCT_PAYMENT",
      sourceId: purchase.id,
      template: productPaymentEntry({
        purchase_id: purchase.id, host_id: product.host_id,
        product_price: price, platform_fee: platformFee,
        customer_total: customerTotal, vendor_amount: vendorAmount,
        razorpay_fee_actual: feeExclTax, razorpay_tax_actual: tax,
      }),
    });
  } catch (ledgerErr) {
    console.error("Product ledger post error (non-fatal):", ledgerErr.message);
  }

  // GST invoice for BAS's own platform fee (mirrors bookings — taxable = fee,
  // gst = gst on fee). Best-effort: never let invoicing throw/block delivery.
  if (platformFee > 0) {
    try {
      const invoiceService = require('../services/invoiceService');
      await invoiceService.generateInvoice({
        sourceType: 'product', sourceId: purchase.id, paymentId,
        buyer: { name: notes.buyer_name, email: baseRow.buyer_email, gstin: notes.buyer_gstin, state: notes.buyer_state },
        taxableValue: platformFee, gstAmount: gstOnFee,
      });
    } catch (e) { console.error('product invoice (non-fatal):', e.message); }
  }

  return { reused: false, downloadToken, purchase };
};

// ── POST /api/payment/verify-product ────────────────────────
const verifyProductPayment = async (req, res) => {
  try {
    const { product_id, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
    // buyer_id is never trusted from the body — derive from the session if any.
    const buyerId = req.user?.id || null;

    const keySecret = await razorpayConfig.getKeySecret();
    if (!verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, keySecret)) {
      securityLog('PRODUCT_PAYMENT_SIGNATURE_INVALID', { product_id, ip: req.ip });
      return res.status(400).json({ message: "Payment verification failed." });
    }

    const { data: product } = await supabaseAdmin
      .from("products")
      .select("id, price, host_id, title, profiles!products_host_id_fkey(username, name)")
      .eq("id", product_id).single();
    if (!product) return res.status(404).json({ message: "Product not found" });

    // SECURITY: the signature only proves the order/payment pair is genuine —
    // not WHAT it was for. Fetch the Razorpay order, assert it was created for
    // THIS product, then read the buyer + amount from the order notes (set and
    // OTP-verified at order creation). Trusting the order — not the request
    // body — is what makes buyer_email and the charged amount authoritative.
    let rzpOrder;
    try {
      const razorpay = await razorpayConfig.getClient();
      rzpOrder = await razorpay.orders.fetch(razorpay_order_id);
    } catch (_) {
      return res.status(400).json({ message: "Order not found." });
    }
    const orderNotes = rzpOrder?.notes || {};
    // Snapshot fields live in notes for orders created by the current code; the
    // body fallbacks cover only orders already in flight across a deploy.
    const notes = {
      product_id,
      product_price: orderNotes.product_price != null ? orderNotes.product_price : product.price,
      platform_fee: orderNotes.platform_fee != null ? orderNotes.platform_fee : calculatePlatformFee(product.price),
      buyer_name: orderNotes.buyer_name || req.body.buyer_name || '',
      buyer_email: String(orderNotes.buyer_email || req.body.buyer_email || '').toLowerCase().trim(),
      buyer_phone: orderNotes.buyer_phone || req.body.buyer_phone || '',
    };
    const expectedPaise = Math.round((Number(notes.product_price) + Number(notes.platform_fee)) * 100);
    if (String(orderNotes.product_id) !== String(product_id) || Number(rzpOrder?.amount) !== expectedPaise) {
      securityLog('PRODUCT_PAYMENT_MISMATCH', { product_id, order_id: razorpay_order_id, ip: req.ip });
      return res.status(400).json({ message: "Payment does not match this product." });
    }

    let issued;
    try {
      issued = await materializeProductPurchase({
        product, notes, orderId: razorpay_order_id, paymentId: razorpay_payment_id, buyerId,
      });
    } catch (error) {
      return safeError(res, error);
    }
    if (issued.reused) {
      return res.json({ message: "Payment verified", download_token: issued.downloadToken });
    }

    const amount = Number(notes.product_price) || 0;
    auditLog('PRODUCT_PURCHASED', buyerId, { product_id, amount });

    // Deliver the secure download link by email (also makes the "a copy has been
    // sent" line on the purchase page true). Deferred so SMTP never blocks the
    // response; the in-app flow still gets the token in the JSON below.
    runInBackground("product:download-email", () => sendProductDownloadEmail({
      to: notes.buyer_email,
      username: product.profiles?.username,
      productId: product.id,
      productTitle: product.title,
      hostName: product.profiles?.name,
      downloadToken: issued.downloadToken,
      isFree: false,
    }));

    trackServer(resolveGuestId({ guestId: buyerId, guestEmail: notes.buyer_email }), "product_purchased", {
      product_id,
      host_id: product.host_id,
      amount,
      currency: "INR",
      razorpay_payment_id,
    }, {
      value: amount,
      currency: "INR",
      email: notes.buyer_email,
      phone: notes.buyer_phone,
      req,
      eventId: razorpay_payment_id,
      gaClientId: req.body?.ga_client_id,
    });

    res.json({ message: "Payment verified", download_token: issued.downloadToken, purchase: issued.purchase });
  } catch (error) {
    safeError(res, error);
  }
};

// F21: record a received webhook for forensics + redelivery detection. event_id
// comes from Razorpay's per-delivery header (x-razorpay-event-id), falling back to
// a sha256 of the raw body, so a redelivery of the same event collides on the
// UNIQUE(event_id) index and is logged once. Best-effort — swallows every error
// (including a missing table before migration v3.143) so it can never break the
// webhook path. Called AFTER the signature check, so only genuine events are logged.
async function recordWebhookEvent(req, event) {
  try {
    const eventId = req.headers['x-razorpay-event-id']
      || crypto.createHash('sha256').update(req.body).digest('hex');
    await supabaseAdmin.from('webhook_events').insert({
      provider: 'razorpay',
      event_id: String(eventId),
      event_type: typeof event?.event === 'string' ? event.event : 'unknown',
      payload: event || {},
    });
  } catch (_) { /* forensic log must never break the webhook path */ }
}

// ── POST /api/payment/webhook ────────────────────────────────
// Razorpay server-side webhook for payment.captured / payment.failed events
// MUST use raw body — register before express.json()
const handleWebhook = async (req, res) => {
  const webhookSecret = await razorpayConfig.getWebhookSecret();
  if (!webhookSecret) {
    return res.status(500).json({ message: "Webhook secret not configured" });
  }

  const signature = req.headers['x-razorpay-signature'];
  if (!signature) {
    securityLog('WEBHOOK_NO_SIGNATURE', { ip: req.ip });
    return res.status(400).json({ message: "Missing signature" });
  }

  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(req.body) // raw body buffer
    .digest('hex');

  const expectedBuf = Buffer.from(expectedSig);
  const sigBuf = Buffer.from(String(signature));
  // Length-guard: timingSafeEqual throws on unequal-length buffers.
  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf)) {
    securityLog('WEBHOOK_SIGNATURE_INVALID', { ip: req.ip });
    return res.status(400).json({ message: "Invalid webhook signature" });
  }

  let event;
  try { event = JSON.parse(req.body.toString()); }
  catch { return res.status(400).json({ message: "Invalid JSON" }); }

  // F21: append-only log of every signature-verified webhook, BEFORE dispatch.
  // Previously events were verified, handled, and discarded — so "did the webhook
  // arrive, what did it say, was it a redelivery?" was unanswerable without the
  // Razorpay dashboard, and there was no way to tell "never got it" from "got it
  // and mishandled it". Best-effort + non-blocking: a logging failure must never
  // stop us handling a real payment event. Idempotency of EFFECTS stays with the
  // per-handler conditional writes; this is the forensic record.
  await recordWebhookEvent(req, event);

  // ── Subscription lifecycle (handled BEFORE the payment-only guard, since
  // subscription.activated/halted/cancelled carry no payment entity) ──
  if (typeof event.event === 'string' && event.event.startsWith('subscription.')) {
    const rzpSub = event.payload?.subscription?.entity;
    const rzpPayment = event.payload?.payment?.entity || null;
    try {
      if (rzpSub) {
        if (event.event === 'subscription.charged' || event.event === 'subscription.activated') {
          await subscriptionService.activateFromSubscription({ rzpSub, rzpPayment });
          auditLog('WEBHOOK_SUBSCRIPTION_ACTIVE', null, { subscription_id: rzpSub.id, event: event.event });
        } else if (event.event === 'subscription.halted') {
          await subscriptionService.markHalted(rzpSub);
          securityLog('WEBHOOK_SUBSCRIPTION_HALTED', { subscription_id: rzpSub.id });
        } else if (event.event === 'subscription.cancelled') {
          await subscriptionService.markCancelled(rzpSub);
          auditLog('WEBHOOK_SUBSCRIPTION_CANCELLED', null, { subscription_id: rzpSub.id });
          // Churn: subscription cancelled at Razorpay. Key on vendor_id carried in
          // the subscription notes (set at creation). PostHog-only.
          if (rzpSub.notes?.vendor_id) {
            phCapture(rzpSub.notes.vendor_id, "subscription_cancelled", { subscription_id: rzpSub.id, source: "razorpay_webhook" });
          }
        }
      }
    } catch (err) {
      securityLog('WEBHOOK_PROCESSING_ERROR', { event: event.event, error: err.message });
      // Fire-and-forget: 500 makes Razorpay retry, but if retries exhaust the
      // subscription would silently stay pending. Alert the founder. Throttled
      // per event type so a retry burst doesn't spam.
      adminAlert({
        key: `webhook_error:${event.event}`,
        subject: `Razorpay webhook failed: ${event.event}`,
        lines: [
          `Event: ${event.event}`,
          rzpSub?.id ? `Subscription: ${rzpSub.id}` : null,
          `Error: ${err.message}`,
          `Razorpay will retry. If this persists the subscription may stay pending — reconcile against the Razorpay dashboard.`,
        ].filter(Boolean),
      });
      return res.status(500).json({ error: 'processing_failed' });
    }
    return res.json({ received: true });
  }

  // ── Route transfer lifecycle (Phase 1). transfer.processed finalizes a host
  // payout (posts the SETTLEMENT ledger entry + flips the payout to paid);
  // transfer.failed/reversed marks it retryable. Carries a transfer entity, no
  // payment entity — handled BEFORE the payment guard below. ──
  if (typeof event.event === 'string' && event.event.startsWith('transfer.')) {
    const transfer = event.payload?.transfer?.entity;
    try {
      if (transfer) {
        // A transfer id belongs to EITHER a booking held transfer (Phase 2 auto-
        // payout) or a payout_request (Phase 1 manual release). Try the booking
        // handler first; fall back to the payout-request handler.
        let r = await routeAutoPayoutService.handleBookingTransferWebhook(transfer);
        if (!r.handled) r = await routeTransferService.handleTransferWebhook(transfer);
        auditLog('WEBHOOK_ROUTE_TRANSFER', null, { transfer_id: transfer.id, event: event.event, status: transfer.status, handled: r.handled, reason: r.reason });
      }
    } catch (err) {
      securityLog('WEBHOOK_PROCESSING_ERROR', { event: event.event, error: err.message });
      adminAlert({
        key: `webhook_error:${event.event}`,
        subject: `Razorpay webhook failed: ${event.event}`,
        lines: [
          `Event: ${event.event}`,
          transfer?.id ? `Transfer: ${transfer.id}` : null,
          `Error: ${err.message}`,
          `Razorpay will retry. If this persists a host payout may be stuck — reconcile against the Razorpay dashboard.`,
        ].filter(Boolean),
      });
      return res.status(500).json({ error: 'processing_failed' });
    }
    return res.json({ received: true });
  }

  // ── Route settlement (v3.124): the LAST payout hop — a processed transfer's
  // linked-account balance settled to the host's actual bank. Carries a settlement
  // entity (setl_...), no payment entity — handled BEFORE the payment guard below.
  // The handler self-filters: a settlement with no matching Route transfers (e.g. the
  // parent merchant's own settlement) is a harmless no-op, so we accept them all. ──
  if (typeof event.event === 'string' && event.event.startsWith('settlement.')) {
    const settlement = event.payload?.settlement?.entity;
    try {
      if (event.event === 'settlement.processed' && settlement?.id) {
        const r = await routeAutoPayoutService.handleSettlementWebhook(settlement);
        auditLog('WEBHOOK_ROUTE_SETTLEMENT', null, { settlement_id: settlement.id, event: event.event, handled: r.handled, transfers: r.transfers, settled: r.settled, reason: r.reason });
      }
    } catch (err) {
      securityLog('WEBHOOK_PROCESSING_ERROR', { event: event.event, error: err.message });
      adminAlert({
        key: `webhook_error:${event.event}`,
        subject: `Razorpay webhook failed: ${event.event}`,
        lines: [
          `Event: ${event.event}`,
          settlement?.id ? `Settlement: ${settlement.id}` : null,
          `Error: ${err.message}`,
          `Razorpay will retry. If this persists, host bank-settlement status may be stale — the payout reconciler backfills it on its next run.`,
        ].filter(Boolean),
      });
      return res.status(500).json({ error: 'processing_failed' });
    }
    return res.json({ received: true });
  }

  // ── Payment dispute (Phase 2): a disputed booking must not pay the host.
  // Reverse the held Route transfer so the money stays with the platform while
  // the dispute is resolved. Carries a dispute entity (with a payment_id).
  // Razorpay names these `payment.dispute.*` (e.g. payment.dispute.created);
  // accept the bare `dispute.*` form too for forward-compat. ──
  if (typeof event.event === 'string'
      && (event.event.startsWith('payment.dispute.') || event.event.startsWith('dispute.'))) {
    const dispute = event.payload?.dispute?.entity;
    const disputedPaymentId = dispute?.payment_id;
    try {
      if (disputedPaymentId) {
        const r = await routeAutoPayoutService.reverseByPaymentId(disputedPaymentId, `dispute ${dispute.id} (${event.event})`);
        auditLog('WEBHOOK_DISPUTE_REVERSE', null, { dispute_id: dispute.id, payment_id: disputedPaymentId, event: event.event, reversed: r.ok, reason: r.error || r.skipped });
        // Open a dispute record for the admin queue (best-effort).
        if (r.bookingId || r.ok || r.skipped === 'no_held_transfer') {
          const { data: bk } = await supabaseAdmin.from('bookings').select('id').eq('razorpay_payment_id', disputedPaymentId).maybeSingle();
          if (bk?.id) {
            await require('../services/disputeService').recordDispute({
              bookingId: bk.id, raisedBy: 'razorpay',
              reason: `Razorpay dispute ${dispute.id} — ${dispute.reason_code || event.event}`,
              payoutAction: r.ok ? 'reversed' : 'none',
            });
          }
        }
      }
    } catch (err) {
      securityLog('WEBHOOK_PROCESSING_ERROR', { event: event.event, error: err.message });
      return res.status(500).json({ error: 'processing_failed' });
    }
    return res.json({ received: true });
  }

  // ── Refund (LOOPHOLE FIX): refunds are issued MANUALLY in the Razorpay
  // dashboard, so `refund.processed` is the only signal that guest cash actually
  // left our balance. Previously ignored → the outflow never hit the ledger and
  // Vendor Payables stayed orphaned-credited. Post the REFUND entry + reverse the
  // held Route transfer so a refunded booking never also pays the host. Carries a
  // refund entity (with payment_id); handled BEFORE the payment guard below. ──
  if (typeof event.event === 'string' && event.event.startsWith('refund.')) {
    const refund = event.payload?.refund?.entity;
    try {
      if (event.event === 'refund.processed' && refund?.payment_id) {
        const r = await recordBookingRefund({
          paymentId: refund.payment_id,
          refundAmountPaise: refund.amount,
          refundId: refund.id,
          reason: `refund ${refund.id} (${event.event})`,
        });
        auditLog('WEBHOOK_REFUND', null, {
          refund_id: refund.id, payment_id: refund.payment_id,
          posted: r.posted, transfer_reversed: r.transferReversed, reason: r.reason,
        });
        // Refund we couldn't auto-record (no matching booking, e.g. a
        // subscription/product refund) → the money still left; a human must book
        // it. Alert rather than silently drop it.
        if (!r.posted) {
          adminAlert({
            key: `refund_unposted:${refund.id}`,
            subject: `Refund not auto-recorded (${refund.id})`,
            lines: [
              `Refund: ${refund.id} for payment ${refund.payment_id}`,
              `Amount: ₹${(Number(refund.amount || 0) / 100).toFixed(2)}`,
              `Reason: ${r.reason || 'unknown'}`,
              `Money HAS left the Razorpay balance — record it manually in the ledger.`,
            ],
          });
        }
      }
    } catch (err) {
      securityLog('WEBHOOK_PROCESSING_ERROR', { event: event.event, error: err.message });
      adminAlert({
        key: `webhook_error:${event.event}`,
        subject: `Razorpay webhook failed: ${event.event}`,
        lines: [
          `Event: ${event.event}`,
          refund?.id ? `Refund: ${refund.id}` : null,
          `Error: ${err.message}`,
          `Razorpay will retry. If this persists the refund may be unrecorded — reconcile against the Razorpay dashboard.`,
        ].filter(Boolean),
      });
      return res.status(500).json({ error: 'processing_failed' });
    }
    return res.json({ received: true });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment) return res.json({ received: true });

  try {
    if (event.event === 'payment.captured') {
      const notes = payment.notes || {};
      if (notes.booking_id) {
        // Single source of truth (security audit H-3): flip unpaid→paid/confirmed
        // AND finalise the vendor payout (subtracting the gateway fee) AND post the
        // ORDER_PAYMENT ledger entry. Previously the webhook only flipped the status
        // flags, over-crediting the host by the fee and skipping the ledger. The
        // captured event payload carries fee/tax, so no extra Razorpay call.
        // Idempotent: only the unpaid→paid transition matches, so analytics fire
        // exactly once even though verify + webhook + reconciler can all run.
        const { updated: paid } = await finalizeBookingCapture({
          bookingId: notes.booking_id,
          paymentId: payment.id,
          feePaise: payment.fee,
          taxPaise: payment.tax,
        });
        auditLog('WEBHOOK_BOOKING_PAID', null, { booking_id: notes.booking_id, payment_id: payment.id });
        if (paid) {
          let invoiceRef = null;
          try { const inv = await generateBookingInvoice(paid); if (inv) invoiceRef = { id: inv.id, token: inv.access_token }; } catch (_) { /* non-fatal */ }
          try { await generateCommissionInvoice(paid); } catch (_) { /* non-fatal */ }
          // Confirmation side-effects (calendar/Meet + BOOKING_CONFIRMED + reminder)
          // that the client verify path runs — now fired here too, so a webhook-only
          // capture (redirect/UPI, dead client tab) isn't left un-confirmed.
          sendBookingConfirmation({ bookingId: notes.booking_id, invoiceRef })
            .catch((e) => console.error("webhook booking confirmation failed:", e.message));
          trackServer(resolveGuestId({ guestId: paid.guest_id, guestEmail: paid.guest_email }), "booking_paid", {
            booking_id: paid.id,
            service_title: paid.services?.title,
            host_id: paid.host_id,
            amount: Number(paid.customer_total) || 0,
            currency: "INR",
            razorpay_payment_id: payment.id,
            source: "webhook",
          }, {
            value: Number(paid.customer_total) || 0,
            currency: "INR",
            email: paid.guest_email,
            eventId: payment.id,              // same id browser pixel used → de-dupe
          });
        }
      } else if (notes.product_id) {
        // Product-purchase safety net: verify-product may have died after Razorpay
        // captured (DB blip, client closed the tab). The order notes carry the
        // buyer + price snapshot, so reconcile straight from them. Idempotent on
        // razorpay_order_id — if verify-product already issued the purchase, this
        // is a no-op and no second email/analytics fire.
        const { data: product } = await supabaseAdmin
          .from("products")
          .select("id, host_id, title, profiles!products_host_id_fkey(username, name)")
          .eq("id", notes.product_id).single();
        if (product) {
          const issued = await materializeProductPurchase({
            product, notes, orderId: payment.order_id, paymentId: payment.id, buyerId: null,
          });
          if (!issued.reused) {
            auditLog('WEBHOOK_PRODUCT_PAID', null, { product_id: notes.product_id, payment_id: payment.id });
            const buyerEmail = String(notes.buyer_email || '').toLowerCase().trim();
            runInBackground("product:download-email", () => sendProductDownloadEmail({
              to: buyerEmail,
              username: product.profiles?.username,
              productId: product.id,
              productTitle: product.title,
              hostName: product.profiles?.name,
              downloadToken: issued.downloadToken,
              isFree: false,
            }));
            trackServer(resolveGuestId({ guestId: null, guestEmail: buyerEmail }), "product_purchased", {
              product_id: notes.product_id,
              host_id: product.host_id,
              amount: Number(notes.product_price) || 0,
              currency: "INR",
              razorpay_payment_id: payment.id,
              source: "webhook",
            }, {
              value: Number(notes.product_price) || 0,
              currency: "INR",
              email: buyerEmail,
              phone: notes.buyer_phone,
              eventId: payment.id,            // same id verify path uses → de-dupe
            });
          }
        }
      }
    } else if (event.event === 'payment.failed') {
      const notes = payment.notes || {};
      // reschedule_fee notes ALSO carry booking_id — check kind first so a failed
      // reschedule fee never flips the original (already-paid) booking to "failed".
      if (notes.kind === 'reschedule_fee') {
        securityLog('WEBHOOK_PAYMENT_FAILED', { reschedule_booking_id: notes.booking_id || null, payment_id: payment.id, error: payment.error_description });
      } else if (notes.booking_id) {
        // We deliberately do NOT write payment_status='failed'. The CHECK
        // constraint only permits unpaid/paid/refunded, so that write was silently
        // REJECTED (supabase-js returns the error, it does not throw) — which meant
        // `failedRow` was always null and this drop-off analytics NEVER fired. The
        // booking correctly stays 'unpaid' and the stale-hold reaper cancels it;
        // here we only READ the (still-unpaid) row to attribute the drop-off event.
        const { data: failedRow } = await supabaseAdmin.from("bookings")
          .select("guest_id, guest_email")
          .eq("id", notes.booking_id).eq("payment_status", "unpaid").maybeSingle();
        securityLog('WEBHOOK_PAYMENT_FAILED', { booking_id: notes.booking_id, error: payment.error_description });
        // Drop-off signal: a booking payment failed. PostHog-only (not a conversion).
        if (failedRow) {
          phCapture(resolveGuestId({ guestId: failedRow.guest_id, guestEmail: failedRow.guest_email }),
            "payment_failed", { kind: "booking", booking_id: notes.booking_id, reason: payment.error_description || null });
        }
      } else if (notes.product_id) {
        // Products materialize a row only on success, so there is nothing to
        // mark failed — but log it so the failure isn't silently dropped.
        securityLog('WEBHOOK_PAYMENT_FAILED', { product_id: notes.product_id, payment_id: payment.id, error: payment.error_description });
        phCapture(resolveGuestId({ guestEmail: notes.buyer_email }),
          "payment_failed", { kind: "product", product_id: notes.product_id, reason: payment.error_description || null });
      }
    }
  } catch (err) {
    securityLog('WEBHOOK_PROCESSING_ERROR', { event: event.event, error: err.message });
    // Fire-and-forget: 500 makes Razorpay retry, but if retries exhaust the
    // booking would silently stay unpaid. Alert the founder. Throttled per
    // event type so a retry burst doesn't spam.
    adminAlert({
      key: `webhook_error:${event.event}`,
      subject: `Razorpay webhook failed: ${event.event}`,
      lines: [
        `Event: ${event.event}`,
        payment?.notes?.booking_id ? `Booking: ${payment.notes.booking_id}` : null,
        payment?.id ? `Payment: ${payment.id}` : null,
        `Error: ${err.message}`,
        `Razorpay will retry. If this persists the booking may stay unpaid — reconcile against the Razorpay dashboard.`,
      ].filter(Boolean),
    });
    return res.status(500).json({ error: 'processing_failed' });
  }

  res.json({ received: true });
};

module.exports = {
  createOrder, buildBookingOrder, verifyPayment, signatureValid, subscribePlan, verifySubscription,
  createVendorSubscription, syncVendorSubscription, cancelVendorSubscription,
  createProductOrder, verifyProductPayment, createRescheduleFeeOrder, handleWebhook,
  generateBookingInvoice, generateCommissionInvoice,
};
