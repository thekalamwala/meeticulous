// Unit tests for supportChatService — thread/message engine for support chat.
// supabaseAdmin + the broadcast fetch + sendEmail are mocked; nothing leaves the process.
// adminAlert is deliberately REAL: a mock of it once hid a wrong import shape, so
// escalate() threw in production while these tests passed.

process.env.SUPABASE_URL = 'http://sb.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
process.env.SUPPORT_EMAIL = 'support@example.test';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/sendEmail', () => jest.fn(() => Promise.resolve()));
jest.mock('../../utils/supportHours', () => ({ isOpen: jest.fn(() => true), LABEL: 'Mon–Fri, 10am–6pm IST' }));

const { supabaseAdmin } = require('../../config/supabase');
const sendEmail = require('../../utils/sendEmail');
const { adminAlert } = require('../../utils/adminAlert');
const supportHours = require('../../utils/supportHours');
const chat = require('../../services/supportChatService');

// Chainable builder whose terminals (single/maybeSingle) and await (.then) resolve `result`.
const makeChain = (result) => {
  const chain = {};
  for (const m of ['select', 'insert', 'update', 'eq', 'neq', 'in', 'order', 'limit']) chain[m] = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  chain.then = (resolve) => resolve(result);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
  adminAlert._resetThrottle();
  global.fetch = jest.fn(() => Promise.resolve({ ok: true }));
});

test('refFrom derives a SUP- reference from a uuid', () => {
  expect(chat.refFrom('8f92abcd-1234-5678-9abc-def012345678')).toBe('SUP-8F92AB');
});

test('postMessage inserts, accrues unread to the other side, and broadcasts', async () => {
  const msg = { id: 'm1', thread_id: 't1', sender: 'user', created_at: '2026-08-25T00:00:00Z' };
  const insertChain = makeChain({ data: msg });
  const threadChain = makeChain({ data: { id: 't1', admin_unread: 0, user_unread: 0 } });
  const updateChain = makeChain({ data: {} });
  supabaseAdmin.from
    .mockReturnValueOnce(insertChain)   // insert message
    .mockReturnValueOnce(threadChain)   // getThread
    .mockReturnValueOnce(updateChain);  // update thread counters

  const out = await chat.postMessage({ threadId: 't1', sender: 'user', body: 'hello' });

  expect(out.id).toBe('m1');
  // a user message accrues unread to the admin side
  expect(updateChain.update).toHaveBeenCalledWith(expect.objectContaining({ admin_unread: 1 }));
  // broadcast fired to the thread channel
  expect(global.fetch).toHaveBeenCalledTimes(1);
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.messages[0].topic).toBe('support:thread:t1');
  expect(body.messages[0].event).toBe('message');
});

test('an admin message accrues unread to the user side', async () => {
  const upd = makeChain({ data: {} });
  supabaseAdmin.from
    .mockReturnValueOnce(makeChain({ data: { id: 'm2', sender: 'admin', created_at: 'x' } })) // insert
    .mockReturnValueOnce(makeChain({ data: { id: 't1', admin_unread: 0, user_unread: 3 } }))   // getThread
    .mockReturnValueOnce(upd);                                                                 // update

  await chat.postMessage({ threadId: 't1', sender: 'admin', body: 'on it' });
  expect(upd.update).toHaveBeenCalledWith(expect.objectContaining({ user_unread: 4 }));
});

test('escalate sets status waiting and broadcasts a status event', async () => {
  const upd = makeChain({ data: { id: 't1', status: 'waiting' } });
  supabaseAdmin.from.mockReturnValueOnce(upd);

  const out = await chat.escalate('t1', 'payout question');

  expect(upd.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'waiting', ai_summary: 'payout question' }));
  expect(out.status).toBe('waiting');
  const body = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(body.messages[0].event).toBe('status');
  // Rings every admin console over the station channel…
  const adminMsg = global.fetch.mock.calls
    .map((c) => JSON.parse(c[1].body).messages[0])
    .find((m) => m.topic === 'support:admin');
  expect(adminMsg.event).toBe('escalation');
  expect(adminMsg.payload.thread_id).toBe('t1');
  // …and emails the support inbox.
  expect(sendEmail).toHaveBeenCalledTimes(1);
  expect(sendEmail.mock.calls[0][0].to).toBe('support@example.test');
});

test('re-escalating the same thread emails once (throttled per-thread)', async () => {
  const row = { data: { id: 't1', status: 'waiting', reference: 'SUP-1' } };
  supabaseAdmin.from.mockReturnValueOnce(makeChain(row)).mockReturnValueOnce(makeChain(row));
  await chat.escalate('t1', 'first');
  await chat.escalate('t1', 'again');
  expect(sendEmail).toHaveBeenCalledTimes(1);
});

test('escalate outside support hours neither rings nor emails — it waits for the digest', async () => {
  supportHours.isOpen.mockReturnValueOnce(false);
  supabaseAdmin.from.mockReturnValueOnce(makeChain({ data: { id: 't1', status: 'waiting', reference: 'SUP-1' } }));
  const out = await chat.escalate('t1', 'after hours');
  const rang = global.fetch.mock.calls.some((c) => JSON.parse(c[1].body).messages[0].topic === 'support:admin');
  expect(rang).toBe(false);
  expect(sendEmail).not.toHaveBeenCalled();
  expect(out.status).toBe('waiting'); // still in the queue the digest reads
});

test('sendWaitingDigest emails the support inbox one list of waiting threads', async () => {
  const queue = makeChain({ data: [
    { id: 't1', reference: 'SUP-AAA111', participant_type: 'host', ai_summary: 'Payout\nmissing' },
    { id: 't2', reference: 'SUP-BBB222', participant_type: 'guest', guest_phone: '+919800000000', ai_summary: null },
  ] });
  supabaseAdmin.from
    .mockReturnValueOnce(queue)
    .mockReturnValueOnce(makeChain({ data: [{ thread_id: 't2', body: 'Where is my invoice?' }] }));

  const out = await chat.sendWaitingDigest();

  expect(queue.eq).toHaveBeenCalledWith('status', 'waiting');
  expect(out).toMatchObject({ sent: true, count: 2 });
  expect(sendEmail).toHaveBeenCalledTimes(1);
  const mail = sendEmail.mock.calls[0][0];
  expect(mail.to).toBe('support@example.test');
  expect(mail.subject).toContain('2 support threads');
  expect(mail.text).toContain('SUP-AAA111: Host · Payout missing');
  expect(mail.text).toContain('SUP-BBB222: Guest · +919800000000 · Where is my invoice?');
});

test('sendWaitingDigest sends nothing when no thread is waiting', async () => {
  supabaseAdmin.from.mockReturnValueOnce(makeChain({ data: [] }));
  expect(await chat.sendWaitingDigest()).toMatchObject({ sent: false, count: 0 });
  expect(sendEmail).not.toHaveBeenCalled();
});

test('markRead zeroes the correct counter', async () => {
  const upd = makeChain({ data: {} });
  supabaseAdmin.from.mockReturnValueOnce(upd);
  await chat.markRead('t1', 'admin');
  expect(upd.update).toHaveBeenCalledWith({ admin_unread: 0 });
});

test('getOrCreateOpenThread returns an existing open thread without inserting', async () => {
  supabaseAdmin.from.mockReturnValueOnce(makeChain({ data: [{ id: 't9', status: 'assigned' }] }));
  const t = await chat.getOrCreateOpenThread({ participantType: 'host', userId: 'u1' });
  expect(t.id).toBe('t9');
  expect(supabaseAdmin.from).toHaveBeenCalledTimes(1); // no insert
});

test('getOpenThread returns the open thread, never inserting', async () => {
  supabaseAdmin.from.mockReturnValueOnce(makeChain({ data: [{ id: 't5', user_unread: 3 }] }));
  const t = await chat.getOpenThread({ userId: 'u1' });
  expect(t).toMatchObject({ id: 't5', user_unread: 3 });
  expect(supabaseAdmin.from).toHaveBeenCalledTimes(1); // read only
});

test('getOpenThread returns null when there is no open thread', async () => {
  supabaseAdmin.from.mockReturnValueOnce(makeChain({ data: [] }));
  expect(await chat.getOpenThread({ userId: 'u1' })).toBeNull();
});
