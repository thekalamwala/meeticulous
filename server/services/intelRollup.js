/**
 * intel-rollup — turns raw events into the tables the Intelligence pages read.
 * Design: docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §12.4
 *
 * Idempotent by construction: it recomputes whole days and upserts, so running
 * it twice, or re-running it after a partial failure, lands on the same numbers.
 * That is what lets it carry `retryOnError`.
 *
 * Recomputes today and yesterday every run. Yesterday because a visitor whose
 * session straddles midnight, or a beacon that flushed late from a reopened tab,
 * lands in a day we have already rolled.
 *
 * DAYS ARE IST, not UTC. Every host is Indian and "yesterday" to them ends at
 * midnight IST; a UTC day would cut their evening in half and make the busiest
 * hours land on the wrong date. The day key is derived once, here, so every
 * downstream read inherits it.
 *
 * ponytail: aggregation happens in JS over a day's rows, not in SQL. PostgREST
 * has no real GROUP BY, and a day is hundreds of rows per host at current scale.
 * The ceiling is roughly when one host's single day exceeds ~50k events; past
 * that this becomes a Postgres function and the job calls it by RPC. The shape
 * of what it writes does not change, so that swap is local to this file.
 */
const { supabaseAdmin } = require('../config/supabase');
const { setCachedSize } = require('./analyticsIngest');

const IST_OFFSET_MIN = 5 * 60 + 30;

/** The IST calendar day an instant falls in, as 'YYYY-MM-DD'. */
function istDay(d = new Date()) {
  const t = new Date(d.getTime() + IST_OFFSET_MIN * 60 * 1000);
  return t.toISOString().slice(0, 10);
}

/** Start and end instants (UTC) of an IST calendar day. */
function istDayBounds(day) {
  const startUtcMs = Date.parse(`${day}T00:00:00.000Z`) - IST_OFFSET_MIN * 60 * 1000;
  return {
    from: new Date(startUtcMs).toISOString(),
    to: new Date(startUtcMs + 24 * 60 * 60 * 1000).toISOString(),
  };
}

// event name -> the analytics_daily column it increments.
const COUNTER_OF = {
  host_profile_viewed: 'profile_views',
  service_viewed: 'service_views',
  booking_started: 'booking_starts',
  booking_slot_picked: 'slot_picks',
  checkout_started: 'checkout_starts',
  profile_link_clicked: 'link_clicks',
};

const EMPTY = () => ({
  profile_views: 0,
  unique_visitors: 0,
  new_visitors: 0,
  service_views: 0,
  booking_starts: 0,
  slot_picks: 0,
  checkout_starts: 0,
  link_clicks: 0,
});

/**
 * Fold one day's rows into per-host daily counters and dimension rows.
 * Pure: no database, no clock. Everything interesting is testable from here.
 *
 * @param rows   raw analytics_events rows for the day
 * @param priorVisitors Set of `${host_id}|${visitor_id}` seen BEFORE this day,
 *                      which is what makes a visitor "new" rather than returning
 */
function fold(rows, priorVisitors = new Set()) {
  const daily = new Map();   // host_id -> counters
  const seen = new Map();    // host_id -> Set(visitor_id)
  const dims = new Map();    // `${host}|${type}|${value}` -> counters

  const bump = (hostId, type, value, field) => {
    if (!value) return; // an unknown dimension is left out, never bucketed as ''
    const k = `${hostId}|${type}|${value}`;
    const cur = dims.get(k) || { host_id: hostId, dim_type: type, dim_value: String(value).slice(0, 128), visitors: 0, service_views: 0, booking_starts: 0 };
    cur[field] += 1;
    dims.set(k, cur);
  };

  for (const r of rows) {
    const host = r.host_id;
    if (!host) continue;

    if (!daily.has(host)) daily.set(host, EMPTY());
    const d = daily.get(host);

    const col = COUNTER_OF[r.event];
    if (col) d[col] += 1;

    // Visitors are counted once per host per day, on first sight.
    if (!seen.has(host)) seen.set(host, new Set());
    const visitors = seen.get(host);
    const firstSightToday = r.visitor_id && !visitors.has(r.visitor_id);
    if (firstSightToday) {
      visitors.add(r.visitor_id);
      d.unique_visitors += 1;
      if (!priorVisitors.has(`${host}|${r.visitor_id}`)) d.new_visitors += 1;

      bump(host, 'source', r.source, 'visitors');
      bump(host, 'medium', r.medium, 'visitors');
      bump(host, 'campaign', r.campaign, 'visitors');
      bump(host, 'device', r.device_type, 'visitors');
      bump(host, 'referrer', r.referrer_host, 'visitors');
    }

    if (r.event === 'service_viewed') {
      bump(host, 'service', r.service_id, 'service_views');
      bump(host, 'source', r.source, 'service_views');
    }
    if (r.event === 'booking_started') {
      bump(host, 'service', r.service_id, 'booking_starts');
      bump(host, 'source', r.source, 'booking_starts');
    }
  }

  return { daily, dims: [...dims.values()] };
}

/**
 * Attribution for paid bookings (§12.2).
 *
 * Exactly one candidate event in the window -> 'high'. Several, or none -> NO
 * ROW. A guess recorded as a fact is worse than an honest gap, and every gap
 * lands in the `unknown` bucket which the UI always shows rather than spreading
 * across the known sources.
 *
 * Pure, for the same reason as fold().
 */
const ATTRIBUTION_WINDOW_MS = 2 * 60 * 60 * 1000;

function resolveAttribution(bookings, events) {
  const candidates = events.filter(
    (e) => e.event === 'checkout_started' || e.event === 'booking_started',
  );

  const out = [];
  for (const b of bookings) {
    const paidAt = Date.parse(b.created_at);
    if (!Number.isFinite(paidAt)) continue;

    const matches = candidates.filter((e) => {
      if (e.host_id !== b.host_id) return false;
      if (b.service_id && e.service_id && e.service_id !== b.service_id) return false;
      const t = Date.parse(e.occurred_at);
      return Number.isFinite(t) && t <= paidAt && paidAt - t <= ATTRIBUTION_WINDOW_MS;
    });

    // Ambiguous is the common case as volume grows: two guests booking the same
    // service in the same two hours are indistinguishable here. Recorded as
    // nothing, deliberately. Revisit with a signed attribution token when
    // `unknown` passes ~15% of paid bookings in a month.
    if (matches.length !== 1) continue;

    const m = matches[0];
    out.push({
      booking_id: b.id,
      visitor_id: m.visitor_id,
      first_source: m.source, first_medium: m.medium, first_campaign: m.campaign,
      last_source: m.source, last_medium: m.medium, last_campaign: m.campaign,
      first_seen_at: m.occurred_at,
      confidence: 'high',
    });
  }
  return out;
}

/* ── The job ─────────────────────────────────────────────────────────────── */

async function eventsForDay(day) {
  const { from, to } = istDayBounds(day);
  const { data, error } = await supabaseAdmin
    .from('analytics_events')
    .select('host_id, visitor_id, event, service_id, occurred_at, source, medium, campaign, device_type, referrer_host')
    .gte('occurred_at', from)
    .lt('occurred_at', to)
    .order('occurred_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** `${host}|${visitor}` pairs seen strictly before this day, for new_visitors. */
async function priorVisitorsBefore(day) {
  const { from } = istDayBounds(day);
  const { data, error } = await supabaseAdmin
    .from('analytics_events')
    .select('host_id, visitor_id')
    .lt('occurred_at', from);
  if (error) throw error;
  return new Set((data || []).map((r) => `${r.host_id}|${r.visitor_id}`));
}

async function rollDay(day) {
  const rows = await eventsForDay(day);
  if (rows.length === 0) return { day, hosts: 0, dims: 0, attributed: 0 };

  const prior = await priorVisitorsBefore(day);
  const { daily, dims } = fold(rows, prior);

  const dailyRows = [...daily.entries()].map(([host_id, c]) => ({
    host_id, day, ...c, updated_at: new Date().toISOString(),
  }));

  if (dailyRows.length) {
    const { error } = await supabaseAdmin
      .from('analytics_daily')
      .upsert(dailyRows, { onConflict: 'host_id,day' });
    if (error) throw error;
  }
  if (dims.length) {
    const { error } = await supabaseAdmin
      .from('analytics_daily_dim')
      .upsert(dims.map((d) => ({ ...d, day, updated_at: new Date().toISOString() })), { onConflict: 'host_id,day,dim_type,dim_value' });
    if (error) throw error;
  }

  // Attribution, off the money path by design.
  const { from, to } = istDayBounds(day);
  const { data: paid } = await supabaseAdmin
    .from('bookings')
    .select('id, host_id, service_id, created_at')
    .eq('payment_status', 'paid')
    .gte('created_at', from)
    .lt('created_at', to);

  let attributed = 0;
  const attr = resolveAttribution(paid || [], rows);
  if (attr.length) {
    const { error } = await supabaseAdmin
      .from('booking_attribution')
      .upsert(attr.map((a) => ({ ...a, resolved_at: new Date().toISOString() })), { onConflict: 'booking_id' });
    if (!error) attributed = attr.length;
  }

  return { day, hosts: dailyRows.length, dims: dims.length, attributed };
}

/** Refresh the size reading the ingest guard reads. Best-effort. */
async function refreshSizeCache() {
  try {
    const { data, error } = await supabaseAdmin.rpc('analytics_events_size_bytes');
    if (!error && data != null) setCachedSize(data);
  } catch {
    // No RPC yet is fine: the guard simply stays at its last known value, and
    // intel-prune is the real ceiling. Never fail the rollup over telemetry.
  }
}

async function runIntelRollup({ days } = {}) {
  const targets = days || [istDay(), istDay(new Date(Date.now() - 24 * 60 * 60 * 1000))];
  const results = [];
  for (const day of targets) {
    try {
      results.push(await rollDay(day));
    } catch (err) {
      // One bad day must not stop the other. Schema fallback lives here too: a
      // missing table before v3.217 is applied is a no-op, not a crash loop.
      results.push({ day, error: err?.message });
    }
  }
  await refreshSizeCache();
  return results;
}

module.exports = {
  runIntelRollup,
  rollDay,
  fold,
  resolveAttribution,
  istDay,
  istDayBounds,
  ATTRIBUTION_WINDOW_MS,
};
