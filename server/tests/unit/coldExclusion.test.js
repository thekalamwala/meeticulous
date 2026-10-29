'use strict';
const rules = require('../../services/crm/lifecycleRules');

test('cold status is in CLOSED so desk/report/followup queries drop it', () => {
  expect(rules.CLOSED).toContain('list');
  expect(rules.CLOSED_SQL).toMatch(/\blist\b/);
});
