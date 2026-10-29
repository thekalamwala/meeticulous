/**
 * tests/unit/validateWeeklySchedule.test.js
 *
 * P1-10: a host could save end<=start / overlapping / malformed availability
 * windows; computeSlots then silently produced ZERO bookable slots (host looks
 * open, guests see nothing). The validator rejects those server-side.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { validateWeeklySchedule } = require('../../controllers/hostController');

test('null schedule (not being updated) is allowed', () => {
  expect(validateWeeklySchedule(null)).toBeNull();
});

test('a valid schedule passes', () => {
  const ws = {
    monday: [{ start: '09:00', end: '12:00' }, { start: '13:00', end: '17:00' }],
    sunday: [],
  };
  expect(validateWeeklySchedule(ws)).toBeNull();
});

test('rejects end <= start', () => {
  const msg = validateWeeklySchedule({ monday: [{ start: '17:00', end: '09:00' }] });
  expect(msg).toMatch(/end time must be after/i);
});

test('rejects overlapping windows on the same day', () => {
  const msg = validateWeeklySchedule({
    tuesday: [{ start: '09:00', end: '12:00' }, { start: '11:00', end: '14:00' }],
  });
  expect(msg).toMatch(/overlapping/i);
});

test('rejects malformed HH:MM', () => {
  expect(validateWeeklySchedule({ monday: [{ start: '9am', end: '5pm' }] })).toMatch(/HH:MM/i);
});

test('rejects an unknown day key', () => {
  expect(validateWeeklySchedule({ funday: [{ start: '09:00', end: '10:00' }] })).toMatch(/unknown day/i);
});

test('rejects a non-array day value', () => {
  expect(validateWeeklySchedule({ monday: 'open' })).toMatch(/list of time windows/i);
});

test('rejects a non-object schedule', () => {
  expect(validateWeeklySchedule(['monday'])).toMatch(/invalid weekly schedule/i);
});
