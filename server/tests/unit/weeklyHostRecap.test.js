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

describe('computeHostWeek — a failed query must not look like a quiet week', () => {
  // The recap sent nothing to anyone for as long as it was enabled, and
  // reported ok the whole time: it selected a `bookings.amount` column that
  // does not exist, PostgREST rejected the query, the error was destructured
  // away, and null rows summarized to zero — which worthSending() reads as
  // "nothing happened this week". Zero-from-failure and zero-from-quiet are
  // indistinguishable downstream, so the only defence is refusing to be silent.
  const { supabaseAdmin } = require('../../config/supabase');
  const { computeHostWeek } = require('../../services/weeklyHostRecap');

  /** Minimal thenable query builder: every method chains, awaiting yields `result`. */
  const chain = (result) => {
    const o = {};
    ['select', 'eq', 'gte', 'lte'].forEach((m) => { o[m] = jest.fn(() => o); });
    o.then = (resolve) => resolve(result);
    return o;
  };

  afterEach(() => jest.restoreAllMocks());

  test('logs when the bookings query fails instead of returning a silent zero', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    supabaseAdmin.from
      .mockReturnValueOnce(chain({ data: null, error: { message: 'column bookings.amount does not exist' } }))
      .mockReturnValueOnce(chain({ count: 0, error: null }));

    const s = await computeHostWeek('host-1');

    expect(s).toEqual({ bookings: 0, earnings: 0, upcoming: 0 });
    expect(err).toHaveBeenCalled();
    expect(err.mock.calls[0].join(' ')).toMatch(/bookings query failed/);
  });

  test('stays quiet when the query simply returns nothing', async () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    supabaseAdmin.from
      .mockReturnValueOnce(chain({ data: [], error: null }))
      .mockReturnValueOnce(chain({ count: 0, error: null }));

    expect(await computeHostWeek('host-1')).toEqual({ bookings: 0, earnings: 0, upcoming: 0 });
    expect(err).not.toHaveBeenCalled();
  });

  test('does not ask for a column the bookings table does not have', () => {
    // Drift guard. A unit test cannot see the real schema, so it pins the one
    // fact that broke: `amount` is not selectable on bookings.
    const src = require('fs').readFileSync(require.resolve('../../services/weeklyHostRecap'), 'utf8');
    const selects = [...src.matchAll(/\.select\('([^']+)'/g)].map((m) => m[1]);
    expect(selects.some((s) => /\bamount\b/.test(s))).toBe(false);
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
