// supportHours.isOpen — 10am–6pm IST, Mon–Fri. Uses fixed UTC instants so the
// test is timezone-independent (IST = UTC + 5:30).
const { isOpen } = require('../../utils/supportHours');

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
