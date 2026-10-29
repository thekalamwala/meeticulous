jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { rpc: jest.fn() },
}));
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn() }));
const { supabaseAdmin } = require('../../config/supabase');
const { adminAlert } = require('../../utils/adminAlert');
const posting = require('../../services/ledger/postingService');

beforeEach(() => jest.clearAllMocks());

describe('postingService.post', () => {
  const tpl = {
    description: 'test',
    lines: [
      { account_code: '1000', debit: 10, credit: 0 },
      { account_code: '4000', debit: 0, credit: 10 },
    ],
  };

  test('calls the RPC with the full payload and returns the entry id', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: 'entry-uuid', error: null });
    const id = await posting.post({
      sourceType: 'ORDER_PAYMENT', sourceId: 'src-1',
      journalDate: '2026-06-13', template: tpl,
    });
    expect(id).toBe('entry-uuid');
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('post_journal_entry', {
      p: {
        source_type: 'ORDER_PAYMENT',
        source_id: 'src-1',
        journal_date: '2026-06-13',
        description: 'test',
        created_by: null,
        lines: tpl.lines,
      },
    });
  });

  test('journalDate and createdBy default to null', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: 'e2', error: null });
    await posting.post({ sourceType: 'ADJUSTMENT', sourceId: 'src-2', template: tpl });
    const payload = supabaseAdmin.rpc.mock.calls[0][1].p;
    expect(payload.journal_date).toBeNull();
    expect(payload.created_by).toBeNull();
  });

  test('throws a descriptive error when the RPC errors', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: null, error: { message: 'does not balance' } });
    await expect(posting.post({ sourceType: 'ADJUSTMENT', sourceId: 'x', template: tpl }))
      .rejects.toThrow(/does not balance/);
  });

  test('postSafe never throws — returns null and logs on failure', async () => {
    supabaseAdmin.rpc.mockRejectedValue(new Error('boom'));
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const id = await posting.postSafe({ sourceType: 'ORDER_PAYMENT', sourceId: 'y', template: tpl });
    expect(id).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  test('postSafe returns the entry id on success', async () => {
    supabaseAdmin.rpc.mockResolvedValue({ data: 'e3', error: null });
    const id = await posting.postSafe({ sourceType: 'ORDER_PAYMENT', sourceId: 'z', template: tpl });
    expect(id).toBe('e3');
  });

  test('postSafe alerts once a source keeps failing (dead-letter, not silent retry)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    supabaseAdmin.rpc.mockRejectedValue(new Error('line amounts cannot be negative'));
    // First failure stays quiet — could be a transient blip the reconciler heals.
    await posting.postSafe({ sourceType: 'ORDER_PAYMENT', sourceId: 'poison-1', template: tpl });
    expect(adminAlert).not.toHaveBeenCalled();
    // Same source fails again → surfaces instead of retrying forever in silence.
    await posting.postSafe({ sourceType: 'ORDER_PAYMENT', sourceId: 'poison-1', template: tpl });
    expect(adminAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'ledger_poison:ORDER_PAYMENT/poison-1' }),
    );
    spy.mockRestore();
  });

  test('postSafe success clears the failure streak (a healed blip does not alert)', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    supabaseAdmin.rpc.mockRejectedValueOnce(new Error('blip'));
    await posting.postSafe({ sourceType: 'ORDER_PAYMENT', sourceId: 'flaky', template: tpl });
    supabaseAdmin.rpc.mockResolvedValueOnce({ data: 'ok', error: null });
    await posting.postSafe({ sourceType: 'ORDER_PAYMENT', sourceId: 'flaky', template: tpl }); // heals → streak cleared
    supabaseAdmin.rpc.mockRejectedValueOnce(new Error('blip-again'));
    await posting.postSafe({ sourceType: 'ORDER_PAYMENT', sourceId: 'flaky', template: tpl }); // streak back to 1
    expect(adminAlert).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
