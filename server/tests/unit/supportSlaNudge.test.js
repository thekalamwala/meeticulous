// supportSlaNudge — real supportHours and intro detection; only DB + email are mocked.
// All instants are on Tue 2026-08-25 / Wed 2026-08-26, inside 10:00–18:00 IST.
jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn() }));

const { supabaseAdmin } = require('../../config/supabase');
const { adminAlert } = require('../../utils/adminAlert');
const { introMessage } = require('../../config/supportAgents');
const { run } = require('../../services/supportSlaNudge');

const HANDOFF = '2026-08-25T05:00:00.000Z'; // 10:30 IST
const AT = {
  under: new Date('2026-08-25T06:59:00Z'),  // 1h59 in
  p1: new Date('2026-08-25T07:00:00Z'),     // 2h in
  p2: new Date('2026-08-26T05:00:00Z'),     // 8h in (one full business day)
};

const thread = (extra = {}) => ({
  id: 't1', reference: 'SUP-AAAAAA', participant_type: 'host', status: 'waiting', agent_name: null,
  created_at: '2026-08-20T05:00:00Z', sla_waiting_since: HANDOFF,
  sla_alerted_clock: null, sla_alerted_level: null, ...extra,
});
const msg = (sender, created_at, body = 'hello') => ({ thread_id: 't1', sender, created_at, body });

function setup(threads, messages = [], errors = {}) {
  const query = (result) => {
    const q = { then: (resolve) => resolve(result) };
    for (const m of ['select', 'in', 'order']) q[m] = jest.fn(() => q);
    return q;
  };
  const stamp = jest.fn(() => ({ eq: jest.fn(() => Promise.resolve({ error: null })) }));
  supabaseAdmin.from.mockImplementation((table) => (table === 'support_messages'
    ? query({ data: errors.messages ? null : messages, error: errors.messages || null })
    : { ...query({ data: errors.threads ? null : threads, error: errors.threads || null }), update: stamp }));
  return stamp;
}

beforeEach(() => {
  jest.clearAllMocks();
  adminAlert.mockResolvedValue({ sent: true });
});

test('no alert under 2 business hours', async () => {
  setup([thread()]);
  expect(await run(AT.under)).toEqual({ alerted: 0 });
  expect(adminAlert).not.toHaveBeenCalled();
});

test('P1 at 2 business hours: alerts once and records the breach', async () => {
  const stamp = setup([thread()]);
  expect(await run(AT.p1)).toEqual({ alerted: 1 });
  expect(adminAlert.mock.calls[0][0].subject).toBe('Support SLA breach (P1) — SUP-AAAAAA');
  expect(stamp).toHaveBeenCalledWith({ sla_alerted_clock: HANDOFF, sla_alerted_level: 1 });
});

test('a recorded breach is not alerted again', async () => {
  setup([thread({ sla_alerted_clock: '2026-08-25T05:00:00+00:00', sla_alerted_level: 1 })]);
  expect(await run(AT.p1)).toEqual({ alerted: 0 });
});

test('P2 still fires after P1 for the same wait', async () => {
  const stamp = setup([thread({ sla_alerted_clock: HANDOFF, sla_alerted_level: 1 })]);
  await run(AT.p2);
  expect(adminAlert.mock.calls[0][0].subject).toContain('(P2)');
  expect(stamp).toHaveBeenCalledWith({ sla_alerted_clock: HANDOFF, sla_alerted_level: 2 });
});

test('a thread past both targets gets one alert, at the higher level', async () => {
  setup([thread()]);
  await run(AT.p2);
  expect(adminAlert).toHaveBeenCalledTimes(1);
  expect(adminAlert.mock.calls[0][0].subject).toContain('(P2)');
});

test('the auto-intro on claim does not stop the clock', async () => {
  setup([thread({ status: 'assigned' })], [msg('admin', '2026-08-25T05:10:00Z', introMessage('Tithi', 'Asha'))]);
  expect(await run(AT.p1)).toEqual({ alerted: 1 });
});

test('a real human reply stops the clock', async () => {
  setup([thread({ status: 'assigned' })], [msg('admin', '2026-08-25T05:10:00Z', 'Refund is on its way')]);
  expect(await run(AT.p2)).toEqual({ alerted: 0 });
});

test('a customer reply after the human starts a new wait that can breach again', async () => {
  const followUp = '2026-08-25T06:00:00.000Z';
  const stamp = setup(
    [thread({ status: 'assigned', sla_alerted_clock: HANDOFF, sla_alerted_level: 2 })],
    [msg('user', followUp), msg('admin', '2026-08-25T05:10:00Z', 'Done, please check')],
  );
  expect(await run(AT.p2)).toEqual({ alerted: 1 });
  expect(stamp).toHaveBeenCalledWith({ sla_alerted_clock: followUp, sla_alerted_level: 1 });
});

test('a thread handed off before the migration uses its first customer message', async () => {
  setup([thread({ sla_waiting_since: null })], [msg('user', HANDOFF)]);
  expect(await run(AT.p1)).toEqual({ alerted: 1 });
});

test('a failed send is not recorded, so the next run retries', async () => {
  adminAlert.mockResolvedValue({ sent: false, reason: 'send_error' });
  const stamp = setup([thread()]);
  expect(await run(AT.p1)).toEqual({ alerted: 0 });
  expect(stamp).not.toHaveBeenCalled();
});

test.each(['threads', 'messages'])('sends nothing and fails the job when the %s query fails', async (which) => {
  setup([thread()], [], { [which]: { message: 'column does not exist' } });
  await expect(run(AT.p1)).rejects.toThrow('column does not exist');
  expect(adminAlert).not.toHaveBeenCalled();
});
