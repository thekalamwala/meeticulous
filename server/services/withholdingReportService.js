'use strict';
/**
 * withholdingReportService.js — TDS (194-O) + TCS (GST §52) reporting for the
 * marketplace model (docs/payment-model.md v4). Feeds:
 *   - quarterly 26Q  (income-tax TDS return)
 *   - monthly  GSTR-8 (GST TCS return)
 *   - per-host TDS/TCS certificates
 *
 * Source of truth is the per-booking snapshot: bookings.tds_amount / tcs_amount,
 * both 1% of the host's gross sale, so the withholding BASE = tds_amount / rate.
 * We derive gross from the withheld amount rather than re-joining services(price),
 * which can drift after the booking (the snapshot is what was actually withheld).
 */
const { round2 } = require('../lib/pricingEngine');
const { DEFAULTS } = require('../lib/pricingEngine');

// Pure core: group booking snapshot rows by host and sum. No DB, no side effects.
// Each row: { host_id, tds_amount, tcs_amount }. rate = the TDS/TCS rate (1%).
function aggregateWithholding(rows, rate = DEFAULTS.tdsRate) {
  const byHost = new Map();
  for (const r of rows || []) {
    const tds = Number(r.tds_amount) || 0;
    const tcs = Number(r.tcs_amount) || 0;
    if (tds === 0 && tcs === 0) continue;
    const g = byHost.get(r.host_id) || { host_id: r.host_id, grossSales: 0, tds: 0, tcs: 0, bookings: 0 };
    // Gross = the withholding base. tds = rate × base ⇒ base = tds / rate.
    g.grossSales += rate > 0 ? tds / rate : 0;
    g.tds += tds;
    g.tcs += tcs;
    g.bookings += 1;
    byHost.set(r.host_id, g);
  }
  return [...byHost.values()]
    .map((g) => ({ ...g, grossSales: round2(g.grossSales), tds: round2(g.tds), tcs: round2(g.tcs) }))
    .sort((a, b) => b.tds - a.tds);
}

// CSV for the chosen filing. kind: 'tds' (26Q) | 'tcs' (GSTR-8). PAN column present
// only when a decrypted PAN is supplied per row (filing needs it; UI views mask it).
function toCsv(rows, kind = 'tds') {
  const amtCol = kind === 'tcs' ? 'TCS' : 'TDS';
  const header = ['PAN', 'Deductee/Host', 'Gross Sales', amtCol, 'Bookings'];
  const line = (cells) => cells.map((c) => {
    const s = String(c ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
  const body = rows.map((r) => line([
    r.pan || 'NO-PAN', r.name || '', r.grossSales, kind === 'tcs' ? r.tcs : r.tds, r.bookings,
  ]));
  return [line(header), ...body].join('\n');
}

// DB-backed report: aggregate paid bookings in [from,to] and enrich with host name +
// PAN. revealPan=true decrypts PAN (admin filing only); otherwise it is masked.
async function buildWithholdingReport({ from, to, revealPan = false, hostId = null } = {}) {
  const { supabaseAdmin } = require('../config/supabase');
  const { decrypt, maskPan } = require('../utils/kycCrypto');

  let q = supabaseAdmin
    .from('bookings')
    .select('host_id, tds_amount, tcs_amount, paid_at')
    .eq('payment_status', 'paid')
    .not('tds_amount', 'is', null);
  if (hostId) q = q.eq('host_id', hostId);
  if (from) q = q.gte('paid_at', from);
  if (to) q = q.lte('paid_at', to);
  const { data: rows, error } = await q;
  if (error) throw error;

  const agg = aggregateWithholding(rows || []);
  if (agg.length === 0) return [];

  const ids = agg.map((g) => g.host_id);
  const [{ data: profiles }, { data: kyc }] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, name').in('id', ids),
    supabaseAdmin.from('kyc_submissions').select('user_id, pan_number').in('user_id', ids),
  ]);
  const nameOf = new Map((profiles || []).map((p) => [p.id, p.name]));
  const panBlobOf = new Map((kyc || []).map((k) => [k.user_id, k.pan_number]));

  return agg.map((g) => {
    const blob = panBlobOf.get(g.host_id);
    let pan = null;
    try { pan = blob ? (revealPan ? decrypt(blob) : maskPan(blob)) : null; } catch (_) { pan = null; }
    return { ...g, name: nameOf.get(g.host_id) || null, pan };
  });
}

module.exports = { aggregateWithholding, toCsv, buildWithholdingReport };
