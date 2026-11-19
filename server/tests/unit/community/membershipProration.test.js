'use strict';
// Upgrade money math: unused days of the current tier credit against the first
// charge of the dearer one. Pure function, so every edge is cheap to pin here
// rather than discovered against a real card.

const { quoteUpgrade, remainingDays, isUpgrade } = require('../../../lib/membershipProration');

const NOW = new Date('2026-11-19T12:00:00.000Z');
const inDays = (n) => new Date(NOW.getTime() + n * 24 * 3600 * 1000).toISOString();

describe('remainingDays', () => {
  test('rounds part-days up — a member paid for the whole calendar day', () => {
    expect(remainingDays(new Date(NOW.getTime() + 4 * 3600 * 1000).toISOString(), NOW)).toBe(1);
  });
  test('a past period end earns nothing', () => {
    expect(remainingDays(inDays(-3), NOW)).toBe(0);
  });
  test('missing or unparseable period end earns nothing', () => {
    expect(remainingDays(null, NOW)).toBe(0);
    expect(remainingDays('not a date', NOW)).toBe(0);
  });
  test('caps at one cycle so a bad period end cannot mint credit', () => {
    expect(remainingDays(inDays(400), NOW)).toBe(30);
  });
});

describe('quoteUpgrade', () => {
  test('half a cycle left on 499 credits half of it against 1499', () => {
    const q = quoteUpgrade({ currentPriceInr: 499, newPriceInr: 1499, periodEndIso: inDays(15), now: NOW });
    expect(q.remainingDays).toBe(15);
    expect(q.creditInr).toBe(249.5);
    expect(q.dueNowInr).toBe(1249.5);
  });

  test('a free tier earns no credit — full price is due', () => {
    const q = quoteUpgrade({ currentPriceInr: 0, newPriceInr: 499, periodEndIso: inDays(20), now: NOW });
    expect(q.creditInr).toBe(0);
    expect(q.dueNowInr).toBe(499);
  });

  test('an expired period earns no credit', () => {
    const q = quoteUpgrade({ currentPriceInr: 499, newPriceInr: 1499, periodEndIso: inDays(-1), now: NOW });
    expect(q.creditInr).toBe(0);
    expect(q.dueNowInr).toBe(1499);
  });

  test('credit never exceeds what the member actually paid', () => {
    const q = quoteUpgrade({ currentPriceInr: 499, newPriceInr: 1499, periodEndIso: inDays(400), now: NOW });
    expect(q.creditInr).toBe(499);
    expect(q.dueNowInr).toBe(1000);
  });

  test('due now never goes negative', () => {
    // Not reachable through isUpgrade, but the arithmetic must not hand Razorpay
    // a negative order amount if a caller ever gets the guard wrong.
    const q = quoteUpgrade({ currentPriceInr: 5000, newPriceInr: 100, periodEndIso: inDays(30), now: NOW });
    expect(q.dueNowInr).toBe(0);
  });

  test('refuses a free target tier — free joins do not go through billing', () => {
    expect(() => quoteUpgrade({ currentPriceInr: 0, newPriceInr: 0, periodEndIso: inDays(10), now: NOW }))
      .toThrow(/newPriceInr/);
  });
});

describe('isUpgrade', () => {
  test('dearer is an upgrade, same or cheaper is not', () => {
    expect(isUpgrade(499, 1499)).toBe(true);
    expect(isUpgrade(0, 499)).toBe(true);
    expect(isUpgrade(1499, 1499)).toBe(false);
    expect(isUpgrade(1499, 499)).toBe(false);
  });
});
