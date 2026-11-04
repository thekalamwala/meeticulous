'use strict';
/**
 * supportReportService.js — READ-ONLY support numbers for the SUTRA agent network
 * (SEVA). Served by GET /api/agents/reports/support.
 *
 * Reads the EXISTING support system, does not change it:
 *   support_threads / support_messages (v3.115-117 host+guest chat inbox) and
 *   bot_escalations / bot_escalation_replies (v3.89/90 widget handoffs).
 *
 * Contract:
 *   • COUNTS ONLY. No message bodies, subjects, AI summaries, names, phones, emails,
 *     user/guest ids, admin ids or references are selected. Row ids are read only to
 *     join (thread → messages, escalation → replies) and never returned. Asserted in
 *     tests/unit/supportReport.test.js.
 *   • No writes, no new tables, no migration. Empty tables → zeros / null medians.
 *   • Reason codes = config/supportReasons.js (same taxonomy as supportInsightsService).
 *   • "today" / "mtd" are IST calendar day / month (same istWindows as finance/sales).
 */
const { supabaseAdmin } = require('../config/supabase');
const { fetchAll, istWindows } = require('./financeReportService');
const { REASONS, BY_CODE } = require('../config/supportReasons');

const THREAD_STATUSES = ['bot', 'waiting', 'assigned', 'resolved'];
const ESC_STATUSES = ['open', 'replied', 'closed'];
const PERIODS = ['today', 'mtd', 'lifetime'];
const UNTAGGED = '(untagged)';
const TOP_N = 5;
const MIN = 60 * 1000;

// Exported so the PII test checks the exact strings the queries use.
const COLS = {
  support_threads: 'id, participant_type, status, reason_code, rating, created_at, updated_at',
  support_messages: 'thread_id, sender, created_at',
  bot_escalations: 'id, status, reason_code, rating, created_at',
  bot_escalation_replies: 'escalation_id, channel, created_at',
};

const at = (ts) => Date.parse(ts);
const zeros = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };
const round = (n, dp) => Math.round(n * 10 ** dp) / 10 ** dp;
// reason_code is set from the picker (isValidReason) — still bucket anything unknown.
const reasonKey = (c) => (!c ? UNTAGGED : BY_CODE[c] ? c : 'other');
const reasonZeros = () => ({ ...zeros(REASONS.map((r) => r.code)), [UNTAGGED]: 0 });

function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function ratingStats(rows) {
  const rated = rows.filter((r) => r.rating >= 1 && r.rating <= 5);
  return {
    avg_rating: rated.length ? round(rated.reduce((s, r) => s + r.rating, 0) / rated.length, 2) : null,
    rated: rated.length,
  };
}

/**
 * Per-period median of durations. `items` = [{ endAt, minutes }]; an item falls in a
 * period by endAt (the response / resolution moment).
 */
function durationsByPeriod(items, inPeriod) {
  return Object.fromEntries(PERIODS.map((p) => {
    const xs = items.filter((i) => inPeriod[p](i.endAt)).map((i) => i.minutes);
    const m = median(xs);
    return [p, { count: xs.length, median_minutes: m === null ? null : round(m, 1) }];
  }));
}

/**
 * Pure aggregation over already-fetched rows. Exported for tests.
 * @param {object} p
 * @param {Array}  p.threads      support_threads rows (COLS.support_threads)
 * @param {Array}  p.messages     non-user support_messages rows (COLS.support_messages)
 * @param {Array}  p.escalations  bot_escalations rows (COLS.bot_escalations)
 * @param {Array}  p.replies      bot_escalation_replies rows (COLS.bot_escalation_replies)
 * @param {object} p.bookings     { today, mtd, lifetime } completed-checkout booking counts
 * @param {object} p.windows      { todayStart, monthStart } from istWindows()
 */
function aggregateSupport({ threads, messages, escalations, replies, bookings, windows }) {
  const inPeriod = {
    today: (ts) => at(ts) >= at(windows.todayStart),
    mtd: (ts) => at(ts) >= at(windows.monthStart),
    lifetime: () => true,
  };

  // ── support threads ──
  const byStatus = zeros(THREAD_STATUSES);
  const byParticipant = zeros(['host', 'guest']);
  const threadReasons = reasonZeros();
  for (const t of threads) {
    bump(byStatus, t.status || '(unknown)');
    bump(byParticipant, t.participant_type || '(unknown)');
    if (t.status === 'resolved' || t.reason_code) bump(threadReasons, reasonKey(t.reason_code));
  }

  // First human response: first admin message − the handoff moment. Handoff ≈ the
  // latest bot/system message before that admin message (escalate() is preceded by
  // the handoff note or Tithi's last answer; Tithi stops replying once handed off),
  // else thread created_at. Bot-only time before the handoff is not counted.
  const msgsByThread = new Map();
  for (const m of messages) {
    if (!msgsByThread.has(m.thread_id)) msgsByThread.set(m.thread_id, []);
    msgsByThread.get(m.thread_id).push(m);
  }
  const firstResponses = [];
  const resolutions = [];
  for (const t of threads) {
    const ms = (msgsByThread.get(t.id) || []).sort((a, b) => at(a.created_at) - at(b.created_at));
    const firstAdmin = ms.find((m) => m.sender === 'admin');
    if (firstAdmin) {
      const before = ms.filter((m) => m.sender !== 'admin' && at(m.created_at) <= at(firstAdmin.created_at));
      const handoff = before.length ? before[before.length - 1].created_at : t.created_at;
      firstResponses.push({ endAt: firstAdmin.created_at, minutes: Math.max(0, at(firstAdmin.created_at) - at(handoff)) / MIN });
    }
    // Resolved moment = the "marked resolved" system note (the thread's LAST system
    // message — nothing posts a system message after resolve). Not updated_at: an
    // admin reply on a resolved thread bumps it. Fallback updated_at if no note.
    if (t.status === 'resolved') {
      const sys = ms.filter((m) => m.sender === 'system');
      const resolvedAt = sys.length ? sys[sys.length - 1].created_at : t.updated_at;
      if (resolvedAt) resolutions.push({ endAt: resolvedAt, minutes: Math.max(0, at(resolvedAt) - at(t.created_at)) / MIN });
    }
  }

  // ── bot escalations ──
  const escByStatus = zeros(ESC_STATUSES);
  const escReasons = reasonZeros();
  for (const e of escalations) {
    bump(escByStatus, e.status || '(unknown)');
    if (e.status === 'closed' || e.reason_code) bump(escReasons, reasonKey(e.reason_code));
  }
  // First reply to the visitor (email / WhatsApp; internal notes don't count).
  const firstReplyAt = new Map();
  for (const r of replies) {
    if (r.channel === 'note') continue;
    const prev = firstReplyAt.get(r.escalation_id);
    if (!prev || at(r.created_at) < at(prev)) firstReplyAt.set(r.escalation_id, r.created_at);
  }
  const escFirstResponses = [];
  for (const e of escalations) {
    const r = firstReplyAt.get(e.id);
    if (r) escFirstResponses.push({ endAt: r, minutes: Math.max(0, at(r) - at(e.created_at)) / MIN });
  }

  // ── tickets per period = threads that reached a human + widget escalations ──
  const tickets = Object.fromEntries(PERIODS.map((p) => {
    const human = threads.filter((t) => t.status !== 'bot' && inPeriod[p](t.created_at)).length;
    const esc = escalations.filter((e) => inPeriod[p](e.created_at)).length;
    const total = human + esc;
    const b = bookings[p];
    return [p, {
      support_threads: human,
      bot_escalations: esc,
      total,
      bookings: b,
      per_100_bookings: b ? round((total / b) * 100, 1) : null,
    }];
  }));

  // ── top reason codes across both stores (tagged only) ──
  const combined = {};
  for (const [k, v] of [...Object.entries(threadReasons), ...Object.entries(escReasons)]) {
    if (k !== UNTAGGED && v) combined[k] = (combined[k] || 0) + v;
  }
  const topReasons = Object.entries(combined)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, TOP_N)
    .map(([code, count]) => ({ code, label: BY_CODE[code].label, category: BY_CODE[code].category, type: BY_CODE[code].type, count }));

  return {
    threads: {
      total: threads.length,
      by_status: byStatus,
      by_stage: {
        open: byStatus.waiting || 0,
        pending: byStatus.assigned || 0,
        resolved: byStatus.resolved || 0,
        bot_only: byStatus.bot || 0,
      },
      by_participant: byParticipant,
      by_reason_code: threadReasons,
      first_response: durationsByPeriod(firstResponses, inPeriod),
      resolution: durationsByPeriod(resolutions, inPeriod),
      csat: ratingStats(threads),
    },
    bot_escalations: {
      total: escalations.length,
      by_status: escByStatus,
      open: (escByStatus.open || 0) + (escByStatus.replied || 0),
      resolved: escByStatus.closed || 0,
      by_reason_code: escReasons,
      first_response: durationsByPeriod(escFirstResponses, inPeriod),
      ...ratingStats(escalations),
    },
    tickets,
    top_reason_codes: topReasons,
  };
}

async function countBookings(db, since) {
  // Completed checkouts only: 'pending' = an unfinished/abandoned checkout, not a booking.
  let q = db.from('bookings').select('id', { count: 'exact', head: true }).neq('status', 'pending');
  if (since) q = q.gte('created_at', since);
  const { count, error } = await q;
  if (error) throw error;
  return count || 0;
}

async function buildSupportReport({ now = new Date() } = {}) {
  const windows = istWindows(now);
  const db = supabaseAdmin;

  // ponytail: full scans of the support tables — fine at current volume; move to a
  // count/median RPC if threads reach the tens of thousands.
  const [threads, messages, escalations, replies, bToday, bMtd, bLife] = await Promise.all([
    fetchAll(() => db.from('support_threads').select(COLS.support_threads).order('id')),
    fetchAll(() => db.from('support_messages').select(COLS.support_messages).in('sender', ['admin', 'bot', 'system']).order('id')),
    fetchAll(() => db.from('bot_escalations').select(COLS.bot_escalations).order('id')),
    fetchAll(() => db.from('bot_escalation_replies').select(COLS.bot_escalation_replies).order('id')),
    countBookings(db, windows.todayStart),
    countBookings(db, windows.monthStart),
    countBookings(db, null),
  ]);

  return {
    report: 'support',
    version: 1,
    as_of: now.toISOString(),
    timezone: 'Asia/Kolkata',
    windows: { today_start: windows.todayStart, month_start: windows.monthStart },
    definitions: {
      thread_status: 'support_threads.status: bot = Tithi only, never handed off; waiting = handed off, no human yet; assigned = a human is on it; resolved = closed by support',
      by_stage: 'open = waiting, pending = assigned, resolved = resolved, bot_only = bot',
      first_response: 'support threads: first admin message (incl. the automatic intro posted on "Assign to me", so this is time-to-claim) minus the handoff (latest bot/system message before it, else thread created_at); escalations: first email/WhatsApp reply minus escalation created_at (internal notes excluded; a WhatsApp reply is a logged wa.me hand-off, not a confirmed delivery). Windowed by the response time; minutes',
      resolution: 'resolved support threads: resolved time (the "marked resolved" system note, else updated_at) minus thread created_at, windowed by resolved time; minutes. Not derivable for bot escalations (no closed timestamp)',
      by_reason_code: 'config/supportReasons.js codes on resolved/closed conversations; (untagged) = resolved/closed without a code; unknown codes count as other',
      csat: 'mean 1-5 rating where given; null when nobody rated',
      bot_escalations: 'open = open + replied (support replied, not closed); resolved = closed',
      tickets: 'support threads that reached a human (status not bot) + bot escalations, by created_at',
      per_100_bookings: 'tickets / bookings created in the same window x 100; bookings = status not pending (completed checkouts); null when no bookings',
      top_reason_codes: `top ${TOP_N} tagged reason codes across threads + escalations, lifetime`,
    },
    ...aggregateSupport({
      threads,
      messages,
      escalations,
      replies,
      bookings: { today: bToday, mtd: bMtd, lifetime: bLife },
      windows,
    }),
  };
}

module.exports = { buildSupportReport, aggregateSupport, median, COLS };
