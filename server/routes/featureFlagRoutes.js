const express = require('express');
const router = express.Router();
const { getPublicFlags } = require('../controllers/featureFlagController');
router.get('/', getPublicFlags);
module.exports = router;
