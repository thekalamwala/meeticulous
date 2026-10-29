/**
 * enterpriseLeadRoutes.js — public "Enterprise" lead form. Mounted at /api/enterprise-lead.
 */
'use strict';

const express = require('express');
const router = express.Router();
const { newsletterEmailLimiter, newsletterIpLimiter } = require('../middleware/security');
const { submitEnterpriseLead } = require('../controllers/enterpriseLeadController');

router.post('/', newsletterEmailLimiter, newsletterIpLimiter, submitEnterpriseLead);

module.exports = router;
