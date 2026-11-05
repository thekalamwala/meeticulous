const state = {
  campaigns: [{ id: 'camp1', status: 'sending', template_id: 'tA', subject_override: '', throttle_per_min: 100 }],
  recipients: [
    { id: 'r1', campaign_id: 'camp1', contact_id: 'c1', destination: 'a@x', status: 'queued' },
    { id: 'r2', campaign_id: 'camp1', contact_id: 'c2', destination: 'b@x', status: 'queued' },
  ],
  contacts: { c1: { id: 'c1', email: 'a@x', name: 'A', user_id: 'u1', email_opt_in: true, email_suppressed: false, attributes: {} },
              c2: { id: 'c2', email: 'b@x', name: 'B', user_id: null, email_opt_in: true, email_suppressed: false, attributes: {} } },
  emailSentToday: 0, // campaign emails already handed to Resend today (for the daily-cap gate)
};
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: (t) => {
    const q = { _f: {} };
    q.select = (_c, opts) => { q._opts = opts; return q; };
    q.eq = (c, v) => { q._f[c] = v; return q; }; q.limit = () => q;
    q.not = () => q; q.gte = () => q;
    q.in = (c, vs) => { q._in = vs; return q; };
    q.then = (res) => {
      // Daily-cap head/count query (email_logs) → return only a count.
      if (q._opts && q._opts.head) return res({ count: state.emailSentToday, error: null });
      if (t === 'email_campaigns') return res({ data: state.campaigns.filter((c) => c.status === 'sending'), error: null });
      if (t === 'campaign_recipients') {
        // staleRead: the worker's list read races another worker's claim (sees every row as queued).
        const rows = state.staleRead ? state.recipients.map((r) => ({ ...r, status: 'queued' })) : state.recipients;
        return res({ data: rows.filter((r) => r.campaign_id === q._f.campaign_id && (q._in ? q._in.includes(r.status) : r.status === (q._f.status || r.status))), error: null });
      }
      if (t === 'contacts') return res({ data: Object.values(state.contacts).filter((c) => c.id === q._f.id), error: null });
      return res({ data: [], error: null });
    };
    q.single = () => { if (t === 'contacts') return Promise.resolve({ data: state.contacts[q._f.id], error: null }); return Promise.resolve({ data: null, error: null }); };
    // Chainable update: .eq() filters, .lt() = the stale-claim sweep (test rows are never
    // stale), .select().maybeSingle() = the conditional claim (returns the row if won).
    q.update = (ch) => {
      const f = {}; let stale = false;
      const apply = () => {
        const list = t === 'campaign_recipients' ? state.recipients : t === 'email_campaigns' ? state.campaigns : [];
        const hits = stale ? [] : list.filter((x) => Object.entries(f).every(([c, v]) => x[c] === v));
        hits.forEach((x) => Object.assign(x, ch));
        return hits;
      };
      const u = {
        eq: (c, v) => { f[c] = v; return u; }, lt: () => { stale = true; return u; }, select: () => u,
        maybeSingle: () => Promise.resolve({ data: apply()[0] || null, error: null }),
        then: (res) => { apply(); return res({ error: null }); },
      };
      return u;
    };
    return q;
  } },
  supabase: {},
}));
// Must be `mock`-prefixed so the jest.mock factory may reference it (hoisting rule).
let mockEnqueued = [];
jest.mock('../../services/email/communicationEngine', () => ({
  enqueueCampaignEmail: async (a) => { mockEnqueued.push(a); return { ok: true, status: 'queued', logId: `log${mockEnqueued.length}` }; },
}));
// Cold email budget now comes from the shared sendBudget (18:00 window + ramp +
// remainder). Stub it so these tests control the allowance directly instead of
// depending on wall-clock IST time.
let mockColdAllowance = 90;
jest.mock('../../services/email/sendBudget', () => ({ coldAllowanceNow: async () => mockColdAllowance }));
const worker = require('../../services/campaignWorker');
beforeEach(() => { mockEnqueued = []; state.recipients.forEach((r) => { r.status = 'queued'; }); state.campaigns[0].status = 'sending'; state.emailSentToday = 0; mockColdAllowance = 90; });

test('enqueues each queued recipient and marks them sent', async () => {
  const r = await worker.processDue();
  expect(mockEnqueued).toHaveLength(2);
  expect(mockEnqueued[0].templateId).toBe('tA');
  expect(state.recipients.every((x) => x.status === 'sent')).toBe(true);
  expect(r.enqueued).toBe(2);
});

test('marks campaign sent once drained', async () => {
  await worker.processDue();
  expect(state.campaigns[0].status).toBe('sent');
});

test('cold budget spent (0 allowance): leaves recipients queued, no send, campaign not drained', async () => {
  mockColdAllowance = 0; // outside window / no remainder
  const r = await worker.processDue();
  expect(mockEnqueued).toHaveLength(0);
  expect(state.recipients.every((x) => x.status === 'queued')).toBe(true);
  expect(r.enqueued).toBe(0);
  expect(state.campaigns[0].status).toBe('sending'); // still queued → not marked sent
});

test('a recipient already claimed by another worker is not sent twice (ASH-35)', async () => {
  state.recipients[0].status = 'sending'; // another worker claimed r1…
  state.staleRead = true;                 // …after this worker read it as 'queued'
  await worker.processDue();
  state.staleRead = false;
  expect(mockEnqueued.map((e) => e.to)).toEqual(['b@x']); // only r2; r1's claim was lost
  expect(state.recipients[0].status).toBe('sending');
});

test('a campaign with a recipient still mid-send is NOT marked sent', async () => {
  state.recipients[0].status = 'sending'; // claimed by another worker, not yet finished
  await worker.processDue();
  expect(state.recipients[1].status).toBe('sent');
  expect(state.campaigns[0].status).toBe('sending');
});

test('partial cold allowance enqueues only up to the remainder', async () => {
  mockColdAllowance = 1; // 1 slot left
  const r = await worker.processDue();
  expect(r.enqueued).toBe(1);
  expect(state.recipients.filter((x) => x.status === 'sent')).toHaveLength(1);
  expect(state.recipients.filter((x) => x.status === 'queued')).toHaveLength(1);
});
