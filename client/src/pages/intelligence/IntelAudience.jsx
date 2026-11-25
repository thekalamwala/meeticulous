// Creator Intelligence · Audience — real data from getIntelligenceAudience().
// Pro-gated: the server answers { locked: true } for Starter hosts, and we render
// only the upsell card then (never zeros).
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { getIntelligenceAudience } from '../../services/api';
import { ErrorState, Skeleton } from '../../components/dashboard/ui';
import { PageHeading, Panel, RankedBars, SubNav, Tile, inr, pct } from '../../components/dashboard/ui/v2';
import { INTELLIGENCE_NAV } from '../dashboardNav';

const num = (v) => (v == null ? '—' : Number(v).toLocaleString('en-IN'));

const IntelAudience = () => {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);

  const load = async () => {
    setErr(false);
    setData(null);
    try { const res = await getIntelligenceAudience(); setData(res.data || {}); }
    catch { setErr(true); }
  };
  useEffect(() => { load(); }, []);

  const header = (
    <>
      <PageHeading title="Audience" sub="Who arrives, and who comes back." />
    </>
  );

  if (err) return <div className="flex flex-col gap-2.5">{header}<ErrorState message="Couldn't load your audience." onRetry={load} /></div>;
  if (data === null) return <div className="flex flex-col gap-2.5">{header}<Skeleton className="h-28 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>;

  if (data.locked) {
    return (
      <div className="flex flex-col gap-2.5">
        {header}
        <section className="flex flex-col gap-2 rounded-lg border-2 border-maroon/20 bg-blush/60 p-3">
          <div className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-maroon" strokeWidth={2.4} />
            <h2 className="mb-0 font-display text-[12.5px] font-bold tracking-[-0.02em] text-maroon">Audience is on Pro</h2>
          </div>
          <p className="text-[11.5px] font-medium text-ink/65">Pro shows new vs returning guests, your repeat rate and your best guests.</p>
          <Link to="/dashboard/upgrade?src=intelligence"
            className="inline-flex w-fit items-center gap-1 rounded-full bg-maroon px-3 py-1.5 text-[11.5px] font-bold text-white transition hover:bg-maroon-dark">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.4} /> See Pro
          </Link>
        </section>
      </div>
    );
  }

  const { funnel, topGuests } = data;
  const guests = Array.isArray(topGuests) ? topGuests : [];

  return (
    <div className="flex flex-col gap-2.5">
      {header}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="New guests" value={num(data.newGuests)} accent hint="First-time bookers" />
        <Tile label="Returning guests" value={num(data.returningGuests)} hint="Booked again" />
        <Tile label="Repeat rate" value={data.repeatRate == null ? '—' : pct(data.repeatRate)} hint="Guests who came back" />
        <Tile label="Paid" value={funnel?.paidPct == null ? '—' : pct(funnel.paidPct)} hint="Bookings that were paid" />
      </div>

      <Panel title="Booking funnel" subtitle="From booked to paid">
        <div className="grid grid-cols-2 gap-2">
          <Tile label="Bookings" value={num(funnel?.bookings)} />
          <Tile label="Paid bookings" value={num(funnel?.paidBookings)} />
        </div>
      </Panel>

      <Panel title="Your best guests" subtitle="By lifetime spend">
        {guests.length ? (
          <RankedBars rows={guests} valueKey="lifetime" labelKey="name" format={(v) => inr(v)}
            secondary={(r) => `· ${r.bookings ?? 0} booking${r.bookings === 1 ? '' : 's'}`} />
        ) : (
          <p className="mb-0 py-4 text-center text-[11.5px] font-medium text-ink/55">No guests to rank yet.</p>
        )}
      </Panel>
    </div>
  );
};

export default IntelAudience;
