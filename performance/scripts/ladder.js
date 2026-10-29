#!/usr/bin/env node
'use strict';
/**
 * Progressive load ladder (Phase 4). Runs the stages in order; after each stage it
 * gates the result with parse-jtl.js and STOPS on the first SLA breach (error% or
 * P95 over threshold) OR when run.js refuses a stage (e.g. the local >250 safety cap).
 * This is the "do not jump straight to 10,000 users" guard rail in script form.
 *
 *   node scripts/ladder.js <env> [plan] [maxStage]
 *   env      : local | staging
 *   plan     : test-plan name (default slots-readonly)
 *   maxStage : optional cap, e.g. s1000 (default runs through s10000)
 *
 * SLA thresholds come from parse-jtl.js env vars: PERF_P95_MAX_MS (def 500),
 * PERF_ERR_MAX_PCT (def 1). Large stages on a non-local target require
 * PERF_ALLOW_LARGE_RUN=1 (see run.js / LOAD_TEST_BLOCKERS.md).
 */
const { spawnSync } = require('child_process');
const path = require('path');

const STAGES = ['s10', 's50', 's100', 's250', 's500', 's1000', 's2500', 's5000', 's10000'];
const [env = 'local', plan = 'slots-readonly', maxStage] = process.argv.slice(2);

if (maxStage && !STAGES.includes(maxStage)) {
  console.error(`Unknown maxStage "${maxStage}". One of: ${STAGES.join(', ')}`);
  process.exit(1);
}
const stages = maxStage ? STAGES.slice(0, STAGES.indexOf(maxStage) + 1) : STAGES;

const RUN = path.join(__dirname, 'run.js');
const GATE = path.join(__dirname, 'parse-jtl.js');
const node = process.execPath;
const sh = (args) => spawnSync(node, args, { stdio: 'inherit' });

const summary = [];
for (const stage of stages) {
  console.log(`\n========== STAGE ${stage}  (plan=${plan} env=${env}) ==========`);
  const run = sh([RUN, env, stage, plan]);
  if (run.status !== 0) {
    console.error(
      `\nLADDER STOP at ${stage}: stage did not run (exit ${run.status}).\n` +
      `Likely the safety cap (env=local is capped at 250 threads) or a run error.\n` +
      `For larger stages stand up staging and re-run: node scripts/ladder.js staging ${plan}\n` +
      `See LOAD_TEST_BLOCKERS.md / STAGING_SETUP.md.`);
    summary.push(`${stage}: NOT RUN (exit ${run.status})`);
    break;
  }
  const gate = sh([GATE]);
  if (gate.status !== 0) {
    console.error(`\nLADDER STOP at ${stage}: SLA breached (see gate output above). Do not proceed to the next stage.`);
    summary.push(`${stage}: SLA FAIL — stop here`);
    break;
  }
  summary.push(`${stage}: PASS`);
}

console.log('\n========== LADDER SUMMARY ==========');
summary.forEach((s) => console.log('  ' + s));
console.log('HTML reports: performance/jmeter/reports/.  Record each stage in BENCHMARK_REPORT.md.');
