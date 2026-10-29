/**
 * notify.js — thin compatibility wrappers over the Notification Engine.
 *
 * New code should call NotificationEngine.send({ event, data }) directly.
 * These wrappers keep older call sites (authController, vendorOnboarding)
 * working while routing everything through the engine, which reads channel
 * config, campaign names and provider credentials from the database.
 */
const NotificationEngine = require('../services/notificationEngine');

const sendOtpNotification = async ({ email, phone, name, otp }) => {
  if (!email && !phone) return { emailSent: false, whatsappSent: false };
  const result = await NotificationEngine.send({
    event: 'BOOKING_OTP',
    data: {
      email,
      phone,
      name,
      templateParams: otp ? [String(otp)] : [],   // WhatsApp body var {{1}}
      buttonParams: otp ? [String(otp)] : [],      // copy-code button (auth OTP template)
      emailData: { otp: otp ? String(otp) : '' },  // {{otp}} for the email template
      emailUser: { email, name },
      immediateEmail: true,                         // OTP bypasses the queue
    },
  });
  return {
    emailSent: !!result.email.success,
    whatsappSent: !!result.whatsapp.success,
  };
};

// Legacy export used by vendorOnboardingController — now engine-backed.
const sendWhatsAppOtp = async ({ phone, otp, name = 'Friend' }) => {
  if (!phone) return false;
  const result = await NotificationEngine.send({
    event: 'BOOKING_OTP',
    data: { phone, name, templateParams: [String(otp)], buttonParams: [String(otp)] },
  });
  return !!result.whatsapp.success;
};

// WhatsApp number-verification OTP — dedicated AiSensy template.
const sendWhatsAppVerifyOtp = async ({ phone, otp, name = 'Friend' }) => {
  if (!phone) return false;
  const result = await NotificationEngine.send({
    event: 'WHATSAPP_VERIFY_OTP',
    data: { phone, name, templateParams: [String(otp)], buttonParams: [String(otp)] },
  });
  return !!result.whatsapp.success;
};

module.exports = { sendOtpNotification, sendWhatsAppOtp, sendWhatsAppVerifyOtp };
