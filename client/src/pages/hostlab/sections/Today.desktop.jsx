// Today — desktop. Uses the width the phone can't: a KPI row, a two-column
// mid (today's plan + a money/capacity rail), a two-column analytics row
// (performance chart + sources), and a heatmap-with-activity row — the grid
// rhythm borrowed from the reference dashboard, the content from the mobile
// Today, the decision-first order kept from before.
//
// No greeting and no "Today · date" line: the chrome already says which page
// this is, so the page opens straight on the work (dropped at the founder's
// call). Order: do → plan → grow → look back.
import { Fragment, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, BellRing, CalendarPlus, CalendarX2, Check,
  ChevronLeft, ChevronRight, Clock, Gift, IndianRupee, MessageSquare, Package, Share2, Star,
  UserMinus, UserPlus, Video, Wallet,
} from 'lucide-react';
import { Button, cn } from '../../../components/dashboard/ui';
import {
  Avatar, BarChart, Drawer, Panel, RankedBars, StatusPill,
  fmtTime, inr, pct, relDay, useLast,
} from '../labUi';
import mock from '../mockData';

const DAY = 86_400_000;
const sameDay = (a, b) => a.toDateString() === b.toDateString();
const ymd = (d) => new Date(d).toISOString().slice(0, 10);
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const dayHours = (slots = []) => slots.reduce((n, s) => n + (toMin(s.end) - toMin(s.start)) / 60, 0);
const dowIndex = (d) => (d.getDay() + 6) % 7; // Mon = 0

/* ── Hero banner — the reference opened on a full-width promo strip. This host
 * is already Pro, so it carries a referral invite (real data) instead of an
 * upsell. On-brand maroon ground with the ee-thread arc motif, one CTA. ───── */
const PromoBanner = ({ go }) => (
  <div className="relative overflow-hidden rounded-lg border-2 border-maroon bg-maroon px-5 py-4 text-white">
    <span aria-hidden="true" className="absolute -right-10 -top-12 h-36 w-36 rounded-full border-[3px] border-white/10" />
    <span aria-hidden="true" className="absolute -right-2 top-8 h-20 w-20 rounded-full border-[3px] border-white/10" />
    <div className="relative flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/15">
          <Gift className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-extrabold leading-tight tracking-[-0.02em]">Invite a fellow creator — you both earn ₹500</p>
          <p className="mt-0.5 text-[11.5px] font-medium text-white/70">
            {mock.referrals.joined} joined · {inr(mock.referrals.earned)} earned so far
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => go('grow')}
        className="shrink-0 rounded-full bg-white px-4 py-2 text-[12px] font-bold text-maroon transition hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
      >
        Share invite link
      </button>
    </div>
  </div>
);

/* ── Quick actions — the mobile's icon-circle row, not a text toolbar ────── */
const QuickAction = ({ icon: Icon, label, onClick, accent = false }) => (
  <button type="button" onClick={onClick} className="group flex w-[92px] shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none">
    <span className={cn(
      'grid h-14 w-14 place-items-center rounded-full border-2 transition group-hover:-translate-y-0.5',
      accent ? 'border-maroon bg-maroon text-white hover:bg-maroon-dark' : 'border-neutral-200 bg-blush text-maroon hover:border-maroon/40',
    )}>
      <Icon className="h-5 w-5" strokeWidth={2.2} />
    </span>
    <span className="text-center text-[11px] font-semibold leading-tight text-ink/70">{label}</span>
  </button>
);
const QuickActions = ({ go }) => (
  <div className="flex flex-wrap gap-3">
    <QuickAction icon={Package} label="Manage services" accent onClick={() => go('catalog')} />
    <QuickAction icon={UserPlus} label="Add client" onClick={() => go('clients')} />
    <QuickAction icon={Share2} label="Share link" onClick={() => go('grow/page')} />
    <QuickAction icon={Star} label="Reviews" onClick={() => go('grow/proof')} />
  </div>
);

/* ── At a glance — the mobile's illustrated stat tiles, laid out horizontally
 * for a wide screen. One 2×2 sprite sliced by background-position. ────────── */
const GLANCE_SPRITE = '/brand/host-lab/glance-sprite.png';
const GLANCE_POS = ['0% 0%', '100% 0%', '0% 100%', '100% 100%'];
const Glance = ({ idx, label, value, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-3 rounded-xl border-2 border-neutral-200 bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-maroon/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
  >
    <span
      aria-hidden="true"
      className="h-14 w-14 shrink-0 rounded-lg"
      style={{ backgroundImage: `url(${GLANCE_SPRITE})`, backgroundSize: '200% 200%', backgroundPosition: GLANCE_POS[idx] }}
    />
    <span className="min-w-0">
      <span className="block text-[11px] font-semibold leading-tight text-ink/60">{label}</span>
      <span className="mt-0.5 block font-display text-[20px] font-extrabold leading-none tracking-[-0.03em] text-maroon">{value}</span>
    </span>
  </button>
);

/* ── Needs attention — the action queue, two columns on a wide screen ────── */
const KIND_ICON = { confirm: BellRing, unpaid: IndianRupee, lapsing: UserMinus, review: Star, gap: CalendarX2 };
const URGENCY = {
  now: ['Now', 'bg-error-bg text-error-fg'],
  today: ['Today', 'bg-warning-bg text-warning-fg'],
  this_week: ['This week', 'bg-neutral-100 text-ink/55'],
};
const ActionQueue = ({ go }) => {
  const [done, setDone] = useState([]);
  const open = mock.actionQueue.filter((a) => !done.includes(a.id));

  if (open.length === 0) {
    return (
      <Panel title="Needs attention">
        <p className="flex items-center gap-2 text-[12px] font-semibold text-success-fg">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.8} />
          All clear. Next booking {relDay(mock.bookings[0].scheduled_at).toLowerCase()} at {fmtTime(mock.bookings[0].scheduled_at)}.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Needs attention" subtitle={`${open.length} waiting · hardest first`}>
      <div className="grid gap-3 xl:grid-cols-2">
        {open.map((a) => {
          const Icon = KIND_ICON[a.kind] || AlertTriangle;
          const [word, cls] = URGENCY[a.urgency];
          return (
            <div key={a.id} className="flex items-start gap-2.5 rounded-md border-2 border-neutral-200 p-3.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blush text-maroon">
                <Icon className="h-4 w-4" strokeWidth={2.3} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] font-bold leading-snug text-ink">{a.title}</p>
                  <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold', cls)}>{word}</span>
                </div>
                <p className="mt-0.5 text-[11px] font-medium leading-snug text-ink/55">{a.detail}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <button type="button" onClick={() => go(a.target)} className="inline-flex items-center gap-1 text-[11px] font-bold text-maroon hover:text-maroon-dark">
                    {a.cta} <ArrowRight className="h-3 w-3" strokeWidth={2.6} />
                  </button>
                  <button type="button" onClick={() => setDone((d) => [...d, a.id])} className="text-[11px] font-semibold text-ink/35 hover:text-ink/70">Dismiss</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
};

/* ── Day picker + schedule — the mobile strip, at desktop density ────────── */
const DaySchedule = ({ go }) => {
  const [sel, setSel] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [openId, setOpenId] = useState(null);

  const base = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const strip = useMemo(() => Array.from({ length: 14 }, (_, i) => new Date(base.getTime() + (i - 2) * DAY)), [base]);

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

  const totalMin = items.reduce((n, b) => n + b.services.duration, 0);
  const money = items.reduce((n, b) => n + (b.payment_status === 'paid' ? b.amount : 0), 0);

  const booking = items.find((b) => b.id === openId) || null;
  const shown = useLast(booking);

  const nudge = (dir) => setSel((cur) => new Date(cur.getTime() + dir * DAY));

  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label="Earlier day" onClick={() => nudge(-1)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 bg-white text-ink/55 transition hover:border-maroon/40 hover:text-maroon">
          <ChevronLeft className="h-4 w-4" strokeWidth={2.4} />
        </button>
        <div className="dash-noscrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto">
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
                  'flex min-w-[64px] shrink-0 flex-col items-center gap-0.5 rounded-xl border-2 px-2.5 py-2 transition',
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
        <button type="button" aria-label="Later day" onClick={() => nudge(1)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-neutral-200 bg-white text-ink/55 transition hover:border-maroon/40 hover:text-maroon">
          <ChevronRight className="h-4 w-4" strokeWidth={2.4} />
        </button>
      </div>

      <Panel
        title={sel.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        subtitle={items.length
          ? `${items.length} ${items.length === 1 ? 'booking' : 'bookings'} · ${Math.floor(totalMin / 60)}h ${totalMin % 60}m · ${inr(money)} collected`
          : (blocked.has(ymd(sel)) ? 'Blocked' : 'Nothing booked')}
        flush
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
            <CalendarX2 className="h-5 w-5 text-maroon/30" strokeWidth={1.8} />
            <p className="text-[12px] font-bold text-ink">{blocked.has(ymd(sel)) ? 'This day is blocked' : 'A clear day'}</p>
            {next ? (
              <button type="button" onClick={() => setSel(new Date(new Date(next.scheduled_at).setHours(0, 0, 0, 0)))} className="text-[11.5px] font-bold text-maroon hover:text-maroon-dark">
                Next: {relDay(next.scheduled_at)} {fmtTime(next.scheduled_at)} · {next.guest_name}
              </button>
            ) : (
              <p className="text-[11px] font-medium text-ink/55">Nothing coming up.</p>
            )}
          </div>
        ) : (
          <ul className="divide-y-2 divide-neutral-200">
            {items.map((b) => {
              const past = new Date(b.scheduled_at) < new Date();
              return (
                <li key={b.id}>
                  <button type="button" onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose">
                    <span className={cn('w-[46px] shrink-0 text-[11.5px] font-bold tabular-nums', past ? 'text-ink/35' : 'text-maroon')}>{fmtTime(b.scheduled_at)}</span>
                    <span aria-hidden="true" className={cn('h-7 w-0.5 shrink-0 rounded-full', past ? 'bg-neutral-200' : 'bg-maroon')} />
                    <Avatar name={b.guest_name} size="h-7 w-7 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-bold text-ink">{b.guest_name}</span>
                      <span className="block truncate text-[11px] font-medium text-ink/55">{b.services.title} · {b.services.duration} min</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1 sm:flex">
                      <StatusPill status={b.status} />
                      {b.payment_status === 'unpaid' && b.amount > 0 && <StatusPill status="unpaid" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Drawer open={!!booking} onClose={() => setOpenId(null)} title={shown?.guest_name || ''} subtitle={shown ? `${shown.ref} · ${shown.services.title}` : ''}>
        {shown && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusPill status={shown.status} />
              <StatusPill status={shown.payment_status} />
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-ink/55">from {shown.source}</span>
            </div>
            <div className="rounded-sm border-2 border-neutral-200 p-3">
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
            {shown.guest_note && (
              <div className="rounded-sm bg-blush p-2.5">
                <p className="text-[9.5px] font-bold uppercase tracking-wide text-maroon/70">What they wrote</p>
                <p className="mt-1 text-[11.5px] font-medium text-ink/80">{shown.guest_note}</p>
              </div>
            )}
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

/* ── Next payout — rail callout ─────────────────────────────────────────── */
const NextPayout = ({ go }) => {
  const { available, clearing, next_payout_on: on } = mock.payouts;
  return (
    <button
      type="button"
      onClick={() => go('money/payouts')}
      className="flex w-full items-center gap-3 rounded-lg border-2 border-maroon bg-maroon px-3 py-2.5 text-left text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15">
        <Wallet className="h-4 w-4" strokeWidth={2.3} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold uppercase tracking-[0.07em] text-white/70">Ready to withdraw</span>
        <span className="block font-display text-[19px] font-extrabold leading-none tracking-[-0.03em]">{inr(available)}</span>
        <span className="mt-0.5 block text-[10.5px] font-medium text-white/65">{inr(clearing)} clearing · pays out {relDay(on).toLowerCase()}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-white/80" strokeWidth={2.4} />
    </button>
  );
};

/* ── Weekly availability — single-hue lollipop ──────────────────────────── */
const WEEK = [['Mon', 'monday'], ['Tue', 'tuesday'], ['Wed', 'wednesday'], ['Thu', 'thursday'], ['Fri', 'friday'], ['Sat', 'saturday'], ['Sun', 'sunday']];
const Availability = ({ go }) => {
  const hrs = WEEK.map(([lbl, key]) => [lbl, dayHours(mock.availability.weekly_schedule[key])]);
  const max = Math.max(...hrs.map(([, h]) => h), 1);
  return (
    <Panel
      title="Weekly availability"
      subtitle="Bookable hours by day"
      action={<Button size="sm" variant="ghost" onClick={() => go('schedule/hours')}>Hours <ArrowRight className="h-3 w-3" strokeWidth={2.6} /></Button>}
    >
      <div className="flex items-stretch justify-between gap-1" style={{ height: 120 }}>
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

/* ── Booking activity heatmap — weekday × time-of-day, single-hue intensity.
 * Sequential ramp (one measure, light→dark), not a categorical palette — the
 * honest form for "how much", and inside the brand's one-hue chart rule. ──── */
const BUCKETS = [['Morning', 6, 11], ['Midday', 11, 14], ['Afternoon', 14, 18], ['Evening', 18, 23]];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const Heatmap = () => {
  const counts = useMemo(() => {
    const g = BUCKETS.map(() => Array(7).fill(0));
    for (const b of mock.bookings) {
      if (b.status === 'cancelled') continue;
      const d = new Date(b.scheduled_at);
      const row = BUCKETS.findIndex(([, s, e]) => d.getHours() >= s && d.getHours() < e);
      if (row < 0) continue;
      g[row][dowIndex(d)] += 1;
    }
    return g;
  }, []);
  const max = Math.max(1, ...counts.flat());
  return (
    <Panel title="Booking activity" subtitle="When guests book, by weekday">
      <div className="grid gap-1" style={{ gridTemplateColumns: 'auto repeat(7, minmax(0, 1fr))' }}>
        <span />
        {DOW.map((d) => <span key={d} className="pb-0.5 text-center text-[10px] font-bold text-ink/45">{d}</span>)}
        {BUCKETS.map(([label], r) => (
          <Fragment key={label}>
            <span className="self-center whitespace-nowrap pr-2 text-right text-[10px] font-semibold text-ink/50">{label}</span>
            {DOW.map((d, c) => {
              const n = counts[r][c];
              const t = n / max;
              return (
                <span
                  key={d}
                  title={`${label}, ${d}: ${n} booking${n === 1 ? '' : 's'}`}
                  className="grid aspect-square place-items-center rounded-xs text-[9.5px] font-bold tabular-nums"
                  style={{ backgroundColor: n ? `rgba(150,13,50,${0.14 + 0.86 * t})` : '#f4f4f5', color: t > 0.5 ? '#fff' : '#960D32' }}
                >
                  {n || ''}
                </span>
              );
            })}
          </Fragment>
        ))}
      </div>
    </Panel>
  );
};

/* ── Recent activity ────────────────────────────────────────────────────── */
const ACT_ICON = { booking: CalendarPlus, money: IndianRupee, review: Star, product: Package, alert: AlertTriangle };
const RecentActivity = () => (
  <Panel title="Recent activity" subtitle="Newest first" flush>
    <ul className="divide-y-2 divide-neutral-200">
      {mock.activity.map((a) => {
        const Icon = ACT_ICON[a.kind] || Clock;
        return (
          <li key={a.id} className="flex items-start gap-2.5 px-3 py-2">
            <span className={cn('mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full', a.kind === 'alert' ? 'bg-error-bg text-error-fg' : 'bg-blush text-maroon')}>
              <Icon className="h-3.5 w-3.5" strokeWidth={2.3} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11.5px] font-semibold leading-snug text-ink/85">{a.text}</p>
              <p className="mt-0.5 text-[10px] font-medium text-ink/40">{relDay(a.at)} · {fmtTime(a.at)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  </Panel>
);

/* ── Setup nudge — slim, only while the checklist is unfinished ──────────── */
const SetupNudge = ({ go }) => {
  const list = mock.setupChecklist;
  const done = list.filter((s) => s.done).length;
  const nextStep = list.find((s) => !s.done);
  if (!nextStep) return null;
  return (
    <button
      type="button"
      onClick={() => go(nextStep.to)}
      className="flex w-full items-center gap-2.5 rounded-lg border-2 border-marigold-300 bg-marigold-100 px-3 py-2 text-left transition hover:border-marigold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[11.5px] font-bold text-ink">Finish setting up · {list.length - done} left</span>
        <span className="block truncate text-[10.5px] font-medium text-ink/55">Next: {nextStep.label}</span>
      </span>
      <span aria-hidden="true" className="flex shrink-0 gap-0.5">
        {list.map((s, i) => <span key={i} className={cn('h-1.5 w-1.5 rounded-full', s.done ? 'bg-maroon' : 'bg-maroon/20')} />)}
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-maroon" strokeWidth={2.4} />
    </button>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Today = ({ go }) => {
  const paid = mock.bookings.filter((b) => b.amount > 0 && b.payment_status === 'paid');
  const avgValue = paid.length ? Math.round(paid.reduce((n, b) => n + b.amount, 0) / paid.length) : 0;
  const repeatRate = mock.clients.filter((c) => c.bookings_count >= 2).length / mock.clients.length;
  const convRate = mock.funnel.completed / mock.funnel.views;

  return (
    <div className="flex flex-col gap-4">
      <PromoBanner go={go} />
      <QuickActions go={go} />

      {/* At a glance — illustrated stat tiles (from mobile) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Glance idx={0} label="Ready to withdraw" value={inr(mock.payouts.available)} onClick={() => go('money/payouts')} />
        <Glance idx={1} label="Average booking value" value={inr(avgValue)} onClick={() => go('money/earnings')} />
        <Glance idx={2} label="Repeat client rate" value={pct(repeatRate)} onClick={() => go('clients')} />
        <Glance idx={3} label="Booking conversion" value={pct(convRate)} onClick={() => go('intelligence/audience')} />
      </div>

      {/* Do */}
      <ActionQueue go={go} />

      {/* Plan — today's schedule, with a money + capacity rail */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <DaySchedule go={go} />
        <div className="flex min-w-0 flex-col gap-2.5">
          <NextPayout go={go} />
          <Availability go={go} />
        </div>
      </div>

      {/* Grow — performance chart + where it came from */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Booking performance"
          subtitle="Revenue, last 12 months"
          action={<Button size="sm" variant="ghost" onClick={() => go('money/earnings')}>Details <ArrowRight className="h-3 w-3" strokeWidth={2.6} /></Button>}
        >
          <BarChart data={mock.revenueByMonth} valueKey="revenue" labelKey="month" />
        </Panel>
        <Panel
          title="Where bookings came from"
          subtitle="Last 30 days"
          action={<Button size="sm" variant="ghost" onClick={() => go('intelligence/audience')}>Details <ArrowRight className="h-3 w-3" strokeWidth={2.6} /></Button>}
        >
          <RankedBars rows={mock.trafficSources} valueKey="bookings" labelKey="label" format={(v) => `${v} booked`} secondary={(r) => `${r.views.toLocaleString('en-IN')} views`} />
        </Panel>
      </div>

      {/* Look back — heatmap + activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Heatmap />
        <RecentActivity />
      </div>

      <SetupNudge go={go} />
    </div>
  );
};

export default Today;
