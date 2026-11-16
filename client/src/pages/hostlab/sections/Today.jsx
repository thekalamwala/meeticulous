// Today — what the host must do, then what is happening, then how it is going.
//
// Replaces the live Overview's four equal-weight tiles (balance + upcoming +
// completed + cancelled). "Completed" and "cancelled" counts are history, not
// decisions, so they move to Bookings; the space goes to an action queue and
// today's actual timeline. The rule for this page: every block either names a
// decision or answers "am I growing?" — nothing is here to fill the grid.
import { useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowRight, CalendarCheck2, CalendarX2, Check, Clock,
  IndianRupee, MessageSquare, Star, UserMinus, Wallet, Video, Share2,
} from 'lucide-react';
import { Button, Modal, cn } from '../../../components/dashboard/ui';
import { Avatar, Panel, Sparkline, StatusPill, Tile, fmtTime, inr, relDay } from '../labUi';
import mock from '../mockData';

const KIND_ICON = { confirm: CalendarCheck2, unpaid: IndianRupee, lapsing: UserMinus, review: Star, gap: Clock };
const URGENCY = {
  now: ['Now', 'bg-error-bg text-error-fg'],
  today: ['Today', 'bg-warning-bg text-warning-fg'],
  this_week: ['This week', 'bg-neutral-100 text-ink/55'],
};

const greet = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Still up';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

/* ── The action queue. The one block that makes this page worth opening. ── */
const ActionQueue = ({ go }) => {
  const [done, setDone] = useState([]);
  const open = mock.actionQueue.filter((a) => !done.includes(a.id));

  if (open.length === 0) {
    return (
      <Panel title="Needs you" subtitle="Nothing is waiting. That is the goal.">
        <div className="flex items-center gap-2.5 rounded-lg bg-success-bg px-3 py-4">
          <Check className="h-5 w-5 shrink-0 text-success-fg" strokeWidth={2.6} />
          <p className="text-[12px] font-semibold text-success-fg">All clear. Your next booking is {relDay(mock.bookings[0].scheduled_at).toLowerCase()} at {fmtTime(mock.bookings[0].scheduled_at)}.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel
      title="Needs you"
      subtitle={`${open.length} ${open.length === 1 ? 'thing' : 'things'} waiting · hardest first`}
      flush
    >
      <ul className="divide-y-2 divide-neutral-200">
        {open.map((a) => {
          const Icon = KIND_ICON[a.kind] || AlertTriangle;
          const [word, cls] = URGENCY[a.urgency];
          return (
            <li key={a.id} className="flex flex-col gap-2.5 px-3 py-2.5 sm:flex-row sm:items-center">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blush text-maroon">
                <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12.5px] font-bold leading-snug text-ink">{a.title}</p>
                  <span className={cn('rounded-full px-2 py-0.5 text-[9.5px] font-bold', cls)}>{word}</span>
                </div>
                <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-ink/55">{a.detail}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button size="sm" onClick={() => go(a.target)}>{a.cta}</Button>
                <button
                  type="button"
                  onClick={() => setDone((d) => [...d, a.id])}
                  aria-label={`Dismiss: ${a.title}`}
                  title="Dismiss"
                  className="grid h-7 w-7 place-items-center rounded-full text-ink/35 transition hover:bg-neutral-100 hover:text-ink/70"
                >
                  <Check className="h-4 w-4" strokeWidth={2.6} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};

/* ── Today's timeline — the live dashboard has no "today" at all. ──────── */
const DayTimeline = ({ go }) => {
  const [detail, setDetail] = useState(null);
  const todays = useMemo(() => {
    const t = new Date().toDateString();
    return mock.bookings
      .filter((b) => new Date(b.scheduled_at).toDateString() === t && b.status !== 'cancelled')
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  }, []);

  const totalMin = todays.reduce((n, b) => n + b.services.duration, 0);
  const money = todays.reduce((n, b) => n + (b.payment_status === 'paid' ? b.amount : 0), 0);

  return (
    <>
      <Panel
        title="Today"
        subtitle={todays.length ? `${todays.length} bookings · ${Math.floor(totalMin / 60)}h ${totalMin % 60}m booked · ${inr(money)} collected` : 'Nothing booked today'}
        action={<Button size="sm" variant="outline" onClick={() => go('bookings')}>Open calendar</Button>}
        flush
      >
        {todays.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <CalendarX2 className="h-6 w-6 text-maroon/35" strokeWidth={1.8} />
            <p className="text-[12.5px] font-bold text-ink">A clear day</p>
            <p className="max-w-xs text-[11.5px] font-medium text-ink/55">Share your link if you would rather it were not. Most bookings come from an Instagram bio.</p>
            <Button size="sm" className="mt-1" onClick={() => go('grow')}>
              <Share2 className="h-4 w-4" strokeWidth={2.4} /> Share your page
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
                    onClick={() => setDetail(b)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-rose"
                  >
                    <span className={cn('w-[52px] shrink-0 text-[11.5px] font-bold tabular-nums', past ? 'text-ink/35' : 'text-maroon')}>
                      {fmtTime(b.scheduled_at)}
                    </span>
                    <span aria-hidden="true" className={cn('h-7 w-0.5 shrink-0 rounded-full', past ? 'bg-neutral-200' : 'bg-maroon')} />
                    <Avatar name={b.guest_name} size="h-7 w-7 text-[10px]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-bold text-ink">{b.guest_name}</span>
                      <span className="block truncate text-[11px] font-medium text-ink/55">{b.services.title} · {b.services.duration} min</span>
                    </span>
                    <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
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

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.guest_name} · ${detail.ref}` : ''} size="md">
        {detail && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <StatusPill status={detail.status} />
              <StatusPill status={detail.payment_status} />
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-bold text-ink/55">from {detail.source}</span>
            </div>
            <dl className="grid grid-cols-2 gap-2.5 text-[12px]">
              {[
                ['When', `${relDay(detail.scheduled_at)} · ${fmtTime(detail.scheduled_at)}`],
                ['Service', `${detail.services.title} (${detail.services.duration} min)`],
                ['Amount', detail.amount ? `${inr(detail.amount)} · fee ${inr(detail.platform_fee)}` : 'Free'],
                ['Where', detail.location],
                ['Phone', detail.guest_phone],
                ['Email', detail.guest_email],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-ink/40">{k}</dt>
                  <dd className="mt-0.5 font-semibold text-ink/80">{v}</dd>
                </div>
              ))}
            </dl>
            {detail.guest_note && (
              <div className="rounded-lg bg-blush p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-maroon/70">What they wrote</p>
                <p className="mt-1 text-[12px] font-medium text-ink/80">{detail.guest_note}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm"><Video className="h-4 w-4" strokeWidth={2.4} /> Join call</Button>
              <Button size="sm" variant="outline"><MessageSquare className="h-4 w-4" strokeWidth={2.4} /> WhatsApp</Button>
              <Button size="sm" variant="outline" onClick={() => { setDetail(null); go(`clients?client=${detail.client_id}`); }}>Open client</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Today = ({ go }) => {
  const thisMonth = mock.revenueByMonth[mock.revenueByMonth.length - 1];
  const lastMonth = mock.revenueByMonth[mock.revenueByMonth.length - 2];
  const delta = Math.round(((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue) * 100);
  const upcoming = mock.bookings.filter((b) => new Date(b.scheduled_at) > new Date() && b.status !== 'cancelled').length;
  const viewsDelta = Math.round(((mock.funnel.views - mock.funnel.views_prev) / mock.funnel.views_prev) * 100);

  return (
    <div className="flex flex-col gap-3.5">
      <header>
        <h1 className="mb-0 font-display text-[20px] font-extrabold leading-tight tracking-[-0.035em] text-maroon sm:text-[24px]">
          {greet()}, {mock.host.name.split(' ')[0]}.
        </h1>
        <p className="mt-1 text-[13px] font-medium text-ink/55">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · {mock.host.city}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Tile
          accent
          label="Ready to withdraw"
          value={inr(mock.payouts.available)}
          hint={`${inr(mock.payouts.clearing)} still clearing`}
          onClick={() => go('money?tab=payouts')}
        />
        <Tile
          label="This month"
          value={inr(thisMonth.revenue, { compact: true })}
          delta={delta}
          deltaLabel="vs October"
          spark={<Sparkline values={mock.revenueByMonth.map((m) => m.revenue)} />}
          onClick={() => go('money')}
        />
        <Tile label="Upcoming bookings" value={upcoming} hint="Next 30 days" onClick={() => go('bookings')} />
        <Tile label="Page views" value={mock.funnel.views.toLocaleString('en-IN')} delta={viewsDelta} deltaLabel="vs last 30 days" onClick={() => go('grow')} />
      </div>

      <ActionQueue go={go} />

      <div className="grid gap-3.5 lg:grid-cols-[1.35fr_1fr]">
        <DayTimeline go={go} />

        <div className="flex flex-col gap-3.5">
          <Panel title="Where bookings came from" subtitle="Last 30 days" action={<Button size="sm" variant="ghost" onClick={() => go('grow')}>Details <ArrowRight className="h-3.5 w-3.5" /></Button>}>
            <ul className="flex flex-col gap-2">
              {mock.trafficSources.slice(0, 4).map((s) => {
                const max = mock.trafficSources[0].views;
                return (
                  <li key={s.label}>
                    <div className="mb-1 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11.5px] font-semibold text-ink/80">{s.label}</span>
                      <span className="shrink-0 text-[11px] font-bold tabular-nums text-ink">{s.bookings} <span className="font-medium text-ink/45">booked</span></span>
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
                <li key={a.id} className="flex items-start gap-2 px-3 py-2">
                  <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', a.kind === 'alert' ? 'bg-error-fg' : a.kind === 'money' ? 'bg-success-fg' : 'bg-pink')} />
                  <span className="min-w-0">
                    <span className="block text-[11.5px] font-medium leading-snug text-ink/80">{a.text}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold text-ink/40">{relDay(a.at)} · {fmtTime(a.at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Your money" flush>
            <ul className="divide-y-2 divide-neutral-200 text-[12px]">
              {[
                ['Available now', inr(mock.payouts.available), Wallet],
                ['Clearing', inr(mock.payouts.clearing), Clock],
                ['Held until session is done', inr(mock.payouts.pending_completion), CalendarCheck2],
              ].map(([k, v, Icon]) => (
                <li key={k} className="flex items-center gap-2 px-3 py-2">
                  <Icon className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={2.2} />
                  <span className="flex-1 font-medium text-ink/65">{k}</span>
                  <span className="font-bold tabular-nums text-ink">{v}</span>
                </li>
              ))}
            </ul>
            <div className="border-t-2 border-neutral-200 p-2.5">
              <Button size="sm" full onClick={() => go('money?tab=payouts')}>Withdraw {inr(mock.payouts.available)}</Button>
              <p className="mt-2 text-center text-[10px] font-medium text-ink/45">Next automatic payout {relDay(mock.payouts.next_payout_on).toLowerCase()}</p>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

export default Today;
