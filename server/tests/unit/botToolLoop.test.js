// Slice 1 — Tithi's agentic account tool-loop (read-only, authenticated thread only).
// Covers botTools (specs + executor) and botService.runToolLoop (the bounded model loop).
// Anthropic SDK, Supabase and budget are mocked; no live API is hit.

jest.mock('../../services/ai/anthropicClient', () => {
  const create = jest.fn();
  return {
    __create: create,
    MODELS: { generate: 'gen' },
    isConfigured: jest.fn(() => true),
    getClient: () => ({ messages: { create } }),
  };
});
jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../lib/botBudget', () => ({ tryConsume: jest.fn().mockResolvedValue({ allowed: true, reason: null }) }));

const client = require('../../services/ai/anthropicClient');
const botBudget = require('../../lib/botBudget');
const bt = require('../../services/bot/botTools');
const { runToolLoop } = require('../../services/botService');

const hostCtx = {
  kind: 'host',
  profile: { plan: 'premium' },
  host: { kyc: { status: 'approved' }, listingActive: true, payoutLinked: true },
  bookings: [{ ref: 'BK1', service: 'Yoga', status: 'confirmed', payment_status: 'paid', when: '2026-11-20T09:30:00Z' }],
};
const guestCtx = { kind: 'guest', bookings: [{ ref: 'BK9', status: 'confirmed', payment_status: 'paid' }] };

// Anthropic response shapes
const toolUse = (name, id = 't1') => ({ content: [{ type: 'tool_use', id, name, input: {} }] });
const textReply = (text) => ({ content: [{ type: 'text', text }] });

beforeEach(() => {
  client.__create.mockReset();
  client.isConfigured.mockReturnValue(true);
  botBudget.tryConsume.mockResolvedValue({ allowed: true, reason: null });
});

describe('botTools — specs are scoped to the caller', () => {
  test('host sees all five status tools', () => {
    expect(bt.toolSpecsFor(hostCtx).map((t) => t.name).sort()).toEqual(
      ['get_booking_status', 'get_listing_status', 'get_payout_status', 'get_plan_status', 'get_refund_status'],
    );
  });
  test('guest sees only the non-host tools', () => {
    expect(bt.toolSpecsFor(guestCtx).map((t) => t.name).sort()).toEqual(['get_booking_status', 'get_refund_status']);
  });
  test('no ctx never exposes a host-only tool', () => {
    expect(bt.toolSpecsFor(null).map((t) => t.name)).not.toContain('get_payout_status');
  });
});

describe('botTools — executor is safe', () => {
  test('booking status reads the host booking', () => {
    expect(bt.runTool('get_booking_status', hostCtx)).toMatch(/BK1/);
  });
  test('a host-only tool called for a guest returns NONE (no cross-account leak)', () => {
    expect(bt.runTool('get_payout_status', guestCtx)).toBe(bt.NONE);
  });
  test('unknown tool returns NONE and never throws', () => {
    expect(bt.runTool('definitely_not_a_tool', hostCtx)).toBe(bt.NONE);
  });
  test('no matching record returns NONE', () => {
    // No refund-shaped booking → refundAnswer null → NONE.
    expect(bt.runTool('get_refund_status', guestCtx)).toBe(bt.NONE);
  });
});

describe('runToolLoop — the bounded model loop', () => {
  test('calls the tool it picked, feeds the result back, returns the composed answer', async () => {
    client.__create
      .mockResolvedValueOnce(toolUse('get_booking_status'))
      .mockResolvedValueOnce(textReply('Your booking BK1 (Yoga) is confirmed and paid.'));

    const out = await runToolLoop('is my appointment confirmed?', hostCtx);

    expect(out).toEqual({ answer: 'Your booking BK1 (Yoga) is confirmed and paid.' });
    expect(client.__create).toHaveBeenCalledTimes(2);
    // Second call carries the tool_result for the id the model used.
    const secondMsgs = client.__create.mock.calls[1][0].messages;
    const toolResult = secondMsgs[secondMsgs.length - 1].content[0];
    expect(toolResult).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
    expect(toolResult.content).toMatch(/BK1/);
  });

  test('a direct answer with no tool call needs only one model call', async () => {
    client.__create.mockResolvedValueOnce(textReply('Happy to help — what would you like to check?'));
    const out = await runToolLoop('hey there', hostCtx);
    expect(out).toEqual({ answer: 'Happy to help — what would you like to check?' });
    expect(client.__create).toHaveBeenCalledTimes(1);
  });

  test('over budget → null (caller falls back to the regex path)', async () => {
    botBudget.tryConsume.mockResolvedValue({ allowed: false, reason: 'cap' });
    expect(await runToolLoop('where is my booking?', hostCtx)).toBeNull();
    expect(client.__create).not.toHaveBeenCalled();
  });

  test('empty model text → null (never posts a blank reply)', async () => {
    client.__create.mockResolvedValueOnce(textReply('   '));
    expect(await runToolLoop('where is my booking?', hostCtx)).toBeNull();
  });

  test('a model error → null, never throws', async () => {
    client.__create.mockRejectedValueOnce(new Error('boom'));
    expect(await runToolLoop('where is my booking?', hostCtx)).toBeNull();
  });
});
