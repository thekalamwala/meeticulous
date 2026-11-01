'use strict';
/**
 * demoLeadRoutes — public "Book a Demo" lead form on /be-a-sloth.
 * Mounted at /api/demo-lead. Rate-limited; no auth.
 */
const express = require('express');
const router = express.Router();
const { otpLimiter, otpContactLimiter, newsletterIpLimiter } = require('../middleware/security');
const { sendLeadOtp, submitLead } = require('../controllers/demoLeadController');

// Phone-OTP send — reuses the same per-IP + per-contact limits as auth OTPs.
router.post('/send-otp', otpLimiter, otpContactLimiter, sendLeadOtp);
// Final submit (verifies OTP, then creates the CRM lead).
router.post('/', newsletterIpLimiter, submitLead);

module.exports = router;
