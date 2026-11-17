const express = require('express');
const router = express.Router();
const {
  getMyMembership, upsertProgram, addTier, updateTier, deleteTier, setPublished,
  getPublicSpace, joinFree, createPaidSubscription, syncPaidSubscription, cancelSubscription,
  getHostMembers, getMySubscriptions,
} = require('../controllers/membershipController');
const { protect, optionalProtect, requireHost } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/requireFeature');

// Everything is flag-gated by community_memberships (OFF + fail-closed).

// Public membership space — anyone; viewer rank (optionalProtect) unlocks teasers in place.
router.get('/space/:username', optionalProtect, requireFeature('community_memberships'), getPublicSpace);

// Free-tier join — any signed-in member (not the host).
router.post('/join', protect, requireFeature('community_memberships'), joinFree);

// Paid membership (Razorpay). Subscribe is money movement -> extra SAFETY gate.
router.post('/subscribe', protect, requireFeature('community_memberships'), requireFeature('membership_purchase'), createPaidSubscription);
router.post('/subscription/sync', protect, requireFeature('community_memberships'), syncPaidSubscription);
router.post('/cancel', protect, requireFeature('community_memberships'), cancelSubscription);

// Member's own memberships across hosts.
router.get('/my-subscriptions', protect, requireFeature('community_memberships'), getMySubscriptions);

// Host-only management.
// No Pro gate yet — whether membership creation is a paid-plan feature is an open
// business toggle (ponytail: add callerIsFreePlan here if the founder wants it Pro-only).
const host = [protect, requireHost, requireFeature('community_memberships')];
router.get('/mine', ...host, getMyMembership);
router.get('/members', ...host, getHostMembers);
router.post('/', ...host, upsertProgram);
router.post('/publish', ...host, setPublished);
router.post('/tiers', ...host, addTier);
router.put('/tiers/:id', ...host, updateTier);
router.delete('/tiers/:id', ...host, deleteTier);

module.exports = router;
