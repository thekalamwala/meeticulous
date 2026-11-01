/**
 * /become-a-host "Book a Demo" lead form — capture model + verify semantics:
 *  - the lead is captured on send-otp (Meta suppressed) so drop-offs are kept,
 *  - a valid OTP on submit tags the lead `phone-verified` and fires the Meta Lead,
 *  - an invalid OTP never tags/fires,
 *  - the honeypot silently drops bots.
 */
jest.mock('../../utils/otpStore', () => ({
  generate: jest.fn(() => '123456'),
  set: jest.fn(async () => ({ ok: true })),
  verify: jest.fn(),
}));
jest.mock('../../utils/notify', () => ({ sendOtpNotification: jest.fn(async () => {}) }));
jest.mock('../../services/aisensyService', () => ({
  normalizePhone: (p) => (p ? String(p).replace(/\D/g, '').slice(-10) : null),
}));
jest.mock('../../services/crm/leadService', () => ({
  safeUpsertLead: jest.fn(),
  addTag: jest.fn(async () => {}),
}));
jest.mock('../../utils/trackServer', () => ({ sendMetaCrmLead: jest.fn() }));
jest.mock('../../services/crm/intentEvents', () => ({ record: jest.fn(async () => {}) }));
jest.mock('../../utils/httpError', () => ({ safeError: (res, e) => res.status(500).json({ error: e.message }) }));

const otpStore = require('../../utils/otpStore');
const { safeUpsertLead, addTag } = require('../../services/crm/leadService');
const { sendMetaCrmLead } = require('../../utils/trackServer');
const { sendLeadOtp, submitLead } = require('../../controllers/demoLeadController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};
const base = { name: 'Aditi', phone: '9876543210', profession: 'Coach', otp: '123456' };

beforeEach(() => {
  jest.clearAllMocks();
  safeUpsertLead.mockResolvedValue({ lead: { id: 'lead-1' }, created: true });
});

test('send-otp captures the lead immediately with Meta suppressed', async () => {
  const res = mockRes();
  await sendLeadOtp({ body: base, headers: {} }, res);
  expect(safeUpsertLead).toHaveBeenCalledTimes(1);
  const [patch, opts] = safeUpsertLead.mock.calls[0];
  expect(patch).toMatchObject({ name: 'Aditi', phone: '9876543210', profession: 'Coach' });
  expect(opts.source).toBe('website');
  expect(opts.skipMetaLead).toBe(true);       // deferred until verified
  expect(otpStore.set).toHaveBeenCalled();
});

test('a valid OTP tags the lead phone-verified and fires the Meta Lead', async () => {
  otpStore.verify.mockResolvedValue({ valid: true });
  const res = mockRes();
  await submitLead({ body: base, headers: {} }, res);
  expect(addTag).toHaveBeenCalledWith('lead-1', 'phone-verified');
  expect(sendMetaCrmLead).toHaveBeenCalledTimes(1);
  expect(res.status).toHaveBeenCalledWith(201);
});

test('an invalid OTP never tags the lead or fires Meta', async () => {
  otpStore.verify.mockResolvedValue({ valid: false, reason: 'Invalid OTP.' });
  const res = mockRes();
  await submitLead({ body: base, headers: {} }, res);
  expect(addTag).not.toHaveBeenCalled();
  expect(sendMetaCrmLead).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(400);
});

test('honeypot submissions are silently dropped (no lead, no tag)', async () => {
  const res = mockRes();
  await sendLeadOtp({ body: { ...base, company_hp: 'bot' }, headers: {} }, res);
  await submitLead({ body: { ...base, company_hp: 'bot' }, headers: {} }, res);
  expect(safeUpsertLead).not.toHaveBeenCalled();
  expect(addTag).not.toHaveBeenCalled();
});
