// Post-resolution CSAT endpoint — owner check + 1..5 validation. Deps mocked.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/botService', () => ({ askBot: jest.fn() }));
jest.mock('../../services/supportContextService', () => ({ getSupportContext: jest.fn() }));
jest.mock('../../services/supportChatService', () => ({ getThread: jest.fn(), setRating: jest.fn() }));

const chat = require('../../services/supportChatService');
const { rateThread } = require('../../controllers/supportController');

const mkRes = () => { const r = {}; r.json = jest.fn(() => r); r.status = jest.fn(() => r); return r; };
const req = (rating) => ({ user: { id: 'u1', phone: '+91' }, params: { id: 't1' }, body: { rating } });

beforeEach(() => jest.clearAllMocks());

test('records a valid rating for the thread owner', async () => {
  chat.getThread.mockResolvedValue({ id: 't1', user_id: 'u1' });
  chat.setRating.mockResolvedValue({ id: 't1', rating: 5 });
  const res = mkRes();
  await rateThread(req(5), res);
  expect(chat.setRating).toHaveBeenCalledWith('t1', 5);
  expect(res.json).toHaveBeenCalledWith({ thread: { id: 't1', rating: 5 } });
});

test('rejects an out-of-range rating (setRating returns null)', async () => {
  chat.getThread.mockResolvedValue({ id: 't1', user_id: 'u1' });
  chat.setRating.mockResolvedValue(null);
  const res = mkRes();
  await rateThread(req(9), res);
  expect(res.status).toHaveBeenCalledWith(400);
});

test('404s when the thread is not the caller\'s', async () => {
  chat.getThread.mockResolvedValue({ id: 't1', user_id: 'someone-else' });
  const res = mkRes();
  await rateThread(req(5), res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(chat.setRating).not.toHaveBeenCalled();
});
