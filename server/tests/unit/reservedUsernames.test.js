/**
 * tests/unit/reservedUsernames.test.js — the reserved-slug guard must block every
 * top-level route segment so a host username can never shadow a real app route.
 */
const { isReserved } = require('../../utils/reservedUsernames');

describe('reservedUsernames.isReserved', () => {
  // Guest namespace + every top-level route segment from client/src/App.jsx.
  const reserved = [
    'user',          // /user/* guest namespace
    'review',        // /review/:bookingId
    'reviews',       // /user/reviews (+ legacy redirect)
    'refund',        // /refund
    'lp',            // /lp/* landing pages
    'dashboard', 'super-dashboard', 'admin', 'explore', 'support',
    'my-bookings', 'profile', 'loyalty',
    'help', 'about', 'privacy', 'terms', 'unsubscribe',
  ];

  it.each(reserved)('rejects "%s" (case-insensitive)', (slug) => {
    expect(isReserved(slug)).toBe(true);
    expect(isReserved(slug.toUpperCase())).toBe(true);
    expect(isReserved(`  ${slug}  `)).toBe(true);
  });

  it('rejects empty / nullish slugs', () => {
    expect(isReserved('')).toBe(true);
    expect(isReserved(null)).toBe(true);
    expect(isReserved(undefined)).toBe(true);
  });

  it('allows an ordinary host slug', () => {
    expect(isReserved('jane-doe')).toBe(false);
    expect(isReserved('astro_guru')).toBe(false);
  });
});
