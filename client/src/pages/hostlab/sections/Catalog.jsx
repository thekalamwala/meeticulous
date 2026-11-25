// Catalog — one list of everything a host sells.
//
// It was five tabs: Services, Products, Courses, Memberships, Offers. But a
// tab set whose only job is to show a subset of one list is a filter wearing a
// costume — and we already have a filter bar. So: one list, a Type filter, and
// the same row shape for every kind, each carrying its own 30-day performance.
//
// Rows open a full page, never a modal. See CatalogEditor.
//
// Two things the first pass got wrong, both the same mistake — saying one thing
// many times:
//   · Sold / Revenue / View→buy were labelled on every row. Three labels × 12
//     rows is 36 repetitions of what a table says once, in its header. It is a
//     table now.
//   · The status pill read "Active" on nine rows of twelve. Live is the
//     ordinary state of a thing you sell, so it needs no badge; the pill is
//     kept for Hidden, Expired and Scheduled, which are the exceptions.
//
// Row actions are one, not four. Edit, duplicate and delete all exist inside
// the editor, which is one click away and actually shows you what you are
// about to duplicate or destroy — a delete button on a dense row, with no
// confirm and nothing on screen but a title, is a trap. What stays on the row
// is the show/hide toggle, because that is the one you do while scanning the
// list rather than while looking at the item.
//
// (Money and Settings keep their tabs on purpose: those are different views of
// one subject, not one list filtered.)
import { useMemo, useState } from 'react';
import { Eye, EyeOff, Package, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { cn } from '../../../components/dashboard/ui';
import { StatusPill, SubPageHeader, inr, pct } from '../labUi';
import { Filter, FilterBar } from '../filters';
import { CATALOG_TYPES, TYPE_LIST } from '../catalogTypes';
import { allItems, couponState, summarise } from '../catalogData';

const SORTS = [
  { value: 'revenue', label: 'Earning most' },
  { value: 'sold', label: 'Sold most' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'type', label: 'Grouped by type' },
];

// One tint per catalog kind, from the --mt-cat-* tokens (design-system brand
// extension — pending founder sign-off). coupon rows use the "offer" tint.
// Shared by the table tiles (TypeIcon) and the New-item menu.
const KIND_TINT = {
  service: 'bg-cat-service-bg text-cat-service-fg',
  product: 'bg-cat-product-bg text-cat-product-fg',
  course: 'bg-cat-course-bg text-cat-course-fg',
  membership: 'bg-cat-membership-bg text-cat-membership-fg',
  coupon: 'bg-cat-offer-bg text-cat-offer-fg',
};

/* ── New-item menu: pick what you are making, then get a page ──────────────
   Catalog keeps its create button where Bookings lost one: a host fills this
   list themselves, while bookings arrive from guests. */
const NewMenu = ({ onPick }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex h-8 items-center gap-1 rounded-full bg-maroon px-3 text-[11.5px] font-bold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.8} /> New
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div role="menu" className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-sm border-2 border-neutral-200 bg-white dash-elev-3">
            {TYPE_LIST.map((t) => (
              <button
                key={t.key}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onPick(t.key); }}
                className="flex w-full items-start gap-2 rounded-none px-3 py-2 text-left transition hover:bg-blush"
              >
                <span className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-xs', KIND_TINT[t.key] || 'bg-blush text-maroon')}>
                  <t.icon className="h-3 w-3" strokeWidth={2.4} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[11.5px] font-bold text-ink">{t.label}</span>
                  <span className="block text-[10.5px] font-medium leading-snug text-ink/50">{t.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Catalog = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState(() => allItems());
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [state, setState] = useState('all');
  const [sort, setSort] = useState('revenue');

  const open = (id) => navigate(`/host-lab/catalog/${id}`);
  const create = (typeKey) => navigate(`/host-lab/catalog/new?type=${typeKey}`);

  const counts = useMemo(() => {
    const c = {};
    TYPE_LIST.forEach((t) => { c[t.key] = items.filter((i) => i.kind === t.key).length; });
    return c;
  }, [items]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = items.filter((i) => {
      if (kind !== 'all' && i.kind !== kind) return false;
      if (state === 'live' && !i.active) return false;
      if (state === 'hidden' && i.active) return false;
      if (needle && !`${i.title} ${i.description || ''}`.toLowerCase().includes(needle)) return false;
      return true;
    });
    const by = {
      revenue: (a, b) => b.revenue_30d - a.revenue_30d,
      sold: (a, b) => b.sold_30d - a.sold_30d,
      name: (a, b) => String(a.title).localeCompare(String(b.title)),
      type: (a, b) => a.kind.localeCompare(b.kind) || String(a.title).localeCompare(String(b.title)),
    };
    return [...out].sort(by[sort]);
  }, [items, q, kind, state, sort]);

  const earned = items.reduce((n, i) => n + i.revenue_30d, 0);
  const activeCount = (kind !== 'all' ? 1 : 0) + (state !== 'all' ? 1 : 0) + (q.trim() ? 1 : 0);

  const toggleLive = (item) => {
    setItems((v) => v.map((x) => (x.id === item.id ? { ...x, active: !x.active } : x)));
    toast.success(`${item.title} ${item.active ? 'hidden' : 'live'}`);
  };

  // Live is the ordinary state, so only the exceptions wear a pill.
  const stateOf = (item) => (item.kind === 'coupon' ? couponState(item) : item.active ? 'active' : 'inactive');

  const TypeIcon = ({ item, size = 'h-7 w-7', glyph = 'h-3.5 w-3.5' }) => {
    const type = CATALOG_TYPES[item.kind];
    return (
      <span className={cn('grid shrink-0 place-items-center rounded-xs', KIND_TINT[item.kind] || 'bg-blush text-maroon', size)} title={type.label}>
        <type.icon className={glyph} strokeWidth={2.4} />
      </span>
    );
  };

  const LiveToggle = ({ item, className = '' }) => (
    <button
      type="button"
      onClick={() => toggleLive(item)}
      aria-label={`${item.active ? 'Hide' : 'Show'} ${item.title}`}
      title={item.active ? 'Hide from your page' : 'Show on your page'}
      className={cn('grid h-7 w-7 place-items-center rounded-xs text-ink/45 transition hover:bg-blush hover:text-maroon', className)}
    >
      {item.active ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2.2} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />}
    </button>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <SubPageHeader title="Catalog" action={<NewMenu onPick={create} />}>
        {items.length} things you sell · {inr(earned)} earned in the last 30 days
      </SubPageHeader>

      <FilterBar
        bare
        search={{ value: q, onChange: setQ, placeholder: 'Search what you sell' }}
        activeCount={activeCount}
        onClearAll={() => { setKind('all'); setState('all'); setQ(''); }}
        trailing={(
          <Filter label="Sort" value={sort} empty="revenue" align="right" width="w-48" onChange={setSort} options={SORTS} />
        )}
      >
        <Filter
          label="Type"
          value={kind}
          width="w-52"
          onChange={setKind}
          options={[{ value: 'all', label: 'Everything' }, ...TYPE_LIST.map((t) => ({ value: t.key, label: t.plural, count: counts[t.key] }))]}
        />
        <Filter
          label="Shown"
          value={state}
          width="w-40"
          onChange={setState}
          options={[
            { value: 'all', label: 'Live and hidden' },
            { value: 'live', label: 'Live only' },
            { value: 'hidden', label: 'Hidden only' },
          ]}
        />
      </FilterBar>

      <div className="flex flex-col gap-1.5">
        <p className="px-1 text-[10px] font-bold uppercase tracking-wide text-ink/40">
          {rows.length} {rows.length === 1 ? 'item' : 'items'}
        </p>
        <div className="overflow-hidden rounded-2xl bg-white">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-10 text-center">
            <Package className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
            <p className="text-[12.5px] font-bold text-ink">
              {items.length === 0 ? 'Nothing in your catalog yet' : 'Nothing matches'}
            </p>
            <p className="max-w-sm text-[11.5px] font-medium text-ink/55">
              {items.length === 0
                ? 'A service puts time on your calendar. A product sells while you sleep. Start with either.'
                : 'Loosen a filter, or clear them all.'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop: a table, so the three measures are named once. The page
                header already says the window is 30 days. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-[11.5px]">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-ink/40">
                    <th scope="col" className="px-3 py-2 text-left font-bold">Item</th>
                    <th scope="col" className="w-20 px-3 py-2 text-right font-bold">Sold</th>
                    <th scope="col" className="w-28 px-3 py-2 text-right font-bold">Revenue</th>
                    <th scope="col" className="w-28 px-3 py-2 text-right font-bold">View → buy</th>
                    <th scope="col" className="w-12 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink/5">
                  {rows.map((item) => {
                    const live = stateOf(item);
                    return (
                      <tr
                        key={item.id}
                        onClick={() => open(item.id)}
                        className="cursor-pointer transition-colors hover:bg-cream"
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <TypeIcon item={item} />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[12px] font-bold text-ink">{item.title}</span>
                                {live !== 'active' && <StatusPill status={live} />}
                              </span>
                              <span className="block truncate text-[10.5px] font-medium text-ink/50">{summarise(item)}</span>
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-ink">{item.sold_30d}</td>
                        <td className="px-3 py-2 text-right font-bold tabular-nums text-maroon">{inr(item.revenue_30d, { compact: true })}</td>
                        <td className="px-3 py-2 text-right font-medium tabular-nums text-ink/70">{item.conversion ? pct(item.conversion) : '—'}</td>
                        <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <LiveToggle item={item} className="ml-auto" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile: revenue is the one number worth carrying across. */}
            <ul className="divide-y divide-ink/5 md:hidden">
              {rows.map((item) => {
                const live = stateOf(item);
                return (
                  <li key={item.id} className="flex items-center gap-2 px-2.5 py-1.5">
                    <button type="button" onClick={() => open(item.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                      <TypeIcon item={item} size="h-8 w-8" glyph="h-4 w-4" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-[12px] font-bold text-ink">{item.title}</span>
                          {live !== 'active' && <StatusPill status={live} />}
                        </span>
                        <span className="block truncate text-[10.5px] font-medium text-ink/50">{summarise(item)}</span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-[11.5px] font-bold text-maroon">{inr(item.revenue_30d, { compact: true })}</span>
                        <span className="block text-[10px] font-medium text-ink/40">{item.sold_30d} sold</span>
                      </span>
                    </button>
                    <LiveToggle item={item} />
                  </li>
                );
              })}
            </ul>
          </>
        )}
        </div>
      </div>
    </div>
  );
};

export default Catalog;
