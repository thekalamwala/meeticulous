jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));

const { aggregate } = require('../../services/crmService');
const { customerKey } = require('../../utils/customerKey');

const now = Date.parse('2026-07-15T00:00:00Z');
const daysAgo = (d) => new Date(now - d * 86400000).toISOString();
const daysAhead = (d) => new Date(now + d * 86400000).toISOString();

describe('crmService.aggregate', () => {
  const bookings = [
    // Jane: two paid → recurring; one no_show
    { id: 'b1', guest_name: 'Jane', guest_phone: '9876543210', customer_total: 500, status: 'completed', payment_status: 'paid', scheduled_at: daysAgo(90) },
    { id: 'b2', guest_name: 'Jane', guest_phone: '98765 43210', customer_total: 700, status: 'completed', payment_status: 'paid', scheduled_at: daysAgo(80) },
    { id: 'b3', guest_name: 'Jane', guest_phone: '9876543210', customer_total: 0, status: 'no_show', payment_status: 'pending', scheduled_at: daysAgo(10) },
    // Bob: one paid + one upcoming
    { id: 'b4', guest_name: 'Bob', guest_email: 'Bob@X.com', customer_total: 300, status: 'completed', payment_status: 'paid', scheduled_at: daysAgo(5) },
    { id: 'b5', guest_name: 'Bob', guest_email: 'bob@x.com', customer_total: 300, status: 'confirmed', payment_status: 'paid', scheduled_at: daysAhead(3) },
    // Cancelled-only + no contact → excluded from key set
    { id: 'b6', guest_name: 'Ghost', customer_total: 0, status: 'cancelled', payment_status: 'pending', scheduled_at: daysAgo(1) },
  ];

  test('groups by customerKey, phone normalizes across spacing', () => {
    const m = aggregate(bookings, now);
    expect(m.has('p:9876543210')).toBe(true);
    const jane = m.get('p:9876543210');
    expect(jane.bookings_count).toBe(2);            // paid only
    expect(jane.total_spent).toBe(1200);
    expect(jane.no_show_count).toBe(1);
  });

  test('email key lowercased; upcoming detected', () => {
    const m = aggregate(bookings, now);
    const bob = m.get('e:bob@x.com');
    expect(bob.bookings_count).toBe(2);
    expect(bob.next_upcoming_at).toBeTruthy();
  });

  test('no-contact booking produces no key', () => {
    expect(customerKey({ phone: undefined, email: undefined })).toBeNull();
    const m = aggregate(bookings, now);
    // Ghost had no phone/email → not present under any key
    const names = [...m.values()].map((c) => c.name);
    expect(names).not.toContain('Ghost');
  });
});
