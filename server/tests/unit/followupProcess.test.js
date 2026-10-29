jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn() }));
jest.mock('../../services/planService', () => ({ resolveVendorPlan: jest.fn(() => 'professional'), getLimit: jest.fn(async () => 2) }));
jest.mock('../../services/notificationEngine', () => ({ send: jest.fn(async () => ({ whatsapp: {}, email: { success: true } })) }));
jest.mock('../../services/email/communicationEngine', () => ({ isUnsubscribed: jest.fn(async () => false) }));

const { supabaseAdmin } = require('../../config/supabase');
const featureFlags = require('../../services/featureFlags');
const planService = require('../../services/planService');
const NotificationEngine = require('../../services/notificationEngine');
const commEngine = require('../../services/email/communicationEngine');
const { processFollowups } = require('../../services/followups/followupService');

// Chainable query builder recording the last update() payload into `sink`.
const q = (result, sink) => {
  const b = {
    select: () => b, eq: () => b, lte: () => b, neq: () => b, gt: () => b, limit: () => b, order: () => b,
    maybeSingle: () => Promise.resolve(result), single: () => Promise.resolve(result),
    then: (res, rej) => Promise.resolve(result).then(res, rej),
    update: (vals) => { if (sink) sink.push(vals); return b; },
  };
  return b;
};

const pendingRow = (over = {}) => ({
  id: 'sf1', source_type: 'booking', source_id: 'b1', host_id: 'h1', step: 1,
  flow_key: 'rebook', event_key: 'REBOOK_NUDGE_CUSTOMER', attempts: 0,
  payload: { guest_name: 'Ada', guest_email: 'ada@x.com', guest_phone: '+91', guest_id: 'g1', service_title: 'Tarot', host_name: 'Mystic', host_username: 'mystic', host_id: 'h1' },
  ...over,
});

beforeEach(() => jest.clearAllMocks());

test('flag off: does not fire, leaves rows pending', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(false);
  const r = await processFollowups();
  expect(r).toEqual({ sent: 0, skipped: 0, failed: 0 });
  expect(supabaseAdmin.from).not.toHaveBeenCalled();
});

test('happy path: eligible row sends and is marked sent', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  const updates = [];
  supabaseAdmin.from
    .mockReturnValueOnce(q({ data: [pendingRow()], error: null }))                                   // select pending
    .mockReturnValueOnce(q({ data: { plan: 'professional', plan_expires_at: null }, error: null }))  // host plan (E2)
    .mockReturnValueOnce(q({ data: { status: 'completed', payment_status: 'paid', completed_at: '2026-07-01T00:00:00Z' }, error: null })) // booking (E3)
    .mockReturnValueOnce(q({ data: [], error: null }))                                                // rebooked? (E4) none
    .mockReturnValueOnce(q({ data: null, error: null }, updates));                                    // update -> sent
  const r = await processFollowups();
  expect(NotificationEngine.send).toHaveBeenCalledTimes(1);
  expect(NotificationEngine.send.mock.calls[0][0].event).toBe('REBOOK_NUDGE_CUSTOMER');
  expect(NotificationEngine.send.mock.calls[0][0].data.emailData.profile_url).toContain('/mystic');
  // WhatsApp: profile link must be a body param ({{3}}) — AiSensy has no dynamic CTA button.
  expect(NotificationEngine.send.mock.calls[0][0].data.templateParams[2]).toContain('/mystic');
  expect(r.sent).toBe(1);
  expect(updates[0].status).toBe('sent');
});

test('already rebooked: skips and cancels the sibling step', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  const updates = [];
  supabaseAdmin.from
    .mockReturnValueOnce(q({ data: [pendingRow()], error: null }))                                   // pending
    .mockReturnValueOnce(q({ data: { plan: 'professional', plan_expires_at: null }, error: null }))  // plan
    .mockReturnValueOnce(q({ data: { status: 'completed', payment_status: 'paid', completed_at: '2026-07-01T00:00:00Z' }, error: null })) // booking
    .mockReturnValueOnce(q({ data: [{ id: 'b2' }], error: null }))                                    // rebooked? YES
    .mockReturnValueOnce(q({ data: null, error: null }, updates))                                     // update -> skipped
    .mockReturnValueOnce(q({ data: null, error: null }, updates));                                    // cancel siblings
  const r = await processFollowups();
  expect(NotificationEngine.send).not.toHaveBeenCalled();
  expect(r.skipped).toBe(1);
  expect(updates.some((u) => u.status === 'skipped' && u.skip_reason === 'already_rebooked')).toBe(true);
  expect(updates.some((u) => u.status === 'cancelled')).toBe(true);
});

test('source invalid (cancelled/refunded): skips', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  const updates = [];
  supabaseAdmin.from
    .mockReturnValueOnce(q({ data: [pendingRow()], error: null }))
    .mockReturnValueOnce(q({ data: { plan: 'professional', plan_expires_at: null }, error: null }))
    .mockReturnValueOnce(q({ data: { status: 'cancelled', payment_status: 'refunded', completed_at: null }, error: null }))
    .mockReturnValueOnce(q({ data: null, error: null }, updates));
  const r = await processFollowups();
  expect(NotificationEngine.send).not.toHaveBeenCalled();
  expect(updates[0].skip_reason).toBe('source_invalid');
});

test('sanitises CRLF from host/guest names before WhatsApp params (injection)', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  const updates = [];
  const base = pendingRow().payload;
  supabaseAdmin.from
    .mockReturnValueOnce(q({ data: [pendingRow({ payload: { ...base, guest_name: 'Ada\r\nInjected', host_name: 'Mystic\r\nHost' } })], error: null }))
    .mockReturnValueOnce(q({ data: { plan: 'professional', plan_expires_at: null }, error: null }))
    .mockReturnValueOnce(q({ data: { status: 'completed', payment_status: 'paid', completed_at: '2026-07-01T00:00:00Z' }, error: null }))
    .mockReturnValueOnce(q({ data: [], error: null }))
    .mockReturnValueOnce(q({ data: null, error: null }, updates));
  await processFollowups();
  const params = NotificationEngine.send.mock.calls[0][0].data.templateParams;
  expect(params[0]).toBe('Ada Injected');
  expect(params[1]).toBe('Mystic Host');
  expect(params[0]).not.toMatch(/[\r\n]/);
  expect(params[1]).not.toMatch(/[\r\n]/);
});

test('send failure: increments attempts, stays pending', async () => {
  featureFlags.isFeatureEnabled.mockResolvedValue(true);
  NotificationEngine.send.mockRejectedValueOnce(new Error('smtp down'));
  const updates = [];
  supabaseAdmin.from
    .mockReturnValueOnce(q({ data: [pendingRow({ attempts: 0 })], error: null }))
    .mockReturnValueOnce(q({ data: { plan: 'professional', plan_expires_at: null }, error: null }))
    .mockReturnValueOnce(q({ data: { status: 'completed', payment_status: 'paid', completed_at: '2026-07-01T00:00:00Z' }, error: null }))
    .mockReturnValueOnce(q({ data: [], error: null }))
    .mockReturnValueOnce(q({ data: null, error: null }, updates));
  const r = await processFollowups();
  expect(r.failed).toBe(1);
  expect(updates[0]).toMatchObject({ attempts: 1, status: 'pending' });
});
