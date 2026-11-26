// Insights · Overview (Kept) — real data from GET /vendor/intelligence/overview.
// Follows the founder-approved mock (2026-11-26): a band with the commission
// finding and a side card, four headline tiles, "Commission so far" beside
// "Your next steps", then one grouped Pro preview for Starter hosts.
//
// Free: headline tiles + commission. Pro: forecast + win-back. The server REMOVES
// gated figures (each gated block arrives as { locked: true }), so a locked block
// renders as ghost shapes, never as zeros.
import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowRight, CalendarCheck, ChevronRight, Eye, IndianRupee, Info, Lock, MousePointerClick, ReceiptText, Share2, Sparkles, Users,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getIntelligenceOverview, markLinkShared } from '../../services/api';
import { Avatar, InsightBand, Panel, Tile, cn, inr } from '../../components/dashboard/ui/v2';
import { BandLink, Failed, Fact, Loading, linkBtn, plural, serif, useInsight } from './insightsUi';

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
      eyebrow: 'Coming in',
      title: <>About {inr(f.projectedMonth, { compact: true })} <em className={serif}>in the next 30 days.</em></>,
      sub: f.confirmedUnpaid?.value > 0
        ? `${inr(f.confirmedUnpaid.value)} of it is already booked and waiting to be paid. ${f.basis}`
        : `An estimate from your recent bookings. ${f.basis}`,
    };
  }
  if (!pro && leak?.aheadBy > 0) {
    return {
      eyebrow: 'Commission · last 12 months',
      title: <>Pro would have saved you {inr(leak.aheadBy, { compact: true })} <em className={serif}>this year.</em></>,
      sub: `You paid ${inr(leak.commissionPaid)} in commission over the last 12 months. Pro costs ${inr(leak.proCost)} a year.`,
    };
  }
  if (!pro && leak?.projectedYear > 0) {
    return {
      eyebrow: 'Commission · at this pace',
      title: <>You&apos;re on track to pay {inr(leak.projectedYear, { compact: true })} <em className={serif}>in commission this year.</em></>,
      sub: `${inr(leak.commissionPaid)} paid in the last 12 months.${leak.projectedYear > leak.proCost ? ` That's more than Pro costs (${inr(leak.proCost)} a year).` : ''}`,
    };
  }
  if (paidCount > 0) {
    return {
      eyebrow: 'Insights',
      title: <>You&apos;ve kept {inr(net, { compact: true })} <em className={serif}>from {plural(paidCount, 'booking')}.</em></>,
      sub: 'After fees and refunds. Revenue shows where the rest went.',
    };
  }
  return {
    eyebrow: 'Insights',
    title: <>Your insights grow <em className={serif}>with every booking.</em></>,
    sub: 'Revenue, guests and busy days fill in here as people book.',
  };
};

/* The band's side card (mock): projected year against Pro's price. Starter only,
 * and only when there is a projection to show. */
// The mascot sits beside the card here (mock), not behind it, so the band gets
// no `mascot` prop when the aside shows — still one mascot on the screen.
const BandAside = ({ leak }) => {
  const share = leak.projectedYear ? Math.min(1, leak.proCost / leak.projectedYear) : 0;
  return (
    <div className="flex items-center gap-4">
    <div className="min-w-0 flex-1 rounded-[20px] bg-white/[0.1] p-4 text-white ring-1 ring-inset ring-white/15 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-white/80">Commission, projected year</span>
        <span className="font-display text-[20px] font-extrabold tabular-nums">{inr(leak.projectedYear, { compact: true })}</span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-white/80">Pro, per year</span>
        <span className="text-[15px] font-semibold tabular-nums">{inr(leak.proCost)}</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/15" aria-hidden="true">
        <div className="h-full rounded-full bg-pink" style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mb-0 mt-2.5 text-[12.5px] text-white/75">Last 12 months: {inr(leak.commissionPaid)} on commission</p>
    </div>
    <img src="/about/mascot-purple.png" alt="" aria-hidden="true" className="hidden w-[112px] shrink-0 object-contain sm:block xl:w-[136px]" />
    </div>
  );
};

/* Icon chip for a tile's label (mock): blush square, maroon glyph. */
const chip = (Icon, label) => (
  <span className="flex items-center gap-2">
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[10px] bg-blush text-maroon"><Icon className="h-4 w-4" strokeWidth={2.2} /></span>
    <span className="truncate">{label}</span>
  </span>
);

const CommissionPanel = ({ leak, go, panelRef }) => {
  const share = leak.proCost ? Math.min(1, leak.commissionPaid / leak.proCost) : 0;
  return (
    <section ref={panelRef} id="commission" className="scroll-mt-24">
      <Panel title="Commission so far" subtitle="How close you are to Pro paying for itself"
        action={<button type="button" onClick={() => go('/dashboard/intelligence/revenue')} className={linkBtn}>Revenue <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></button>}>
        <div role="img" aria-label={`${inr(leak.commissionPaid)} paid in commission, Pro breaks even at ${inr(leak.proCost)}`}>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-maroon" style={{ width: `${Math.max(share * 100, share ? 2 : 0)}%` }} />
          </div>
          <div className="mt-2 flex justify-between gap-3 text-[13px]">
            <span className="text-ink"><b className="tabular-nums">{inr(leak.commissionPaid)}</b> <span className="text-muted">paid in the last 12 months</span></span>
            <span className="shrink-0 text-muted">Pro breaks even <b className="tabular-nums text-ink">{inr(leak.proCost)}</b></span>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3">
          {leak.aheadBy > 0
            ? <Fact label="Past break-even by" value={inr(leak.aheadBy)} />
            : <Fact label="Still to break even" value={inr(leak.stillToBreakEven)} />}
          <Fact label="Pro costs" value={inr(leak.proCost)} hint="A year" />
          {leak.projectedYear == null
            ? <Fact label="Projected year" value={<span className="text-[15px] font-medium tracking-normal text-muted">Not enough history yet</span>} />
            : <Fact label="Projected year" value={inr(leak.projectedYear, { compact: true })} hint="At this pace" />}
        </div>
        {leak.basis && (
          <p className="mb-0 mt-3 flex items-start gap-1.5 text-[12.5px] text-faint">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={2.2} />{leak.basis} Includes GST on commission.
          </p>
        )}
      </Panel>
    </section>
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

/* Your next steps (mock). Things to DO from here; asks that live elsewhere (KYC,
 * confirmations) stay where they are — one fact, one place. */
const NextSteps = ({ steps }) => (
  <Panel title="Your next steps" subtitle="Three things that move these numbers" bodyClassName="!pt-3">
    <ul className="flex flex-col gap-2">
      {steps.map((s) => (
        <li key={s.title}>
          <button type="button" onClick={s.onClick}
            className="flex min-h-[56px] w-full items-center gap-3 rounded-[16px] bg-cream px-3 py-2.5 text-left transition hover:bg-blush focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-white text-maroon"><s.icon className="h-[18px] w-[18px]" strokeWidth={2.2} /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold text-ink">{s.title}</span>
              <span className="block truncate text-[12.5px] text-faint">{s.line}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-maroon" strokeWidth={2.4} />
          </button>
        </li>
      ))}
    </ul>
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
                <span className="block truncate text-[13px] text-faint">Last booked {g.daysSince} days ago · {plural(g.bookings, 'booking')}</span>
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

/* Grouped Pro preview (mock): the pitch on the left, ghost cards on the right.
 * Ghost cards carry shapes only, no figures (the server sent none). */
const GhostCard = ({ title, line, soon, shape }) => (
  <div aria-hidden="true" className="rounded-[18px] bg-cream p-4">
    <div className="flex items-start justify-between gap-2">
      <p className="mb-0 text-[14px] font-semibold text-ink">{title}</p>
      {soon && <span className="shrink-0 rounded-[6px] bg-white px-1.5 py-0.5 text-[12px] font-medium text-muted">Soon</span>}
    </div>
    <p className="mb-0 mt-0.5 text-[12.5px] text-faint">{line}</p>
    {shape === 'bars' && (
      <div className="mt-3 flex h-10 items-end gap-1.5">
        {[40, 55, 45, 60, 50, 100].map((h, i) => <span key={i} className={cn('flex-1 rounded-t-[4px]', i === 5 ? 'bg-pink/60' : 'bg-neutral-200/80')} style={{ height: `${h}%` }} />)}
      </div>
    )}
    {shape === 'rows' && (
      <div className="mt-3 flex flex-col gap-2">
        {[0.85, 0.6].map((w) => <span key={w} className="h-2.5 rounded-full bg-neutral-200/80" style={{ width: `${w * 100}%` }} />)}
      </div>
    )}
  </div>
);

const ProPreview = ({ go }) => (
  <section aria-label="What Pro adds" className="grid grid-cols-1 gap-5 rounded-[24px] bg-white p-5 sm:p-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.6fr)] lg:items-center lg:gap-8">
    <div>
      <span className="inline-flex items-center gap-1 rounded-[8px] bg-blush px-2.5 py-0.5 text-[12px] font-semibold text-maroon"><Lock className="h-3 w-3" strokeWidth={2.6} /> On Pro</span>
      <h2 className="mb-0 mt-3 font-display text-[20px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[22px]">See what&apos;s coming, not just what came.</h2>
      <p className="mb-0 mt-2 text-[14px] text-muted">Pro adds a revenue forecast and a win-back list of guests who haven&apos;t returned.</p>
      <button type="button" onClick={() => go(UPGRADE)}
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-[12px] bg-maroon px-5 text-[14px] font-semibold text-white transition hover:bg-maroon-dark focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-rose">
        See Pro <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
      </button>
    </div>
    <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
      <GhostCard title="Revenue forecast" line="Confirmed money, then the next 30 days" shape="bars" />
      <GhostCard title="Win-back list" line="Guests who haven't booked lately" shape="rows" />
      <GhostCard title="Peer benchmarks" line="How you compare with similar hosts" soon />
      <GhostCard title="Weekly moves" line="One suggested action each week" soon />
    </div>
  </section>
);

const IntelOverview = () => {
  const navigate = useNavigate();
  const go = (to) => navigate(to);
  const { user } = useAuth();
  const commissionRef = useRef(null);
  const [data, reload] = useInsight(getIntelligenceOverview, 'overview');

  if (data === false) return <Failed what="insights" onRetry={reload} />;
  if (data === null) return <Loading />;

  const { headline: h, commissionLeak: leak, forecast, winBack } = data;
  const pro = !data.locked;
  const band = overviewBand(data);
  const showCommission = !pro && !!leak; // a Starter argument; a Pro host pays none
  const showAside = showCommission && leak.projectedYear > 0;

  const copyLink = async () => {
    if (!user?.username) { go('/dashboard/profile'); return; }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${user.username}`);
      toast.success('Booking link copied');
      markLinkShared();
    } catch { toast.error('Could not copy your link.'); }
  };
  const steps = [
    { icon: Share2, title: 'Share your booking page', line: 'More visitors, more bookings', onClick: copyLink },
    { icon: ReceiptText, title: 'See where the money went', line: 'Revenue, line by line', onClick: () => go('/dashboard/intelligence/revenue') },
    pro
      ? { icon: Users, title: 'Win back quiet guests', line: 'Message the ones who drifted', onClick: () => go('/dashboard/clients') }
      : { icon: Sparkles, title: 'Compare plans', line: 'What Pro adds, and what it costs', onClick: () => go(UPGRADE) },
  ];

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <InsightBand mascot={showAside ? undefined : 'purple'} eyebrow={band.eyebrow} title={band.title} sub={band.sub}
        aside={showAside ? <BandAside leak={leak} /> : null}
        actions={(
          <>
            {!pro && <BandLink to={UPGRADE}>See what Pro includes <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandLink>}
            {showCommission
              ? (
                <button type="button" onClick={() => commissionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="inline-flex h-11 items-center gap-2 rounded-[12px] bg-maroon-700 px-5 text-[14px] font-semibold text-white ring-2 ring-inset ring-white/35 transition hover:ring-white/60 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-pink">
                  How this is worked out
                </button>
              )
              : <BandLink to="/dashboard/intelligence/revenue" ghost={!pro}>See revenue <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandLink>}
          </>
        )} />

      {h && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <Tile label={chip(IndianRupee, 'Net revenue')} value={inr(h.netRevenue, { compact: true })} hint="After fees and refunds"
            onClick={() => go('/dashboard/intelligence/revenue')} />
          <Tile label={chip(CalendarCheck, 'Paid bookings')} value={(h.paidBookings ?? 0).toLocaleString('en-IN')} hint="All time"
            onClick={() => go('/dashboard/intelligence/demand')} />
          <Tile label={chip(Eye, 'Page views')} value={h.profileViews == null ? null : h.profileViews.toLocaleString('en-IN')}
            note="Not tracked yet" hint="Your public page" />
          <Tile label={chip(MousePointerClick, 'Views that booked')} value={h.viewToBook == null ? null : `${h.viewToBook}%`}
            note="Needs page views" hint="Of page visits" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {showCommission
            ? <CommissionPanel leak={leak} go={go} panelRef={commissionRef} />
            : isReady(forecast) && <ForecastPanel f={forecast} />}
        </div>
        <NextSteps steps={steps} />
      </div>

      {isReady(winBack) && <WinBackPanel w={winBack} go={go} />}
      {!pro && <ProPreview go={go} />}
    </div>
  );
};

export default IntelOverview;
