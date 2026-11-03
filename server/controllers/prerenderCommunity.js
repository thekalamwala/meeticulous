'use strict';
// Bot HTML for /community pages (spec §15). The edge (client/middleware.js) proxies crawlers,
// Googlebot included, to GET /prerender/community/... — community content is created after
// deploy, so build-time prerender can't cover it. Same shape as resolveProfileMeta:
// resolvers return {status, redirectTo?, buildHtmlArgs?}; render() turns that into HTTP.
// Crawlers never get early access: every resolver 404s while the `community` flag is off.

const store = require('../services/community/store');
const { canView, filterVisible } = require('../services/community/visibility');
const { discussionForumPostingJsonLd, qaPageJsonLd, communityBreadcrumbJsonLd, headlineOf } = require('../services/community/jsonLd');
const { isFeatureEnabled } = require('../services/featureFlags');
const { buildHtml, esc, SITE_URL } = require('./prerenderController');

const SITE = String(SITE_URL).replace(/\/+$/, '');
const SUFFIX = ' — Meeticulous Community';
const LIST = 20;
const REPLIES = 20;
const COMMENT_FETCH = 50; // tombstones are skipped, so read a little past 20
const GONE = ['removed', 'deleted'];
const NOT_FOUND = { status: 404 };
const HOME_DESC = 'Questions, tips and updates from hosts and guests on Meeticulous, the booking platform for independent professionals.';

const flat = (s) => String(s || '').replace(/\s+/g, ' ').trim();
const text = (s) => esc(s).replace(/\n/g, '<br>'); // esc first: <br> is the only markup we add
const day = (ts) => esc(String(ts || '').slice(0, 10));
const abs = (path) => `${SITE}${path}`;
const label = (it) => it.title || flat(it.body).slice(0, 60);
const authorHtml = (a) => (a.profile_url ? `<a href="${esc(abs(a.profile_url))}">${esc(a.display_name)}</a>` : esc(a.display_name));

const anonCtx = async () => ({ viewerId: null, bannedAuthorIds: await store.bannedAuthorIds(), blockedPairs: new Set() });

// Flag first (a read failure counts as off), then a missing community table -> 404, never 500.
const gated = (fn) => async (...args) => {
  if (!(await isFeatureEnabled('community').catch(() => false))) return NOT_FOUND;
  try {
    return await fn(...args);
  } catch (e) {
    if (e.code === 'COMMUNITY_UNAVAILABLE') return NOT_FOUND;
    throw e;
  }
};

const collectionLd = (name, url, description, items) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name,
  url,
  description,
  mainEntity: {
    '@type': 'ItemList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(it.url) })),
  },
});

const itemList = (items) => (items.length
  ? `<ul>${items.map((it) => `<li><a href="${esc(abs(it.url))}">${esc(label(it))}</a></li>`).join('')}</ul>`
  : '<p>No posts yet.</p>');

// Latest visible items (feed, or one space's threads by activity), hydrated for anonymous viewers.
async function latest(opts) {
  const [raw, ctx] = await Promise.all([store.listFeedRows({ cur: null, limit: LIST + 5, ...opts }), anonCtx()]);
  return store.hydrateItems(filterVisible(raw, ctx).slice(0, LIST), null);
}

const resolveCommunityHome = gated(async () => {
  const [items, spaces] = await Promise.all([latest({}), store.listSpaces()]);
  const canonical = abs('/community');
  const spaceLinks = spaces.map((s) => `<li><a href="${esc(abs(`/community/s/${s.key}`))}">${esc(s.name)}</a></li>`).join('');
  return {
    status: 200,
    buildHtmlArgs: {
      title: 'Meeticulous Community',
      description: HOME_DESC,
      canonical,
      robots: 'index,follow',
      jsonLd: collectionLd('Meeticulous Community', canonical, HOME_DESC, items),
      breadcrumbJsonLd: communityBreadcrumbJsonLd(null, null, SITE),
      bodyHtml: [
        '<h1>Meeticulous Community</h1>',
        `<p>${esc(HOME_DESC)}</p>`,
        spaceLinks ? `<section><h2>Spaces</h2><ul>${spaceLinks}</ul></section>` : '',
        `<section><h2>Latest posts</h2>${itemList(items)}</section>`,
        `<p><a href="${esc(abs('/community/guidelines'))}">Community guidelines</a></p>`,
      ].filter(Boolean).join('\n'),
    },
  };
});

const resolveCommunitySpace = gated(async (key) => {
  const space = (await store.listSpaces()).find((s) => s.key === key);
  if (!space) return NOT_FOUND;
  const items = await latest({ spaceId: space.id, sortCol: 'last_activity_at' });
  const canonical = abs(`/community/s/${space.key}`);
  const description = space.description || `${space.name} threads on the Meeticulous Community.`;
  return {
    status: 200,
    buildHtmlArgs: {
      title: `${space.name}${SUFFIX}`,
      description,
      canonical,
      robots: 'index,follow',
      jsonLd: collectionLd(space.name, canonical, description, items),
      breadcrumbJsonLd: communityBreadcrumbJsonLd(null, space, SITE),
      bodyHtml: [
        `<h1>${esc(space.name)}</h1>`,
        `<p>${esc(description)}</p>`,
        `<section><h2>Latest threads</h2>${itemList(items)}</section>`,
        `<p><a href="${esc(abs('/community'))}">Back to the community</a></p>`,
      ].join('\n'),
    },
  };
});

function itemBody(item, replies) {
  const back = item.space ? abs(`/community/s/${item.space.key}`) : abs('/community');
  const replyHtml = replies.map((c) => `<div id="c-${esc(c.id)}"><p>${authorHtml(c.author)} · <time datetime="${esc(c.created_at)}">${day(c.created_at)}</time>${
    c.id === item.accepted_comment_id ? ' · Accepted answer' : ''}</p><p>${text(c.body)}</p></div>`).join('\n');
  return [
    '<article>',
    `<h1>${esc(label(item))}</h1>`,
    `<p>By ${authorHtml(item.author)} · <time datetime="${esc(item.created_at)}">${day(item.created_at)}</time></p>`,
    `<p>${text(item.body)}</p>`,
    replies.length ? `<section><h2>Replies</h2>\n${replyHtml}\n</section>` : '',
    `<p><a href="${esc(back)}">Back to ${esc(item.space ? item.space.name : 'the community')}</a></p>`,
    '</article>',
  ].filter(Boolean).join('\n');
}

// 404 missing/hidden/banned author, 410 removed/deleted, 301 on the wrong t/p prefix.
const resolveCommunityItem = gated(async (prefix, slug) => {
  const row = await store.getPostBySlug(String(slug));
  if (!row) return NOT_FOUND;
  if (GONE.includes(row.status)) return { status: 410 };
  const ctx = await anonCtx();
  if (!canView(row, ctx)) return NOT_FOUND;
  const want = row.kind === 'thread' ? 't' : 'p';
  if (prefix !== want) return { status: 301, redirectTo: abs(`/community/${want}/${row.slug}`) };

  // canView drops tombstones, hidden and banned-author replies (anonymous viewer).
  let shown = filterVisible(await store.listCommentRows(row.id, null, COMMENT_FETCH), ctx).slice(0, REPLIES);
  if (row.accepted_comment_id && !shown.some((c) => c.id === row.accepted_comment_id)) {
    const acc = await store.getComment(row.accepted_comment_id); // QAPage needs it even past the first page
    if (acc && acc.post_id === row.id && canView(acc, ctx)) shown = [...shown, acc];
  }
  const [[item], comments] = await Promise.all([store.hydrateItems([row], null), store.hydrateComments(shown, null)]);

  return {
    status: 200,
    buildHtmlArgs: {
      title: `${label(item)}${SUFFIX}`,
      description: flat(item.body).slice(0, 155) || headlineOf(item),
      canonical: abs(item.url),
      image: item.media[0]?.url, // undefined -> buildHtml's site default card
      robots: item.is_indexable ? 'index,follow' : 'noindex,follow',
      // Google: a Q&A page uses QAPage instead of (not alongside) DiscussionForumPosting.
      jsonLd: qaPageJsonLd(item, comments, SITE) || discussionForumPostingJsonLd(item, comments, SITE),
      breadcrumbJsonLd: communityBreadcrumbJsonLd(item, item.space, SITE),
      bodyHtml: itemBody(item, comments.slice(0, REPLIES)),
    },
  };
});

const GUIDELINES = [
  'Be kind and respectful. No harassment, hate or threats.',
  'No spam, scams or self-promotion outside the right spaces.',
  'Keep bookings on Meeticulous: no phone numbers, emails or off-platform booking links.',
  'Do not name or shame a host. Problems with a booking go to support.',
  'No sexual, violent or illegal content.',
  'Use Report on anything that breaks these rules. Moderators review every report.',
];

const resolveCommunityGuidelines = gated(async () => {
  const canonical = abs('/community/guidelines');
  const description = 'The rules for taking part in the Meeticulous Community, and how to report content.';
  return {
    status: 200,
    buildHtmlArgs: {
      title: `Community guidelines${SUFFIX}`,
      description,
      canonical,
      robots: 'index,follow',
      breadcrumbJsonLd: communityBreadcrumbJsonLd({ title: 'Community guidelines', url: '/community/guidelines' }, null, SITE),
      bodyHtml: [
        '<h1>Community guidelines</h1>',
        `<p>${esc(description)}</p>`,
        `<ul>${GUIDELINES.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>`,
        `<p><a href="${esc(abs('/community'))}">Back to the community</a></p>`,
      ].join('\n'),
    },
  };
});

const GONE_HTML = buildHtml({
  title: `This post was removed${SUFFIX}`,
  description: 'This post is no longer available.',
  canonical: abs('/community'),
  robots: 'noindex,follow',
  bodyHtml: `<h1>This post was removed</h1>\n<p>It is no longer available. <a href="${esc(abs('/community'))}">Back to the community</a></p>`,
});

const render = (resolve) => async (req, res) => {
  try {
    const m = await resolve(req.params);
    if (m.status === 301) return res.redirect(301, m.redirectTo);
    if (m.status === 404 || m.status === 410) {
      res.set('Cache-Control', 'public, max-age=60');
      return m.status === 410 ? res.status(410).type('html').send(GONE_HTML) : res.status(404).send('Not found');
    }
    res.set('Content-Type', 'text/html');
    res.set('Cache-Control', 'public, max-age=120, s-maxage=300');
    return res.send(buildHtml(m.buildHtmlArgs));
  } catch (err) {
    console.error('[prerender] community error:', err.message);
    return res.status(500).send('Error');
  }
};

module.exports = {
  resolveCommunityHome, resolveCommunitySpace, resolveCommunityItem, resolveCommunityGuidelines,
  renderHome: render(() => resolveCommunityHome()),
  renderGuidelines: render(() => resolveCommunityGuidelines()),
  renderSpace: render((p) => resolveCommunitySpace(p.key)),
  renderThread: render((p) => resolveCommunityItem('t', p.slug)),
  renderPost: render((p) => resolveCommunityItem('p', p.slug)),
  renderNotFound: render(async () => NOT_FOUND),
};
