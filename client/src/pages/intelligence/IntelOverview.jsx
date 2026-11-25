// Insights · Overview (Kept) — real data from GET /vendor/intelligence/overview.
// Free: headline tiles + commission. Pro: forecast + win-back. The server REMOVES
// gated figures (each gated block arrives as { locked: true }), so a locked block
// renders as a ghost preview, never as zeros. The band says the one finding in a
// sentence built from real figures (replaces the old "Projected year" tile).
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import { getIntelligenceOverview } from '../../services/api';
import { Avatar, InsightBand, Panel, Tile, inr } from '../../components/dashboard/ui/v2';
import { BandLink, Failed, Fact, Ghost, Loading, linkBtn, plural, serif, useInsight } from './insightsUi';

const isReady = (b) => b && !b.locked && !b.unavailable;
const UPGRADE = '/dashboard/upgrade?src=insights_overview';

// Pure, tested: the band's sentence, picked by what is true for this host.
export const overviewBand = (data) => {
  const leak = data.commissionLeak;
  const net = data.headline?.netRevenue || 0;
  const paidCount = data.headline?.paidBookings || 0;
  const pro = !data.locked;
  if (pro && isReady(data.forecast) && data.forecast.projectedMonth != null) {
    const f = data.forecast;
    return {
      title: <>About {inr(f.projectedMonth, { compact: true })} <em className={serif}>in the next 30 days.</em></>,
      sub: f.confirmedUnpaid?.value > 0
        ? `${inr(f.confirmedUnpaid.value)} of it is already booked and waiting to be paid. ${f.basis}`
        : `An estimate from your recent bookings. ${f.basis}`,
    };
  }
  if (!pro && leak?.aheadBy > 0) {
    return {
      title: <>Pro would have saved you {inr(leak.aheadBy, { compact: true })} <em className={serif}>this year.</em></>,
      sub: `You paid ${inr(leak.commissionPaid)} in commission over the last 12 months. Pro costs ${inr(leak.proCost)} a year.`,
    };
  }
  if (!pro && leak?.projectedYear > 0) {
    return {
      title: <>You&apos;ll pay {inr(leak.projectedYear, { compact: true })} commission <em className={serif}>this year.</em></>,
      sub: `${inr(leak.commissionPaid)} paid in the last 12 months.${leak.projectedYear > leak.proCost ? ` That's more than Pro costs (${inr(leak.proCost)} a year).` : ''}`,
    };
  }
  if (paidCount > 0) {
    return {
      title: <>You&apos;ve kept {inr(net, { compact: true })} <em className={serif}>from {plural(paidCount, 'booking')}.</em></>,
      sub: 'After fees and refunds. Revenue shows where the rest went.',
    };
  }
  return {
    title: <>Your insights grow <em className={serif}>with every booking.</em></>,
    sub: 'Revenue, guests and busy days fill in here as people book.',
  };
};

const CommissionPanel = ({ leak }) => {
  const share = leak.proCost ? Math.min(1, leak.commissionPaid / leak.proCost) : 0;
  return (
    <Panel title="Commission" subtitle="Last 12 months, including GST">
      <div className="grid grid-cols-2 gap-2">
        <Fact label="You paid" value={inr(leak.commissionPaid)} />
        <Fact label="Pro costs" value={inr(leak.proCost)} hint="A year" />
      </div>
      <div className="mt-4" role="img" aria-label={`${Math.round(share * 100)}% of Pro's yearly price paid in commission`}>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-maroon" style={{ width: `${Math.max(share * 100, share ? 2 : 0)}%` }} />
        </div>
        <p className="mb-0 mt-2.5 text-[14px] text-ink">
          {leak.aheadBy > 0
            ? <>Your commission is past Pro&apos;s price by <b>{inr(leak.aheadBy)}</b>.</>
            : <><b>{inr(leak.stillToBreakEven)}</b> more in commission and Pro would have paid for itself.</>}
        </p>
        {leak.basis && <p className="mb-0 mt-1 text-[12.5px] text-faint">{leak.basis}</p>}
      </div>
    </Panel>
  );
};

const ForecastPanel = ({ f }) => (
  <Panel title="Coming in" subtitle="Firm money first, then an estimate">
    <div className="grid grid-cols-2 gap-2">
      <Fact label="Booked, not paid yet" value={inr(f.confirmedUnpaid?.value, { compact: true })}
        hint={plural(f.confirmedUnpaid?.bookings ?? 0, 'booking')} />
      {f.projectedMonth == null
        ? <Fact label="Next 30 days" value={<span className="text-[15px] font-medium tracking-normal text-muted">Not enough history yet</span>} />
        : <Fact label="Next 30 days" value={inr(f.projectedMonth, { compact: true })} hint="Estimate" />}
    </div>
    {f.basis && <p className="mb-0 mt-2.5 text-[12.5px] text-faint">{f.basis}</p>}
  </Panel>
);

const WinBackPanel = ({ w, go }) => (
  <Panel title="Win back" subtitle={`Guests who haven't booked in ${w.staleDays} days`}
    action={<button type="button" onClick={() => go('/dashboard/clients')} className={linkBtn}>Clients <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></button>}>
    {w.guests?.length ? (
      <>
        <p className="mb-2 text-[14px] text-ink"><b>{inr(w.atStake)}</b> <span className="text-muted">spent with you, all time, by these guests.</span></p>
        <ul className="flex flex-col divide-y divide-neutral-200">
          {w.guests.map((g) => (
            <li key={g.key} className="flex items-center gap-3 py-2.5">
              <Avatar name={g.name} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-semibold text-ink">{g.name}</span>
                <span className="block text-[13px] text-faint">Last booked {g.daysSince} days ago · {plural(g.bookings, 'booking')}</span>
              </span>
              <span className="shrink-0 text-[14px] font-semibold tabular-nums text-ink">{inr(g.lifetime)}</span>
            </li>
          ))}
        </ul>
      </>
    ) : (
      <p className="mb-0 rounded-[16px] bg-cream p-4 text-[14px] text-muted">Nobody has drifted away. Everyone who booked did so recently.</p>
    )}
  </Panel>
);

const IntelOverview = () => {
  const navigate = useNavigate();
  const go = (to) => navigate(to);
  const [data, reload] = useInsight(getIntelligenceOverview, 'overview');

  if (data === false) return <Failed what="insights" onRetry={reload} />;
  if (data === null) return <Loading />;

  const { headline: h, commissionLeak: leak, forecast, winBack } = data;
  const pro = !data.locked;
  const band = overviewBand(data);
  // The commission-vs-Pro meter is a Starter argument; a Pro host pays none.
  const showCommission = !pro && !!leak;
  const soon = pro ? [['peer benchmarks', data.benchmarks], ['weekly moves', data.moves]].filter(([, b]) => b?.unavailable).map(([k]) => k) : [];

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <InsightBand mascot="purple" eyebrow={pro ? 'Insights' : 'Insights · Starter'} title={band.title} sub={band.sub}
        actions={(
          <>
            {!pro && <BandLink to={UPGRADE}><Sparkles className="h-4 w-4" strokeWidth={2.4} /> See Pro</BandLink>}
            <BandLink to="/dashboard/intelligence/revenue" ghost={!pro}>See revenue <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandLink>
          </>
        )} />

      {h && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Tile label="Net revenue" value={inr(h.netRevenue, { compact: true })} hint="After fees and refunds" more="Revenue"
            onClick={() => go('/dashboard/intelligence/revenue')} />
          <Tile label="Paid bookings" value={(h.paidBookings ?? 0).toLocaleString('en-IN')} hint="All time" more="Demand"
            onClick={() => go('/dashboard/intelligence/demand')} />
          <Tile label="Page views" value={h.profileViews == null ? null : h.profileViews.toLocaleString('en-IN')}
            note="Not tracked yet" hint="Your public page" />
          <Tile label="Views that booked" value={h.viewToBook == null ? null : `${h.viewToBook}%`}
            note="Needs page views" hint="Of page visits" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
        {showCommission && <CommissionPanel leak={leak} />}
        {isReady(forecast) ? <ForecastPanel f={forecast} />
          : forecast?.locked && <Ghost title="Coming in" line="What's booked and what's likely over the next 30 days." shape="figures" />}
        {(isReady(winBack) || winBack?.locked) && (
          <div className={showCommission ? 'lg:col-span-2' : ''}>
            {winBack.locked
              ? <Ghost title="Win back" line="Guests who've gone quiet, ranked by what they've spent." shape="rows" />
              : <WinBackPanel w={winBack} go={go} />}
          </div>
        )}
      </div>

      {soon.length > 0 && (
        <p className="mb-0 px-1 text-[13px] text-faint">On the way: {soon.join(' and ')}, once there&apos;s enough data to make them honest.</p>
      )}
    </div>
  );
};

export default IntelOverview;
