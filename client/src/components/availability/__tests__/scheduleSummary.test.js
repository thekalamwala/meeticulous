import { describe, it, expect } from 'vitest';
import { fmtClock, fmtHours, daysLabel, sharedHours, weekSummary, weekGrid, windowsLabel, monthCells } from '../scheduleSummary';
import { validateSchedule } from '../useAvailabilityEditor';

const nine5 = [{ start: '09:00', end: '17:00' }];

describe('scheduleSummary', () => {
  it('formats clock times in plain words', () => {
    expect(fmtClock('09:00')).toBe('9 am');
    expect(fmtClock('13:30')).toBe('1:30 pm');
    expect(fmtClock('00:00')).toBe('12 am');
    expect(fmtClock('12:00')).toBe('12 pm');
  });

  it("lists a day's windows", () => {
    expect(windowsLabel([{ start: '10:00', end: '13:00' }, { start: '15:00', end: '18:30' }])).toBe('10 am – 1 pm, 3 pm – 6:30 pm');
    expect(windowsLabel([])).toBe('');
  });

  it('formats durations', () => {
    expect(fmtHours(480)).toBe('8 hours');
    expect(fmtHours(60)).toBe('1 hour');
    expect(fmtHours(450)).toBe('7.5 hours');
    expect(fmtHours(30)).toBe('30 minutes');
  });

  it('collapses day runs', () => {
    expect(daysLabel(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])).toBe('Mon–Fri');
    expect(daysLabel(['monday', 'tuesday', 'wednesday', 'friday'])).toBe('Mon–Wed and Fri');
    expect(daysLabel(['saturday', 'sunday'])).toBe('Sat and Sun');
    expect(daysLabel(['monday', 'wednesday', 'friday'])).toBe('Mon, Wed and Fri');
    expect(daysLabel(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])).toBe('every day');
    expect(daysLabel([])).toBe('');
  });

  it('reports shared hours only when every open day has the same single window', () => {
    expect(sharedHours({ monday: nine5, tuesday: nine5 })).toBe('9 am – 5 pm');
    expect(sharedHours({ monday: nine5, tuesday: [{ start: '10:00', end: '17:00' }] })).toBeNull();
    expect(sharedHours({ monday: [...nine5, { start: '18:00', end: '19:00' }] })).toBeNull();
    expect(sharedHours({})).toBeNull();
  });

  it('sums the week', () => {
    const s = weekSummary({ monday: nine5, tuesday: nine5, wednesday: [] });
    expect(s.days).toEqual(['monday', 'tuesday']);
    expect(s.minutes).toBe(960);
    expect(s.label).toBe('Mon and Tue');
  });

  it('builds a half-hour grid spanning the open hours', () => {
    const g = weekGrid({ monday: [{ start: '09:30', end: '11:00' }], friday: [{ start: '10:00', end: '12:00' }] });
    expect(g.rows).toEqual([540, 570, 600, 630, 660, 690]); // 9:00 … 11:30
    expect(g.open.monday).toEqual([false, true, true, true, false, false]);
    expect(g.open.friday).toEqual([false, false, true, true, true, true]);
    expect(g.open.sunday.every((x) => !x)).toBe(true);
  });

  it('falls back to 9 am – 6 pm with nothing open, ignoring invalid windows', () => {
    const g = weekGrid({ monday: [{ start: '17:00', end: '09:00' }] });
    expect(g.rows[0]).toBe(540);
    expect(g.rows).toHaveLength(18);
    expect(g.open.monday.every((x) => !x)).toBe(true);
  });
});

describe('monthCells', () => {
  it('pads to Monday and lists every day', () => {
    const nov = monthCells(2026, 10); // 1 Nov 2026 is a Sunday
    expect(nov.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(nov.filter(Boolean)).toHaveLength(30);
    expect(nov[nov.length - 1]).toBe('2026-11-30');
    expect(monthCells(2027, 1).filter(Boolean)).toHaveLength(28);
    expect(monthCells(2026, 5)[0]).toBe('2026-06-01'); // a Monday: no padding
  });
});

describe('validateSchedule', () => {
  it('mirrors the server rules', () => {
    expect(validateSchedule({ monday: nine5 })).toBeNull();
    expect(validateSchedule({ monday: [{ start: '10:00', end: '09:00' }] })).toMatch(/end time/);
    expect(validateSchedule({ monday: [{ start: '09:00', end: '12:00' }, { start: '11:00', end: '13:00' }] })).toMatch(/Overlapping/);
    expect(validateSchedule({ monday: [{ start: '', end: '12:00' }] })).toMatch(/both times/);
  });
});
