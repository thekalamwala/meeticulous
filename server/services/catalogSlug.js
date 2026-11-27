// server/services/catalogSlug.js
// Resolve a public product/course URL key to its row: current slug → id (old
// /:u/product/<uuid> links and emailed ?dl deep links) → legacy_slugs (slugs a
// row used to have, e.g. the stripped `demo-` prefix, v3.229). The caller
// compares the returned row's slug with the key and 301s to the canonical
// /:u/products|courses/<slug> URL when they differ — so a UUID or an old slug
// never stays the public URL.
//
// Schema fallback: before v3.229 is applied the legacy_slugs column does not
// exist; that lookup then errors and is treated as "not found", so this works
// on both sides of the migration.
const { supabaseAdmin } = require('../config/supabase');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Only plain slugs reach the array filter (no PostgREST syntax in a URL key).
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,159}$/i;

// table: 'products' | 'courses'. Returns { data, error } like a supabase call;
// `error` is only the slug lookup's (callers keep their missing-table handling).
async function resolveCatalogItem(table, hostId, key, cols) {
  const k = String(key || '').trim();
  const base = () => supabaseAdmin.from(table).select(cols).eq('host_id', hostId).eq('is_active', true);

  const bySlug = await base().eq('slug', k).maybeSingle();
  if (bySlug.error || bySlug.data) return { data: bySlug.data || null, error: bySlug.error || null };

  if (UUID_RE.test(k)) {
    const byId = await base().eq('id', k).maybeSingle();
    if (byId.data) return { data: byId.data, error: null };
  }

  if (SLUG_RE.test(k)) {
    const byLegacy = await base().contains('legacy_slugs', [k.toLowerCase()]).limit(1);
    if (!byLegacy.error && byLegacy.data && byLegacy.data.length) return { data: byLegacy.data[0], error: null };
  }
  return { data: null, error: null };
}

module.exports = { resolveCatalogItem, UUID_RE };
