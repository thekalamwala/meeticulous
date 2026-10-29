const express = require('express');
const router = express.Router();
const { getPublicBadges, getPublicBadgeDetail } = require('../controllers/badgePublicController');

// Public, unauthenticated showcase endpoints (mounted at /api/vendors)
router.get('/:username/badges', getPublicBadges);
router.get('/:username/badges/:badgeId', getPublicBadgeDetail);

module.exports = router;
