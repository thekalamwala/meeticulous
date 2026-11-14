const express = require('express');
const router = express.Router();
const {
  getHostProfile, updateProfile, getMyCategories, updateCategories,
  updateService, deleteService,
  getMyServices, setAvailability, getServiceBySlug, searchVendors, getAvailability,
  recordProfileView, getMyProfileViews,
} = require('../controllers/hostController');
const { gone } = require('../middleware/gone');
const { changeUsername } = require('../controllers/usernameController');
const { getHostNudges, dismissHostNudge } = require('../controllers/hostNudgeController');
const { recordFeatureInterest } = require('../controllers/featureInterestController');
const { createCoupon, listCoupons, updateCoupon, deleteCoupon } = require('../controllers/couponHostController');
const {
  listMyTestimonials, createTestimonial, updateTestimonial, deleteTestimonial, getPublicTestimonials,
} = require('../controllers/testimonialController');
const { protect, requireHost } = require('../middleware/authMiddleware');
const { attachPlan, enforceMinPrice } = require('../middleware/planMiddleware');
const { requireFeature } = require('../middleware/requireFeature');
const { validate, serviceWriteRules, updateProfileRules } = require('../middleware/validate');

router.get('/search', searchVendors);              // Task 11 — must come before /:username
router.get('/availability', protect, getAvailability); // GET current availability for dashboard
router.put('/profile', protect, requireHost, ...updateProfileRules, validate, updateProfile);
router.get('/categories', protect, getMyCategories);
router.put('/categories', protect, requireHost, attachPlan, updateCategories);
router.put('/username', protect, requireHost, changeUsername);  // gated, rate-limited username change
// #534: dead slug-less create path — the live one is POST /api/services
// (serviceRoutes). Retired to 410 so nothing can create a service here.
router.post('/services', gone('Removed. Create services via the dashboard (POST /api/services).'));
router.get('/services', protect, getMyServices);
router.put('/services/:id', protect, requireHost, requireFeature('services'), ...serviceWriteRules, validate, attachPlan, enforceMinPrice, updateService);
router.delete('/services/:id', protect, requireHost, deleteService);
router.put('/availability', protect, requireHost, requireFeature('availability_editor'), setAvailability);
// Dashboard "Next step" nudge dismissal state (server-tracked, cross-device).
// MUST stay above the public /:username routes or "nudges" reads as a username.
router.get('/nudges', protect, requireHost, getHostNudges);
router.post('/nudges/:key/dismiss', protect, requireHost, dismissHostNudge);
// One-click "notify me" interest in an unlaunched feature (schema-fallback safe).
router.post('/feature-interest', protect, requireHost, recordFeatureInterest);
// Host-managed discount codes (v3.204, behind the `coupons` flag). Static paths —
// MUST stay above the public /:username routes or "coupons" reads as a username.
router.get('/coupons', protect, requireHost, listCoupons);
router.post('/coupons', protect, requireHost, createCoupon);
router.patch('/coupons/:id', protect, requireHost, updateCoupon);
router.delete('/coupons/:id', protect, requireHost, deleteCoupon);
// Profile view counter (v3.205). Static read MUST stay above /:username; the public
// beacon is a POST so it never collides with the GET /:username profile route.
router.get('/profile-views', protect, requireHost, getMyProfileViews);
// Host-authored proof-wall testimonials (v3.212). Static paths — MUST stay above
// the public /:username routes or "testimonials" reads as a username.
router.get('/testimonials', protect, requireHost, listMyTestimonials);
router.post('/testimonials', protect, requireHost, createTestimonial);
router.put('/testimonials/:id', protect, requireHost, updateTestimonial);
router.delete('/testimonials/:id', protect, requireHost, deleteTestimonial);
router.post('/:username/view', recordProfileView);
// Public proof wall — MUST stay above /:username/:slug or it reads as a service slug.
router.get('/:username/testimonials', getPublicTestimonials);
router.get('/:username/:slug', getServiceBySlug);
router.get('/:username', getHostProfile);

module.exports = router;
