/**
 * Pricing v2 §2.1 Change A / acceptance test 5: a course carries no platform
 * fee — a ₹999 course costs the buyer exactly ₹999, and the verify path's
 * amount check (price + notes fee + notes GST) still matches the order.
 */
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/planService', () => ({ hostRate: jest.fn().mockResolvedValue(7) }));
jest.mock('../../services/platformConfig', () => ({ getConfig: jest.fn().mockResolvedValue({ platformFee: 10, gstRate: 0.18 }) }));
const mockOrdersCreate = jest.fn().mockResolvedValue({ id: 'order_1', amount: 99900, currency: 'INR' });
jest.mock('../../services/razorpayConfig', () => ({
  getClient: async () => ({ orders: { create: mockOrdersCreate } }),
  getKeyId: async () => 'rzp_test',
}));
jest.mock('../../utils/logger', () => ({ auditLog: jest.fn(), securityLog: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const { createCourseOrder, materializeCoursePurchase } = require('../../controllers/courseController');

test('₹999 course → order for exactly ₹999, fee and GST recorded as 0', async () => {
  const course = { id: 'c1', title: 'T', price: 999, host_id: 'h1', is_active: true };
  supabaseAdmin.from.mockImplementation((t) => t === 'courses'
    ? { select: () => ({ eq: () => ({ single: async () => ({ data: course }) }) }) }
    : { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }) }) });
  const r = { json: jest.fn(), status: jest.fn().mockReturnThis() };
  await createCourseOrder({ body: { course_id: 'c1' }, user: { id: 'buyer-1' } }, r);

  const order = mockOrdersCreate.mock.calls[0][0];
  expect(order.amount).toBe(99900);
  // Rate fixed at checkout from the host's `courses` rate (7 = a made-up mock rate).
  expect(order.notes).toMatchObject({ course_price: 999, platform_fee: 0, platform_fee_gst: 0, commission_pct: 7 });
  // verifyCoursePayment recomputes the amount from these notes — must equal the order.
  const n = order.notes;
  expect(Math.round((n.course_price + n.platform_fee + n.platform_fee_gst) * 100)).toBe(order.amount);
  expect(r.json).toHaveBeenCalledWith(expect.objectContaining({ total: 999, platform_fee: 0 }));
});

test('course purchase snapshots commission at the checkout rate (₹999 at 12% → ₹119.88)', async () => {
  let inserted;
  supabaseAdmin.rpc = jest.fn().mockResolvedValue({});
  supabaseAdmin.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
    insert: (row) => { inserted = row; return { select: () => ({ single: async () => ({ data: { id: 'cp1', ...row } }) }) }; },
  }));
  await materializeCoursePurchase({
    course: { id: 'c1', host_id: 'h1' },
    notes: { course_price: '999', platform_fee: '0', commission_pct: '12', gst_rate: '0.18', buyer_id: 'b1' },
    orderId: 'order_1', paymentId: 'pay_1',
  });
  expect(inserted).toMatchObject({ amount_paid: 999, platform_fee: 0, commission_percentage: 12,
    commission_applied: 119.88, commission_gst: 18.29, commission_taxable: 101.59 });
});
