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
const { otpLimiter } = require('../middleware/security');

router.get('/status', getStatus);
router.post('/verify/start', otpLimiter, startVerify);   // per-IP OTP limiter (otpStore adds per-number cap)
router.post('/verify/confirm', otpLimiter, confirmVerify);
router.get('/wall', getWall);

module.exports = router;
