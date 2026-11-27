import { describe, it, expect } from 'vitest';
import {
  bucketOf, canConfirm, canReportCompleted, homeBand, spendOf, tierProgress, amountPaid, rebookHref, isUpcoming,
} from '../pages/guest/guestModel';

const NOW = new Date('2026-11-27T10:00:00Z');
const at = (h) => new Date(+NOW + h * 3600000).toISOString();
const bk = (o) => ({ id: Math.random().toString(36).slice(2), status: 'confirmed', payment_status: 'paid', customer_total: 500, ...o });

describe('bookings buckets', () => {
  it('keeps awaiting-confirm, pending and no_show in Past, never hidden', () => {
    expect(bucketOf(bk({ scheduled_at: at(-2) }), NOW)).toBe('past'); // awaiting confirm
    expect(bucketOf(bk({ status: 'pending', scheduled_at: at(-2) }), NOW)).toBe('past');
    expect(bucketOf(bk({ status: 'no_show', scheduled_at: at(-2) }), NOW)).toBe('past');
    expect(bucketOf(bk({ status: 'completed', scheduled_at: at(-2) }), NOW)).toBe('past');
  });
  it('treats now as upcoming and both cancel spellings as cancelled', () => {
    expect(bucketOf(bk({ scheduled_at: NOW.toISOString() }), NOW)).toBe('upcoming');
    expect(bucketOf(bk({ status: 'canceled', scheduled_at: at(5) }), NOW)).toBe('cancelled');
    expect(bucketOf(bk({ status: 'cancelled', scheduled_at: at(-5) }), NOW)).toBe('cancelled');
  });
  it('asks "did it happen?" only for a paid, confirmed, ended session', () => {
    expect(canConfirm(bk({ scheduled_at: at(-1) }), NOW)).toBe(true);
    expect(canConfirm(bk({ scheduled_at: at(1) }), NOW)).toBe(false);
    expect(canConfirm(bk({ scheduled_at: at(-1), payment_status: 'unpaid' }), NOW)).toBe(false);
    expect(canConfirm(bk({ scheduled_at: at(-1), status: 'completed' }), NOW)).toBe(false);
  });
  it('lets a completed paid session be reported for 14 days', () => {
    expect(canReportCompleted(bk({ status: 'completed', scheduled_at: at(-24 * 13) }), NOW)).toBe(true);
    expect(canReportCompleted(bk({ status: 'completed', scheduled_at: at(-24 * 15) }), NOW)).toBe(false);
  });
});

describe('home band', () => {
  const past = bk({ status: 'completed', scheduled_at: at(-48), services: { slug: 'yoga' }, profiles: { username: 'priya' } });
  it('orders confirm > next > again > first', () => {
    const waiting = bk({ scheduled_at: at(-1) });
    const next = bk({ scheduled_at: at(30) });
    expect(homeBand([past, next, waiting], NOW).kind).toBe('confirm');
    expect(homeBand([past, next], NOW)).toMatchObject({ kind: 'next', booking: next });
    expect(homeBand([past], NOW)).toMatchObject({ kind: 'again', booking: past });
    expect(homeBand([], NOW).kind).toBe('first');
  });
  it('survives bare rows from the fallback select', () => {
    const bare = { id: 'x', status: 'completed', scheduled_at: at(-3), payment_status: 'paid' };
    expect(homeBand([bare], NOW).kind).toBe('first');
    expect(rebookHref(bare)).toBe(null);
    expect(rebookHref(past)).toBe('/priya/booking/yoga');
    expect(isUpcoming({}, NOW)).toBe(false);
  });
});

describe('rewards', () => {
  it('counts paid bookings only', () => {
    const list = [
      bk({ customer_total: 1200 }),
      bk({ customer_total: 800, payment_status: 'refunded' }),
      bk({ customer_total: 600, payment_status: 'unpaid' }),
      bk({ customer_total: 0 }),
      bk({ customer_total: null, services: { price: 300 } }),
    ];
    expect(spendOf(list)).toBe(1500);
    expect(spendOf([])).toBe(0);
  });
  it('places each threshold in the right tier', () => {
    expect(tierProgress(0)).toMatchObject({ tier: { name: 'Bronze' }, next: { name: 'Silver' }, gap: 5000 });
    expect(tierProgress(4999)).toMatchObject({ tier: { name: 'Bronze' }, gap: 1 });
    expect(tierProgress(5000)).toMatchObject({ tier: { name: 'Silver' }, gap: 10000, pct: 0 });
    expect(tierProgress(40000)).toMatchObject({ tier: { name: 'Platinum' }, next: null, gap: 0, pct: 1 });
    expect(tierProgress(-5).tier.name).toBe('Bronze');
  });
  it('labels amounts honestly', () => {
    expect(amountPaid(bk({ customer_total: 0 }))).toBe('Free');
    expect(amountPaid(bk({ customer_total: 1500, payment_status: 'refunded' }))).toBe('₹1,500 (refunded)');
  });
});
