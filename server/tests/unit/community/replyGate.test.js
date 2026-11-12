'use strict';
// replyGate — the cheapest-first community relevance gate. AI + budget are mocked so the
// Tier-0 heuristic, routing and fail-safes are asserted without a live model.

let mockConfigured = true;
let mockTriage = { answerable: true, route: 'support' };
let mockThrow = false;
const mockCreateSpy = jest.fn();
jest.mock('../../../services/ai/anthropicClient', () => ({
  isConfigured: () => mockConfigured,
  getClient: () => ({
    messages: {
      create: async (args) => {
        mockCreateSpy(args);
        if (mockThrow) throw new Error('boom');
        return { content: [{ type: 'tool_use', name: 'triage', input: mockTriage }] };
      },
    },
  }),
  MODELS: { generate: 'haiku' },
}));
let mockBudget = { allowed: true };
jest.mock('../../../lib/botBudget', () => ({ tryConsume: async () => mockBudget }));

const gate = require('../../../services/community/replyGate');

beforeEach(() => {
  mockConfigured = true;
  mockTriage = { answerable: true, route: 'support' };
  mockThrow = false;
  mockBudget = { allowed: true };
  mockCreateSpy.mockClear();
});

describe('looksLikeQuestion (Tier 0, free)', () => {
  test('question / problem text passes', () => {
    expect(gate.looksLikeQuestion('how do payouts work?')).toBe(true);
    expect(gate.looksLikeQuestion('my calendar is not syncing')).toBe(true);
    expect(gate.looksLikeQuestion('can Meeticulous do recurring bookings like Calendly?')).toBe(true);
  });
  test('announcements / showcase / chit-chat / too-short fall out free', () => {
    expect(gate.looksLikeQuestion('Just shipped my new booking page, so proud!')).toBe(false);
    expect(gate.looksLikeQuestion('loving this community lately')).toBe(false);
    expect(gate.looksLikeQuestion('hi')).toBe(false);
    expect(gate.looksLikeQuestion('')).toBe(false);
  });
});

describe('decide (Tier 0 → Tier 1)', () => {
  test('a non-question short-circuits WITHOUT any model call', async () => {
    const res = await gate.decide({ body: 'Just shipped my page!' });
    expect(res).toEqual({ act: false, route: 'not_for_us', reason: 'not_a_question' });
    expect(mockCreateSpy).not.toHaveBeenCalled();
  });
  test('answerable support question → act, route support', async () => {
    mockTriage = { answerable: true, route: 'support' };
    expect(await gate.decide({ body: 'how do I set up payouts?' })).toEqual({ act: true, route: 'support', reason: 'support' });
    expect(mockCreateSpy).toHaveBeenCalledTimes(1);
  });
  test('comparison routed for pitch', async () => {
    mockTriage = { answerable: true, route: 'comparison' };
    expect(await gate.decide({ body: 'can you do recurring bookings like Calendly?' })).toMatchObject({ act: true, route: 'comparison' });
  });
  test('classifier says not_for_us → silent', async () => {
    mockTriage = { answerable: false, route: 'not_for_us' };
    expect(await gate.decide({ body: 'is anyone else loving the new colours?' })).toMatchObject({ act: false });
  });
  test('AI off → silent (fail-safe)', async () => {
    mockConfigured = false;
    expect(await gate.decide({ body: 'how do I add a service?' })).toMatchObject({ act: false, reason: 'classify_unavailable' });
    expect(mockCreateSpy).not.toHaveBeenCalled();
  });
  test('budget spent → silent', async () => {
    mockBudget = { allowed: false };
    expect(await gate.decide({ body: 'how do I add a service?' })).toMatchObject({ act: false });
    expect(mockCreateSpy).not.toHaveBeenCalled();
  });
  test('model error → silent', async () => {
    mockThrow = true;
    expect(await gate.decide({ body: 'how do I add a service?' })).toMatchObject({ act: false });
  });
});

describe('appendCta (pitch — comparison only)', () => {
  test('comparison gets one pricing CTA', () => {
    expect(gate.appendCta('We do that too.', 'comparison')).toBe('We do that too.\n\n[See plans & pricing](/pricing)');
  });
  test('support answers are untouched', () => {
    expect(gate.appendCta('Here is how.', 'support')).toBe('Here is how.');
  });
  test('no double-link when the answer already points to pricing', () => {
    expect(gate.appendCta('Yep — [see pricing](/pricing).', 'comparison')).toBe('Yep — [see pricing](/pricing).');
  });
});
