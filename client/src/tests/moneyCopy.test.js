import { describe, it, expect } from 'vitest';
import { bandCopy } from '../pages/money/MoneyV2';
import { kycCopy } from '../pages/kyc/KycHomeV2';
import { taxLines } from '../pages/money/InvoicesTab';
import { dateFromFor, toCsv } from '../pages/money/TransactionsTab';

const buckets = (o = {}) => ({ waiting: 0, ready: 0, inTransit: 0, held: 0, total: 0, paidOut: 0, ...o });
const words = (c) => `${c.eyebrow} ${c.title.join(' ')} ${c.sub}`;

describe('bandCopy (Money balance band)', () => {
  it('asks to verify inside the balance when KYC is not done', () => {
    const c = bandCopy({ buckets: buckets({ total: 1424 }), kyc: { status: 'not_started' } });
    expect(c.title[0]).toBe('₹1,424');
    expect(c.verify).toBe('verify');
  });
  it('pending KYC has no action; rejected asks for a fix with the reason', () => {
    expect(bandCopy({ buckets: buckets({ total: 5 }), kyc: { status: 'pending' } }).verify).toBeNull();
    const r = bandCopy({ buckets: buckets({ total: 5 }), kyc: { status: 'rejected', review_note: 'Name mismatch' } });
    expect(r.verify).toBe('fix');
    expect(r.sub).toContain('Name mismatch');
  });
  it('verified: on its way, or all caught up, never a wallet', () => {
    const on = bandCopy({ buckets: buckets({ total: 900, paidOut: 100 }), kyc: { status: 'approved' } });
    expect(on.verify).toBeUndefined();
    const done = bandCopy({ buckets: buckets({ paidOut: 100 }), kyc: { status: 'approved' } });
    expect(done.title[0]).toBe('₹100');
    for (const c of [on, done, bandCopy({ buckets: buckets(), kyc: null })]) expect(words(c)).not.toMatch(/wallet/i);
  });
});

describe('kycCopy (Verification page)', () => {
  it('has a main action only where the host has something to do', () => {
    expect(kycCopy({ status: 'not_started' }).action).toBeTruthy();
    expect(kycCopy({ status: 'rejected' }).action).toBeTruthy();
    expect(kycCopy({ status: 'pending' }).action).toBeUndefined();
    expect(kycCopy({ status: 'approved' }).action).toBeUndefined();
    expect(kycCopy({ status: 'approved', payouts_ready: false }).action).toBeTruthy();
  });
  it('names the waiting money when there is some', () => {
    expect(kycCopy({ status: 'not_started', pending_earnings: 1424.05 }).title[0]).toContain('₹1,424');
  });
});

describe('taxLines', () => {
  it('hides ₹0 lines', () => {
    expect(taxLines({ tds: 0, tcs: 12.5 }).map((l) => l.label)).toEqual(['TCS']);
    expect(taxLines({ tds: 0, tcs: 0 })).toEqual([]);
    expect(taxLines(null)).toEqual([]);
  });
});

describe('Transactions helpers', () => {
  it('maps date presets to an ISO lower bound, all time to undefined', () => {
    const now = new Date('2026-11-26T15:00:00');
    expect(dateFromFor('', now)).toBeUndefined();
    expect(new Date(dateFromFor('month', now)).getDate()).toBe(1);
    expect(new Date(dateFromFor('7d', now)).getDate()).toBe(19);
  });
  it('exports the same columns, quoting commas and quotes', () => {
    const csv = toCsv([{ guest_name: 'A, "B"', services: { title: 'X', price: 100 }, vendor_amount: 95, scheduled_at: '2026-11-20T10:00:00Z' }], { verified: true });
    const [head, row] = csv.split('\n');
    expect(head.split(',')).toHaveLength(10);
    expect(row).toContain('"A, ""B"""');
  });
});
