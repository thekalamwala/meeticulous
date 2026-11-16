// ─────────────────────────────────────────────────────────────────────────────
// Intelligence — Creator Intelligence, the Pro magnet.
//
// Four tabs, one job each (design doc §8):
//   Overview  — what is staying free costing me, and what do I do today?
//   Revenue   — where did it actually go, and what is coming?
//   Audience  — who arrives, and where do they fall out?
//   Demand    — when am I wanted, and who keeps coming back?
//
// Two things make this different from every competitor's analytics tab:
// commission is shown as money the host is losing, and the host is benchmarked
// against anonymised peers. Both run on data Meeticulous already holds.
//
// GATING (founder decision, 2026-11-16): Money/Revenue stays FREE — PLAN_MATRIX
// already promises free hosts "Earnings & transaction history" and "Commission
// tracker", so paywalling it would break a published promise and gate data they
// can reach one click away. Pro gates the six things promised to nobody:
// forecast, win-back list, peer benchmarks, Audience & Conversion, cohorts/LTV,
// and the weekly moves.
//
// The "View as" control is PROTOTYPE-ONLY — it exists so a reviewer can see the
// free host's locked experience without switching accounts. It ships nowhere.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import {
  ArrowRight, Clock, Download, Sparkles, Star, Target, TrendingDown, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Tabs, cn } from '../../../components/dashboard/ui';
import { BarChart, Funnel, Panel, RankedBars, Tile, inr, pct, useUrlTab } from '../labUi';
import {
  AsOf, CohortTable, Delta, Empty, Explain, Heatmap, InsightCard, LineChart,
  Locked, RangeControls, SortableTable, Waterfall, rate,
} from '../intelUi';
import intel from '../intelData';

const soon = (what) => toast.success(what);

/* ═══ Overview ════════════════════════════════════════════════════════════ */

const CommissionLeak = ({ isFree }) => {
  const { paidThisFy, runRateYear, proPrice, paybackDays, monthlyIfFree } = intel.leak;
  // The blunt line only fires once what they've paid exceeds what Pro costs —
  // the parent design's locked decision D1.
  const blunt = (isFree ? monthlyIfFree * 3 : paidThisFy) > proPrice;
  const paid = isFree ? monthlyIfFree * 3 : paidThisFy;

  return (
    <div className="rounded-xl border-2 border-maroon bg-maroon p-3.5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-white/60">
            Commission {isFree ? 'you are paying' : 'you paid before Pro'}
          </p>
          <p className="mt-1 font-display text-[28px] font-extrabold leading-none tracking-[-0.04em]">{inr(paid)}</p>
          <p className="mt-1.5 max-w-md text-[12.5px] font-medium leading-snug text-white/75">
            {blunt
              ? <>That is more than Pro costs for a whole year. Pro is {inr(proPrice)} and takes your commission to <span className="font-bold text-white">0%</span>.</>
              : <>Pro is {inr(proPrice)} a year and takes your commission to 0%.</>}
          </p>
        </div>
        {isFree && (
          <button
            type="button"
            onClick={() => soon('Opens /dashboard/upgrade?src=intel-overview')}
            className="shrink-0 rounded-full bg-white px-3.5 py-2 text-[12.5px] font-bold text-maroon transition hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
          >
            Go Pro
          </button>
        )}
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-white/15 sm:grid-cols-3">
        {[
          ['At your pace, this year', inr(runRateYear)],
          ['Pro costs', `${inr(proPrice)}/yr`],
          ['Pro pays for itself in', `${paybackDays} days`],
        ].map(([k, v]) => (
          <div key={k} className="bg-maroon px-2.5 py-2">
            <dt className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-white/55">{k}</dt>
            <dd className="mt-0.5 font-display text-[15px] font-extrabold tracking-[-0.02em]">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10.5px] font-medium text-white/50">
        A run rate, not a promise — it assumes your last 90 days continue.
      </p>
    </div>
  );
};

const WinBack = () => (
  <Panel
    title="Win these guests back"
    subtitle={`${intel.customers.winBack.length} guests, ₹${intel.customers.winBack.reduce((s, g) => s + g.ltv, 0).toLocaleString('en-IN')} of past spend, nothing booked in 60+ days`}
    action={<Button variant="outline" onClick={() => soon('Sends all four a rebook nudge through the existing notify rail')}>Nudge all</Button>}
  >
    <ul className="flex flex-col divide-y divide-neutral-100">
      {intel.customers.winBack.map((g) => (
        <li key={g.label} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blush text-[11px] font-bold text-maroon">
            {g.label.split(' ').map((n) => n[0]).join('')}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12.5px] font-bold text-ink">{g.label}</p>
            <p className="truncate text-[11px] font-medium text-ink/50">
              {g.bookings} bookings · last was {g.service} · {g.daysSince} days ago
            </p>
          </div>
          <span className="shrink-0 text-right">
            <span className="block font-display text-[14px] font-extrabold text-ink">{inr(g.ltv)}</span>
            <span className="block text-[9.5px] font-bold uppercase tracking-wide text-ink/40">lifetime</span>
          </span>
          <Button variant="ghost" onClick={() => soon(`Opens a rebook nudge for ${g.label}`)}>Nudge</Button>
        </li>
      ))}
    </ul>
  </Panel>
);

const Benchmark = ({ data }) => {
  if (data.suppressed) {
    return (
      <Panel title="How you compare" subtitle="Anonymised, against hosts like you">
        <Empty
          title="Not enough hosts yet"
          body={`We only compare you once at least 5 ${data.cohortLabel.toLowerCase()} are active, so no one can be identified from an average. Right now there are ${data.hostCount}.`}
        />
      </Panel>
    );
  }
  return (
    <Panel
      title="How you compare"
      subtitle={`Against ${data.hostCount} other ${data.cohortLabel.toLowerCase()} — anonymised, aggregates only`}
    >
      <ul className="flex flex-col gap-2.5">
        {data.rows.map((r) => {
          const fmt = (v) => (r.isPct ? rate(v) : inr(v));
          return (
            <li key={r.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-semibold text-ink/80">{r.label}</span>
                <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-ink">
                  {fmt(r.you)}
                  <span className="ml-1.5 font-medium text-ink/45">median {fmt(r.median)}</span>
                </span>
              </div>
              <div className="relative h-2 w-full rounded-full bg-neutral-100">
                <span className="absolute inset-y-0 left-1/2 w-px bg-ink/20" aria-hidden="true" />
                <div
                  className={cn('h-full rounded-full', r.better ? 'bg-maroon' : 'bg-rose')}
                  style={{ width: `${r.percentile}%` }}
                />
              </div>
              <p className="mt-1 text-[11px] font-medium text-ink/45">
                {r.better
                  ? `Ahead of ${r.percentile}% of them.`
                  : `Behind — only ${r.percentile}% of them do worse. This is where the money is.`}
              </p>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
};

const GoalStrip = () => {
  const g = intel.goal;
  return (
    <Panel
      title="This month's target"
      subtitle={`${inr(g.achieved)} of ${inr(g.target)}`}
      action={<Button variant="ghost" onClick={() => soon('Opens an inline target editor')}>Change</Button>}
    >
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
        <div className="h-full rounded-full bg-maroon" style={{ width: `${g.progress * 100}%` }} />
      </div>
      <p className="mt-2 text-[12px] font-medium text-ink/60">
        <span className="font-bold text-ink">{inr(g.remaining)}</span> to go — about{' '}
        <span className="font-bold text-ink">{g.bookingsNeeded} more bookings</span> at your current average.
        On your current pace you get there around <span className="font-bold text-ink">{g.projectedDate}</span>.
      </p>
    </Panel>
  );
};

const Overview = ({ isFree, go }) => {
  const { money, audience, reputation } = intel;
  return (
    <div className="flex flex-col gap-3">
      <CommissionLeak isFree={isFree} />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Tile label="Net revenue" value={inr(money.net, { compact: true })} delta={money.deltas.net} onClick={() => go?.('money')} more="Money" />
        <Tile label="Paid bookings" value={money.paidBookings} delta={money.deltas.bookings} onClick={() => go?.('bookings')} more="Bookings" />
        <Tile label="Profile views" value={audience.visitors.toLocaleString('en-IN')} delta={audience.deltas.visitors} hint={`tracked since ${audience.trackingSince}`} />
        <Tile label="View → book" value={rate(money.paidBookings / audience.visitors)} delta={audience.deltas.conversion} />
      </div>

      <Panel
        title="This week's 3 moves"
        subtitle="Each one carries the numbers behind it"
        action={<span className="inline-flex items-center gap-1 text-[11px] font-bold text-maroon"><Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} /> Updated Monday</span>}
      >
        {isFree ? (
          <Locked
            headline={`Three moves worth about ${inr(14_400)} this month`}
            sub="Your numbers are already here. Pro turns them into what to do next."
            src="intel-moves"
            onUpgrade={() => soon('Opens /dashboard/upgrade?src=intel-moves')}
          >
            <ul className="flex flex-col gap-2">
              {intel.insights.map((i) => <InsightCard key={i.id} insight={i} />)}
            </ul>
          </Locked>
        ) : (
          <ul className="flex flex-col gap-2">
            {intel.insights.map((i) => (
              <InsightCard key={i.id} insight={i} onAct={(ins) => soon(`${ins.action}: wired to the real action in phase 3`)} />
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        {isFree ? (
          <Locked
            headline={`${intel.customers.winBack.length} past guests worth ${inr(intel.customers.winBack.reduce((s, g) => s + g.ltv, 0))}`}
            sub="They haven't booked in 60+ days. Pro shows you who, and nudges them in one tap."
            src="intel-winback"
            onUpgrade={() => soon('Opens /dashboard/upgrade?src=intel-winback')}
          >
            <WinBack />
          </Locked>
        ) : <WinBack />}

        {isFree ? (
          <Locked
            headline="You price above the median — but convert below it"
            sub="See exactly where you sit against other nutritionists."
            src="intel-benchmark"
            onUpgrade={() => soon('Opens /dashboard/upgrade?src=intel-benchmark')}
          >
            <Benchmark data={intel.benchmark} />
          </Locked>
        ) : <Benchmark data={intel.benchmark} />}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Revenue and bookings" subtitle="Last 12 months">
          <LineChart
            series={[
              { key: 'Revenue', data: money.byMonth },
              { key: 'Bookings', data: money.bookingsByMonth.map((d) => ({ ...d, value: d.value * 1_600 })), dashed: true },
            ]}
          />
          <p className="mt-1.5 text-[10.5px] font-medium text-ink/45">
            Bookings are scaled to share the revenue axis — hover any month for the real counts.
          </p>
        </Panel>

        <div className="flex flex-col gap-3">
          <GoalStrip />
          <Panel
            title="Your biggest leak"
            action={<Button variant="ghost" onClick={() => go?.('intelligence')}>Funnel</Button>}
          >
            <p className="font-display text-[15px] font-extrabold leading-snug tracking-[-0.02em] text-ink">
              {audience.bottleneck.step}
            </p>
            <p className="mt-1 text-[12px] font-medium leading-snug text-ink/60">{audience.bottleneck.note}</p>
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-rose/15 px-2 py-1 text-[11px] font-bold text-maroon">
              <TrendingDown className="h-3.5 w-3.5" strokeWidth={2.6} /> {pct(audience.bottleneck.drop)} drop
            </span>
          </Panel>
          <Panel title="Reputation" action={<Button variant="ghost" onClick={() => soon('Opens Grow › Social proof')}>Reviews</Button>}>
            <div className="flex items-center gap-2.5">
              <Star className="h-7 w-7 fill-marigold text-marigold" strokeWidth={1.5} />
              <div>
                <p className="font-display text-[22px] font-extrabold leading-none tracking-[-0.03em] text-ink">{reputation.rating}</p>
                <p className="text-[11px] font-medium text-ink/50">{reputation.reviews} reviews · +{reputation.delta} this month</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
};

/* ═══ Revenue ═════════════════════════════════════════════════════════════ */

const REV_TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'breakdown', label: 'Breakdown' },
  { value: 'forecast', label: 'Forecast' },
  { value: 'transactions', label: 'Transactions' },
];

const Revenue = ({ isFree }) => {
  const [sub, setSub] = useState('overview');
  const m = intel.money;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs tabs={REV_TABS} value={sub} onChange={setSub} className="border-0" />
        <Button variant="outline" onClick={() => soon('Downloads this view as CSV')}>
          <Download className="h-4 w-4" strokeWidth={2.4} /> Export
        </Button>
      </div>

      {sub === 'overview' && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Tile label="Gross" value={inr(m.gross, { compact: true })} delta={m.deltas.gross} />
            <Tile label="Net — yours" value={inr(m.net, { compact: true })} delta={m.deltas.net} accent />
            <Tile label="Average booking" value={inr(m.aov)} delta={m.deltas.aov} />
            <Tile label="Pending payout" value={inr(m.pendingPayout, { compact: true })} hint="clears in 2–3 days" />
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel
              title="Gross to net"
              subtitle="Every rupee deducted, named"
              action={<Explain>Net is gross minus the platform fee, GST on that fee, the payment gateway&apos;s cut and refunds. This is the number that should match your bank.</Explain>}
            >
              <Waterfall rows={m.waterfall} />
              <p className="mt-2.5 rounded-lg bg-cream p-2 text-[11px] font-medium leading-snug text-ink/60">
                You are on Pro, so <span className="font-bold text-ink">₹0</span> of this is commission. On the free plan the
                same month would have cost you <span className="font-bold text-ink">{inr(m.commissionIfFree)}</span>.
              </p>
            </Panel>

            <Panel title="Revenue by month" subtitle="Last 12 months">
              <BarChart data={m.byMonth.map((d) => ({ month: d.label, revenue: d.value }))} />
            </Panel>
          </div>
        </>
      )}

      {sub === 'breakdown' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Revenue by service" subtitle="What is actually earning">
            <RankedBars
              rows={m.byService}
              valueKey="revenue"
              format={(v) => inr(v, { compact: true })}
              secondary={(r) => `· ${r.bookings} sold`}
            />
          </Panel>
          <Panel title="Where it concentrates" subtitle="A solo business risk worth watching">
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[30px] font-extrabold leading-none tracking-[-0.04em] text-ink">
                {pct(m.concentration.topThreeShare)}
              </span>
              <span className="text-[12px] font-semibold text-ink/55">from your top 3 guests</span>
            </div>
            <p className="mt-2 text-[12px] font-medium leading-snug text-ink/60">
              If one of them stops, you lose more than a tenth of your income. Worth widening.
            </p>
            <div className="mt-3">
              <RankedBars
                rows={intel.customers.topByLtv.slice(0, 5)}
                valueKey="ltv"
                format={(v) => inr(v, { compact: true })}
                secondary={(r) => `· ${r.bookings}×`}
              />
            </div>
          </Panel>
        </div>
      )}

      {sub === 'forecast' && (
        isFree ? (
          <Locked
            headline={`On your pace, about ${inr(m.forecast.projected, { compact: true })} next month`}
            sub="Pro shows the projection, the range it could land in, and the gap to your target."
            src="intel-forecast"
            onUpgrade={() => soon('Opens /dashboard/upgrade?src=intel-forecast')}
          >
            <Panel title="Next 30 days"><div className="h-40" /></Panel>
          </Locked>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Next 30 days" subtitle="Firm money, then an estimate">
              <div className="flex flex-col gap-2.5">
                <div className="rounded-lg border-2 border-neutral-200 p-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-ink/45">Already confirmed</p>
                  <p className="mt-0.5 font-display text-[22px] font-extrabold tracking-[-0.03em] text-ink">{inr(m.forecast.confirmedUpcoming)}</p>
                  <p className="text-[11px] font-medium text-ink/50">Bookings on the calendar, not yet paid out</p>
                </div>
                <div className="rounded-lg border-2 border-dashed border-marigold bg-marigold/10 p-2.5">
                  <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.07em] text-ink/55">
                    Projected
                    <span className="rounded-full bg-marigold/40 px-1.5 py-px text-[9px] font-bold tracking-wide">estimate</span>
                  </p>
                  <p className="mt-0.5 font-display text-[22px] font-extrabold tracking-[-0.03em] text-ink">{inr(m.forecast.projected)}</p>
                  <p className="text-[11px] font-medium text-ink/55">
                    Likely between {inr(m.forecast.low, { compact: true })} and {inr(m.forecast.high, { compact: true })}
                  </p>
                  <p className="mt-1.5 border-t border-ink/10 pt-1.5 text-[11px] font-medium leading-snug text-ink/55">{m.forecast.basis}</p>
                </div>
              </div>
            </Panel>
            <GoalStrip />
          </div>
        )
      )}

      {sub === 'transactions' && (
        <Panel title="Transactions" subtitle={`${m.transactions.length} in the last 30 days`} flush>
          <div className="px-3 pb-3 pt-2.5">
            <SortableTable
              rowKey="id"
              initialSort="gross"
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'guest', label: 'Guest', strong: true },
                { key: 'service', label: 'Service' },
                { key: 'gross', label: 'Gross', align: 'right', render: (r) => inr(r.gross) },
                { key: 'fee', label: 'Fees', align: 'right', render: (r) => `−${inr(r.fee)}` },
                { key: 'net', label: 'Net', align: 'right', strong: true, render: (r) => inr(r.net) },
                {
                  key: 'status',
                  label: 'Status',
                  render: (r) => (
                    <span className={cn(
                      'rounded-full px-2 py-0.5 text-[10.5px] font-bold',
                      r.status === 'paid' ? 'bg-success-bg text-success-fg'
                        : r.status === 'refunded' ? 'bg-blush text-maroon'
                        : 'bg-error-bg text-error-fg',
                    )}>
                      {r.status}
                    </span>
                  ),
                },
              ]}
              rows={m.transactions}
            />
          </div>
        </Panel>
      )}
    </div>
  );
};

/* ═══ Audience & Conversion ═══════════════════════════════════════════════ */

const AUD_TABS = [
  { value: 'traffic', label: 'Traffic' },
  { value: 'funnel', label: 'Funnel' },
  { value: 'services', label: 'Services' },
  { value: 'devices', label: 'Devices' },
];

const AudienceInner = () => {
  const [sub, setSub] = useState('traffic');
  const a = intel.audience;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs tabs={AUD_TABS} value={sub} onChange={setSub} className="border-0" />
        <Button variant="outline" onClick={() => soon('Downloads this view as CSV')}>
          <Download className="h-4 w-4" strokeWidth={2.4} /> Export
        </Button>
      </div>

      {sub === 'traffic' && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Tile label="Visitors" value={a.visitors.toLocaleString('en-IN')} delta={a.deltas.visitors} />
            <Tile label="Unique visitors" value={a.uniqueVisitors.toLocaleString('en-IN')} delta={a.deltas.unique} />
            <Tile label="Returning" value={a.returningVisitors.toLocaleString('en-IN')} hint={`${pct(a.returningVisitors / a.uniqueVisitors)} of unique`} />
            <Tile label="Revenue per visitor" value={inr(intel.money.gross / a.uniqueVisitors)} hint="gross ÷ unique visitors" />
          </div>

          <Panel
            title="Where they come from"
            subtitle="Sort by any column — the one that matters is revenue per visitor"
            action={<Explain>A booking we could not trace to a source lands in &quot;Unknown&quot; rather than being quietly dropped or spread across the others.</Explain>}
          >
            <SortableTable
              initialSort="revenue"
              columns={[
                { key: 'label', label: 'Source', strong: true },
                { key: 'visitors', label: 'Visitors', align: 'right' },
                { key: 'serviceViews', label: 'Service views', align: 'right' },
                { key: 'bookings', label: 'Bookings', align: 'right' },
                { key: 'conv', label: 'Conv.', align: 'right', render: (r) => rate(r.bookings / r.visitors) },
                { key: 'revenue', label: 'Revenue', align: 'right', strong: true, render: (r) => inr(r.revenue) },
                { key: 'rpv', label: '₹ / visitor', align: 'right', render: (r) => inr(Math.round(r.revenue / r.visitors)) },
              ]}
              rows={a.sources.map((s) => ({ ...s, conv: s.bookings / s.visitors, rpv: s.revenue / s.visitors }))}
            />
          </Panel>

          <div className="grid gap-3 lg:grid-cols-2">
            <Panel title="Visitors and bookings" subtitle={`Tracked since ${a.trackingSince}`}>
              <LineChart
                series={[
                  { key: 'Views', data: a.trend.map((d) => ({ label: d.label, value: d.views })) },
                  { key: 'Bookings', data: a.trend.map((d) => ({ label: d.label, value: d.bookings * 20 })), dashed: true },
                ]}
                format={(v) => String(Math.round(v))}
              />
            </Panel>
            <Panel title="Campaigns" subtitle="Your own tracking links">
              <RankedBars
                rows={a.campaigns}
                valueKey="revenue"
                format={(v) => inr(v, { compact: true })}
                secondary={(r) => `· ${rate(r.conversion)} conv`}
              />
            </Panel>
          </div>
        </>
      )}

      {sub === 'funnel' && (
        <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
          <Panel
            title="Profile view to paid"
            subtitle="Each step against the one before it"
            action={<Explain>Every step&apos;s percentage is measured against the step immediately above it, never against the top. That denominator is fixed and will not change between releases.</Explain>}
          >
            <Funnel stages={a.funnel} />
          </Panel>
          <div className="flex flex-col gap-3">
            <Panel title="Your biggest leak">
              <p className="font-display text-[15px] font-extrabold leading-snug tracking-[-0.02em] text-ink">{a.bottleneck.step}</p>
              <p className="mt-1 text-[12px] font-medium leading-snug text-ink/60">{a.bottleneck.note}</p>
              <Button className="mt-2.5" onClick={() => soon('Opens the service page editor')}>
                Fix the service pages <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
              </Button>
            </Panel>
            <Panel title="Conversion by source" subtitle="Same funnel, split by where they came from">
              <RankedBars
                rows={a.sources.filter((s) => s.label !== 'Unknown').map((s) => ({ label: s.label, conv: Math.round((s.bookings / s.visitors) * 1000) }))}
                valueKey="conv"
                format={(v) => `${(v / 10).toFixed(1)}%`}
              />
            </Panel>
          </div>
        </div>
      )}

      {sub === 'services' && (
        <Panel title="Which services convert" subtitle="Views are wasted if they don't book">
          <SortableTable
            initialSort="conversion"
            columns={[
              { key: 'label', label: 'Service', strong: true },
              { key: 'views', label: 'Views', align: 'right' },
              { key: 'started', label: 'Started', align: 'right' },
              { key: 'paid', label: 'Paid', align: 'right' },
              { key: 'conversion', label: 'View → paid', align: 'right', strong: true, render: (r) => rate(r.conversion) },
              { key: 'revenue', label: 'Revenue', align: 'right', render: (r) => inr(r.revenue) },
            ]}
            rows={a.serviceConversion}
          />
          <p className="mt-2.5 rounded-lg bg-cream p-2 text-[11px] font-medium leading-snug text-ink/60">
            Follow-up consult converts at 11.3% from 212 views. Nutrition deep-dive gets 388 views and converts at 4.6% —
            the same traffic through the better page would be worth about {inr(14_000)} a month.
            <span className="ml-1 rounded-full bg-marigold/30 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-ink/70">estimate</span>
          </p>
        </Panel>
      )}

      {sub === 'devices' && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="What they browse on">
            <RankedBars rows={a.devices} valueKey="visitors" />
          </Panel>
          <Panel title="And which actually books" subtitle="India is mobile-first — a desktop gap is a real bug">
            <RankedBars
              rows={a.devices.map((d) => ({ label: d.label, conv: Math.round(d.conversion * 1000) }))}
              valueKey="conv"
              format={(v) => `${(v / 10).toFixed(1)}%`}
            />
            <p className="mt-2.5 text-[11.5px] font-medium leading-snug text-ink/60">
              Mobile converts at 4.8%, desktop at 2.9%. Worth opening your booking page on a laptop to see what breaks.
            </p>
          </Panel>
        </div>
      )}
    </div>
  );
};

const Audience = ({ isFree }) => (
  isFree ? (
    <Locked
      headline={`${intel.audience.visitors.toLocaleString('en-IN')} people viewed your page this month`}
      sub="Pro shows where they came from, which services they opened, and exactly where they dropped out."
      src="intel-audience"
      onUpgrade={() => soon('Opens /dashboard/upgrade?src=intel-audience')}
    >
      <AudienceInner />
    </Locked>
  ) : <AudienceInner />
);

/* ═══ Demand & Customers ══════════════════════════════════════════════════ */

const DEM_TABS = [
  { value: 'demand', label: 'Demand' },
  { value: 'customers', label: 'Customers' },
  { value: 'retention', label: 'Retention' },
];

const Demand = ({ isFree }) => {
  const [sub, setSub] = useState('demand');
  const d = intel.demand;
  const c = intel.customers;

  return (
    <div className="flex flex-col gap-3">
      <Tabs tabs={DEM_TABS} value={sub} onChange={setSub} className="border-0" />

      {sub === 'demand' && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Tile label="Utilisation" value={pct(d.utilisation)} hint={`${d.bookedHours}h booked of ${d.publishedHours}h published`} />
            <Tile label="Median lead time" value={`${d.leadTimeMedianDays} days`} hint={`${pct(d.lastMinuteShare)} book within 24h`} />
            <Tile label="Cancellations" value={rate(d.cancellationRate)} hint={`${rate(d.rescheduleRate)} reschedule`} />
            <Tile label="No-shows" value={rate(d.noShowRate)} hint="of completed + no-show" />
          </div>

          <Panel
            title="When you're wanted"
            subtitle={`Busiest: ${d.peak.label}, filling at ${pct(d.peak.fillRate)}`}
            action={<Button variant="ghost" onClick={() => soon('Opens Schedule › Hours')}>Edit hours</Button>}
          >
            <Heatmap grid={d.grid} hours={d.hours} onPick={(day, hour, v) => soon(`${day} ${hour}: ${v} bookings`)} />
            <div className="mt-2.5 rounded-lg bg-cream p-2.5">
              <p className="text-[12px] font-bold text-ink">{d.gap.label} is your gap</p>
              <p className="mt-0.5 text-[11.5px] font-medium leading-snug text-ink/60">{d.gap.note}</p>
            </div>
          </Panel>

          <Panel title="How far ahead they book">
            <RankedBars rows={d.leadTime} valueKey="value" format={(v) => `${v} bookings`} />
          </Panel>
        </>
      )}

      {sub === 'customers' && (
        isFree ? (
          <Locked
            headline={`Your top guest has spent ${inr(c.topByLtv[0].ltv)}`}
            sub="Pro ranks every guest by what they've spent, and shows which ones are slipping away."
            src="intel-customers"
            onUpgrade={() => soon('Opens /dashboard/upgrade?src=intel-customers')}
          >
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => <Tile key={i} label="—" value="—" />)}
            </div>
          </Locked>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Tile label="Customers" value={c.total} hint={`${c.new30d} new this month`} />
              <Tile label="Repeat rate" value={pct(c.repeatRate)} hint={`${c.returning30d} returned this month`} />
              <Tile label="Average spend" value={inr(c.avgSpend)} hint="lifetime, per customer" />
              <Tile label="Typical gap" value={`${c.medianGapDays} days`} hint="between bookings" />
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Panel title="Most valuable guests" subtitle="By everything they've ever paid you">
                <SortableTable
                  initialSort="ltv"
                  columns={[
                    { key: 'label', label: 'Guest', strong: true },
                    { key: 'bookings', label: 'Bookings', align: 'right' },
                    { key: 'ltv', label: 'Lifetime', align: 'right', strong: true, render: (r) => inr(r.ltv) },
                    { key: 'source', label: 'Came from' },
                    { key: 'last', label: 'Last seen' },
                  ]}
                  rows={c.topByLtv}
                />
              </Panel>
              <Panel title="Segments" subtitle="Where your revenue sits">
                <RankedBars rows={c.segments} valueKey="revenue" format={(v) => inr(v, { compact: true })} secondary={(r) => `· ${r.count} guests`} />
              </Panel>
            </div>
            <WinBack />
          </>
        )
      )}

      {sub === 'retention' && (
        isFree ? (
          <Locked
            headline={`${pct(c.repeatRate)} of your bookings are repeat guests`}
            sub="Pro shows how each month's guests come back over time — and when they stop."
            src="intel-retention"
            onUpgrade={() => soon('Opens /dashboard/upgrade?src=intel-retention')}
          >
            <Panel title="Repeat bookings by cohort"><div className="h-48" /></Panel>
          </Locked>
        ) : (
          <Panel
            title="Repeat bookings by cohort"
            subtitle="Of the guests who first booked in each month, how many came back"
            action={<Explain>Read across a row: M1 is the share of that month&apos;s first-time guests who booked again the following month. Small cohorts show their size rather than being hidden — it&apos;s your own data.</Explain>}
          >
            <CohortTable cohorts={c.cohorts} months={c.cohortMonths} />
            <p className="mt-2.5 text-[11.5px] font-medium leading-snug text-ink/60">
              September is your best cohort — 52% booked again within a month. Whatever you did that month, do it again.
            </p>
          </Panel>
        )
      )}
    </div>
  );
};

/* ═══ Shell ═══════════════════════════════════════════════════════════════ */

const PAGES = {
  overview: { Component: Overview, title: 'Overview', blurb: 'What your business did, and what to do next', freshness: 'live' },
  revenue: { Component: Revenue, title: 'Revenue', blurb: 'Every rupee in, every deduction, what is coming', freshness: 'live' },
  audience: { Component: Audience, title: 'Audience & conversion', blurb: 'Who arrives, and where they fall out', freshness: 'rolled' },
  demand: { Component: Demand, title: 'Demand & customers', blurb: 'When you are wanted, and who comes back', freshness: 'live' },
};

export default function Intelligence({ go }) {
  const [tab, setTab, tabs] = useUrlTab('intelligence');
  const [range, setRange] = useState('30d');
  const [compare, setCompare] = useState(true);
  const [isFree, setIsFree] = useState(false);

  const page = PAGES[tab] || PAGES.overview;
  const { Component } = page;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-[20px] font-extrabold leading-none tracking-[-0.035em] text-ink">{page.title}</h1>
            <p className="mt-1 text-[12px] font-medium text-ink/55">{page.blurb}</p>
          </div>
          {/* PROTOTYPE ONLY — lets a reviewer see the free host's locked view. */}
          <div className="flex items-center gap-1.5 rounded-full border-2 border-dashed border-marigold bg-marigold/10 px-2 py-1">
            <span className="text-[10px] font-bold uppercase tracking-wide text-ink/50">View as</span>
            {[['Pro', false], ['Free', true]].map(([label, v]) => (
              <button
                key={label}
                type="button"
                onClick={() => setIsFree(v)}
                aria-pressed={isFree === v}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
                  isFree === v ? 'bg-ink text-white' : 'text-ink/55 hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Tabs tabs={tabs} value={tab} onChange={setTab} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <RangeControls range={range} onRange={setRange} compare={compare} onCompare={setCompare} />
          <AsOf at="16 Nov, 7:40 pm" freshness={page.freshness} />
        </div>
      </div>

      <Component isFree={isFree} go={go} range={range} compare={compare} />

      <p className="pt-1 text-[10.5px] font-medium leading-snug text-ink/40">
        Money comes from your bookings and payouts, so it always matches what you were paid. Visitor and funnel numbers
        come from our own tracking and start from {intel.audience.trackingSince} — anything marked
        <span className="mx-1 rounded-full bg-marigold/30 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-ink/70">estimate</span>
        is a projection, not a fact.
      </p>
    </div>
  );
}
