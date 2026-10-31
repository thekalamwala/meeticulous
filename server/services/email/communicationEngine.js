/**
 * communicationEngine.js — centralized email authority (PRD).
 *
 * Business event → resolve template → resolve placeholders → layout →
 * (OTP: send now | else: queue) → provider → delivery log.
 *
 * Business logic NEVER builds HTML or calls a provider directly. It calls:
 *   communicationEngine.send({ event, to, data, user, immediate?, bookingId? })
 *
 * Everything is logged in email_logs, which also backs the retry queue.
 */

'use strict';

const { supabaseAdmin } = require('../../config/supabase');
const { buildGlobals, resolveTemplate, resolveString } = require('./placeholderResolver');
const { renderLayout } = require('./emailLayout');
const { getProvider, MARKETING_PROVIDER } = require('./providers');
const { makeToken } = require('./unsubscribeToken');
const senderRegistry = require('./senderRegistry');

// Marketing / lifecycle events that honor the unsubscribe list. Everything NOT
// listed here (OTP, auth, security, booking confirmations, payment receipts,
// subscription receipts) is transactional and ALWAYS sends — the CAN-SPAM /
// GDPR carve-out. Bulk campaigns (event_key 'CAMPAIGN:<id>') are always marketing.
const MARKETING_EVENTS = new Set([
  'BADGE_UNLOCKED',
  'MILESTONE_FIRST_BOOKING', 'MILESTONE_10_BOOKINGS', 'MILESTONE_50_BOOKINGS', 'MILESTONE_100_BOOKINGS',
  'BIRTHDAY', 'ACCOUNT_ANNIVERSARY',
  'PROFILE_COMPLETION_REMINDER',
  'REBOOK_NUDGE_CUSTOMER',
  'UPGRADE_COMMISSION_NUDGE',
  // Newsletter, cross-sell, cart-recovery and onboarding nudges are promotional/
  // bulk — they keep the unsubscribe footer (legal opt-out) and may file under
  // Updates. Everything NOT listed here is transactional → clean footer → Primary.
  'NEWSLETTER_WELCOME',
  'GUEST_TO_HOST_INVITE',
  'BOOKING_ABANDONED_CUSTOMER',
  'HOST_ADD_SERVICE_NUDGE', 'HOST_SHARE_LINK_NUDGE', 'HOST_FIRST_BOOKING_NUDGE', 'HOST_PAYOUT_WAITING_NUDGE',
]);

const isMarketing = (event) => MARKETING_EVENTS.has(event) || String(event).startsWith('CAMPAIGN:');

/**
 * Has this address opted out of marketing email? Fails OPEN: if the table is
 * missing or the query errors, returns false so transactional/lifecycle mail is
 * never silently dropped by an infra problem.
 */
async function isUnsubscribed(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  try {
    const { data, error } = await supabaseAdmin
      .from('email_unsubscribes').select('email').eq('email', e).maybeSingle();
    if (error) return false;
    return !!data;
  } catch (_) {
    return false;
  }
}

// Retry delays (minutes) after a failed send: 5m, 30m, 2h, then permanent fail.
const BACKOFFS_MIN = [5, 30, 120];
const CACHE_TTL_MS = 60 * 1000;

let _settingsCache = { at: 0, value: null };
let _templateCache = { at: 0, map: null };

const isMissingSchema = (e) =>
  e && /Could not find the|does not exist|relation .* does not exist/i.test(e.message || '');

async function loadSettings() {
  const now = Date.now();
  if (_settingsCache.value && now - _settingsCache.at < CACHE_TTL_MS) return _settingsCache.value;
  let value = {
    provider: 'smtp', from_name: 'Meeticulous', from_email: '',
    support_email: 'hello@mail.meeticulous.in', website_url: 'https://meeticulous.com',
    logo_url: '', brand_color: '#960D32', footer_html: '',
  };
  try {
    const { data } = await supabaseAdmin.from('email_settings').select('*').eq('id', 1).maybeSingle();
    if (data) value = { ...value, ...data };
  } catch (_) { /* defaults */ }
  _settingsCache = { at: now, value };
  return value;
}

async function loadTemplates() {
  const now = Date.now();
  if (_templateCache.map && now - _templateCache.at < CACHE_TTL_MS) return _templateCache.map;
  const map = new Map(); // `${event_key}:${audience}` → template
  try {
    const { data, error } = await supabaseAdmin
      .from('email_templates').select('*').eq('status', 'active');
    if (!error) for (const t of data || []) map.set(`${t.event_key}:${t.audience}`, t);
  } catch (_) { /* empty */ }
  _templateCache = { at: now, map };
  return map;
}

function clearCache() {
  _settingsCache = { at: 0, value: null };
  _templateCache = { at: 0, map: null };
  senderRegistry.clearCache();
}

/** Active template for an event; prefers an exact audience, falls back to 'all'. */
async function getTemplate(event, audience = 'all') {
  const map = await loadTemplates();
  return map.get(`${event}:${audience}`) || map.get(`${event}:all`) || null;
}

/**
 * Render a template to a full HTML document (no DB writes).
 * `audience` selects the layout shell (vendor vs customer); it is the RECIPIENT
 * audience, not the template row tag. Defaults to 'all' → customer shell.
 */
function renderEmail(template, { data = {}, user = {}, settings, audience = 'all', marketing } = {}) {
  const globals = buildGlobals(settings, user);
  const r = resolveTemplate(template, data, globals);
  // Resolve the preheader too — otherwise raw {{tokens}} leak into the inbox preview.
  const previewText = resolveString(data.preview_text || template.preview_text || '', { ...globals, ...data }).text;
  const html = renderLayout({
    audience,
    bodyHtml: r.html, previewText,
    ctaLabel: r.ctaLabel, ctaUrl: r.ctaUrl, settings,
    emailCategory: template.email_category || '',
    data,
    // Only marketing mail gets the unsubscribe/nav footer; transactional stays
    // clean so Gmail files it in Primary, not Updates. Campaign/composer sends
    // pass marketing:true explicitly (no event_key to classify, but always bulk).
    marketing: marketing ?? isMarketing(template.event_key),
  });
  return { subject: r.subject, html, missing: r.missing };
}

// Minimal HTML → plain-text for the text/plain alternative. A multipart message
// (not html-only) is a strong "real/transactional" signal for inbox placement.
function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(?:br|\/p|\/div|\/tr|\/h[1-6])\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&middot;/g, '·')
    .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');
}

async function insertLog(row) {
  const { data, error } = await supabaseAdmin.from('email_logs').insert(row).select('id').single();
  if (error) { console.error('email_logs insert failed:', error.message); return null; }
  return data?.id || null;
}

// `providerName` overrides email_settings.provider for this one send — bulk
// campaigns pass MARKETING_PROVIDER so they leave Resend's transactional quota
// alone. Omitted → the global provider (Resend in prod). No fallback: a marketing
// send that fails stays on the marketing provider and is retried by the queue.
// One-click unsubscribe headers (RFC 8058) for marketing mail — Gmail/Yahoo
// require these on bulk, and they help keep promo out of the spam folder. The
// token is deterministic from the recipient, so it works for queued rows too.
function unsubHeaders(settings, to) {
  const site = settings.website_url || 'https://meeticulous.com';
  const support = settings.support_email || 'team@meeticulous.com';
  const url = `${site}/unsubscribe?u=${makeToken(to)}`;
  return {
    'List-Unsubscribe': `<${url}>, <mailto:${support}?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

async function deliver({ settings, to, subject, html, sender, providerName, marketing = false }) {
  // Provider precedence: the sender's own provider (per-stream split) > an explicit
  // override > the global transactional default. Lets marketing route to a different
  // ESP than booking/OTP once sender rows carry a provider.
  const provider = getProvider(sender?.provider || providerName || settings.provider);
  const res = await provider.sendEmail({
    to, subject, html,
    text: htmlToText(html), // plain-text twin → multipart, better inbox placement
    fromName: sender?.fromName ?? settings.from_name,
    fromEmail: sender?.fromEmail ?? settings.from_email,
    replyTo: sender?.replyTo || settings.support_email || null,
    headers: marketing ? unsubHeaders(settings, to) : undefined,
  });
  return { provider: provider.name, ...res };
}

/**
 * Send an email for a business event.
 * @param {object} opts
 * @param {string} opts.event       event key (must have an active template)
 * @param {string} opts.to          recipient email
 * @param {object} [opts.data]      placeholder values (booking_date, otp, ...)
 * @param {object} [opts.user]      { name, email, username } for global placeholders
 * @param {string} [opts.audience]  'customer' | 'vendor' | 'all'
 * @param {string} [opts.recipientUserId]
 * @param {string} [opts.bookingId]
 * @param {boolean} [opts.immediate] true for OTP — bypasses the queue
 * @param {boolean} [opts.isTest]   test send (marked, excluded from normal logs)
 * @returns {{ ok, status, logId?, reason?, error? }}
 */
async function send(opts) {
  const {
    event, to, data = {}, user = {}, audience = 'all',
    recipientUserId = null, bookingId = null, immediate = false, isTest = false,
  } = opts || {};
  if (!event || !to) return { ok: false, reason: 'event and to are required' };

  const settings = await loadSettings();
  const template = await getTemplate(event, audience);
  if (!template) {
    console.warn(`communicationEngine: no active template for ${event} (${audience})`);
    // Observability (E4): a missing template silently sends nothing and left no
    // trace before. Write a queryable no_template row + one throttled alert so a
    // deactivated/absent template is visible instead of an invisible no-send.
    // (email_logs.status has no CHECK; template_id is nullable — no migration.)
    if (!isTest) {
      await insertLog({ event_key: event, audience, recipient: to, status: 'no_template', attempts: 0 });
      require('../../utils/adminAlert').adminAlert({
        key: `email_no_template:${event}:${audience}`,
        subject: `Email has no active template: ${event}`,
        lines: [
          `Event: ${event}`, `Audience: ${audience}`, `Recipient: ${to}`,
          `No active email_templates row matched ${event}:${audience} or ${event}:all — this email was NOT sent.`,
        ],
      });
    }
    return { ok: false, reason: 'no_template' };
  }

  // Signed unsubscribe token for the customer-footer link (recovered statelessly
  // on click). Harmless for shells without an unsubscribe link (vendor).
  const sendData = { ...data, unsubscribe_token: data.unsubscribe_token || makeToken(to) };
  const { subject, html, missing } = renderEmail(template, { data: sendData, user, settings, audience });
  // Resolve the FROM persona (Tithi/Durga/…) for this template. Falls back to the
  // global settings sender when the template has no sender_key (schema-safe).
  const sender = await senderRegistry.senderFor(template, settings);
  // Observability (E1): an unresolved placeholder renders as '' — silent blank
  // content. Globals are always present, so any 'missing' token is a real
  // template/caller drift. Surface it (throttled per event+tokens) instead of
  // shipping a blanked email nobody notices.
  if (!isTest && missing && missing.length) {
    console.warn(`communicationEngine: unresolved placeholders for ${event} (${audience}): ${missing.join(', ')}`);
    require('../../utils/adminAlert').adminAlert({
      key: `email_missing:${event}:${missing.join(',')}`,
      subject: `Email placeholders unresolved: ${event}`,
      lines: [
        `Event: ${event}`, `Audience: ${audience}`, `Missing: ${missing.join(', ')}`,
        `These tokens rendered blank. Add them to the caller data, or remove them from the template.`,
      ],
    });
  }

  const baseLog = {
    event_key: event, template_id: template.id, audience: template.audience,
    recipient: to, recipient_user_id: recipientUserId, booking_id: bookingId,
    subject, html, is_test: isTest,
  };

  // Marketing email to an opted-out address → suppress (never reaches the queue).
  // Transactional events bypass this entirely. Real sends only (not test/immediate-OTP).
  if (!isTest && !immediate && isMarketing(event) && await isUnsubscribed(to)) {
    const logId = await insertLog({ ...baseLog, status: 'suppressed', attempts: 0, sent_at: null });
    return { ok: true, status: 'suppressed', logId };
  }

  // Test send → deliver now, mark TEST (kept out of the normal logs view)
  if (isTest) {
    const r = await deliver({ settings, to, subject, html, sender, marketing: isMarketing(event) });
    await insertLog({ ...baseLog, status: r.success ? 'test' : 'failed',
      provider: r.provider, provider_response: r.response || {}, error: r.error || null,
      attempts: 1, sent_at: new Date().toISOString() });
    return { ok: r.success, status: 'test', error: r.error };
  }

  // OTP / critical → immediate send (PRD §17)
  if (immediate) {
    const r = await deliver({ settings, to, subject, html, sender, marketing: isMarketing(event) });
    const logId = await insertLog({ ...baseLog,
      status: r.success ? 'sent' : 'queued', provider: r.provider,
      provider_response: r.response || {}, error: r.error || null,
      attempts: 1, sent_at: r.success ? new Date().toISOString() : null,
      next_attempt_at: r.success ? null : new Date(Date.now() + BACKOFFS_MIN[0] * 60000).toISOString() });
    return { ok: r.success, status: r.success ? 'sent' : 'queued', logId, error: r.error };
  }

  // Everything else → queue for the worker. The email_logs row IS the queue, so a
  // failed insert (logId null) means nothing will ever be delivered — surface that
  // as a failure instead of a false 'queued' success (P2-09).
  const logId = await insertLog({ ...baseLog, status: 'queued', attempts: 0,
    next_attempt_at: new Date().toISOString() });
  if (!logId) return { ok: false, status: 'log_failed', reason: 'email_logs insert failed' };
  return { ok: true, status: 'queued', logId };
}

// The cross-channel notification_logs row for a queued email is written as
// 'pending' at enqueue time (notificationEngine.logResult) and never revisited —
// so the admin "Notification Settings" log showed every async email stuck on
// 'pending' even after the worker delivered it (WhatsApp is synchronous, so it
// logged the real status). Back-fill that row here, matched by the email_logs id
// the engine stored in payload.logId. Fire-and-forget + schema-safe: a missing
// table/column or no matching row must never disturb the delivery path.
async function syncNotificationLog(logId, status) {
  if (!logId) return;
  try {
    await supabaseAdmin.from('notification_logs')
      .update({ status })
      .eq('channel', 'email')
      .filter('payload->>logId', 'eq', String(logId));
  } catch (_) { /* log sync must never break delivery */ }
}

/**
 * Queue worker — processes due 'queued' emails with retry backoff.
 * Called on an interval from server.js.
 * @returns {{ processed, sent, failed, retried }}
 */
async function processQueue(limit = 25) {
  const settings = await loadSettings();
  const nowIso = new Date().toISOString();

  let rows = [];
  try {
    const { data, error } = await supabaseAdmin
      .from('email_logs').select('*')
      .eq('status', 'queued').lte('next_attempt_at', nowIso)
      .order('next_attempt_at', { ascending: true }).limit(limit);
    if (error) { if (!isMissingSchema(error)) console.error('queue read:', error.message); return { processed: 0, sent: 0, failed: 0, retried: 0 }; }
    rows = data || [];
  } catch (_) { return { processed: 0, sent: 0, failed: 0, retried: 0 }; }

  let sent = 0, failed = 0, retried = 0;
  for (const row of rows) {
    const attemptsMade = (row.attempts || 0) + 1;
    // Sender is a property of the template, resolved here at delivery time (the
    // queued row stores rendered html/subject but not the persona). Missing
    // template → null → global fallback.
    const rowTemplate = await getTemplate(row.event_key, row.audience);
    let rowSender = await senderRegistry.senderFor(rowTemplate, settings);
    // Composer campaigns carry no template — their persona lives on the campaign
    // row (sender_key, default 'shubham'). Prefer it when present. Schema-safe:
    // a select error pre-migration leaves camp null → keeps the global fallback.
    if (String(row.event_key || '').startsWith('CAMPAIGN:')) {
      const campId = row.event_key.slice('CAMPAIGN:'.length);
      const { data: camp } = await supabaseAdmin.from('email_campaigns').select('sender_key').eq('id', campId).maybeSingle();
      rowSender = (camp && await senderRegistry.byKey(camp.sender_key)) || rowSender;
    }
    // Bulk campaigns go out on the dedicated marketing SMTP transport (off Resend);
    // transactional + lifecycle queued rows keep the global provider.
    const providerName = String(row.event_key || '').startsWith('CAMPAIGN:') ? MARKETING_PROVIDER : null;
    const r = await deliver({ settings, to: row.recipient, subject: row.subject, html: row.html, sender: rowSender, providerName, marketing: isMarketing(row.event_key) });

    if (r.success) {
      await supabaseAdmin.from('email_logs').update({
        status: 'sent', attempts: attemptsMade, provider: r.provider,
        provider_response: r.response || {}, error: null,
        // Resend email id — lets the delivery webhook match this row later (v3.138).
        provider_message_id: r.id || r.response?.id || null,
        sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq('id', row.id);
      await syncNotificationLog(row.id, 'sent');
      sent++;
    } else if (attemptsMade <= BACKOFFS_MIN.length) {
      // schedule the next retry (5m → 30m → 2h)
      const delayMin = BACKOFFS_MIN[attemptsMade - 1];
      await supabaseAdmin.from('email_logs').update({
        status: 'queued', attempts: attemptsMade, provider: r.provider,
        error: r.error || 'send failed',
        next_attempt_at: new Date(Date.now() + delayMin * 60000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', row.id);
      retried++;
    } else {
      // exhausted retries → permanent failure
      await supabaseAdmin.from('email_logs').update({
        status: 'failed', attempts: attemptsMade, provider: r.provider,
        error: r.error || 'send failed (max retries)', updated_at: new Date().toISOString(),
      }).eq('id', row.id);
      await syncNotificationLog(row.id, 'failed');
      failed++;
      // Observability parity with WhatsApp (E2): a permanently-failed email
      // (provider outage, bad address, exhausted retries) previously only lived in
      // email_logs. Alert once per event (throttled) so it doesn't go unnoticed the
      // way the WhatsApp confirmation break did for 5 weeks.
      require('../../utils/adminAlert').adminAlert({
        key: `email_fail:${row.event_key}`,
        subject: `Email send failing: ${row.event_key}`,
        lines: [
          `Event: ${row.event_key}`, `To: ${row.recipient}`, `Attempts: ${attemptsMade}`,
          `Error: ${r.error || 'unknown'}`,
          `Provider: ${r.provider || 'unknown'}`,
          `Exhausted retries (${BACKOFFS_MIN.join('/')} min). Check the email provider (${r.provider || 'Resend'}) status/credits or the recipient address.`,
        ],
      });
    }
  }
  return { processed: rows.length, sent, failed, retried };
}

/**
 * Enqueue one campaign email for one contact → queued log. The standard
 * processQueue() worker delivers it.
 *
 * Two sources of content:
 *   • templateId          → render a saved email_templates row (legacy path).
 *   • bodyHtml + subject  → the composer's compiled body (custom campaign). The
 *                           chrome-less body is wrapped in the recipient shell
 *                           here so the unsubscribe token stays per-recipient.
 * Placeholders ({{first_name}}…) are resolved in either path.
 */
async function enqueueCampaignEmail({
  templateId, bodyHtml, subject: composedSubject, previewText, audience = 'all',
  to, data = {}, user = {}, campaignId, subjectOverride, recipientUserId = null,
}) {
  if (!to) return { ok: false, reason: 'to required' };
  if (!templateId && !bodyHtml) return { ok: false, reason: 'templateId or bodyHtml required' };
  const settings = await loadSettings();

  let template, renderAudience;
  if (templateId) {
    ({ data: template } = await supabaseAdmin.from('email_templates').select('*').eq('id', templateId).single());
    if (!template) return { ok: false, reason: 'no_template' };
    renderAudience = template.audience;
  } else {
    // Pseudo-template: renderEmail resolves tokens in the composed body + subject
    // and wraps it in the recipient shell, exactly like a saved template.
    template = {
      subject: composedSubject || '', html_content: bodyHtml, preview_text: previewText || '',
      cta_label: '', cta_url: '', email_category: '', audience,
    };
    renderAudience = audience;
  }

  // Campaigns are bulk marketing — honor the unsubscribe list (legal requirement).
  if (await isUnsubscribed(to)) {
    const logId = await insertLog({
      event_key: `CAMPAIGN:${campaignId || ''}`, template_id: templateId || null, audience: renderAudience,
      recipient: to, recipient_user_id: recipientUserId, campaign_id: campaignId || null,
      subject: subjectOverride || composedSubject || '', html: '', status: 'suppressed', attempts: 0, is_test: false,
    });
    return { ok: true, status: 'suppressed', logId };
  }

  const sendData = { ...data, unsubscribe_token: data.unsubscribe_token || makeToken(to) };
  // Campaigns are always bulk marketing → force the unsubscribe/nav footer.
  const rendered = renderEmail(template, { data: sendData, user, settings, audience: renderAudience, marketing: true });
  const subject = subjectOverride || rendered.subject;
  const logId = await insertLog({
    event_key: `CAMPAIGN:${campaignId || ''}`, template_id: templateId || null, audience: renderAudience,
    recipient: to, recipient_user_id: recipientUserId, campaign_id: campaignId || null,
    subject, html: rendered.html, status: 'queued', attempts: 0,
    next_attempt_at: new Date().toISOString(), is_test: false,
  });
  return { ok: true, status: 'queued', logId };
}

// Provider delivery event → email_logs status, matched by the Resend message id
// stored at send. Forward-only-ish: a bounce is terminal (never downgraded to
// delivered), delivered won't overwrite a bounce. Best-effort + schema-safe: an
// unmatched id or a pre-v3.138 DB just no-ops (a webhook must never throw).
const EMAILLOG_DELIVERY = {
  'email.delivered': { status: 'delivered', stamp: 'delivered_at' },
  // suppress: a campaign/transactional bounce must also suppress the contact so
  // cold never re-sends a dead address (the CRM path already does this via
  // webhookEvents; campaign emails only hit email_logs, so it was leaking here —
  // 53 bounced but only ~10 suppressed until this landed).
  'email.bounced':   { status: 'bounced',   stamp: 'bounced_at', suppress: true },
  'email.complained':{ status: 'bounced',   stamp: 'bounced_at', suppress: true },
  // Engagement (v3.157): stamp the timestamp only — an opened/clicked email is
  // still 'delivered', so status is never touched. First touch wins.
  'email.opened':    { stamp: 'opened_at',  engagement: true },
  'email.clicked':   { stamp: 'clicked_at', engagement: true },
};
// Suppress a bounced address on the contact (what the campaign/CRM send gates read)
// and mark the lead, so it's skipped and visible. Best-effort + schema-safe: any
// error (missing column, no match) is swallowed — a webhook must never throw.
async function suppressBouncedContact(recipient) {
  const email = String(recipient).trim();
  if (!email) return;
  try {
    await supabaseAdmin.from('contacts')
      .update({ email_suppressed: true, updated_at: new Date().toISOString() })
      .ilike('email', email);
  } catch (_) { /* best-effort */ }
  try {
    await supabaseAdmin.from('leads')
      .update({ email_status: 'bounced', updated_at: new Date().toISOString() })
      .ilike('email', email);
  } catch (_) { /* best-effort */ }
}

async function recordEmailLogDelivery({ providerMessageId, event }) {
  const map = EMAILLOG_DELIVERY[event];
  if (!map || !providerMessageId) return { ok: true, matched: false };
  try {
    // Select the target stamp too so engagement events can honour first-touch and
    // so a pre-migration DB (missing opened_at/clicked_at) trips isMissingSchema → no-op.
    const { data: row } = await supabaseAdmin
      .from('email_logs').select(`id, status, recipient, ${map.stamp}`).eq('provider_message_id', providerMessageId).maybeSingle();
    if (!row) return { ok: true, matched: false };
    const now = new Date().toISOString();
    if (map.engagement) {
      if (row[map.stamp]) return { ok: true, matched: true }; // first-touch wins
      await supabaseAdmin.from('email_logs')
        .update({ [map.stamp]: now, updated_at: now }).eq('id', row.id);
      return { ok: true, matched: true };
    }
    if (row.status === 'bounced') return { ok: true, matched: true }; // terminal
    await supabaseAdmin.from('email_logs')
      .update({ status: map.status, [map.stamp]: now, updated_at: now }).eq('id', row.id);
    // Bounce/complaint → suppress the contact so cold never re-sends this address.
    // Best-effort: ilike matches case-insensitively; never throw out of a webhook.
    if (map.suppress && row.recipient) await suppressBouncedContact(row.recipient);
    return { ok: true, matched: true };
  } catch (err) {
    if (!isMissingSchema(err)) console.error('[email] recordEmailLogDelivery:', err.message);
    return { ok: false };
  }
}

/**
 * Deliver a composer draft to one address NOW (test send). Uses the exact same
 * compile→shell path as a real campaign, so the test mirrors production. Bypasses
 * the queue and suppression (it goes only to the admin's chosen address); subject
 * is prefixed [TEST] and the row is logged is_test.
 */
async function sendComposedTest({ bodyHtml, subject: composedSubject, previewText, audience = 'customer', senderKey = 'shubham', to }) {
  if (!to || !bodyHtml) return { ok: false, reason: 'to and bodyHtml required' };
  const settings = await loadSettings();
  const template = {
    subject: composedSubject || '', html_content: bodyHtml, preview_text: previewText || '',
    cta_label: '', cta_url: '', email_category: '', audience,
  };
  const sendData = { unsubscribe_token: makeToken(to), first_name: 'there', name: 'there' };
  const { subject, html } = renderEmail(template, { data: sendData, user: {}, settings, audience, marketing: true });
  const sender = (await senderRegistry.byKey(senderKey)) || { fromName: settings.from_name, fromEmail: settings.from_email, replyTo: null };
  // A composer test IS a campaign send — route it through the marketing SMTP
  // transport so the test proves the real bulk path, not Resend.
  const r = await deliver({ settings, to, subject: `[TEST] ${subject}`, html, sender, providerName: MARKETING_PROVIDER, marketing: true });
  await insertLog({
    event_key: 'CAMPAIGN:test', audience, recipient: to, subject, html,
    status: r.success ? 'test' : 'failed', provider: r.provider, provider_response: r.response || {},
    error: r.error || null, attempts: 1, is_test: true, sent_at: new Date().toISOString(),
  });
  return { ok: r.success, error: r.error };
}

module.exports = {
  send, processQueue, renderEmail, getTemplate, loadSettings, loadTemplates,
  clearCache, BACKOFFS_MIN, enqueueCampaignEmail, sendComposedTest, recordEmailLogDelivery, isMarketing, isUnsubscribed,
};
