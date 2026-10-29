/**
 * securityRoutes.js — Google Cross-Account Protection (RISC) receiver.
 *
 * MOUNTED IN PROD (#512): server.js mounts this at /api/security. The SET is the
 *    auth for this route (no protect/requireHost), and the body is a raw JWT
 *    (content-type application/secevent+jwt) needing express.text() rather than
 *    the global JSON parser — the router supplies its own below.
 */
const express = require('express');
const router = express.Router();
const { receiveRiscEvent } = require('../controllers/securityRiscController');

// Accept the bare SET JWT as text. `type: () => true` so we still capture it if
// Google sends application/secevent+jwt (which the JSON parser would ignore).
const rawSet = express.text({ type: () => true, limit: '64kb' });

// POST /api/security/risc — receives Google RISC Security Event Tokens.
router.post('/risc', rawSet, receiveRiscEvent);

module.exports = router;
