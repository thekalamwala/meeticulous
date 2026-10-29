/**
 * enrichTopmateCategories.js — scrape each Topmate profile's public headline
 * (the real "what they do") to sharpen the lead type-tags that name/domain
 * keyword-guessing can't.
 *
 * Topmate SEO pages carry the role in a static `og:description`:
 *   "<name> · <headline> · <rating>★ (n) · Topmate"
 * No JS render needed — a plain fetch + meta parse. We classify the headline
 * with the SAME rules as the importer (shared module) and cache the result to
 * `topmate_categories.json` (next to the CSV). importTopmateLeads.js reads that
 * cache and prefers the headline for the type tag.
 *
 * Public profile pages, read-only, one request at a time with a delay — gentle.
 * The cache is derived from the prospect list, so like the CSV it is NOT committed.
 *
 * Usage:
 *   node scripts/enrichTopmateCategories.js            # scrape (resumes; skips cached)
 *   node scripts/enrichTopmateCategories.js --refresh  # re-scrape everything
 *   node scripts/enrichTopmateCategories.js --files a.csv,b.csv --out cache.json
 *
 * ponytail: fetch + meta-parse, not a headless browser; cached + resumable so a
 * re-run costs nothing.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseCSV, inferType, decodeEntities, topmateSlug } = require('./importTopmateLeads');

const DELAY_MS = 400;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function defaultFiles() {
  const desk = path.join(os.homedir(), 'OneDrive', 'Desktop');
  return ['leads_grade_A.csv', 'leads_grade_B.csv'].map((f) => path.join(desk, f));
}

// "<name> · <headline...> · 4.8★ (11) · Topmate" → "<headline...>"
function headlineFromOg(desc) {
  const parts = decodeEntities(desc).split(' · ')
    .map((s) => s.trim())
    .filter((s) => s && !/★|^topmate$/i.test(s));
  parts.shift(); // drop the leading name
  return parts.join(' | ').replace(/…+$/, '').trim();
}

async function fetchHeadline(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': 'Mozilla/5.0 (BookASloth lead research)' },
  });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const html = await res.text();
  const m = html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
  if (!m) return { error: 'no og:description' };
  return { headline: headlineFromOg(m[1]) };
}

async function main() {
  const args = process.argv.slice(2);
  const refresh = args.includes('--refresh');
  const filesArg = args[args.indexOf('--files') + 1];
  const files = args.includes('--files') && filesArg ? filesArg.split(',').map((s) => s.trim()) : defaultFiles();
  const outArg = args[args.indexOf('--out') + 1];
  const out = args.includes('--out') && outArg ? outArg : path.join(path.dirname(files[0]), 'topmate_categories.json');

  // Unique A/B slugs from the CSVs.
  const targets = new Map(); // slug -> { url, name }
  for (const f of files) {
    if (!fs.existsSync(f)) { console.warn(`! missing: ${f}`); continue; }
    for (const r of parseCSV(fs.readFileSync(f, 'utf8'))) {
      const grade = (r.grade || '').trim().toUpperCase();
      const slug = topmateSlug(r.topmate_profile);
      if ((grade === 'A' || grade === 'B') && slug && !targets.has(slug)) {
        targets.set(slug, { url: `https://topmate.io/${slug}`, name: (r.name || r.tm_name || '').trim() });
      }
    }
  }

  const cache = !refresh && fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : {};
  const todo = [...targets].filter(([slug]) => !cache[slug]);
  console.log(`\nTopmate enrich — ${targets.size} A/B profiles · ${Object.keys(cache).length} cached · ${todo.length} to fetch\n`);

  let done = 0, errs = 0;
  const save = () => fs.writeFileSync(out, JSON.stringify(cache, null, 2));
  for (const [slug, { url, name }] of todo) {
    let r;
    try { r = await fetchHeadline(url); }
    catch (e) { await sleep(DELAY_MS); try { r = await fetchHeadline(url); } catch (e2) { r = { error: e2.name === 'TimeoutError' ? 'timeout' : e2.message }; } }
    const type = r.headline ? inferType(r.headline).tag : null;
    cache[slug] = { slug, url, name, headline: r.headline || '', type: type || '', error: r.error, at: new Date().toISOString() };
    if (r.error) { errs++; process.stdout.write(`  ! ${slug}: ${r.error}\n`); }
    else { done++; process.stdout.write(`  · ${slug} → ${type || '—'}  ${r.headline.slice(0, 70)}\n`); }
    if ((done + errs) % 10 === 0) save();
    await sleep(DELAY_MS);
  }
  save();

  const tally = Object.values(cache).reduce((m, c) => { const k = c.type || '—'; m[k] = (m[k] || 0) + 1; return m; }, {});
  console.log(`\nDone. fetched ${done} · errors ${errs} · total cached ${Object.keys(cache).length}`);
  console.log('by type:', tally);
  console.log(`\ncache: ${out}\nNow run: node scripts/importTopmateLeads.js  (it will pick up the headlines)\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
