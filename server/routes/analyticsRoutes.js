/**
 * POST /api/analytics/collect — first-party event beacon.
 * Design: docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §11.5
 *
 * Answers 202 to everything. Not laziness: the caller is navigator.sendBeacon on
 * a guest's booking page, and a 4xx or 5xx there teaches the client to retry,
 * surfaces an error next to a payment button, or both. Whether an event was
 * stored is our problem, never the guest's.
 *
 * Mounted AHEAD of the global apiLimiter (see server.js). The global limiter is
 * 100 req/min per IP and DB-backed: guests behind carrier NAT share one bucket,
 * beacons flush every 5 s, and each hit writes a rate_limit_hits row. Mounting
 * this behind it would 429 guests mid-booking and grow the table we are trying
 * to keep small. The per-visitor cap inside analyticsIngest does the job in
 * memory instead, and drops rather than refusing.
 */
const express = require('express');
const router = express.Router();
const { ingest } = require('../services/analyticsIngest');

router.post('/collect', async (req, res) => {
  // Answer first. Nothing below can change the status code, so a slow database
  // cannot hold a beacon open on the guest's page.
  res.status(202).end();

  try {
    const body = req.body || {};
    const events = Array.isArray(body) ? body : body.events;
    await ingest({ events: events || [], origin: req.get('origin') || '' });
  } catch {
    // Already answered; there is nobody left to tell. Swallow deliberately
    // rather than letting it reach the error handler as an unhandled rejection.
  }
});

module.exports = router;
