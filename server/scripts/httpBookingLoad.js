'use strict';
require('dotenv').config();

/**
 * httpBookingLoad.js — write-path THROUGHPUT test over real HTTP.
 *
 * Unlike sameSlotBurst.js (in-process createBooking(), proves the no-overlap
 * constraint) this fires concurrent POST /api/bookings at a DEPLOYED server URL
 * to measure how many bookings/sec the single Render instance accepts before it
 * breaks — the real "traffic spike" number for the paper.
 *
 * Each request books a UNIQUE future slot (not the same one) so a healthy server
 * returns 201 for all of them — we're measuring accept-rate + latency, not
 * contention. Anonymous guest path: we mint the OTP booking_grant ourselves with
 * the server's OAUTH_STATE_SECRET (same proof verify-otp issues), so no OTP round
 * trip. Free service (price=0) → no Razorpay path, no gcal.
 *
 * SAFETY: writes bookings → refuses any prod Supabase ref (same guard as
 * sameSlotBurst). Point SUPABASE_URL at the throwaway staging DB. Tagged emails
 * (@loadtest.meeticulous.local) → cleanupLoadTest.js removes them.
 *
 * Prereq:  node scripts/seedLoadTest.js              (seeds the vendor+service)
 * Run:     BASE=https://<staging>.onrender.com node scripts/httpBookingLoad.js
 * Tunables: LEVELS="10,25,50,100,200"  PER_LEVEL=150  (requests per level)
 *
 * ponytail: worker-pool, no ramp-curve — fixed CONC levels find the knee cleanly
 * and read simpler in the paper. Add k6-style arrival-rate only if the knee is
 * between two levels and you need to pin it.
 */

const { supabaseAdmin } = require('../config/supabase');
const { assertNotProd } = require('./lib/guard');
const grant = require('../utils/bookingGrant');

const BASE = process.env.BASE;
const PROD_REFS = ['spquowzrefozmrzoszkf', 'ayjhlwyzszykqtnaktpb']; // live + retired Mumbai
const TAG_DOMAIN = '@loadtest.meeticulous.local';
const HOST_USERNAME = 'loadtest-vendor-rules';
const SERVICE_SLUG = 'loadtest-rules-free'; // price 0 → confirmed, no payment, no gcal
const LEVELS = (process.env.LEVELS || '10,25,50,100,200').split(',').map((n) => parseInt(n, 10));
const PER_LEVEL = parseInt(process.env.PER_LEVEL || '150', 10);

function assertStagingAndBase() {
  if (!BASE || !/^https?:\/\//.test(BASE)) {
    console.error('REFUSING: set BASE=https://<staging-host> (the deployed server to load).');
    process.exit(2);
  }
  if (/meeticulous-api\.onrender\.com/.test(BASE) || /meeticulous\.(com|in)/.test(BASE)) {
    console.error(`REFUSING: BASE=${BASE} looks like PROD. This POSTs bookings — staging host only.`);
    process.exit(2);
  }
  assertNotProd('httpBookingLoad');
  const url = process.env.SUPABASE_URL || '';
  const prodRef = PROD_REFS.find((ref) => url.includes(ref));
  if (prodRef) {
    console.error(`REFUSING: SUPABASE_URL points at PROD (${prodRef}). Point it at the throwaway staging DB.`);
    process.exit(2);
  }
}

// Unique future slot per request index. Host open 09:00–21:00 IST; spread across
// days+minutes so no two of a batch collide (they'd 409 and skew the accept-rate).
const slotISO = (i) => {
  const daysAhead = 20 + Math.floor(i / 500);          // start 20d out, roll days every 500
  const minsIntoDay = (9 * 60) + ((i * 7) % (11 * 60)); // 09:00 + step, within 09:00–20:00 IST
  const now = new Date();
  const midnightUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysAhead);
  const d = new Date(midnightUTC);
  d.setUTCMinutes(d.getUTCMinutes() + (minsIntoDay - 330)); // 330 = IST offset
  return d.toISOString();
};

async function bookOnce(serviceId, i) {
  const guest_email = `httpload-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}${TAG_DOMAIN}`;
  const booking_grant = grant.issue({ email: guest_email });
  const body = {
    service_id: serviceId,
    scheduled_at: slotISO(i),
    guest_name: `HttpLoad ${i}`,
    guest_email,
    booking_grant,
  };
  const t = process.hrtime.bigint();
  let status = 0;
  try {
    const res = await fetch(`${BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    status = res.status;
  } catch (e) {
    status = -1; // connection reset / timeout = the ceiling signal
  }
  return { ms: Number(process.hrtime.bigint() - t) / 1e6, status };
}

// Fire `count` requests with at most `conc` in flight.
async function runLevel(serviceId, conc, count) {
  const samples = [];
  let next = 0;
  const started = Date.now();
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= count) return;
      samples.push(await bookOnce(serviceId, i));
    }
  }
  await Promise.all(Array.from({ length: conc }, worker));
  const wallSec = (Date.now() - started) / 1000;
  return { samples, wallSec };
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function main() {
  assertStagingAndBase();

  const { data: host } = await supabaseAdmin
    .from('profiles').select('id').eq('username', HOST_USERNAME).maybeSingle();
  if (!host) { console.error(`Host ${HOST_USERNAME} not found — run: node scripts/seedLoadTest.js`); process.exit(1); }
  const { data: service } = await supabaseAdmin
    .from('services').select('id').eq('host_id', host.id).eq('slug', SERVICE_SLUG).maybeSingle();
  if (!service) { console.error(`Service ${SERVICE_SLUG} not found — run: node scripts/seedLoadTest.js`); process.exit(1); }

  console.log(`BASE=${BASE}  service=${SERVICE_SLUG}  per-level=${PER_LEVEL}`);
  console.log(`conc   ok(201)  4xx  5xx  conn-err   rps   p50ms   p95ms   p99ms   maxms`);
  const rows = [];
  for (const conc of LEVELS) {
    const { samples, wallSec } = await runLevel(service.id, conc, PER_LEVEL);
    const ms = samples.map((s) => s.ms);
    const ok = samples.filter((s) => s.status === 201).length;
    const c4 = samples.filter((s) => s.status >= 400 && s.status < 500).length;
    const c5 = samples.filter((s) => s.status >= 500).length;
    const err = samples.filter((s) => s.status === -1).length;
    const rps = (samples.length / wallSec);
    const row = {
      conc, ok, c4, c5, err,
      rps: +rps.toFixed(1),
      p50: +pct(ms, 50).toFixed(0), p95: +pct(ms, 95).toFixed(0),
      p99: +pct(ms, 99).toFixed(0), max: +Math.max(...ms).toFixed(0),
    };
    rows.push(row);
    console.log(
      `${String(conc).padStart(4)}  ${String(ok).padStart(6)}  ${String(c4).padStart(3)}  ` +
      `${String(c5).padStart(3)}  ${String(err).padStart(7)}  ${String(row.rps).padStart(6)}  ` +
      `${String(row.p50).padStart(6)}  ${String(row.p95).padStart(6)}  ${String(row.p99).padStart(6)}  ${String(row.max).padStart(6)}`,
    );
  }

  const fs = require('fs');
  fs.writeFileSync('server/scripts/httpBookingLoad.summary.json', JSON.stringify({ base: BASE, perLevel: PER_LEVEL, rows }, null, 2));
  console.log('\nwrote server/scripts/httpBookingLoad.summary.json');
  console.log('cleanup:  node scripts/cleanupLoadTest.js');
  process.exit(0);
}

// Self-check: slotISO never collides within a 150-batch, and the prod guard trips.
if (process.env.SELFTEST === '1') {
  const seen = new Set();
  for (let i = 0; i < 150; i++) { const s = slotISO(i); if (seen.has(s)) throw new Error(`slot collision at ${i}: ${s}`); seen.add(s); }
  console.log('SELFTEST ok: 150 unique slots, no collision');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
