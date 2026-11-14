'use strict';
/**
 * cancellationPolicy — resolve the refund tiers for a booking (v3.206).
 *
 * A "tier" = the refund fraction of the SERVICE PRICE a guest gets when they cancel
 * at least `hours` before the start. Walked highest-hours-first. The platform fee +
 * GST + PG fee stay non-refundable (handled in refundService, unchanged).
 *
 * Everything here operates on money ALREADY collected upfront — it only decides how
 * much to refund via Razorpay. No card on file, no wallet (see no-wallet-no-card rule).
 *
 * Dependency-free on purpose (the caller passes `isPro`), so it stays a pure, unit-
 * testable module — no supabase/planService import chain.
 */

// Today's policy — the Free default and the OFF-flag default for everyone.
const DEFAULT_TIERS = [
  { hours: 24, pct: 1 },
  { hours: 6, pct: 0.5 },
  { hours: 0, pct: 0 },
];

// The Pro default (dormant until `pro_cancellation_policy` is ON). Stricter: a Pro
// host keeps money on anything cancelled inside ~48h instead of inside 6h.
const PRO_DEFAULT_TIERS = [
  { hours: 48, pct: 1 },
  { hours: 24, pct: 0.5 },
  { hours: 0, pct: 0 },
];

// A lenient option a Pro host can pick (full refund up to 2h before).
const FLEXIBLE_TIERS = [
  { hours: 2, pct: 1 },
  { hours: 0, pct: 0 },
];

// Named presets a Pro host chooses from (P4). The SERVER maps a preset name → tiers,
// so a client can never inject arbitrary refund tiers. `standard` = the Free/default
// policy; `strict` and `flexible` are Pro-only.
const PRESETS = {
  standard: { tiers: DEFAULT_TIERS, proOnly: false },
  strict: { tiers: PRO_DEFAULT_TIERS, proOnly: true },
  flexible: { tiers: FLEXIBLE_TIERS, proOnly: true },
};

/**
 * Build a stored per-service policy from a preset name chosen by a host.
 * @returns {{ preset: string, tiers: Array }|null} null = clear any override and use
 *   the default (for 'standard', an unknown preset, or a Pro-only preset a non-Pro
 *   host tried to set).
 */
function policyFromPreset(presetName, { isPro } = {}) {
  const name = String(presetName || '').toLowerCase();
  const p = PRESETS[name];
  if (!p || name === 'standard') return null;   // default → store no override
  if (p.proOnly && !isPro) return null;          // free host can't set Pro presets
  return { preset: name, tiers: p.tiers };
}

/** Keep only well-formed tiers; sort high→low hours. Returns null if nothing valid. */
function normalizeTiers(tiers) {
  if (!Array.isArray(tiers)) return null;
  const clean = tiers
    .filter((t) => t && Number.isFinite(Number(t.hours)) && Number(t.hours) >= 0
      && Number.isFinite(Number(t.pct)) && Number(t.pct) >= 0 && Number(t.pct) <= 1)
    .map((t) => ({ hours: Number(t.hours), pct: Number(t.pct) }))
    .sort((a, b) => b.hours - a.hours);
  return clean.length ? clean : null;
}

/** Refund fraction (0..1) of the service price for a guest cancelling `hoursToStart` before. */
function refundPctFor(hoursToStart, tiers) {
  const t = normalizeTiers(tiers) || DEFAULT_TIERS;
  for (const tier of t) {
    if (hoursToStart >= tier.hours) return tier.pct;
  }
  return 0;
}

/**
 * Resolve the effective policy for a booking being created.
 * @returns {{ tiers: Array<{hours:number,pct:number}> }}
 */
function resolveCancellationPolicy({ service, isPro, flagOn } = {}) {
  if (!flagOn) return { tiers: DEFAULT_TIERS };
  if (!isPro) return { tiers: DEFAULT_TIERS };
  // Pro: a valid per-service override wins, else the Pro default.
  const custom = normalizeTiers(service?.cancellation_policy?.tiers);
  return { tiers: custom || PRO_DEFAULT_TIERS };
}

module.exports = { DEFAULT_TIERS, PRO_DEFAULT_TIERS, FLEXIBLE_TIERS, PRESETS, policyFromPreset, normalizeTiers, refundPctFor, resolveCancellationPolicy };
