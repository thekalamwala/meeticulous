// Insights · Demand (Kept) — real data from GET /vendor/intelligence/demand.
// Pro-gated ({ locked: true } carries no figures → Pro ask + ghost shapes).
// Days and hours are when the booking was MADE (created_at, IST), not when the
// session runs, so the copy says "guests book", never "you're busy".
//
// "Where bookings came from" (moved here from Today) reads the host's own
// bookings (bookings.source) and is not gated; it shows only with 2+ sources.
import { Sparkles } from 'lucide-react';
import { getHostBookings, getIntelligenceDemand } from '../../services/api';
import { BarChart, InsightBand, Panel, SourceDonut } from '../../components/dashboard/ui/v2';
import { BandLink, Failed, Ghost, Loading, hourLabel, plural, serif, useInsight } from './insightsUi';

const DAY_NAME = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
const plain = (v) => String(Math.round(v));

// Pure, tested: the top weekday(s) — ties are named together, nothing invented.
export const busiestDays = (byWeekday = []) => {
  const max = Math.max(0, ...byWeekday.map((d) => d.bookings || 0));
  return max ? byWeekday.filter((d) => d.bookings === max).map((d) => DAY_NAME[d.day] || d.day) : [];
};

// Pure, tested: 24 hourly rows → 3-hour blocks, trimmed to the span that has bookings.
export const hourBlocks = (byHour = []) => {
  const at = (h) => byHour.find((r) => Number(r.hour) === h)?.bookings || 0;
  const blocks = Array.from({ length: 8 }, (_, i) => {
    const start = i * 3;
    return { start, label: hourLabel(start), bookings: at(start) + at(start + 1) + at(start + 2) };
  });
  const first = blocks.findIndex((b) => b.bookings > 0);
  if (first < 0) return [];
  const last = blocks.length - 1 - [...blocks].reverse().findIndex((b) => b.bookings > 0);
  return blocks.slice(first, last + 1);
};
const blockName = (b) => `${hourLabel(b.start)} – ${hourLabel((b.start + 3) % 24)}`;

// Pure, tested: bookings per source, biggest first. Cancelled bookings don't count.
const SOURCE_LABEL = { platform: 'Booking page', manual_cash: 'Added by you' };
export const sourceRows = (bookings = []) => {
  const by = {};
  for (const b of bookings) {
    if (String(b.status || '').toLowerCase() === 'cancelled') continue;
    const s = b.source || 'platform';
    by[s] = (by[s] || 0) + 1;
  }
  return Object.entries(by)
    .map(([key, bookingsCount]) => ({ label: SOURCE_LABEL[key] || key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), bookingsCount }))
    .sort((a, b) => b.bookingsCount - a.bookingsCount);
};

const loadBookings = () => getHostBookings().then((r) => ({ data: { rows: Array.isArray(r?.data) ? r.data : [] } }));

const Sources = ({ rows }) => (
  <Panel title="Where bookings came from" subtitle="By number of bookings">
    <SourceDonut rows={rows} valueKey="bookingsCount" labelKey="label" />
  </Panel>
);

const IntelDemand = () => {
  const [data, reload] = useInsight(getIntelligenceDemand, 'demand');
  const [bk] = useInsight(loadBookings, 'demand-bookings');
  // Sources are a bonus block: if bookings fail to load, the tab still works.
  const sources = bk ? sourceRows(bk.rows) : [];
  const showSources = sources.length >= 2;

  if (data === false) return <Failed what="demand" onRetry={reload} />;
  if (data === null) return <Loading />;

  if (data.locked) {
    return (
      <div className="flex flex-col gap-4 sm:gap-5">
        <InsightBand mascot="purple" eyebrow="Demand · Pro"
          title={<>See when guests book, <em className={serif}>and plan around it.</em></>}
          sub="Pro shows the days and hours guests book most, and how often they come back."
          actions={<BandLink to="/dashboard/upgrade?src=insights_demand"><Sparkles className="h-4 w-4" strokeWidth={2.4} /> See Pro</BandLink>} />
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
          <Ghost title="By day of the week" line="Which days guests book most." />
          <Ghost title="By time of day" line="The hours guests book in." />
          {showSources && <div className="lg:col-span-2"><Sources rows={sources} /></div>}
        </div>
      </div>
    );
  }

  const weekday = Array.isArray(data.byWeekday) ? data.byWeekday : [];
  const blocks = hourBlocks(data.byHour);
  const days = busiestDays(weekday);
  const top = Math.max(0, ...blocks.map((b) => b.bookings));
  const peaks = top ? blocks.filter((b) => b.bookings === top) : [];
  const r = data.retention || {};

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      <InsightBand mascot="purple" eyebrow="Demand"
        title={days.length
          ? <>Guests book most <em className={serif}>on {days.length > 2 ? 'several days' : days.map((d) => `${d}s`).join(' and ')}.</em></>
          : <>Busy days show up here <em className={serif}>after a few bookings.</em></>}
        sub={peaks.length === 1
          ? `The busiest time to book is ${blockName(peaks[0])}. Share your link just before it.`
          : peaks.length === 2
            ? `The busiest times to book are ${blockName(peaks[0])} and ${blockName(peaks[1])}.`
          : 'Which days and hours guests book in, and how often they come back.'} />

      {days.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            <Panel title="By day of the week" subtitle="When guests made their booking">
              <div className="pt-5">
                <BarChart data={weekday} labelKey="day" valueKey="bookings" format={plain}
                  tip={(d) => `${DAY_NAME[d.day] || d.day} · ${plural(d.bookings, 'booking')}`} />
              </div>
              {r.avgBookingsPerGuest > 0 && (
                <p className="mb-0 mt-4 rounded-[16px] bg-cream px-4 py-3 text-[14px] text-ink">
                  Each guest books <b>{Number(r.avgBookingsPerGuest).toFixed(1)}</b> times on average
                  {data.leadTimeDays != null ? <>, about <b>{plural(data.leadTimeDays, 'day')}</b> ahead</> : null}.
                </p>
              )}
            </Panel>
            <Panel title="By time of day" subtitle="In 3-hour blocks, India time">
              {blocks.length >= 3 ? (
                <div className="pt-5">
                  <BarChart data={blocks} labelKey="label" valueKey="bookings" format={plain}
                    tip={(b) => `${blockName(b)} · ${plural(b.bookings, 'booking')}`} />
                </div>
              ) : (
                <p className="mb-0 text-[14px] text-ink">
                  {blocks.map((b) => `${plural(b.bookings, 'booking')} between ${blockName(b)}`).join(', ')}.
                </p>
              )}
            </Panel>
            {showSources && <div className="lg:col-span-2"><Sources rows={sources} /></div>}
          </div>
        </>
      )}

      {!days.length && showSources && <Sources rows={sources} />}
    </div>
  );
};

export default IntelDemand;
