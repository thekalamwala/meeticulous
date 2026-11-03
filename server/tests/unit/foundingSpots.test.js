'use strict';
// Founding-100: count, checkout routing to premium_founding, founder milestone alerts.

const mockState = { taken: 0, profile: null, marker: null, upserts: [], plans: new Map() };
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn((table) => {
      const c = {};
      c.select = () => c; c.in = () => c; c.eq = () => c;
      c.not = () => Promise.resolve({ count: mockState.taken, error: null }); // count query ends here
      c.maybeSingle = () => Promise.resolve({ data: table === 'profiles' ? mockState.profile : mockState.marker });
      c.upsert = (row) => { mockState.upserts.push(row); return Promise.resolve({ error: null }); };
      return c;
    }),
  },
}));
jest.mock('../../services/planService', () => ({
  loadPlans: jest.fn(async () => mockState.plans),
  resolveVendorPlan: (p) => (p && p.plan) || 'free',
}));
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn() }));

const { adminAlert } = require('../../utils/adminAlert');
const founding = require('../../services/foundingSpots');

beforeEach(() => {
  jest.clearAllMocks();
  founding.clearCache();
  Object.assign(mockState, { taken: 0, profile: null, marker: null, upserts: [], plans: new Map([['premium_founding', {}]]) });
});

test('status counts paying Pro against 100', async () => {
  mockState.taken = 73;
  expect(await founding.getFoundingStatus({ fresh: true })).toEqual({ limit: 100, taken: 73, left: 27, open: true });
});

test('routes to founding while open, or when the host already holds it', async () => {
  mockState.taken = 10;
  expect(await founding.routesToFounding('h1')).toBe(true);
  mockState.taken = 100;
  expect(await founding.routesToFounding('h1')).toBe(false);
  mockState.profile = { plan: 'premium_founding' };
  expect(await founding.routesToFounding('h1')).toBe(true);
});

test('never routes when the founding row is missing (migration not applied)', async () => {
  mockState.plans = new Map();
  mockState.taken = 1;
  expect(await founding.routesToFounding('h1')).toBe(false);
});

test('alerts once at 90 and once at 100', async () => {
  mockState.taken = 91;
  expect(await founding.checkFoundingMilestones()).toEqual({ alerted: 90 });
  expect(mockState.upserts[0]).toMatchObject({ key: 'founding_milestone_alerted', value: '90' });
  mockState.marker = { value: '90' };
  expect(await founding.checkFoundingMilestones()).toEqual({ alerted: null });
  mockState.taken = 100;
  expect(await founding.checkFoundingMilestones()).toEqual({ alerted: 100 });
  expect(adminAlert).toHaveBeenCalledTimes(2);
  expect(adminAlert.mock.calls[1][0].subject).toMatch(/cutover/);
});
