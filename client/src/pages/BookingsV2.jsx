// Bookings — dashboard_v2 graduation. The v2 look (tiles, dense list, compact
// week/month calendars) on the REAL getHostBookings data, REUSING the existing
// BookingDetailModal for every action (confirm/complete/no-show/cancel/reschedule/
// review) — the proven flow is not rebuilt. Shown on the flag-ON path (App picks
// it in BookingsRoute).
//
// Deferred (lab extras, tracked follow-ups, not faked): saved views, multi-select
// bulk actions, advanced status/payment/service filters. Search + status filter
// are here because they're cheap over the loaded list.
import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { CalendarClock, Clock, CalendarX2, ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, CheckCircle2, List, CalendarDays, CalendarRange, Check, X, RotateCcw } from 'lucide-react';
import { getHostBookings, getBookingReview } from '../services/api';
import { useRegisterRefresh } from '../components/dashboard/ui/refreshContext';
import { Skeleton, EmptyState, ErrorState, SearchInput } from '../components/dashboard/ui';
import { Avatar, Panel, PageHeading, StatusPill, cn, fmtTime, fmtDayFull } from '../components/dashboard/ui/v2';
import { BookingDetailModal } from './Bookings';
import MeetDropdown from '../components/ui/MeetDropdown';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_FULL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']; // indexed by Date.getDay()
const lower = (s) => String(s || '').toLowerCase();
const startOfWeek = (base) => { const d = new Date(base.getFullYear(), base.getMonth(), base.getDate()); return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)); };
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const VIEWS = [
  { id: 'list', label: 'List', icon: List },
  { id: 'week', label: 'Week', icon: CalendarDays },
  { id: 'month', label: 'Month', icon: CalendarRange },
];
// Leading icon per status/payment pill (keeps colour+word, adds a scannable glyph).
const PILL_ICON = {
  confirmed: Check, completed: Check, paid: Check, processed: Check, active: Check,
  pending: Clock, unpaid: Clock, in_transit: Clock,
  cancelled: X, no_show: X, expired: X, used_up: X, inactive: X,
  refunded: RotateCcw,
};
// Headline stat cards — each is a shortcut that filters the list.
const STAT_CARDS = [
  { key: 'upcoming', label: 'Upcoming', sub: 'Next 7 days', icon: CalendarClock, tint: 'bg-blush text-maroon', filter: 'confirmed' },
  { key: 'pending', label: 'Needs attention', sub: 'Requires action', icon: AlertTriangle, tint: 'bg-warning-bg text-warning-fg', filter: 'pending' },
  { key: 'completed', label: 'Completed', sub: 'This month', icon: CheckCircle2, tint: 'bg-success-bg text-success-fg', filter: 'completed' },
];
const STATUS_FILTER = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Needs confirming' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Done' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled', label: 'Cancelled' },
];

const CalCell = ({ b, onOpen }) => (
  <button type="button" onClick={() => onOpen(b)}
    className="flex w-full items-center gap-1.5 rounded-md bg-blush/50 px-1.5 py-1 text-left transition hover:bg-blush">
    <span className={cn('h-5 w-0.5 shrink-0 rounded-full', lower(b.status) === 'completed' ? 'bg-success-fg' : lower(b.status) === 'pending' ? 'bg-warning-fg' : lower(b.status) === 'cancelled' ? 'bg-neutral-300' : 'bg-maroon')} />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[10px] font-bold leading-tight text-ink">{fmtTime(b.scheduled_at)} {b.services?.title || 'Booking'}</span>
      <span className="block truncate text-[9px] font-medium text-ink/50">{b.guest_name || 'Guest'}</span>
    </span>
  </button>
);

const BookingsV2 = () => {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('list');
  const [anchor, setAnchor] = useState(() => new Date());
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');

  const fetch = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const { data } = await getHostBookings();
      const list = Array.isArray(data) ? data : [];
      setBookings(list);
      const done = list.filter((b) => lower(b.status) === 'completed' && b.guest_id);
      Promise.all(done.map((b) => getBookingReview(b.id).then(({ data: r }) => [b.id, r]).catch(() => [b.id, null])))
        .then((pairs) => setReviews(Object.fromEntries(pairs)));
    } catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { fetch(); }, [fetch]);
  useRegisterRefresh(fetch);

  const counts = useMemo(() => {
    const now = Date.now();
    const terminal = (s) => ['cancelled', 'completed', 'no_show'].includes(lower(s));
    return {
      upcoming: bookings.filter((b) => !terminal(b.status) && new Date(b.scheduled_at) > now).length,
      pending: bookings.filter((b) => lower(b.status) === 'pending' || (!terminal(b.status) && new Date(b.scheduled_at) <= now)).length,
      completed: bookings.filter((b) => lower(b.status) === 'completed').length,
    };
  }, [bookings]);

  const listRows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...bookings]
      .filter((b) => status === 'all' || lower(b.status) === status)
      .filter((b) => !needle || `${b.guest_name || ''} ${b.guest_email || ''} ${b.services?.title || ''}`.toLowerCase().includes(needle))
      .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));
  }, [bookings, q, status]);

  const weekStart = useMemo(() => startOfWeek(anchor), [anchor]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStart, i);
    return { date, items: bookings.filter((b) => sameDay(new Date(b.scheduled_at), date)).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)) };
  }), [weekStart, bookings]);
  const monthCells = useMemo(() => {
    const ms = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const gridStart = addDays(ms, -((ms.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => { const date = addDays(gridStart, i); return { date, inMonth: date.getMonth() === ms.getMonth(), items: bookings.filter((b) => sameDay(new Date(b.scheduled_at), date)) }; });
  }, [anchor, bookings]);
  const step = (dir) => setAnchor((a) => view === 'month' ? new Date(a.getFullYear(), a.getMonth() + dir, 1) : addDays(a, dir * 7));
  const labelDate = view === 'month' ? anchor : weekStart;
  const rangeLabel = `${MONTHS[labelDate.getMonth()].slice(0, 3)} '${String(labelDate.getFullYear()).slice(-2)}`;
  const today = new Date();

  return (
    <div className="flex flex-col gap-2.5">
      <PageHeading title="Bookings" sub={loading ? 'Loading…' : `${bookings.length} booking${bookings.length === 1 ? '' : 's'}`} />

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {STAT_CARDS.map(({ key, label, sub, icon: Icon, tint, filter }) => {
          const val = counts[key];
          const hot = key === 'pending' && val > 0;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { setStatus(filter); setView('list'); }}
              className="group rounded-xl border border-neutral-200/60 bg-white p-3.5 text-left transition hover:border-maroon/30 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
            >
              {/* Desktop: icon + number/title aligned left, sub to the right corner */}
              <span className="hidden items-center justify-between gap-3 sm:flex">
                <span className="flex items-center gap-3">
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-lg', tint)}>
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.4} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[22px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink">{loading ? '—' : val}</span>
                    <span className={cn('mt-1 block text-[12.5px] font-bold leading-tight', hot ? 'text-warning-fg' : 'text-ink/70')}>{label}</span>
                  </span>
                </span>
                <span className="shrink-0 self-start text-[10.5px] font-medium text-ink/40">{sub}</span>
              </span>
              {/* Mobile: title on top, icon + number aligned below */}
              <span className="flex flex-col gap-1.5 sm:hidden">
                <span className={cn('text-[11px] font-bold leading-tight', hot ? 'text-warning-fg' : 'text-ink/70')}>{label}</span>
                <span className="flex items-center gap-2">
                  <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg', tint)}>
                    <Icon className="h-4 w-4" strokeWidth={2.4} />
                  </span>
                  <span className="font-display text-[20px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink">{loading ? '—' : val}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <nav className={cn('flex gap-1 rounded-full border border-neutral-200/70 bg-white p-1 sm:flex-none', view === 'list' ? 'min-w-0 flex-1' : 'shrink-0')}>
          {VIEWS.map((v) => (
            <button key={v.id} type="button" onClick={() => setView(v.id)} aria-pressed={view === v.id} aria-label={v.label}
              className={cn('relative flex-1 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold transition-colors sm:flex-none sm:px-3', view === v.id ? 'text-white' : 'text-ink/55 hover:text-maroon')}>
              {view === v.id && (
                <motion.span layoutId="viewPill" className="absolute inset-0 rounded-full bg-maroon"
                  transition={{ type: 'spring', stiffness: 420, damping: 28 }} />
              )}
              <span className="relative z-10 flex items-center justify-center gap-1.5">
                <v.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
                <span className={cn(view === v.id ? 'inline' : 'hidden min-[480px]:inline')}>{v.label}</span>
              </span>
            </button>
          ))}
        </nav>
        {view === 'list' ? (
          <>
            {/* Status filter — mobile: right end of the toggle row; desktop: after search */}
            <div className="order-1 ml-auto shrink-0 sm:order-3 sm:ml-0">
              <MeetDropdown size="sm" ariaLabel="Status" value={status} onChange={setStatus} options={STATUS_FILTER} />
            </div>
            {/* Search — mobile: full-width second row; desktop: grows inline between toggle and filter */}
            <SearchInput value={q} onChange={setQ} placeholder="Guest, email or service…" className="order-2 w-full min-w-0 sm:order-2 sm:w-auto sm:flex-1" />
          </>
        ) : (
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => step(-1)} aria-label="Previous" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-neutral-200/70 text-ink/60 hover:bg-blush hover:text-maroon"><ChevronLeft className="h-4 w-4" /></button>
            <span className="min-w-[56px] shrink-0 text-center text-[12px] font-bold text-maroon">{rangeLabel}</span>
            <button type="button" onClick={() => step(1)} aria-label="Next" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-neutral-200/70 text-ink/60 hover:bg-blush hover:text-maroon"><ChevronRight className="h-4 w-4" /></button>
            <button type="button" onClick={() => setAnchor(new Date())} className="shrink-0 rounded-full border border-neutral-200/70 px-3 py-1.5 text-[11.5px] font-bold text-ink/70 transition hover:bg-blush hover:text-maroon">Today</button>
          </div>
        )}
      </div>

      {error && bookings.length === 0 ? (
        <ErrorState message="Couldn't load your bookings." onRetry={fetch} />
      ) : loading ? (
        <div className="overflow-hidden rounded-[8px] border border-neutral-200/60 bg-white">
          {[0, 1, 2, 3].map((i) => <div key={i} className="flex items-center gap-2.5 border-b border-neutral-100 px-3 py-2.5 last:border-b-0"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-3.5 w-40" /><Skeleton className="ml-auto h-3.5 w-16" /></div>)}
        </div>
      ) : bookings.length === 0 ? (
        <EmptyState icon={CalendarX2} title="No bookings yet" description="They'll show up here as guests book you — share your link to get the first one." />
      ) : view === 'list' ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-0.5">
            <h2 className="font-display text-[15px] font-extrabold text-ink">All bookings</h2>
            <span className="text-[11px] font-semibold text-ink/45">{listRows.length} result{listRows.length === 1 ? '' : 's'}</span>
          </div>
          {listRows.length === 0 ? (
            <div className="rounded-xl border border-neutral-200/60 bg-white px-3 py-10 text-center text-[12px] font-medium text-ink/50">No bookings match.</div>
          ) : (
            <>
              {/* Desktop: table */}
              <div className="hidden overflow-hidden rounded-xl border border-neutral-200/60 bg-white sm:block">
                <table className="w-full text-[11.5px]">
                  <thead>
                    <tr className="border-b border-neutral-200/70 bg-cream text-[10px] uppercase tracking-wide text-ink/45">
                      {['When', 'Guest', 'Service', 'Status', 'Payment'].map((h) => <th key={h} scope="col" className="px-3 py-2 text-left font-bold">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {listRows.map((b) => (
                      <tr key={b.id} onClick={() => setSelected(b)} className="cursor-pointer transition-colors hover:bg-cream">
                        <td className="px-3 py-2"><span className="block font-bold text-ink">{fmtDayFull(b.scheduled_at)}</span><span className="block text-[10.5px] font-medium text-ink/50">{fmtTime(b.scheduled_at)}</span></td>
                        <td className="px-3 py-2"><div className="flex items-center gap-1.5"><Avatar name={b.guest_name} size="h-6 w-6 text-[9px]" /><span className="min-w-0"><span className="block truncate font-bold text-ink">{b.guest_name || 'Guest'}</span><span className="block max-w-[150px] truncate text-[10px] font-medium text-ink/45">{b.guest_email || ''}</span></span></div></td>
                        <td className="px-3 py-2"><span className="block max-w-[160px] truncate text-ink/70">{b.services?.title || '—'}</span></td>
                        <td className="px-3 py-2"><StatusPill status={lower(b.status)} icon={PILL_ICON[lower(b.status)]} /></td>
                        <td className="px-3 py-2">{b.payment_status ? <StatusPill status={lower(b.payment_status)} icon={PILL_ICON[lower(b.payment_status)]} /> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile: appointment cards — date/time block up front, no avatar */}
              <div className="flex flex-col gap-2.5 sm:hidden">
                {listRows.map((b) => {
                  const dt = new Date(b.scheduled_at);
                  return (
                    <button key={b.id} type="button" onClick={() => setSelected(b)}
                      className="flex overflow-hidden rounded-2xl border border-neutral-200/60 bg-white text-left shadow-sm transition active:scale-[0.99] active:bg-cream">
                      {/* date + time block */}
                      <span className="flex w-[78px] shrink-0 flex-col items-center justify-center gap-0.5 bg-blush/60 px-2 py-3 text-center">
                        <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-maroon/60">{DAYS_FULL[dt.getDay()]}</span>
                        <span className="font-display text-[24px] font-extrabold leading-none text-maroon">{dt.getDate()}</span>
                        <span className="text-[10px] font-bold uppercase text-maroon/60">{MONTHS[dt.getMonth()].slice(0, 3)}</span>
                        <span className="mt-1.5 text-[10.5px] font-bold text-ink/70">{fmtTime(b.scheduled_at)}</span>
                      </span>
                      {/* details */}
                      <span className="flex min-w-0 flex-1 flex-col justify-center gap-2 p-3.5">
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-bold text-ink">{b.guest_name || 'Guest'}</span>
                          <span className="block truncate text-[12px] font-medium text-ink/50">{b.services?.title || '—'}</span>
                        </span>
                        <span className="flex flex-wrap gap-1.5">
                          <StatusPill status={lower(b.status)} icon={PILL_ICON[lower(b.status)]} />
                          {b.payment_status && <StatusPill status={lower(b.payment_status)} icon={PILL_ICON[lower(b.payment_status)]} />}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      ) : view === 'week' ? (
        <Panel flush>
          <div className="overflow-x-auto">
            {/* Empty days shrink to a slim column; days with bookings grow to fill. */}
            <div className="flex min-w-full">
              {weekDays.map(({ date, items }, i) => (
                <div key={i} className={cn('flex min-h-[300px] flex-col border-r border-neutral-100 last:border-r-0',
                  items.length ? 'min-w-[128px] flex-1' : 'w-14 shrink-0',
                  sameDay(date, today) && 'bg-blush/30')}>
                  <div className="border-b border-neutral-100 px-1.5 py-1.5 text-center">
                    <p className="text-[9.5px] font-bold uppercase text-ink/40">{DAYS[i]}</p>
                    <p className={cn('font-display text-[16px] font-extrabold leading-none', sameDay(date, today) ? 'text-maroon' : 'text-ink')}>{date.getDate()}</p>
                  </div>
                  <div className="flex-1 space-y-1 p-1">{items.map((b) => <CalCell key={b.id} b={b} onOpen={setSelected} />)}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      ) : (
        <Panel flush>
          <div className="grid grid-cols-7 border-b border-neutral-200/70 bg-cream">
            {DAYS.map((d) => <div key={d} className="py-1.5 text-center text-[9.5px] font-bold uppercase text-ink/45">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map(({ date, inMonth, items }, i) => (
              <div key={i} className={cn('min-h-[86px] border-b border-r border-neutral-100 p-1', !inMonth && 'bg-neutral-50/60', sameDay(date, today) && 'bg-blush/30')}>
                <p className={cn('text-[10px] font-bold', sameDay(date, today) ? 'text-maroon' : inMonth ? 'text-ink/60' : 'text-ink/25')}>{date.getDate()}</p>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 2).map((b) => <CalCell key={b.id} b={b} onOpen={setSelected} />)}
                  {items.length > 2 && <p className="px-1 text-[9px] font-semibold text-ink/40">+{items.length - 2} more</p>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {selected && (
        <BookingDetailModal
          booking={selected}
          onClose={() => setSelected(null)}
          onAction={fetch}
          review={reviews[selected.id] || null}
          onReviewDone={(saved) => setReviews((m) => ({ ...m, [selected.id]: saved }))}
        />
      )}
    </div>
  );
};

export default BookingsV2;
