'use strict';
// Public provider webhooks (signature/secret-gated in the controllers).
// Mounted at /api/webhooks. The Resend route needs the RAW body for Svix
// verification — see the express.raw mount in server.js.
const express = require('express');
const router = express.Router();
const { handleResendWebhook } = require('../controllers/resendWebhookController');
const { verifyMetaLeadgen, handleMetaLeadgen } = require('../controllers/metaLeadgenController');
const { handleInbound } = require('../controllers/brevoInboundController');
const { handleGithubWebhook } = require('../controllers/githubWebhookController');

router.post('/resend', handleResendWebhook);

// GitHub pull_request webhook → Tithi release notes, instant on merge (raw body
// mounted in server.js for X-Hub-Signature-256 verify). Replaces the free-plan poll.
router.post('/github', handleGithubWebhook);

// Brevo inbound parsing — CRM email replies (secret-gated, JSON body).
router.post('/brevo/inbound', handleInbound);

// Facebook/Instagram Lead Ads. GET = one-time subscribe handshake; POST = signed
// leadgen notifications (raw body mounted in server.js for signature verify).
router.get('/meta-leadgen', verifyMetaLeadgen);
router.post('/meta-leadgen', handleMetaLeadgen);

module.exports = router;
