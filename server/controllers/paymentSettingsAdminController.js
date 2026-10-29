/**
 * paymentSettingsAdminController.js — Admin → Settings → Payment → Razorpay.
 *
 * Stores Razorpay credentials in platform_settings (secret + webhook secret
 * encrypted at rest). The GET never returns plaintext secrets — only whether
 * they are set, plus a masked hint. All routes behind requireAdmin.
 */
'use strict';

const Razorpay = require('razorpay');
const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');
const razorpayConfig = require('../services/razorpayConfig');
const razorpaySubscriptions = require('../services/razorpaySubscriptions');
const subscriptionReconciler = require('../services/subscriptionReconciler');
const { auditLog } = require('../utils/logger');

const { KEYS } = razorpayConfig;

const maskTail = (val) => (val && val.length > 4 ? `••••${val.slice(-4)}` : (val ? '••••' : ''));

const upsertSetting = async (key, value) =>
  supabaseAdmin.from('platform_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

// ── GET /api/admin/settings/payment/razorpay ─────────────────────
// Returns config WITHOUT plaintext secrets (only "is it set" + a masked hint).
const getRazorpay = async (req, res) => {
  try {
    const cfg = await razorpayConfig.getConfig();
    const reconciler = await subscriptionReconciler.getStatus().catch(() => null);
    res.json({
      key_id: cfg.keyId || '',
      key_secret_set: !!cfg.keySecret,
      key_secret_hint: maskTail(cfg.keySecret),
      webhook_secret_set: !!cfg.webhookSecret,
      enabled: !!cfg.enabled,
      mode: cfg.mode || 'test',
      // The webhook URL the admin must paste into the Razorpay dashboard.
      webhook_url: `${process.env.API_URL || ''}/api/payment/webhook`,
      // Subscription reconciler last-run summary (orphan cleanup activity).
      reconciler,
    });
  } catch (err) {
    safeError(res, err);
  }
};

// ── PUT /api/admin/settings/payment/razorpay ─────────────────────
// Secrets are only updated when a non-empty value is supplied, so re-saving the
// form (which never receives the plaintext secret back) doesn't wipe them.
const updateRazorpay = async (req, res) => {
  try {
    const { key_id, key_secret, webhook_secret, enabled, mode } = req.body;

    // Snapshot the resolved credentials BEFORE writing so we can detect a
    // key/mode switch — cached Razorpay plan ids are account- and mode-scoped and
    // must be dropped, or checkout 404s loading a plan from the old account.
    const prev = await razorpayConfig.getConfig();

    if (key_id != null) await upsertSetting(KEYS.keyId, String(key_id).trim());
    if (typeof key_secret === 'string' && key_secret.trim()) {
      await upsertSetting(KEYS.keySecret, razorpayConfig.encryptSecret(key_secret.trim()));
    }
    if (typeof webhook_secret === 'string' && webhook_secret.trim()) {
      await upsertSetting(KEYS.webhookSecret, razorpayConfig.encryptSecret(webhook_secret.trim()));
    }
    if (enabled != null) await upsertSetting(KEYS.enabled, enabled ? 'true' : 'false');
    if (mode != null) await upsertSetting(KEYS.mode, String(mode));

    razorpayConfig.clearCache();

    // Re-resolve and compare. On a key or mode change, wipe the per-cadence plan
    // ids so they re-mint under the new account on the next subscription.
    const next = await razorpayConfig.getConfig();
    const keyChanged = prev.keyId !== next.keyId || prev.mode !== next.mode;
    if (keyChanged) {
      const r = await razorpaySubscriptions.clearCachedPlanIds();
      auditLog('RAZORPAY_PLAN_IDS_CLEARED', req.admin?.id || null, {
        from_key: prev.keyId || null, to_key: next.keyId || null,
        from_mode: prev.mode || null, to_mode: next.mode || null, cleared: !!r.cleared,
      });
    }
    auditLog('RAZORPAY_SETTINGS_UPDATED', req.admin?.id || null, { key_id_set: key_id != null, enabled, key_changed: keyChanged });

    return getRazorpay(req, res);
  } catch (err) {
    safeError(res, err);
  }
};

// ── POST /api/admin/settings/payment/razorpay/test ───────────────
// Validates credentials by making a cheap authenticated Razorpay call. Uses the
// submitted key/secret if provided (test-before-save), else the stored ones.
const testRazorpay = async (req, res) => {
  try {
    const { key_id, key_secret } = req.body || {};
    let keyId = key_id, keySecret = key_secret;
    if (!keyId || !keySecret) {
      const cfg = await razorpayConfig.getConfig();
      keyId = keyId || cfg.keyId;
      keySecret = keySecret || cfg.keySecret;
    }
    if (!keyId || !keySecret) {
      return res.status(400).json({ ok: false, message: 'Enter a key id and secret first.' });
    }
    const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
    await client.orders.all({ count: 1 }); // 401 here means bad credentials
    res.json({ ok: true, message: 'Razorpay credentials are valid.' });
  } catch (err) {
    const desc = err?.error?.description || err?.message || 'Razorpay rejected the credentials.';
    res.status(400).json({ ok: false, message: desc });
  }
};

module.exports = { getRazorpay, updateRazorpay, testRazorpay };
