'use strict';
// Weekly host recap — retention loop. Pure summary logic + the off-by-default gate.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/sendEmail', () => jest.fn().mockResolvedValue(undefined));
jest.mock('../../utils/inAppNotify', () => ({ inAppNotify: jest.fn() }));

const sendEmail = require('../../utils/sendEmail');
const { summarize, worthSending, sendWeeklyRecaps } = require('../../services/weeklyHostRecap');

describe('summarize', () => {
  test('sums vendor_amount (falling back to amount only when null/undefined)', () => {
    // Row 3: vendor_amount is 0 (not null), so it stays 0 — a ₹0 booking earned ₹0.
    const s = summarize([{ vendor_amount: 500 }, { amount: 200 }, { vendor_amount: 0, amount: 99 }], 4);
    expect(s).toEqual({ bookings: 3, earnings: 700, upcoming: 4 });
  });
  test('empty week', () => {
    expect(summarize([], 0)).toEqual({ bookings: 0, earnings: 0, upcoming: 0 });
  });
});

describe('worthSending — never nag a dead host', () => {
  test('nothing this week and nothing upcoming → skip', () => {
    expect(worthSending({ bookings: 0, earnings: 0, upcoming: 0 })).toBe(false);
  });
  test('had a booking → send', () => {
    expect(worthSending({ bookings: 1, earnings: 500, upcoming: 0 })).toBe(true);
  });
  test('only upcoming → send', () => {
    expect(worthSending({ bookings: 0, earnings: 0, upcoming: 2 })).toBe(true);
  });
});

describe('sendWeeklyRecaps gate', () => {
  const OLD = process.env.WEEKLY_RECAP_ENABLED;
  afterEach(() => { process.env.WEEKLY_RECAP_ENABLED = OLD; });

  test('off by default — no DB touch, no email', async () => {
    delete process.env.WEEKLY_RECAP_ENABLED;
    const r = await sendWeeklyRecaps();
    expect(r).toEqual({ skipped: 'disabled' });
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
