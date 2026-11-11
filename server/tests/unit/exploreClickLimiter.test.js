/**
 * tests/unit/exploreClickLimiter.test.js
 *
 * Security audit F-04: POST /api/explore/click writes a row into explore_clicks
 * on every call and had no per-route limiter — only the global apiLimiter, which
 * IP rotation bypasses (~144k inserts/day/IP). Assert a dedicated clickLimiter is
 * attached to the route.
 */
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({}) },
  supabase: {},
}));

const exploreRoutes = require('../../routes/exploreRoutes');
const { clickLimiter } = require('../../middleware/security');

test('clickLimiter is exported from security middleware', () => {
  expect(typeof clickLimiter).toBe('function');
});

test('POST /explore/click is guarded by clickLimiter (beyond the global apiLimiter)', () => {
  const layer = exploreRoutes.stack.find(
    (l) => l.route && l.route.path === '/click' && l.route.methods.post,
  );
  expect(layer).toBeDefined();
  const handles = layer.route.stack.map((s) => s.handle);
  expect(handles).toContain(clickLimiter);
});
