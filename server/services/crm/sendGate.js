'use strict';
/**
 * sendGate.js — the single safety checkpoint EVERY CRM outbound send passes.
 *
 * A send is only allowed when ALL hold:
 *   1. The global CRM send kill-switch is ON (feature flag `crm_admin_sends`).
 *      This flag is FAIL-CLOSED (see services/featureFlags.js) and seeded
 *      disabled — sends are impossible until an admin explicitly enables it.
 *   2. The lead is not do_not_contact and not status='do_not_contact'.
 *   3. A valid destination exists for the channel (phone for WhatsApp, email
 *      for email).
 *   4. The recipient hasn't opted out on that channel:
 *        - email  → email_unsubscribes (HMAC list) OR contacts.email_suppressed
 *        - whatsapp → contacts.whatsapp_suppressed
 *
 * Returns { ok: boolean, reason?: string }. `reason` is a stable slug so the
 * caller can record why a send was skipped (crm_messages.status='skipped').
 */
const { supabaseAdmin } = require('../../config/supabase');
const { isFeatureEnabled } = require('../featureFlags');
const { normalizePhone } = require('../aisensyService');
const { isPlaceholderEmail } = require('../email/placeholderEmail');
const governor = require('./touchGovernor');
const sendBudget = require('../email/sendBudget');

const SEND_FLAG = 'crm_admin_sends';

// Coordinated-conversation limits — apply to AUTOMATED sends only (sequences /
// queue-drained), never to a human's ad-hoc composer send. A `defer:true` reason
// means "not now, try later" (re-queue) rather than "never" (skip).
// The frequency cap itself now lives in touchGovernor — the ONE master cap across
// every automated touch (CRM sends, birthday, milestones) — so a CRM send is capped
// against birthday/milestone touches too, not just other CRM messages. Quiet-hours
// stays here (it's a CRM-send concern, not a per-touch one).
const QUIET_START_IST = 9;                   // send window [09:00, 20:00) Asia/Kolkata
const QUIET_END_IST = 20;

const validEmail = (e) => typeof e === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

// Current hour in Asia/Kolkata as 0–23. hourCycle:'h23' avoids the midnight "24"
// quirk that hour12:false + 2-digit produces on some ICU builds.
function istHour() {
  return Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23',
  }).format(new Date()));
}

// Quiet-hours + the global frequency cap. Returns a defer result to block, or null
// to allow. Quiet-hours is checked first (cheap, no I/O); the cap then delegates to
// the touch governor, which counts the lead's automated-touch ledger (lead_activities
// — CRM sends AND birthday/milestone touches). FAIL-OPEN: the governor never throws,
// and this guards defensively too, so an outage never silently freezes every send.
async function throttle(lead, channel) {
  const h = istHour();
  if (h < QUIET_START_IST || h >= QUIET_END_IST) return { ok: false, reason: 'quiet_hours', defer: true };
  // Shared Resend daily budget — EMAIL only (WhatsApp rides AiSensy, a different
  // quota). CRM (P1/P2) draws freely up to the cap; when it's spent, defer (re-queue)
  // rather than send into a quota-reject. remainingToday() fails OPEN, so a counting
  // outage never freezes CRM mail. See services/email/sendBudget.js.
  if (channel === 'email' && (await sendBudget.remainingToday()) <= 0) {
    return { ok: false, reason: 'daily_budget', defer: true };
  }
  try {
    const gate = await governor.canTouch({ type: 'lead', id: lead.id });
    if (!gate.ok) return { ok: false, reason: gate.reason || 'frequency_capped', defer: true };
  } catch (_) { /* fail-open */ }
  return null;
}

/**
 * @param {object} lead   a leads row (needs phone/whatsapp_phone/email, do_not_contact, status, contact_id)
 * @param {'whatsapp'|'email'} channel
 * @param {object} [opts]
 * @param {boolean} [opts.automated=false]  true for sequence/queue sends → subject to
 *        quiet-hours + frequency cap. Human composer sends stay exempt.
 */
async function canSend(lead, channel, opts = {}) {
  if (!lead) return { ok: false, reason: 'no_lead' };

  // 1. Global kill-switch (fail-closed).
  if (!(await isFeatureEnabled(SEND_FLAG))) return { ok: false, reason: 'sends_disabled' };

  // 2. Do Not Contact.
  if (lead.do_not_contact || lead.status === 'do_not_contact') return { ok: false, reason: 'do_not_contact' };

  if (channel === 'whatsapp') {
    const dest = normalizePhone(lead.whatsapp_phone || lead.phone);
    if (!dest) return { ok: false, reason: 'invalid_phone' };
    if (await isSuppressed(lead, 'whatsapp')) return { ok: false, reason: 'whatsapp_suppressed' };
  } else if (channel === 'email') {
    const email = (lead.email || '').trim().toLowerCase();
    if (!validEmail(email)) return { ok: false, reason: 'invalid_email' };
    // Phone-only users carry a synthetic p<phone>@users.bookasloth.app address that
    // can't receive mail — emailing it only bounces. Skip (they get WhatsApp instead).
    if (isPlaceholderEmail(email)) return { ok: false, reason: 'placeholder_email' };
    if (await isEmailUnsubscribed(email)) return { ok: false, reason: 'email_unsubscribed' };
    if (await isSuppressed(lead, 'email')) return { ok: false, reason: 'email_suppressed' };
  } else {
    return { ok: false, reason: 'unknown_channel' };
  }

  // 3. Coordinated-conversation throttle + shared daily budget (automated sends only).
  if (opts.automated) {
    const t = await throttle(lead, channel);
    if (t) return t;
  }
  return { ok: true };
}

// email_unsubscribes is the platform-wide HMAC opt-out list (v3.7). Fail OPEN on
// error (matches communicationEngine.isUnsubscribed) — an outage shouldn't block
// legitimate sends, but a real opt-out row always wins.
async function isEmailUnsubscribed(email) {
  try {
    const { data } = await supabaseAdmin
      .from('email_unsubscribes').select('email').eq('email', email).maybeSingle();
    return !!data;
  } catch (_) { return false; }
}

// contacts carries per-channel suppression flags set by prior campaign activity.
// Matched by the lead's linked contact_id, else by email/phone.
async function isSuppressed(lead, channel) {
  try {
    let contact = null;
    if (lead.contact_id) {
      ({ data: contact } = await supabaseAdmin
        .from('contacts').select('email_suppressed, whatsapp_suppressed')
        .eq('id', lead.contact_id).maybeSingle());
    }
    if (!contact && lead.email) {
      ({ data: contact } = await supabaseAdmin
        .from('contacts').select('email_suppressed, whatsapp_suppressed')
        .eq('email', lead.email.trim().toLowerCase()).maybeSingle());
    }
    if (!contact) return false;
    return channel === 'email' ? !!contact.email_suppressed : !!contact.whatsapp_suppressed;
  } catch (_) { return false; }
}

module.exports = { canSend, SEND_FLAG, validEmail };
