'use strict';
/**
 * backfillMeaningfulInteraction.js — populate the v3.133 relationship clocks from
 * existing CRM history. Idempotent (recompute-from-source): safe to re-run.
 *
 * Derives, per lead, from lead_activities:
 *   last_meaningful_interaction_at = latest CONTACT-type activity by a HUMAN (actor set)
 *   last_meaningful_channel        = channel of that latest meaningful activity
 *   meaningful_interaction_count   = count of human CONTACT-type activities
 *   last_automated_touch_at        = latest CONTACT-type activity by the SYSTEM (no actor)
 * and stamps lead_activities.is_meaningful on each human CONTACT row.
 *
 * Usage:
 *   node scripts/backfillMeaningfulInteraction.js --dry-run   # counts only, no writes
 *   node scripts/backfillMeaningfulInteraction.js             # writes
 *
 * Targets whatever Supabase project server/.env points at — run once per DB
 * (staging then prod). Matches the equivalent SQL applied via the Supabase MCP.
 */
require('dotenv').config();
const { supabaseAdmin } = require('../config/supabase');

const CONTACT_TYPES = ['whatsapp_sent', 'email_sent', 'call_logged'];
const CHANNEL_OF = { whatsapp_sent: 'whatsapp', email_sent: 'email', call_logged: 'call' };
const DRY = process.argv.includes('--dry-run');
const PAGE = 1000;

async function fetchContactActivities() {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('lead_activities')
      .select('lead_id, type, actor_admin_id, occurred_at')
      .in('type', CONTACT_TYPES)
      .order('occurred_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`fetch lead_activities: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

function rollup(activities) {
  const byLead = new Map();
  for (const a of activities) {
    if (!a.lead_id) continue;
    const acc = byLead.get(a.lead_id) || {
      last_meaningful_interaction_at: null, last_meaningful_channel: null,
      meaningful_interaction_count: 0, last_automated_touch_at: null,
    };
    const human = !!a.actor_admin_id;
    if (human) {
      acc.meaningful_interaction_count += 1;
      // activities are ascending, so the last human row seen is the latest.
      acc.last_meaningful_interaction_at = a.occurred_at;
      acc.last_meaningful_channel = CHANNEL_OF[a.type] || null;
    } else {
      acc.last_automated_touch_at = a.occurred_at;
    }
    byLead.set(a.lead_id, acc);
  }
  return byLead;
}

async function run() {
  console.log(`[backfill] meaningful-interaction ${DRY ? '(DRY RUN)' : '(WRITING)'}`);
  const activities = await fetchContactActivities();
  const byLead = rollup(activities);
  const humanRows = activities.filter((a) => a.actor_admin_id).length;
  console.log(`[backfill] ${activities.length} contact activities across ${byLead.size} leads; ${humanRows} meaningful (human) rows.`);

  if (DRY) {
    let sample = 0;
    for (const [leadId, acc] of byLead) {
      if (sample++ >= 5) break;
      console.log(`  ${leadId}: meaningful=${acc.meaningful_interaction_count} last=${acc.last_meaningful_interaction_at || '-'} auto=${acc.last_automated_touch_at || '-'}`);
    }
    console.log('[backfill] dry run — no writes.');
    return;
  }

  // 1. Classify the timeline rows in bulk (idempotent).
  const { error: clsErr } = await supabaseAdmin
    .from('lead_activities').update({ is_meaningful: true })
    .in('type', CONTACT_TYPES).not('actor_admin_id', 'is', null);
  if (clsErr) throw new Error(`classify lead_activities: ${clsErr.message}`);

  // 2. Write the per-lead rollup.
  let updated = 0;
  for (const [leadId, acc] of byLead) {
    const { error } = await supabaseAdmin.from('leads').update(acc).eq('id', leadId);
    if (error) { console.error(`  lead ${leadId} update failed: ${error.message}`); continue; }
    updated += 1;
  }
  console.log(`[backfill] done — ${updated}/${byLead.size} leads updated.`);
}

run().then(() => process.exit(0)).catch((e) => { console.error('[backfill] fatal:', e.message); process.exit(1); });
