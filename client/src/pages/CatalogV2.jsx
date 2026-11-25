// Catalog — dashboard_v2 graduation. The v2 look on the SAME real data + model
// logic as CatalogList (svcGetAll/getMyProducts/getMyCourses/getHostCoupons +
// mergeCatalog/selectItems). Partial-failure degradation is preserved. Shown on
// the flag-ON path (App picks it in CatalogRoute).
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, CalendarClock, FileDown, BookOpen, Users, TicketPercent } from 'lucide-react';
import { svcGetAll, getMyProducts, getMyCourses, getHostCoupons, getMyMembership } from '../services/api';
import useFeatureFlags from '../hooks/useFeatureFlags';
import { Button, SearchInput, SegmentedControl, ErrorState, Skeleton } from '../components/dashboard/ui';
import { PageHeading, StatusPill, cn } from '../components/dashboard/ui/v2';
import {
  mergeCatalog, selectItems, countsByKind, editHref, TYPE_LABEL, TYPE_PLURAL, TYPE_BLURB, TYPES, ADD_ROUTE,
} from './catalog/catalogModel';

// Icon per type for the New picker (matches the Host Lab descriptors).
const TYPE_ICON = { service: CalendarClock, product: FileDown, course: BookOpen, membership: Users, coupon: TicketPercent };
// Order the picker shows, Memberships before Offers (as the prototype does).
const NEW_ORDER = ['service', 'product', 'course', 'membership', 'coupon'];

/* The "New" picker: pick what you are making, land on that type's create page.
   An anchored panel with an icon + name + one line each, like Host Lab. */
const NewMenu = ({ enabled, onPick }) => {
  const [open, setOpen] = useState(false);
  const types = NEW_ORDER.filter((t) => enabled[t]);
  return (
    <div className="relative">
      <Button size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <Plus className="h-4 w-4" /> New
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="menu" className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-[8px] border-2 border-neutral-200 bg-white py-1 shadow-lg">
            {types.map((t) => {
              const Icon = TYPE_ICON[t] || Plus;
              return (
                <button key={t} type="button" role="menuitem"
                  onClick={() => { setOpen(false); onPick(t); }}
                  className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition hover:bg-blush">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-xs bg-neutral-100 text-ink/55">
                    <Icon className="h-3 w-3" strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-bold text-ink">{TYPE_LABEL[t]}</span>
                    <span className="block text-[10.5px] font-medium leading-snug text-ink/50">{TYPE_BLURB[t]}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

const money = (n) => (n === 0 ? 'Free' : `₹${Number(n).toLocaleString('en-IN')}`);
const load = async (kind, fn) => {
  try { const { data } = await fn(); return { kind, rows: Array.isArray(data) ? data : [] }; }
  catch { return { kind, rows: [], error: true }; }
};
// Membership returns one program ({ program: { tiers } }), not an array — flatten
// its tiers into rows so each tier is a sellable item in the list.
const loadMemberships = async () => {
  try { const { data } = await getMyMembership(); return { kind: 'membership', rows: data?.program?.tiers || [] }; }
  catch { return { kind: 'membership', rows: [], error: true }; }
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
  const membershipOn = !!flags?.community_memberships;
  const enabled = useMemo(() => ({ service: true, product: true, course: courseOn, coupon: couponOn, membership: membershipOn }), [courseOn, couponOn, membershipOn]);

  const fetchAll = useCallback(async () => {
    setSources(null);
    const jobs = [
      enabled.service && load('service', svcGetAll),
      enabled.product && load('product', getMyProducts),
      enabled.course && load('course', getMyCourses),
      enabled.coupon && load('coupon', getHostCoupons),
      enabled.membership && loadMemberships(),
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
      action={<NewMenu enabled={enabled} onPick={(t) => navigate(ADD_ROUTE[t])} />} />
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

      <div className="overflow-hidden rounded-2xl bg-white">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-14 text-center">
            <Package className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
            <p className="text-[12px] font-bold text-ink">{items.length === 0 ? 'Nothing in your catalog yet' : 'Nothing matches'}</p>
            <p className="max-w-sm text-[11px] font-medium text-ink/55">
              {items.length === 0 ? 'A service puts time on your calendar. A product sells while you sleep.' : 'Try a different type, or clear the search.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-ink/5">
            {rows.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button type="button" onClick={() => navigate(editHref(item))} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-cream">
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
      </div>
    </div>
  );
};

export default CatalogV2;
