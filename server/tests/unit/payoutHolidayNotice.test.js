'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/bankHolidays', () => ({
  istDate: jest.fn(), upcomingDelayingHoliday: jest.fn(), nextSettlementDay: jest.fn(() => '2026-10-05'),
  holidayCalendarStatus: jest.fn(() => ({ year: '2026', count: 22, stale: false })),
}));
jest.mock('../../services/payoutEmails', () => ({ sendHolidayDelay: jest.fn(() => Promise.resolve()) }));
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const bh = require('../../utils/bankHolidays');
const payoutEmails = require('../../services/payoutEmails');
const { adminAlert } = require('../../utils/adminAlert');
const { run } = require('../../services/payoutHolidayNotice');

const rows = (data) => {
  const c = {};
  for (const m of ['select', 'eq', 'gte', 'is']) c[m] = jest.fn(() => c);
  c.limit = jest.fn(() => Promise.resolve({ data, error: null }));
  return c;
};

beforeEach(() => jest.clearAllMocks());

test('skips when it is not Friday — no queries', async () => {
  bh.istDate.mockReturnValue({ ymd: '2026-09-30', dow: 3 });
  const r = await run();
  expect(r.skipped).toBe('not_friday');
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});

test('skips on a Friday with no upcoming weekday holiday', async () => {
  bh.istDate.mockReturnValue({ ymd: '2026-09-25', dow: 5 });
  bh.upcomingDelayingHoliday.mockReturnValue(null);
  const r = await run();
  expect(r.skipped).toBe('no_holiday');
  expect(payoutEmails.sendHolidayDelay).not.toHaveBeenCalled();
});

test('Friday before a holiday emails hosts with recent payouts', async () => {
  bh.istDate.mockReturnValue({ ymd: '2026-10-02', dow: 5 });
  bh.upcomingDelayingHoliday.mockReturnValue({ date: '2026-10-05', name: 'Test Holiday' });
  supabaseAdmin.from.mockReturnValue(rows([{ id: 'bk1', host_id: 'h1', vendor_amount: 500, settlement_status: 'eligible_for_settlement' }]));
  const r = await run();
  expect(payoutEmails.sendHolidayDelay).toHaveBeenCalledTimes(1);
  expect(r.notified).toBe(1);
  expect(r.holiday).toBe('Test Holiday');
});

test('cancelled bookings are not emailed', async () => {
  bh.istDate.mockReturnValue({ ymd: '2026-10-02', dow: 5 });
  bh.upcomingDelayingHoliday.mockReturnValue({ date: '2026-10-05', name: 'Test' });
  supabaseAdmin.from.mockReturnValue(rows([{ id: 'bk1', host_id: 'h1', vendor_amount: 500, settlement_status: 'cancelled' }]));
  const r = await run();
  expect(payoutEmails.sendHolidayDelay).not.toHaveBeenCalled();
  expect(r.notified).toBe(0);
});

test('F19: a stale bank-holiday calendar for the year raises a throttled admin alert', async () => {
  bh.istDate.mockReturnValue({ ymd: '2027-01-15', dow: 5 });
  bh.holidayCalendarStatus.mockReturnValue({ year: '2027', count: 4, stale: true });
  bh.upcomingDelayingHoliday.mockReturnValue(null); // no holiday → returns early after the alert
  await run();
  expect(adminAlert).toHaveBeenCalledWith(expect.objectContaining({ key: 'bank_holiday_stale:2027' }));
});

test('F19: a fresh calendar does not alert', async () => {
  bh.istDate.mockReturnValue({ ymd: '2026-09-25', dow: 5 });
  bh.holidayCalendarStatus.mockReturnValue({ year: '2026', count: 22, stale: false });
  bh.upcomingDelayingHoliday.mockReturnValue(null);
  await run();
  expect(adminAlert).not.toHaveBeenCalled();
});
