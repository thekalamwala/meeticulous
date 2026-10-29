/**
 * sitemapRoutes.js — root-mounted (NOT under /api) so the public URLs are
 * bookasloth.com/sitemap*.xml after the Vercel rewrite proxies them here.
 *
 * Regex routes avoid path-to-regexp's `.`/`:param` ambiguity around the `.xml`
 * suffix and capture the optional page number as group 1.
 */
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/sitemapController');

router.get('/sitemap.xml', ctrl.sitemapIndex);
router.get('/sitemap-pages.xml', ctrl.sitemapPages);
router.get(/^\/sitemap-hosts(?:-(\d+))?\.xml$/, ctrl.sitemapHosts);
router.get(/^\/sitemap-services(?:-(\d+))?\.xml$/, ctrl.sitemapServices);
router.get('/sitemap-professions.xml', ctrl.sitemapProfessions);
router.get('/sitemap-blog.xml', ctrl.sitemapBlog);

module.exports = router;
