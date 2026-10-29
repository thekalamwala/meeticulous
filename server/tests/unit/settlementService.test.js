'use strict';
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
const { supabaseAdmin } = require('../../config/supabase');
const { computeSettlementBalance } = require('../../services/settlementService');

const chain = (result) => {
  const c = {};
  for (const m of ['select', 'eq']) c[m] = jest.fn(() => c);
  c.then = (resolve) => resolve(result);
  return c;
};

const NOW = Date.UTC(2026, 5, 20, 0, 0, 0); // 2026-06-20
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();

const mockData = (bookings, payouts) => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'bookings') return chain({ data: bookings });
    if (t === 'payout_requests') return chain({ data: payouts });
    return chain({ data: [] });
  });
};

beforeEach(() => jest.clearAllMocks());

test('matured eligible booking (completed > window ago) counts as available', async () => {
  mockData(
    [{ vendor_amount: 500, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(500);
  expect(b.clearing).toBe(0);
});

test('eligible booking still in clearing window is clearing, not available', async () => {
  mockData(
    [{ vendor_amount: 300, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(2), payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);
  expect(b.clearing).toBe(300);
});

test('paid-but-not-completed booking is pendingCompletion only', async () => {
  mockData(
    [{ vendor_amount: 200, settlement_status: 'pending_completion', completed_at: null, payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);
  expect(b.clearing).toBe(0);
  expect(b.pendingCompletion).toBe(200);
});

test('cancelled and not_eligible bookings are excluded from all buckets', async () => {
  mockData(
    [
      { vendor_amount: 999, settlement_status: 'cancelled', completed_at: daysAgo(30), payment_status: 'paid' },
      { vendor_amount: 888, settlement_status: 'not_eligible', completed_at: daysAgo(30), payment_status: 'paid' },
    ],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);
  expect(b.clearing).toBe(0);
  expect(b.pendingCompletion).toBe(0);
  expect(b.lifetimeEarned).toBe(0);
});

test('payouts (pending/approved/paid) reduce available; report inflight and paidOut', async () => {
  mockData(
    [{ vendor_amount: 1000, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' }],
    [
      { amount: 200, status: 'paid' },
      { amount: 100, status: 'approved' },
      { amount: 50, status: 'pending' },
      { amount: 999, status: 'rejected' },
    ]
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(650);
  expect(b.paidOut).toBe(200);
  expect(b.inflight).toBe(150);
});

test('available never negative when over-claimed', async () => {
  mockData(
    [{ vendor_amount: 100, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' }],
    [{ amount: 500, status: 'paid' }]
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);
});

test('negative vendor_amount is clamped to 0 (cannot suppress a real balance)', async () => {
  mockData(
    [
      { vendor_amount: 500, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' },
      { vendor_amount: -400, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' },
    ],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(500); // the -400 row contributes 0, not -400
});

test('booking completed exactly at cutoff counts as matured (<= cutoff)', async () => {
  mockData(
    [{ vendor_amount: 400, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(7), payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(400);
});

test('zero-day window makes eligible bookings immediately available', async () => {
  mockData(
    [{ vendor_amount: 250, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(0), payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 0, NOW);
  expect(b.available).toBe(250);
});

test('throws when the bookings query errors (no silent all-zeros)', async () => {
  supabaseAdmin.from.mockImplementation((t) => {
    if (t === 'bookings') return chain({ data: null, error: { message: 'connection refused' } });
    return chain({ data: [] });
  });
  await expect(computeSettlementBalance('h1', 7, NOW)).rejects.toThrow(/bookings query failed/);
});

test('scopes the bookings query to the given host_id', async () => {
  const calls = [];
  const spyChain = (result) => {
    const c = {};
    c.select = jest.fn(() => c);
    c.eq = jest.fn((col, val) => { calls.push([col, val]); return c; });
    c.then = (resolve) => resolve(result);
    return c;
  };
  supabaseAdmin.from.mockImplementation(() => spyChain({ data: [] }));
  await computeSettlementBalance('host-xyz', 7, NOW);
  expect(calls).toContainEqual(['host_id', 'host-xyz']);
});

test('eligible booking with null completed_at goes to clearing, not dropped', async () => {
  mockData(
    [{ vendor_amount: 150, settlement_status: 'eligible_for_settlement', completed_at: null, payment_status: 'paid' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);
  expect(b.clearing).toBe(150);
});

// --- auto Route rail (v3.99 transfer_status) double-pay guard ---

test('a matured booking already PAID via auto transfer (processed) is paidOut, NOT available', async () => {
  mockData(
    [{ vendor_amount: 500, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid', transfer_status: 'processed' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);       // cannot be withdrawn again
  expect(b.paidOut).toBe(500);       // reflected as already paid
  expect(b.clearing).toBe(0);
});

test('a HELD booking (pending transfer) reads as in-transit (clearing), NOT available', async () => {
  mockData(
    [{ vendor_amount: 400, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid', transfer_status: 'pending' }],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(0);
  expect(b.clearing).toBe(400);
});

test('a FAILED / REVERSED transfer means the host was not paid — money stays owed', async () => {
  mockData(
    [
      { vendor_amount: 300, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid', transfer_status: 'failed' },
      { vendor_amount: 200, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid', transfer_status: 'reversed' },
    ],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(500);     // both fall through to the manual rail
  expect(b.paidOut).toBe(0);
});

test('lifetimeEarned still counts auto-paid money (matured moved to paidOut, not lost)', async () => {
  mockData(
    [
      { vendor_amount: 500, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid', transfer_status: 'processed' },
      { vendor_amount: 100, settlement_status: 'eligible_for_settlement', completed_at: daysAgo(10), payment_status: 'paid' },
    ],
    []
  );
  const b = await computeSettlementBalance('h1', 7, NOW);
  expect(b.available).toBe(100);
  expect(b.lifetimeEarned).toBe(600);
});
