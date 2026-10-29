'use strict';
/**
 * eventsController.js — public intent-event ingest (/api/events).
 * Fire-and-forget from the client for identified intent (pricing viewed, demo
 * requested, …). Never reveals whether a lead matched (privacy); only an
 * unknown event slug is a 400.
 */
const intentEvents = require('../services/crm/intentEvents');

async function recordIntent(req, res) {
  const { event, email, phone, meta, source } = req.body || {};
  const r = await intentEvents.record({ event, email, phone, meta, source: source || 'web' });
  if (!r.stored && r.reason === 'unknown_event') return res.status(400).json({ message: 'unknown event' });
  return res.status(202).json({ ok: !!r.stored });
}

module.exports = { recordIntent };
