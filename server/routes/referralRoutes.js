const express = require('express');
const router = express.Router();
const { protect, requireHost } = require('../middleware/authMiddleware');
const { capture, mine } = require('../controllers/referralController');

// Refer & Earn is host-refers-host: every endpoint requires an authed host.
router.use(protect, requireHost);

router.post('/capture', capture);
router.get('/mine', mine);

module.exports = router;
