'use strict';
require('dotenv').config();

/**
 * sameSlotBurst.js — proves the double-booking guarantee under REAL concurrency.
 *
 * Fires N simultaneous createBooking() calls at ONE identical slot against the
 * real staging Postgres and asserts exactly one wins (201) and the rest are
 * rejected (409). This is the only way to exercise the `bookings_no_overlap`
 * GiST exclusion constraint — every server/tests/ suite mocks supabaseAdmin, so
 * a mock can at best fake a 23P01, never prove "one of N racing inserts commits".
 *
 * Scenario 1 — double-booking: N bookings at the same time → expect 1×201, rest 409.
 * Scenario 2 — grace-race probe (gates plan Item C): two concurrent bookings that
 *   do NOT raw-overlap but sit inside the per-service grace window. The DB
 *   constraint uses raw [scheduled_at, end_at) so it can't catch these; only the
 *   racy app-level check can. If both commit → the grace race is real → build the
 *   grace-in-constraint migration (Item C). Timing-dependent, so it runs a few
 *   rounds and reports how often both slipped through.
 *
 * Prereq: seed the loadtest host first →  node scripts/seedLoadTest.js
 * Run (staging env only):                 node scripts/sameSlotBurst.js
 * Tunables: BURST_N (default 50), GRACE_ROUNDS (default 5).
 */

const { supabaseAdmin } = require('../config/supabase');
const { assertNotProd } = require('./lib/guard');
const grant = require('../utils/bookingGrant');
const { createBooking } = require('../controllers/bookingController');

const PROD_REF = 'ayjhlwyzszykqtnaktpb';     // Mumbai — NEVER write-burst this
const STAGING_REF = 'xwvciqkayammbvsidqig';  // Tokyo — the only allowed target
const TAG_DOMAIN = '@loadtest.bookasloth.local';
const HOST_USERNAME = 'loadtest-vendor-rules';
const SERVICE_SLUG = 'loadtest-rules-free';  // price 0 → confirmed/paid, no payment, no gcal
const N = Number(process.env.BURST_N || 50);
const GRACE_ROUNDS = Number(process.env.GRACE_ROUNDS || 5);

// ── Safety gate ─────────────────────────────────────────────────────────────
// assertNotProd (NODE_ENV) is NOT enough: a dev .env commonly points at the PROD
// Supabase project while NODE_ENV is unset (the "local == prod DB" trap called
// out in performance/scripts/run.js). This script INSERTS bookings, so refuse
// anything that isn't the staging project ref.
function assertStaging() {
  assertNotProd('sameSlotBurst');
  const url = process.env.SUPABASE_URL || '';
  if (url.includes(PROD_REF)) {
    console.error(`REFUSING: SUPABASE_URL points at PROD (${PROD_REF}). This script writes bookings — staging only.`);
    process.exit(2);
  }
  if (!url.includes(STAGING_REF) && process.env.PERF_ALLOW_NONSTAGING !== '1') {
    console.error(
      `REFUSING: SUPABASE_URL is neither staging (${STAGING_REF}) nor prod.\n` +
      `Point it at staging, or set PERF_ALLOW_NONSTAGING=1 for a custom isolated test DB.`,
    );
    process.exit(2);
  }
}

// Express res double good enough for the controller: it only ever calls
// res.status(code).json(body) exactly once. Default 0 = controller never replied.
const makeRes = () => {
  const r = { statusCode: 0, body: null };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (b) => { r.body = b; return r; };
  return r;
};

// Anonymous booker: needs a signed OTP grant bound to its (unique, tagged) email.
const makeReqRes = (label, scheduledAtISO, serviceId) => {
  const guest_email = `burst-${label}-${Date.now()}${TAG_DOMAIN}`;
  const booking_grant = grant.issue({ email: guest_email });
  const req = {
    user: null,
    headers: {},
    get: () => undefined,
    body: { service_id: serviceId, scheduled_at: scheduledAtISO, guest_name: `Burst ${label}`, guest_email, booking_grant },
  };
  return { req, res: makeRes() };
};

// istHour:istMin (Asia/Kolkata, UTC+5:30) → the UTC instant, `daysAhead` out.
// Host is open 09:00–21:00 every day, blocked_dates empty, so any weekday works;
// > '2026-06-11' satisfies the constraint predicate.
const futureSlotISO = (daysAhead, istHour, istMin = 0) => {
  const now = new Date();
  const midnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead);
  const d = new Date(midnightUTC);
  d.setUTCMinutes(d.getUTCMinutes() + (istHour * 60 + istMin - 330)); // 330 = 5h30m IST offset
  return d.toISOString();
};

const call = async ({ req, res }) => {
  try { await createBooking(req, res); }
  catch (e) { res.statusCode = -1; res.body = { message: String(e && e.message || e) }; }
  return res.statusCode;
};

const clearHostBookings = (hostId) =>
  supabaseAdmin.from('bookings').delete().eq('host_id', hostId).like('guest_email', `%${TAG_DOMAIN}`);

async function main() {
  assertStaging();

  const { data: host } = await supabaseAdmin
    .from('profiles').select('id').eq('username', HOST_USERNAME).maybeSingle();
  if (!host) { console.error(`Host ${HOST_USERNAME} not found — run: node scripts/seedLoadTest.js`); process.exit(1); }
  const { data: service } = await supabaseAdmin
    .from('services').select('id, grace_period_minutes, duration').eq('host_id', host.id).eq('slug', SERVICE_SLUG).maybeSingle();
  if (!service) { console.error(`Service ${SERVICE_SLUG} not found — run: node scripts/seedLoadTest.js`); process.exit(1); }

  const tally = (codes) => codes.reduce((m, c) => ((m[c] = (m[c] || 0) + 1), m), {});
  let failed = false;

  // ── Scenario 1 — double-booking ──
  await clearHostBookings(host.id);
  const slot = futureSlotISO(10, 10); // 10:00 IST, 10 days out
  const reqs = Array.from({ length: N }, (_, i) => makeReqRes(`s1-${i}`, slot, service.id));
  const codes = await Promise.all(reqs.map(call));
  const t = tally(codes);
  const created = t[201] || 0;
  const conflict = t[409] || 0;

  const { count: dbCount } = await supabaseAdmin
    .from('bookings').select('id', { count: 'exact', head: true })
    .eq('host_id', host.id).eq('scheduled_at', slot).neq('status', 'cancelled');

  const s1ok = created === 1 && conflict === N - 1 && dbCount === 1;
  failed = failed || !s1ok;
  console.log(`\n── Scenario 1: double-booking (N=${N}) ──`);
  console.log(`  status codes: ${JSON.stringify(t)}`);
  console.log(`  created(201)=${created}  conflict(409)=${conflict}  non-cancelled rows in DB=${dbCount}`);
  console.log(`  ${s1ok ? 'PASS' : 'FAIL'}: expected exactly 1 win, ${N - 1}×409, and 1 DB row.`);

  // ── Scenario 2 — grace-race probe (gates Item C) ──
  const dur = service.duration || 30;
  const graceMin = service.grace_period_minutes ?? 10;
  // slotB starts after slotA ends (no raw overlap) but within grace: gap < graceA+graceB.
  const gapMin = dur + Math.max(1, Math.floor(graceMin / 2)); // e.g. 30 + 5 = 35 → 5-min gap, grace 10
  let doubleCommits = 0;
  for (let round = 0; round < GRACE_ROUNDS; round++) {
    await clearHostBookings(host.id);
    const a = futureSlotISO(11 + round, 10);           // A at 10:00 IST
    const bDate = new Date(a); bDate.setUTCMinutes(bDate.getUTCMinutes() + gapMin);
    const b = bDate.toISOString();                     // B = A + (duration + ~half-grace)
    const r = await Promise.all([makeReqRes(`s2a-${round}`, a, service.id), makeReqRes(`s2b-${round}`, b, service.id)].map(call));
    const both201 = r.every((c) => c === 201);
    if (both201) doubleCommits++;
  }
  console.log(`\n── Scenario 2: grace-race probe (${GRACE_ROUNDS} rounds, gap=${gapMin}m within grace) ──`);
  if (doubleCommits > 0) {
    console.log(`  GRACE RACE CONFIRMED: ${doubleCommits}/${GRACE_ROUNDS} rounds committed BOTH within-grace bookings.`);
    console.log(`  → Build plan Item C (grace-in-constraint migration v3.70).`);
  } else {
    console.log(`  No grace race observed in ${GRACE_ROUNDS} rounds — app-level check held each time.`);
    console.log(`  → Item C stays gated (revisit if you move to 2+ backend instances).`);
  }

  await clearHostBookings(host.id);
  console.log(`\n${failed ? 'RESULT: FAIL' : 'RESULT: PASS'} (Scenario 1 is the gate; Scenario 2 is informational).`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
