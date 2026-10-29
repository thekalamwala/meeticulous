// server/routes/feedbackRoutes.js
const express = require('express');
const router = express.Router();
const { createFeedback, getMyFeedback } = require('../controllers/feedbackController');
const { protect, requireHost } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/requireFeature');

// POST is gated by the kill-switch; the global apiLimiter (server.js) already
// rate-limits /api, so no extra limiter here.
router.post('/', protect, requireHost, requireFeature('vendor_feedback'), createFeedback);
router.get('/mine', protect, getMyFeedback);

module.exports = router;
