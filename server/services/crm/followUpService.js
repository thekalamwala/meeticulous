'use strict';
/**
 * followUpService.js — owner-facing sales tasks (lead_follow_ups).
 *
 * Distinct from services/followups (that is the booking rebook-nudge drip).
 * These are "remind me to chase Rahul on Tuesday" tasks the sales team sees on
 * the dashboard. processReminders() optionally pings the owner (email/WA) when
 * a task with remind=true comes due, guarded so a reminder never fires twice.
 */
const { supabaseAdmin } = require('../../config/supabase');
const { logActivity } = require('./activity');
const sendEmail = require('../../utils/sendEmail');

async function create({ leadId, ownerAdminId, title, dueAt, remind = true, createdBy = '' }) {
  if (!leadId || !title || !dueAt) throw new Error('leadId, title, dueAt required');
  const { data, error } = await supabaseAdmin.from('lead_follow_ups')
    .insert({ lead_id: leadId, owner_admin_id: ownerAdminId || null, title: String(title).trim(), due_at: new Date(dueAt).toISOString(), remind: !!remind, created_by: createdBy })
    .select('*').single();
  if (error) throw error;
  await logActivity(leadId, 'follow_up_created', { actorAdminId: ownerAdminId, title: `Follow-up: ${title}`, meta: { follow_up_id: data.id, due_at: data.due_at } });
  return data;
}

/**
 * Idempotently open an AUTOMATION follow-up task (audit Phase 4). Skips if an
 * open task with the same `key` marker already exists for the lead, so repeated
 * webhook deliveries or re-fired lifecycle events never pile up duplicate tasks.
 * Inherits the lead's owner so the task lands in their queue. Never throws — a
 * CRM automation must not break the webhook/payment flow it hangs off.
 *
 * @param {object} p
 * @param {string} p.leadId
 * @param {string} p.key         dedup + created_by marker (e.g. 'auto:churn')
 * @param {string} p.title       task title shown in the queue
 * @param {number} [p.dueInDays] days from now the task is due (0 = today)
 * @returns {Promise<object|null>} the task row (new or existing), or null
 */
async function openAuto({ leadId, key, title, dueInDays = 1 } = {}) {
  if (!leadId || !key || !title) return null;
  try {
    const { data: existing } = await supabaseAdmin.from('lead_follow_ups')
      .select('id').eq('lead_id', leadId).eq('status', 'open').eq('created_by', key).limit(1).maybeSingle();
    if (existing) return existing;
    const { data: lead } = await supabaseAdmin.from('leads')
      .select('owner_admin_id').eq('id', leadId).maybeSingle();
    const dueAt = new Date(Date.now() + Math.max(0, dueInDays) * 864e5).toISOString();
    return await create({ leadId, ownerAdminId: lead?.owner_admin_id || null, title, dueAt, remind: true, createdBy: key });
  } catch (e) {
    console.warn('[crm] openAuto follow-up failed:', e?.message || e);
    return null;
  }
}

async function complete(id, actorAdminId) {
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin.from('lead_follow_ups')
    .update({ status: 'done', completed_at: now, updated_at: now }).eq('id', id).select('*').single();
  if (data) await logActivity(data.lead_id, 'follow_up_completed', { actorAdminId, title: `Follow-up done: ${data.title}`, meta: { follow_up_id: id } });
  return data;
}

async function cancel(id) {
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin.from('lead_follow_ups')
    .update({ status: 'cancelled', updated_at: now }).eq('id', id).select('*').single();
  return data;
}

/** Open follow-ups, optionally scoped to an owner and a due window. */
async function listOpen({ ownerAdminId, before, leadId } = {}) {
  let q = supabaseAdmin.from('lead_follow_ups').select('*').eq('status', 'open');
  if (ownerAdminId) q = q.eq('owner_admin_id', ownerAdminId);
  if (leadId) q = q.eq('lead_id', leadId);
  if (before) q = q.lte('due_at', new Date(before).toISOString());
  const { data } = await q.order('due_at', { ascending: true }).limit(200);
  return data || [];
}

/**
 * Cron tick: email the owner for each due, remind=true, not-yet-reminded task.
 * Leader-elected by the caller. Best-effort; a failed reminder is retried next
 * tick (reminded_at only set on success).
 */
async function processReminders() {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin.from('lead_follow_ups')
    .select('*').eq('status', 'open').eq('remind', true).is('reminded_at', null)
    .lte('due_at', nowIso).limit(100);
  if (!due?.length) return { reminded: 0 };

  let reminded = 0;
  for (const f of due) {
    if (!f.owner_admin_id) continue;
    const { data: owner } = await supabaseAdmin.from('admin_users').select('email, name').eq('id', f.owner_admin_id).maybeSingle();
    if (!owner?.email) continue;
    const { data: lead } = await supabaseAdmin.from('leads').select('name, business_name').eq('id', f.lead_id).maybeSingle();
    const who = lead?.business_name || lead?.name || 'a lead';
    try {
      await sendEmail({
        to: owner.email,
        subject: `Follow-up due: ${f.title}`,
        html: `<p>Hi ${owner.name || 'there'},</p><p>Reminder to follow up with <b>${who}</b>:</p><blockquote>${f.title}</blockquote><p>Open the lead in the Book A Sloth admin to continue.</p>`,
        text: `Follow up with ${who}: ${f.title}`,
      });
      await supabaseAdmin.from('lead_follow_ups').update({ reminded_at: new Date().toISOString() }).eq('id', f.id);
      reminded++;
    } catch (err) {
      console.error('[crm] follow-up reminder failed:', err.message);
    }
  }
  return { reminded };
}

module.exports = { create, openAuto, complete, cancel, listOpen, processReminders };
