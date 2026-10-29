'use strict';
const { parseDob } = require('../../lib/dobValidator');

const NOW = new Date('2026-06-15T12:00:00Z').getTime();

test('accepts a real past date within the sane age range', () => {
  expect(parseDob('1990-06-15', NOW)).toEqual({ ok: true, value: '1990-06-15' });
});

test('empty / null clears the DOB (allowed)', () => {
  expect(parseDob('', NOW)).toEqual({ ok: true, value: null });
  expect(parseDob(null, NOW)).toEqual({ ok: true, value: null });
  expect(parseDob(undefined, NOW)).toEqual({ ok: true, value: null });
});

test('rejects a malformed string', () => {
  expect(parseDob('15/06/1990', NOW).ok).toBe(false);
  expect(parseDob('1990-6-5', NOW).ok).toBe(false);
});

test('rejects an impossible date (would silently roll over)', () => {
  expect(parseDob('2026-02-30', NOW).ok).toBe(false);
  expect(parseDob('1990-13-01', NOW).ok).toBe(false);
});

test('rejects a future date', () => {
  expect(parseDob('2030-01-01', NOW).ok).toBe(false);
});

test('rejects absurd ages (too young / too old)', () => {
  expect(parseDob('2020-01-01', NOW).ok).toBe(false); // ~6yo < 13
  expect(parseDob('1850-01-01', NOW).ok).toBe(false); // > 120
});
