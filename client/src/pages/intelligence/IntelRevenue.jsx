// Insights · Revenue (Kept) — the reconciliation, from GET /vendor/intelligence/money.
// Ungated: free hosts already get earnings history. Absorbs the old Earnings page
// (its period chips come along; /dashboard/earnings redirects here).
//
// Presentation only: every figure is the server's. Nothing here recomputes net,
// commission or tax. Two rules from the CA ruling (2026-11-17):
//  · withholding is FY-scoped, so the tax panel ALWAYS reads the all-time call
//    (the server scopes it to the FY) and never the period-filtered one, and the
//    "where it went" list does not show an all-time TDS/TCS total;
//  · ₹0 deduction lines are hidden, not shown as ₹0.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronDown, Info } from 'lucide-react';
import { getIntelligenceMoney } from '../../services/api';
import { Skeleton } from '../../components/dashboard/ui';
import { BarChart, InsightBand, Panel, RankedBars, Tile, cn, inr } from '../../components/dashboard/ui/v2';
import { periodStart } from '../money/earningsModel';
import { BandLink, Failed, Fact, Loading, Notice, linkBtn, monthLabel, monthLong, plural, serif, useInsight } from './insightsUi';

const PERIODS = [
  { value: 'all', label: 'All time', phrase: '' },
  { value: '30d', label: '30 days', phrase: ' in the last 30 days' },
  { value: '90d', label: '90 days', phrase: ' in the last 90 days' },
  { value: 'year', label: 'This year', phrase: ' this year' },
];

// Pure, tested: the deduction lines worth showing — ₹0 lines hidden.
export const deductionLines = (s) => [
  ['Commission', (s.commission || 0) + (s.commissionGst || 0), 'Including GST'],
  ['Platform fee', (s.platformFee || 0) + (s.platformFeeGst || 0), 'Including GST'],
  ['Payment gateway', s.razorpayFee || 0, 'Fee and tax'],
  ['Refunded', s.refunded || 0, 'Returned to guests'],
].filter(([, v]) => v > 0);

// Pure, tested: chart labels for the monthly series ("Oct", or "Oct 25" across years).
export const monthSeries = (byMonth = []) => {
  const years = new Set(byMonth.map((m) => String(m.month).slice(0, 4)));
  return byMonth.map((m) => ({ ...m, label: monthLabel(m.month, years.size > 1) }));
};

// Period: a full-width segmented control on a phone, a compact one on desktop.
const PeriodChips = ({ value, onChange }) => (
  <div role="group" aria-label="Period" className="grid grid-cols-4 gap-1 rounded-[14px] bg-white p-1 lg:w-fit lg:flex">
    {PERIODS.map((p) => (
      <button key={p.value} type="button" onClick={() => onChange(p.value)} aria-pressed={value === p.value}
        className={cn('inline-flex h-10 min-w-0 items-center justify-center whitespace-nowrap rounded-[10px] px-1 text-[13px] font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose lg:px-4 lg:text-[13.5px]',
          value === p.value ? 'bg-ink text-white' : 'text-muted active:bg-blush lg:hover:bg-blush lg:hover:text-maroon')}>
        {p.label}
      </button>
    ))}
  </div>
);

const WentPanel = ({ s }) => {
  const lines = deductionLines(s);
  const kept = s.gross > 0 ? Math.max(0, Math.min(1, s.net / s.gross)) : 1;
  const taxed = (s.tds || 0) + (s.tcs || 0) > 0;
  return (
    <Panel title="Where the money went" subtitle="From what guests paid to what you keep">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-neutral-100" role="img"
        aria-label={`You keep ${Math.round(kept * 100)}% of what guests paid`}>
        <span className="h-full bg-maroon" style={{ width: `${kept * 100}%` }} />
        <span className="h-full flex-1 bg-rose-500" />
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-neutral-200">
        <li className="flex items-baseline justify-between gap-3 py-2.5">
          <span className="text-[14px] text-ink">Guests paid</span>
          <span className="text-[14.5px] font-semibold tabular-nums text-ink">{inr(s.gross)}</span>
        </li>
        {lines.map(([label, v, hint]) => (
          <li key={label} className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="min-w-0 text-[14px] text-ink">{label} <span className="text-[12.5px] text-faint">· {hint}</span></span>
            <span className="shrink-0 text-[14.5px] font-semibold tabular-nums text-rose-600">−{inr(v)}</span>
          </li>
        ))}
        {taxed && (
          <li className="flex items-baseline justify-between gap-3 py-2.5">
            <span className="text-[14px] text-ink">Tax withheld</span>
            <span className="shrink-0 text-[13px] text-faint">This year, under Tax below</span>
          </li>
        )}
        <li className="flex items-baseline justify-between gap-3 py-2.5">
          <span className="text-[14px] font-semibold text-ink">You keep</span>
          <span className="font-display text-[20px] font-extrabold tabular-nums tracking-[-0.02em] text-maroon">{inr(s.net)}</span>
        </li>
      </ul>
      {!lines.length && <p className="mb-0 mt-1 text-[12.5px] text-faint">No fees or refunds taken in this period.</p>}
    </Panel>
  );
};

// Grouped list rows (label + meta left, amount right): reads as one list on a
// phone instead of three stacked cards.
const NowPanel = ({ settlement, upcoming, go }) => {
  const rows = [
    settlement && ['In your bank', 'Settled', settlement.settled],
    settlement && ['On its way', 'Paid by guests, not settled yet', settlement.pending],
    upcoming && ['Booked, not paid yet', plural(upcoming.bookings, 'booking'), upcoming.value],
  ].filter(Boolean);
  return (
    <Panel title="Where it is now" subtitle="Paid out, on the way, or still to be paid"
      action={<button type="button" onClick={() => go('/dashboard/payments/payouts')} className={linkBtn}>Payouts <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></button>}>
      <ul className="flex flex-col divide-y divide-neutral-200">
        {rows.map(([label, meta, v]) => (
          <li key={label} className="flex min-h-[56px] items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] font-semibold text-ink">{label}</span>
              <span className="block truncate text-[12.5px] text-faint">{meta}</span>
            </span>
            <span className="shrink-0 font-display text-[20px] font-extrabold tabular-nums tracking-[-0.02em] text-ink">{inr(v)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
};

const MonthPanel = ({ byMonth }) => {
  const rows = monthSeries(byMonth);
  return (
    <Panel title="By month" subtitle="What you kept, oldest first">
      {rows.length >= 3 ? (
        <div className="pt-5">
          <BarChart data={rows} valueKey="net" labelKey="label"
            tip={(r) => `${monthLong(r.month)} · ${inr(r.net)} kept · ${plural(r.bookings, 'booking')}`} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {rows.map((r) => <Fact key={r.month} label={monthLong(r.month)} value={inr(r.net, { compact: true })} hint={plural(r.bookings, 'booking')} />)}
        </div>
      )}
    </Panel>
  );
};

const ServicePanel = ({ byService, conc }) => (
  <Panel title="By service" subtitle="What guests paid, highest first">
    {byService.length === 1 ? (
      <p className="mb-0 text-[14px] text-ink">All of it came from <b>{byService[0].label}</b>: {plural(byService[0].bookings, 'booking')}, {inr(byService[0].gross)}.</p>
    ) : (
      <RankedBars rows={byService} valueKey="gross" labelKey="label" format={(v) => (v ? inr(v) : 'Free')}
        secondary={(r) => `· ${plural(r.bookings, 'booking')}`} />
    )}
    {conc?.share != null && conc.guests > conc.topN && (
      <p className="mb-0 mt-4 rounded-[16px] bg-cream px-4 py-3 text-[14px] text-ink">
        <b>{conc.share}%</b> of your revenue comes from your top {conc.topN} guests, out of {conc.guests}.
      </p>
    )}
  </Panel>
);

const TaxPanel = ({ w }) => {
  const [open, setOpen] = useState(false);
  const none = !(w.total > 0);
  const notes = [w.disclosure?.tds, w.disclosure?.tcs, w.disclosure?.caveat].filter((t) => typeof t === 'string');
  return (
    <Panel title={none ? 'No tax withheld this year' : `Tax withheld · ${w.fyLabel}`}
      subtitle={none ? `${w.fyLabel} · from your payout records` : 'From your payout records'}>
      {!none && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {w.tds > 0 && <Fact label="TDS" value={inr(w.tds, { decimals: true })} />}
          {w.tcs > 0 && <Fact label="TCS" value={inr(w.tcs, { decimals: true })} />}
          <Fact label="Total" value={inr(w.total, { decimals: true })} hint={`Across ${plural(w.bookingsMeasured, 'booking')}`} />
        </div>
      )}
      {w.bookingsUnknown > 0 && (
        <p className={cn('mb-0 text-[14px] text-ink', !none && 'mt-3')}>
          {plural(w.bookingsUnknown, 'booking')} ({inr(w.unknownGross)} paid) have no payout record yet, so they aren&apos;t counted here.
        </p>
      )}
      {notes.length > 0 && (
        <div className={cn((!none || w.bookingsUnknown > 0) && 'mt-3')}>
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={cn(linkBtn, '-ml-2')}>
            What this means <ChevronDown className={cn('h-4 w-4 transition', open && 'rotate-180')} strokeWidth={2.4} />
          </button>
          {open && (
            <div className="mt-1 flex flex-col gap-1.5 text-[13px] text-muted">
              {notes.map((t) => <p key={t} className="mb-0">{t}</p>)}
            </div>
          )}
        </div>
      )}
    </Panel>
  );
};

const IntelRevenue = () => {
  const navigate = useNavigate();
  const go = (to) => navigate(to);
  const [period, setPeriod] = useState('all');
  const p = PERIODS.find((x) => x.value === period);
  const [all, reloadAll] = useInsight(getIntelligenceMoney, 'money-all');
  const [scoped, reloadScoped] = useInsight(
    () => (period === 'all' ? Promise.resolve(null) : getIntelligenceMoney({ from: periodStart(period).toISOString() })),
    `money-${period}`,
  );
  const data = period === 'all' ? all : scoped;

  if (all === false || data === false) return <Failed what="revenue" onRetry={() => { reloadAll(); if (period !== 'all') reloadScoped(); }} />;
  if (all === null) return <Loading />;

  const s = data?.summary;
  const has = s && s.bookings > 0;
  const kept = has && s.gross > 0 ? Math.round((s.net / s.gross) * 100) : null;
  const commission = has ? (s.commission || 0) + (s.commissionGst || 0) : 0;
  const pending = data?.settlement?.pending || 0;

  const band = !data ? null : has ? (
    <InsightBand mascot="purple" eyebrow={`Revenue${p.phrase ? ` · ${p.label}` : ''}`}
      title={kept != null
        ? <>You keep {inr(kept)} <em className={serif}>of every ₹100 guests pay.</em></>
        : <>{plural(s.bookings, 'paid booking')} <em className={serif}>{p.phrase ? p.phrase.trim() : 'so far'}.</em></>}
      sub={[
        commission > 0 && `Commission took ${inr(commission)}${p.phrase}.`,
        pending > 0 && `${inr(pending)} is on its way to your bank.`,
      ].filter(Boolean).join(' ') || `You kept ${inr(s.net)} from ${plural(s.bookings, 'paid booking')}${p.phrase}.`}
      actions={<BandLink to="/dashboard/payments/payouts">See payouts <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandLink>} />
  ) : (
    <InsightBand mascot="purple" eyebrow="Revenue"
      title={period === 'all' ? <>No paid bookings <em className={serif}>yet.</em></> : <>No paid bookings <em className={serif}>{p.phrase.trim()}.</em></>}
      sub={period === 'all' ? 'What guests pay, what comes out and what reaches you fills in here once a guest pays.' : 'Try a longer period to see more.'}
      actions={period === 'all' ? <BandLink to="/dashboard/bookings">See bookings <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandLink> : null} />
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {data === null ? <Skeleton className="h-[200px] rounded-[28px] sm:rounded-[32px]" /> : band}
      <PeriodChips value={period} onChange={setPeriod} />
      {data === null && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[112px] rounded-[20px]" />)}
        </div>
      )}

      {data && has && (
        <>
          {s.derivedLeads && (
            <Notice icon={Info}>
              {plural(s.derivedRows, 'older booking')} ({inr(s.derivedValue)}) had no payout record, so what you kept from {s.derivedRows === 1 ? 'it' : 'them'} is estimated.
            </Notice>
          )}

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Tile label="You kept" value={inr(s.net, { compact: true })} accent hint="After fees" />
            <Tile label="Guests paid" value={inr(s.gross, { compact: true })} hint="Before fees" />
            <Tile label="Paid bookings" value={s.bookings.toLocaleString('en-IN')} hint={`${inr(s.aov)} each on average`} />
            <Tile label="Kept per booking" value={inr(s.netAov)} hint="On average" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            <WentPanel s={s} />
            <NowPanel settlement={data.settlement} upcoming={data.upcoming} go={go} />
            {data.byMonth?.length > 0 && <MonthPanel byMonth={data.byMonth} />}
            {data.byService?.length > 0 && <ServicePanel byService={data.byService} conc={data.concentration} />}
          </div>
        </>
      )}

      {data && !has && data.upcoming?.bookings > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Tile label="Booked, not paid yet" value={inr(data.upcoming.value, { compact: true })} hint={plural(data.upcoming.bookings, 'booking')} />
        </div>
      )}

      {/* Always the all-time call: the server scopes withholding to the FY itself. */}
      {all.withholding && <TaxPanel w={all.withholding} />}
    </div>
  );
};

export default IntelRevenue;
