'use strict';
/**
 * sequenceService.js — lightweight drip automation.
 *
 * A sequence is an ordered list of steps (delay + channel + template). Enrolling
 * a lead schedules the first step; the worker fires due steps through
 * MessageService (so every send passes the kill-switch + DNC + opt-out gate) and
 * advances the enrollment. A sequence STOPS immediately when the lead replies,
 * converts, is marked Do Not Contact, or unsubscribes.
 *
 * Because sends route through MessageService, nothing fires while the global
 * `crm_admin_sends` kill-switch is OFF (default) — the enrollment simply waits.
 */
const { supabaseAdmin } = require('../../config/supabase');
const messageService = require('./messageService');
const { logActivity } = require('./activity');

const CONVERTED = new Set(['activated', 'paid']);
const BATCH = 50;

async function steps(sequenceId) {
  const { data } = await supabaseAdmin.from('crm_sequence_steps').select('*')
    .eq('sequence_id', sequenceId).order('step_no', { ascending: true });
  return data || [];
}

/** Enroll a lead; schedules step 1 at now + step1.delay_hours. Idempotent per (sequence, lead). */
async function enroll(sequenceId, leadId, enrolledBy = '') {
  const { data: existing } = await supabaseAdmin.from('crm_sequence_enrollments')
    .select('*').eq('sequence_id', sequenceId).eq('lead_id', leadId).maybeSingle();
  if (existing && existing.status === 'active') return existing;

  const s = await steps(sequenceId);
  if (!s.length) throw new Error('sequence has no steps');
  const nextRun = new Date(Date.now() + (s[0].delay_hours || 0) * 3600 * 1000).toISOString();

  const row = { sequence_id: sequenceId, lead_id: leadId, status: 'active', current_step: 0, next_run_at: nextRun, enrolled_by: enrolledBy, updated_at: new Date().toISOString() };
  let enrollment;
  if (existing) {
    ({ data: enrollment } = await supabaseAdmin.from('crm_sequence_enrollments').update(row).eq('id', existing.id).select('*').single());
  } else {
    ({ data: enrollment } = await supabaseAdmin.from('crm_sequence_enrollments').insert(row).select('*').single());
  }
  await logActivity(leadId, 'sequence_enrolled', { title: 'Enrolled in sequence', meta: { sequence_id: sequenceId, enrollment_id: enrollment.id } });
  return enrollment;
}

/** Enroll a lead into the active sequence with this exact name. Best-effort:
 *  returns null if no such active sequence exists (e.g. seed not run yet). */
async function enrollByName(name, leadId, enrolledBy = '') {
  try {
    const { data: seq } = await supabaseAdmin.from('crm_sequences')
      .select('id, is_active').eq('name', name).maybeSingle();
    if (!seq?.id || !seq.is_active) return null;
    return await enroll(seq.id, leadId, enrolledBy);
  } catch (e) {
    console.warn('[crm] enrollByName failed:', e?.message || e);
    return null;
  }
}

async function stop(enrollmentId, reason) {
  const { data } = await supabaseAdmin.from('crm_sequence_enrollments')
    .update({ status: 'stopped', stopped_reason: reason, updated_at: new Date().toISOString() })
    .eq('id', enrollmentId).select('*').single();
  if (data) await logActivity(data.lead_id, 'sequence_stopped', { title: `Sequence stopped (${reason})`, meta: { enrollment_id: enrollmentId, reason } });
  return data;
}

/** Which stop reason (if any) applies to this lead for this sequence. */
function stopReason(lead, seq) {
  if (!lead) return 'lead_missing';
  if (lead.do_not_contact || lead.status === 'do_not_contact') return 'dnc';
  if (seq.stop_on_convert && CONVERTED.has(lead.status)) return 'converted';
  if (seq.stop_on_reply && lead.status === 'replied') return 'replied';
  return null;
}

/** Cron tick: advance every due active enrollment by one step. Leader-elected. */
async function processDue() {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin.from('crm_sequence_enrollments')
    .select('*').eq('status', 'active').lte('next_run_at', nowIso)
    .order('next_run_at', { ascending: true }).limit(BATCH);
  if (!due?.length) return { sent: 0, stopped: 0, completed: 0 };

  let sent = 0, stopped = 0, completed = 0;
  for (const en of due) {
    const { data: seq } = await supabaseAdmin.from('crm_sequences').select('*').eq('id', en.sequence_id).maybeSingle();
    const { data: lead } = await supabaseAdmin.from('leads').select('*').eq('id', en.lead_id).maybeSingle();
    if (!seq || !seq.is_active) { await stop(en.id, 'sequence_inactive'); stopped++; continue; }

    const reason = stopReason(lead, seq);
    if (reason) { await stop(en.id, reason); stopped++; continue; }

    const s = await steps(en.sequence_id);
    const next = s.find((st) => st.step_no === en.current_step + 1);
    if (!next) {
      await supabaseAdmin.from('crm_sequence_enrollments').update({ status: 'completed', updated_at: nowIso }).eq('id', en.id);
      completed++; continue;
    }

    // Fire the step through the gated queue (idempotent per enrollment+step).
    try {
      await messageService.enqueue({
        leadId: en.lead_id, channel: next.channel, templateKey: next.template_key,
        subject: next.subject, body: next.body,
        // WhatsApp steps carry ordered template params in step.variables (jsonb array);
        // email steps carry a { preview } object for the inbox preheader.
        variables: {
          html: next.body,
          params: Array.isArray(next.variables) ? next.variables : (next.variables?.params || []),
          preview: Array.isArray(next.variables) ? undefined : (next.variables?.preview || undefined),
        },
        // Step persona overrides the sequence persona; null → global default.
        senderKey: next.sender_key || seq.sender_key || null,
        sequenceId: en.sequence_id, enrollmentId: en.id,
        idempotencyKey: `seq:${en.id}:${next.step_no}`, createdBy: 'sequence', immediate: false,
      });
      sent++;
    } catch (err) {
      console.error('[crm] sequence enqueue failed:', err.message);
    }

    const following = s.find((st) => st.step_no === next.step_no + 1);
    const patch = { current_step: next.step_no, updated_at: nowIso };
    if (following) patch.next_run_at = new Date(Date.now() + (following.delay_hours || 0) * 3600 * 1000).toISOString();
    else { patch.status = 'completed'; }
    await supabaseAdmin.from('crm_sequence_enrollments').update(patch).eq('id', en.id);
    if (patch.status === 'completed') completed++;
  }
  return { sent, stopped, completed };
}

module.exports = { enroll, enrollByName, stop, processDue, stopReason };
