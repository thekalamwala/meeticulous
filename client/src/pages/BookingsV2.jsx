// Bookings — the host's calendar of bookings, in the Kept direction (approved
// 2026-11-25; page plan "Bookings": borrow Calendly's "Scheduled events" and
// Google Calendar). REAL getHostBookings data only. Shown on the dashboard_v2
// path (App picks it in BookingsRoute).
//
// One layout for phone and desktop (founder, 2026-11-25). Top to bottom: the band
// (what's next, as a sentence from real figures), the view controls, then the
// bookings grouped by day. List = Upcoming / Past tabs (founder pick). Week and
// Month = a day strip or month grid; tap a day to list it below (founder pick: a
// 7-column time grid is unreadable on a phone).
//
// The booking detail is the shared BookingDetail in the side Drawer (full screen
// on a phone) with the actions pinned in its footer. Every action keeps the v1
// handlers and their confirmation copy: complete / no-show / cancel call the same
// API, reschedule is v1's RescheduleModal, review is the same ReviewModal. There
// is no host "confirm": 'pending' means the guest hasn't paid yet
// (bookingController creates paid bookings as pending), so the row says
// "Awaiting payment" and nothing offers to confirm it.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Copy, List, Search, SlidersHorizontal, Star, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getHostBookings, getBookingReview, completeBooking, markNoShow, cancelBooking, markLinkShared,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import useFeatureFlags from '../hooks/useFeatureFlags';
import { isFreePlan } from '../utils/themeUtils';
import { useRegisterRefresh } from '../components/dashboard/ui/refreshContext';
import { ErrorState, Skeleton } from '../components/dashboard/ui';
import {
  Drawer, InsightBand, MeetIcon, PageHeading, StatusPill, WhatsAppIcon, cn, fmtTime, inr, useLast,
} from '../components/dashboard/ui/v2';
import BookingDetail from '../components/dashboard/BookingDetail';
import ReviewModal from '../components/booking/ReviewModal';
import { RescheduleModal } from './Bookings';
import { focusBooking, whenWord } from './TodayV2';

const DAY = 86_400_000;
const lower = (s) => String(s || '').toLowerCase();
const amountOf = (b) => Number(b.customer_total ?? b.amount ?? 0) || 0;
const TERMINAL = ['cancelled', 'completed', 'no_show'];
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const mondayOf = (d) => addDays(startOfDay(d), -((d.getDay() + 6) % 7));
const waLink = (phone) => { const d = (phone || '').replace(/\D/g, ''); return d ? `https://wa.me/${d}` : null; };
const serif = 'font-serif font-normal italic text-pink';
const SHARE_KEY = 'mt_golive_link_shared'; // same key Today and GoLiveChecklist read

/* ── Pure helpers (tested in tests/bookingsV2.test.js) ─────────────────── */

// Same clock as Today and BookingDetail: start + the service's duration.
export const endOf = (b) => new Date(new Date(b.scheduled_at).getTime() + (Number(b.services?.duration) || 30) * 60_000);

// "Today", "Tomorrow", "Yesterday", else "Fri, 28 Nov" (year added when it isn't this year).
export const dayLabel = (date, now = new Date()) => {
  const days = Math.round((startOfDay(date) - startOfDay(now)) / DAY);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return date.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', ...(date.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });
};

// Consecutive runs of the same calendar day, in the order given.
export const groupByDay = (rows) => {
  const out = [];
  for (const b of rows) {
    const date = startOfDay(new Date(b.scheduled_at));
    const last = out[out.length - 1];
    if (last && sameDay(last.date, date)) last.items.push(b);
    else out.push({ key: date.toISOString(), date, items: [b] });
  }
  return out;
};

// Upcoming = not over yet, soonest first. Past = over, newest first.
export const splitByTime = (bookings, now = new Date()) => {
  const withDate = bookings.filter((b) => b.scheduled_at);
  const by = (dir) => (a, b) => dir * (new Date(a.scheduled_at) - new Date(b.scheduled_at));
  return {
    upcoming: withDate.filter((b) => endOf(b) > now).sort(by(1)),
    past: withDate.filter((b) => endOf(b) <= now).sort(by(-1)),
  };
};

// What the money on a booking is doing, as one key StatusPill knows (or 'free').
export const payKey = (b) => {
  if (!amountOf(b)) return 'free';
  const p = lower(b.payment_status);
  if (p === 'paid' || p === 'refunded') return p;
  if (p === 'failed') return 'failed';
  return 'unpaid';
};

// The words on a row. A confirmed booking only shows its payment; any other state
// leads with the state. 'pending' already says the money, so it stands alone.
export const rowPills = (b) => {
  const s = lower(b.status);
  if (s === 'pending') return [{ key: 'pending', word: 'Awaiting payment' }];
  const pay = payKey(b);
  const payPill = pay === 'free' ? { key: 'free', word: 'Free' } : pay === 'failed' ? { key: 'failed', word: 'Payment failed' } : { key: pay };
  if (s === 'confirmed' || !s) return [payPill];
  if (s === 'cancelled') return pay === 'refunded' ? [{ key: 'cancelled' }, payPill] : [{ key: 'cancelled' }];
  return [{ key: s }, payPill];
};

export const STATUS_OPTIONS = [
  { value: 'all', label: 'Any status' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'pending', label: 'Awaiting payment' },
  { value: 'completed', label: 'Done' },
  { value: 'no_show', label: 'No-show' },
  { value: 'cancelled', label: 'Cancelled' },
];
export const PAY_OPTIONS = [
  { value: 'all', label: 'Any payment' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'free', label: 'Free' },
  { value: 'refunded', label: 'Refunded' },
];

export const matchesFilter = (b, { q = '', status = 'all', pay = 'all' } = {}) => {
  if (status !== 'all' && lower(b.status) !== status) return false;
  if (pay !== 'all') {
    const k = payKey(b);
    if (pay === 'unpaid' ? !(k === 'unpaid' || k === 'failed') : k !== pay) return false;
  }
  const needle = q.trim().toLowerCase();
  return !needle || `${b.guest_name || ''} ${b.guest_email || ''} ${b.guest_phone || ''} ${b.services?.title || ''}`.toLowerCase().includes(needle);
};

// The band's sentence: what's left today, the week ahead, and money still owed.
export const bandLine = (bookings, now = new Date()) => {
  // Not started yet: the booking on now is the band's title, not "still to come".
  const live = bookings.filter((b) => b.scheduled_at && lower(b.status) !== 'cancelled' && new Date(b.scheduled_at) > now);
  const today = live.filter((b) => sameDay(new Date(b.scheduled_at), now)).length;
  const week = live.filter((b) => new Date(b.scheduled_at) < addDays(startOfDay(now), 7)).length;
  const awaiting = live.filter((b) => lower(b.status) === 'pending').length;
  const parts = [
    today ? `${today} still to come today` : 'Nothing else today',
    `${week} in the next 7 days`,
  ];
  let line = `${parts.join(', ')}.`;
  if (awaiting) line += ` ${awaiting} ${awaiting === 1 ? 'is' : 'are'} waiting on payment.`;
  return line;
};

/* ── Band — the page's one focal card. ─────────────────────────────────── */
const bandBtn = 'inline-flex h-11 items-center gap-2 rounded-[12px] px-4 sm:px-5 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink';
const BandPrimary = ({ children, ...p }) => <button type="button" className={cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100')} {...p}>{children}</button>;
const BandGhost = ({ children, href, ...p }) => (href
  ? <a href={href} target="_blank" rel="noreferrer" className={cn(bandBtn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60')}>{children}</a>
  : <button type="button" className={cn(bandBtn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60')} {...p}>{children}</button>);

const BookingsBand = ({ bookings, onOpen, onCopy, username }) => {
  const now = new Date();
  const focus = focusBooking(bookings, now);
  if (!focus) {
    const url = username ? `${window.location.origin}/${username}` : null;
    const share = url ? `https://wa.me/?text=${encodeURIComponent(`Book a session with me: ${url}`)}` : null;
    return (
      <InsightBand mascot="blue" compact eyebrow={bookings.length ? 'Nothing coming up' : 'No bookings yet'}
        title={<>Your calendar is open. <em className={serif}>Let&apos;s fill it.</em></>}
        sub="Put your booking link where your audience already is: bio, WhatsApp status, email signature."
        actions={(
          <>
            <BandPrimary onClick={onCopy}><Copy className="h-4 w-4" strokeWidth={2.4} /> Copy booking link</BandPrimary>
            {share && <BandGhost href={share}><WhatsAppIcon className="h-4 w-4" /> Share on WhatsApp</BandGhost>}
          </>
        )} />
    );
  }
  const b = focus.booking;
  const eyebrow = focus.phase === 'now'
    ? `On now · until ${fmtTime(endOf(b).toISOString())}`
    : `Next booking · ${sameDay(new Date(b.scheduled_at), now) ? 'today' : whenWord(b.scheduled_at, now)}`;
  const wa = waLink(b.guest_phone);
  return (
    <InsightBand mascot="blue" compact eyebrow={eyebrow}
      title={<>{b.guest_name || 'Guest'} <em className={serif}>at {fmtTime(b.scheduled_at)}</em></>}
      sub={bandLine(bookings, now)}
      actions={(
        <>
          {b.meeting_link
            ? <BandPrimary onClick={() => window.open(b.meeting_link, '_blank', 'noopener')}><MeetIcon className="h-4 w-4" /> Join call</BandPrimary>
            : <BandPrimary onClick={() => onOpen(b.id)}>Open booking <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandPrimary>}
          {b.meeting_link
            ? <BandGhost onClick={() => onOpen(b.id)}>Details</BandGhost>
            : wa && <BandGhost href={wa}><WhatsAppIcon className="h-4 w-4" /> WhatsApp</BandGhost>}
        </>
      )} />
  );
};

/* ── Controls ──────────────────────────────────────────────────────────── */
const ring = 'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
const Seg = ({ label, value, onChange, options }) => (
  <div role="tablist" aria-label={label} className="flex w-fit max-w-full gap-1 rounded-[14px] bg-white p-1">
    {options.map((o) => {
      const on = o.value === value;
      return (
        <button key={o.value} type="button" role="tab" aria-selected={on} onClick={() => onChange(o.value)}
          className={cn('inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 text-[13.5px] font-semibold transition', ring,
            on ? 'bg-maroon text-white' : 'text-muted hover:bg-blush hover:text-maroon')}>
          {o.icon && <o.icon className="h-4 w-4" strokeWidth={2.2} />}
          {o.label}
          {o.count != null && <span className={cn('rounded-[6px] px-1.5 text-[12px] tabular-nums', on ? 'bg-white/20' : 'bg-cream')}>{o.count}</span>}
        </button>
      );
    })}
  </div>
);

const navBtn = cn('grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-white text-maroon transition hover:bg-pink-100', ring);

const VIEWS = [
  { value: 'list', label: 'List', icon: List },
  { value: 'week', label: 'Week', icon: CalendarDays },
  { value: 'month', label: 'Month', icon: CalendarRange },
];

/* ── Rows + day cards ──────────────────────────────────────────────────── */
const Pills = ({ b }) => rowPills(b).map((p) => <StatusPill key={p.key} status={p.key}>{p.word}</StatusPill>);

const BookingRow = ({ b, now, onOpen, meetCol }) => {
  const start = new Date(b.scheduled_at);
  const end = endOf(b);
  const over = end <= now;
  const cancelled = lower(b.status) === 'cancelled';
  const onNow = !TERMINAL.includes(lower(b.status)) && start <= now && end > now;
  const quiet = over || cancelled;
  const mins = Math.round((end - start) / 60_000);
  const canJoin = b.meeting_link && !over && !cancelled;
  return (
    <li className="relative hidden items-center gap-4 px-6 py-3.5 transition hover:bg-pink-50 sm:flex">
      {/* The whole row opens the booking (stretched button); the Meet link sits above it. */}
      <button type="button" onClick={() => onOpen(b.id)}
        aria-label={`${b.guest_name || 'Guest'}, ${fmtTime(b.scheduled_at)}, ${b.services?.title || 'Booking'}`}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-rose" />
      <span className="pointer-events-none flex w-[72px] shrink-0 flex-col">
        <span className={cn('font-display text-[16px] font-extrabold tabular-nums tracking-[-0.02em]', quiet ? 'text-muted' : 'text-maroon')}>{fmtTime(b.scheduled_at)}</span>
        <span className={cn('text-[12.5px]', onNow ? 'font-semibold text-maroon' : 'text-faint')}>{onNow ? 'On now' : `${mins} min`}</span>
      </span>
      <span className="pointer-events-none min-w-0 flex-1">
        <span className={cn('block truncate text-[15px] font-semibold', quiet ? 'text-muted' : 'text-ink')}>{b.guest_name || 'Guest'}</span>
        <span className="block truncate text-[13px] text-muted">{b.services?.title || 'Booking'}</span>
      </span>
      <span className="pointer-events-none flex shrink-0 gap-1.5"><Pills b={b} /></span>
      {canJoin ? (
        <a href={b.meeting_link} target="_blank" rel="noreferrer" aria-label={`Join Google Meet with ${b.guest_name || 'guest'}`}
          className={cn('relative grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-cream transition hover:bg-blush', ring)}>
          <MeetIcon className="h-5 w-5" />
        </a>
      ) : meetCol && <span aria-hidden="true" className="w-10 shrink-0" />}
    </li>
  );
};

/* Phone: its own row, not the desktop row squeezed (founder call, 2026-11-25).
 * Agenda pattern (iOS Calendar / Google Calendar app): a state rail on the left,
 * the time range and the state as words on line one, the guest large, the
 * service under it, and a 44px Join button. Same content as the desktop row. */
const WORD = { confirmed: 'Confirmed', completed: 'Done', paid: 'Paid', unpaid: 'Unpaid', refunded: 'Refunded', cancelled: 'Cancelled', no_show: 'No-show' };
const TONE = { // text colour of the state words, and the rail beside them
  paid: ['text-success-fg', 'bg-maroon'], free: ['text-muted', 'bg-maroon'], confirmed: ['text-maroon', 'bg-maroon'],
  pending: ['text-warning-fg', 'bg-warning-fg'], unpaid: ['text-warning-fg', 'bg-warning-fg'], failed: ['text-error-fg', 'bg-error-fg'],
  completed: ['text-success-fg', 'bg-neutral-200'], cancelled: ['text-muted', 'bg-neutral-200'], refunded: ['text-muted', 'bg-neutral-200'],
  no_show: ['text-error-fg', 'bg-error-fg'],
};
const PhoneRow = ({ b, now, onOpen }) => {
  const start = new Date(b.scheduled_at);
  const end = endOf(b);
  const over = end <= now;
  const cancelled = lower(b.status) === 'cancelled';
  const onNow = !TERMINAL.includes(lower(b.status)) && start <= now && end > now;
  const canJoin = b.meeting_link && !over && !cancelled;
  const pills = rowPills(b);
  const [tone, rail] = TONE[pills[0].key] || TONE.confirmed;
  return (
    <li className={cn('relative flex items-center gap-3 py-3 pl-4 pr-3 transition active:bg-pink-50', onNow && 'bg-pink-50')}>
      <button type="button" onClick={() => onOpen(b.id)}
        aria-label={`${b.guest_name || 'Guest'}, ${fmtTime(b.scheduled_at)}, ${b.services?.title || 'Booking'}, ${pills.map((p) => p.word || WORD[p.key]).join(', ')}`}
        className="absolute inset-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-rose" />
      <span aria-hidden="true" className={cn('w-1 self-stretch rounded-full', over && !onNow ? 'bg-neutral-200' : rail)} />
      <span className="pointer-events-none min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2 text-[13px]">
          <span className="truncate tabular-nums text-muted">
            {onNow && <span className="font-semibold text-maroon">On now · </span>}
            {fmtTime(b.scheduled_at)} – {fmtTime(end.toISOString())}
          </span>
          <span className={cn('shrink-0 font-semibold', tone)}>{pills.map((p) => p.word || WORD[p.key]).join(' · ')}</span>
        </span>
        <span className={cn('mt-0.5 block truncate text-[16px] font-semibold leading-snug', over || cancelled ? 'text-muted' : 'text-ink')}>{b.guest_name || 'Guest'}</span>
        <span className="block truncate text-[14px] text-muted">{b.services?.title || 'Booking'}</span>
      </span>
      {canJoin && (
        <a href={b.meeting_link} target="_blank" rel="noreferrer" aria-label={`Join Google Meet with ${b.guest_name || 'guest'}`}
          className={cn('relative grid h-11 w-11 shrink-0 place-items-center rounded-[12px] bg-cream transition active:bg-blush', ring)}>
          <MeetIcon className="h-5 w-5" />
        </a>
      )}
    </li>
  );
};

const card = 'overflow-hidden rounded-[24px] bg-white';
const DayCard = ({ date, items, now, onOpen }) => {
  const meetCol = items.some((b) => b.meeting_link && endOf(b) > now && lower(b.status) !== 'cancelled');
  const label = dayLabel(date, now);
  const count = items.length > 1 && <span className="shrink-0 text-[13px] text-faint">{items.length} bookings</span>;
  // "Today" / "Tomorrow" on a phone also carry the date, since there is no calendar beside them.
  const phoneLabel = /^(Today|Tomorrow|Yesterday)$/.test(label)
    ? <>{label} <span className="font-sans text-[14px] font-medium text-faint">{date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span></>
    : label;
  return (
    <section aria-label={label}>
      {/* Phone: a grouped-list section header above the card. */}
      <header className="flex items-baseline justify-between gap-3 px-1 pb-2 sm:hidden">
        <h2 className="mb-0 font-display text-[17px] font-bold tracking-[-0.02em] text-ink">{phoneLabel}</h2>
        {count}
      </header>
      <div className={card}>
        <header className="hidden items-baseline justify-between gap-3 px-6 pb-2 pt-5 sm:flex">
          <h2 className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">{label}</h2>
          {count}
        </header>
        <ul className="divide-y divide-neutral-100 sm:hidden">
          {items.map((b) => <PhoneRow key={b.id} b={b} now={now} onOpen={onOpen} />)}
        </ul>
        <ul className="hidden divide-y divide-neutral-100 sm:block">
          {items.map((b) => <BookingRow key={b.id} b={b} now={now} onOpen={onOpen} meetCol={meetCol} />)}
        </ul>
      </div>
    </section>
  );
};

const Note = ({ children }) => <div className={cn(card, 'px-5 py-6 text-[14px] text-muted sm:px-6')}>{children}</div>;

/* ── Week strip + month grid: pick a day, its bookings list below. ─────── */
const Dots = ({ n, on }) => (
  <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
    {Array.from({ length: Math.min(n, 3) }, (_, i) => <span key={i} className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-white' : 'bg-maroon')} />)}
  </span>
);
const dayAria = (date, n) => `${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}: ${n} booking${n === 1 ? '' : 's'}`;
const dayBtn = (on, isToday) => cn('flex flex-col items-center justify-center gap-1 rounded-[12px] transition', ring,
  on ? 'bg-maroon text-white' : isToday ? 'bg-blush text-maroon hover:bg-pink-100' : 'text-ink hover:bg-pink-50');

const WeekStrip = ({ day, setDay, countOn, now }) => {
  const monday = mondayOf(day);
  return (
    <div className={cn(card, 'grid grid-cols-7 gap-1 p-2 sm:p-3')}>
      {Array.from({ length: 7 }, (_, i) => {
        const date = addDays(monday, i);
        const on = sameDay(date, day);
        const n = countOn(date);
        return (
          <button key={i} type="button" onClick={() => setDay(date)} aria-pressed={on} aria-label={dayAria(date, n)} className={cn(dayBtn(on, sameDay(date, now)), 'py-2.5')}>
            <span className={cn('text-[12px] font-medium', on ? 'text-white/80' : 'text-faint')}>{date.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
            <span className="font-display text-[18px] font-extrabold tabular-nums leading-none sm:text-[20px]">{date.getDate()}</span>
            <Dots n={n} on={on} />
          </button>
        );
      })}
    </div>
  );
};

const MonthGrid = ({ day, setDay, countOn, now }) => {
  const first = new Date(day.getFullYear(), day.getMonth(), 1);
  const gridStart = mondayOf(first);
  return (
    <div className={cn(card, 'p-2 sm:p-4')}>
      <div className="grid grid-cols-7 gap-1 pb-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d} className="py-1 text-center text-[12px] font-medium text-faint">{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 42 }, (_, i) => {
          const date = addDays(gridStart, i);
          const inMonth = date.getMonth() === first.getMonth();
          const on = sameDay(date, day);
          const n = countOn(date);
          return (
            <button key={i} type="button" onClick={() => setDay(date)} aria-pressed={on} aria-label={dayAria(date, n)}
              className={cn(dayBtn(on, sameDay(date, now)), 'h-12 sm:h-14', !inMonth && !on && 'text-ink/30')}>
              <span className="text-[14px] font-semibold tabular-nums">{date.getDate()}</span>
              <Dots n={n} on={on} />
            </button>
          );
        })}
      </div>
    </div>
  );
};

/* ── Detail drawer: earnings + the pinned actions. ─────────────────────── */
const Earnings = ({ b, freePlan }) => {
  const mine = b.vendor_amount != null && amountOf(b) > 0 ? Number(b.vendor_amount) : null;
  const commission = Number(b.commission_applied) || 0;
  const resched = b.reschedule_status && b.reschedule_status !== 'none'
    ? (b.reschedule_status === 'acknowledged' ? 'The guest has seen the new time.' : 'Waiting for the guest to see the new time.') : null;
  if (mine == null && !resched) return null;
  return (
    <section className="mt-3 rounded-[20px] bg-white p-4 sm:p-5">
      {mine != null && (
        <>
          <h3 className="mb-1 font-display text-[16px] font-bold tracking-[-0.02em] text-ink">Your earnings</h3>
          <p className="mb-0 text-[14.5px] text-ink"><span className="font-semibold">{inr(mine)}</span> <span className="text-muted">to you from this booking</span></p>
          {/* Same upgrade nudge as v1: a free host just paid commission on this booking. */}
          {freePlan && commission > 0 && (
            <Link to="/dashboard/upgrade?src=booking_commission"
              className={cn('mt-3 flex items-center justify-between gap-3 rounded-[12px] bg-cream px-3 py-2.5 text-[13.5px] text-muted transition hover:bg-blush', ring)}>
              <span><span className="font-semibold text-maroon">{inr(Math.round(commission))}</span> went to the platform (5%). Pro charges 0%.</span>
              <span className="shrink-0 font-semibold text-maroon">Upgrade</span>
            </Link>
          )}
        </>
      )}
      {resched && <p className={cn('mb-0 text-[13.5px] text-muted', mine != null && 'mt-3')}>Rescheduled. {resched}</p>}
    </section>
  );
};

const actBtn = cn('inline-flex h-11 min-w-[120px] flex-1 items-center justify-center gap-2 rounded-[12px] px-4 text-[14px] font-semibold transition disabled:opacity-60', ring);
const primary = 'bg-maroon text-white hover:bg-maroon-dark';
const quiet = 'bg-cream text-maroon hover:bg-blush';

const BookingActions = ({ b, review, reviewsOn, onReschedule, onReview, onDone }) => {
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const s = lower(b.status);
  const future = new Date(b.scheduled_at) > new Date();
  const terminal = TERMINAL.includes(s);

  // v1's doAction, unchanged: same endpoints, same toasts.
  const doAction = async (action) => {
    setBusy(true);
    try {
      if (action === 'complete') { await completeBooking(b.id); toast.success('Marked as completed'); }
      if (action === 'no_show') { await markNoShow(b.id); toast.success('Marked as no-show'); }
      if (action === 'cancel') { await cancelBooking(b.id); toast.success('Booking cancelled'); }
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setBusy(false); setConfirming(null); }
  };

  if (confirming) {
    const ask = confirming === 'cancel'
      ? lower(b.payment_status) === 'paid'
        ? 'Cancel this paid booking? The guest will be notified. Cancelling does not refund automatically, so process any refund yourself.'
        : 'Cancel this booking? The guest will be notified.'
      : confirming === 'no_show' ? 'Mark this booking as a no-show?' : 'Mark this booking as done?';
    return (
      <div className="flex flex-col gap-3">
        <p className="mb-0 text-[14px] font-medium text-ink">{ask}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfirming(null)} className={cn(actBtn, quiet)}>Back</button>
          <button type="button" onClick={() => doAction(confirming)} disabled={busy}
            className={cn(actBtn, confirming === 'cancel' ? 'bg-error-fg text-white hover:opacity-90' : primary)}>
            {busy ? 'Working…' : confirming === 'cancel' ? 'Yes, cancel' : confirming === 'no_show' ? 'Yes, no-show' : 'Yes, mark done'}
          </button>
        </div>
      </div>
    );
  }

  const canReview = s === 'completed' && reviewsOn && b.guest_id;
  const reviewed = !!review?.rating;
  const buttons = [
    s === 'confirmed' && !future && <button key="done" type="button" onClick={() => setConfirming('complete')} className={cn(actBtn, primary)}>Mark done</button>,
    s === 'confirmed' && !future && <button key="ns" type="button" onClick={() => setConfirming('no_show')} className={cn(actBtn, quiet)}>No-show</button>,
    s === 'confirmed' && future && <button key="rs" type="button" onClick={onReschedule} className={cn(actBtn, quiet)}>Reschedule</button>,
    !terminal && <button key="cx" type="button" onClick={() => setConfirming('cancel')} className={cn(actBtn, 'bg-cream text-error-fg hover:bg-error-bg')}>Cancel booking</button>,
    canReview && !reviewed && <button key="rv" type="button" onClick={onReview} className={cn(actBtn, primary)}><Star className="h-4 w-4" strokeWidth={2.4} /> Review guest</button>,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-2.5">
      {canReview && reviewed && (
        <p className="mb-0 flex flex-wrap items-center gap-x-2 text-[13.5px] text-muted">
          <span>You reviewed this guest</span>
          <span className="tracking-tight text-maroon" aria-label={`${review.rating} out of 5`}>{'★'.repeat(review.rating)}<span className="text-ink/25">{'★'.repeat(5 - review.rating)}</span></span>
          <button type="button" onClick={onReview} className={cn('rounded-[8px] px-1 font-semibold text-maroon hover:bg-pink-100', ring)}>Edit</button>
        </p>
      )}
      {buttons.length > 0 && <div className="flex flex-wrap gap-2">{buttons}</div>}
      {buttons.length === 0 && !(canReview && reviewed) && (
        <p className="mb-0 text-[13.5px] text-muted">Nothing to do on a {s === 'no_show' ? 'no-show' : s === 'completed' ? 'finished' : s} booking.</p>
      )}
      {b.guest_id && (
        <Link to={`/dashboard/clients/${b.guest_id}`} className={cn('inline-flex items-center justify-center gap-1 self-center rounded-[10px] px-2 py-1 text-[13.5px] font-semibold text-maroon transition hover:bg-pink-100', ring)}>
          Client profile <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
        </Link>
      )}
    </div>
  );
};

/* ── Filter sheet ──────────────────────────────────────────────────────── */
const Choice = ({ label, options, value, onChange }) => (
  <fieldset className="mb-6">
    <legend className="mb-2 font-display text-[16px] font-bold tracking-[-0.02em] text-ink">{label}</legend>
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={cn('h-10 rounded-[12px] px-3.5 text-[14px] font-semibold transition', ring,
            value === o.value ? 'bg-maroon text-white' : 'bg-cream text-ink hover:bg-blush')}>
          {o.label}
        </button>
      ))}
    </div>
  </fieldset>
);

/* ── Page ──────────────────────────────────────────────────────────────── */
const PAGE = 40; // past rows per "Show more"

const BookingsV2 = () => {
  const { user } = useAuth();
  const { on } = useFeatureFlags();
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState({});
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [view, setView] = useState('list');
  const [tab, setTab] = useState('upcoming');
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState({ status: 'all', pay: 'all' });
  const [filterOpen, setFilterOpen] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState(null);
  const [rescheduling, setRescheduling] = useState(null);
  const [reviewing, setReviewing] = useState(null);

  const load = useCallback(async () => {
    setStatus((s) => (s === 'ready' ? s : 'loading')); // a refresh keeps the list on screen
    try {
      const { data } = await getHostBookings();
      const list = Array.isArray(data) ? data : [];
      setBookings(list);
      setStatus('ready');
      const done = list.filter((b) => lower(b.status) === 'completed' && b.guest_id);
      Promise.all(done.map((b) => getBookingReview(b.id).then(({ data: r }) => [b.id, r]).catch(() => [b.id, null])))
        .then((pairs) => setReviews(Object.fromEntries(pairs)));
    } catch { setStatus((s) => (s === 'ready' ? s : 'error')); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useRegisterRefresh(load);

  const copyLink = useCallback(async () => {
    if (!user?.username) { toast.error('Set your username first.'); return; }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${user.username}`);
      toast.success('Booking link copied');
      try { localStorage.setItem(SHARE_KEY, '1'); } catch { /* non-persistent is fine */ }
      markLinkShared();
    } catch { toast.error('Could not copy your link.'); }
  }, [user?.username]);

  const now = new Date();
  const filtered = useMemo(() => bookings.filter((b) => matchesFilter(b, { q, ...filter })), [bookings, q, filter]);
  const split = useMemo(() => splitByTime(filtered), [filtered]);
  const countOn = useCallback((date) => filtered.filter((b) => b.scheduled_at && sameDay(new Date(b.scheduled_at), date)).length, [filtered]);
  const dayItems = useMemo(() => filtered.filter((b) => b.scheduled_at && sameDay(new Date(b.scheduled_at), day))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)), [filtered, day]);

  const filterCount = (filter.status !== 'all') + (filter.pay !== 'all');
  const filtering = filterCount > 0 || q.trim() !== '';
  const clearAll = () => { setFilter({ status: 'all', pay: 'all' }); setQ(''); };

  const openBooking = useLast(bookings.find((b) => b.id === openId) || null);
  const step = (dir) => setDay((d) => (view === 'month' ? new Date(d.getFullYear(), d.getMonth() + dir, 1) : addDays(d, dir * 7)));
  const rangeLabel = view === 'month'
    ? day.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : `${mondayOf(day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${addDays(mondayOf(day), 6).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-6">
        <PageHeading title="Bookings" />
        <div className={card}>
          <ErrorState title="We couldn't load your bookings."
            message="Your bookings are safe. This is a problem showing them. Try again." onRetry={load} />
        </div>
      </div>
    );
  }

  const loading = status === 'loading';
  const pastRows = split.past.slice(0, limit);
  const listRows = tab === 'upcoming' ? split.upcoming : pastRows;
  const noneAtAll = !loading && bookings.length === 0;

  const emptyList = () => {
    if (filtering) {
      return (
        <Note>
          No {tab} bookings match your search or filters.{' '}
          <button type="button" onClick={clearAll} className={cn('rounded-[8px] px-1 font-semibold text-maroon hover:bg-pink-100', ring)}>Clear filters</button>
        </Note>
      );
    }
    if (noneAtAll) return <Note>New bookings land here, grouped by day.</Note>;
    return tab === 'upcoming'
      ? <Note>Nothing coming up. Bookings you&apos;ve had are under Past.</Note>
      : <Note>No past bookings yet. They move here once they&apos;re over.</Note>;
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Bookings" />

      {loading ? <Skeleton className="h-[220px] rounded-[28px] sm:rounded-[32px]" />
        : <BookingsBand bookings={bookings} onOpen={setOpenId} onCopy={copyLink} username={user?.username} />}

      {/* Controls: view + search + filter, then the view's own row. 16px inside the group. */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <Seg label="View" value={view} onChange={setView} options={VIEWS} />
          <button type="button" onClick={() => setFilterOpen(true)}
            className={cn('order-2 ml-auto inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-[12px] bg-white px-3 sm:px-4 text-[14px] font-semibold text-ink transition hover:bg-pink-50 sm:order-3 sm:ml-0', ring)}>
            <SlidersHorizontal className="h-4 w-4 text-maroon" strokeWidth={2.2} /><span className="sr-only sm:not-sr-only">Filter</span>
            {filterCount > 0 && <span className="rounded-[8px] bg-maroon px-1.5 text-[12px] tabular-nums text-white">{filterCount}</span>}
          </button>
          <label className="relative order-3 w-full sm:order-2 sm:w-auto sm:min-w-[220px] sm:flex-1">
            <span className="sr-only">Search bookings</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" strokeWidth={2.2} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guest, phone, email or service"
              className="h-11 w-full rounded-[12px] border-0 bg-white pl-10 pr-10 text-[14px] text-ink placeholder:text-faint focus:outline-none focus-visible:ring-[3px] focus-visible:ring-rose [&::-webkit-search-cancel-button]:hidden" />
            {q && (
              <button type="button" onClick={() => setQ('')} aria-label="Clear search"
                className={cn('absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[10px] text-muted hover:bg-blush hover:text-maroon', ring)}>
                <X className="h-4 w-4" strokeWidth={2.2} />
              </button>
            )}
          </label>
        </div>

        {view === 'list' ? (
          <Seg label="When" value={tab} onChange={(t) => { setTab(t); setLimit(PAGE); }} options={[
            { value: 'upcoming', label: 'Upcoming', count: loading ? null : split.upcoming.length },
            { value: 'past', label: 'Past', count: loading ? null : split.past.length },
          ]} />
        ) : (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => step(-1)} aria-label={view === 'month' ? 'Previous month' : 'Previous week'} className={navBtn}><ChevronLeft className="h-4 w-4" strokeWidth={2.4} /></button>
            <span className="min-w-0 flex-1 text-center font-display text-[16px] font-bold tracking-[-0.02em] text-ink sm:flex-none sm:px-2" aria-live="polite">{rangeLabel}</span>
            <button type="button" onClick={() => step(1)} aria-label={view === 'month' ? 'Next month' : 'Next week'} className={navBtn}><ChevronRight className="h-4 w-4" strokeWidth={2.4} /></button>
            <button type="button" onClick={() => setDay(startOfDay(new Date()))}
              className={cn('h-11 shrink-0 rounded-[12px] bg-white px-4 text-[14px] font-semibold text-maroon transition hover:bg-pink-100', ring)}>Today</button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[3, 2].map((n) => (
            <div key={n} className={cn(card, 'flex flex-col gap-4 p-5 sm:p-6')}>
              <Skeleton className="h-5 w-32" />
              {Array.from({ length: n }, (_, i) => <div key={i} className="flex items-center gap-4"><Skeleton className="h-9 w-14" /><Skeleton className="h-9 flex-1" /><Skeleton className="h-6 w-16" /></div>)}
            </div>
          ))}
        </div>
      ) : view === 'list' ? (
        listRows.length === 0 ? emptyList() : (
          <div className="flex flex-col gap-4">
            {groupByDay(listRows).map((g) => <DayCard key={g.key} date={g.date} items={g.items} now={now} onOpen={setOpenId} />)}
            {tab === 'past' && split.past.length > limit && (
              <button type="button" onClick={() => setLimit((l) => l + PAGE)}
                className={cn('h-11 self-center rounded-[12px] bg-white px-5 text-[14px] font-semibold text-maroon transition hover:bg-pink-100', ring)}>
                Show older bookings ({split.past.length - limit} more)
              </button>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-4">
          {view === 'week'
            ? <WeekStrip day={day} setDay={setDay} countOn={countOn} now={now} />
            : <MonthGrid day={day} setDay={setDay} countOn={countOn} now={now} />}
          {dayItems.length
            ? <DayCard date={day} items={dayItems} now={now} onOpen={setOpenId} />
            : <Note>Nothing booked {dayLabel(day, now) === 'Today' ? 'today' : `on ${day.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`}{filtering ? ' that matches your filters' : ''}.</Note>}
        </div>
      )}

      <Drawer open={filterOpen} onClose={() => setFilterOpen(false)} title="Filter bookings" bodyClassName="bg-white"
        footer={(
          <div className="flex gap-2">
            <button type="button" onClick={() => setFilter({ status: 'all', pay: 'all' })} className={cn(actBtn, quiet)}>Clear</button>
            <button type="button" onClick={() => setFilterOpen(false)} className={cn(actBtn, primary)}>Show {filtered.length} booking{filtered.length === 1 ? '' : 's'}</button>
          </div>
        )}>
        <Choice label="Status" options={STATUS_OPTIONS} value={filter.status} onChange={(v) => setFilter((f) => ({ ...f, status: v }))} />
        <Choice label="Payment" options={PAY_OPTIONS} value={filter.pay} onChange={(v) => setFilter((f) => ({ ...f, pay: v }))} />
      </Drawer>

      <Drawer open={!!openId && !!openBooking} onClose={() => setOpenId(null)} title="Booking details" bodyClassName="bg-cream"
        footer={openBooking && (
          <BookingActions key={openBooking.id} b={openBooking} review={reviews[openBooking.id] || null} reviewsOn={on('review_submission')}
            onReschedule={() => { setOpenId(null); setRescheduling(openBooking); }}
            onReview={() => { setOpenId(null); setReviewing(openBooking); }}
            onDone={() => { setOpenId(null); load(); }} />
        )}>
        {openBooking && (
          <>
            <BookingDetail booking={openBooking} bookings={bookings} />
            <Earnings b={openBooking} freePlan={isFreePlan(user?.plan)} />
          </>
        )}
      </Drawer>

      {/* Drawer sits above modals (z-101 vs 100), so it closes before these open. */}
      {rescheduling && (
        <RescheduleModal booking={rescheduling} onClose={() => setRescheduling(null)}
          onDone={() => { setRescheduling(null); load(); }} />
      )}
      {reviewing && (
        <ReviewModal open booking={reviewing} direction="host_to_guest" existing={reviews[reviewing.id] || null}
          onClose={() => setReviewing(null)}
          onDone={(saved) => { const id = reviewing.id; setReviewing(null); setReviews((m) => ({ ...m, [id]: saved })); }} />
      )}
    </div>
  );
};

export default BookingsV2;
