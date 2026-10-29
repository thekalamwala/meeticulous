'use strict';
// P1: the reason-guarded changeStatus and the real-time recomputeFromAccount.
// The pure decision logic lives in lifecycleRules.test.js; here we pin the I/O
// wrappers — that manual backward/exit moves demand a reason, auto moves don't,
// and that a paid host with a booking is resolved straight to `won`.

const mockState = { leadRow: null, profileRow: null, updates: [], activities: [] };

// Per-table Supabase mock. A builder is chainable + awaitable; maybeSingle and
// await both resolve via mockResolve(table, isCount).
function mockResolve(table, isCount) {
  switch (table) {
    case 'leads': return { data: mockState.leadRow, error: null };
    case 'profiles': return { data: mockState.profileRow, error: null };
    case 'services': return { count: 1, error: null };
    case 'availability': return { count: 1, error: null };
    case 'bookings': return isCount
      ? { count: 6, error: null }                                                        // last-30d recency
      : { data: [{ platform_fee_amount: 4000, status: null, created_at: '2026-08-01' }], error: null }; // ₹4000 fee (below sloth gate)
    case 'subscription_payments': return { data: [{ total_charged: 3650, status: 'paid' }], error: null };
    case 'referrals': return { count: 0, error: null };
    default: return { data: null, count: 0, error: null };
  }
}

jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from(table) {
      return {
        _t: table, _count: false,
        select(_c, opts) { if (opts && opts.count) this._count = true; return this; },
        eq() { return this; }, gte() { return this; }, in() { return this; }, is() { return this; },
        order() { return this; }, limit() { return this; },
        maybeSingle() { return Promise.resolve(mockResolve(table, this._count)); },
        then(res, rej) { return Promise.resolve(mockResolve(table, this._count)).then(res, rej); },
        update(patch) { mockState.updates.push({ table, patch }); return { eq: () => Promise.resolve({ error: null }) }; },
        insert(row) { const r = [].concat(row)[0]; return { select: () => ({ single: () => Promise.resolve({ data: { id: 'lead1', ...r }, error: null }) }) }; },
      };
    },
  },
  supabase: {},
}));
jest.mock('../../services/crm/activity', () => ({ logActivity: async (_id, type, opts) => { mockState.activities.push({ type, meta: opts && opts.meta }); } }));
jest.mock('../../services/crm/intentEvents', () => ({ attachToLead: async () => {} }));
jest.mock('../../services/planService', () => ({
  getPlan: async () => ({ annual_price: 3650, monthly_price: 555 }),
  resolveVendorPlan: (p) => (p && p.plan) || 'professional',
  isFreeSlug: (s) => ['free', 'starter', 'starter_legacy', 'explorer'].includes(String(s || '').toLowerCase()),
}));

const leadService = require('../../services/crm/leadService');

const statusPatches = () => mockState.updates.filter((u) => u.table === 'leads' && u.patch.status);
const lastStatusMeta = () => [...mockState.activities].reverse().find((a) => a.type === 'status_changed')?.meta;

beforeEach(() => {
  mockState.leadRow = null; mockState.profileRow = null; mockState.updates = []; mockState.activities = [];
});

describe('changeStatus — manual override guard', () => {
  test('manual backward move WITHOUT a reason throws', async () => {
    mockState.leadRow = { id: 'lead1', status: 'won', converted_at: '2026-01-01' };
    await expect(leadService.changeStatus('lead1', 'qualified', 'admin1')).rejects.toThrow(/reason required/);
    expect(statusPatches()).toHaveLength(0);            // nothing written
  });

  test('manual backward move WITH a reason succeeds and records it', async () => {
    mockState.leadRow = { id: 'lead1', status: 'won', converted_at: '2026-01-01' };
    await leadService.changeStatus('lead1', 'qualified', 'admin1', { reason: 'refund — not a real win' });
    const meta = lastStatusMeta();
    expect(meta.change_type).toBe('manual');
    expect(meta.reason).toBe('refund — not a real win');
  });

  test('manual EXIT needs a reason, and stores it as lost_reason', async () => {
    mockState.leadRow = { id: 'lead1', status: 'qualified', converted_at: null };
    await expect(leadService.changeStatus('lead1', 'lost', 'admin1')).rejects.toThrow(/reason required/);
    await leadService.changeStatus('lead1', 'lost', 'admin1', { reason: 'not_interested' });
    expect(statusPatches().pop().patch.lost_reason).toBe('not_interested');
  });

  test('manual FORWARD move needs no reason', async () => {
    mockState.leadRow = { id: 'lead1', status: 'new', converted_at: null };
    await leadService.changeStatus('lead1', 'qualified', 'admin1');
    expect(statusPatches()).toHaveLength(1);
    expect(lastStatusMeta().change_type).toBe('manual');
  });

  test('system/auto move (no actor) bypasses the reason guard even backward', async () => {
    mockState.leadRow = { id: 'lead1', status: 'won', converted_at: '2026-01-01' };
    await leadService.changeStatus('lead1', 'churned', null, { via: 'cancel' });
    expect(lastStatusMeta().change_type).toBe('auto');
  });

  test('an invalid status is always rejected', async () => {
    mockState.leadRow = { id: 'lead1', status: 'new', converted_at: null };
    await expect(leadService.changeStatus('lead1', 'bogus', 'admin1')).rejects.toThrow(/invalid status/);
  });

  test('a paying customer (MONEY status) cannot be demoted to list', async () => {
    mockState.leadRow = { id: 'lead1', status: 'paid', converted_at: '2026-01-01' };
    await expect(leadService.changeStatus('lead1', 'list', 'admin1')).rejects.toThrow(/paying customer/);
    expect(statusPatches()).toHaveLength(0);            // status='list' never written
  });

  test('a non-money lead can still be demoted to list (routine, no reason)', async () => {
    mockState.leadRow = { id: 'lead1', status: 'qualified', converted_at: null };
    await leadService.changeStatus('lead1', 'list', 'admin1');
    expect(statusPatches().pop().patch.status).toBe('list');
  });
});

describe('recomputeFromAccount — real-time resolution', () => {
  test('paid host, onboarded, with a booking → resolves to won', async () => {
    mockState.leadRow = { id: 'lead1', status: 'paid', converted_at: '2026-01-01' };
    mockState.profileRow = { onboarding_completed: true, profile_image: 'x.jpg', plan: 'professional', razorpay_subscription_id: 'sub_1', subscription_status: 'active' };
    const next = await leadService.recomputeFromAccount('prof1');
    expect(next).toBe('won');
    expect(statusPatches().pop().patch.status).toBe('won');
  });

  test('no linked lead → null, no writes', async () => {
    mockState.leadRow = null;
    expect(await leadService.recomputeFromAccount('prof-none')).toBeNull();
    expect(statusPatches()).toHaveLength(0);
  });

  test('never throws — protects the payment flow', async () => {
    mockState.leadRow = { id: 'lead1', status: 'paid', converted_at: null };
    mockState.profileRow = null;
    await expect(leadService.recomputeFromAccount('prof1')).resolves.not.toThrow();
  });
});
