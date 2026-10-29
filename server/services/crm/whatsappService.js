'use strict';
/**
 * WhatsAppService — the ONLY way CRM code sends WhatsApp.
 *
 * Wraps the existing AiSensy client (services/aisensyService) so the rest of the
 * CRM never talks to AiSensy directly and we can swap providers later. Reads the
 * AiSensy api_key from notification_providers (same store the notification engine
 * uses) — never from env, never hardcoded.
 *
 * AiSensy/WhatsApp only permits APPROVED TEMPLATES for business-initiated sends,
 * so `templateKey` IS an approved AiSensy campaign name. Free-text is only valid
 * inside a 24h session window and is out of scope here (template-only).
 *
 * Passes the send through sendGate first (kill-switch + DNC + opt-out + valid
 * phone). Returns a normalized result; never throws.
 */
const { supabaseAdmin } = require('../../config/supabase');
const aisensy = require('../aisensyService');
const { canSend } = require('./sendGate');

const CACHE_TTL_MS = 60 * 1000;
let _key = { at: 0, value: null };

// AiSensy provider api_key, cached 60s (mirrors notificationEngine.loadConfig).
async function getApiKey() {
  const now = Date.now();
  if (_key.value && now - _key.at < CACHE_TTL_MS) return _key.value;
  try {
    const { data } = await supabaseAdmin
      .from('notification_providers').select('api_key, is_active')
      .eq('provider', 'aisensy').maybeSingle();
    _key = { at: now, value: data && data.is_active !== false ? data.api_key : null };
  } catch (_) { _key = { at: now, value: null }; }
  return _key.value;
}

/**
 * @param {object} p
 * @param {object} p.lead            leads row
 * @param {string} p.templateKey     approved AiSensy campaign/template name
 * @param {string[]} p.templateParams ordered template variables
 * @param {string} [p.userName]      recipient display name
 * @returns {{success:boolean, skipped?:boolean, reason?:string, providerMessageId?:string, error?:string, response?:object}}
 */
async function send({ lead, templateKey, templateParams = [], buttonParams = [], userName, automated = false }) {
  const gate = await canSend(lead, 'whatsapp', { automated });
  if (!gate.ok) return { success: false, skipped: true, reason: gate.reason, defer: gate.defer };

  if (!templateKey) return { success: false, error: 'missing_template' };

  const apiKey = await getApiKey();
  if (!apiKey) return { success: false, error: 'aisensy_not_configured' };

  const res = await aisensy.sendCampaign({
    apiKey,
    campaignName: templateKey,
    destination: lead.whatsapp_phone || lead.phone,
    userName: userName || lead.name || 'there',
    templateParams: (templateParams || []).map(String),
    buttonParams,
  });

  if (!res.success) return { success: false, error: res.error, response: res.response };
  // AiSensy returns a submission id under a few possible keys across template types.
  const providerMessageId =
    res.response?.messageId || res.response?.submitted_message_id || res.response?.id || null;
  return { success: true, providerMessageId, response: res.response };
}

module.exports = { send, getApiKey, _clearKeyCache: () => { _key = { at: 0, value: null }; } };
