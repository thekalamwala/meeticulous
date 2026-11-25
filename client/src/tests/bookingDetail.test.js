// BookingDetail's two pure helpers: the status line at the top of the panel, and
// which visit this is for the guest. Both read only data the list already loaded.
import { describe, expect, it } from 'vitest';
import { bookingPhaseLine, guestVisit } from '../components/dashboard/BookingDetail';

const now = new Date('2026-11-25T15:00:00+05:30');
const at = (h, m = 0) => new Date(`2026-11-25T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+05:30`).toISOString();
const bk = (over) => ({ id: 'b1', status: 'confirmed', scheduled_at: at(16), services: { duration: 30 }, ...over });

describe('bookingPhaseLine', () => {
  it('says cancelled first, whatever the time', () => {
    expect(bookingPhaseLine(bk({ status: 'cancelled', scheduled_at: at(14, 50) }), now)).toBe('Cancelled');
  });
  it('says on now while the session runs, timed by the service duration', () => {
    expect(bookingPhaseLine(bk({ scheduled_at: at(14, 45) }), now)).toMatch(/^On now · until 3:15/i);
  });
  it('counts down under an hour', () => {
    expect(bookingPhaseLine(bk({ scheduled_at: at(15, 20) }), now)).toBe('Starts in 20 min');
  });
  it('marks past sessions done', () => {
    expect(bookingPhaseLine(bk({ scheduled_at: at(10) }), now)).toMatch(/^Done · /);
  });
});

describe('guestVisit', () => {
  const list = [
    { id: 'a', guest_id: 'g1', status: 'completed', scheduled_at: at(9) },
    { id: 'b', guest_id: 'g1', status: 'confirmed', scheduled_at: at(12) },
    { id: 'c', guest_id: 'g1', status: 'cancelled', scheduled_at: at(13) },
    { id: 'd', guest_id: 'g2', status: 'confirmed', scheduled_at: at(14) },
  ];
  it('names the ordinal among the guest\'s non-cancelled bookings', () => {
    expect(guestVisit(list[1], list)).toBe('2nd booking with you · 2 in all');
  });
  it('calls a lone booking the first', () => {
    expect(guestVisit(list[3], list)).toBe('First booking with you');
  });
});
