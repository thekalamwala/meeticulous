'use strict';
/**
 * gstExportService.js — GST CA-pack / export generation (P4, spec §11–§13).
 *
 * Assembles a period's GST working papers into a ZIP (CSV raw registers + XLSX
 * working papers + a README), uploads it to the private `gst-exports` bucket, and
 * records an immutable gst_export_runs row. Every figure comes from gstEngine
 * (invoices = source of truth); this module only formats and packages.
 *
 * Generation is INLINE (the admin's own action shows a spinner). Volumes are
 * small; a closed period's pack is content-hash deduped and reused.
 * ponytail: move to a job queue only if a single period's pack ever gets large
 * enough to block the event loop — not the case at current volumes.
 */

const crypto = require('crypto');
const archiver = require('archiver');
const ExcelJS = require('exceljs');
const { round2 } = require('../../lib/pricingEngine');
const { seller } = require('../../config/sellerIdentity');
const engine = require('./gstEngine');
const { buildIssues } = require('./gstExceptions');
const { reconcile } = require('./gstReconcile');

const BUCKET = 'gst-exports';
const num = (v) => Number(v) || 0;

// ── CSV helper (RFC-4180 quoting), mirrors withholdingReportService.toCsv ──
function toCsv(header, rows) {
  const esc = (c) => { const s = String(c ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const line = (cells) => cells.map(esc).join(',');
  return [line(header), ...rows.map(line)].join('\n');
}

// ── XLSX helper: sheets = [{ name, header, rows }] → Buffer ──
async function toXlsx(sheets) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Meeticulous GST';
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    ws.addRow(s.header);
    ws.getRow(1).font = { bold: true };
    for (const r of s.rows) ws.addRow(r);
    ws.columns.forEach((c) => { c.width = 18; });
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// ── ZIP helper: files = [{ name, content(string|Buffer) }] → Buffer ──
function zipFiles(files) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks = [];
    archive.on('data', (c) => chunks.push(c));
    archive.on('error', reject);
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    for (const f of files) archive.append(f.content, { name: f.name });
    archive.finalize();
  });
}

const paramsHash = ({ packType, fiscalYear, periodKey }) =>
  crypto.createHash('sha256').update(`${seller.gstin}|${packType}|${fiscalYear}|${periodKey}`).digest('hex').slice(0, 24);

// ── Build the file set for a period ───────────────────────────
async function buildFiles({ range, packType, actorEmail }) {
  const rows = await engine.fetchInvoiceRows({ from: range.from, to: range.to });
  const summary = engine.summarize(rows);
  const byRate = engine.byRate(rows);
  const byPos = engine.byPos(rows);
  const g1 = engine.gstr1Working(rows);
  const g3 = engine.gstr3bWorking(rows);
  const rec = await reconcile({ from: range.from, to: range.to });
  const { issues } = await buildIssues({ from: range.from, to: range.to });

  const invHeader = ['Invoice', 'Date', 'Source', 'Buyer', 'GSTIN', 'POS', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'SAC'];
  const invRow = (r) => [r.invoice_number, r.issued_at, r.source_type, r.buyer_name, r.buyer_gstin || '', r.place_of_supply || '', r.taxable_value, r.cgst, r.sgst, r.igst, r.total, r.sac_code || ''];

  // Customer/vendor GSTIN aggregations.
  const custMap = new Map();
  for (const r of rows.filter((x) => x.source_type !== 'commission' && x.buyer_gstin)) {
    const g = custMap.get(r.buyer_gstin) || { gstin: r.buyer_gstin, name: r.buyer_name, taxable: 0, gst: 0, count: 0 };
    g.taxable += num(r.taxable_value); g.gst += num(r.cgst) + num(r.sgst) + num(r.igst); g.count += 1; custMap.set(r.buyer_gstin, g);
  }
  const vendMap = new Map();
  for (const r of rows.filter((x) => x.source_type === 'commission')) {
    const k = r.buyer_gstin || `NO-GSTIN:${r.buyer_name}`;
    const g = vendMap.get(k) || { gstin: r.buyer_gstin || '', name: r.buyer_name, taxable: 0, gst: 0, count: 0 };
    g.taxable += num(r.taxable_value); g.gst += num(r.cgst) + num(r.sgst) + num(r.igst); g.count += 1; vendMap.set(k, g);
  }

  const emptyNote = (what) => `${what}\n\n(No rows — see 00_README for why.)`;

  const summaryXlsx = await toXlsx([
    { name: 'Summary', header: ['Metric', 'Value'], rows: [
      ['GSTIN', seller.gstin], ['Legal name', seller.legalName], ['Period', range.label],
      ['Invoices', summary.count], ['Taxable value', summary.taxable],
      ['CGST', summary.cgst], ['SGST', summary.sgst], ['IGST', summary.igst],
      ['Total output GST', summary.totalGst], ['Eligible ITC', 0], ['Net GST liability', summary.totalGst],
    ] },
    { name: 'By rate', header: ['Rate %', 'Taxable', 'CGST', 'SGST', 'IGST', 'GST', 'Count'], rows: byRate.map((r) => [r.rate, r.taxable, r.cgst, r.sgst, r.igst, r.gst, r.count]) },
  ]);

  const g1Xlsx = await toXlsx([
    { name: 'B2B by rate', header: ['Rate %', 'Taxable', 'GST', 'Count'], rows: g1.b2b.byRate.map((r) => [r.rate, r.taxable, r.gst, r.count]) },
    { name: 'B2C by rate', header: ['Rate %', 'Taxable', 'GST', 'Count'], rows: g1.b2c.byRate.map((r) => [r.rate, r.taxable, r.gst, r.count]) },
  ]);
  const g3Xlsx = await toXlsx([
    { name: 'GSTR-3B working', header: ['Line', 'Taxable', 'IGST', 'CGST', 'SGST'], rows: [
      ['3.1(a) Outward taxable', g3.outwardTaxableSupplies.taxableValue, g3.outwardTaxableSupplies.igst, g3.outwardTaxableSupplies.cgst, g3.outwardTaxableSupplies.sgst],
      ['Net tax payable', '', '', '', g3.netTaxPayable.total],
    ] },
    { name: 'Inter-state (3.2)', header: ['POS state', 'Taxable', 'IGST'], rows: g3.interStateSupplies.map((s) => [s.posStateCode, s.taxable, s.igst]) },
  ]);

  const files = [
    { name: '01_GST_Summary.xlsx', content: summaryXlsx },
    { name: '02_Sales_Invoice_Register.csv', content: toCsv(invHeader, rows.map(invRow)) },
    { name: '03_Purchase_Register.csv', content: emptyNote('Purchase / input-GST register') },
    { name: '04_GST_Transactions.csv', content: toCsv(invHeader, rows.map(invRow)) },
    { name: '05_Credit_Notes.csv', content: emptyNote('Credit notes') },
    { name: '06_Debit_Notes.csv', content: emptyNote('Debit notes') },
    { name: '07_ITC_Report.csv', content: emptyNote('Input Tax Credit') },
    { name: '08_ITC_Reconciliation.csv', content: emptyNote('ITC reconciliation') },
    { name: '09_Place_of_Supply.csv', content: toCsv(['POS state', 'Taxable', 'CGST', 'SGST', 'IGST', 'Count'], byPos.map((p) => [p.stateCode, p.taxable, p.cgst, p.sgst, p.igst, p.count])) },
    { name: '10_Customer_GST_Details.csv', content: toCsv(['GSTIN', 'Name', 'Taxable', 'GST', 'Invoices'], [...custMap.values()].map((c) => [c.gstin, c.name, round2(c.taxable), round2(c.gst), c.count])) },
    { name: '11_Vendor_GST_Details.csv', content: toCsv(['GSTIN', 'Host', 'Taxable', 'GST', 'Invoices'], [...vendMap.values()].map((v) => [v.gstin, v.name, round2(v.taxable), round2(v.gst), v.count])) },
    { name: '12_GSTR1_Working.xlsx', content: g1Xlsx },
    { name: '13_GSTR3B_Working.xlsx', content: g3Xlsx },
    { name: '14_GST_Reconciliation.csv', content: toCsv(['Metric', 'Value'], [['Invoices GST', rec.ours.gst], ['Ledger GST (2100)', rec.ledger.found ? rec.ledger.gst : 'n/a'], ['Difference', rec.difference], ['Status', rec.status], ['Reason', rec.reason || '']]) },
    { name: '15_Exceptions.csv', content: toCsv(['Type', 'Severity', 'Message', 'Amount', 'Source', 'Source ID', 'Status'], issues.map((i) => [i.type, i.severity, i.message, i.amount ?? '', i.sourceType, i.sourceId, i.status])) },
  ];

  // Full accounting pack: add financial transactions (paid bookings + subs).
  if (packType === 'full') {
    files.push({ name: '16_Financial_Transactions.csv', content: await financialTxnCsv(range) });
  }

  files.push({ name: '00_README.txt', content: readme({ range, packType, actorEmail, summary, issues, rec }) });
  return { files, summary, rows };
}

async function financialTxnCsv(range) {
  const { supabaseAdmin } = require('../../config/supabase');
  const [{ data: bookings }, { data: subs }] = await Promise.all([
    supabaseAdmin.from('bookings').select('id, paid_at, customer_total, platform_fee_amount, platform_fee_gst, commission_applied, commission_gst, tds_amount, tcs_amount').eq('payment_status', 'paid').gte('paid_at', range.from).lt('paid_at', range.to),
    supabaseAdmin.from('subscription_payments').select('id, created_at, plan_price, gst_amount, total_charged').eq('status', 'paid').gte('created_at', range.from).lt('created_at', range.to),
  ]);
  const header = ['Type', 'ID', 'Date', 'Customer total', 'Platform fee', 'Fee GST', 'Commission', 'Commission GST', 'TDS', 'TCS', 'Plan price', 'Sub GST', 'Total charged'];
  const rows = [];
  for (const b of bookings || []) rows.push(['booking', b.id, b.paid_at, b.customer_total, b.platform_fee_amount, b.platform_fee_gst, b.commission_applied, b.commission_gst, b.tds_amount, b.tcs_amount, '', '', '']);
  for (const s of subs || []) rows.push(['subscription', s.id, s.created_at, '', '', '', '', '', '', '', s.plan_price, s.gst_amount, s.total_charged]);
  return toCsv(header, rows);
}

function readme({ range, packType, actorEmail, summary, issues, rec }) {
  return [
    `Meeticulous — GST ${packType} pack`,
    `Entity: ${seller.legalName} (${seller.gstin})`,
    `Period: ${range.label}  [${range.from} .. ${range.to})`,
    `Generated: ${new Date().toISOString()} by ${actorEmail || 'admin'}`,
    '',
    `Coverage: ${summary.count} invoices · taxable ${summary.taxable} · output GST ${summary.totalGst}`,
    `Reconciliation: ${rec.status}${rec.reason ? ' — ' + rec.reason : ''}`,
    `Exceptions: ${issues.length}`,
    '',
    'NOTES / LIMITATIONS:',
    '- Output GST only. The platform captures no input-GST, so Purchase Register,',
    '  ITC Report and ITC Reconciliation are intentionally empty.',
    '- Credit/Debit note registers are empty: refunds are reversed in the ledger',
    '  but not yet issued as GST credit notes (pending CA decision).',
    '- GSTR-1 and GSTR-3B files are WORKING PAPERS, not government filing files.',
    '- All figures derive from the immutable invoices table (source of truth).',
    '- Have the final tax treatment reviewed by your CA before filing.',
  ].join('\n');
}

// ── Public: generate (or reuse) a pack and record the run ─────
async function generatePack({ packType, range, actorId, actorEmail }) {
  const { supabaseAdmin } = require('../../config/supabase');
  const hash = paramsHash({ packType, fiscalYear: range.fiscalYear, periodKey: range.periodKey });
  const closed = new Date(range.to).getTime() < Date.now();

  // Reuse an existing complete pack for a CLOSED period with the same params.
  if (closed) {
    const { data: existing } = await supabaseAdmin.from('gst_export_runs')
      .select('*').eq('params_hash', hash).eq('status', 'complete').order('generated_at', { ascending: false }).limit(1).maybeSingle();
    if (existing) return { run: existing, reused: true };
  }

  const name = `${packType === 'full' ? 'Full Accounting' : 'GST'} Pack — ${range.label}`;
  // Record a running row first so a crash leaves a visible failed/running trace.
  const { data: run, error: insErr } = await supabaseAdmin.from('gst_export_runs').insert({
    name, pack_type: packType, gstin: seller.gstin, fiscal_year: range.fiscalYear, period_key: range.periodKey,
    params_hash: hash, status: 'running', generated_by: actorId || null,
  }).select().single();
  if (insErr) throw insErr;

  try {
    const { files, summary } = await buildFiles({ range, packType, actorEmail });
    const zip = await zipFiles(files);
    const path = `${range.fiscalYear}/${packType}-${range.periodKey}-${Date.now()}.zip`;
    const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(path, zip, { contentType: 'application/zip', upsert: false });
    if (upErr) throw upErr;

    const { data: done, error: updErr } = await supabaseAdmin.from('gst_export_runs').update({
      status: 'complete', storage_path: path,
      record_count: summary.count, taxable_total: summary.taxable, gst_total: summary.totalGst,
    }).eq('id', run.id).select().single();
    if (updErr) throw updErr;
    return { run: done, reused: false };
  } catch (e) {
    await supabaseAdmin.from('gst_export_runs').update({ status: 'failed' }).eq('id', run.id);
    throw e;
  }
}

// Short-lived signed URL for a completed pack.
async function signedUrlFor(run) {
  const { supabaseAdmin } = require('../../config/supabase');
  if (!run?.storage_path) return null;
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(run.storage_path, 120);
  if (error) throw error;
  return data?.signedUrl || null;
}

module.exports = { generatePack, signedUrlFor, BUCKET, toCsv, zipFiles };
