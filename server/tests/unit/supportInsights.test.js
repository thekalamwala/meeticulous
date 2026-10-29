// Insights aggregation — supabaseAdmin mocked with a per-table result queue.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/supportChatService', () => ({}));
jest.mock('../../services/supportContextService', () => ({}));
const { supabaseAdmin } = require('../../config/supabase');
const { insights } = require('../../controllers/supportAdminController');

// Chainable builder resolving (await) to `result`.
function qb(result) {
  const b = {};
  ['select', 'eq', 'gte'].forEach((m) => { b[m] = () => b; });
  b.then = (res) => res(result);
  return b;
}
const mkRes = () => { const r = {}; r.json = jest.fn(() => r); r.status = jest.fn(() => r); return r; };

test('aggregates reasons across threads + escalations and computes product-caused rate', async () => {
  const queue = {
    support_threads: [{ data: [{ reason_code: 'pay_refund', rating: 5 }, { reason_code: 'host_listing_live', rating: 3 }, { reason_code: null, rating: null }], error: null }],
    bot_escalations: [{ data: [{ reason_code: 'product_bug', rating: 4 }, { reason_code: 'host_listing_live', rating: null }], error: null }],
  };
  supabaseAdmin.from.mockImplementation((t) => qb(queue[t].shift()));

  const res = mkRes();
  await insights({ query: { days: '30' } }, res);
  const out = res.json.mock.calls[0][0];

  expect(out.total_resolved).toBe(5);
  expect(out.tagged).toBe(4); // one null dropped
  // product/ux: host_listing_live x2 (ux) + product_bug (product) = 3 of 4
  expect(out.product_caused_rate).toBeCloseTo(0.75, 2);
  // CSAT: ratings 5,3,4 → avg 4.0 over 3 responses
  expect(out.csat).toBeCloseTo(4.0, 2);
  expect(out.csat_responses).toBe(3);
  const top = out.by_reason.find((r) => r.code === 'host_listing_live');
  expect(top.count).toBe(2);
  expect(out.by_category.find((c) => c.category === 'host').count).toBe(2);
});

test('degrades to empty when the reason_code column is missing (pre-migration)', async () => {
  supabaseAdmin.from.mockImplementation(() => qb({ data: null, error: { message: 'column reason_code does not exist' } }));
  const res = mkRes();
  await insights({ query: {} }, res);
  const out = res.json.mock.calls[0][0];
  expect(out.total_resolved).toBe(0);
  expect(out.by_reason).toEqual([]);
  expect(out.product_caused_rate).toBe(0);
});
