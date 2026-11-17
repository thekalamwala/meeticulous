const express = require('express');
const router = express.Router();
const {
  getMyMembership, upsertProgram, addTier, updateTier, deleteTier, setPublished,
} = require('../controllers/membershipController');
const { protect, requireHost } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/requireFeature');

// Host-only management. Flag-gated (community_memberships, ships OFF/fail-closed).
// No Pro gate yet — whether membership creation is a paid-plan feature is an open
// business toggle (ponytail: add callerIsFreePlan here if the founder wants it Pro-only).
router.use(protect, requireHost, requireFeature('community_memberships'));

router.get('/mine', getMyMembership);
router.post('/', upsertProgram);
router.post('/publish', setPublished);
router.post('/tiers', addTier);
router.put('/tiers/:id', updateTier);
router.delete('/tiers/:id', deleteTier);

module.exports = router;
