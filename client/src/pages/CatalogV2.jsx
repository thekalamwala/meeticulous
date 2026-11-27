// Catalog — Kept (dashboard_v2). One list of everything a host sells:
// Services, Products, Courses, Memberships and Discounts (coupons, renamed).
//
// Borrowed wheels: Calendly Event types (type cards, on/off toggle, duplicate)
// and Shopify Products + Discounts (one list, type tabs). Same data and handlers
// as before — svcGetAll / getMyProducts / getMyCourses / getHostCoupons /
// getMyMembership through catalogModel — so one failing source never blanks the
// page; it is named in a notice and everything else still shows.
//
// Phone is an app screen, not this page shrunk: grouped rows with full-row tap,
// sticky type chips + section headers under the top bar, long-press a row to
// drag it into place, and "Add a service" pinned in the thumb zone. Desktop is
// a grid of photo cards with the same facts.
//
// Price: the big figure is what the host set. Under it, for a paid service, is
// what the host gets ("You'll get", server host_earnings = price less
// commission); for products and courses, the guest's total (server
// guest_total). Neither is ever worked out here.
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Reorder, useDragControls, motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Plus, CalendarClock, FileDown, BookOpen, Users, TicketPercent, Copy, GripVertical,
  Search, X, ExternalLink, ArrowUpDown, Check, AlertTriangle,
} from 'lucide-react';
import {
  svcGetAll, getMyProducts, getMyCourses, getHostCoupons, getMyMembership,
  svcToggle, svcDuplicate, updateProduct, updateCourse, updateHostCoupon, reorderCatalog,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import useFeatureFlags from '../hooks/useFeatureFlags';
import { ErrorState, Skeleton } from '../components/dashboard/ui';
import { PageHeading, InsightBand, Toggle, inr, cn } from '../components/dashboard/ui/v2';
import {
  mergeCatalog, selectItems, countsByKind, editHref, groupByKind, byHostOrder,
  TYPE_LABEL, TYPE_PLURAL, TYPE_BLURB, ADD_ROUTE, REORDERABLE,
} from './catalog/catalogModel';
import BottomSheet from './catalog/BottomSheet';

// Tab + section order (the plan's order: Memberships before Discounts).
const ORDER = ['service', 'product', 'course', 'membership', 'coupon'];
const TYPE_ICON = { service: CalendarClock, product: FileDown, course: BookOpen, membership: Users, coupon: TicketPercent };

// Emil's press: a quick scale on touch, nothing on hover but a tint.
const press = 'transition-[transform,background-color,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100 touch-manipulation select-none [-webkit-touch-callout:none]';
const ring = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const control = `rounded-[12px] ${ring} ${press}`;
const chip = (on) => cn('h-10 shrink-0 snap-start rounded-[12px] px-3.5 text-[13.5px] font-semibold', ring, press,
  on ? 'bg-maroon text-white' : 'bg-white text-muted hover:bg-pink-50 hover:text-maroon');
const serif = 'font-serif font-normal italic text-pink';
const bandBtn = 'inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink';

const load = async (kind, fn) => {
  try { const { data } = await fn(); return { kind, rows: Array.isArray(data) ? data : [] }; }
  catch { return { kind, rows: [], error: true }; }
};
// One membership program ({ program: { tiers } }); each tier is a row.
const loadMemberships = async () => {
  try { const { data } = await getMyMembership(); return { kind: 'membership', rows: data?.program?.tiers || [] }; }
  catch { return { kind: 'membership', rows: [], error: true }; }
};

/* ── Thumb: the item's photo, or its type on a tint. ───────────────────── */
const Thumb = ({ item, className, big = false }) => {
  const Icon = TYPE_ICON[item.kind] || CalendarClock;
  const [broken, setBroken] = useState(false);
  if (item.image && !broken) {
    return <img src={item.image} alt="" loading="lazy" onError={() => setBroken(true)} className={cn('object-cover', className)} />;
  }
  // No photo on a card: the type on a white disc over the dots pattern (tone on tone).
  if (big) {
    return (
      <span aria-hidden="true" className={cn('grid place-items-center bg-blush', className)}
        style={{ backgroundImage: 'url(/brand/ds/03-patterns/mt-pattern-dots-on-blush.svg)', backgroundSize: '44px' }}>
        <span className="grid h-16 w-16 place-items-center rounded-full bg-white text-maroon">
          <Icon className="h-7 w-7" strokeWidth={1.9} />
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden="true" className={cn('grid place-items-center bg-blush text-maroon', className)}>
      {item.kind === 'coupon'
        ? <span className="font-display text-[15px] font-extrabold tracking-[-0.02em]">%</span>
        : <Icon className="h-[40%] max-h-8 w-[40%] max-w-8" strokeWidth={1.8} />}
    </span>
  );
};

/* ── Price: what the host set, and what a guest pays when the server said. ─ */
const priceFacts = (item) => {
  if (item.kind === 'coupon') return { big: item.meta, small: null };
  if (item.kind === 'membership') return { big: item.price === null ? 'Free' : `${inr(item.price)}/mo`, small: null };
  if (item.priceOnRequest) return { big: 'Price on request', small: 'Guests book, then you agree a price' };
  const g = item.guestTotal;
  if (!item.price) return { big: 'Free', small: g ? `Guests pay a ${inr(g, { decimals: g % 1 !== 0 })} booking fee` : null };
  // A paid service shows what the HOST gets (price less Meeticulous's commission,
  // server-computed host_earnings); products and courses still show the guest total.
  if (item.kind === 'service') {
    const e = item.hostEarnings;
    return { big: inr(item.price), small: e !== null && e !== undefined ? `You'll get ${inr(e, { decimals: e % 1 !== 0 })}` : null };
  }
  return { big: inr(item.price), small: g && g > item.price ? `Guests pay ${inr(g, { decimals: g % 1 !== 0 })}` : null };
};

// What the switch means: a discount is on or paused; anything else is on the
// host's page or hidden from it.
const stateWord = (it, on = it.active) => (it.kind === 'coupon' ? (on ? 'Active' : 'Paused') : (on ? 'On your page' : 'Hidden'));
const switchLabel = (it) => (it.kind === 'coupon' ? `${it.active ? 'Pause' : 'Turn on'} ${it.title}` : `${it.active ? 'Hide' : 'Show'} ${it.title} on your page`);

/* ── Toggle wiring: one call per type, all existing endpoints. ─────────── */
const TOGGLE = {
  service: (it) => svcToggle(it.id),
  product: (it) => updateProduct(it.id, { is_active: !it.active }),
  course: (it) => updateCourse(it.id, { is_active: !it.active }),
  coupon: (it) => updateHostCoupon(it.id, { active: !it.active }),
};

/* ── Long-press to lift a row (phone). Cancels on movement, so a scroll never
   becomes a drag. While a row is held, the page stops scrolling. ────────── */
const useLiftOnHold = (onLift, delay = 420) => {
  const t = useRef(null);
  const origin = useRef(null);
  const clear = () => { clearTimeout(t.current); t.current = null; };
  return {
    onPointerDown: (e) => {
      if (e.pointerType === 'mouse') return;
      origin.current = { x: e.clientX, y: e.clientY };
      const ev = e.nativeEvent;
      clear();
      t.current = setTimeout(() => { t.current = null; onLift(ev); }, delay);
    },
    onPointerMove: (e) => {
      if (!t.current || !origin.current) return;
      if (Math.abs(e.clientX - origin.current.x) > 8 || Math.abs(e.clientY - origin.current.y) > 8) clear();
    },
    onPointerUp: clear,
    onPointerCancel: clear,
    onContextMenu: (e) => e.preventDefault(),
  };
};

/* ── Phone row ──────────────────────────────────────────────────────────── */
const Row = ({ item, onOpen, onToggle, busy, canDrag, lifting, setLifting }) => {
  const controls = useDragControls();
  const { big, small } = priceFacts(item);
  const lift = useLiftOnHold((ev) => {
    if (!canDrag) return;
    navigator.vibrate?.(10);
    setLifting(item.id);
    controls.start(ev);
  });
  const held = lifting === item.id;
  return (
    <Reorder.Item as="li" value={item.id} dragListener={false} dragControls={controls}
      onDragEnd={() => setLifting(null)}
      className={cn('relative bg-white', held && 'z-10 rounded-[16px] shadow-[var(--shadow-md)]')}
      transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}>
      <div className="flex items-center gap-3 pl-4 pr-2">
        <button type="button" onClick={() => !held && onOpen(item)} {...(canDrag ? lift : {})}
          className={cn('flex min-w-0 flex-1 items-center gap-3 py-3 text-left', ring, press, 'active:bg-transparent')}>
          <Thumb item={item} className="h-14 w-14 shrink-0 rounded-[14px]" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-[14.5px] font-semibold text-ink">{item.title}</span>
            {item.detail && <span className="truncate text-[12.5px] text-muted">{item.detail}</span>}
            <span className="truncate text-[13px] font-semibold tabular-nums text-maroon">
              {big}{small && <span className="font-normal text-faint"> · {small}</span>}
            </span>
          </span>
        </button>
        {item.kind === 'membership' ? (
          <span className={cn('shrink-0 rounded-[8px] px-2.5 py-1 text-[12px] font-semibold', item.active ? 'bg-pink-50 text-maroon' : 'bg-cream text-muted')}>
            {item.active ? 'Live' : 'Draft'}
          </span>
        ) : (
          <span className="grid h-11 w-12 shrink-0 place-items-center">
            <Toggle checked={item.active} disabled={busy} onChange={() => onToggle(item)} label={switchLabel(item)} />
          </span>
        )}
      </div>
    </Reorder.Item>
  );
};

/* ── Desktop card ───────────────────────────────────────────────────────── */
const Card = ({ item, onOpen, onToggle, onDuplicate, busy }) => {
  const { big, small } = priceFacts(item);
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-[24px] bg-white">
      <button type="button" onClick={() => onOpen(item)} className={cn('flex min-w-0 flex-1 flex-col text-left transition-colors hover:bg-pink-50', ring)}>
        {/* Discounts have no picture; a tier shows its cover (v3.228) or its icon. */}
        {item.kind !== 'coupon' && <Thumb item={item} big className="aspect-[16/9] w-full" />}
        <span className="flex min-w-0 flex-col gap-0.5 px-5 pb-4 pt-4">
          <span className="text-[13px] font-semibold text-faint">{TYPE_LABEL[item.kind]}</span>
          <span className="truncate font-display text-[18px] font-bold tracking-[-0.02em] text-ink">{item.title}</span>
          <span className="truncate text-[13.5px] text-muted">{item.detail || ' '}</span>
          <span className="mt-2 truncate font-display text-[22px] font-extrabold tabular-nums tracking-[-0.02em] text-maroon">{big}</span>
          <span className="truncate text-[13px] text-faint">{small || ' '}</span>
        </span>
      </button>
      <footer className="flex items-center gap-2 border-t border-neutral-200 px-3 py-2">
        {item.kind === 'membership' ? (
          <span className={cn('ml-2 rounded-[8px] px-2.5 py-1 text-[12.5px] font-semibold', item.active ? 'bg-pink-50 text-maroon' : 'bg-cream text-muted')}>
            {item.active ? 'Live' : 'Draft'}
          </span>
        ) : (
          <label className="flex min-h-11 items-center gap-2.5 px-2 text-[13.5px] font-semibold text-muted">
            <Toggle checked={item.active} disabled={busy} onChange={() => onToggle(item)} label={switchLabel(item)} />
            <span aria-hidden="true">{stateWord(item)}</span>
          </label>
        )}
        {item.kind === 'service' && (
          <button type="button" onClick={() => onDuplicate(item)} disabled={busy}
            className={cn(control, 'ml-auto inline-flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-semibold text-muted hover:bg-pink-50 hover:text-maroon disabled:opacity-50')}>
            <Copy className="h-4 w-4" strokeWidth={2.2} /> Duplicate
          </button>
        )}
      </footer>
    </article>
  );
};

/* ── Desktop arrange list: the same Reorder, with a grip you can see. ──── */
const ArrangeRow = ({ item }) => {
  const controls = useDragControls();
  return (
    <Reorder.Item as="li" value={item.id} dragListener={false} dragControls={controls}
      className="flex items-center gap-3 bg-white px-3 py-2.5" whileDrag={{ boxShadow: 'var(--shadow-md)', borderRadius: 16 }}
      transition={{ duration: 0.26, ease: [0.22, 0.61, 0.36, 1] }}>
      <button type="button" aria-label={`Drag ${item.title}`} onPointerDown={(e) => controls.start(e)}
        className={cn(control, 'grid h-10 w-10 shrink-0 cursor-grab touch-none place-items-center text-faint hover:bg-pink-50 hover:text-maroon active:cursor-grabbing')}>
        <GripVertical className="h-5 w-5" strokeWidth={2.2} />
      </button>
      <Thumb item={item} className="h-10 w-10 shrink-0 rounded-[12px]" />
      <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold text-ink">{item.title}</span>
      <span className="shrink-0 text-[13.5px] font-semibold tabular-nums text-maroon">{priceFacts(item).big}</span>
    </Reorder.Item>
  );
};

/* ── Section: one type. Sticky header on phone; grid or arrange on desktop. */
const Section = ({ kind, items, showHead, arranging, onArrange, onReorder, onOpen, onToggle, onDuplicate, busyId, lifting, setLifting, onAdd }) => {
  const canDrag = REORDERABLE.includes(kind) && items.length > 1;
  const ids = items.map((i) => i.id);
  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  return (
    <section aria-label={TYPE_PLURAL[kind]} className="flex flex-col gap-3">
      {showHead && (
        <header className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px)+52px)] z-10 -mx-4 flex items-center gap-2 bg-cream/90 px-4 py-1.5 backdrop-blur-md sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <h2 className="mb-0 font-display text-[17px] font-bold tracking-[-0.02em] text-ink sm:text-[20px]">
            {TYPE_PLURAL[kind]} <span className="font-sans text-[13px] font-semibold tabular-nums text-faint sm:text-[14px]">{items.length}</span>
          </h2>
          <span className="ml-auto hidden items-center gap-1 sm:flex">
            {canDrag && (
              <button type="button" onClick={() => onArrange(arranging ? null : kind)} aria-pressed={arranging}
                className={cn(control, 'inline-flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-semibold', arranging ? 'bg-maroon text-white' : 'text-muted hover:bg-blush hover:text-maroon')}>
                {arranging ? <><Check className="h-4 w-4" strokeWidth={2.4} /> Done</> : <><ArrowUpDown className="h-4 w-4" strokeWidth={2.2} /> Reorder</>}
              </button>
            )}
            <button type="button" onClick={() => onAdd(kind)}
              className={cn(control, 'inline-flex h-10 items-center gap-1.5 px-3 text-[13.5px] font-semibold text-maroon hover:bg-blush')}>
              <Plus className="h-4 w-4" strokeWidth={2.4} /> Add {TYPE_LABEL[kind].toLowerCase()}
            </button>
          </span>
        </header>
      )}

      {/* Phone: grouped rows; long-press lifts a row to drag. */}
      <Reorder.Group as="ul" axis="y" values={ids} onReorder={(next) => onReorder(kind, next, false)}
        className="divide-y divide-neutral-200 overflow-hidden rounded-[24px] bg-white sm:hidden [&>li]:[--inset:88px]">
        {items.map((it) => (
          <Row key={it.id} item={it} onOpen={onOpen} onToggle={onToggle} busy={busyId === it.id}
            canDrag={canDrag} lifting={lifting} setLifting={(v) => { setLifting(v); if (v === null) onReorder(kind, null, true); }} />
        ))}
      </Reorder.Group>

      {/* Desktop: photo cards, or the arrange list while reordering. */}
      {arranging ? (
        <Reorder.Group as="ul" axis="y" values={ids} onReorder={(next) => onReorder(kind, next, false)}
          className="hidden divide-y divide-neutral-200 overflow-hidden rounded-[24px] bg-white sm:block">
          {ids.map((id) => <ArrangeRow key={id} item={byId[id]} />)}
        </Reorder.Group>
      ) : (
        <div className="hidden grid-cols-2 gap-4 sm:grid xl:grid-cols-3">
          {items.map((it) => (
            <Card key={it.id} item={it} onOpen={onOpen} onToggle={onToggle} onDuplicate={onDuplicate} busy={busyId === it.id} />
          ))}
        </div>
      )}
    </section>
  );
};

/* ── New: desktop menu, phone bottom sheet. Same list of types. ───────── */
const NewList = ({ types, onPick }) => (
  <ul className="flex flex-col gap-1">
    {types.map((t) => {
      const Icon = TYPE_ICON[t];
      return (
        <li key={t}>
          <button type="button" role="menuitem" onClick={() => onPick(t)}
            className={cn('flex w-full items-start gap-3 rounded-[12px] px-3 py-3 text-left transition-colors hover:bg-pink-50 active:bg-pink-50', ring)}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-blush text-maroon"><Icon className="h-5 w-5" strokeWidth={2.2} /></span>
            <span className="min-w-0">
              <span className="block text-[14.5px] font-semibold text-ink">{TYPE_LABEL[t]}</span>
              <span className="block text-[13px] leading-snug text-muted">{TYPE_BLURB[t]}</span>
            </span>
          </button>
        </li>
      );
    })}
  </ul>
);

const NewMenu = ({ types, onPick }) => {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [open]);
  return (
    <div className="relative hidden sm:block">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu"
        className={cn(control, 'inline-flex h-11 items-center gap-2 bg-maroon px-5 text-[14px] font-semibold text-white hover:bg-maroon-dark')}>
        <Plus className="h-4 w-4" strokeWidth={2.4} /> New
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
            <motion.div role="menu" initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.16, ease: [0.22, 0.61, 0.36, 1] }} style={{ transformOrigin: 'top right' }}
              className="absolute right-0 z-50 mt-2 w-[340px] rounded-[20px] bg-white p-2 shadow-[var(--shadow-lg)]">
              <NewList types={types} onPick={(t) => { setOpen(false); onPick(t); }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// Phone: the same list in a bottom sheet (grab handle, swipe down to close).
const NewSheet = ({ open, onClose, types, onPick }) => (
  <BottomSheet open={open} onClose={onClose} title="Add to your catalog">
    <NewList types={types} onPick={(t) => { onClose(); onPick(t); }} />
  </BottomSheet>
);

/* ── Page ───────────────────────────────────────────────────────────────── */
const CatalogV2 = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { flags } = useFeatureFlags();
  const [sources, setSources] = useState(null);
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [busyId, setBusyId] = useState(null);
  const [arranging, setArranging] = useState(null);
  const [lifting, setLifting] = useState(null);
  const [order, setOrder] = useState({});   // kind -> [ids] while a drag is in flight
  const [sheet, setSheet] = useState(false);
  const pending = useRef({});              // kind -> ids to save when the drag ends

  const enabled = useMemo(() => ({
    service: true, product: true, course: !!flags?.course_purchase, coupon: !!flags?.coupons, membership: !!flags?.community_memberships,
  }), [flags?.course_purchase, flags?.coupons, flags?.community_memberships]);
  const types = ORDER.filter((t) => enabled[t]);

  const fetchAll = useCallback(async () => {
    setSources(null);
    const jobs = [
      enabled.service && load('service', svcGetAll),
      enabled.product && load('product', getMyProducts),
      enabled.course && load('course', getMyCourses),
      enabled.membership && loadMemberships(),
      enabled.coupon && load('coupon', getHostCoupons),
    ].filter(Boolean);
    setSources(await Promise.all(jobs));
  }, [enabled]);
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { items: loaded, failed } = useMemo(() => mergeCatalog(sources || []), [sources]);
  const [local, setLocal] = useState(null); // optimistic copy after a toggle/duplicate
  useEffect(() => { setLocal(null); }, [sources]);
  const items = local || loaded;

  const counts = useMemo(() => countsByKind(items), [items]);
  const query = q.trim();
  const visible = useMemo(() => selectItems(items, { q: query, kind, sort: 'host' }), [items, query, kind]);
  const groups = useMemo(() => {
    const g = groupByKind(visible, ORDER);
    return g.map(([k, list]) => {
      const ids = order[k];
      if (!ids) return [k, list];
      const byId = Object.fromEntries(list.map((i) => [i.id, i]));
      return [k, ids.map((id) => byId[id]).filter(Boolean)];
    });
  }, [visible, order]);

  const loading = sources === null;
  const allFailed = !loading && sources.length > 0 && failed.length === sources.length;
  const none = !loading && !allFailed && items.length === 0 && failed.length === 0;

  // `from` lets the service editor send Back / Save to the Catalog.
  const open = (it) => navigate(editHref(it), { state: { from: '/dashboard/catalog' } });
  const add = (t) => navigate(ADD_ROUTE[t], { state: { from: '/dashboard/catalog' } });

  const toggle = async (it) => {
    const call = TOGGLE[it.kind];
    if (!call) return;
    setBusyId(it.id);
    const flip = (on) => setLocal((cur) => (cur || loaded).map((x) => (x.kind === it.kind && x.id === it.id ? { ...x, active: on } : x)));
    flip(!it.active);
    try {
      await call(it);
      toast.success(it.kind === 'coupon'
        ? `${it.title} is ${it.active ? 'paused' : 'active'}`
        : (it.active ? `${it.title} is hidden from your page` : `${it.title} is on your page`));
    } catch (err) {
      flip(it.active);
      toast.error(err?.response?.data?.message || 'Could not change that. Try again.');
    } finally { setBusyId(null); }
  };

  const duplicate = async (it) => {
    setBusyId(it.id);
    try {
      await svcDuplicate(it.id);
      toast.success(`Copied ${it.title}. The copy starts hidden.`);
      fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Could not duplicate that service.');
    } finally { setBusyId(null); }
  };

  // Reorder: the list follows the finger live; saving waits for the drop.
  const reorder = async (k, next, commit) => {
    if (!commit) {
      if (!next) return;
      pending.current[k] = next;
      setOrder((o) => ({ ...o, [k]: next }));
      return;
    }
    const ids = pending.current[k];
    delete pending.current[k];
    if (!ids) return;
    const before = items.filter((i) => i.kind === k).sort(byHostOrder).map((i) => i.id);
    if (before.join() === ids.join()) { setOrder((o) => { const { [k]: _, ...rest } = o; return rest; }); return; }
    const rank = Object.fromEntries(ids.map((id, i) => [id, i + 1]));
    setLocal((cur) => (cur || loaded).map((x) => (x.kind === k && rank[x.id] ? { ...x, sortOrder: rank[x.id] } : x)));
    setOrder((o) => { const { [k]: _, ...rest } = o; return rest; });
    try {
      await reorderCatalog(k, ids);
    } catch (err) {
      setLocal(null);
      toast.error(err?.response?.data?.message || 'Could not save the new order.');
    }
  };
  // Desktop "Done" commits the arranged section.
  const setArrange = (k) => { if (arranging && !k) reorder(arranging, null, true); setArranging(k); };

  const live = items.filter((i) => i.active && i.kind !== 'coupon').length;
  const sellable = items.filter((i) => i.kind !== 'coupon').length;
  const top = useMemo(() => items
    .filter((i) => i.kind === 'service' && i.active)
    .map((i) => ({ i, n: Number(sources?.find((s) => s.kind === 'service')?.rows.find((r) => r.id === i.id)?.total_bookings) || 0 }))
    .sort((a, b) => b.n - a.n)[0], [items, sources]);

  const pageUrl = user?.username ? `/${user.username}` : null;
  const sub = loading ? 'Loading what you sell…'
    : allFailed ? 'Not loaded right now'
      : none ? 'Nothing here yet'
      : `${sellable} ${sellable === 1 ? 'thing' : 'things'} you sell · ${live} on your page`;

  let band = null;
  if (none) {
    band = (
      <InsightBand mascot="green" compact className="sm:py-7" eyebrow="Your catalog"
        title={<>Add your first service. <em className={serif}>Guests can book it today.</em></>}
        sub="A service puts paid time on your calendar. Products and courses sell while you sleep."
        actions={<button type="button" onClick={() => add('service')} className={cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100')}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add a service</button>} />
    );
  } else if (!loading && !allFailed && items.length > 0) {
    band = (
      <InsightBand compact className="sm:py-7" eyebrow="Your catalog"
        title={top && top.n > 0
          ? <>{top.i.title} <em className={serif}>is booked the most.</em></>
          : <>{live} of {sellable} on your page. <em className={serif}>Ready to book.</em></>}
        sub={top && top.n > 0
          ? `${top.n} ${top.n === 1 ? 'booking' : 'bookings'} so far. Under each service is what you get after our commission.`
          : 'Under each service is what you get after our commission. Hidden items stay off your page.'}
        actions={pageUrl ? (
          <a href={pageUrl} target="_blank" rel="noreferrer" className={cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100')}>
            See your page <ExternalLink className="h-4 w-4" strokeWidth={2.4} />
          </a>
        ) : null} />
    );
  }

  const tabs = [{ value: 'all', label: 'All', count: items.length }, ...types.map((t) => ({ value: t, label: TYPE_PLURAL[t], count: counts[t] || 0 }))];
  const showSearch = items.length > 6;

  return (
    <div className={cn('flex flex-col gap-6', !allFailed && 'pb-28 sm:pb-0')}>
      <PageHeading title="Catalog" sub={sub} action={!loading && !allFailed ? <NewMenu types={types} onPick={add} /> : null} />

      {allFailed ? (
        <div className="rounded-[24px] bg-white">
          <ErrorState title="We couldn't load your catalog."
            message="What you sell is safe. This is a problem showing it. Try again." onRetry={fetchAll} />
        </div>
      ) : (
        <>
          {loading ? <Skeleton className="h-[164px] !rounded-[28px] sm:!rounded-[32px]" /> : band}

          {failed.length > 0 && (
            <section className="flex flex-col gap-3 rounded-[24px] bg-white p-5 sm:flex-row sm:items-center sm:p-6">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-blush text-maroon"><AlertTriangle className="h-5 w-5" strokeWidth={2.2} /></span>
              <p className="mb-0 flex-1 text-[14px] text-ink">
                Your {failed.map((f) => TYPE_PLURAL[f].toLowerCase()).join(' and ')} didn&apos;t load. Everything else is here.
              </p>
              <button type="button" onClick={fetchAll} className={cn(control, 'inline-flex h-11 shrink-0 items-center justify-center bg-cream px-4 text-[14px] font-semibold text-maroon hover:bg-blush')}>Try again</button>
            </section>
          )}

          {!none && (
            <div className="flex flex-col gap-5">
              {/* Phone: the type chips stick under the 56px top bar (52px tall), and each
                  section's header sticks under them. Search scrolls away with the page. */}
              {/* `contents` on a phone so the sticky chips' parent is the whole list
                  (sticky only holds inside its parent); a row of chips + search on desktop. */}
              <div className="contents sm:flex sm:flex-row sm:items-center sm:gap-3">
              <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-20 -mx-4 bg-cream/90 px-4 pb-2 pt-1 backdrop-blur-md sm:static sm:order-1 sm:mx-0 sm:flex-1 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                <nav aria-label="Type" className="dash-noscrollbar -mx-4 flex snap-x gap-2 overflow-x-auto overscroll-x-contain scroll-px-4 px-4 sm:mx-0 sm:flex-1 sm:flex-wrap sm:px-0">
                  {loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-24 shrink-0" />)
                    : tabs.map((t) => (
                      <button key={t.value} type="button" aria-pressed={kind === t.value} onClick={() => setKind(t.value)} className={chip(kind === t.value)}>
                        {t.label}<span className={cn('ml-1.5 tabular-nums', kind === t.value ? 'text-white/75' : 'text-faint')}>{t.count}</span>
                      </button>
                    ))}
                </nav>
              </div>
                {showSearch && (
                  <label className="relative order-first block sm:order-2 sm:w-[280px]">
                    <span className="sr-only">Search your catalog</span>
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-faint" strokeWidth={2.2} />
                    <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)}
                      placeholder="Search what you sell"
                      className="h-11 w-full rounded-[12px] border-0 bg-white pl-11 pr-11 text-[14.5px] text-ink placeholder:text-faint focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose [&::-webkit-search-cancel-button]:hidden" />
                    {q && (
                      <button type="button" onClick={() => setQ('')} aria-label="Clear search"
                        className={cn(control, 'absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-faint hover:text-maroon')}>
                        <X className="h-4 w-4" strokeWidth={2.4} />
                      </button>
                    )}
                  </label>
                )}
              </div>

              {loading ? (
                <>
                  <ul aria-hidden="true" className="divide-y divide-neutral-200 overflow-hidden rounded-[24px] bg-white sm:hidden">
                    {[0, 1, 2, 3].map((i) => (
                      <li key={i} className="flex items-center gap-3 px-4 py-3">
                        <Skeleton className="h-14 w-14 !rounded-[14px]" />
                        <span className="flex flex-1 flex-col gap-2"><Skeleton className="h-3.5 w-40 max-w-full" /><Skeleton className="h-3 w-28" /><Skeleton className="h-3 w-20" /></span>
                      </li>
                    ))}
                  </ul>
                  <div aria-hidden="true" className="hidden grid-cols-2 gap-4 sm:grid xl:grid-cols-3">
                    {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[300px] !rounded-[24px]" />)}
                  </div>
                </>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-[24px] bg-white px-6 py-12 text-center">
                  <p className="mb-0 text-[15px] font-semibold text-ink">
                    {query ? `Nothing matches “${query}”.` : `No ${TYPE_PLURAL[kind]?.toLowerCase()} yet.`}
                  </p>
                  {query
                    ? <button type="button" onClick={() => setQ('')} className={cn(control, 'inline-flex h-11 items-center gap-1.5 bg-cream px-4 text-[14px] font-semibold text-maroon hover:bg-blush')}><X className="h-4 w-4" strokeWidth={2.4} /> Clear search</button>
                    : <button type="button" onClick={() => add(kind)} className={cn(control, 'inline-flex h-11 items-center gap-1.5 bg-maroon px-4 text-[14px] font-semibold text-white hover:bg-maroon-dark')}><Plus className="h-4 w-4" strokeWidth={2.4} /> Add {TYPE_LABEL[kind]?.toLowerCase()}</button>}
                </div>
              ) : (
                groups.map(([k, list]) => (
                  <Section key={k} kind={k} items={list} showHead={kind === 'all' || !query}
                    arranging={arranging === k} onArrange={setArrange} onReorder={reorder}
                    onOpen={open} onToggle={toggle} onDuplicate={duplicate} busyId={busyId}
                    lifting={lifting} setLifting={setLifting} onAdd={add} />
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Phone thumb zone: "Add a service" pinned above the tab bar, clear of its
          raised centre button. Portalled: the page sits inside transformed wrappers
          (pull-to-refresh, page transition) that would otherwise pin it to them. */}
      {!loading && !allFailed && !none && createPortal(
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+76px)] z-30 flex gap-2 bg-cream/90 px-4 pb-9 pt-2 backdrop-blur-md sm:hidden">
          <button type="button" onClick={() => add('service')}
            className={cn(control, 'flex h-12 flex-1 items-center justify-center gap-2 bg-maroon text-[15px] font-semibold text-white active:bg-maroon-dark')}>
            <Plus className="h-4 w-4" strokeWidth={2.4} /> Add a service
          </button>
          {types.length > 1 && (
            <button type="button" onClick={() => setSheet(true)} aria-label="Add something else"
              className={cn(control, 'grid h-12 w-12 shrink-0 place-items-center bg-white text-maroon active:bg-blush')}>
              <Plus className="h-5 w-5" strokeWidth={2.4} />
            </button>
          )}
        </div>,
        document.body,
      )}
      <NewSheet open={sheet} onClose={() => setSheet(false)} types={types} onPick={add} />
    </div>
  );
};

export default CatalogV2;
