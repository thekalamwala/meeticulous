/**
 * replyRadar.js — find fresh Reddit + Quora posts where Meeticulous is a
 * genuinely useful answer, and draft a reply for each. It NEVER posts.
 *
 * Flow: Reddit search RSS (per subreddit, last N days) + Quora
 * questions via Claude's web_search tool → Claude triages each post
 * (lead | brand | skip) and drafts a reply → a dated markdown file you read,
 * edit and post by hand.
 *
 * Why draft-only: automated promotional comments break Reddit's spam /
 * content-manipulation rules and Quora's ToS (no API, no automation) — bot
 * accounts get shadowbanned and the domain can get sitewide-blocked. Same call
 * as the scrapped X autopost: posting stays MANUAL.
 *
 * Output (not committed — it's scraped third-party content):
 *   ~/OneDrive/Desktop/reply-radar/YYYY-MM-DD.md   the queue
 *   ~/OneDrive/Desktop/reply-radar/seen.json       ids already drafted (skipped next run)
 *
 * Usage (from server/):
 *   node scripts/replyRadar.js                 # last 7 days, up to 40 drafts
 *   node scripts/replyRadar.js --days 3 --limit 20
 *   node scripts/replyRadar.js --no-quora      # Reddit only
 *   node scripts/replyRadar.js --dry           # fetch + list posts, no Claude calls
 *   node scripts/replyRadar.js --out ./radar
 *
 * Needs ANTHROPIC_API_KEY in server/.env. REPLY_RADAR_MODEL overrides the model.
 *
 * ponytail: Reddit's unauthenticated .json is 403 and new OAuth apps need
 * approval (Responsible Builder Policy, Nov 2025), so this reads the search RSS
 * — subreddits batched into ~2 sitewide queries, 15s apart. If RSS dies
 * entirely it falls back to Claude web_search on reddit.com (titles only).
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── Tune these ──────────────────────────────────────────────────────────────
// Leads: people asking how to take paid bookings/consultations. Brand: broader
// threads where a helpful answer earns a mention (and AI-search citations).
const SUBREDDITS = [
  'IndianEntrepreneur', 'StartUpIndia', 'india', 'indiasocial', 'freelance_forhire',
  'freelance', 'consulting', 'therapists', 'Entrepreneur', 'smallbusiness',
  'SaaS', 'coaching', 'IndiaInvestments', 'personalfinanceindia',
];
const QUERIES = [
  'booking link', 'calendly alternative', 'paid consultation', 'take appointments',
  'booking app', 'collect payment for sessions', 'scheduling tool', 'topmate',
  'charge for calls', 'online consultation',
];
const SEARCH_TOPICS = [
  'best appointment booking app in India',
  'how to charge for online consultations in India',
  'Calendly alternative with UPI / Razorpay payments',
  'how coaches and therapists in India take paid bookings',
  'Topmate alternative',
];
const REDDIT_DELAY_MS = 15000;
const UA = 'meeticulous-reply-radar/1.0 (manual review tool)';
const MODEL = process.env.REPLY_RADAR_MODEL || 'claude-sonnet-5-5';

// Product facts the drafter may use. Keep in sync with Pricing.jsx — a wrong
// price in a public comment is worse than no comment.
const PRODUCT_FACTS = `Meeticulous (meeticulous.com) — booking page + payments for Indian creators,
consultants, coaches, therapists, tutors, doctors, salons.
- Hosts publish services (1:1 calls, sessions, packages, digital products) on a page like meeticulous.com/<username>.
- Guests book with WhatsApp OTP (no account/password), pay via Razorpay (UPI, cards, netbanking).
- Google Calendar sync, Google Meet links, WhatsApp + email reminders, payouts to the host's bank.
- Plans (prices include GST): Starter = free forever, 5% commission only when you get paid.
  Pro = ₹3,599/year (~₹300/month), 0% commission, adds automation + client CRM.
  ~2.4% payment-gateway fee applies on both (Razorpay's charge, not ours).
- Breakeven: above ~₹6,000/month in bookings, Pro costs less than the 5%.`;

const SYSTEM = `You help the founder of Meeticulous find online threads worth replying to,
and draft the reply they will post by hand from their own account.

${PRODUCT_FACTS}

For each post decide a route:
- "lead": the poster (or readers) need a way to take bookings/payments for their time — Meeticulous directly solves it.
- "brand": a broader question (pricing your time, freelancing in India, tools for consultants) where a genuinely useful answer can mention Meeticulous as one option among others.
- "skip": off-topic, a rant, a job post, already solved, hostile to self-promotion, or a mention would feel forced.

score: 1–10, how worth the founder's time this reply is (relevance × reach × buying intent).

Reply rules (only when route is not "skip"; empty string for skip):
- Answer the actual question first, with specific, practical help. The answer must be useful even with the product mention removed.
- Mention Meeticulous at most once, near the end, with plain disclosure ("I'm building Meeticulous, so I'm biased"). For "brand", name 1–2 alternatives too.
- No link unless route is "lead" — then at most one bare meeticulous.com.
- Reddit: casual, first person, 60–150 words, no headings, no emoji, no marketing words ("seamless", "game-changer", "unlock").
- Quora: 120–250 words, can use a short list.
- Never invent facts about the poster or the product. Only use the product facts above.`;

const OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    route: { type: 'string', enum: ['lead', 'brand', 'skip'] },
    score: { type: 'integer' },
    why: { type: 'string', description: 'one line: why this route/score' },
    reply: { type: 'string' },
  },
  required: ['route', 'score', 'why', 'reply'],
  additionalProperties: false,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function parseArgs(argv) {
  const get = (flag, dflt) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
  };
  return {
    days: Number(get('--days', 7)),
    limit: Number(get('--limit', 40)),
    out: get('--out', path.join(os.homedir(), 'OneDrive', 'Desktop', 'reply-radar')),
    quora: !argv.includes('--no-quora'),
    dry: argv.includes('--dry'),
  };
}

// Sitewide Reddit search queries: (subreddit:a OR subreddit:b) ("x" OR "y"),
// packing as many subreddits per query as fit Reddit's 512-char query cap —
// fewer requests is the whole game against the RSS rate limit.
function redditQueries(subs, phrases, max = 500) {
  const terms = `(${phrases.map((p) => `"${p}"`).join(' OR ')})`;
  const build = (group) => `(${group.map((s) => `subreddit:${s}`).join(' OR ')}) ${terms}`;
  const out = [];
  let group = [];
  for (const sub of subs) {
    if (group.length && build([...group, sub]).length > max) { out.push(build(group)); group = []; }
    group.push(sub);
  }
  if (group.length) out.push(build(group));
  return out;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decode = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    : ENTITIES[e.toLowerCase()] ?? m));

// Atom <content type="html"> is XML-escaped HTML → plain post text (minus the
// "submitted by /u/x [link] [comments]" footer Reddit appends).
const htmlToText = (s) => decode(decode(s).replace(/<!--[\s\S]*?-->/g, '').replace(/<\/p>/g, '\n\n').replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, ''))
  .split(/\s*submitted by\s/)[0].replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();

// Reddit search RSS (Atom) → posts newer than sinceMs.
function parseRedditAtom(xml, sinceMs) {
  return xml.split('<entry>').slice(1).map((e) => {
    const tag = (re) => (e.match(re) || [])[1] || '';
    const id = tag(/<id>t3_([^<]+)<\/id>/);
    const published = tag(/<published>([^<]+)<\/published>/);
    if (!id || Date.parse(published) < sinceMs) return null;
    return {
      id: `reddit:${id}`,
      platform: 'reddit',
      where: `r/${tag(/<category term="([^"]+)"/)}`,
      title: decode(tag(/<title>([^<]*)<\/title>/)),
      body: htmlToText(tag(/<content type="html">([\s\S]*?)<\/content>/)),
      url: decode(tag(/<link href="([^"]+)"/)),
      created: published.slice(0, 10),
    };
  }).filter(Boolean);
}

// Unauthenticated .json is 403 since 2026; the search RSS still answers but
// rate-limits hard (429 after a short burst, IP-wide, lasting minutes) — so a
// couple of batched requests, spaced out, no retry storm.
async function fetchReddit({ days }) {
  const sinceMs = Date.now() - days * 86400e3;
  const t = days <= 1 ? 'day' : days <= 7 ? 'week' : 'month';
  const queries = redditQueries(SUBREDDITS, QUERIES);
  const posts = [];
  let failed = 0;
  for (const [i, q] of queries.entries()) {
    if (i) await sleep(REDDIT_DELAY_MS);
    const url = `https://www.reddit.com/search.rss?q=${encodeURIComponent(q)}&sort=new&t=${t}&limit=100`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (!res.ok) { failed++; console.warn(`  batch ${i + 1}/${queries.length}: HTTP ${res.status}${res.status === 429 ? ' (rate-limited — retry in ~15 min)' : ''}`); continue; }
      const found = parseRedditAtom(await res.text(), sinceMs);
      console.log(`  batch ${i + 1}/${queries.length}: ${found.length}`);
      posts.push(...found);
    } catch (e) {
      failed++;
      console.warn(`  batch ${i + 1}/${queries.length}: ${e.message}`);
    }
  }
  return { posts, allFailed: failed === queries.length };
}

// Search-result URL → canonical { id, url, where }, or null for non-posts
// (profiles, topics, subreddit front pages).
function canonicalPost(raw) {
  let u;
  try { u = new URL(raw); } catch { return null; }
  const parts = u.pathname.split('/').filter(Boolean);
  if (/(^|\.)reddit\.com$/.test(u.hostname)) {
    // /r/<sub>/comments/<id>/<slug>
    if (parts[0] !== 'r' || parts[2] !== 'comments' || !parts[3]) return null;
    return { id: `reddit:${parts[3]}`, url: `https://www.reddit.com/r/${parts[1]}/comments/${parts[3]}/`, where: `r/${parts[1]}`, platform: 'reddit' };
  }
  if (/(^|\.)quora\.com$/.test(u.hostname)) {
    const slug = parts[0];
    if (!slug || ['profile', 'topic', 'q', 'search', 'answer', 'spaces'].includes(slug)) return null;
    const url = `https://www.quora.com/${slug}`;
    return { id: `quora:${url}`, url, where: 'Quora', platform: 'quora' };
  }
  return null;
}

// No Quora API (and Reddit's may vanish) — let Claude's web_search find
// threads, then read result URLs/titles straight off the tool-result blocks
// (no JSON parsing of prose). Titles only: no body text from search results.
async function webSearchPosts(client, domain, topics) {
  const messages = [{
    role: 'user',
    content: `Find recent ${domain} threads/questions (ideally from the last few weeks) on each of these topics. Run one search per topic.\n- ${topics.join('\n- ')}`,
  }];
  const byId = new Map();
  for (let turn = 0; turn < 4; turn++) {
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: topics.length, allowed_domains: [domain] }],
      messages,
    });
    for (const block of res.content) {
      // Error results come back as an object, successes as a list.
      if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue;
      for (const r of block.content) {
        const post = canonicalPost(r.url);
        if (post && !byId.has(post.id)) {
          byId.set(post.id, { ...post, title: (r.title || '').replace(/\s*[-:|]\s*(Quora|r\/\w+|Reddit)\s*$/i, ''), body: '', created: r.page_age || '' });
        }
      }
    }
    if (res.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: res.content }); // resume a paused server-tool turn
  }
  console.log(`  ${domain} (web search): ${byId.size}`);
  return [...byId.values()];
}

async function triage(client, post) {
  // ponytail: cap long self-posts; the title + first 4k chars carry the ask.
  const body = post.body.length > 4000 ? `${post.body.slice(0, 4000)}\n[…truncated]` : post.body;
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    messages: [{
      role: 'user',
      content: `Platform: ${post.platform} (${post.where})\nTitle: ${post.title}\n\n${body || '(no body — title only)'}`,
    }],
  });
  if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') {
    return { route: 'skip', score: 0, why: `model stop: ${res.stop_reason}`, reply: '' };
  }
  const text = res.content.find((b) => b.type === 'text');
  const out = JSON.parse(text.text);
  return { ...out, reply: tagLinks(out.reply, post.platform) };
}

// Bare homepage mentions → UTM-tagged link, so sign-ups show under "By UTM
// source" (utils/attribution.js). NOT ?ref= — that's Refer & Earn: it would be
// stashed as a referrer username (AuthContext) and credit whoever owns it.
// Host-page links (meeticulous.com/<username>) are left alone.
const tagLinks = (reply, platform) => reply.replace(
  /\b(?:https?:\/\/)?(?:www\.)?meeticulous\.com\/?(?![\w/?#-])/gi,
  `https://meeticulous.com/?utm_source=${platform}&utm_medium=comment&utm_campaign=reply-radar`,
);

function toMarkdown(rows, date) {
  const section = (route, heading) => {
    const items = rows.filter((r) => r.route === route).sort((a, b) => b.score - a.score);
    if (!items.length) return '';
    return `## ${heading} (${items.length})\n\n${items.map((r) => [
      `### [${r.score}/10] ${r.title}`,
      `${r.where} · ${r.created} · ${r.url}`,
      `_Why:_ ${r.why}`,
      '',
      '```text',
      r.reply,
      '```',
      '- [ ] posted',
    ].join('\n')).join('\n\n')}\n`;
  };
  const skipped = rows.filter((r) => r.route === 'skip').length;
  return [
    `# Reply Radar — ${date}`,
    '',
    'Drafts only. Read the thread, edit the reply in your own voice, then post it yourself.',
    '',
    section('lead', 'Leads'),
    section('brand', 'Brand / helpful answers'),
    `_${skipped} posts skipped as off-topic or not worth a reply._`,
    '',
  ].join('\n');
}

async function main() {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.out, { recursive: true });
  const seenFile = path.join(args.out, 'seen.json');
  const seen = new Set(fs.existsSync(seenFile) ? JSON.parse(fs.readFileSync(seenFile, 'utf8')) : []);

  const client = args.dry && !args.quora ? null : require('../services/ai/anthropicClient').getClient();
  if (!client && !args.dry) throw new Error('ANTHROPIC_API_KEY missing in server/.env');

  console.log('Reddit…');
  const reddit = await fetchReddit(args);
  const posts = reddit.posts;
  if (reddit.allFailed && client) {
    console.log('Reddit RSS unreachable — falling back to web search…');
    posts.push(...await webSearchPosts(client, 'reddit.com', SEARCH_TOPICS));
  }
  if (args.quora && client) {
    console.log('Quora…');
    posts.push(...await webSearchPosts(client, 'quora.com', SEARCH_TOPICS));
  }
  const fresh = [...new Map(posts.map((p) => [p.id, p])).values()].filter((p) => !seen.has(p.id)).slice(0, args.limit);
  console.log(`${fresh.length} new posts to triage (${posts.length} found, ${seen.size} seen before).`);

  if (args.dry) {
    for (const p of fresh) console.log(`- ${p.where} · ${p.title}\n  ${p.url}`);
    return;
  }

  const rows = [];
  for (const [i, post] of fresh.entries()) {
    try {
      rows.push({ ...post, ...await triage(client, post) });
      seen.add(post.id);
      process.stdout.write(`\r  drafted ${i + 1}/${fresh.length}`);
    } catch (e) {
      console.warn(`\n  ${post.url}: ${e.message}`); // not marked seen → retried next run
    }
  }
  const date = new Date().toISOString().slice(0, 10);
  const file = path.join(args.out, `${date}.md`);
  fs.writeFileSync(file, toMarkdown(rows, date));
  fs.writeFileSync(seenFile, JSON.stringify([...seen]));
  const n = (r) => rows.filter((x) => x.route === r).length;
  console.log(`\nWrote ${file} — ${n('lead')} leads, ${n('brand')} brand, ${n('skip')} skipped.`);
}

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { redditQueries, parseRedditAtom, canonicalPost, tagLinks, toMarkdown };
