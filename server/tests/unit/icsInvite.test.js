const { buildIcs } = require('../../utils/icsInvite');

test('builds a valid VCALENDAR/VEVENT with start, end, summary', () => {
  const ics = buildIcs({ id: 'b1', title: 'Tarot Reading', start: '2026-09-01T10:00:00Z', end: '2026-09-01T10:30:00Z', stamp: '2026-08-26T00:00:00Z' });
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain('BEGIN:VEVENT');
  expect(ics).toContain('UID:b1@meeticulous.com');
  expect(ics).toContain('DTSTART:20260901T100000Z');
  expect(ics).toContain('DTEND:20260901T103000Z');
  expect(ics).toContain('SUMMARY:Tarot Reading');
  expect(ics.endsWith('END:VCALENDAR')).toBe(true);
});

test('defaults a 30-min end when none is given', () => {
  const ics = buildIcs({ id: 'b2', title: 'X', start: '2026-09-01T10:00:00Z' });
  expect(ics).toContain('DTSTART:20260901T100000Z');
  expect(ics).toContain('DTEND:20260901T103000Z');
});

test('returns null when the start time is unusable', () => {
  expect(buildIcs({ id: 'b3', title: 'X', start: 'not-a-date' })).toBeNull();
  expect(buildIcs({})).toBeNull();
});

test('escapes commas/semicolons per RFC 5545', () => {
  const ics = buildIcs({ id: 'b4', title: 'Reading, Deep; Dive', start: '2026-09-01T10:00:00Z', end: '2026-09-01T11:00:00Z' });
  expect(ics).toContain('SUMMARY:Reading\\, Deep\\; Dive');
});
