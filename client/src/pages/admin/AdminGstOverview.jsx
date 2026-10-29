// AdminGstOverview.jsx — /admin/gst command center.
// Answers: how much GST, net liability, what needs attention, what's due — every
// number derived server-side from the invoices table (source of truth). KPIs
// drill into the filtered transaction view.
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader, Card, StatCard, Badge, Skeleton } from '../../components/admin/ui';
import { adminGstOverview } from '../../services/api';
import { inr, num, PeriodFilter, defaultPeriod, periodParams } from './gstShared';

const pct = (v) => (v == null ? '—' : `${v}%`);

export default function AdminGstOverview() {
  const [period, setPeriod] = useState(defaultPeriod);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminGstOverview(periodParams(period));
      setData(res.data);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to load GST overview');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  // Preserve the selected period when drilling into the transactions view.
  const txnLink = (extra = {}) => {
    const p = { ...periodParams(period), ...extra };
    return `/admin/gst/transactions?${new URLSearchParams(p).toString()}`;
  };

  const k = data?.kpis || {};
  const h = data?.health || {};
  const lia = data?.liability;

  return (
    <div>
      <PageHeader
        title="GST"
        subtitle={data ? `${data.gstin} · ${data.period?.label || ''}` : 'GST command center'}
      />

      <div className="mb-6"><PeriodFilter value={period} onChange={setPeriod} /></div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      ) : !data ? (
        <Card>Could not load GST data for this period.</Card>
      ) : (
        <>
          {/* Net liability — the most prominent number */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
            <Card className="lg:col-span-1 flex flex-col justify-center">
              <div className="text-[11px] uppercase tracking-wide adm-t3">Net GST Liability</div>
              <div className="text-[34px] font-semibold tabular-nums leading-tight mt-1">{inr(k.netLiability)}</div>
              <div className="text-xs adm-t3 mt-1">Output GST − ITC (ITC = 0, no input-GST data)</div>
              <Link to={txnLink()} className="text-xs mt-3" style={{ color: 'var(--adm-accent)' }}>View transactions →</Link>
            </Card>
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <StatCard label="GST Collected" value={inr(k.gstCollected)} sub="Total output GST" to={txnLink()} />
              <StatCard label="Taxable Value" value={inr(k.taxableValue)} sub={`${num(k.invoiceCount)} invoices`} to={txnLink()} />
              <StatCard label="ITC Available" value={inr(0)} sub="No input-GST captured" />
              <StatCard label="ITC at Risk" value={inr(0)} sub="n/a" />
            </div>
          </div>

          {/* Liability breakdown + health */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <Card>
              <div className="text-sm font-semibold mb-3">Liability breakdown</div>
              <table className="w-full text-sm">
                <tbody className="tabular-nums">
                  <tr className="border-b adm-border"><td className="py-2 adm-t2">Output CGST</td><td className="py-2 text-right">{inr(lia?.output.cgst)}</td></tr>
                  <tr className="border-b adm-border"><td className="py-2 adm-t2">Output SGST</td><td className="py-2 text-right">{inr(lia?.output.sgst)}</td></tr>
                  <tr className="border-b adm-border"><td className="py-2 adm-t2">Output IGST</td><td className="py-2 text-right">{inr(lia?.output.igst)}</td></tr>
                  <tr className="border-b adm-border"><td className="py-2 font-medium">Total Output GST</td><td className="py-2 text-right font-medium">{inr(lia?.output.total)}</td></tr>
                  <tr className="border-b adm-border"><td className="py-2 adm-t3">Less: Eligible ITC</td><td className="py-2 text-right adm-t3">{inr(0)}</td></tr>
                  <tr><td className="py-2 font-semibold">Net GST Liability</td><td className="py-2 text-right font-semibold">{inr(lia?.netLiability)}</td></tr>
                </tbody>
              </table>
              <div className="text-xs adm-t3 mt-2">{data.itcNote}</div>
            </Card>

            <Card>
              <div className="text-sm font-semibold mb-3">GST health</div>
              <div className="space-y-3 text-sm">
                <HealthRow label="Sales invoices reconciled" value={pct(h.sales_invoices_reconciled_pct)} tone={h.sales_invoices_reconciled_pct >= 98 ? 'ok' : h.sales_invoices_reconciled_pct >= 90 ? 'warn' : 'danger'} />
                <HealthRow label="ITC reconciliation" value={h.itc_reconciliation_pct == null ? 'n/a' : pct(h.itc_reconciliation_pct)} tone="neutral" />
                <HealthRow label="Return preparation" value={pct(h.return_preparation_pct)} tone={h.return_preparation_pct >= 100 ? 'ok' : 'warn'} />
                <HealthRow label="Invoices requiring attention" value={num(h.invoices_requiring_attention)} tone={h.invoices_requiring_attention ? 'warn' : 'ok'} />
                <HealthRow label="Tax mismatches" value={num(h.tax_mismatches)} tone={h.tax_mismatches ? 'danger' : 'ok'} />
                <HealthRow label="Missing GST information" value={num(h.missing_gst_information)} tone={h.missing_gst_information ? 'warn' : 'ok'} />
              </div>
            </Card>
          </div>

          {/* By source + next filing */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <div className="text-sm font-semibold mb-3">By supply stream</div>
              <table className="w-full text-sm tabular-nums">
                <thead><tr className="text-[11px] uppercase tracking-wide adm-t3 border-b adm-border">
                  <th className="text-left py-2">Stream</th><th className="text-right py-2">Taxable</th><th className="text-right py-2">GST</th><th className="text-right py-2">Count</th>
                </tr></thead>
                <tbody>
                  {(data.bySource || []).map((s) => (
                    <tr key={s.sourceType} className="border-b adm-border last:border-0">
                      <td className="py-2 capitalize">{s.sourceType}</td>
                      <td className="py-2 text-right">{inr(s.taxable)}</td>
                      <td className="py-2 text-right">{inr(s.gst)}</td>
                      <td className="py-2 text-right">{num(s.count)}</td>
                    </tr>
                  ))}
                  {!(data.bySource || []).length && <tr><td colSpan={4} className="py-6 text-center adm-t3">No invoices in this period.</td></tr>}
                </tbody>
              </table>
            </Card>
            <Card>
              <div className="text-sm font-semibold mb-3">Next filing</div>
              <div className="text-sm adm-t2">Period: {data.nextFiling?.period}</div>
              <div className="mt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between border-b adm-border pb-2">
                  <span>{data.nextFiling?.gstr1.return_type}</span>
                  <span className="text-xs adm-t3">{data.nextFiling?.gstr1.due}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{data.nextFiling?.gstr3b.return_type}</span>
                  <span className="text-xs adm-t3">{data.nextFiling?.gstr3b.due}</span>
                </div>
              </div>
              <div className="text-xs adm-t3 mt-4">GSTR-1/3B working papers and returns tracking arrive in a later phase.</div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function HealthRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between">
      <span className="adm-t2">{label}</span>
      <Badge tone={tone}>{value}</Badge>
    </div>
  );
}
