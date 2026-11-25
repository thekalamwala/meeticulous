// Today — mobile. Sequence (founder spec): a Pro banner, the calendar slider +
// today's meetings, at-a-glance stats, quick actions, weekly availability drawn
// as a left-to-right bar chart (the desktop Booking-performance look, turned
// horizontal for a phone), then where bookings came from. No heatmap on mobile.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CalendarPlus, ChevronLeft, ChevronRight,
  Package, Share2, Star, UserPlus, X,
} from 'lucide-react';
import { Button, cn } from '../../../components/dashboard/ui';
import {
  Avatar, Drawer, MeetIcon, NeedsYouModal, Panel, SourceDonut, StatusPill, WhatsAppIcon,
  fmtTime, inr, pct, relDay, useLast,
} from '../labUi';
import mock from '../mockData';

const DAY = 86_400_000;
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const ymd = (d) => new Date(d).toISOString().slice(0, 10); // matches mockData's at().slice(0,10)
// Hide the scrollbar and fade the right edge, so a row reads as scrollable
// without a visible track (brand: no raw browser chrome on a phone).
const FADE_RIGHT = {
  maskImage: 'linear-gradient(to right, #000 86%, transparent)',
  WebkitMaskImage: 'linear-gradient(to right, #000 86%, transparent)',
};

// Drag-to-scroll a horizontal row with a MOUSE (touch already scrolls natively,
// so we ignore non-mouse pointers and let the browser's momentum handle those).
// A move past a few px cancels the click, so a drag never fires a card tap.
const useDragScroll = () => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let down = false; let startX = 0; let startLeft = 0; let moved = false;
    const onDown = (e) => {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft;
      el.classList.add('cursor-grabbing');
    };
    const onMove = (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startLeft - dx;
    };
    const onUp = () => { down = false; el.classList.remove('cursor-grabbing'); };
    const onClick = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClick, true);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClick, true);
    };
  }, []);
  return ref;
};

/* ── Pro promo banner — mobile only. A tall photo card (reference layout): the
 * lifestyle image sits behind a maroon gradient, copy anchored to the bottom.
 * This is deliberately a different shape from the slim desktop banner. ────── */
const PROMO_SCRIM = {
  backgroundImage:
    'linear-gradient(0deg, #710d2d 4%, rgba(119,13,44,0.9) 26%, transparent 82%), linear-gradient(90deg, rgba(100,11,43,0.85), transparent 72%)',
};
const PromoBanner = ({ go }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="relative isolate flex min-h-[256px] flex-col justify-end overflow-hidden rounded-2xl px-4 py-4 text-white">
      <img
        src="/brand/host-lab/promo-bg.jpg"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 -z-10 h-full w-full object-cover object-right"
      />
      <div aria-hidden="true" className="absolute inset-0 -z-10" style={PROMO_SCRIM} />
      <div className="relative">
        <h2 className="max-w-[11ch] font-display text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em] text-white">
          Smarter tools. <span className="text-pink">Done easier.</span>
        </h2>
        <p className="mt-1.5 max-w-[26ch] text-[12px] font-medium leading-snug text-white/80">
          Advanced analytics, priority support and custom branding — do more with every booking.
        </p>
        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => go('settings/plan')}
            className="inline-flex items-center gap-1.5 rounded-full bg-cream px-4 py-2 text-[12px] font-bold text-maroon-dark transition hover:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
          >
            Start free trial <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
          </button>
          <button type="button" onClick={() => go('settings/plan')} className="inline-flex items-center gap-1 text-[12px] font-bold text-white/90 transition hover:text-white">
            See what&apos;s included <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-black/20 text-white/80 transition hover:bg-black/35 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
      >
        <X className="h-4 w-4" strokeWidth={2.4} />
      </button>
    </div>
  );
};

/* ── Quick actions — the four things a host starts from ─────────────────── */
const QuickAction = ({ icon: Icon, label, onClick, accent = false, badge }) => (
  <button type="button" onClick={onClick} className="group flex w-[74px] shrink-0 snap-start flex-col items-center gap-1.5 focus-visible:outline-none">
    <span className={cn(
      'relative grid h-14 w-14 place-items-center rounded-full border-2 transition group-hover:-translate-y-0.5',
      accent ? 'border-maroon bg-maroon text-white hover:bg-maroon-dark' : 'border-neutral-200 bg-blush text-maroon hover:border-maroon/40',
    )}>
      <Icon className="h-5 w-5" strokeWidth={2.2} />
      {badge ? (
        <span className="absolute -right-0.5 -top-0.5 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-rose text-[10px] font-extrabold text-white">
          {badge}
        </span>
      ) : null}
    </span>
    <span className="text-center text-[10.5px] font-semibold leading-tight text-ink/70">{label}</span>
  </button>
);

/* ── At a glance — illustrated tiles. The four illustrations are one 2×2 sprite
 * sliced by background-position. ────────────────────────────────────────── */
const GLANCE_SPRITE = '/brand/host-lab/glance-sprite.png';
const GLANCE_POS = ['0% 0%', '100% 0%', '0% 100%', '100% 100%'];
const Glance = ({ idx, label, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-w-[130px] shrink-0 snap-start flex-col text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
  >
    <span
      aria-hidden="true"
      className="aspect-square w-full rounded-xl"
      style={{ backgroundImage: `url(${GLANCE_SPRITE})`, backgroundSize: '200% 200%', backgroundPosition: GLANCE_POS[idx] }}
    />
    <span className="mt-1.5 text-[11px] font-semibold leading-tight text-ink/60">{label}</span>
    <span className="mt-0.5 font-display text-[19px] font-extrabold leading-none tracking-[-0.03em] text-maroon">{value}</span>
  </button>
);

/* ── Profile performance — the desktop Booking-performance chart, rotated to
 * horizontal for a phone: one stacked bar per month, split into the four
 * booking statuses, with a legend. (Multi-hue + marigold are off the kit's
 * single-hue / open-slots-only rules — kept here on the founder's spec.) ──── */
const STATUS = [
  ['Confirmed', '#960D32'], // maroon, solid
  ['Completed', '#E0506F'], // rose, hatched
  ['Pending', '#F6C35A'],   // marigold, solid
  ['Cancelled', '#D4D4D8'], // neutral, hatched
];
const STATUS_SPLIT = [0.54, 0.24, 0.14, 0.08]; // confirmed / completed / pending / cancelled
// Completed and Cancelled read as diagonal hatch; Confirmed and Pending solid.
const segStyle = (i) => (i === 1 || i === 3)
  ? { backgroundImage: `repeating-linear-gradient(45deg, ${STATUS[i][1]} 0 3px, #ffffff 3px 6px)` }
  : { backgroundColor: STATUS[i][1] };
const ProfilePerformance = ({ go }) => {
  const [open, setOpen] = useState(null);
  const rows = mock.revenueByMonth.map((m) => ({
    month: m.month,
    total: m.bookings,
    seg: STATUS_SPLIT.map((r) => Math.round(m.bookings * r)),
  }));
  const max = Math.max(...rows.map((r) => r.total), 1);
  return (
    <Panel
      title="Profile performance"
      subtitle="Bookings by status · last 12 months"
      action={<Button size="sm" variant="ghost" onClick={() => go('intelligence/overview')}>Details <ArrowRight className="h-3 w-3" strokeWidth={2.6} /></Button>}
    >
      <ul className="flex flex-col gap-0.5">
        {rows.map((r) => {
          const isOpen = open === r.month;
          return (
            <li key={r.month}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.month)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
              >
                <span className={cn('w-7 shrink-0 text-[10px] font-bold', isOpen ? 'text-maroon' : 'text-ink/50')}>{r.month}</span>
                <div className="flex h-3.5 flex-1 items-stretch">
                  <span className="flex overflow-hidden rounded-full" style={{ width: `${Math.max((r.total / max) * 100, 3)}%` }}>
                    {r.seg.map((v, i) => (v ? <span key={i} style={{ flex: v, ...segStyle(i) }} /> : null))}
                  </span>
                </div>
                <span className="w-6 shrink-0 text-right text-[10.5px] font-bold tabular-nums text-ink/70">{r.total}</span>
              </button>
              {/* Curtain — the tapped month's breakdown slides open; one at a time. */}
              <div className={cn('grid transition-[grid-template-rows] duration-200 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                <div className="min-h-0 overflow-hidden">
                  <div className="ml-9 mr-8 mb-1 mt-1 rounded-md border-2 border-neutral-200 bg-cream/70 px-3 py-2">
                    {STATUS.map(([label], i) => (
                      <div key={label} className="flex items-center justify-between py-[3px] text-[11px]">
                        <span className="inline-flex items-center gap-2 font-medium text-ink/70">
                          <span className="h-2.5 w-3.5 rounded-[3px]" style={segStyle(i)} /> {label}
                        </span>
                        <span className="font-bold tabular-nums text-ink">{r.seg[i]}</span>
                      </div>
                    ))}
                    <div className="mt-1 flex items-center justify-between border-t-2 border-neutral-200 pt-1.5 text-[11px] font-bold text-maroon">
                      <span>Total</span><span className="tabular-nums">{r.total}</span>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-neutral-100 pt-2.5">
        {STATUS.map(([label], i) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-ink/55">
            <span className="h-2.5 w-3.5 rounded-[3px]" style={segStyle(i)} /> {label}
          </span>
        ))}
      </div>
    </Panel>
  );
};

/* ── Calendar slider + today's meetings — the date strip (with booking dots and
 * a dash for blocked/travelling days) and the selected day's list. ───────── */
const DaySchedule = ({ go }) => {
  const [sel, setSel] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [openId, setOpenId] = useState(null);

  const stripRef = useRef(null);
  const base = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const strip = useMemo(() => Array.from({ length: 14 }, (_, i) => new Date(base.getTime() + (i - 2) * DAY)), [base]);
  const nudge = (dir) => stripRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });

  const blocked = useMemo(() => {
    const set = new Set(mock.availability.blocked_dates);
    for (const o of mock.availability.date_overrides) if (!o.slots.length) set.add(o.date);
    return set;
  }, []);
  const countFor = (d) => mock.bookings.filter((b) => sameDay(new Date(b.scheduled_at), d) && b.status !== 'cancelled').length;

  const items = useMemo(() => mock.bookings
    .filter((b) => sameDay(new Date(b.scheduled_at), sel) && b.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)), [sel]);

  const next = useMemo(() => {
    const end = new Date(sel.getTime() + DAY);
    return mock.bookings
      .filter((b) => new Date(b.scheduled_at) >= end && b.status !== 'cancelled')
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0] || null;
  }, [sel]);

  const booking = mock.bookings.find((b) => b.id === openId) || null;
  const shown = useLast(booking);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Calendar slider — arrow-nav day cards with booking/blocked markers. */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Earlier days"
          onClick={() => nudge(-1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 bg-white text-ink/55 transition hover:border-maroon/40 hover:text-maroon"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <div ref={stripRef} className="dash-noscrollbar flex flex-1 snap-x gap-2 overflow-x-auto scroll-smooth">
          {strip.map((d) => {
            const on = sameDay(d, sel);
            const today = sameDay(d, base);
            const isBlocked = blocked.has(ymd(d));
            const count = isBlocked ? 0 : countFor(d);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setSel(d)}
                aria-current={on ? 'date' : undefined}
                className={cn(
                  'flex min-w-[62px] shrink-0 snap-start flex-col items-center gap-0.5 rounded-xl border-2 px-2.5 py-2 transition',
                  on ? 'border-maroon bg-blush text-maroon' : 'border-neutral-200 bg-white text-ink/70 hover:border-maroon/40',
                )}
              >
                <span className={cn('text-[10.5px] font-semibold', on ? 'text-maroon' : 'text-ink/45')}>
                  {today ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}
                </span>
                <span className="whitespace-nowrap font-display text-[13px] font-extrabold leading-none tracking-[-0.02em]">
                  {d.getDate()} {d.toLocaleDateString('en-IN', { month: 'short' })}
                </span>
                <span aria-hidden="true" className="mt-1 flex h-1.5 items-center gap-0.5">
                  {isBlocked ? (
                    <span className="h-0.5 w-3 rounded-full bg-neutral-300" />
                  ) : count ? (
                    Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span key={i} className={cn('h-1.5 w-1.5 rounded-full', on ? 'bg-maroon' : 'bg-maroon/55')} />
                    ))
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-label="Later days"
          onClick={() => nudge(1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 bg-white text-ink/55 transition hover:border-maroon/40 hover:text-maroon"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>

      <Panel
        title={sameDay(sel, base) ? "Today's meetings" : sel.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        subtitle={items.length ? `${items.length} ${items.length === 1 ? 'booking' : 'bookings'}` : (blocked.has(ymd(sel)) ? 'Blocked' : 'Nothing booked')}
        flush
      >
      {items.length === 0 ? (
        blocked.has(ymd(sel)) ? (
          <div className="px-4 py-7 text-center">
            <p className="text-[11.5px] font-medium text-ink/50">This day is blocked.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
            <span className="mb-0.5 grid h-10 w-10 place-items-center rounded-full bg-blush text-maroon">
              <CalendarPlus className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <p className="font-display text-[14px] font-extrabold tracking-[-0.02em] text-ink">A clear day ahead</p>
            <p className="max-w-[240px] text-[11.5px] font-medium leading-snug text-ink/55">
              Share your booking link and let guests grab a slot before it&apos;s gone.
            </p>
            <Button size="sm" className="mt-1.5" onClick={() => go('grow/page')}>
              <Share2 className="h-3.5 w-3.5" strokeWidth={2.4} /> Share booking link
            </Button>
            {next && (
              <button type="button" onClick={() => setSel(new Date(new Date(next.scheduled_at).setHours(0, 0, 0, 0)))} className="mt-1 text-[11px] font-bold text-maroon/70 transition hover:text-maroon">
                Next booking {relDay(next.scheduled_at)} · {fmtTime(next.scheduled_at)}
              </button>
            )}
          </div>
        )
      ) : (
        <ul className="divide-y-2 divide-neutral-200">
          {items.map((b) => {
            const past = new Date(b.scheduled_at) < new Date();
            return (
              <li key={b.id}>
                <button type="button" onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-2 rounded-none px-3 py-2 text-left transition hover:bg-cream">
                  <span className={cn('w-[52px] shrink-0 text-[11.5px] font-bold tabular-nums', past ? 'text-ink/35' : 'text-maroon')}>{fmtTime(b.scheduled_at)}</span>
                  <span aria-hidden="true" className={cn('h-8 w-0.5 shrink-0 rounded-full', past ? 'bg-neutral-200' : 'bg-maroon')} />
                  <span className={cn(past && 'opacity-50')}><Avatar name={b.guest_name} size="h-8 w-8 text-[10px]" /></span>
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-[12px] font-bold', past ? 'text-ink/35' : 'text-ink')}>{b.guest_name}</span>
                    <span className={cn('block truncate text-[11px] font-medium', past ? 'text-ink/30' : 'text-ink/55')}>{b.services.title} · {b.services.duration} min</span>
                  </span>
                  {b.payment_status === 'unpaid' && b.amount > 0 && <StatusPill status="unpaid" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
        <button
          type="button"
          onClick={() => go('bookings/week')}
          className="flex w-full items-center justify-center gap-1 border-t border-neutral-200/70 px-3 py-2.5 text-[11.5px] font-bold text-maroon transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose"
        >
          View full week <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.6} />
        </button>
      </Panel>

      <Drawer
        open={!!booking}
        onClose={() => setOpenId(null)}
        title={shown?.guest_name || ''}
        subtitle={shown ? `${shown.ref} · ${shown.services.title}` : ''}
      >
        {shown && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={shown.status} />
              <StatusPill status={shown.payment_status} />
            </div>
            <div className="rounded-md border-2 border-neutral-200 p-3">
              <p className="text-[13px] font-bold text-maroon">{relDay(shown.scheduled_at)} · {fmtTime(shown.scheduled_at)}</p>
              <p className="mt-0.5 text-[11.5px] font-medium text-ink/55">{shown.services.duration} min · {shown.location}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2.5 text-[11.5px]">
              {[
                ['Amount', shown.amount ? inr(shown.amount) : 'Free'],
                ['You keep', shown.amount ? inr(shown.amount - shown.platform_fee) : '—'],
                ['Phone', shown.guest_phone],
                ['Email', shown.guest_email],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[9.5px] font-bold uppercase tracking-wide text-ink/40">{k}</dt>
                  <dd className="mt-0.5 truncate font-semibold text-ink/80">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" variant="outline"><MeetIcon className="h-4 w-4" /> Join call</Button>
              <Button size="sm" variant="outline"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</Button>
              <Button size="sm" variant="ghost" onClick={() => { setOpenId(null); go(`clients?client=${shown.client_id}`); }}>Open client</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Today = ({ go }) => {
  const paid = mock.bookings.filter((b) => b.amount > 0 && b.payment_status === 'paid');
  const avgValue = paid.length ? Math.round(paid.reduce((n, b) => n + b.amount, 0) / paid.length) : 0;
  const repeatRate = mock.clients.filter((c) => c.bookings_count >= 2).length / mock.clients.length;
  const convRate = mock.funnel.completed / mock.funnel.views;
  const glanceRef = useDragScroll();
  const [needsOpen, setNeedsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      {/* 1. Banner */}
      <PromoBanner go={go} />

      {/* 2 + 3. Calendar slider + today's meetings */}
      <DaySchedule go={go} />

      {/* 4. At a glance */}
      <section>
        <h2 className="mb-2 font-display text-[12.5px] font-bold tracking-[-0.02em] text-ink">At a glance</h2>
        <div ref={glanceRef} className="dash-noscrollbar flex cursor-grab snap-x select-none gap-2.5 overflow-x-auto pb-1" style={FADE_RIGHT}>
          <Glance idx={0} label="Ready to withdraw" value={inr(mock.payouts.available)} onClick={() => go('money/payouts')} />
          <Glance idx={1} label="Average booking value" value={inr(avgValue)} onClick={() => go('money/earnings')} />
          <Glance idx={2} label="Repeat client rate" value={pct(repeatRate)} onClick={() => go('clients')} />
          <Glance idx={3} label="Booking conversion rate" value={pct(convRate)} onClick={() => go('intelligence/audience')} />
        </div>
      </section>

      {/* 5. Quick actions */}
      <section>
        <h2 className="mb-2 font-display text-[12.5px] font-bold tracking-[-0.02em] text-ink">Quick actions</h2>
        <div className="dash-noscrollbar -mx-1 flex snap-x gap-2 overflow-x-auto px-1 py-2">
          <QuickAction icon={AlertTriangle} label="Needs you" badge={mock.actionQueue.length} onClick={() => setNeedsOpen(true)} />
          <QuickAction icon={Package} label="Manage services" accent onClick={() => go('catalog')} />
          <QuickAction icon={UserPlus} label="Add client" onClick={() => go('clients')} />
          <QuickAction icon={Share2} label="Share booking link" onClick={() => go('grow/page')} />
          <QuickAction icon={Star} label="View reviews" onClick={() => go('grow/proof')} />
        </div>
      </section>

      {/* 6. Profile performance — Booking-performance chart layout */}
      <ProfilePerformance go={go} />

      {/* 7. Where bookings came from */}
      <Panel
        title="Where bookings came from"
        subtitle="Last 30 days"
        action={<Button size="sm" variant="ghost" onClick={() => go('intelligence/audience')}>Details <ArrowRight className="h-3 w-3" strokeWidth={2.6} /></Button>}
      >
        <SourceDonut rows={mock.trafficSources} valueKey="bookings" labelKey="label" stack />
      </Panel>

      <NeedsYouModal open={needsOpen} onClose={() => setNeedsOpen(false)} items={mock.actionQueue} go={go} />
    </div>
  );
};

export default Today;
