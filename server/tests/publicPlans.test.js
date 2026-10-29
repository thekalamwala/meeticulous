// publicPlans must expose sort_order so the client can rank tiers (upgrade vs.
// downgrade) and name the correct higher tier in upgrade CTAs. Without it the
// client treated every tier as rank 0 and mislabelled lower tiers as upgrades.
jest.mock('../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../services/planService', () => ({ loadPlans: jest.fn() }));
jest.mock('../services/razorpaySubscriptions', () => ({}));

const planService = require('../services/planService');
const { publicPlans } = require('../controllers/planAdminController');

const PLANS = new Map([
  ['starter',      { id: '1', slug: 'starter',      name: 'Starter',      sort_order: 1, active: true,  annual_price: 0,    monthly_price: 0,   limits: { digital_products: 3 } }],
  ['creator',      { id: '2', slug: 'creator',      name: 'Creator',      sort_order: 2, active: true,  annual_price: 999,  monthly_price: 199, limits: { digital_products: 10 } }],
  ['professional', { id: '3', slug: 'professional', name: 'Professional', sort_order: 3, active: true,  annual_price: 3650, monthly_price: 0,   limits: { digital_products: 20 } }],
  ['supreme',      { id: '4', slug: 'supreme',      name: 'Supreme',      sort_order: 99, active: false, annual_price: 0,    monthly_price: 0,   limits: { digital_products: -1 } }],
]);

const mockRes = () => {
  const res = {};
  res.json = jest.fn().mockReturnValue(res);
  res.status = jest.fn().mockReturnValue(res);
  res.set = jest.fn().mockReturnValue(res);
  return res;
};

describe('publicPlans', () => {
  beforeEach(() => planService.loadPlans.mockResolvedValue(PLANS));

  it('returns sort_order on every plan, ordered ascending', async () => {
    const res = mockRes();
    await publicPlans({}, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.map((p) => p.slug)).toEqual(['starter', 'creator', 'professional']); // supreme filtered (inactive)
    expect(payload.map((p) => p.sort_order)).toEqual([1, 2, 3]);
    payload.forEach((p) => expect(p).toHaveProperty('sort_order'));
  });
});
