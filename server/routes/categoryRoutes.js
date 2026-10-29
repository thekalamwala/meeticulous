const express = require('express');
const router = express.Router();
const { protect, requireHost } = require('../middleware/authMiddleware');
const { listActive, suggest } = require('../controllers/categoryController');

// Public: categories shown in the onboarding picker.
router.get('/', listActive);

// Vendor (authenticated during onboarding): suggest a custom category.
router.post('/suggest', protect, requireHost, suggest);

module.exports = router;
