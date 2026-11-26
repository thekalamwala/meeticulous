// Insights · Audience (Kept) — real data from GET /vendor/intelligence/audience.
// Pro-gated: the server answers { locked: true } for Starter hosts, with no
// figures at all, so the locked tab is a Pro ask + ghost shapes, never zeros.
import { ArrowRight, Sparkles } from 'lucide-react';
import { getIntelligenceAudience } from '../../services/api';
import { InsightBand, Panel, RankedBars, Tile, inr, pct } from '../../components/dashboard/ui/v2';
import { BandLink, Failed, Ghost, Loading, plural, serif, useInsight } from './insightsUi';

// Pure, tested: the band's sentence.
export const audienceBand = (d) => {
  const total = (d.newGuests || 0) + (d.returningGuests || 0);
  const top = (d.topGuests || []).find((g) => g.lifetime > 0);
  if (!total) {
    return { title: <>Your guests show up here <em className={serif}>after the first booking.</em></>, sub: 'New and returning guests, your repeat rate and who you see most.' };
  }
  return {
    title: d.returningGuests > 0
      ? <>{d.returningGuests} of your {total} guests <em className={serif}>came back.</em></>
      : <>{plural(total, 'guest')} so far, <em className={serif}>none back yet.</em></>,
    sub: top
      ? `${top.name} is your top guest: ${inr(top.lifetime)} kept from ${plural(top.bookings, 'booking')}.`
      : 'A guest who books twice is the cheapest booking you will ever get.',
  };
};

const IntelAudience = () => {
  const [data, reload] = useInsight(getIntelligenceAudience, 'audience');

  if (data === false) return <Failed what="audience" onRetry={reload} />;
  if (data === null) return <Loading />;

  if (data.locked) {
    return (
      <div className="flex flex-col gap-4 sm:gap-5">
        <InsightBand mascot="purple" eyebrow="Audience · Pro"
          title={<>See who comes back, <em className={serif}>and who drifts away.</em></>}
          sub="Pro shows new and returning guests, your repeat rate and the guests who spend the most with you."
          actions={<BandLink to="/dashboard/upgrade?src=insights_audience"><Sparkles className="h-4 w-4" strokeWidth={2.4} /> See Pro</BandLink>} />
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          <Ghost title="New and returning" line="How many guests are new, and how many came back." shape="figures" />
          <Ghost title="Your best guests" line="Ranked by what you've kept from their bookings." shape="rows" />
        </div>
      </div>
    );
  }

  const band = audienceBand(data);
  const guests = (data.topGuests || []).filter((g) => g.lifetime > 0 || g.bookings > 0);
  const total = (data.newGuests || 0) + (data.returningGuests || 0);
  const f = data.funnel || {};

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <InsightBand mascot="purple" eyebrow="Audience" title={band.title} sub={band.sub}
        actions={total > 0 && <BandLink to="/dashboard/clients">See clients <ArrowRight className="h-4 w-4" strokeWidth={2.4} /></BandLink>} />

      {total > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <Tile label="New guests" value={(data.newGuests || 0).toLocaleString('en-IN')} hint="Booked once" />
            <Tile label="Returning guests" value={(data.returningGuests || 0).toLocaleString('en-IN')} hint="Booked more than once" />
            <Tile label="Repeat rate" value={pct(data.repeatRate)} accent hint="Of guests came back" />
            <Tile label="Paid bookings" value={(f.paidBookings || 0).toLocaleString('en-IN')} hint={`Of ${plural(f.bookings || 0, 'booking')}`} />
          </div>

          <Panel title="Your best guests" subtitle="Ranked by what you've kept from their bookings">
            {guests.length > 1 ? (
              <RankedBars rows={guests} valueKey="lifetime" labelKey="name" format={(v) => (v ? inr(v) : 'Free')}
                secondary={(r) => `· ${plural(r.bookings, 'booking')}`} />
            ) : guests.length === 1 ? (
              <p className="mb-0 text-[14px] text-ink"><b>{guests[0].name}</b>: {plural(guests[0].bookings, 'booking')}, {inr(guests[0].lifetime)} kept.</p>
            ) : (
              <p className="mb-0 rounded-[16px] bg-cream p-4 text-[14px] text-muted">Nobody to rank yet.</p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
};

export default IntelAudience;
