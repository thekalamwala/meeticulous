'use strict';
/**
 * relationshipHealth.js — how strong and current is our relationship with a lead,
 * and is it decaying? (Relationship engine PR-2.)
 *
 * This is deliberately NOT the lead score. Lead score answers "how likely to
 * convert/buy?"; relationship health answers "are we still in a real, current
 * relationship — or running on autopilot / going quiet?". Its dominant term is the
 * time since the last MEANINGFUL (human) interaction, so a customer we never
 * actually talk to visibly cools no matter how many automated touches they get.
 *
 * PURE + deterministic (no I/O, no AI), like leadScore. `compute` returns a stored
 * `state` (what the UI shows), a backing `score` (for cheap sorting), and `signals`
 * (top contributors, for explainability next to the state).
 *
 * Guardrails baked in (asserted in the tests):
 *   - health decays with time-since-MEANINGFUL-interaction (the whole point),
 *   - automated touches alone never raise it (only meaningful contact + real
 *     outcomes do — automated recency is not an input here),
 *   - reaching `at_risk` needs a corroborating signal; a single soft signal caps
 *     at `cooling`, so the state doesn't cry wolf.
 *
 * ctx (all optional; supplied by lifecycleEngine.loadAccountCtx facts):
 *   isPaid, hasBooking, bookingsLast30d, referralsQualified, meetsSloth,
 *   lapsed (paid term expired / subscription halted),
 *   supportOpen, negativeFeedback (soft risk signals — wired in a follow-up).
 */

const STATES = ['thriving', 'steady', 'cooling', 'at_risk', 'dormant']; // best → worst
const SEVERITY = Object.fromEntries(STATES.map((s, i) => [s, i]));      // higher = worse
const worseOf = (a, b) => (b == null ? a : SEVERITY[b] > SEVERITY[a] ? b : a);

const DAY = 864e5;
const daysSince = (iso, now) => (iso ? (now - new Date(iso).getTime()) / DAY : Infinity);

// Weights (v1 — deterministic guesses; tune against reactivation once touch
// outcomes exist in PR-4). Kept as named consts so the model stays legible.
const W = {
  base: 50,
  meaningful: { d7: 28, d21: 12, d45: -2, d90: -18, stale: -28 },
  usage: { active: 14, some: 7, idleWithHistory: -2, never: -6 },
  paid: 8, sloth: 6, referral: 4, reply: 6,
  activity: { silent60: -12, silent30: -6 },
  softNegative: -18, hardNegative: -30,
};

const EXIT_TERMINAL = new Set(['lost', 'churned', 'not_reachable', 'not_interested', 'disqualified']);

function compute(lead, ctx = {}, now = Date.now()) {
  if (!lead) return { state: 'dormant', score: 0, signals: [] };
  const signals = [];
  const add = (key, dir, weight) => { signals.push({ key, dir, weight }); return weight; };

  let score = W.base;

  // ── Dominant: recency of a MEANINGFUL (human) interaction ──
  const dMean = daysSince(lead.last_meaningful_interaction_at, now);
  const hasEverMeaningful = Number.isFinite(dMean);
  if (dMean <= 7) score += add('meaningful_interaction', 'recent', W.meaningful.d7);
  else if (dMean <= 21) score += add('meaningful_interaction', 'fairly_recent', W.meaningful.d21);
  else if (dMean <= 45) score += add('meaningful_interaction', 'cooling', W.meaningful.d45);
  else if (dMean <= 90) score += add('meaningful_interaction', 'stale', W.meaningful.d90);
  else score += add('meaningful_interaction', hasEverMeaningful ? 'very_stale' : 'never', W.meaningful.stale);

  // ── Product usage / outcomes ──
  const b30 = Number(ctx.bookingsLast30d) || 0;
  if (b30 >= 5) score += add('usage', 'high', W.usage.active);
  else if (b30 >= 1) score += add('usage', 'some', W.usage.some);
  else if (ctx.hasBooking) score += add('usage', 'idle', W.usage.idleWithHistory);
  else score += add('usage', 'none', W.usage.never);

  // ── Paying + positive signals ──
  if (ctx.isPaid) score += add('paying', 'yes', W.paid);
  if (ctx.meetsSloth) score += add('sloth_gate', 'met', W.sloth);
  if ((Number(ctx.referralsQualified) || 0) >= 1) score += add('referral', 'made', W.referral);

  // ── Inbound reply = they engaged back ──
  if (daysSince(lead.last_reply_at, now) <= 14) score += add('reply', 'recent', W.reply);

  // ── Any-activity recency (softer than meaningful) ──
  const dAct = daysSince(lead.last_activity_at, now);
  if (dAct > 60) score += add('activity', 'silent_60d', W.activity.silent60);
  else if (dAct > 30) score += add('activity', 'silent_30d', W.activity.silent30);

  // ── Risk signals ──
  const churned = EXIT_TERMINAL.has(lead.status);
  const lapsed = !!ctx.lapsed;
  let negatives = 0;
  if (ctx.supportOpen) { negatives += 1; score += add('support', 'open', W.softNegative); }
  if (ctx.negativeFeedback) { negatives += 1; score += add('feedback', 'negative', W.softNegative); }
  if (lapsed) score += add('subscription', 'lapsed', W.hardNegative);

  score = Math.max(0, Math.min(100, Math.round(score)));

  // ── State: start from the score band, then apply overrides in priority order ──
  let band = score >= 75 ? 'thriving'
    : score >= 55 ? 'steady'
    : score >= 35 ? 'cooling'
    : score >= 18 ? 'at_risk'
    : 'dormant';

  // A recently-active lead shouldn't read as fully 'dormant' from a low score alone.
  if (band === 'dormant' && dAct < 30 && !churned) band = 'at_risk';
  // Never (or barely) had a meaningful interaction → can't be a top-tier relationship.
  if (!hasEverMeaningful && (band === 'thriving' || band === 'steady')) band = 'cooling';

  // 1. Hard terminal: an exited/churned lead is dormant, full stop.
  if (churned) return finalize('dormant', score, signals);
  // 2. Long two-way silence → dormant (covers a lapsed-and-long-gone lead too).
  if (dMean >= 90 && dAct >= 60) return finalize('dormant', score, signals);
  // 3. Corroboration for at_risk: 2+ risk signals, or a lapsed subscription (hard).
  if (negatives >= 2 || lapsed) band = worseOf(band, 'at_risk');
  // 4. A single soft signal alone must not reach at_risk — cap it at cooling.
  else if (negatives === 1 && SEVERITY[band] > SEVERITY.cooling) band = 'cooling';
  // 5. Meaningful-decay caps: the core "we've gone quiet" behaviour, applied last so
  //    a genuinely stale relationship still escalates even when nothing else is wrong.
  if (dMean > 45) band = worseOf(band, 'at_risk');
  else if (dMean > 21) band = worseOf(band, 'cooling');

  return finalize(band, score, signals);
}

// Keep only the strongest few contributors for the UI, worst/best first by |weight|.
function finalize(state, score, signals) {
  const top = [...signals].sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 4);
  return { state, score, signals: top };
}

module.exports = { compute, STATES };
