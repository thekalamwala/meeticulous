/**
 * emailAdminController.js — Super Admin → Communications.
 * Templates CRUD + duplicate/archive, live preview, test send, email logs
 * (search), settings, and the system event list. No campaigns/newsletters.
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const { sanitizeLikeTerm } = require('../utils/searchSanitize');
const communicationEngine = require('../services/email/communicationEngine');
const { renderEmail } = communicationEngine;
const { getProvider } = require('../services/email/providers');

const CATEGORIES = ['Authentication', 'Security', 'Booking', 'Profile', 'Badge', 'Subscription', 'Celebrations'];

// Sample placeholder values for previews + test sends.
const SAMPLE = {
  user_name: 'Asha Verma', first_name: 'Asha', last_name: 'Verma', email: 'asha@example.com',
  otp: '123456', service_name: 'SEO Consultation', vendor_name: 'Meeticulous Studio',
  vendor_phone: '+91 90000 00000', booking_id: 'BK-10293', booking_date: 'Mon, 21 Oct 2026',
  booking_time: '10:00 AM', location: 'Online', badge_name: 'Top Pick by BAS Team',
  badge_description: 'Editorial endorsement of exceptional vendor quality.',
  milestone_name: '10 Bookings', milestone_value: '10', plan_name: 'Host+',
  expiry_date: '10 June 2027', completion_percentage: '80', verification_status: 'Approved',
  ip_address: '49.36.x.x', device_name: 'Chrome on Windows', login_time: 'Today, 9:14 AM',
};

// ── GET /api/admin/email/templates ───────────────────────────────
const listTemplates = async (req, res) => {
  try {
    const { search, category, status } = req.query;
    let q = supabaseAdmin.from('email_templates').select('*').order('category').order('name');
    if (category) q = q.eq('category', category);
    if (status)   q = q.eq('status', status);
    const safeSearch = sanitizeLikeTerm(search);
    if (safeSearch) q = q.ilike('name', `%${safeSearch}%`);
    const { data, error } = await q;
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (e) { safeError(res, e); }
};

// ── GET /api/admin/email/templates/:id ───────────────────────────
const getTemplate = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('email_templates').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ message: 'Template not found' });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// ── PUT /api/admin/email/templates/:id ───────────────────────────
const updateTemplate = async (req, res) => {
  try {
    const allowed = ['name', 'category', 'subject', 'preview_text', 'html_content', 'cta_label', 'cta_url', 'status'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    const { data, error } = await supabaseAdmin
      .from('email_templates').update(updates).eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ message: error?.message || 'Template not found' });
    communicationEngine.clearCache();
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// ── POST /api/admin/email/templates ──────────────────────────────
const createTemplate = async (req, res) => {
  try {
    const { event_key, audience = 'all', name, category = 'Booking', subject, preview_text, html_content, cta_label, cta_url, status = 'draft' } = req.body;
    if (!event_key || !name) return res.status(400).json({ message: 'event_key and name are required' });
    const { data, error } = await supabaseAdmin.from('email_templates').insert({
      event_key, audience, name, category, subject: subject || '', preview_text: preview_text || '',
      html_content: html_content || '', cta_label: cta_label || '', cta_url: cta_url || '', status,
    }).select().single();
    if (error) {
      if (/duplicate key/i.test(error.message)) return res.status(409).json({ message: 'An active template already exists for this event + audience' });
      return safeError(res, error);
    }
    communicationEngine.clearCache();
    res.status(201).json(data);
  } catch (e) { safeError(res, e); }
};

// ── POST /api/admin/email/templates/:id/duplicate ────────────────
const duplicateTemplate = async (req, res) => {
  try {
    const { data: src } = await supabaseAdmin.from('email_templates').select('*').eq('id', req.params.id).single();
    if (!src) return res.status(404).json({ message: 'Template not found' });
    const { id, created_at, updated_at, ...rest } = src;
    const { data, error } = await supabaseAdmin.from('email_templates').insert({
      ...rest, name: `${src.name} (Copy)`, status: 'draft',  // drafts avoid the active-unique clash
    }).select().single();
    if (error) return safeError(res, error);
    communicationEngine.clearCache();
    res.status(201).json(data);
  } catch (e) { safeError(res, e); }
};

// ── PATCH /api/admin/email/templates/:id/archive ─────────────────
const archiveTemplate = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('email_templates').update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ message: 'Template not found' });
    communicationEngine.clearCache();
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// ── POST /api/admin/email/templates/:id/preview ──────────────────
// Renders with sample values (or a supplied data override). No send, no log.
const previewTemplate = async (req, res) => {
  try {
    const { data: tpl } = await supabaseAdmin.from('email_templates').select('*').eq('id', req.params.id).single();
    if (!tpl) return res.status(404).json({ message: 'Template not found' });
    const settings = await communicationEngine.loadSettings();
    const data = { ...SAMPLE, ...(req.body?.data || {}) };
    const rendered = renderEmail(tpl, { data, user: { name: data.user_name, email: data.email, username: 'asha' }, settings });
    res.json({ subject: rendered.subject, html: rendered.html, missing: rendered.missing });
  } catch (e) { safeError(res, e); }
};

// ── POST /api/admin/email/templates/:id/test ─────────────────────
// Sends a TEST email (marked, excluded from the normal logs view).
const testTemplate = async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: 'A recipient email (to) is required' });
    const { data: tpl } = await supabaseAdmin.from('email_templates').select('event_key, audience').eq('id', req.params.id).single();
    if (!tpl) return res.status(404).json({ message: 'Template not found' });
    const r = await communicationEngine.send({
      event: tpl.event_key, audience: tpl.audience, to, isTest: true,
      data: SAMPLE, user: { name: SAMPLE.user_name, email: to, username: 'asha' },
    });
    res.status(r.ok ? 200 : 502).json({ message: r.ok ? 'Test email sent' : `Send failed: ${r.error || r.reason}` });
  } catch (e) { safeError(res, e); }
};

// ── GET /api/admin/email/logs ────────────────────────────────────
const listLogs = async (req, res) => {
  try {
    const { email, event, status, booking, includeTest, limit = 100 } = req.query;
    let q = supabaseAdmin.from('email_logs').select('*')
      .order('created_at', { ascending: false }).limit(Math.min(parseInt(limit) || 100, 500));
    if (!includeTest) q = q.eq('is_test', false);   // test sends excluded by default (PRD §15)
    const safeEmail = sanitizeLikeTerm(email);
    if (safeEmail) q = q.ilike('recipient', `%${safeEmail}%`);
    if (event)   q = q.eq('event_key', event);
    if (status)  q = q.eq('status', status);
    if (booking) q = q.eq('booking_id', booking);
    const { data, error } = await q;
    if (error) return safeError(res, error);
    // Don't ship full rendered HTML in the list payload
    res.json((data || []).map(({ html, ...rest }) => rest));
  } catch (e) { safeError(res, e); }
};

// ── GET /api/admin/email/logs/:id ────────────────────────────────
const getLog = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('email_logs').select('*').eq('id', req.params.id).single();
    if (error || !data) return res.status(404).json({ message: 'Log not found' });
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// ── POST /api/admin/email/logs/:id/retry ─────────────────────────
// Re-queue a failed email for the worker (resets backoff).
const retryLog = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('email_logs')
      .update({ status: 'queued', attempts: 0, next_attempt_at: new Date().toISOString(), error: null, updated_at: new Date().toISOString() })
      .eq('id', req.params.id).select().single();
    if (error || !data) return res.status(404).json({ message: 'Log not found' });
    res.json({ message: 'Re-queued for delivery', log: { id: data.id, status: data.status } });
  } catch (e) { safeError(res, e); }
};

// ── GET /api/admin/email/settings ────────────────────────────────
const getSettings = async (req, res) => {
  try {
    const { data } = await supabaseAdmin.from('email_settings').select('*').eq('id', 1).maybeSingle();
    res.json(data || {});
  } catch (e) { safeError(res, e); }
};

// ── PUT /api/admin/email/settings ────────────────────────────────
const updateSettings = async (req, res) => {
  try {
    const allowed = ['provider', 'from_name', 'from_email', 'support_email', 'website_url', 'logo_url', 'brand_color', 'footer_html'];
    const updates = { id: 1, updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];
    const { data, error } = await supabaseAdmin.from('email_settings').upsert(updates, { onConflict: 'id' }).select().single();
    if (error) return safeError(res, error);
    communicationEngine.clearCache();
    res.json(data);
  } catch (e) { safeError(res, e); }
};

// ── GET /api/admin/email/events ──────────────────────────────────
// System event list: every event + whether it has an active template.
const listEvents = async (req, res) => {
  try {
    const { data: tpls } = await supabaseAdmin.from('email_templates').select('event_key, audience, status, name, category');
    const byEvent = {};
    for (const t of tpls || []) {
      (byEvent[t.event_key] ||= []).push({ audience: t.audience, status: t.status, name: t.name, category: t.category });
    }
    const events = Object.entries(byEvent).map(([event_key, templates]) => ({
      event_key, templates, has_active: templates.some((t) => t.status === 'active'),
    })).sort((a, b) => a.event_key.localeCompare(b.event_key));
    res.json({ categories: CATEGORIES, events });
  } catch (e) { safeError(res, e); }
};

// ── POST /api/admin/email/test-provider ──────────────────────────
// Sends a minimal email through the CURRENTLY configured provider (no template).
// Use to verify Resend/SES credentials before running a campaign.
const testProvider = async (req, res) => {
  try {
    const { to } = req.body;
    if (!to) return res.status(400).json({ message: 'A recipient email (to) is required' });
    const settings = await communicationEngine.loadSettings();
    const provider = getProvider(settings.provider);
    const r = await provider.sendEmail({
      to,
      subject: `Meeticulous — ${settings.provider} provider test`,
      html: `<p>This is a provider connectivity test sent via <b>${settings.provider}</b>.</p>`,
      fromName: settings.from_name, fromEmail: settings.from_email,
    });
    return res.status(r.success ? 200 : 502)
      .json({ message: r.success ? `Test email sent via ${provider.name}` : `Send failed: ${r.error}`, provider: provider.name });
  } catch (e) { safeError(res, e); }
};

module.exports = {
  listTemplates, getTemplate, createTemplate, updateTemplate, duplicateTemplate, archiveTemplate,
  previewTemplate, testTemplate, listLogs, getLog, retryLog, getSettings, updateSettings, listEvents,
  testProvider,
};
