// server/scripts/scorePageUrl.mjs
// Score ONE live/local page URL (landing/product/generic — NOT blog drafts) with the
// live v2 scorer, no DB write and no full-site crawl. Used by the page-seo-gate skill.
// Blog drafts use scoreBlogDraft.mjs instead (they have no URL yet).
//
//   cd server && node --env-file=.env scripts/scorePageUrl.mjs <url> [--type static|product|profession]
//   (--env-file needed: the crawler loads the Supabase client at import. --selfcheck needs no env.)
//
// crawlOne() fetches the URL (so run against the PRERENDERED HTML a bot sees — prod,
// or a `vite build && preview` of the route — a raw SPA dev URL has an empty body and
// scores near zero). Row-build mirrors seoPersist.js:37-63 exactly (kept pure here).
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import scoringPkg from '../services/seo/scoring/index.js';  // CJS default import — pure, no DB
const { scorePage } = scoringPkg;
// crawlOne is imported lazily inside scoreUrl(): seoCrawler pulls the Supabase client at
// load and throws without env, which would also break the pure --selfcheck. A real scoring
// run needs server/.env loaded anyway, so defer the import to the one path that fetches.

// crawlOne() flat output -> a seo_crawl_pages row shape (what scorePage/extract read).
// This is the ONLY mapping the scorer needs; keep it identical to seoPersist's pageRows.
export function toRow(p) {
  return {
    url: p.url,
    page_type: p.pageType,
    http_status: p.httpStatus,
    title: p.title,
    meta_description: p.metaDescription,
    canonical: p.canonical,
    robots: p.robots,
    h1: p.h1,
    word_count: p.wordCount,
    indexable: p.indexable,
    in_sitemap: p.inSitemap,
    raw_signals: {
      headings: p.headings, links: p.links, images: p.images,
      jsonLd: p.jsonLd, viewport: p.viewport, fetchError: p.fetchError,
      contentModel: p.contentModel || null,
      bodyText: p.bodyText ? String(p.bodyText).slice(0, 4000) : null,
    },
  };
}

export async function scoreUrl(url, pageType = 'static') {
  const { crawlOne } = (await import('../services/seo/seoCrawler.js')).default;
  const page = await crawlOne({ url, pageType, inSitemap: false });
  return { page, result: scorePage(toRow(page), {}) };
}

async function main() {
  const url = process.argv[2];
  const typeArg = process.argv.indexOf('--type');
  const pageType = typeArg > -1 ? process.argv[typeArg + 1] : 'static';
  if (!url) { console.error('usage: node scripts/scorePageUrl.mjs <url> [--type static]'); process.exit(2); }

  const { page, result } = await scoreUrl(url, pageType);
  const { seo, geo, recommendations, signals } = result;
  console.log(`\nURL        ${page.url}`);
  console.log(`HTTP ${page.httpStatus}  indexable=${page.indexable}  words=${signals.wordCount}  bodySource=${signals.bodySource}`);
  console.log(`SEO ${seo.score}/100   caps: ${(seo.caps || []).map((c) => `${c.cap}(${c.reason})`).join('; ') || 'none'}`);
  console.log(`GEO ${geo.score}/100   caps: ${(geo.caps || []).map((c) => `${c.cap}(${c.reason})`).join('; ') || 'none'}`);
  console.log('\nTop fixes (priority-sorted):');
  for (const r of recommendations.slice(0, 12)) {
    console.log(`  [${r.tier}] ${r.axis}/${r.dimension}  -${r.impact}pt  ${r.title}`);
  }
  console.log('');
}

// self-check: toRow must preserve the fields extract() reads, or the gate scores garbage.
function demo() {
  const row = toRow({
    url: 'x', pageType: 'static', httpStatus: 200, wordCount: 42, indexable: true,
    robots: null, h1: ['Hi'], headings: [{ tag: 'h1', text: 'Hi' }],
    links: { internal: ['/a'], external: [] }, images: [], jsonLd: [{ '@type': 'Organization' }],
    bodyText: 'hello', title: 't', metaDescription: 'd', canonical: 'c',
  });
  assert.equal(row.word_count, 42);
  assert.equal(row.page_type, 'static');
  assert.equal(row.raw_signals.headings[0].text, 'Hi');
  assert.equal(row.raw_signals.jsonLd[0]['@type'], 'Organization');
  assert.equal(row.raw_signals.bodyText, 'hello');
  console.log('scorePageUrl toRow self-check OK');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === '--selfcheck') demo();
  else main().catch((e) => { console.error(e); process.exit(1); });
}
