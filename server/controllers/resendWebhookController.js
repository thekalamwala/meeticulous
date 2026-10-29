'use strict';
/**
 * resendWebhookController — Resend email delivery webhook (public, Svix-signed).
 *
 * Verifies the Svix signature over the RAW body (route is mounted with
 * express.raw), then funnels delivered/opened/clicked/bounced/complained events
 * into the CRM via webhookEvents. Matches our stored provider_message_id
 * (= Resend email id). Always 200s on a verified request so Resend doesn't
 * retry a message we simply don't track; 401 only on a bad signature.
 *
 * Env: RESEND_WEBHOOK_SECRET (the "whsec_..." signing secret from Resend).
 */
const crypto = require('crypto');
const { safeError } = require('../utils/httpError');
const { recordDeliveryEvent } = require('../services/crm/webhookEvents');
const { recordEmailLogDelivery } = require('../services/email/communicationEngine');

const TOLERANCE_MS = 5 * 60 * 1000; // reject stale timestamps (replay guard)

// Svix signature verification (Resend uses Svix). Returns true/false.
function verify(rawBody, headers, secret) {
  const id = headers['svix-id'];
  const ts = headers['svix-timestamp'];
  const sigHeader = headers['svix-signature'];
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() - Number(ts) * 1000) > TOLERANCE_MS) return false;

  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64');
  const signedContent = `${id}.${ts}.${rawBody}`;
  const expected = crypto.createHmac('sha256', key).update(signedContent).digest('base64');

  // Header is a space-separated list of "v1,<sig>" entries.
  return String(sigHeader).split(' ').some((part) => {
    const sig = part.split(',')[1];
    if (!sig || sig.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
}

const handleResendWebhook = async (req, res) => {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) return res.status(503).json({ message: 'webhook not configured' });

    // req.body is a Buffer (express.raw). Keep the exact bytes for signing.
    const raw = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {});
    if (!verify(raw, req.headers, secret)) return res.status(401).json({ message: 'invalid signature' });

    let evt; try { evt = JSON.parse(raw); } catch { return res.status(400).json({ message: 'bad json' }); }
    const type = evt.type;                     // e.g. 'email.opened'
    const data = evt.data || {};
    const emailId = data.email_id || data.id;  // matches crm_messages.provider_message_id
    const to = Array.isArray(data.to) ? data.to[0] : data.to;

    // CRM (sales outreach) delivery state…
    await recordDeliveryEvent({ channel: 'email', event: type, providerMessageId: emailId, email: to, payload: evt });
    // …and the transactional/campaign email_logs row (feeds Campaigns history). Best-effort.
    await recordEmailLogDelivery({ providerMessageId: emailId, event: type });
    return res.json({ ok: true });
  } catch (e) { safeError(res, e); }
};

module.exports = { handleResendWebhook, _verify: verify };
