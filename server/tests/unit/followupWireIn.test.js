// communicationEngine.js requires config/supabase.js at module load, which
// throws when SUPABASE_SERVICE_ROLE_KEY isn't set in the test environment.
// Mock it the same way tests/unit/communicationEngine.test.js does — this
// test only needs the pure isMarketing() lookup, not a live DB.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const templates = require('../../config/emailTemplates');
const { REGISTRY } = require('../../config/featureRegistry');
const commEngine = require('../../services/email/communicationEngine');

test('REBOOK_NUDGE_CUSTOMER email template exists with a rebook CTA', () => {
  const list = Array.isArray(templates) ? templates : (templates.EMAIL_TEMPLATES || templates.templates);
  const t = list.find((x) => x.event_key === 'REBOOK_NUDGE_CUSTOMER');
  expect(t).toBeTruthy();
  expect(t.cta_url).toBe('{{profile_url}}');
});

test('rebook_nudge feature flag is registered', () => {
  expect(REGISTRY.some((f) => f.key === 'rebook_nudge')).toBe(true);
});

test('REBOOK_NUDGE_CUSTOMER is a marketing event (honors unsubscribe)', () => {
  expect(commEngine.isMarketing('REBOOK_NUDGE_CUSTOMER')).toBe(true);
});
