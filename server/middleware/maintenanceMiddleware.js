/**
 * maintenanceMiddleware.js — enforce the platform_settings.maintenance_mode flag.
 *
 * M0 fix: the admin Settings page has always saved a maintenance_mode toggle,
 * but nothing read it. When enabled, public + vendor/user API traffic gets a
 * 503, while the admin surface (/admin, /admin-auth) stays reachable so staff
 * can turn it back off. The flag is cached for 30s to avoid a DB read per request.
 */

const { supabaseAdmin } = require('../config/supabase');

let _cache = { value: false, at: 0 };
const TTL_MS = 30 * 1000;

const parseBool = (v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase().replace(/^"|"$/g, ''); // strip JSON quoting
    return s === 'true' || s === '1';
  }
  return false;
};

const isEnabled = async () => {
  const now = Date.now();
  if (now - _cache.at < TTL_MS) return _cache.value;
  try {
    const { data } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle();
    _cache = { value: parseBool(data?.value), at: now };
  } catch (_) {
    // On any read failure, fail OPEN (don't take the platform down by accident).
    _cache = { value: false, at: now };
  }
  return _cache.value;
};

/** Bust the cache immediately after an admin saves settings. */
const clearCache = () => { _cache = { value: false, at: 0 }; };

const maintenanceMiddleware = async (req, res, next) => {
  // Admin surface is always reachable so staff can lift maintenance.
  if (req.path.startsWith('/admin') || req.path.startsWith('/admin-auth')) return next();

  if (await isEnabled()) {
    return res.status(503).json({
      message: 'Meeticulous is temporarily down for maintenance. Please try again shortly.',
      maintenance: true,
    });
  }
  return next();
};

module.exports = { maintenanceMiddleware, clearCache, isEnabled };
