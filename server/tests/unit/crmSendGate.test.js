// CRM send gate — the safety checkpoint every outbound send passes.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/crm/touchGovernor', () => ({ canTouch: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const featureFlags = require('../../services/featureFlags');
const governor = require('../../services/crm/touchGovernor');
const { canSend, validEmail } = require('../../services/crm/sendGate');

// from(table) → chain resolving maybeSingle() to the row registered for that table.
const rows = {};
const chain = (table) => ({
  select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: rows[table] ?? null }) }) }),
});

beforeEach(() => {
  jest.clearAllMocks();
  for (const k of Object.keys(rows)) delete rows[k];
  supabaseAdmin.from.mockImplementation(chain);
  featureFlags.isFeatureEnabled.mockResolvedValue(true); // switch ON by default
});

test('kill-switch OFF blocks every send (fail-closed master gate)', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(false);
  const r = await canSend({ email: 'a@b.com' }, 'email');
  expect(r).toEqual({ ok: false, reason: 'sends_disabled' });
});

test('do_not_contact flag blocks send', async () => {
  const r = await canSend({ email: 'a@b.com', do_not_contact: true }, 'email');
  expect(r.reason).toBe('do_not_contact');
});

test('status do_not_contact blocks send', async () => {
  const r = await canSend({ phone: '9876543210', status: 'do_not_contact' }, 'whatsapp');
  expect(r.reason).toBe('do_not_contact');
});

test('invalid phone blocks WhatsApp', async () => {
  const r = await canSend({ phone: '123' }, 'whatsapp');
  expect(r.reason).toBe('invalid_phone');
});

test('invalid email blocks email', async () => {
  const r = await canSend({ email: 'not-an-email' }, 'email');
  expect(r.reason).toBe('invalid_email');
});

test('unsubscribed email blocks send', async () => {
  rows.email_unsubscribes = { email: 'a@b.com' };
  const r = await canSend({ email: 'a@b.com' }, 'email');
  expect(r.reason).toBe('email_unsubscribed');
});

test('placeholder phone-only email is skipped (never emailed → no bounce)', async () => {
  const r = await canSend({ email: 'p919876543210@users.bookasloth.app' }, 'email');
  expect(r).toEqual({ ok: false, reason: 'placeholder_email' });
});

test('suppressed contact blocks that channel', async () => {
  rows.contacts = { email_suppressed: true, whatsapp_suppressed: false };
  const r = await canSend({ email: 'a@b.com' }, 'email');
  expect(r.reason).toBe('email_suppressed');
});

test('clean email lead passes', async () => {
  const r = await canSend({ email: 'a@b.com' }, 'email');
  expect(r).toEqual({ ok: true });
});

test('clean WhatsApp lead passes', async () => {
  const r = await canSend({ phone: '9876543210' }, 'whatsapp');
  expect(r).toEqual({ ok: true });
});

test('validEmail helper', () => {
  expect(validEmail('x@y.com')).toBe(true);
  expect(validEmail('x@y')).toBe(false);
  expect(validEmail('')).toBe(false);
});

// ── Coordinated-conversation throttle (automated sends only) → touch governor ──
// The cap now delegates to touchGovernor.canTouch (the ONE master cap across every
// automated touch); sendGate keeps only quiet-hours. These assert the delegation +
// the exemptions, not the count mechanics (those are touchGovernorDb's tests).
const IST_NOON = new Date('2025-01-15T06:30:00Z');  // 12:00 IST — inside window
const IST_NIGHT = new Date('2025-01-15T17:00:00Z'); // 22:30 IST — outside window
afterEach(() => jest.useRealTimers());

test('automated send is frequency-capped when the governor caps the subject', async () => {
  jest.useFakeTimers().setSystemTime(IST_NOON);
  governor.canTouch.mockResolvedValue({ ok: false, reason: 'frequency_capped' });
  const r = await canSend({ id: 'L1', phone: '9876543210' }, 'whatsapp', { automated: true });
  expect(r).toEqual({ ok: false, reason: 'frequency_capped', defer: true });
  expect(governor.canTouch).toHaveBeenCalledWith({ type: 'lead', id: 'L1' });
});

test('automated send passes when the governor allows it', async () => {
  jest.useFakeTimers().setSystemTime(IST_NOON);
  governor.canTouch.mockResolvedValue({ ok: true });
  const r = await canSend({ id: 'L1', phone: '9876543210' }, 'whatsapp', { automated: true });
  expect(r).toEqual({ ok: true });
});

test('automated send is deferred outside quiet hours (before consulting the governor)', async () => {
  jest.useFakeTimers().setSystemTime(IST_NIGHT);
  governor.canTouch.mockResolvedValue({ ok: true });
  const r = await canSend({ id: 'L1', phone: '9876543210' }, 'whatsapp', { automated: true });
  expect(r).toEqual({ ok: false, reason: 'quiet_hours', defer: true });
  expect(governor.canTouch).not.toHaveBeenCalled();
});

test('human composer send is EXEMPT from cap + quiet hours (governor not consulted)', async () => {
  jest.useFakeTimers().setSystemTime(IST_NIGHT);
  governor.canTouch.mockResolvedValue({ ok: false, reason: 'frequency_capped' });
  const r = await canSend({ id: 'L1', phone: '9876543210' }, 'whatsapp'); // automated omitted → false
  expect(r).toEqual({ ok: true });
  expect(governor.canTouch).not.toHaveBeenCalled();
});

test('governor failure fails OPEN (send proceeds)', async () => {
  jest.useFakeTimers().setSystemTime(IST_NOON);
  governor.canTouch.mockRejectedValue(new Error('db down'));
  const r = await canSend({ id: 'L1', phone: '9876543210' }, 'whatsapp', { automated: true });
  expect(r).toEqual({ ok: true });
});
