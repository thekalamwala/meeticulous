/**
 * ensureChrome.mjs — make sure `npm run build` has a Chrome the prerender can use.
 *
 * puppeteer downloads Chrome in a postinstall hook, but that hook does not re-run
 * when node_modules is restored from a cache — so a build could reach the
 * prerender with no browser and fail with "Could not find Chrome".
 *
 * On Vercel this is skipped: that image cannot run a downloaded Chrome at all
 * (no libnspr4 et al), so prerender.mjs uses @sparticuz/chromium there instead.
 * Downloading ~150MB of unusable binary on every deploy would be pure waste.
 */
import { execSync } from 'child_process';

if (process.env.VERCEL) {
  console.log('[chrome] Vercel build — skipping download; prerender uses @sparticuz/chromium');
  process.exit(0);
}

// Idempotent: prints the existing path and exits when Chrome is already cached.
execSync('npx puppeteer browsers install chrome', { stdio: 'inherit' });
