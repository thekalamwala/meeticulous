'use strict';

const { tzLabel, calendarUrl } = require('../../utils/bookingEmailExtras');

describe('bookingEmailExtras', () => {
  test('tzLabel resolves Asia/Kolkata to IST', () => {
    expect(tzLabel('2026-02-16T04:45:00Z', 'Asia/Kolkata')).toBe('IST');
  });

  test('tzLabel degrades to "" on a bad timezone', () => {
    expect(tzLabel('2026-02-16T04:45:00Z', 'Not/AZone')).toBe('');
  });

  test('calendarUrl builds a Google render link with a UTC start/end window', () => {
    const url = calendarUrl({ title: 'A & B', start: '2026-02-16T04:45:00Z', durationMin: 30, location: 'Online' });
    expect(url).toContain('https://calendar.google.com/calendar/render?action=TEMPLATE');
    expect(url).toContain('dates=20260216T044500Z%2F20260216T051500Z');
    expect(url).toContain('text=A+%26+B');
    expect(url).toContain('location=Online');
  });

  test('calendarUrl returns "" when start is unusable', () => {
    expect(calendarUrl({ title: 'x', start: 'not-a-date' })).toBe('');
  });
});
