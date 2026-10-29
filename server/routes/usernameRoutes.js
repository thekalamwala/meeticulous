const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { checkUsername, resolveUsername } = require('../controllers/usernameController');

// Public — used by the Vercel edge redirect to find the canonical username.
router.get('/resolve/:slug', resolveUsername);

// Auth — live availability check while a verified host types a new username.
router.get('/check/:slug', protect, checkUsername);

module.exports = router;
