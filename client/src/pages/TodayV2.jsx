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
// greeting + booking link + setup, Pro strip, what's next + what needs you,
// shortcuts, how it's going, the week.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CalendarCheck2, Check, Clock, Copy, IndianRupee,
  Link2, Package, ShieldCheck, Star, UserPlus, Wallet, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getPayoutBalance, getHostBookings, getMyProfileViews, getMyKyc, getMyServices, markLinkShared } from '../services/api';
import { isFreePlan } from '../utils/themeUtils';
import GoLiveChecklist from '../components/dashboard/GoLiveChecklist';
import { Button, ErrorState, Skeleton } from '../components/dashboard/ui';
import {
  Avatar, Drawer, InsightBand, Panel, Sparkline, StatusPill, Tile,
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

// Real "needs you" items derived from bookings + kyc. Hardest first.
export const buildQueue = (bookings, kyc, now = Date.now()) => {
  const q = [];
  const kycStatus = lower(kyc?.status || kyc?.kyc_status);
  if (kycStatus && !['approved', 'verified'].includes(kycStatus)) {
    const held = Number(kyc?.pending_earnings) || 0;
    q.push({ id: 'kyc', kind: 'kyc', urgency: 'now', title: 'Verify to get paid',
      detail: held > 0 ? `${inr(held)} is held until your PAN and bank are verified.` : 'Payouts are locked until verification is approved.',
      cta: 'Verify now', to: '/dashboard/kyc' });
  }
  const pending = bookings.filter((b) => lower(b.status) === 'pending' && new Date(b.scheduled_at) > now - DAY);
  if (pending.length) {
    q.push({ id: 'confirm', kind: 'confirm', urgency: 'now', title: `${pending.length} booking${pending.length > 1 ? 's' : ''} to confirm`, detail: pending.slice(0, 2).map((b) => b.guest_name || 'Guest').join(', '), cta: 'Review', to: '/dashboard/bookings' });
  }
  const unpaid = bookings.filter((b) => lower(b.payment_status) === 'unpaid' && amountOf(b) > 0 && ['completed', 'confirmed'].includes(lower(b.status)));
  if (unpaid.length) {
    const owed = unpaid.reduce((n, b) => n + amountOf(b), 0);
    q.push({ id: 'unpaid', kind: 'unpaid', urgency: 'today', title: `${unpaid.length} unpaid booking${unpaid.length > 1 ? 's' : ''}`, detail: `${inr(owed)} not yet collected`, cta: 'See', to: '/dashboard/bookings' });
  }
  return q;
};

// "Monday", "tomorrow", "later today" or "on 12 Dec" — how a person says when.
export const whenWord = (iso, now = new Date()) => {
  const d = new Date(iso);
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / DAY);
  if (days <= 0) return 'later today';
  if (days === 1) return 'tomorrow';
  if (days < 7) return d.toLocaleDateString('en-IN', { weekday: 'long' });
  return `on ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
};

const KIND_ICON = { kyc: ShieldCheck, confirm: CalendarCheck2, unpaid: IndianRupee };
const URGENCY = { now: ['Now', 'bg-error-bg text-error-fg'], today: ['Today', 'bg-warning-bg text-warning-fg'], this_week: ['This week', 'bg-neutral-100 text-muted'] };

const waLink = (phone) => { const d = (phone || '').replace(/\D/g, ''); return d ? `https://wa.me/${d}` : null; };
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const greeting = (h = new Date().getHours()) => (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening');
const UPGRADE_TO = '/dashboard/upgrade';
const PROFILE_TO = '/dashboard/profile';
const SHARE_KEY = 'mt_golive_link_shared'; // same key GoLiveChecklist reads
const serif = 'font-serif font-normal italic text-pink';
const card = 'rounded-[24px] bg-white';

/* Copy the public booking link — the one control every creator reaches for. Also
 * ticks the setup checklist's "share" step (same localStorage key + share signal). */
const useCopyLink = (username) => useCallback(async () => {
  if (!username) { toast.error('Set your username first.'); return; }
  try {
    await navigator.clipboard.writeText(`${window.location.origin}/${username}`);
    toast.success('Booking link copied');
    try { localStorage.setItem(SHARE_KEY, '1'); } catch { /* non-persistent is fine */ }
    markLinkShared();
  } catch {
    toast.error('Could not copy your link.');
  }
}, [username]);

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

/* ── Band — the page's one focal sentence, from real bookings. ────────────── */
const TodayBand = ({ todays, next, onOpen, onCopy }) => {
  const now = new Date();
  const laterToday = todays.filter((b) => new Date(b.scheduled_at) > now);
  const meta = (b) => [b.guest_name || 'Guest', b.services?.title].filter(Boolean).join(' · ');
  const action = (label, onClick, Icon = ArrowRight) => (
    <button type="button" onClick={onClick}
      className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-white px-5 text-[14px] font-semibold text-maroon transition hover:bg-pink-100 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink">
      {label} <Icon className="h-4 w-4" strokeWidth={2.4} />
    </button>
  );

  let eyebrow; let title; let sub; let actions;
  if (laterToday.length) {
    const b = laterToday[0];
    eyebrow = `Today · ${todays.length} booking${todays.length > 1 ? 's' : ''}`;
    title = <>Next up at <em className={serif}>{fmtTime(b.scheduled_at)}.</em></>;
    sub = meta(b);
    actions = action('Open booking', () => onOpen(b.id));
  } else if (next) {
    eyebrow = 'Next booking';
    title = todays.length
      ? <>Today&apos;s done. Next is <em className={serif}>{whenWord(next.scheduled_at)}.</em></>
      : <>A clear day. Next booking is <em className={serif}>{whenWord(next.scheduled_at)}.</em></>;
    sub = `${meta(next)} · ${fmtDayFull(next.scheduled_at)} · ${fmtTime(next.scheduled_at)}`;
    actions = action('Open booking', () => onOpen(next.id));
  } else {
    eyebrow = 'Today';
    title = <>A clear day. <em className={serif}>Let&apos;s fill the next one.</em></>;
    sub = 'Nothing is booked yet. Share your link where your audience already is.';
    actions = action('Copy booking link', onCopy, Copy);
  }
  return <InsightBand eyebrow={eyebrow} title={title} sub={sub} actions={actions} mascot="blue" className="sm:py-7" />;
};

/* ── Needs you — the action queue, compact rows with the action inline. ───── */
const NeedsYou = ({ queue, go, onResolve }) => (
  <section className={cn(card, 'flex flex-col gap-3 p-5')} aria-labelledby="needs-you">
    <div className="flex items-center justify-between gap-2">
      <h2 id="needs-you" className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">Needs you</h2>
      {queue.length > 0 && <span className="rounded-[8px] bg-maroon px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-white">{queue.length}</span>}
    </div>
    {queue.length === 0 ? (
      <p className="mb-0 flex flex-1 items-center gap-2 rounded-[16px] bg-cream p-4 text-[14px] font-medium text-success-fg">
        <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} /> All clear. Nothing needs you right now.
      </p>
    ) : (
      <ul className="flex flex-col gap-2">
        {queue.map((a) => {
          const Icon = KIND_ICON[a.kind] || AlertTriangle;
          const [word, cls] = URGENCY[a.urgency] || URGENCY.this_week;
          return (
            <li key={a.id} className="flex items-center gap-3 rounded-[16px] bg-cream p-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white text-maroon"><Icon className="h-5 w-5" strokeWidth={2} /></span>
              <div className="min-w-0 flex-1">
                <p className="mb-0 flex flex-wrap items-center gap-x-2 text-[14.5px] font-semibold leading-snug text-ink">
                  {a.title} <span className={cn('rounded-[6px] px-1.5 text-[11px] font-semibold', cls)}>{word}</span>
                </p>
                <p className="mb-0 truncate text-[13px] text-muted" title={a.detail}>{a.detail}</p>
              </div>
              <Button size="sm" onClick={() => go(a.to)}>{a.cta}</Button>
              <button type="button" onClick={() => onResolve(a.id)} aria-label={`Mark "${a.title}" handled`} title="Mark handled"
                className="hidden h-8 w-8 shrink-0 place-items-center rounded-[10px] text-faint transition hover:bg-white hover:text-success-fg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose sm:grid">
                <Check className="h-4 w-4" strokeWidth={2.6} />
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

/* ── Shortcuts — the same five controls on phone and desktop. ─────────────── */
const Shortcuts = ({ go, onCopy }) => {
  const items = [
    { icon: Copy, label: 'Copy link', onClick: onCopy, primary: true },
    { icon: Package, label: 'Services', onClick: () => go('/dashboard/catalog') },
    { icon: Clock, label: 'Availability', onClick: () => go('/dashboard/availability') },
    { icon: UserPlus, label: 'Clients', onClick: () => go('/dashboard/clients') },
    { icon: Star, label: 'Reviews', onClick: () => go('/dashboard/testimonials') },
  ];
  return (
    <nav aria-label="Shortcuts" className="grid grid-cols-5 gap-2 sm:gap-3">
      {items.map((s) => (
        <button key={s.label} type="button" onClick={s.onClick}
          className="group flex flex-col items-center gap-1.5 rounded-[18px] py-1 text-center transition focus-visible:outline-none sm:flex-row sm:gap-3 sm:bg-white sm:px-4 sm:py-3 sm:text-left sm:hover:shadow-[var(--shadow-md)]">
          <span className={cn('grid h-12 w-12 shrink-0 place-items-center rounded-[16px] transition group-active:scale-95 group-focus-visible:ring-[3px] group-focus-visible:ring-rose sm:h-10 sm:w-10 sm:rounded-[12px]',
            s.primary ? 'bg-maroon text-white' : 'bg-white text-maroon sm:bg-pink-100')}>
            <s.icon className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="text-[12px] font-medium text-muted sm:text-[14px] sm:font-semibold sm:text-ink">{s.label}</span>
        </button>
      ))}
    </nav>
  );
};

/* ── Week — 7-day strip (pink dot = booked) + the chosen day's bookings. ──── */
const BookingRow = ({ b, onOpen }) => {
  const past = new Date(b.scheduled_at) < new Date();
  return (
    <li>
      <button type="button" onClick={() => onOpen(b.id)}
        className="flex w-full items-center gap-3 rounded-[14px] px-2 py-2.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
        <span className={cn('w-[58px] shrink-0 text-[13px] font-semibold tabular-nums', past ? 'text-faint' : 'text-maroon')}>{fmtTime(b.scheduled_at)}</span>
        <Avatar name={b.guest_name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold text-ink">{b.guest_name || 'Guest'}</span>
          <span className="block truncate text-[13px] text-muted">{b.services?.title || 'Booking'}{b.services?.duration ? ` · ${b.services.duration} min` : ''}</span>
        </span>
        {lower(b.payment_status) === 'unpaid' && amountOf(b) > 0 && <StatusPill status="unpaid" />}
      </button>
    </li>
  );
};

const linkBtn = 'inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[13.5px] font-semibold text-maroon transition hover:bg-pink-100';

const WeekPanel = ({ bookings, onOpen, go }) => {
  const base = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [sel, setSel] = useState(base);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => new Date(base.getTime() + i * DAY)), [base]);
  const live = (b) => b.scheduled_at && lower(b.status) !== 'cancelled';
  const countFor = (d) => bookings.filter((b) => live(b) && sameDay(new Date(b.scheduled_at), d)).length;
  const dayItems = useMemo(() => bookings
    .filter((b) => live(b) && sameDay(new Date(b.scheduled_at), sel))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)), [bookings, sel]);
  const label = sameDay(sel, base) ? 'today' : `on ${sel.toLocaleDateString('en-IN', { weekday: 'long' })}`;

  return (
    <Panel title="This week" action={<button type="button" onClick={() => go('/dashboard/bookings')} className={linkBtn}>All bookings <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></button>}>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((d) => {
          const on = sameDay(d, sel);
          const n = countFor(d);
          return (
            <button key={d.toISOString()} type="button" onClick={() => setSel(d)} aria-pressed={on}
              aria-label={`${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${n ? `, ${n} booking${n > 1 ? 's' : ''}` : ''}`}
              className={cn('flex flex-col items-center gap-0.5 rounded-[14px] py-2 transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
                on ? 'bg-maroon text-white' : 'bg-cream text-muted hover:bg-blush')}>
              <span className={cn('text-[11.5px] font-medium', on ? 'text-white/80' : 'text-faint')}>{sameDay(d, base) ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
              <span className={cn('font-display text-[18px] font-extrabold leading-none tracking-[-0.02em] sm:text-[20px]', on ? 'text-white' : 'text-ink')}>{d.getDate()}</span>
              <span aria-hidden="true" className={cn('mt-1 h-1.5 w-1.5 rounded-full', n ? 'bg-pink' : 'bg-transparent')} />
            </button>
          );
        })}
      </div>
      {dayItems.length === 0 ? (
        <p className="mb-0 mt-3 rounded-[16px] bg-cream p-4 text-[14px] text-muted">Nothing booked {label}.</p>
      ) : (
        <ul className="mt-2 flex flex-col">{dayItems.map((b) => <BookingRow key={b.id} b={b} onOpen={onOpen} />)}</ul>
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
                className="flex w-full items-center gap-3 py-2.5 text-left transition hover:bg-cream/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
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
  const copyLink = useCopyLink(user?.username);

  const [balance, setBalance] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [views, setViews] = useState(null);
  const [kyc, setKyc] = useState(null);
  const [hasPaidService, setHasPaidService] = useState(true); // assume set up until we know
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [dismissed, setDismissed] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [promoClosed, setPromoClosed] = useState(false);
  // Upsell Pro only to free-plan hosts; dismissible for the session.
  const showPromo = isFreePlan(user?.plan) && !promoClosed;

  const load = useCallback(() => {
    setStatus('loading');
    Promise.all([
      getPayoutBalance().catch(() => null),
      getHostBookings().then(({ data }) => (Array.isArray(data) ? data : [])),
      getMyProfileViews().then((r) => Number(r?.data?.views) || 0).catch(() => null),
      getMyKyc().then((r) => r?.data ?? null).catch(() => null),
      getMyServices().then((r) => (Array.isArray(r?.data) ? r.data : null)).catch(() => null),
    ])
      .then(([bal, bk, vw, k, svcs]) => {
        setBalance(bal?.data ?? null); setBookings(bk); setViews(vw); setKyc(k);
        if (svcs) setHasPaidService(svcs.some((x) => Number(x.price) > 0 && !x.price_on_request));
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

  const queue = useMemo(() => buildQueue(bookings, kyc).filter((a) => !dismissed.includes(a.id)), [bookings, kyc, dismissed]);
  const resolve = (id) => setDismissed((d) => (d.includes(id) ? d : [...d, id]));

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

  const metrics = [
    <Tile key="money" {...moneyTile} onClick={() => go('/dashboard/payments/payouts')} />,
    <Tile key="month" label="This month" value={inr(thisMonth, { compact: true })} delta={delta ?? undefined} deltaLabel="vs last month"
      hint="Paid bookings" spark={series.some((s) => s.revenue) ? <Sparkline values={series.map((s) => s.revenue)} /> : null}
      onClick={() => go('/dashboard/intelligence/revenue')} />,
    <Tile key="upcoming" label="Upcoming" value={upcomingList.length} hint={next ? `Next: ${fmtDayFull(next.scheduled_at)}` : 'Nothing scheduled'} onClick={() => go('/dashboard/bookings')} />,
    <Tile key="views" label="Page views" value={views == null ? '—' : views.toLocaleString('en-IN')} hint="Your public page" onClick={() => go(pageTo)} />,
  ];

  const firstName = (user?.name || '').trim().split(/\s+/)[0];
  const dateLine = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
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

  // ONE layout for every screen size, in the order a creator needs it: who/what
  // today, what to act on, the controls they reach for, how it's going, the week.
  // Phones stack it; wider screens set the same blocks side by side.
  return (
    <div className="flex flex-col gap-4 lg:gap-5">
      <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h1 className="mb-0 font-display text-[28px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon sm:text-[34px]">
            {greeting()}{firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="mb-0 mt-1 text-[14px] text-muted sm:text-[15px]">
            {dateLine} · {queue.length > 0
              ? <span className="font-semibold text-maroon">{queue.length} thing{queue.length > 1 ? 's' : ''} need{queue.length > 1 ? '' : 's'} you</span>
              : 'All clear'}
          </p>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <LinkChip username={user?.username} onCopy={copyLink} className="min-w-0 flex-1 lg:w-[340px] lg:flex-none" />
          {!loading && <GoLiveChecklist kyc={kyc} hasPaidService={hasPaidService} username={user?.username} />}
        </div>
      </header>

      {showPromo && <ProStrip go={go} onClose={() => setPromoClosed(true)} />}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr] lg:gap-5">
        {loading ? <Skeleton className="h-[220px] rounded-[28px]" /> : <TodayBand todays={todays} next={next} onOpen={setOpenId} onCopy={copyLink} />}
        {loading ? <Skeleton className="h-[220px] rounded-[24px]" /> : <NeedsYou queue={queue} go={go} onResolve={resolve} />}
      </div>

      <Shortcuts go={go} onCopy={copyLink} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-5">
        {loading ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[124px] rounded-[20px]" />) : metrics}
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.35fr_1fr] lg:gap-5">
        <WeekPanel bookings={bookings} onOpen={setOpenId} go={go} />
        <RecentBookings bookings={bookings} onOpen={setOpenId} go={go} />
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
