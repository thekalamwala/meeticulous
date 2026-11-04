const express = require('express');
const router = express.Router();
const { protect, requireHost } = require('../middleware/authMiddleware');
const { safeError } = require('../utils/httpError');
const planGiftService = require('../services/planGiftService');

// Gifted Pro, host side (docs/superpowers/plans/2026-11-04-gifted-pro.md §8).
// Every endpoint acts on the signed-in host only — never on a host id from the body.
router.use(protect, requireHost);

const STATUS = { BAD_URL: 400, NOT_ACTIVE: 409, ALREADY_SHARED: 409, GIFTS_UNAVAILABLE: 503 };
const fail = (res, err) => (err instanceof planGiftService.GiftError
  ? res.status(STATUS[err.code] || 400).json({ message: err.message })
  : safeError(res, err));

// POST /api/gift/share  { url } — share-to-extend: queue a public post for review.
router.post('/share', async (req, res) => {
  try {
    const gift = await planGiftService.submitShare(req.user.id, req.body?.url);
    res.json({ share_status: gift.share_status });
  } catch (err) {
    fail(res, err);
  }
});

// POST /api/gift/redeem  { code } — pay-it-forward: a new host redeems a gifted
// host's link (stashed from ?gift= at signup). keep=true → retry after onboarding.
router.post('/redeem', async (req, res) => {
  try {
    res.json(await planGiftService.redeemForward(req.user.id, req.body?.code));
  } catch (err) {
    fail(res, err);
  }
});

module.exports = router;
