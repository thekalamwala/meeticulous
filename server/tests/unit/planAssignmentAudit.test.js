'use strict';
// assignPlan must record an admin_audit_logs entry (action 'plan.assign') with
// before/after plan snapshots + optional reason, like payout.approve/reject do.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
jest.mock('../../services/razorpaySubscriptions', () => ({ PLAN_ID_COLUMN: { monthly: 'razorpay_plan_id_monthly', annual: 'razorpay_plan_id_annual' }, ensureRazorpayPlan: jest.fn() }));
jest.mock('../../services/planService', () => ({
  getPlan: jest.fn(),
  normalizeSlug: jest.fn((s) => s),
  clearCache: jest.fn(),
}));

const { supabaseAdmin } = require('../../config/supabase');
const { audit } = require('../../services/auditService');
const planService = require('../../services/planService');
const ctrl = require('../../controllers/planAdminController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };

// Supports the pre-update read (.select().eq().maybeSingle() → current plan)
// and the update (.update().eq().select().single() → updated row).
const chain = (currentPlan, updatedRow) => {
  const c = {};
  c.select = jest.fn(() => c);
  c.eq = jest.fn(() => c);
  c.maybeSingle = jest.fn(() => Promise.resolve({ data: { plan: currentPlan }, error: null }));
  c.update = jest.fn(() => c);
  c.single = jest.fn(() => Promise.resolve({ data: updatedRow, error: null }));
  return c;
};

const admin = { id: 'adm1', email: 'a@x.com', role: 'super' };
beforeEach(() => jest.clearAllMocks());

test('assignPlan records a plan.assign audit with before/after + reason', async () => {
  planService.getPlan.mockResolvedValue({ slug: 'supreme', name: 'Supreme', annual_price: 0 });
  supabaseAdmin.from.mockReturnValue(
    chain('creator', { id: 'h1', name: 'Host', email: 'h@x.com', plan: 'supreme', plan_expires_at: null })
  );
  const res = mockRes();
  await ctrl.assignPlan({ admin, body: { vendor_id: 'h1', plan_slug: 'supreme', reason: 'VIP partner' } }, res);

  expect(res.json).toHaveBeenCalled();
  expect(audit).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      action: 'plan.assign',
      resource_type: 'profile',
      resource_id: 'h1',
      before: { plan: 'creator' },
      after: expect.objectContaining({ plan: 'supreme', reason: 'VIP partner' }),
    })
  );
});

test('assignPlan still 400s without vendor_id/plan_slug and does not audit', async () => {
  const res = mockRes();
  await ctrl.assignPlan({ admin, body: { vendor_id: 'h1' } }, res);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(audit).not.toHaveBeenCalled();
});

test('reason is null in the audit when not supplied', async () => {
  planService.getPlan.mockResolvedValue({ slug: 'creator', name: 'Creator', annual_price: 999 });
  supabaseAdmin.from.mockReturnValue(
    chain('starter', { id: 'h2', name: 'H2', email: 'h2@x.com', plan: 'creator', plan_expires_at: '2027-01-01' })
  );
  const res = mockRes();
  await ctrl.assignPlan({ admin, body: { vendor_id: 'h2', plan_slug: 'creator' } }, res);
  expect(audit).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ after: expect.objectContaining({ reason: null }) })
  );
});
