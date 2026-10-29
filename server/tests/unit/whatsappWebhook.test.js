const updated = {};
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: () => ({
    select() { return this; }, eq(c, v) { this._c = c; this._v = v; return this; },
    single() { return Promise.resolve({ data: { settings_json: { webhook_secret: 's3cret' } }, error: null }); },
    update(ch) { return { eq: (c, v) => { updated.col = c; updated.val = v; updated.changes = ch; return Promise.resolve({ error: null }); } }; },
  }) }, supabase: {},
}));
const { handleWebhook } = require('../../controllers/whatsappWebhookController');
const mkRes = () => { const r = {}; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; return r; };
beforeEach(() => { Object.keys(updated).forEach((k) => delete updated[k]); delete process.env.AISENSY_WEBHOOK_SECRET; });

test('rejects a bad secret', async () => {
  const res = mkRes();
  await handleWebhook({ query: { secret: 'wrong' }, headers: {}, body: {} }, res);
  expect(res.code).toBe(401);
});

test('STOP message suppresses the contact for WhatsApp', async () => {
  const res = mkRes();
  await handleWebhook({ query: { secret: 's3cret' }, headers: {}, body: { destination: '919991112222', text: 'STOP' } }, res);
  expect(res.body.action).toBe('opted_out');
  expect(updated.changes.whatsapp_suppressed).toBe(true);
  expect(updated.changes.whatsapp_opt_in).toBe(false);
  expect(updated.col).toBe('phone');
  expect(updated.val).toBe('919991112222');
});

test('a delivery status event is recorded, not suppressed', async () => {
  const res = mkRes();
  await handleWebhook({ query: { secret: 's3cret' }, headers: {}, body: { destination: '919991112222', status: 'delivered' } }, res);
  // Since #705 the webhook maps delivery statuses to a CRM funnel event and
  // echoes it back as the action (was 'status_ack' before delivery tracking).
  expect(res.body.action).toBe('delivered');
  expect(updated.changes).toBeUndefined(); // never touches the contact row
});
