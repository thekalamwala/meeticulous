#!/usr/bin/env node
/**
 * use-env.js — flip your LOCAL machine between the staging and production
 * databases by copying the right credential file into the active `.env`.
 *
 *   node scripts/use-env.js staging      # point laptop at STAGING (default daily driver)
 *   node scripts/use-env.js production    # point laptop at PROD (rare; read warning)
 *   node scripts/use-env.js              # prints which env is active right now
 *
 * It copies, for both server/ and client/:
 *   .env.<target>  ->  .env
 *
 * The .env.staging / .env.production files hold real secrets and are gitignored.
 * Only this script is committed. Nothing here ever touches Render/Vercel — those
 * hold their own env vars in their dashboards; this is purely your laptop.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIRS = ['server', 'client'];
const VALID = ['staging', 'production'];

const C = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

function readActiveUrl(dir) {
  const p = path.join(ROOT, dir, '.env');
  if (!fs.existsSync(p)) return null;
  const txt = fs.readFileSync(p, 'utf8');
  const m = txt.match(/^(?:VITE_)?SUPABASE_URL=(.+)$/m);
  return m ? m[1].trim() : null;
}

function status() {
  console.log(C.bold('\nActive local environment:'));
  for (const dir of DIRS) {
    const url = readActiveUrl(dir);
    console.log(`  ${dir.padEnd(7)} ${url ? C.green(url) : C.dim('(no .env)')}`);
  }
  console.log(C.dim(`\nSwitch with: node scripts/use-env.js <staging|production>\n`));
}

function fail(msg) {
  console.error(C.red('\n✗ ' + msg + '\n'));
  process.exit(1);
}

function main() {
  const target = process.argv[2];

  if (!target) return status();

  if (!VALID.includes(target)) {
    fail(`Unknown target "${target}". Use one of: ${VALID.join(', ')}`);
  }

  // Pre-flight: every source file must exist before we overwrite anything.
  const jobs = DIRS.map((dir) => ({
    dir,
    src: path.join(ROOT, dir, `.env.${target}`),
    dest: path.join(ROOT, dir, '.env'),
  }));

  for (const { dir, src } of jobs) {
    if (!fs.existsSync(src)) {
      fail(`Missing ${dir}/.env.${target}. Create it (copy .env.example or the other env) and fill its credentials first.`);
    }
  }

  // Guard: refuse to activate a file that still has REPLACE_ME placeholders.
  for (const { dir, src } of jobs) {
    const txt = fs.readFileSync(src, 'utf8');
    if (/REPLACE_ME/.test(txt)) {
      fail(`${dir}/.env.${target} still has REPLACE_ME placeholders. Fill in the real ${target} values, then re-run.`);
    }
  }

  if (target === 'production') {
    console.log(C.red(C.bold('\n⚠  Pointing your LAPTOP at the PRODUCTION database.')));
    console.log(C.yellow('   Local test bookings, payments, and reseeds will hit REAL customer data.'));
    console.log(C.yellow('   Switch back with: node scripts/use-env.js staging\n'));
  }

  for (const { dir, src, dest } of jobs) {
    fs.copyFileSync(src, dest);
    console.log(C.green(`✓ ${dir}/.env  ←  .env.${target}`));
  }

  console.log(C.bold(`\nNow active → ${target.toUpperCase()}`));
  status();
}

main();
