'use strict';

/**
 * supportInsightsService — the one place that turns resolved conversations into the
 * product-intelligence aggregate. Used by BOTH the admin endpoint and the weekly
 * digest email, so the numbers never diverge.
 *
 * Aggregates contact reasons across both stores (support_threads + bot_escalations)
 * over a window: total resolved, product-caused rate, tag coverage, CSAT, top
 * reasons, by-area. Degrades to zeros when the reason_code column is absent
 * (pre-v3.117) rather than throwing.
 */

const { supabaseAdmin } = require('../config/supabase');
const { REASONS, BY_CODE, isProductCaused } = require('../config/supportReasons');

async function computeInsights(days = 30) {
  const window = Math.min(Math.max(parseInt(days, 10) || 30, 1), 365);
  const cutoff = new Date(Date.now() - window * 86400000).toISOString();

  const [tq, eq] = await Promise.all([
    supabaseAdmin.from('support_threads').select('reason_code, rating').eq('status', 'resolved').gte('updated_at', cutoff),
    supabaseAdmin.from('bot_escalations').select('reason_code, rating').eq('status', 'closed').gte('created_at', cutoff),
  ]);
  const rows = [...(tq.error ? [] : tq.data || []), ...(eq.error ? [] : eq.data || [])];

  const total = rows.length;
  const withReason = rows.filter((r) => r.reason_code && BY_CODE[r.reason_code]);
  const counts = {};
  withReason.forEach((r) => { counts[r.reason_code] = (counts[r.reason_code] || 0) + 1; });

  const byReason = REASONS
    .map((r) => ({ ...r, count: counts[r.code] || 0 }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const byCategory = {};
  byReason.forEach((r) => { byCategory[r.category] = (byCategory[r.category] || 0) + r.count; });

  const productCaused = withReason.filter((r) => isProductCaused(r.reason_code)).length;
  const denom = withReason.length || 1;

  const rated = rows.filter((r) => r.rating >= 1 && r.rating <= 5);
  const csat = rated.length ? +(rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(2) : null;

  return {
    window_days: window,
    total_resolved: total,
    tagged: withReason.length,
    coverage_rate: total ? +(withReason.length / total).toFixed(3) : 0,
    product_caused_rate: +(productCaused / denom).toFixed(3),
    csat, csat_responses: rated.length,
    by_reason: byReason,
    by_category: Object.entries(byCategory).map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    reasons: REASONS,
  };
}

module.exports = { computeInsights };
