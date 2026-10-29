'use strict';
/**
 * withholdingAdminController — TDS (194-O) / TCS (GST §52) filing exports.
 * 26Q = kind 'tds', GSTR-8 = kind 'tcs'. PAN is decrypted here because a filing
 * needs it; the route is admin-permission gated (analytics.view).
 */
const { safeError } = require('../utils/httpError');
const { buildWithholdingReport, toCsv } = require('../services/withholdingReportService');

// GET /api/admin/reports/withholding?from&to&kind=tds|tcs&format=json|csv
async function getWithholdingReport(req, res) {
  try {
    const { from, to, format = 'json' } = req.query;
    const kind = req.query.kind === 'tcs' ? 'tcs' : 'tds';
    const rows = await buildWithholdingReport({ from, to, revealPan: true });
    if (format === 'csv') {
      const csv = toCsv(rows, kind);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition',
        `attachment; filename="withholding-${kind}-${from || 'all'}_${to || 'all'}.csv"`);
      return res.send(csv);
    }
    res.json({ from: from || null, to: to || null, kind, rows });
  } catch (e) { safeError(res, e); }
}

module.exports = { getWithholdingReport };
