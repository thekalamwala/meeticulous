// Client mirror of the cancellation refund tiers (server lib/cancellationPolicy.js).
// Used to DISCLOSE the policy at checkout before a guest pays. While
// `pro_cancellation_policy` is OFF every host uses DEFAULT_TIERS; once it's ON (P3),
// the service payload will carry the host's resolved tiers and we format those.

export const DEFAULT_TIERS = [
  { hours: 24, pct: 1 },
  { hours: 6, pct: 0.5 },
  { hours: 0, pct: 0 },
];

/**
 * Turn refund tiers into window-based disclosure rows, most-notice-first.
 * @returns {Array<{ pct: string, when: string }>}
 */
export function cancellationSegments(tiers) {
  const t = (Array.isArray(tiers) && tiers.length ? tiers : DEFAULT_TIERS)
    .filter((x) => x && Number.isFinite(Number(x.hours)) && Number.isFinite(Number(x.pct)))
    .map((x) => ({ hours: Number(x.hours), pct: Number(x.pct) }))
    .sort((a, b) => b.hours - a.hours);
  const src = t.length ? t : DEFAULT_TIERS;
  return src.map((tier, i) => {
    const pct = tier.pct >= 1 ? 'Full refund' : tier.pct <= 0 ? 'No refund' : `${Math.round(tier.pct * 100)}% refund`;
    const upper = i === 0 ? null : src[i - 1].hours;
    let when;
    if (tier.hours <= 0) when = upper ? `under ${upper}h before, or no-show` : 'any time';
    else if (upper == null) when = `${tier.hours}h or more before`;
    else when = `${tier.hours}–${upper}h before`;
    return { pct, when };
  });
}
