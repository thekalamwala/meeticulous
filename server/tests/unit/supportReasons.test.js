// Contact-reason taxonomy — pure.
const { REASONS, isValidReason, isProductCaused, suggestReason } = require('../../config/supportReasons');

test('every reason has a code, label, category and a known type', () => {
  const types = new Set(['product', 'ux', 'expected', 'external', 'unknown']);
  REASONS.forEach((r) => {
    expect(r.code).toMatch(/^[a-z_]+$/);
    expect(r.label.length).toBeGreaterThan(0);
    expect(r.category.length).toBeGreaterThan(0);
    expect(types.has(r.type)).toBe(true);
  });
  // codes are unique
  expect(new Set(REASONS.map((r) => r.code)).size).toBe(REASONS.length);
});

test('isValidReason gates unknown codes', () => {
  expect(isValidReason('pay_refund')).toBe(true);
  expect(isValidReason('nonsense')).toBe(false);
  expect(isValidReason(undefined)).toBe(false);
});

test('product-caused = product or ux types only', () => {
  expect(isProductCaused('product_bug')).toBe(true);   // product
  expect(isProductCaused('host_listing_live')).toBe(true); // ux
  expect(isProductCaused('pay_refund')).toBe(false);   // expected
  expect(isProductCaused('pay_failed')).toBe(false);   // external
  expect(isProductCaused('other')).toBe(false);        // unknown
});

test('suggestReason pre-fills the picker from message text', () => {
  expect(suggestReason('where is my refund')).toBe('pay_refund');
  expect(suggestReason('my listing is not live')).toBe('host_listing_live');
  expect(suggestReason('the page throws an error')).toBe('product_bug');
  expect(suggestReason('hello there')).toBeNull();
});
