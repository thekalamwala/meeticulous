#!/usr/bin/env node
'use strict';
/**
 * Perf SLA gate. Reads a JMeter HTML-report statistics.json (produced by the
 * `-e -o` run that run.js does) and checks the Total row against SLA thresholds.
 * Exit 0 = pass, 1 = fail (so CI can gate on it).
 *
 *   node scripts/parse-jtl.js [path/to/statistics.json]   # gate latest if omitted
 *   node scripts/parse-jtl.js --save-baseline             # save current as baseline
 *
 * Thresholds (override via env):
 *   PERF_P95_MAX_MS=500   PERF_ERR_MAX_PCT=1   PERF_TPUT_DROP_MAX_PCT=20
 */
const fs = require('fs');
const path = require('path');

const REPORTS = path.resolve(__dirname, '..', 'jmeter', 'reports');
const BASELINE = path.resolve(__dirname, '..', 'jmeter', 'baseline.json');
const P95_MAX = Number(process.env.PERF_P95_MAX_MS || 500);
const ERR_MAX = Number(process.env.PERF_ERR_MAX_PCT || 1);
const TPUT_DROP_MAX = Number(process.env.PERF_TPUT_DROP_MAX_PCT || 20);

const args = process.argv.slice(2);
const saveBaseline = args.includes('--save-baseline');
const explicit = args.find((a) => !a.startsWith('--'));

function latestStats() {
  if (explicit) return explicit;
  if (!fs.existsSync(REPORTS)) return null;
  const found = fs.readdirSync(REPORTS)
    .map((d) => path.join(REPORTS, d, 'statistics.json'))
    .filter((f) => fs.existsSync(f))
    .sort();
  return found.pop() || null;
}

const file = latestStats();
if (!file) { console.error('No statistics.json found. Run a test first (e.g. npm run perf:smoke).'); process.exit(1); }

const stats = JSON.parse(fs.readFileSync(file, 'utf8'));
const t = stats.Total;
if (!t) { console.error(`No "Total" row in ${file}`); process.exit(1); }

const p95 = t.pct2ResTime;
const p99 = t.pct3ResTime;
const errPct = t.errorPct;
const tput = t.throughput;

if (saveBaseline) {
  fs.writeFileSync(BASELINE, JSON.stringify({ throughput: tput, p95, errPct, savedFrom: path.basename(path.dirname(file)) }, null, 2));
  console.log(`Saved baseline: throughput=${tput.toFixed(1)}/s p95=${p95.toFixed(0)}ms (${path.basename(BASELINE)})`);
  process.exit(0);
}

let tputDrop = null;
if (fs.existsSync(BASELINE)) {
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  if (base.throughput) tputDrop = ((base.throughput - tput) / base.throughput) * 100;
}

const fails = [];
if (p95 > P95_MAX) fails.push(`P95 ${p95.toFixed(0)}ms > ${P95_MAX}ms`);
if (errPct > ERR_MAX) fails.push(`error ${errPct.toFixed(2)}% > ${ERR_MAX}%`);
if (tputDrop != null && tputDrop > TPUT_DROP_MAX) fails.push(`throughput drop ${tputDrop.toFixed(1)}% > ${TPUT_DROP_MAX}%`);

console.log(`Perf gate — ${path.basename(path.dirname(file))}`);
console.log(`  samples=${t.sampleCount} errors=${errPct.toFixed(2)}% p95=${p95.toFixed(0)}ms p99=${(p99 || 0).toFixed(0)}ms throughput=${tput.toFixed(1)}/s` + (tputDrop != null ? ` (Δ ${tputDrop.toFixed(1)}% vs baseline)` : ' (no baseline)'));

if (fails.length) { console.error('FAIL: ' + fails.join('; ')); process.exit(1); }
console.log('PASS');
