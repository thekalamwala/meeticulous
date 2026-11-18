// Creator Intelligence · Revenue — the reconciliation, from GET /host/intelligence/money.
// Ungated: free hosts already get earnings history. All figures are live from bookings.
import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { getIntelligenceMoney } from '../../services/api';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { PageHeading, Panel, SubNav, Tile, BarChart, RankedBars, inr } from '../../components/dashboard/ui/v2';
import { INTELLIGENCE_NAV } from '../dashboardNav';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

const IntelRevenue = () => {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  const load = async () => {
    setErr(false);
    setData(null);
    try { const res = await getIntelligenceMoney(); setData(res.data || {}); }
    catch { setErr(true); }
  };
  useEffect(() => { load(); }, []);

  const header = (
    <>
      <SubNav items={INTELLIGENCE_NAV} />
      <PageHeading title="Revenue" sub="From what guests paid to what reaches you, line by line." />
    </>
  );

  if (err) {
    return <div className="flex flex-col gap-2.5">{header}<ErrorState message="Couldn't load your revenue." onRetry={load} /></div>;
  }
  if (data === null) {
    return <div className="flex flex-col gap-2.5">{header}<Skeleton className="h-28 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  }

  const { summary: s, settlement, byService = [], byMonth = [], concentration: conc, upcoming, withholding: w } = data;

  if (!s || s.bookings === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <div className="flex flex-col items-center gap-1.5 rounded-lg border-2 border-neutral-200 bg-white py-12 text-center">
          <TrendingUp className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
          <p className="text-[12px] font-bold text-ink">No paid bookings yet</p>
          <p className="max-w-xs text-[11px] font-medium text-ink/55">Your revenue breakdown appears here once guests pay.</p>
        </div>
        {upcoming?.bookings > 0 && (
          <Tile label="Confirmed, unpaid" value={inr(upcoming.value, { compact: true })} hint={plural(upcoming.bookings, 'booking')} />
        )}
      </div>
    );
  }

  const monthChart = byMonth.map((m) => ({ ...m, month: m.month.slice(2) }));

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      {s.derivedLeads && (
        <p className="rounded-md border-2 border-warning-bg bg-warning-bg/50 px-3 py-2 text-[11px] font-semibold text-warning-fg">
          {plural(s.derivedRows, 'booking')} ({inr(s.derivedValue)}) had no payout snapshot, so their net is estimated and totals may not tie exactly.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Net revenue" value={inr(s.net, { compact: true })} accent hint="After fees, tax and refunds" />
        <Tile label="Gross" value={inr(s.gross, { compact: true })} hint="What guests paid" />
        <Tile label="Paid bookings" value={s.bookings} hint={`Avg ${inr(s.aov)} per booking`} />
        <Tile label="Net per booking" value={inr(s.netAov)} hint="What you keep on average" />
      </div>

      <Panel title="Where the gross went" subtitle="Every deduction, all paid bookings">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile label="Commission" value={inr(s.commission + s.commissionGst, { compact: true })} hint="Including GST" />
          <Tile label="Platform fee" value={inr(s.platformFee + s.platformFeeGst, { compact: true })} hint="Including GST" />
          <Tile label="Payment gateway" value={inr(s.razorpayFee, { compact: true })} hint="Fee and tax" />
          <Tile label="Refunded" value={inr(s.refunded, { compact: true })} hint="Returned to guests" />
        </div>
      </Panel>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {settlement && <Tile label="Settled" value={inr(settlement.settled, { compact: true })} hint="Paid out to you" />}
        {settlement && <Tile label="Pending payout" value={inr(settlement.pending, { compact: true })} hint="Paid by guests, not yet settled" />}
        {upcoming && <Tile label="Confirmed, unpaid" value={inr(upcoming.value, { compact: true })} hint={plural(upcoming.bookings, 'booking')} />}
      </div>

      <Panel title="Revenue by month" subtitle="Net, oldest first">
        {monthChart.length ? <BarChart data={monthChart} valueKey="net" labelKey="month" /> : <p className="text-[11px] font-medium text-ink/55">No monthly data yet.</p>}
      </Panel>

      <Panel title="Revenue by service" subtitle="Gross, highest first">
        <RankedBars rows={byService} valueKey="gross" labelKey="label"
          format={(v) => inr(v)} secondary={(r) => `${plural(r.bookings, 'booking')} · net ${inr(r.net)}`} />
      </Panel>

      {conc && conc.share != null && (
        <Panel title="Guest concentration">
          <p className="text-[12px] font-medium text-ink/70">
            <span className="font-bold text-ink">{conc.share}%</span> of your gross comes from your top {conc.topN} of {plural(conc.guests, 'guest')}.
          </p>
        </Panel>
      )}

      {w && (
        <Panel title={`Tax withheld · ${w.fyLabel}`} subtitle="Measured from payout records only">
          <div className="grid grid-cols-3 gap-2">
            <Tile label="TDS" value={inr(w.tds, { decimals: true })} />
            <Tile label="TCS" value={inr(w.tcs, { decimals: true })} />
            <Tile label="Total" value={inr(w.total, { decimals: true })} hint={plural(w.bookingsMeasured, 'booking')} />
          </div>
          {w.bookingsUnknown > 0 && (
            <p className="mt-2 text-[11px] font-medium text-ink/55">
              {plural(w.bookingsUnknown, 'booking')} ({inr(w.unknownGross)} gross) have no payout snapshot and are left out of these totals.
            </p>
          )}
          {w.disclosure && (
            <div className="mt-2 flex flex-col gap-1 text-[10.5px] font-medium text-ink/45">
              {[w.disclosure.tds, w.disclosure.tcs, w.disclosure.caveat].filter((t) => typeof t === 'string').map((t) => <p key={t}>{t}</p>)}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
};

export default IntelRevenue;
