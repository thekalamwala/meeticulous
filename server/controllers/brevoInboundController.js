'use strict';
/**
 * brevoInboundController — CRM email replies via Brevo inbound parsing (public,
 * secret-gated).
 *
 * CRM senders set Reply-To to an address on the receiving subdomain (MX →
 * Brevo). Brevo POSTs { items: [...] } here; for each reply we:
 *   1. label it with Haiku (replyClassifier)
 *   2. record it on the lead (webhookEvents 'email.replied' → last_reply_at,
 *      email_reply activity → the Sales Desk "Replied — unanswered" queue)
 *   3. a confident soft opt-out → email_unsubscribes (same list the link uses)
 *   4. forward a copy to the human inbox, so nothing is lost if the CRM side fails
 *
 * Brevo inbound webhooks carry no signature, so the endpoint is gated by a shared
 * secret (?secret= in the registered URL, or x-webhook-secret) and FAILS CLOSED
 * when BREVO_INBOUND_SECRET is unset. We ack 200 first and process after — Brevo
 * only needs the ack, and a slow model call must not trigger provider retries.
 */
const crypto = require('crypto');
const { supabaseAdmin } = require('../config/supabase');
const { recordDeliveryEvent } = require('../services/crm/webhookEvents');
const { classifyReply, isConfidentOptOut } = require('../services/crm/replyClassifier');
const sendEmail = require('../utils/sendEmail');
const { escapeHtml } = require('../utils/adminAlert');

// Capture-address local part → the human inbox that gets the forwarded copy
// (mirrors the v3.182 senders: crm_shubham replies → shubham@, crm_tithi → team@).
const FORWARD_TO = { shubham: 'shubham@meeticulous.com', tithi: 'team@meeticulous.com' };
const DEFAULT_FORWARD = 'team@meeticulous.com';
// Loop guard: never process mail from our own domains (our auto-replies, forwards).
const OWN_DOMAIN_RE = /(^|\.)meeticulous\.(com|in)$/i;
const SPAM_SCORE_MAX = 5; // rspamd score; above this we drop it outright

const secretsMatch = (provided, expected) => {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

const isMissingSchema = (e) =>
  e && /column .* does not exist|Could not find|does not exist/i.test(e.message || '');

function forwardTarget(item) {
  const rcpts = [...(item.Recipients || []), ...(item.To || []).map((t) => t?.Address)];
  for (const r of rcpts) {
    const local = String(r || '').split('@')[0].split('+')[0].toLowerCase();
    if (FORWARD_TO[local]) return FORWARD_TO[local];
  }
  return DEFAULT_FORWARD;
}

async function processItem(item) {
  const from = String(item?.From?.Address || '').trim().toLowerCase();
  if (!from || !from.includes('@')) return { action: 'ignored' };
  if (OWN_DOMAIN_RE.test(from.split('@')[1])) return { action: 'own_domain' };
  const spam = Number(item.Spam?.Score ?? item.SpamScore);
  if (Number.isFinite(spam) && spam > SPAM_SCORE_MAX) return { action: 'spam' };

  const subject = String(item.Subject || '');
  const text = String(item.ExtractedMarkdownMessage || item.RawTextBody || '').trim();
  const label = await classifyReply({ subject, text });

  const { leadId } = await recordDeliveryEvent({
    channel: 'email', event: 'email.replied', email: from,
    payload: { subject, message_id: item.MessageId || null },
    activityBody: text.slice(0, 2000),
    activityMeta: { intent: label.intent, confidence: label.confidence, summary: label.summary, subject },
  });

  if (leadId) {
    const { error } = await supabaseAdmin.from('leads').update({ last_reply_intent: label.intent }).eq('id', leadId);
    // v3.183 not applied yet → the label still lives on the activity row.
    if (error && !isMissingSchema(error)) console.warn('[crm] reply intent stamp failed:', error.message);
  }

  let optedOut = false;
  if (isConfidentOptOut(label)) {
    const { error } = await supabaseAdmin.from('email_unsubscribes')
      .upsert({ email: from, unsubscribed_at: new Date().toISOString(), source: 'reply_ai' }, { onConflict: 'email' });
    optedOut = !error;
    if (error) console.error('[crm] reply opt-out failed:', error.message);
  }

  try {
    const lines = [
      `From: ${item.From?.Name ? `${item.From.Name} <${from}>` : from}`,
      `Label: ${label.intent} (${Math.round(label.confidence * 100)}%)${label.summary ? ` — ${label.summary}` : ''}`,
      optedOut ? 'Auto-unsubscribed from marketing email.' : null,
      leadId ? null : 'No matching lead in the CRM.',
      '',
      text || '(empty reply)',
    ].filter((l) => l !== null);
    await sendEmail({
      to: forwardTarget(item),
      subject: `[${label.intent}] ${subject || '(no subject)'}`,
      text: lines.join('\n'),
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(lines.join('\n'))}</pre>`,
      replyTo: from, // hitting Reply in the inbox answers the lead directly
    });
  } catch (e) {
    console.error('[crm] reply forward failed:', e?.message || e);
  }

  return { action: 'recorded', intent: label.intent, matched: !!leadId, optedOut };
}

const handleInbound = async (req, res) => {
  const expected = process.env.BREVO_INBOUND_SECRET;
  if (!expected) return res.status(503).json({ message: 'webhook not configured' });
  const provided = req.headers?.['x-webhook-secret'] || req.query?.secret;
  if (!secretsMatch(provided, expected)) return res.status(401).json({ message: 'invalid secret' });

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  res.json({ ok: true, received: items.length });
  for (const item of items) {
    try { await processItem(item); } catch (e) { console.error('[crm] inbound reply failed:', e?.message || e); }
  }
};

module.exports = { handleInbound, processItem };
