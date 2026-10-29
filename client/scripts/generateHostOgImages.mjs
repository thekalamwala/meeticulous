/**
 * generateHostOgImages.mjs — render each host's 1200x630 social card.
 *
 * The host equivalent of generateBlogOgImages.mjs, and it works the same way:
 * screenshot the REAL /og/host/:username React route at 1200x630 and upload the
 * PNG to Supabase Storage (images bucket, host-og/ prefix), writing the URL to
 * profiles.og_image. prerenderController serves it as og:image so a shared
 * bookasloth.com/:username link previews as a proper wide card instead of the
 * host's square avatar letterboxed inside one.
 *
 * State machine (profiles.og_status, migration v3.88):
 *   none/dirty -> this script picks it up -> generating -> ready.
 *   A profile edit marks the row 'dirty' (hostController); the next run
 *   regenerates. og_hash skips a row whose visible card fields are unchanged, so
 *   a no-op save or a small booking tick doesn't re-render.
 *
 * Card-ready gate: a host only gets a personal card once the profile looks good
 * in one — name + photo + profession + >=1 active service. Below that, the row
 * stays 'none' and prerenderController serves the default host card.
 *
 * Needs the built site served locally (screenshots a real route):
 *   cd client
 *   npm run build:no-prerender
 *   node --env-file=../server/.env.production scripts/generateHostOgImages.mjs   # prod
 *   node --env-file=../server/.env scripts/generateHostOgImages.mjs              # staging
 *
 * --only=<username>   one host        --force  ignore og_hash, regenerate anyway
 * --all               every card-ready host (not just none/dirty)
 * --dry               write PNGs to scripts/.host-og-preview/, upload nothing
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
const PORT = 4175; // 4173 = prerender, 4174 = blog og
const ORIGIN = `http://localhost:${PORT}`;
const BUCKET = 'images';
const PREFIX = 'host-og';

const args = process.argv.slice(2);
const only = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;
const force = args.includes('--force');
const all = args.includes('--all');
const dry = args.includes('--dry');

// Google avatars come back at =s96-c (96px); ask for 512 so the card's avatar
// isn't upscaled mush. Mirrors prerenderController.upscaleAvatar.
const upscale = (url) => String(url || '').replace(/=s\d+-c$/, '=s512-c');

// review-weighted host rating across the host's active services.
const hostStats = (services) => {
  let reviews = 0, bookings = 0, weighted = 0;
  for (const s of services) {
    const r = Number(s.total_reviews) || 0;
    reviews += r;
    bookings += Number(s.total_bookings) || 0;
    weighted += (Number(s.rating) || 0) * r;
  }
  return { reviews, bookings, rating: reviews > 0 ? weighted / reviews : 0 };
};

// Same compact() the card uses, so the HASH is computed over what actually
// renders: a booking count nudging 812 -> 815 keeps "810+" and skips a re-render.
const compact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(Math.floor(v / 100) / 10).toString().replace(/\.0$/, '')}k+`;
  if (v >= 10) return `${Math.floor(v / 10) * 10}+`;
  return String(v);
};

const cardFields = (p, services) => {
  const { reviews, bookings, rating } = hostStats(services);
  const hasRating = reviews > 0 && rating > 0;
  const online = services.some((s) => s.meeting_mode === 'online');
  return {
    name: p.name || 'Book A Sloth Host',
    profession: p.profession || '',
    bio: (p.seo_description || p.bio || '').slice(0, 140),
    username: p.username || '',
    avatar: upscale(p.profile_image) || '',
    verified: p.is_verified ? '1' : '0',
    online: online ? '1' : '0',
    // Online bookings auto-get a Google Meet link, so online => Meet.
    meet: online ? '1' : '0',
    rating: hasRating ? rating.toFixed(1) : '0',
    reviews: String(reviews),
    bookings: String(bookings),
    since: p.created_at ? new Date(p.created_at).getUTCFullYear().toString() : '',
  };
};

// Hash over the DISPLAY-ready payload (compact stats, not raw counts), so the
// row only regenerates when the card visibly changes.
const fieldHash = (f) => createHash('sha1').update(JSON.stringify({
  ...f, rating: f.rating, reviews: compact(f.reviews), bookings: compact(f.bookings),
})).digest('hex').slice(0, 16);

const staticServer = () => {
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };
  return createServer((req, res) => {
    let f = join(DIST, req.url === '/' ? 'index.html' : req.url.split('?')[0]);
    // Bare SPA shell for unknown paths so /og/host/:username resolves client-side
    // — never dist/index.html (that's the full homepage; see prerender.mjs).
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

  // Card-ready hosts: real profile + at least one active service. Pulled with a
  // joined services select so stats need no second round-trip.
  let q = db.from('profiles')
    .select('id, username, name, profession, bio, seo_description, profile_image, is_verified, created_at, og_status, og_hash, og_version, og_image, services!services_host_id_fkey(rating, total_reviews, total_bookings, is_active, meeting_mode)')
    .eq('role', 'host')
    .not('username', 'is', null)
    .not('name', 'is', null)
    .not('profile_image', 'is', null)
    .not('profession', 'is', null);
  if (only) q = q.eq('username', only);
  else if (!all) q = q.in('og_status', ['none', 'dirty']);

  const { data: rows, error } = await q;
  if (error) throw error;

  // Keep only hosts with >=1 ACTIVE service (the join returns inactive ones too).
  const ready = (rows || [])
    .map((p) => ({ p, services: (p.services || []).filter((s) => s && s.is_active) }))
    .filter((r) => r.services.length > 0);

  if (!ready.length) {
    console.log(only ? `No card-ready host "${only}" (needs name + photo + profession + >=1 active service).` : 'No hosts need a card right now.');
    return;
  }

  const server = staticServer();
  await new Promise((r) => server.listen(PORT, r));

  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });

  const outDir = join(__dirname, '.host-og-preview');
  if (dry) mkdirSync(outDir, { recursive: true });

  let ok = 0, skipped = 0, failed = 0;

  for (const { p, services } of ready) {
    const fields = cardFields(p, services);
    const hash = fieldHash(fields);

    // Visible fields unchanged and a card already exists → nothing to render. If
    // a no-op profile save left the row 'dirty', settle it back to 'ready' here
    // so it stops showing up in every sweep.
    if (!force && !dry && p.og_image && p.og_hash === hash) {
      if (p.og_status !== 'ready') await db.from('profiles').update({ og_status: 'ready' }).eq('id', p.id);
      skipped++;
      continue;
    }

    try {
      if (!dry) await db.from('profiles').update({ og_status: 'generating' }).eq('id', p.id);

      const qs = new URLSearchParams(fields);
      // NOT networkidle0: the built SPA boots and fires background calls (auth,
      // analytics) to whatever VITE_API_URL was built in — a placeholder in CI —
      // which never settle, so networkidle0 timed out on every card. The card is
      // static data from the query string; wait for the marker, then for its
      // images (avatar + CDN logo) to actually paint, then shoot.
      await page.goto(`${ORIGIN}/og/host/${p.username}?${qs}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
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
        writeFileSync(join(outDir, `${p.username}.png`), png);
        console.log('dry ', p.username);
        ok++;
        continue;
      }

      const path = `${PREFIX}/${p.username}.png`;
      const up = await db.storage.from(BUCKET).upload(path, png, { contentType: 'image/png', upsert: true });
      if (up.error) throw up.error;

      const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path);
      // ?v=timestamp cache-busts the CDN + every scraper cache on regen — the
      // storage path is stable, so without it a redesign keeps serving the old card.
      const imageUrl = `${publicUrl}?v=${Date.now()}`;
      const upd = await db.from('profiles').update({
        og_image: imageUrl,
        og_status: 'ready',
        og_hash: hash,
        og_generated_at: new Date().toISOString(),
        og_version: (Number(p.og_version) || 0) + 1,
        og_error: null,
      }).eq('id', p.id);
      if (upd.error) throw upd.error;

      console.log('ok  ', p.username, `(${fields.verified === '1' ? 'verified' : 'unverified'}, ${services.length} svc)`);
      ok++;
    } catch (err) {
      failed++;
      console.error('FAIL', p.username, '-', err.message);
      // Return to 'dirty' so the next sweep retries, and record why.
      if (!dry) await db.from('profiles').update({ og_status: 'dirty', og_error: String(err.message).slice(0, 300) }).eq('id', p.id).then(() => {}, () => {});
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
