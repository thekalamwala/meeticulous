/**
 * prerenderController.js — Renders minimal HTML meta-tag pages for bot traffic.
 *
 * Reuses the same DB builders (buildHostProfile, buildPublicServiceByProfileAndSlug)
 * as the public API, so admin SEO overrides are always respected. Output is a
 * self-contained HTML document with:
 *   - <title>, meta description, robots
 *   - Open Graph + Twitter Card tags
 *   - Canonical URL
 *   - JSON-LD structured data
 *   - A <noscript> redirect to the real SPA page
 *
 * No React, no JS bundle — just the tags social scrapers and non-JS bots need.
 */

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://meeticulous.com';

const {
  profileFaqs, serviceFaqs, catalogFaqs, catalogSections, updatedLabel, latestUpdate, sameAsFrom,
} = require('../services/seo/pageContentModel');
const {
  cityForSeo, profileMeta, serviceDescription, profileTabMeta, productMeta, courseMeta,
  tierAnchors, catalogRobots, productPath, coursePath, productType, capFirst,
} = require('../services/seo/catalogSeo');
const { cloudinaryHostCard, cloudinaryServiceCard } = require('../services/seo/hostOgCard');

const trimSlash = (s) => String(s || '').replace(/\/+$/, '');
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Google profile photos come back as `=s96-c` — 96px. Facebook's minimum for a
 * link card is 200x200, so a host's own avatar was UNDER the floor and Facebook
 * and WhatsApp rendered no card at all, rather than a small one. The size is just
 * a URL parameter, so ask for one that clears it. Only touches Google's
 * `=s<N>-c` suffix; every other image URL passes through untouched.
 */
const upscaleAvatar = (url) => String(url || '').replace(/=s\d+-c$/, '=s512-c');

// Category slugs → human topic labels for Person.knowsAbout / occupationalCategory
// (e.g. 'startup-advisor' → 'Startup Advisor'). MIRRORS the same helper in the
// client SEO path (client/src/utils/seo.js) — keep both in sync.
const humanizeSlug = (s) => String(s || '').replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
const knowsAboutFrom = (host = {}) => [...new Set(
  [host.primary_category, ...(Array.isArray(host.categories) ? host.categories : [])]
    .filter(Boolean).map(humanizeSlug),
)];

// JSON for a <script type="application/ld+json"> body. `<` -> the JSON escape \u003c so user
// text such as "</script>" in a bio or community post can never close the script element (XSS).
const ldJson = (o) => JSON.stringify(o).replace(/</g, '\\u003c');

function buildHtml({ title, description, canonical, ogTitle, ogDescription, image, robots, jsonLd, faqJsonLd, breadcrumbJsonLd, cardImage, bodyHtml }) {
  const site = trimSlash(SITE_URL);
  const img = image || `${site}/og-image.png`;
  const rob = robots || 'index,follow';
  // Emit 1200x630 size hints only when we KNOW the image is that size: the site
  // fallback card, and (now) a generated host card — both are exactly 1200x630.
  // A service thumbnail is whatever the host uploaded, so declaring a size over
  // it would be a lie scrapers act on; omit the hint and let them measure.
  const knownCard = cardImage || !image;
  const sizeHints = knownCard
    ? '\n<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">'
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${rob}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Meeticulous">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(ogDescription || description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(img)}">${sizeHints}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle || title)}">
<meta name="twitter:description" content="${esc(ogDescription || description)}">
<meta name="twitter:image" content="${esc(img)}">
${jsonLd ? `<script type="application/ld+json">${ldJson(jsonLd)}</script>` : ''}
${faqJsonLd ? `<script type="application/ld+json">${ldJson(faqJsonLd)}</script>` : ''}
${breadcrumbJsonLd ? `<script type="application/ld+json">${ldJson(breadcrumbJsonLd)}</script>` : ''}
</head>
<body>
${bodyHtml || `<p>Redirecting to <a href="${esc(canonical)}">${esc(title)}</a>...</p>`}
</body>
</html>`;
}

// ── Visible body ──────────────────────────────────────────────────────────────
// The shell used to ship a one-line "Redirecting…" stub, so AI answer engines and
// non-JS crawlers had NO extractable prose — only <head> JSON-LD — and the AEO
// "answer structure" dimension scored ~0 on host + service pages (the two largest
// URL classes). These builders render the SAME data the <head> schema + the public
// SPA already carry into a real body: headings, service list, visible FAQ Q&A,
// reviews, internal links. Bot-only route, so no human-UX change; content is sourced
// from the same helpers the SPA renders, so served HTML matches what guests see.

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

function faqSection(faqs) {
  const items = (faqs || []).filter((f) => f && f.q && f.a);
  if (!items.length) return '';
  return `<section><h2>Frequently asked questions</h2>${
    items.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')
  }</section>`;
}

function reviewSection(reviews, heading) {
  const items = (reviews || []).map((r) => r && (r.comment || r.text)).filter(Boolean).slice(0, 3);
  if (!items.length) return '';
  return `<section><h2>${esc(heading)}</h2>${
    items.map((t) => `<blockquote>“${esc(t)}”</blockquote>`).join('')
  }</section>`;
}

// Headed, self-contained sections (catalogSections in pageContentModel — the
// same blocks the SPA renders): h2 + paragraphs + bullet list + ordered steps.
function sectionsHtml(sections) {
  return (sections || []).map((sec) => [
    `<section><h2>${esc(sec.heading)}</h2>`,
    ...(sec.paras || []).map((t) => `<p>${esc(t)}</p>`),
    (sec.list || []).length ? `<ul>${sec.list.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : '',
    (sec.steps || []).length ? `<ol>${sec.steps.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : '',
    '</section>',
  ].join('')).join('\n');
}

function hostBody(payload) {
  const { host = {}, services = [], reviews = [] } = payload || {};
  const site = trimSlash(SITE_URL);
  const name = host.name || 'Host';
  const out = [`<h1>${esc(name)}</h1>`];
  // No answer-first summary line and no "About" stats block on the profile
  // (founder 2026-11-28), mirroring the SPA. Both facts stay in the meta
  // description and the Person schema.
  if (host.profession) out.push(`<p>${esc(host.profession)}${host.location ? ` · ${esc(host.location)}` : ''}</p>`);
  if (host.bio) out.push(`<p>${esc(host.bio)}</p>`);

  const bookable = (services || []).filter((s) => s && s.title);
  if (bookable.length) {
    out.push(`<section><h2>Services you can book with ${esc(name)}</h2><ul>`);
    for (const s of bookable) {
      const url = s.slug ? `${site}/${esc(host.username)}/${esc(s.slug)}` : null;
      const label = url ? `<a href="${url}">${esc(s.title)}</a>` : esc(s.title);
      const price = s.price_on_request ? ' — Price on request'
        : Number(s.price) > 0 ? ` — ${inr(s.price)}` : (s.price === 0 ? ' — Free' : '');
      const desc = s.short_description ? `: ${esc(s.short_description)}` : '';
      out.push(`<li>${label}${price}${desc}</li>`);
    }
    out.push(`</ul></section>`);
  }

  out.push(faqSection(profileFaqs(host, services)));
  out.push(reviewSection(reviews, `What guests say about ${name}`));
  return out.filter(Boolean).join('\n');
}

function serviceBody(payload) {
  const { service = {}, vendor = {}, reviews = [] } = payload || {};
  const site = trimSlash(SITE_URL);
  const title = service.title || 'Service';
  const out = [`<h1>${esc(title)}</h1>`];

  if (vendor.name) {
    const vurl = vendor.username ? `${site}/${esc(vendor.username)}` : null;
    out.push(`<p>With ${vurl ? `<a href="${vurl}">${esc(vendor.name)}</a>` : esc(vendor.name)}</p>`);
  }

  const meta = [];
  if (service.price_on_request) meta.push('Price on request');
  else if (Number(service.price) > 0) meta.push(inr(service.price));
  else if (service.price === 0) meta.push('Free');
  if (service.duration) meta.push(`${service.duration} min`);
  meta.push(service.meeting_mode === 'offline' ? 'In person' : 'Online');
  out.push(`<p>${esc(meta.join(' · '))}</p>`);

  if (service.short_description) out.push(`<p>${esc(service.short_description)}</p>`);
  if (service.description) out.push(`<p>${esc(service.description)}</p>`);

  const inc = (service.included_items || []).filter(Boolean);
  if (inc.length) {
    out.push(`<section><h2>What's included</h2><ul>${inc.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></section>`);
  }

  out.push(faqSection(serviceFaqs(service, vendor)));
  out.push(reviewSection(reviews, `Reviews of ${title}`));
  return out.filter(Boolean).join('\n');
}

// ── Profile ─────────────────────────────────────────────────────────────────

// Pure resolver: DB lookup + meta computation only, no res.* calls. Extracted
// so the SEO crawler can get a host page's real meta/indexability in-process
// (no HTTP round-trip, so Cloudflare's bot-UA block never applies to it).
// Returns { status: 200, buildHtmlArgs } | { status: 404 } | { status: 301, redirectTo }.
// FAQPage node from [{q,a}]. Kept here (not imported from client utils/seo) so the
// server prerender shell has no client dependency; shape matches faqJsonLd there.
// cityForSeo (local-SEO city from free-text profiles.location) lives in
// services/seo/catalogSeo.js with the other meta templates; it mirrors client
// utils/seo.js cityForSeo VERBATIM.

// ── Host entity graph (bot-shell mirror of client/src/utils/seo.js) ───────────
//
// buildProfileGraph / buildServiceGraph emit the SAME single @graph the client
// builders (profileGraphJsonLd / serviceGraphJsonLd) emit for the same input — the
// host is one `Person` entity (@id `${site}/${username}#person`) linked by @id
// across the profile and every service. The client/server parity test proves these
// stay deep-equal. Every node below mirrors its client counterpart VERBATIM; change
// one, change both. (Product pages are client-only — not in this bot shell.)

const LOGO_URL = (site) => `${site}/web-app-manifest-512x512.png`;
const websiteNode = (site) => ({
  '@type': 'WebSite', '@id': `${site}/#website`, url: `${site}/`,
  name: 'Meeticulous', publisher: { '@id': `${site}/#organization` }, inLanguage: 'en-IN',
});
// Mirrors client orgNode (utils/seo.js) + its ORG_LEGAL_NAME / ORG_CONTACT_POINT /
// ORG_SAME_AS. Keep sameAs identical to client ORG_SAME_AS (seo.js) — the graph
// parity suites (seoGraphParity.test.js + prerenderGraphParity.test.js) fail if they drift.
const ORG_SAME_AS = [
  'https://www.linkedin.com/company/meeticulous',
  'https://www.instagram.com/meeticulousapp',
  'https://www.facebook.com/meeticulousapp',
  'https://x.com/meeticulous',
];
const orgNode = (site) => ({
  '@type': 'Organization', '@id': `${site}/#organization`, name: 'Meeticulous',
  legalName: 'Rajmudra Media LLP', url: `${site}/`,
  logo: { '@type': 'ImageObject', '@id': `${site}/#logo`, url: LOGO_URL(site), contentUrl: LOGO_URL(site), width: 512, height: 512 },
  description: 'Online booking and appointment scheduling platform for coaches, consultants, therapists, and small businesses.',
  contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: 'team@meeticulous.com', availableLanguage: ['en', 'hi'] },
  ...(ORG_SAME_AS.length ? { sameAs: ORG_SAME_AS } : {}),
});
const aggregateRatingNode = (avg, count) =>
  ({ '@type': 'AggregateRating', ratingValue: avg, reviewCount: count, bestRating: 5, worstRating: 1 });
const abs = (site, p) => (/^https?:/i.test(p) ? p : `${site}${String(p || '').startsWith('/') ? '' : '/'}${p || ''}`);
const breadcrumbNode = (items, site, id) => ({
  '@type': 'BreadcrumbList', '@id': id,
  itemListElement: (items || []).filter((it) => it && it.name && it.path)
    .map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(site, it.path) })),
});
const faqGraphNode = (faqs, id) => ({
  '@type': 'FAQPage', '@id': id,
  mainEntity: (faqs || []).filter((f) => f && f.q && f.a)
    .map((f) => ({ '@type': 'Question', name: String(f.q), acceptedAnswer: { '@type': 'Answer', text: String(f.a) } })),
});
// Host Person stub (same @id as the profile's full Person) + sameAs from
// social_links. Mirrors client personStubNode.
const personStubNode = ({ host = {}, site } = {}) => {
  const url = host.username ? `${site}/${host.username}` : site;
  const sameAs = sameAsFrom(host);
  return { '@type': 'Person', '@id': `${url}#person`, name: host.name || 'Host', url, ...(sameAs.length ? { sameAs } : {}) };
};

// host: profiles row; services: public service rows; rating: {avg,count}; faqs: [{q,a}].
function buildProfileGraph({ host = {}, services = [], rating = null, faqs = [], site, name } = {}) {
  const url = host.username ? `${site}/${host.username}` : site;
  const sameAs = sameAsFrom(host);
  const knowsAbout = knowsAboutFrom(host);
  const hasOffline = (services || []).some((s) => s && s.meeting_mode === 'offline');
  const city = hasOffline ? cityForSeo(host.location) : null;
  const offers = (Array.isArray(services) ? services : []).filter((s) => s && s.title).map((s) => ({
    '@type': 'Offer',
    ...(s.price_on_request ? {} : { price: String(s.price ?? 0), priceCurrency: s.currency || 'INR' }),
    url: s.slug ? `${url}/${s.slug}` : url,
    itemOffered: { '@id': s.slug ? `${url}/${s.slug}#service` : `${url}#service` },
  }));
  const person = {
    '@type': 'Person',
    '@id': `${url}#person`,
    name: host.name || 'Host',
    url,
    jobTitle: host.profession || undefined,
    description: host.seo_description || host.bio || undefined,
    image: upscaleAvatar(host.seo_image || host.profile_image) || undefined,
    ...(sameAs.length ? { sameAs } : {}),
    ...(host.profession ? {
      hasOccupation: {
        '@type': 'Occupation', name: host.profession,
        ...(host.primary_category ? { occupationalCategory: humanizeSlug(host.primary_category) } : {}),
      },
    } : {}),
    ...(knowsAbout.length ? { knowsAbout } : {}),
    ...(city ? { workLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: city, addressCountry: 'IN' } } } : {}),
    ...(offers.length ? { makesOffer: offers } : {}),
    ...(rating && rating.count > 0 && rating.avg > 0 ? { aggregateRating: aggregateRatingNode(rating.avg, rating.count) } : {}),
  };
  const graph = [
    websiteNode(site),
    orgNode(site),
    {
      '@type': 'ProfilePage', '@id': url, url,
      ...(name ? { name } : {}),
      inLanguage: 'en-IN',
      ...(host.updated_at ? { dateModified: host.updated_at } : {}),
      isPartOf: { '@id': `${site}/#website` },
      publisher: { '@id': `${site}/#organization` },
      mainEntity: { '@id': person['@id'] },
      breadcrumb: { '@id': `${url}#breadcrumb` },
    },
    person,
    breadcrumbNode([
      { name: 'Home', path: '/' },
      { name: host.name || 'Host', path: `/${host.username}` },
    ], site, `${url}#breadcrumb`),
  ];
  if (faqs && faqs.length) graph.push(faqGraphNode(faqs, `${url}#faq`));
  return { '@context': 'https://schema.org', '@graph': graph };
}

function buildServiceGraph({ service = {}, vendor = {}, avgRating, reviewCount, faqs = [], site } = {}) {
  const hostUrl = vendor.username ? `${site}/${vendor.username}` : site;
  const url = vendor.username && service.slug ? `${site}/${vendor.username}/${service.slug}` : site;
  const offline = service.meeting_mode === 'offline';
  const city = offline ? cityForSeo(vendor.location) : null;
  const duration = Number(service.duration);
  const serviceNode = {
    '@type': 'Service',
    '@id': `${url}#service`,
    name: service.title || 'Service',
    url,
    description: service.seo_description || service.short_description || service.description || undefined,
    ...(service.category_label ? { serviceType: service.category_label } : {}),
    ...(vendor.profession ? { category: vendor.profession } : {}),
    ...(service.seo_image || service.thumbnail_url ? { image: service.seo_image || service.thumbnail_url } : {}),
    ...(service.updated_at ? { dateModified: service.updated_at } : {}),
    provider: { '@id': `${hostUrl}#person` },
    areaServed: city ? { '@type': 'City', name: city } : { '@type': 'Country', name: 'India' },
    availableChannel: {
      '@type': 'ServiceChannel',
      serviceUrl: vendor.username && service.slug ? `${site}/${vendor.username}/booking/${service.slug}` : url,
      availableLanguage: { '@type': 'Language', name: 'English' },
    },
    offers: {
      '@type': 'Offer',
      ...(service.price_on_request ? {} : { price: String(service.price ?? 0), priceCurrency: service.currency || 'INR' }),
      availability: 'https://schema.org/InStock',
      url,
      ...(duration > 0 ? { eligibleDuration: { '@type': 'QuantitativeValue', value: duration, unitCode: 'MIN' } } : {}),
    },
    ...(reviewCount > 0 && avgRating > 0 ? { aggregateRating: aggregateRatingNode(avgRating, reviewCount) } : {}),
  };
  const graph = [
    websiteNode(site),
    orgNode(site),
    serviceNode,
    personStubNode({ host: vendor, site }),
    breadcrumbNode([
      { name: 'Home', path: '/' },
      { name: vendor.name || vendor.username, path: `/${vendor.username}` },
      { name: service.title, path: `/${vendor.username}/${service.slug}` },
    ], site, `${url}#breadcrumb`),
  ];
  if (faqs && faqs.length) graph.push(faqGraphNode(faqs, `${url}#faq`));
  return { '@context': 'https://schema.org', '@graph': graph };
}

async function resolveProfileMeta(username) {
  const { buildHostProfile } = require('./hostController');
  const { sameAsFrom, profileFaqs } = require('../services/seo/pageContentModel');
  const outcome = await buildHostProfile(username);

  if (outcome.notFound || outcome.redirect) {
    if (outcome.redirect) {
      return { status: 301, redirectTo: `${trimSlash(SITE_URL)}/${outcome.username}` };
    }
    return { status: 404 };
  }

  const { host, services } = outcome.payload;
  const avgRating = outcome.payload.avgRating || 0;
  const reviewCount = (outcome.payload.reviews || []).length;
  const site = trimSlash(SITE_URL);
  const name = host.name || 'Host';

  // Answer-first title + description from real data (profileMeta — mirrors client
  // resolveProfileSeo); admin seo_* overrides still win. The rating clause appears
  // only with real reviews of this host.
  const meta = profileMeta({ host, services, rating: { avg: avgRating, count: reviewCount } });
  const title = host.seo_title || meta.title;
  const description = host.seo_description || meta.description;
  const canonical = `${site}/${host.username}`;
  // og:image is a SHARE CARD, not the avatar. A square Google photo letterboxes
  // inside a summary_large_image card, so we serve a 1200x630 host card instead.
  // The card is a Cloudinary URL composited on first crawl from the committed
  // background + brand marks + this host's photo (services/seo/hostOgCard) — no
  // pre-generation, no storage, never stale. Order: admin override (og_image) ->
  // Cloudinary card -> static site default (when CLOUDINARY_CLOUD is unset or the
  // card can't be built). The host's own photo feeds JSON-LD Person.image below.
  const ogCard = host.og_image
    || cloudinaryHostCard({
      name,
      avatar: host.profile_image,
      profession: host.profession,
      city: cityForSeo(host.location),
      handle: host.username,
      bio: host.seo_description || host.bio,
    })
    || `${site}/og-image.png`;

  // One @graph (ProfilePage + Person + Breadcrumb + optional FAQPage), @id-linked,
  // mirroring client profileGraphJsonLd. Person.image is the upscaled host photo
  // (same seo_image/profile_image source the builder reads).
  // Only emit the FAQPage when the host has host-specific facts (services or a
  // profession); generic template FAQs are thin (guide §5.3). MIRRORS the client
  // HostProfile gate — keep in sync.
  const faqsHostSpecific = (services || []).length > 0 || !!host.profession;
  const jsonLd = buildProfileGraph({
    host, services, site, name: title,
    rating: { avg: avgRating, count: reviewCount },
    faqs: faqsHostSpecific ? profileFaqs(host, services) : [],
  });

  const buildHtmlArgs = {
    title,
    description,
    canonical,
    // Share-card copy is its own fixed voice — the SAME line across every host
    // profile, deliberately NOT derived from bio/profession. The <title>/meta
    // description above stay SEO-flavoured for Google; these OG tags carry the
    // brand share line. Explicit og_/seo_ fields still override when set.
    ogTitle: host.og_title || host.seo_title || `${name} — now taking bookings on Meeticulous.`,
    ogDescription: host.og_description || host.seo_description
      || `Skip the back-and-forth — ${name}'s calendar is open. Book a slot with them.`,
    image: ogCard,
    cardImage: true, // ogCard is always a known 1200x630 card (generated or site default)
    // No bookable service = thin profile: noindex but keep links followable.
    // Mirrors client resolveProfileSeo + the sitemap host filter.
    // Honest signal matching the sitemap host filter: unverified hosts are excluded
    // from the sitemap, so their profile must not say "index me" either.
    robots: host.is_indexable === false ? 'noindex,nofollow'
      : host.is_verified !== true ? 'noindex,follow'
      : (services || []).length ? 'index,follow' : 'noindex,follow',
    // FAQPage + BreadcrumbList are now members of the single jsonLd @graph above.
    jsonLd,
  };

  // payload is passed through (additive) so the SEO crawler can build a DB-derived
  // content model for this bodiless page — see services/seo/pageContentModel.js.
  return { status: 200, buildHtmlArgs, payload: outcome.payload, summary: meta.description };
}

const renderProfileMeta = async (req, res) => {
  try {
    const m = await resolveProfileMeta(req.params.username);
    if (m.status === 404) return res.status(404).send('Not found');
    if (m.status === 301) return res.redirect(301, m.redirectTo);

    const html = buildHtml({ ...m.buildHtmlArgs, bodyHtml: hostBody(m.payload) });
    res.set('Content-Type', 'text/html');
    res.set('Cache-Control', 'public, max-age=120, s-maxage=300');
    res.send(html);
  } catch (err) {
    console.error('[prerender] profile error:', err.message);
    res.status(500).send('Error');
  }
};

// ── Catalog graphs (mirror client utils/seo.js) ─────────────────────────────
// Product, course, profile tabs, membership: ONE @graph each — WebSite, Org, the
// page entity, the host Person stub, BreadcrumbList (Home › {Name} › {Tab} ›
// {Item}) and a FAQPage only when the page renders that FAQ. Slug-only URLs.
// Deep-equal to the client builders (parity fixture); change one, change both.
const TAB_CRUMB = { products: 'Products', courses: 'Courses', membership: 'Membership' };
const IN_STOCK = 'https://schema.org/InStock';
// datePublished / dateModified from a row's created_at / updated_at (freshness).
const rowDates = (row = {}) => ({
  ...(row.created_at ? { datePublished: row.created_at } : {}),
  ...(row.updated_at ? { dateModified: row.updated_at } : {}),
});
const newest = (rows = []) => (rows || []).map((r) => r && r.updated_at).filter(Boolean).sort().pop();

const catalogCrumbs = (host, tab, item) => [
  { name: 'Home', path: '/' },
  { name: host.name || host.username, path: `/${host.username}` },
  { name: TAB_CRUMB[tab], path: `/${host.username}/${tab}` },
  ...(item ? [{ name: item.name, path: item.path }] : []),
];

const withFaq = (graph, faqs, url) => {
  if (faqs && faqs.length) graph.push(faqGraphNode(faqs, `${url}#faq`));
  return { '@context': 'https://schema.org', '@graph': graph };
};

function buildProductGraph({ product = {}, username, site, faqs = [] } = {}) {
  const host = { ...(product.profiles || {}), username: username || (product.profiles || {}).username };
  const hostUrl = `${site}/${host.username}`;
  const url = product.slug ? `${site}${productPath(host.username, product.slug)}` : `${hostUrl}/products`;
  const productNode = {
    '@type': 'Product',
    '@id': `${url}#product`,
    name: product.title || 'Digital product',
    url,
    description: product.description || undefined,
    category: capFirst(productType(product.type)),
    ...(product.thumbnail_url ? { image: product.thumbnail_url } : {}),
    offers: {
      '@type': 'Offer',
      price: String(product.price ?? 0),
      priceCurrency: product.currency || 'INR',
      availability: IN_STOCK,
      url,
      seller: { '@id': `${hostUrl}#person` },
    },
  };
  const pageNode = {
    '@type': 'ItemPage', '@id': `${url}#webpage`, url, name: productNode.name, inLanguage: 'en-IN',
    isPartOf: { '@id': `${site}/#website` }, breadcrumb: { '@id': `${url}#breadcrumb` },
    mainEntity: { '@id': productNode['@id'] }, ...rowDates(product),
  };
  return withFaq([
    websiteNode(site), orgNode(site), pageNode, productNode, personStubNode({ host, site }),
    breadcrumbNode(catalogCrumbs(host, 'products', product.slug && { name: productNode.name, path: productPath(host.username, product.slug) }), site, `${url}#breadcrumb`),
  ], faqs, url);
}

function buildCourseGraph({ course = {}, username, site, faqs = [] } = {}) {
  const host = { ...(course.profiles || {}), username: username || (course.profiles || {}).username };
  const hostUrl = `${site}/${host.username}`;
  const url = course.slug ? `${site}${coursePath(host.username, course.slug)}` : `${hostUrl}/courses`;
  const name = course.title || 'Course';
  const price = Number(course.price ?? 0);
  const courseNode = {
    '@type': 'Course',
    '@id': `${url}#course`,
    name,
    url,
    description: course.description || `${name} — an online course by ${host.name || 'the host'}.`,
    ...(course.thumbnail_url ? { image: course.thumbnail_url } : {}),
    provider: { '@id': `${hostUrl}#person` },
    inLanguage: 'en',
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online' },
    ...rowDates(course),
    offers: {
      '@type': 'Offer',
      category: price > 0 ? 'Paid' : 'Free',
      price: String(price),
      priceCurrency: course.currency || 'INR',
      availability: IN_STOCK,
      url,
    },
  };
  return withFaq([
    websiteNode(site), orgNode(site), courseNode, personStubNode({ host, site }),
    breadcrumbNode(catalogCrumbs(host, 'courses', course.slug && { name, path: coursePath(host.username, course.slug) }), site, `${url}#breadcrumb`),
  ], faqs, url);
}

function buildProfileTabGraph({ tab, host = {}, items = [], site, name, description, faqs = [] } = {}) {
  const hostUrl = `${site}/${host.username}`;
  const url = `${hostUrl}/${tab}`;
  const toPath = tab === 'courses' ? coursePath : productPath;
  const listed = (items || []).filter((i) => i && i.slug && i.title);
  return withFaq([
    websiteNode(site), orgNode(site),
    {
      '@type': 'CollectionPage', '@id': url, url,
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
      inLanguage: 'en-IN',
      ...(newest(listed) ? { dateModified: newest(listed) } : {}),
      isPartOf: { '@id': `${site}/#website` },
      about: { '@id': `${hostUrl}#person` },
      mainEntity: { '@id': `${url}#list` },
      breadcrumb: { '@id': `${url}#breadcrumb` },
    },
    {
      '@type': 'ItemList', '@id': `${url}#list`, numberOfItems: listed.length,
      itemListElement: listed.map((i, n) => ({ '@type': 'ListItem', position: n + 1, url: `${site}${toPath(host.username, i.slug)}`, name: i.title })),
    },
    personStubNode({ host, site }),
    breadcrumbNode(catalogCrumbs(host, tab), site, `${url}#breadcrumb`),
  ], faqs, url);
}

function buildMembershipGraph({ host = {}, program = {}, tiers = [], site, name, description, faqs = [] } = {}) {
  const hostUrl = `${site}/${host.username}`;
  const url = `${hostUrl}/membership`;
  const live = (tiers || []).filter((t) => t && t.name);
  const anchors = tierAnchors(live);
  const prog = (program && program.name) || 'Membership';
  return withFaq([
    websiteNode(site), orgNode(site),
    {
      '@type': 'CollectionPage', '@id': url, url,
      ...(name ? { name } : {}),
      ...(description ? { description } : {}),
      inLanguage: 'en-IN',
      ...rowDates(program || {}),
      isPartOf: { '@id': `${site}/#website` },
      about: { '@id': `${hostUrl}#person` },
      mainEntity: { '@id': `${url}#list` },
      breadcrumb: { '@id': `${url}#breadcrumb` },
    },
    {
      '@type': 'ItemList', '@id': `${url}#list`, numberOfItems: live.length,
      itemListElement: live.map((t, i) => {
        const tierUrl = `${url}#${anchors[i]}`;
        const price = t.type === 'free' ? 0 : Number(t.price_inr) || 0;
        const perks = (Array.isArray(t.perks) ? t.perks : []).filter(Boolean);
        return {
          '@type': 'ListItem', position: i + 1,
          item: {
            '@type': 'Product', '@id': tierUrl, name: `${prog} — ${t.name}`, url: tierUrl,
            ...(t.description || perks.length ? { description: t.description || perks.join('; ') } : {}),
            ...(t.cover_url ? { image: t.cover_url } : {}),
            offers: {
              '@type': 'Offer', price: String(price), priceCurrency: 'INR', availability: IN_STOCK, url: tierUrl,
              seller: { '@id': `${hostUrl}#person` },
              ...(price > 0 ? {
                priceSpecification: {
                  '@type': 'UnitPriceSpecification', price: String(price), priceCurrency: 'INR',
                  billingDuration: 'P1M', unitCode: 'MON',
                },
              } : {}),
            },
          },
        };
      }),
    },
    personStubNode({ host, site }),
    breadcrumbNode(catalogCrumbs(host, 'membership'), site, `${url}#breadcrumb`),
  ], faqs, url);
}

// ── Profile tabs (/:username/products|courses|membership) ───────────────────

// The tab's published items, in the host's own order — the same rows the SPA
// lists (GET /products|courses/host/:username, /memberships/space/:username).
// Membership only while `community_memberships` is on. Never throws.
async function loadTabItems(hostId, tab) {
  const { supabaseAdmin } = require('../config/supabase');
  try {
    if (tab === 'membership') {
      const { isFeatureEnabled } = require('../services/featureFlags');
      if (!(await isFeatureEnabled('community_memberships').catch(() => false))) return { items: [] };
      // select('*') like getPublicSpace: tier cover_url/description (v3.228) may not exist yet.
      const { data } = await supabaseAdmin.from('community_membership_programs')
        .select('*, tiers:community_membership_tiers(*)')
        .eq('host_id', hostId).eq('status', 'live').maybeSingle();
      if (!data) return { items: [] };
      const tiers = (data.tiers || []).filter((t) => t.status === 'live').sort((a, b) => (a.position || 0) - (b.position || 0));
      return { items: tiers, program: { name: data.name, blurb: data.blurb, cover_url: data.cover_url, created_at: data.created_at || null, updated_at: data.updated_at || null } };
    }
    const { applyHostOrder } = require('../services/catalogOrder');
    const cols = tab === 'courses'
      ? 'id, title, description, price, thumbnail_url, slug, created_at, updated_at, course_lessons(id, title, sort_order)'
      : 'id, title, description, type, price, thumbnail_url, slug, created_at, updated_at';
    const { data, error } = await supabaseAdmin.from(tab).select(cols).eq('host_id', hostId).eq('is_active', true);
    if (error || !data) return { items: [] };
    const rows = tab === 'courses'
      ? data.map(({ course_lessons: l, ...c }) => ({
        ...c,
        lesson_count: (l || []).length,
        lessons: [...(l || [])].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((x) => x.title).filter(Boolean),
      }))
      : data;
    return { items: await applyHostOrder(tab, hostId, rows) };
  } catch (_) {
    return { items: [] };
  }
}

// The profile shell with the tab's own title/description/canonical, a
// CollectionPage + ItemList graph and a body listing the items. A tab the host
// does not have answers a 301 to the profile (the SPA redirects there too).
async function resolveProfileTabMeta(username, tab) {
  const m = await resolveProfileMeta(username);
  if (m.status === 301) return { status: 301, redirectTo: `${m.redirectTo}/${tab}` };
  if (m.status !== 200) return m;
  const { host } = m.payload;
  const site = trimSlash(SITE_URL);
  const { items, program = null } = await loadTabItems(host.id, tab);
  if (!items.length) return { status: 301, redirectTo: `${site}/${host.username}` };
  const { title, description } = profileTabMeta({ tab, host, items, program });
  const faqs = catalogFaqs({ kind: tab, host, items, program });
  const jsonLd = tab === 'membership'
    ? buildMembershipGraph({ host, program: program || {}, tiers: items, site, name: title, description, faqs })
    : buildProfileTabGraph({ tab, host, items, site, name: title, description, faqs });
  return {
    ...m,
    tab, items, program, faqs, summary: description,
    buildHtmlArgs: {
      ...m.buildHtmlArgs,
      title, description, ogTitle: title, ogDescription: description,
      canonical: `${site}/${host.username}/${tab}`,
      jsonLd,
    },
  };
}

// Visible bot-shell body for a tab: h1, answer-first summary, the items (linked
// to their slug URLs), the FAQ, a link back to the profile.
function tabBody(m) {
  const { host = {} } = m.payload || {};
  const site = trimSlash(SITE_URL);
  const name = host.name || 'Host';
  const u = esc(host.username);
  const updated = updatedLabel(m.tab === 'membership' ? (m.program && m.program.updated_at) : latestUpdate(m.items));
  const sections = catalogSections({ kind: m.tab, host, items: m.items, program: m.program });
  const out = [];
  if (m.tab === 'membership') {
    const prog = (m.program && m.program.name) || '';
    out.push(`<h1>${esc(prog ? `${prog} — membership by ${name}` : `Membership by ${name}`)}</h1>`);
    if (updated) out.push(`<p>${esc(updated)}</p>`);
    if (m.program && m.program.blurb) out.push(`<p>${esc(m.program.blurb)}</p>`);
    const anchors = tierAnchors(m.items);
    m.items.forEach((t, i) => {
      const price = t.type === 'free' || !(Number(t.price_inr) > 0) ? 'Free' : `${inr(t.price_inr)}/month`;
      const perks = (Array.isArray(t.perks) ? t.perks : []).filter(Boolean);
      out.push(`<section id="${esc(anchors[i])}"><h3>${esc(t.name)}</h3><p>${esc(price)}</p>${t.description ? `<p>${esc(t.description)}</p>` : ''}${perks.length ? `<ul>${perks.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}</section>`);
    });
    out.push(sectionsHtml(sections));
  } else {
    const label = m.tab === 'courses' ? 'Online courses' : 'Digital products';
    // No summary line under the h1 (founder 2026-11-28), mirroring the SPA tab.
    out.push(`<h1>${esc(`${label} by ${name}`)}</h1>`);
    if (updated) out.push(`<p>${esc(updated)}</p>`);
    out.push(sectionsHtml(sections.filter((x) => x.key === 'intro')));
    for (const i of m.items) {
      if (!i.slug || !i.title) continue;
      const path = (m.tab === 'courses' ? coursePath : productPath)(host.username, i.slug);
      const price = Number(i.price) > 0 ? inr(i.price) : 'Free';
      const extra = m.tab === 'courses' ? ` · ${i.lesson_count || 0} lessons` : '';
      const lessons = (i.lessons || []).length ? `<p>Lessons: ${esc(i.lessons.join(', '))}</p>` : '';
      out.push(`<article><h3><a href="${site}${esc(path)}">${esc(i.title)}</a></h3><p>${esc(price)}${esc(extra)}</p>${i.description ? `<p>${esc(i.description)}</p>` : ''}${lessons}</article>`);
    }
    out.push(sectionsHtml(sections.filter((x) => x.key !== 'intro')));
  }
  out.push(faqSection(m.faqs));
  out.push(`<p><a href="${site}/${u}">See everything ${esc(name)} offers</a></p>`);
  return out.filter(Boolean).join('\n');
}

const renderProfileTabMeta = async (req, res) => {
  try {
    const m = await resolveProfileTabMeta(req.params.username, req.params.tab);
    if (m.status === 404) return res.status(404).send('Not found');
    if (m.status === 301) return res.redirect(301, m.redirectTo);
    const html = buildHtml({ ...m.buildHtmlArgs, bodyHtml: tabBody(m) });
    res.set('Content-Type', 'text/html');
    res.set('Cache-Control', 'public, max-age=120, s-maxage=300');
    res.send(html);
  } catch (err) {
    console.error('[prerender] profile tab error:', err.message);
    res.status(500).send('Error');
  }
};

// ── Catalog items (/:username/products|courses/:slug) ────────────────────────

const CATALOG_COLS = {
  products: 'id, title, description, type, price, thumbnail_url, slug, created_at, updated_at',
  courses: 'id, title, description, price, thumbnail_url, slug, created_at, updated_at, course_lessons(id, title, sort_order)',
};

// kind: 'products' | 'courses'. key: slug, old id or legacy slug. Returns
// { status: 200, buildHtmlArgs, ... } | { status: 404 } | { status: 301, redirectTo }
// — a 301 whenever the key is not the canonical slug, so an id / old slug never
// stays the public URL.
async function resolveCatalogMeta(kind, username, key) {
  const m = await resolveProfileMeta(username);
  if (m.status === 404) return m;
  if (m.status === 301) return { status: 301, redirectTo: `${m.redirectTo}/${kind}/${encodeURIComponent(key)}` };
  const { host } = m.payload;
  const site = trimSlash(SITE_URL);
  const { resolveCatalogItem } = require('../services/catalogSlug');
  const { data: row } = await resolveCatalogItem(kind, host.id, key, CATALOG_COLS[kind]);
  if (!row || !row.slug) return { status: 404 };
  const path = (kind === 'courses' ? coursePath : productPath)(host.username, row.slug);
  if (row.slug !== key) return { status: 301, redirectTo: `${site}${path}` };

  const item = kind === 'courses'
    ? {
      ...row,
      course_lessons: (row.course_lessons || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((l) => ({ id: l.id, title: l.title })),
      lesson_count: (row.course_lessons || []).length,
    }
    : row;
  const withHost = { ...item, profiles: host };
  const meta = kind === 'courses' ? courseMeta({ course: item, host }) : productMeta({ product: item, host });
  const faqs = catalogFaqs({ kind: kind === 'courses' ? 'course' : 'product', host, item });
  const jsonLd = kind === 'courses'
    ? buildCourseGraph({ course: withHost, username: host.username, site, faqs })
    : buildProductGraph({ product: withHost, username: host.username, site, faqs });
  return {
    status: 200, kind, item, faqs, summary: meta.description, payload: m.payload,
    buildHtmlArgs: {
      title: meta.title,
      description: meta.description,
      canonical: `${site}${path}`,
      ogTitle: meta.title,
      ogDescription: meta.description,
      // The item's own cover, else the host's 1200x630 share card (profile shell).
      image: item.thumbnail_url || m.buildHtmlArgs.image,
      cardImage: !item.thumbnail_url,
      robots: catalogRobots(host),
      jsonLd,
    },
  };
}

function itemBody(m) {
  const { host = {} } = m.payload || {};
  const site = trimSlash(SITE_URL);
  const { item } = m;
  const name = host.name || 'Host';
  const out = [`<h1>${esc(item.title)}</h1>`, `<p>${esc(m.summary)}</p>`];
  const updated = updatedLabel(item.updated_at);
  if (updated) out.push(`<p>${esc(updated)}</p>`);
  out.push(`<p>By <a href="${site}/${esc(host.username)}">${esc(name)}</a>${host.profession ? `, ${esc(host.profession)}` : ''}</p>`);
  // What's included / What you'll learn · Who made it · How you get it (same blocks as the SPA).
  out.push(sectionsHtml(catalogSections({ kind: m.kind === 'courses' ? 'course' : 'product', host, item })));
  out.push(faqSection(m.faqs));
  out.push(`<p><a href="${site}/${esc(host.username)}/${m.kind}">More ${m.kind === 'courses' ? 'courses' : 'digital products'} by ${esc(name)}</a></p>`);
  return out.filter(Boolean).join('\n');
}

const renderCatalogMeta = async (req, res) => {
  try {
    const { username, kind, key } = req.params;
    const m = await resolveCatalogMeta(kind, username, key);
    if (m.status === 404) return res.status(404).send('Not found');
    if (m.status === 301) return res.redirect(301, m.redirectTo);
    const html = buildHtml({ ...m.buildHtmlArgs, bodyHtml: itemBody(m) });
    res.set('Content-Type', 'text/html');
    res.set('Cache-Control', 'public, max-age=120, s-maxage=300');
    res.send(html);
  } catch (err) {
    console.error('[prerender] catalog item error:', err.message);
    res.status(500).send('Error');
  }
};

// Old /:username/product|course/:key → 301 straight to the canonical slug URL.
const renderLegacyCatalogRedirect = async (req, res) => {
  try {
    const kind = req.params.kind === 'course' ? 'courses' : 'products';
    const m = await resolveCatalogMeta(kind, req.params.username, req.params.key);
    if (m.status === 404) return res.status(404).send('Not found');
    return res.redirect(301, m.status === 301 ? m.redirectTo : m.buildHtmlArgs.canonical);
  } catch (err) {
    console.error('[prerender] legacy catalog error:', err.message);
    res.status(500).send('Error');
  }
};

// ── Service ─────────────────────────────────────────────────────────────────

// Pure resolver mirroring resolveProfileMeta, for the service page. Returns
// { status: 200, buildHtmlArgs } | { status: 404 } (services never redirect).
async function resolveServiceMeta(username, serviceSlug) {
  const { buildPublicServiceByProfileAndSlug } = require('./serviceController');
  const outcome = await buildPublicServiceByProfileAndSlug(username, serviceSlug);

  if (outcome.hostNotFound || outcome.notFound) {
    return { status: 404 };
  }

  const { service, vendor } = outcome.payload;
  const site = trimSlash(SITE_URL);
  const baseTitle = service.title || 'Service';

  // Compose progressively so the title isn't truncated in results (Google cuts
  // ~60 chars): full → drop " | Meeticulous" → drop " with {host}" → the bare
  // service title. The service title is host-authored (UGC) and never truncated.
  // Mirrors client resolveServiceSeo (utils/seo.js) — this server path is what the
  // SEO crawler and bots audit, so it must apply the same guard.
  // Local-SEO city only for an OFFLINE (in-person) service — mirrors client
  // resolveServiceSeo (utils/seo.js). City comes from the host (vendor.location).
  const city = service.meeting_mode === 'offline' ? cityForSeo(vendor.location) : null;
  const composeTitle = () => {
    const base = city ? `${baseTitle} in ${city}` : baseTitle;
    const withName = vendor.name ? `${base} with ${vendor.name}` : base;
    const full = `${withName} | Meeticulous`;
    if (full.length <= 60) return full;
    if (withName.length <= 60) return withName;
    if (base.length <= 60) return base;
    return baseTitle;
  };
  const title = service.seo_title || composeTitle();
  // Answer-first template unless the admin set one (mirrors client resolveServiceSeo).
  const description = service.seo_description || serviceDescription({ service, vendor });
  const canonical = vendor.username && service.slug
    ? `${site}/${vendor.username}/${service.slug}`
    : site;

  const avgRating = outcome.payload.avgRating || 0;
  const reviewCount = (outcome.payload.reviews || []).length;

  // One @graph (Service + Offer + host Person stub + Breadcrumb + optional FAQPage),
  // @id-linked, mirroring client serviceGraphJsonLd. The host Person is a stub here;
  // the full Person lives on the profile page, shared by @id.
  const jsonLd = buildServiceGraph({
    service, vendor, site, avgRating, reviewCount,
    faqs: serviceFaqs(service, vendor),
  });

  // A generated service card (og_image) and the static default floor are both known
  // 1200x630 assets → flag cardImage so buildHtml emits the og:image size hints. A
  // real seo_image/thumbnail is whatever size the host uploaded, so it stays hint-less.
  const hostImage = service.seo_image || service.thumbnail_url;
  // Share card: admin override (og_image) -> composited Cloudinary service card
  // (services/seo/hostOgCard) -> host's own seo_image/thumbnail -> static floor.
  // The first two are known 1200x630 cards (size hints honest); a host image is
  // whatever size they uploaded, so it stays hint-less.
  const svcCard = service.og_image || cloudinaryServiceCard({
    title: baseTitle,
    hostName: vendor.name,
    hostAvatar: vendor.profile_image,
    price: service.price,
    priceOnRequest: service.price_on_request,
    duration: service.duration,
    mode: service.meeting_mode,
  });
  const buildHtmlArgs = {
    title,
    description,
    canonical,
    // Share title carries the host name (mirrors client resolveServiceSeo).
    ogTitle: service.og_title || service.seo_title || (vendor.name ? `${baseTitle} with ${vendor.name}` : baseTitle),
    ogDescription: service.og_description || description,
    image: svcCard || hostImage || `${site}/service-og-default.png`,
    cardImage: Boolean(svcCard) || !hostImage,
    // Honest signal matching the sitemap gate (server/services/sitemapService.js):
    // explicit noindex wins (nofollow too); otherwise an unverified host's service
    // is excluded from the sitemap, so the page falls to noindex,follow (links still
    // followable) until the host is verified; a verified, indexable page indexes.
    robots: service.is_indexable === false ? 'noindex,nofollow'
      : (vendor.is_verified === true && vendor.is_indexable !== false) ? 'index,follow'
      : 'noindex,follow',
    // FAQPage + BreadcrumbList are now members of the single jsonLd @graph above.
    jsonLd,
  };

  // payload passed through (additive) for the crawler's content model (see profile).
  return { status: 200, buildHtmlArgs, payload: outcome.payload };
}

const renderServiceMeta = async (req, res) => {
  try {
    const { username, serviceSlug } = req.params;
    const m = await resolveServiceMeta(username, serviceSlug);
    if (m.status === 404) return res.status(404).send('Not found');

    const html = buildHtml({ ...m.buildHtmlArgs, bodyHtml: serviceBody(m.payload) });
    res.set('Content-Type', 'text/html');
    res.set('Cache-Control', 'public, max-age=120, s-maxage=300');
    res.send(html);
  } catch (err) {
    console.error('[prerender] service error:', err.message);
    res.status(500).send('Error');
  }
};

module.exports = {
  renderProfileMeta, renderServiceMeta, resolveProfileMeta, resolveServiceMeta,
  renderProfileTabMeta, resolveProfileTabMeta,
  renderCatalogMeta, resolveCatalogMeta, renderLegacyCatalogRedirect,
  // shared with prerenderCommunity.js
  buildHtml, esc, SITE_URL,
  // pure graph builders — mirror client seo.js; exercised by the parity test
  buildProfileGraph, buildServiceGraph, buildProductGraph, buildCourseGraph, buildProfileTabGraph, buildMembershipGraph,
};
