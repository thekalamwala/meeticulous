// supportHours.isOpen — 10am–6pm IST, Mon–Fri. Uses fixed UTC instants so the
// test is timezone-independent (IST = UTC + 5:30).
const { isOpen, businessMinutesBetween } = require('../../utils/supportHours');

test('business minutes count only the open window across a weekend', () => {
  // Fri 2026-08-28 17:00 IST → Mon 2026-08-31 11:00 IST = 1h Friday + 1h Monday.
  expect(businessMinutesBetween(new Date('2026-08-28T11:30:00Z'), new Date('2026-08-31T05:30:00Z'))).toBe(120);
});

test('business minutes are zero entirely off-hours', () => {
  // Tue 2026-08-25 19:00 IST → Wed 09:00 IST.
  expect(businessMinutesBetween(new Date('2026-08-25T13:30:00Z'), new Date('2026-08-26T03:30:00Z'))).toBe(0);
});

test('business minutes within one open day', () => {
  // Tue 11:00 → 13:30 IST.
  expect(businessMinutesBetween(new Date('2026-08-25T05:30:00Z'), new Date('2026-08-25T08:00:00Z'))).toBe(150);
});

test('open midday on a weekday (IST)', () => {
  // 2026-08-25 is a Tuesday. 08:00 UTC = 13:30 IST → open.
  expect(isOpen(new Date('2026-08-25T08:00:00Z'))).toBe(true);
});

test('closed before 10am IST', () => {
  // 03:00 UTC = 08:30 IST → before open.
  expect(isOpen(new Date('2026-08-25T03:00:00Z'))).toBe(false);
});

test('closed after 6pm IST', () => {
  // 13:00 UTC = 18:30 IST → after close.
  expect(isOpen(new Date('2026-08-25T13:00:00Z'))).toBe(false);
});

test('closed on the weekend', () => {
  // 2026-08-23 is a Sunday. 08:00 UTC = 13:30 IST but Sunday → closed.
  expect(isOpen(new Date('2026-08-23T08:00:00Z'))).toBe(false);
});
