/**
 * intel-archive — writes a day of raw events out before intel-prune deletes it.
 * Design: docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §12.4
 *
 * WHY THIS SHIPS WITH THE PRUNE, NOT LATER. A 30-day raw window means a metric
 * can only be recomputed over the last 30 days. Change a funnel denominator in
 * month four and the earlier history cannot be rebuilt, because the rows are
 * gone. That cannot be fixed retroactively: an archive added in month four does
 * not bring months one to three back. So the escape hatch has to exist before
 * the first deletion, or it never covers the period that matters.
 *
 * Nothing reads this in normal operation. It exists so a definition change can
 * be replayed over a month we no longer hold.
 *
 * Storage is billed separately from the 500 MB database cap, and a month of raw
 * events gzips to single-digit MB — which is the whole reason the retention
 * window can be short without losing the history.
 */
const zlib = require('zlib');
const { promisify } = require('util');
const { supabaseAdmin } = require('../config/supabase');

const gzip = promisify(zlib.gzip);

// Private bucket, like `kyc` and `gst-exports`. Must exist before the first
// prune; the job fails soft and refuses to delete if it does not.
const BUCKET = 'intel-archive';

// One object per host-month, so a replay reads only the hosts it needs.
const objectPath = (hostId, day) => `${day.slice(0, 7)}/${hostId}/${day}.jsonl.gz`;

/**
 * Serialise rows as JSON Lines — one event per line.
 * JSONL, not a JSON array, so a replay can stream a large object line by line
 * instead of parsing it whole.
 */
function toJsonl(rows) {
  return rows.map((r) => JSON.stringify(r)).join('\n');
}

/**
 * Archive one IST day. Returns { archived, objects, skipped } and never throws
 * for an ordinary empty day.
 */
async function archiveDay(day, { fetchRows }) {
  const rows = await fetchRows(day);
  if (rows.length === 0) return { day, archived: 0, objects: 0 };

  const byHost = new Map();
  for (const r of rows) {
    if (!byHost.has(r.host_id)) byHost.set(r.host_id, []);
    byHost.get(r.host_id).push(r);
  }

  let objects = 0;
  for (const [hostId, hostRows] of byHost) {
    const body = await gzip(Buffer.from(toJsonl(hostRows), 'utf8'));
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(objectPath(hostId, day), body, {
        contentType: 'application/gzip',
        // A re-run of the same day must overwrite, not fail — the prune is only
        // allowed to delete once the archive has confirmably succeeded, so a
        // retry has to be able to get there.
        upsert: true,
      });
    if (error) throw error;
    objects += 1;
  }

  return { day, archived: rows.length, objects };
}

/** Read one host-day back, for a replay or a verification test. */
async function readArchivedDay(hostId, day) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(objectPath(hostId, day));
  if (error) throw error;
  const buf = Buffer.from(await data.arrayBuffer());
  const text = zlib.gunzipSync(buf).toString('utf8');
  return text.split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

module.exports = { archiveDay, readArchivedDay, toJsonl, objectPath, BUCKET };
