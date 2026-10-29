// listEngagementService — cold-pool promotion + nurture off the B1 opens/clicks counters.
const state = { flag: true, leads: [], seqByName: {}, everEnrolled: false, activeLadder: false };
const changeStatusCalls = [];
const enrollCalls = [];
const enrollByNameCalls = [];

jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: () => Promise.resolve(state.flag) }));
jest.mock('../../services/crm/leadService', () => ({
  changeStatus: (...a) => { changeStatusCalls.push(a); return Promise.resolve(); },
}));
jest.mock('../../services/crm/sequenceService', () => ({
  enroll: (seqId, leadId, by) => { enrollCalls.push({ seqId, leadId, by }); return Promise.resolve({}); },
  enrollByName: (name, leadId, by) => { enrollByNameCalls.push({ name, leadId, by }); return Promise.resolve({}); },
  stop: () => Promise.resolve({}),
}));
jest.mock('../../config/supabase', () => {
  const build = (table) => {
    const f = {};
    const arrayResult = () => {
      if (table === 'leads') return { data: state.leads, error: null };
      if (table === 'crm_sequence_enrollments') return { data: state.activeLadder ? [{ id: 'e1' }] : [], error: null };
      return { data: [], error: null };
    };
    const b = {
      select() { return b; }, eq(c, v) { f[c] = v; return b; }, or() { return b; },
      in(c, v) { f[c] = v; return b; }, order() { return b; },
      limit() { return Promise.resolve(arrayResult()); },
      maybeSingle() {
        if (table === 'crm_sequences') return Promise.resolve({ data: state.seqByName[f.name] ? { id: state.seqByName[f.name] } : null, error: null });
        if (table === 'crm_sequence_enrollments') return Promise.resolve({ data: state.everEnrolled ? { id: 'e1' } : null, error: null });
        return Promise.resolve({ data: null, error: null });
      },
      then(res) { return Promise.resolve(arrayResult()).then(res); },
    };
    return b;
  };
  return { supabaseAdmin: { from: (t) => build(t) }, supabase: {} };
});

const svc = require('../../services/crm/listEngagementService');
const SEQS = { 'Openers nurture': 'op', 'Clickers nurture': 'cl', 'New marketing': 'nm' };
beforeEach(() => {
  state.flag = true; state.leads = []; state.seqByName = { ...SEQS };
  state.everEnrolled = false; state.activeLadder = false;
  changeStatusCalls.length = 0; enrollCalls.length = 0; enrollByNameCalls.length = 0;
});

test('flag off → nothing runs', async () => {
  state.flag = false;
  const r = await svc.run({ dryRun: false });
  expect(r.skipped).toBe(true);
  expect(changeStatusCalls).toHaveLength(0);
});

test('threshold opens≥1 & clicks≥2 promotes list→new + enrolls New marketing', async () => {
  state.leads = [{ id: 'L1', status: 'list', opens: 1, clicks: 2, do_not_contact: false }];
  const r = await svc.run({ dryRun: false });
  expect(r.promoted).toBe(1);
  expect(changeStatusCalls[0][1]).toBe('new');      // (id, status, actor, opts)
  expect(changeStatusCalls[0][2]).toBeNull();        // system move — no manual guard
  expect(enrollByNameCalls[0].name).toBe('New marketing');
});

test('dry run counts the promotion but writes nothing', async () => {
  state.leads = [{ id: 'L1', status: 'list', opens: 2, clicks: 3, do_not_contact: false }];
  const r = await svc.run({ dryRun: true });
  expect(r.promoted).toBe(1);
  expect(changeStatusCalls).toHaveLength(0);
  expect(enrollByNameCalls).toHaveLength(0);
});

test('one click (sub-threshold) enrolls Clickers nurture', async () => {
  state.leads = [{ id: 'L1', status: 'list', opens: 2, clicks: 1, do_not_contact: false }];
  const r = await svc.run({ dryRun: false });
  expect(r.enrolled).toBe(1);
  expect(enrollCalls[0].seqId).toBe('cl');
  expect(changeStatusCalls).toHaveLength(0); // not promoted
});

test('opens only enrolls Openers nurture', async () => {
  state.leads = [{ id: 'L1', status: 'list', opens: 3, clicks: 0, do_not_contact: false }];
  await svc.run({ dryRun: false });
  expect(enrollCalls[0].seqId).toBe('op');
});

test('a lead already enrolled in a ladder is not re-enrolled (once ever)', async () => {
  state.everEnrolled = true;
  state.leads = [{ id: 'L1', status: 'list', opens: 1, clicks: 0, do_not_contact: false }];
  const r = await svc.run({ dryRun: false });
  expect(r.enrolled).toBe(0);
  expect(enrollCalls).toHaveLength(0);
});

test('do_not_contact lead is skipped', async () => {
  state.leads = [{ id: 'L1', status: 'list', opens: 1, clicks: 5, do_not_contact: true }];
  const r = await svc.run({ dryRun: false });
  expect(r.promoted).toBe(0);
  expect(changeStatusCalls).toHaveLength(0);
});
