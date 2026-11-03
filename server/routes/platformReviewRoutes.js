const express = require('express');
const router = express.Router();
const { getMine, saveMine, listPublic } = require('../controllers/platformReviewController');
const { protect } = require('../middleware/authMiddleware');

router.get('/', listPublic); // public — approved + consented only
router.get('/me', protect, getMine);
router.put('/me', protect, saveMine);

module.exports = router;
