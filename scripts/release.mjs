#!/usr/bin/env node
/**
 * release.mjs — tag a production release so rollback is never a guess.
 *
 * A tag is a permanent, named bookmark of an exact commit. "Roll back to the
 * last good version" becomes `git checkout v1.2.0` instead of hunting through
 * history. Run this right AFTER a deploy to prod is verified healthy.
 *
 * Usage:
 *   node scripts/release.mjs                 # show recent releases + next-version hint
 *   node scripts/release.mjs v1.2.0          # tag current main as v1.2.0 and push
 *   node scripts/release.mjs v1.2.0 "note"   # ...with a custom annotation message
 *
 * Guards: refuses unless you are on `main` with a clean working tree, and
 * refuses to reuse an existing tag. Pure git — no dependencies.
 */
import { execSync } from 'node:child_process';

const sh = (cmd) => execSync(cmd, { encoding: 'utf8' }).trim();
const tryS = (cmd) => { try { return sh(cmd); } catch { return ''; } };
const die = (msg) => { console.error(`\n✖ ${msg}\n`); process.exit(1); };

const [, , versionArg, messageArg] = process.argv;

// Recent releases, newest first.
const recent = tryS('git tag --sort=-v:refname --list "v*"').split('\n').filter(Boolean);

if (!versionArg) {
  console.log('\nRecent releases:');
  console.log(recent.length ? recent.slice(0, 10).map((t) => '  ' + t).join('\n') : '  (none yet)');
  const latest = recent[0];
  if (latest) {
    const m = latest.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    if (m) {
      const [maj, min, pat] = m.slice(1).map(Number);
      console.log(`\nNext version ideas:`);
      console.log(`  bugfix  → node scripts/release.mjs v${maj}.${min}.${pat + 1}`);
      console.log(`  feature → node scripts/release.mjs v${maj}.${min + 1}.0`);
    }
  } else {
    console.log('\nFirst release → node scripts/release.mjs v1.0.0');
  }
  console.log('');
  process.exit(0);
}

// ── Validate the version string (semver vX.Y.Z) ──
if (!/^v\d+\.\d+\.\d+$/.test(versionArg)) {
  die(`"${versionArg}" is not a valid version. Use vMAJOR.MINOR.PATCH, e.g. v1.2.0`);
}
if (recent.includes(versionArg)) {
  die(`Tag ${versionArg} already exists. Pick a new number (you have: ${recent[0]}).`);
}

// ── Safety guards: on main, clean tree, in sync with remote ──
const branch = sh('git rev-parse --abbrev-ref HEAD');
if (branch !== 'main') {
  die(`You are on "${branch}". Release tags must point at production code — switch to main:\n    git checkout main && git pull`);
}
if (sh('git status --porcelain')) {
  die('Working tree is dirty. Commit or stash changes before tagging a release.');
}
// Warn (don't block) if local main is behind/ahead of origin.
tryS('git fetch --quiet origin main');
const ahead = tryS('git rev-list --count origin/main..HEAD');
const behind = tryS('git rev-list --count HEAD..origin/main');
if (behind && behind !== '0') {
  die(`Local main is ${behind} commit(s) behind origin/main. Run "git pull" so you tag what's actually deployed.`);
}
if (ahead && ahead !== '0') {
  console.warn(`⚠  Local main is ${ahead} commit(s) ahead of origin/main — those aren't deployed yet. Push first if you mean to tag them.`);
}

const commit = sh('git rev-parse --short HEAD');
const message = messageArg || `release ${versionArg}`;

console.log(`\nTagging ${versionArg} → commit ${commit} on main`);
sh(`git tag -a ${versionArg} -m "${message.replace(/"/g, '\\"')}"`);
sh(`git push origin ${versionArg}`);
console.log(`\n✔ Released ${versionArg}. Roll back anytime with:  git checkout ${versionArg}\n`);
