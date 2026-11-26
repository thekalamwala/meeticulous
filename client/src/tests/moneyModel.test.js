import { describe, it, expect } from 'vitest';
import { balanceBuckets, payoutState, splitPayouts, byMonth, feeLines } from '../pages/money/moneyModel';

const NOW = Date.parse('2026-11-26T10:00:00Z');
const tx = (o) => ({ vendor_amount: 100, scheduled_at: '2026-11-20T10:00:00Z', transfer_status: null, ...o });

describe('balanceBuckets', () => {
  it('folds the server balance into waiting / ready / in transit', () => {
    const b = balanceBuckets({ pendingCompletion: 100, available: 0, heldForKyc: 50, clearing: 20, inflight: 5, paidOut: 900 });
    expect(b).toEqual({ waiting: 100, ready: 50, inTransit: 25, held: 50, total: 175, paidOut: 900 });
  });
  it('is null while the balance has not loaded', () => expect(balanceBuckets(null)).toBeNull());
});

describe('payoutState', () => {
  const s = (o, opts) => payoutState(tx(o), { now: NOW, ...opts })?.key;
  it('nothing owed has no state', () => expect(payoutState(tx({ vendor_amount: 0 }))).toBeNull());
  it('reads the Route transfer + settlement columns', () => {
    expect(s({ transfer_status: 'processed', transfer_settlement_status: 'settled' })).toBe('deposited');
    expect(s({ transfer_status: 'processed', transfer_settled_at: '2026-11-21T00:00:00Z' })).toBe('deposited');
    expect(s({ transfer_status: 'processed' })).toBe('sent');
    expect(s({ transfer_status: 'pending' })).toBe('clearing');
    expect(s({ transfer_status: 'creating' })).toBe('clearing');
    expect(s({ transfer_status: 'reversed' })).toBe('reversed');
    expect(s({ transfer_status: 'failed' })).toBe('failed');
  });
  it('an untransferred payment waits for the session, then for KYC', () => {
    expect(s({ scheduled_at: '2026-12-01T10:00:00Z' })).toBe('waiting');
    expect(s({}, { verified: true })).toBe('ready');
    expect(s({}, { verified: false })).toBe('held');
  });
  it('every state carries a word', () => {
    for (const o of [{}, { transfer_status: 'failed' }, { transfer_status: 'processed' }]) {
      expect(payoutState(tx(o), { now: NOW }).word).toMatch(/\w/);
    }
  });
});

describe('splitPayouts', () => {
  it('groups deposited payments by bank deposit, newest first, and sets problems apart', () => {
    const dep = (id, at, amt) => tx({ transfer_status: 'processed', transfer_settlement_status: 'settled', recipient_settlement_id: id, transfer_settled_at: at, vendor_amount: amt });
    const { onTheWay, deposits, problems } = splitPayouts([
      dep('setl_A', '2026-11-01T09:00:00Z', 100.1), dep('setl_B', '2026-11-20T09:00:00Z', 50), dep('setl_A', '2026-11-01T09:00:00Z', 200.2),
      tx({ transfer_status: 'failed' }), tx({ vendor_amount: 0 }), tx({ transfer_status: 'pending' }),
    ], { now: NOW });
    expect(deposits.map((d) => [d.id, d.total, d.rows.length])).toEqual([['setl_B', 50, 1], ['setl_A', 300.3, 2]]);
    expect(problems).toHaveLength(1);
    expect(onTheWay).toHaveLength(1);
  });
});

describe('byMonth', () => {
  it('starts a new group when the month changes', () => {
    const g = byMonth([{ d: '2026-11-20' }, { d: '2026-11-02' }, { d: '2026-10-30' }], (x) => x.d);
    expect(g.map((x) => x.items.length)).toEqual([2, 1]);
  });
});

describe('feeLines', () => {
  it('drops ₹0 lines and never states a rate', () => {
    const lines = feeLines({ services: { price: 1000 }, commission_applied: 50, razorpay_fee_actual: 0, tds_amount: 1, tcs_amount: 0 });
    expect(lines.map((l) => l.label)).toEqual(['Guest paid', 'Meeticulous commission', 'TDS (section 194-O)']);
    expect(lines.some((l) => /%/.test(l.label))).toBe(false);
  });
});
