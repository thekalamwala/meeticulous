const mockWrites = [];
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => ({
      update: (patch) => ({ eq: async () => { mockWrites.push({ table, op: 'update', patch }); return { error: null }; } }),
      upsert: async (row) => { mockWrites.push({ table, op: 'upsert', row }); return { error: null }; },
    }),
  },
  supabase: {},
}));
jest.mock('../../services/crm/webhookEvents', () => ({ recordDeliveryEvent: jest.fn(async () => ({ ok: true, leadId: 'lead-1' })) }));
jest.mock('../../services/crm/replyClassifier', () => ({
  ...jest.requireActual('../../services/crm/replyClassifier'),
  classifyReply: jest.fn(async () => ({ intent: 'interested', confidence: 0.9, summary: 'Wants a demo' })),
}));
jest.mock('../../utils/sendEmail', () => jest.fn(async () => ({ ok: true })));

const { handleInbound, processItem } = require('../../controllers/brevoInboundController');
const { recordDeliveryEvent } = require('../../services/crm/webhookEvents');
const { classifyReply } = require('../../services/crm/replyClassifier');
const sendEmail = require('../../utils/sendEmail');

const mkRes = () => { const r = {}; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
const item = (over = {}) => ({
  From: { Address: 'Lead@Example.com', Name: 'Asha' },
  To: [{ Address: 'shubham@reply.meeticulous.in' }],
  Subject: 'Re: quick question',
  ExtractedMarkdownMessage: 'Yes, let us talk Friday.',
  ...over,
});

beforeEach(() => {
  mockWrites.length = 0;
  jest.clearAllMocks();
  process.env.BREVO_INBOUND_SECRET = 's3cret';
});

test('fails closed with no secret configured, rejects a wrong secret', async () => {
  delete process.env.BREVO_INBOUND_SECRET;
  const r1 = mkRes();
  await handleInbound({ query: { secret: 'x' }, headers: {}, body: {} }, r1);
  expect(r1.code).toBe(503);
  process.env.BREVO_INBOUND_SECRET = 's3cret';
  const r2 = mkRes();
  await handleInbound({ query: { secret: 'nope' }, headers: {}, body: { items: [item()] } }, r2);
  expect(r2.code).toBe(401);
  expect(recordDeliveryEvent).not.toHaveBeenCalled();
});

test('labels, records on the lead, stamps intent and forwards to the sender inbox', async () => {
  const res = mkRes();
  await handleInbound({ query: { secret: 's3cret' }, headers: {}, body: { items: [item()] } }, res);
  expect(res.body).toEqual({ ok: true, received: 1 });
  expect(recordDeliveryEvent).toHaveBeenCalledWith(expect.objectContaining({
    channel: 'email', event: 'email.replied', email: 'lead@example.com',
    activityMeta: expect.objectContaining({ intent: 'interested' }),
  }));
  expect(mockWrites).toContainEqual({ table: 'leads', op: 'update', patch: { last_reply_intent: 'interested' } });
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
    to: 'shubham@meeticulous.com', subject: '[interested] Re: quick question', replyTo: 'lead@example.com',
  }));
});

test('a confident soft opt-out lands on email_unsubscribes', async () => {
  classifyReply.mockResolvedValueOnce({ intent: 'unsubscribe', confidence: 0.95, summary: 'Stop emailing' });
  const out = await processItem(item({ ExtractedMarkdownMessage: 'please remove me from your list' }));
  expect(out.optedOut).toBe(true);
  expect(mockWrites).toContainEqual(expect.objectContaining({ table: 'email_unsubscribes', op: 'upsert', row: expect.objectContaining({ email: 'lead@example.com', source: 'reply_ai' }) }));
});

test('a low-confidence unsubscribe is only labelled', async () => {
  classifyReply.mockResolvedValueOnce({ intent: 'unsubscribe', confidence: 0.5, summary: '' });
  const out = await processItem(item());
  expect(out.optedOut).toBe(false);
  expect(mockWrites.find((w) => w.table === 'email_unsubscribes')).toBeUndefined();
});

test('own-domain mail and spam are dropped before any model call', async () => {
  expect((await processItem(item({ From: { Address: 'team@meeticulous.com' } }))).action).toBe('own_domain');
  expect((await processItem(item({ From: { Address: 'x@mail.meeticulous.in' } }))).action).toBe('own_domain');
  expect((await processItem(item({ Spam: { Score: 9 } }))).action).toBe('spam');
  expect(classifyReply).not.toHaveBeenCalled();
});

test('unknown capture address forwards to the team inbox', async () => {
  await processItem(item({ To: [{ Address: 'hello@reply.meeticulous.in' }] }));
  expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'team@meeticulous.com' }));
});
