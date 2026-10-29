const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/whatsappWebhookController');

// Public (secret-gated) inbound AiSensy webhook — NOT behind admin auth.
router.post('/aisensy/webhook', handleWebhook);

module.exports = router;
