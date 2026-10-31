'use strict';
/**
 * MessageService — CRM outbound send orchestrator + queue worker.
 *
 * One entry point (enqueue) and one worker (processQueue). Every send becomes a
 * crm_messages row: `queued` rows are the worklist the cron drains. The row is
 * both the durable record (source of truth for CRM history) and the queue item,
 * so there is no separate queue table. Idempotency key prevents double-sends on
 * retry or duplicate enqueue.
 *
 * Actual delivery is delegated to WhatsAppService / EmailService (which wrap
 * AiSensy / Resend and enforce the send gate). This file owns: templating, the
 * crm_messages lifecycle, retry backoff, and timeline writes.
 */
const { supabaseAdmin } = require('../../config/supabase');
const whatsapp = require('./whatsappService');
const email = require('./emailService');
const { logActivity } = require('./activity');
const senderRegistry = require('../email/senderRegistry');
const { MARKETING_PROVIDER } = require('../email/providers');

const isMissingColumn = (e) => e?.code === '42703' || e?.code === 'PGRST204'
  || /column .* does not exist|could not find the '.*' column/i.test(e?.message || '');

const RETRY_BACKOFF_MIN = [5, 30, 120]; // matches the email queue
const MAX_ATTEMPTS = RETRY_BACKOFF_MIN.length;
const BATCH = 50;

// Senders whose email sends render PLAIN (no brand shell) — a hand-typed 1:1 note.
// The founder cold voice (Shubham) and his warm second-touch use this; the branded
// personas (Tithi/Sujata/Durga) keep the marketing shell.
const PLAIN_SENDERS = new Set(['shubham']);

const SITE_URL = process.env.SITE_URL || 'https://meeticulous.com';

/** Render {{var}} tokens from a lead. Unknown tokens collapse to ''. */
function renderVars(str, lead, extra = {}) {
  if (!str) return str;
  const first = (lead.name || '').trim().split(/\s+/)[0] || 'there';
  const map = {
    first_name: first,
    name: lead.name || 'there',
    business_name: lead.business_name || '',
    profession: lead.profession || '',
    city: lead.city || '',
    booking_link: SITE_URL,
    sales_owner: extra.sales_owner || '',
    ...extra,
  };
  return String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (k in map ? map[k] : ''));
}

/** Ordered WhatsApp template params rendered from a variables array of tokens/strings.
 *  `extra` supplies profile-derived tokens the lead lacks (username, account_name). */
function renderParams(variables, lead, extra = {}) {
  if (!Array.isArray(variables)) return [];
  return variables.map((v) => renderVars(String(v), lead, extra));
}

async function getLead(leadId) {
  const { data } = await supabaseAdmin.from('leads').select('*').eq('id', leadId).maybeSingle();
  return data || null;
}

/**
 * Queue (or immediately send) one CRM message.
 * @returns the crm_messages row.
 */
async function enqueue({
  leadId, channel, templateKey, subject, body, variables = {},
  campaignId = null, sequenceId = null, enrollmentId = null, senderKey = null,
  idempotencyKey = null, createdBy = '', immediate = false,
}) {
  const now = new Date().toISOString();

  // Idempotency: if a row with this key already exists, return it (no dup send).
  if (idempotencyKey) {
    const { data: existing } = await supabaseAdmin
      .from('crm_messages').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) return existing;
  }

  const lead = await getLead(leadId);
  const bodyPreview = channel === 'email'
    ? (subject ? renderVars(subject, lead || {}) : '')
    : renderVars(templateKey || '', lead || {});

  const insertRow = {
    lead_id: leadId,
    contact_id: lead?.contact_id || null,
    channel,
    template_key: templateKey || null,
    subject: subject || null,
    body_preview: bodyPreview || null,
    variables,
    provider: channel === 'whatsapp' ? 'aisensy' : MARKETING_PROVIDER,
    status: 'queued',
    next_attempt_at: now,
    campaign_id: campaignId,
    sequence_id: sequenceId,
    enrollment_id: enrollmentId,
    sender_key: senderKey || null,
    idempotency_key: idempotencyKey,
    created_by: createdBy,
  };
  let { data: row, error } = await supabaseAdmin.from('crm_messages').insert(insertRow).select('*').single();
  // Schema fallback: sender_key column not present yet (v3.122 unapplied) → retry without it.
  if (error && isMissingColumn(error)) {
    const { sender_key, ...rest } = insertRow;
    ({ data: row, error } = await supabaseAdmin.from('crm_messages').insert(rest).select('*').single());
  }
  if (error) throw error;

  if (immediate) return dispatch(row, lead);
  return row;
}

/**
 * Deliver one crm_messages row now; updates status + writes a timeline activity.
 * @param {object} [opts]
 * @param {boolean} [opts.automated=false]  true for queue/sequence sends → subject
 *        to the sendGate quiet-hours + frequency cap. Human composer sends (the
 *        immediate enqueue path) leave this false and are exempt.
 */
async function dispatch(row, leadArg, opts = {}) {
  const lead = leadArg || (await getLead(row.lead_id));
  if (!lead) return markFailed(row, 'lead_missing');

  const automated = !!opts.automated;
  let result;
  // Profile-derived tokens the lead lacks — {{username}} (public profile URL) and
  // {{account_name}}. Fetched once and used by BOTH WhatsApp params and email copy.
  let extra = {};
  if (lead.profile_id) {
    const { data: prof } = await supabaseAdmin.from('profiles').select('username, name').eq('id', lead.profile_id).maybeSingle();
    if (prof) extra = { username: prof.username || '', account_name: prof.name || lead.name || '' };
  }

  if (row.channel === 'whatsapp') {
    result = await whatsapp.send({
      lead,
      templateKey: row.template_key,
      templateParams: renderParams(row.variables?.params || row.variables?.templateParams, lead, extra),
      buttonParams: row.variables?.buttonParams || [],   // dynamic URL button (cold-call tracking link)
      userName: extra.account_name || lead.name,
      automated,
    });
  } else {
    const subject = renderVars(row.subject, lead, extra);
    const html = renderVars(row.variables?.html || row.body_preview || '', lead, extra);
    // Send FROM the message's persona (Tithi lifecycle / Sujata offers); null → global default.
    const sender = await senderRegistry.byKey(row.sender_key);
    result = await email.send({
      lead, subject, html, text: renderVars(row.variables?.text, lead, extra),
      category: row.sender_key === 'sujata' ? 'Offer' : '',   // header pill
      previewText: row.variables?.preview ? renderVars(row.variables.preview, lead, extra) : '',
      fromName: sender?.fromName, fromEmail: sender?.fromEmail, replyTo: sender?.replyTo, automated,
      plain: PLAIN_SENDERS.has(row.sender_key),   // founder cold → hand-typed, no brand shell
    });
  }

  // Quiet-hours / frequency-capped: re-queue for later WITHOUT consuming a retry
  // attempt — this is "not now", not a failure.
  if (result.defer) {
    const delayMs = result.reason === 'quiet_hours' ? 60 * 60 * 1000 : 6 * 60 * 60 * 1000;
    const next = new Date(Date.now() + delayMs).toISOString();
    const now = new Date().toISOString();
    await supabaseAdmin.from('crm_messages')
      .update({ status: 'queued', next_attempt_at: next, error: result.reason, updated_at: now })
      .eq('id', row.id);
    return { ...row, status: 'queued', deferred: true, error: result.reason };
  }

  if (result.skipped) {
    await supabaseAdmin.from('crm_messages')
      .update({ status: 'skipped', error: result.reason, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    return { ...row, status: 'skipped', error: result.reason };
  }

  if (result.success) {
    const now = new Date().toISOString();
    await supabaseAdmin.from('crm_messages')
      .update({ status: 'sent', provider_message_id: result.providerMessageId || null, sent_at: now, error: null, updated_at: now })
      .eq('id', row.id);
    await logActivity(row.lead_id, row.channel === 'whatsapp' ? 'whatsapp_sent' : 'email_sent', {
      actorAdminId: null,
      title: row.channel === 'whatsapp' ? 'WhatsApp sent' : 'Email sent',
      body: row.body_preview || row.subject || '',
      meta: { message_id: row.id, template_key: row.template_key, campaign_id: row.campaign_id, sequence_id: row.sequence_id },
    });
    return { ...row, status: 'sent' };
  }

  return markFailed(row, result.error || 'send_failed');
}

async function markFailed(row, error) {
  const attempts = (row.attempts || 0) + 1;
  const now = Date.now();
  const patch = { attempts, error, updated_at: new Date().toISOString() };
  if (attempts >= MAX_ATTEMPTS) {
    patch.status = 'failed';
    patch.failed_at = new Date().toISOString();
  } else {
    patch.status = 'queued';
    patch.next_attempt_at = new Date(now + RETRY_BACKOFF_MIN[attempts - 1] * 60 * 1000).toISOString();
  }
  await supabaseAdmin.from('crm_messages').update(patch).eq('id', row.id);
  return { ...row, ...patch };
}

/** Cron tick: drain due queued rows. Leader-elected by the caller (jobLock). */
async function processQueue() {
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabaseAdmin
    .from('crm_messages')
    .select('*')
    .eq('status', 'queued')
    .lte('next_attempt_at', nowIso)
    .order('next_attempt_at', { ascending: true })
    .limit(BATCH);
  if (error || !rows?.length) return { sent: 0, failed: 0, skipped: 0 };

  let sent = 0, failed = 0, skipped = 0;
  for (const row of rows) {
    // Claim the row so a concurrent tick on the same instance can't double-send.
    const { data: claimed } = await supabaseAdmin
      .from('crm_messages').update({ status: 'processing', updated_at: nowIso })
      .eq('id', row.id).eq('status', 'queued').select('id').maybeSingle();
    if (!claimed) continue;
    const out = await dispatch({ ...row, status: 'processing' }, null, { automated: true });
    if (out.status === 'sent') sent++;
    else if (out.status === 'skipped') skipped++;
    else if (out.status === 'failed') failed++;
  }
  return { sent, failed, skipped };
}

module.exports = { enqueue, dispatch, processQueue, renderVars, renderParams };
