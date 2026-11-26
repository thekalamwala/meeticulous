// Time off in availability.blocked_dates: legacy date strings, whole-day objects
// and part-day objects with a private reason (utils/timeOff + availabilityService).
jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../config/google', () => ({ getFreeBusy: jest.fn() }));
jest.mock('../../utils/cryptoTokens', () => ({ decrypt: (v) => v }));

const { sanitizeTimeOff, isFullDayOff, partDayOff, publicAvailability, MAX_REASON } = require('../../utils/timeOff');
const { isDateBlocked, timeOffIntervals, validateSlot } = require('../../services/availabilityService');

describe('sanitizeTimeOff', () => {
  test('keeps legacy strings and clean objects, drops unknown keys', () => {
    const { value, error } = sanitizeTimeOff([
      '2026-12-25',
      { date: '2026-12-31', reason: '  New year  ', extra: 'x' },
      { date: '2026-12-02', from: '14:00', to: '16:00', reason: 'Doctor' },
    ]);
    expect(error).toBeUndefined();
    expect(value).toEqual([
      '2026-12-25',
      { date: '2026-12-31', reason: 'New year' },
      { date: '2026-12-02', from: '14:00', to: '16:00', reason: 'Doctor' },
    ]);
  });

  test('passes null through (field not being updated)', () => {
    expect(sanitizeTimeOff(undefined)).toEqual({ value: undefined });
  });

  test.each([
    ['not a list', 'nope', /list of dates/],
    ['bad date string', ['25-12-2026'], /not a date/],
    ['object without date', [{ reason: 'x' }], /needs a date/],
    ['only a start time', [{ date: '2026-12-02', from: '14:00' }], /both a start and an end/],
    ['bad time', [{ date: '2026-12-02', from: '2pm', to: '16:00' }], /HH:MM/],
    ['end before start', [{ date: '2026-12-02', from: '16:00', to: '14:00' }], /end after it starts/],
    ['non-text reason', [{ date: '2026-12-02', reason: 5 }], /must be text/],
  ])('rejects %s', (_label, input, msg) => {
    expect(sanitizeTimeOff(input).error).toMatch(msg);
  });

  test('strips control characters and caps the reason', () => {
    const { value } = sanitizeTimeOff([{ date: '2026-12-02', reason: `a\u0000b\n${'x'.repeat(300)}` }]);
    expect(value[0].reason).not.toMatch(/[\u0000\n]/);
    expect(value[0].reason.length).toBe(MAX_REASON);
  });

  test('drops an empty reason', () => {
    expect(sanitizeTimeOff([{ date: '2026-12-02', reason: '   ' }]).value).toEqual([{ date: '2026-12-02' }]);
  });
});

describe('reading time off', () => {
  const list = ['2026-12-25', { date: '2026-12-31', reason: 'NYE' }, { date: '2026-12-02', from: '14:00', to: '16:00' }];

  test('whole days: legacy strings and objects without times', () => {
    expect(isFullDayOff(list, '2026-12-25')).toBe(true);
    expect(isFullDayOff(list, '2026-12-31')).toBe(true);
    expect(isFullDayOff(list, '2026-12-02')).toBe(false); // part day only
    expect(isDateBlocked(list, '2026-12-31')).toBe(true);
    expect(isDateBlocked(list, '2026-12-03')).toBe(false);
  });

  test('part days', () => {
    expect(partDayOff(list, '2026-12-02')).toEqual([{ from: '14:00', to: '16:00' }]);
    expect(partDayOff(list, '2026-12-25')).toEqual([]);
  });

  test('part-day blocks become UTC intervals in the host time zone', () => {
    const [i] = timeOffIntervals(list, '2026-12-02', 'Asia/Kolkata');
    expect(i.start.toISOString()).toBe('2026-12-02T08:30:00.000Z'); // 14:00 IST
    expect(i.end.toISOString()).toBe('2026-12-02T10:30:00.000Z');   // 16:00 IST
  });
});

describe('publicAvailability — the reason never leaves the server', () => {
  test('keeps whole days as plain dates, drops reasons and part-day blocks', () => {
    const row = { host_id: 'h', timezone: 'Asia/Kolkata', blocked_dates: ['2026-12-25', { date: '2026-12-31', reason: 'Private' }, { date: '2026-12-02', from: '14:00', to: '16:00', reason: 'Doctor' }] };
    const out = publicAvailability(row);
    expect(out.blocked_dates).toEqual(['2026-12-25', '2026-12-31']);
    expect(JSON.stringify(out)).not.toMatch(/Private|Doctor/);
    expect(out.timezone).toBe('Asia/Kolkata');
    expect(row.blocked_dates).toHaveLength(3); // input untouched
  });

  test('null row passes through', () => {
    expect(publicAvailability(null)).toBeNull();
  });
});

describe('validateSlot honours part-day time off', () => {
  const availability = {
    timezone: 'Asia/Kolkata',
    weekly_schedule: { wednesday: [{ start: '10:00', end: '18:00' }] },
    blocked_dates: [{ date: '2099-12-02', from: '14:00', to: '16:00', reason: 'Doctor' }],
  };
  test('a booking inside the block is refused before any lookup', async () => {
    const res = await validateSlot({
      host: { id: 'h' }, service: { duration: 30 }, availability,
      scheduledAtUTC: '2099-12-02T09:00:00.000Z', // 14:30 IST
      now: new Date('2099-01-01T00:00:00Z'),
    });
    expect(res).toEqual({ ok: false, reason: expect.stringMatching(/unavailable at this time/) });
  });
  test('a booking that ends exactly when the block starts is not refused by it', async () => {
    // 13:30–14:00 IST: touches the block's start, no overlap. It then goes on to the
    // busy lookups, which this mock can't serve, so only assert it got past time off.
    await expect(validateSlot({
      host: { id: 'h' }, service: { duration: 30 }, availability,
      scheduledAtUTC: '2099-12-02T08:00:00.000Z',
      now: new Date('2099-01-01T00:00:00Z'),
    }).catch((e) => ({ threw: true, e }))).resolves.not.toEqual({ ok: false, reason: expect.stringMatching(/unavailable at this time/) });
  });
});
