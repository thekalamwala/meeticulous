// recordEmailLogDelivery: Resend event → email_logs status, matched by message id.
const state = { row: null, updates: [], suppressed: [] };
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => ({
      select() { return this; },
      eq(_c, v) { this._v = v; return this; },
      maybeSingle() { return Promise.resolve({ data: state.row, error: null }); },
      update(patch) {
        // email_logs updates use .eq(); the bounce-suppress helper uses .ilike().
        if (table === 'email_logs') state.updates.push(patch);
        return {
          eq: () => Promise.resolve({ error: null }),
          ilike: (_c, v) => { state.suppressed.push({ table, patch, email: v }); return Promise.resolve({ error: null }); },
        };
      },
    }),
  },
  supabase: {},
}));

const engine = require('../../services/email/communicationEngine');
beforeEach(() => { state.row = null; state.updates = []; state.suppressed = []; });

test('delivered event stamps status=delivered + delivered_at', async () => {
  state.row = { id: 'log1', status: 'sent' };
  const r = await engine.recordEmailLogDelivery({ providerMessageId: 'rs_1', event: 'email.delivered' });
  expect(r.matched).toBe(true);
  expect(state.updates[0].status).toBe('delivered');
  expect(state.updates[0].delivered_at).toBeTruthy();
});

test('bounced event stamps status=bounced + bounced_at', async () => {
  state.row = { id: 'log2', status: 'sent' };
  await engine.recordEmailLogDelivery({ providerMessageId: 'rs_2', event: 'email.complained' });
  expect(state.updates[0].status).toBe('bounced');
  expect(state.updates[0].bounced_at).toBeTruthy();
});

test('a campaign bounce suppresses the contact + marks the lead (the leak fix)', async () => {
  state.row = { id: 'log6', status: 'sent', recipient: 'Dead@Example.com' };
  await engine.recordEmailLogDelivery({ providerMessageId: 'rs_6', event: 'email.bounced' });
  expect(state.updates[0].status).toBe('bounced'); // log still stamped
  const contact = state.suppressed.find((s) => s.table === 'contacts');
  const lead = state.suppressed.find((s) => s.table === 'leads');
  expect(contact).toBeTruthy();
  expect(contact.patch.email_suppressed).toBe(true);
  expect(contact.email).toBe('Dead@Example.com'); // ilike = case-insensitive match
  expect(lead.patch.email_status).toBe('bounced');
});

test('a bounce with no recipient on the row skips suppression (no crash)', async () => {
  state.row = { id: 'log7', status: 'sent' }; // no recipient
  await engine.recordEmailLogDelivery({ providerMessageId: 'rs_7', event: 'email.bounced' });
  expect(state.suppressed).toHaveLength(0);
});

test('a bounced row is terminal — a later delivered does not overwrite it', async () => {
  state.row = { id: 'log3', status: 'bounced' };
  await engine.recordEmailLogDelivery({ providerMessageId: 'rs_3', event: 'email.delivered' });
  expect(state.updates).toHaveLength(0);
});

test('unmatched id or unknown event no-ops', async () => {
  state.row = null; // no match
  expect((await engine.recordEmailLogDelivery({ providerMessageId: 'x', event: 'email.delivered' })).matched).toBe(false);
  state.row = { id: 'log4', status: 'sent' };
  await engine.recordEmailLogDelivery({ providerMessageId: 'rs_4', event: 'email.unknown' }); // not mapped
  expect(state.updates).toHaveLength(0);
});

test('opened event stamps opened_at only — status untouched, first-touch wins', async () => {
  state.row = { id: 'log5', status: 'delivered', opened_at: null };
  const r = await engine.recordEmailLogDelivery({ providerMessageId: 'rs_5', event: 'email.opened' });
  expect(r.matched).toBe(true);
  expect(state.updates[0].opened_at).toBeTruthy();
  expect(state.updates[0].status).toBeUndefined(); // engagement never changes status

  // Second open on an already-stamped row is a no-op (first-touch wins).
  state.updates = [];
  state.row = { id: 'log5', status: 'delivered', opened_at: '2026-09-12T00:00:00Z' };
  await engine.recordEmailLogDelivery({ providerMessageId: 'rs_5', event: 'email.opened' });
  expect(state.updates).toHaveLength(0);
});

test('clicked event stamps clicked_at even on a delivered row', async () => {
  state.row = { id: 'log6', status: 'delivered', clicked_at: null };
  await engine.recordEmailLogDelivery({ providerMessageId: 'rs_6', event: 'email.clicked' });
  expect(state.updates[0].clicked_at).toBeTruthy();
  expect(state.updates[0].status).toBeUndefined();
});
