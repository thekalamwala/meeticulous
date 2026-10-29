// secondTouchService — governed warm follow-up: flag/dry-run gates + candidate filters.
const state = { flag: true, acts: [], lead: null, prior: null };
const enqueueCalls = [];

jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: () => Promise.resolve(state.flag) }));
jest.mock('../../services/crm/messageService', () => ({
  enqueue: (a) => { enqueueCalls.push(a); return Promise.resolve({ id: 'm1' }); },
}));
jest.mock('../../config/supabase', () => {
  const build = (table) => {
    const result = () => {
      if (table === 'lead_activities') return { data: state.acts, error: null };
      if (table === 'leads') return { data: state.lead, error: null };
      if (table === 'crm_messages') return { data: state.prior, error: null };
      return { data: null, error: null };
    };
    const b = {
      select() { return b; }, eq() { return b; }, gte() { return b; }, lte() { return b; },
      order() { return b; }, limit() { return b; },
      maybeSingle() { return Promise.resolve(result()); },
      then(r) { return Promise.resolve(result()).then(r); }, // makes the acts query awaitable
    };
    return b;
  };
  return { supabaseAdmin: { from: (t) => build(t) }, supabase: {} };
});

const svc = require('../../services/crm/secondTouchService');
const clickAt = new Date(Date.now() - 48 * 3600e3).toISOString(); // 48h ago → inside 24–96h window
beforeEach(() => {
  state.flag = true;
  state.acts = [{ lead_id: 'L1', occurred_at: clickAt }];
  state.lead = { id: 'L1', email: 'a@b.com', status: 'list', converted_at: null, last_reply_at: null, do_not_contact: false };
  state.prior = null;
  enqueueCalls.length = 0;
});

test('flag off → nothing runs', async () => {
  state.flag = false;
  const r = await svc.run({ dryRun: false });
  expect(r.skipped).toBe(true);
  expect(enqueueCalls).toHaveLength(0);
});

test('dry run counts a warm clicker but enqueues nothing', async () => {
  const r = await svc.run({ dryRun: true });
  expect(r.enqueued).toBe(1);
  expect(enqueueCalls).toHaveLength(0);
});

test('live run enqueues one governed second-touch', async () => {
  const r = await svc.run({ dryRun: false });
  expect(r.enqueued).toBe(1);
  expect(enqueueCalls).toHaveLength(1);
  expect(enqueueCalls[0].createdBy).toBe('auto:second-touch');
  expect(enqueueCalls[0].channel).toBe('email');
});

test('converted (paying) lead is skipped', async () => {
  state.lead.status = 'paid';
  state.lead.converted_at = '2026-01-01T00:00:00Z';
  const r = await svc.run({ dryRun: false });
  expect(r.enqueued).toBe(0);
  expect(enqueueCalls).toHaveLength(0);
});

test('a reply after the click is skipped (human conversation underway)', async () => {
  state.lead.last_reply_at = new Date().toISOString(); // after the 48h-ago click
  const r = await svc.run({ dryRun: false });
  expect(r.enqueued).toBe(0);
});

test('dedup — a prior auto second-touch in window is skipped', async () => {
  state.prior = { id: 'prev' };
  const r = await svc.run({ dryRun: false });
  expect(r.enqueued).toBe(0);
  expect(enqueueCalls).toHaveLength(0);
});
