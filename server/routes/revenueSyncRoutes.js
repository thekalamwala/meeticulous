'use strict';
/**
 * revenueSyncRoutes.js — read-only revenue export for Papertrail. Mounted at
 * /api/sync. GET /api/sync/revenue — token-gated (x-sync-token). No writes.
 */
const express = require('express');
const router = express.Router();
const { exportRevenue } = require('../controllers/revenueSyncController');

router.get('/revenue', exportRevenue);

module.exports = router;
