/**
 * subscriptionService.js — activation / renewal / lifecycle for auto-renewing
 * vendor subscriptions. Called by the Razorpay webhook (source of truth), the
 * on-return sync endpoint, and the reconciler cron. All entry points are
 * idempotent on razorpay_payment_id so layered delivery never double-charges.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');
const planService = require('./planService');
const platformConfig = require('./platformConfig');
const NotificationEngine = require('./notificationEngine');
const { capture: phCapture } = require('../utils/posthog');
const { trackServer } = require('../utils/trackServer');
const { computeSubscriptionBreakdown, round2 } = require('../lib/pricingEngine');
const { normCadence } = require('../lib/subscriptionPricing');

const unixToIso = (sec) => (sec ? new Date(Number(sec) * 1000).toISOString() : null);
const ACTIVE_STATES = ['active', 'authenticated'];
// UPI-AutoPay mandate-registration "auth" captures are a fixed nominal debit
// (₹1–5). An absolute ceiling separates them from any real plan charge without
// depending on the (mutable) plan list price. Kept comfortably above the ₹1–5
// auth debit and far below the cheapest paid plan.
const AUTH_TOKEN_MAX_RUPEES = 10;

/**
 * Activate or renew a vendor's plan from a Razorpay subscription (+ optional
 * payment entity). Idempotent. Grants access on every active sub; records a
 * payment row + ledger entry only when a payment entity is present (a charge).
 *
 * @param {object} p
 * @param {object} p.rzpSub       Razorpay subscription entity (notes, current_end, id)
 * @param {object} [p.rzpPayment] Razorpay payment entity (charges only)
 * @returns {Promise<{activated:boolean, reason?:string}>}
 */
async function activateFromSubscription({ rzpSub, rzpPayment = null }) {
  const notes = rzpSub?.notes || {};
  const vendorId = notes.vendor_id;
  const planSlug = planService.normalizeSlug(notes.plan);
  const cadence = normCadence(notes.cadence) || 'monthly';
  if (!vendorId || !notes.plan) return { activated: false, reason: 'missing subscription notes' };

  const paymentId = rzpPayment?.id || null;

  // Idempotency: a recorded payment means this charge already posted.
  // THROW on a failed read rather than swallowing it. supabase-js returns errors
  // instead of throwing, so `const { data: prior }` made a DB blip look like
  // "never seen this payment" and re-ran the whole activation: a second receipt
  // email, a second CRM subscription_started, a second ledger post. The money row
  // itself is protected by uniq_subpay_payment_id, but everything around it is not.
  // Throwing lets the webhook return 500 so Razorpay retries — the charge is
  // re-processed later rather than half-processed now.
  if (paymentId) {
    const { data: prior, error: priorErr } = await supabaseAdmin
      .from('subscription_payments').select('id').eq('razorpay_payment_id', paymentId).maybeSingle();
    if (priorErr) throw priorErr;
    if (prior) return { activated: false, reason: 'payment already processed' };
  }

  const plan = await planService.getPlan(planSlug);

  // First charge for this subscription → initial (drives the purchase email);
  // later charges → renewal. Read before recording so the new row doesn't skew it.
  // A failed read would leave count undefined → `(undefined || 0) === 0` → true,
  // so a renewal would be mis-sent as a brand-new purchase (and re-promoted to
  // paid in the CRM). Same treatment: fail the webhook and let Razorpay retry.
  const { count: priorCount, error: countErr } = await supabaseAdmin
    .from('subscription_payments').select('id', { count: 'exact', head: true })
    .eq('razorpay_subscription_id', rzpSub.id);
  if (countErr) throw countErr;
  const isInitial = (priorCount || 0) === 0;

  let periodEndIso = unixToIso(rzpSub.current_end) ||
    new Date(Date.now() + (cadence === 'monthly' ? 30 : 365) * 24 * 3600 * 1000).toISOString();
  const nowIso = new Date().toISOString();

  // Never shrink access below what's already granted — a switch grants free
  // days up-front (deferred start_at), and the activation webhook must not claw
  // that back when Razorpay reports the first paid cycle's (earlier) end.
  const { data: existing } = await supabaseAdmin
    .from('profiles').select('plan_expires_at').eq('id', vendorId).maybeSingle();
  if (existing?.plan_expires_at && new Date(existing.plan_expires_at) > new Date(periodEndIso)) {
    periodEndIso = existing.plan_expires_at;
  }

  // Grant / extend access (idempotent — safe to repeat).
  await supabaseAdmin.from('profiles').update({
    plan: planSlug,
    billing_cadence: cadence,
    subscription_status: 'active',
    razorpay_subscription_id: rzpSub.id,
    current_period_end: periodEndIso,
    plan_expires_at: periodEndIso,
    plan_updated_at: nowIso,
    plan_activated_at: nowIso,
    updated_at: nowIso,
  }).eq('id', vendorId);

  // Record the charge + ledger entry (only when a payment entity is present).
  // A missing payment entity (e.g. subscription.activated) grants access but
  // books no money — recordSubscriptionCharge / the reconciler backfill handles
  // the actual charge when the invoice/payment surfaces.
  if (paymentId) {
    let fetched = null;
    // Fetch the full payment so fee/tax are present (webhook payloads may omit).
    try { fetched = await require('./razorpaySubscriptions').fetchPayment(paymentId); }
    catch (e) { console.error('subscription payment fetch failed (using webhook entity):', e.message); }
    // Merge so id/order survive even if a mock/partial fetch omits them.
    const payment = { ...(rzpPayment || {}), ...(fetched || {}), id: paymentId, order_id: fetched?.order_id || rzpPayment?.order_id || null };
    await recordSubscriptionCharge({ vendorId, planSlug, cadence, rzpSub, payment });
  }

  // First charge → purchase receipt; later charges → renewal receipt. Both carry
  // the amount + a link to the GST invoice PDF (see sendSubscriptionReceiptEmail).
  if (paymentId) {
    await sendSubscriptionReceiptEmail({
      event: isInitial ? 'SUBSCRIPTION_PURCHASED' : 'SUBSCRIPTION_RENEWED',
      vendorId, plan, planSlug, cadence, periodEndIso, paymentId,
    });
  } else if (isInitial) {
    // Access granted without a payment entity (e.g. subscription.activated) —
    // still send the purchase email; invoice_url falls back to the dashboard.
    await sendSubscriptionReceiptEmail({
      event: 'SUBSCRIPTION_PURCHASED', vendorId, plan, planSlug, cadence, periodEndIso, paymentId: null,
    });
  }

  // Auto-renew analytics. Renewal charges flow ONLY through this path (webhook /
  // reconciler), never the verify endpoint — so a dedicated event can't overlap
  // the verify path's `subscription_purchased` and never double-counts.
  if (paymentId && !isInitial) {
    const { gstRate } = await platformConfig.getConfig();
    const planPrice = cadence === 'monthly' ? Number(plan.monthly_price) || 0 : Number(plan.annual_price) || 0;
    const total = computeSubscriptionBreakdown({ planPrice, gstRate }).totalCharged;
    trackServer(vendorId, 'subscription_renewed', {
      plan: planSlug,
      cadence,
      expires_at: periodEndIso,
    }, {
      value: Number(total) || 0,
      currency: 'INR',
      eventId: paymentId,   // de-dupe (renewals have no browser pixel, but keep stable)
    });
  }

  // CRM: real-time timeline event + immediate paid promotion (don't wait up to an
  // hour for the attribution batch). isInitial = became a customer; else a renewal.
  // Runs once per charge — the idempotency guard above already returned on replay.
  try {
    const leadService = require('./crm/leadService');
    if (isInitial) {
      await leadService.recordAccountEvent({
        profileId: vendorId, type: 'subscription_started',
        title: `Subscribed — ${planSlug} (${cadence})`,
        meta: { plan: planSlug, cadence, payment_id: paymentId }, promoteToPaid: true, wonAt: nowIso,
      });
    } else if (paymentId) {
      await leadService.recordAccountEvent({
        profileId: vendorId, type: 'subscription_renewed',
        title: `Renewed — ${planSlug} (${cadence})`,
        meta: { plan: planSlug, cadence, payment_id: paymentId }, promoteToPaid: true,
      });
    }
    // Resolve to the fullest earned status now (Subscribed→Onboarded→Won→ROI→
    // Retained on renewal) instead of waiting up to 15 min for the engine tick.
    await leadService.recomputeFromAccount(vendorId);
  } catch (e) { console.error('[crm] subscription event hook failed (non-fatal):', e.message); }

  // A successful charge clears any earlier "renewal payment failed" bell — the
  // plan is active again, so resolve the SUBSCRIPTION_HALTED notice.
  require('../utils/inAppNotify').resolveInApp({ userId: vendorId, type: 'SUBSCRIPTION_HALTED' });

  return { activated: true };
}

/**
 * Record a single subscription charge (idempotent on razorpay_payment_id) +
 * post its ledger entry. Shared by activateFromSubscription (webhook) and the
 * reconciler backfill so the money logic lives in exactly one place.
 *
 * @param {object} p
 * @param {string} p.vendorId
 * @param {string} p.planSlug
 * @param {string} p.cadence     'monthly' | 'annual'
 * @param {object} p.rzpSub      Razorpay subscription entity (id, current_start/end)
 * @param {object} p.payment     Razorpay payment entity (id, order_id, fee/tax in paise)
 * @returns {Promise<{recorded:boolean, reason?:string}>}
 */
async function recordSubscriptionCharge({ vendorId, planSlug, cadence, rzpSub, payment }) {
  const paymentId = payment?.id || null;
  if (!paymentId) return { recorded: false, reason: 'no payment id' };

  // Idempotency: skip if this exact charge already booked. Throws on a failed
  // read (see activateFromSubscription) so a blip can't double-post the ledger.
  const { data: prior, error: priorErr } = await supabaseAdmin
    .from('subscription_payments').select('id').eq('razorpay_payment_id', paymentId).maybeSingle();
  if (priorErr) throw priorErr;
  if (prior) return { recorded: false, reason: 'already recorded' };

  const plan = await planService.getPlan(planSlug);
  const { gstRate } = await platformConfig.getConfig();
  const expectedPlanPrice = cadence === 'monthly' ? Number(plan.monthly_price) || 0 : Number(plan.annual_price) || 0;
  const expected = computeSubscriptionBreakdown({ planPrice: expectedPlanPrice, gstRate });

  // Guard against UPI-AutoPay mandate-authorization token charges. When a UPI
  // AutoPay mandate is registered Razorpay captures a ₹1–5 "auth" transaction to
  // validate it — status=paid but NOT a plan payment; recording it would stamp a
  // full plan price against a ₹1 capture (this is what once put a never-paying
  // admin-granted host into "Subscriptions Collected"). Skip only genuinely nominal
  // captures, measured against an ABSOLUTE ceiling — never the current plan price.
  // The old `captured < planPrice` test SILENTLY DISCARDED a genuine renewal on an
  // old-price mandate whenever the plan's list price was later raised above the
  // mandate's fixed gross amount. The plan-price side is kept only as a secondary
  // lower bound so a hypothetically sub-₹10 plan's real charge isn't mistaken for a token.
  const capturedRupees = payment?.amount != null ? round2(Number(payment.amount) / 100) : null;
  if (capturedRupees != null && capturedRupees <= AUTH_TOKEN_MAX_RUPEES &&
      (expectedPlanPrice <= 0 || capturedRupees + 0.01 < expectedPlanPrice)) {
    return { recorded: false, reason: `auth/token txn ₹${capturedRupees}` };
  }

  // Amount source of truth = what Razorpay ACTUALLY captured (a fixed, GST-inclusive
  // mandate amount), NOT the current DB plan price — which may have changed since the
  // mandate was created. GST is charged ON TOP for subscriptions, so back it out of
  // the captured gross to split taxable value + GST. This keeps invoice total ==
  // gateway amount even after a plan-price or GST-rate change. When the capture amount
  // is unknown (a webhook entity without an amount) we fall back to the expected breakdown.
  let planPrice, gstAmount, totalCharged;
  if (capturedRupees != null && capturedRupees > 0) {
    totalCharged = capturedRupees;
    planPrice = round2(totalCharged / (1 + gstRate));
    gstAmount = round2(totalCharged - planPrice);
  } else {
    ({ planPrice, gstAmount, totalCharged } = expected);
  }

  const periodStartIso = unixToIso(rzpSub?.current_start) || new Date().toISOString();
  const periodEndIso = unixToIso(rzpSub?.current_end) ||
    new Date(Date.now() + (cadence === 'monthly' ? 30 : 365) * 24 * 3600 * 1000).toISOString();
  // Prefer the real capture time; fall back to now.
  const paidIso = payment?.created_at ? new Date(Number(payment.created_at) * 1000).toISOString() : new Date().toISOString();

  // First charge for this subscription → initial; later → renewal.
  const { count: priorCount } = await supabaseAdmin
    .from('subscription_payments').select('id', { count: 'exact', head: true })
    .eq('razorpay_subscription_id', rzpSub.id);
  const kind = (priorCount || 0) === 0 ? 'initial' : 'renewal';

  // Gateway fee+tax — PLATFORM-borne for subscriptions (PRD §5.3). Paise → rupees.
  let feeTotal = 0, tax = 0;
  if (payment?.fee != null) feeTotal = Number(payment.fee) / 100;
  if (payment?.tax != null) tax = Number(payment.tax) / 100;
  tax = Math.min(tax, feeTotal);
  const feeExcl = Math.max(0, Math.round((feeTotal - tax) * 100) / 100);

  const { data: subPayment, error: subErr } = await supabaseAdmin
    .from('subscription_payments').insert({
      vendor_id: vendorId, plan_type: planSlug,
      plan_price: planPrice, gst_amount: gstAmount, total_charged: totalCharged,
      razorpay_fee: feeExcl, razorpay_tax: tax,
      razorpay_payment_id: paymentId, razorpay_order_id: payment?.order_id || null,
      razorpay_subscription_id: rzpSub.id, billing_cadence: cadence, kind,
      paid_at: paidIso, revenue_recognized_at: paidIso,
      billing_period_start: periodStartIso.slice(0, 10),
      billing_period_end: periodEndIso.slice(0, 10),
      status: 'paid',
    }).select().single();

  if (subErr) {
    if (subErr.code === '23505' || /duplicate key|unique constraint/i.test(subErr.message || '')) {
      return { recorded: false, reason: 'duplicate (raced)' };
    }
    console.error('subscription_payments insert failed:', subErr.message);
    return { recorded: false, reason: subErr.message };
  }

  try {
    const { subscriptionPaymentEntry } = require('./ledger/journalTemplates');
    const { postSafe } = require('./ledger/postingService');
    await postSafe({
      sourceType: 'SUBSCRIPTION_PAYMENT', sourceId: subPayment.id,
      journalDate: paidIso.slice(0, 10), template: subscriptionPaymentEntry(subPayment),
    });
  } catch (e) { console.error('subscription ledger error (non-fatal):', e.message); }

  // v3.67: GST tax invoice for the subscription (best-effort, idempotent).
  // Shared with the reconciler's backfill sweep — one code path mints invoices
  // so a silent failure here is self-healed later instead of lost forever.
  await ensureSubscriptionInvoice({
    id: subPayment.id,
    vendor_id: vendorId,
    plan_price: planPrice,
    gst_amount: gstAmount,
    paid_at: paidIso,
    razorpay_payment_id: paymentId,
  });

  // v3.77 Refer & Earn: a real (non-token) plan charge just booked for this host.
  // If they were referred, advance the referral toward its reward. Best-effort.
  try {
    await require('./referralService').onReferredCharge({ referredId: vendorId, planSlug, cadence });
  } catch (e) { console.error('referral qualify hook failed (non-fatal):', e.message); }

  return { recorded: true };
}

/**
 * Backfill EVERY paid invoice of a subscription that isn't yet booked. Heals
 * subscriptions whose charge was never recorded (activation granted access via
 * subscription.activated, but the subscription.charged webhook that carries the
 * payment was missed). Idempotent — recordSubscriptionCharge skips existing rows.
 *
 * @param {object} rzpSub Razorpay subscription entity (notes.vendor_id/plan/cadence)
 * @returns {Promise<{recorded:number}>}
 */
async function backfillSubscriptionPayments(rzpSub) {
  const notes = rzpSub?.notes || {};
  const vendorId = notes.vendor_id;
  const planSlug = planService.normalizeSlug(notes.plan);
  const cadence = normCadence(notes.cadence) || 'monthly';
  if (!vendorId || !notes.plan) return { recorded: 0 };

  const razorpaySubscriptions = require('./razorpaySubscriptions');
  let invoices = [];
  try { invoices = await razorpaySubscriptions.fetchSubscriptionInvoices(rzpSub.id); }
  catch (e) { console.error('backfill invoices fetch failed', rzpSub.id, e.message); return { recorded: 0 }; }

  let recorded = 0;
  for (const inv of invoices) {
    if (inv.status !== 'paid' || !inv.payment_id) continue;
    let payment = { id: inv.payment_id, order_id: inv.order_id || null };
    try { payment = await razorpaySubscriptions.fetchPayment(inv.payment_id); }
    catch (e) { console.error('backfill payment fetch failed', inv.payment_id, e.message); }
    const r = await recordSubscriptionCharge({ vendorId, planSlug, cadence, rzpSub, payment });
    if (r.recorded) recorded++;
  }
  return { recorded };
}

/**
 * Mint the GST tax invoice for one recorded subscription charge. Best-effort and
 * idempotent (create_invoice is unique on source_type+source_id), so it is safe
 * to call both inline at charge time AND from the reconciler backfill. Accepts a
 * subscription_payments row (or an equivalent shape) — reads plan_price/gst_amount
 * off the row so the money is never recomputed from a rate.
 *
 * @param {object} sp subscription_payments row: {id, vendor_id, plan_price,
 *                     gst_amount, paid_at, razorpay_payment_id}
 * @returns {Promise<object|null>} the invoice, or null on skip/failure
 */
async function ensureSubscriptionInvoice(sp) {
  if (!sp?.id) return null;
  try {
    const { generateInvoice } = require('./invoiceService');
    const { data: prof } = await supabaseAdmin
      .from('profiles').select('name, billing_details').eq('id', sp.vendor_id).maybeSingle();
    const bd = prof?.billing_details || {};
    return await generateInvoice({
      sourceType: 'subscription',
      sourceId: sp.id,
      paymentId: sp.razorpay_payment_id || null,
      issuedAt: sp.paid_at || null,
      buyer: {
        name: bd.name || prof?.name || 'Customer',
        address: bd.address || null,
        stateCode: bd.state_code || null,
        stateName: bd.state || null,
        gstin: bd.gstin || null,
        pan: bd.pan || null,
      },
      taxableValue: Number(sp.plan_price) || 0,
      gstAmount: Number(sp.gst_amount) || 0,
    });
  } catch (e) {
    console.error('ensureSubscriptionInvoice failed (non-fatal):', e.message);
    return null;
  }
}

/**
 * Send a subscription receipt email (purchase or renewal). Carries the amount
 * charged (plan + GST) and a direct link to the GST invoice PDF — the token-gated
 * invoice page prints itself. Falls back to the dashboard link when the invoice
 * or API_URL isn't resolvable. Best-effort: never throws.
 *
 * @param {object} p
 * @param {'SUBSCRIPTION_PURCHASED'|'SUBSCRIPTION_RENEWED'} p.event
 * @param {string} p.vendorId
 * @param {object} p.plan          plan record (monthly_price/annual_price/name)
 * @param {string} p.planSlug
 * @param {string} p.cadence       'monthly' | 'annual'
 * @param {string} p.periodEndIso  current period end (renews-on date)
 * @param {string|null} p.paymentId razorpay payment id of this charge (for the invoice link)
 */
async function sendSubscriptionReceiptEmail({ event, vendorId, plan, planSlug, cadence, periodEndIso, paymentId }) {
  try {
    const { data: prof } = await supabaseAdmin.from('profiles').select('name, email').eq('id', vendorId).single();
    const { gstRate } = await platformConfig.getConfig();
    const planPrice = cadence === 'monthly' ? Number(plan?.monthly_price) || 0 : Number(plan?.annual_price) || 0;
    const totalCharged = computeSubscriptionBreakdown({ planPrice, gstRate }).totalCharged;

    // Direct token-gated invoice link (the page prints itself to PDF).
    let invoice_url = `${process.env.CLIENT_URL || 'https://meeticulous.com'}/dashboard`;
    try {
      const apiBase = process.env.API_URL;
      if (apiBase && paymentId) {
        const { data: inv } = await supabaseAdmin
          .from('invoices').select('id, access_token').eq('payment_id', paymentId).maybeSingle();
        if (inv?.id && inv?.access_token) {
          invoice_url = `${apiBase.replace(/\/$/, '')}/api/invoices/${inv.id}?token=${encodeURIComponent(inv.access_token)}`;
        }
      }
    } catch (_) { /* keep dashboard fallback */ }

    await NotificationEngine.send({
      event,
      data: {
        email: prof?.email, emailUser: { name: prof?.name, email: prof?.email },
        emailData: {
          plan_name: plan?.name || planSlug,
          amount_charged: `₹${Number(totalCharged).toLocaleString('en-IN')}`,
          expiry_date: new Date(periodEndIso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
          invoice_url,
        },
        recipientUserId: vendorId,
      },
    }).catch((e) => console.error('subscription email error:', e.message));

    // Founder alert on every subscription charge (purchase + renewal). Fire-and-
    // forget; adminAlert never throws and is throttled per payment id so a resend
    // within the cooldown window can't double-ping.
    const isRenewal = event === 'SUBSCRIPTION_RENEWED';
    require('../utils/adminAlert').adminAlert({
      key: `sub_charge:${paymentId || vendorId}`,
      category: 'Payment Receipt',
      subject: isRenewal
        ? `Subscription renewed: ${plan?.name || planSlug}`
        : `New subscription: ${plan?.name || planSlug}`,
      lines: [
        `${prof?.name || 'A host'} (${prof?.email || 'no email'})`,
        `Plan: ${plan?.name || planSlug} (${cadence})`,
        `Amount: ₹${Number(totalCharged).toLocaleString('en-IN')}`,
        isRenewal ? 'Auto-renewal charge.' : 'New purchase / upgrade.',
      ],
      link: `${process.env.CLIENT_URL || 'https://meeticulous.com'}/admin/host360/${vendorId}`,
    });
  } catch (_) { /* non-fatal */ }
}

/**
 * Re-send the receipt email for one already-recorded charge (looked up by
 * razorpay payment id). Mints the invoice first if missing so the link resolves
 * to the PDF. Picks PURCHASED vs RENEWED from the row's kind. Shared by the
 * admin endpoint and the resend CLI so the logic lives in one place.
 *
 * @param {string} paymentId razorpay payment id
 * @returns {Promise<{ok:boolean, event?:string, vendorId?:string, reason?:string}>}
 */
async function resendReceiptForPayment(paymentId) {
  if (!paymentId) return { ok: false, reason: 'missing payment id' };
  const { data: sp } = await supabaseAdmin
    .from('subscription_payments')
    .select('id, vendor_id, plan_type, billing_cadence, kind, razorpay_payment_id, billing_period_end')
    .eq('razorpay_payment_id', paymentId).maybeSingle();
  if (!sp) return { ok: false, reason: 'no charge found for payment id' };

  await ensureSubscriptionInvoice(sp);

  const cadence = normCadence(sp.billing_cadence) || 'monthly';
  const plan = await planService.getPlan(planService.normalizeSlug(sp.plan_type));
  const { data: prof } = await supabaseAdmin
    .from('profiles').select('plan_expires_at').eq('id', sp.vendor_id).maybeSingle();
  const periodEndIso = prof?.plan_expires_at
    || (sp.billing_period_end ? new Date(sp.billing_period_end).toISOString() : new Date().toISOString());
  const event = sp.kind === 'renewal' ? 'SUBSCRIPTION_RENEWED' : 'SUBSCRIPTION_PURCHASED';

  await sendSubscriptionReceiptEmail({
    event, vendorId: sp.vendor_id, plan, planSlug: sp.plan_type, cadence, periodEndIso,
    paymentId: sp.razorpay_payment_id,
  });
  return { ok: true, event, vendorId: sp.vendor_id };
}

/**
 * Backfill GST invoices for paid subscription charges that have none. Heals the
 * silent gap where generateInvoice failed at charge time (best-effort → the row
 * existed but no invoice did, permanently). Idempotent; cheap once every charge
 * is invoiced. Returns how many invoices it minted this pass.
 *
 * @param {number} [limit] max charges to scan per pass
 * @returns {Promise<{minted:number, scanned:number}>}
 */
async function backfillMissingInvoices(limit = 200) {
  // Recent paid charges, then subtract the ones that already have an invoice.
  const { data: charges } = await supabaseAdmin
    .from('subscription_payments')
    .select('id, vendor_id, plan_price, gst_amount, paid_at, razorpay_payment_id')
    .eq('status', 'paid')
    .order('paid_at', { ascending: false })
    .limit(limit);
  if (!charges?.length) return { minted: 0, scanned: 0 };

  const { data: existing } = await supabaseAdmin
    .from('invoices').select('source_id')
    .eq('source_type', 'subscription')
    .in('source_id', charges.map((c) => c.id));
  const invoiced = new Set((existing || []).map((r) => r.source_id));

  let minted = 0;
  for (const c of charges) {
    if (invoiced.has(c.id)) continue;
    const inv = await ensureSubscriptionInvoice(c);
    if (inv) minted++;
  }
  return { minted, scanned: charges.length };
}

// Emit a CRM lifecycle event for the host owning a subscription. Looks the host
// up by mandate id (rzpSub carries no vendor_id on cancel/halt webhooks).
async function crmSubEvent(rzpSubId, type, title, meta = {}, opts = {}) {
  try {
    if (!rzpSubId) return;
    const { data: prof } = await supabaseAdmin.from('profiles')
      .select('id').eq('razorpay_subscription_id', rzpSubId).maybeSingle();
    if (!prof?.id) return;
    // Churn/halt are NOT status regressions — they stay a paid customer until the
    // paid term lapses (resolveVendorPlan downgrades then). Record the event only.
    const leadId = await require('./crm/leadService').recordAccountEvent({ profileId: prof.id, type, title, meta });
    if (!leadId) return;
    // Phase 4: a deduped follow-up task in the owner's queue. Creates work, sends nothing.
    if (opts.followUp) await require('./crm/followUpService').openAuto({ leadId, ...opts.followUp });
    // Sends redesign: enrol into an offer/win-back sequence (gated by the kill-switch),
    // and/or fire an urgent WhatsApp. Both best-effort — never break the webhook.
    if (opts.enroll) await require('./crm/sequenceService').enrollByName(opts.enroll, leadId, `event:${type}`);
    if (opts.whatsapp) {
      await require('./crm/messageService').enqueue({
        leadId, channel: 'whatsapp', templateKey: opts.whatsapp.template,
        variables: { params: opts.whatsapp.params || [] }, senderKey: opts.whatsapp.senderKey || 'tithi',
        idempotencyKey: `evt:${type}:${leadId}`, createdBy: `event:${type}`, immediate: false,
      });
    }
  } catch (e) { console.error('[crm] subscription lifecycle hook failed (non-fatal):', e.message); }
}

/** subscription.halted — repeated charge failure. Keep plan flag, mark halted. */
async function markHalted(rzpSub) {
  if (!rzpSub?.id) return;
  const { data: hosts } = await supabaseAdmin.from('profiles')
    .update({ subscription_status: 'halted', updated_at: new Date().toISOString() })
    .eq('razorpay_subscription_id', rzpSub.id)
    .select('id, name, email, plan');
  // Transactional notice to the host: a failed renewal silently paused their plan.
  // (The CRM WhatsApp nudge below is gated by the crm_admin_sends kill-switch —
  // this is the un-gated email + in-app the host always gets.) Never throws.
  const host = hosts && hosts[0];
  if (host) {
    const firstName = (host.name || '').split(' ')[0] || 'there';
    await NotificationEngine.send({
      event: 'SUBSCRIPTION_HALTED',
      data: {
        email: host.email, name: host.name,
        recipientUserId: host.id,
        emailUser: { name: host.name, email: host.email },
        emailData: { first_name: firstName, plan_name: host.plan || 'your plan' },
        inApp: {
          title: 'Renewal payment failed',
          body: 'Your plan is paused — update your payment method to keep it.',
          link: '/dashboard/upgrade',
        },
      },
    });
  }
  await crmSubEvent(rzpSub.id, 'subscription_payment_failed', 'Subscription halted — payment failing', {}, {
    followUp: { key: 'auto:payment_failed', title: 'Payment failing — reach out to retain', dueInDays: 0 },
    // Same-day urgent WhatsApp — AiSensy Campaign Name (approved).
    // Subscription Payment Failed params: {{1}} name, {{2}} payments link.
    whatsapp: { template: 'Subscription Payment Failed', params: ['{{first_name}}', '{{booking_link}}/dashboard/payments'], senderKey: 'tithi' },
  });
}

/**
 * subscription.cancelled — access is retained until current_period_end;
 * resolveVendorPlan() downgrades to starter once plan_expires_at passes.
 */
async function markCancelled(rzpSub) {
  if (!rzpSub?.id) return;
  await supabaseAdmin.from('profiles')
    .update({ subscription_status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('razorpay_subscription_id', rzpSub.id);
  await crmSubEvent(rzpSub.id, 'subscription_cancelled', 'Subscription cancelled (churn)', {}, {
    followUp: { key: 'auto:churn', title: 'Win back — subscription cancelled', dueInDays: 1 },
    // Enrol into the win-back OFFER sequence (Tithi nudge → Sujata offer → WA → call).
    enroll: 'Churn-winback',
  });
}

module.exports = { activateFromSubscription, recordSubscriptionCharge, ensureSubscriptionInvoice, sendSubscriptionReceiptEmail, resendReceiptForPayment, backfillSubscriptionPayments, backfillMissingInvoices, markHalted, markCancelled, ACTIVE_STATES };
