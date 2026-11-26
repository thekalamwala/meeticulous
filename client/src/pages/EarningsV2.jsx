// Earnings — dashboard_v2 graduation. The v2 look (SubNav + balance tiles +
// RankedBars) on the SAME real data as Earnings.jsx: getHostBookings / getHostNudges,
// same period presets, same paid-booking + per-service math. Reuses the existing
// EarningsTrendChart and the free-plan CommissionMeter unchanged. Shown on the
// flag-ON path (App picks it in EarningsRoute). Deferred vs the lab: period-over-period
// deltas (needs a history window the API doesn't return cheaply) and the withdraw flow.
import { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';
import { getHostBookings, getHostNudges } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isFreePlan } from '../utils/themeUtils';
import EarningsTrendChart from '../components/EarningsTrendChart';
import CommissionMeter from '../components/dashboard/CommissionMeter';
import { SegmentedControl, ErrorState, Skeleton } from '../components/dashboard/ui';
import { PageHeading, Panel, SubNav, Tile, RankedBars, inr } from '../components/dashboard/ui/v2';
import { MONEY_NAV } from './dashboardNav';
import { periodStart, summarizeEarnings } from './money/earningsModel';

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: 'year', label: 'This year' },
];

const EarningsV2 = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState(null);
  const [err, setErr] = useState(false);
  const [period, setPeriod] = useState('all');
  const [commissionPaid, setCommissionPaid] = useState(0);

  useEffect(() => {
    getHostNudges().then(({ data }) => setCommissionPaid(Number(data?.commissionPaid) || 0)).catch(() => {});
  }, []);

  const load = async () => {
    setErr(false);
    setBookings(null);
    try { const { data } = await getHostBookings(); setBookings(data || []); }
    catch { setErr(true); }
  };
  useEffect(() => { load(); }, []);

  const header = (
    <>
      <PageHeading title="Earnings" sub="What you've made, and which services earn it." />
    </>
  );

  if (err) {
    return <div className="flex flex-col gap-4 sm:gap-6">{header}<ErrorState message="Couldn't load your earnings." onRetry={load} /></div>;
  }
  if (bookings === null) {
    return <div className="flex flex-col gap-4 sm:gap-6">{header}<Skeleton className="h-28 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;
  }

  const { paid, gross, net, byService } = summarizeEarnings(bookings, periodStart(period));

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {header}

      <CommissionMeter commissionPaid={commissionPaid} isFree={isFreePlan(user?.plan)} src="earnings" />

      <SegmentedControl value={period} onChange={setPeriod} options={PERIODS} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        <Tile label="Net earnings" value={inr(net, { compact: true })} accent hint="Your share, after fees" />
        <Tile label="Gross revenue" value={inr(gross, { compact: true })} hint="Before platform fee" />
        <Tile label="Paid bookings" value={paid.length} hint="In this period" />
        <Tile label="Commission paid" value={inr(commissionPaid, { compact: true })} hint="Platform fee to date" />
      </div>

      <Panel title="Revenue trend"><EarningsTrendChart paid={paid} /></Panel>

      <Panel title="Revenue by service" subtitle="Net, highest first">
        {byService.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-10 text-center">
            <TrendingUp className="h-6 w-6 text-maroon/30" strokeWidth={1.8} />
            <p className="text-[12px] font-bold text-ink">No paid bookings yet</p>
            <p className="max-w-xs text-[11px] font-medium text-ink/55">Revenue by service appears here once guests pay.</p>
          </div>
        ) : (
          <RankedBars rows={byService} valueKey="net" labelKey="label"
            format={(v) => inr(v)} secondary={(r) => `${r.count} booking${r.count !== 1 ? 's' : ''}`} />
        )}
      </Panel>
    </div>
  );
};

export default EarningsV2;
