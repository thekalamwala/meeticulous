'use strict';
/**
 * financeReport.test.js — SUTRA phase-1 read-only finance report (ASH-21).
 * Covers: IST windows, ledger-sign aggregation (revenue / refunds / payouts / tax),
 * BACKFILL exclusion from windows, PII-free selects, and the fail-closed token gate.
 */
const selects = [];
const fixtures = {};
let failCols = null; // simulate a missing column on the query selecting exactly these cols
const mockBuilder = (table) => {
  let sel = '';
  const b = {
    select: (cols) => { sel = cols; selects.push({ table, cols }); return b; },
    order: () => b, gte: () => b, in: () => b, eq: () => b, not: () => b, is: () => b,
    range: async () => (failCols === sel
      ? { data: null, error: { code: '42703', message: 'column bookings.transfer_status does not exist' } }
      : { data: fixtures[table] || [], error: null }),
  };
  return b;
};
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (t) => mockBuilder(t) } }));
jest.mock('../../middleware/security', () => ({ newsletterIpLimiter: (_q, _s, n) => n() }));
jest.mock('../../utils/logger', () => ({ securityLog: jest.fn() }));

const express = require('express');
const request = require('supertest');
const { aggregateFinance, istWindows, buildFinanceReport } = require('../../services/financeReportService');

// 2026-11-04 10:00 IST = 04:30Z
const NOW = new Date('2026-11-04T04:30:00Z');
const W = istWindows(NOW);
const TODAY = '2026-11-04T01:00:00Z';   // 06:30 IST today
const EARLIER = '2026-11-02T10:00:00Z'; // this month, not today
const line = (code, debit, credit, source, created_at = TODAY, entry = `${source}-${code}-${created_at}`) => ({
  journal_entry_id: entry, debit, credit, created_at,
  chart_of_accounts: { code }, journal_entries: { source_type: source },
});

test('istWindows: IST midnight today and IST 1st-of-month, as UTC', () => {
  expect(W).toEqual({ todayStart: '2026-11-03T18:30:00.000Z', monthStart: '2026-10-31T18:30:00.000Z' });
  // 23:00 IST on the 30th of a month is still that day/month (UTC is 17:30Z same day)
  expect(istWindows(new Date('2026-11-30T17:30:00Z')).todayStart).toBe('2026-11-29T18:30:00.000Z');
  // 00:30 IST on the 1st = previous UTC day; must already be the NEW month
  expect(istWindows(new Date('2026-11-30T19:00:00Z')).monthStart).toBe('2026-11-30T18:30:00.000Z');
});

describe('aggregateFinance', () => {
  const m = aggregateFinance({
    windows: W,
    balanceRows: [
      ['1000', 5000], ['1100', 1200], ['2000', 900], ['2100', 180], ['2300', 10], ['2400', 5],
      ['4000', 300], ['4100', 150], ['4200', 400], ['5100', 20], ['5200', 6], ['5300', 4], ['5400', 50],
    ].map(([code, balance]) => ({ balance: String(balance), chart_of_accounts: { code } })),
    lineRows: [
      // booking today: 1180 collected → 1000 host / 100 fee / 50 commission / 30 GST
      line('1100', 1180, 0, 'ORDER_PAYMENT', TODAY, 'o1'),
      line('2000', 0, 1000, 'ORDER_PAYMENT', TODAY, 'o1'),
      line('4000', 0, 100, 'ORDER_PAYMENT', TODAY, 'o1'),
      line('4100', 0, 50, 'ORDER_PAYMENT', TODAY, 'o1'),
      line('2100', 0, 30, 'ORDER_PAYMENT', TODAY, 'o1'),
      // earlier this month: subscription 199 + refund of 500 (reverses host 450 + commission 50)
      line('4200', 0, 199, 'SUBSCRIPTION_PAYMENT', EARLIER, 's1'),
      line('2000', 450, 0, 'REFUND', EARLIER, 'r1'),
      line('4100', 50, 0, 'REFUND', EARLIER, 'r1'),
      line('1100', 0, 500, 'REFUND', EARLIER, 'r1'),
      // host payout released today (2000 → 1000)
      line('2000', 700, 0, 'SETTLEMENT', TODAY, 'p1'),
      line('1000', 0, 700, 'SETTLEMENT', TODAY, 'p1'),
      line('5100', 4, 0, 'SUBSCRIPTION_PAYMENT', EARLIER, 's1'),
      // historical backfill posted today must NOT count in windows
      line('4000', 0, 9999, 'BACKFILL', TODAY, 'b1'),
      line('2000', 9999, 0, 'BACKFILL_SETTLEMENT', TODAY, 'b2'),
    ],
    bookingRows: [{ paid_at: TODAY, customer_total: '1180' }, { paid_at: EARLIER, customer_total: '590.5' }],
    subRows: [{ paid_at: EARLIER, total_charged: '235' }],
    payoutReqRows: [{ status: 'pending', amount: '100' }, { status: 'approved', amount: '50.25' }, { status: 'pending', amount: 25 }],
    heldRows: [{ vendor_amount: '300' }, { vendor_amount: 200 }],
  });

  test('GMV + subscription collections split today vs MTD', () => {
    expect(m.gmv.today).toEqual({ amount: 1180, count: 1 });
    expect(m.gmv.mtd).toEqual({ amount: 1770.5, count: 2 });
    expect(m.subscription_collections.today).toEqual({ amount: 0, count: 0 });
    expect(m.subscription_collections.mtd).toEqual({ amount: 235, count: 1 });
  });

  test('revenue from ledger, net of refund reversal, BACKFILL excluded', () => {
    expect(m.revenue.today).toEqual({ platform_fee: 100, commission: 50, subscription: 0, total: 150 });
    expect(m.revenue.mtd).toEqual({ platform_fee: 100, commission: 0, subscription: 199, total: 299 });
    expect(m.revenue.lifetime.total).toBe(850);
    expect(m.revenue.net_revenue_lifetime).toBe(820); // 850 − 20 − 6 − 4 (same as admin summary)
  });

  test('refunds and payouts released are positive amounts with entry counts', () => {
    expect(m.refunds.today).toEqual({ amount: 0, count: 0 });
    expect(m.refunds.mtd).toEqual({ amount: 500, count: 1 });
    expect(m.host_payouts.released_today).toEqual({ amount: 700, count: 1 });
    expect(m.host_payouts.released_mtd).toEqual({ amount: 700, count: 1 });
    expect(m.host_payouts.owed_to_hosts).toBe(900);
    expect(m.host_payouts.route_held).toEqual({ amount: 500, count: 2 });
    expect(m.host_payouts.requests_awaiting).toEqual({ pending: { amount: 125, count: 2 }, approved: { amount: 50.25, count: 1 } });
  });

  test('tax, costs, cash and labels', () => {
    expect(m.tax_liability).toMatchObject({ label: 'estimated', gst_payable: 180, gst_accrued_mtd: 30, tds_payable: 10, tcs_payable: 5 });
    expect(m.platform_costs.mtd.razorpay_subscription_mdr).toBe(4);
    expect(m.platform_costs.lifetime.total).toBe(80);
    expect(m.cash_position).toMatchObject({ label: 'estimated', bank: 5000, razorpay_receivable: 1200, available_business_cash: 3920 });
    expect(m.burn_vendor_spend).toMatchObject({ label: 'not_available', value: null });
    for (const k of ['gmv', 'subscription_collections', 'revenue', 'refunds', 'host_payouts', 'platform_costs']) {
      expect(m[k].label).toBe('verified');
    }
  });

  test('windows compare instants, not strings (PostgREST +00:00 / +05:30 formats)', () => {
    const r = aggregateFinance({
      windows: W, balanceRows: [], lineRows: [], subRows: [], payoutReqRows: [], heldRows: [],
      bookingRows: [
        { paid_at: '2026-11-03T18:30:00+00:00', customer_total: 10 }, // exactly IST midnight → today
        { paid_at: '2026-11-04T00:10:00+05:30', customer_total: 20 }, // 00:10 IST today
        { paid_at: '2026-11-03T23:59:00+05:30', customer_total: 40 }, // 23:59 IST yesterday
      ],
    });
    expect(r.gmv.today).toEqual({ amount: 30, count: 2 });
  });

  test('empty DB → zeros, never NaN', () => {
    const e = aggregateFinance({ windows: W, balanceRows: [], lineRows: [], bookingRows: [], subRows: [], payoutReqRows: [], heldRows: null });
    expect(e.revenue.mtd.total).toBe(0);
    expect(e.host_payouts.route_held).toBeNull();
    expect(JSON.stringify(e)).not.toMatch(/NaN/);
  });
});

beforeEach(() => { selects.length = 0; failCols = null; for (const k of Object.keys(fixtures)) delete fixtures[k]; });

describe('buildFinanceReport', () => {

  test('as_of + windows, and selects only money/date/status columns (no PII)', async () => {
    fixtures.bookings = [{ paid_at: TODAY, customer_total: 100, vendor_amount: 0 }];
    const r = await buildFinanceReport({ now: NOW });
    expect(r).toMatchObject({ report: 'finance', version: 1, as_of: NOW.toISOString(), currency: 'INR' });
    expect(r.windows.today_start).toBe(W.todayStart);
    expect(selects.length).toBeGreaterThanOrEqual(6);
    for (const { cols } of selects) expect(cols).not.toMatch(/\*|name|email|phone|guest|host_id|vendor_id|payment_id|notes/);
  });

  test('missing Route columns → route_held null, report still served', async () => {
    failCols = 'vendor_amount';
    const r = await buildFinanceReport({ now: NOW });
    expect(r.metrics.host_payouts.route_held).toBeNull();
  });

  test('any other DB error fails the whole report (no partial numbers)', async () => {
    failCols = 'paid_at, customer_total';
    await expect(buildFinanceReport({ now: NOW })).rejects.toMatchObject({ code: '42703' });
  });
});

describe('GET /api/agents/reports/finance auth', () => {
  const app = express();
  app.use('/api/agents/reports', require('../../routes/agentReportRoutes'));
  const GOOD = 'x'.repeat(40);
  afterEach(() => { delete process.env.AGENT_REPORT_TOKEN; });

  test('fail-closed: unset or short token → 503', async () => {
    await request(app).get('/api/agents/reports/finance').set('x-agent-token', 'anything').expect(503);
    process.env.AGENT_REPORT_TOKEN = 'short';
    await request(app).get('/api/agents/reports/finance').set('x-agent-token', 'short').expect(503);
  });

  test('wrong or missing token → 401', async () => {
    process.env.AGENT_REPORT_TOKEN = GOOD;
    await request(app).get('/api/agents/reports/finance').expect(401);
    await request(app).get('/api/agents/reports/finance').set('x-agent-token', `${GOOD}y`).expect(401);
  });

  test('right token → 200 report, no-store; no write verbs', async () => {
    process.env.AGENT_REPORT_TOKEN = GOOD;
    const res = await request(app).get('/api/agents/reports/finance').set('x-agent-token', GOOD).expect(200);
    expect(res.body.report).toBe('finance');
    expect(res.headers['cache-control']).toBe('no-store');
    await request(app).post('/api/agents/reports/finance').set('x-agent-token', GOOD).expect(404);
  });
});
