'use strict';
/**
 * leadScore.js — server-side port of the CRM lead score.
 *
 * MUST stay numerically identical to the client formula
 * (client/src/pages/admin/sales/salesConstants.js `leadScore`) — the client
 * renders the badge, the server persists the value; any drift shows a different
 * number in the UI than the one the lifecycle engine acts on. Pure function, no
 * DB, no AI: a deterministic 0–100 from the signals we actually have.
 *
 * `intent` is the coarser bucket the pipeline/handoff rules key on. It is NOT
 * the same axis as `temp` (hot/warm/cold, kept for parity with the client
 * badge): a converted lead is `intent: 'activated'` regardless of score.
 */

// Kept BYTE-FOR-BYTE in sync with the client STAGE
// (client/src/pages/admin/sales/salesConstants.js `leadScore`). The pre-v3.126
// keys (demo_scheduled/trial) were dropped when the lifecycle statuses were
// redesigned; the post-conversion ladder (won…champion) was added. A status
// absent here falls to the shared `?? 10` default on BOTH sides, so retired
// statuses stay in parity. See docs/crm-relationship-engine-audit.md (PR-0).
const { MONEY: CONVERTED, ROI } = require('./lifecycleRules');
const STAGE = {
  new: 5, contacted: 20, replied: 45, qualified: 60, demo: 70,
  paid: 90, activated: 92, won: 95, [ROI]: 98, retained: 98, ambassador: 99, enterprised: 99, champion: 100,
  lost: 0, churned: 0, not_reachable: 0, not_interested: 0, disqualified: 0, do_not_contact: 0,
};
// A converted/paying customer is `intent: 'activated'` regardless of raw score, so
// a high-scoring customer never floods the High Intent acquisition queue. Reuse the
// single lifecycle source of truth (paid, activated, won, ROI, retained,
// ambassador, enterprised, champion) rather than re-listing the money states here.

/** @returns {{ score:number, temp:'hot'|'warm'|'cold' }} — parity with the client. */
function compute(lead, now = Date.now()) {
  if (!lead) return { score: 0, temp: 'cold' };
  let s = STAGE[lead.status] ?? 10;
  if (lead.phone) s += 8;
  if (lead.email) s += 4;
  if (Number(lead.revenue_paise) > 0) s += 12;
  if (['referral', 'website'].includes(lead.source)) s += 5;
  const last = lead.last_activity_at || lead.last_contacted_at;
  if (last) {
    const days = (now - new Date(last)) / 864e5;
    if (days < 3) s += 10; else if (days < 7) s += 5; else if (days > 30) s -= 10;
  }
  if (lead.last_engaged_at) {
    const d = (now - new Date(lead.last_engaged_at)) / 864e5;
    if (d < 3) s += 15; else if (d < 14) s += 8;
  }
  s = Math.max(0, Math.min(100, Math.round(s)));
  return { score: s, temp: s >= 70 ? 'hot' : s >= 40 ? 'warm' : 'cold' };
}

/**
 * Deterministic intent bucket for pipeline/handoff rules.
 * Converted leads are 'activated' irrespective of score.
 * @returns {'low'|'medium'|'high'|'activated'}
 */
function intentOf(lead, score) {
  if (lead && (CONVERTED.has(lead.status) || lead.converted_at)) return 'activated';
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

module.exports = { compute, intentOf, STAGE };
