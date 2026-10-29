'use strict';
/**
 * gstAdminController.js — GST command center API (spec §3/§4/§9/§10, P1 backend).
 *
 * Every number is DERIVED from the invoices table (source of truth, §3) via
 * gstEngine — this controller does zero tax math. Writes are limited to workflow
 * state (issue status, return status) and are audited through the shared
 * admin_audit_logs trail. Export generation is P4 (documented 501 stub here).
 */

const { safeError } = require('../utils/httpError');
const { supabaseAdmin } = require('../config/supabase');
const { audit } = require('../services/auditService');
const { hasPermission } = require('../lib/adminPermissions');
const { seller, SAC_SUBSCRIPTION, SERIES } = require('../config/sellerIdentity');
const { DEFAULTS } = require('../lib/pricingEngine');
const period = require('../services/gst/gstPeriod');
const engine = require('../services/gst/gstEngine');
const exceptions = require('../services/gst/gstExceptions');
const reconcileService = require('../services/gst/gstReconcile');
const { itcReport } = require('../services/gst/itcStub');
const exportService = require('../services/gst/gstExportService');
const { buildTaxInvoiceHTML } = require('../services/invoiceHtml');

const p = (req) => period.resolvePeriod({ fy: req.query.fy, month: req.query.month, quarter: req.query.quarter });

// GST return due dates (working reference, not authoritative): GSTR-1 11th of the
// next month, GSTR-3B 20th of the next month (monthly filer). IST dates.
function nextFilingForPeriod(range) {
  const label = range.label;
  return {
    period: label,
    gstr1: { return_type: 'GSTR-1', due: `11th of month after ${label}` },
    gstr3b: { return_type: 'GSTR-3B', due: `20th of month after ${label}` },
  };
}

// ── GET /admin/gst/overview ───────────────────────────────────
const getOverview = async (req, res) => {
  try {
    const range = p(req);
    const rows = await engine.fetchInvoiceRows({ from: range.from, to: range.to });
    const summary = engine.summarize(rows);
    const liability = engine.liability(rows);

    // Health from computed row defects (real data, no fake %).
    let attention = 0, taxMismatch = 0, missingGst = 0;
    for (const r of rows) {
      const iss = exceptions.detectRowIssues(r);
      if (iss.length) attention += 1;
      for (const i of iss) {
        if (['TAX_MISMATCH', 'HEAD_INCONSISTENCY', 'POS_HEAD_MISMATCH'].includes(i.type)) taxMismatch += 1;
        if (['MISSING_GSTIN', 'INVALID_GSTIN', 'MISSING_POS'].includes(i.type)) missingGst += 1;
      }
    }
    const reconciledPct = rows.length ? Math.round(((rows.length - attention) / rows.length) * 1000) / 10 : 100;

    // Return preparation % for this FY from the tracked returns.
    const { data: rets } = await supabaseAdmin
      .from('gst_returns').select('status').eq('fiscal_year', range.fiscalYear);
    const totalRets = (rets || []).length;
    const doneRets = (rets || []).filter((r) => ['ready', 'filed'].includes(r.status)).length;
    const returnPrepPct = totalRets ? Math.round((doneRets / totalRets) * 1000) / 10 : 0;

    res.json({
      period: range,
      gstin: seller.gstin,
      kpis: {
        gstCollected: summary.totalGst,
        itcAvailable: 0,
        netLiability: liability.netLiability,
        itcAtRisk: 0,
        taxableValue: summary.taxable,
        invoiceCount: summary.count,
      },
      liability,
      byHead: engine.byHead(rows),
      bySource: engine.bySource(rows),
      health: {
        sales_invoices_reconciled_pct: reconciledPct,
        itc_reconciliation_pct: null, // no ITC data
        invoices_requiring_attention: attention,
        tax_mismatches: taxMismatch,
        missing_gst_information: missingGst,
        return_preparation_pct: returnPrepPct,
      },
      nextFiling: nextFilingForPeriod(range),
      itcNote: liability.itc.note,
    });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/gst/transactions ───────────────────────────────
const getTransactions = async (req, res) => {
  try {
    const range = p(req);
    const filters = { from: range.from, to: range.to, sourceType: req.query.source_type, gstin: req.query.gstin, posCode: req.query.pos };
    const { rows, total, page, limit } = await engine.fetchRegister(filters, { page: req.query.page, limit: req.query.limit });
    res.json({ period: range, rows, total, page, limit });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/gst/invoices ───────────────────────────────────
// Tabs: all | sales | purchase | credit | debit | cancelled. Only sales exist;
// purchase/credit/debit are empty by design (no input GST / no credit notes yet).
const listInvoices = async (req, res) => {
  try {
    const tab = (req.query.tab || 'all').toLowerCase();
    if (['purchase', 'credit', 'debit', 'cancelled'].includes(tab)) {
      const note = tab === 'purchase' ? 'No input-GST/purchase invoices are captured (§9).'
        : tab === 'cancelled' ? 'Invoices are immutable and never cancelled in place.'
          : 'Credit/debit notes are not issued yet — pending CA decision (§7/G2).';
      return res.json({ period: p(req), rows: [], total: 0, page: 1, limit: 50, empty: true, note });
    }
    const range = p(req);
    const filters = { from: range.from, to: range.to, gstin: req.query.gstin };
    const { rows, total, page, limit } = await engine.fetchRegister(filters, { page: req.query.page, limit: req.query.limit });
    res.json({ period: range, rows, total, page, limit });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/gst/invoices/:id ───────────────────────────────
const getInvoiceDetail = async (req, res) => {
  try {
    const inv = await engine.fetchInvoiceById(req.params.id);
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    const issues = exceptions.detectRowIssues(inv);
    // Drill-down links back to the source record.
    const source = { type: inv.source_type, id: inv.source_id, payment_id: inv.payment_id };
    res.json({ invoice: inv, issues, source, ratePct: engine.ratePct(inv) });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/gst/invoices/:id/download ──────────────────────
// Printable tax invoice (HTML → browser print-to-PDF). Reuses the same
// buildTaxInvoiceHTML the guest/email invoice links render, fed the raw
// invoices row (not the engine's shaped view) so the layout matches exactly.
const downloadInvoice = async (req, res) => {
  try {
    const { data: inv } = await supabaseAdmin
      .from('invoices').select('*').eq('id', req.params.id).maybeSingle();
    if (!inv) return res.status(404).json({ message: 'Invoice not found' });
    res
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="${(inv.invoice_number || 'invoice').replace(/[^\w.-]/g, '_')}.html"`)
      .send(buildTaxInvoiceHTML(inv));
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/gst/issues ─────────────────────────────────────
const getIssues = async (req, res) => {
  try {
    const range = p(req);
    const { issues, summary } = await exceptions.buildIssues({ from: range.from, to: range.to });
    const status = req.query.status;
    const filtered = status ? issues.filter((i) => i.status === status) : issues;
    res.json({ period: range, issues: filtered, summary });
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/gst/issues/status ─────────────────────────────
const setIssueStatus = async (req, res) => {
  try {
    const { issue_type, source_type, source_id, status, owner, note } = req.body || {};
    const allowed = ['open', 'under_review', 'resolved', 'ignored'];
    if (!issue_type || !source_type || !source_id) return res.status(400).json({ message: 'issue_type, source_type, source_id are required' });
    if (!allowed.includes(status)) return res.status(400).json({ message: `status must be one of ${allowed.join(', ')}` });

    const { data: prev } = await supabaseAdmin.from('gst_issue_status')
      .select('status').eq('issue_type', issue_type).eq('source_type', source_type).eq('source_id', String(source_id)).maybeSingle();

    const { error } = await supabaseAdmin.from('gst_issue_status').upsert({
      issue_type, source_type, source_id: String(source_id), status,
      owner: owner || null, note: note || null,
      updated_by: req.admin?.id || null, updated_at: new Date().toISOString(),
    }, { onConflict: 'issue_type,source_type,source_id' });
    if (error) return safeError(res, error);

    await audit(req, {
      action: 'GST_ISSUE_STATUS_CHANGED', resource_type: 'gst_issue', resource_id: `${issue_type}:${source_type}:${source_id}`,
      before: { status: prev?.status || 'open' }, after: { status, note: note || null },
    });
    res.json({ ok: true });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/gst/reconciliation ─────────────────────────────
const getReconciliation = async (req, res) => {
  try {
    const range = p(req);
    const result = await reconcileService.reconcile({ from: range.from, to: range.to });
    res.json({ period: range, ...result });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/gst/itc ────────────────────────────────────────
const getItc = async (req, res) => {
  res.json({ period: p(req), ...itcReport() });
};

// ── GET /admin/gst/returns ────────────────────────────────────
const getReturns = async (req, res) => {
  try {
    const fy = period.fyTwoDigit(period.normalizeFyStart(req.query.fy));
    const { data, error } = await supabaseAdmin
      .from('gst_returns').select('*').eq('fiscal_year', fy).order('period_key');
    if (error) return safeError(res, error);
    res.json({ fiscalYear: fy, gstin: seller.gstin, returns: data || [] });
  } catch (e) { safeError(res, e); }
};

// ── POST /admin/gst/returns/status ────────────────────────────
// Upsert a return's workflow state. "filed" REQUIRES an ARN (a filed return is
// only filed when it has a government reference — never on a button click alone).
const setReturnStatus = async (req, res) => {
  try {
    const { fiscal_year, period_type, period_key, return_type, status, arn, reconciliation_status } = req.body || {};
    const allowedStatus = ['not_started', 'preparing', 'needs_review', 'ready', 'filed'];
    const allowedType = ['GSTR1', 'GSTR3B'];
    const allowedPeriod = ['month', 'quarter'];
    if (!fiscal_year || !period_key) return res.status(400).json({ message: 'fiscal_year and period_key are required' });
    if (!allowedType.includes(return_type)) return res.status(400).json({ message: `return_type must be one of ${allowedType.join(', ')}` });
    if (!allowedPeriod.includes(period_type)) return res.status(400).json({ message: `period_type must be one of ${allowedPeriod.join(', ')}` });
    if (!allowedStatus.includes(status)) return res.status(400).json({ message: `status must be one of ${allowedStatus.join(', ')}` });
    if (status === 'filed' && !(arn && String(arn).trim())) return res.status(400).json({ message: 'An ARN is required to mark a return as filed' });
    // Marking a return FILED is a stronger grant than preparing it (the route
    // gate only requires gst.returns.prepare).
    if (status === 'filed' && !hasPermission(req.admin?.permissions, 'gst.returns_file')) {
      return res.status(403).json({ message: 'Forbidden — missing permission: gst.returns_file' });
    }

    const fy = period.fyTwoDigit(period.normalizeFyStart(fiscal_year));
    const filedNow = status === 'filed';
    const { data: prev } = await supabaseAdmin.from('gst_returns')
      .select('id, status').eq('gstin', seller.gstin).eq('fiscal_year', fy).eq('period_key', period_key).eq('return_type', return_type).maybeSingle();

    const row = {
      gstin: seller.gstin, fiscal_year: fy, period_type, period_key, return_type, status,
      reconciliation_status: reconciliation_status || null,
      arn: arn ? String(arn).trim() : null,
      filed_at: filedNow ? new Date().toISOString() : null,
      filed_by: filedNow ? (req.admin?.id || null) : null,
      prepared_by: req.admin?.id || null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabaseAdmin.from('gst_returns').upsert(row, { onConflict: 'gstin,fiscal_year,period_key,return_type' });
    if (error) return safeError(res, error);

    await audit(req, {
      action: filedNow ? 'GST_RETURN_MARKED_FILED' : 'GST_RETURN_STATUS_CHANGED',
      resource_type: 'gst_return', resource_id: `${fy}/${period_key}/${return_type}`,
      before: { status: prev?.status || 'not_started' }, after: { status, arn: row.arn },
    });
    res.json({ ok: true });
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/gst/reports/:type ──────────────────────────────
// JSON by default; ?format=csv for the register-style reports.
const toCsv = (header, rows) => {
  const esc = (c) => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const line = (cells) => cells.map(esc).join(',');
  return [line(header), ...rows.map(line)].join('\n');
};

const getReport = async (req, res) => {
  try {
    const range = p(req);
    const type = (req.params.type || '').toLowerCase();
    const rows = await engine.fetchInvoiceRows({ from: range.from, to: range.to, gstin: req.query.gstin });
    const wantCsv = (req.query.format || '').toLowerCase() === 'csv';

    const sendCsv = (name, header, csvRows) => {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${name}-${range.fiscalYear}-${range.periodKey}.csv"`);
      res.send(toCsv(header, csvRows));
    };

    switch (type) {
      case 'summary':
        return res.json({ period: range, summary: engine.summarize(rows), byHead: engine.byHead(rows), byRate: engine.byRate(rows), bySource: engine.bySource(rows), liability: engine.liability(rows) });
      case 'by-rate':
        return res.json({ period: range, rows: engine.byRate(rows) });
      case 'by-pos':
      case 'place-of-supply':
        return res.json({ period: range, rows: engine.byPos(rows) });
      case 'gstr1':
        return res.json({ period: range, ...engine.gstr1Working(rows) });
      case 'gstr3b':
        return res.json({ period: range, ...engine.gstr3bWorking(rows) });
      case 'itc':
        return res.json({ period: range, ...itcReport() });
      case 'reconciliation':
        return res.json({ period: range, ...(await reconcileService.reconcile({ from: range.from, to: range.to })) });
      case 'customer-gstin': {
        const map = new Map();
        for (const r of rows.filter((x) => x.source_type !== 'commission' && x.buyer_gstin)) {
          const g = map.get(r.buyer_gstin) || { gstin: r.buyer_gstin, name: r.buyer_name, taxable: 0, gst: 0, count: 0 };
          g.taxable += Number(r.taxable_value) || 0; g.gst += (Number(r.cgst) || 0) + (Number(r.sgst) || 0) + (Number(r.igst) || 0); g.count += 1;
          map.set(r.buyer_gstin, g);
        }
        return res.json({ period: range, rows: [...map.values()] });
      }
      case 'vendor-gstin': {
        // Host commission invoices: the host is the counterparty carrying the GSTIN.
        const map = new Map();
        for (const r of rows.filter((x) => x.source_type === 'commission')) {
          const k = r.buyer_gstin || `NO-GSTIN:${r.buyer_name}`;
          const g = map.get(k) || { gstin: r.buyer_gstin || null, name: r.buyer_name, taxable: 0, gst: 0, count: 0 };
          g.taxable += Number(r.taxable_value) || 0; g.gst += (Number(r.cgst) || 0) + (Number(r.sgst) || 0) + (Number(r.igst) || 0); g.count += 1;
          map.set(k, g);
        }
        return res.json({ period: range, rows: [...map.values()] });
      }
      case 'transactions':
      case 'sales-register':
        if (wantCsv) {
          const header = ['Invoice', 'Date', 'Source', 'Buyer', 'GSTIN', 'Place of Supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'SAC'];
          const csvRows = rows.map((r) => [r.invoice_number, r.issued_at, r.source_type, r.buyer_name, r.buyer_gstin || '', r.place_of_supply || '', r.taxable_value, r.cgst, r.sgst, r.igst, r.total, r.sac_code || '']);
          return sendCsv('gst-register', header, csvRows);
        }
        return res.json({ period: range, rows, total: rows.length });
      case 'credit-notes':
      case 'debit-notes':
        return res.json({ period: range, rows: [], empty: true, note: 'Not issued yet — pending CA decision (§7/G2).' });
      default:
        return res.status(400).json({ message: `Unknown report type "${type}"` });
    }
  } catch (e) { safeError(res, e); }
};

// ── GET /admin/gst/settings ───────────────────────────────────
// Read-only display of the seller identity + rate config (config-sourced today;
// promote to an editable gst_settings row later — see architecture §3/§15).
const getSettings = async (req, res) => {
  res.json({
    registration: {
      gstin: seller.gstin, legalName: seller.legalName, pan: seller.pan, cin: seller.cin,
      stateCode: seller.stateCode, stateName: seller.stateName, address: seller.address,
      registrationType: 'Regular', status: 'active',
    },
    taxConfig: { gstRate: DEFAULTS.gstRate, tdsRate: DEFAULTS.tdsRate, tcsRate: DEFAULTS.tcsRate, defaultSac: SAC_SUBSCRIPTION },
    invoiceConfig: { series: SERIES, fiscalYear: 'Apr–Mar (India)' },
    integrations: { gstPortal: false, eInvoicing: false, eWayBill: false, accounting: false },
    editable: false,
    note: 'Settings are read-only. Seller identity lives in config (sellerIdentity.js); a gst_settings table can make it editable later.',
  });
};

// ── Exports (history + generation) — P4 ───────────────────────
const listExports = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('gst_export_runs')
      .select('*').order('generated_at', { ascending: false }).limit(100);
    if (error) return safeError(res, error);
    res.json({ exports: data || [] });
  } catch (e) { safeError(res, e); }
};

// POST /admin/gst/exports — generate (or reuse) a period pack.
// body: { pack_type: 'monthly'|'quarterly'|'annual'|'full', fy, month?, quarter? }
// The period granularity is derived from pack_type; 'full' uses the FY.
const createExport = async (req, res) => {
  try {
    const packType = ['monthly', 'quarterly', 'annual', 'full'].includes(req.body?.pack_type) ? req.body.pack_type : 'monthly';
    // Map pack type → period query for gstPeriod.
    const q = { fy: req.body?.fy };
    if (packType === 'monthly') q.month = req.body?.month;
    else if (packType === 'quarterly') q.quarter = req.body?.quarter;
    const range = period.resolvePeriod(q);

    const { run, reused } = await exportService.generatePack({
      packType, range, actorId: req.admin?.id, actorEmail: req.admin?.email,
    });
    if (!reused) {
      await audit(req, {
        action: 'GST_EXPORT_GENERATED', resource_type: 'gst_export', resource_id: run.id,
        after: { pack_type: packType, period: range.label, records: run.record_count },
      });
    }
    res.json({ run, reused });
  } catch (e) { safeError(res, e); }
};

// GET /admin/gst/exports/:id/download — short-lived signed URL for a pack.
const downloadExport = async (req, res) => {
  try {
    const { data: run, error } = await supabaseAdmin.from('gst_export_runs').select('*').eq('id', req.params.id).single();
    if (error || !run) return res.status(404).json({ message: 'Export not found' });
    if (run.status !== 'complete' || !run.storage_path) return res.status(409).json({ message: `Export is ${run.status}, not ready to download` });
    const url = await exportService.signedUrlFor(run);
    if (!url) return res.status(500).json({ message: 'Could not sign the download URL' });
    await audit(req, { action: 'GST_EXPORT_DOWNLOADED', resource_type: 'gst_export', resource_id: run.id });
    res.json({ url });
  } catch (e) { safeError(res, e); }
};

module.exports = {
  getOverview, getTransactions, listInvoices, getInvoiceDetail, downloadInvoice,
  getIssues, setIssueStatus, getReconciliation, getItc,
  getReturns, setReturnStatus, getReport, getSettings, listExports, createExport, downloadExport,
};
