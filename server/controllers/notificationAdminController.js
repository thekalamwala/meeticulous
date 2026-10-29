/**
 * notificationAdminController.js — Super Admin → Notification Settings.
 *
 * Provider config (AiSensy), event registry CRUD, test sends, logs, retry.
 * Secrets never leave the server unmasked.
 */
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const NotificationEngine = require('../services/notificationEngine');
const aisensy = require('../services/aisensyService');

const maskKey = (key) => {
  if (!key) return '';
  const tail = key.slice(-6);
  return `${'*'.repeat(14)}${tail}`;
};

// notification_logs.status for an email is only the ENQUEUE-time snapshot
// ('pending' for a queued send). The queue worker updates email_logs, never
// notification_logs, so the true outcome lives in email_logs. Map it back to the
// cross-channel vocabulary used by this screen.
const EMAIL_STATUS_TO_NOTIF = {
  sent: 'sent', failed: 'failed', queued: 'pending', suppressed: 'suppressed', test: 'sent',
};

/**
 * Overlay the real email delivery status onto notification_logs rows.
 * @param {object[]} rows            notification_logs rows
 * @param {Object<string,string>} emailStatusById  email_logs.id → status
 * Non-email rows and rows without a resolvable email_logs link pass through unchanged.
 */
const overlayEmailLogStatus = (rows, emailStatusById = {}) =>
  (rows || []).map((r) => {
    if (r.channel !== 'email') return r;
    const logId = r.payload && r.payload.logId;
    const real = logId ? emailStatusById[logId] : null;
    return real ? { ...r, status: EMAIL_STATUS_TO_NOTIF[real] || r.status } : r;
  });

const isMasked = (v) => typeof v === 'string' && v.startsWith('****');

// ── GET /api/admin/notifications/provider ───────────────────────
const getProvider = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_providers')
      .select('*')
      .eq('provider', 'aisensy')
      .maybeSingle();
    if (error) return safeError(res, error);
    if (!data) return res.json({ provider: 'aisensy', api_key_masked: '', settings_json: {}, is_active: false, configured: false });
    res.json({
      provider: data.provider,
      api_key_masked: maskKey(data.api_key),
      settings_json: data.settings_json || {},
      is_active: data.is_active,
      configured: !!data.api_key,
      updated_at: data.updated_at,
    });
  } catch (err) {
    safeError(res, err);
  }
};

// ── PUT /api/admin/notifications/provider ───────────────────────
const updateProvider = async (req, res) => {
  try {
    const { api_key, connected_number, webhook_url, is_active } = req.body;
    const updates = {
      settings_json: { connected_number: connected_number || '', webhook_url: webhook_url || '' },
      is_active: !!is_active,
      updated_at: new Date().toISOString(),
    };
    // Only overwrite the key when a real (non-masked) value was supplied
    if (api_key && !isMasked(api_key)) updates.api_key = api_key.trim();

    const { data, error } = await supabaseAdmin
      .from('notification_providers')
      .upsert({ provider: 'aisensy', ...updates }, { onConflict: 'provider' })
      .select()
      .single();
    if (error) return safeError(res, error);

    NotificationEngine.clearCache();
    res.json({
      message: 'Provider settings saved',
      api_key_masked: maskKey(data.api_key),
      settings_json: data.settings_json,
      is_active: data.is_active,
    });
  } catch (err) {
    safeError(res, err);
  }
};

// ── POST /api/admin/notifications/provider/test ─────────────────
const testProvider = async (req, res) => {
  try {
    const { data } = await supabaseAdmin
      .from('notification_providers')
      .select('api_key')
      .eq('provider', 'aisensy')
      .maybeSingle();
    const result = await aisensy.testConnection({ apiKey: data?.api_key });
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    console.error('[api error]', err?.message || err);
    res.status(500).json({ ok: false, message: 'Something went wrong. Please try again.' });
  }
};

// ── GET /api/admin/notifications/events ─────────────────────────
const getEvents = async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notification_events')
      .select('*')
      .order('event_key');
    if (error) return safeError(res, error);
    res.json(data || []);
  } catch (err) {
    safeError(res, err);
  }
};

// ── PUT /api/admin/notifications/events/:id ─────────────────────
const updateEvent = async (req, res) => {
  try {
    const allowed = ['display_name', 'whatsapp_enabled', 'email_enabled', 'campaign_name', 'email_subject', 'is_active'];
    const updates = { updated_at: new Date().toISOString() };
    for (const k of allowed) if (k in req.body) updates[k] = req.body[k];

    const { data, error } = await supabaseAdmin
      .from('notification_events')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) return safeError(res, error);

    NotificationEngine.clearCache();
    res.json(data);
  } catch (err) {
    safeError(res, err);
  }
};

// ── POST /api/admin/notifications/test-send ─────────────────────
// { event_key, channel: 'whatsapp'|'email', destination }
const testSend = async (req, res) => {
  try {
    const { event_key, channel, destination } = req.body;
    if (!event_key || !channel || !destination)
      return res.status(400).json({ message: 'event_key, channel and destination are required' });

    const sampleParams = event_key === 'BOOKING_OTP'
      ? ['123456']
      : ['Test Customer', 'Sample Service', 'Test Vendor', new Date().toLocaleString('en-IN')];

    const result = await NotificationEngine.send({
      event: event_key,
      data: {
        phone: channel === 'whatsapp' ? destination : undefined,
        email: channel === 'email' ? destination : undefined,
        name: 'Test User',
        templateParams: sampleParams,
        // OTP templates carry a copy-code button that needs the code too.
        buttonParams: event_key === 'BOOKING_OTP' ? sampleParams : [],
        emailSubject: `[TEST] ${event_key}`,
        emailHtml: channel === 'email'
          ? `<div style="font-family:sans-serif;padding:24px;"><h2>Test notification</h2><p>This is a test of <strong>${event_key}</strong> from Book A Sloth Super Admin.</p><p>Params: ${sampleParams.join(', ')}</p></div>`
          : undefined,
      },
    });

    const ch = channel === 'whatsapp' ? result.whatsapp : result.email;
    if (!ch.attempted) {
      return res.status(400).json({ message: `${channel} not attempted — check that the channel is enabled for this event and the provider is active.`, result });
    }
    res.status(ch.success ? 200 : 502).json({ message: ch.success ? 'Test sent' : `Send failed: ${ch.error}`, result });
  } catch (err) {
    safeError(res, err);
  }
};

// ── GET /api/admin/notifications/logs ───────────────────────────
const getLogs = async (req, res) => {
  try {
    const { event_key, channel, status, limit = 100 } = req.query;
    const lim = Math.min(parseInt(limit) || 100, 500);

    // Status is filtered AFTER overlay (below) so it matches the corrected status
    // the screen shows. Without a status filter we only need `lim` rows; with one
    // we pull the cap and trim post-filter so the count stays honest.
    let q = supabaseAdmin
      .from('notification_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(status ? 500 : lim);
    if (event_key) q = q.eq('event_key', event_key);
    if (channel)   q = q.eq('channel', channel);
    const { data, error } = await q;
    if (error) return safeError(res, error);
    let rows = data || [];

    // Reconcile email rows against their true delivery status in email_logs.
    const ids = [...new Set(
      rows.filter((r) => r.channel === 'email' && r.payload && r.payload.logId)
          .map((r) => r.payload.logId)
    )];
    if (ids.length) {
      const { data: logs } = await supabaseAdmin
        .from('email_logs').select('id, status').in('id', ids);
      const map = Object.fromEntries((logs || []).map((l) => [l.id, l.status]));
      rows = overlayEmailLogStatus(rows, map);
    }

    if (status) rows = rows.filter((r) => r.status === status).slice(0, lim);
    res.json(rows);
  } catch (err) {
    safeError(res, err);
  }
};

// ── POST /api/admin/notifications/logs/:id/retry ────────────────
const retryLog = async (req, res) => {
  try {
    const { data: log, error } = await supabaseAdmin
      .from('notification_logs')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !log) return res.status(404).json({ message: 'Log entry not found' });

    if (log.channel === 'whatsapp') {
      const { data: provider } = await supabaseAdmin
        .from('notification_providers').select('*').eq('provider', 'aisensy').maybeSingle();
      const p = log.payload || {};
      const r = await aisensy.sendCampaign({
        apiKey: provider?.api_key,
        campaignName: p.campaignName,
        destination: log.destination,
        userName: p.userName,
        templateParams: p.templateParams || [],
      });
      await NotificationEngine.logResult({
        event: log.event_key, channel: 'whatsapp', destination: log.destination,
        status: r.success ? 'sent' : 'failed', response: r.response, error: r.error, payload: p,
      });
      return res.status(r.success ? 200 : 502).json({ message: r.success ? 'Retried successfully' : `Retry failed: ${r.error}` });
    }

    if (log.channel === 'email') {
      // Re-queue the ORIGINAL email_logs row (subject + rendered HTML are stored
      // there) so the worker resends the real template — never a placeholder.
      const logId = log.payload && log.payload.logId;
      if (!logId) {
        return res.status(400).json({
          message: 'This email predates delivery tracking and cannot be retried here. Use Communications → Email Logs.',
        });
      }
      const { data: updated, error: upErr } = await supabaseAdmin
        .from('email_logs')
        .update({
          status: 'queued', attempts: 0, error: null,
          next_attempt_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        })
        .eq('id', logId).select('id, status').single();
      if (upErr || !updated) return res.status(404).json({ message: 'Linked email log not found' });
      return res.json({ message: 'Re-queued for delivery' });
    }

    res.status(400).json({ message: `Unknown channel: ${log.channel}` });
  } catch (err) {
    safeError(res, err);
  }
};

module.exports = { getProvider, updateProvider, testProvider, getEvents, updateEvent, testSend, getLogs, retryLog, maskKey, overlayEmailLogStatus };
