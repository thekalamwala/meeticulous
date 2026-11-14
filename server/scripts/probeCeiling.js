'use strict';

/**
 * probeCeiling.js — read-only concurrency SWEEP to find the Render free-tier knee.
 *
 * Steps through concurrency levels and reports a clean per-level table so we can
 * SEE where latency/errors start climbing (the knee), not just pass/fail. Hits
 * ipGuard-exempt paths only (server/middleware/ipGuard.js EXEMPT_PREFIXES:
 * /health, /api/blogs, /sitemap) so a single IP can't auto-ban itself. Straight
 * at the Render origin (bypasses Vercel) = bare instance ceiling, the number the
 * edge cache later protects. No DB, no auth, no writes.
 *
 * Run (bash):
 *   BASE=https://meeticulous-api.onrender.com node scripts/probeCeiling.js
 * Tunables: LEVELS="1,5,10,20,40,80,160,320"  PER_LEVEL=300  PATH=/health
 *
 * ponytail: worker-pool lifted from httpBookingLoad.js; same engine, read paths.
 */

const BASE = process.env.BASE || 'https://meeticulous-api.onrender.com';
const PATHS = (process.env.PATHS || '/health,/api/blogs').split(',');
const LEVELS = (process.env.LEVELS || '1,5,10,20,40,80,160,320').split(',').map((n) => parseInt(n, 10));
const LEVEL_MS = parseInt(process.env.LEVEL_MS || '12000', 10); // wall-time per level

async function hit(path) {
  const t = process.hrtime.bigint();
  let status = 0;
  try {
    const res = await fetch(`${BASE}${path}`, { headers: { 'accept-encoding': 'gzip' } });
    status = res.status;
    await res.arrayBuffer(); // drain body so timing includes full transfer
  } catch { status = -1; }
  return { ms: Number(process.hrtime.bigint() - t) / 1e6, status };
}

async function runLevel(path, conc, durationMs) {
  const samples = [];
  const started = Date.now();
  const deadline = started + durationMs;
  const worker = async () => {
    while (Date.now() < deadline) samples.push(await hit(path));
  };
  await Promise.all(Array.from({ length: conc }, worker));
  return { samples, wallSec: (Date.now() - started) / 1000 };
}

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};

async function main() {
  console.log(`BASE=${BASE}  level-ms=${LEVEL_MS}`);
  const out = { base: BASE, levelMs: LEVEL_MS, paths: {} };
  for (const path of PATHS) {
    console.log(`\n=== ${path} ===`);
    console.log('conc   ok   non200  conn-err   rps    p50    p95    p99    max');
    out.paths[path] = [];
    for (const conc of LEVELS) {
      const { samples, wallSec } = await runLevel(path, conc, LEVEL_MS);
      const ms = samples.map((s) => s.ms);
      const ok = samples.filter((s) => s.status === 200).length;
      const non200 = samples.filter((s) => s.status > 0 && s.status !== 200).length;
      const err = samples.filter((s) => s.status === -1).length;
      const row = {
        conc, ok, non200, err,
        rps: +(samples.length / wallSec).toFixed(1),
        p50: +pct(ms, 50).toFixed(0), p95: +pct(ms, 95).toFixed(0),
        p99: +pct(ms, 99).toFixed(0), max: +Math.max(...ms).toFixed(0),
      };
      out.paths[path].push(row);
      console.log(
        `${String(conc).padStart(4)} ${String(ok).padStart(4)} ${String(non200).padStart(7)} ` +
        `${String(err).padStart(9)} ${String(row.rps).padStart(6)} ${String(row.p50).padStart(6)} ` +
        `${String(row.p95).padStart(6)} ${String(row.p99).padStart(6)} ${String(row.max).padStart(6)}`,
      );
    }
  }
  require('fs').writeFileSync('server/scripts/probeCeiling.summary.json', JSON.stringify(out, null, 2));
  console.log('\nwrote server/scripts/probeCeiling.summary.json');
}

main().catch((e) => { console.error(e); process.exit(1); });
