// Support Insights — turns resolved conversations into product intelligence:
// why people needed us, and what share was product/UX-caused (preventable).
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { adminSupportInsights } from '../../services/api';
import { PageHeader, Skeleton } from '../../components/admin/ui';

const RANGES = [{ d: 7, label: '7d' }, { d: 30, label: '30d' }, { d: 90, label: '90d' }];
const pct = (x) => `${Math.round((x || 0) * 100)}%`;

function Tile({ label, value, sub, tone }) {
  return (
    <div className="rounded-xl border adm-border p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide adm-t3">{label}</p>
      <p className={'mt-1 text-2xl font-bold ' + (tone === 'bad' ? 'text-rose-600' : tone === 'good' ? 'text-emerald-600' : 'adm-t1')}>{value}</p>
      {sub && <p className="mt-0.5 text-xs adm-t3">{sub}</p>}
    </div>
  );
}

export default function SupportInsights() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    adminSupportInsights(days)
      .then(({ data }) => { if (active) setData(data); })
      .catch(() => toast.error('Could not load insights'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [days]);

  const maxReason = data?.by_reason?.[0]?.count || 1;

  return (
    <div>
      <PageHeader title="Support Insights" subtitle="Every resolved conversation, tagged — so support becomes product signal." />
      <div className="mb-4 flex gap-2">
        {RANGES.map((r) => (
          <button key={r.d} onClick={() => setDays(r.d)}
            className={'rounded-lg px-3 py-1.5 text-sm font-medium ' + (days === r.d ? 'bg-[#960D32] text-white' : 'border adm-border adm-t2')}>
            {r.label}
          </button>
        ))}
      </div>

      {loading ? <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        : !data ? <p className="text-sm adm-t3">No data.</p>
          : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Tile label="Resolved" value={data.total_resolved} sub={`in the last ${data.window_days} days`} />
                <Tile label="Product-caused" value={pct(data.product_caused_rate)} tone={data.product_caused_rate > 0.4 ? 'bad' : undefined}
                  sub="share we could have prevented (product/UX)" />
                <Tile label="CSAT" value={data.csat != null ? `${data.csat}/5` : '—'}
                  tone={data.csat != null ? (data.csat >= 4 ? 'good' : data.csat < 3 ? 'bad' : undefined) : undefined}
                  sub={data.csat_responses ? `${data.csat_responses} rating${data.csat_responses > 1 ? 's' : ''}` : 'no ratings yet'} />
                <Tile label="Tagged" value={pct(data.coverage_rate)} sub={`${data.tagged} of ${data.total_resolved} given a reason`} />
              </div>

              <h3 className="mt-6 mb-2 text-sm font-semibold adm-t1">Top contact reasons</h3>
              {data.by_reason.length === 0
                ? <p className="text-sm adm-t3">No tagged conversations yet — pick a reason when resolving to build this.</p>
                : (
                  <div className="space-y-1.5">
                    {data.by_reason.map((r) => (
                      <div key={r.code} className="flex items-center gap-3">
                        <span className="w-52 shrink-0 truncate text-xs adm-t2" title={r.label}>{r.label}</span>
                        <div className="h-4 flex-1 overflow-hidden rounded bg-[#f0ede6]">
                          <div className={'h-full rounded ' + (['product', 'ux'].includes(r.type) ? 'bg-rose-400' : 'bg-[#960D32]')}
                            style={{ width: `${Math.max(4, (r.count / maxReason) * 100)}%` }} />
                        </div>
                        <span className="w-8 shrink-0 text-right text-xs font-semibold tabular-nums adm-t1">{r.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              <p className="mt-2 text-[11px] adm-t3"><span className="inline-block h-2 w-2 rounded-sm bg-rose-400" /> product/UX-caused &nbsp; <span className="inline-block h-2 w-2 rounded-sm bg-[#960D32]" /> expected / external</p>

              {data.by_category.length > 0 && (
                <>
                  <h3 className="mt-6 mb-2 text-sm font-semibold adm-t1">By area</h3>
                  <div className="flex flex-wrap gap-2">
                    {data.by_category.map((c) => (
                      <span key={c.category} className="rounded-lg border adm-border px-3 py-1.5 text-xs adm-t2">
                        <span className="font-semibold capitalize adm-t1">{c.category}</span> · {c.count}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
    </div>
  );
}
