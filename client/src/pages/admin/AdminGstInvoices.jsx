// AdminGstInvoices.jsx — /admin/gst/invoices — tabbed invoice view + tax detail.
// Sales invoices are real; purchase/credit/debit/cancelled are empty by design
// (no input GST, no credit notes yet) and render the server's explanatory note.
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Badge, Btn, Skeleton } from '../../components/admin/ui';
import { adminGstInvoices, adminGstInvoice, adminGstInvoiceDownload } from '../../services/api';
import { inr, num, PeriodFilter, defaultPeriod, periodParams, SOURCE_LABEL, downloadBlob } from './gstShared';

const LIMIT = 50;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—');
const TABS = [
  ['all', 'All'], ['sales', 'Sales'], ['purchase', 'Purchase'],
  ['credit', 'Credit Notes'], ['debit', 'Debit Notes'], ['cancelled', 'Cancelled'],
];

export default function AdminGstInvoices() {
  const [period, setPeriod] = useState(defaultPeriod);
  const [tab, setTab] = useState('all');
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ rows: [], total: 0, empty: false, note: '' });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGstInvoices({ ...periodParams(period), tab, page, limit: LIMIT });
      setState({ rows: res.data.rows || [], total: res.data.total || 0, empty: !!res.data.empty, note: res.data.note || '' });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load invoices');
      setState({ rows: [], total: 0, empty: false, note: '' });
    } finally {
      setLoading(false);
    }
  }, [period, tab, page]);

  useEffect(() => { load(); }, [load]);

  const openDetail = async (id) => {
    setDetail({ loading: true });
    try {
      const res = await adminGstInvoice(id);
      setDetail({ loading: false, ...res.data });
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load invoice');
      setDetail(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(state.total / LIMIT));

  return (
    <div>
      <PageHeader title="GST Invoices" subtitle="Tax invoices with CGST/SGST/IGST breakdown" />

      <div className="mb-4"><PeriodFilter value={period} onChange={(v) => { setPage(1); setPeriod(v); }} /></div>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setPage(1); setTab(key); }}
            className={`px-3 py-1.5 rounded-xl text-sm border adm-border ${tab === key ? 'adm-chip font-medium' : 'adm-t3 adm-hoverable'}`}
          >{label}</button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : state.empty ? (
        <div className="adm-card rounded-2xl py-16 text-center adm-t3 px-6">{state.note}</div>
      ) : !state.rows.length ? (
        <div className="adm-card rounded-2xl py-16 text-center adm-t3">No invoices in this period.</div>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="adm-table w-full text-sm tabular-nums">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
                  <th className="text-left px-4 py-3">Invoice</th>
                  <th className="text-left px-4 py-3">Date</th>
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
                {state.rows.map((r) => (
                  <tr key={r.id} className="border-b adm-border last:border-0 adm-hoverable cursor-pointer" onClick={() => openDetail(r.id)}>
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{r.invoice_number}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(r.issued_at)}</td>
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

      {!state.empty && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-sm adm-t3">{num(state.total)} invoices</span>
          <div className="flex items-center gap-3">
            <Btn variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Btn>
            <span className="text-sm">Page {page} of {totalPages}</span>
            <Btn variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Btn>
          </div>
        </div>
      )}

      {detail && <InvoiceDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function InvoiceDetailModal({ detail, onClose }) {
  const inv = detail.invoice;
  const [downloading, setDownloading] = useState(false);
  const download = async () => {
    if (!inv) return;
    setDownloading(true);
    try {
      const res = await adminGstInvoiceDownload(inv.id);
      downloadBlob(res, `${inv.invoice_number || 'invoice'}.html`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to download invoice');
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="adm-card rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        {detail.loading ? (
          <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : !inv ? (
          <div className="adm-t3">Invoice not found.</div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-lg font-semibold">{inv.invoice_number}</div>
                <div className="text-xs adm-t3">{fmtDate(inv.issued_at)} · <span className="capitalize">{SOURCE_LABEL[inv.source_type] || inv.source_type}</span> · {detail.ratePct}% GST</div>
              </div>
              <div className="flex items-center gap-2">
                <Btn variant="outline" size="sm" onClick={download} disabled={downloading}>{downloading ? 'Downloading…' : 'Download'}</Btn>
                <button onClick={onClose} className="adm-t3 text-xl leading-none px-2" aria-label="Close">×</button>
              </div>
            </div>

            <div className="text-[11px] uppercase tracking-wide adm-t3 mb-1">Buyer</div>
            <div className="text-sm mb-1">{inv.buyer_name}</div>
            <div className="text-xs adm-t3 mb-4">
              {inv.buyer_gstin ? `GSTIN ${inv.buyer_gstin}` : 'No GSTIN'} · POS {inv.place_of_supply || '—'} · SAC {inv.sac_code || '—'}
            </div>

            <table className="w-full text-sm tabular-nums mb-4">
              <tbody>
                <tr className="border-b adm-border"><td className="py-2 adm-t2">Taxable value</td><td className="py-2 text-right">{inr(inv.taxable_value)}</td></tr>
                <tr className="border-b adm-border"><td className="py-2 adm-t2">CGST</td><td className="py-2 text-right">{inr(inv.cgst)}</td></tr>
                <tr className="border-b adm-border"><td className="py-2 adm-t2">SGST</td><td className="py-2 text-right">{inr(inv.sgst)}</td></tr>
                <tr className="border-b adm-border"><td className="py-2 adm-t2">IGST</td><td className="py-2 text-right">{inr(inv.igst)}</td></tr>
                <tr><td className="py-2 font-semibold">Total</td><td className="py-2 text-right font-semibold">{inr(inv.total)}</td></tr>
              </tbody>
            </table>

            {!!(detail.issues || []).length && (
              <div className="mb-4">
                <div className="text-[11px] uppercase tracking-wide adm-t3 mb-2">Issues</div>
                <div className="flex flex-col gap-2">
                  {detail.issues.map((i, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Badge tone={i.severity === 'high' ? 'danger' : i.severity === 'medium' ? 'warn' : 'neutral'}>{i.type}</Badge>
                      <span className="text-xs adm-t2">{i.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[11px] uppercase tracking-wide adm-t3 mb-1">Source record</div>
            <div className="text-xs adm-t2">{detail.source?.type} · {detail.source?.id}{detail.source?.payment_id ? ` · payment ${detail.source.payment_id}` : ''}</div>
          </>
        )}
      </div>
    </div>
  );
}
