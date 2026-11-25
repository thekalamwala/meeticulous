// Today — the host home, in the Kept direction (approved 2026-11-25; mock in the
// "Kept Dashboard Direction" pitch, section 08). REAL data only: getPayoutBalance,
// getHostBookings, getMyProfileViews, getMyKyc, plus getMyServices for the setup
// checklist (the same check KycNudgeStrip and the v1 Dashboard already make).
//
// One focal point per screen: the insight band says what's next (today's next
// booking, or the next one on the calendar, or how to get one). "Needs you" is the
// ONE place KYC / confirmations / unpaid show on Today — the shell's KYC notice is
// hidden on this route so the same fact isn't said three times.
//
// One layout for phone and desktop (founder, 2026-11-25: the two must not look
// like different dashboards). Same blocks in the same order; phones stack them,
// desktop sets them side by side. Order follows what a creator needs on login:
// greeting (topbar), next booking + today's schedule, the
// week + numbers, recent bookings, setup (onboarding), then link + Pro (secondary).
import { Children, cloneElement, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Check, ChevronLeft, ChevronRight, Copy, Link2, Wallet, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getPayoutBalance, getHostBookings, getMyProfileViews, getMyKyc, getMyServices, getAvailability, getPublicPlans, markLinkShared } from '../services/api';
import { isFreePlan } from '../utils/themeUtils';
import SetupGuide, { buildSetupSteps } from '../components/dashboard/SetupGuide';
import { buildQueue } from '../utils/attentionQueue';
import { Button, ErrorState, Skeleton } from '../components/dashboard/ui';
import {
  Avatar, Drawer, Figure, InsightBand, Panel, StatusPill, Tile,
  MeetIcon, WhatsAppIcon, cn, inr, fmtTime, fmtDayFull, relDay, useLast,
} from '../components/dashboard/ui/v2';

const lower = (s) => String(s || '').toLowerCase();
const amountOf = (b) => Number(b.customer_total ?? b.amount ?? 0) || 0;
const isPaid = (b) => lower(b.payment_status) === 'paid';
const monthKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}`; };
const DAY = 86_400_000;

// Last 6 calendar months of paid revenue, oldest→newest. Pure, tested.
export const revenueSeries = (bookings, now = new Date()) => {
  const out = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const revenue = bookings
      .filter((b) => isPaid(b) && b.scheduled_at && monthKey(b.scheduled_at) === key)
      .reduce((n, b) => n + amountOf(b), 0);
    out.push({ month: d.toLocaleDateString('en-IN', { month: 'short' }), revenue });
  }
  return out;
};

// Bookings by status over the last 12 calendar months, oldest→newest. Each row
// carries the real per-status counts (confirmed/completed/pending/cancelled) —
// no_show folds into cancelled. Pure, tested. Nothing invented (the lab mock
// split a fixed ratio; this counts the host's own bookings).
export const statusByMonth = (bookings, now = new Date()) => {
  const out = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const seg = [0, 0, 0, 0]; // confirmed, completed, pending, cancelled
    for (const b of bookings) {
      if (!b.scheduled_at || monthKey(b.scheduled_at) !== key) continue;
      const s = lower(b.status);
      if (s === 'confirmed') seg[0] += 1;
      else if (s === 'completed') seg[1] += 1;
      else if (s === 'pending') seg[2] += 1;
      else if (s === 'cancelled' || s === 'no_show') seg[3] += 1;
    }
    out.push({ month: d.toLocaleDateString('en-IN', { month: 'short' }), seg, total: seg[0] + seg[1] + seg[2] + seg[3] });
  }
  return out;
};

// The action queue now lives in utils/attentionQueue (shared with the notifications
// drawer); re-exported so existing imports keep working.
export { buildQueue };

// "Monday", "tomorrow", "later today" or "on 12 Dec" — how a person says when.
export const whenWord = (iso, now = new Date()) => {
  const d = new Date(iso);
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY);
  if (days <= 0) return 'later today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' });
  return `on ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
};


const waLink = (phone) => { const d = (phone || '').replace(/\D/g, ''); return d ? `https://wa.me/${d}` : null; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const UPGRADE_TO = '/dashboard/upgrade';
const PROFILE_TO = '/dashboard/profile';
const SHARE_KEY = 'mt_golive_link_shared'; // same key GoLiveChecklist reads
const serif = 'font-serif font-normal italic text-pink';
const card = 'rounded-[24px] bg-white';

/* Copy the public booking link — the one control every creator reaches for. Also
 * ticks the setup checklist's "share" step (same localStorage key + share signal). */
const readShared = () => { try { return localStorage.getItem(SHARE_KEY) === '1'; } catch { return false; } };
const useCopyLink = (username, onCopied) => useCallback(async () => {
  if (!username) { toast.error('Set your username first.'); return; }
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/${username}`);
    toast.success('Booking link copied');
    try { localStorage.setItem(SHARE_KEY, '1'); } catch { /* non-persistent is fine */ }
    markLinkShared();
    onCopied?.();
  } catch {
    toast.error('Could not copy your link.');
  }
}, [username, onCopied]);

/* ── Your page — booking link with Copy and View. ─────────────────────────── */
const LinkChip = ({ username, onCopy, className = '' }) => {
  if (!username) return null;
  const host = typeof window !== 'undefined' ? window.location.host.replace(/^www\./, '') : 'meeticulous.com';
  return (
    <div className={cn('flex min-w-0 items-center gap-1 rounded-[14px] bg-white p-1 pl-3', className)}>
      <Link2 className="h-4 w-4 shrink-0 text-maroon" strokeWidth={2.2} />
      <a href={`/${username}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate px-1.5 text-[13.5px] font-medium text-ink hover:text-maroon">
        {host}/<b className="font-semibold">{username}</b>
      </a>
      <button type="button" onClick={onCopy}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-maroon px-3 text-[13px] font-semibold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
        <Copy className="h-3.5 w-3.5" strokeWidth={2.4} /> Copy
      </button>
    </div>
  );
};

/* ── Pro strip — free plans only, dismissible, first thing on the page. A light
 * card so the maroon band below stays the one focal surface. ───────────────── */
const ProStrip = ({ go, onClose }) => (
  <div className="relative flex items-center gap-3 overflow-hidden rounded-[20px] bg-blush py-3 pl-3 pr-12 sm:gap-4 sm:py-3.5 sm:pl-4">
    <img src="/about/mascot-purple.png" alt="" aria-hidden="true" className="h-12 w-12 shrink-0 object-contain sm:h-14 sm:w-14" />
    <div className="min-w-0 flex-1">
      <p className="mb-0 text-[14.5px] font-semibold leading-snug text-maroon sm:text-[15px]">Smarter tools. Done easier.</p>
      <p className="mb-0 truncate text-[13px] text-muted">Analytics, priority support and your own branding.</p>
    </div>
    <button type="button" onClick={() => go(UPGRADE_TO)}
      className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-[12px] bg-maroon px-4 text-[13.5px] font-semibold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
      See Pro <ArrowRight className="hidden h-4 w-4 sm:block" strokeWidth={2.4} />
    </button>
    <button type="button" onClick={onClose} aria-label="Dismiss"
      className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-[10px] text-faint transition hover:bg-white hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
      <X className="h-4 w-4" strokeWidth={2.4} />
    </button>
  </div>
);

/* ── Band — the one focal card. Three jobs, picked by what's true right now:
 *  1. a booking is on now, or one is coming → that booking's details + actions;
 *  2. nothing coming, free plan              → a Pro ad that converts;
 *  3. nothing coming, already Pro            → "fill your calendar" (share).
 * (founder spec, 2026-11-25) ─────────────────────────────────────────────── */
// Pure, tested: the booking that matters now — the one in progress, else the next.
export const focusBooking = (bookings, now = new Date()) => {
  const live = bookings.filter((b) => b.scheduled_at && lower(b.status) !== 'cancelled');
  const current = live.find((b) => new Date(b.scheduled_at) <= now && endOf(b) > now);
  if (current) return { booking: current, phase: 'now' };
  const next = live.filter((b) => new Date(b.scheduled_at) > now)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
  return next ? { booking: next, phase: 'next' } : null;
};

const bandBtn = 'inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink';
const BandPrimary = ({ children, ...p }) => <button type="button" className={cn(bandBtn, 'bg-white text-maroon hover:bg-pink-100')} {...p}>{children}</button>;
const BandGhost = ({ children, href, ...p }) => (href
  ? <a href={href} target="_blank" rel="noreferrer" className={cn(bandBtn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60')}>{children}</a>
  : <button type="button" className={cn(bandBtn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60')} {...p}>{children}</button>);
const Chip = ({ children }) => <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-white/12 px-2.5 py-1 text-[13px] text-white">{children}</span>;

const BookingBand = ({ focus, onOpen }) => {
  const b = focus.booking;
  const start = new Date(b.scheduled_at);
  const isToday = sameDay(start, new Date());
  const amount = amountOf(b);
  const pay = !amount ? 'Free' : lower(b.payment_status) === 'paid' ? `${inr(amount)} · Paid` : `${inr(amount)} · Unpaid`;
  const wa = waLink(b.guest_phone);
  const eyebrow = focus.phase === 'now'
    ? `On now · until ${fmtTime(endOf(b).toISOString())}`
    : `Next booking · ${isToday ? 'today' : whenWord(b.scheduled_at)}`;
  return (
    <InsightBand mascot="blue" compact className="sm:py-5" eyebrow={eyebrow}
      title={<>{b.guest_name || 'Guest'} <em className={serif}>at {fmtTime(b.scheduled_at)}</em></>}
      sub={(
        <span className="mt-1 flex flex-wrap gap-1.5">
          <Chip>{b.services?.title || 'Booking'}</Chip>
          {b.services?.duration ? <Chip>{b.services.duration} min</Chip> : null}
          {!isToday && <Chip>{fmtDayFull(b.scheduled_at)}</Chip>}
          <Chip>{pay}</Chip>
        </span>
      )}
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

const ProAdBand = ({ proPlan, go }) => {
  const monthly = Number(proPlan?.monthly_price) || 0;
  const annual = Number(proPlan?.annual_price) || 0;
  // Same display rule as the upgrade page: GST-inclusive (server is authoritative).
  const price = monthly ? `${inr(Math.round(monthly * 1.18))}/month` : annual ? `${inr(Math.round(annual * 1.18))}/year` : null;
  return (
    <InsightBand mascot="purple" compact className="sm:py-5" eyebrow="Meeticulous Pro"
      title={<>Your calendar is open. <em className={serif}>Fill it faster.</em></>}
      sub={(
        <span className="mt-1 flex flex-col gap-1">
          {['Revenue forecast and a win-back list of guests to rebook', 'Your own branding on your booking page', 'Priority support from a real person'].map((t) => (
            <span key={t} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-pink" strokeWidth={2.6} />{t}</span>
          ))}
        </span>
      )}
      actions={(
        <>
          <BandPrimary onClick={() => go('/dashboard/upgrade?src=today_band')}>Upgrade to Pro <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandPrimary>
          {price && <span className="self-center text-[14px] font-medium text-white/85">{price} · incl. GST</span>}
        </>
      )} />
  );
};

const GrowBand = ({ username, views, onCopy }) => {
  const url = username ? `${window.location.origin}/${username}` : null;
  const share = url ? `https://wa.me/?text=${encodeURIComponent(`Book a session with me: ${url}`)}` : null;
  return (
    <InsightBand mascot="green" compact className="sm:py-5" eyebrow="Your calendar is open"
      title={<>Nothing booked yet. <em className={serif}>Let&apos;s change that.</em></>}
      sub={views ? `${views.toLocaleString('en-IN')} people have seen your page. Put your link where your audience already is.` : 'Put your link where your audience already is: bio, WhatsApp status, email signature.'}
      actions={(
        <>
          <BandPrimary onClick={onCopy}><Copy className="h-4 w-4" strokeWidth={2.4} /> Copy booking link</BandPrimary>
          {share && <BandGhost href={share}><WhatsAppIcon className="h-4 w-4" /> Share on WhatsApp</BandGhost>}
        </>
      )} />
  );
};

export const TodayBand = ({ bookings, isFree, proPlan, username, views, onOpen, onCopy, go }) => {
  const focus = focusBooking(bookings);
  if (focus) return <BookingBand focus={focus} onOpen={onOpen} />;
  if (isFree) return <ProAdBand proPlan={proPlan} go={go} />;
  return <GrowBand username={username} views={views} onCopy={onCopy} />;
};

const linkBtn = 'inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[13.5px] font-semibold text-maroon transition hover:bg-pink-100';

/* ── ScrollStrip — a swipeable row with two modes:
 *  · 'center' (carousel): the active card sits centred and fully visible; its
 *    neighbours peek in at the sides, faded and slightly smaller, so they read as
 *    coming in / going out. Arrows sit over the peeking edges, never the card.
 *  · 'pages': one full-width page at a time (the week planner).
 * Opens on `startIndex`, set before paint so nothing jumps. ─────────────── */
const CARD_W = 'min(248px, 76%)';
const ScrollStrip = ({ label, startIndex = 0, children, mode = 'center', onIndex, goTo, arrows = true }) => {
  const ref = useRef(null);
  const items = Children.toArray(children);
  const [active, setActive] = useState(startIndex);
  const centerOf = (el, i) => {
    const item = el.children[i];
    return item ? item.offsetLeft - (el.clientWidth - item.offsetWidth) / 2 : 0;
  };
  const go = useCallback((i, smooth = true) => {
    const el = ref.current;
    if (!el) return;
    const n = el.children.length;
    const j = Math.max(0, Math.min(n - 1, i));
    const left = mode === 'pages' ? j * el.clientWidth : centerOf(el, j);
    el.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' });
  }, [mode]);
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    let best = 0; let dist = Infinity;
    [...el.children].forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - (el.scrollLeft + el.clientWidth / 2));
      if (d < dist) { dist = d; best = i; }
    });
    if (best !== active) { setActive(best); onIndex?.(best); }
  };
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.scrollBehavior = 'auto';
    go(startIndex, false);
    el.style.scrollBehavior = '';
  }, [startIndex, go]);
  // External controls (e.g. arrows in a panel header) ask for an index.
  useEffect(() => { if (goTo != null) go(goTo.index); }, [goTo, go]);

  const arrow = 'absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 place-items-center rounded-[12px] bg-white text-maroon shadow-[var(--shadow-md)] transition hover:bg-pink-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose [@media(hover:hover)]:grid';
  const fade = mode === 'center'
    ? { maskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 14%, #000 86%, transparent)' }
    : undefined;
  return (
    <div className="relative">
      {arrows && active > 0 && <button type="button" onClick={() => go(active - 1)} aria-label={`Earlier ${label}`} className={cn(arrow, 'left-1')}><ChevronLeft className="h-4 w-4" strokeWidth={2.4} /></button>}
      <div ref={ref} onScroll={onScroll} role="list" aria-label={label}
        className={cn('dash-noscrollbar flex snap-x snap-mandatory overflow-x-auto scroll-smooth', mode === 'center' ? 'gap-3 py-1' : 'gap-0')}
        style={mode === 'center' ? { ...fade, paddingInline: `calc((100% - ${CARD_W}) / 2)` } : undefined}>
        {items.map((child, i) => cloneElement(child, {
          'data-active': i === active ? 'true' : 'false',
          style: { ...(child.props.style || {}), ...(mode === 'center' ? { width: CARD_W } : {}) },
        }))}
      </div>
      {arrows && active < items.length - 1 && <button type="button" onClick={() => go(active + 1)} aria-label={`Later ${label}`} className={cn(arrow, 'right-1')}><ChevronRight className="h-4 w-4" strokeWidth={2.4} /></button>}
    </div>
  );
};

/* ── This week — planning, not running the day (Today's schedule does that).
 * Swipe between last week, this week and next week (opens on this week). Each
 * page answers "how full was / am I and what does it earn": totals (bookings,
 * booked hours, earned or expected) and one bar per day by booked time. ───── */
const mondayOf = (d) => { const m = new Date(d); m.setHours(0, 0, 0, 0); m.setDate(m.getDate() - ((m.getDay() + 6) % 7)); return m; };

// Pure, tested: one week's load from the host's own bookings.
export const weekLoad = (bookings, monday, now = new Date()) => {
  const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY));
  const live = bookings.filter((b) => b.scheduled_at && lower(b.status) !== 'cancelled');
  const perDay = days.map((d) => {
    const items = live.filter((b) => sameDay(new Date(b.scheduled_at), d));
    return {
      date: d,
      count: items.length,
      minutes: items.reduce((n, b) => n + (Number(b.services?.duration) || 30), 0),
      past: new Date(d).setHours(23, 59, 59, 999) < now.getTime(),
    };
  });
  const weekItems = live.filter((b) => { const t = new Date(b.scheduled_at); return t >= days[0] && t < new Date(days[6].getTime() + DAY); });
  return {
    days: perDay,
    count: weekItems.length,
    hours: Math.round((perDay.reduce((n, d) => n + d.minutes, 0) / 60) * 10) / 10,
    expected: weekItems.reduce((n, b) => n + amountOf(b), 0),
    quiet: perDay.filter((d) => !d.past && d.count === 0),
  };
};

const WeekPage = ({ week, label, past, go }) => {
  const max = Math.max(60, ...week.days.map((d) => d.minutes));
  const today = new Date();
  return (
    <div role="listitem" aria-label={label} className="flex w-full shrink-0 snap-start flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {[['Bookings', week.count], ['Booked', `${week.hours}h`], [past ? 'Earned' : 'Expected', inr(week.expected, { compact: true })]].map(([k, v]) => (
          <div key={k} className="rounded-[14px] bg-cream px-3 py-2.5">
            <p className="mb-0 text-[12px] text-faint">{k}</p>
            <p className="mb-0 font-display text-[20px] font-extrabold tabular-nums tracking-[-0.02em] text-ink"><Figure value={v} /></p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 items-end gap-1.5" style={{ height: 112 }}>
        {week.days.map((d) => {
          const isToday = sameDay(d.date, today);
          const h = d.minutes ? Math.max(10, (d.minutes / max) * 84) : 4;
          return (
            <button key={d.date.toISOString()} type="button" onClick={() => go('/dashboard/bookings')}
              aria-label={`${d.date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}: ${d.count} booking${d.count === 1 ? '' : 's'}`}
              className="group flex h-full flex-col items-center justify-end gap-1 rounded-[10px] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
              <span className={cn('text-[11.5px] font-semibold tabular-nums', d.count ? 'text-ink' : 'text-transparent')}>{d.count || 0}</span>
              <span className={cn('w-full max-w-[34px] rounded-[6px] transition group-hover:opacity-80',
                d.past ? 'bg-neutral-200' : d.count ? 'bg-maroon' : 'bg-neutral-100')} style={{ height: h }} />
              <span className={cn('text-[11.5px] font-medium', isToday ? 'font-semibold text-maroon' : 'text-faint')}>
                {isToday ? 'Today' : d.date.toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const WeekPanel = ({ bookings, go }) => {
  const weeks = useMemo(() => {
    const m0 = mondayOf(new Date());
    return [-1, 0, 1].map((i) => {
      const monday = new Date(m0.getTime() + i * 7 * DAY);
      const sunday = new Date(monday.getTime() + 6 * DAY);
      const range = `${monday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
      return { label: i < 0 ? 'Last week' : i === 0 ? 'This week' : 'Next week', past: i < 0, range, load: weekLoad(bookings, monday) };
    });
  }, [bookings]);
  const [page, setPage] = useState(1); // this week, in the middle
  const [goTo, setGoTo] = useState(null);
  const step = (dir) => setGoTo({ index: page + dir }); // fresh object so the same index can repeat
  const nav = 'grid h-9 w-9 place-items-center rounded-[10px] bg-cream text-maroon transition hover:bg-pink-100 disabled:cursor-default disabled:text-neutral-300 disabled:hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose';
  return (
    <Panel title={weeks[page].label} subtitle={`${weeks[page].range} · swipe for last or next week`}
      action={(
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => step(-1)} disabled={page === 0} aria-label="Previous week" className={nav}><ChevronLeft className="h-4 w-4" strokeWidth={2.4} /></button>
          <button type="button" onClick={() => step(1)} disabled={page === weeks.length - 1} aria-label="Next week" className={nav}><ChevronRight className="h-4 w-4" strokeWidth={2.4} /></button>
        </div>
      )}>
      <ScrollStrip label="weeks" mode="pages" startIndex={1} onIndex={setPage} goTo={goTo} arrows={false}>
        {weeks.map((w) => <WeekPage key={w.range} week={w.load} label={`${w.label}, ${w.range}`} past={w.past} go={go} />)}
      </ScrollStrip>
    </Panel>
  );
};

/* ── Today's schedule — today as a timeline of cards you can swipe: what's
 * done (muted), what's on now, what's next and later. Opens on now / next. ── */
const endOf = (b) => new Date(new Date(b.scheduled_at).getTime() + (Number(b.services?.duration) || 30) * 60_000);
export const phaseOf = (b, now = new Date()) => {
  const start = new Date(b.scheduled_at);
  if (endOf(b) <= now) return 'done';
  if (start <= now) return 'now';
  return 'upcoming';
};
const PHASE = {
  done: ['Done', 'bg-neutral-100 text-muted'],
  now: ['On now', 'bg-maroon text-white'],
  next: ['Up next', 'bg-blush text-maroon'],
  later: ['Later', 'bg-cream text-muted'],
};

const TodaySchedule = ({ todays, onOpen, go }) => {
  const now = new Date();
  const phases = todays.map((b) => phaseOf(b, now));
  const doneCount = phases.filter((p) => p === 'done').length;
  const firstLive = phases.findIndex((p) => p !== 'done');
  const nextIdx = phases.findIndex((p) => p === 'upcoming');
  const startIndex = firstLive >= 0 ? firstLive : Math.max(0, todays.length - 1);
  const sub = todays.length
    ? [doneCount && `${doneCount} done`, todays.length - doneCount && `${todays.length - doneCount} still to come`].filter(Boolean).join(' · ')
    : 'Nothing booked today';

  return (
    <Panel title="Today's schedule" subtitle={sub}
      action={<button type="button" onClick={() => go('/dashboard/bookings')} className={linkBtn}>All bookings <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></button>}>
      {todays.length === 0 ? (
        <p className="mb-0 rounded-[16px] bg-cream p-4 text-[14px] text-muted">A clear day. New bookings land here.</p>
      ) : (
        <ScrollStrip label="bookings today" startIndex={startIndex}>
          {todays.map((b, i) => {
            const phase = phases[i];
            const key = phase === 'upcoming' ? (i === nextIdx ? 'next' : 'later') : phase;
            const [word, cls] = PHASE[key];
            const unpaid = lower(b.payment_status) === 'unpaid' && amountOf(b) > 0;
            return (
              <button key={b.id} type="button" role="listitem" onClick={() => onOpen(b.id)}
                aria-label={`${word}: ${b.guest_name || 'Guest'}, ${fmtTime(b.scheduled_at)}`}
                className={cn('flex shrink-0 snap-center flex-col gap-3 rounded-[18px] p-4 text-left transition duration-300 ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-rose',
                  'data-[active=false]:scale-[0.94] data-[active=false]:opacity-55 motion-reduce:transition-none',
                  phase === 'now' ? 'bg-blush ring-2 ring-inset ring-maroon' : 'bg-cream hover:bg-blush',
                  phase === 'done' && 'text-muted')}>
                <span className="flex items-center justify-between gap-2">
                  <span className={cn('font-display text-[18px] font-extrabold tabular-nums tracking-[-0.02em]', phase === 'done' ? 'text-muted' : 'text-maroon')}>{fmtTime(b.scheduled_at)}</span>
                  <span className={cn('shrink-0 whitespace-nowrap rounded-[6px] px-2 py-0.5 text-[11.5px] font-semibold', cls)}>{word}</span>
                </span>
                <span className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={b.guest_name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-ink">{b.guest_name || 'Guest'}</span>
                    <span className="block truncate text-[12.5px] text-muted">{b.services?.title || 'Booking'} · until {fmtTime(endOf(b).toISOString())}</span>
                  </span>
                  {unpaid && <span className="ml-auto shrink-0"><StatusPill status="unpaid" /></span>}
                </span>
              </button>
            );
          })}
        </ScrollStrip>
      )}
    </Panel>
  );
};

/* ── Recent bookings — latest four, status as a word. ─────────────────────── */
const RecentBookings = ({ bookings, onOpen, go }) => {
  const rows = [...bookings].sort((a, b) => new Date(b.created_at || b.scheduled_at) - new Date(a.created_at || a.scheduled_at)).slice(0, 4);
  return (
    <Panel title="Recent bookings" action={<button type="button" onClick={() => go('/dashboard/bookings')} className={linkBtn}>See all <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></button>}>
      {rows.length === 0 ? (
        <p className="mb-0 rounded-[16px] bg-cream p-4 text-[14px] text-muted">New bookings show up here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200">
          {rows.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => onOpen(b.id)}
                className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-[12px] px-2 py-2.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
                <Avatar name={b.guest_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-semibold text-ink">{b.guest_name || 'Guest'} · {b.services?.title || 'Booking'}</span>
                  <span className="block text-[13px] text-faint">{relDay(b.scheduled_at)} · {fmtTime(b.scheduled_at)}</span>
                </span>
                <StatusPill status={lower(b.status)} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const TodayV2 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const go = useCallback((to) => navigate(to), [navigate]);
  const [linkShared, setLinkShared] = useState(readShared);
  const copyLink = useCopyLink(user?.username, useCallback(() => setLinkShared(true), []));

  const [balance, setBalance] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [views, setViews] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [hasService, setHasService] = useState(true); // assume set up until we know
  const [availabilitySet, setAvailabilitySet] = useState(true);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [openId, setOpenId] = useState(null);
  const [promoClosed, setPromoClosed] = useState(false);
  const [proPlan, setProPlan] = useState(null);
  // Upsell Pro only to free-plan hosts; dismissible for the session.
  const isFree = isFreePlan(user?.plan);
  const showPromo = isFree && !promoClosed;

  const load = useCallback(() => {
    setStatus('loading');
    Promise.all([
      getPayoutBalance().catch(() => null),
      getHostBookings().then(({ data }) => (Array.isArray(data) ? data : [])),
      getMyProfileViews().then((r) => Number(r?.data?.views) || 0).catch(() => null),
      getMyKyc().then((r) => r?.data ?? null).catch(() => null),
      getMyServices().then((r) => (Array.isArray(r?.data) ? r.data : null)).catch(() => null),
      getAvailability().then((r) => r?.data ?? null).catch(() => undefined),
      getPublicPlans().then((r) => { const d = r?.data; return Array.isArray(d) ? d : (d?.plans || []); }).catch(() => []),
    ])
      .then(([bal, bk, vw, k, svcs, avail, plans]) => {
        // The Pro offer = the first paid plan by sort order (same rule as the upgrade page).
        setProPlan(plans.filter((pl) => (Number(pl.monthly_price) || 0) > 0 || (Number(pl.annual_price) || 0) > 0)
          .sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0))[0] || null);
        setBalance(bal?.data ?? null); setBookings(bk); setViews(vw); setKyc(k);
        if (svcs) setHasService(svcs.length > 0);
        if (avail !== undefined) setAvailabilitySet(!!avail); // undefined = request failed: don't nag
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const series = useMemo(() => revenueSeries(bookings), [bookings]);
  const thisMonth = series.at(-1)?.revenue || 0;
  const lastMonth = series.at(-2)?.revenue || 0;
  const delta = lastMonth ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;

  const upcomingList = useMemo(() => bookings
    .filter((b) => lower(b.status) !== 'cancelled' && b.scheduled_at && new Date(b.scheduled_at) > Date.now())
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)), [bookings]);
  const next = upcomingList[0] || null;

  const setupSteps = useMemo(() => buildSetupSteps({ hasService, availabilitySet, user, kyc, linkShared }),
    [hasService, availabilitySet, user, kyc, linkShared]);
  const setupOpen = setupSteps.some((s) => !s.done);

  const todays = useMemo(() => {
    const t = new Date().toDateString();
    return bookings
      .filter((b) => b.scheduled_at && new Date(b.scheduled_at).toDateString() === t && lower(b.status) !== 'cancelled')
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, [bookings]);
  const openBooking = useLast(bookings.find((b) => b.id === openId) || null);

  // Money: lead with the true, useful number. ₹0 ready but money held shows
  // "Waiting for you ₹1,424", not a loud ₹0 (Kept audit).
  const ready = Number(balance?.available) || 0;
  const held = (balance?.clearing || 0) + (balance?.pendingCompletion || 0);
  const moneyTile = !balance
    ? { label: 'Ready to withdraw', value: '—', hint: 'Balance unavailable' }
    : ready > 0 || held === 0
      ? { label: 'Ready to withdraw', value: inr(ready), hint: held ? `${inr(held)} clearing or held` : 'Paid out as bookings clear' }
      : { label: 'Waiting for you', value: inr(held), hint: balance.payoutsBlocked ? '₹0 ready · verify to release' : '₹0 ready · clearing now' };
  const pageTo = user?.username ? `/${user.username}` : PROFILE_TO;

  // Mascot art in each metric's empty right side, by domain (founder call,
  // 2026-11-25): orange = money, purple = insights, blue = bookings, green = growth.
  // Decorative — the label carries the meaning.
  const art = (who) => <img src={`/about/mascot-${who}.png`} alt="" className="h-20 w-20 object-contain lg:h-24 lg:w-24" />;
  const metrics = [
    <Tile key="money" {...moneyTile} art={art('orange')} onClick={() => go('/dashboard/payments/payouts')} />,
    <Tile key="month" label="This month" value={inr(thisMonth, { compact: true })} delta={delta ?? undefined} deltaLabel="vs last month"
      hint="Paid bookings" art={art('purple')} onClick={() => go('/dashboard/intelligence/revenue')} />,
    <Tile key="upcoming" label="Upcoming" value={upcomingList.length} hint={next ? `Next: ${fmtDayFull(next.scheduled_at)}` : 'Nothing scheduled'}
      art={art('blue')} onClick={() => go('/dashboard/bookings')} />,
    <Tile key="views" label="Page views" value={views == null ? '—' : views.toLocaleString('en-IN')} hint="Your public page"
      art={art('green')} onClick={() => go(pageTo)} />,
  ];

  const loading = status === 'loading';

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-4 sm:gap-6">
        <h1 className="mb-0 font-display text-[28px] font-extrabold tracking-[-0.035em] text-maroon sm:text-[34px]">Today</h1>
        <div className={card}>
          <ErrorState icon={Wallet} title="We couldn't load your day."
            message="Your bookings and payouts are safe. This is a problem showing them. Try again." onRetry={load} />
        </div>
      </div>
    );
  }

  // ONE layout for every screen size, in the founder's order (2026-11-25).
  // "Needs your attention" lives in the notifications drawer (bell), not here:
  // what's next + today's schedule, the week + the
  // numbers, recent bookings; onboarding and promotion last so they never get
  // between a host and their day. Spacing groups it: 16px inside a group, 40px
  // between groups.
  const sk = (h) => <Skeleton className={cn(h, 'rounded-[24px]')} />;
  return (
    <div className="flex flex-col gap-8 lg:gap-10">

      <section aria-label="Today" className="grid grid-cols-1 gap-4 lg:min-h-[251px] lg:grid-cols-[1.4fr_1fr] lg:gap-5">
        {loading ? sk('h-[220px]') : <TodayBand bookings={bookings} isFree={isFree} proPlan={proPlan} username={user?.username} views={views} onOpen={setOpenId} onCopy={copyLink} go={go} />}
        {loading ? sk('h-[220px]') : <TodaySchedule todays={todays} onOpen={setOpenId} go={go} />}
      </section>

      <section aria-label="Your week and numbers" className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        {loading ? sk('h-[260px]') : <WeekPanel bookings={bookings} go={go} />}
        <div className="grid grid-cols-2 gap-3 lg:h-full lg:grid-rows-2 lg:gap-4">
          {loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[124px] rounded-[20px]" />) : metrics}
        </div>
      </section>

      <RecentBookings bookings={bookings} onOpen={setOpenId} go={go} />

      {!loading && setupOpen && <SetupGuide steps={setupSteps} onGo={go} onCopy={copyLink} />}

      <div className="flex flex-col gap-4">
        <LinkChip username={user?.username} onCopy={copyLink} className="w-full sm:w-[360px]" />
        {showPromo && focusBooking(bookings) && <ProStrip go={go} onClose={() => setPromoClosed(true)} />}
      </div>

      <Drawer open={!!openId && !!openBooking} onClose={() => setOpenId(null)} title={openBooking?.guest_name || ''} subtitle={openBooking?.services?.title || ''}>
        {openBooking && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={lower(openBooking.status)} />
              {openBooking.payment_status && <StatusPill status={lower(openBooking.payment_status)} />}
            </div>
            <div className="rounded-[18px] bg-cream p-4">
              <p className="mb-0 font-display text-[20px] font-bold tracking-[-0.02em] text-maroon">{relDay(openBooking.scheduled_at)} · {fmtTime(openBooking.scheduled_at)}</p>
              <p className="mb-0 mt-0.5 text-[13px] text-muted">{fmtDayFull(openBooking.scheduled_at)}{openBooking.services?.duration ? ` · ${openBooking.services.duration} min` : ''}</p>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              {[['Amount', amountOf(openBooking) ? inr(amountOf(openBooking)) : 'Free'], ['Phone', openBooking.guest_phone || '—'], ['Email', openBooking.guest_email || '—']].map(([k, v]) => (
                <div key={k} className="min-w-0"><dt className="text-[12.5px] text-faint">{k}</dt><dd className="mb-0 mt-0.5 truncate text-[14.5px] font-semibold text-ink">{v}</dd></div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2">
              {openBooking.meet_link && <a href={openBooking.meet_link} target="_blank" rel="noreferrer" className="inline-flex"><Button size="sm" variant="secondary"><MeetIcon className="h-4 w-4" /> Join call</Button></a>}
              {waLink(openBooking.guest_phone)
                ? <a href={waLink(openBooking.guest_phone)} target="_blank" rel="noreferrer" className="inline-flex"><Button size="sm" variant="secondary"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</Button></a>
                : null}
              <Button size="sm" variant="ghost" onClick={() => { setOpenId(null); go('/dashboard/bookings'); }}>All bookings</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default TodayV2;
