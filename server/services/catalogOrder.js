/**
 * catalogOrder — the host-set order of services, products and courses (v3.227).
 *
 * One rule everywhere a host's list is read (dashboard Catalog and the public
 * booking page): placed rows first by `sort_order`, then rows the host never
 * placed, newest first. A host who never reorders keeps today's newest-first
 * order exactly.
 *
 * Schema-fallback safe: the order is read in its own small query (`id,
 * sort_order`) and applied in memory, so the main selects are untouched and a
 * DB without the column (migration not applied yet) simply keeps the old order.
 */
'use strict';

const { supabaseAdmin } = require('../config/supabase');

const TABLES = new Set(['services', 'products', 'courses']);
const MAX_IDS = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const missingColumn = (err) => !!err && /sort_order|Could not find the|column .* does not exist/i.test(err.message || '');

/** Comparator: sort_order ASC NULLS LAST, then created_at DESC. Pure. */
function compareHostOrder(a, b) {
  const sa = Number.isFinite(a?.sort_order) ? a.sort_order : null;
  const sb = Number.isFinite(b?.sort_order) ? b.sort_order : null;
  if (sa !== null && sb !== null && sa !== sb) return sa - sb;
  if (sa !== null && sb === null) return -1;
  if (sa === null && sb !== null) return 1;
  return String(b?.created_at || '').localeCompare(String(a?.created_at || ''));
}

/** Copy of rows in host order. Rows already carrying sort_order are used as-is. */
const sortHostOrder = (rows) => [...(rows || [])].sort(compareHostOrder);

/**
 * Apply the host's order to rows fetched WITHOUT sort_order (e.g. a public
 * select with a fixed column list). Best-effort: any read error leaves the
 * rows in the order they came, so a page never fails over its ordering.
 */
async function applyHostOrder(table, hostId, rows) {
  if (!TABLES.has(table) || !Array.isArray(rows) || rows.length < 2) return rows || [];
  try {
    const { data, error } = await supabaseAdmin.from(table).select('id, sort_order').eq('host_id', hostId);
    if (error || !Array.isArray(data)) return rows;
    const rank = new Map(data.map((r) => [r.id, r.sort_order]));
    // Ties without created_at in the row keep their incoming order (stable sort).
    return [...rows].sort((a, b) => {
      const sa = rank.get(a.id); const sb = rank.get(b.id);
      const na = Number.isFinite(sa) ? sa : null; const nb = Number.isFinite(sb) ? sb : null;
      if (na !== null && nb !== null) return na - nb;
      if (na !== null) return -1;
      if (nb !== null) return 1;
      return a.created_at && b.created_at ? String(b.created_at).localeCompare(String(a.created_at)) : 0;
    });
  } catch (_) {
    return rows;
  }
}

/** Validate a reorder body. Returns { ids } or { error }. Pure. */
function parseReorder(body) {
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0) return { error: 'Send the items in the order you want.' };
  if (ids.length > MAX_IDS) return { error: `At most ${MAX_IDS} items can be ordered at once.` };
  if (!ids.every((id) => typeof id === 'string' && UUID_RE.test(id))) return { error: 'Unknown item in the list.' };
  if (new Set(ids).size !== ids.length) return { error: 'An item appears twice in the list.' };
  return { ids };
}

/**
 * PUT /api/{services,products,courses}/reorder  { ids: [uuid, ...] }
 * Writes sort_order = position (1-based) on the host's OWN rows only: every id
 * must belong to req.user, or nothing is written. Ids not sent keep their value.
 * `onSaved` runs after a successful write (e.g. bust the public profile cache).
 */
const makeReorderHandler = (table, { onSaved } = {}) => async (req, res) => {
  if (!TABLES.has(table)) return res.status(500).json({ message: 'Not available' });
  const { ids, error } = parseReorder(req.body);
  if (error) return res.status(400).json({ message: error });
  try {
    const { data: owned, error: readErr } = await supabaseAdmin
      .from(table).select('id').eq('host_id', req.user.id).in('id', ids);
    if (readErr) return res.status(500).json({ message: 'Could not save the order.' });
    if ((owned || []).length !== ids.length) return res.status(404).json({ message: 'Some of these items are not yours or no longer exist.' });

    const results = await Promise.all(ids.map((id, i) => supabaseAdmin
      .from(table).update({ sort_order: i + 1 }).eq('id', id).eq('host_id', req.user.id)));
    const failed = results.find((r) => r.error);
    if (failed) {
      if (missingColumn(failed.error)) return res.status(409).json({ message: 'Reordering is not available yet.' });
      return res.status(500).json({ message: 'Could not save the order.' });
    }
    try { onSaved?.(); } catch (_) { /* a cache bust never fails the save */ }
    res.json({ ok: true, ids });
  } catch (_) {
    res.status(500).json({ message: 'Could not save the order.' });
  }
};

module.exports = { compareHostOrder, sortHostOrder, applyHostOrder, parseReorder, makeReorderHandler, MAX_IDS };
