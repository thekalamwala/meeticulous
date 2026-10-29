/**
 * blogRoutes.js — public blog endpoints. Mounted at /api/blogs in server.js.
 */
const router = require('express').Router();
const blog = require('../controllers/blogController');

router.get('/',      blog.listBlogs);
router.get('/:slug', blog.getBlogBySlug);

module.exports = router;
