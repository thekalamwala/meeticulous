'use strict';
/**
 * activity.js — CRM timeline writes.
 *
 * logActivity() appends one row to lead_activities and bumps the lead's
 * last_activity_at (and, for outbound touches, last_contacted_at). Every CRM
 * mutation that should show in a lead's timeline goes through here so the
 * write and the denormalized stamps never drift.
 *
 * MEANINGFUL vs AUTOMATED (v3.133 / relationship engine PR-1): this is the single
 * chokepoint every CRM touch flows through, so it is where we split a real human
 * conversation from an automated send:
 *   - an outbound CONTACT type with a human actor (`opts.actorAdminId` set) is a
 *     MEANINGFUL interaction → stamps last_meaningful_interaction_at/_channel and
 *     bumps meaningful_interaction_count; the activity row is is_meaningful=true.
 *   - the same CONTACT type with NO actor (system/sequence) is an AUTOMATED touch
 *     → stamps last_automated_touch_at only. Automated sends never raise "meaningful".
 *   - an internal note (note_added) is neither — it never reached the customer.
 *
 * Fire-and-forget friendly: a timeline write must never break the action that
 * triggered it, so failures are swallowed (logged) rather than thrown.
 *
 * Schema fallback: the v3.133 columns may not exist yet on a given DB. The first
 * "column missing" error flips `meaningfulColumns=false` and we retry with the
 * pre-v3.133 shape, so the timeline write itself never breaks on an un-migrated DB
 * (mirrors lifecycleEngine.writeScoring).
 */
const { supabaseAdmin } = require('../../config/supabase');

// Activity types that also count as "we contacted the lead" (moves last_contacted_at).
const CONTACT_TYPES = new Set(['whatsapp_sent', 'email_sent', 'call_logged']);
// A meaningful interaction is a CONTACT type performed by a human (actorAdminId set).
// Channel a meaningful/automated CONTACT type maps to.
const CHANNEL_OF = { whatsapp_sent: 'whatsapp', email_sent: 'email', call_logged: 'call' };

const isMissingColumn = (err) =>
  !!err && /column .* does not exist|Could not find/i.test(err.message || '');

let meaningfulColumns = true; // flipped false on first "column missing" (pre-v3.133 DB)

async function logActivity(leadId, type, opts = {}) {
  if (!leadId || !type) return null;
  const now = new Date().toISOString();
  const isContact = CONTACT_TYPES.has(type);
  const meaningful = isContact && !!opts.actorAdminId;   // human-authored contact / logged call
  const automated = isContact && !opts.actorAdminId;     // system send (sequence/engine)
  try {
    // ── 1. Append the timeline row (with is_meaningful when the column exists) ──
    const baseRow = {
      lead_id: leadId,
      type,
      actor_admin_id: opts.actorAdminId || null,
      title: opts.title || null,
      body: opts.body || null,
      meta: opts.meta || {},
      occurred_at: opts.occurredAt || now,
    };
    // is_meaningful (v3.133) + touch_reason (v3.137) are the newer activity columns;
    // both ride the same schema-fallback flag, so an un-migrated DB drops both on retry.
    const newCols = meaningfulColumns
      ? { is_meaningful: meaningful, ...(opts.touchReason ? { touch_reason: opts.touchReason } : {}) }
      : {};
    let ins = await supabaseAdmin
      .from('lead_activities')
      .insert({ ...baseRow, ...newCols })
      .select('id')
      .single();
    if (ins.error && isMissingColumn(ins.error) && meaningfulColumns) {
      meaningfulColumns = false;
      ins = await supabaseAdmin.from('lead_activities').insert(baseRow).select('id').single();
    }
    const activityId = ins.data?.id || null;

    // ── 2. Bump the denormalized stamps on the lead ──
    const patch = { last_activity_at: now, updated_at: now };
    if (isContact) patch.last_contacted_at = now;
    if (meaningfulColumns && meaningful) {
      patch.last_meaningful_interaction_at = now;
      patch.last_meaningful_channel = CHANNEL_OF[type] || null;
      // Non-atomic count bump. A concurrent race could drop one increment — harmless
      // at CRM volume, and only on genuine human touches (rare vs automated sends).
      // ponytail: promote to an atomic SQL increment only if this ever matters.
      const { data: cur } = await supabaseAdmin
        .from('leads').select('meaningful_interaction_count').eq('id', leadId).maybeSingle();
      patch.meaningful_interaction_count = (Number(cur?.meaningful_interaction_count) || 0) + 1;
    } else if (meaningfulColumns && automated) {
      patch.last_automated_touch_at = now;
    }

    let upd = await supabaseAdmin.from('leads').update(patch).eq('id', leadId);
    if (upd.error && isMissingColumn(upd.error) && meaningfulColumns) {
      meaningfulColumns = false;
      const {
        last_meaningful_interaction_at: _a, last_meaningful_channel: _b,
        meaningful_interaction_count: _c, last_automated_touch_at: _d, ...core
      } = patch;
      await supabaseAdmin.from('leads').update(core).eq('id', leadId);
    }

    return activityId;
  } catch (err) {
    console.error('[crm] logActivity failed:', err.message);
    return null;
  }
}

module.exports = { logActivity };
