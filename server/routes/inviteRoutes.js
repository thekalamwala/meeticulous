const express = require('express');
const router = express.Router();
const { getConfig, visit } = require('../controllers/inviteController');

// Public: lead-source attribution landing. No auth — anyone can view an invite.
router.get('/:slug', getConfig);
router.post('/:slug/visit', visit);   // fire-and-forget, de-botted in the service

module.exports = router;
