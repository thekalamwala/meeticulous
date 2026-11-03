/**
 * prerenderRoutes.js — Lightweight HTML meta-tag shells for bot/scraper traffic.
 *
 * Serves minimal HTML pages with correct <title>, OG tags, canonical, and JSON-LD
 * for dynamic routes (host profiles and service pages). The Vercel edge middleware
 * detects bot User-Agents and proxies them here instead of serving the SPA shell.
 *
 * These pages are NOT rendered by React — they're a simple HTML template filled
 * from the same DB data the SPA uses. Admin SEO overrides (SeoDrawer) take effect
 * immediately since we read from DB on every request (with response-cache).
 */
const express = require('express');
const router = express.Router();
const { renderProfileMeta, renderServiceMeta } = require('../controllers/prerenderController');

// /prerender/community/... — MUST stay above /:username, or /community would resolve as a
// host profile. Anything else under /community (search, saved, unknown) is a bot 404.
const community = require('../controllers/prerenderCommunity');
router.get('/community', community.renderHome);
router.get('/community/guidelines', community.renderGuidelines);
router.get('/community/s/:key', community.renderSpace);
router.get('/community/t/:slug', community.renderThread);
router.get('/community/p/:slug', community.renderPost);
router.use('/community', community.renderNotFound);

// GET /prerender/:username — host profile meta shell
router.get('/:username', renderProfileMeta);

// GET /prerender/:username/:serviceSlug — service page meta shell
router.get('/:username/:serviceSlug', renderServiceMeta);

module.exports = router;
