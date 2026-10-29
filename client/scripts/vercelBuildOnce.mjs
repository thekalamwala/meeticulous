/**
 * vercelBuildOnce.mjs — run the real vercel-build pipeline exactly once per commit.
 *
 * Vercel invokes `npm run vercel-build` TWICE per deploy in the same build
 * container (verified in the build logs of dpl_BmV6EfVQ5hc2i7XHWnxaxPxPxo8h and
 * the deploy before it: two `Running "npm run vercel-build"` echoes, two full
 * vitest+vite+prerender cycles, ~4m45s each — every deploy paid double). No
 * build/install command overrides exist and there is no api/ folder; the extra
 * pass appears to come from the Edge Middleware (middleware.js) build.
 *
 * Guard: after a successful pipeline run, stamp dist/.vercel-build-stamp with
 * the commit SHA. A re-invocation in the same container finds the stamp
 * matching and exits 0 immediately.
 *
 * Why the stamp CANNOT leak into a later deploy and skip a real build:
 *   - It lives in dist/, which Vercel's cross-deploy build cache does not
 *     restore (only node_modules + framework caches come back).
 *   - It is keyed to VERCEL_GIT_COMMIT_SHA anyway, so a new commit never
 *     matches a stale stamp.
 * Off Vercel there is no VERCEL_GIT_COMMIT_SHA, so the guard never engages and
 * local runs always build.
 */
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const STAMP = join(DIST, '.vercel-build-stamp');
// Prod deploys come from `vercel deploy` in GitHub Actions (CLI), where the git
// SHA may not be exposed — without a key the guard never engages and the full
// prerender runs twice against the 45-min build limit. The deployment id is
// unique per deploy, so it is an equally safe key. GITHUB_SHA covers a
// `vercel build` run inside GitHub Actions (prebuilt deploys).
const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || process.env.GITHUB_SHA || '';

if (sha) {
  let prev = '';
  try {
    prev = readFileSync(STAMP, 'utf-8').trim();
  } catch {
    // no stamp — first run
  }
  if (prev === sha) {
    console.log(`[vercel-build] already built for ${sha.slice(0, 7)} in this container — skipping duplicate run`);
    process.exit(0);
  }
}

// Client unit tests are the CI `client` job's responsibility now (runs `vitest
// run` on every PR that touches client/** — see .github/workflows/ci.yml), so we
// no longer re-run them here. The deploy just builds + prerenders. Merges to main
// come from PRs that already passed that gate, so this doesn't ship untested code.
execSync('npm run build', { stdio: 'inherit', shell: true });

if (sha) {
  mkdirSync(DIST, { recursive: true });
  writeFileSync(STAMP, sha, 'utf-8');
}
