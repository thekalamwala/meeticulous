// ─────────────────────────────────────────────────────────────────────────────
// Intelligence — Creator Intelligence.
//
// Laid out like Google Analytics: a scorecard row, then a grid of cards where
// each card is one question answered by one chart. Titles are short, there are
// no paragraphs under charts, and definitions live in the ⓘ tooltip rather than
// in body copy. If a chart needs a sentence to be understood, the chart is wrong.
//
// Four pages:
//   Overview  what is staying free costing me, and what do I do today
//   Revenue   every rupee in, every deduction, what is coming
//   Audience  who arrives, and where they fall out
//   Demand    when am I wanted, and who keeps coming back
//
// No dual-axis charts: revenue and bookings are two measures of different scale,
// so they are two cards side by side, never two y-scales on one plot.
//
// GATING (founder decision 2026-11-16): Revenue stays FREE — PLAN_MATRIX already
// promises free hosts "Earnings & transaction history" and "Commission tracker".
// Pro gates the six things promised to nobody: forecast, win-back list, peer
// benchmarks, Audience, cohorts/LTV, and the weekly moves.
//
// "View as" is PROTOTYPE-ONLY, so the locked experience can be reviewed without
// switching accounts.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button, Tabs, cn } from '../../../components/dashboard/ui';
import { Sparkline, inr, useUrlTab } from '../labUi';
import {
  AreaChart, Bars, C, Card, CardLink, CohortTable, DataTable, Empty, Explain,
  Funnel, Heatmap, Insight, Locked, RangeControls, Scorecard, SegmentedBar,
  Waterfall, rate,
} from '../intelUi';
import intel from '../intelData';

const soon = (what) => toast.success(what);
const GRID = 'grid gap-2.5 lg:grid-cols-2';

/* ═══ Overview ════════════════════════════════════════════════════════════ */

const Leak = ({ isFree }) => {
  const { paidThisFy, runRateYear, proPrice, paybackDays, monthlyIfFree } = intel.leak;
  const paid = isFree ? monthlyIfFree * 3 : paidThisFy;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl bg-maroon p-3.5 text-white">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-white/60">Commission {isFree ? 'you are paying' : 'you paid before Pro'}</p>
        <p className="font-display text-[30px] font-extrabold leading-none tracking-[-0.045em]">{inr(paid)}</p>
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {[['This year at your pace', inr(runRateYear)], ['Pro', `${inr(proPrice)}/yr`], ['Pays for itself in', `${paybackDays} days`]].map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10.5px] font-semibold text-white/55">{k}</dt>
            <dd className="font-display text-[16px] font-extrabold tracking-[-0.025em]">{v}</dd>
          </div>
        ))}
      </dl>
      {isFree && (
        <button
          type="button"
          onClick={() => soon('Opens /dashboard/upgrade?src=intel-overview')}
          className="ml-auto shrink-0 rounded-full bg-white px-4 py-2 text-[12.5px] font-bold text-maroon transition hover:bg-cream focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose"
        >
          Go Pro
        </button>
      )}
    </div>
  );
};

const WinBackCard = () => (
  <Card
    title="Win back"
    info="Guests with at least one paid booking and nothing in the last 60 days, ranked by what they have spent with you."
    action={<CardLink onClick={() => soon('Sends all four a rebook nudge')}>Nudge all</CardLink>}
  >
    <DataTable
      initialSort="ltv"
      barKey="ltv"
      columns={[
        { key: 'label', label: 'Guest', strong: true },
        { key: 'daysSince', label: 'Quiet', align: 'right', render: (r) => `${r.daysSince}d` },
        { key: 'ltv', label: 'Lifetime', align: 'right', strong: true, render: (r) => inr(r.ltv) },
      ]}
      rows={intel.customers.winBack}
    />
  </Card>
);

const BenchmarkCard = ({ data }) => (
  <Card title="You vs similar hosts" info="Anonymised medians across hosts in your profession. Suppressed below five hosts so no one can be identified.">
    {data.suppressed ? (
      <Empty title="Not enough hosts yet" body={`We compare you once five ${data.cohortLabel.toLowerCase()} are active. Right now there are ${data.hostCount}.`} />
    ) : (
      <ul className="flex flex-col gap-2.5">
        {data.rows.map((r) => {
          const fmt = (v) => (r.isPct ? rate(v) : inr(v));
          return (
            <li key={r.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-[11.5px] font-semibold text-ink/75">{r.label}</span>
                <span className="shrink-0 text-[11.5px] font-bold tabular-nums text-ink">
                  {fmt(r.you)}<span className="ml-1.5 font-medium text-ink/40">med {fmt(r.median)}</span>
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-neutral-100">
                <span className="absolute inset-y-0 left-1/2 w-px bg-ink/15" aria-hidden="true" />
                <div className="h-full rounded-full" style={{ width: `${r.percentile}%`, background: r.better ? C.series : C.alt }} />
              </div>
            </li>
          );
        })}
      </ul>
    )}
  </Card>
);

const Overview = ({ isFree, go }) => {
  const { money, audience, customers, goal, reputation } = intel;
  return (
    <div className="flex flex-col gap-2.5">
      <Leak isFree={isFree} />

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Scorecard label="Net revenue" value={inr(money.net, { compact: true })} delta={money.deltas.net}
          spark={<Sparkline values={money.byMonth.map((d) => d.value)} />} onClick={() => go?.('money')}
          info="Gross, minus platform fee, GST on it, the gateway's cut and refunds." />
        <Scorecard label="Paid bookings" value={money.paidBookings} delta={money.deltas.bookings}
          spark={<Sparkline values={money.bookingsByMonth.map((d) => d.value)} />} onClick={() => go?.('bookings')} />
        <Scorecard label="Visitors" value={audience.visitors.toLocaleString('en-IN')} delta={audience.deltas.visitors}
          spark={<Sparkline values={audience.trend.map((d) => d.views)} />}
          info={`Tracked since ${audience.trackingSince}. Your own visits are excluded.`} />
        <Scorecard label="View → book" value={rate(money.paidBookings / audience.visitors)} delta={audience.deltas.conversion}
          info="Paid bookings divided by profile views in the range." />
      </div>

      <Card title="This week's 3 moves" action={<Explain>Each one is generated from a metric on these pages. If the evidence is missing, nothing is shown.</Explain>}>
        {isFree ? (
          <Locked headline="Three moves worth about ₹14,400 this month" src="intel-moves" onUpgrade={() => soon('Opens /dashboard/upgrade?src=intel-moves')} compact>
            <ul className="flex flex-col gap-2">{intel.insights.map((i) => <Insight key={i.id} insight={i} />)}</ul>
          </Locked>
        ) : (
          <ul className="flex flex-col gap-2">
            {intel.insights.map((i) => <Insight key={i.id} insight={i} onAct={(x) => soon(`${x.action} — wired in phase 3`)} />)}
          </ul>
        )}
      </Card>

      {/* Two measures, two scales → two cards. Never one plot with two y-axes. */}
      <div className={GRID}>
        <Card title="Revenue" action={<CardLink onClick={() => go?.('intelligence')}>Revenue</CardLink>}>
          <AreaChart id="ov-rev" data={money.byMonth} />
        </Card>
        <Card title="Bookings">
          <AreaChart id="ov-bk" data={money.bookingsByMonth} format={(v) => String(Math.round(v))} />
        </Card>
      </div>

      <div className={GRID}>
        {isFree
          ? <Locked headline={`4 past guests worth ${inr(customers.winBack.reduce((s, g) => s + g.ltv, 0))}`} src="intel-winback" onUpgrade={() => soon('Opens upgrade')} compact><WinBackCard /></Locked>
          : <WinBackCard />}
        {isFree
          ? <Locked headline="You price above the median, and convert below it" src="intel-benchmark" onUpgrade={() => soon('Opens upgrade')} compact><BenchmarkCard data={intel.benchmark} /></Locked>
          : <BenchmarkCard data={intel.benchmark} />}
      </div>

      <div className="grid gap-2.5 lg:grid-cols-3">
        <Card title="Where bookings leak" info="Each step is measured against the step immediately above it. That denominator never changes.">
          <Funnel stages={audience.funnel} />
        </Card>
        <Card title="Monthly target" action={<CardLink onClick={() => soon('Opens the target editor')}>Edit</CardLink>}>
          <p className="font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] text-ink">{rate(goal.progress)}</p>
          <div className="mt-2 h-2.5 rounded-full bg-neutral-100">
            <div className="h-full rounded-full" style={{ width: `${goal.progress * 100}%`, background: C.series }} />
          </div>
          <dl className="mt-2.5 grid grid-cols-2 gap-y-1.5 text-[11.5px]">
            {[['To go', inr(goal.remaining)], ['Bookings needed', goal.bookingsNeeded], ['Target', inr(goal.target)], ['On pace for', goal.projectedDate]].map(([k, v]) => (
              <div key={k}><dt className="text-[10px] font-semibold text-ink/45">{k}</dt><dd className="font-bold tabular-nums text-ink">{v}</dd></div>
            ))}
          </dl>
        </Card>
        <Card title="Rating" action={<CardLink onClick={() => soon('Opens Grow › Social proof')}>Reviews</CardLink>}>
          <p className="font-display text-[26px] font-extrabold leading-none tracking-[-0.04em] text-ink">{reputation.rating}</p>
          <p className="mt-0.5 text-[11px] font-medium text-ink/45">{reputation.reviews} reviews · +{reputation.delta} this month</p>
          <div className="mt-2"><Bars rows={reputation.distribution} /></div>
        </Card>
      </div>
    </div>
  );
};

/* ═══ Revenue ═════════════════════════════════════════════════════════════ */

const REV_TABS = [
  { value: 'overview', label: 'Overview' }, { value: 'breakdown', label: 'Breakdown' },
  { value: 'forecast', label: 'Forecast' }, { value: 'transactions', label: 'Transactions' },
];

const Revenue = ({ isFree }) => {
  const [sub, setSub] = useState('overview');
  const m = intel.money;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs tabs={REV_TABS} value={sub} onChange={setSub} className="border-0" />
        <Button variant="outline" onClick={() => soon('Downloads this view as CSV')}><Download className="h-4 w-4" strokeWidth={2.4} /> Export</Button>
      </div>

      {sub === 'overview' && (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Scorecard label="Gross" value={inr(m.gross, { compact: true })} delta={m.deltas.gross} spark={<Sparkline values={m.byMonth.map((d) => d.value)} />} />
            <Scorecard label="Net — yours" value={inr(m.net, { compact: true })} delta={m.deltas.net} info="What should land in your bank." />
            <Scorecard label="Average booking" value={inr(m.aov)} delta={m.deltas.aov} />
            <Scorecard label="Pending payout" value={inr(m.pendingPayout, { compact: true })} />
          </div>
          <div className={GRID}>
            <Card title="Gross to net" info="Every deduction between what the guest paid and what reaches you.">
              <Waterfall rows={m.waterfall} />
            </Card>
            <Card title="Revenue by month"><AreaChart id="rev-m" data={m.byMonth} height={176} /></Card>
          </div>
        </>
      )}

      {sub === 'breakdown' && (
        <>
          <div className={GRID}>
            <Card title="What it comes from"><SegmentedBar segments={m.composition} /></Card>
            <Card title="Revenue by service">
              <Bars rows={m.byService} valueKey="revenue" format={(v) => inr(v, { compact: true })} note={(r) => `· ${r.bookings}`} />
            </Card>
          </div>
          <div className={GRID}>
            <Card title="Top guests by lifetime spend">
              <Bars rows={intel.customers.topByLtv} valueKey="ltv" format={(v) => inr(v, { compact: true })} note={(r) => `· ${r.bookings}×`} />
            </Card>
            <Card title="Concentration" info="Share of all revenue coming from your three biggest guests.">
              <p className="font-display text-[34px] font-extrabold leading-none tracking-[-0.045em] text-ink">{rate(m.concentration.topThreeShare)}</p>
              <p className="mt-1 text-[11.5px] font-medium text-ink/50">from your top 3 guests</p>
              <div className="mt-3">
                <SegmentedBar
                  segments={[{ label: 'Top 3 guests', value: Math.round(m.gross * m.concentration.topThreeShare) }, { label: 'Everyone else', value: Math.round(m.gross * (1 - m.concentration.topThreeShare)) }]}
                />
              </div>
            </Card>
          </div>
        </>
      )}

      {sub === 'forecast' && (
        isFree ? (
          <Locked headline={`On your pace, about ${inr(m.forecast.projected, { compact: true })} next month`} src="intel-forecast" onUpgrade={() => soon('Opens upgrade')}>
            <div className={GRID}><Card title="Next 30 days"><div className="h-36" /></Card><Card title="Target"><div className="h-36" /></Card></div>
          </Locked>
        ) : (
          <div className={GRID}>
            <Card title="Next 30 days" info="Confirmed bookings are firm. The projection uses your trailing 90-day booking rate and average booking value.">
              <div className="flex flex-col gap-2">
                <div className="rounded-lg border-2 border-neutral-200 p-2.5">
                  <p className="text-[10.5px] font-semibold text-ink/45">Confirmed</p>
                  <p className="font-display text-[22px] font-extrabold tracking-[-0.035em] text-ink">{inr(m.forecast.confirmedUpcoming)}</p>
                </div>
                <div className="rounded-lg border-2 border-dashed border-marigold-600/50 bg-marigold-100/50 p-2.5">
                  <p className="flex items-center gap-1.5 text-[10.5px] font-semibold text-ink/55">
                    Projected <span className="rounded-full bg-marigold-100 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-marigold-800">estimate</span>
                  </p>
                  <p className="font-display text-[22px] font-extrabold tracking-[-0.035em] text-ink">{inr(m.forecast.projected)}</p>
                  <p className="text-[11px] font-medium text-ink/50">{inr(m.forecast.low, { compact: true })} – {inr(m.forecast.high, { compact: true })}</p>
                </div>
              </div>
            </Card>
            <Card title="Against target">
              <AreaChart id="fc" data={[...m.byMonth.slice(-5), { label: 'Dec', value: m.forecast.projected }]} />
            </Card>
          </div>
        )
      )}

      {sub === 'transactions' && (
        <Card title={`Transactions · ${m.transactions.length}`}>
          <DataTable
            rowKey="id" initialSort="gross"
            columns={[
              { key: 'date', label: 'Date' },
              { key: 'guest', label: 'Guest', strong: true },
              { key: 'service', label: 'Service' },
              { key: 'gross', label: 'Gross', align: 'right', render: (r) => inr(r.gross) },
              { key: 'fee', label: 'Fees', align: 'right', render: (r) => `−${inr(r.fee)}` },
              { key: 'net', label: 'Net', align: 'right', strong: true, render: (r) => inr(r.net) },
              {
                key: 'status', label: 'Status',
                render: (r) => (
                  <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold',
                    r.status === 'paid' ? 'bg-success-bg text-success-fg' : r.status === 'refunded' ? 'bg-blush text-maroon' : 'bg-error-bg text-error-fg')}>
                    {r.status}
                  </span>
                ),
              },
            ]}
            rows={m.transactions}
          />
        </Card>
      )}
    </div>
  );
};

/* ═══ Audience ════════════════════════════════════════════════════════════ */

const AUD_TABS = [
  { value: 'traffic', label: 'Traffic' }, { value: 'funnel', label: 'Funnel' },
  { value: 'services', label: 'Services' }, { value: 'devices', label: 'Devices' },
];

const AudienceInner = () => {
  const [sub, setSub] = useState('traffic');
  const a = intel.audience;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs tabs={AUD_TABS} value={sub} onChange={setSub} className="border-0" />
        <Button variant="outline" onClick={() => soon('Downloads this view as CSV')}><Download className="h-4 w-4" strokeWidth={2.4} /> Export</Button>
      </div>

      {sub === 'traffic' && (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Scorecard label="Visitors" value={a.visitors.toLocaleString('en-IN')} delta={a.deltas.visitors} spark={<Sparkline values={a.trend.map((d) => d.views)} />} />
            <Scorecard label="Unique" value={a.uniqueVisitors.toLocaleString('en-IN')} delta={a.deltas.unique}
              info="Counted once per visitor across the whole range — daily uniques do not add up to it." />
            <Scorecard label="Returning" value={rate(a.returningVisitors / a.uniqueVisitors)} />
            <Scorecard label="₹ per visitor" value={inr(Math.round(intel.money.gross / a.uniqueVisitors))} />
          </div>
          <div className={GRID}>
            <Card title="Visitors"><AreaChart id="aud-v" data={a.trend.map((d) => ({ label: d.label, value: d.views }))} format={(v) => String(v)} /></Card>
            <Card title="Bookings"><AreaChart id="aud-b" data={a.trend.map((d) => ({ label: d.label, value: d.bookings }))} format={(v) => String(v)} /></Card>
          </div>
          <Card title="Where they come from" info="A booking we could not trace to a source appears as Unknown rather than being dropped or spread across the others.">
            <DataTable
              initialSort="revenue" barKey="revenue"
              columns={[
                { key: 'label', label: 'Source', strong: true },
                { key: 'visitors', label: 'Visitors', align: 'right' },
                { key: 'bookings', label: 'Bookings', align: 'right' },
                { key: 'conv', label: 'Conv.', align: 'right', render: (r) => rate(r.bookings / r.visitors) },
                { key: 'revenue', label: 'Revenue', align: 'right', strong: true, render: (r) => inr(r.revenue) },
                { key: 'rpv', label: '₹ / visitor', align: 'right', render: (r) => inr(Math.round(r.revenue / r.visitors)) },
              ]}
              rows={a.sources.map((s) => ({ ...s, conv: s.bookings / s.visitors, rpv: s.revenue / s.visitors }))}
            />
          </Card>
          <Card title="Campaigns">
            <Bars rows={a.campaigns} valueKey="revenue" format={(v) => inr(v, { compact: true })} note={(r) => `· ${rate(r.conversion)}`} />
          </Card>
        </>
      )}

      {sub === 'funnel' && (
        <div className={GRID}>
          <Card title="Profile view to paid" info="Each step against the step immediately above it. Frozen — it will not change between releases.">
            <Funnel stages={a.funnel} />
          </Card>
          <Card title="Conversion by source">
            <Bars
              rows={a.sources.filter((s) => s.label !== 'Unknown').map((s) => ({ label: s.label, conv: s.bookings / s.visitors }))}
              valueKey="conv" format={rate}
            />
          </Card>
        </div>
      )}

      {sub === 'services' && (
        <Card title="Views to bookings, by service">
          <DataTable
            initialSort="conversion" barKey="views"
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
        </Card>
      )}

      {sub === 'devices' && (
        <div className={GRID}>
          <Card title="Visitors by device"><SegmentedBar segments={a.devices.map((d) => ({ label: d.label, value: d.visitors }))} format={(v) => v.toLocaleString('en-IN')} /></Card>
          <Card title="Conversion by device" info="India books on a phone. A desktop gap is usually a broken layout, not a preference.">
            <Bars rows={a.devices.map((d) => ({ label: d.label, conv: d.conversion }))} valueKey="conv" format={rate} />
          </Card>
        </div>
      )}
    </div>
  );
};

const Audience = ({ isFree }) => (
  isFree ? (
    <Locked headline={`${intel.audience.visitors.toLocaleString('en-IN')} people viewed your page this month`} src="intel-audience" onUpgrade={() => soon('Opens upgrade')} compact>
      <AudienceInner />
    </Locked>
  ) : <AudienceInner />
);

/* ═══ Demand ══════════════════════════════════════════════════════════════ */

const DEM_TABS = [
  { value: 'demand', label: 'Demand' }, { value: 'customers', label: 'Customers' }, { value: 'retention', label: 'Retention' },
];

const Demand = ({ isFree }) => {
  const [sub, setSub] = useState('demand');
  const d = intel.demand;
  const c = intel.customers;
  return (
    <div className="flex flex-col gap-2.5">
      <Tabs tabs={DEM_TABS} value={sub} onChange={setSub} className="border-0" />

      {sub === 'demand' && (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Scorecard label="Utilisation" value={rate(d.utilisation)} info="Booked hours divided by the hours you publish." />
            <Scorecard label="Median lead time" value={`${d.leadTimeMedianDays}d`} />
            <Scorecard label="Cancellations" value={rate(d.cancellationRate)} inverse delta={-2} />
            <Scorecard label="No-shows" value={rate(d.noShowRate)} inverse info="Of completed plus no-show. A cancellation is not a no-show." />
          </div>
          <Card title="When you're wanted" info="All times IST. Darker means more bookings taken in that slot." action={<CardLink onClick={() => soon('Opens Schedule › Hours')}>Hours</CardLink>}>
            <Heatmap grid={d.grid} hours={d.hours} onPick={(day, hour, v) => soon(`${day} ${hour}: ${v} bookings`)} />
          </Card>
          <div className={GRID}>
            {/* Marigold here means exactly what the brand reserves it for: open capacity. */}
            <Card title="Booked vs open hours">
              <div className="flex h-7 w-full gap-[2px] overflow-hidden rounded-full">
                <div className="h-full rounded-l-full" style={{ width: `${d.utilisation * 100}%`, background: C.series }} />
                <div className="h-full rounded-r-full" style={{ width: `${(1 - d.utilisation) * 100}%`, background: C.open }} />
              </div>
              <ul className="mt-2.5 flex flex-col gap-1 text-[11.5px]">
                <li className="flex items-baseline gap-2"><span className="h-2 w-2 rounded-full" style={{ background: C.series }} /><span className="font-semibold text-ink/70">Booked</span><span className="ml-auto font-bold tabular-nums text-ink">{d.bookedHours}h</span></li>
                <li className="flex items-baseline gap-2"><span className="h-2 w-2 rounded-full" style={{ background: C.open }} /><span className="font-semibold text-ink/70">Open</span><span className="ml-auto font-bold tabular-nums text-ink">{d.publishedHours - d.bookedHours}h</span></li>
              </ul>
            </Card>
            <Card title="How far ahead they book"><Bars rows={d.leadTime} format={(v) => `${v}`} /></Card>
          </div>
        </>
      )}

      {sub === 'customers' && (
        isFree ? (
          <Locked headline={`Your top guest has spent ${inr(c.topByLtv[0].ltv)}`} src="intel-customers" onUpgrade={() => soon('Opens upgrade')} compact>
            <div className={GRID}><Card title="Top guests"><div className="h-40" /></Card><Card title="Segments"><div className="h-40" /></Card></div>
          </Locked>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <Scorecard label="Customers" value={c.total} />
              <Scorecard label="Repeat rate" value={rate(c.repeatRate)} />
              <Scorecard label="Average spend" value={inr(c.avgSpend)} />
              <Scorecard label="Typical gap" value={`${c.medianGapDays}d`} info="Median days between one booking and the next." />
            </div>
            <div className={GRID}>
              <Card title="Top guests by lifetime spend">
                <DataTable
                  initialSort="ltv" barKey="ltv"
                  columns={[
                    { key: 'label', label: 'Guest', strong: true },
                    { key: 'bookings', label: 'Bookings', align: 'right' },
                    { key: 'ltv', label: 'Lifetime', align: 'right', strong: true, render: (r) => inr(r.ltv) },
                    { key: 'source', label: 'From' },
                  ]}
                  rows={c.topByLtv}
                />
              </Card>
              <Card title="Revenue by segment"><Bars rows={c.segments} valueKey="revenue" format={(v) => inr(v, { compact: true })} note={(r) => `· ${r.count}`} /></Card>
            </div>
            <WinBackCard />
          </>
        )
      )}

      {sub === 'retention' && (
        isFree ? (
          <Locked headline={`${rate(c.repeatRate)} of your bookings are repeat guests`} src="intel-retention" onUpgrade={() => soon('Opens upgrade')}>
            <Card title="Repeat bookings by cohort"><div className="h-44" /></Card>
          </Locked>
        ) : (
          <Card title="Repeat bookings by cohort" info="Read across a row: M1 is the share of that month's new guests who booked again the next month. Shown as a percentage.">
            <CohortTable cohorts={c.cohorts} months={c.cohortMonths} />
          </Card>
        )
      )}
    </div>
  );
};

/* ═══ Shell ═══════════════════════════════════════════════════════════════ */

const PAGES = {
  overview: { Component: Overview, title: 'Overview', freshness: 'live' },
  revenue: { Component: Revenue, title: 'Revenue', freshness: 'live' },
  audience: { Component: Audience, title: 'Audience', freshness: 'rolled' },
  demand: { Component: Demand, title: 'Demand', freshness: 'live' },
};

export default function Intelligence({ go }) {
  const [tab, setTab, tabs] = useUrlTab('intelligence');
  const [range, setRange] = useState('30d');
  const [compare, setCompare] = useState(true);
  const [isFree, setIsFree] = useState(false);

  const page = PAGES[tab] || PAGES.overview;
  const { Component } = page;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-[20px] font-extrabold leading-none tracking-[-0.04em] text-ink">{page.title}</h1>
        {/* PROTOTYPE ONLY — see the free host's locked view without switching accounts. */}
        <div className="flex items-center gap-1 rounded-full border-2 border-dashed border-marigold-600/50 bg-marigold-100/60 px-1.5 py-0.5">
          <span className="text-[9.5px] font-bold uppercase tracking-wide text-ink/45">View as</span>
          {[['Pro', false], ['Free', true]].map(([label, v]) => (
            <button
              key={label} type="button" onClick={() => setIsFree(v)} aria-pressed={isFree === v}
              className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose',
                isFree === v ? 'bg-ink text-white' : 'text-ink/50 hover:text-ink')}
            >{label}</button>
          ))}
        </div>
      </div>

      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <RangeControls range={range} onRange={setRange} compare={compare} onCompare={setCompare} asOf="16 Nov, 7:40 pm" freshness={page.freshness} />

      <Component isFree={isFree} go={go} range={range} compare={compare} />
    </div>
  );
}
