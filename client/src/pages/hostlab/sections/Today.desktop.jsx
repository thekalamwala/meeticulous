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
  AlertTriangle, ArrowRight, CalendarCheck2, CalendarX2, ChevronRight,
  Package, Share2, Star, TrendingDown, TrendingUp, UserPlus, X,
} from 'lucide-react';
import { Button, cn } from '../../../components/dashboard/ui';
import {
  Avatar, Drawer, MeetIcon, NeedsYouModal, Panel, SourceDonut, StatusPill, WhatsAppIcon,
  fmtTime, inr, relDay, useLast,
} from '../labUi';
import mock from '../mockData';

/* ── Quick actions — a grid of icon tiles (mirrors mobile). "Needs you" carries
 * the waiting-count badge and opens the modal; the rest route. ─────────────── */
const QUICK_ACTIONS = [
  { icon: Package, label: 'Manage services', target: 'catalog' },
  { icon: UserPlus, label: 'Add client', target: 'clients' },
  { icon: Share2, label: 'Share booking link', target: 'grow/page' },
  { icon: Star, label: 'View reviews', target: 'grow/proof' },
  { icon: CalendarCheck2, label: 'Availability', target: 'schedule' },
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
        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-rose text-[10px] font-extrabold text-white">
          {badge}
        </span>
      ) : null}
    </span>
    <span className="text-[11px] font-semibold leading-tight text-ink/70">{label}</span>
  </button>
);

const QuickActions = ({ go, onNeedsYou }) => (
  <Panel title="Quick actions" subtitle="Jump to what you do most">
    <div className="grid grid-cols-3 gap-2">
      <QuickActionTile icon={AlertTriangle} label="Needs you" badge={mock.actionQueue.length} onClick={onNeedsYou} />
      {QUICK_ACTIONS.map((q) => (
        <QuickActionTile key={q.label} icon={q.icon} label={q.label} onClick={() => go(q.target)} />
      ))}
    </div>
  </Panel>
);

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
                    className="flex w-full items-center gap-2 rounded-none px-3 py-1.5 text-left transition hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose"
                  >
                    <span className={cn('w-[46px] shrink-0 text-[11.5px] font-bold tabular-nums', past ? 'text-ink/35' : 'text-maroon')}>
                      {fmtTime(b.scheduled_at)}
                    </span>
                    <span aria-hidden="true" className={cn('h-7 w-0.5 shrink-0 rounded-full', past ? 'bg-neutral-200' : 'bg-maroon')} />
                    <span className={cn(past && 'opacity-50')}><Avatar name={b.guest_name} size="h-7 w-7 text-[10px]" /></span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[12px] font-bold', past ? 'text-ink/35' : 'text-ink')}>{b.guest_name}</span>
                      <span className={cn('block truncate text-[11px] font-medium', past ? 'text-ink/30' : 'text-ink/55')}>{b.services.title} · {b.services.duration} min</span>
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
              <Button size="sm" variant="outline"><MeetIcon className="h-4 w-4" /> Join call</Button>
              <Button size="sm" variant="outline"><WhatsAppIcon className="h-4 w-4" /> WhatsApp</Button>
              <Button size="sm" variant="ghost" onClick={() => { setOpenId(null); go(`clients?client=${shown.client_id}`); }}>Open client</Button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
};

/* ── Pro promo — composed to the reference: a roomy maroon card, a translucent
 * sparkle pill, a big two-beat Bricolage headline (second half in pink), two
 * CTAs with arrows, the white camera illustration, and the ee thread large and
 * faint behind, bleeding off the right. Dismissible. Tokens only, no gradient. */
const PromoBanner = ({ go }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="relative isolate overflow-hidden rounded-3xl bg-maroon text-white">
      {/* ee thread — one per layout, large, bleeding off the right, behind all. */}
      <img
        aria-hidden="true"
        src="/brand/ds/02-ee/mt-ee-thread-white.svg"
        alt=""
        className="pointer-events-none absolute right-0 top-1/2 h-[190%] w-auto -translate-y-1/2 translate-x-[14%] -rotate-[18deg] opacity-[0.07]"
      />
      <div className="relative flex items-center gap-6 px-7 py-6 sm:px-9 sm:py-7">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[34px] font-extrabold leading-[1.0] tracking-[-0.045em] text-white sm:text-[46px]">
            Smarter tools. <span className="text-pink">Done easier.</span>
          </h2>
          <p className="mt-3 whitespace-nowrap text-[13px] font-medium leading-snug text-white/70">
            Advanced analytics, priority support and custom branding — do more with every booking you take.
          </p>
          <div className="mt-5 flex items-center gap-5">
            <button
              type="button"
              onClick={() => go('settings/plan')}
              className="inline-flex items-center gap-2 rounded-full bg-pink px-5 py-2.5 text-[13px] font-bold text-maroon-dark transition hover:bg-white focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
            >
              Start free trial <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
            </button>
            <button type="button" onClick={() => go('settings/plan')} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-white/85 transition hover:text-white">
              See what&apos;s included <ArrowRight className="h-4 w-4" strokeWidth={2.6} />
            </button>
          </div>
        </div>

        {/* White camera/live illustration (brand kit) — the art, not a placeholder. */}
        <img
          src="/brand/ds/04-illustrations/mt-illo-live-dark.svg"
          alt=""
          aria-hidden="true"
          className="hidden h-28 w-auto shrink-0 self-center lg:block"
        />
      </div>

      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="absolute right-4 top-4 grid h-7 w-7 place-items-center rounded-full text-white/70 transition hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
      >
        <X className="h-4 w-4" strokeWidth={2.4} />
      </button>
    </div>
  );
};

/* ── KPI card — label, big value, a delta (or hint) + "Show more" footer, and a
 * flat kit illustration on the right (the glance sprite — no 3D mascots). ─── */
// Currency values render the ₹ at baseline and lift the digits 2px, with a 2px
// gap after the symbol. Plain numbers (Upcoming, Page views) pass through.
const CardValue = ({ value }) => {
  const s = String(value);
  if (!s.startsWith('₹')) return s;
  return (
    <>₹<span className="ml-[2px] inline-block -translate-y-[2px]">{s.slice(1)}</span></>
  );
};
const KpiCard = ({ img, label, value, delta, deltaLabel, hint, onClick }) => {
  const up = delta != null && delta >= 0;
  return (
    <div className="flex flex-col rounded-2xl border border-neutral-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(43,10,20,0.03),0_8px_24px_-12px_rgba(43,10,20,0.08)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink/45">{label}</p>
          <p className="mt-1.5 font-display text-[27px] font-extrabold leading-none tracking-[-0.035em] tabular-nums text-ink"><CardValue value={value} /></p>
        </div>
        {/* Raw mascot image — bigger, nudged into the top-right corner. */}
        <img src={img} alt="" aria-hidden="true" className="-mr-1.5 -mt-2.5 h-[76px] w-[76px] shrink-0 object-contain" />
      </div>
      <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-neutral-100 pt-3">
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
        <button
          type="button"
          onClick={onClick}
          className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-ink/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose"
        >
          Show more <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.6} />
        </button>
      </div>
    </div>
  );
};

/* ── Page ──────────────────────────────────────────────────────────────── */
const Today = ({ go }) => {
  const thisMonth = mock.revenueByMonth.at(-1);
  const lastMonth = mock.revenueByMonth.at(-2);
  const delta = Math.round(((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue) * 100);
  const upcoming = mock.bookings.filter((b) => new Date(b.scheduled_at) > new Date() && b.status !== 'cancelled').length;
  const viewsDelta = Math.round(((mock.funnel.views - mock.funnel.views_prev) / mock.funnel.views_prev) * 100);
  const held = mock.payouts.clearing + mock.payouts.pending_completion;
  const [needsOpen, setNeedsOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2.5">
      <PromoBanner go={go} />

      {/* Traffic lives in Intelligence now, so Page views links there. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard img="/brand/host-lab/kpi-withdraw.png" label="Ready to withdraw" value={inr(mock.payouts.available)} hint={`${inr(held)} clearing or held`} onClick={() => go('money/payouts')} />
        <KpiCard img="/brand/host-lab/kpi-month.png" label="This month" value={inr(thisMonth.revenue)} delta={delta} deltaLabel="vs October" onClick={() => go('money/earnings')} />
        <KpiCard img="/brand/host-lab/kpi-upcoming.png" label="Upcoming" value={upcoming} hint="Next 30 days" onClick={() => go('bookings/list')} />
        <KpiCard img="/brand/host-lab/kpi-views.png" label="Page views" value={mock.funnel.views.toLocaleString('en-IN')} delta={viewsDelta} deltaLabel="vs last 30 days" onClick={() => go('intelligence/audience')} />
      </div>

      {/* 33 / 66 — quick actions (with Needs you) beside the day. */}
      <div className="grid gap-2.5 lg:grid-cols-[1fr_2fr]">
        <QuickActions go={go} onNeedsYou={() => setNeedsOpen(true)} />
        <DayTimeline go={go} />
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Panel
          title="Where bookings came from"
          subtitle="Last 30 days"
          action={(
            <Button size="sm" variant="ghost" onClick={() => go('intelligence/audience')}>
              Details <ArrowRight className="h-3 w-3" strokeWidth={2.6} />
            </Button>
          )}
        >
          <SourceDonut rows={mock.trafficSources} valueKey="bookings" labelKey="label" />
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

      <NeedsYouModal open={needsOpen} onClose={() => setNeedsOpen(false)} items={mock.actionQueue} go={go} />
    </div>
  );
};

export default Today;
