/**
 * analyticsIngest — first-party event collection for Creator Intelligence.
 * Design: docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §11.5
 *
 * THE ONE RULE: analytics degrades, bookings never do. Every failure path here
 * ends in "drop it and return 202". A guest mid-booking must never see an error,
 * a retry storm, or a slow response because a telemetry table was full. That is
 * why there is no 4xx anywhere in this file, including for input we know is
 * junk — a 4xx teaches a client to retry, and the client is a beacon.
 *
 * Four independent brakes, each able to stop ingest on its own:
 *   1. `analytics_ingest` feature flag — the kill switch (60 s cache). In
 *      SAFETY_KEYS, so no plan can bypass an emergency off.
 *   2. Size guard — a cached table-size reading, refreshed by intel-prune.
 *      Over budget, ingest stops and the founder is told once.
 *   3. Per-visitor in-memory rate limit — NOT the DB-backed apiLimiter, which
 *      would both 429 guests behind carrier NAT and write a rate_limit_hits row
 *      per beacon, growing the very table we are trying not to grow.
 *   4. Origin check — only the production host. Dev and preview traffic can
 *      never appear in a real host's paid dashboard.
 */
const { supabaseAdmin } = require('../config/supabase');
const { isFeatureEnabled } = require('./featureFlags');
const { adminAlert } = require('../utils/adminAlert');

// Events we accept. Anything else is dropped silently — the catalog exists so
// names never drift, and an unknown name here means a client is ahead of the
// server, not that the guest did something wrong.
// Mirrors client/src/services/analytics/events.js.
const ALLOWED_EVENTS = new Set([
  'host_profile_viewed',
  'service_viewed',
  'booking_started',
  'booking_slot_picked',
  'checkout_started',
  'booking_created',
  'booking_paid',
  'payment_failed',
  // Added for Intelligence (§11.3) — neither can be derived from Postgres.
  'profile_link_clicked',
  'service_shared',
]);

const MAX_BATCH = 20;
// Client clocks lie. Anything further out than this is clamped to now rather
// than dropped — a wrong timestamp is still a real event.
const CLOCK_SKEW_MS = 48 * 60 * 60 * 1000;

const PROD_ORIGINS = new Set([
  'https://meeticulous.com',
  'https://www.meeticulous.com',
]);

// Per-visitor budget. Generous: a real session flushing every 5 s with 20 events
// a flush stays far under, so tripping this means something automated.
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_EVENTS = 240;

// Table-size budget. analytics_events shares a 500 MB cap with the booking
// tables, so it gets a fraction and stops there.
const SIZE_BUDGET_BYTES = Number(process.env.ANALYTICS_SIZE_BUDGET_BYTES || 150 * 1024 * 1024);

/* ── Brake 3: per-visitor rate limit, in memory ──────────────────────────── */
// A Map, not Redis: this is per-process and that is fine. The limit exists to
// blunt a runaway client, not to be exact across a fleet.
const _buckets = new Map();

function rateLimited(visitorId, count, now = Date.now()) {
  const b = _buckets.get(visitorId);
  if (!b || now - b.start >= RATE_WINDOW_MS) {
    _buckets.set(visitorId, { start: now, n: count });
    // Opportunistic sweep so the Map cannot grow without bound.
    if (_buckets.size > 10_000) {
      for (const [k, v] of _buckets) if (now - v.start >= RATE_WINDOW_MS) _buckets.delete(k);
    }
    return false;
  }
  if (b.n >= RATE_MAX_EVENTS) return true;
  b.n += count;
  return false;
}

/* ── Brake 2: size guard ─────────────────────────────────────────────────── */
// Read from cache, never measured inline — pg_total_relation_size on the ingest
// path would be a query per beacon. intel-prune refreshes it.
let _size = { bytes: 0, at: 0, alerted: false };

function setCachedSize(bytes) {
  _size = { bytes: Number(bytes) || 0, at: Date.now(), alerted: _size.alerted };
}

function overBudget() {
  return _size.bytes > SIZE_BUDGET_BYTES;
}

async function alertOnceIfOverBudget() {
  if (!overBudget() || _size.alerted) return;
  _size.alerted = true; // set before awaiting, so a burst cannot send twice
  try {
    await adminAlert({
      subject: 'Analytics ingest stopped — size budget reached',
      key: 'analytics-size-budget',
      category: 'Analytics',
      lines: [
        `analytics_events is ${(_size.bytes / 1024 / 1024).toFixed(1)} MB, over the ${(SIZE_BUDGET_BYTES / 1024 / 1024).toFixed(0)} MB budget.`,
        'Ingest is dropping events. Bookings and payments are unaffected.',
        'intel-prune should bring this down on its next run; if it does not, shorten the retention window.',
      ],
    });
  } catch {
    // An alert that fails must not break ingest. The guard still holds.
  }
}

/* ── Validation ──────────────────────────────────────────────────────────── */
const str = (v, max) => (typeof v === 'string' && v ? v.slice(0, max) : null);

/**
 * Shape one client event into a row, or return null to drop it.
 * Pure and synchronous so it can be tested without a database.
 */
function normalise(raw, { now = Date.now() } = {}) {
  if (!raw || typeof raw !== 'object') return null;
  if (!ALLOWED_EVENTS.has(raw.event)) return null;
  if (!raw.host_id || !raw.visitor_id || !raw.ingest_id) return null;

  // Client clock, clamped. `occurred_at` outside the skew window becomes now.
  const t = Date.parse(raw.occurred_at);
  const ok = Number.isFinite(t) && Math.abs(now - t) <= CLOCK_SKEW_MS;

  return {
    host_id: raw.host_id,
    visitor_id: str(raw.visitor_id, 64),
    session_id: str(raw.session_id, 64),
    event: raw.event,
    service_id: raw.service_id || null,
    occurred_at: new Date(ok ? t : now).toISOString(),
    source: str(raw.source, 64),
    medium: str(raw.medium, 64),
    campaign: str(raw.campaign, 64),
    referrer_host: str(raw.referrer_host, 253),
    device_type: str(raw.device_type, 16),
    route: str(raw.route, 64),
    link_type: str(raw.link_type, 32),
    channel: str(raw.channel, 32),
    ingest_id: str(raw.ingest_id, 64),
  };
}

function originAllowed(origin) {
  if (process.env.ANALYTICS_ALLOW_ANY_ORIGIN === 'true') return true; // local dev only
  return PROD_ORIGINS.has(origin);
}

/* ── The ingest path ─────────────────────────────────────────────────────── */
/**
 * Always resolves. Returns a small report for tests and logs; the route turns
 * every outcome into 202.
 */
async function ingest({ events = [], origin = '' } = {}) {
  if (!originAllowed(origin)) return { accepted: 0, dropped: events.length, reason: 'origin' };
  if (!Array.isArray(events) || events.length === 0) return { accepted: 0, dropped: 0, reason: 'empty' };

  const batch = events.slice(0, MAX_BATCH);

  if (!(await isFeatureEnabled('analytics_ingest'))) {
    return { accepted: 0, dropped: batch.length, reason: 'flag_off' };
  }
  if (overBudget()) {
    await alertOnceIfOverBudget();
    return { accepted: 0, dropped: batch.length, reason: 'size_budget' };
  }

  const rows = batch.map((e) => normalise(e)).filter(Boolean);
  if (rows.length === 0) return { accepted: 0, dropped: batch.length, reason: 'invalid' };

  if (rateLimited(rows[0].visitor_id, rows.length)) {
    return { accepted: 0, dropped: batch.length, reason: 'rate' };
  }

  try {
    // Dedupe is the unique index on ingest_id: a beacon replayed after a failed
    // flush inserts nothing the second time.
    const { error } = await supabaseAdmin
      .from('analytics_events')
      .upsert(rows, { onConflict: 'ingest_id', ignoreDuplicates: true });
    if (error) throw error;
    return { accepted: rows.length, dropped: batch.length - rows.length, reason: null };
  } catch (err) {
    // Schema fallback: safe to deploy before v3.217 is applied. A missing table
    // is a quiet drop, not an error a guest can see.
    return { accepted: 0, dropped: batch.length, reason: 'db', error: err?.message };
  }
}

module.exports = {
  ingest,
  normalise,
  setCachedSize,
  overBudget,
  originAllowed,
  ALLOWED_EVENTS,
  MAX_BATCH,
  SIZE_BUDGET_BYTES,
  RATE_MAX_EVENTS,
  __test: { rateLimited, resetBuckets: () => _buckets.clear(), resetSize: () => { _size = { bytes: 0, at: 0, alerted: false }; } },
};
