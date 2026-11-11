/**
 * openingRoutes.js — public "The Opening" launch event. Mounted at /api/opening.
 *
 * GET  /status          window + live count
 * POST /verify/start    send WhatsApp OTP (Booking OTP campaign) to the number
 * POST /verify/confirm  verify OTP + place the stone (create-on-verify)
 * GET  /wall            paginated Inaugurators Wall
 */
'use strict';

const router = require('express').Router();
const { getStatus, startVerify, confirmVerify, getWall } = require('../controllers/openingController');
const { otpLimiter, otpContactLimiter } = require('../middleware/security');

router.get('/status', getStatus);
// Stack per-IP + per-contact OTP limiters (audit F-21): the per-IP cap alone is
// bypassable by rotating source IPs to spray OTPs at one victim number
// (otpStore's per-number cap already blunts this; this is defense-in-depth parity
// with /auth and /bot).
router.post('/verify/start', otpLimiter, otpContactLimiter, startVerify);
router.post('/verify/confirm', otpLimiter, otpContactLimiter, confirmVerify);
router.get('/wall', getWall);

module.exports = router;
