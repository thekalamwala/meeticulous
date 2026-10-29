// server/scripts/scoreBlogDraft.mjs
// Score a draft blog post (blogPosts.js shape) with the live v2 scorer, no crawl.
// Pure analyzer + row builder here; scorer wiring added in the next task.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import scoringPkg from '../services/seo/scoring/index.js'; // CJS module → default import
const { scorePage } = scoringPkg;
import { articleGraphJsonLd } from '../../client/src/utils/seo.js';

const LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

export function analyzeBody(body = []) {
  const headings = [];
  const textParts = [];
  const internal = new Set();
  const external = new Set();

  const harvestLinks = (s) => {
    for (const m of String(s || '').matchAll(LINK_RE)) {
      const href = m[2].trim();
      if (href.startsWith('/')) internal.add(href);
      else if (/^https?:/i.test(href)) external.add(href);
    }
  };
  const pushText = (s) => { if (s) { textParts.push(String(s)); harvestLinks(s); } };

  for (const block of body) {
    if (!block || typeof block !== 'object') continue;
    if ('h2' in block) { headings.push({ tag: 'h2', text: String(block.h2) }); pushText(block.h2); }
    else if ('p' in block) pushText(block.p);
    else if ('ul' in block) (block.ul || []).forEach(pushText);
    else if ('ol' in block) (block.ol || []).forEach(pushText);
    else if ('steps' in block) (block.steps || []).forEach(pushText);
    else if ('quote' in block) { pushText(block.quote); pushText(block.cite); }
    else if ('info' in block) { pushText(block.info?.title); pushText(block.info?.text); }
    else if ('table' in block) {
      (block.table?.head || []).forEach(pushText);
      (block.table?.rows || []).forEach((r) => (r || []).forEach(pushText));
    } else if ('faq' in block) {
      (block.faq || []).forEach((f) => { pushText(f?.q); pushText(f?.a); });
    }
  }
  const bodyText = textParts.join('\n');
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;
  return {
    bodyText,
    headings,
    links: { internal: [...internal], external: [...external] },
    wordCount,
  };
}

export function buildPageRow(post, { siteUrl = 'https://bookasloth.com', jsonLdGraph = [] } = {}) {
  const a = analyzeBody(post.body || []);
  const images = post.image ? [{ src: post.image, alt: post.imageAlt || '' }] : [];
  return {
    url: `${siteUrl}/blog/${post.slug}`,
    page_type: 'blog',
    http_status: 200,
    indexable: true,
    robots: 'index,follow',
    canonical: `${siteUrl}/blog/${post.slug}`,
    title: post.title || '',
    meta_description: post.excerpt || '',
    h1: [post.title || ''],
    word_count: a.wordCount,
    raw_signals: {
      headings: [{ tag: 'h1', text: post.title || '' }, ...a.headings],
      links: a.links,
      images,
      bodyText: a.bodyText,
      jsonLd: jsonLdGraph,
    },
  };
}

export function scoreDraft(post, { siteUrl = 'https://bookasloth.com', queries = [] } = {}) {
  const graph = articleGraphJsonLd({
    siteUrl,
    url: `${siteUrl}/blog/${post.slug}`,
    type: 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.image || undefined,
    datePublished: post.date || undefined,
    dateModified: post.dateModified || post.date || undefined,
    author: post.author && typeof post.author === 'object' ? post.author : undefined,
    breadcrumb: [{ name: 'Blog', path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }],
    faqs: collectFaqs(post.body || []),
  });
  const row = buildPageRow(post, { siteUrl, jsonLdGraph: graph['@graph'] });
  return scorePage(row, { queries, gsc: null, robots: {} });
}

function collectFaqs(body = []) {
  const out = [];
  for (const b of body) if (b && 'faq' in b) for (const f of (b.faq || [])) if (f?.q && f?.a) out.push({ q: f.q, a: f.a });
  return out;
}

function selfcheck() {
  const body = [
    { h2: 'How booking works' },
    { p: 'Guests book via [our pricing](/pricing) and read [Razorpay docs](https://razorpay.com/docs).' },
    { ul: ['Fast [setup](/blog/setup)', 'OTP login'] },
    { faq: [{ q: 'Is it free?', a: 'Starter is free.' }] },
  ];
  const a = analyzeBody(body);
  assert.equal(a.headings.length, 1, 'one h2 heading');
  assert.deepEqual(a.links.internal.sort(), ['/blog/setup', '/pricing'], 'internal links');
  assert.deepEqual(a.links.external, ['https://razorpay.com/docs'], 'external link');
  assert.ok(a.wordCount > 5, 'word count counted');
  assert.ok(a.bodyText.includes('Is it free?'), 'faq text included in body');

  const row = buildPageRow({ slug: 's', title: 'T', excerpt: 'E', body }, { siteUrl: 'https://bookasloth.com', jsonLdGraph: [{ '@type': 'BlogPosting' }] });
  assert.equal(row.page_type, 'blog');
  assert.equal(row.http_status, 200);
  assert.equal(row.canonical, 'https://bookasloth.com/blog/s');
  assert.deepEqual(row.h1, ['T']);
  assert.equal(row.raw_signals.jsonLd[0]['@type'], 'BlogPosting');
  assert.equal(row.raw_signals.headings.length, 2, 'h1 (title) + one h2');
  console.log('selfcheck (analyze+row): PASS');

  // Import sanity — both app modules must resolve under Node ESM.
  const graph = articleGraphJsonLd({ url: 'https://bookasloth.com/blog/s', headline: 'T', description: 'E' });
  assert.ok(Array.isArray(graph['@graph']) && graph['@graph'].length, 'articleGraphJsonLd returns a @graph');
  assert.equal(typeof scorePage, 'function', 'scorePage imported');

  const longBody = [{ h2: 'Intro' }, { p: 'word '.repeat(400) + '[src](https://example.com)' }];
  const res = scoreDraft({ slug: 's', title: 'A real blog title about booking', excerpt: 'x'.repeat(150), body: longBody, date: '2026-09-10' }, {});
  assert.ok(res.seo && typeof res.seo.score === 'number', 'seo score present');
  assert.ok(res.geo && typeof res.geo.score === 'number', 'geo score present');
  assert.equal(res.seo.profile, 'blog', 'blog weight profile selected');
  assert.ok(Array.isArray(res.recommendations), 'recommendations array');
  console.log('selfcheck (scoreDraft): PASS');
}

async function readPost() {
  const fileArg = process.argv.find((a) => a.endsWith('.json'));
  if (fileArg) {
    const { readFile } = await import('node:fs/promises');
    return JSON.parse(await readFile(fileArg, 'utf8'));
  }
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

// Only run the CLI/selfcheck when this file is the entry point — importing it
// (e.g. for batch scoring) must not fire the stdin CLI.
const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  if (process.argv.includes('--selfcheck')) {
    selfcheck();
  } else {
    const siteUrl = process.env.SITE_URL || 'https://bookasloth.com';
    readPost()
      .then((post) => { process.stdout.write(JSON.stringify(scoreDraft(post, { siteUrl }), null, 2)); })
      .catch((e) => { console.error('scoreBlogDraft error:', e.message); process.exit(1); });
  }
}
