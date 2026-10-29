const express = require('express');
const router = express.Router();
const {
  registerUser,
  googleAuth,
  googleVendorAuth,
  googleCallback,
  sendOtp,
  verifyOtp,
  login,
  loginUnified,
  loginWithPhone,
  verifyOtpLogin,
  setPassword,
  getMe,
  updateMe,
  becomeHost,
  cancelHosting,
  verifyLinkedin,
  forgotPassword,
  resetPassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const { otpLimiter, otpContactLimiter, authLimiter } = require('../middleware/security');
const { requireFeature } = require('../middleware/requireFeature');
const { gone } = require('../middleware/gone');

// #534: email/password host registration is retired — hosts sign in with Google
// only. 410 so any stale caller fails loudly instead of minting a password account.
router.post('/register/vendor', gone('Removed. Hosts sign in with Google at /be-a-sloth.'));
// guest_signup kill-switch — guest registration stays.
router.post('/register/user', authLimiter, requireFeature('guest_signup'), registerUser);

// Google OAuth
router.get('/google', protect, googleAuth);                 // legacy: calendar connect (logged-in vendor)
router.get('/google/vendor', authLimiter, googleVendorAuth); // vendor signup/login entry (public)
router.get('/google/callback', googleCallback);

// OTP (for guest booking) — IP-keyed + contact-keyed limiters stacked (P2-2)
router.post('/send-otp', otpLimiter, otpContactLimiter, sendOtp);
router.post('/verify-otp', otpLimiter, otpContactLimiter, verifyOtp);

// Phone-primary user login: phone+password, OTP login, set-password
router.post('/login-phone', authLimiter, loginWithPhone);
router.post('/verify-otp-login', otpLimiter, otpContactLimiter, verifyOtpLogin);
router.post('/set-password', protect, setPassword);

// Password reset (OTP-based, works for user/vendor/admin) — IP-keyed +
// contact-keyed limiters stacked (P2-2): otpLimiter alone (per-IP) is bypassed
// by rotating source IPs to spray reset codes at one victim's email
// (email bombing). otpContactLimiter caps per-email regardless of IP.
router.post('/forgot-password', otpLimiter, otpContactLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);

// Shared
router.post('/login', authLimiter, login);
// Unified login door (Phase B): email OR phone + password, any role.
router.post('/login-unified', authLimiter, loginUnified);
router.get('/me', protect, getMe);
router.put('/me', protect, updateMe);
// Unified identity: add hosting capability to the current account.
router.post('/become-host', protect, becomeHost);
// Reverse an in-progress hosting upgrade (un-become-host) — frees a guest who
// backed out of onboarding from being forced into /vendor-register on login.
router.post('/cancel-hosting', protect, cancelHosting);
// LinkedIn verification: host has linked their LinkedIn identity client-side
// (supabase linkIdentity); server confirms it and awards the "LinkedIn Verified"
// badge. Auth-gated — the identity is read for the calling user only.
router.post('/linkedin/verify', protect, authLimiter, verifyLinkedin);

module.exports = router;
