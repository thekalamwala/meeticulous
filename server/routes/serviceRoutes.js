const express = require('express');
const router = express.Router();
const {
  createService,
  getMyServices,
  getServiceById,
  updateService,
  deleteService,
  duplicateService,
  toggleService,
  getPublicServiceBySlug,
  getPublicServiceByProfileAndSlug,
  getPriceBenchmark,
} = require('../controllers/serviceController');
const { protect, requireHost } = require('../middleware/authMiddleware');
// BUG-04: import plan middlewares so the new /api/services endpoint enforces limits
const { attachPlan, checkServiceLimit, enforceMinPrice } = require('../middleware/planMiddleware');
const { requireFeature } = require('../middleware/requireFeature');
const { validate, serviceWriteRules } = require('../middleware/validate');
const { generateAiListing } = require('../controllers/aiController');

// Public routes — no auth (specific before dynamic)
router.get('/public/:profileSlug/:serviceSlug', getPublicServiceByProfileAndSlug);
router.get('/public/:slug', getPublicServiceBySlug);

// Protected routes — vendor dashboard
// "Write with Bolt" AI autofill — before any /:id-style route so it can't be shadowed.
router.post('/ai/listing',    protect, requireHost, attachPlan, generateAiListing);
// Advisory price benchmark — static path before any /:id route so it isn't shadowed.
router.get('/price-benchmark', protect, requireHost, getPriceBenchmark);
router.get('/',               protect, getMyServices);
router.post('/',              protect, requireHost, requireFeature('services'), ...serviceWriteRules, validate, attachPlan, enforceMinPrice, checkServiceLimit, createService); // BUG-04 fixed
router.get('/:id',            protect, getServiceById);
router.put('/:id',            protect, requireHost, requireFeature('services'), ...serviceWriteRules, validate, attachPlan, enforceMinPrice, updateService);
router.delete('/:id',         protect, requireHost, deleteService);
router.post('/:id/duplicate', protect, requireHost, requireFeature('services'), duplicateService);
router.put('/:id/toggle',     protect, requireHost, toggleService);

module.exports = router;
