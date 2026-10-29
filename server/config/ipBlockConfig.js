/**
 * ipBlockConfig.js — All IP-blocking thresholds in one place, env-driven.
 *
 * Every value is read from the environment with a sane default, so the founder
 * can retune the system (or disable it entirely) without a code change — just set
 * the env var and restart. Values are read once at module load (same pattern as
 * middleware/rateLimitStore.js); tests use jest.resetModules + env override.
 *
 * Two independent trackers + an attack rule:
 *   - general      : N rate-limit violations (429s) in a window  → 24h ban
 *   - admin login  : N failed admin logins per IP in a window    → 30-min lockout
 *   - attack       : a single blockSuspiciousRequests hit        → 24h ban
 */

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const config = {
  // Master kill-switch. Set IP_BLOCK_ENABLED=false to neutralise the whole
  // feature (ipGuard passes everything, nothing is auto-banned) without a deploy.
  enabled: process.env.IP_BLOCK_ENABLED !== 'false',

  // General abuse: rate-limit violations → temporary ban.
  general: {
    max:      num(process.env.IP_BAN_GENERAL_MAX, 10),         // 429s before a ban
    windowMs: num(process.env.IP_BAN_GENERAL_WINDOW_MS, 15 * 60 * 1000),
    ttlMs:    num(process.env.IP_BAN_GENERAL_TTL_MS, 24 * 60 * 60 * 1000),
  },

  // Admin-login brute-force: failed admin logins from one IP → short lockout.
  // Stricter + independent of the per-account lockout in adminAuthController.
  admin: {
    max:      num(process.env.IP_BAN_ADMIN_MAX, 5),
    windowMs: num(process.env.IP_BAN_ADMIN_WINDOW_MS, 15 * 60 * 1000),
    ttlMs:    num(process.env.IP_BAN_ADMIN_TTL_MS, 30 * 60 * 1000),
  },

  // Attack-pattern hit (SQLi/XSS/path-traversal): immediate ban, no threshold.
  attack: {
    ttlMs:    num(process.env.IP_BAN_ATTACK_TTL_MS, 24 * 60 * 60 * 1000),
  },

  // Header carrying the real client IP. Blank → trust express's req.ip (correct
  // today behind Render's single proxy). Set to 'cf-connecting-ip' once Cloudflare
  // sits in front so bans key the real client, not the edge. See the Cloudflare
  // runbook (docs/cloudflare-edge-setup.md).
  clientIpHeader: (process.env.CLIENT_IP_HEADER || '').trim().toLowerCase(),

  // How often the in-memory cache re-syncs from the DB (catches expirations and
  // changes made directly in the DB / on another instance).
  cacheRefreshMs: num(process.env.IP_BLOCK_CACHE_REFRESH_MS, 60 * 1000),
};

module.exports = config;
