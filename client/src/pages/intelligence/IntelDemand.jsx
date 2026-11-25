// Creator Intelligence · Demand — real data from getIntelligenceDemand().
// Pro-gated: { locked: true } renders only the upsell card.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { getIntelligenceDemand } from '../../services/api';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { BarChart, PageHeading, Panel, SubNav, Tile, pct } from '../../components/dashboard/ui/v2';
import { INTELLIGENCE_NAV } from '../dashboardNav';

const plain = (v) => String(Math.round(v));

const IntelDemand = () => {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  const load = async () => {
    setErr(false);
    setData(null);
    try { const res = await getIntelligenceDemand(); setData(res.data || {}); }
    catch { setErr(true); }
  };
  useEffect(() => { load(); }, []);

  const header = (
    <>
      <PageHeading title="Demand" sub="When you are wanted, and who keeps coming back." />
    </>
  );

  if (err) return <div className="flex flex-col gap-4 sm:gap-6">{header}<ErrorState message="Couldn't load your demand." onRetry={load} /></div>;
  if (data === null) return <div className="flex flex-col gap-4 sm:gap-6">{header}<Skeleton className="h-28 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;

  if (data.locked) {
    return (
      <div className="flex flex-col gap-4 sm:gap-6">
        {header}
        <section className="flex flex-col gap-2 rounded-lg border-2 border-maroon/20 bg-blush/60 p-3">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-maroon" strokeWidth={2.4} />
            <h2 className="mb-0 font-display text-[12.5px] font-bold tracking-[-0.02em] text-maroon">Demand is on Pro</h2>
          </div>
          <p className="text-[11.5px] font-medium text-ink/65">Pro shows your busiest days and hours, retention and booking lead time.</p>
          <Link to="/dashboard/upgrade?src=intelligence"
            className="inline-flex w-fit items-center gap-1 rounded-full bg-maroon px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-maroon-dark">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} /> See Pro
          </Link>
        </section>
      </div>
    );
  }

  const weekday = Array.isArray(data.byWeekday) ? data.byWeekday : [];
  const hours = Array.isArray(data.byHour) ? data.byHour : [];
  const { retention, leadTimeDays } = data;
  const empty = (
    <p className="mb-0 py-4 text-center text-[11.5px] font-medium text-ink/55">Not enough bookings yet.</p>
  );

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {header}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3">
        <Tile label="Repeat guests" value={retention?.repeatGuestPct == null ? '—' : pct(retention.repeatGuestPct)} accent hint="Booked more than once" />
        <Tile label="Bookings per guest" value={retention?.avgBookingsPerGuest == null ? '—' : Number(retention.avgBookingsPerGuest).toFixed(1)} hint="Average" />
        {leadTimeDays != null && <Tile label="Lead time" value={`${leadTimeDays} days`} hint="Booked ahead, on average" />}
      </div>

      <Panel title="By weekday" subtitle="Bookings per day of the week">
        {weekday.length ? <BarChart data={weekday} labelKey="day" valueKey="bookings" format={plain} /> : empty}
      </Panel>

      <Panel title="By hour" subtitle="Bookings by start hour">
        {hours.length ? <BarChart data={hours} labelKey="hour" valueKey="bookings" format={plain} /> : empty}
      </Panel>
    </div>
  );
};

export default IntelDemand;
