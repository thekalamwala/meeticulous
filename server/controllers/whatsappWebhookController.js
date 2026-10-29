/**
 * whatsappWebhookController — inbound AiSensy webhook (public, secret-gated).
 *
 * COMPLIANCE-CRITICAL: an inbound STOP / opt-out must permanently suppress the
 * contact for WhatsApp. That path is matched leniently and is the main reason
 * this endpoint exists.
 *
 * NOTE: AiSensy's exact webhook payload shape is account-configured. Fields are
 * extracted defensively across common names. CONFIRM the live payload before
 * relying on delivery/read status (the full delivery funnel is a v2 concern —
 * here we only acknowledge status events). The secret is read from
 * notification_providers.settings_json.webhook_secret (or AISENSY_WEBHOOK_SECRET)
 * and passed as the x-webhook-secret header (preferred) or ?secret= (legacy).
 */
'use strict';
const crypto = require('crypto');
const { safeError } = require('../utils/httpError');
const { supabaseAdmin } = require('../config/supabase');
const aisensy = require('../services/aisensyService');
const { recordDeliveryEvent } = require('../services/crm/webhookEvents');

// Constant-time secret comparison with a length guard (timingSafeEqual throws
// on unequal-length buffers).
const secretsMatch = (provided, expected) => {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

async function getSecret() {
  if (process.env.AISENSY_WEBHOOK_SECRET) return process.env.AISENSY_WEBHOOK_SECRET;
  try {
    const { data } = await supabaseAdmin.from('notification_providers').select('settings_json').eq('provider', 'aisensy').single();
    return data?.settings_json?.webhook_secret || null;
  } catch (_) { return null; }
}

const OPT_OUT_RE = /\b(stop|unsubscribe|opt[\s-]?out)\b/i;

const handleWebhook = async (req, res) => {
  try {
    const expected = await getSecret();
    // FAIL CLOSED: with no secret configured the endpoint must NOT accept
    // unauthenticated requests (which could forge opt-out events for any phone).
    if (!expected) return res.status(503).json({ message: 'webhook not configured' });
    // Prefer the x-webhook-secret header; query strings land in proxy/access
    // logs. Fall back to ?secret= for backward compatibility.
    const provided = req.headers?.['x-webhook-secret'] || req.query?.secret;
    if (!secretsMatch(provided, expected)) return res.status(401).json({ message: 'invalid secret' });

    const body = req.body || {};
    const phoneRaw = body.destination || body.phone || body.from || body.mobile || body.waId || '';
    const text = body.text || body.message || body.body || '';
    const status = body.status || body.eventType || body.event || '';

    // Inbound opt-out → suppress WhatsApp for this contact (never message again).
    if (phoneRaw && OPT_OUT_RE.test(String(text))) {
      const phone = aisensy.normalizePhone(phoneRaw) || String(phoneRaw);
      await supabaseAdmin.from('contacts')
        .update({ whatsapp_suppressed: true, whatsapp_opt_in: false, updated_at: new Date().toISOString() })
        .eq('phone', phone);
      return res.json({ ok: true, action: 'opted_out' });
    }

    // CRM delivery funnel: reflect delivered/read/reply on the matching
    // crm_messages row (best-effort; never blocks the webhook ack).
    const providerMessageId = body.messageId || body.submitted_message_id || body.msgId || body.id || null;
    let event = null;
    if (text) event = 'replied';                       // inbound (non-opt-out) reply
    else {
      const st = String(status).toLowerCase();
      if (st.includes('read')) event = 'read';
      else if (st.includes('deliver')) event = 'delivered';
      else if (st.includes('sent')) event = 'sent';
      else if (st.includes('fail') || st.includes('error') || st.includes('undeliver')) event = 'failed';
    }
    if (event) await recordDeliveryEvent({ channel: 'whatsapp', event, providerMessageId, phone: phoneRaw, payload: body });

    return res.json({ ok: true, action: event || (status ? 'status_ack' : 'ignored') });
  } catch (e) { safeError(res, e); }
};

module.exports = { handleWebhook, OPT_OUT_RE };
