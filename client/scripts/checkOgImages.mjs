/**
 * checkOgImages.mjs — verify every OG card a page references actually exists.
 *
 * The recurring failure this guards: a page ships `og:image` pointing at a CDN
 * file nobody uploaded, so WhatsApp/LinkedIn/Facebook show a broken card — and
 * because humans never see OG tags, it stays broken for weeks. Code claims the
 * card exists; only a real request proves it.
 *
 * Collects every URL `ogCard()` can produce (from the config's naming) for the
 * known page set, plus the per-profession /for/ cards, and HEADs each. Any
 * non-200 is a hard failure.
 *
 * Run manually after uploading cards, before merging the wiring:
 *   node scripts/checkOgImages.mjs
 *
 * Deliberately NOT wired into `npm run build`: it depends on the network and an
 * external host, and a CDN blip must not fail a production deploy. This is a
 * pre-flight you run, not a build gate.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, '..', 'src');

const OG_BASE = 'https://company-assets.bookasloth.in/images/seo';
const card = (name, ext = 'jpg') => `${OG_BASE}/${name}-og-1200x630.${ext}`;

// The static marketing pages, by the ogCard() name each one wires in. Kept here
// as the source of truth for what must exist — if you wire a new page, add it.
const STATIC_NAMES = [
  'home',
  'pricing', 'enterprise', 'about', 'help', 'contact', 'support',
  'blog-index', 'careers', 'changelog', 'privacy', 'terms', 'refund',
  'services', 'explore',
  'lp-calendly-alternative', 'lp-topmate-vs-bookasloth', 'lp-setmore-alternative',
  'lp-acuity-alternative', 'lp-simplybook-alternative', 'lp-zoho-bookings-alternative',
];

// Cards uploaded as PNG (the convention is JPG; these pages pass ext='png' to
// ogCard). Keep in sync with the ogCard(..., 'png') call sites.
const PNG_NAMES = [
  'how-it-works', 'be-a-sloth', 'earnings-calculator', 'invite',
  'inaugurators', 'opening',
];

// /features/:slug — one card per feature. Read the slugs so this never drifts
// from the actual feature list.
function featureNames() {
  const src = readFileSync(join(SRC, 'pages', 'features', 'featureData.js'), 'utf8');
  return [...src.matchAll(/slug:\s*['"]([a-z0-9-]+)['"]/g)].map((m) => `features-${m[1]}`);
}

// /for/:profession — the URLs are spelled out in the data file. Pull them as-is
// so a rename there is caught here rather than shipping a dead card.
function forUrls() {
  const src = readFileSync(join(SRC, 'pages', 'for', 'professionLandingData.js'), 'utf8');
  return [...src.matchAll(/https:\/\/[^\s'"]+-og-1200x630\.jpg/g)].map((m) => m[0]);
}

const urls = [
  ...STATIC_NAMES.map((n) => card(n)),
  ...PNG_NAMES.map((n) => card(n, 'png')),
  ...featureNames().map((n) => card(n)),
  ...forUrls(),
];

const seen = new Set();
const unique = urls.filter((u) => (seen.has(u) ? false : seen.add(u)));

console.log(`[og-check] ${unique.length} unique cards to verify\n`);

let bad = 0;
await Promise.all(
  unique.map(async (url) => {
    // Own the timer so it is always cleared — AbortSignal.timeout leaves a live
    // handle that trips a libuv assertion on process exit (Windows/node).
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 15000);
    try {
      const res = await fetch(url, { method: 'HEAD', signal: ac.signal });
      if (res.ok) {
        console.log(`  ok    ${url}`);
      } else {
        bad++;
        console.error(`  ${res.status}   ${url}`);
      }
    } catch (err) {
      bad++;
      console.error(`  ERR   ${url} — ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }),
);

console.log(`\n[og-check] ${unique.length - bad}/${unique.length} present`);
if (bad > 0) {
  console.error(`[og-check] FAILED: ${bad} card(s) missing — upload them before shipping.`);
  // exitCode, not exit(): force-exiting while keep-alive sockets are open trips a
  // libuv assertion on Windows. Let node drain and exit non-zero on its own.
  process.exitCode = 1;
} else {
  console.log('[og-check] all cards present.');
}
