const express = require('express');
const router = express.Router();
const {
  createBooking, getHostBookings, getGuestBookings,
  cancelBooking, completeBooking, guestConfirmComplete, guestReportProblem, markNoShow, rescheduleBooking, confirmReschedule,
  getServiceById, getBookedSlots, getAvailableSlots,
} = require('../controllers/bookingController');
const { protect, optionalProtect } = require('../middleware/authMiddleware');
const { requireFeature } = require('../middleware/requireFeature');
const { slotsLimiter, bookingLimiter, bookingContactLimiter } = require('../middleware/security');

router.get('/service/:id', getServiceById);
router.get('/slots', slotsLimiter, getBookedSlots);  // Task 3: ?host_id=&date= (legacy) — P2-3: throttle public enum
router.get('/available-slots', slotsLimiter, getAvailableSlots); // v2.5: server-computed availability
// optionalProtect: sets req.user if logged in; createBooking derives guest_id
// server-side and never trusts a client-supplied id.
router.post('/', bookingLimiter, bookingContactLimiter, optionalProtect, requireFeature('guest_booking'), createBooking);
router.get('/host', protect, getHostBookings);
router.get('/guest', protect, getGuestBookings);
router.put('/:id/cancel', protect, cancelBooking);
router.put('/:id/complete', protect, completeBooking);
router.put('/:id/guest-complete', protect, guestConfirmComplete); // guest confirms → releases held payout
router.put('/:id/report-problem', protect, guestReportProblem);   // guest reports → reverses held payout
router.put('/:id/no-show', protect, markNoShow);   // P1-6: host records a no-show
router.put('/:id/reschedule', protect, requireFeature('reschedule'), rescheduleBooking); // Task 5
router.get('/:id/confirm-reschedule', requireFeature('reschedule'), confirmReschedule);

module.exports = router;
