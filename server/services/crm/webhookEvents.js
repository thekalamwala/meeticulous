'use strict';
/**
 * webhookEvents.js — normalize provider delivery events into the CRM.
 *
 * Both the Resend (email) and AiSensy (WhatsApp) webhooks funnel here so the
 * status/timeline logic lives in one place:
 *   1. find the crm_messages row (by provider_message_id, else by lead phone/email)
 *      AND the lead behind it (leadId is resolved even when no message matches)
 *   2. advance the message status (forward-only) + stamp the matching *_at column
 *   3. append a crm_message_events row (audit trail)
 *   4. for POSITIVE engagement (open/click/read/reply) → write a lead_activity
 *      and bump leads.last_engaged_at (feeds the behavioural lead score)
 *   5. for a bounce/complaint → suppress the contact's email (compliance)
 *   6. a not-yet-converted lead that CLICKS a campaign → open an owner follow-up task
 *
 * The lead-level effects (4, 6) fire whether or not a crm_message exists — a
 * campaign blast logs to email_logs, not crm_messages, so without this a
 * cold-blast open/click would score nothing on the lead. See PR #1066 (metrics)
 * and the CRM engagement plan.
 *
 * Best-effort + defensive: a provider we can't match is recorded and skipped,
 * never throws (a webhook must always 200 or the provider retries forever).
 */
const { supabaseAdmin } = require('../../config/supabase');
const { normalizePhone } = require('../aisensyService');
const { MONEY, TERMINAL } = require('./lifecycleRules');

// Forward-only status ranking so a late 'sent' can't overwrite 'read'.
const RANK = { queued: 0, processing: 1, sent: 2, delivered: 3, read: 4 };
const TERMINAL_MSG = new Set(['failed', 'bounced']);

// Provider event → { status?, stamp?, activity?, engaged?, suppressEmail? }
const EMAIL_MAP = {
  'email.sent': { status: 'sent', stamp: 'sent_at' },
  'email.delivered': { status: 'delivered', stamp: 'delivered_at' },
  'email.opened': { activity: 'email_opened', engaged: true },
  'email.clicked': { activity: 'email_clicked', engaged: true },
  'email.bounced': { status: 'bounced', stamp: 'failed_at', suppressEmail: true },
  'email.complained': { status: 'bounced', stamp: 'failed_at', suppressEmail: true },
};
const WA_MAP = {
  sent: { status: 'sent', stamp: 'sent_at' },
  delivered: { status: 'delivered', stamp: 'delivered_at' },
  read: { status: 'read', stamp: 'read_at', activity: 'whatsapp_read', engaged: true },
  failed: { status: 'failed', stamp: 'failed_at' },
  replied: { activity: 'whatsapp_reply', engaged: true, reply: true },
};

// Left axis of the two-axis lead model (v3.159 / B1): the last email's state,
// stamped on the lead per event, alongside the opens/clicks counters that the
// list-engagement threshold (B2) reads.
const EMAIL_STATUS_OF = {
  'email.sent': 'sent', 'email.delivered': 'delivered',
  'email.opened': 'opened', 'email.clicked': 'clicked',
  'email.bounced': 'bounced', 'email.complained': 'complained',
};
const isMissingSchema = (e) =>
  e && /column .* does not exist|Could not find|does not exist/i.test(e.message || '');

/** Resolve the lead behind a delivery event by channel identity. */
async function resolveLeadId({ channel, phone, email }) {
  if (channel === 'whatsapp' && phone) {
    const np = normalizePhone(phone);
    if (!np) return null;
    const { data } = await supabaseAdmin.from('leads').select('id').eq('phone', np).maybeSingle();
    return data?.id || null;
  }
  if (channel === 'email' && email) {
    const { data } = await supabaseAdmin.from('leads').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
    return data?.id || null;
  }
  return null;
}

/**
 * Locate both the crm_message (if any) and the lead. A campaign send has no
 * crm_message, so `message` may be null while `leadId` is set — the lead-level
 * effects still run off leadId.
 */
async function findTarget({ providerMessageId, channel, phone, email }) {
  if (providerMessageId) {
    const { data } = await supabaseAdmin.from('crm_messages').select('*').eq('provider_message_id', providerMessageId).maybeSingle();
    if (data) return { message: data, leadId: data.lead_id };
  }
  const leadId = await resolveLeadId({ channel, phone, email });
  if (!leadId) return { message: null, leadId: null };
  const { data } = await supabaseAdmin.from('crm_messages').select('*')
    .eq('lead_id', leadId).eq('channel', channel).eq('direction', 'outbound')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  return { message: data || null, leadId };
}

// A click from a lead that isn't already a customer/dead/DNC is a warm signal —
// open an idempotent owner follow-up task (dedup by key, so repeat clicks don't
// pile up). Cold (LIST) leads deliberately DO qualify — a cold clicker is gold.
async function maybeClickFollowUp(leadId) {
  try {
    const { data: lead } = await supabaseAdmin.from('leads')
      .select('status, converted_at').eq('id', leadId).maybeSingle();
    if (!lead) return;
    if (lead.converted_at || MONEY.has(lead.status) || TERMINAL.has(lead.status) || lead.status === 'do_not_contact') return;
    await require('./followUpService').openAuto({
      leadId, key: 'auto:campaign-click',
      title: 'Clicked a campaign email — follow up while warm', dueInDays: 1,
    });
  } catch (e) {
    console.warn('[crm] click follow-up failed:', e?.message || e);
  }
}

async function recordDeliveryEvent({ channel, event, providerMessageId, payload = {}, phone, email }) {
  try {
    const map = channel === 'email' ? EMAIL_MAP[event] : WA_MAP[event];
    const { message: msg, leadId } = await findTarget({ providerMessageId, channel, phone, email });
    const now = new Date().toISOString();

    // ── Message-level: audit event + forward-only status (only with a crm_message) ──
    if (msg) {
      await supabaseAdmin.from('crm_message_events').insert({ message_id: msg.id, event_type: event, payload });
      if (map) {
        const patch = { updated_at: now };
        if (map.status) {
          const cur = RANK[msg.status] ?? -1;
          const next = RANK[map.status] ?? -1;
          if (TERMINAL_MSG.has(map.status) || next > cur) patch.status = map.status;
        }
        if (map.stamp) patch[map.stamp] = now;
        if (Object.keys(patch).length > 1) await supabaseAdmin.from('crm_messages').update(patch).eq('id', msg.id);
      }
    }

    // ── Lead-level: email axis + engagement, with or without a crm_message ──
    // (a campaign blast logs to email_logs, not crm_messages). One write carries
    // the email_status axis + opens/clicks counters (B1) and the engagement stamps.
    if (map && leadId) {
      const patch = { updated_at: now };
      const es = EMAIL_STATUS_OF[event];
      if (es) patch.email_status = es;
      if (map.engaged) {
        patch.last_engaged_at = now; patch.last_activity_at = now;
        if (map.reply) patch.last_reply_at = now; // a real inbound reply, not a passive open
      }
      if (event === 'email.opened' || event === 'email.clicked') {
        // ponytail: read-modify-write; a single lead's webhook events are effectively
        // serial, so the increment race is negligible at this volume.
        const { data: cur } = await supabaseAdmin.from('leads').select('opens, clicks').eq('id', leadId).maybeSingle();
        if (event === 'email.opened') patch.opens = (cur?.opens || 0) + 1;
        else patch.clicks = (cur?.clicks || 0) + 1;
      }
      if (Object.keys(patch).length > 1) {
        const { error } = await supabaseAdmin.from('leads').update(patch).eq('id', leadId);
        // v3.159 (email_status/opens/clicks) not applied on this DB yet → drop the
        // new keys, keep the engagement stamps that predate B1.
        if (error && isMissingSchema(error)) {
          const { email_status, opens, clicks, ...safe } = patch;
          if (Object.keys(safe).length > 1) await supabaseAdmin.from('leads').update(safe).eq('id', leadId);
        }
      }
      if (map.activity) {
        await supabaseAdmin.from('lead_activities').insert({
          lead_id: leadId, type: map.activity, title: activityTitle(map.activity),
          meta: { message_id: msg?.id || null, channel }, occurred_at: now,
        });
        if (map.activity === 'email_clicked') await maybeClickFollowUp(leadId);
      }
    }

    // ── Compliance: a bounce/complaint suppresses the contact, even for a campaign
    // send with no crm_message — match by the message's contact, else by email. ──
    if (map?.suppressEmail) {
      if (msg?.contact_id) {
        await supabaseAdmin.from('contacts').update({ email_suppressed: true, updated_at: now }).eq('id', msg.contact_id);
      } else if (channel === 'email' && email) {
        await supabaseAdmin.from('contacts').update({ email_suppressed: true, updated_at: now }).eq('email', email.trim().toLowerCase());
      }
    }

    return { ok: true, matched: !!(msg || leadId) };
  } catch (err) {
    console.error('[crm] recordDeliveryEvent failed:', err.message);
    return { ok: false };
  }
}

function activityTitle(a) {
  return { email_opened: 'Email opened', email_clicked: 'Email link clicked', whatsapp_read: 'WhatsApp read', whatsapp_reply: 'WhatsApp reply received' }[a] || a;
}

module.exports = { recordDeliveryEvent };
