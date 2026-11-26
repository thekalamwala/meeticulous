import { describe, it, expect } from 'vitest';
import {
  initialsOf, lastSeen, waLink, isLapsing, matchesSegment, visitLine, summarize, groupRecent,
} from '../pages/ClientsV2';
import { lastVisit, bookAgainText } from '../pages/ClientDetail';

const NOW = new Date('2026-11-25T12:00:00Z').getTime();
const daysAgo = (d, now = NOW) => new Date(now - d * 86_400_000).toISOString();

describe('ClientsV2 helpers', () => {
  it('initialsOf takes up to two initials, uppercased, with a fallback', () => {
    expect(initialsOf('Ananya Rao')).toBe('AR');
    expect(initialsOf('madonna')).toBe('M');
    expect(initialsOf('a b c d')).toBe('AB');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });

  // Kept: a missing date is null so the caller writes a sentence, never a dash.
  it('lastSeen says how long ago as a person would', () => {
    expect(lastSeen(null, NOW)).toBe(null);
    expect(lastSeen(daysAgo(0), NOW)).toBe('today');
    expect(lastSeen(daysAgo(1), NOW)).toBe('yesterday');
    expect(lastSeen(daysAgo(3), NOW)).toBe('3 days ago');
    expect(lastSeen(daysAgo(90), NOW)).toBe('3 months ago');
  });

  it('waLink strips non-digits, is null without a number, and can prefill text', () => {
    expect(waLink('+91 98765 43210')).toBe('https://wa.me/919876543210');
    expect(waLink('+91 98765 43210', 'Hi & bye')).toBe('https://wa.me/919876543210?text=Hi%20%26%20bye');
    expect(waLink('')).toBe(null);
    expect(waLink(null)).toBe(null);
  });

  it('visitLine prefers the next visit, then the last, then a sentence', () => {
    expect(visitLine({ next_upcoming_at: daysAgo(-3), last_booking_at: daysAgo(-3) }, NOW)).toMatch(/^Next visit /);
    expect(visitLine({ next_upcoming_at: null, last_booking_at: daysAgo(4) }, NOW)).toBe('Last visit 4 days ago');
    expect(visitLine({ next_upcoming_at: null, last_booking_at: null }, NOW)).toBe('No visits yet');
  });
});

describe('ClientsV2 segmentation', () => {
  // Lapsing = repeat client, nothing upcoming, last seen > 60 days ago.
  it('isLapsing matches the server lapsed rule', () => {
    expect(isLapsing({ bookings_count: 3, next_upcoming_at: null, last_booking_at: daysAgo(90, Date.now()) })).toBe(true);
    expect(isLapsing({ bookings_count: 1, next_upcoming_at: null, last_booking_at: daysAgo(90, Date.now()) })).toBe(false); // one-off
    expect(isLapsing({ bookings_count: 3, next_upcoming_at: daysAgo(-5, Date.now()), last_booking_at: daysAgo(90, Date.now()) })).toBe(false); // has upcoming
    expect(isLapsing({ bookings_count: 3, next_upcoming_at: null, last_booking_at: daysAgo(20, Date.now()) })).toBe(false); // recent
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

  it('summarize counts repeat clients and the lifetime value at stake', () => {
    const list = [
      { bookings_count: 3, total_spent: 3000, next_upcoming_at: null, last_booking_at: daysAgo(90) },
      { bookings_count: 2, total_spent: 2000, next_upcoming_at: null, last_booking_at: daysAgo(10) },
      { bookings_count: 1, total_spent: 500, next_upcoming_at: null, last_booking_at: daysAgo(5) },
    ];
    expect(summarize(list, NOW)).toEqual({ total: 3, repeat: 2, lifetime: 5500, lapsing: 1, lapsingValue: 3000 });
    expect(summarize([], NOW)).toEqual({ total: 0, repeat: 0, lifetime: 0, lapsing: 0, lapsingValue: 0 });
  });

  it('groupRecent splits into coming up / last 30 days / earlier and drops empty groups', () => {
    const a = { customer_key: 'a', next_upcoming_at: daysAgo(-2), last_booking_at: daysAgo(-2) };
    const b = { customer_key: 'b', next_upcoming_at: null, last_booking_at: daysAgo(12) };
    const c = { customer_key: 'c', next_upcoming_at: null, last_booking_at: daysAgo(80) };
    expect(groupRecent([a, b, c], NOW).map(([l, r]) => [l, r.map((x) => x.customer_key)]))
      .toEqual([['Coming up', ['a']], ['Last 30 days', ['b']], ['Earlier', ['c']]]);
    expect(groupRecent([c], NOW).map(([l]) => l)).toEqual(['Earlier']);
  });
});

describe('ClientDetail helpers', () => {
  it('lastVisit is the newest past, non-cancelled booking (not a prepaid future one)', () => {
    const history = [
      { scheduled_at: daysAgo(-5), status: 'confirmed' },
      { scheduled_at: daysAgo(2), status: 'cancelled' },
      { scheduled_at: daysAgo(9), status: 'completed' },
      { scheduled_at: daysAgo(30), status: 'completed' },
    ];
    expect(lastVisit(history, NOW)).toBe(daysAgo(9));
    expect(lastVisit([], NOW)).toBe(null);
  });

  it('bookAgainText greets by first name and carries the link', () => {
    expect(bookAgainText('Meera Iyer', 'https://x.in/riya', false)).toBe("Hi Meera! Here's my booking link for your next visit: https://x.in/riya");
    expect(bookAgainText('Meera Iyer', 'https://x.in/riya', true)).toMatch(/^Hi Meera, it's been a while!.*https:\/\/x\.in\/riya$/);
    expect(bookAgainText('', 'u', false)).toMatch(/^Hi! /);
  });
});
