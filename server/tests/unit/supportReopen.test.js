// sendMessage reopens a resolved thread so the message isn't posted into a thread
// the admin queue hides. botService + supportChatService are mocked.

jest.mock('../../services/botService', () => ({ askBot: jest.fn(() => Promise.resolve({ answer: '', escalate: false })) }));
jest.mock('../../services/supportActions', () => ({ detectAction: jest.fn(() => null), runAction: jest.fn() }));
jest.mock('../../services/supportContextService', () => ({ getSupportContext: jest.fn() }));
jest.mock('../../services/supportChatService', () => ({
  getThread: jest.fn(),
  setStatus: jest.fn(() => Promise.resolve({})),
  postMessage: jest.fn(() => Promise.resolve({ id: 'm1', body: 'hi', sender: 'user' })),
  escalate: jest.fn(),
}));

const chat = require('../../services/supportChatService');
const { sendMessage } = require('../../controllers/supportController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

test('reopens a resolved thread to the bot phase on a user message', async () => {
  chat.getThread.mockResolvedValue({ id: 't1', user_id: 'u1', status: 'resolved' });
  const req = { params: { id: 't1' }, user: { id: 'u1' }, body: { body: 'hi again' } };
  const res = mockRes();

  await sendMessage(req, res);

  expect(chat.setStatus).toHaveBeenCalledWith('t1', 'bot');
  expect(res.status).toHaveBeenCalledWith(201);
});

test('does not reopen an already-open (bot) thread', async () => {
  chat.getThread.mockResolvedValue({ id: 't1', user_id: 'u1', status: 'bot' });
  const req = { params: { id: 't1' }, user: { id: 'u1' }, body: { body: 'hi' } };
  await sendMessage(req, mockRes());
  expect(chat.setStatus).not.toHaveBeenCalled();
});
