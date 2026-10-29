/**
 * badgeEngine.js — rules-driven badge evaluation service.
 *
 * Holds ZERO badge-specific logic. Reads rules from badge_rules, metric
 * snapshots from the vendor_metrics view (one batched query — no N+1),
 * evaluates, and upserts vendor_badges.
 *
 * Evaluation semantics:
 *   - Rules are grouped by group_id. Within a group, rules are ANDed.
 *   - Groups are combined with badges.rule_logic ('AND' | 'OR').
 *     A single-group badge therefore behaves exactly as its rule_logic
 *     suggests for the common case.
 *   - Operators: =, >, <, >=, <=
 *
 * Award/revoke:
 *   - pass + not holding  → insert award (assigned_by = null = engine)
 *   - fail + holding      → revoke ONLY if engine-awarded (assigned_by null).
 *     Manually-assigned badges are never auto-revoked.
 *   - Revocation is soft: sets revoked_at; history rows are preserved.
 */

const { supabaseAdmin } = require('../config/supabase');

const METRIC_FIELDS = [
  'completed_bookings', 'revenue', 'avg_rating', 'review_count',
  'five_star_reviews', 'one_star_reviews', 'avg_response_time_minutes',
  'active_days', 'login_streak', 'repeat_customers', 'customer_count',
  'cancellation_count', 'inactive_days', 'account_age_days',
  // Attribute metrics (0/1) — account facts, not activity counts. Power the
  // Google/LinkedIn verification badges (rule: field = 1). See v3.173.
  'has_google_identity', 'linkedin_verified',
];

const OPERATORS = {
  '=':  (a, b) => a === b,
  '>':  (a, b) => a > b,
  '<':  (a, b) => a < b,
  '>=': (a, b) => a >= b,
  '<=': (a, b) => a <= b,
};

/** Evaluate one rule against a metric snapshot. Unknown field/op → false. */
const evaluateRule = (snapshot, rule) => {
  const fn = OPERATORS[rule.operator];
  if (!fn || !(rule.field in snapshot)) return false;
  const actual = Number(snapshot[rule.field]);
  const expected = Number(rule.value);
  if (Number.isNaN(actual) || Number.isNaN(expected)) return false;
  return fn(actual, expected);
};

/** Evaluate a badge's full rule set against a snapshot. No rules → false. */
const evaluateBadge = (snapshot, badge, rules) => {
  if (!rules || rules.length === 0) return false;
  const groups = new Map();
  for (const r of rules) {
    const g = r.group_id || 0;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(r);
  }
  const groupResults = [...groups.values()].map((groupRules) =>
    groupRules.every((r) => evaluateRule(snapshot, r))
  );
  return (badge.rule_logic === 'OR')
    ? groupResults.some(Boolean)
    : groupResults.every(Boolean);
};

/** Load metric snapshots — all vendors or a specific set (one query). */
const loadSnapshots = async (vendorIds = null) => {
  let q = supabaseAdmin.from('vendor_metrics').select('*');
  if (vendorIds && vendorIds.length) q = q.in('vendor_id', vendorIds);
  const { data, error } = await q;
  if (error) throw new Error(`vendor_metrics read failed: ${error.message}`);
  return data || [];
};

/** Load active automatic badges with their rules (two queries total). */
const loadActiveAutomaticBadges = async () => {
  const { data: badges, error } = await supabaseAdmin
    .from('badges')
    .select('*')
    .eq('badge_type', 'automatic')
    .eq('status', 'active');
  if (error) throw new Error(`badges read failed: ${error.message}`);
  if (!badges || badges.length === 0) return [];

  const { data: rules, error: rErr } = await supabaseAdmin
    .from('badge_rules')
    .select('*')
    .in('badge_id', badges.map((b) => b.id));
  if (rErr) throw new Error(`badge_rules read failed: ${rErr.message}`);

  const byBadge = new Map(badges.map((b) => [b.id, []]));
  for (const r of rules || []) byBadge.get(r.badge_id)?.push(r);
  return badges.map((b) => ({ badge: b, rules: byBadge.get(b.id) || [] }));
};

/** Load all ACTIVE (non-revoked) vendor_badges rows (one query). */
const loadActiveAwards = async (vendorIds = null) => {
  let q = supabaseAdmin
    .from('vendor_badges')
    .select('id, vendor_id, badge_id, assigned_by')
    .is('revoked_at', null);
  if (vendorIds && vendorIds.length) q = q.in('vendor_id', vendorIds);
  const { data, error } = await q;
  if (error) throw new Error(`vendor_badges read failed: ${error.message}`);
  return data || [];
};

/**
 * Run a full evaluation pass.
 * @param {string[]|null} vendorIds  null = all vendors
 * @param {string|null}   badgeId    restrict to one badge (e.g. on publish)
 * @returns {{ evaluated, awarded, revoked }}
 */
const evaluate = async ({ vendorIds = null, badgeId = null } = {}) => {
  let badgeSets = await loadActiveAutomaticBadges();
  if (badgeId) badgeSets = badgeSets.filter((s) => s.badge.id === badgeId);
  if (badgeSets.length === 0) return { evaluated: 0, awarded: 0, revoked: 0 };

  const [snapshots, awards] = await Promise.all([
    loadSnapshots(vendorIds),
    loadActiveAwards(vendorIds),
  ]);

  const held = new Map(); // `${vendor}:${badge}` → award row
  for (const a of awards) held.set(`${a.vendor_id}:${a.badge_id}`, a);

  const toAward = [];
  const toRevoke = [];

  for (const snap of snapshots) {
    for (const { badge, rules } of badgeSets) {
      const key = `${snap.vendor_id}:${badge.id}`;
      const passes = evaluateBadge(snap, badge, rules);
      const existing = held.get(key);
      if (passes && !existing) {
        toAward.push({ vendor_id: snap.vendor_id, badge_id: badge.id, assigned_by: null, reason: null });
      } else if (!passes && existing && existing.assigned_by === null) {
        // Auto-revoke only engine-awarded badges
        toRevoke.push(existing.id);
      }
    }
  }

  if (toAward.length) {
    const { error } = await supabaseAdmin.from('vendor_badges').insert(toAward);
    if (error && !/duplicate key/i.test(error.message)) {
      throw new Error(`badge award insert failed: ${error.message}`);
    }
  }
  if (toRevoke.length) {
    const { error } = await supabaseAdmin
      .from('vendor_badges')
      .update({ revoked_at: new Date().toISOString(), revocation_reason: 'Rules no longer satisfied (engine)' })
      .in('id', toRevoke);
    if (error) throw new Error(`badge revoke failed: ${error.message}`);
  }

  return {
    evaluated: snapshots.length * badgeSets.length,
    awarded: toAward.length,
    revoked: toRevoke.length,
  };
};

/** Preview: how many current vendors would earn this rule set right now. */
const previewRuleSet = async (badgeLike, rules) => {
  const snapshots = await loadSnapshots();
  return snapshots.filter((s) => evaluateBadge(s, badgeLike, rules)).length;
};

module.exports = {
  METRIC_FIELDS, OPERATORS,
  evaluateRule, evaluateBadge,
  loadSnapshots, evaluate, previewRuleSet,
};
