/**
 * contactRoutes.js — public "Contact us" form. Mounted at /api/contact.
 */
'use strict';

const router = require('express').Router();
const { submitContact } = require('../controllers/contactController');
const { newsletterEmailLimiter, newsletterIpLimiter } = require('../middleware/security');

// Stack BOTH limiters (parity with /api/enterprise-lead): the email-keyed cap
// stops bombing one address; the IP-keyed cap stops rotating the email per
// request to spam the support inbox from one IP. IP-only (the prior state) left
// the latter open.
router.post('/', newsletterEmailLimiter, newsletterIpLimiter, submitContact);

module.exports = router;
