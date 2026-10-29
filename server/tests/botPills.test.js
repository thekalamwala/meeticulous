// Mock the Anthropic client + budget so llmPills never hits the network.
jest.mock('../services/ai/anthropicClient', () => ({
  MODELS: { generate: 'claude-haiku-4-5' },
  isConfigured: jest.fn(() => false),
  getClient: jest.fn(() => null),
}));
jest.mock('../lib/botBudget', () => ({
  tryConsume: jest.fn(async () => ({ allowed: true, reason: null })),
  _reset: jest.fn(),
}));

const anthropicClient = require('../services/ai/anthropicClient');
const botBudget = require('../lib/botBudget');
const { buildPills, rulePills, llmPills, validate, dynamicReadPill, PILL_VOCAB } = require('../services/bot/pills');

beforeEach(() => {
  jest.clearAllMocks();
  process.env.BOT_PILLS_ENABLED = 'true';
  anthropicClient.getClient.mockReturnValue(null);
  botBudget.tryConsume.mockResolvedValue({ allowed: true, reason: null });
});

describe('rulePills', () => {
  it('refund intent → payments + ticket', () => {
    expect(rulePills({ question: 'I want a refund on my booking' })).toEqual(['payments', 'ticket']);
  });
  it('booking intent → book + how', () => {
    expect(rulePills({ question: 'How do I book an appointment?' })).toEqual(['book', 'how']);
  });
  it('pricing intent → pricing + book', () => {
    expect(rulePills({ question: 'what is the cost' })).toEqual(['pricing', 'book']);
  });
  it('host intent → host', () => {
    expect(rulePills({ question: 'how to become a host' })).toEqual(['host']);
  });
  it('roast source → ticket only', () => {
    expect(rulePills({ question: 'anything', source: 'roast' })).toEqual(['ticket']);
  });
  it('escalate → ticket', () => {
    expect(rulePills({ question: 'obscure thing', escalate: true })).toEqual(['ticket']);
  });
  it('over_budget → ticket', () => {
    expect(rulePills({ question: 'x', source: 'over_budget' })).toEqual(['ticket']);
  });
  it('no intent → []', () => {
    expect(rulePills({ question: 'hello there' })).toEqual([]);
  });
});

describe('validate', () => {
  it('caps at 3', () => {
    const many = [PILL_VOCAB.book, PILL_VOCAB.pricing, PILL_VOCAB.how, PILL_VOCAB.host];
    expect(validate(many)).toHaveLength(3);
  });
  it('dedupes by label', () => {
    expect(validate([PILL_VOCAB.book, PILL_VOCAB.book])).toEqual([PILL_VOCAB.book]);
  });
  it('drops falsy action value', () => {
    expect(validate([{ label: 'Bad', action: { type: 'route', value: '' } }])).toEqual([]);
  });
});

describe('dynamicReadPill', () => {
  it('builds a route pill from the top cited source', () => {
    const pill = dynamicReadPill([{ source_file: 'docs/help/how-to-book.md' }]);
    expect(pill).toEqual({ label: 'Read: How To Book', action: { type: 'route', value: '/help/docs/how-to-book' } });
  });
  it('returns null when no source', () => {
    expect(dynamicReadPill([])).toBeNull();
    expect(dynamicReadPill(null)).toBeNull();
  });
});

describe('llmPills', () => {
  it('returns [] when anthropic unconfigured', async () => {
    anthropicClient.getClient.mockReturnValue(null);
    expect(await llmPills({ question: 'q', answer: 'a' })).toEqual([]);
  });
  it('returns [] when budget denied', async () => {
    anthropicClient.getClient.mockReturnValue({ messages: { create: jest.fn() } });
    botBudget.tryConsume.mockResolvedValue({ allowed: false, reason: 'minute' });
    expect(await llmPills({ question: 'q', answer: 'a' })).toEqual([]);
  });
  it('intersects model keys with the whitelist', async () => {
    anthropicClient.getClient.mockReturnValue({
      messages: {
        create: jest.fn(async () => ({
          content: [{ type: 'tool_use', name: 'emit_pills', input: { keys: ['book', 'nonsense', 'host'] } }],
        })),
      },
    });
    expect(await llmPills({ question: 'q', answer: 'a' })).toEqual(['book', 'host']);
  });
});

describe('buildPills', () => {
  it('returns [] when the flag is unset', async () => {
    delete process.env.BOT_PILLS_ENABLED;
    expect(await buildPills({ question: 'I want a refund' })).toEqual([]);
  });
  it('maps rule keys to valid vocab objects with proper shape', async () => {
    const pills = await buildPills({ question: 'I want a refund', source: 'model' });
    expect(pills.length).toBeGreaterThan(0);
    expect(pills.length).toBeLessThanOrEqual(3);
    for (const p of pills) {
      expect(typeof p.label).toBe('string');
      expect(['route', 'send']).toContain(p.action.type);
      expect(typeof p.action.value).toBe('string');
      expect(p.action.value).toBeTruthy();
    }
    expect(pills).toContainEqual(PILL_VOCAB.payments);
  });
  it('roast → ticket only, never calls the LLM', async () => {
    const spy = jest.spyOn(anthropicClient, 'getClient');
    expect(await buildPills({ question: 'x', source: 'roast' })).toEqual([PILL_VOCAB.ticket]);
    expect(spy).not.toHaveBeenCalled();
  });
  it('appends the cited-page pill on a model answer when there is room', async () => {
    const pills = await buildPills({
      question: 'how to become a host',
      source: 'model',
      cited_sources: [{ source_file: 'docs/help/become-a-host.md' }],
    });
    expect(pills).toContainEqual(PILL_VOCAB.host);
    expect(pills.some((p) => p.label.startsWith('Read: '))).toBe(true);
  });
});
