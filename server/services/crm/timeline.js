'use strict';
/**
 * timeline.js — the unified lead timeline.
 *
 * Merges CRM-native events (lead_activities) with the platform's existing send
 * logs so an admin sees the ENTIRE relationship without opening AiSensy/Resend:
 *   - lead_activities   → all CRM actions (status, notes, calls, sends, conversion)
 *   - notification_logs → WhatsApp attempts, matched by the lead's phone
 *   - email_logs        → email attempts, matched by the lead's email
 *
 * Read-only, best-effort: a missing/errored source degrades to the others.
 */
const { supabaseAdmin } = require('../../config/supabase');
const { normalizePhone } = require('../aisensyService');

const LIMIT = 100;

async function getTimeline(leadId) {
  const { data: lead } = await supabaseAdmin.from('leads').select('*').eq('id', leadId).maybeSingle();
  if (!lead) return [];

  const phone = normalizePhone(lead.whatsapp_phone || lead.phone);
  const last10 = phone ? phone.slice(-10) : null;
  const email = (lead.email || '').trim().toLowerCase();

  const [acts, wa, mail] = await Promise.all([
    supabaseAdmin.from('lead_activities').select('*').eq('lead_id', leadId)
      .order('occurred_at', { ascending: false }).limit(LIMIT),
    last10
      ? supabaseAdmin.from('notification_logs').select('*').eq('channel', 'whatsapp')
          .ilike('destination', `%${last10}%`).order('created_at', { ascending: false }).limit(LIMIT)
      : Promise.resolve({ data: [] }),
    email
      ? supabaseAdmin.from('email_logs').select('*').eq('recipient', email)
          .order('created_at', { ascending: false }).limit(LIMIT)
      : Promise.resolve({ data: [] }),
  ]);

  const items = [];

  for (const a of acts.data || []) {
    items.push({
      source: 'crm', type: a.type, channel: null,
      title: a.title || a.type, body: a.body || null, status: null,
      at: a.occurred_at || a.created_at, meta: a.meta || {},
    });
  }
  for (const n of wa.data || []) {
    items.push({
      source: 'whatsapp_log', type: 'whatsapp', channel: 'whatsapp',
      title: `WhatsApp ${n.status || ''}`.trim(), body: n.event_key || null, status: n.status,
      at: n.created_at || n.sent_at, meta: { event_key: n.event_key, error: n.error },
    });
  }
  for (const m of mail.data || []) {
    items.push({
      source: 'email_log', type: 'email', channel: 'email',
      title: m.subject || `Email ${m.status || ''}`.trim(), body: m.event_key || null, status: m.status,
      at: m.sent_at || m.created_at, meta: { event_key: m.event_key, campaign_id: m.campaign_id },
    });
  }

  return items
    .filter((i) => i.at)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

module.exports = { getTimeline };
