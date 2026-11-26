#!/usr/bin/env node
// Delete old Vercel deployments so the Hobby plan's 10 GB Deployment Storage
// cap is never reached. Vercel keeps every deployment forever; each production
// build of this client stores ~50 MB of prerendered output, so unattended the
// project fills 10 GB in roughly three months and Vercel PAUSES it — which
// takes meeticulous.com down until someone notices.
//
// Run from the deploy workflow (see .github/workflows/deploy-vercel.yml) or by
// hand:
//   node scripts/pruneVercelDeployments.mjs --self-check  # offline logic check
//   node scripts/pruneVercelDeployments.mjs --dry-run     # list, delete nothing
//   node scripts/pruneVercelDeployments.mjs
//
// Env: VERCEL_TOKEN (falls back to server/.env for local runs), VERCEL_ORG_ID,
// VERCEL_PROJECT_ID, VERCEL_PRUNE_KEEP (default 5), PROD_ALIAS (default
// meeticulous.com).

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');

function localToken() {
  // Convenience for running this by hand; in CI the secret is already in env.
  try {
    const env = readFileSync(join(repoRoot, 'server/.env'), 'utf8');
    return env.match(/^VERCEL_TOKEN=(.+)$/m)?.[1].trim().replace(/^["']|["']$/g, '');
  } catch {
    return undefined;
  }
}

// Which deployments may be deleted: everything past the newest `keep`, minus
// whatever is serving production. Pure, so --self-check can prove it offline.
export function selectStale(deployments, keep, live) {
  const id = (d) => d.uid || d.id;
  return [...deployments]
    .sort((a, b) => b.created - a.created)
    .slice(keep)
    .filter((d) => id(d) !== live);
}

if (process.argv.includes('--self-check')) {
  const { strict: assert } = await import('node:assert');
  const d = (uid, created) => ({ uid, created });
  const all = [d('a', 5), d('b', 4), d('c', 3), d('d', 2), d('e', 1)];
  const ids = (xs) => xs.map((x) => x.uid);

  // Newest `keep` are retained, the rest are stale.
  assert.deepEqual(ids(selectStale(all, 2, 'a')), ['c', 'd', 'e']);
  // Unsorted input still sorts newest-first before slicing.
  assert.deepEqual(ids(selectStale([all[3], all[0], all[2], all[1], all[4]], 2, 'a')), ['c', 'd', 'e']);
  // THE important one: a live deployment that has aged out of the keep window
  // is still never deleted.
  assert.deepEqual(ids(selectStale(all, 2, 'd')), ['c', 'e']);
  // keep >= total deletes nothing.
  assert.deepEqual(selectStale(all, 5, 'a'), []);
  assert.deepEqual(selectStale(all, 9, 'a'), []);
  // Deployments listed under `id` rather than `uid` are handled too.
  assert.deepEqual(
    selectStale([{ id: 'x', created: 2 }, { id: 'y', created: 1 }], 1, 'y').map((o) => o.id),
    [],
  );
  console.log('self-check OK');
  process.exit(0);
}

const TOKEN = process.env.VERCEL_TOKEN || localToken();
const ORG = process.env.VERCEL_ORG_ID || 'team_uxnH0xiRg1CUjgcNL1rxf0MJ';
const PROJECT = process.env.VERCEL_PROJECT_ID || 'prj_G0HSyvMvRWt7doXpU7MRImSLgY5u';
const KEEP = Number(process.env.VERCEL_PRUNE_KEEP || 5);
const ALIAS = process.env.PROD_ALIAS || 'meeticulous.com';

if (!TOKEN) {
  console.error('VERCEL_TOKEN missing; nothing pruned.');
  process.exit(1);
}
if (!Number.isInteger(KEEP) || KEEP < 1) {
  console.error(`VERCEL_PRUNE_KEEP must be a positive integer, got ${process.env.VERCEL_PRUNE_KEEP}`);
  process.exit(1);
}

const api = (path, init) =>
  fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${TOKEN}` },
  });

async function json(path) {
  const res = await api(path);
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

async function main() {
  // The deployment behind the production alias is never deleted, even if it has
  // aged out of the newest-KEEP window. Without a confirmed id we fail closed and
  // delete nothing rather than risk taking production down.
  let live;
  try {
    live = (await json(`/v4/aliases/${ALIAS}?teamId=${ORG}`)).deploymentId;
  } catch (err) {
    console.error(`Alias lookup failed: ${err.message}`);
  }
  if (!live) {
    console.error(`Could not resolve the deployment behind ${ALIAS}; skipping prune.`);
    return;
  }

  const { deployments } = await json(
    `/v6/deployments?teamId=${ORG}&projectId=${PROJECT}&limit=100`,
  );
  const id = (d) => d.uid || d.id;
  const stale = selectStale(deployments, KEEP, live);

  console.log(`live=${live} total=${deployments.length} keep=${KEEP} stale=${stale.length}`);
  if (dryRun) {
    for (const d of stale) console.log(`  would delete ${id(d)}  ${new Date(d.created).toISOString()}`);
    return;
  }

  let failed = 0;
  for (const d of stale) {
    const res = await api(`/v13/deployments/${id(d)}?teamId=${ORG}`, { method: 'DELETE' });
    if (!res.ok) failed += 1;
    console.log(`  ${res.ok ? 'deleted' : `FAILED ${res.status}`} ${id(d)}`);
  }
  console.log(`pruned ${stale.length - failed}/${stale.length}`);
  // Surface partial failures; the workflow step is continue-on-error, so this
  // marks the log without ever failing the deploy.
  if (failed) process.exitCode = 1;
}

await main();
