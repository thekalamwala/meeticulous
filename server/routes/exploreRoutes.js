/**
 * exploreRoutes.js — Public Explore page endpoints
 * Mounted at /api/explore in server.js
 */
const router = require('express').Router();
const explore = require('../controllers/exploreController');
const { searchLimiter, clickLimiter } = require('../middleware/security');

router.get('/',            searchLimiter, explore.listServices);
router.post('/click',      clickLimiter, explore.logClick);   // sendBeacon; + per-IP clickLimiter (audit F-04)
router.get('/featured',    explore.getFeatured);
router.get('/categories',  explore.getCategories);
router.get('/collections', explore.getCollections);
router.get('/sponsored',   explore.getSponsored);

module.exports = router;
