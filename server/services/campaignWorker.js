/**
 * campaignWorker — drives 'sending' campaigns. Each tick, for every sending
 * campaign, process up to throttle_per_min queued recipients.
 *   - email    → render template + enqueue into the email queue (delivered by
 *                communicationEngine.processQueue with retry/backoff)
 *   - whatsapp → send the approved AiSensy template now, throttled
 * Idempotent per recipient (only 'queued' rows are picked). Flips campaign to
 * 'sent' when no queued recipients remain. Consent/suppression is re-checked
 * here per channel (defence in depth over segment resolution).
 */
'use strict';
const { supabaseAdmin } = require('../config/supabase');
const communicationEngine = require('./email/communicationEngine');
const aisensy = require('./aisensyService');
const waTemplates = require('./whatsappTemplateService');
const NotificationEngine = require('./notificationEngine');
const sendBudget = require('./email/sendBudget');

async function processDue() {
  const { data: campaigns } = await supabaseAdmin.from('email_campaigns').select('*').eq('status', 'sending');
  let enqueued = 0, failed = 0;

  // ── Cold email budget: the SHARED Resend remainder, 18:00 IST window only ──
  // Campaigns are cold acquisition (P3) and go LAST: only inside the cold window,
  // capped by the warm-up ramp AND whatever budget CRM (P1/P2) left today. Outside
  // the window / on a skip day this is 0, so email recipients stay 'queued' and
  // resume at 18:00. WhatsApp campaigns are a different provider (AiSensy) and are
  // never gated by this. See services/email/sendBudget.js.
  let emailBudget = await sendBudget.coldAllowanceNow();

  for (const campaign of campaigns || []) {
    const cap = campaign.throttle_per_min || 120;
    // Email campaign but no budget left today → skip its recipients this tick
    // (avoids pointless contact reads); they stay 'queued' for the next day.
    if (campaign.channel !== 'whatsapp' && emailBudget <= 0) continue;
    const { data: recipients } = await supabaseAdmin
      .from('campaign_recipients').select('*').eq('campaign_id', campaign.id).eq('status', 'queued').limit(cap);

    // Pre-load WhatsApp config once per campaign (not per recipient).
    let waTpl = null, waProvider = null;
    if (campaign.channel === 'whatsapp') {
      ({ data: waTpl } = await supabaseAdmin.from('whatsapp_templates').select('*').eq('id', campaign.whatsapp_template_id).single());
      ({ data: waProvider } = await supabaseAdmin.from('notification_providers').select('*').eq('provider', 'aisensy').single());
    }

    for (const rcpt of recipients || []) {
      const { data: contact } = await supabaseAdmin.from('contacts').select('*').eq('id', rcpt.contact_id).single();

      // ── WhatsApp ──
      if (campaign.channel === 'whatsapp') {
        if (!contact || !contact.phone || !contact.whatsapp_opt_in || contact.whatsapp_suppressed) {
          await mark(rcpt.id, 'skipped', 'not_contactable'); continue;
        }
        if (!waTpl || !waProvider || !waProvider.is_active || !waProvider.api_key) {
          await mark(rcpt.id, 'failed', 'whatsapp_not_configured'); failed++; continue;
        }
        const cdata = { first_name: (contact.name || '').split(' ')[0], name: contact.name, ...(contact.attributes || {}) };
        const params = waTemplates.buildParams(waTpl, cdata);
        const r = await aisensy.sendCampaign({
          apiKey: waProvider.api_key, campaignName: waTpl.aisensy_campaign_name,
          destination: contact.phone, userName: contact.name, templateParams: params,
        });
        await NotificationEngine.logResult({
          event: `CAMPAIGN:${campaign.id}`, channel: 'whatsapp', destination: contact.phone,
          status: r.success ? 'sent' : 'failed', response: r.response, error: r.error,
          payload: { campaignName: waTpl.aisensy_campaign_name, templateParams: params },
        });
        if (r.success) { await mark(rcpt.id, 'sent'); enqueued++; }
        else           { await mark(rcpt.id, 'failed', r.error); failed++; }
        continue;
      }

      // ── Email ──
      if (!contact || !contact.email || !contact.email_opt_in || contact.email_suppressed) {
        await mark(rcpt.id, 'skipped', 'not_contactable'); continue;
      }
      // Daily Resend budget ran out mid-batch — leave 'queued' (untouched) so a
      // later tick / the next UTC day picks it up, rather than burn it as failed.
      if (emailBudget <= 0) continue;
      const data = { first_name: (contact.name || '').split(' ')[0], name: contact.name, email: contact.email, ...(contact.attributes || {}) };
      // Custom (composer) campaign carries its own compiled body; template-based
      // campaign carries a template_id. enqueueCampaignEmail accepts either.
      const custom = !campaign.template_id && campaign.html_content;
      const r = await communicationEngine.enqueueCampaignEmail({
        templateId: campaign.template_id || null,
        bodyHtml: custom ? campaign.html_content : undefined,
        subject: custom ? campaign.subject : undefined,
        previewText: custom ? campaign.preview_text : undefined,
        // Honor the campaign's chosen shell (v3.153); fall back to contact type
        // for legacy campaigns saved before the layout column existed.
        audience: campaign.layout || (contact.contact_type === 'vendor' ? 'vendor' : 'customer'),
        to: contact.email, data,
        user: { name: contact.name, email: contact.email },
        campaignId: campaign.id, subjectOverride: campaign.subject_override || null,
        recipientUserId: contact.user_id || null,
      });
      if (r.ok) { await mark(rcpt.id, 'sent', null, r.logId); enqueued++; emailBudget--; }
      else      { await mark(rcpt.id, 'failed', r.reason || 'enqueue_failed'); failed++; }
    }

    // Drained? Mark the campaign complete.
    const { data: remaining } = await supabaseAdmin
      .from('campaign_recipients').select('id').eq('campaign_id', campaign.id).eq('status', 'queued').limit(1);
    if (!remaining || remaining.length === 0) {
      await supabaseAdmin.from('email_campaigns').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', campaign.id);
    }
  }
  return { enqueued, failed };
}

async function mark(id, status, error = null, email_log_id = null) {
  const patch = { status, error, updated_at: new Date().toISOString() };
  if (status === 'sent') { patch.sent_at = new Date().toISOString(); if (email_log_id) patch.email_log_id = email_log_id; }
  await supabaseAdmin.from('campaign_recipients').update(patch).eq('id', id);
}

module.exports = { processDue };
