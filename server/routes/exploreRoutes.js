/**
 * exploreRoutes.js — Public Explore page endpoints
 * Mounted at /api/explore in server.js
 */
const router = require('express').Router();
const explore = require('../controllers/exploreController');
const { searchLimiter } = require('../middleware/security');

router.get('/',            searchLimiter, explore.listServices);
router.post('/click',      explore.logClick);   // navigator.sendBeacon; global apiLimiter still applies
router.get('/featured',    explore.getFeatured);
router.get('/categories',  explore.getCategories);
router.get('/collections', explore.getCollections);
router.get('/sponsored',   explore.getSponsored);

module.exports = router;
