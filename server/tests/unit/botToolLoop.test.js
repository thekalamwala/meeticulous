// Tithi's agentic account tool-loop (authenticated thread only).
//   Slice 1 — read-only status tools.
//   Slice 2 — the 3 email writes as tools behind a confirmation gate.
// Anthropic SDK, Supabase, budget and supportActions are mocked; no live API / email.

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
jest.mock('../../services/supportActions', () => ({
  latestBooking: jest.fn(),
  runAction: jest.fn(),
  detectAction: jest.fn(),
  cancelLinkInfo: jest.fn(),
}));

const client = require('../../services/ai/anthropicClient');
const botBudget = require('../../lib/botBudget');
const supportActions = require('../../services/supportActions');
const bt = require('../../services/bot/botTools');
const { runToolLoop } = require('../../services/botService');

const hostCtx = {
  kind: 'host',
  profile: { plan: 'premium' },
  host: { kyc: { status: 'approved' }, listingActive: true, payoutLinked: true },
  bookings: [{ ref: 'BK1', service: 'Yoga', status: 'confirmed', payment_status: 'paid', when: '2026-11-20T09:30:00Z' }],
};
const guestCtx = { kind: 'guest', bookings: [{ ref: 'BK9', status: 'confirmed', payment_status: 'paid' }] };
const identity = { userId: 'u1', guestPhone: null, isHost: true };

// Anthropic response shapes
const toolUse = (name, input = {}, id = 't1') => ({ content: [{ type: 'tool_use', id, name, input }] });
const textReply = (text) => ({ content: [{ type: 'text', text }] });

beforeEach(() => {
  client.__create.mockReset();
  client.isConfigured.mockReturnValue(true);
  botBudget.tryConsume.mockResolvedValue({ allowed: true, reason: null });
  supportActions.latestBooking.mockReset().mockResolvedValue({ service_title: 'Yoga', scheduled_at: '2026-11-20T09:30:00Z', guest_email: 'g@x.com' });
  supportActions.runAction.mockReset().mockResolvedValue({ ok: true, message: 'Sent — your invoice is on its way to g@x.com.' });
  supportActions.cancelLinkInfo.mockReset().mockResolvedValue({ ok: true, label: 'Yoga on 20 Nov', email: 'g@x.com', tierText: 'a 50% refund of the service price' });
});

describe('botTools — specs are scoped to the caller', () => {
  test('host sees the 5 read tools + 4 write tools', () => {
    const names = bt.toolSpecsFor(hostCtx).map((t) => t.name).sort();
    expect(names).toEqual([
      'get_booking_status', 'get_listing_status', 'get_payout_status', 'get_plan_status', 'get_refund_status',
      'resend_calendar', 'resend_confirmation', 'resend_invoice', 'send_cancel_link',
    ].sort());
  });
  test('guest sees only non-host reads + the writes (writes act on own booking)', () => {
    const names = bt.toolSpecsFor(guestCtx).map((t) => t.name).sort();
    expect(names).toEqual(['get_booking_status', 'get_refund_status', 'resend_calendar', 'resend_confirmation', 'resend_invoice', 'send_cancel_link'].sort());
  });
  test('no ctx never exposes a host-only read tool', () => {
    expect(bt.toolSpecsFor(null).map((t) => t.name)).not.toContain('get_payout_status');
  });
  test('isWriteTool flags only the resend tools', () => {
    expect(bt.isWriteTool('resend_invoice')).toBe(true);
    expect(bt.isWriteTool('get_booking_status')).toBe(false);
  });
});

describe('botTools — read executor is safe', () => {
  test('booking status reads the host booking', async () => {
    expect(await bt.runTool('get_booking_status', hostCtx)).toMatch(/BK1/);
  });
  test('a host-only tool called for a guest returns NONE', async () => {
    expect(await bt.runTool('get_payout_status', guestCtx)).toBe(bt.NONE);
  });
  test('unknown tool returns NONE and never throws', async () => {
    expect(await bt.runTool('definitely_not_a_tool', hostCtx)).toBe(bt.NONE);
  });
  test('no matching record returns NONE', async () => {
    expect(await bt.runTool('get_refund_status', guestCtx)).toBe(bt.NONE);
  });
});

describe('botTools — write executor is gated', () => {
  test('confirmed=false previews and sends NOTHING', async () => {
    const out = await bt.runTool('resend_invoice', hostCtx, identity, { confirmed: false });
    expect(out).toMatch(/PREVIEW/);
    expect(out).toMatch(/g@x\.com/);
    expect(supportActions.runAction).not.toHaveBeenCalled();
  });
  test('confirmed=true performs the action with the server-resolved identity', async () => {
    const out = await bt.runTool('resend_invoice', hostCtx, identity, { confirmed: true });
    expect(supportActions.runAction).toHaveBeenCalledWith('resend_invoice', identity);
    expect(out).toMatch(/on its way/);
  });
  test('a write with no identity refuses and never calls the action', async () => {
    expect(await bt.runTool('resend_invoice', hostCtx, null, { confirmed: true })).toBe(bt.NO_IDENTITY);
    expect(supportActions.runAction).not.toHaveBeenCalled();
  });
  test('missing input is treated as not-confirmed (preview, no send)', async () => {
    await bt.runTool('resend_calendar', hostCtx, identity, null);
    expect(supportActions.runAction).not.toHaveBeenCalled();
  });
});

describe('botTools — send_cancel_link (safe split: bot never cancels/refunds)', () => {
  test('preview discloses the refund tier and sends nothing', async () => {
    const out = await bt.runTool('send_cancel_link', hostCtx, identity, { confirmed: false });
    expect(out).toMatch(/50% refund/);
    expect(out).toMatch(/does NOT cancel/i);
    expect(supportActions.runAction).not.toHaveBeenCalled();
    expect(supportActions.cancelLinkInfo).toHaveBeenCalled();
  });
  test('preview surfaces a not-cancellable reason', async () => {
    supportActions.cancelLinkInfo.mockResolvedValueOnce({ ok: false, message: 'That booking is already completed.' });
    expect(await bt.runTool('send_cancel_link', hostCtx, identity, { confirmed: false })).toBe('That booking is already completed.');
    expect(supportActions.runAction).not.toHaveBeenCalled();
  });
  test('confirmed=true emails the secure link (no cancel performed by the bot)', async () => {
    supportActions.runAction.mockResolvedValueOnce({ ok: true, message: "Done — I've emailed your secure cancel link to g@x.com." });
    const out = await bt.runTool('send_cancel_link', hostCtx, identity, { confirmed: true });
    expect(supportActions.runAction).toHaveBeenCalledWith('send_cancel_link', identity);
    expect(out).toMatch(/secure cancel link/);
  });
  test('no identity refuses', async () => {
    expect(await bt.runTool('send_cancel_link', hostCtx, null, { confirmed: true })).toBe(bt.NO_IDENTITY);
    expect(supportActions.runAction).not.toHaveBeenCalled();
  });
});

describe('runToolLoop — reads', () => {
  test('calls the tool, feeds the result back, returns the composed answer', async () => {
    client.__create
      .mockResolvedValueOnce(toolUse('get_booking_status'))
      .mockResolvedValueOnce(textReply('Your booking BK1 (Yoga) is confirmed and paid.'));
    const out = await runToolLoop('is my appointment confirmed?', hostCtx, identity, null);
    expect(out).toMatchObject({ answer: 'Your booking BK1 (Yoga) is confirmed and paid.', didWrite: false });
    expect(client.__create).toHaveBeenCalledTimes(2);
    const secondMsgs = client.__create.mock.calls[1][0].messages;
    const toolResult = secondMsgs[secondMsgs.length - 1].content[0];
    expect(toolResult).toMatchObject({ type: 'tool_result', tool_use_id: 't1' });
    expect(toolResult.content).toMatch(/BK1/);
  });
  test('a direct answer with no tool call needs only one model call', async () => {
    client.__create.mockResolvedValueOnce(textReply('Happy to help — what would you like to check?'));
    const out = await runToolLoop('hey there', hostCtx, identity, null);
    expect(out).toMatchObject({ answer: 'Happy to help — what would you like to check?', didWrite: false });
    expect(client.__create).toHaveBeenCalledTimes(1);
  });
});

describe('runToolLoop — writes behind the confirm gate', () => {
  test('first ask → preview only, nothing sent, didWrite false', async () => {
    client.__create
      .mockResolvedValueOnce(toolUse('resend_invoice', { confirmed: false }))
      .mockResolvedValueOnce(textReply('I can resend your invoice to g@x.com — want me to?'));
    const out = await runToolLoop('resend my invoice', hostCtx, identity, null);
    expect(out.didWrite).toBe(false);
    expect(supportActions.runAction).not.toHaveBeenCalled();
    expect(out.answer).toMatch(/want me to/i);
  });
  test('after the user confirms → the write runs, didWrite true', async () => {
    client.__create
      .mockResolvedValueOnce(toolUse('resend_invoice', { confirmed: true }))
      .mockResolvedValueOnce(textReply('Done — sent to g@x.com.'));
    const history = [
      { role: 'user', content: 'resend my invoice' },
      { role: 'assistant', content: 'I can resend your invoice to g@x.com — want me to?' },
    ];
    const out = await runToolLoop('yes please', hostCtx, identity, history);
    expect(supportActions.runAction).toHaveBeenCalledWith('resend_invoice', identity);
    expect(out.didWrite).toBe(true);
    expect(out.answer).toMatch(/Done/);
  });
});

describe('runToolLoop — guards', () => {
  test('over budget → null (caller falls back to the regex path)', async () => {
    botBudget.tryConsume.mockResolvedValue({ allowed: false, reason: 'cap' });
    expect(await runToolLoop('where is my booking?', hostCtx, identity, null)).toBeNull();
    expect(client.__create).not.toHaveBeenCalled();
  });
  test('empty model text → null', async () => {
    client.__create.mockResolvedValueOnce(textReply('   '));
    expect(await runToolLoop('where is my booking?', hostCtx, identity, null)).toBeNull();
  });
  test('a model error → null, never throws', async () => {
    client.__create.mockRejectedValueOnce(new Error('boom'));
    expect(await runToolLoop('where is my booking?', hostCtx, identity, null)).toBeNull();
  });
});
