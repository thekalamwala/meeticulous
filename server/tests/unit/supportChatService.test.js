// Unit tests for supportChatService — thread/message engine for support chat.
// supabaseAdmin + the broadcast fetch are mocked; nothing leaves the process.

process.env.SUPABASE_URL = 'http://sb.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/adminAlert', () => jest.fn(() => Promise.resolve({ sent: true })));
jest.mock('../../utils/supportHours', () => ({ isOpen: jest.fn(() => true), LABEL: 'Mon–Fri, 10am–6pm IST' }));

const { supabaseAdmin } = require('../../config/supabase');
const adminAlert = require('../../utils/adminAlert');
const supportHours = require('../../utils/supportHours');
const chat = require('../../services/supportChatService');

// Chainable builder whose terminals (single/maybeSingle) and await (.then) resolve `result`.
const makeChain = (result) => {
  const chain = {};
  for (const m of ['select', 'insert', 'update', 'eq', 'neq', 'order', 'limit']) chain[m] = jest.fn(() => chain);
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  chain.then = (resolve) => resolve(result);
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
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
  // …and emails the team, throttled per-thread.
  expect(adminAlert).toHaveBeenCalledWith(expect.objectContaining({ key: 'support-escalation:t1' }));
});

test('escalate outside support hours does NOT ring, but still emails', async () => {
  supportHours.isOpen.mockReturnValueOnce(false);
  supabaseAdmin.from.mockReturnValueOnce(makeChain({ data: { id: 't1', status: 'waiting', reference: 'SUP-1' } }));
  await chat.escalate('t1', 'after hours');
  const rang = global.fetch.mock.calls.some((c) => JSON.parse(c[1].body).messages[0].topic === 'support:admin');
  expect(rang).toBe(false);            // no admin ring off-hours
  expect(adminAlert).toHaveBeenCalled(); // email still fires
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
