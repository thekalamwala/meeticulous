// Insights (Kept) — the pure helpers behind each tab's sentences and charts.
// Fixtures use deliberately non-statutory amounts (see CLAUDE.md: withholding).
import { describe, expect, it } from 'vitest';
import { overviewBand } from '../IntelOverview';
import { deductionLines, monthSeries } from '../IntelRevenue';
import { audienceBand } from '../IntelAudience';
import { busiestDays, hourBlocks, sourceRows } from '../IntelDemand';

const leak = { commissionPaid: 600, proCost: 1000, stillToBreakEven: 400, aheadBy: 0, projectedYear: 5000 };

describe('overviewBand', () => {
  it('Starter with a projection: says the commission year, and compares it to Pro', () => {
    const b = overviewBand({ locked: true, commissionLeak: leak, headline: { netRevenue: 9000, paidBookings: 9 } });
    expect(b.sub).toContain('₹600 paid in the last 12 months');
    expect(b.sub).toContain("more than Pro costs (₹1,000 a year)");
  });
  it('Starter past break-even: leads with what Pro would have saved', () => {
    const b = overviewBand({ locked: true, commissionLeak: { ...leak, commissionPaid: 1300, aheadBy: 300 }, headline: {} });
    expect(b.sub).toContain('You paid ₹1,300 in commission');
  });
  it('Pro with a forecast: leads with the next 30 days, never the commission', () => {
    const b = overviewBand({ locked: false, commissionLeak: leak, forecast: { projectedMonth: 7000, confirmedUnpaid: { value: 500 }, basis: 'B.' } });
    expect(b.sub).toBe('₹500 of it is already booked and waiting to be paid. B.');
  });
  it('no bookings: an honest empty sentence, no ₹0', () => {
    const b = overviewBand({ locked: false, commissionLeak: { ...leak, projectedYear: null }, headline: { netRevenue: 0, paidBookings: 0 }, forecast: { projectedMonth: null } });
    expect(b.sub).not.toContain('₹');
  });
});

describe('revenue', () => {
  it('hides ₹0 deduction lines and folds GST into its line', () => {
    const lines = deductionLines({ commission: 50, commissionGst: 9, platformFee: 0, platformFeeGst: 0, razorpayFee: 0, refunded: 20 });
    expect(lines.map(([l, v]) => [l, v])).toEqual([['Commission', 59], ['Refunded', 20]]);
  });
  it('labels months as people say them, with a year only across years', () => {
    expect(monthSeries([{ month: '2026-10' }, { month: '2026-11' }]).map((m) => m.label)).toEqual(['Oct', 'Nov']);
    expect(monthSeries([{ month: '2025-12' }, { month: '2026-01' }])[1].label).toMatch(/Jan.*26/);
  });
});

describe('audienceBand', () => {
  it('counts who came back and names the top guest', () => {
    const b = audienceBand({ newGuests: 5, returningGuests: 2, topGuests: [{ name: 'A', lifetime: 300, bookings: 2 }] });
    expect(b.sub).toBe('A is your top guest: ₹300 kept from 2 bookings.');
  });
});

describe('demand', () => {
  it('names every day tied for busiest', () => {
    expect(busiestDays([{ day: 'Mon', bookings: 2 }, { day: 'Thu', bookings: 4 }, { day: 'Sat', bookings: 4 }])).toEqual(['Thursday', 'Saturday']);
    expect(busiestDays([{ day: 'Mon', bookings: 0 }])).toEqual([]);
  });
  it('folds 24 hours into 3-hour blocks, trimmed to the span with bookings', () => {
    const byHour = Array.from({ length: 24 }, (_, hour) => ({ hour, bookings: { 9: 1, 10: 2, 16: 3 }[hour] || 0 }));
    expect(hourBlocks(byHour)).toEqual([
      { start: 9, label: '9 am', bookings: 3 },
      { start: 12, label: '12 pm', bookings: 0 },
      { start: 15, label: '3 pm', bookings: 3 },
    ]);
    expect(hourBlocks(byHour.map((h) => ({ ...h, bookings: 0 })))).toEqual([]);
  });
  it('counts sources, skipping cancelled bookings, with human labels', () => {
    const rows = sourceRows([
      { source: 'platform' }, { source: 'platform' }, { source: 'manual_cash' },
      { source: 'manual_cash', status: 'cancelled' }, { source: 'reply_ai' },
    ]);
    expect(rows).toEqual([
      { label: 'Booking page', bookingsCount: 2 },
      { label: 'Added by you', bookingsCount: 1 },
      { label: 'Reply ai', bookingsCount: 1 },
    ]);
  });
});
