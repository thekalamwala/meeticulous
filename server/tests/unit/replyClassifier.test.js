const mockCreate = jest.fn();
jest.mock('../../services/ai/anthropicClient', () => ({
  MODELS: { generate: 'haiku' },
  getClient: jest.fn(() => ({ messages: { create: mockCreate } })),
}));
jest.mock('../../lib/botBudget', () => ({ tryConsume: jest.fn(async () => ({ allowed: true })) }));

const anthropicClient = require('../../services/ai/anthropicClient');
const botBudget = require('../../lib/botBudget');
const { classifyReply, isConfidentOptOut } = require('../../services/crm/replyClassifier');

const toolReply = (input) => ({ content: [{ type: 'tool_use', name: 'label', input }] });

beforeEach(() => { mockCreate.mockReset(); });

test('returns the model label, clamping confidence', async () => {
  mockCreate.mockResolvedValueOnce(toolReply({ intent: 'interested', confidence: 1.7, summary: 'Wants a demo' }));
  const out = await classifyReply({ subject: 'Re: hi', text: 'Yes, can we talk tomorrow?' });
  expect(out).toEqual({ intent: 'interested', confidence: 1, summary: 'Wants a demo' });
});

test('an unknown label falls back to other', async () => {
  mockCreate.mockResolvedValueOnce(toolReply({ intent: 'buy_now', confidence: 0.9, summary: 'x' }));
  expect((await classifyReply({ text: 'hello' })).intent).toBe('other');
});

test('fails open on a model error', async () => {
  mockCreate.mockRejectedValueOnce(new Error('401'));
  expect((await classifyReply({ text: 'hello' })).intent).toBe('other');
});

test('empty text, no client or no budget never calls the model', async () => {
  expect((await classifyReply({ text: '  ' })).intent).toBe('other');
  anthropicClient.getClient.mockReturnValueOnce(null);
  expect((await classifyReply({ text: 'hi' })).intent).toBe('other');
  botBudget.tryConsume.mockResolvedValueOnce({ allowed: false });
  expect((await classifyReply({ text: 'hi' })).intent).toBe('other');
  expect(mockCreate).not.toHaveBeenCalled();
});

test('only a confident unsubscribe counts as an opt-out', () => {
  expect(isConfidentOptOut({ intent: 'unsubscribe', confidence: 0.8 })).toBe(true);
  expect(isConfidentOptOut({ intent: 'unsubscribe', confidence: 0.6 })).toBe(false);
  expect(isConfidentOptOut({ intent: 'angry', confidence: 1 })).toBe(false);
});
