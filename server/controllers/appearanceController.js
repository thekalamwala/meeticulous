/**
 * appearanceController.js — site appearance (navbar logo).
 *
 * One row in appearance_settings (id = 1) is the source of truth for the active
 * navbar logo. Public read feeds the website navbar; admin read/update is gated
 * by the isolated admin RBAC session. Fails OPEN: if the table is missing or a
 * read errors, callers get sensible defaults so the navbar never breaks.
 *
 * The email header logo is NOT managed here — it is a fixed image on
 * email_settings.logo_url, decoupled from these navbar modes.
 */

'use strict';

const { supabaseAdmin } = require('../config/supabase');
const { isBackgroundKey, BACKGROUND_KEYS } = require('../config/backgroundKeys');

const MODES = ['icon_text', 'image', 'festive'];

/**
 * Validate an admin-supplied backgrounds map: keep only known background keys
 * and coerce each entry to the canonical { enabled, order, params } shape.
 */
function sanitizeBackgrounds(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const key of Object.keys(input)) {
    if (!isBackgroundKey(key)) continue;
    const v = input[key] || {};
    out[key] = {
      enabled: !!v.enabled,
      order: Number.isFinite(+v.order) ? +v.order : 0,
      params: v.params && typeof v.params === 'object' && !Array.isArray(v.params) ? v.params : {},
    };
  }
  return out;
}

/**
 * Resolve a usable default background: keep the requested one if it is a known,
 * enabled key; otherwise fall back to the first enabled key, then null.
 */
function resolveDefaultBackground(requested, backgrounds) {
  if (isBackgroundKey(requested) && backgrounds?.[requested]?.enabled) return requested;
  const firstEnabled = BACKGROUND_KEYS.find((k) => backgrounds?.[k]?.enabled);
  return firstEnabled || null;
}

// icon_url is served relative on purpose — it resolves to the client's own
// origin (client/public/favicon-96x96.png), a 96x96 file for a 26px navbar mark
// instead of the 800x800 CDN original. Mirrors DEFAULTS in
// client/src/hooks/useAppearance.js; an admin-set icon_url still wins.
const DEFAULTS = {
  navbar_logo_mode: 'icon_text',
  icon_url: '/favicon-96x96.png',
  logo_image_url: '',
  festive_logo_url: '',
};

/** Read the single appearance row, falling back to defaults on any problem. */
async function loadRow() {
  try {
    const { data, error } = await supabaseAdmin
      .from('appearance_settings').select('*').eq('id', 1).maybeSingle();
    if (error || !data) return { ...DEFAULTS };
    return data;
  } catch (_) {
    return { ...DEFAULTS };
  }
}

const publicShape = (row) => {
  const _all = row?.backgrounds || {};
  const _enabled = Object.entries(_all)
    .filter(([, v]) => v?.enabled)
    .sort((a, b) => (a[1].order || 0) - (b[1].order || 0))
    .map(([key, v]) => ({ key, params: v.params || {} }));
  return {
    navbar_logo_mode: row.navbar_logo_mode || DEFAULTS.navbar_logo_mode,
    icon_url: row.icon_url || DEFAULTS.icon_url,
    logo_image_url: row.logo_image_url || '',
    festive_logo_url: row.festive_logo_url || '',
    backgrounds: _enabled,
    default_background: row?.default_background || null,
  };
};

/**
 * Reusable getter for the public appearance data (enabled backgrounds + default).
 * Lets other controllers (e.g. the public service page) embed appearance without
 * an extra round-trip. Reuses loadRow() + publicShape() so shaping stays in sync.
 */
async function getPublicAppearanceData() {
  const row = await loadRow();
  const shaped = publicShape(row);
  return { backgrounds: shaped.backgrounds, default_background: shaped.default_background };
}

/** GET /api/appearance — public; navbar reads this (no auth). */
async function getPublic(req, res) {
  const row = await loadRow();
  res.json(publicShape(row));
}

/** GET /api/admin/appearance — admin; full raw backgrounds map for curation. */
async function getAdmin(req, res) {
  const row = await loadRow();
  res.json({ ...publicShape(row), backgrounds: row?.backgrounds || {} });
}

/** PUT /api/admin/appearance — admin; update mode + image URLs. */
async function update(req, res) {
  const { navbar_logo_mode, icon_url, logo_image_url, festive_logo_url } = req.body || {};

  if (navbar_logo_mode != null && !MODES.includes(navbar_logo_mode)) {
    return res.status(400).json({ message: `navbar_logo_mode must be one of: ${MODES.join(', ')}` });
  }

  // Only update provided fields; keep the others as-is.
  const patch = { updated_at: new Date().toISOString() };
  if (navbar_logo_mode != null) patch.navbar_logo_mode = navbar_logo_mode;
  if (icon_url != null)         patch.icon_url = String(icon_url);
  if (logo_image_url != null)   patch.logo_image_url = String(logo_image_url);
  if (festive_logo_url != null) patch.festive_logo_url = String(festive_logo_url);

  // Background library: validate the supplied map and pin a usable default.
  // Both columns are NOT NULL, and the background registry is currently empty
  // (client/src/backgrounds/registry.js + config/backgroundKeys.js), so a save
  // from the logo-only form sanitizes down to {} / null. Writing that would
  // both violate the NOT NULL on default_background and wipe any curated map,
  // so only persist these when there is something real to persist.
  if (req.body && req.body.backgrounds != null) {
    const backgrounds = sanitizeBackgrounds(req.body.backgrounds);
    if (Object.keys(backgrounds).length) {
      patch.backgrounds = backgrounds;
      const nextDefault = resolveDefaultBackground(req.body.default_background, backgrounds);
      if (nextDefault) patch.default_background = nextDefault;
    }
  } else if (req.body && req.body.default_background != null) {
    patch.default_background = String(req.body.default_background);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('appearance_settings')
      .upsert({ id: 1, ...patch }, { onConflict: 'id' })
      .select('*')
      .single();
    if (error) {
      console.error('[appearance] update failed:', error);
      return res.status(500).json({ message: 'Could not save appearance settings.' });
    }
    res.json(publicShape(data));
  } catch (err) {
    console.error('[appearance] update threw:', err);
    res.status(500).json({ message: 'Could not save appearance settings.' });
  }
}

module.exports = {
  getPublic,
  getAdmin,
  update,
  MODES,
  DEFAULTS,
  sanitizeBackgrounds,
  resolveDefaultBackground,
  getPublicAppearanceData,
};
