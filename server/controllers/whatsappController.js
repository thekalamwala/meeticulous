const otpStore = require('../utils/otpStore');
const notify = require('../utils/notify');
const aisensy = require('../services/aisensyService');
const { supabaseAdmin } = require('../config/supabase');

// Namespace WhatsApp OTPs so they never collide with login/booking OTPs.
const otpKey = (normalized) => `wa:${normalized}`;

// POST /api/whatsapp/send-otp  { phone }
const sendOtp = async (req, res) => {
  const normalized = aisensy.normalizePhone(req.body?.phone);
  if (!normalized) {
    return res.status(400).json({ success: false, message: 'Enter a valid WhatsApp number.' });
  }
  const otp = otpStore.generate();
  const stored = await otpStore.set(otpKey(normalized), otp);
  if (!stored.ok) {
    return res.status(429).json({ success: false, message: stored.reason });
  }
  const sent = await notify.sendWhatsAppVerifyOtp({ phone: normalized, otp, name: req.user?.name });
  if (!sent) {
    // Ops signal: a per-number failure is usually a bad number, but a systemic
    // AiSensy outage stalls every host on this step at once. Throttled on a
    // constant key so an outage sends ONE alert, not one per host. Best-effort.
    require('../utils/adminAlert').adminAlert({
      subject: 'WhatsApp OTP delivery failing',
      lines: [
        'A WhatsApp verification code failed to send during onboarding.',
        `Number: ${normalized}`,
        req.user?.id ? `Host: ${req.user.id}` : 'Sender: unauthenticated',
      ],
      key: 'wa_verify_send_fail',
    }).catch(() => {});
    return res.status(502).json({
      success: false,
      message: 'We could not deliver the code on WhatsApp. Check the country code and make sure this number has WhatsApp.',
    });
  }
  return res.json({ success: true });
};

// POST /api/whatsapp/verify-otp  { phone, otp }
const verifyOtp = async (req, res) => {
  if (!req.user?.id) {
    return res.status(401).json({ success: false, verified: false, message: 'Authentication required.' });
  }
  const { phone, otp } = req.body || {};
  const normalized = aisensy.normalizePhone(phone);
  if (!normalized || !otp) {
    return res.status(400).json({ success: false, verified: false, message: 'Phone and OTP are required.' });
  }
  const result = await otpStore.verify(otpKey(normalized), otp);
  if (!result.valid) {
    return res.json({ success: false, verified: false, message: result.reason });
  }
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      // Store the NORMALIZED number (verified against `normalized`); the raw
      // request `phone` could differ and break downstream sends that assume
      // the stored value is canonical.
      whatsapp_number: normalized,
      whatsapp_verified: true,
      whatsapp_verified_at: new Date().toISOString(),
    })
    .eq('id', req.user?.id);
  if (error) {
    return res.status(500).json({ success: false, verified: false, message: 'Could not save your number.' });
  }
  return res.json({ success: true, verified: true });
};

module.exports = { sendOtp, verifyOtp };
