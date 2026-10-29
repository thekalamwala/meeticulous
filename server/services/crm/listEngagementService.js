'use strict';
/**
 * listEngagementService — B2: promote/nurture the cold pool by email engagement.
 *
 * lifecycleEngine deliberately excludes status='list' (OPEN_EXCLUDE), so cold
 * leads never enter the funnel automation. This batch job fills that seam using
 * the B1 counters (leads.opens / leads.clicks, set by the webhook):
 *   opens≥1 & clicks≥2 → promote list→'new' + enroll 'New marketing'; the lead
 *                         then flows through lifecycleEngine like any warm lead.
 *   clicks≥1           → enroll 'Clickers nurture' (stays 'list')
 *   opens≥1            → enroll 'Openers nurture'  (stays 'list')
 * Engagement ladders run once-ever per lead and never stack; promotion stops any
 * active ladder (the lead graduated).
 *
 * Two OFF-guards: the crm_list_engagement flag (fail-closed, ships OFF) +
 * CRM_LIST_ENGAGEMENT_DRY_RUN!=='false' (counts intentions, writes nothing).
 * Nothing is sent here — enrolled steps drain through sequenceService → sendGate,
 * still behind crm_admin_sends. Sequences are enrolled BY NAME and no-op softly
 * until seedLifecycleSequences has run (so this is safe before the seed lands).
 */
const { supabaseAdmin } = require('../../config/supabase');
const { isFeatureEnabled } = require('../featureFlags');
const sequenceService = require('./sequenceService');
const leadService = require('./leadService');

const FLAG = 'crm_list_engagement';
const BATCH = Number(process.env.LIST_ENGAGEMENT_BATCH) || 300;
const SEQ_OPENERS = 'Openers nurture';
const SEQ_CLICKERS = 'Clickers nurture';
const SEQ_NEW = 'New marketing';

async function activeSeqId(name) {
  const { data } = await supabaseAdmin.from('crm_sequences')
    .select('id').eq('name', name).eq('is_active', true).maybeSingle();
  return data?.id || null;
}
// Ever enrolled in this sequence (any status)? once-ever guard so a completed
// ladder is never resurrected on a later scan.
async function everEnrolled(seqId, leadId) {
  const { data } = await supabaseAdmin.from('crm_sequence_enrollments')
    .select('id').eq('sequence_id', seqId).eq('lead_id', leadId).maybeSingle();
  return !!data;
}
async function inActiveLadder(leadId, ids) {
  if (!ids.length) return false;
  const { data } = await supabaseAdmin.from('crm_sequence_enrollments')
    .select('id').eq('lead_id', leadId).eq('status', 'active').in('sequence_id', ids).limit(1);
  return !!(data && data.length);
}
async function stopLadders(leadId, ids) {
  if (!ids.length) return;
  const { data } = await supabaseAdmin.from('crm_sequence_enrollments')
    .select('id').eq('lead_id', leadId).eq('status', 'active').in('sequence_id', ids);
  for (const e of data || []) { try { await sequenceService.stop(e.id, 'graduated'); } catch (_) { /* best-effort */ } }
}

async function run({ dryRun = true } = {}) {
  if (!(await isFeatureEnabled(FLAG))) return { skipped: true, reason: 'flag_off', promoted: 0, enrolled: 0 };

  const { data: leads } = await supabaseAdmin.from('leads')
    .select('id, status, opens, clicks, do_not_contact')
    .eq('status', 'list').or('opens.gte.1,clicks.gte.1')
    .order('updated_at', { ascending: true }).limit(BATCH);
  if (!leads?.length) return { promoted: 0, enrolled: 0, scanned: 0, dryRun };

  const openersId = await activeSeqId(SEQ_OPENERS);
  const clickersId = await activeSeqId(SEQ_CLICKERS);
  const ladderIds = [openersId, clickersId].filter(Boolean);
  let promoted = 0, enrolled = 0, scanned = 0;

  for (const lead of leads) {
    try {
      scanned++;
      if (lead.do_not_contact) continue;
      const opens = lead.opens || 0, clicks = lead.clicks || 0;

      // Threshold → graduate to the funnel.
      if (opens >= 1 && clicks >= 2) {
        if (dryRun) { promoted++; continue; }
        await leadService.changeStatus(lead.id, 'new', null, { via: 'engagement_threshold' });
        await stopLadders(lead.id, ladderIds);
        await sequenceService.enrollByName(SEQ_NEW, lead.id, 'engagement:threshold').catch(() => {});
        promoted++;
        continue;
      }

      // Sub-threshold nurture — one ladder, once ever, never stacked.
      const seqId = clicks >= 1 ? clickersId : openersId;
      if (!seqId) continue; // ladder not seeded yet
      if (await inActiveLadder(lead.id, ladderIds)) continue;
      if (await everEnrolled(seqId, lead.id)) continue;
      if (dryRun) { enrolled++; continue; }
      await sequenceService.enroll(seqId, lead.id, clicks >= 1 ? 'engagement:clickers' : 'engagement:openers').catch(() => {});
      enrolled++;
    } catch (err) {
      console.error(`[crm] list-engagement: lead ${lead.id} failed:`, err.message);
    }
  }
  return { promoted, enrolled, scanned, dryRun };
}

module.exports = { run };
