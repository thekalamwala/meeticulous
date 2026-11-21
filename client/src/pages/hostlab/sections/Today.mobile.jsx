// Today — the mobile redesign from the standalone proposal, built on-brand.
//
// Layout follows the proposal file: quick actions, a glance strip, weekly
// availability, a day picker + schedule, then where bookings came from. The
// proposal drew the last two as a 3D-icon row and a five-colour donut; both
// break the brand rules (no 3D blobs, no purple/blue, charts are single-hue —
// see labUi.jsx "never a pie, never five hues"), so here the glance cards use
// Lucide marks and the source breakdown is the single-hue RankedBars. Same
// information, same order, same shapes — brand-correct fills.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight, ChevronLeft, ChevronRight, MessageSquare, Package, Share2, Star, UserPlus, Video,
} from 'lucide-react';
import { Button, cn } from '../../../components/dashboard/ui';
import {
  Avatar, Drawer, Panel, RankedBars, StatusPill,
  fmtTime, inr, pct, relDay, useLast,
} from '../labUi';
import mock from '../mockData';

const DAY = 86_400_000;
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const dayHours = (slots = []) => slots.reduce((n, s) => n + (toMin(s.end) - toMin(s.start)) / 60, 0);

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
    let lastX = 0; let lastT = 0; let vx = 0; let raf = 0;
    const stop = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    const glide = () => {
      el.scrollLeft -= vx * 16;     // vx is px/ms; ~16ms a frame
      vx *= 0.92;                   // friction
      raf = Math.abs(vx) > 0.02 ? requestAnimationFrame(glide) : 0;
    };
    const onDown = (e) => {
      if (e.pointerType !== 'mouse') return;
      stop();
      down = true; moved = false; startX = e.clientX; startLeft = el.scrollLeft;
      lastX = e.clientX; lastT = e.timeStamp; vx = 0;
      el.classList.add('cursor-grabbing');
    };
    const onMove = (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      el.scrollLeft = startLeft - dx;
      const dt = e.timeStamp - lastT;
      if (dt > 0) vx = (e.clientX - lastX) / dt;
      lastX = e.clientX; lastT = e.timeStamp;
    };
    const onUp = () => {
      if (!down) return;
      down = false;
      el.classList.remove('cursor-grabbing');
      if (Math.abs(vx) > 0.03) raf = requestAnimationFrame(glide); // momentum on release
    };
    const onClick = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    el.addEventListener('click', onClick, true);
    return () => {
      stop();
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      el.removeEventListener('click', onClick, true);
    };
  }, []);
  return ref;
};

/* ── Quick actions — the four things a host starts from ─────────────────── */
const QuickAction = ({ icon: Icon, label, onClick, accent = false }) => (
  <button type="button" onClick={onClick} className="flex w-[74px] shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none">
    <span className={cn(
      'grid h-14 w-14 place-items-center rounded-full border-2 transition group-hover:-translate-y-0.5',
      accent ? 'border-maroon bg-maroon text-white hover:bg-maroon-dark' : 'border-neutral-200 bg-blush text-maroon hover:border-maroon/40',
    )}>
      <Icon className="h-5 w-5" strokeWidth={2.2} />
    </span>
    <span className="text-center text-[10.5px] font-semibold leading-tight text-ink/70">{label}</span>
  </button>
);

/* ── At a glance — the proposal's illustrated tiles. The four illustrations
 * are one 2×2 sprite (lifted verbatim from the standalone reference), sliced by
 * background-position; each quadrant carries its own coloured ground. ──────── */
const GLANCE_SPRITE = '/brand/host-lab/glance-sprite.png';
const GLANCE_POS = ['0% 0%', '100% 0%', '0% 100%', '100% 100%'];
const Glance = ({ idx, label, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex min-w-[130px] shrink-0 flex-col text-left transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
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

/* ── Weekly availability — single-hue lollipop, bookable hours per day ──── */
const WEEK = [['Mon', 'monday'], ['Tue', 'tuesday'], ['Wed', 'wednesday'], ['Thu', 'thursday'], ['Fri', 'friday'], ['Sat', 'saturday'], ['Sun', 'sunday']];
const Availability = ({ go }) => {
  const hrs = WEEK.map(([lbl, key]) => [lbl, dayHours(mock.availability.weekly_schedule[key])]);
  const max = Math.max(...hrs.map(([, h]) => h), 1);
  return (
    <Panel
      title="Weekly availability"
      subtitle="Bookable hours by day"
      action={<Button size="sm" variant="ghost" onClick={() => go('schedule/hours')}>View hours <ArrowRight className="h-3 w-3" strokeWidth={2.6} /></Button>}
    >
      <div className="flex items-stretch justify-between gap-1" style={{ height: 150 }}>
        {hrs.map(([lbl, h]) => (
          <div key={lbl} className="flex flex-1 flex-col items-center gap-1">
            <span className={cn('text-[10px] font-bold tabular-nums', h ? 'text-maroon' : 'text-ink/30')}>{h ? `${h}h` : 'Off'}</span>
            <div className="flex w-full flex-1 items-end justify-center">
              {h ? (
                <span className="flex flex-col items-center" style={{ height: `${Math.max((h / max) * 100, 8)}%` }}>
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-maroon" />
                  <span className="w-[3px] flex-1 rounded-full bg-maroon/35" />
                </span>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full border-2 border-neutral-300" />
              )}
            </div>
            <span className="text-[10px] font-semibold text-ink/45">{lbl}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
};

/* ── Day picker + schedule — the proposal's date strip and timeline ─────── */
const DaySchedule = ({ go }) => {
  const [sel, setSel] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [openId, setOpenId] = useState(null);

  const stripRef = useRef(null);
  const base = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const strip = useMemo(() => Array.from({ length: 14 }, (_, i) => new Date(base.getTime() + (i - 2) * DAY)), [base]);
  const nudge = (dir) => stripRef.current?.scrollBy({ left: dir * 180, behavior: 'smooth' });

  const items = useMemo(() => mock.bookings
    .filter((b) => sameDay(new Date(b.scheduled_at), sel) && b.status !== 'cancelled')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)), [sel]);

  const booking = mock.bookings.find((b) => b.id === openId) || null;
  const shown = useLast(booking);

  return (
    <div className="flex flex-col gap-2.5">
      {/* Date strip — arrow-nav day cards (redesign per the reference image). */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Earlier days"
          onClick={() => nudge(-1)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 bg-white text-ink/55 transition hover:border-maroon/40 hover:text-maroon"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <div ref={stripRef} className="dash-noscrollbar flex flex-1 gap-2 overflow-x-auto scroll-smooth">
          {strip.map((d) => {
            const on = sameDay(d, sel);
            const today = sameDay(d, base);
            return (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setSel(d)}
                aria-current={on ? 'date' : undefined}
                className={cn(
                  'flex min-w-[62px] shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 px-2.5 py-2 transition',
                  on ? 'border-maroon bg-blush text-maroon' : 'border-neutral-200 bg-white text-ink/70 hover:border-maroon/40',
                )}
              >
                <span className={cn('text-[10.5px] font-semibold', on ? 'text-maroon' : 'text-ink/45')}>
                  {today ? 'Today' : d.toLocaleDateString('en-IN', { weekday: 'short' })}
                </span>
                <span className="whitespace-nowrap font-display text-[13px] font-extrabold leading-none tracking-[-0.02em]">
                  {d.getDate()} {d.toLocaleDateString('en-IN', { month: 'short' })}
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
        title={sel.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        subtitle={items.length ? `${items.length} ${items.length === 1 ? 'booking' : 'bookings'}` : 'Nothing booked'}
        flush
      >
      {items.length === 0 ? (
        <p className="px-3 py-8 text-center text-[11.5px] font-medium text-ink/50">A clear day.</p>
      ) : (
        <ul className="divide-y-2 divide-neutral-200">
          {items.map((b) => {
            const past = new Date(b.scheduled_at) < new Date();
            return (
              <li key={b.id}>
                <button type="button" onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-cream">
                  <span className={cn('w-[52px] shrink-0 text-[11.5px] font-bold tabular-nums', past ? 'text-ink/35' : 'text-maroon')}>{fmtTime(b.scheduled_at)}</span>
                  <span aria-hidden="true" className={cn('h-8 w-0.5 shrink-0 rounded-full', past ? 'bg-neutral-200' : 'bg-maroon')} />
                  <Avatar name={b.guest_name} size="h-8 w-8 text-[10px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-bold text-ink">{b.guest_name}</span>
                    <span className="block truncate text-[11px] font-medium text-ink/55">{b.services.title} · {b.services.duration} min</span>
                  </span>
                  {b.payment_status === 'unpaid' && b.amount > 0 && <StatusPill status="unpaid" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
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
              <Button size="sm"><Video className="h-3.5 w-3.5" strokeWidth={2.4} /> Join call</Button>
              <Button size="sm" variant="outline"><MessageSquare className="h-3.5 w-3.5" strokeWidth={2.4} /> WhatsApp</Button>
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

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="mb-0 font-display text-[20px] font-extrabold tracking-[-0.035em] text-maroon">Today</h1>
        <p className="mt-0.5 text-[12px] font-medium text-ink/55">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {mock.host.city}
        </p>
      </header>

      {/* Quick actions */}
      <section>
        <h2 className="mb-2 font-display text-[12.5px] font-bold tracking-[-0.02em] text-ink">Quick actions</h2>
        <div className="dash-noscrollbar flex gap-2 overflow-x-auto pb-1">
          <QuickAction icon={Package} label="Manage services" accent onClick={() => go('catalog')} />
          <QuickAction icon={UserPlus} label="Add client" onClick={() => go('clients')} />
          <QuickAction icon={Share2} label="Share booking link" onClick={() => go('grow/page')} />
          <QuickAction icon={Star} label="View reviews" onClick={() => go('grow/proof')} />
        </div>
      </section>

      {/* At a glance */}
      <section>
        <h2 className="mb-2 font-display text-[12.5px] font-bold tracking-[-0.02em] text-ink">At a glance</h2>
        <div ref={glanceRef} className="dash-noscrollbar flex cursor-grab select-none gap-2.5 overflow-x-auto pb-1" style={FADE_RIGHT}>
          <Glance idx={0} label="Ready to withdraw" value={inr(mock.payouts.available)} onClick={() => go('money/payouts')} />
          <Glance idx={1} label="Average booking value" value={inr(avgValue)} onClick={() => go('money/earnings')} />
          <Glance idx={2} label="Repeat client rate" value={pct(repeatRate)} onClick={() => go('clients')} />
          <Glance idx={3} label="Booking conversion rate" value={pct(convRate)} onClick={() => go('intelligence/audience')} />
        </div>
      </section>

      {/* Sequence: calendar (day picker) → list (that day's bookings) → chart. */}
      <DaySchedule go={go} />

      <Availability go={go} />

      <Panel
        title="Where bookings came from"
        subtitle="Last 30 days"
        action={<Button size="sm" variant="ghost" onClick={() => go('intelligence/audience')}>Details <ArrowRight className="h-3 w-3" strokeWidth={2.6} /></Button>}
      >
        <RankedBars
          rows={mock.trafficSources}
          valueKey="bookings"
          labelKey="label"
          format={(v) => `${v} booked`}
          secondary={(r) => `${r.views.toLocaleString('en-IN')} views`}
        />
      </Panel>
    </div>
  );
};

export default Today;
