const { supabaseAdmin } = require('../config/supabase');

const CACHE_TTL_MS = 60 * 1000;
let _cache = { at: 0, map: null };

async function loadFlags() {
  const now = Date.now();
  if (_cache.map && now - _cache.at < CACHE_TTL_MS) return _cache.map;
  const map = {};
  try {
    const { data, error } = await supabaseAdmin.from('feature_flags').select('key, enabled');
    if (!error) for (const row of data || []) map[row.key] = !!row.enabled;
  } catch (_) { /* fail-open below */ }
  _cache = { at: now, map };
  return map;
}

// Security-boundary flags fail CLOSED. For these keys an absent row or a DB
// read error must NOT silently disable the guard, so they default to `false`
// (the safe / more-restrictive state) rather than `true`. A boundary control
// that fails open is not a control. `unified_login` gates the host/guest login
// separation (authController) — if it can't be read, enforce the separation.
// `crm_admin_sends` is the master gate for admin CRM outbound. It fails CLOSED
// so a missing row or a DB read error means NO sends (an outbound control that
// fails open is not a control). It also ships disabled (featureRegistry).
// `host_linkedin_login` is an opt-in login door: it stays closed if its row is missing or the read fails.
// `bot_tool_loop` gates Tithi's agentic account tool-loop on the authenticated support
// thread. It ships OFF and reads/acts on a signed-in user's own account, so a missing
// row or read error must NOT turn it on — fail closed.
const FAIL_CLOSED_KEYS = new Set(['unified_login', 'crm_admin_sends', 'crm_second_touch', 'crm_list_engagement', 'community', 'community_writes', 'community_tithi', 'community_ads', 'community_v2', 'host_linkedin_login', 'bot_tool_loop']);

// Fail-open (default): unknown / errored feature flags default to enabled so a
// missing migration never bricks a normal feature. Security keys override this
// and fail closed (see FAIL_CLOSED_KEYS).
async function isFeatureEnabled(key) {
  const map = await loadFlags();
  if (key in map) return map[key];
  return FAIL_CLOSED_KEYS.has(key) ? false : true;
}

function clearCache() { _cache = { at: 0, map: null }; }

module.exports = { isFeatureEnabled, loadFlags, clearCache };
