// Unit tests for the cron leader-election lock. The Supabase admin client is
// mocked so no real DB is touched. Covers: it runs the job when the lease is
// won, skips when another instance holds it, and FAILS OPEN (still runs) when the
// lock RPC errors or is missing — preserving today's single-instance behaviour.

const mockRpc = jest.fn();
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { rpc: (...args) => mockRpc(...args) },
}));
const mockAdminAlert = jest.fn();
jest.mock('../../utils/adminAlert', () => ({ adminAlert: (...a) => mockAdminAlert(...a) }));

function loadFresh() {
  jest.resetModules();
  return require('../../utils/jobLock');
}

beforeEach(() => { mockRpc.mockReset(); mockAdminAlert.mockReset(); });

describe('acquire', () => {
  test('passes the job name, a stable holder id, and the lease to the RPC', async () => {
    const { acquire, HOLDER } = loadFresh();
    mockRpc.mockResolvedValueOnce({ data: true, error: null });

    const got = await acquire('reminders', 600000);

    expect(got).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('try_acquire_job_lock', {
      p_name: 'reminders',
      p_holder: HOLDER,
      p_lease_ms: 600000,
    });
  });

  test('returns false when another instance holds the lease', async () => {
    const { acquire } = loadFresh();
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await acquire('reminders', 1000)).toBe(false);
  });

  test('fails OPEN (true) and alerts when the RPC returns an error (e.g. migration missing)', async () => {
    const { acquire } = loadFresh();
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'function does not exist' } });
    expect(await acquire('reminders', 1000)).toBe(true);
    expect(mockAdminAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'joblock_fail_open' }),
    );
  });

  test('fails OPEN (true) and alerts when the RPC call throws (DB down)', async () => {
    const { acquire } = loadFresh();
    mockRpc.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await acquire('reminders', 1000)).toBe(true);
    expect(mockAdminAlert).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'joblock_fail_open' }),
    );
  });

  test('does NOT alert on a normal win', async () => {
    const { acquire } = loadFresh();
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    expect(await acquire('reminders', 1000)).toBe(true);
    expect(mockAdminAlert).not.toHaveBeenCalled();
  });
});

describe('runLocked', () => {
  test('runs the job and returns its result when the lease is won', async () => {
    const { runLocked } = loadFresh();
    mockRpc.mockResolvedValueOnce({ data: true, error: null });
    const fn = jest.fn().mockResolvedValue('done');

    const result = await runLocked('email-queue', fn, { leaseMs: 120000 });

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe('done');
  });

  test('skips the job (returns undefined) when another instance holds the lease', async () => {
    const { runLocked } = loadFresh();
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    const fn = jest.fn();

    const result = await runLocked('email-queue', fn, { leaseMs: 120000 });

    expect(fn).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });

  test('still runs the job when the lock is unavailable (fail-open)', async () => {
    const { runLocked } = loadFresh();
    mockRpc.mockRejectedValueOnce(new Error('DB down'));
    const fn = jest.fn().mockResolvedValue('ran');

    const result = await runLocked('reminders', fn);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(result).toBe('ran');
  });
});
