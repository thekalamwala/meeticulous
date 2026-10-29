const express = require('express');
const router = express.Router();
const { protect, requireHost } = require('../middleware/authMiddleware');
const { otpLimiter } = require('../middleware/security');
const { sendOtp, verifyOtp } = require('../controllers/whatsappController');

router.post('/send-otp', protect, requireHost, otpLimiter, sendOtp);
router.post('/verify-otp', protect, requireHost, otpLimiter, verifyOtp);

module.exports = router;
