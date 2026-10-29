/**
 * campaignService — create, launch (snapshot recipients), and report stats for
 * campaigns. Sending itself is done by campaignWorker via the channel engines.
 */
'use strict';
const { supabaseAdmin } = require('../config/supabase');
const segmentService = require('./segmentService');

const isMissingSchema = (e) =>
  e && /Could not find the|does not exist|column .* does not exist/i.test(e.message || '');

async function create(input) {
  const row = {
    name: input.name, channel: input.channel || 'email', segment_id: input.segment_id || null,
    template_id: input.template_id || null, whatsapp_template_id: input.whatsapp_template_id || null,
    subject_override: input.subject_override || '',
    status: 'draft', scheduled_at: input.scheduled_at || null,
    throttle_per_min: input.throttle_per_min || 120, created_by: input.created_by || '',
    // Composer fields (v3.133). Stripped on the fallback insert below if the
    // migration hasn't landed on this DB yet.
    audience_type: input.audience_type || 'segment', audience_ref: input.audience_ref || null,
    design_json: input.design_json || null, html_content: input.html_content || null,
    subject: input.subject || null, preview_text: input.preview_text || null,
    sender_key: input.sender_key || 'shubham',
    // v3.153: the send shell (customer|vendor|cold). Lets 'cold' outreach fire.
    layout: input.layout || 'customer',
  };
  let { data, error } = await supabaseAdmin.from('email_campaigns').insert(row).select().single();
  if (error && isMissingSchema(error)) {
    const { audience_type, audience_ref, design_json, html_content, subject, preview_text, sender_key, layout, ...safe } = row;
    ({ data, error } = await supabaseAdmin.from('email_campaigns').insert(safe).select().single());
  }
  if (error) return { error: error.message };
  return { campaign: data };
}

/** Resolve segment → snapshot consented recipients → status 'sending'. */
async function launch(campaignId) {
  const { data: campaign } = await supabaseAdmin.from('email_campaigns').select('*').eq('id', campaignId).single();
  if (!campaign) return { error: 'campaign_not_found' };
  const channel = campaign.channel || 'email';
  if (channel === 'whatsapp' && !campaign.whatsapp_template_id) return { error: 'no_whatsapp_template' };
  // Email needs either a saved template OR composed HTML (custom campaign).
  if (channel === 'email' && !campaign.template_id && !campaign.html_content) return { error: 'no_content' };
  if (!['draft', 'scheduled'].includes(campaign.status)) return { error: `cannot_launch_from_${campaign.status}` };

  // Manual / single audience → snapshot the explicit pick; else resolve the segment.
  let recipients;
  if (['manual', 'single'].includes(campaign.audience_type)) {
    recipients = await segmentService.resolveRefs(campaign.audience_ref || {}, channel);
  } else {
    const { data: segment } = await supabaseAdmin.from('segments').select('*').eq('id', campaign.segment_id).single();
    recipients = await segmentService.resolve(segment ? segment.definition : {}, channel);
  }

  if (recipients.length) {
    const rows = recipients.map((c) => ({
      campaign_id: campaignId, contact_id: c.id, channel,
      destination: channel === 'whatsapp' ? c.phone : c.email, status: 'queued', attempts: 0,
    }));
    const { error } = await supabaseAdmin.from('campaign_recipients').insert(rows).select();
    if (error) return { error: error.message };
  }

  const stats = { total: recipients.length, queued: recipients.length, sent: 0, failed: 0, skipped: 0 };
  await supabaseAdmin.from('email_campaigns')
    .update({ status: 'sending', stats, updated_at: new Date().toISOString() })
    .eq('id', campaignId).select().single();

  return { recipients: recipients.length };
}

async function stats(campaignId) {
  const { data } = await supabaseAdmin.from('campaign_recipients').select('status').eq('campaign_id', campaignId);
  const acc = { total: 0, queued: 0, sent: 0, failed: 0, skipped: 0 };
  for (const r of data || []) { acc.total++; acc[r.status] = (acc[r.status] || 0) + 1; }
  return acc;
}

module.exports = { create, launch, stats };
