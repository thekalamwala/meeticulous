// AdminGstReports.jsx — /admin/gst/reports — report console.
// Pick a period + report; view the derived figures or download CSV. GSTR-1/3B
// are working papers (not government filing files).
import React, { useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PageHeader, Card, Btn, Badge, Skeleton } from '../../components/admin/ui';
import { adminGstReport, adminGstReportCsv } from '../../services/api';
import { inr, num, PeriodFilter, defaultPeriod, periodParams, downloadBlob } from './gstShared';

const REPORTS = [
  { key: 'summary', label: 'GST Summary' },
  { key: 'by-rate', label: 'Tax Rate Summary' },
  { key: 'place-of-supply', label: 'Place of Supply' },
  { key: 'customer-gstin', label: 'Customer GSTIN' },
  { key: 'vendor-gstin', label: 'Vendor / Host GSTIN' },
  { key: 'gstr1', label: 'GSTR-1 Working' },
  { key: 'gstr3b', label: 'GSTR-3B Working' },
  { key: 'reconciliation', label: 'Reconciliation' },
  { key: 'itc', label: 'ITC' },
  { key: 'transactions', label: 'Transaction Register', csv: true },
];

const money = (v) => (typeof v === 'number' ? inr(v) : v);

// Generic table for a rows[] report.
function RowsTable({ rows }) {
  if (!rows.length) return <div className="py-8 text-center adm-t3">No rows for this period.</div>;
  const cols = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="adm-table w-full text-sm tabular-nums">
        <thead><tr className="text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
          {cols.map((c) => <th key={c} className="text-left px-3 py-2">{c.replace(/_/g, ' ')}</th>)}
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b adm-border last:border-0">
              {cols.map((c) => <td key={c} className="px-3 py-2">{/gst|taxable|cgst|sgst|igst|total|amount/i.test(c) ? money(r[c]) : String(r[c] ?? '—')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const KV = ({ label, value }) => (
  <div className="flex justify-between border-b adm-border py-2 text-sm"><span className="adm-t2">{label}</span><span className="tabular-nums font-medium">{value}</span></div>
);

function ResultView({ type, data }) {
  if (!data) return null;
  if (Array.isArray(data.rows)) return <RowsTable rows={data.rows} />;

  if (type === 'summary' && data.summary) {
    const s = data.summary;
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><div className="text-sm font-semibold mb-2">Totals</div>
          <KV label="Invoices" value={num(s.count)} /><KV label="Taxable value" value={inr(s.taxable)} />
          <KV label="CGST" value={inr(s.cgst)} /><KV label="SGST" value={inr(s.sgst)} /><KV label="IGST" value={inr(s.igst)} />
          <KV label="Total GST" value={inr(s.totalGst)} /><KV label="Total" value={inr(s.total)} />
        </Card>
        <Card><div className="text-sm font-semibold mb-2">By rate</div><RowsTable rows={data.byRate || []} /></Card>
      </div>
    );
  }
  if (type === 'gstr3b' && data.outwardTaxableSupplies) {
    const o = data.outwardTaxableSupplies;
    return (
      <Card>
        <Badge tone="info">{data.label}</Badge>
        <div className="mt-3"><div className="text-sm font-semibold mb-1">3.1(a) Outward taxable supplies</div>
          <KV label="Taxable value" value={inr(o.taxableValue)} /><KV label="IGST" value={inr(o.igst)} /><KV label="CGST" value={inr(o.cgst)} /><KV label="SGST" value={inr(o.sgst)} />
        </div>
        <div className="mt-3 text-sm font-semibold mb-1">3.2 Inter-state supplies</div>
        <RowsTable rows={data.interStateSupplies || []} />
        <div className="mt-3"><KV label="Net tax payable" value={inr(data.netTaxPayable?.total)} /></div>
        <div className="text-xs adm-t3 mt-2">ITC available: {inr(0)} — {data.itcAvailable?.note}</div>
      </Card>
    );
  }
  if (type === 'gstr1' && data.b2b) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card><div className="text-sm font-semibold mb-2">B2B (registered buyers)</div>
          <KV label="Invoices" value={num(data.b2b.summary.count)} /><KV label="Taxable" value={inr(data.b2b.summary.taxable)} /><KV label="Total GST" value={inr(data.b2b.summary.totalGst)} />
          <div className="mt-2"><RowsTable rows={data.b2b.byRate || []} /></div>
        </Card>
        <Card><div className="text-sm font-semibold mb-2">B2C</div>
          <KV label="Invoices" value={num(data.b2c.summary.count)} /><KV label="Taxable" value={inr(data.b2c.summary.taxable)} /><KV label="Total GST" value={inr(data.b2c.summary.totalGst)} />
          <div className="mt-2"><RowsTable rows={data.b2c.byRate || []} /></div>
        </Card>
      </div>
    );
  }
  if (type === 'reconciliation') {
    return (
      <Card>
        <KV label="Our GST (invoices)" value={inr(data.ours?.gst)} />
        <KV label="Ledger GST (2100)" value={data.ledger?.found ? inr(data.ledger?.gst) : '—'} />
        <KV label="Difference" value={inr(data.difference)} />
        <div className="mt-2"><Badge tone={data.status === 'matched' ? 'ok' : 'danger'}>{data.status}</Badge></div>
        {data.reason && <div className="text-sm adm-t2 mt-2">{data.reason}</div>}
      </Card>
    );
  }
  if (type === 'itc') {
    return <Card><div className="text-sm adm-t2">{data.reason}</div></Card>;
  }
  return <pre className="text-xs overflow-auto adm-card rounded-xl p-4">{JSON.stringify(data, null, 2)}</pre>;
}

export default function AdminGstReports() {
  const [period, setPeriod] = useState(defaultPeriod);
  const [type, setType] = useState('summary');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const view = useCallback(async () => {
    setLoading(true); setData(null);
    try {
      const res = await adminGstReport(type, periodParams(period));
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to run report');
    } finally {
      setLoading(false);
    }
  }, [type, period]);

  const csv = async () => {
    try {
      const res = await adminGstReportCsv('transactions', periodParams(period));
      downloadBlob(res, `gst-${type}-${period.fy}.csv`);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Export failed');
    }
  };

  const current = REPORTS.find((r) => r.key === type);

  return (
    <div>
      <PageHeader title="GST Reports" subtitle="Working papers for accounting & filing — GSTR-1/3B are working papers, not government files" />

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <PeriodFilter value={period} onChange={setPeriod} />
        <label className="flex flex-col gap-1 text-[11px] uppercase tracking-wide adm-t3">
          Report
          <select className="fb-input text-sm" value={type} onChange={(e) => { setType(e.target.value); setData(null); }}>
            {REPORTS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </label>
        <Btn variant="primary" size="sm" onClick={view} disabled={loading}>{loading ? 'Running…' : 'View'}</Btn>
        {current?.csv && <Btn variant="outline" size="sm" onClick={csv}>Download CSV</Btn>}
      </div>

      {loading ? <Skeleton className="h-40" /> : data ? <ResultView type={type} data={data} /> : (
        <div className="adm-card rounded-2xl py-16 text-center adm-t3">Pick a report and period, then View.</div>
      )}
    </div>
  );
}
