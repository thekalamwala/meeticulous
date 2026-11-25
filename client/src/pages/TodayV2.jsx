// Today — the host home, in the Kept direction (approved 2026-11-25; mock in the
// "Kept Dashboard Direction" pitch, section 08). REAL data only, from the same four
// calls as before (getPayoutBalance, getHostBookings, getMyProfileViews, getMyKyc).
//
// One focal point per screen: the insight band says what's next (today's next
// booking, or the next one on the calendar, or how to get one). "Needs you" is the
// ONE place KYC / confirmations / unpaid show on Today — the shell's KYC notice is
// hidden on this route so the same fact isn't said three times.
//
// Desktop and mobile are deliberately different compositions of the same data:
// desktop opens wide (band beside Needs you, four metrics, week beside recent);
// mobile opens on the next booking and the one task, then thumb-sized shortcuts.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CalendarCheck2, CalendarDays, Check, ChevronLeft,
  ChevronRight, Eye, IndianRupee, Package, Share2, ShieldCheck, Star, UserPlus,
  Wallet, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getPayoutBalance, getHostBookings, getMyProfileViews, getMyKyc } from '../services/api';
import { isFreePlan } from '../utils/themeUtils';
import { Button, ErrorState, Skeleton } from '../components/dashboard/ui';
import {
  Avatar, Drawer, InsightBand, Panel, Sparkline, StatusPill, SourceDonut, Tile,
  MeetIcon, WhatsAppIcon, cn, inr, pct, fmtTime, fmtDayFull, relDay, useLast,
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
const SHARE_TO = '/dashboard/profile';
const serif = 'font-serif font-normal italic text-pink';

/* ── Band — the page's one focal sentence, from real bookings. ────────────── */
const TodayBand = ({ todays, next, onOpen, go, compact = false }) => {
  const now = new Date();
  const laterToday = todays.filter((b) => new Date(b.scheduled_at) > now);
  const meta = (b) => [b.guest_name || 'Guest', b.services?.title].filter(Boolean).join(' · ');
  const btn = 'inline-flex h-11 items-center gap-2 rounded-[12px] px-5 text-[14px] font-semibold transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink';
  const primary = (label, onClick) => <button type="button" onClick={onClick} className={cn(btn, 'bg-white text-maroon hover:bg-pink-100')}>{label} <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></button>;
  const ghost = (label, onClick) => <button type="button" onClick={onClick} className={cn(btn, 'bg-maroon-700 text-white ring-2 ring-inset ring-white/35 hover:ring-white/60')}>{label}</button>;

  let eyebrow; let title; let sub; let actions;
  if (laterToday.length) {
    const b = laterToday[0];
    eyebrow = `Today · ${todays.length} booking${todays.length > 1 ? 's' : ''}`;
    title = <>Next up at <em className={serif}>{fmtTime(b.scheduled_at)}.</em></>;
    sub = meta(b);
    actions = <>{primary('Open booking', () => onOpen(b.id))}{!compact && ghost('See the week', () => go('/dashboard/bookings'))}</>;
  } else if (next) {
    eyebrow = compact ? 'Next booking' : `Today · ${now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}`;
    title = todays.length
      ? <>Today&apos;s done. Next is <em className={serif}>{whenWord(next.scheduled_at)}.</em></>
      : <>A clear day. Your next booking is <em className={serif}>{whenWord(next.scheduled_at)}.</em></>;
    sub = `${meta(next)} · ${fmtDayFull(next.scheduled_at)} · ${fmtTime(next.scheduled_at)}`;
    actions = <>{primary('Open booking', () => onOpen(next.id))}{!compact && ghost('See the week', () => go('/dashboard/bookings'))}</>;
  } else {
    eyebrow = 'Today';
    title = <>A clear day. <em className={serif}>Let&apos;s fill the next one.</em></>;
    sub = 'Nothing is booked yet. Share your page and guests can book you straight away.';
    actions = primary('Share your page', () => go(SHARE_TO));
  }
  return <InsightBand eyebrow={eyebrow} title={title} sub={sub} actions={actions} mascot="blue" />;
};

/* ── Needs you — the action queue, inline (was a drawer). ─────────────────── */
const NeedsYou = ({ queue, go, onResolve, className = '' }) => (
  <section className={cn('flex flex-col gap-3 rounded-[24px] bg-white p-5 sm:p-6', className)} aria-labelledby="needs-you">
    <div className="flex items-center justify-between gap-2">
      <h2 id="needs-you" className="mb-0 font-display text-[18px] font-bold tracking-[-0.02em] text-ink sm:text-[20px]">Needs you</h2>
      {queue.length > 0 && <span className="rounded-[8px] bg-maroon px-2.5 py-0.5 text-[12px] font-semibold tabular-nums text-white">{queue.length}</span>}
    </div>
    {queue.length === 0 ? (
      <p className="mb-0 flex items-center gap-2 rounded-[18px] bg-cream p-4 text-[14px] font-medium text-success-fg">
        <Check className="h-4 w-4 shrink-0" strokeWidth={2.6} /> All clear. Nothing needs you right now.
      </p>
    ) : (
      <ul className="flex flex-col gap-2">
        {queue.map((a) => {
          const Icon = KIND_ICON[a.kind] || AlertTriangle;
          const [word, cls] = URGENCY[a.urgency] || URGENCY.this_week;
          return (
            <li key={a.id} className="flex flex-col gap-3 rounded-[18px] bg-cream p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-white text-maroon"><Icon className="h-5 w-5" strokeWidth={2} /></span>
                <div className="min-w-0 flex-1">
                  <p className="mb-0 text-[15px] font-semibold leading-snug text-ink">
                    {a.title} <span className={cn('ml-1 inline-block rounded-[6px] px-2 py-px align-[2px] text-[11px] font-semibold', cls)}>{word}</span>
                  </p>
                  <p className="mb-0 mt-0.5 text-[13px] text-muted">{a.detail}</p>
                </div>
                <button type="button" onClick={() => onResolve(a.id)} aria-label={`Mark "${a.title}" handled`} title="Mark handled"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] text-faint transition hover:bg-white hover:text-success-fg focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
                  <Check className="h-4 w-4" strokeWidth={2.6} />
                </button>
              </div>
              <Button onClick={() => go(a.to)} full>{a.cta}</Button>
            </li>
          );
        })}
      </ul>
    )}
    <p className="mb-0 mt-auto text-[12.5px] text-faint">Hardest first. Done items leave this list.</p>
  </section>
);

/* ── Week — the date strip (pink dot = booked) + the chosen day's bookings. ─ */
const BookingRow = ({ b, onOpen }) => {
  const past = new Date(b.scheduled_at) < new Date();
  return (
    <li>
      <button type="button" onClick={() => onOpen(b.id)}
        className="flex w-full items-center gap-3 rounded-[16px] px-2 py-2.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
        <span className={cn('w-[60px] shrink-0 text-[13px] font-semibold tabular-nums', past ? 'text-faint' : 'text-maroon')}>{fmtTime(b.scheduled_at)}</span>
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

const WeekPanel = ({ bookings, onOpen, go, mobile = false }) => {
  const base = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [sel, setSel] = useState(base);
  const stripRef = useRef(null);
  const days = useMemo(() => Array.from({ length: mobile ? 14 : 7 }, (_, i) => new Date(base.getTime() + i * DAY)), [base, mobile]);
  const live = (b) => b.scheduled_at && lower(b.status) !== 'cancelled';
  const countFor = (d) => bookings.filter((b) => live(b) && sameDay(new Date(b.scheduled_at), d)).length;
  const dayItems = useMemo(() => bookings
    .filter((b) => live(b) && sameDay(new Date(b.scheduled_at), sel))
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)), [bookings, sel]);
  const nudge = (dir) => stripRef.current?.scrollBy({ left: dir * 200, behavior: 'smooth' });
  const label = sameDay(sel, base) ? 'today' : `on ${sel.toLocaleDateString('en-IN', { weekday: 'long' })}`;

  const cell = (d) => {
    const on = sameDay(d, sel);
    const n = countFor(d);
    return (
      <button key={d.toISOString()} type="button" onClick={() => setSel(d)} aria-pressed={on}
        aria-label={`${d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${n ? `, ${n} booking${n > 1 ? 's' : ''}` : ''}`}
        className={cn('flex shrink-0 snap-start flex-col items-center gap-0.5 rounded-[16px] py-2.5 transition focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose',
          mobile ? 'w-[60px]' : 'w-full',
          on ? 'bg-maroon text-white' : 'bg-cream text-muted hover:bg-blush')}>
        <span className={cn('text-[12px] font-medium', on ? 'text-white/80' : 'text-faint')}>{sameDay(d, base) ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}</span>
        <span className={cn('font-display text-[20px] font-extrabold leading-none tracking-[-0.02em]', on ? 'text-white' : 'text-ink')}>{d.getDate()}</span>
        <span aria-hidden="true" className={cn('mt-1 h-1.5 w-1.5 rounded-full', n ? 'bg-pink' : 'bg-transparent')} />
      </button>
    );
  };

  return (
    <Panel title="This week" subtitle="Tap a day to see its bookings"
      action={<button type="button" onClick={() => go('/dashboard/bookings')} className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[13.5px] font-semibold text-maroon transition hover:bg-pink-100">All bookings <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></button>}>
      {mobile ? (
        <div className="-mx-5 flex items-center gap-1 px-5">
          <button type="button" aria-label="Earlier days" onClick={() => nudge(-1)} className="hidden h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-cream text-muted sm:grid"><ChevronLeft className="h-4 w-4" /></button>
          <div ref={stripRef} className="dash-noscrollbar flex flex-1 snap-x gap-2 overflow-x-auto">{days.map(cell)}</div>
          <button type="button" aria-label="Later days" onClick={() => nudge(1)} className="hidden h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-cream text-muted sm:grid"><ChevronRight className="h-4 w-4" /></button>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-2">{days.map(cell)}</div>
      )}
      {dayItems.length === 0 ? (
        <div className="mt-4 flex items-center gap-4 rounded-[18px] bg-cream p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] border-2 border-dashed border-neutral-300 text-faint"><CalendarDays className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="mb-0 text-[15px] font-semibold text-ink">Nothing booked {label}</p>
            <p className="mb-0 text-[13px] text-muted">Share your page if you&apos;d like that to change.</p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => go(SHARE_TO)} className="hidden sm:inline-flex">Share page</Button>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col">{dayItems.map((b) => <BookingRow key={b.id} b={b} onOpen={onOpen} />)}</ul>
      )}
    </Panel>
  );
};

/* ── Recent bookings — latest five, one row each, status as a word. ───────── */
const RecentBookings = ({ bookings, onOpen, go }) => {
  const rows = [...bookings].sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)).slice(0, 5);
  return (
    <Panel title="Recent bookings" subtitle="Latest first"
      action={<button type="button" onClick={() => go('/dashboard/bookings')} className="inline-flex items-center gap-1 rounded-[10px] px-2 py-1 text-[13.5px] font-semibold text-maroon transition hover:bg-pink-100">See all <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></button>}>
      {rows.length === 0 ? (
        <p className="mb-0 rounded-[18px] bg-cream p-4 text-[14px] text-muted">New bookings show up here.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-neutral-200">
          {rows.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => onOpen(b.id)}
                className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-cream/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
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

/* ── Shortcuts — the mobile app-icon row. ─────────────────────────────────── */
const SHORTCUTS = [
  { icon: Share2, label: 'Share page', to: SHARE_TO, primary: true },
  { icon: Package, label: 'Services', to: '/dashboard/catalog' },
  { icon: UserPlus, label: 'Add client', to: '/dashboard/clients' },
  { icon: Star, label: 'Reviews', to: '/dashboard/testimonials' },
];
const Shortcuts = ({ go }) => (
  <nav aria-label="Shortcuts" className="grid grid-cols-4 gap-2">
    {SHORTCUTS.map((s) => (
      <button key={s.label} type="button" onClick={() => go(s.to)} className="group flex flex-col items-center gap-2 rounded-[16px] py-1 text-center focus-visible:outline-none">
        <span className={cn('grid h-14 w-14 place-items-center rounded-[18px] transition group-active:scale-95 group-focus-visible:ring-[3px] group-focus-visible:ring-rose',
          s.primary ? 'bg-maroon text-white' : 'bg-white text-maroon')}>
          <s.icon className="h-6 w-6" strokeWidth={2} />
        </span>
        <span className="text-[12.5px] font-medium text-muted">{s.label}</span>
      </button>
    ))}
  </nav>
);

/* ── Pro promo — free-plan hosts only, dismissible, and always below the work. */
const PromoDesktop = ({ go, onClose }) => (
  <div className="relative isolate overflow-hidden rounded-[24px] bg-white">
    <div className="flex items-center gap-6 px-7 py-6 sm:px-8">
      <img src="/about/mascot-purple.png" alt="" aria-hidden="true" className="hidden h-24 w-24 shrink-0 object-contain md:block" />
      <div className="min-w-0 flex-1">
        <p className="mb-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-rose-600">Pro</p>
        <h2 className="mb-0 mt-1 font-display text-[24px] font-extrabold leading-tight tracking-[-0.03em] text-maroon">Smarter tools. Done easier.</h2>
        <p className="mb-0 mt-1.5 text-[14px] text-muted">Advanced analytics, priority support and custom branding — do more with every booking you take.</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Button onClick={() => go(UPGRADE_TO)}>See Pro <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></Button>
      </div>
    </div>
    <button type="button" onClick={onClose} aria-label="Dismiss"
      className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-[10px] text-faint transition hover:bg-cream hover:text-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
      <X className="h-4 w-4" strokeWidth={2.4} />
    </button>
  </div>
);

const PROMO_SCRIM = {
  backgroundImage:
    'linear-gradient(0deg, #710d2d 4%, rgba(119,13,44,0.9) 26%, transparent 82%), linear-gradient(90deg, rgba(100,11,43,0.85), transparent 72%)',
};
const PromoMobile = ({ go, onClose }) => (
  <div className="relative isolate flex min-h-[240px] flex-col justify-end overflow-hidden rounded-[24px] p-5 text-white">
    <img src="/brand/host-lab/promo-bg.jpg" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover object-right" />
    <div aria-hidden="true" className="absolute inset-0 -z-10" style={PROMO_SCRIM} />
    <h2 className="mb-0 max-w-[12ch] font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.035em] text-white">Smarter tools. <span className="text-pink">Done easier.</span></h2>
    <p className="mb-0 mt-2 max-w-[28ch] text-[13.5px] text-white/85">Advanced analytics, priority support and custom branding.</p>
    <button type="button" onClick={() => go(UPGRADE_TO)}
      className="mt-4 inline-flex h-11 w-fit items-center gap-2 rounded-[12px] bg-cream px-5 text-[14px] font-semibold text-maroon-dark transition active:scale-95 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink">
      See Pro <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
    </button>
    <button type="button" onClick={onClose} aria-label="Dismiss"
      className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-[12px] bg-black/25 text-white transition hover:bg-black/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink">
      <X className="h-4 w-4" strokeWidth={2.4} />
    </button>
  </div>
);

/* ── Profile performance — real bookings by status, last 12 months (mobile).
 * (Multi-hue + marigold are a deliberate exception carried from the lab on the
 * founder's spec.) ────────────────────────────────────────────────────────── */
const PERF_STATUS = [
  ['Confirmed', '#960D32'],
  ['Completed', '#E0506F'],
  ['Pending', '#F6C35A'],
  ['Cancelled', '#D4D4D8'],
];
const perfSeg = (i) => (i === 1 || i === 3)
  ? { backgroundImage: `repeating-linear-gradient(45deg, ${PERF_STATUS[i][1]} 0 3px, #ffffff 3px 6px)` }
  : { backgroundColor: PERF_STATUS[i][1] };
const ProfilePerformance = ({ rows }) => {
  const [open, setOpen] = useState(null);
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <Panel title="Bookings by month" subtitle="By status · last 12 months">
      <ul className="flex flex-col gap-1">
        {rows.map((r) => {
          const isOpen = open === r.month;
          return (
            <li key={r.month}>
              <button type="button" onClick={() => setOpen(isOpen ? null : r.month)} aria-expanded={isOpen}
                className="flex w-full items-center gap-3 rounded-[10px] px-1 py-1.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
                <span className={cn('w-8 shrink-0 text-[12px] font-medium', isOpen ? 'text-maroon' : 'text-faint')}>{r.month}</span>
                <div className="flex h-3.5 flex-1 items-stretch">
                  {r.total > 0 && (
                    <span className="flex overflow-hidden rounded-[6px]" style={{ width: `${Math.max((r.total / max) * 100, 3)}%` }}>
                      {r.seg.map((v, i) => (v ? <span key={i} style={{ flex: v, ...perfSeg(i) }} /> : null))}
                    </span>
                  )}
                </div>
                <span className="w-7 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink">{r.total}</span>
              </button>
              {isOpen && (
                <div className="mb-1 ml-11 mr-9 mt-1 rounded-[14px] bg-cream px-3 py-2">
                  {PERF_STATUS.map(([lbl], i) => (
                    <div key={lbl} className="flex items-center justify-between py-1 text-[13px]">
                      <span className="inline-flex items-center gap-2 text-muted"><span className="h-2.5 w-3.5 rounded-[3px]" style={perfSeg(i)} /> {lbl}</span>
                      <span className="font-semibold tabular-nums text-ink">{r.seg[i]}</span>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-neutral-200 pt-3">
        {PERF_STATUS.map(([lbl], i) => (
          <span key={lbl} className="inline-flex items-center gap-1.5 text-[12px] text-muted"><span className="h-2.5 w-3.5 rounded-[3px]" style={perfSeg(i)} /> {lbl}</span>
        ))}
      </div>
    </Panel>
  );
};

const TodayV2 = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const go = useCallback((to) => navigate(to), [navigate]);

  const [balance, setBalance] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [views, setViews] = useState(null);
  const [kyc, setKyc] = useState(null);
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
    ])
      .then(([bal, bk, vw, k]) => { setBalance(bal?.data ?? null); setBookings(bk); setViews(vw); setKyc(k); setStatus('ready'); })
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

  const sources = useMemo(() => {
    const by = {};
    for (const b of bookings) {
      const s = b.source && b.source !== 'manual_cash' ? b.source : null;
      if (!s) continue;
      by[s] = (by[s] || 0) + 1;
    }
    return Object.entries(by).map(([label, bookingsCount]) => ({ label, bookingsCount })).sort((a, b) => b.bookingsCount - a.bookingsCount).slice(0, 4);
  }, [bookings]);
  // One source says nothing ("platform · 13"); only show the split once there is one.
  const showSources = sources.length >= 2;

  // ── Glance metrics — all from the host's own data, none faked.
  const ready = Number(balance?.available) || 0;
  const held = (balance?.clearing || 0) + (balance?.pendingCompletion || 0);
  const moneyTile = !balance
    ? { label: 'Ready to withdraw', value: '—', hint: 'Balance unavailable' }
    : ready > 0 || held === 0
      ? { label: 'Ready to withdraw', value: inr(ready), hint: held ? `${inr(held)} clearing or held` : 'Paid out as bookings clear' }
      // ₹0 ready but money held: lead with the real, useful number (Kept audit).
      : { label: 'Waiting for you', value: inr(held), hint: balance.payoutsBlocked ? '₹0 ready · verify to release' : '₹0 ready · clearing now' };
  const paidBookings = bookings.filter((b) => isPaid(b) && amountOf(b) > 0);
  const avgValue = paidBookings.length ? Math.round(paidBookings.reduce((n, b) => n + amountOf(b), 0) / paidBookings.length) : 0;
  const guestCounts = useMemo(() => {
    const by = {};
    for (const b of bookings) {
      if (lower(b.status) === 'cancelled') continue;
      const k = b.guest_phone || b.guest_email;
      if (k) by[k] = (by[k] || 0) + 1;
    }
    return Object.values(by);
  }, [bookings]);
  const repeatRate = guestCounts.length ? guestCounts.filter((n) => n >= 2).length / guestCounts.length : 0;
  const bookedCount = bookings.filter((b) => lower(b.status) !== 'cancelled').length;
  const convRate = views ? Math.min(bookedCount / views, 1) : null;
  const statusMonths = useMemo(() => statusByMonth(bookings), [bookings]);
  const pageTo = user?.username ? `/${user.username}` : SHARE_TO;

  const tiles = {
    money: <Tile key="money" {...moneyTile} onClick={() => go('/dashboard/payments/payouts')} />,
    month: <Tile key="month" label="This month" value={inr(thisMonth, { compact: true })} delta={delta ?? undefined} deltaLabel="vs last month"
      hint="Paid bookings" spark={series.some((s) => s.revenue) ? <Sparkline values={series.map((s) => s.revenue)} /> : null}
      onClick={() => go('/dashboard/intelligence/revenue')} />,
    upcoming: <Tile key="upcoming" label="Upcoming" value={upcomingList.length} hint={next ? `Next: ${fmtDayFull(next.scheduled_at)}` : 'Nothing scheduled'} onClick={() => go('/dashboard/bookings')} />,
    views: <Tile key="views" label="Page views" value={views == null ? '—' : views.toLocaleString('en-IN')} hint="Your public page" onClick={() => go(pageTo)} />,
    avg: <Tile key="avg" label="Average booking" value={avgValue ? inr(avgValue) : '—'} hint="Per paid booking" onClick={() => go('/dashboard/intelligence/revenue')} />,
    repeat: <Tile key="repeat" label="Repeat clients" value={guestCounts.length ? pct(repeatRate) : '—'} hint="Booked more than once" onClick={() => go('/dashboard/clients')} />,
    conv: <Tile key="conv" label="Booking conversion" value={convRate == null ? '—' : pct(convRate)} hint="Views that booked" onClick={() => go(pageTo)} />,
  };

  const now = new Date();
  const dateLine = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const needsLine = queue.length > 0
    ? <span className="font-semibold text-maroon">{queue.length} thing{queue.length > 1 ? 's' : ''} need{queue.length > 1 ? '' : 's'} you</span>
    : <span>All clear</span>;
  const loading = status === 'loading';

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-4 sm:gap-6">
        <h1 className="mb-0 font-display text-[28px] font-extrabold tracking-[-0.035em] text-maroon sm:text-[34px]">Today</h1>
        <div className="rounded-[24px] bg-white">
          <ErrorState icon={Wallet} title="We couldn't load your day."
            message="Your bookings and payouts are safe. This is a problem showing them. Try again." onRetry={load} />
        </div>
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile: the app screen ───────────────────────────────────────── */}
      <div className="flex flex-col gap-5 lg:hidden">
        <header>
          <p className="mb-0 text-[13px] font-medium text-faint">{dateLine}</p>
          <h1 className="mb-0 mt-0.5 font-display text-[32px] font-extrabold leading-none tracking-[-0.035em] text-maroon">Today</h1>
          <p className="mb-0 mt-1.5 text-[14px] text-muted">{needsLine}{next ? <> · next booking {whenWord(next.scheduled_at)}</> : null}</p>
        </header>
        {loading ? (
          <>
            <Skeleton className="h-[210px] rounded-[28px]" />
            <Skeleton className="h-[120px] rounded-[24px]" />
          </>
        ) : (
          <>
            <TodayBand todays={todays} next={next} onOpen={setOpenId} go={go} compact />
            {queue.length > 0 && <NeedsYou queue={queue} go={go} onResolve={resolve} />}
          </>
        )}
        <Shortcuts go={go} />
        <WeekPanel bookings={bookings} onOpen={setOpenId} go={go} mobile />
        <section aria-labelledby="glance">
          <h2 id="glance" className="mb-3 font-display text-[18px] font-bold tracking-[-0.02em] text-ink">At a glance</h2>
          <div className="dash-noscrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
            {(loading ? [0, 1, 2] : [tiles.money, tiles.month, tiles.avg, tiles.repeat, tiles.conv]).map((t, i) => (
              <div key={loading ? i : t.key} className="w-[44%] min-w-[150px] shrink-0 snap-start">{loading ? <Skeleton className="h-[120px] rounded-[20px]" /> : t}</div>
            ))}
          </div>
        </section>
        {showPromo && <PromoMobile go={go} onClose={() => setPromoClosed(true)} />}
        {!loading && bookedCount > 0 && <ProfilePerformance rows={statusMonths} />}
        {showSources && (
          <Panel title="Where bookings came from" subtitle="By bookings">
            <SourceDonut rows={sources} valueKey="bookingsCount" labelKey="label" stack />
          </Panel>
        )}
      </div>

      {/* ── Desktop: wide, one focal band ────────────────────────────────── */}
      <div className="hidden flex-col gap-6 lg:flex">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="mb-0 font-display text-[34px] font-extrabold leading-[1.05] tracking-[-0.035em] text-maroon">{greeting()}</h1>
            <p className="mb-0 mt-1.5 text-[15px] text-muted">{dateLine} · {needsLine}</p>
          </div>
          <div className="flex items-center gap-2.5">
            <Button variant="secondary" onClick={() => go('/dashboard/catalog')}><Package className="h-4 w-4" strokeWidth={2.2} /> Manage services</Button>
            <Button onClick={() => go(SHARE_TO)}><Share2 className="h-4 w-4" strokeWidth={2.2} /> Share your page</Button>
          </div>
        </header>

        <div className="grid grid-cols-[1.9fr_1fr] gap-4">
          {loading ? <Skeleton className="h-[260px] rounded-[32px]" /> : <TodayBand todays={todays} next={next} onOpen={setOpenId} go={go} />}
          {loading ? <Skeleton className="h-[260px] rounded-[24px]" /> : <NeedsYou queue={queue} go={go} onResolve={resolve} />}
        </div>

        <div className="grid grid-cols-4 gap-4">
          {loading
            ? [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[132px] rounded-[20px]" />)
            : [tiles.money, tiles.month, tiles.upcoming, tiles.views]}
        </div>

        <div className="grid grid-cols-[1.35fr_1fr] items-start gap-4">
          <WeekPanel bookings={bookings} onOpen={setOpenId} go={go} />
          <RecentBookings bookings={bookings} onOpen={setOpenId} go={go} />
        </div>

        {showSources && (
          <Panel title="Where bookings came from" subtitle="By bookings">
            <SourceDonut rows={sources} valueKey="bookingsCount" labelKey="label" />
          </Panel>
        )}
        {showPromo && <PromoDesktop go={go} onClose={() => setPromoClosed(true)} />}
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
    </>
  );
};

export default TodayV2;
