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

const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://bookasloth.com';

const { profileFaqs, serviceFaqs } = require('../services/seo/pageContentModel');

const trimSlash = (s) => String(s || '').replace(/\/+$/, '');
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const truncate = (s, n = 160) => {
  const str = String(s || '').trim();
  return str.length <= n ? str : str.slice(0, n - 1).trimEnd() + '…';
};

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

function buildHtml({ title, description, canonical, ogTitle, ogDescription, image, robots, jsonLd, faqJsonLd, cardImage, bodyHtml }) {
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
<meta property="og:site_name" content="Book A Sloth">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(ogDescription || description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(img)}">${sizeHints}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle || title)}">
<meta name="twitter:description" content="${esc(ogDescription || description)}">
<meta name="twitter:image" content="${esc(img)}">
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : ''}
${faqJsonLd ? `<script type="application/ld+json">${JSON.stringify(faqJsonLd)}</script>` : ''}
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
    items.map((t) => `<blockquote>${esc(t)}</blockquote>`).join('')
  }</section>`;
}

function hostBody(payload) {
  const { host = {}, services = [], reviews = [] } = payload || {};
  const site = trimSlash(SITE_URL);
  const name = host.name || 'Host';
  const out = [`<h1>${esc(name)}</h1>`];
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
// City for a local-SEO <title>/meta from free-text profiles.location. Mirrors
// client utils/seo.js cityForSeo VERBATIM — keep in sync. Only used for OFFLINE
// (in-person) pages; online pages carry no local intent so never get a city.
const JUNK_LOC = /^(wfh|remote|online|virtual|anywhere|india|worldwide|global|n\/?a|-|\.)$/i;
function cityForSeo(loc) {
  const first = String(loc || '').split(',')[0].trim();
  if (!first || first.length > 24 || JUNK_LOC.test(first)) return null;
  return first.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function faqPageLd(faqs) {
  const mainEntity = (faqs || []).filter((f) => f && f.q && f.a).map((f) => ({
    '@type': 'Question', name: String(f.q),
    acceptedAnswer: { '@type': 'Answer', text: String(f.a) },
  }));
  return mainEntity.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity } : null;
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

  // Local-SEO city only when the host offers an in-person (offline) service —
  // mirrors client resolveProfileSeo (utils/seo.js). Online-only host = no city.
  const hasOffline = (services || []).some((s) => s && s.meeting_mode === 'offline');
  const city = hasOffline ? cityForSeo(host.location) : null;
  const composeTitle = () => {
    const base = `${name}${host.profession ? ` — ${host.profession}` : ''}`;
    const withCity = city ? `${base} in ${city}` : base;
    const full = `${withCity} | Book A Sloth`;
    if (full.length <= 60) return full;
    if (withCity.length <= 60) return withCity;
    return base;
  };
  const title = host.seo_title || composeTitle();
  const description = host.seo_description
    || truncate(host.bio || `Book sessions with ${name}${city ? ` in ${city}` : ''} on Book A Sloth.`);
  const canonical = `${site}/${host.username}`;
  // Resolved once: the OG tag and the JSON-LD both point at the host's photo,
  // and upscaling only one of them is how you get a card that works next to
  // structured data that still says 96px.
  const avatar = upscaleAvatar(host.seo_image || host.profile_image) || undefined;

  // og:image is a SHARE CARD, not the avatar. A square Google photo letterboxes
  // inside a summary_large_image card, so we serve the generated 1200x630 host
  // card whenever one EXISTS — including a 'dirty' one (a visible field changed
  // and a regen is queued): a slightly-stale personal card beats dropping to the
  // generic site card, which is exactly the design's "dirty => serve old image".
  // Only a host with no card yet ('none') gets the site-wide default.
  // The avatar still feeds JSON-LD Person.image below, which is correct there.
  // ponytail: default = the existing site card; swap for a host-flavoured
  // default 1200x630 when one's designed.
  const ogCard = host.og_image || `${site}/og-image.png`;

  // sameAs (external identity links) + dateModified are AEO/entity-clarity signals:
  // they tell answer engines who this Person is and how fresh the page is.
  const sameAs = sameAsFrom(host);
  const knowsAbout = knowsAboutFrom(host);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url: canonical,
    ...(host.updated_at ? { dateModified: host.updated_at } : {}),
    // BAS publishes the profile page (accurate — NOT the person's employer, so never
    // Person.worksFor). Links the page to the Organization entity for the graph.
    publisher: { '@type': 'Organization', name: 'Book A Sloth', url: site },
    mainEntity: {
      '@type': 'Person',
      name,
      url: canonical,
      jobTitle: host.profession || undefined,
      description: host.seo_description || host.bio || undefined,
      image: avatar,
      ...(sameAs.length ? { sameAs } : {}),
      // Structured occupation + topics reinforce jobTitle as a real entity and tell
      // answer engines what this person is known for (name-query relevance). Mirrors
      // the client seo.js profileJsonLd — keep both in sync.
      ...(host.profession ? {
        hasOccupation: {
          '@type': 'Occupation',
          name: host.profession,
          ...(host.primary_category ? { occupationalCategory: humanizeSlug(host.primary_category) } : {}),
        },
      } : {}),
      ...(knowsAbout.length ? { knowsAbout } : {}),
      // Only the host's OWN reviews (never a platform default) — a rating here must
      // be reviews of this person and is shown on the profile. Platform-wide rating
      // lives on the homepage SoftwareApplication node instead.
      ...(reviewCount > 0 && avgRating > 0 ? {
        aggregateRating: { '@type': 'AggregateRating', ratingValue: avgRating, reviewCount },
      } : {}),
      ...(Array.isArray(services) && services.length ? {
        makesOffer: services.filter(s => s && s.title).map(s => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: s.title, url: s.slug ? `${canonical}/${s.slug}` : undefined },
        })),
      } : {}),
    },
  };

  const buildHtmlArgs = {
    title,
    description,
    canonical,
    // Share-card copy is its own fixed voice — the SAME line across every host
    // profile, deliberately NOT derived from bio/profession. The <title>/meta
    // description above stay SEO-flavoured for Google; these OG tags carry the
    // brand share line. Explicit og_/seo_ fields still override when set.
    ogTitle: host.og_title || host.seo_title || `${name} — now taking bookings on Book A Sloth.`,
    ogDescription: host.og_description || host.seo_description
      || `Skip the back-and-forth — ${name}'s calendar is open. Book a slot with them.`,
    image: ogCard,
    cardImage: true, // ogCard is always a known 1200x630 card (generated or site default)
    // No bookable service = thin profile: noindex but keep links followable.
    // Mirrors client resolveProfileSeo + the sitemap host filter.
    robots: host.is_indexable === false ? 'noindex,nofollow'
      : (services || []).length ? 'index,follow' : 'noindex,follow',
    jsonLd,
    // Same templated FAQ the client renders (utils/profileFaqs mirror) — emitted as
    // a second JSON-LD script so non-JS crawlers + AI answer bots get the FAQPage.
    faqJsonLd: faqPageLd(profileFaqs(host, services)),
  };

  // payload is passed through (additive) so the SEO crawler can build a DB-derived
  // content model for this bodiless page — see services/seo/pageContentModel.js.
  return { status: 200, buildHtmlArgs, payload: outcome.payload };
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
  // ~60 chars): full → drop " | Book A Sloth" → drop " with {host}" → the bare
  // service title. The service title is host-authored (UGC) and never truncated.
  // Mirrors client resolveServiceSeo (utils/seo.js) — this server path is what the
  // SEO crawler and bots audit, so it must apply the same guard.
  // Local-SEO city only for an OFFLINE (in-person) service — mirrors client
  // resolveServiceSeo (utils/seo.js). City comes from the host (vendor.location).
  const city = service.meeting_mode === 'offline' ? cityForSeo(vendor.location) : null;
  const composeTitle = () => {
    const base = city ? `${baseTitle} in ${city}` : baseTitle;
    const withName = vendor.name ? `${base} with ${vendor.name}` : base;
    const full = `${withName} | Book A Sloth`;
    if (full.length <= 60) return full;
    if (withName.length <= 60) return withName;
    if (base.length <= 60) return base;
    return baseTitle;
  };
  const title = service.seo_title || composeTitle();
  const description = service.seo_description
    || truncate(service.short_description || service.description
      || `Book ${baseTitle}${city ? ` in ${city}` : ''} on Book A Sloth.`);
  const canonical = vendor.username && service.slug
    ? `${site}/${vendor.username}/${service.slug}`
    : site;

  const avgRating = outcome.payload.avgRating || 0;
  const reviewCount = (outcome.payload.reviews || []).length;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: baseTitle,
    description: service.seo_description || service.short_description || service.description || undefined,
    url: canonical,
    provider: vendor.name
      ? { '@type': 'Person', name: vendor.name, url: vendor.username ? `${site}/${vendor.username}` : undefined }
      : undefined,
    // Price-on-request: omit the numeric price so the fee never leaks to crawlers
    // (Offer stays valid via availByRequest). Otherwise expose the real price.
    offers: service.price_on_request ? {
      '@type': 'Offer',
      priceCurrency: service.currency || 'INR',
      availability: 'https://schema.org/InStock',
      url: canonical,
    } : {
      '@type': 'Offer',
      price: String(service.price ?? 0),
      priceCurrency: service.currency || 'INR',
      availability: 'https://schema.org/InStock',
      url: canonical,
    },
    ...(service.seo_image || service.thumbnail_url ? { image: service.seo_image || service.thumbnail_url } : {}),
    ...(reviewCount > 0 && avgRating > 0 ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: avgRating, reviewCount },
    } : {}),
  };

  // A generated service card (og_image) and the static default floor are both known
  // 1200x630 assets → flag cardImage so buildHtml emits the og:image size hints. A
  // real seo_image/thumbnail is whatever size the host uploaded, so it stays hint-less.
  const hostImage = service.seo_image || service.thumbnail_url;
  const buildHtmlArgs = {
    title,
    description,
    canonical,
    ogTitle: service.og_title || service.seo_title || baseTitle,
    ogDescription: service.og_description || description,
    // Ordered fallback mirroring client resolveServiceSeo (utils/seo.js): generated
    // service card -> admin override -> host thumbnail -> static default floor.
    image: service.og_image || hostImage || `${site}/service-og-default.png`,
    cardImage: Boolean(service.og_image) || !hostImage,
    robots: service.is_indexable === false ? 'noindex,nofollow' : 'index,follow',
    jsonLd,
    // Visible FAQ (host-authored ∪ templated) is now rendered in the body, so emit the
    // matching FAQPage schema — mirrors the host shell and the client ServiceDetail.
    faqJsonLd: faqPageLd(serviceFaqs(service, vendor)),
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

module.exports = { renderProfileMeta, renderServiceMeta, resolveProfileMeta, resolveServiceMeta };
