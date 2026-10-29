// Public, read-only — powers /services and /services/:profession SEO pages.
const express = require('express');
const sd = require('../controllers/servicesDirectoryController');

const router = express.Router();
router.get('/', sd.listProfessions);
router.get('/:profession', sd.getProfession);

module.exports = router;
