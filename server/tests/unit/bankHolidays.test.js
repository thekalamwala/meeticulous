'use strict';
const bh = require('../../utils/bankHolidays');

// 2026 anchors: Oct 1 Thu · Oct 2 Fri (Gandhi Jayanti) · Oct 3 Sat · Oct 4 Sun · Oct 5 Mon.

test('isBankHoliday recognizes only listed dates', () => {
  expect(bh.isBankHoliday('2026-10-02')).toBe(true);
  expect(bh.isBankHoliday('2026-10-05')).toBe(false);
});

test('nextSettlementDay skips a bank holiday, lands on a settlement day', () => {
  const d = bh.nextSettlementDay('2026-10-01'); // Oct 2 = Gandhi Jayanti
  expect(d).not.toBe('2026-10-02');
  expect(bh.isNonSettlementDay(d)).toBe(false);
});

test('nextSettlementDay skips Sunday', () => {
  const d = bh.nextSettlementDay('2026-10-03'); // Sun Oct 4 skipped → Mon Oct 5
  expect(d).toBe('2026-10-05');
  expect(bh.dowOf(d)).not.toBe(0);
});

test('upcomingDelayingHoliday finds the weekday holiday in the window', () => {
  expect(bh.upcomingDelayingHoliday('2026-09-30', 4)).toEqual({ date: '2026-10-02', name: 'Gandhi Jayanti' });
});

test('upcomingDelayingHoliday returns null when no holiday in the window', () => {
  expect(bh.upcomingDelayingHoliday('2026-11-02', 4)).toBeNull();
});
