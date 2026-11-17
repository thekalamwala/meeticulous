// Today — what needs doing, then what is happening, then how it is going.
//
// The page opens on a decision, not a salutation. The greeting is gone and the
// header is the shape every other page uses: the name, then the facts — the
// day, the city, and how many things are waiting. Order is deliberate: money
// you can act on, the queue, the day itself, then where it came from.
//
// Replaces the live Overview's four equal-weight tiles (balance + upcoming +
// completed + cancelled). "Completed" and "cancelled" are history, not
// decisions, so they live in Bookings behind a filter.
//
// The rule for this page: every block either names a decision or answers "am I
// growing?" — nothing is here to fill the grid.
import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CalendarCheck2, CalendarX2, Check, Clock,
  IndianRupee, MessageSquare, Share2, Star, UserMinus, Video,
} from 'lucide-react';
import { Button, cn } from '../../../components/dashboard/ui';
import {
  Avatar, Drawer, Panel, Sparkline, StatusPill, Tile,
  fmtTime, inr, relDay, useLast,
} from '../labUi';
import mock from '../mockData';

const KIND_ICON = { confirm: CalendarCheck2, unpaid: IndianRupee, lapsing: UserMinus, review: Star, gap: Clock };
const URGENCY = {
  now: ['Now', 'bg-error-bg text-error-fg'],
  today: ['Today', 'bg-warning-bg text-warning-fg'],
  this_week: ['This week', 'bg-neutral-100 text-ink/55'],
};

/* ── The action queue. The one block that makes this page worth opening. ── */
const ActionQueue = ({ go }) => {
  const [done, setDone] = useState([]);
  const open = mock.actionQueue.filter((a) => !done.includes(a.id));

  if (open.length === 0) {
    return (
      <Panel title="Needs you">
        <p className="flex items-center gap-2 text-[12px] font-semibold text-success-fg">
          <Check className="h-4 w-4 shrink-0" strokeWidth={2.8} />
          All clear. Next booking {relDay(mock.bookings[0].scheduled_at).toLowerCase()} at {fmtTime(mock.bookings[0].scheduled_at)}.
        </p>
      </Panel>
    );
  }

  return (
    <Panel title="Needs you" subtitle={`${open.length} waiting · hardest first`} flush>
      <ul className="divide-y-2 divide-neutral-200">
        {open.map((a) => {
          const Icon = KIND_ICON[a.kind] || AlertTriangle;
          const [word, cls] = URGENCY[a.urgency];
          return (
            <li key={a.id} className="flex items-center gap-2 px-3 py-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xs bg-blush text-maroon">
                <Icon className="h-3.5 w-3.5" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12px] font-bold leading-tight text-ink">{a.title}</span>
                  <span className={cn('rounded-full px-1.5 py-px text-[9.5px] font-bold', cls)}>{word}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-ink/55">{a.detail}</span>
              </span>
              <button
                type="button"
                onClick={() => go(a.target)}
                className="inline-flex h-7 shrink-0 items-center rounded-sm border-2 border-maroon px-2 text-[11px] font-bold text-maroon transition hover:bg-pink-100"
              >
                {a.cta}
              </button>
              <button
                type="button"
                onClick={() => setDone((d) => [...d, a.id])}
                aria-label={`Dismiss: ${a.title}`}
                title="Dismiss"
                className="grid h-7 w-7 shrink-0 place-items-center rounded-xs text-ink/30 transition hover:bg-neutral-100 hover:text-ink/70"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};

/* ── Today's timeline — the live dashboard has no "today" at all ───────── */
const DayTimeline = ({ go }) => {
  const [openId, setOpenId] = useState(null);

  const todays = useMemo(() => {
    const t = new Date().toDateString();
    return mock.bookings
      .filter((b) => new Date(b.scheduled_at).toDateString() === t && b.status !== 'cancelled')
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, []);

  const booking = todays.find((b) => b.id === openId) || null;
  const shown = useLast(booking);

  const totalMin = todays.reduce((n, b) => n + b.services.duration, 0);
  const money = todays.reduce((n, b) => n + (b.payment_status === 'paid' ? b.amount : 0), 0);

  return (
    <>
      <Panel
        title="Today"
        subtitle={todays.length
          ? `${todays.length} bookings · ${Math.floor(totalMin / 60)}h ${totalMin % 60}m · ${inr(money)} collected`
          : 'Nothing booked today'}
        action={(
          <Button size="sm" variant="ghost" onClick={() => go('bookings/week')}>
            Week <ArrowRight className="h-3 w-3" strokeWidth={2.6} />
          </Button>
        )}
        flush
      >
        {todays.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-3 py-8 text-center">
            <CalendarX2 className="h-5 w-5 text-maroon/30" strokeWidth={1.8} />
            <p className="text-[12px] font-bold text-ink">A clear day</p>
            <p className="max-w-xs text-[11px] font-medium text-ink/55">Share your link if you would rather it were not.</p>
            <Button size="sm" className="mt-1" onClick={() => go('grow/page')}>
              <Share2 className="h-3.5 w-3.5" strokeWidth={2.4} /> Share your page
            </Button>
          </div>
        ) : (
          <ul className="divide-y-2 divide-neutral-200">
            {todays.map((b) => {
              const past = new Date(b.scheduled_at) < new Date();
              return (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(b.id)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose"
                  >
                    <span className={cn('w-[46px] shrink-0 text-[11.5px] font-bold tabular-nums', past ? 'text-ink/35' : 'text-maroon')}>
                      {fmtTime(b.scheduled_at)}
                    </span>
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
    </>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Today = ({ go }) => {
  const thisMonth = mock.revenueByMonth.at(-1);
  const lastMonth = mock.revenueByMonth.at(-2);
  const delta = Math.round(((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue) * 100);
  const upcoming = mock.bookings.filter((b) => new Date(b.scheduled_at) > new Date() && b.status !== 'cancelled').length;
  const viewsDelta = Math.round(((mock.funnel.views - mock.funnel.views_prev) / mock.funnel.views_prev) * 100);
  const waiting = mock.actionQueue.length;
  const held = mock.payouts.clearing + mock.payouts.pending_completion;

  return (
    <div className="flex flex-col gap-2.5">
      <header>
        <h1 className="mb-0 font-display text-[17px] font-extrabold tracking-[-0.03em] text-maroon sm:text-[18px]">Today</h1>
        <p className="mt-0.5 text-[12px] font-medium text-ink/55">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {mock.host.city}
          {waiting > 0 && <span className="text-warning-fg"> · {waiting} waiting on you</span>}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile
          accent
          label="Ready to withdraw"
          value={inr(mock.payouts.available)}
          hint={`${inr(held)} clearing or held`}
          onClick={() => go('money/payouts')}
        />
        <Tile
          label="This month"
          value={inr(thisMonth.revenue, { compact: true })}
          delta={delta}
          deltaLabel="vs October"
          spark={<Sparkline values={mock.revenueByMonth.map((m) => m.revenue)} />}
          onClick={() => go('money/earnings')}
        />
        <Tile label="Upcoming" value={upcoming} hint="Next 30 days" onClick={() => go('bookings/list')} />
        <Tile
          label="Page views"
          value={mock.funnel.views.toLocaleString('en-IN')}
          delta={viewsDelta}
          deltaLabel="vs last 30 days"
          onClick={() => go('grow/insights')}
        />
      </div>

      <ActionQueue go={go} />

      <div className="grid gap-2.5 lg:grid-cols-[1.45fr_1fr]">
        <DayTimeline go={go} />

        <div className="flex min-w-0 flex-col gap-2.5">
          <Panel
            title="Where bookings came from"
            subtitle="Last 30 days"
            action={(
              <Button size="sm" variant="ghost" onClick={() => go('grow/insights')}>
                Details <ArrowRight className="h-3 w-3" strokeWidth={2.6} />
              </Button>
            )}
          >
            <ul className="flex flex-col gap-2">
              {mock.trafficSources.slice(0, 4).map((s) => {
                const max = mock.trafficSources[0].views;
                return (
                  <li key={s.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11.5px] font-semibold text-ink/80">{s.label}</span>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink">
                        {s.bookings} <span className="font-medium text-ink/45">booked</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-maroon" style={{ width: `${(s.views / max) * 100}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Latest activity" flush>
            <ul className="divide-y-2 divide-neutral-200">
              {mock.activity.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-start gap-2 px-3 py-1.5">
                  <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', a.kind === 'alert' ? 'bg-error-fg' : a.kind === 'money' ? 'bg-success-fg' : 'bg-pink')} />
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-medium leading-snug text-ink/80">{a.text}</span>
                    <span className="mt-px block text-[10px] font-semibold text-ink/40">{relDay(a.at)} · {fmtTime(a.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default Today;
