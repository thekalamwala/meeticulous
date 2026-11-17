/**
 * Catalog — one list of everything a host sells.
 *
 * The console gives each sellable type its own page and its own rail entry, so
 * "what do I sell, and what is live?" takes four visits and a good memory. This
 * is that question answered once.
 *
 * Reachable at /dashboard/catalog whatever the rail says; the console_v2 flag
 * only decides whether the rail points four entries at the old pages or one at
 * this. Nothing is removed — Services, Products, Courses and Coupons keep their
 * routes, their pages and their editors.
 *
 * EDITING STILL LANDS ON THE TYPE'S OWN PAGE. Only services have a per-item
 * editor route; products, courses and coupons edit in a modal on their page. So
 * a row opens the service editor, or the right page for the rest. That seam is
 * real and is stated rather than papered over — closing it means unifying four
 * editors, which is its own change and not this one.
 *
 * Partial failure degrades instead of blanking: four endpoints feed this page,
 * and one being down must not hide the three that answered. The host sees what
 * loaded and is told what did not, rather than a short list that looks complete.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import {
  svcGetAll, getMyProducts, getMyCourses, getHostCoupons,
} from '../../services/api';
import useFeatureFlags from '../../hooks/useFeatureFlags';
import {
  PageHeader, Card, Button, SearchInput, SegmentedControl,
  StatusBadge, SkeletonCard, ErrorState, cn,
} from '../../components/dashboard/ui';
import {
  mergeCatalog, selectItems, countsByKind, editHref,
  TYPE_LABEL, TYPE_PLURAL, TYPES,
} from './catalogModel';

const money = (n) => (n === 0 ? 'Free' : `₹${Number(n).toLocaleString('en-IN')}`);

/** One source's fetch, resolved into the shape mergeCatalog expects. */
const load = async (kind, fn) => {
  try {
    const { data } = await fn();
    return { kind, rows: Array.isArray(data) ? data : [] };
  } catch {
    // Swallowed on purpose: the merge reports it, and one dead endpoint is a
    // partial result, not a page error.
    return { kind, rows: [], error: true };
  }
};

const CatalogList = () => {
  const navigate = useNavigate();
  const { flags } = useFeatureFlags();

  const [sources, setSources] = useState(null); // null = still loading
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');

  // Courses and coupons are flag-gated in the rail, so they are flag-gated here
  // too. Fetching a type the host cannot see would put rows in this list that
  // exist nowhere else in their console.
  // Depend on the VALUES, not the flags object. Keying this memo on `flags`
  // means any caller handing back a fresh object on each render recreates
  // fetchAll, refires the effect and loops the page through four requests
  // forever. useFeatureFlags holds its map in state today, so it is stable —
  // but a component should not be one refactor away from a fetch loop.
  const courseOn = !!flags?.course_purchase;
  const couponOn = !!flags?.coupons;
  const enabled = useMemo(() => ({
    service: true,
    product: true,
    course: courseOn,
    coupon: couponOn,
  }), [courseOn, couponOn]);

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

  // SegmentedControl renders opt.count as its own pill, so the counts do not
  // belong inside the labels.
  const typeOptions = [
    { value: 'all', label: 'All', count: items.length },
    ...TYPES.filter((t) => enabled[t]).map((t) => ({
      value: t, label: TYPE_PLURAL[t], count: counts[t] || 0,
    })),
  ];

  if (sources === null) {
    return (
      <div className="space-y-4">
        <PageHeader title="Catalog" subtitle="Everything you sell, in one place." />
        <SkeletonCard />
      </div>
    );
  }

  // Only a total failure is an error state. Anything less is a partial result,
  // and a partial result is still useful.
  if (failed.length === sources.length) {
    return (
      <div className="space-y-4">
        <PageHeader title="Catalog" subtitle="Everything you sell, in one place." />
        <ErrorState onRetry={fetchAll} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Catalog"
        subtitle={`${items.length} ${items.length === 1 ? 'thing' : 'things'} you sell`}
        actions={(
          <Button onClick={() => navigate('/dashboard/service/add-new')}>
            <Plus className="w-4 h-4" /> New service
          </Button>
        )}
      />

      {failed.length > 0 && (
        // Named, not a generic "something went wrong": a host needs to know
        // WHICH part of their catalog is missing before they trust the list.
        <Card className="border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-900">
            Could not load {failed.map((f) => TYPE_PLURAL[f].toLowerCase()).join(' and ')}.
            Everything else is shown below.{' '}
            <button type="button" onClick={fetchAll} className="underline font-semibold">Try again</button>
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search what you sell" className="flex-1 min-w-[200px]" />
        <SegmentedControl value={kind} onChange={setKind} options={typeOptions} />
        <SegmentedControl
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'live', label: 'Live' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />
      </div>

      <Card padded={false}>
        {rows.length === 0 ? (
          <div className="py-14 text-center">
            <p className="font-semibold text-gray-900">
              {items.length === 0 ? 'Nothing in your catalog yet' : 'Nothing matches'}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              {items.length === 0
                ? 'A service puts time on your calendar. A product sells while you sleep.'
                : 'Try a different type, or clear the search.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {rows.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  type="button"
                  onClick={() => navigate(editHref(item))}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold text-gray-900">{item.title}</span>
                      <span className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-gray-400">
                        {TYPE_LABEL[item.kind]}
                      </span>
                    </span>
                    {item.meta && <span className="block text-sm text-gray-500">{item.meta}</span>}
                  </span>
                  <span className={cn('shrink-0 font-semibold tabular-nums', item.price === null ? 'text-gray-400' : 'text-gray-900')}>
                    {item.price === null ? '—' : money(item.price)}
                  </span>
                  <StatusBadge
                    status={item.active ? 'active' : 'disabled'}
                    label={item.active ? 'Live' : 'Hidden'}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default CatalogList;
