// CRM pure logic — templating + sequence stop conditions (no DB).
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));

const { renderVars, renderParams } = require('../../services/crm/messageService');
const { stopReason } = require('../../services/crm/sequenceService');

const lead = { name: 'Rahul Verma', business_name: 'FitPune', profession: 'Fitness Trainer', city: 'Pune', status: 'contacted' };

test('renderVars fills known tokens and drops unknown', () => {
  const out = renderVars('Hi {{first_name}} from {{business_name}} ({{profession}}) — {{nope}}', lead);
  expect(out).toBe('Hi Rahul from FitPune (Fitness Trainer) — ');
});

test('renderVars first_name falls back to "there" when no name', () => {
  expect(renderVars('Hi {{first_name}}', {})).toBe('Hi there');
});

test('renderParams renders each WhatsApp param', () => {
  expect(renderParams(['{{first_name}}', '{{city}}'], lead)).toEqual(['Rahul', 'Pune']);
});

test('stopReason: do_not_contact wins', () => {
  expect(stopReason({ do_not_contact: true, status: 'new' }, {})).toBe('dnc');
  expect(stopReason({ status: 'do_not_contact' }, {})).toBe('dnc');
});

test('stopReason: converted when stop_on_convert', () => {
  expect(stopReason({ status: 'paid' }, { stop_on_convert: true })).toBe('converted');
  expect(stopReason({ status: 'paid' }, { stop_on_convert: false })).toBeNull();
});

test('stopReason: replied when stop_on_reply', () => {
  expect(stopReason({ status: 'replied' }, { stop_on_reply: true })).toBe('replied');
});

test('stopReason: active lead keeps going', () => {
  expect(stopReason({ status: 'contacted' }, { stop_on_reply: true, stop_on_convert: true })).toBeNull();
});

test('stopReason: missing lead stops', () => {
  expect(stopReason(null, {})).toBe('lead_missing');
});
