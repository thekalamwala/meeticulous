'use strict';
/**
 * ingestController.js — public external-lead intake (audit Phase 5).
 * POST /api/ingest/:provider  (meta | zoho | form)
 *
 * Auth = a shared secret in the `x-ingest-token` header, constant-time compared
 * to INGEST_TOKEN. Fail-CLOSED: if INGEST_TOKEN is unset the endpoint is disabled
 * (503), so a misconfigured deploy can never accept unauthenticated leads.
 */
const crypto = require('crypto');
const { ingest } = require('../services/crm/ingestService');
const { PROVIDERS } = require('../services/crm/ingest/mappers');

function tokenValid(req) {
  const expected = process.env.INGEST_TOKEN;
  if (!expected) return null;                 // disabled
  const got = req.get('x-ingest-token') || '';
  const a = Buffer.from(got), b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function ingestLead(req, res) {
  const auth = tokenValid(req);
  if (auth === null) return res.status(503).json({ error: 'Ingest not configured.' });
  if (!auth) return res.status(401).json({ error: 'Invalid ingest token.' });

  const provider = String(req.params.provider || '').toLowerCase();
  if (!PROVIDERS.includes(provider)) return res.status(400).json({ error: `Unknown provider. Use one of: ${PROVIDERS.join(', ')}` });

  // Body is the provider's lead payload (a single lead). Meta/Zoho batch webhooks
  // are unwrapped to one lead per call by the caller / a thin future adapter.
  const payload = req.body && typeof req.body === 'object' ? (req.body.payload || req.body) : {};

  const result = await ingest({ provider, payload });
  // 200 for success + idempotent duplicate; 422 for a skipped (unusable) lead;
  // 400/500 for mapping / upsert errors.
  if (result.ok) return res.status(200).json(result);
  if (result.status === 'skipped') return res.status(422).json(result);
  return res.status(result.status === 'error' && result.reason === 'upsert failed' ? 500 : 400).json(result);
}

module.exports = { ingestLead };
