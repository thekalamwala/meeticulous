/**
 * emailRoutes.js — public email preference endpoints (no auth; token-gated).
 * Mounted at /api/email.
 */
'use strict';

const router = require('express').Router();
const c = require('../controllers/emailPublicController');
const { newsletterIpLimiter, newsletterEmailLimiter } = require('../middleware/security');

router.get('/unsubscribe', c.getUnsubscribeStatus);
router.post('/unsubscribe', c.unsubscribe);
router.post('/resubscribe', c.resubscribe);

// Public newsletter signup — stack IP + email limiters to block list-bombing.
router.post('/subscribe', newsletterIpLimiter, newsletterEmailLimiter, c.subscribe);

module.exports = router;
