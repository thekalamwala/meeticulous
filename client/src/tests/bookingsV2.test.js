import { describe, it, expect } from 'vitest';
import { dayLabel, groupByDay, splitByTime, payKey, rowPills, matchesFilter, bandLine, endOf } from '../pages/BookingsV2';

const now = new Date(2026, 10, 25, 12, 0); // Wed 25 Nov 2026, noon
const at = (d, h = 10, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const bk = (id, iso, extra = {}) => ({ id, scheduled_at: iso, status: 'confirmed', services: { duration: 60 }, ...extra });

describe('BookingsV2 dayLabel', () => {
  it('says Today / Tomorrow / Yesterday, else a short date', () => {
    expect(dayLabel(new Date(2026, 10, 25), now)).toBe('Today');
    expect(dayLabel(new Date(2026, 10, 26), now)).toBe('Tomorrow');
    expect(dayLabel(new Date(2026, 10, 24), now)).toBe('Yesterday');
    expect(dayLabel(new Date(2026, 10, 28), now)).toMatch(/28 Nov/);
    expect(dayLabel(new Date(2027, 0, 5), now)).toMatch(/2027/);
  });
});

describe('BookingsV2 splitByTime + groupByDay', () => {
  it('upcoming = not over yet, soonest first; past = over, newest first', () => {
    const list = [bk('a', at(27)), bk('b', at(25, 11, 30)), bk('c', at(20)), bk('d', at(24)), bk('e', at(25, 13))];
    const { upcoming, past } = splitByTime(list, now);
    // b started 11:30 and runs 60 min, so it is still on at noon -> upcoming.
    expect(upcoming.map((b) => b.id)).toEqual(['b', 'e', 'a']);
    expect(past.map((b) => b.id)).toEqual(['d', 'c']);
  });

  it('groups consecutive bookings on the same day', () => {
    const groups = groupByDay([bk('b', at(25, 11)), bk('e', at(25, 13)), bk('a', at(27))]);
    expect(groups.map((g) => g.items.map((b) => b.id))).toEqual([['b', 'e'], ['a']]);
  });

  it('endOf uses the service duration, 30 min when missing', () => {
    expect(endOf(bk('x', at(25, 10), { services: {} })).getMinutes()).toBe(30);
  });
});

describe('BookingsV2 rowPills', () => {
  it('pending stands alone as Awaiting payment', () => {
    expect(rowPills({ status: 'pending', customer_total: 500, payment_status: 'unpaid' })).toEqual([{ key: 'pending', word: 'Awaiting payment' }]);
  });
  it('confirmed shows only the payment; free says Free', () => {
    expect(rowPills({ status: 'confirmed', customer_total: 500, payment_status: 'paid' })).toEqual([{ key: 'paid' }]);
    expect(rowPills({ status: 'confirmed', customer_total: 0, payment_status: 'free' })).toEqual([{ key: 'free', word: 'Free' }]);
  });
  it('other states lead with the state; cancelled adds only a refund', () => {
    expect(rowPills({ status: 'completed', customer_total: 500, payment_status: 'paid' }).map((p) => p.key)).toEqual(['completed', 'paid']);
    expect(rowPills({ status: 'cancelled', customer_total: 500, payment_status: 'paid' }).map((p) => p.key)).toEqual(['cancelled']);
    expect(rowPills({ status: 'cancelled', customer_total: 500, payment_status: 'refunded' }).map((p) => p.key)).toEqual(['cancelled', 'refunded']);
  });
  it('payKey folds a missing state on a priced booking into unpaid', () => {
    expect(payKey({ amount: 300 })).toBe('unpaid');
    expect(payKey({ amount: 300, payment_status: 'failed' })).toBe('failed');
  });
});

describe('BookingsV2 matchesFilter', () => {
  const b = { status: 'confirmed', customer_total: 999, payment_status: 'failed', guest_name: 'Meera Iyer', services: { title: 'Funnel Teardown' } };
  it('matches status, payment (failed counts as unpaid) and search text', () => {
    expect(matchesFilter(b)).toBe(true);
    expect(matchesFilter(b, { status: 'pending' })).toBe(false);
    expect(matchesFilter(b, { pay: 'unpaid' })).toBe(true);
    expect(matchesFilter(b, { pay: 'paid' })).toBe(false);
    expect(matchesFilter(b, { q: 'funnel' })).toBe(true);
    expect(matchesFilter(b, { q: 'kabir' })).toBe(false);
  });
});

describe('BookingsV2 bandLine', () => {
  it('counts what is left today, the next 7 days and unpaid, from real bookings', () => {
    const list = [
      bk('a', at(25, 9)), // over
      bk('b', at(25, 15)), bk('c', at(25, 17), { status: 'pending' }),
      bk('d', at(28)), bk('e', at(30), { status: 'cancelled' }), bk('f', at(29, 9)),
    ];
    expect(bandLine(list, now)).toBe('2 still to come today, 4 in the next 7 days. 1 is waiting on payment.');
  });
  it('says nothing else today when today is clear', () => {
    expect(bandLine([bk('d', at(28))], now)).toBe('Nothing else today, 1 in the next 7 days.');
  });
});
