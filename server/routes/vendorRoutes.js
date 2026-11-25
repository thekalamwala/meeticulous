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
  getMyAccountManager,
} = require('../controllers/vendorController');

// All vendor routes require auth
router.use(protect);

// Creator Intelligence (Phase 3). Both read bookings live, so they work the
// day they ship rather than waiting on the event store. Money is ungated by
// design (see services/intel/gate.js); Overview gates six blocks on the
// subscription_plans limits.insights key.
const { getMoney, getOverview, getAudience, getDemand } = require('../controllers/intelligenceController');
router.get('/intelligence/money', getMoney);
router.get('/intelligence/overview', getOverview);
router.get('/intelligence/audience', getAudience);
router.get('/intelligence/demand', getDemand);

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

// The host's assigned account manager (admin-assigned via Host 360)
router.get('/account-manager', requireHost, getMyAccountManager);

module.exports = router;
