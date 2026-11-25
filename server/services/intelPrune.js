/**
 * intel-prune — archives, then deletes raw events past the retention window,
 * then refreshes the size reading the ingest guard reads.
 * Design: docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §12.4
 *
 * On a 500 MB tier shared with the booking tables this is a safety device, not
 * housekeeping. It is the reason analytics cannot grow until a booking write
 * fails.
 *
 * ORDER MATTERS AND IS NOT NEGOTIABLE: archive, verify, then delete. A delete
 * that runs when the archive failed destroys the only copy, and no later fix
 * brings it back. So every failure path here declines to delete.
 *
 * Rollups are NOT pruned. analytics_daily is one row per host per day, so a
 * year of 500 hosts is single-digit MB — the rollups are the history, and raw
 * events exist only to build them and to allow a 30-day recompute.
 */
const { supabaseAdmin } = require('../config/supabase');
const { archiveDay } = require('./intelArchive');
const { istDay, istDayBounds } = require('./intelRollup');
const { setCachedSize } = require('./analyticsIngest');

const RETENTION_DAYS = Number(process.env.ANALYTICS_RETENTION_DAYS || 30);

/** The IST day N days before today. */
function dayBefore(n, now = Date.now()) {
  return istDay(new Date(now - n * 24 * 60 * 60 * 1000));
}

async function rowsForDay(day) {
  const { from, to } = istDayBounds(day);
  const { data, error } = await supabaseAdmin
    .from('analytics_events')
    .select('*')
    .gte('occurred_at', from)
    .lt('occurred_at', to)
    .order('occurred_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/**
 * Prune one day: archive it, confirm the archive, then delete.
 * Returns what it did. Never throws for an ordinary failure — a prune that
 * cannot archive simply declines to delete and says so.
 */
async function pruneDay(day) {
  let archived;
  try {
    archived = await archiveDay(day, { fetchRows: rowsForDay });
  } catch (err) {
    // The bucket is missing, Storage is down, whatever it is: do not delete.
    // Raw events cost us some disk; losing them costs us the ability to ever
    // recompute that day.
    return { day, deleted: 0, skipped: 'archive_failed', error: err?.message };
  }

  if (archived.archived === 0) return { day, deleted: 0, skipped: 'empty' };

  const { from, to } = istDayBounds(day);
  const { error, count } = await supabaseAdmin
    .from('analytics_events')
    .delete({ count: 'exact' })
    .gte('occurred_at', from)
    .lt('occurred_at', to);
  if (error) return { day, deleted: 0, skipped: 'delete_failed', error: error.message };

  return { day, deleted: count ?? archived.archived, archivedObjects: archived.objects };
}

async function refreshSizeCache() {
  try {
    const { data, error } = await supabaseAdmin.rpc('analytics_events_size_bytes');
    if (!error && data != null) setCachedSize(data);
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * Prune every day that has fallen out of the window. Walks a bounded number of
 * days back so a long outage cannot turn one run into an unbounded scan.
 */
async function runIntelPrune({ retentionDays = RETENTION_DAYS, maxDays = 14, now = Date.now() } = {}) {
  const results = [];
  for (let i = 0; i < maxDays; i += 1) {
    const day = dayBefore(retentionDays + i, now);
    try {
      const r = await pruneDay(day);
      results.push(r);
      // Nothing there and nothing older worth walking to.
      if (r.skipped === 'empty' && i > 0) break;
    } catch (err) {
      results.push({ day, error: err?.message });
      break;
    }
  }
  const bytes = await refreshSizeCache();
  return { pruned: results, sizeBytes: bytes };
}

module.exports = { runIntelPrune, pruneDay, dayBefore, RETENTION_DAYS };
