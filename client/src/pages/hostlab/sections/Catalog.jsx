// Catalog — one list of everything a host sells.
//
// It was five tabs: Services, Products, Courses, Memberships, Offers. But a
// tab set whose only job is to show a subset of one list is a filter wearing a
// costume — and we already have a filter bar. So: one list, a Type filter, and
// the same row shape for every kind, each carrying its own 30-day performance.
//
// Rows open a full page, never a modal. See CatalogEditor.
//
// (Money and Settings keep their tabs on purpose: those are different views of
// one subject, not one list filtered.)
import { useMemo, useState } from 'react';
import { Copy, Eye, EyeOff, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Panel, StatusPill, inr, pct } from '../labUi';
import { Filter, FilterBar } from '../filters';
import { CATALOG_TYPES, TYPE_LIST } from '../catalogTypes';
import { allItems, couponState, summarise } from '../catalogData';

const SORTS = [
  { value: 'revenue', label: 'Earning most' },
  { value: 'sold', label: 'Sold most' },
  { value: 'name', label: 'Name A-Z' },
  { value: 'type', label: 'Grouped by type' },
];

/* ── New-item menu: pick what you are making, then get a page ──────────── */
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
          <div role="menu" className="absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-sm border-2 border-neutral-200 bg-white py-1 dash-elev-3">
            {TYPE_LIST.map((t) => (
              <button
                key={t.key}
                type="button"
                role="menuitem"
                onClick={() => { setOpen(false); onPick(t.key); }}
                className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition hover:bg-blush"
              >
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-xs bg-neutral-100 text-ink/55">
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

  return (
    <div className="flex flex-col gap-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">Catalog</h1>
          <p className="mt-0.5 text-[12px] font-medium text-ink/55">
            {items.length} things you sell · {inr(earned)} earned in the last 30 days
          </p>
        </div>
        <NewMenu onPick={create} />
      </header>

      <FilterBar
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

      <Panel flush title={`${rows.length} ${rows.length === 1 ? 'item' : 'items'}`}>
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
          <ul className="divide-y-2 divide-neutral-200">
            {rows.map((item) => {
              const type = CATALOG_TYPES[item.kind];
              const live = item.kind === 'coupon' ? couponState(item) : item.active ? 'active' : 'inactive';
              return (
                <li key={item.id}>
                  <div className="flex items-center gap-2 px-3 py-2 transition hover:bg-cream">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xs bg-neutral-100 text-ink/55" title={type.label}>
                      <type.icon className="h-3.5 w-3.5" strokeWidth={2.4} />
                    </span>

                    <button type="button" onClick={() => open(item.id)} className="min-w-0 flex-1 text-left">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-[12.5px] font-bold text-ink">{item.title}</span>
                        <StatusPill status={live} />
                      </span>
                      <span className="block truncate text-[11px] font-medium text-ink/50">{summarise(item)}</span>
                    </button>

                    {/* Per-row performance: the old tabs showed none of this */}
                    <div className="hidden shrink-0 gap-4 sm:flex">
                      {[
                        ['Sold', item.sold_30d],
                        ['Revenue', inr(item.revenue_30d, { compact: true })],
                        ['View → buy', item.conversion ? pct(item.conversion) : '—'],
                      ].map(([k, v]) => (
                        <div key={k} className="w-[62px] text-right">
                          <p className="text-[9.5px] font-bold uppercase tracking-wide text-ink/40">{k}</p>
                          <p className="font-display text-[12.5px] font-extrabold tabular-nums text-ink">{v}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex shrink-0 gap-0.5">
                      <button type="button" onClick={() => open(item.id)} aria-label={`Edit ${item.title}`} className="grid h-7 w-7 place-items-center rounded-xs text-ink/45 transition hover:bg-blush hover:text-maroon">
                        <Pencil className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </button>
                      <button type="button" onClick={() => toggleLive(item)} aria-label={`${item.active ? 'Hide' : 'Show'} ${item.title}`} className="grid h-7 w-7 place-items-center rounded-xs text-ink/45 transition hover:bg-blush hover:text-maroon">
                        {item.active ? <EyeOff className="h-3.5 w-3.5" strokeWidth={2.2} /> : <Eye className="h-3.5 w-3.5" strokeWidth={2.2} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setItems((v) => [...v, { ...item, id: `${item.id}-copy`, title: `${item.title} (copy)`, active: false, sold_30d: 0, revenue_30d: 0 }]); toast.success(`${item.title} duplicated`); }}
                        aria-label={`Duplicate ${item.title}`}
                        className="grid h-7 w-7 place-items-center rounded-xs text-ink/45 transition hover:bg-blush hover:text-maroon"
                      >
                        <Copy className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setItems((v) => v.filter((x) => x.id !== item.id)); toast.success(`${item.title} deleted`); }}
                        aria-label={`Delete ${item.title}`}
                        className="grid h-7 w-7 place-items-center rounded-xs text-ink/35 transition hover:bg-error-bg hover:text-error-fg"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.2} />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {counts.membership === 0 && (
        <p className="rounded-lg border-2 border-neutral-200 bg-white px-3 py-2 text-[11.5px] font-medium text-ink/60">
          You have no memberships yet. A monthly fee for ongoing access is the steadiest revenue a host can build —
          it is in the <b className="font-bold text-ink">New</b> menu above.
        </p>
      )}
    </div>
  );
};

export default Catalog;
