'use strict';
/**
 * gstEngine.js — the ONE place that defines "output GST for a period".
 *
 * Source of truth is the `invoices` table (docs/gst-finance-module-architecture.md
 * §3): it is the only store carrying head-wise CGST/SGST/IGST + place of supply,
 * is immutable, and has integrity CHECKs. This module NEVER recomputes tax from a
 * rate — it only reads and aggregates the already-charged invoice rows.
 *
 * ITC / input GST is not captured anywhere in the platform (confirmed), so ITC is
 * a hard 0 stub here — never a fabricated number (see itcStub / §9 limitations).
 *
 * Pure aggregation core (summarize/byHead/byRate/…) has no DB and is unit-tested;
 * the fetch* helpers are the thin DB layer over Supabase.
 */

const { round2 } = require('../../lib/pricingEngine');
const { seller } = require('../../config/sellerIdentity');

const INVOICE_COLS =
  'id,invoice_number,source_type,source_id,payment_id,buyer_name,buyer_gstin,buyer_state,buyer_state_code,taxable_value,cgst,sgst,igst,total,gst_rate,place_of_supply,sac_code,issued_at';

const num = (v) => Number(v) || 0;
const gstOf = (r) => num(r.cgst) + num(r.sgst) + num(r.igst);

// Effective rate as a percentage (18, 12, …). Prefers the stored fraction
// gst_rate (v3.118); falls back to gst/taxable for pre-v3.118 rows.
function ratePct(r) {
  const frac = r.gst_rate != null ? Number(r.gst_rate) : (num(r.taxable_value) > 0 ? gstOf(r) / num(r.taxable_value) : 0);
  return Math.round(frac * 100 * 100) / 100;
}

// ── Pure aggregation ──────────────────────────────────────────
function summarize(rows) {
  let taxable = 0, cgst = 0, sgst = 0, igst = 0, total = 0;
  for (const r of rows || []) {
    taxable += num(r.taxable_value); cgst += num(r.cgst); sgst += num(r.sgst);
    igst += num(r.igst); total += num(r.total);
  }
  return {
    count: (rows || []).length,
    taxable: round2(taxable),
    cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst),
    totalGst: round2(cgst + sgst + igst),
    total: round2(total),
  };
}

// Output − ITC. ITC is 0 (no input-GST data). netLiability = output GST.
function liability(rows) {
  const s = summarize(rows);
  return {
    output: { cgst: s.cgst, sgst: s.sgst, igst: s.igst, total: s.totalGst },
    itc: { cgst: 0, sgst: 0, igst: 0, total: 0, note: 'No input-GST data captured — see limitations §9' },
    netLiability: s.totalGst,
  };
}

function byHead(rows) {
  const s = summarize(rows);
  return { cgst: s.cgst, sgst: s.sgst, igst: s.igst, total: s.totalGst };
}

function byRate(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const pct = ratePct(r);
    const g = map.get(pct) || { rate: pct, taxable: 0, cgst: 0, sgst: 0, igst: 0, gst: 0, count: 0 };
    g.taxable += num(r.taxable_value); g.cgst += num(r.cgst); g.sgst += num(r.sgst);
    g.igst += num(r.igst); g.gst += gstOf(r); g.count += 1;
    map.set(pct, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, taxable: round2(g.taxable), cgst: round2(g.cgst), sgst: round2(g.sgst), igst: round2(g.igst), gst: round2(g.gst) }))
    .sort((a, b) => a.rate - b.rate);
}

function byPos(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const code = r.place_of_supply || 'UNKNOWN';
    const g = map.get(code) || { stateCode: code, taxable: 0, cgst: 0, sgst: 0, igst: 0, count: 0 };
    g.taxable += num(r.taxable_value); g.cgst += num(r.cgst); g.sgst += num(r.sgst);
    g.igst += num(r.igst); g.count += 1;
    map.set(code, g);
  }
  return [...map.values()]
    .map((g) => ({ ...g, taxable: round2(g.taxable), cgst: round2(g.cgst), sgst: round2(g.sgst), igst: round2(g.igst) }))
    .sort((a, b) => b.taxable - a.taxable);
}

function bySource(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const k = r.source_type || 'other';
    const g = map.get(k) || { sourceType: k, taxable: 0, gst: 0, count: 0 };
    g.taxable += num(r.taxable_value); g.gst += gstOf(r); g.count += 1;
    map.set(k, g);
  }
  return [...map.values()].map((g) => ({ ...g, taxable: round2(g.taxable), gst: round2(g.gst) }));
}

// ── Return working papers (labelled "working", NOT filing files) ──
// GSTR-3B working: 3.1(a) outward taxable supplies + 3.2 inter-state breakup.
function gstr3bWorking(rows) {
  const s = summarize(rows);
  const interStateByPos = byPos(rows).filter((p) => p.igst > 0)
    .map((p) => ({ posStateCode: p.stateCode, taxable: p.taxable, igst: p.igst }));
  return {
    label: 'GSTR-3B working (not a filing file)',
    outwardTaxableSupplies: { taxableValue: s.taxable, igst: s.igst, cgst: s.cgst, sgst: s.sgst },
    interStateSupplies: interStateByPos,
    itcAvailable: { igst: 0, cgst: 0, sgst: 0, note: 'No input-GST data captured' },
    netTaxPayable: { total: s.totalGst },
  };
}

// GSTR-1 working: B2B (buyer has GSTIN) vs B2C, each split by rate.
function gstr1Working(rows) {
  const b2b = [], b2c = [];
  for (const r of rows || []) (r.buyer_gstin ? b2b : b2c).push(r);
  return {
    label: 'GSTR-1 working (not a filing file)',
    b2b: { summary: summarize(b2b), byRate: byRate(b2b) },
    b2c: { summary: summarize(b2c), byRate: byRate(b2c) },
  };
}

// ── DB layer (thin) ───────────────────────────────────────────
function applyFilters(q, { from, to, sourceType, gstin, posCode } = {}) {
  if (from) q = q.gte('issued_at', from);
  if (to) q = q.lt('issued_at', to);
  if (sourceType) q = q.eq('source_type', sourceType);
  if (gstin) q = q.eq('buyer_gstin', gstin);
  if (posCode) q = q.eq('place_of_supply', posCode);
  return q;
}

// Fetch every invoice row in a period for aggregation. Period-bounded, so the row
// count is one tax period — acceptable in memory.
// ponytail: move to an indexed SQL aggregation view if a single period ever
// exceeds ~50k invoices (mirrors financeAdminController's P4 TODO).
async function fetchInvoiceRows(filters = {}) {
  const { supabaseAdmin } = require('../../config/supabase');
  const q = applyFilters(supabaseAdmin.from('invoices').select(INVOICE_COLS), filters);
  const { data, error } = await q.order('issued_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Server-side paginated transaction/invoice register.
async function fetchRegister(filters = {}, { page = 1, limit = 50 } = {}) {
  const { supabaseAdmin } = require('../../config/supabase');
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(500, Math.max(1, Number(limit) || 50));
  let q = applyFilters(supabaseAdmin.from('invoices').select(INVOICE_COLS, { count: 'exact' }), filters);
  q = q.order('issued_at', { ascending: false }).range((p - 1) * l, p * l - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data || [], total: count || 0, page: p, limit: l };
}

async function fetchInvoiceById(id) {
  const { supabaseAdmin } = require('../../config/supabase');
  const { data, error } = await supabaseAdmin.from('invoices').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}

module.exports = {
  INVOICE_COLS, sellerStateCode: seller.stateCode, ratePct,
  summarize, liability, byHead, byRate, byPos, bySource, gstr3bWorking, gstr1Working,
  fetchInvoiceRows, fetchRegister, fetchInvoiceById,
};
