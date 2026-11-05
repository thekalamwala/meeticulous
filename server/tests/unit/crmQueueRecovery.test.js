'use strict';
// ASH-35 S2-7: CRM messages must not get lost.
//   • a dispatch that THROWS goes back on the retry path instead of sitting in
//     'processing' forever — but never flips a row that already reached 'sent'
//   • rows stuck in 'processing' (worker died) are failed visibly, not resent
//   • a sequence step whose enqueue fails is retried, not skipped

// Recording Supabase mock: every awaited builder logs { table, op, patch, filters }
// and resolves through mockResolve(entry).
const mockOps = [];
let mockResolve = () => ({ data: null, error: null });
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: (table) => {
      const entry = { table, op: 'select', patch: null, filters: {} };
      const q = {
        select: () => q, order: () => q, limit: () => q, maybeSingle: () => q,
        update: (patch) => { entry.op = 'update'; entry.patch = patch; return q; },
        eq: (c, v) => { entry.filters[c] = v; return q; },
        lte: (c, v) => { entry.filters[`${c}<=`] = v; return q; },
        lt: (c, v) => { entry.filters[`${c}<`] = v; return q; },
        then: (res, rej) => { mockOps.push(entry); return Promise.resolve(mockResolve(entry)).then(res, rej); },
      };
      return q;
    },
  },
}));
jest.mock('../../services/crm/whatsappService', () => ({ send: jest.fn() }));
jest.mock('../../services/crm/emailService', () => ({ send: jest.fn() }));
jest.mock('../../services/crm/activity', () => ({ logActivity: jest.fn() }));
jest.mock('../../services/email/senderRegistry', () => ({ forCrm: jest.fn(() => Promise.resolve(null)) }));
jest.mock('../../services/email/providers', () => ({ MARKETING_PROVIDER: 'brevo' }));

const email = require('../../services/crm/emailService');
const { logActivity } = require('../../services/crm/activity');
const messageService = require('../../services/crm/messageService');

const ROW = { id: 'm1', lead_id: 'L1', channel: 'email', status: 'queued', attempts: 0, subject: 'Hi', variables: { html: 'x' } };
const updatesTo = (table) => mockOps.filter((o) => o.table === table && o.op === 'update');

beforeEach(() => {
  mockOps.length = 0;
  jest.clearAllMocks();
  mockResolve = (e) => {
    if (e.table === 'crm_messages' && e.op === 'select') return { data: [ROW], error: null };
    if (e.table === 'crm_messages' && e.op === 'update' && e.patch.status === 'processing') return { data: { id: 'm1' }, error: null }; // claim won
    if (e.table === 'leads') return { data: { id: 'L1', name: 'Asha', email: 'a@x.test' }, error: null };
    return { data: null, error: null };
  };
});

describe('processQueue', () => {
  test('a throwing dispatch is re-queued with backoff, guarded on status=processing', async () => {
    email.send.mockRejectedValueOnce(new Error('provider exploded'));
    await messageService.processQueue();
    const requeue = updatesTo('crm_messages').find((o) => o.patch.status === 'queued');
    expect(requeue).toBeTruthy();
    expect(requeue.patch.error).toMatch(/dispatch_error: provider exploded/);
    expect(requeue.patch.attempts).toBe(1);
    expect(requeue.filters).toMatchObject({ id: 'm1', status: 'processing' }); // never flips a 'sent' row
  });

  test('a throw AFTER the send (logActivity) cannot resend: the requeue is status-guarded', async () => {
    email.send.mockResolvedValueOnce({ success: true, providerMessageId: 'p1' });
    logActivity.mockRejectedValueOnce(new Error('timeline write failed'));
    await messageService.processQueue();
    const ups = updatesTo('crm_messages');
    expect(ups.some((o) => o.patch.status === 'sent')).toBe(true);
    // The fallback requeue only applies WHERE status='processing' — the row is 'sent' by now.
    const requeue = ups.find((o) => o.patch.status === 'queued');
    expect(requeue.filters.status).toBe('processing');
  });

  test('rows stuck in processing are failed (not resent) before draining', async () => {
    mockResolve = (e) => (e.table === 'crm_messages' && e.op === 'select' ? { data: [], error: null } : { data: null, error: null });
    await messageService.processQueue();
    const sweep = updatesTo('crm_messages')[0];
    expect(sweep.patch).toMatchObject({ status: 'failed' });
    expect(sweep.patch.error).toMatch(/stuck_processing/);
    expect(sweep.filters.status).toBe('processing');
    expect(sweep.filters['updated_at<']).toBeTruthy();
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('sequence processDue', () => {
  test('a failed enqueue keeps the step (retry later) instead of advancing past it', async () => {
    jest.spyOn(messageService, 'enqueue').mockRejectedValueOnce(new Error('queue down'));
    const sequenceService = require('../../services/crm/sequenceService');
    mockResolve = (e) => {
      if (e.table === 'crm_sequence_enrollments' && e.op === 'select') return { data: [{ id: 'en1', sequence_id: 's1', lead_id: 'L1', current_step: 0 }], error: null };
      if (e.table === 'crm_sequences') return { data: { id: 's1', is_active: true }, error: null };
      if (e.table === 'leads') return { data: { id: 'L1', status: 'new' }, error: null };
      if (e.table === 'crm_sequence_steps') return { data: [{ step_no: 1, channel: 'email', delay_hours: 0 }, { step_no: 2, channel: 'email', delay_hours: 24 }], error: null };
      return { data: null, error: null };
    };
    const r = await sequenceService.processDue();
    expect(r.sent).toBe(0);
    const ups = updatesTo('crm_sequence_enrollments');
    expect(ups).toHaveLength(1);
    expect(ups[0].patch).not.toHaveProperty('current_step');          // NOT advanced
    expect(new Date(ups[0].patch.next_run_at).getTime()).toBeGreaterThan(Date.now() + 50 * 60 * 1000); // ~1h retry
  });
});
