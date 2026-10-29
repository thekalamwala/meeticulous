/**
 * notificationEngine.js — central, DB-configured notification dispatcher.
 *
 * Business logic emits semantic events:
 *   NotificationEngine.send({ event: 'BOOKING_CONFIRMED_CUSTOMER', data: {...} })
 *
 * The engine — never the callers — decides:
 *   - WhatsApp enabled? (notification_events.whatsapp_enabled + provider active)
 *   - Email enabled?    (notification_events.email_enabled)
 *   - Which AiSensy campaign? (notification_events.campaign_name)
 *   - Which provider credentials? (notification_providers)
 * Every attempt is written to notification_logs.
 *
 * data contract:
 *   {
 *     phone:          recipient phone (WhatsApp)
 *     name:           recipient display name
 *     templateParams: ordered array for the WhatsApp template
 *     email:          recipient email address
 *     emailHtml:      rendered HTML body (callers keep their templates)
 *     emailSubject:   optional override; falls back to event.email_subject
 *   }
 *
 * Resilient by design: if the v1.9 tables don't exist yet (schema fallback
 * pattern), the engine falls back to email-only with defaults so production
 * never breaks.
 */

const { supabaseAdmin } = require('../config/supabase');
const aisensy = require('./aisensyService');
const communicationEngine = require('./email/communicationEngine');
const { inAppNotify } = require('../utils/inAppNotify');
const { isLoadTestMode } = require('../config/loadTestMode');

const CACHE_TTL_MS = 60 * 1000;
let _cache = { at: 0, events: null, providers: null };

const _isMissingSchema = (error) =>
  error && /Could not find the|does not exist|relation .* does not exist/i.test(error.message || '');

const loadConfig = async () => {
  const now = Date.now();
  if (_cache.events && now - _cache.at < CACHE_TTL_MS) return _cache;

  const [evRes, prRes] = await Promise.all([
    supabaseAdmin.from('notification_events').select('*'),
    supabaseAdmin.from('notification_providers').select('*'),
  ]);

  if (_isMissingSchema(evRes.error) || _isMissingSchema(prRes.error)) {
    // v1.9 migration not applied — email-only fallback
    _cache = { at: now, events: new Map(), providers: new Map(), schemaMissing: true };
    return _cache;
  }

  const events = new Map((evRes.data || []).map((e) => [e.event_key, e]));
  const providers = new Map((prRes.data || []).map((p) => [p.provider, p]));
  _cache = { at: now, events, providers, schemaMissing: false };
  return _cache;
};

const clearCache = () => { _cache = { at: 0, events: null, providers: null }; };

// Events the WhatsApp opt-out (STOP) does NOT suppress: user-requested, foreground
// authentication codes. Blocking these would strand an opted-out guest who is
// actively trying to book/verify right now, and they aren't business-initiated.
const WHATSAPP_OPT_OUT_EXEMPT = new Set(['BOOKING_OTP', 'WHATSAPP_VERIFY_OTP']);

// Vendor-recipient lifecycle events that don't carry a _VENDOR suffix.
// (Hosts own profiles, plans, badges/metrics — these always reach a vendor.)
const VENDOR_EVENTS = new Set([
  'VENDOR_WELCOME',
  'PROFILE_COMPLETION_REMINDER', 'PROFILE_VERIFIED', 'PROFILE_REJECTED',
  'KYC_APPROVED', 'KYC_REJECTED', 'KYC_EARN_NUDGE',
  'PAYOUT_SENT', 'PAYOUT_VERIFICATION_NEEDED', 'PAYOUT_FAILED', 'EARNING_REVERSED', 'PAYOUT_DELAY_HOLIDAY',
  'BADGE_UNLOCKED',
  'MILESTONE_FIRST_BOOKING', 'MILESTONE_10_BOOKINGS', 'MILESTONE_50_BOOKINGS', 'MILESTONE_100_BOOKINGS',
  'SUBSCRIPTION_PURCHASED', 'SUBSCRIPTION_EXPIRING', 'SUBSCRIPTION_RENEWED', 'SUBSCRIPTION_HALTED',
  'REFERRAL_REWARD_RELEASED',
]);

/**
 * Resolve the RECIPIENT audience that selects the email layout shell.
 * Explicit data.audience always wins. Otherwise inferred from the event key:
 *   *_VENDOR / known vendor-lifecycle event → 'vendor' (host-branded shell)
 *   *_CUSTOMER                              → 'customer'
 *   else                                    → 'all' (→ customer/BAS-branded shell;
 *                                             correct for OTP/auth/security/generic)
 */
const inferAudience = (event, explicit) => {
  if (explicit) return explicit;
  if (/_VENDOR$/.test(event) || VENDOR_EVENTS.has(event)) return 'vendor';
  if (/_CUSTOMER$/.test(event)) return 'customer';
  return 'all';
};

const logResult = async ({ event, channel, destination, status, response, error, payload }) => {
  try {
    await supabaseAdmin.from('notification_logs').insert({
      event_key: event,
      channel,
      destination: destination || 'unknown',
      status,
      response: response || {},
      error: error || null,
      payload: payload || {},
    });
  } catch (_) { /* logging must never break the flow */ }
};

/**
 * Send a notification for a semantic event.
 * Never throws — returns { whatsapp, email } result objects.
 */
const send = async ({ event, data = {} }) => {
  if (isLoadTestMode()) {
    // Load test: never touch real providers. Shape mirrors the real return
    // so callers (notify.js reads .email.success / .whatsapp.success) work.
    return {
      event,
      whatsapp: { attempted: false, success: true, stub: true },
      email: { attempted: false, success: true, stub: true },
    };
  }
  const results = { event, whatsapp: { attempted: false }, email: { attempted: false }, inApp: { attempted: false } };
  if (!event) return results;

  let cfg;
  try {
    cfg = await loadConfig();
  } catch (err) {
    cfg = { events: new Map(), providers: new Map(), schemaMissing: true };
  }

  const evt = cfg.events.get(event);
  // Defaults when event row missing / schema missing: email on, whatsapp off.
  // In-app defaults ON (a caller only reaches it by explicitly passing data.inApp),
  // so new in-app notes work before v3.130 is applied; once the row exists the
  // admin-set in_app_enabled flag wins.
  const emailEnabled    = evt ? !!evt.email_enabled && !!evt.is_active : true;
  const whatsappEnabled = evt ? !!evt.whatsapp_enabled && !!evt.is_active : false;
  const inAppEnabled    = evt ? !!evt.in_app_enabled && !!evt.is_active : true;

  // ── WhatsApp via AiSensy ─────────────────────────────────────
  const provider = cfg.providers.get('aisensy');
  if (whatsappEnabled && provider && provider.is_active && data.phone) {
    results.whatsapp.attempted = true;
    // P1-06: honor the WhatsApp opt-out (inbound STOP → contacts.whatsapp_suppressed)
    // for TRANSACTIONAL sends too — previously only the marketing path checked it.
    // contacts.phone is stored AiSensy-normalized, so match on the same function.
    // OTP/auth events are EXEMPT: the user just requested them in a foreground flow
    // (they'd be stranded mid-booking otherwise), and they aren't business-initiated.
    let suppressed = false;
    if (!WHATSAPP_OPT_OUT_EXEMPT.has(event)) {
      const normPhone = aisensy.normalizePhone(data.phone);
      if (normPhone) {
        try {
          const { data: contact } = await supabaseAdmin
            .from('contacts').select('whatsapp_suppressed').eq('phone', normPhone).maybeSingle();
          suppressed = !!contact?.whatsapp_suppressed;
        } catch (_) { /* contacts unavailable → don't block the send */ }
      }
    }
    if (suppressed) {
      results.whatsapp = { attempted: true, success: false, suppressed: true };
      await logResult({
        event, channel: 'whatsapp', destination: data.phone, status: 'suppressed',
        response: {}, error: 'recipient opted out of WhatsApp (STOP)',
        payload: { campaignName: evt.campaign_name },
      });
    } else {
      const params = {
        apiKey: provider.api_key,
        campaignName: evt.campaign_name,
        destination: data.phone,
        userName: data.name,
        templateParams: data.templateParams || [],
        buttonParams: data.buttonParams || [],   // copy-code button (auth/OTP templates)
      };
      const r = await aisensy.sendCampaign(params);
      results.whatsapp = { attempted: true, ...r };
      await logResult({
        event, channel: 'whatsapp', destination: data.phone,
        status: r.success ? 'sent' : 'failed',
        response: r.response, error: r.error,
        payload: { campaignName: evt.campaign_name, userName: data.name, templateParams: data.templateParams || [], buttonParams: data.buttonParams || [] },
      });
      if (!r.success) {
        // Surface a silent WhatsApp breakage (template-param mismatch, out-of-credits,
        // provider outage) instead of it only living in notification_logs — the
        // "Booking Confirmed" template mismatch failed unnoticed for ~5 weeks.
        // Fire-and-forget; adminAlert never throws and is throttled per key, so a
        // burst of the same failure sends ONE alert, not one per send.
        require('../utils/adminAlert').adminAlert({
          key: `wa_fail:${event}`,
          subject: `WhatsApp send failing: ${event}`,
          lines: [
            `Event: ${event}`,
            `Campaign: ${evt.campaign_name || '(none)'}`,
            `To: ${data.phone}`,
            `Error: ${r.error || 'unknown'}`,
            `Check the AiSensy template variable count vs the app templateParams, or the AiSensy conversation-credit balance.`,
          ],
        });
      }
    }
  }

  // ── Email via the Communication Engine (DB template + queue + log) ───
  // No inline HTML here: business logic passes structured placeholder data and
  // the engine resolves the DB template, renders the standard layout, queues,
  // sends via the configured provider and records to email_logs.
  if (emailEnabled && data.email) {
    results.email.attempted = true;
    const r = await communicationEngine.send({
      event,
      to: data.email,
      audience: inferAudience(event, data.audience),
      data: data.emailData || {},
      user: data.emailUser || { email: data.email, name: data.name },
      recipientUserId: data.recipientUserId || null,
      bookingId: data.bookingId || null,
      immediate: !!data.immediateEmail,
    });
    results.email = { attempted: true, success: !!r.ok, status: r.status, error: r.error || r.reason };
    // notification_logs keeps the cross-channel summary; email_logs has detail.
    await logResult({
      event, channel: 'email', destination: data.email,
      status: r.status === 'sent' ? 'sent' : (r.status === 'queued' ? 'pending' : 'failed'),
      error: r.error || r.reason || null,
      payload: { via: 'communicationEngine', logId: r.logId || null },
    });
  }

  // ── In-app feed (bell) ───────────────────────────────────────
  // Fires when the caller supplies data.inApp {title, body?, link?} and the event
  // permits it — the same one-call fan-out as email/WhatsApp, so a lifecycle event
  // no longer needs a separate hand-written inAppNotify at the call-site. inAppNotify
  // itself is fire-and-forget and never throws into this path.
  if (inAppEnabled && data.recipientUserId && data.inApp && data.inApp.title) {
    const role = inferAudience(event, data.audience) === 'vendor' ? 'host' : 'guest';
    inAppNotify({
      userId: data.recipientUserId, role, type: event,
      title: data.inApp.title, body: data.inApp.body || null,
      link: data.inApp.link || null, data: data.inApp.data || {},
    });
    results.inApp = { attempted: true, success: true };
    await logResult({
      event, channel: 'in_app', destination: String(data.recipientUserId),
      status: 'sent', payload: { title: data.inApp.title, link: data.inApp.link || null },
    });
  }

  return results;
};

module.exports = { send, loadConfig, clearCache, logResult, inferAudience };
