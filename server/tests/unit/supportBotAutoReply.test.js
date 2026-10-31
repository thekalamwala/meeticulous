// Unit tests for Bolt auto-reply in the support-chat controller. botService and
// supportChatService are mocked — no model call, no DB.

jest.mock('../../services/botService', () => ({ askBot: jest.fn() }));
jest.mock('../../services/supportChatService', () => ({ postMessage: jest.fn(), escalate: jest.fn() }));
jest.mock('../../services/supportContextService', () => ({ getSupportContext: jest.fn() }));
jest.mock('../../services/supportActions', () => ({ detectAction: jest.fn(() => null), runAction: jest.fn() }));

const bot = require('../../services/botService');
const chat = require('../../services/supportChatService');
const supportContext = require('../../services/supportContextService');
const { botAutoReply } = require('../../controllers/supportController');

const thread = { id: 't1', reference: 'SUP-ABC123', user_id: 'u1', participant_type: 'host' };
const CTX = { kind: 'host', profile: {}, host: {}, bookings: [] };

beforeEach(() => { jest.clearAllMocks(); supportContext.getSupportContext.mockResolvedValue(CTX); });

test('resolves the authenticated context and passes it to askBot', async () => {
  bot.askBot.mockResolvedValue({ answer: 'You get paid via Razorpay Route.', escalate: false });
  await botAutoReply(thread, 'how do payouts work?');
  expect(supportContext.getSupportContext).toHaveBeenCalledWith({ userId: 'u1', phone: null, isHost: true });
  expect(bot.askBot).toHaveBeenCalledWith({ question: 'how do payouts work?', sessionRef: 'SUP-ABC123', context: CTX });
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
