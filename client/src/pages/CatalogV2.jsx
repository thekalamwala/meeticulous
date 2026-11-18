// Catalog — dashboard_v2 graduation. The v2 look on the SAME real data + model
// logic as CatalogList (svcGetAll/getMyProducts/getMyCourses/getHostCoupons +
// mergeCatalog/selectItems). Partial-failure degradation is preserved. Shown on
// the flag-ON path (App picks it in CatalogRoute).
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package } from 'lucide-react';
import { svcGetAll, getMyProducts, getMyCourses, getHostCoupons } from '../services/api';
import useFeatureFlags from '../hooks/useFeatureFlags';
import { Button, SearchInput, SegmentedControl, ErrorState, Skeleton } from '../components/dashboard/ui';
import { PageHeading, Panel, StatusPill, cn } from '../components/dashboard/ui/v2';
import {
  mergeCatalog, selectItems, countsByKind, editHref, TYPE_LABEL, TYPE_PLURAL, TYPES,
} from './catalog/catalogModel';

const money = (n) => (n === 0 ? 'Free' : `₹${Number(n).toLocaleString('en-IN')}`);
const load = async (kind, fn) => {
  try { const { data } = await fn(); return { kind, rows: Array.isArray(data) ? data : [] }; }
  catch { return { kind, rows: [], error: true }; }
};

const CatalogV2 = () => {
  const navigate = useNavigate();
  const { flags } = useFeatureFlags();
  const [sources, setSources] = useState(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');

  const courseOn = !!flags?.course_purchase;
  const couponOn = !!flags?.coupons;
  const enabled = useMemo(() => ({ service: true, product: true, course: courseOn, coupon: couponOn }), [courseOn, couponOn]);

  const fetchAll = useCallback(async () => {
    setSources(null);
    const jobs = [
      enabled.service && load('service', svcGetAll),
      enabled.product && load('product', getMyProducts),
      enabled.course && load('course', getMyCourses),
      enabled.coupon && load('coupon', getHostCoupons),
    ].filter(Boolean);
    setSources(await Promise.all(jobs));
  }, [enabled]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { items, failed } = useMemo(() => mergeCatalog(sources || []), [sources]);
  const counts = useMemo(() => countsByKind(items), [items]);
  const rows = useMemo(() => selectItems(items, { q, kind, status }), [items, q, kind, status]);

  const typeOptions = [
    { value: 'all', label: 'All', count: items.length },
    ...TYPES.filter((t) => enabled[t]).map((t) => ({ value: t, label: TYPE_PLURAL[t], count: counts[t] || 0 })),
  ];

  const header = (
    <PageHeading title="Catalog" sub={sources === null ? 'Loading…' : `${items.length} ${items.length === 1 ? 'thing' : 'things'} you sell`}
      action={<Button size="sm" onClick={() => navigate('/dashboard/service/add-new')}><Plus className="h-4 w-4" /> New service</Button>} />
  );

  if (sources === null) {
    return <div className="flex flex-col gap-2.5">{header}<Skeleton className="h-40 rounded-xl" /></div>;
  }
  if (failed.length === sources.length) {
    return <div className="flex flex-col gap-2.5">{header}<ErrorState onRetry={fetchAll} /></div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      {failed.length > 0 && (
        <div className="rounded-xl border-2 border-marigold-300 bg-marigold-100 px-3 py-2 text-[11.5px] font-semibold text-marigold-800">
          Couldn't load {failed.map((f) => TYPE_PLURAL[f].toLowerCase()).join(' and ')}. Everything else is shown.{' '}
          <button type="button" onClick={fetchAll} className="underline">Try again</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search what you sell" className="min-w-[200px] flex-1" />
        <SegmentedControl value={kind} onChange={setKind} options={typeOptions} />
        <SegmentedControl value={status} onChange={setStatus} options={[{ value: 'all', label: 'All' }, { value: 'live', label: 'Live' }, { value: 'hidden', label: 'Hidden' }]} />
      </div>

      <Panel flush>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-14 text-center">
            <Package className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
            <p className="text-[12px] font-bold text-ink">{items.length === 0 ? 'Nothing in your catalog yet' : 'Nothing matches'}</p>
            <p className="max-w-sm text-[11px] font-medium text-ink/55">
              {items.length === 0 ? 'A service puts time on your calendar. A product sells while you sleep.' : 'Try a different type, or clear the search.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y-2 divide-neutral-200">
            {rows.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button type="button" onClick={() => navigate(editHref(item))} className="flex w-full items-center gap-3 px-3 py-2 text-left transition hover:bg-cream">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[12px] font-bold text-ink">{item.title}</span>
                      <span className="shrink-0 text-[9.5px] font-bold uppercase tracking-wide text-ink/40">{TYPE_LABEL[item.kind]}</span>
                    </span>
                    {item.meta && <span className="block truncate text-[10.5px] font-medium text-ink/50">{item.meta}</span>}
                  </span>
                  <span className={cn('shrink-0 text-[11.5px] font-bold tabular-nums', item.price === null ? 'text-ink/35' : 'text-maroon')}>
                    {item.price === null ? '—' : money(item.price)}
                  </span>
                  <StatusPill status={item.active ? 'active' : 'inactive'}>{item.active ? 'Live' : 'Hidden'}</StatusPill>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
};

export default CatalogV2;
