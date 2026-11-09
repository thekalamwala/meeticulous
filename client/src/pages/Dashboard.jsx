import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight,
  LayoutGrid, Plus, Sparkles, Wallet,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getPayoutBalance, getHostBookings } from '../services/api';
import { fmtMoney, cn } from '../components/dashboard/ui';
import { useOverviewChrome } from '../components/common/overviewChrome';
import { isPreviewEnabled, getPreviewBookings, getPreviewPayoutBalance } from '../utils/previewData';
import toast from 'react-hot-toast';

/* ==========================================================================
 * Overview — reference layout.
 *
 * ALL business data is real: the money tiles read the host's payout balance
 * (getPayoutBalance) and the calendar + counts read the host's own bookings
 * (getHostBookings). No dummy bookings and no hardcoded counts — when the host
 * has none (or the backend is unreachable), the calendar shows a clean empty
 * state and the counts read 0, never a fabricated number.
 * ======================================================================== */

// Monday of the given date's week (Mon-first).
const startOfWeek = (base) => {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  const dow = (d.getDay() + 6) % 7; // Mon = 0
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
};

// The visible week is anchored to today (navigable via the arrows).
const WEEK_START = startOfWeek(new Date());

// Real booking.status → one of the four preserved card colour styles.
const STATUS_STYLE_KEY = {
  completed: 'green',
  confirmed: 'purple',
  pending: 'orange',
  no_show: 'pink',
};
const styleKeyFor = (status) => STATUS_STYLE_KEY[String(status || '').toLowerCase()] || 'purple';

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const fmtClock = (d) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase();

// Map a raw host booking to the calendar's view-model. Cancelled bookings are
// omitted from the calendar (they aren't scheduled time).
const toCalendarBooking = (b) => {
  const start = new Date(b.scheduled_at);
  const durationMin = b.services?.duration || b.duration || 30;
  const end = new Date(start.getTime() + durationMin * 60000);
  return {
    id: b.id,
    name: b.guest_name || 'Guest',
    date: start,
    status: b.status,
    styleKey: styleKeyFor(b.status),
    time: `${fmtClock(start)} - ${fmtClock(end)}`,
  };
};

const STATUS = {
  purple: {
    card: 'border-l-[#9B7CF6] bg-[#F6F3FF]',
    time: 'text-[#7C6BB0]',
    dot: 'bg-[#9B7CF6]',
  },
  pink: {
    card: 'border-l-[#F50069] bg-[#FFF1F7]',
    time: 'text-[#C05B87]',
    dot: 'bg-[#F50069]',
  },
  green: {
    card: 'border-l-[#10BF83] bg-[#ECFBF4]',
    time: 'text-[#3E8C72]',
    dot: 'bg-[#10BF83]',
  },
  orange: {
    card: 'border-l-[#F59E0B] bg-[#FFF5EA]',
    time: 'text-[#B07A2A]',
    dot: 'bg-[#F59E0B]',
  },
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

const formatRange = (start, end) => {
  const fmt = (d) => `${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
  return `${fmt(start)} – ${fmt(end)} ${end.getFullYear()}`;
};

/* ------------------------------------------------------------------ */
/* Greeting                                                            */
/* ------------------------------------------------------------------ */

const Greeting = ({ firstName }) => (
  <header className="relative mb-5">
    <span aria-hidden="true" className="absolute -left-2 -top-2 h-2 w-2 rounded-full bg-[#FF9FB0]/70" />
    <span aria-hidden="true" className="absolute -left-4 top-3 h-1.5 w-[2px] rotate-45 rounded-full bg-[#F50069]/50" />
    <div className="flex items-center gap-2">
      <h1 className="mb-0 font-heading text-[26px] font-extrabold leading-tight tracking-tight text-[#F50069] sm:text-[32px] lg:text-[36px]">
        Good afternoon, {firstName}!
      </h1>
      <Sparkles className="hidden h-6 w-6 shrink-0 text-[#FF9FB0] sm:block" strokeWidth={1.8} />
    </div>
    <p className="mt-1 text-[15px] font-medium text-[#71639E] sm:text-[16px] lg:text-[18px]">
      Here's what's happening with your business today.
    </p>
  </header>
);

/* ------------------------------------------------------------------ */
/* Stat cards                                                          */
/* ------------------------------------------------------------------ */

const WithdrawCard = ({ balance, status }) => {
  const navigate = useNavigate();
  const ready = status === 'ready';
  // Only show a real figure once the balance has actually loaded. While loading
  // or on error we show '—' so an unavailable balance is never misread as ₹0.00.
  const money = (v) => (ready ? fmtMoney(v ?? 0, { decimals: true }) : '—');

  return (
    <div className="relative flex h-[122px] flex-col justify-between overflow-hidden rounded-[18px] bg-gradient-to-br from-[#F50069] via-[#D90059] to-[#B3006B] p-4 text-white shadow-[0_16px_34px_-20px_rgba(217,0,89,0.75)]">
      <span aria-hidden="true" className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10" />
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/20">
          <Wallet className="h-5 w-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-white/85">Available to withdraw</p>
          <p className="mt-0.5 font-heading text-[30px] font-extrabold leading-none tracking-tight">
            {money(balance?.available)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/dashboard/payments/payouts')}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-[11.5px] font-bold text-[#D90059] shadow-sm transition hover:bg-[#FFF0F8]"
        >
          Withdraw
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.4} />
        </button>
      </div>
      {/* Clearing / pending — kept on one readable line under the balance.
          Mapped from the real getPayoutBalance() fields (clearing, pendingCompletion). */}
      <p className="flex flex-wrap items-baseline gap-x-1.5 pl-[56px] text-[13px] font-medium leading-tight text-white/90">
        <span className="font-bold text-white">{money(balance?.clearing)}</span>
        <span className="text-white/80">clearing</span>
        <span aria-hidden="true" className="px-0.5 text-white/55">·</span>
        <span className="font-bold text-white">{money(balance?.pendingCompletion)}</span>
        <span className="text-white/80">pending</span>
      </p>
    </div>
  );
};

const CountCard = ({ title, value, to, tone, Icon, showLink = false }) => (
  <div className="flex h-[122px] flex-col justify-between rounded-[18px] border border-[#FFD8ED] bg-white p-4 shadow-[0_10px_26px_-22px_rgba(245,0,105,0.45)]">
    <div className="flex items-start gap-2.5">
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-full',
          tone === 'green' ? 'bg-[#E7FAF2] text-[#10BF83]' : 'bg-[#FFE1F1] text-[#F50069]',
        )}
      >
        <Icon className="h-[17px] w-[17px]" strokeWidth={2} />
      </span>
      <p className="pt-1 text-[12px] font-semibold leading-snug text-[#17164A]">{title}</p>
    </div>
    <div className="flex items-end justify-between gap-2">
      <p className="font-heading text-[27px] font-extrabold leading-none text-[#17164A]">{value}</p>
      {showLink && (
        <Link to={to} className="mb-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#F50069] hover:underline">
          View bookings <ArrowRight className="h-3 w-3" strokeWidth={2.4} />
        </Link>
      )}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Booking card                                                        */
/* ------------------------------------------------------------------ */

const BookingCard = ({ booking, onOpen }) => {
  const s = STATUS[booking.styleKey] || STATUS.purple;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'mx-auto flex h-[53px] w-[90%] items-center justify-between gap-1.5 rounded-[10px] border-l-[3px] px-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-[0_6px_14px_-10px_rgba(23,22,74,0.45)]',
        s.card,
      )}
      title={`${booking.name} · ${booking.time}`}
    >
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-bold leading-tight text-[#17164A]">{booking.name}</span>
        <span className={cn('mt-0.5 block truncate text-[10px] leading-tight', s.time)}>{booking.time}</span>
      </span>
      <span className={cn('grid h-4 w-4 shrink-0 place-items-center rounded-full text-white', s.dot)}>
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </span>
    </button>
  );
};

/* ------------------------------------------------------------------ */
/* Calendar                                                            */
/* ------------------------------------------------------------------ */

const WeeklyCalendar = ({ bookings = [], status = 'ready', onRetry, onAddBooking, onOpenBooking }) => {
  const [view, setView] = useState('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const date = addDays(WEEK_START, weekOffset * 7 + i);
      return { name: DAY_NAMES[i], date, bookings: bookings.filter((b) => sameDay(b.date, date)) };
    }),
    [weekOffset, bookings],
  );

  const monthBase = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset]);

  const range = useMemo(() => {
    if (view === 'week') return formatRange(weekDays[0].date, weekDays[6].date);
    return monthBase.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }, [view, weekDays, monthBase]);

  const monthCells = useMemo(() => {
    if (view !== 'month') return [];
    const leading = (monthBase.getDay() + 6) % 7; // Monday-first grid
    const gridStart = addDays(monthBase, -leading);
    return Array.from({ length: 42 }, (_, i) => {
      const date = addDays(gridStart, i);
      return {
        date,
        inMonth: date.getMonth() === monthBase.getMonth(),
        bookings: bookings.filter((b) => sameDay(b.date, date)),
      };
    });
  }, [view, monthBase, bookings]);

  // The empty message is a genuine "loaded, and there are none" signal — it must
  // never show while loading or after a failed fetch (those have their own states).
  const weekEmpty = status === 'ready' && view === 'week' && weekDays.every((d) => d.bookings.length === 0);

  const step = (dir) => {
    if (view === 'week') setWeekOffset((n) => n + dir);
    else setMonthOffset((n) => n + dir);
  };

  return (
    <section className="mt-7 flex min-h-[448px] flex-col overflow-hidden rounded-[20px] border border-[#FFD8ED] bg-white shadow-[0_18px_40px_-30px_rgba(245,0,105,0.5)]">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 border-b border-[#FFE1F1] px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[#FFE1F1] text-[#F50069]">
            <CalendarDays className="h-[15px] w-[15px]" strokeWidth={2} />
          </span>
          <h2 className="mb-0 font-heading text-[15px] font-bold text-[#17164A]">Calendar</h2>
        </div>

        <div className="order-3 flex w-full items-center justify-between gap-2 sm:order-none sm:ml-auto sm:w-auto">
          <div className="flex items-center rounded-full border border-[#FFE1F1] bg-white p-0.5">
            {[
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                aria-pressed={view === t.id}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-semibold transition',
                  view === t.id ? 'bg-[#FFE1F1] text-[#F50069]' : 'text-[#71639E] hover:text-[#17164A]',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label={view === 'week' ? 'Previous week' : 'Previous month'}
              className="grid h-7 w-7 place-items-center rounded-full border border-[#FFE1F1] text-[#71639E] transition hover:bg-[#FFF0F8] hover:text-[#F50069]"
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
            <span className="min-w-[128px] text-center text-[11.5px] font-semibold text-[#17164A] sm:min-w-[150px]">
              {range}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label={view === 'week' ? 'Next week' : 'Next month'}
              className="grid h-7 w-7 place-items-center rounded-full border border-[#FFE1F1] text-[#71639E] transition hover:bg-[#FFF0F8] hover:text-[#F50069]"
            >
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.2} />
            </button>
          </div>
        </div>

        <button
          type="button"
          aria-label="Calendar view"
          className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[#FFE1F1] text-[#71639E] transition hover:bg-[#FFF0F8] hover:text-[#F50069] sm:ml-0"
        >
          <LayoutGrid className="h-[15px] w-[15px]" strokeWidth={1.9} />
        </button>
      </div>

      {/* Grid */}
      <div className="dash-noscrollbar relative min-h-0 flex-1 overflow-x-auto">
        {status === 'loading' && (
          <div className="pointer-events-none absolute inset-x-0 top-[46%] z-10 flex flex-col items-center px-4 text-center" aria-live="polite">
            <CalendarDays className="h-6 w-6 animate-pulse text-[#E6A8C8]" strokeWidth={1.7} />
            <p className="mt-2 text-[13px] font-semibold text-[#71639E]">Loading your bookings…</p>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-x-0 top-[42%] z-10 flex flex-col items-center px-4 text-center" aria-live="polite">
            <CalendarDays className="h-6 w-6 text-[#E6A8C8]" strokeWidth={1.7} />
            <p className="mt-2 text-[13px] font-semibold text-[#17164A]">Couldn't load your bookings</p>
            <p className="mt-0.5 text-[11.5px] text-[#71639E]">Check your connection and try again.</p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#F50069] to-[#D90059] px-3.5 py-1.5 text-[11.5px] font-semibold text-white transition hover:brightness-[1.04]"
              >
                Try again
              </button>
            )}
          </div>
        )}
        {weekEmpty && (
          <div className="pointer-events-none absolute inset-x-0 top-[46%] z-10 flex flex-col items-center px-4 text-center">
            <CalendarDays className="h-6 w-6 text-[#E6A8C8]" strokeWidth={1.7} />
            <p className="mt-2 text-[13px] font-semibold text-[#17164A]">No bookings this week</p>
            <p className="mt-0.5 text-[11.5px] text-[#71639E]">New bookings will appear here automatically.</p>
          </div>
        )}
        {view === 'week' ? (
          <div className="grid h-full min-w-[900px] grid-cols-7 xl:min-w-0">
            {weekDays.map((day) => (
              <div key={day.name} className="flex min-h-[360px] flex-col border-r border-[#FFE8F3] px-1.5 pb-3 pt-3 last:border-r-0">
                <div className="text-center">
                  <p className="text-[11px] font-medium text-[#8D7FB5]">{day.name}</p>
                  <p className="mt-0.5 font-heading text-[22px] font-extrabold leading-none text-[#17164A]">
                    {day.date.getDate()}
                  </p>
                  <button
                    type="button"
                    onClick={onAddBooking}
                    className="mt-1.5 inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-[#F50069] transition hover:text-[#D90059]"
                  >
                    <Plus className="h-3 w-3" strokeWidth={2.6} /> Add booking
                  </button>
                </div>

                <div className="mt-3 space-y-2.5">
                  {day.bookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} onOpen={onOpenBooking} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="min-w-[900px] xl:min-w-0">
            <div className="grid grid-cols-7 border-b border-[#FFE8F3]">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-1.5 text-center text-[10px] font-semibold text-[#8D7FB5]">{d.slice(0, 3)}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthCells.map(({ date, inMonth, bookings }) => (
                <div
                  key={date.toISOString()}
                  className={cn(
                    'min-h-[58px] border-b border-r border-[#FFE8F3] p-1 last:border-r-0',
                    !inMonth && 'bg-[#FFF7FB]/60',
                  )}
                >
                  <p className={cn('text-[10px] font-semibold', inMonth ? 'text-[#71639E]' : 'text-[#C9BEDF]')}>
                    {date.getDate()}
                  </p>
                  <div className="mt-0.5 space-y-0.5">
                    {bookings.slice(0, 2).map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={onOpenBooking}
                        className={cn('block w-full truncate rounded px-1 py-0.5 text-left text-[8px] font-semibold text-[#17164A]', (STATUS[b.styleKey] || STATUS.purple).card)}
                        title={`${b.name} · ${b.time}`}
                      >
                        {b.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

const Dashboard = () => {
  const { user, updateUser } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isHost = user?.is_host === true || user?.role === 'host';
  const { openNewMeeting } = useOverviewChrome();

  const [balance, setBalance] = useState(null);
  const [balanceStatus, setBalanceStatus] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [rawBookings, setRawBookings] = useState([]);
  const [bookingsStatus, setBookingsStatus] = useState('loading'); // 'loading' | 'ready' | 'error'

  // Real host bookings. We track load status explicitly so an API FAILURE is
  // never mistaken for a genuinely-empty calendar (the empty state + 0 counts
  // show only once a request SUCCEEDS with no rows). Retryable from the UI.
  const loadBookings = useCallback(() => {
    setBookingsStatus('loading');
    getHostBookings()
      .then(({ data }) => { setRawBookings(Array.isArray(data) ? data : []); setBookingsStatus('ready'); })
      .catch(() => { setRawBookings([]); setBookingsStatus('error'); });
  }, []);

  useEffect(() => {
    if (!isHost) return;
    // DEV-only UI preview: show sample payout + bookings WITHOUT touching the
    // API. Gated on the flag; never a fallback on a real API failure.
    if (isPreviewEnabled()) {
      setBalance(getPreviewPayoutBalance());
      setBalanceStatus('ready');
      setRawBookings(getPreviewBookings() || []);
      setBookingsStatus('ready');
      return;
    }
    setBalanceStatus('loading');
    getPayoutBalance()
      .then(({ data }) => { setBalance(data); setBalanceStatus('ready'); })
      .catch(() => setBalanceStatus('error'));
    loadBookings();
  }, [isHost, loadBookings]);

  // Calendar view-models (cancelled bookings aren't shown on the calendar).
  const calendarBookings = useMemo(
    () => rawBookings.filter((b) => String(b.status || '').toLowerCase() !== 'cancelled').map(toCalendarBooking),
    [rawBookings],
  );

  // Counts from real data: upcoming = not-cancelled & still in the future;
  // completed = status 'completed'.
  const { upcomingCount, completedCount } = useMemo(() => {
    const now = Date.now();
    return {
      upcomingCount: rawBookings.filter(
        (b) => String(b.status || '').toLowerCase() !== 'cancelled' && +new Date(b.scheduled_at) > now,
      ).length,
      completedCount: rawBookings.filter((b) => String(b.status || '').toLowerCase() === 'completed').length,
    };
  }, [rawBookings]);

  // Google-calendar return toast (preserved from the previous dashboard).
  useEffect(() => {
    const g = searchParams.get('google');
    if (g === 'connected') {
      toast.success('Google Calendar connected!');
      updateUser({ google_calendar_connected: true });
      window.history.replaceState({}, '', '/dashboard');
    } else if (g === 'denied') {
      toast.error("Calendar access wasn't granted. Tick the calendar boxes on Google's screen and try again.");
      window.history.replaceState({}, '', '/dashboard');
    } else if (g === 'error') {
      toast.error('Failed to connect Google Calendar.');
      window.history.replaceState({}, '', '/dashboard');
    }
  }, [searchParams, updateUser]);

  if (!isHost) return <Navigate to="/user" replace />;

  const displayName = user?.name || 'Mohini Daf';
  const firstName = displayName.trim().split(/\s+/)[0] || 'Mohini';

  // A count is a real figure only once bookings have loaded; otherwise '—' so an
  // unavailable backend is never shown as a genuine 0.
  const countValue = (n) => (bookingsStatus === 'ready' ? n : '—');

  return (
    <div>
      {/* Profile completion now lives in a toolbar hover popover (OverviewLayout),
          so the overview content is a single column — no layout shift. */}
      <Greeting firstName={firstName} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[540px_minmax(0,1fr)_minmax(0,1fr)]">
        <WithdrawCard balance={balance} status={balanceStatus} />
        <CountCard
          title="Upcoming bookings"
          value={countValue(upcomingCount)}
          to="/dashboard/bookings"
          tone="pink"
          Icon={CalendarDays}
          showLink
        />
        <CountCard
          title="Completed bookings"
          value={countValue(completedCount)}
          to="/dashboard/bookings"
          tone="green"
          Icon={CheckCircle2}
        />
      </div>

      <WeeklyCalendar
        bookings={calendarBookings}
        status={bookingsStatus}
        onRetry={loadBookings}
        onAddBooking={openNewMeeting}
        onOpenBooking={() => navigate('/dashboard/bookings')}
      />
    </div>
  );
};

export default Dashboard;
