/**
 * campaignAdminController — Super Admin → Campaigns (Phase 1: email).
 * Contacts (list/sync/suppress), segments (list/preview), campaigns (CRUD + launch).
 */
'use strict';
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { sanitizeLikeTerm } = require('../utils/searchSanitize');
const contactsService = require('../services/contactsService');
const segmentService = require('../services/segmentService');
const campaignService = require('../services/campaignService');
const campaignCompiler = require('../services/email/campaignCompiler');
const communicationEngine = require('../services/email/communicationEngine');
const { audit } = require('../services/auditService');

// Composer Layout dropdown → email shell. 'vendor' and 'cold' pass through; any
// other value (incl. undefined) falls back to the branded customer shell.
const shellAudience = (a) => (a === 'vendor' || a === 'cold' ? a : 'customer');

// ── Contacts ──
const listContacts = async (req, res) => {
  try {
    const { type, search, limit = 100 } = req.query;
    let q = supabaseAdmin.from('contacts').select('*').order('updated_at', { ascending: false }).limit(Math.min(parseInt(limit) || 100, 500));
    if (type) q = q.eq('contact_type', type);
    const safeSearch = sanitizeLikeTerm(search);
    // Manual/single audience picker searches by name, email, or phone.
    if (safeSearch) q = q.or(`email.ilike.%${safeSearch}%,name.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`);
    const { data, error } = await q;
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (e) { safeError(res, e); }
};
const syncContacts = async (_req, res) => {
  try {
    // Sync both sources: profiles/bookings/purchases AND the sales CRM leads.
    const base = await contactsService.sync();
    const leads = await contactsService.syncLeads();
    res.json({ upserted: (base.upserted || 0) + (leads.upserted || 0), fromLeads: leads.upserted || 0, linked: leads.linked || 0 });
  } catch (e) { safeError(res, e); }
};
const suppressContact = async (req, res) => {
  try {
    const allowed = ['email_opt_in', 'whatsapp_opt_in', 'email_suppressed', 'whatsapp_suppressed'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in req.body) updates[k] = !!req.body[k];
    const { data, error } = await supabaseAdmin.from('contacts').update(updates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ message: error?.message || 'Contact not found' });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// ── Segments ──
const listSegments = async (_req, res) => {
  try { const { data, error } = await supabaseAdmin.from('segments').select('*').order('name');
    if (error) return safeError(res, error); res.json(data || []);
  } catch (e) { safeError(res, e); }
};
const previewSegment = async (req, res) => {
  try { const n = await segmentService.count(req.body?.definition || {}, req.body?.channel || 'email'); res.json({ count: n }); }
  catch (e) { safeError(res, e); }
};

/**
 * Create/update a saved segment (audience). Powers "Save as campaign audience"
 * from the lead list — build a list once (by tag/profession/grade) and reuse it
 * as a campaign audience. Idempotent on name (case-insensitive) so re-saving the
 * same list updates it rather than duplicating.
 */
const createSegment = async (req, res) => {
  try {
    const { name, description = '', definition } = req.body || {};
    const nm = String(name || '').trim();
    if (!nm) return res.status(400).json({ message: 'name required' });
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
      return res.status(400).json({ message: 'definition object required' });
    }
    const now = new Date().toISOString();
    const { data: existing } = await supabaseAdmin.from('segments').select('id, is_system').ilike('name', nm).maybeSingle();
    if (existing?.is_system) return res.status(409).json({ message: 'A system segment already uses that name' });
    const body = { name: nm, description: String(description || ''), definition };
    let data, error;
    if (existing?.id) {
      ({ data, error } = await supabaseAdmin.from('segments').update({ ...body, updated_at: now }).eq('id', existing.id).select().single());
    } else {
      ({ data, error } = await supabaseAdmin.from('segments').insert({ ...body, is_system: false }).select().single());
    }
    if (error) return safeError(res, error);
    try { await audit(req, 'campaign.segment.upsert', { name: nm }); } catch { /* audit best-effort */ }
    res.status(existing?.id ? 200 : 201).json(data);
  } catch (e) { safeError(res, e); }
};

/**
 * Resolve an audience to the actual recipient list (name/email/type) so the
 * admin can SEE who receives before launching. Segment (definition) or an
 * explicit pick (audience_ref). Consent/suppression already applied.
 */
const resolveAudience = async (req, res) => {
  try {
    const { audience_type = 'segment', definition, segment_id, audience_ref, channel = 'email' } = req.body || {};
    let rows;
    if (['manual', 'single'].includes(audience_type)) {
      rows = await segmentService.resolveRefs(audience_ref || {}, channel);
    } else {
      // Prefer an inline definition (composer); fall back to a saved segment id
      // (the campaign list only stores segment_id).
      let def = definition;
      if (!def && segment_id) {
        const { data: seg } = await supabaseAdmin.from('segments').select('definition').eq('id', segment_id).single();
        def = seg?.definition || {};
      }
      rows = await segmentService.resolve(def || {}, channel);
    }
    const recipients = rows.slice(0, 1000).map((c) => ({ id: c.id, name: c.name || '', email: c.email || '', contact_type: c.contact_type || '' }));
    res.json({ count: rows.length, recipients, truncated: rows.length > recipients.length });
  } catch (e) { safeError(res, e); }
};

/**
 * Send the composer draft to one address NOW (default: the admin's own email).
 * Same compile→shell path as production, so the test mirrors the real send.
 */
const testCampaign = async (req, res) => {
  try {
    const { design_json, blocks, subject, preview_text, audience, to } = req.body || {};
    const dest = String(to || req.admin?.email || 'shubham@bookasloth.in').trim();
    const { bodyHtml } = campaignCompiler.compile(design_json || { blocks: blocks || [] });
    const r = await communicationEngine.sendComposedTest({
      bodyHtml, subject, previewText: preview_text,
      audience: shellAudience(audience), senderKey: 'shubham', to: dest,
    });
    if (!r.ok) return res.status(502).json({ message: r.error || 'Test send failed' });
    res.json({ ok: true, to: dest });
  } catch (e) { safeError(res, e); }
};

// ── Campaigns ──
const listCampaigns = async (_req, res) => {
  try { const { data, error } = await supabaseAdmin.from('email_campaigns').select('*').order('created_at', { ascending: false });
    if (error) return safeError(res, error); res.json(data || []);
  } catch (e) { safeError(res, e); }
};
const createCampaign = async (req, res) => {
  try {
    if (!req.body?.name) return res.status(400).json({ message: 'name is required' });
    // A composer campaign ships a design_json block model → compile to the
    // chrome-less html_content the send path wraps per recipient.
    const input = { ...req.body, created_by: req.admin?.email || '' };
    if (input.design_json) input.html_content = campaignCompiler.compile(input.design_json).bodyHtml;
    const r = await campaignService.create(input);
    if (r.error) return res.status(500).json({ message: r.error });
    res.status(201).json(r);
  } catch (e) { safeError(res, e); }
};

/** Preview: compile a design → full email HTML (dummy unsubscribe token). */
const previewCampaign = async (req, res) => {
  try {
    const design = req.body?.design_json || { blocks: req.body?.blocks || [] };
    const audience = shellAudience(req.body?.audience);
    const { bodyHtml } = campaignCompiler.compile(design);
    const settings = await communicationEngine.loadSettings();
    const pseudo = {
      subject: req.body?.subject || '', html_content: bodyHtml,
      preview_text: req.body?.preview_text || '', cta_label: '', cta_url: '', email_category: '', audience,
    };
    const { html } = communicationEngine.renderEmail(pseudo, {
      data: { unsubscribe_token: 'preview', first_name: 'there', name: 'there' },
      user: {}, settings, audience,
    });
    res.json({ html });
  } catch (e) { safeError(res, e); }
};
const getCampaign = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('email_campaigns').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ message: 'Campaign not found' });
    const stats = await campaignService.stats(req.params.id);
    res.json({ ...data, live_stats: stats });
  } catch (e) { safeError(res, e); }
};

/**
 * Per-recipient history for one campaign: who was sent to, the queue status,
 * and (for email) the delivery state stamped by the Resend webhook. Joins
 * campaign_recipients → contacts (name) → email_logs (delivery) in batches
 * (no FK-embed dependency). Summary counts both queue + delivery states.
 */
const campaignRecipients = async (req, res) => {
  try {
    const { data: recips, error } = await supabaseAdmin
      .from('campaign_recipients')
      .select('id, contact_id, destination, status, error, sent_at, email_log_id')
      .eq('campaign_id', req.params.id).order('created_at', { ascending: true }).limit(2000);
    if (error) return safeError(res, error);
    const list = recips || [];

    const contactIds = [...new Set(list.map((r) => r.contact_id).filter(Boolean))];
    const { data: contacts } = contactIds.length
      ? await supabaseAdmin.from('contacts').select('id, name').in('id', contactIds) : { data: [] };
    const nameById = Object.fromEntries((contacts || []).map((c) => [c.id, c.name]));

    const logIds = [...new Set(list.map((r) => r.email_log_id).filter(Boolean))];
    // opened_at/clicked_at are v3.157; select fails soft on a pre-migration DB.
    let logs = [];
    if (logIds.length) {
      let q = await supabaseAdmin.from('email_logs').select('id, status, delivered_at, bounced_at, opened_at, clicked_at').in('id', logIds);
      if (q.error) q = await supabaseAdmin.from('email_logs').select('id, status, delivered_at, bounced_at').in('id', logIds);
      logs = q.data || [];
    }
    const logById = Object.fromEntries(logs.map((l) => [l.id, l]));

    const summary = { total: list.length };
    const bump = (k) => { summary[k] = (summary[k] || 0) + 1; };
    const rows = list.map((r) => {
      const log = r.email_log_id ? logById[r.email_log_id] : null;
      // Furthest state for the per-row pill (clicked ⊃ opened ⊃ delivered; bounced is exclusive).
      const delivery = !log ? null
        : log.bounced_at ? 'bounced'
        : log.clicked_at ? 'clicked'
        : log.opened_at ? 'opened'
        : log.delivered_at ? 'delivered' : null;
      bump(r.status);
      // Count each engagement stamp independently so rates (open = opened/delivered)
      // are computable — a clicked email is also delivered + opened.
      if (log) {
        if (log.delivered_at) bump('delivered');
        if (log.bounced_at) bump('bounced');
        if (log.opened_at) bump('opened');
        if (log.clicked_at) bump('clicked');
      }
      return { id: r.id, name: nameById[r.contact_id] || '', email: r.destination, status: r.status, delivery, sent_at: r.sent_at, error: r.error };
    });
    res.json({ recipients: rows.slice(0, 1000), summary, truncated: rows.length > 1000 });
  } catch (e) { safeError(res, e); }
};
const updateCampaign = async (req, res) => {
  try {
    const allowed = ['name', 'channel', 'segment_id', 'template_id', 'whatsapp_template_id', 'subject_override', 'scheduled_at', 'throttle_per_min', 'status',
      'audience_type', 'audience_ref', 'design_json', 'subject', 'preview_text', 'sender_key'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    // Recompile the body whenever the design changes.
    if ('design_json' in req.body) updates.html_content = campaignCompiler.compile(req.body.design_json || {}).bodyHtml;
    let { data, error } = await supabaseAdmin.from('email_campaigns').update(updates).eq('id', req.params.id).select().single();
    if (error && /Could not find the|does not exist|column .* does not exist/i.test(error.message || '')) {
      const { audience_type, audience_ref, design_json, subject, preview_text, sender_key, html_content, ...safe } = updates;
      ({ data, error } = await supabaseAdmin.from('email_campaigns').update(safe).eq('id', req.params.id).select().single());
    }
    if (error || !data) return res.status(404).json({ message: error?.message || 'Campaign not found' });
    res.json(data);
  } catch (e) { safeError(res, e); }
};
const launchCampaign = async (req, res) => {
  try {
    const r = await campaignService.launch(req.params.id);
    if (r.error) return res.status(400).json({ message: r.error });
    audit(req, { action: 'campaign.launch', resource_type: 'campaign', resource_id: req.params.id, after: { recipients: r.recipients } });
    res.json({ message: `Launched — ${r.recipients} recipients queued`, recipients: r.recipients });
  } catch (e) { safeError(res, e); }
};

// ── WhatsApp templates (AiSensy approved-template registry + variable map) ──
const listWaTemplates = async (_req, res) => {
  try { const { data, error } = await supabaseAdmin.from('whatsapp_templates').select('*').order('name');
    if (error) return safeError(res, error); res.json(data || []);
  } catch (e) { safeError(res, e); }
};
const createWaTemplate = async (req, res) => {
  try {
    const { name, aisensy_campaign_name } = req.body || {};
    if (!name || !aisensy_campaign_name) return res.status(400).json({ message: 'name and aisensy_campaign_name are required' });
    const row = {
      name, aisensy_campaign_name, language: req.body.language || 'en',
      body_preview: req.body.body_preview || '', variable_map: req.body.variable_map || {},
      param_count: req.body.param_count || 0, approval_status: req.body.approval_status || 'pending',
      is_active: req.body.is_active !== undefined ? !!req.body.is_active : true,
    };
    const { data, error } = await supabaseAdmin.from('whatsapp_templates').insert(row).select().single();
    if (error) return safeError(res, error);
    res.status(201).json(data);
  } catch (e) { safeError(res, e); }
};
const updateWaTemplate = async (req, res) => {
  try {
    const allowed = ['name', 'aisensy_campaign_name', 'language', 'body_preview', 'variable_map', 'param_count', 'approval_status', 'is_active'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    const { data, error } = await supabaseAdmin.from('whatsapp_templates').update(updates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ message: error?.message || 'Template not found' });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

module.exports = {
  listContacts, syncContacts, suppressContact,
  listSegments, previewSegment, createSegment, resolveAudience, testCampaign,
  listCampaigns, createCampaign, previewCampaign, getCampaign, campaignRecipients, updateCampaign, launchCampaign,
  listWaTemplates, createWaTemplate, updateWaTemplate,
};
