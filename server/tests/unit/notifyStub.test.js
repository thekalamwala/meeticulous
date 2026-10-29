jest.mock('../../config/supabase', () => ({ supabaseAdmin: {} }));
jest.mock('../../services/aisensyService', () => ({ sendCampaign: jest.fn() }));
// sendEmail now routes through the provider abstraction: loadSettings() picks
// the provider, getProvider() dispatches. Point it at 'smtp' so the nodemailer
// mock below still intercepts the actual send.
jest.mock('../../services/email/communicationEngine', () => ({
  send: jest.fn(),
  loadSettings: jest.fn().mockResolvedValue({ provider: 'smtp', from_name: 'BAS', from_email: 'x@bas.in' }),
}));

const aisensy = require('../../services/aisensyService');
const comm = require('../../services/email/communicationEngine');
const engine = require('../../services/notificationEngine');

const mockSendMail = jest.fn().mockResolvedValue({});
jest.mock('nodemailer', () => ({ createTransport: () => ({ sendMail: mockSendMail }) }));
const sendEmail = require('../../utils/sendEmail');

describe('notification + smtp stubs in load mode', () => {
  const OLD = process.env;
  beforeEach(() => { process.env = { ...OLD }; jest.clearAllMocks(); });
  afterAll(() => { process.env = OLD; });

  test('engine short-circuits, no provider calls when load mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    const r = await engine.send({ event: 'BOOKING_OTP', data: { email: 'a@b.c', phone: '+910000000000', name: 'X' } });
    expect(r.email.stub).toBe(true);
    expect(r.whatsapp.stub).toBe(true);
    expect(aisensy.sendCampaign).not.toHaveBeenCalled();
    expect(comm.send).not.toHaveBeenCalled();
  });

  test('engine runs provider path when flag off', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    comm.send.mockResolvedValue({ ok: true, status: 'sent' });
    const r = await engine.send({ event: 'BOOKING_OTP', data: { email: 'a@b.c', name: 'X' } });
    expect(r.email.attempted).toBe(true);
    expect(comm.send).toHaveBeenCalled();
  });

  test('sendEmail does NOT hit SMTP in load mode', async () => {
    process.env.NODE_ENV = 'development';
    process.env.LOAD_TEST_MODE = 'true';
    await sendEmail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('sendEmail hits SMTP when flag off', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LOAD_TEST_MODE;
    await sendEmail({ to: 'a@b.c', subject: 's', html: '<p>x</p>' });
    expect(mockSendMail).toHaveBeenCalled();
  });
});
