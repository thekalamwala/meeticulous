/**
 * generateBlogOgImages.mjs — render each post's icon thumbnail as a social card.
 *
 * Without this every post shares /og-image.png, so 34 different articles produce
 * one identical preview in WhatsApp, LinkedIn and Slack.
 *
 * The card is a screenshot of the post's REAL BlogHeroThumbnail, served by the
 * /og/blog/:slug route at exactly 1200x630. That route renders the same React
 * component the site does, so a card can never drift from the site's art — change
 * the icons or the palette and the next run follows. An earlier version drew its
 * own title card in the script; it looked nothing like the blog.
 *
 * Writes to blogs.og_image, NEVER blogs.image. `image` is the on-page hero and
 * setting it suppresses the icon thumbnail on both the post page and the index —
 * which is exactly the regression that produced this column (v3.82).
 *
 * Needs the built site served locally, because it screenshots a real route:
 *   cd client
 *   npm run build:no-prerender          # dist/ must exist
 *   node --env-file=../server/.env.production scripts/generateBlogOgImages.mjs   # prod
 *   node --env-file=../server/.env scripts/generateBlogOgImages.mjs              # staging
 *
 * The dist is environment-agnostic here: post data is read from the DB by this
 * script and handed to the route as query params, so VITE_API_URL is irrelevant
 * and no API call happens during rendering. Only SUPABASE_* decides which
 * environment is written to.
 *
 * --only=<slug>  one post   --dry  write PNGs to scripts/.og-preview/, upload nothing
 */
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

const W = 1200;
const H = 630;
const PORT = 4174; // not 4173 — prerender.mjs uses that
const ORIGIN = `http://localhost:${PORT}`;
const BUCKET = 'images';
const PREFIX = 'blog-og';

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;
const dry = args.includes('--dry');
// --missing: only posts with no card yet (og_image IS NULL). Used by the deploy
// workflow so each deploy generates cards for freshly-published posts only, fast,
// instead of re-rendering every published post every time.
const missing = args.includes('--missing');

// Same SPA-fallback static server the prerender uses: any unknown path serves
// index.html so client-side routes like /og/blog/:slug resolve.
const staticServer = () => {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  return createServer((req, res) => {
    let f = join(DIST, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!existsSync(f) || f.endsWith('/')) f = join(DIST, 'index.html');
    try {
      const body = readFileSync(f);
      res.writeHead(200, { 'Content-Type': mime['.' + f.split('.').pop()] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(join(DIST, 'index.html')));
    }
  });
};

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set — see the header for the --env-file invocation.');
    process.exit(1);
  }
  if (!existsSync(join(DIST, 'index.html'))) {
    console.error('client/dist not found. Run `npm run build:no-prerender` first — this screenshots the built site.');
    process.exit(1);
  }

  const db = createClient(url, key, { auth: { persistSession: false } });
  // category + icons are handed to the render route as query params. The route
  // deliberately does NOT fetch the API: a page served from localhost calling the
  // production API is blocked by CORS, which failed all 34 on the first attempt.
  let q = db.from('blogs').select('slug,category,icons').eq('status', 'published');
  if (only) q = q.eq('slug', only);
  if (missing) q = q.is('og_image', null);
  const { data: posts, error } = await q;
  if (error) throw error;
  if (!posts.length) {
    // In --missing mode "nothing to do" is success, not an error — the deploy
    // step must not fail just because every published post already has a card.
    if (missing) { console.log('No posts missing an OG card — nothing to generate.'); return; }
    console.error(only ? `No published post with slug "${only}"` : 'No published posts.');
    process.exit(1);
  }

  const server = staticServer();
  await new Promise((r) => server.listen(PORT, r));

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  const outDir = join(__dirname, '.og-preview');
  if (dry) mkdirSync(outDir, { recursive: true });

  let ok = 0;
  for (const p of posts) {
    try {
      const qs = new URLSearchParams({
        category: p.category || 'News',
        icons: (Array.isArray(p.icons) ? p.icons : []).join(','),
      });
      await page.goto(`${ORIGIN}/og/blog/${p.slug}?${qs}`, { waitUntil: 'networkidle0', timeout: 30000 });

      // The route marks itself ready once the thumbnail is mounted, so a blank or
      // half-painted page fails here rather than being screenshotted silently.
      await page.waitForSelector('[data-og-ready="true"] svg', { timeout: 20000 });

      const el = await page.$('[data-og-ready="true"]');
      const png = await el.screenshot({ type: 'png' });

      if (dry) {
        writeFileSync(join(outDir, `${p.slug}.png`), png);
        console.log('dry ', p.slug);
        ok += 1;
        continue;
      }

      const path = `${PREFIX}/${p.slug}.png`;
      const up = await db.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', upsert: true });
      if (up.error) throw up.error;

      const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path);
      // Cache-bust: the path is stable across runs, so without this the CDN and
      // every scraper cache would keep serving the old card after a redesign.
      const imageUrl = `${publicUrl}?v=${Date.now()}`;
      const upd = await db.from('blogs').update({ og_image: imageUrl }).eq('slug', p.slug);
      if (upd.error) throw upd.error;

      console.log('ok  ', p.slug);
      ok += 1;
    } catch (err) {
      console.error('FAIL', p.slug, '-', err.message);
    }
  }

  await browser.close();
  server.close();
  console.log(`\n${dry ? 'rendered' : 'generated + uploaded'} ${ok}/${posts.length} cards${dry ? ` → ${outDir}` : ''}`);

  // Exit non-zero on ANY miss: a partial run once wrote 1 of 34 and still
  // reported success, which in a log is indistinguishable from a good run.
  if (ok < posts.length) {
    console.error(`INCOMPLETE: ${posts.length - ok} card(s) failed — see FAIL lines above.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
