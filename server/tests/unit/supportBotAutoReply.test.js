// Unit tests for Bolt auto-reply in the support-chat controller. botService and
// supportChatService are mocked — no model call, no DB.

jest.mock('../../services/botService', () => ({ askBot: jest.fn() }));
jest.mock('../../services/supportChatService', () => ({ postMessage: jest.fn(), escalate: jest.fn(), listMessages: jest.fn() }));
jest.mock('../../services/supportContextService', () => ({ getSupportContext: jest.fn() }));
jest.mock('../../services/supportActions', () => ({ detectAction: jest.fn(() => null), runAction: jest.fn() }));
// Agentic tool-loop OFF by default here → the legacy regex action path + askBot route run.
jest.mock('../../services/featureFlags', () => ({ isFeatureEnabled: jest.fn().mockResolvedValue(false) }));

const bot = require('../../services/botService');
const chat = require('../../services/supportChatService');
const supportContext = require('../../services/supportContextService');
const { botAutoReply } = require('../../controllers/supportController');

const thread = { id: 't1', reference: 'SUP-ABC123', user_id: 'u1', participant_type: 'host' };
const CTX = { kind: 'host', profile: {}, host: {}, bookings: [] };

beforeEach(() => { jest.clearAllMocks(); supportContext.getSupportContext.mockResolvedValue(CTX); chat.listMessages.mockResolvedValue([]); });

test('resolves the authenticated context and passes it to askBot', async () => {
  bot.askBot.mockResolvedValue({ answer: 'You get paid via Razorpay Route.', escalate: false });
  await botAutoReply(thread, 'how do payouts work?');
  expect(supportContext.getSupportContext).toHaveBeenCalledWith({ userId: 'u1', phone: null, isHost: true });
  expect(bot.askBot).toHaveBeenCalledWith({ question: 'how do payouts work?', sessionRef: 'SUP-ABC123', context: CTX, identity: { userId: 'u1', guestPhone: undefined, isHost: true }, history: [] });
  expect(chat.postMessage).toHaveBeenCalledWith({ threadId: 't1', sender: 'bot', senderName: 'Tithi', body: 'You get paid via Razorpay Route.' });
  expect(chat.escalate).not.toHaveBeenCalled();
});

test('escalates to a human when Tithi returns escalate=true', async () => {
  bot.askBot.mockResolvedValue({ answer: 'Let me connect you to the team.', escalate: true });
  await botAutoReply(thread, 'my dispute is unresolved');
  expect(chat.postMessage).toHaveBeenCalledTimes(1);
  expect(chat.escalate).toHaveBeenCalledWith('t1', 'my dispute is unresolved');
});

test('stays silent (no message) on an empty answer', async () => {
  bot.askBot.mockResolvedValue({ answer: '   ', escalate: false });
  await botAutoReply(thread, 'hi');
  expect(chat.postMessage).not.toHaveBeenCalled();
  expect(chat.escalate).not.toHaveBeenCalled();
});

test('never throws when askBot fails', async () => {
  bot.askBot.mockRejectedValue(new Error('model down'));
  await expect(botAutoReply(thread, 'anything')).resolves.toBeUndefined();
  expect(chat.postMessage).not.toHaveBeenCalled();
});

describe('thread history', () => {
  beforeEach(() => bot.askBot.mockResolvedValue({ answer: 'ok', escalate: false }));
  const lastHistory = () => bot.askBot.mock.calls[0][0].history;

  test('passes earlier customer + Tithi turns only, oldest first, never this message or later ones', async () => {
    chat.listMessages.mockResolvedValue([
      { id: 'm0', sender: 'system', body: 'Hi! Ask us anything' },
      { id: 'm1', sender: 'user', body: 'what does Pro cost?' },
      { id: 'm2', sender: 'bot', body: 'Rs199 a month.' },
      { id: 'm3', sender: 'admin', body: 'Looking at your account now' },
      { id: 'm4', sender: 'user', body: '' },
      { id: 'm5', sender: 'user', body: 'and yearly?' },
      { id: 'm6', sender: 'user', body: 'sent while Tithi was thinking' },
    ]);
    await botAutoReply(thread, 'and yearly?', 'm5');
    expect(lastHistory()).toEqual([
      { role: 'user', content: 'what does Pro cost?' },
      { role: 'assistant', content: 'Rs199 a month.' },
    ]);
  });

  test('sends no history if the current message cannot be located', async () => {
    chat.listMessages.mockResolvedValue([{ id: 'm1', sender: 'user', body: 'old' }]);
    await botAutoReply(thread, 'latest', 'missing');
    expect(lastHistory()).toEqual([]);
  });

  test('still answers when the history lookup fails', async () => {
    chat.listMessages.mockRejectedValue(new Error('db down'));
    await botAutoReply(thread, 'latest', 'now');
    expect(lastHistory()).toEqual([]);
    expect(chat.postMessage).toHaveBeenCalledTimes(1);
  });
});
