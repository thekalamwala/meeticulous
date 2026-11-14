'use strict';

/**
 * tithiProactive.js — Tithi's proactive IN-APP nudges (Slice 5).
 *
 * When a host has a resolvable blocker — verification stuck, no live service, earnings
 * waiting, plan expiring — Tithi drops a short warm nudge in their notification bell, in
 * her voice, so she reaches out instead of only reacting. This is the IN-APP + Tithi-voice
 * layer; it complements (does not replace) the email/WhatsApp activation nudges in
 * activationNudges.js, and reuses the SAME vetted source (the host_activation view).
 *
 * SAFETY:
 *   - Flag `tithi_proactive` (default OFF, fail-closed) → the whole job no-ops.
 *   - Quiet hours 09–20 IST.
 *   - Per-host-per-blocker dedupe via inAppNotify's (user_id, dedupe_key): a host is
 *     nudged ONCE per blocker, never spammed (inAppNotify skips a duplicate row).
 *   - Internal/test hosts excluded (host_activation.is_internal).
 *   - EXTENSIBLE: add a STAGE_RULE (or another detector) to cover a new blocker.
 *
 * ponytail: v1 is nudge-only. The in-app row self-clears when the host reads it; wiring
 * resolveInApp to the fix events (KYC approved, service added) is a clean fast-follow.
 */

const { supabaseAdmin } = require('../../config/supabase');
const { isFeatureEnabled } = require('../featureFlags');
const { inAppNotify } = require('../../utils/inAppNotify');

const FLAG = 'tithi_proactive';
const PLAN_EXPIRY_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

const firstNameOf = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

// 09:00–20:00 Asia/Kolkata (IST = UTC+5:30), regardless of server TZ (mirrors activationNudges).
function withinQuietHours(now = new Date()) {
  const istHour = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000).getHours();
  return istHour >= 9 && istHour < 20;
}

// Stage-based rules over host_activation (same stages activationNudges maps). `type` is
// the in-app dedupe key — one nudge per host per blocker. body(firstName) → Tithi's voice.
const STAGE_RULES = [
  {
    stage: '1_signed_up', type: 'TITHI_KYC_STUCK', minSignupDays: 2,
    title: 'One step to go live',
    body: (n) => `Hey ${n} — your verification is the one thing between you and taking bookings. It's a two-minute job; tap through and I'll point you to it.`,
    link: '/dashboard/kyc',
  },
  {
    stage: '2_onboarded', type: 'TITHI_NO_SERVICE',
    title: 'Your page is ready — add a service',
    body: (n) => `${n}, you're verified and set up, but there's no service for people to book yet. Add one and you're properly live.`,
    link: '/dashboard/services',
  },
  {
    stage: '5_paid', type: 'TITHI_PAYOUT_WAITING',
    title: 'Earnings waiting',
    body: (n) => `${n}, you've got money from a booking waiting to pay out — it just needs your payout account set up.`,
    link: '/dashboard/payments/payouts',
  },
];

// Nudge the stuck hosts matching one stage rule. Returns how many were nudged.
async function runStageRule(rule) {
  const { data: rows, error } = await supabaseAdmin
    .from('host_activation')
    .select('host_id,name,signed_up_at,stage,is_internal')
    .eq('stage', rule.stage)
    .eq('is_internal', false);
  if (error || !rows) return 0;
  let n = 0;
  for (const h of rows) {
    if (!h.host_id) continue;
    if (rule.minSignupDays && h.signed_up_at) {
      const ageDays = (Date.now() - new Date(h.signed_up_at).getTime()) / DAY_MS;
      if (ageDays < rule.minSignupDays) continue; // don't ping the instant they land here
    }
    inAppNotify({
      userId: h.host_id, role: 'vendor', type: rule.type,
      title: rule.title, body: rule.body(firstNameOf(h.name)),
      link: rule.link, dedupeKey: rule.type,
    });
    n += 1;
  }
  return n;
}

// Plan expiry — Pro/gifted plans expiring within the window (profiles, not stage-based).
async function runPlanExpiry() {
  const nowIso = new Date().toISOString();
  const soon = new Date(Date.now() + PLAN_EXPIRY_DAYS * DAY_MS).toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from('profiles')
    .select('id,name,plan,plan_expires_at')
    .not('plan_expires_at', 'is', null)
    .gt('plan_expires_at', nowIso)
    .lte('plan_expires_at', soon);
  if (error || !rows) return 0;
  let n = 0;
  for (const p of rows) {
    if (!p.id) continue;
    inAppNotify({
      userId: p.id, role: 'vendor', type: 'TITHI_PLAN_EXPIRING',
      title: 'Your plan renews soon',
      body: `${firstNameOf(p.name)}, your ${p.plan || 'Pro'} plan renews in a few days. Nothing to do if your card's current — ping me if you want to change anything.`,
      link: '/dashboard/upgrade', dedupeKey: 'TITHI_PLAN_EXPIRING',
    });
    n += 1;
  }
  return n;
}

// The scan. Flag-gated + quiet-hours; never throws (each rule fails soft).
async function runProactiveNudges(now = new Date()) {
  if (!(await isFeatureEnabled(FLAG))) return { skipped: 'flag_off' };
  if (!withinQuietHours(now)) return { skipped: 'quiet_hours' };
  let nudged = 0;
  for (const rule of STAGE_RULES) {
    try { nudged += await runStageRule(rule); } catch (e) { console.error('[tithi-proactive]', rule.type, e.message); }
  }
  try { nudged += await runPlanExpiry(); } catch (e) { console.error('[tithi-proactive] plan-expiry', e.message); }
  return { nudged };
}

module.exports = { runProactiveNudges, runStageRule, runPlanExpiry, withinQuietHours, STAGE_RULES, FLAG };
