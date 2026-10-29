#!/usr/bin/env node
'use strict';
/**
 * Cross-platform JMeter runner.
 *   node scripts/run.js <env> <scenario> [plan]   # run a plan
 *   node scripts/run.js report [path-to.jtl]       # regenerate HTML from a .jtl
 *
 * env       : local | staging          (selects config/<env>.properties)
 * scenario  : smoke | normal | launch | spike
 * plan      : test-plan name (default slots-readonly), with or without .jmx
 *
 * Tooling is resolved from $JMETER_HOME/$JAVA_HOME, else from ~/perf-tools
 * (see performance/README.md). Launches `java -jar ApacheJMeter.jar` directly.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const JMETER_DIR = path.resolve(__dirname, '..', 'jmeter');
const DATA_DIR = path.join(JMETER_DIR, 'data');
const PLANS_DIR = path.join(JMETER_DIR, 'test-plans');
const CONFIG_DIR = path.join(JMETER_DIR, 'config');
const RESULTS_DIR = path.join(JMETER_DIR, 'results');
const REPORTS_DIR = path.join(JMETER_DIR, 'reports');

// Progressive load ladder (Phase 4). Legacy aliases smoke/normal/launch/spike kept
// for back-compat with package.json scripts + CI. Numeric keys map to the task stages.
const SCENARIOS = {
  smoke: { threads: 10, rampup: 30, duration: 60 },     // stage 1
  s10: { threads: 10, rampup: 30, duration: 60 },       // stage 1
  s50: { threads: 50, rampup: 60, duration: 120 },      // stage 2
  normal: { threads: 100, rampup: 300, duration: 300 }, // stage 3
  s100: { threads: 100, rampup: 300, duration: 300 },   // stage 3
  s250: { threads: 250, rampup: 300, duration: 300 },   // stage 4
  launch: { threads: 500, rampup: 1200, duration: 600 },// stage 5
  s500: { threads: 500, rampup: 90, duration: 150 },   // stage 5
  spike: { threads: 1000, rampup: 300, duration: 300 }, // stage 6
  s1000: { threads: 1000, rampup: 300, duration: 300 }, // stage 6
  s2500: { threads: 2500, rampup: 600, duration: 300 }, // stage 7
  s5000: { threads: 5000, rampup: 600, duration: 300 }, // stage 8
  s10000: { threads: 10000, rampup: 600, duration: 300 },// stage 9
};

// Max concurrency the LOCAL server may be scale-tested at. The local server connects
// to the PRODUCTION Supabase project, so anything above this would load-test the live
// customer DB. Larger stages require a dedicated test environment. See LOAD_TEST_BLOCKERS.md.
const SAFE_MAX_THREADS_LOCAL = 250;

function findVersioned(base, prefix) {
  try { const hit = fs.readdirSync(base).find((d) => d.startsWith(prefix)); return hit ? path.join(base, hit) : null; }
  catch { return null; }
}

function resolveTools() {
  const root = path.join(os.homedir(), 'perf-tools');
  const javaHome = process.env.JAVA_HOME || findVersioned(path.join(root, 'jdk'), 'jdk-');
  const jmeterHome = process.env.JMETER_HOME || findVersioned(path.join(root, 'jmeter'), 'apache-jmeter-');
  if (!javaHome || !jmeterHome) {
    console.error('Cannot locate JAVA_HOME / JMETER_HOME. Set them or install per performance/README.md (~/perf-tools).');
    process.exit(1);
  }
  return { javaHome, jmeterHome };
}

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

function launch(jmeterArgs) {
  const { javaHome, jmeterHome } = resolveTools();
  const java = path.join(javaHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  const jar = path.join(jmeterHome, 'bin', 'ApacheJMeter.jar');
  const env = { ...process.env, JAVA_HOME: javaHome };
  const r = spawnSync(java, ['-Xmx1g', '-jar', jar, ...jmeterArgs], { stdio: 'inherit', env, cwd: JMETER_DIR });
  process.exit(r.status == null ? 1 : r.status);
}

const argv = process.argv.slice(2);

if (argv[0] === 'report') {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  let jtl = argv[1];
  if (!jtl) {
    const jtls = fs.existsSync(RESULTS_DIR)
      ? fs.readdirSync(RESULTS_DIR).filter((f) => f.endsWith('.jtl')).map((f) => path.join(RESULTS_DIR, f)).sort()
      : [];
    jtl = jtls.pop();
  }
  if (!jtl) { console.error('No .jtl found in results/.'); process.exit(1); }
  launch(['-g', jtl, '-o', path.join(REPORTS_DIR, 'report-' + stamp())]);
}

const [envName = 'local', scenarioName = 'smoke', plan = 'slots-readonly'] = argv;
const sc = SCENARIOS[scenarioName];
if (!sc) { console.error(`Unknown scenario "${scenarioName}". One of: ${Object.keys(SCENARIOS).join(', ')}`); process.exit(1); }

// Phase 1 safety gate: refuse large-scale runs that would hit the production Supabase
// project. The local server is wired to the live DB, so it is hard-capped. Other targets
// must explicitly acknowledge they are pointed at an ISOLATED test environment.
if (argv[0] !== 'report' && sc.threads > SAFE_MAX_THREADS_LOCAL) {
  if (envName === 'local') {
    console.error(
      `\nBLOCKED: "${scenarioName}" = ${sc.threads} threads on env=local.\n` +
      `The local server connects to the PRODUCTION Supabase project, so a run this large\n` +
      `would load-test the live customer database. Safe local ceiling is ${SAFE_MAX_THREADS_LOCAL} threads.\n` +
      `Stand up a separate Supabase project + staging server, set config/staging.properties,\n` +
      `and re-run with env=staging. See LOAD_TEST_BLOCKERS.md.\n`);
    process.exit(2);
  }
  if (process.env.PERF_ALLOW_LARGE_RUN !== '1') {
    console.error(
      `\nBLOCKED: "${scenarioName}" = ${sc.threads} threads requires explicit acknowledgement.\n` +
      `Confirm the target is an ISOLATED test environment (NOT production data), then re-run\n` +
      `with PERF_ALLOW_LARGE_RUN=1. See LOAD_TEST_BLOCKERS.md.\n`);
    process.exit(2);
  }
}
const planFile = path.join(PLANS_DIR, plan.endsWith('.jmx') ? plan : `${plan}.jmx`);
if (!fs.existsSync(planFile)) { console.error(`No plan at ${planFile}`); process.exit(1); }

fs.mkdirSync(RESULTS_DIR, { recursive: true });
fs.mkdirSync(REPORTS_DIR, { recursive: true });
const tag = `${plan}-${scenarioName}-${stamp()}`;

launch([
  '-n', '-t', planFile,
  '-q', path.join(CONFIG_DIR, 'base.properties'),
  '-q', path.join(CONFIG_DIR, `${envName}.properties`),
  '-Jthreads=' + sc.threads, '-Jrampup=' + sc.rampup, '-Jduration=' + sc.duration,
  '-Jdata.dir=' + DATA_DIR,
  '-Jvendortoken=' + (process.env.VENDOR_TOKEN || ''),
  '-l', path.join(RESULTS_DIR, `${tag}.jtl`),
  '-e', '-o', path.join(REPORTS_DIR, tag),
]);
