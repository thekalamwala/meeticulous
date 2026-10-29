const { prioritize } = require('../../services/seo/prioritize');
test('P0 outranks P3', () => {
  const a = prioritize({ severity: 'P0', confidence: 1, evidence: {} }, {});
  const b = prioritize({ severity: 'P3', confidence: 1, evidence: {} }, {});
  expect(a.priorityScore).toBeGreaterThan(b.priorityScore);
});
test('scope from evidence.count raises the score', () => {
  const one = prioritize({ severity: 'P2', confidence: 1, evidence: {} }, {});
  const many = prioritize({ severity: 'P2', confidence: 1, evidence: { count: 10 } }, {});
  expect(many.priorityScore).toBeGreaterThan(one.priorityScore);
});
