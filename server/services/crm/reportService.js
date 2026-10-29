'use strict';
/**
 * reportService.js — CRM attribution & funnel analytics (audit Phase 3a).
 *
 * Answers the audit's central question: "which source produced paying customers
 * and revenue?" — plus the honest conversion funnel and lead→customer timing.
 *
 * All aggregation is pure (unit-tested) over a bounded lead snapshot; the query
 * wrapper is thin. Reads `select('*')` so utm_* columns are used when v3.120 has
 * been applied and simply absent otherwise — no schema coupling.
 *
 * A "paying customer" is a lead at `paid` status (revenue-backed) — never
 * `activated` (a free active host). Kept identical to leadService/dashboard.
 */
const { supabaseAdmin } = require('../../config/supabase');
const { FUNNEL } = require('./leadService');
const { MONEY } = require('./lifecycleRules');

// A "paying customer" is a lead in ANY money state (Subscribed → Champion), not
// only the literal 'paid' — a host who progressed to won/sloth is still paying.
const isPaying = (status) => MONEY.has(status);
const PAGE = 1000;
const MAX_ROWS = 20000; // safety bound; leads are ~hundreds today

// ── pure helpers (unit-tested) ───────────────────────────────────────────────

const num = (v) => Number(v) || 0;

/** Whole days from a→b (float), or null if either is missing/invalid. */
function daysBetween(a, b) {
  if (!a || !b) return null;
  const t0 = new Date(a).getTime();
  const t1 = new Date(b).getTime();
  if (Number.isNaN(t0) || Number.isNaN(t1)) return null;
  return (t1 - t0) / 86400000;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

/** avg / median / p90 / count over a list of day-durations. null when empty. */
function timingStats(days) {
  const xs = (days || []).filter((d) => typeof d === 'number' && d >= 0).sort((a, b) => a - b);
  if (!xs.length) return null;
  const sum = xs.reduce((a, b) => a + b, 0);
  const round1 = (n) => Math.round(n * 10) / 10;
  return {
    count: xs.length,
    avg_days: round1(sum / xs.length),
    median_days: round1(percentile(xs, 50)),
    p90_days: round1(percentile(xs, 90)),
  };
}

/**
 * Group lead rows by an attribution key → { key, leads, paying, revenue_paise,
 * conversion_rate }. Rows missing the key are bucketed as '(unknown)'.
 * Sorted by paying customers, then lead volume.
 */
function summarizeBy(rows, key) {
  const m = new Map();
  for (const r of rows || []) {
    const k = (r[key] == null || r[key] === '') ? '(unknown)' : String(r[key]);
    const g = m.get(k) || { key: k, leads: 0, paying: 0, revenue_paise: 0 };
    g.leads += 1;
    if (isPaying(r.status)) g.paying += 1;
    g.revenue_paise += num(r.revenue_paise);
    m.set(k, g);
  }
  return [...m.values()]
    .map((g) => ({ ...g, conversion_rate: g.leads ? +((g.paying / g.leads) * 100).toFixed(1) : 0 }))
    .sort((a, b) => b.paying - a.paying || b.leads - a.leads);
}

/** Funnel stages in canonical order with counts + step-to-step retention. */
function funnelStages(counts = {}) {
  let prev = null;
  return FUNNEL.map((status) => {
    const count = counts[status] || 0;
    const stepRate = prev == null || prev === 0 ? null : +((count / prev) * 100).toFixed(1);
    prev = count;
    return { status, count, step_rate: stepRate };
  });
}

/** Top-level aggregation over the full lead snapshot. Pure. */
function buildReport(rows = []) {
  const total = rows.length;
  const paying = rows.filter((r) => isPaying(r.status)).length;
  const revenue_paise = rows.reduce((a, r) => a + num(r.revenue_paise), 0);
  const conversion_rate = total ? +((paying / total) * 100).toFixed(1) : 0;

  const counts = {};
  for (const r of rows) counts[r.status] = (counts[r.status] || 0) + 1;

  const hasUtm = rows.some((r) => Object.prototype.hasOwnProperty.call(r, 'utm_source'));
  const convDays = rows
    .filter((r) => r.converted_at)
    .map((r) => daysBetween(r.created_at, r.converted_at))
    .filter((d) => d != null);

  return {
    totals: { total, paying, revenue_paise, conversion_rate },
    funnel: funnelStages(counts),
    by_source: summarizeBy(rows, 'source'),
    by_utm_source: hasUtm ? summarizeBy(rows.filter((r) => r.utm_source), 'utm_source') : [],
    by_utm_campaign: hasUtm ? summarizeBy(rows.filter((r) => r.utm_campaign), 'utm_campaign') : [],
    time_to_convert: timingStats(convDays),
    has_utm: hasUtm,
  };
}

// ── query wrapper (thin) ─────────────────────────────────────────────────────

async function fetchLeads() {
  const rows = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await supabaseAdmin
      // Cold list leads were never worked — they'd dilute conversion_rate and
      // by_source totals, so keep them out of the report snapshot.
      .from('leads').select('*').neq('status', 'list').range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

async function getReport() {
  return buildReport(await fetchLeads());
}

module.exports = {
  getReport, buildReport,
  summarizeBy, funnelStages, timingStats, daysBetween, // exported for tests
};
