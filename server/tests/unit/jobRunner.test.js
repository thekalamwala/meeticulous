// Unit tests for the persisted-schedule runner (F4). runIfDue only runs a job when
// it is DUE per job_runs.last_run_at (durable across pod restarts) and the lease is
// won, then stamps the run. Fail-open on a schedule-read error.

const mockRunLocked = jest.fn((_name, fn) => fn()); // by default: lease won → run
jest.mock('../../utils/jobLock', () => ({ runLocked: (...a) => mockRunLocked(...a) }));

const mockUpserts = [];
let mockScheduleRow = null;
let mockReadError = null;
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: mockScheduleRow, error: mockReadError }),
      upsert: jest.fn((row) => { mockUpserts.push(row); return Promise.resolve({ error: null }); }),
    })),
  },
}));

const { runIfDue } = require('../../utils/jobRunner');

const HOUR = 60 * 60 * 1000;
beforeEach(() => { jest.clearAllMocks(); mockUpserts.length = 0; mockScheduleRow = null; mockReadError = null; });

test('no prior run → due → runs the job and stamps last_run_at', async () => {
  mockScheduleRow = null; // never run
  const fn = jest.fn().mockResolvedValue('done');
  const r = await runIfDue('ledger-reconcile', HOUR, fn);
  expect(fn).toHaveBeenCalledTimes(1);
  expect(r).toBe('done');
  expect(mockUpserts[0]).toMatchObject({ name: 'ledger-reconcile', last_outcome: 'ok' });
  expect(mockUpserts[0].last_run_at).toBeTruthy();
});

test('last run older than the interval → due → runs', async () => {
  mockScheduleRow = { last_run_at: new Date(Date.now() - 2 * HOUR).toISOString() };
  const fn = jest.fn().mockResolvedValue('x');
  await runIfDue('ledger-reconcile', HOUR, fn);
  expect(fn).toHaveBeenCalledTimes(1);
});

test('last run within the interval → NOT due → skips (no lease, no run, no stamp)', async () => {
  mockScheduleRow = { last_run_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() }; // 5 min ago
  const fn = jest.fn();
  const r = await runIfDue('ledger-reconcile', HOUR, fn);
  expect(r).toBeUndefined();
  expect(fn).not.toHaveBeenCalled();
  expect(mockRunLocked).not.toHaveBeenCalled();
  expect(mockUpserts).toHaveLength(0);
});

test('schedule read error → fail-open → runs anyway', async () => {
  mockReadError = { message: 'db blip' };
  const fn = jest.fn().mockResolvedValue('ok');
  await runIfDue('ledger-reconcile', HOUR, fn);
  expect(fn).toHaveBeenCalledTimes(1);
});

test('a failing job stamps outcome=error and rethrows', async () => {
  mockScheduleRow = null;
  const fn = jest.fn().mockRejectedValue(new Error('boom'));
  await expect(runIfDue('ledger-reconcile', HOUR, fn)).rejects.toThrow('boom');
  expect(mockUpserts[0]).toMatchObject({ name: 'ledger-reconcile', last_outcome: 'error' });
  expect(mockUpserts[0].last_error).toMatch(/boom/);
});

test('when another instance holds the lease (runLocked skips), fn does not run', async () => {
  mockScheduleRow = null;
  mockRunLocked.mockImplementationOnce(() => undefined); // lease lost → skip
  const fn = jest.fn();
  const r = await runIfDue('ledger-reconcile', HOUR, fn);
  expect(r).toBeUndefined();
  expect(fn).not.toHaveBeenCalled();
});
