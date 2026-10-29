// server/tests/unit/featureRegistryFeedback.test.js
const { REGISTRY, KEYS } = require('../../config/featureRegistry');

test('vendor_feedback flag is registered with the right shape', () => {
  expect(KEYS).toContain('vendor_feedback');
  const f = REGISTRY.find((x) => x.key === 'vendor_feedback');
  expect(f).toMatchObject({ key: 'vendor_feedback', scope: 'vendor', category: 'Operations' });
  expect(typeof f.label).toBe('string');
  expect(typeof f.description).toBe('string');
});
