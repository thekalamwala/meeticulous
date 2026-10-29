/**
 * botRoutes.js — Bolt 958 support bot. Mounted at /api/bot.
 * Public; optionalProtect attaches req.user when the caller is logged in (host/guest)
 * so escalation can auto-attach identity — anonymous visitors proceed without it.
 * botLimiter caps the Anthropic-backed /ask path per IP; the escalate OTP routes reuse
 * the same per-IP + per-contact OTP limiters as the booking/login OTP flow.
 */
'use strict';

const router = require('express').Router();
const { ask, askStream, feedback, escalateSendOtp, escalateVerifyOtp, escalateRating } = require('../controllers/botController');
const { botLimiter, botGlobalLimiter, otpLimiter, otpContactLimiter } = require('../middleware/security');
const { optionalProtect } = require('../middleware/authMiddleware');

router.post('/ask', optionalProtect, botGlobalLimiter, botLimiter, ask);
router.post('/ask/stream', optionalProtect, botGlobalLimiter, botLimiter, askStream);
router.post('/feedback', botLimiter, feedback);

// Anonymous escalation contact verification (verify-only, no account created).
router.post('/escalate/send-otp', otpLimiter, otpContactLimiter, escalateSendOtp);
router.post('/escalate/verify-otp', otpLimiter, otpContactLimiter, escalateVerifyOtp);
router.post('/escalate/rating', botLimiter, escalateRating);

module.exports = router;
