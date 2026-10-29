'use strict';
/**
 * secondTouchService — Phase 3 automated warm follow-up (governed).
 *
 * A lead that CLICKED a campaign email but hasn't replied or converted is warm.
 * This job enqueues ONE governed second-touch email per such lead. It does NOT
 * send directly: it drops a queued crm_messages row and the existing crm-send
 * worker drains it through sendGate — crm_admin_sends kill-switch + quiet-hours
 * (09–20 IST) + touchGovernor (1 automated touch / 48h) + suppression /
 * unsubscribe. So every platform guardrail still applies; this only decides WHO
 * gets queued.
 *
 * Two independent OFF-guards before anything is queued (belt + braces on top of
 * crm_admin_sends, which gates the actual send):
 *   - `crm_second_touch` feature flag — fail-closed, ships OFF (featureRegistry).
 *   - CRM_SECOND_TOUCH_DRY_RUN !== 'false' — counts would-sends, enqueues nothing.
 * Go-live needs BOTH cleared AND crm_admin_sends already enabled.
 *
 * Depends on the click landing as a lead_activity — PR #1069 makes that true for
 * cold-campaign recipients (email_logs sends), not just crm_messages recipients.
 */
const { supabaseAdmin } = require('../../config/supabase');
const { isFeatureEnabled } = require('../featureFlags');
const { MONEY, TERMINAL } = require('./lifecycleRules');
const messageService = require('./messageService');

const FLAG = 'crm_second_touch';
const CREATED_BY = 'auto:second-touch';
const MIN_H = Number(process.env.SECOND_TOUCH_MIN_HOURS) || 24;      // wait ≥ this after the click
const MAX_H = Number(process.env.SECOND_TOUCH_MAX_HOURS) || 96;      // still warm ≤ this
const DEDUP_DAYS = Number(process.env.SECOND_TOUCH_DEDUP_DAYS) || 14; // ≤ 1 auto touch / lead / window
const BATCH = Number(process.env.SECOND_TOUCH_BATCH) || 100;

const SUBJECT = 'Still weighing it up, {{first_name}}?';
const PREVIEW = 'A quick follow-up on Book A Sloth';
const HTML = [
  '<p>Hi {{first_name}},</p>',
  "<p>Noticed you took a look at Book A Sloth — thought I'd follow up in case a question got in the way.</p>",
  '<p>Setting up your page and taking your first booking takes about two minutes. If anything is unclear, just reply to this email — it comes straight to me.</p>',
  '<p><a href="{{booking_link}}">Pick up where you left off →</a></p>',
  '<p>— Shubham, Book A Sloth</p>',
].join('\n');

async function run({ dryRun = true } = {}) {
  if (!(await isFeatureEnabled(FLAG))) return { skipped: true, reason: 'flag_off', enqueued: 0 };

  const now = Date.now();
  const oldest = new Date(now - MAX_H * 3600e3).toISOString();
  const newest = new Date(now - MIN_H * 3600e3).toISOString();

  // Clicks inside the warm window, newest first so we keep the latest click per lead.
  const { data: acts } = await supabaseAdmin.from('lead_activities')
    .select('lead_id, occurred_at')
    .eq('type', 'email_clicked')
    .gte('occurred_at', oldest).lte('occurred_at', newest)
    .order('occurred_at', { ascending: false })
    .limit(BATCH * 5);

  const latestClick = new Map();
  for (const a of acts || []) if (a.lead_id && !latestClick.has(a.lead_id)) latestClick.set(a.lead_id, a.occurred_at);

  const since = new Date(now - DEDUP_DAYS * 864e5).toISOString();
  let enqueued = 0, skipped = 0, scanned = 0;

  for (const [leadId, clickAt] of latestClick) {
    if (enqueued + skipped >= BATCH) break;
    scanned++;
    const { data: lead } = await supabaseAdmin.from('leads').select('*').eq('id', leadId).maybeSingle();
    if (!lead || !lead.email) { skipped++; continue; }
    if (lead.converted_at || MONEY.has(lead.status) || TERMINAL.has(lead.status)
        || lead.do_not_contact || lead.status === 'do_not_contact') { skipped++; continue; }
    // Replied since the click → a real conversation is underway; leave it to a human.
    if (lead.last_reply_at && new Date(lead.last_reply_at) >= new Date(clickAt)) { skipped++; continue; }
    // One automated second-touch per lead per window (governor also caps globally).
    const { data: prior } = await supabaseAdmin.from('crm_messages')
      .select('id').eq('lead_id', leadId).eq('created_by', CREATED_BY)
      .gte('created_at', since).limit(1).maybeSingle();
    if (prior) { skipped++; continue; }

    if (dryRun) { enqueued++; continue; } // would-send count only
    await messageService.enqueue({
      leadId, channel: 'email',
      subject: SUBJECT,
      variables: { html: HTML, preview: PREVIEW },
      senderKey: 'shubham',
      idempotencyKey: `second_touch:${leadId}:${clickAt.slice(0, 10)}`,
      createdBy: CREATED_BY,
    });
    enqueued++;
  }
  return { enqueued, skipped, scanned, dryRun };
}

module.exports = { run };
