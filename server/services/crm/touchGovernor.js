'use strict';
/**
 * touchGovernor.js — the ONE master cap across every automated touch (PR-7).
 *
 * The MVP left the cap fragmented: sendGate throttled CRM sends (1 / 48h over
 * crm_messages), touchRecommendationService cooled the SAME reason for 14 days, and
 * birthdayGreetings sent straight through NotificationEngine with no cap at all. So a
 * single person could receive a cooling nudge, a birthday email and a milestone touch
 * in the same window — each "allowed" in isolation, spam together.
 *
 * The governor unifies them: one per-subject ceiling of N automated touches per
 * rolling window, counted from the durable ledger every automated touch already
 * writes — lead_activities automated rows (is_meaningful=false CONTACT types), which
 * activity.logActivity stamps and which also bumps leads.last_automated_touch_at.
 * sendGate delegates its cap here; birthday and any other NotificationEngine-direct
 * automated path call canTouch() before sending and recordTouch() after.
 *
 * SPLIT DESIGN:
 *   - withinCap(): PURE, source-agnostic, fully unit-tested — the decision.
 *   - canTouch()/recordTouch(): the DB adapter that gathers a subject's timestamps
 *     and records a touch. FAIL-OPEN on read error (an outage must never silently
 *     freeze legitimate sends), best-effort on write (never throws).
 *
 * Config (env-tunable; shipped defaults match sendGate's existing 1 / 48h ceiling so
 * the governor is not a behaviour change for CRM sends, only an extension to the rest):
 *   CRM_TOUCH_CAP       (default 1)   max automated touches per window per subject
 *   CRM_TOUCH_WINDOW_H  (default 48)  the rolling window, in hours
 */

const posInt = (v, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : dflt;
};

const CAP = posInt(process.env.CRM_TOUCH_CAP, 1);
const WINDOW_H = posInt(process.env.CRM_TOUCH_WINDOW_H, 48);
const WINDOW_MS = WINDOW_H * 3600e3;

/**
 * PURE decision. Given automated-touch timestamps for a subject, is another allowed?
 * @param {(string|null|undefined)[]} timestamps  ISO strings (any order; blanks ignored)
 * @param {number} now  epoch ms
 * @param {{cap?:number, windowMs?:number}} [o]  overrides (defaults = shipped config)
 * @returns {{ok:boolean, count:number, reason?:'frequency_capped'}}
 *   count = touches inside the window; ok=false once count >= cap.
 */
function withinCap(timestamps, now = Date.now(), o = {}) {
  const cap = o.cap != null ? o.cap : CAP;
  const windowMs = o.windowMs != null ? o.windowMs : WINDOW_MS;
  const cutoff = now - windowMs;
  let count = 0;
  for (const t of timestamps || []) {
    if (!t) continue;
    const ms = new Date(t).getTime();
    if (Number.isFinite(ms) && ms > cutoff) count += 1;
  }
  return count >= cap ? { ok: false, count, reason: 'frequency_capped' } : { ok: true, count };
}

// ── DB adapter ───────────────────────────────────────────────────────────────
// Lazy requires keep withinCap() dependency-free (pure, no I/O at import).

// Automated CONTACT activity types = the automated-touch ledger (is_meaningful=false).
const CONTACT_ACTIVITY_TYPES = ['whatsapp_sent', 'email_sent', 'call_logged'];
const CHANNEL_ACTIVITY = { whatsapp: 'whatsapp_sent', email: 'email_sent', call: 'call_logged' };

/**
 * Resolve a LEAD-shaped touch subject to the lead id whose lead_activities ledger holds
 * its automated touches.
 *   { type:'lead', id }     → id
 *   { type:'profile', id }  → the linked lead (leads.profile_id), if any
 * A { type:'contact' } subject is handled separately (canTouch/recordTouch) — a guest
 * has no per-touch ledger, only the single contacts.last_automated_touch_at clock.
 * Returns null when there is no lead ledger to read/write (→ callers fail-open / no-op).
 */
async function resolveLeadId(subject) {
  if (!subject || !subject.id) return null;
  if (subject.type === 'lead') return subject.id;
  if (subject.type === 'profile') {
    const { supabaseAdmin } = require('../../config/supabase');
    const { data } = await supabaseAdmin.from('leads').select('id').eq('profile_id', subject.id).limit(1);
    return data && data[0] ? data[0].id : null;
  }
  return null; // 'contact' → handled in canTouch/recordTouch, not here
}

/**
 * May we send another AUTOMATED touch to this subject right now?
 * FAIL-OPEN: a subject with no ledger (unlinked profile / guest pre-PR-9) or a read
 * error returns ok — an outage must never silently freeze legitimate sends. A real
 * in-window breach always caps.
 * @param {{type:'lead'|'profile'|'contact', id:string}} subject
 * @returns {Promise<{ok:boolean, count?:number, reason?:string}>}
 */
async function canTouch(subject, now = Date.now()) {
  try {
    // Guest (contact) subject: no per-touch ledger — the single denormalised
    // last_automated_touch_at clock is the whole history. Treating that one timestamp
    // as the window's touches is exact for the default 1/window cap (and conservative
    // for a larger cap). Fail-open on error or a pre-v3.139 missing column.
    if (subject && subject.type === 'contact' && subject.id) {
      const { supabaseAdmin } = require('../../config/supabase');
      const { data, error } = await supabaseAdmin
        .from('contacts').select('last_automated_touch_at').eq('id', subject.id).maybeSingle();
      if (error) return { ok: true };
      return withinCap([data && data.last_automated_touch_at], now);
    }
    const leadId = await resolveLeadId(subject);
    if (!leadId) return { ok: true, count: 0 }; // no ledger → fail-open
    const { supabaseAdmin } = require('../../config/supabase');
    const cutoff = new Date(now - WINDOW_MS).toISOString();
    const { data, error } = await supabaseAdmin
      .from('lead_activities')
      .select('occurred_at')
      .eq('lead_id', leadId)
      .eq('is_meaningful', false)
      .in('type', CONTACT_ACTIVITY_TYPES)
      .gte('occurred_at', cutoff);
    if (error) return { ok: true }; // fail-open on read error
    return withinCap((data || []).map((r) => r.occurred_at), now);
  } catch (_) {
    return { ok: true }; // fail-open
  }
}

/**
 * Record that an automated touch went out, onto the same ledger canTouch reads.
 * Routes through activity.logActivity with NO actor → is_meaningful=false, bumps
 * leads.last_automated_touch_at (never raises "meaningful"). Best-effort: a subject
 * with no ledger no-ops (the send still happened), and a write error never throws.
 * @param {{type:string, id:string}} subject
 * @param {{channel?:'whatsapp'|'email'|'call', event?:string, meta?:object}} [o]
 */
async function recordTouch(subject, { channel = 'email', event = null, meta = {} } = {}) {
  try {
    // Guest (contact) subject: stamp the denormalised clocks directly (no ledger table).
    if (subject && subject.type === 'contact' && subject.id) {
      const { supabaseAdmin } = require('../../config/supabase');
      const nowIso = new Date().toISOString();
      await supabaseAdmin.from('contacts')
        .update({ last_automated_touch_at: nowIso, last_activity_at: nowIso, updated_at: nowIso })
        .eq('id', subject.id);
      return;
    }
    const leadId = await resolveLeadId(subject);
    if (!leadId) return; // unlinked profile → no ledger; send still occurred
    const { logActivity } = require('./activity');
    const type = CHANNEL_ACTIVITY[channel] || 'email_sent';
    await logActivity(leadId, type, {
      actorAdminId: null,
      title: event ? `Automated touch: ${event}` : 'Automated touch',
      meta: { ...meta, ...(event ? { event } : {}), governed: true },
    });
  } catch (e) {
    console.error('[crm] touchGovernor.recordTouch:', e.message);
  }
}

module.exports = {
  withinCap, canTouch, recordTouch, resolveLeadId,
  CAP, WINDOW_H, WINDOW_MS, CONTACT_ACTIVITY_TYPES, CHANNEL_ACTIVITY,
};
