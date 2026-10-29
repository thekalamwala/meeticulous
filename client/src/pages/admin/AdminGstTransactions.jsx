// AdminGstTransactions.jsx — /admin/gst/transactions — master GST register.
// Server-side paginated + filtered over the invoices table; CSV export.
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader, Card, Badge, Btn, Skeleton } from '../../components/admin/ui';
import { adminGstTransactions, adminGstReportCsv } from '../../services/api';
import { inr, num, PeriodFilter, defaultPeriod, periodParams, downloadBlob, SOURCE_LABEL } from './gstShared';

const LIMIT = 50;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—');

// Seed the period from ?fy/&month/&quarter if we arrived via an overview drill-down.
function periodFromSearch(sp) {
  const fy = sp.get('fy');
  if (!fy) return defaultPeriod();
  if (sp.get('month')) return { mode: 'month', fy, month: Number(sp.get('month')), quarter: 1 };
  if (sp.get('quarter')) return { mode: 'quarter', fy, month: 1, quarter: Number(sp.get('quarter')) };
  return { mode: 'annual', fy, month: 1, quarter: 1 };
}

export default function AdminGstTransactions() {
  const [sp] = useSearchParams();
  const [period, setPeriod] = useState(() => periodFromSearch(sp));
  const [filters, setFilters] = useState({ source_type: sp.get('source_type') || '', gstin: '', pos: '' });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const query = useCallback(() => {
    const p = { ...periodParams(period), page, limit: LIMIT };
    if (filters.source_type) p.source_type = filters.source_type;
    if (filters.gstin) p.gstin = filters.gstin.trim();
    if (filters.pos) p.pos = filters.pos.trim();
    return p;
  }, [period, filters, page]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGstTransactions(query());
      setRows(res.data.rows || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load GST transactions');
      setRows([]); setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const setFilter = (patch) => { setPage(1); setFilters((f) => ({ ...f, ...patch })); };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await adminGstReportCsv('transactions', query());
      downloadBlob(res, `gst-register-${period.fy}.csv`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="GST Transactions"
        subtitle="Master GST register — every taxed supply, from the invoices ledger"
        actions={<Btn variant="outline" size="sm" onClick={exportCsv} disabled={exporting || !rows.length}>{exporting ? 'Exporting…' : 'Export CSV'}</Btn>}
      />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <PeriodFilter value={period} onChange={(v) => { setPage(1); setPeriod(v); }} />
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide adm-t3">
          Stream
          <select className="fb-input text-sm" value={filters.source_type} onChange={(e) => setFilter({ source_type: e.target.value })}>
            <option value="">All</option>
            <option value="booking">Booking fee</option>
            <option value="subscription">Subscription</option>
            <option value="commission">Commission</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide adm-t3">
          Buyer GSTIN
          <input className="fb-input text-sm" value={filters.gstin} placeholder="27ABC…" onChange={(e) => setFilter({ gstin: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide adm-t3">
          Place of supply
          <input className="fb-input text-sm w-24" value={filters.pos} placeholder="e.g. 27" onChange={(e) => setFilter({ pos: e.target.value })} />
        </label>
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : !rows.length ? (
        <div className="adm-card rounded-2xl py-16 text-center adm-t3">No GST transactions match these filters.</div>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="adm-table w-full text-sm tabular-nums">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Invoice</th>
                  <th className="text-left px-4 py-3">Stream</th>
                  <th className="text-left px-4 py-3">Buyer</th>
                  <th className="text-left px-4 py-3">GSTIN</th>
                  <th className="text-right px-4 py-3">POS</th>
                  <th className="text-right px-4 py-3">Taxable</th>
                  <th className="text-right px-4 py-3">CGST</th>
                  <th className="text-right px-4 py-3">SGST</th>
                  <th className="text-right px-4 py-3">IGST</th>
                  <th className="text-right px-4 py-3">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b adm-border last:border-0 adm-hoverable">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.issued_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{r.invoice_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><Badge tone="neutral">{SOURCE_LABEL[r.source_type] || r.source_type}</Badge></td>
                    <td className="px-4 py-3 max-w-[180px] truncate" title={r.buyer_name}>{r.buyer_name}</td>
                    <td className="px-4 py-3 whitespace-nowrap adm-t3">{r.buyer_gstin || '—'}</td>
                    <td className="px-4 py-3 text-right">{r.place_of_supply || '—'}</td>
                    <td className="px-4 py-3 text-right">{inr(r.taxable_value)}</td>
                    <td className="px-4 py-3 text-right">{inr(r.cgst)}</td>
                    <td className="px-4 py-3 text-right">{inr(r.sgst)}</td>
                    <td className="px-4 py-3 text-right">{inr(r.igst)}</td>
                    <td className="px-4 py-3 text-right font-medium">{inr(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex items-center justify-between mt-4">
        <span className="text-sm adm-t3">{num(total)} transactions</span>
        <div className="flex items-center gap-3">
          <Btn variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn>
          <span className="text-sm">Page {page} of {totalPages}</span>
          <Btn variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
        </div>
      </div>
    </div>
  );
}
