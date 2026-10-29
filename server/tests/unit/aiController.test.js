jest.mock('../../services/ai/generateListing', () => ({ generateListing: jest.fn() }));
jest.mock('../../services/planService', () => ({ getLimit: jest.fn() }));
jest.mock('../../services/ai/anthropicClient', () => ({ isConfigured: jest.fn(() => true) }));

// Chainable supabase mock: from().select().eq().gte() → { count }, and from().insert() ok.
// Distinguishes the ownership-check select (has an .eq('session_id', ...) in
// its chain) from the plain quota-count select so tests can control each
// independently. missingTableErr, when set, is what BOTH selects resolve to
// (Bug 2: a missing table must degrade, not throw, on either read path).
// countErr simulates an unrelated DB failure (e.g. a dropped connection) on
// the quota-count select specifically — a shape _isMissingSchema must NOT
// swallow, so it should propagate up to the handler's outer catch.
// sessionIdQueryCount counts how many times an .eq('session_id', ...) was
// ever issued, so tests can assert the ownership DB read was skipped
// entirely for a malformed session_id (Bug 1: no 22P02 round-trip).
// regenerateCount backs the NEW per-session regenerate-cap query
// (.eq('session_id', ...).eq('kind', 'regenerate')) — distinct from
// ownedSessionIds, which backs the ownership check (.eq('kind', 'generate')).
const state = { count: 0, insertErr: null, ownedSessionIds: [], missingTableErr: null, insertedRows: [], countErr: null, sessionIdQueryCount: 0, regenerateCount: 0 };
jest.mock('../../config/supabase', () => {
  const q = () => {
    const calls = { eq: [] };
    const o = {};
    ['select', 'gte'].forEach((m) => { o[m] = jest.fn(() => o); });
    o.eq = jest.fn((field, value) => {
      calls.eq.push([field, value]);
      if (field === 'session_id') state.sessionIdQueryCount += 1;
      return o;
    });
    o.then = (res) => {
      if (state.missingTableErr) return res({ count: null, error: { message: state.missingTableErr } });
      const sessionEq = calls.eq.find(([field]) => field === 'session_id');
      const kindEq = calls.eq.find(([field]) => field === 'kind');
      // Regenerate-cap count query: session_id + kind='regenerate'. Distinct
      // from the ownership check below, which is session_id + kind='generate'.
      if (sessionEq && kindEq && kindEq[1] === 'regenerate') {
        return res({ count: state.regenerateCount, error: null });
      }
      if (sessionEq) return res({ count: state.ownedSessionIds.includes(sessionEq[1]) ? 1 : 0, error: null });
      if (state.countErr) return res({ count: null, error: { message: state.countErr } });
      return res({ count: state.count, error: null });
    };
    o.insert = jest.fn((row) => { state.insertedRows.push(row); return Promise.resolve({ error: state.insertErr }); });
    return o;
  };
  return { supabaseAdmin: { from: jest.fn(q) } };
});

const { generateListing } = require('../../services/ai/generateListing');
const planService = require('../../services/planService');
const anthropicClient = require('../../services/ai/anthropicClient');
const { generateAiListing } = require('../../controllers/aiController');

const mkRes = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
const okFields = { title: 'T', short_description: 'S', long_description: 'L', included_items: [], excluded_items: [], faqs: [] };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Mirrors aiController.js's MAX_REGENERATIONS_PER_SESSION (not exported —
// no other consumer needs it, so the test pins the literal instead).
const MAX_REGENERATIONS_PER_SESSION = 8;

beforeEach(() => {
  state.count = 0; state.insertErr = null; state.ownedSessionIds = [];
  state.missingTableErr = null; state.insertedRows = [];
  state.countErr = null; state.sessionIdQueryCount = 0; state.regenerateCount = 0;
  generateListing.mockReset(); planService.getLimit.mockReset();
  anthropicClient.isConfigured.mockReset(); anthropicClient.isConfigured.mockReturnValue(true);
});

test('503 when AI is not configured (dormancy short-circuit, before any DB/quota work)', async () => {
  anthropicClient.isConfigured.mockReturnValue(false);
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'starter', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json.mock.calls[0][0].ai_unavailable).toBe(true);
  expect(planService.getLimit).not.toHaveBeenCalled();
  expect(generateListing).not.toHaveBeenCalled();
});

test('503 when configured but generateListing throws AI_UNAVAILABLE (downstream SDK/key failure)', async () => {
  planService.getLimit.mockResolvedValue(1);
  generateListing.mockRejectedValue(new Error('AI_UNAVAILABLE'));
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'starter', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json.mock.calls[0][0].ai_unavailable).toBe(true);
});

test('429 when generate quota exhausted', async () => {
  planService.getLimit.mockResolvedValue(1);
  state.count = 1; // already used the 1 allowed
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'starter', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(429);
  const payload = res.json.mock.calls[0][0];
  expect(payload.current_plan).toBe('starter');
  expect(payload.limit).toBe(1);
  expect(payload.unlock_at).toBeTruthy();
});

test('200 generate returns fields + new session_id, consumes quota', async () => {
  planService.getLimit.mockResolvedValue(2);
  generateListing.mockResolvedValue({ fields: okFields, model: 'claude-haiku-4-5-20251001' });
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'professional', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  const payload = res.json.mock.calls[0][0];
  expect(payload.ai_generated).toBe(true);
  expect(payload.session_id).toBeTruthy();
  expect(payload.fields.title).toBe('T');
});

const OWNED_SESSION_ID = '22222222-2222-2222-2222-222222222222'; // must be a real UUID: the column is UUID NOT NULL

test('regenerate with an OWNED session_id does not check quota', async () => {
  planService.getLimit.mockResolvedValue(1);
  state.count = 5; // over limit, but an owned regenerate must ignore it
  state.ownedSessionIds.push(OWNED_SESSION_ID); // a prior 'generate' row for this host+session exists
  generateListing.mockResolvedValue({ fields: okFields, model: 'claude-sonnet-5' });
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'starter', body: { title: 'X', session_id: OWNED_SESSION_ID } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(generateListing).toHaveBeenCalledWith(expect.objectContaining({ regenerate: true }));
  const payload = res.json.mock.calls[0][0];
  expect(payload.session_id).toBe(OWNED_SESSION_ID); // reuses the owned session, no fresh quota unit
  expect(state.insertedRows[0].kind).toBe('regenerate'); // no 'generate' unit consumed
});

test('regenerate at the per-session cap returns 429, generateListing not called', async () => {
  planService.getLimit.mockResolvedValue(1);
  state.ownedSessionIds.push(OWNED_SESSION_ID);
  state.regenerateCount = MAX_REGENERATIONS_PER_SESSION; // already at the cap
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'starter', body: { title: 'X', session_id: OWNED_SESSION_ID } }, res);
  expect(res.status).toHaveBeenCalledWith(429);
  expect(res.json.mock.calls[0][0].message).toMatch(/regeneration limit/i);
  expect(generateListing).not.toHaveBeenCalled();
});

test('regenerate below the per-session cap proceeds', async () => {
  planService.getLimit.mockResolvedValue(1);
  state.ownedSessionIds.push(OWNED_SESSION_ID);
  state.regenerateCount = MAX_REGENERATIONS_PER_SESSION - 1; // one below the cap
  generateListing.mockResolvedValue({ fields: okFields, model: 'claude-sonnet-5' });
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'starter', body: { title: 'X', session_id: OWNED_SESSION_ID } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(generateListing).toHaveBeenCalledWith(expect.objectContaining({ regenerate: true }));
});

test('forged/unowned session_id gets NO free ride: falls through to the quota-checked generate path', async () => {
  planService.getLimit.mockResolvedValue(2);
  state.count = 0; // under quota
  // state.ownedSessionIds stays empty — no 'generate' row for this host+session exists
  generateListing.mockResolvedValue({ fields: okFields, model: 'claude-haiku-4-5-20251001' });
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'professional', body: { title: 'X', session_id: 'forged-session' } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(generateListing).toHaveBeenCalledWith(expect.objectContaining({ regenerate: false }));
  const payload = res.json.mock.calls[0][0];
  expect(payload.session_id).not.toBe('forged-session'); // fresh session_id minted, forged one dropped
  expect(state.insertedRows[0].kind).toBe('generate'); // a real quota unit was consumed
});

test('forged/unowned session_id can still 429 once quota is exhausted', async () => {
  planService.getLimit.mockResolvedValue(1);
  state.count = 1; // already at the limit
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'starter', body: { title: 'X', session_id: 'forged-session-2' } }, res);
  expect(res.status).toHaveBeenCalledWith(429);
});

test('non-UUID session_id never hits the ownership DB query and falls through to GENERATE', async () => {
  planService.getLimit.mockResolvedValue(2);
  state.count = 0; // under quota
  generateListing.mockResolvedValue({ fields: okFields, model: 'claude-haiku-4-5-20251001' });
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'professional', body: { title: 'X', session_id: 'anything' } }, res);
  // Bug 1 root-cause: a non-UUID session_id must never reach the
  // .eq('session_id', ...) read — that's what used to throw 22P02 and hang.
  expect(state.sessionIdQueryCount).toBe(0);
  expect(res.status).toHaveBeenCalledWith(200);
  expect(generateListing).toHaveBeenCalledWith(expect.objectContaining({ regenerate: false }));
  const payload = res.json.mock.calls[0][0];
  expect(payload.session_id).not.toBe('anything'); // forged/malformed id dropped
  expect(payload.session_id).toMatch(UUID_RE); // a fresh, real UUID was minted
  expect(state.insertedRows[0].kind).toBe('generate'); // a real quota unit was consumed
});

test('unexpected DB error on the quota-count select returns a clean error, never hangs', async () => {
  planService.getLimit.mockResolvedValue(2);
  state.countErr = 'connection terminated unexpectedly'; // NOT a missing-schema shape, NOT a UUID error
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'professional', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(500);
  const payload = res.json.mock.calls[0][0];
  expect(payload.message).not.toMatch(/connection terminated/);
  expect(generateListing).not.toHaveBeenCalled();
});

test('missing-table error on the count/ownership select degrades gracefully, never hangs/throws', async () => {
  state.missingTableErr = "Could not find the table 'public.ai_listing_generations' in the schema cache";
  planService.getLimit.mockResolvedValue(2);
  generateListing.mockResolvedValue({ fields: okFields, model: 'claude-haiku-4-5-20251001' });
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'professional', body: { title: 'X', session_id: 'any-session' } }, res);
  expect(res.status).toHaveBeenCalledWith(200); // ownership degrades to false, count degrades to 0
  expect(generateListing).toHaveBeenCalledWith(expect.objectContaining({ regenerate: false }));
});

test('missing-table error still maps a downstream AI_UNAVAILABLE to 503, not a hang', async () => {
  state.missingTableErr = "Could not find the table 'public.ai_listing_generations' in the schema cache";
  planService.getLimit.mockResolvedValue(2);
  generateListing.mockRejectedValue(new Error('AI_UNAVAILABLE'));
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'professional', body: { title: 'X', session_id: 'any-session' } }, res);
  expect(res.status).toHaveBeenCalledWith(503);
});

test('unlimited plan (-1) skips quota', async () => {
  planService.getLimit.mockResolvedValue(-1);
  state.count = 99;
  generateListing.mockResolvedValue({ fields: okFields, model: 'claude-haiku-4-5-20251001' });
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'supreme', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(200);
});

test('422 on AI_INVALID', async () => {
  planService.getLimit.mockResolvedValue(2);
  generateListing.mockRejectedValue(new Error('AI_INVALID'));
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'professional', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(422);
});

test('502 on an unmapped/raw error (network/SDK failure), never an unhandled 500', async () => {
  planService.getLimit.mockResolvedValue(2);
  generateListing.mockRejectedValue(new Error('ECONNRESET'));
  const res = mkRes();
  await generateAiListing({ user: { id: 'h1' }, vendorPlan: 'professional', body: { title: 'X' } }, res);
  expect(res.status).toHaveBeenCalledWith(502);
  const payload = res.json.mock.calls[0][0];
  expect(payload.message).not.toMatch(/ECONNRESET/);
});
