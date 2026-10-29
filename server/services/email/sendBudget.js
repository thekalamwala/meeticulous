'use strict';
/**
 * sendBudget.js — the ONE shared Resend daily budget across every outreach path.
 *
 * All outreach rides Resend (MARKETING_PROVIDER): cold campaigns AND CRM sends
 * (lifecycle drips, second-touch). They must share one 100/day, 3000/month free-
 * tier budget, and the wall was previously wrong in two ways:
 *   - campaignWorker counted only campaign email_logs (400 cap), so CRM sends and
 *     cold blasts did NOT share a budget — either could quietly starve the other.
 *   - CRM sends had no daily budget at all.
 *
 * The two paths log to different ledgers (campaigns → email_logs provider=resend;
 * CRM → crm_messages), with no overlap TODAY because CRM sends bypass email_logs.
 * Today's usage is the SUM, counted by sent_at (when the row was handed to Resend —
 * NOT created_at, so a row queued yesterday and sent today lands on the right UTC
 * day). No schema change needed. NOTE: this counts SENT ROWS; a row retried N times
 * still counts once, so the soft-cap headroom below is the retry/bounce reserve — we
 * do not (and need not) count raw provider attempts. Resend's 100 is the hard wall;
 * this only throttles safely under it.
 *
 * Policy (revenue-first, approved 2026-09-13):
 *   - Soft cap 85 of the hard 100 — ~15 held back for retries + late bounce/complaint
 *     webhooks (uncounted attempts). Reset boundary = 00:00 UTC (Resend's own reset).
 *   - CRM (P1/P2) draws freely up to the cap, all day inside quiet-hours.
 *   - Cold (P3) is the pure REMAINDER: one 18:00 IST window, capped by the warm-up
 *     ramp (COLD_DAILY_MAX) AND whatever budget CRM left. No floor — a busy CRM day
 *     legitimately squeezes cold to zero. Cold also skips Sundays and the 31st.
 *
 * Fail modes differ by path on purpose: a counting outage fails OPEN for CRM
 * (protect activation/revenue mail) and CLOSED for cold (protect sender reputation
 * — never blast into an unknown budget).
 *
 * ponytail: usage is a fresh COUNT per call, not a reserved counter. Fine at this
 * volume (≤100/day) with single-instance workers under runLocked leases; swap to an
 * atomic reserve only if senders ever run concurrently at higher throughput.
 */
const { supabaseAdmin } = require('../../config/supabase');
const { logger } = require('../../utils/logger');

const HARD_CAP = 100;                                                    // Resend free-tier daily limit
const SOFT_CAP = parseInt(process.env.RESEND_DAILY_CAP || '85', 10);     // usable/day (headroom = retry/bounce reserve under the hard 100)
// Bounce circuit-breaker: pause cold when the recent Resend bounce rate is too
// high, to protect sender reputation from a dirty list (the fastest way to lose
// the whole marketing channel is a suspension, not overspending the cap).
const BOUNCE_PAUSE_PCT = parseFloat(process.env.COLD_BOUNCE_PAUSE_PCT || '5');   // pause cold above this %
const BOUNCE_WINDOW_H = parseInt(process.env.COLD_BOUNCE_WINDOW_H || '48', 10);  // trailing window
const BOUNCE_MIN_SAMPLE = parseInt(process.env.COLD_BOUNCE_MIN_SAMPLE || '20', 10); // don't trip on tiny samples
const COLD_SEND_HOUR = parseInt(process.env.COLD_SEND_HOUR_IST || '18', 10); // cold window start (IST); -1 disables the window
const COLD_WINDOW_END = parseInt(process.env.COLD_WINDOW_END_IST || '20', 10); // matches CRM quiet-hours end
// Warm-up ramp: the cold upper bound. Start low on a fresh sending reputation and
// raise it over the first week (e.g. 20 → 40 → 60 → 90). One env var, bumped by
// hand — deliberately not a persistent day-counter for a ~2-week one-off drain.
const COLD_DAILY_MAX = parseInt(process.env.COLD_DAILY_MAX || String(SOFT_CAP), 10);

function utcDayStartISO() { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d.toISOString(); }

function istHour() {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
}
// IST weekday ('Sun'…) + day-of-month, for the cold skip rule.
function istParts(d = new Date()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric' }).formatToParts(d);
  return { weekday: p.find((x) => x.type === 'weekday')?.value, day: Number(p.find((x) => x.type === 'day')?.value) };
}

// Resend sends today across BOTH ledgers, counted by sent_at (the send day = the
// quota day). Returns null on error so callers pick their own fail direction. A row
// only has sent_at once it reached Resend, so queued/unsent rows correctly don't
// count; a terminal status (delivered/bounced/failed) still consumed a send.
async function resendUsedToday() {
  try {
    const since = utcDayStartISO();
    const [camp, crm] = await Promise.all([
      supabaseAdmin.from('email_logs').select('id', { count: 'exact', head: true })
        .eq('provider', 'resend').gte('sent_at', since),
      supabaseAdmin.from('crm_messages').select('id', { count: 'exact', head: true })
        .eq('channel', 'email').gte('sent_at', since)
        .in('status', ['sent', 'delivered', 'bounced', 'failed']),
    ]);
    if (camp.error || crm.error) return null;
    return (camp.count || 0) + (crm.count || 0);
  } catch (_) { return null; }
}

// Budget left for CRM (P1/P2). Fail-OPEN: a counting outage returns the full cap so
// activation/revenue mail is never silently frozen.
async function remainingToday() {
  const used = await resendUsedToday();
  if (used == null) return SOFT_CAP;
  return Math.max(0, SOFT_CAP - used);
}

function coldWindowOpen() {
  if (COLD_SEND_HOUR < 0) return true;               // window disabled
  const h = istHour();
  return h >= COLD_SEND_HOUR && h < COLD_WINDOW_END;
}
// Cold skips Sundays and the 31st (low-open weekend + the founder's month-end pause).
function coldSkipToday() {
  const { weekday, day } = istParts();
  return weekday === 'Sun' || day === 31;
}

// Recent Resend bounce state over the trailing window. Fail-OPEN (open:false) on
// error so a transient read glitch doesn't halt cold on its own — a genuinely bad
// list stays high and trips on the next tick. Under BOUNCE_MIN_SAMPLE it never trips
// (a 1/1 bounce is not a signal).
async function coldBounceState() {
  try {
    const since = new Date(Date.now() - BOUNCE_WINDOW_H * 3600e3).toISOString();
    const base = () => supabaseAdmin.from('email_logs').select('id', { count: 'exact', head: true }).eq('provider', 'resend').gte('created_at', since);
    const [tot, bnc] = await Promise.all([base(), base().eq('status', 'bounced')]);
    if (tot.error || bnc.error) return { open: false, rate: null, sample: 0 };
    const sample = tot.count || 0;
    const rate = sample ? (bnc.count || 0) / sample : 0;
    if (sample < BOUNCE_MIN_SAMPLE) return { open: false, rate, sample };
    return { open: rate * 100 > BOUNCE_PAUSE_PCT, rate, sample };
  } catch (_) { return { open: false, rate: null, sample: 0 }; }
}

let _lastBreakerLog = 0;
async function coldCircuitOpen() {
  const s = await coldBounceState();
  if (s.open && Date.now() - _lastBreakerLog > 600000) { // log at most once / 10 min
    _lastBreakerLog = Date.now();
    try { logger.warn({ event: 'cold_bounce_circuit_open', rate: s.rate, sample: s.sample, threshold_pct: BOUNCE_PAUSE_PCT }); } catch (_) { /* noop */ }
  }
  return s.open;
}

// Cold emails already handed to the mailer today, read from campaign_recipients —
// NOT from email_logs. This is the fix for the ramp overshoot: campaign emails are
// enqueued into email_logs with sent_at=NULL and only get sent_at stamped LATER by
// the async email-queue worker, so resendUsedToday() (which counts email_logs.sent_at)
// under-reads during that lag. With cold firing every 60s, each tick then re-read
// "~0 cold sent today" and re-granted the full COLD_DAILY_MAX — a 20/day ramp blasted
// 104 in six minutes on 2026-09-24. campaign_recipients.sent_at, by contrast, is
// stamped SYNCHRONOUSLY by campaignWorker.mark() the instant a row is handed off, so
// counting it caps cold at COLD_DAILY_MAX per UTC day with no lag. Returns null on
// error so coldAllowanceNow fails CLOSED. Counts ALL cold campaigns (layout='cold') —
// they share one ramp.
async function coldSentToday() {
  try {
    const since = utcDayStartISO();
    const { data: cold, error: e1 } = await supabaseAdmin
      .from('email_campaigns').select('id').eq('layout', 'cold');
    if (e1) return null;
    const ids = (cold || []).map((c) => c.id);
    if (!ids.length) return 0;
    const { count, error: e2 } = await supabaseAdmin
      .from('campaign_recipients').select('id', { count: 'exact', head: true })
      .in('campaign_id', ids).eq('channel', 'email').eq('status', 'sent')
      .gte('sent_at', since);
    if (e2) return null;
    return count || 0;
  } catch (_) { return null; }
}

// How many cold emails may go out right now = min(ramp − cold-already-sent-today,
// remainder), but only inside the 18:00 window, not on a skip day, and not while the
// bounce breaker is open. Fail-CLOSED on either count: a counting outage returns 0 so
// we never blast a cold list into an unknown budget and burn reputation.
// ponytail: the SOFT_CAP − used arm still reads the lagging email_logs, so cold + CRM
// combined can briefly overshoot the soft cap under queue lag. Left as-is: it stays
// under the hard 100 wall, CRM is fail-open by design, and the reputation-critical
// bug was the cold RAMP, which coldSentToday now pins exactly.
async function coldAllowanceNow() {
  if (coldSkipToday() || !coldWindowOpen()) return 0;
  if (await coldCircuitOpen()) return 0;
  const [used, coldSent] = await Promise.all([resendUsedToday(), coldSentToday()]);
  if (used == null || coldSent == null) return 0;
  return Math.max(0, Math.min(COLD_DAILY_MAX - coldSent, SOFT_CAP - used));
}

module.exports = {
  resendUsedToday, remainingToday, coldAllowanceNow, coldWindowOpen, coldSkipToday,
  coldBounceState, coldCircuitOpen, coldSentToday,
  HARD_CAP, SOFT_CAP, COLD_DAILY_MAX, COLD_SEND_HOUR, COLD_WINDOW_END,
};
