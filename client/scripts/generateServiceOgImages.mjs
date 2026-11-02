/**
 * generateServiceOgImages.mjs — render each service's 1200x630 social card.
 *
 * The per-SERVICE sibling of generateHostOgImages.mjs, and it works the same way:
 * screenshot the REAL /og/service/:username/:slug React route at 1200x630 and
 * upload the PNG to Supabase Storage (images bucket, service-og/ prefix), writing
 * the URL to services.og_image. prerenderController serves it as og:image so a
 * shared meeticulous.com/:username/:slug link previews as a proper wide card
 * naming the service + price instead of the thumbnail letterboxed inside one.
 *
 * State machine (services.og_status, migration v3.154):
 *   none/dirty -> this script picks it up -> generating -> ready.
 *   A service title/price edit marks the row 'dirty' (serviceController +
 *   hostController); the next run regenerates. og_hash skips a row whose visible
 *   card fields are unchanged, so a no-op save doesn't re-render.
 *
 * Card-ready gate: a service gets a card once it looks good in one — active +
 * a title + a host with a username and a name. Below that, the row stays 'none'
 * and the resolver serves the static /service-og-default.png floor.
 *
 * Needs the built site served locally (screenshots a real route):
 *   cd client
 *   npm run build:no-prerender
 *   node --env-file=../server/.env.production scripts/generateServiceOgImages.mjs   # prod
 *   node --env-file=../server/.env scripts/generateServiceOgImages.mjs              # staging
 *
 * --only=<serviceId>  one service      --force  ignore og_hash, regenerate anyway
 * --all               every card-ready service (not just none/dirty)
 * --dry               write PNGs to scripts/.service-og-preview/, upload nothing
 */
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'http';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');

const W = 1200;
const H = 630;
const PORT = 4176; // 4173 = prerender, 4174 = blog og, 4175 = host og
const ORIGIN = `http://localhost:${PORT}`;
const BUCKET = 'images';
const PREFIX = 'service-og';

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;
const force = args.includes('--force');
const all = args.includes('--all');
const dry = args.includes('--dry');

// Google avatars come back at =s96-c (96px); ask for 512 so the card's portrait
// isn't upscaled mush. Mirrors generateHostOgImages / prerenderController.
const upscale = (url) => String(url || '').replace(/=s\d+-c$/, '=s512-c');

// ₹1,499 reads better than ₹1499 — matches ServiceOgCard's rupees().
const rupees = (n) => Number(n || 0).toLocaleString('en-IN');

const cardFields = (s, p) => {
  const reviews = Number(s.total_reviews) || 0;
  const rating = Number(s.rating) || 0;
  const hasRating = reviews > 0 && rating > 0;
  const price = Number(s.price) || 0;
  const currency = s.currency || 'INR';
  return {
    title: s.title || 'Book a session',
    hostName: p.name || '',
    profession: p.profession || '',
    username: p.username || '',
    avatar: upscale(p.profile_image) || '',
    verified: p.is_verified ? '1' : '0',
    currency,
    price: String(price),
    rating: hasRating ? rating.toFixed(1) : '0',
    reviews: String(reviews),
  };
};

// Hash over the DISPLAY-ready payload, so the row only regenerates when the card
// visibly changes: the rendered price label (Free vs ₹x) and rating shown.
const fieldHash = (f) => {
  const price = Number(f.price) || 0;
  const hasRating = Number(f.reviews) > 0 && Number(f.rating) > 0;
  return createHash('sha1').update(JSON.stringify({
    ...f,
    priceLabel: price > 0 ? `${f.currency === 'INR' ? '₹' : ''}${rupees(price)}` : 'Free',
    rating: hasRating ? f.rating : '0',
  })).digest('hex').slice(0, 16);
};

const staticServer = () => {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  return createServer((req, res) => {
    let f = join(DIST, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    // Bare SPA shell for unknown paths so /og/service/:username/:slug resolves
    // client-side — never dist/index.html (that's the full homepage).
    const shell = existsSync(join(DIST, 'spa-shell.html')) ? 'spa-shell.html' : 'index.html';
    if (!existsSync(f) || f.endsWith('/')) f = join(DIST, shell);
    try {
      res.writeHead(200, { 'Content-Type': mime['.' + f.split('.').pop()] || 'application/octet-stream' });
      res.end(readFileSync(f));
    } catch {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(readFileSync(join(DIST, shell)));
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

  // Card-ready services: active service + host profile with username + name.
  // Pulled with a joined profiles select so no second round-trip is needed.
  let q = db.from('services')
    .select('id, host_id, title, slug, price, currency, rating, total_reviews, is_active, og_status, og_hash, og_version, og_image, profiles!services_host_id_fkey(username, name, profession, profile_image, is_verified, role)')
    .eq('is_active', true)
    .not('title', 'is', null);
  if (only) q = q.eq('id', only);
  else if (!all) q = q.in('og_status', ['none', 'dirty']);

  const { data: rows, error } = await q;
  if (error) throw error;

  // Keep only services whose host is a real host with a username + name.
  const ready = (rows || [])
    .map((s) => ({ s, p: s.profiles || {} }))
    .filter(({ p }) => p && p.role === 'host' && p.username && p.name);

  if (!ready.length) {
    console.log(only ? `No card-ready service "${only}" (needs active + title + host with username + name).` : 'No services need a card right now.');
    return;
  }

  const server = staticServer();
  await new Promise((r) => server.listen(PORT, r));

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  const outDir = join(__dirname, '.service-og-preview');
  if (dry) mkdirSync(outDir, { recursive: true });

  let ok = 0, skipped = 0, failed = 0;

  for (const { s, p } of ready) {
    const fields = cardFields(s, p);
    const hash = fieldHash(fields);

    // Visible fields unchanged and a card already exists → nothing to render. If
    // a no-op save left the row 'dirty', settle it back to 'ready' here so it
    // stops showing up in every sweep.
    if (!force && !dry && s.og_image && s.og_hash === hash) {
      if (s.og_status !== 'ready') await db.from('services').update({ og_status: 'ready' }).eq('id', s.id);
      skipped++;
      continue;
    }

    try {
      if (!dry) await db.from('services').update({ og_status: 'generating' }).eq('id', s.id);

      const qs = new URLSearchParams(fields);
      // NOT networkidle0: the built SPA fires background calls that never settle
      // against a CI placeholder API. The card is static query-string data; wait
      // for the marker, then for its images (avatar + CDN logo) to paint, shoot.
      await page.goto(`${ORIGIN}/og/service/${p.username}/${s.slug}?${qs}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('[data-og-ready="true"]', { timeout: 20000 });
      await page.evaluate(() => {
        const pending = Array.from(document.images).filter((i) => !i.complete);
        return Promise.race([
          Promise.all(pending.map((i) => new Promise((r) => { i.onload = i.onerror = r; }))),
          new Promise((r) => setTimeout(r, 6000)), // a dead image must not hang the run
        ]);
      });
      const el = await page.$('[data-og-ready="true"]');
      const png = await el.screenshot({ type: 'png' });

      if (dry) {
        writeFileSync(join(outDir, `${s.id}.png`), png);
        console.log('dry ', s.id, s.slug);
        ok++;
        continue;
      }

      // Keyed by service id (stable across slug renames), not slug.
      const path = `${PREFIX}/${s.id}.png`;
      const up = await db.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', upsert: true });
      if (up.error) throw up.error;

      const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path);
      // ?v=timestamp cache-busts the CDN + every scraper cache on regen — the
      // storage path is stable, so without it a redesign keeps serving the old card.
      const imageUrl = `${publicUrl}?v=${Date.now()}`;
      const upd = await db.from('services').update({
        og_image: imageUrl,
        og_status: 'ready',
        og_hash: hash,
        og_generated_at: new Date().toISOString(),
        og_version: (Number(s.og_version) || 0) + 1,
        og_error: null,
      }).eq('id', s.id);
      if (upd.error) throw upd.error;

      console.log('ok  ', p.username + '/' + s.slug, `(₹${fields.price})`);
      ok++;
    } catch (err) {
      failed++;
      console.error('FAIL', s.id, s.slug, '-', err.message);
      // Return to 'dirty' so the next sweep retries, and record why.
      if (!dry) await db.from('services').update({ og_status: 'dirty', og_error: String(err.message).slice(0, 300) }).eq('id', s.id).then(() => {}, () => {});
    }
  }

  await browser.close();
  server.close();
  console.log(`\n${dry ? 'rendered' : 'generated'} ${ok}, skipped ${skipped} (unchanged), failed ${failed}${dry ? ` → ${outDir}` : ''}`);

  // Any failure exits non-zero — a partial run that reports success is how the
  // blog cards silently broke. Skips are fine (nothing to do).
  if (failed > 0) {
    console.error(`INCOMPLETE: ${failed} card(s) failed — see FAIL lines above.`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
