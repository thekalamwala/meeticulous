const express = require('express');
const router = express.Router();
const { protect, requireHost } = require('../middleware/authMiddleware');
const {
  getTransactions,
  getPayoutBalance,
  getPayoutRequests,
  requestPayout,
  toggleService,
  getMyWithholding,
  markLinkShared,
} = require('../controllers/vendorController');

// All vendor routes require auth
router.use(protect);

// Transactions
router.get('/transactions', getTransactions);

// TDS/TCS certificate data (host's own withholding for a period)
router.get('/withholding', getMyWithholding);

// Payouts
router.get('/payout/balance', getPayoutBalance);
router.get('/payout/requests', getPayoutRequests);
router.post('/payout/request', requestPayout);

// Service toggle (soft-disable / enable) — requireHost (P1-1: was protect-only)
router.put('/services/:id/toggle', requireHost, toggleService);

// Activation funnel: stamp first time the host shares their public link
router.post('/share-signal', requireHost, markLinkShared);

module.exports = router;
