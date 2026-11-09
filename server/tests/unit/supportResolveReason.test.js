// Resolve requires a valid contact-reason code, so no ticket closes (untagged).

jest.mock('../../config/supabase', () => ({ supabaseAdmin: { from: jest.fn() } }));
jest.mock('../../services/supportChatService', () => ({
  getThread: jest.fn(), setReasonCode: jest.fn(), postMessage: jest.fn(), resolve: jest.fn(),
}));
jest.mock('../../services/supportContextService', () => ({ getSupportContext: jest.fn() }));

const chat = require('../../services/supportChatService');
const { resolve } = require('../../controllers/supportAdminController');

const mkRes = () => { const r = {}; r.json = jest.fn(() => r); r.status = jest.fn(() => r); return r; };
const req = (body) => ({ admin: { id: 'adm-uuid' }, params: { id: 't1' }, body });

beforeEach(() => {
  jest.clearAllMocks();
  chat.getThread.mockResolvedValue({ id: 't1' });
  chat.resolve.mockResolvedValue({ id: 't1', status: 'resolved' });
});

test.each([
  ['missing', {}],
  ['empty', { reason_code: '' }],
  ['unknown', { reason_code: 'made_up' }],
  ['non-string that coerces to a valid code', { reason_code: ['other'] }],
  ['inherited object key', { reason_code: 'toString' }],
])('rejects a %s reason code and leaves the thread open', async (_name, body) => {
  const res = mkRes();
  await resolve(req(body), res);

  expect(res.status).toHaveBeenCalledWith(400);
  expect(chat.resolve).not.toHaveBeenCalled();
  expect(chat.postMessage).not.toHaveBeenCalled();
  expect(chat.setReasonCode).not.toHaveBeenCalled();
});

test('stamps the code and resolves when the reason is valid', async () => {
  const res = mkRes();
  await resolve(req({ reason_code: 'host_payout' }), res);

  expect(res.status).not.toHaveBeenCalled();
  expect(chat.setReasonCode).toHaveBeenCalledWith('t1', 'host_payout');
  expect(chat.resolve).toHaveBeenCalledWith('t1');
  expect(res.json).toHaveBeenCalledWith({ thread: { id: 't1', status: 'resolved' } });
});

test('unknown thread is still a 404 when the reason is valid', async () => {
  chat.getThread.mockResolvedValue(null);
  const res = mkRes();
  await resolve(req({ reason_code: 'other' }), res);

  expect(res.status).toHaveBeenCalledWith(404);
  expect(chat.resolve).not.toHaveBeenCalled();
});
