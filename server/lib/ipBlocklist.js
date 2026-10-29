/**
 * ipBlocklist.js — the brain of the app-layer IP blocking system.
 *
 * Holds the active bans + allowlist in memory (so ipGuard can decide in O(1) with
 * no DB hit per request) and persists every change to Postgres (blocked_ips /
 * ip_allowlist, migration v3.51) so bans survive Render restarts/deploys. Also
 * owns the ephemeral offense counters that turn repeated rate-limit violations and
 * failed admin logins into auto-bans.
 *
 * DB access goes through a small `store` seam so the cache/threshold logic is unit
 * testable without Supabase (see __setStore). The default store lazily requires
 * config/supabase, so merely importing this module never triggers the service-role
 * env validation (keeps tests/CI that don't set the key working).
 *
 * Thresholds + the master kill-switch live in config/ipBlockConfig.js.
 */

const config = require('../config/ipBlockConfig');

// ── In-memory caches ──────────────────────────────────────────
// ip(string) -> { source, reason, expiresAt(ms|null), created_by, created_at }
const bans = new Map();
const allow = new Set(); // ip(string)

// Ephemeral offense counters (reset on restart — they only accumulate the ban
// decision; the resulting ban itself is persisted in the DB).
const rlOffenses = new Map(); // ip -> { count, windowStart(ms) }
const adminFails = new Map(); // ip -> { count, windowStart(ms) }

const normalizeIp = (ip) => String(ip == null ? '' : ip).trim();

// A private/reserved (non-routable) address — RFC1918, loopback, link-local, or
// their IPv6 equivalents — can never be a genuine internet client. It can only be
// a misresolved proxy hop (e.g. Render's internal 10.x address when CLIENT_IP_HEADER
// is unset behind an edge proxy — see docs/cloudflare-edge-setup.md "Incident
// response"). Banning one bans every request that resolves to that same internal
// hop, i.e. the whole platform, and it has happened in production (2026-07-23).
// Refuse to treat such an address as banned, and refuse to create a new ban for
// one, from any source (manual admin action included) — there is no legitimate
// case for blocking a private address.
function isPrivateOrReservedIp(ip) {
  const k = normalizeIp(ip).replace(/^::ffff:/i, '');
  if (!k) return false;
  if (k === '::1' || k === '127.0.0.1') return true;
  if (/^fc[0-9a-f]{2}:|^fd[0-9a-f]{2}:/i.test(k)) return true; // IPv6 ULA fc00::/7
  if (/^fe80:/i.test(k)) return true; // IPv6 link-local
  const m = k.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 10) return true;               // 10.0.0.0/8
  if (a === 127) return true;               // 127.0.0.0/8 (loopback)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true;  // 192.168.0.0/16
  if (a === 169 && b === 254) return true;  // 169.254.0.0/16 (link-local)
  return false;
}

// ── DB store seam ─────────────────────────────────────────────
const supabaseStore = {
  async fetchBans() {
    const { supabaseAdmin } = require('../config/supabase');
    const { data, error } = await supabaseAdmin.from('blocked_ips').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },
  async fetchAllow() {
    const { supabaseAdmin } = require('../config/supabase');
    const { data, error } = await supabaseAdmin.from('ip_allowlist').select('*');
    if (error) throw new Error(error.message);
    return data || [];
  },
  async upsertBan(row) {
    const { supabaseAdmin } = require('../config/supabase');
    const { error } = await supabaseAdmin.from('blocked_ips').upsert(row, { onConflict: 'ip' });
    if (error) throw new Error(error.message);
  },
  async deleteBan(ip) {
    const { supabaseAdmin } = require('../config/supabase');
    const { error } = await supabaseAdmin.from('blocked_ips').delete().eq('ip', ip);
    if (error) throw new Error(error.message);
  },
  async upsertAllow(row) {
    const { supabaseAdmin } = require('../config/supabase');
    const { error } = await supabaseAdmin.from('ip_allowlist').upsert(row, { onConflict: 'ip' });
    if (error) throw new Error(error.message);
  },
  async deleteAllow(ip) {
    const { supabaseAdmin } = require('../config/supabase');
    const { error } = await supabaseAdmin.from('ip_allowlist').delete().eq('ip', ip);
    if (error) throw new Error(error.message);
  },
  async deleteExpired() {
    const { supabaseAdmin } = require('../config/supabase');
    // NULL expires_at (permanent bans) never match `.lt`, so they're preserved.
    const { error, count } = await supabaseAdmin
      .from('blocked_ips')
      .delete({ count: 'exact' })
      .lt('expires_at', new Date().toISOString());
    if (error) throw new Error(error.message);
    return count || 0;
  },
};

let store = supabaseStore;
/** test-only: swap the DB store for an in-memory fake. */
function __setStore(s) { store = s || supabaseStore; }

// ── Cache load / refresh ──────────────────────────────────────
async function refresh() {
  try {
    const [banRows, allowRows] = await Promise.all([store.fetchBans(), store.fetchAllow()]);
    const t = Date.now();

    bans.clear();
    for (const row of banRows || []) {
      const exp = row.expires_at ? new Date(row.expires_at).getTime() : null;
      if (exp != null && exp <= t) continue; // already expired → don't cache
      bans.set(String(row.ip), {
        source: row.source,
        reason: row.reason,
        expiresAt: exp,
        created_by: row.created_by,
        created_at: row.created_at,
      });
    }

    allow.clear();
    for (const row of allowRows || []) allow.add(String(row.ip));
    return true;
  } catch (e) {
    console.error('[ipBlocklist] refresh failed:', e.message);
    return false; // fail-open: keep whatever cache we had
  }
}

// ── Queries ───────────────────────────────────────────────────
function isAllowed(ip) { return allow.has(normalizeIp(ip)); }

function isBlocked(ip) {
  const k = normalizeIp(ip);
  if (!k) return false;
  if (isPrivateOrReservedIp(k)) return false; // never treat a private/proxy-hop address as banned
  if (allow.has(k)) return false; // allowlist always wins
  const ban = bans.get(k);
  if (!ban) return false;
  if (ban.expiresAt != null && ban.expiresAt <= Date.now()) {
    bans.delete(k); // lazy expiry
    return false;
  }
  return true;
}

/** Snapshot of the in-memory ban for an IP (or null). */
function getBan(ip) {
  const k = normalizeIp(ip);
  const b = bans.get(k);
  return b ? { ip: k, ...b } : null;
}

// ── Mutations ─────────────────────────────────────────────────
async function addBan(ip, { reason = null, source = 'manual', ttlMs = null, expiresAt = null, createdBy = null } = {}) {
  const k = normalizeIp(ip);
  if (!k) return { ok: false, error: 'invalid ip' };
  if (isPrivateOrReservedIp(k)) return { ok: false, skipped: 'private-range' }; // never ban a proxy-hop address
  if (allow.has(k)) return { ok: false, skipped: 'allowlisted' }; // never ban a trusted IP

  let exp = expiresAt;
  if (exp == null && ttlMs != null) exp = new Date(Date.now() + ttlMs).toISOString();
  // exp still null → permanent ban.

  const row = { ip: k, reason, source, created_by: createdBy, expires_at: exp };
  await store.upsertBan(row);
  bans.set(k, {
    source,
    reason,
    expiresAt: exp ? new Date(exp).getTime() : null,
    created_by: createdBy,
    created_at: new Date().toISOString(),
  });
  return { ok: true };
}

async function removeBan(ip) {
  const k = normalizeIp(ip);
  if (!k) return { ok: false, error: 'invalid ip' };
  await store.deleteBan(k);
  bans.delete(k);
  rlOffenses.delete(k);
  adminFails.delete(k);
  return { ok: true };
}

async function addAllow(ip, { note = null, createdBy = null } = {}) {
  const k = normalizeIp(ip);
  if (!k) return { ok: false, error: 'invalid ip' };
  await store.upsertAllow({ ip: k, note, created_by: createdBy });
  allow.add(k);
  // Allowlisting an IP lifts any active ban on it (and clears its counters).
  if (bans.has(k)) await removeBan(k);
  return { ok: true };
}

async function removeAllow(ip) {
  const k = normalizeIp(ip);
  if (!k) return { ok: false, error: 'invalid ip' };
  await store.deleteAllow(k);
  allow.delete(k);
  return { ok: true };
}

/** Fresh lists for the admin UI (read straight from the DB, not the cache). */
async function listBans() { return store.fetchBans(); }
async function listAllow() { return store.fetchAllow(); }

// ── Offense tracking → auto-ban ───────────────────────────────
function bump(map, key, windowMs) {
  const t = Date.now();
  let e = map.get(key);
  if (!e || (t - e.windowStart) > windowMs) {
    e = { count: 0, windowStart: t };
    map.set(key, e);
  }
  e.count += 1;
  return e.count;
}

// All recorders are fire-and-forget from middleware; they swallow their own errors
// so a transient DB hiccup can never bubble into an unhandled rejection.
async function recordRateLimitViolation(ip) {
  if (!config.enabled) return;
  const k = normalizeIp(ip);
  if (!k || allow.has(k) || bans.has(k)) return; // trusted or already banned
  const count = bump(rlOffenses, k, config.general.windowMs);
  if (count >= config.general.max) {
    rlOffenses.delete(k);
    try {
      await addBan(k, { reason: `Auto-ban: ${count} rate-limit violations`, source: 'auto', ttlMs: config.general.ttlMs });
    } catch (e) { console.error('[ipBlocklist] auto-ban failed:', e.message); }
  }
}

async function recordAdminLoginFailure(ip) {
  if (!config.enabled) return;
  const k = normalizeIp(ip);
  if (!k || allow.has(k) || bans.has(k)) return;
  const count = bump(adminFails, k, config.admin.windowMs);
  if (count >= config.admin.max) {
    adminFails.delete(k);
    try {
      await addBan(k, { reason: `Auto-lockout: ${count} failed admin logins`, source: 'admin_lockout', ttlMs: config.admin.ttlMs });
    } catch (e) { console.error('[ipBlocklist] admin-lockout failed:', e.message); }
  }
}

/** A successful admin login clears that IP's failure counter. */
function resetAdminLoginFailures(ip) { adminFails.delete(normalizeIp(ip)); }

async function recordAttack(ip, detail) {
  if (!config.enabled) return;
  const k = normalizeIp(ip);
  if (!k || allow.has(k)) return;
  try {
    await addBan(k, {
      reason: `Auto-ban: suspicious request${detail ? ` (${detail})` : ''}`,
      source: 'auto_attack',
      ttlMs: config.attack.ttlMs,
    });
  } catch (e) { console.error('[ipBlocklist] attack-ban failed:', e.message); }
}

// ── Lifecycle ─────────────────────────────────────────────────
let refreshTimer = null;
/** Load the cache and start the periodic re-sync. Call once at server boot. */
async function init() {
  await refresh();
  if (!refreshTimer && config.cacheRefreshMs > 0) {
    refreshTimer = setInterval(() => { refresh(); }, config.cacheRefreshMs);
    if (refreshTimer.unref) refreshTimer.unref(); // never keep the process alive
  }
}
function stopRefresh() { if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; } }

/** Delete expired (non-permanent) bans from the DB. Pure housekeeping — the cache
 *  already ignores expired rows; this just stops the table growing. Returns count. */
async function pruneExpired() {
  if (!store.deleteExpired) return 0;
  try { return await store.deleteExpired(); }
  catch (e) { console.error('[ipBlocklist] pruneExpired failed:', e.message); return 0; }
}

module.exports = {
  init,
  refresh,
  stopRefresh,
  pruneExpired,
  isBlocked,
  isAllowed,
  getBan,
  addBan,
  removeBan,
  addAllow,
  removeAllow,
  listBans,
  listAllow,
  recordRateLimitViolation,
  recordAdminLoginFailure,
  resetAdminLoginFailures,
  recordAttack,
  isPrivateOrReservedIp,
  // test-only
  __setStore,
};
