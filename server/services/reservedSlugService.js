// Unified reserved-slug resolver — the single authority consulted at every
// username/slug write point. Unions the three layers:
//   L1  static route/system names  (config/reservedNamespaces.js — code)
//   L2  admin/premium/prefix rows  (reserved_slugs table — runtime, cached)
//   L3  taken usernames            (username_history via usernameService)
//
// checkAvailability(raw, { selfUserId }) returns { ok, reason, normalized }, with
// reason ∈ format | reserved_route | blocked | reserved_admin | taken | ok. Input is
// normalized FIRST so confusable/zero-width reserved-word variants are caught.
const { supabaseAdmin } = require('../config/supabase');
const { normalizeSlug } = require('../utils/slugNormalize');
const { formatError } = require('../utils/slugFormat');
const { isStaticReserved } = require('../config/reservedNamespaces');
const { isBlocked } = require('../utils/adultContentFilter');
const usernameService = require('./usernameService');

const TTL_MS = 60 * 1000;
let _cache = null; // { rows, at }

// L2 rows, cached for TTL_MS. Bust on admin write via bustReservedCache().
async function _loadDynamic() {
  if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.rows;
  const { data } = await supabaseAdmin
    .from('reserved_slugs')
    .select('slug,is_prefix')
    .is('released_at', null);
  _cache = { rows: data || [], at: Date.now() };
  return _cache.rows;
}

function _clearCache() { _cache = null; }
function bustReservedCache() { _cache = null; }

// Exact match always; prefix match only for is_prefix rows (business namespace).
// Slugs are single path segments, so "acme-corp" matches a prefix reservation
// of "acme" but "acmecorp" does not.
function _matchesDynamic(norm, rows) {
  for (const r of rows) {
    const s = normalizeSlug(r.slug);
    if (!s) continue;
    if (s === norm) return true;
    if (r.is_prefix && norm.startsWith(s + '-')) return true;
  }
  return false;
}

async function checkAvailability(raw, { selfUserId = null } = {}) {
  const normalized = normalizeSlug(raw);

  const fmt = formatError(normalized);
  if (fmt) return { ok: false, reason: 'format', normalized, message: fmt };

  if (isStaticReserved(normalized)) {
    return { ok: false, reason: 'reserved_route', normalized };
  }

  // Adult / sexual-content guard — cheap sync check before any DB round-trip.
  if (isBlocked(normalized)) {
    return { ok: false, reason: 'blocked', normalized };
  }

  const rows = await _loadDynamic();
  if (_matchesDynamic(normalized, rows)) {
    return { ok: false, reason: 'reserved_admin', normalized };
  }

  const owner = await usernameService.usernameOwner(normalized);
  if (owner && owner !== selfUserId) {
    return { ok: false, reason: 'taken', normalized };
  }

  return { ok: true, reason: 'ok', normalized };
}

module.exports = { checkAvailability, bustReservedCache, _clearCache, _loadDynamic };
