'use strict';

// Gated investor pitch deck — passcode + WhatsApp OTP → 45-min token → figures.
// See controllers/pitchDeckController.js. Limiters mirror the guest OTP flow
// (per-IP + per-contact) to stop passcode brute-force and OTP bombing.
const express = require('express');
const { otpLimiter, otpContactLimiter, authLimiter } = require('../middleware/security');
const { checkPasscodeOnly, requestOtp, verifyOtp, getData, accessLog } = require('../controllers/pitchDeckController');

const router = express.Router();

router.post('/check-passcode', authLimiter, checkPasscodeOnly);
router.post('/request-otp', otpLimiter, otpContactLimiter, requestOtp);
router.post('/verify-otp', otpLimiter, otpContactLimiter, verifyOtp);
router.get('/data', authLimiter, getData);
router.post('/access-log', authLimiter, accessLog);

module.exports = router;
