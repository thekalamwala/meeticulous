'use strict';
/**
 * agentReportRoutes.js — READ-ONLY reporting for SUTRA agents. Mounted at /api/agents/reports.
 *   GET /finance  — pre-aggregated finance numbers (services/financeReportService.js)
 *
 * Auth = shared secret in the `x-agent-token` header, constant-time compared to
 * AGENT_REPORT_TOKEN. Fail-CLOSED: unset or shorter than 32 chars → 503, so a
 * misconfigured deploy never serves numbers unauthenticated. The token grants
 * this GET router only — it is not an admin session and can never write.
 * Rotate = change the env var on Render (and in the agent's config).
 */
const crypto = require('crypto');
const express = require('express');
const { newsletterIpLimiter } = require('../middleware/security');
const { securityLog } = require('../utils/logger');
const { safeError } = require('../utils/httpError');
const { buildFinanceReport } = require('../services/financeReportService');

const MIN_TOKEN_LEN = 32;

function requireAgentToken(req, res, next) {
  const expected = process.env.AGENT_REPORT_TOKEN || '';
  if (expected.length < MIN_TOKEN_LEN) return res.status(503).json({ message: 'Agent reports not configured.' });
  // Hash both sides so the compare is constant-time regardless of input length.
  const h = (s) => crypto.createHash('sha256').update(String(s)).digest();
  if (!crypto.timingSafeEqual(h(req.get('x-agent-token') || ''), h(expected))) {
    securityLog('agent_report_auth_failed', { ip: req.ip, path: req.originalUrl });
    return res.status(401).json({ message: 'Invalid agent token.' });
  }
  next();
}

const router = express.Router();
router.use(newsletterIpLimiter, requireAgentToken);

router.get('/finance', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await buildFinanceReport());
  } catch (e) {
    safeError(res, e);
  }
});

module.exports = router;
module.exports.requireAgentToken = requireAgentToken;
