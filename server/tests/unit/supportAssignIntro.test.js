// "Assign to me" — persona attribution + one-time warm intro. chat + context mocked.

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/supportChatService', () => ({
  getThread: jest.fn(), assign: jest.fn(), setAgentName: jest.fn(),
  hasAdminMessage: jest.fn(), postMessage: jest.fn(),
}));
jest.mock('../../services/supportContextService', () => ({ getSupportContext: jest.fn() }));

const chat = require('../../services/supportChatService');
const context = require('../../services/supportContextService');
const { assign } = require('../../controllers/supportAdminController');

const thread = { id: 't1', reference: 'SUP-1', user_id: 'u1', participant_type: 'host', guest_phone: null };
const mkRes = () => { const r = {}; r.json = jest.fn(() => r); r.status = jest.fn(() => r); return r; };
const req = (email) => ({ admin: { id: 'adm-uuid', email }, params: { id: 't1' }, body: {} });

beforeEach(() => {
  jest.clearAllMocks();
  chat.getThread.mockResolvedValue(thread);
  chat.assign.mockResolvedValue({ ...thread, status: 'assigned' });
  context.getSupportContext.mockResolvedValue({ profile: { name: 'Rahul Verma' } });
});

test('claims the thread, snapshots the persona, and posts one warm intro when no human has replied', async () => {
  chat.hasAdminMessage.mockResolvedValue(false);
  const res = mkRes();
  await assign(req('tithi@bookasloth.in'), res);

  expect(chat.assign).toHaveBeenCalledWith('t1', 'adm-uuid');   // real id for the 'mine' filter
  expect(chat.setAgentName).toHaveBeenCalledWith('t1', 'Tithi'); // persona for display
  expect(chat.postMessage).toHaveBeenCalledTimes(1);
  const intro = chat.postMessage.mock.calls[0][0];
  expect(intro.sender).toBe('admin');
  expect(intro.senderName).toBe('Tithi');
  expect(intro.body).toContain('Tithi');
  expect(intro.body).toContain('Rahul'); // greeted by first name from context
});

test('re-assign does NOT re-greet once a human has already replied', async () => {
  chat.hasAdminMessage.mockResolvedValue(true);
  const res = mkRes();
  await assign(req('tithi@bookasloth.in'), res);
  expect(chat.postMessage).not.toHaveBeenCalled();
});

test('intro still posts (name-less) when context lookup fails', async () => {
  chat.hasAdminMessage.mockResolvedValue(false);
  context.getSupportContext.mockRejectedValue(new Error('db down'));
  const res = mkRes();
  await assign(req('tithi@bookasloth.in'), res);
  expect(chat.postMessage).toHaveBeenCalledTimes(1);
  expect(chat.postMessage.mock.calls[0][0].body).toContain('Tithi');
});

test('unmapped admin appears as the generic team name', async () => {
  chat.hasAdminMessage.mockResolvedValue(false);
  const res = mkRes();
  await assign(req('stranger@example.com'), res);
  expect(chat.setAgentName).toHaveBeenCalledWith('t1', 'Support Team');
  expect(chat.postMessage.mock.calls[0][0].senderName).toBe('Support Team');
});
