// server/tests/unit/feedbackAdminController.test.js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));
// Run background tasks synchronously so we can assert the notify call.
jest.mock('../../utils/background', () => ({ runInBackground: (_label, fn) => fn() }));
const mockSend = jest.fn().mockResolvedValue({});
jest.mock('../../services/notificationEngine', () => ({ send: (...a) => mockSend(...a) }));

const { listFeedback, updateFeedbackStatus } = require('../../controllers/feedbackAdminController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('updateFeedbackStatus rejects an invalid status', async () => {
  const r = res();
  await updateFeedbackStatus({ params: { id: 'f1' }, body: { status: 'bogus' }, admin: { id: 'a1' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('updateFeedbackStatus updates, stamps handler, and notifies the vendor on "shipped"', async () => {
  let updated = null;
  mockFrom.mockImplementation(() => {
    const c = {
      update: jest.fn((row) => { updated = row; return c; }),
      eq: jest.fn(() => c),
      select: jest.fn(() => c),
      single: jest.fn().mockResolvedValue({
        data: { id: 'f1', status: 'shipped', subject: 'Dark mode', admin_response: 'Done!',
                profiles: { name: 'Asha', email: 'asha@x.com' } },
        error: null,
      }),
    };
    return c;
  });
  const r = res();
  await updateFeedbackStatus(
    { params: { id: 'f1' }, body: { status: 'shipped', admin_response: 'Done!' }, admin: { id: 'a1' } },
    r,
  );
  expect(updated).toMatchObject({ status: 'shipped', admin_response: 'Done!', handled_by: 'a1' });
  expect(updated.handled_at).toBeTruthy();
  expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({
    event: 'FEEDBACK_STATUS_CHANGED',
    data: expect.objectContaining({ email: 'asha@x.com', audience: 'vendor' }),
  }));
  expect(r.json).toHaveBeenCalled();
});

test('updateFeedbackStatus does NOT notify when moving to "reviewing"', async () => {
  mockFrom.mockImplementation(() => {
    const c = { update: jest.fn(() => c), eq: jest.fn(() => c), select: jest.fn(() => c),
      single: jest.fn().mockResolvedValue({ data: { id: 'f1', status: 'reviewing', profiles: { email: 'a@x.com' } }, error: null }) };
    return c;
  });
  const r = res();
  await updateFeedbackStatus({ params: { id: 'f1' }, body: { status: 'reviewing' }, admin: { id: 'a1' } }, r);
  expect(mockSend).not.toHaveBeenCalled();
});
