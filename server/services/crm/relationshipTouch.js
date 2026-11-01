'use strict';
/**
 * relationshipTouch.js — turn a lead's health + account signals into a relationship
 * TOUCH RECOMMENDATION (relationship engine PR-3). Pure + deterministic, no I/O.
 *
 * Speaks in relationship moments — first success, cooling, at-risk, dormant — not
 * sales stages, and recommends WHO should reach out, WHY, VIA WHICH channel, and
 * whether it should be automated / recommended-to-a-human / human-only. It does NOT
 * send anything; touchRecommendationService persists the result and the Desk (PR-5)
 * surfaces it. The engine already owns the acquisition/nurture "next_action"; this is
 * the additive relationship layer on top.
 *
 * Scope (PR-3): the relationship moments that have NO existing automation. Onboarding
 * stalls are already handled by the engine's nurture sequences (not duplicated here);
 * anniversary / milestone touches arrive in PR-6.
 *
 * Returns the single most relevant touch for the lead this tick (an array of 0 or 1),
 * so the Desk stays a short, high-signal queue rather than a wall of nudges.
 */

const DAY = 864e5;
const daysSince = (iso, now) => (iso ? Math.floor((now - new Date(iso).getTime()) / DAY) : null);

function recommendationsFor(lead, health, ctx = {}, now = Date.now()) {
  if (!lead || !health) return [];
  const state = health.state;
  const dMean = daysSince(lead.last_meaningful_interaction_at, now);
  // High-value = the same ROI signal the lifecycle uses for the ROI gate, or a
  // paying host who has already earned back ≥2× their plan cost.
  const highValue = !!ctx.meetsRoi
    || ((Number(ctx.earningsPaise) || 0) > 0
        && (Number(ctx.planPricePaise) || 0) > 0
        && Number(ctx.earningsPaise) >= 2 * Number(ctx.planPricePaise));

  const mk = (o) => [{
    subject_type: 'lead',
    lead_id: lead.id,
    reason: o.reason,
    touch_type: o.touch,
    priority: o.priority,
    suggested_channel: o.channel,
    suggested_sender: o.sender || 'owner',
    mode: o.mode,
    explanation: o.explanation,
    dedupe_key: `lead:${lead.id}:${o.reason}`,
  }];

  // Priority order — most urgent relationship moment wins.
  if (state === 'at_risk') {
    return mk({
      reason: 'at_risk', touch: 'winback', priority: 'high', channel: 'whatsapp',
      sender: highValue ? 'founder' : 'owner',
      mode: highValue ? 'human' : 'recommend',   // a valued at-risk customer is never an automated blast
      explanation: `Relationship at risk${dMean != null ? ` — no meaningful contact in ${dMean}d` : ''}.`,
    });
  }
  if (lead.status === 'won') {
    return mk({
      reason: 'first_success', touch: 'appreciation', priority: 'high', channel: 'whatsapp',
      mode: 'recommend',
      explanation: 'Landed their first paid booking — a personal congratulations lands well here.',
    });
  }
  if (state === 'cooling') {
    return mk({
      reason: 'cooling', touch: 'check_in', priority: 'medium', channel: 'email',
      mode: 'recommend',
      explanation: `Cooling${dMean != null ? ` — last meaningful contact ${dMean}d ago` : ''}. A light check-in re-warms it.`,
    });
  }
  // Only win back dormant leads who were once real customers — never nag a
  // never-activated dead lead.
  if (state === 'dormant' && ctx.hasBooking) {
    return mk({
      reason: 'dormant', touch: 'winback', priority: 'low', channel: 'email',
      mode: 'recommend',
      explanation: 'Gone quiet after being an active customer — worth one win-back.',
    });
  }
  return [];
}

// Seeded-but-dead relationship touches (PR-6): tenure anniversaries + lifetime
// booking milestones, surfaced as recommend-to-human moments (never auto-sent). Each
// is ONCE-EVER per occurrence — the service permanently suppresses it after a human
// acts, so a 1-year note or a 50-booking celebration fires exactly once. Returns 0..2.
function milestoneRecommendationsFor(lead, ctx = {}, now = Date.now()) {
  if (!lead || !lead.id) return [];
  const out = [];
  const mk = (o) => out.push({
    subject_type: 'lead', lead_id: lead.id, reason: o.reason, touch_type: o.touch,
    priority: o.priority, suggested_channel: o.channel, suggested_sender: o.sender || 'owner',
    mode: o.mode, explanation: o.explanation, dedupe_key: `lead:${lead.id}:${o.key}`,
  });

  // Tenure anniversary, measured from when the relationship started (lead created_at).
  const days = lead.created_at ? Math.floor((now - new Date(lead.created_at).getTime()) / 864e5) : null;
  if (days != null && days >= 0) {
    const years = Math.floor(days / 365);
    if (years >= 1) {
      mk({
        reason: 'anniversary', key: `anniversary:${years}y`, touch: 'founder_note',
        priority: 'medium', channel: 'personal', sender: 'founder', mode: 'human',
        explanation: `${years}-year anniversary with us — a personal note from the team lands well here.`,
      });
    } else if (days >= 30 && days < 60) {
      mk({
        reason: 'anniversary', key: 'anniversary:30d', touch: 'appreciation',
        priority: 'low', channel: 'whatsapp', mode: 'recommend',
        explanation: "One month in — a quick check-in keeps the relationship warm.",
      });
    }
  }

  // Lifetime booking milestone (hosts): the highest threshold reached, once each.
  const total = Number(ctx.bookingsTotal) || 0;
  const threshold = [100, 50, 10].find((t) => total >= t);
  if (threshold) {
    mk({
      reason: 'milestone', key: `milestone:bookings:${threshold}`, touch: 'appreciation',
      priority: 'medium', channel: 'whatsapp', mode: 'recommend',
      explanation: `Reached ${threshold} bookings — worth celebrating the milestone.`,
    });
  }

  return out;
}

module.exports = { recommendationsFor, milestoneRecommendationsFor };
