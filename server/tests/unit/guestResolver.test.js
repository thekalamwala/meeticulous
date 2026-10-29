const { aggregateGuests, filterBookingsForKey, keyForBooking, redFlags } = require('../../services/guestResolver');

const rows = [
  { guest_phone: '+91 98765 43210', guest_name: 'Asha',  customer_total: 500, payment_status: 'paid',   status: 'completed', created_at: '2026-01-01T09:00:00Z', scheduled_at: '2026-01-01T10:00:00Z' },
  { guest_phone: '9876543210',      guest_name: 'Asha K', customer_total: 300, payment_status: 'paid',   status: 'no_show',   created_at: '2026-02-01T09:00:00Z', scheduled_at: '2026-02-01T10:00:00Z' },
  { guest_phone: '098765 43210',    guest_name: 'Asha K', customer_total: 999, payment_status: 'unpaid', status: 'cancelled', created_at: '2026-03-01T09:00:00Z', scheduled_at: '2026-03-01T10:00:00Z' },
  { guest_phone: '8000000000', guest_id: 'host-uuid', guest_name: 'Ravi', customer_total: 200, payment_status: 'paid', status: 'completed', created_at: '2026-01-05T10:00:00Z', scheduled_at: '2026-01-05T10:00:00Z' },
  { guest_name: 'Ghost', customer_total: 100, payment_status: 'paid', status: 'completed' },
];

describe('guestResolver', () => {
  const guests = aggregateGuests(rows);

  test('collapses three phone formats into one guest and drops identity-less rows', () => {
    expect(guests).toHaveLength(2);
  });

  test('counts every format and sums only PAID bookings', () => {
    const asha = guests.find((g) => g.key === 'p:9876543210');
    expect(asha.bookings).toBe(3);
    expect(asha.spent).toBe(800); // 500 + 300; the 999 unpaid is excluded
    expect(asha.no_show).toBe(1);
    expect(asha.cancelled).toBe(1);
    expect(asha.name).toBe('Asha K'); // most-recent booking's name
    expect(asha.has_account).toBe(false);
  });

  test('a guest_id just means a linked account, not a special case', () => {
    expect(guests.find((g) => g.key === 'p:8000000000').has_account).toBe(true);
  });

  test('keyForBooking is null without phone or email', () => {
    expect(keyForBooking({ guest_name: 'x' })).toBeNull();
  });

  test('filterBookingsForKey returns exactly that guest\'s rows', () => {
    expect(filterBookingsForKey(rows, 'p:9876543210')).toHaveLength(3);
  });

  test('red flags fire on the right signals', () => {
    expect(redFlags({ completed: 0, cancelled: 2, no_show: 2 }, { refunded: 2, suppressed: true }).sort())
      .toEqual(['high_cancellation', 'marketing_suppressed', 'repeat_no_show', 'repeat_refunds'].sort());
    expect(redFlags({ completed: 5, cancelled: 0, no_show: 0 }, {})).toEqual([]);
  });
});
