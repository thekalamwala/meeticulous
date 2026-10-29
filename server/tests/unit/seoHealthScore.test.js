const { score } = require('../../services/seo/healthScore');

test('a clean crawl scores 100 across the board', () => {
  const s = score([]);
  expect(s.overall).toBe(100);
  expect(s.technical).toBe(100);
});

test('P0 technical issues drag the technical + overall score down', () => {
  const s = score([{ category: 'technical', severity: 'P0' }, { category: 'technical', severity: 'P0' }]);
  expect(s.technical).toBeLessThan(100);
  expect(s.overall).toBeLessThan(100);
  expect(s.breakdown.technical.length).toBe(2);
});
