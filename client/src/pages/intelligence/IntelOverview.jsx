// Creator Intelligence · Overview — real data from GET /host/intelligence/overview.
// Free: headline tiles + commission leak. Pro: forecast, win-back (+ benchmarks / moves
// once the backend ships them). The server REMOVES gated figures (replaces each block
// with { locked: true }); this page renders only blocks that are present and unlocked,
// and shows one upsell card for the locked ones. Never renders a gated block with zeros.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { getIntelligenceOverview } from '../../services/api';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { PageHeading, Panel, SubNav, Tile, inr } from '../../components/dashboard/ui/v2';
import { INTELLIGENCE_NAV } from '../dashboardNav';

const LOCKED_LABELS = {
  forecast: 'Revenue forecast',
  winBack: 'Win-back list',
  benchmarks: 'Peer benchmarks',
  cohorts: 'Guest cohorts',
  moves: 'Weekly moves',
};

const isLocked = (b) => b?.locked === true;
const isReady = (b) => b && !b.locked && !b.unavailable;

const Note = ({ children }) => <p className="text-[11px] font-medium text-ink/55">{children}</p>;

const IntelOverview = () => {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  const load = async () => {
    setErr(false);
    setData(null);
    try { const res = await getIntelligenceOverview(); setData(res.data || {}); }
    catch { setErr(true); }
  };
  useEffect(() => { load(); }, []);

  const header = (
    <>
      <PageHeading title="Intelligence" sub="What your commission is costing you, and where to act next." />
    </>
  );

  if (err) {
    return <div className="flex flex-col gap-2.5">{header}<ErrorState message="Couldn't load your intelligence." onRetry={load} /></div>;
  }
  if (data === null) {
    return <div className="flex flex-col gap-2.5">{header}<Skeleton className="h-28 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  }

  const { headline, commissionLeak: leak, forecast, winBack, benchmarks, moves, cohorts } = data;
  const lockedKeys = Object.keys(LOCKED_LABELS).filter((k) => isLocked(data[k]));
  const unavailable = [['Peer benchmarks', benchmarks], ['Weekly moves', moves], ['Guest cohorts', cohorts]]
    .filter(([, b]) => b?.unavailable);

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      {headline && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Net revenue" value={inr(headline.netRevenue, { compact: true })} accent hint="After fees and refunds" />
          <Tile label="Paid bookings" value={headline.paidBookings ?? 0} hint="All time" />
          <Tile label="Profile views"
            value={headline.profileViews == null ? '—' : headline.profileViews.toLocaleString('en-IN')}
            hint={headline.profileViews == null ? 'Not tracked yet' : 'On your public page'} />
          <Tile label="View to booking"
            value={headline.viewToBook == null ? '—' : `${headline.viewToBook}%`}
            hint={headline.viewToBook == null ? 'Needs profile views' : 'Of views that booked'} />
        </div>
      )}

      {leak && (
        <Panel title="Commission paid" subtitle="Trailing 12 months, including GST on commission">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Commission paid" value={inr(leak.commissionPaid)} hint="Last 12 months" />
            <Tile label="Pro costs" value={inr(leak.proCost)} hint="Per year" />
            {leak.aheadBy > 0
              ? <Tile label="Pro would have saved" value={inr(leak.aheadBy)} accent hint="Commission above Pro's price" />
              : <Tile label="Still to break even" value={inr(leak.stillToBreakEven)} hint="More commission until Pro pays off" />}
            <Tile label="Projected year" value={leak.projectedYear == null ? '—' : inr(leak.projectedYear, { compact: true })}
              hint={leak.projectedYear == null ? 'Not enough history' : 'At this pace'} />
          </div>
          {leak.basis && <div className="mt-2"><Note>{leak.basis}</Note></div>}
        </Panel>
      )}

      {isReady(forecast) && (
        <Panel title="Forecast" subtitle="Firm money first, then an estimate">
          <div className="grid grid-cols-2 gap-2">
            <Tile label="Confirmed, unpaid" value={inr(forecast.confirmedUnpaid?.value, { compact: true })}
              hint={`${forecast.confirmedUnpaid?.bookings ?? 0} booking${forecast.confirmedUnpaid?.bookings === 1 ? '' : 's'}`} />
            <Tile label="Projected next 30 days" value={forecast.projectedMonth == null ? '—' : inr(forecast.projectedMonth, { compact: true })}
              hint="Estimate" />
          </div>
          {forecast.basis && <div className="mt-2"><Note>{forecast.basis}</Note></div>}
        </Panel>
      )}

      {isReady(winBack) && (
        <Panel title="Win back" subtitle={`Guests who haven't booked in ${winBack.staleDays} days, by lifetime spend`}>
          {winBack.guests?.length ? (
            <>
              <p className="mb-2 text-[12px] font-bold text-ink">{inr(winBack.atStake)} <span className="font-medium text-ink/55">in lifetime spend from these guests</span></p>
              <ul className="divide-y divide-neutral-200 overflow-hidden rounded-[8px] border-2 border-neutral-200">
                {winBack.guests.map((g) => (
                  <li key={g.key} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-bold text-ink">{g.name}</p>
                      <p className="text-[10.5px] font-medium text-ink/50">
                        {g.daysSince} days ago · {g.bookings} booking{g.bookings !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-[12px] font-bold tabular-nums text-ink">{inr(g.lifetime)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <Note>No lapsed guests right now. Everyone who has booked did so recently.</Note>
          )}
        </Panel>
      )}

      {lockedKeys.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border-2 border-maroon/20 bg-blush/60 p-3">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-maroon" strokeWidth={2.4} />
            <h2 className="mb-0 font-display text-[12.5px] font-bold tracking-[-0.02em] text-maroon">Intelligence is on Pro</h2>
          </div>
          <p className="text-[11.5px] font-medium text-ink/65">
            Pro adds {lockedKeys.map((k) => LOCKED_LABELS[k].toLowerCase()).join(', ')}.
          </p>
          <Link to="/dashboard/upgrade?src=intelligence"
            className="inline-flex w-fit items-center gap-1 rounded-full bg-maroon px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-maroon-dark">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} /> See Pro
          </Link>
        </section>
      )}

      {unavailable.length > 0 && (
        <Panel title="Coming soon">
          <ul className="flex flex-col gap-1">
            {unavailable.map(([label, b]) => (
              <li key={label}><Note><span className="font-bold text-ink/80">{label}.</span> {b.unavailable}</Note></li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
};

export default IntelOverview;
