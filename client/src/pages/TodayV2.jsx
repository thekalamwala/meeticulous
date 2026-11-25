// Today — dashboard_v2 graduation of the Host Lab "Today" onto the REAL Overview
// data (getPayoutBalance, getHostBookings, getMyProfileViews, getMyKyc). Opens on
// decisions: money you can act on, the queue of things waiting, today's bookings,
// then how it's going. Shown only on the flag-ON path (App picks it in Dashboard).
//
// The action queue is DERIVED from real state (pending confirmations, unpaid
// completed bookings, KYC) — no invented tasks. Revenue sparkline + delta are
// computed from the host's own paid bookings. "Where bookings came from" shows
// only when bookings actually carry a source; nothing is faked.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, ArrowRight, CalendarCheck2, CalendarX2, Check, ChevronDown,
  ChevronLeft, ChevronRight, IndianRupee, Package, Share2, ShieldCheck, Star,
  TrendingDown, TrendingUp, UserPlus, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getPayoutBalance, getHostBookings, getMyProfileViews, getMyKyc } from '../services/api';
import { isFreePlan } from '../utils/themeUtils';
import { Button, EmptyState, ErrorState, Skeleton } from '../components/dashboard/ui';
import {
  Avatar, Drawer, PageHeading, Panel, StatusPill, SourceDonut,
  MeetIcon, WhatsAppIcon, cn, inr, fmtTime, relDay, useLast,
} from '../components/dashboard/ui/v2';

const lower = (s) => String(s || '').toLowerCase();
const amountOf = (b) => Number(b.customer_total ?? b.amount ?? 0) || 0;
const isPaid = (b) => lower(b.payment_status) === 'paid';
const monthKey = (iso) => { const d = new Date(iso); return `${d.getFullYear()}-${d.getMonth()}`; };

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

// Real "needs you" items derived from bookings + kyc. Hardest first.
export const buildQueue = (bookings, kyc, now = Date.now()) => {
  const q = [];
  const kycStatus = lower(kyc?.status || kyc?.kyc_status);
  if (kycStatus && !['approved', 'verified'].includes(kycStatus)) {
    q.push({ id: 'kyc', kind: 'kyc', urgency: 'now', title: 'Verify to get paid', detail: 'Payouts are locked until verification is approved.', cta: 'Verify', to: '/dashboard/kyc' });
  }
  const pending = bookings.filter((b) => lower(b.status) === 'pending' && new Date(b.scheduled_at) > now - 86400000);
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

const KIND_ICON = { kyc: ShieldCheck, confirm: CalendarCheck2, unpaid: IndianRupee };
const URGENCY = { now: ['Now', 'bg-error-bg text-error-fg'], today: ['Today', 'bg-warning-bg text-warning-fg'], this_week: ['This week', 'bg-neutral-100 text-ink/55'] };

const waLink = (phone) => { const d = (phone || '').replace(/\D/g, ''); return d ? `https://wa.me/${d}` : null; };

const UPGRADE_TO = '/dashboard/upgrade';

/* ── Pro promo — shown only to free-plan hosts (isFreePlan), dismissible for the
 * session. Two deliberately different shapes (lab spec): a slim maroon card on
 * desktop, a tall lifestyle-photo card on mobile. Tokens only, no gradient on
 * the desktop one. CTAs route to the real upgrade page. ───────────────────── */
const PromoDesktop = ({ go, onClose }) => (
  <div className="relative isolate overflow-hidden rounded-3xl bg-maroon text-white">
    <img aria-hidden="true" src="/brand/ds/02-ee/mt-ee-thread-white.svg" alt=""
      className="pointer-events-none absolute right-0 top-1/2 h-[190%] w-auto -translate-y-1/2 translate-x-[14%] -rotate-[18deg] opacity-[0.07]" />
    <div className="relative flex items-center gap-6 px-7 py-6 sm:px-9 sm:py-7">
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[34px] font-extrabold leading-[1.0] tracking-[-0.045em] text-white sm:text-[46px]">
          Smarter tools. <span className="text-pink">Done easier.</span>
        </h2>
        <p className="mt-3 text-[13px] font-medium leading-snug text-white/70">
          Advanced analytics, priority support and custom branding — do more with every booking you take.
        </p>
        <div className="mt-5 flex items-center gap-5">
          <button type="button" onClick={() => go(UPGRADE_TO)}
            className="inline-flex items-center gap-2 rounded-full bg-pink px-5 py-2.5 text-[13px] font-bold text-maroon-dark transition hover:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
            See Pro <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
          </button>
          <button type="button" onClick={() => go(UPGRADE_TO)} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-white/85 transition hover:text-white">
            What&apos;s included <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
          </button>
        </div>
      </div>
      <img src="/brand/ds/04-illustrations/mt-illo-live-dark.svg" alt="" aria-hidden="true" className="hidden h-28 w-auto shrink-0 self-center lg:block" />
    </div>
    <button type="button" onClick={onClose} aria-label="Dismiss"
      className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose">
      <X className="h-4 w-4" strokeWidth={2.4} />
    </button>
  </div>
);

const PROMO_SCRIM = {
  backgroundImage:
    'linear-gradient(0deg, #710d2d 4%, rgba(119,13,44,0.9) 26%, transparent 82%), linear-gradient(90deg, rgba(100,11,43,0.85), transparent 72%)',
};
const PromoMobile = ({ go, onClose }) => (
  <div className="relative isolate flex min-h-[256px] flex-col justify-end overflow-hidden rounded-2xl px-4 py-4 text-white">
    <img src="/brand/host-lab/promo-bg.jpg" alt="" aria-hidden="true" className="absolute inset-0 -z-10 h-full w-full object-cover object-right" />
    <div aria-hidden="true" className="absolute inset-0 -z-10" style={PROMO_SCRIM} />
    <div className="relative">
      <h2 className="max-w-[11ch] font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
        Smarter tools. <span className="text-pink">Done easier.</span>
      </h2>
      <p className="mt-1.5 max-w-[26ch] text-[12px] font-medium leading-snug text-white/80">
        Advanced analytics, priority support and custom branding — do more with every booking.
      </p>
      <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={() => go(UPGRADE_TO)}
          className="inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-[12px] font-bold text-maroon-dark transition hover:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
          See Pro <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
        </button>
        <button type="button" onClick={() => go(UPGRADE_TO)} className="inline-flex items-center gap-1 text-[12px] font-bold text-white/90 transition hover:text-white">
          What&apos;s included <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
        </button>
      </div>
    </div>
    <button type="button" onClick={onClose} aria-label="Dismiss"
      className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-black/20 text-white/80 transition hover:bg-black/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose">
      <X className="h-4 w-4" strokeWidth={2.4} />
    </button>
  </div>
);

/* ── KPI card — the Host Lab stat card: big value, a raw kit mascot nudged into
 * the top-right (no border/hover on the image), and a delta-or-hint + "Show
 * more" footer. Used for the four Today tiles on both layouts, on real values.
 * The lab's accent (maroon) tile and inline sparkline are dropped here — the
 * KpiCard treatment is white with a mascot, same as the lab. ──────────────── */
const KpiCard = ({ img, label, value, delta, deltaLabel, hint, onClick }) => {
  const up = delta != null && delta >= 0;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col rounded-2xl border border-neutral-200/80 bg-white p-4 text-left shadow-[0_1px_2px_rgba(43,10,20,0.03),0_8px_24px_-12px_rgba(43,10,20,0.08)] transition hover:border-maroon/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink/45">{label}</p>
          <p className="mt-1.5 font-display text-[23px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink">{value}</p>
        </div>
        <img src={img} alt="" aria-hidden="true" className="pointer-events-none -mr-1.5 -mt-2.5 h-16 w-16 shrink-0 object-contain" />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {delta != null ? (
            <>
              <span className={cn('inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums', up ? 'bg-success-bg text-success-fg' : 'bg-error-bg text-error-fg')}>
                {up ? <TrendingUp className="h-3 w-3" strokeWidth={2.8} /> : <TrendingDown className="h-3 w-3" strokeWidth={2.8} />}
                {up ? '+' : ''}{delta}%
              </span>
              <span className="truncate text-[10.5px] font-medium text-ink/45">{deltaLabel}</span>
            </>
          ) : (
            <span className="truncate text-[11px] font-medium text-ink/45">{hint}</span>
          )}
        </div>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-ink/60">
          Show more <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.6} />
        </span>
      </div>
    </button>
  );
};

/* ── Quick actions — the Host Lab icon-grid panel. The "Needs you" tile carries
 * the waiting-count badge and opens the side drawer; the rest route. Shared by
 * desktop (3-col panel) and the mobile strip below. ───────────────────────── */
const QUICK_ROUTES = [
  { icon: Package, label: 'Manage services', to: '/dashboard/catalog' },
  { icon: UserPlus, label: 'Add client', to: '/dashboard/clients' },
  { icon: Share2, label: 'Share booking link', to: '/dashboard/profile' },
  { icon: Star, label: 'View reviews', to: '/dashboard/testimonials' },
  { icon: CalendarCheck2, label: 'Availability', to: '/dashboard/availability' },
];

const QuickActionTile = ({ icon: Icon, label, onClick, badge }) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex flex-col items-center gap-2 rounded-2xl px-2 py-3 text-center transition hover:bg-blush/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
  >
    <span className="relative grid h-12 w-12 place-items-center rounded-full bg-blush text-maroon transition group-hover:-translate-y-0.5 group-hover:bg-pink/60">
      <Icon className="h-5 w-5" strokeWidth={2.2} />
      {badge ? (
        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-rose text-[10px] font-extrabold text-white">{badge}</span>
      ) : null}
    </span>
    <span className="text-[11px] font-semibold leading-tight text-ink/70">{label}</span>
  </button>
);

const QuickActions = ({ go, onNeedsYou, needsCount }) => (
  <Panel title="Quick actions" subtitle="Jump to what you do most">
    <div className="grid grid-cols-3 gap-2">
      <QuickActionTile icon={AlertTriangle} label="Needs you" badge={needsCount || undefined} onClick={onNeedsYou} />
      {QUICK_ROUTES.map((q) => <QuickActionTile key={q.label} icon={q.icon} label={q.label} onClick={() => go(q.to)} />)}
    </div>
  </Panel>
);

/* ── Needs-you drawer — the real action queue (KYC / confirm / unpaid, hardest
 * first) as a progress checklist. One row expands at a time: detail, the CTA
 * (routes + closes), and ✓ handled (dismisses). Built on the v2 Drawer, which
 * portals to document.body, so the backdrop-blur shell never clips it. ─────── */
const NeedsYouDrawer = ({ open, onClose, items, go, onResolve }) => {
  const [expand, setExpand] = useState(null);
  useEffect(() => { if (open) setExpand(items[0]?.id ?? null); }, [open, items]);
  const total = items.length;
  return (
    <Drawer open={open} onClose={onClose} title="Needs you" subtitle={total ? `${total} waiting · hardest first` : 'All caught up — nicely done.'}>
      {total === 0 ? (
        <p className="flex items-center gap-2 text-[12px] font-semibold text-success-fg">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.8} /> All clear. Nothing needs you right now.
        </p>
      ) : (
        <ul className="divide-y-2 divide-neutral-200 border-y-2 border-neutral-200">
          {items.map((a) => {
            const Icon = KIND_ICON[a.kind] || AlertTriangle;
            const [word, cls] = URGENCY[a.urgency] || URGENCY.this_week;
            const isOpen = expand === a.id;
            return (
              <li key={a.id}>
                <button type="button" onClick={() => setExpand(isOpen ? null : a.id)}
                  className="flex w-full items-center gap-3 py-3 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-dashed border-maroon/40 text-maroon"><Icon className="h-3 w-3" strokeWidth={2.6} /></span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-ink">{a.title}</span>
                  <span className={cn('shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-bold', cls)}>{word}</span>
                  <ChevronDown className={cn('h-4 w-4 shrink-0 text-ink/40 transition-transform', isOpen && 'rotate-180')} strokeWidth={2.4} />
                </button>
                <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="pb-3 pl-9">
                      <p className="text-[11.5px] font-medium leading-snug text-ink/60">{a.detail}</p>
                      <div className="mt-2.5 flex items-center gap-2">
                        <button type="button" onClick={() => { onClose(); go(a.to); }}
                          className="inline-flex items-center gap-1 rounded-full bg-maroon px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose">
                          {a.cta} <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
                        </button>
                        <button type="button" onClick={() => onResolve(a.id)} aria-label="Mark handled" title="Mark handled"
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 text-ink/45 transition hover:border-success-fg hover:text-success-fg"><Check className="h-4 w-4" strokeWidth={2.6} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
};

/* ── Mobile Today — the Host Lab mobile redesign, on real data ──────────────
 * Graduated from pages/hostlab/sections/Today.mobile: quick actions, a glance
 * strip, a day-picker + schedule, then where bookings came from. The lab's
 * weekly-availability lollipop, conversion/repeat-rate glances and per-source
 * view counts are dropped here — the real dashboard has no source for them yet
 * and this page never fakes a number (same rule as the desktop tree). The queue
 * ("Needs you") is kept, not in the lab mock, because it is the real decision
 * surface and dropping it on mobile would hide KYC / confirm / unpaid actions.
 * Receives already-loaded data from TodayV2 so there is one fetch, two layouts.
 * -------------------------------------------------------------------------- */
const QUICK_ACTIONS = [
  { icon: Package, label: 'Manage services', to: '/dashboard/catalog', accent: true },
  { icon: UserPlus, label: 'Add client', to: '/dashboard/clients' },
  { icon: Share2, label: 'Share page', to: '/dashboard/profile' },
  { icon: Star, label: 'Reviews', to: '/dashboard/testimonials' },
];

const TodayMobile = ({ user, go, balance, bookings, views, queue, onNeedsYou, thisMonth, delta, upcoming, sources, money, held, setOpenId, loading, showPromo, onClosePromo }) => {
  const [sel, setSel] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const stripRef = useRef(null);
  const base = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const strip = useMemo(() => Array.from({ length: 14 }, (_, i) => new Date(base.getTime() + (i - 2) * 86_400_000)), [base]);
  const nudge = (dir) => stripRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });
  const sameDay = (a, b) => a.toDateString() === b.toDateString();

  const dayItems = useMemo(() => bookings
    .filter((b) => b.scheduled_at && sameDay(new Date(b.scheduled_at), sel) && lower(b.status) !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)), [bookings, sel]);
  // Booking dots per day on the slider — real bookings only. The lab also showed
  // a dash for blocked/travelling days; there is no availability source on this
  // page yet, so that marker is omitted rather than faked. (ponytail: add the
  // dash once Today loads host availability.)
  const countFor = (d) => bookings.filter((b) => b.scheduled_at && sameDay(new Date(b.scheduled_at), d) && lower(b.status) !== 'cancelled').length;

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="mb-0 font-display text-[20px] font-extrabold tracking-[-0.035em] text-maroon">Today</h1>
        <p className="mt-0.5 text-[12px] font-medium text-ink/55">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}{user?.city ? ` · ${user.city}` : ''}
          {queue.length > 0 && <span className="text-warning-fg"> · {queue.length} waiting on you</span>}
        </p>
      </header>

      {/* Pro promo — free-plan hosts only, tall photo card */}
      {showPromo && <PromoMobile go={go} onClose={onClosePromo} />}

      {/* Quick actions */}
      <section>
        <h2 className="mb-2 font-display text-[12.5px] font-bold tracking-[-0.02em] text-ink">Quick actions</h2>
        <div className="dash-noscrollbar flex gap-2 overflow-x-auto pb-1">
          {queue.length > 0 && (
            <button type="button" onClick={onNeedsYou} className="group flex w-[74px] shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none">
              <span className="relative grid h-14 w-14 place-items-center rounded-full border-2 border-neutral-200 bg-blush text-maroon transition group-hover:-translate-y-0.5 group-hover:border-maroon/40">
                <AlertTriangle className="h-5 w-5" strokeWidth={2.2} />
                <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-rose text-[10px] font-extrabold text-white">{queue.length}</span>
              </span>
              <span className="text-center text-[10.5px] font-semibold leading-tight text-ink/70">Needs you</span>
            </button>
          )}
          {QUICK_ACTIONS.map((a) => (
            <button key={a.label} type="button" onClick={() => go(a.to)} className="group flex w-[74px] shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none">
              <span className={cn('grid h-14 w-14 place-items-center rounded-full border-2 transition group-hover:-translate-y-0.5',
                a.accent ? 'border-maroon bg-maroon text-white hover:bg-maroon-dark' : 'border-neutral-200 bg-blush text-maroon hover:border-maroon/40')}>
                <a.icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="text-center text-[10.5px] font-semibold leading-tight text-ink/70">{a.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* At a glance — real values on the Host Lab mascot cards */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <KpiCard img="/brand/host-lab/kpi-withdraw.png" label="Ready to withdraw" value={money(balance?.available)} hint={`${money(held)} clearing or held`} onClick={() => go('/dashboard/payments/payouts')} />
          <KpiCard img="/brand/host-lab/kpi-month.png" label="This month" value={inr(thisMonth, { compact: true })} delta={delta ?? undefined} deltaLabel="vs last month" onClick={() => go('/dashboard/earnings')} />
          <KpiCard img="/brand/host-lab/kpi-upcoming.png" label="Upcoming" value={upcoming} hint="Not yet past" onClick={() => go('/dashboard/bookings')} />
          <KpiCard img="/brand/host-lab/kpi-views.png" label="Page views" value={views == null ? '—' : views.toLocaleString('en-IN')} hint="Public profile" onClick={() => go(user?.username ? `/${user.username}` : '/dashboard/profile')} />
        </div>
      )}

      {/* Day picker + schedule */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5">
          <button type="button" aria-label="Earlier days" onClick={() => nudge(-1)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 bg-white text-ink/55 transition hover:border-maroon/40 hover:text-maroon">
            <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
          </button>
          <div ref={stripRef} className="dash-noscrollbar flex flex-1 gap-2 overflow-x-auto scroll-smooth">
            {strip.map((d) => {
              const on = sameDay(d, sel);
              const today = sameDay(d, base);
              return (
                <button key={d.toISOString()} type="button" onClick={() => setSel(d)} aria-current={on ? 'date' : undefined}
                  className={cn('flex min-w-[62px] shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 px-2.5 py-2 transition',
                    on ? 'border-maroon bg-blush text-maroon' : 'border-neutral-200 bg-white text-ink/70 hover:border-maroon/40')}>
                  <span className={cn('text-[10.5px] font-semibold', on ? 'text-maroon' : 'text-ink/45')}>
                    {today ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}
                  </span>
                  <span className="whitespace-nowrap font-display text-[13px] font-extrabold leading-none tracking-[-0.02em]">
                    {d.getDate()} {d.toLocaleDateString('en-IN', { month: 'short' })}
                  </span>
                  <span aria-hidden="true" className="mt-1 flex h-1.5 items-center gap-0.5">
                    {Array.from({ length: Math.min(countFor(d), 3) }).map((_, i) => (
                      <span key={i} className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-maroon' : 'bg-maroon/55')} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" aria-label="Later days" onClick={() => nudge(1)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 bg-white text-ink/55 transition hover:border-maroon/40 hover:text-maroon">
            <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>

        <Panel title={sel.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          subtitle={dayItems.length ? `${dayItems.length} ${dayItems.length === 1 ? 'booking' : 'bookings'}` : 'Nothing booked'} flush>
          {dayItems.length === 0 ? (
            <p className="px-3 py-8 text-center text-[11.5px] font-medium text-ink/50">A clear day.</p>
          ) : (
            <ul className="divide-y-2 divide-neutral-200">
              {dayItems.map((b) => {
                const past = new Date(b.scheduled_at) < new Date();
                return (
                  <li key={b.id}>
                    <button type="button" onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose">
                      <span className={cn('w-[52px] shrink-0 text-[11.5px] font-bold tabular-nums', past ? 'text-ink/35' : 'text-maroon')}>{fmtTime(b.scheduled_at)}</span>
                      <span aria-hidden="true" className={cn('h-8 w-0.5 shrink-0 rounded-full', past ? 'bg-neutral-200' : 'bg-maroon')} />
                      <Avatar name={b.guest_name} size="h-8 w-8 text-[10px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-ink">{b.guest_name || 'Guest'}</span>
                        <span className="block truncate text-[11px] font-medium text-ink/55">{b.services?.title || 'Booking'}{b.services?.duration ? ` · ${b.services.duration} min` : ''}</span>
                      </span>
                      {lower(b.payment_status) === 'unpaid' && amountOf(b) > 0 && <StatusPill status="unpaid" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>

      {/* Where bookings came from — real sources only (counts, no faked views) */}
      {sources.length > 0 && (
        <Panel title="Where bookings came from" subtitle="By bookings">
          <SourceDonut rows={sources} valueKey="bookingsCount" labelKey="label" stack />
        </Panel>
      )}
    </div>
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
  const [needsOpen, setNeedsOpen] = useState(false);
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
  const upcoming = useMemo(() => bookings.filter((b) => lower(b.status) !== 'cancelled' && new Date(b.scheduled_at) > Date.now()).length, [bookings]);

  const queue = useMemo(() => buildQueue(bookings, kyc).filter((a) => !dismissed.includes(a.id)), [bookings, kyc, dismissed]);

  const todays = useMemo(() => {
    const t = new Date().toDateString();
    return bookings
      .filter((b) => b.scheduled_at && new Date(b.scheduled_at).toDateString() === t && lower(b.status) !== 'cancelled')
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, [bookings]);
  // Search all bookings, not just today's — the mobile day-picker opens bookings
  // on any selected day through the same drawer.
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

  const money = (v) => (balance ? inr(v ?? 0) : '—');
  const held = (balance?.clearing || 0) + (balance?.pendingCompletion || 0);
  const firstName = (user?.name || 'there').trim().split(/\s+/)[0];

  if (status === 'error') {
    return (
      <div className="flex flex-col gap-2.5">
        <PageHeading title="Today" />
        <ErrorState message="Couldn't load your dashboard." onRetry={load} />
      </div>
    );
  }

  return (
    <>
      {/* Mobile: the graduated Host Lab redesign. Desktop: the existing layout.
          One data load above, two layouts; the booking Drawer below is shared. */}
      <div className="lg:hidden">
        <TodayMobile
          user={user} go={go} balance={balance} bookings={bookings} views={views}
          queue={queue} onNeedsYou={() => setNeedsOpen(true)} thisMonth={thisMonth} delta={delta}
          upcoming={upcoming} sources={sources} money={money} held={held}
          setOpenId={setOpenId} loading={status === 'loading'}
          showPromo={showPromo} onClosePromo={() => setPromoClosed(true)}
        />
      </div>
      <div className="hidden flex-col gap-2.5 lg:flex">
      {showPromo && <PromoDesktop go={go} onClose={() => setPromoClosed(true)} />}
      <PageHeading
        title="Today"
        sub={(
          <>
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            {user?.city ? ` · ${user.city}` : ''}
            {queue.length > 0 && <span className="text-warning-fg"> · {queue.length} waiting on you</span>}
          </>
        )}
      />

      {status === 'loading' ? (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard img="/brand/host-lab/kpi-withdraw.png" label="Ready to withdraw" value={money(balance?.available)} hint={`${money(held)} clearing or held`} onClick={() => go('/dashboard/payments/payouts')} />
          <KpiCard img="/brand/host-lab/kpi-month.png" label="This month" value={inr(thisMonth, { compact: true })} delta={delta ?? undefined} deltaLabel="vs last month" onClick={() => go('/dashboard/earnings')} />
          <KpiCard img="/brand/host-lab/kpi-upcoming.png" label="Upcoming" value={upcoming} hint="Not yet past" onClick={() => go('/dashboard/bookings')} />
          <KpiCard img="/brand/host-lab/kpi-views.png" label="Page views" value={views == null ? '—' : views.toLocaleString('en-IN')} hint="Public profile" onClick={() => go(user?.username ? `/${user.username}` : '/dashboard/profile')} />
        </div>
      )}

      {/* Quick actions (with the Needs-you tile + drawer) beside today's timeline */}
      <div className="grid gap-2.5 lg:grid-cols-[1fr_2fr]">
        {status === 'ready' && <QuickActions go={go} needsCount={queue.length} onNeedsYou={() => setNeedsOpen(true)} />}
        {/* Today's timeline */}
        <Panel title="Today" subtitle={todays.length ? `${todays.length} booking${todays.length > 1 ? 's' : ''}` : 'Nothing booked today'}
          action={<Button size="sm" variant="ghost" onClick={() => go('/dashboard/bookings')}>All bookings <ArrowRight className="h-3 w-3" strokeWidth={2.6} /></Button>} flush>
          {status === 'loading' ? (
            <div className="p-3"><Skeleton className="h-10 w-full" /></div>
          ) : todays.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
              <CalendarX2 className="h-5 w-5 text-maroon/30" strokeWidth={1.8} />
              <p className="text-[12px] font-bold text-ink">A clear day</p>
              <p className="max-w-xs text-[11px] font-medium text-ink/55">Share your link if you'd rather it weren't.</p>
              {user?.username && <Button size="sm" className="mt-1" onClick={() => go('/dashboard/profile')}><Share2 className="h-3.5 w-3.5" strokeWidth={2.4} /> Share your page</Button>}
            </div>
          ) : (
            <ul className="divide-y-2 divide-neutral-200">
              {todays.map((b) => {
                const past = new Date(b.scheduled_at) < new Date();
                return (
                  <li key={b.id}>
                    <button type="button" onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose">
                      <span className={cn('w-[46px] shrink-0 text-[11.5px] font-bold tabular-nums', past ? 'text-ink/35' : 'text-maroon')}>{fmtTime(b.scheduled_at)}</span>
                      <span aria-hidden="true" className={cn('h-7 w-0.5 shrink-0 rounded-full', past ? 'bg-neutral-200' : 'bg-maroon')} />
                      <Avatar name={b.guest_name} size="h-7 w-7 text-[10px]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold text-ink">{b.guest_name || 'Guest'}</span>
                        <span className="block truncate text-[11px] font-medium text-ink/55">{b.services?.title || 'Booking'}{b.services?.duration ? ` · ${b.services.duration} min` : ''}</span>
                      </span>
                      <span className="hidden shrink-0 items-center gap-1 sm:flex">
                        <StatusPill status={lower(b.status)} />
                        {lower(b.payment_status) === 'unpaid' && amountOf(b) > 0 && <StatusPill status="unpaid" />}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {status !== 'loading' && (
            <button type="button" onClick={() => go('/dashboard/bookings')}
              className="flex w-full items-center justify-center gap-1 border-t border-neutral-200/70 px-3 py-2.5 text-[11.5px] font-bold text-maroon transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose">
              View full week <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
            </button>
          )}
        </Panel>
      </div>

      {/* Where bookings came from + recent activity */}
      <div className="grid gap-2.5 lg:grid-cols-2">
        {sources.length > 0 && (
          <Panel title="Where bookings came from" subtitle="By bookings">
            <SourceDonut rows={sources} valueKey="bookingsCount" labelKey="label" />
          </Panel>
        )}
        <Panel title="Recent bookings" flush>
          {bookings.length === 0 ? (
            <div className="p-3"><EmptyState title="No bookings yet" description="New bookings show up here." /></div>
          ) : (
            <ul className="divide-y-2 divide-neutral-200">
              {[...bookings].sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at)).slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-start gap-2 px-3 py-1.5">
                  <Avatar name={b.guest_name} size="h-6 w-6 text-[9px]" />
                  <span className="min-w-0">
                    <span className="block truncate text-[11.5px] font-medium leading-snug text-ink/80">{b.guest_name || 'Guest'} · {b.services?.title || 'booking'}</span>
                    <span className="mt-px block text-[10px] font-semibold text-ink/40">{relDay(b.scheduled_at)} · {fmtTime(b.scheduled_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      </div>

      <Drawer open={!!openId && !!openBooking} onClose={() => setOpenId(null)} title={openBooking?.guest_name || ''} subtitle={openBooking?.services?.title || ''}>
        {openBooking && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={lower(openBooking.status)} />
              {openBooking.payment_status && <StatusPill status={lower(openBooking.payment_status)} />}
            </div>
            <div className="rounded-sm border-2 border-neutral-200 p-3">
              <p className="text-[13px] font-bold text-maroon">{relDay(openBooking.scheduled_at)} · {fmtTime(openBooking.scheduled_at)}</p>
              {openBooking.services?.duration && <p className="mt-0.5 text-[11.5px] font-medium text-ink/55">{openBooking.services.duration} min</p>}
            </div>
            <dl className="grid grid-cols-2 gap-2.5 text-[11.5px]">
              {[['Amount', amountOf(openBooking) ? inr(amountOf(openBooking)) : 'Free'], ['Phone', openBooking.guest_phone || '—'], ['Email', openBooking.guest_email || '—']].map(([k, v]) => (
                <div key={k}><dt className="text-[9.5px] font-bold uppercase tracking-wide text-ink/40">{k}</dt><dd className="mt-0.5 truncate font-semibold text-ink/80">{v}</dd></div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-1.5">
              {openBooking.meet_link && <a href={openBooking.meet_link} target="_blank" rel="noreferrer" className="inline-flex"><Button size="sm" variant="outline"><MeetIcon className="h-4 w-4" /> Join call</Button></a>}
              {waLink(openBooking.guest_phone)
                ? <a href={waLink(openBooking.guest_phone)} target="_blank" rel="noreferrer" className="inline-flex"><Button size="sm" variant="outline"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</Button></a>
                : null}
              <Button size="sm" variant="ghost" onClick={() => { setOpenId(null); go('/dashboard/bookings'); }}>All bookings</Button>
            </div>
          </div>
        )}
      </Drawer>

      <NeedsYouDrawer
        open={needsOpen}
        onClose={() => setNeedsOpen(false)}
        items={queue}
        go={go}
        onResolve={(id) => setDismissed((d) => (d.includes(id) ? d : [...d, id]))}
      />
    </>
  );
};

export default TodayV2;
