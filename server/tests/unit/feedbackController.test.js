// server/tests/unit/feedbackController.test.js
const mockFrom = jest.fn();
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: (...a) => mockFrom(...a) } }));

const { createFeedback, getMyFeedback } = require('../../controllers/feedbackController');

const res = () => { const r = {}; r.status = jest.fn(() => r); r.json = jest.fn(() => r); return r; };
beforeEach(() => jest.clearAllMocks());

test('createFeedback rejects missing body', async () => {
  const r = res();
  await createFeedback({ user: { id: 'v1' }, body: { type: 'idea' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('createFeedback rejects unknown type', async () => {
  const r = res();
  await createFeedback({ user: { id: 'v1' }, body: { type: 'spam', body: 'hi' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('createFeedback rejects unknown area', async () => {
  const r = res();
  await createFeedback({ user: { id: 'v1' }, body: { type: 'idea', body: 'hi', area: 'nope' } }, r);
  expect(r.status).toHaveBeenCalledWith(400);
});

test('createFeedback inserts a new widget row scoped to the vendor', async () => {
  let inserted = null;
  mockFrom.mockImplementation(() => {
    const c = {
      insert: jest.fn((row) => { inserted = row; return c; }),
      select: jest.fn(() => c),
      single: jest.fn().mockResolvedValue({ data: { id: 'f1', status: 'new' }, error: null }),
    };
    return c;
  });
  const r = res();
  await createFeedback(
    { user: { id: 'v1' }, body: { type: 'bug', area: 'booking', subject: 'X', body: 'broken' } },
    r,
  );
  expect(inserted).toMatchObject({
    vendor_id: 'v1', source: 'widget', type: 'bug', area: 'booking', subject: 'X', body: 'broken', status: 'new',
  });
  expect(r.status).toHaveBeenCalledWith(201);
});

test('getMyFeedback returns the vendor\'s own rows newest-first', async () => {
  const rows = [{ id: 'f2' }, { id: 'f1' }];
  const order = jest.fn().mockResolvedValue({ data: rows, error: null });
  const eq = jest.fn(() => ({ order }));
  const select = jest.fn(() => ({ eq }));
  mockFrom.mockImplementation(() => ({ select }));
  const r = res();
  await getMyFeedback({ user: { id: 'v1' } }, r);
  expect(eq).toHaveBeenCalledWith('vendor_id', 'v1');
  expect(r.json).toHaveBeenCalledWith({ feedback: rows });
});
