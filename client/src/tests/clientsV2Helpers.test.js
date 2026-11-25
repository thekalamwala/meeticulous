import { describe, it, expect } from 'vitest';
import { initialsOf, lastSeen, waLink, isLapsing, matchesSegment } from '../pages/ClientsV2';

const daysAgo = (d) => new Date(Date.now() - d * 86_400_000).toISOString();

describe('ClientsV2 helpers', () => {
  it('initialsOf takes up to two initials, uppercased, with a fallback', () => {
    expect(initialsOf('Ananya Rao')).toBe('AR');
    expect(initialsOf('madonna')).toBe('M');
    expect(initialsOf('a b c d')).toBe('AB');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });

  it('lastSeen renders relative days with today/em-dash edges', () => {
    expect(lastSeen(null)).toBe('—');
    expect(lastSeen(new Date().toISOString())).toBe('today');
    expect(lastSeen(daysAgo(3))).toBe('3d ago');
  });

  it('waLink strips non-digits and is null without a number', () => {
    expect(waLink('+91 98765 43210')).toBe('https://wa.me/919876543210');
    expect(waLink('')).toBe(null);
    expect(waLink(null)).toBe(null);
  });
});

describe('ClientsV2 segmentation', () => {
  // Lapsing = repeat client, nothing upcoming, last seen > 60 days ago.
  it('isLapsing matches the server lapsed rule', () => {
    expect(isLapsing({ bookings_count: 3, next_upcoming_at: null, last_booking_at: daysAgo(90) })).toBe(true);
    expect(isLapsing({ bookings_count: 1, next_upcoming_at: null, last_booking_at: daysAgo(90) })).toBe(false); // one-off
    expect(isLapsing({ bookings_count: 3, next_upcoming_at: daysAgo(-5), last_booking_at: daysAgo(90) })).toBe(false); // has upcoming
    expect(isLapsing({ bookings_count: 3, next_upcoming_at: null, last_booking_at: daysAgo(20) })).toBe(false); // recent
  });

  it('matchesSegment routes new / repeat / risk / vip / all', () => {
    const vips = new Set(['k-vip']);
    expect(matchesSegment({ customer_key: 'k1', bookings_count: 1 }, 'new', vips)).toBe(true);
    expect(matchesSegment({ customer_key: 'k1', bookings_count: 2 }, 'new', vips)).toBe(false);
    expect(matchesSegment({ customer_key: 'k1', bookings_count: 2 }, 'repeat', vips)).toBe(true);
    expect(matchesSegment({ customer_key: 'k1', no_show_count: 2 }, 'risk', vips)).toBe(true);
    expect(matchesSegment({ customer_key: 'k1', no_show_count: 0 }, 'risk', vips)).toBe(false);
    expect(matchesSegment({ customer_key: 'k-vip' }, 'vip', vips)).toBe(true);
    expect(matchesSegment({ customer_key: 'k1' }, 'vip', vips)).toBe(false);
    expect(matchesSegment({ customer_key: 'k1' }, 'all', vips)).toBe(true);
  });
});
