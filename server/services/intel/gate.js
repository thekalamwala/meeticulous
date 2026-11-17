/**
 * The Intelligence plan gate.
 * Design: docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §6.4
 *
 * WHAT IS NOT GATED, and why it matters: the Money page, in full. `PLAN_MATRIX`
 * already promises free hosts "Earnings & transaction history" and "Commission
 * tracker", and /dashboard/earnings is ungated today. Paywalling it would break
 * a published promise and fence off data the host can reach in one click
 * anyway — a weak gate as well as a dishonest one.
 *
 * The gate lands on the INTELLIGENCE, not the ledger. Six things, none of them
 * promised to free hosts anywhere:
 *   forecast · win-back · benchmarks · audience · cohorts · moves
 *
 * MECHANISM: `limits.insights` on subscription_plans, read through
 * planService.getLimit — not an isFreeSlug check. CLAUDE.md is explicit that
 * limits always come from subscription_plans.limits and are never hardcoded, so
 * an admin can retune the gate without a deploy.
 *
 * getLimit returns 0 for a missing key, so this FAILS CLOSED: a plan row with no
 * `insights` key is locked. That is the safe direction, and it is also why
 * flipping Pro on is a data change the founder makes (see the PR), not
 * something that happens silently at merge.
 *
 * The free response never CONTAINS the gated numbers. It is not blurred in CSS
 * or hidden in the client — the figures are absent from the payload, so they
 * cannot be read out of the network tab. The teaser carries a headline the host
 * is already entitled to, plus locked: true.
 */
const { getLimit } = require('../planService');

/** The six gated blocks, named once so nothing can drift out of the list. */
const GATED = Object.freeze([
  'forecast',
  'winBack',
  'benchmarks',
  'audience',
  'cohorts',
  'moves',
]);

/**
 * Is this plan entitled to Intelligence?
 * -1 (unlimited) or any positive number unlocks; 0 or missing locks.
 */
async function hasInsights(planSlug) {
  const limit = await getLimit(planSlug, 'insights');
  return limit !== 0;
}

/**
 * Strip every gated block from a payload, replacing each with a locked marker.
 *
 * Deletes rather than nulls, and replaces with `{ locked: true }` rather than
 * omitting the key entirely, so the client can render a teaser in the right
 * place without having to know the gating rules itself — and so a reviewer can
 * see at a glance that the numbers are gone rather than merely falsy.
 */
function lockGatedBlocks(payload = {}) {
  const out = { ...payload };
  for (const key of GATED) {
    if (key in out) out[key] = { locked: true };
  }
  return out;
}

/**
 * Apply the gate to a built payload.
 * Returns the payload plus `locked`, which the UI uses to decide between the
 * real block and ProTeaser.
 */
async function applyGate(planSlug, payload) {
  const unlocked = await hasInsights(planSlug);
  return {
    ...(unlocked ? payload : lockGatedBlocks(payload)),
    locked: !unlocked,
  };
}

/**
 * Test seam and reviewer aid: every value a gated block could carry, flattened.
 * Used by the leak test to assert that none of a Pro host's gated figures
 * survives into a free host's response — a stronger assertion than checking the
 * six keys, because it would also catch a figure copied somewhere else.
 */
function gatedValues(payload = {}) {
  const vals = [];
  const walk = (v) => {
    if (v == null) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (typeof v === 'object') return Object.values(v).forEach(walk);
    if (typeof v === 'number' || typeof v === 'string') vals.push(v);
  };
  for (const key of GATED) if (key in payload) walk(payload[key]);
  return vals;
}

module.exports = { GATED, hasInsights, lockGatedBlocks, applyGate, gatedValues };
