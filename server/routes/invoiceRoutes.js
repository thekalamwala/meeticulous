const express = require('express');
const router = express.Router();
const { getInvoice, listMyInvoices, viewBookingInvoice } = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');

// Logged-in user's own invoices (subscriptions + bookings billed to them).
// Must be registered before `/:id` so it isn't shadowed.
router.get('/mine', protect, listMyInvoices);

// Owner-gated (session, not shareable) invoice view for the guest dashboard.
// Registered before `/:id` so the static segment isn't captured by the param.
router.get('/booking/:bookingId/view', protect, viewBookingInvoice);

// Token-gated public view/download of a GST tax invoice (emailed link).
router.get('/:id', getInvoice);

module.exports = router;
