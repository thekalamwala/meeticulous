import { useEffect, useState } from 'react';
import { PageHeader, Card } from '../../../components/admin/ui';
import { crmReports } from '../../../services/api';
import { rupees, STATUS_LABEL } from './salesConstants';

const pct = (n) => `${Number(n || 0).toFixed(1)}%`;

function Kpi({ label, value, hint }) {
  return (
    <Card className="rounded-2xl p-4">
      <p className="text-[11px] uppercase tracking-wide adm-t3">{label}</p>
      <p className="text-2xl font-bold adm-t1 mt-1 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] adm-t3 mt-1">{hint}</p>}
    </Card>
  );
}

// Source / campaign attribution table: which channel produced paying customers.
function BreakdownTable({ title, rows, empty }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold uppercase tracking-wide adm-t2 mb-2">{title}</h2>
      <Card className="rounded-2xl overflow-hidden">
        {(!rows || rows.length === 0) ? (
          <p className="p-6 text-center adm-t3 text-[13px]">{empty || 'No data yet.'}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="adm-t3 text-[11px] uppercase tracking-wide border-b border-gray-100">
                  <th className="text-left font-semibold px-4 py-2">Source</th>
                  <th className="text-right font-semibold px-4 py-2">Leads</th>
                  <th className="text-right font-semibold px-4 py-2">Paying</th>
                  <th className="text-right font-semibold px-4 py-2">Conv.</th>
                  <th className="text-right font-semibold px-4 py-2">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.key}>
                    <td className="px-4 py-2 adm-t1 font-medium">{r.key}</td>
                    <td className="px-4 py-2 text-right tabular-nums adm-t2">{r.leads}</td>
                    <td className="px-4 py-2 text-right tabular-nums adm-t1 font-semibold">{r.paying}</td>
                    <td className="px-4 py-2 text-right tabular-nums adm-t2">{pct(r.conversion_rate)}</td>
                    <td className="px-4 py-2 text-right tabular-nums adm-t2">{rupees(r.revenue_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default function SalesReports() {
  const [r, setR] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmReports().then(({ data }) => setR(data)).catch(() => setR(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 max-w-5xl"><PageHeader title="Reports" /><p className="adm-t3">Loading…</p></div>;
  if (!r) return <div className="p-6 max-w-5xl"><PageHeader title="Reports" /><Card className="rounded-2xl p-10 text-center adm-t3">Could not load reports.</Card></div>;

  const t = r.totals || {};
  const maxFunnel = Math.max(1, ...(r.funnel || []).map((f) => f.count));
  const ttc = r.time_to_convert;

  return (
    <div className="p-6 max-w-5xl">
      <PageHeader title="Reports" subtitle="Where leads, customers and revenue come from" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total leads" value={t.total ?? 0} />
        <Kpi label="Paying customers" value={t.paying ?? 0} hint="status = Won only" />
        <Kpi label="Conversion" value={pct(t.conversion_rate)} hint="paying ÷ total" />
        <Kpi label="Revenue" value={rupees(t.revenue_paise)} />
      </div>

      {/* Funnel */}
      <div className="mb-6">
        <h2 className="text-sm font-bold uppercase tracking-wide adm-t2 mb-2">Funnel</h2>
        <Card className="rounded-2xl p-4 space-y-2">
          {(r.funnel || []).map((f) => (
            <div key={f.status} className="flex items-center gap-3">
              <span className="w-24 text-[12px] adm-t2 shrink-0">{STATUS_LABEL[f.status] || f.status}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                <div className="h-full bg-rose-400/80 rounded-full" style={{ width: `${(f.count / maxFunnel) * 100}%` }} />
              </div>
              <span className="w-10 text-right text-[12px] tabular-nums adm-t1 font-semibold">{f.count}</span>
              <span className="w-14 text-right text-[11px] tabular-nums adm-t3">{f.step_rate == null ? '' : pct(f.step_rate)}</span>
            </div>
          ))}
        </Card>
      </div>

      <BreakdownTable title="By source" rows={r.by_source} />

      {r.has_utm ? (
        <>
          <BreakdownTable title="By UTM source" rows={r.by_utm_source} empty="No UTM-tagged leads yet." />
          <BreakdownTable title="By campaign" rows={r.by_utm_campaign} empty="No campaign-tagged leads yet." />
        </>
      ) : (
        <Card className="rounded-2xl p-4 mb-6 adm-t3 text-[13px]">
          UTM / campaign attribution appears here once the attribution-capture release is live.
        </Card>
      )}

      {/* Timing */}
      <div className="mb-2">
        <h2 className="text-sm font-bold uppercase tracking-wide adm-t2 mb-2">Lead → customer time</h2>
        <Card className="rounded-2xl p-4">
          {!ttc ? (
            <p className="adm-t3 text-[13px]">No converted leads with timestamps yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div><p className="text-2xl font-bold adm-t1 tabular-nums">{ttc.median_days}d</p><p className="text-[11px] adm-t3 mt-1">Median</p></div>
              <div><p className="text-2xl font-bold adm-t1 tabular-nums">{ttc.avg_days}d</p><p className="text-[11px] adm-t3 mt-1">Average</p></div>
              <div><p className="text-2xl font-bold adm-t1 tabular-nums">{ttc.p90_days}d</p><p className="text-[11px] adm-t3 mt-1">90th pct ({ttc.count} converted)</p></div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
