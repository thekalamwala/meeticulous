'use strict';
/**
 * ingestRoutes.js — external lead intake. Mounted at /api/ingest.
 * POST /api/ingest/:provider  — token-gated (x-ingest-token), IP-rate-limited.
 */
const express = require('express');
const router = express.Router();
const { newsletterIpLimiter } = require('../middleware/security');
const { ingestLead } = require('../controllers/ingestController');

router.post('/:provider', newsletterIpLimiter, ingestLead);

module.exports = router;
