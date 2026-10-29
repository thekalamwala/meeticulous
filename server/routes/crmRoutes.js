// crmRoutes.js — Studio Client CRM. Every route is Studio-gated (requireCrm) and
// host-scoped in the controller. attachPlan MUST run before requireCrm.
const express = require('express');
const router = express.Router();
const { protect, requireHost } = require('../middleware/authMiddleware');
const { attachPlan, requireCrm } = require('../middleware/planMiddleware');
const c = require('../controllers/crmController');

// Studio gate applied to the whole router.
router.use(protect, requireHost, attachPlan, requireCrm);

router.get('/customers.csv', c.exportCsv);
router.post('/customers/resolve', c.resolveCustomer);
router.get('/customers', c.listCustomers);
router.get('/customers/:id', c.getCustomer);

router.get('/customers/:id/notes', c.listNotes);
router.post('/customers/:id/notes', c.addNote);
router.delete('/customers/:id/notes/:noteId', c.deleteNote);

router.patch('/customers/:id/attributes', c.patchAttributes);

// HELD FROM PROD: walk-in / manual cash booking. The controller exists and is
// Studio-gated, but manual_cash bookings must first be EXCLUDED from every
// platform aggregation (GMV, commission, settlement, payout, bookings_per_year,
// public counts) — that audit (plan Task 16 Step 2) is not done. Re-enable this
// line only after that audit lands, or a Studio host's cash entry would pollute
// platform revenue/settlement.
// router.post('/manual-booking', c.createManualBooking);

module.exports = router;
