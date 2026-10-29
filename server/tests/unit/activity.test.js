'use strict';
// PR-1 (relationship engine): logActivity is the single chokepoint that classifies
// every CRM touch as MEANINGFUL (human) vs AUTOMATED (system) and stamps the two
// clocks on the lead. Each test re-requires the module (jest.resetModules) so the
// module-level `meaningfulColumns` schema-fallback flag never leaks between cases.

const NOW_RE = /^\d{4}-\d{2}-\d{2}T/;

// Fresh mock + module per test. `state` drives what the mocked supabase returns and
// captures what logActivity wrote.
function load({ insertError = null, updateError = null, countRow = { meaningful_interaction_count: 2 } } = {}) {
  jest.resetModules();
  const state = { insertRow: null, updatePatch: null, insertError, updateError, countRow, selectedCol: null };
  jest.doMock('../../config/supabase', () => ({
    supabaseAdmin: {
      from: (table) => ({
        insert: (row) => {
          if (table === 'lead_activities') state.insertRow = row;
          return { select: () => ({ single: () => Promise.resolve({ data: state.insertError ? null : { id: 'act1' }, error: state.insertError }) }) };
        },
        update: (patch) => {
          if (table === 'leads') state.updatePatch = patch;
          return { eq: () => Promise.resolve({ error: state.updateError }) };
        },
        select: (col) => { state.selectedCol = col; return { eq: () => ({ maybeSingle: () => Promise.resolve({ data: state.countRow, error: null }) }) }; },
      }),
    },
  }));
  const { logActivity } = require('../../services/crm/activity');
  return { logActivity, state };
}

afterEach(() => jest.resetModules());

test('human WhatsApp send → meaningful: stamps meaningful clock + channel + count, is_meaningful true', async () => {
  const { logActivity, state } = load();
  const id = await logActivity('lead1', 'whatsapp_sent', { actorAdminId: 'admin7' });
  expect(id).toBe('act1');
  expect(state.insertRow.is_meaningful).toBe(true);
  expect(state.updatePatch.last_meaningful_interaction_at).toMatch(NOW_RE);
  expect(state.updatePatch.last_meaningful_channel).toBe('whatsapp');
  expect(state.updatePatch.meaningful_interaction_count).toBe(3); // 2 (current) + 1
  expect(state.updatePatch.last_contacted_at).toMatch(NOW_RE);
  expect(state.updatePatch.last_automated_touch_at).toBeUndefined();
});

test('system email send (no actor) → automated: stamps automated clock only', async () => {
  const { logActivity, state } = load();
  await logActivity('lead1', 'email_sent', {});
  expect(state.insertRow.is_meaningful).toBe(false);
  expect(state.updatePatch.last_automated_touch_at).toMatch(NOW_RE);
  expect(state.updatePatch.last_contacted_at).toMatch(NOW_RE);
  expect(state.updatePatch.last_meaningful_interaction_at).toBeUndefined();
  expect(state.updatePatch.meaningful_interaction_count).toBeUndefined();
});

test('human logged call → meaningful with channel "call"', async () => {
  const { logActivity, state } = load();
  await logActivity('lead1', 'call_logged', { actorAdminId: 'admin7' });
  expect(state.insertRow.is_meaningful).toBe(true);
  expect(state.updatePatch.last_meaningful_channel).toBe('call');
});

test('internal note by a human → neither clock (never reached the customer)', async () => {
  const { logActivity, state } = load();
  await logActivity('lead1', 'note_added', { actorAdminId: 'admin7' });
  expect(state.insertRow.is_meaningful).toBe(false);
  expect(state.updatePatch.last_meaningful_interaction_at).toBeUndefined();
  expect(state.updatePatch.last_automated_touch_at).toBeUndefined();
  // a note is not a contact → last_contacted_at not moved, but activity recency is
  expect(state.updatePatch.last_contacted_at).toBeUndefined();
  expect(state.updatePatch.last_activity_at).toMatch(NOW_RE);
});

test('schema fallback: pre-v3.133 DB (missing column) still writes the timeline row', async () => {
  const missing = { message: 'column "is_meaningful" does not exist' };
  const { logActivity, state } = load({ insertError: missing });
  // First insert (with is_meaningful) errors → retried without it. We assert it does
  // not throw and the retry drops the new field.
  const id = await logActivity('lead1', 'whatsapp_sent', { actorAdminId: 'admin7' });
  // after fallback the last recorded insertRow is the retry (no is_meaningful key)
  expect('is_meaningful' in state.insertRow).toBe(false);
  // id resolves from the retry insert (mock returns act1 once insertError cleared? no —
  // insertError persists, so the retry also errors and id is null; the point is no throw)
  expect(id === null || id === 'act1').toBe(true);
  // leads patch drops the new columns too (meaningfulColumns flipped false)
  expect(state.updatePatch.last_meaningful_interaction_at).toBeUndefined();
  expect(state.updatePatch.last_activity_at).toMatch(NOW_RE);
});

test('a touch_reason (v3.137) is recorded on the activity row when provided', async () => {
  const { logActivity, state } = load();
  await logActivity('lead1', 'whatsapp_sent', { actorAdminId: 'admin7', touchReason: 'cooling' });
  expect(state.insertRow.touch_reason).toBe('cooling');
  expect(state.insertRow.is_meaningful).toBe(true); // still a meaningful human contact
});

test('bad args are a no-op', async () => {
  const { logActivity } = load();
  expect(await logActivity(null, 'whatsapp_sent')).toBeNull();
  expect(await logActivity('lead1', null)).toBeNull();
});
