'use strict';
/**
 * referralController.js — host-facing Refer & Earn endpoints.
 * Attribution capture (called once after a referred host signs up) + the
 * dashboard read. All money logic lives in referralService.
 */
const { safeError } = require('../utils/httpError');
const referralService = require('../services/referralService');

// POST /api/referrals/capture  { ref }
// Idempotent + guarded (write-once, no retro-attribution of a converted host).
const capture = async (req, res) => {
  try {
    const result = await referralService.capture({ referredId: req.user.id, ref: req.body?.ref });
    res.json(result);
  } catch (e) { safeError(res, e); }
};

// GET /api/referrals/mine — referral code, stats, and list for the dashboard.
const mine = async (req, res) => {
  try {
    res.json(await referralService.getMine(req.user.id));
  } catch (e) { safeError(res, e); }
};

module.exports = { capture, mine };
