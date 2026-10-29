jest.mock('../../utils/otpStore');
jest.mock('../../utils/notify');
jest.mock('../../utils/adminAlert', () => ({ adminAlert: jest.fn().mockResolvedValue({ sent: false }) }));
jest.mock('../../config/supabase', () => ({
  supabaseAdmin: { from: jest.fn() },
}));

const otpStore = require('../../utils/otpStore');
const notify = require('../../utils/notify');
const { adminAlert } = require('../../utils/adminAlert');
const { supabaseAdmin } = require('../../config/supabase');
const { sendOtp, verifyOtp } = require('../../controllers/whatsappController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('whatsappController.sendOtp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects an invalid phone with 400', async () => {
    const res = mockRes();
    await sendOtp({ user: { id: 'u1' }, body: { phone: 'abc' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(otpStore.set).not.toHaveBeenCalled();
  });

  it('generates+stores OTP and sends WhatsApp for a valid phone', async () => {
    otpStore.generate.mockReturnValue('123456');
    otpStore.set.mockResolvedValue({ ok: true });
    notify.sendWhatsAppVerifyOtp.mockResolvedValue(true);
    const res = mockRes();
    await sendOtp({ user: { id: 'u1', name: 'Sam' }, body: { phone: '+919876543210' } }, res);
    expect(otpStore.set).toHaveBeenCalledWith('wa:919876543210', '123456');
    expect(notify.sendWhatsAppVerifyOtp).toHaveBeenCalledWith({ phone: '919876543210', otp: '123456', name: 'Sam' });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it('returns 502 when the WhatsApp send fails (e.g. provider rejects the number)', async () => {
    otpStore.generate.mockReturnValue('123456');
    otpStore.set.mockResolvedValue({ ok: true });
    notify.sendWhatsAppVerifyOtp.mockResolvedValue(false);
    const res = mockRes();
    await sendOtp({ user: { id: 'u1', name: 'Sam' }, body: { phone: '+447760380550' } }, res);
    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message: expect.stringContaining('country code') })
    );
    // Ops gets a throttled alert so a systemic outage isn't invisible.
    expect(adminAlert).toHaveBeenCalledWith(expect.objectContaining({ key: 'wa_verify_send_fail' }));
  });

  it('surfaces a rate-limit reason with 429', async () => {
    otpStore.generate.mockReturnValue('123456');
    otpStore.set.mockResolvedValue({ ok: false, reason: 'Too many OTP requests. Try again in 15 minutes.' });
    const res = mockRes();
    await sendOtp({ user: { id: 'u1' }, body: { phone: '+919876543210' } }, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(notify.sendWhatsAppVerifyOtp).not.toHaveBeenCalled();
  });
});

describe('whatsappController.verifyOtp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('rejects a bad OTP with success:false', async () => {
    otpStore.verify.mockResolvedValue({ valid: false, reason: 'Invalid OTP. 2 attempt(s) left.' });
    const res = mockRes();
    await verifyOtp({ user: { id: 'u1' }, body: { phone: '+919876543210', otp: '000000' } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, verified: false })
    );
  });

  it('returns 400 when phone or otp is missing', async () => {
    const res = mockRes();
    await verifyOtp({ user: { id: 'u1' }, body: { phone: '', otp: '' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(otpStore.verify).not.toHaveBeenCalled();
  });

  it('persists profile + returns verified on a good OTP', async () => {
    otpStore.verify.mockResolvedValue({ valid: true });
    const eq = jest.fn().mockResolvedValue({ error: null });
    const update = jest.fn().mockReturnValue({ eq });
    supabaseAdmin.from.mockReturnValue({ update });
    const res = mockRes();
    await verifyOtp({ user: { id: 'u1' }, body: { phone: '+919876543210', otp: '123456' } }, res);
    expect(supabaseAdmin.from).toHaveBeenCalledWith('profiles');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      whatsapp_number: '919876543210', // stored NORMALIZED, not the raw '+' input
      whatsapp_verified: true,
    }));
    expect(eq).toHaveBeenCalledWith('id', 'u1');
    expect(res.json).toHaveBeenCalledWith({ success: true, verified: true });
  });
});
