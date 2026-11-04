'use strict';
// Gifted Pro admin handlers: input validation, GiftError → HTTP status, and the
// routes are super-admin only (founder rule).
const fs = require('fs');
const path = require('path');

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ message: e.message }) }));
jest.mock('../../services/auditService', () => ({ audit: jest.fn() }));
jest.mock('../../services/razorpaySubscriptions', () => ({ PLAN_ID_COLUMN: {}, ensureRazorpayPlan: jest.fn() }));
jest.mock('../../services/planGiftService', () => {
  class GiftError extends Error { constructor(code, m) { super(m); this.code = code; } }
  return {
    GiftError, TENURES: [1, 2, 6, 12, 24, 60], MAX_BATCH: 200,
    grantGift: jest.fn(async () => ({ granted: [{ host_id: 'h1' }], skipped: [] })),
    extendGift: jest.fn(), revokeGift: jest.fn(), listGifts: jest.fn(), checkEligibility: jest.fn(),
  };
});

const planGiftService = require('../../services/planGiftService');
const ctrl = require('../../controllers/planAdminController');

const mockRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const call = async (fn, body, params = {}) => { const res = mockRes(); await fn({ admin: { id: 'adm1' }, body, params, query: {} }, res); return res; };

beforeEach(() => jest.clearAllMocks());

test('grant validates months, reason and host_ids', async () => {
  expect((await call(ctrl.grantGifts, { host_ids: ['h1'], months: 3, reason: 'x' })).status).toHaveBeenCalledWith(400);
  expect((await call(ctrl.grantGifts, { host_ids: ['h1'], months: 12, reason: '   ' })).status).toHaveBeenCalledWith(400);
  expect((await call(ctrl.grantGifts, { host_ids: [], months: 12, reason: 'x' })).status).toHaveBeenCalledWith(400);
  expect((await call(ctrl.grantGifts, { host_ids: Array(201).fill('h'), months: 12, reason: 'x' })).status).toHaveBeenCalledWith(400);
  expect(planGiftService.grantGift).not.toHaveBeenCalled();
});

test('grant passes trimmed, length-capped fields through', async () => {
  const res = await call(ctrl.grantGifts, { host_ids: ['h1'], months: '60', reason: ' Beta ', note: 'n'.repeat(400), campaign: '  ' });
  expect(res.status).toHaveBeenCalledWith(201);
  expect(planGiftService.grantGift).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
    hostIds: ['h1'], months: 60, reason: 'Beta', campaign: null,
  }));
  expect(planGiftService.grantGift.mock.calls[0][1].note).toHaveLength(280);
});

test('extend / revoke validate and map GiftError codes', async () => {
  expect((await call(ctrl.extendGift, { months: 5 }, { id: 'g1' })).status).toHaveBeenCalledWith(400);
  expect((await call(ctrl.revokeGift, {}, { id: 'g1' })).status).toHaveBeenCalledWith(400);

  planGiftService.revokeGift.mockRejectedValueOnce(new planGiftService.GiftError('NOT_ACTIVE', 'already ended'));
  expect((await call(ctrl.revokeGift, { reason: 'dup' }, { id: 'g1' })).status).toHaveBeenCalledWith(409);
  planGiftService.extendGift.mockRejectedValueOnce(new planGiftService.GiftError('GIFTS_UNAVAILABLE', 'apply v3.190'));
  expect((await call(ctrl.extendGift, { months: 1 }, { id: 'g1' })).status).toHaveBeenCalledWith(503);
});

test('every /gifts route is super-admin only', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/adminRoutes.js'), 'utf8');
  const routes = src.split('\n').filter((l) => /router\.\w+\('\/gifts/.test(l));
  expect(routes).toHaveLength(6);
  for (const l of routes) expect(l).toMatch(/requireSuperAdmin,/);
});
