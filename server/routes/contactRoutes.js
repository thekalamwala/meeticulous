/**
 * contactRoutes.js — public "Contact us" form. Mounted at /api/contact.
 */
'use strict';

const router = require('express').Router();
const { submitContact } = require('../controllers/contactController');
const { newsletterIpLimiter } = require('../middleware/security');

router.post('/', newsletterIpLimiter, submitContact);

module.exports = router;
