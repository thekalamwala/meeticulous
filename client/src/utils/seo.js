/**
 * seo.js — pure SEO resolution for public pages.
 *
 * Single source of truth for how a service/profile turns into the page's
 * title, meta description, OG tags, canonical URL, robots directive, and
 * JSON-LD. Admin-managed overrides (seo_*, og_*, is_indexable) win; otherwise
 * we fall back to the vendor-controlled title/description/image.
 *
 * Canonical is ALWAYS derived from the current public URL (siteUrl + current
 * username [+ slug]) — never stored — so an alias/301 can't split link equity.
 */

// Production base for canonical/OG. Pages pass import.meta.env.VITE_PUBLIC_SITE_URL
// (Vercel) through; falls back to the apex so previews still emit sane tags.
export const SITE_URL = 'https://meeticulous.com';

const trimSlash = (s) => String(s || '').replace(/\/+$/, '');
const truncate = (s, n = 160) => {
  const str = String(s || '').trim();
  return str.length <= n ? str : str.slice(0, n - 1).trimEnd() + '…';
};

const robotsFor = (indexable) => (indexable === false ? 'noindex,nofollow' : 'index,follow');

// City for a local-SEO <title>/meta from free-text profiles.location.
// Takes the first comma-segment, Title-cases it, and drops junk/non-city values
// so "Nagpur, Maharashtra" -> "Nagpur", "NAGPUR, MH, IN" -> "Nagpur",
// ""/"WFH"/"remote"/"India" -> null. Only used for OFFLINE (in-person) pages,
// where a city carries real local intent; online pages never get a city.
// Mirrored verbatim in server/controllers/prerenderController.js — keep in sync.
const JUNK_LOC = /^(wfh|remote|online|virtual|anywhere|india|worldwide|global|n\/?a|-|\.)$/i;
export const cityForSeo = (loc) => {
  const first = String(loc || '').split(',')[0].trim();
  if (!first || first.length > 24 || JUNK_LOC.test(first)) return null;
  return first.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

const brandCard = (siteUrl) => `${trimSlash(siteUrl)}/og-image.png`;
// Static per-service OG floor (Phase 1). The final fallback below a generated
// service card / admin seo_image / host thumbnail. A service-branded 1200x630
// card, distinct from brandCard. See v3.154.
const serviceDefaultCard = (siteUrl) => `${trimSlash(siteUrl)}/service-og-default.png`;

// ── Service ──────────────────────────────────────────────────────────────────

export const resolveServiceSeo = ({ service = {}, vendor = {}, siteUrl = SITE_URL } = {}) => {
  const site = trimSlash(siteUrl);
  const username = vendor.username;
  const baseTitle = service.title || 'Service';

  // Admin seo_title is used verbatim (full control of the tag); otherwise compose
  // progressively so the tag isn't truncated in results (Google cuts ~60 chars):
  // full → drop the " | Meeticulous" brand suffix → drop " with {host}" → the bare
  // service title. The service title is host-authored (UGC) so we never truncate it
  // — if it alone exceeds 60, it stays as the host wrote it.
  // Local-SEO city only for an OFFLINE (in-person) service — an online service
  // has no local intent, so a city in its title would be misleading. City comes
  // from the host (vendor.location); a service has no location of its own.
  const city = service.meeting_mode === 'offline' ? cityForSeo(vendor.location) : null;
  const composeTitle = () => {
    const base = city ? `${baseTitle} in ${city}` : baseTitle;
    const withName = vendor.name ? `${base} with ${vendor.name}` : base;
    const full = `${withName} | Meeticulous`;
    if (full.length <= 60) return full;
    if (withName.length <= 60) return withName;
    if (base.length <= 60) return base; // keep "{title} in {city}" — the SEO phrase
    return baseTitle;
  };
  const title = service.seo_title || composeTitle();
  const description = service.seo_description
    || truncate(service.short_description || service.description
      || `Book ${baseTitle}${city ? ` in ${city}` : ''} on Meeticulous.`);

  const canonical = username && service.slug
    ? `${site}/${username}/${service.slug}`
    : site;

  return {
    title,
    description,
    ogTitle: service.og_title || service.seo_title || baseTitle,
    ogDescription: service.og_description || description,
    // Ordered fallback: generated service card -> admin override -> host
    // thumbnail -> the static /service-og-default.png floor (Phase 1). See v3.154.
    image: service.og_image || service.seo_image || service.thumbnail_url || serviceDefaultCard(site),
    canonical,
    indexable: service.is_indexable !== false,
    robots: robotsFor(service.is_indexable),
  };
};

export const serviceJsonLd = ({ service = {}, vendor = {}, siteUrl = SITE_URL, avgRating, reviewCount } = {}) => {
  const site = trimSlash(siteUrl);
  const url = vendor.username && service.slug ? `${site}/${vendor.username}/${service.slug}` : site;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: service.title || 'Service',
    description: service.seo_description || service.short_description || service.description || undefined,
    url,
    provider: vendor.name
      ? { '@type': 'Person', name: vendor.name, url: vendor.username ? `${site}/${vendor.username}` : undefined }
      : undefined,
    // Price-on-request hides the fee, so the numeric price is omitted from the
    // Offer too — the schema must not leak what the page deliberately hides.
    offers: service.price_on_request ? {
      '@type': 'Offer',
      priceCurrency: service.currency || 'INR',
      availability: 'https://schema.org/InStock',
      url,
    } : {
      '@type': 'Offer',
      price: String(service.price ?? 0),
      priceCurrency: service.currency || 'INR',
      availability: 'https://schema.org/InStock',
      url,
    },
  };
  if (service.seo_image || service.thumbnail_url) ld.image = service.seo_image || service.thumbnail_url;
  if (reviewCount > 0 && avgRating > 0) {
    ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: avgRating, reviewCount };
  }
  return ld;
};

// ── Profile (host) ───────────────────────────────────────────────────────────

export const resolveProfileSeo = ({ host = {}, services = [], siteUrl = SITE_URL } = {}) => {
  const site = trimSlash(siteUrl);
  const name = host.name || 'Host';

  // A city in the profile title only earns local intent if the host actually
  // offers an in-person (offline) service; a fully-online host has no locality.
  const hasOffline = (services || []).some((s) => s && s.meeting_mode === 'offline');
  const city = hasOffline ? cityForSeo(host.location) : null;
  const composeTitle = () => {
    const base = `${name}${host.profession ? ` — ${host.profession}` : ''}`;
    const withCity = city ? `${base} in ${city}` : base;
    const full = `${withCity} | Meeticulous`;
    if (full.length <= 60) return full;
    if (withCity.length <= 60) return withCity;
    return base;
  };
  const title = host.seo_title || composeTitle();
  const description = host.seo_description
    || truncate(host.bio || `Book sessions with ${name}${city ? ` in ${city}` : ''} on Meeticulous.`);

  return {
    title,
    description,
    ogTitle: host.og_title || host.seo_title || name,
    ogDescription: host.og_description || description,
    image: host.seo_image || host.profile_image || brandCard(site),
    canonical: host.username ? `${site}/${host.username}` : site,
    // A profile with no bookable service is a thin page (name + empty shell), so
    // keep it out of the index but let crawlers follow its links. Mirrors
    // prerenderController + the sitemap host filter.
    indexable: host.is_indexable !== false && (services || []).length > 0,
    robots: host.is_indexable === false ? robotsFor(false)
      : (services || []).length ? robotsFor(true) : 'noindex,follow',
  };
};

// Identity links backing schema.org sameAs — mirrors server sameAsFrom()
// (server/services/seo/pageContentModel.js). Reads host.social_links (JSONB),
// keeping only real http(s) identity URLs (drops email/whatsapp + blanks).
const SAMEAS_SOCIALS = ['instagram', 'youtube', 'linkedin', 'facebook', 'twitter', 'website', 'github'];
const sameAsFromSocials = (social = {}) => [...new Set(
  SAMEAS_SOCIALS
    .map((k) => (typeof social[k] === 'string' ? social[k].trim() : ''))
    .filter((v) => /^https?:\/\//i.test(v)),
)];

// Category slugs → human topic labels for Person.knowsAbout / occupationalCategory
// (e.g. 'startup-advisor' → 'Startup Advisor'). MIRRORS the same helper in the
// server prerender path (prerenderController.js) — keep both in sync. Topics are an
// AEO/entity-clarity signal: they tell answer engines what this person is known for.
const humanizeSlug = (s) => String(s || '').replace(/[-_]+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());
const knowsAboutFrom = (host = {}) => [...new Set(
  [host.primary_category, ...(Array.isArray(host.categories) ? host.categories : [])]
    .filter(Boolean).map(humanizeSlug),
)];

export const profileJsonLd = ({ host = {}, siteUrl = SITE_URL, services = [], rating = null } = {}) => {
  const site = trimSlash(siteUrl);
  const url = host.username ? `${site}/${host.username}` : site;
  const sameAs = sameAsFromSocials(host.social_links);
  const knowsAbout = knowsAboutFrom(host);
  const person = {
    '@type': 'Person',
    name: host.name || 'Host',
    url,
    jobTitle: host.profession || undefined,
    description: host.seo_description || host.bio || undefined,
    image: host.seo_image || host.profile_image || undefined,
    ...(sameAs.length ? { sameAs } : {}),
    // Structured occupation + topics reinforce jobTitle as a real entity and tell
    // answer engines what this person is known for (name-query relevance).
    ...(host.profession ? {
      hasOccupation: {
        '@type': 'Occupation',
        name: host.profession,
        ...(host.primary_category ? { occupationalCategory: humanizeSlug(host.primary_category) } : {}),
      },
    } : {}),
    ...(knowsAbout.length ? { knowsAbout } : {}),
    // Host's OWN rating only (shown on the profile). Never a platform default —
    // that would be reviews not about this person. Platform rating lives on the
    // homepage SoftwareApplication node.
    ...(rating && rating.count > 0 && rating.avg > 0 ? {
      aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.avg, reviewCount: rating.count },
    } : {}),
  };
  if (Array.isArray(services) && services.length) {
    person.makesOffer = services
      .filter((s) => s && s.title)
      .map((s) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: s.title, url: s.slug ? `${url}/${s.slug}` : undefined },
      }));
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    ...(host.updated_at ? { dateModified: host.updated_at } : {}),
    // BAS publishes the profile page (accurate — NOT the person's employer, so never
    // Person.worksFor). Links the page to the Organization entity for the graph.
    publisher: { '@type': 'Organization', name: 'Meeticulous', url: site },
    mainEntity: person,
  };
};

// ── Blog post ────────────────────────────────────────────────────────────────

const BLOG_SUFFIX = ' | Meeticulous Blog';

// Blog was the one public page type without a resolver, so BlogPost built its meta
// inline: it appended BLOG_SUFFIX unconditionally (overflowing 60 chars on long
// headlines → truncated in results) and used the raw excerpt as the description
// (frequently > 160 → truncated). Both now go through here.
//   • title: admin seo_title verbatim; else the headline + brand suffix ONLY when
//     the whole thing still fits Google's ~60-char window (a long headline alone is
//     more useful than a headline whose brand tag gets cut off).
//   • description: admin seo_description; else the excerpt truncated to 160.
export const resolveBlogSeo = ({ post = {}, siteUrl = SITE_URL } = {}) => {
  const site = trimSlash(siteUrl);
  const headline = post.title || 'Meeticulous Blog';
  const title = post.seo_title
    || (headline.length + BLOG_SUFFIX.length <= 60 ? `${headline}${BLOG_SUFFIX}` : headline);
  const description = post.seo_description
    || truncate(post.excerpt || `Read ${headline} on the Meeticulous blog.`, 160);
  return {
    title,
    description,
    canonical: post.slug ? `${site}/blog/${post.slug}` : `${site}/blog`,
    indexable: post.is_indexable !== false,
    robots: robotsFor(post.is_indexable),
  };
};

// ── Shared brand / page builders ─────────────────────────────────────────────

// Official brand profiles — used for Organization.sameAs (entity disambiguation
// for SEO/GEO).
// Empty until the company accounts exist (planned for the next deployment):
// LinkedIn, Instagram, Facebook, X. Keep in sync with the Footer social links.
export const ORG_SAME_AS = [];

// Legal entity + a support contact point. Source of truth is the company's own
// published legal pages (/privacy, /terms) — Rajmudra Media LLP since 2026-10-31
// (was Timewheel Internet Private Limited). Added to the Organization node for
// NAP consistency and entity disambiguation (Google knowledge panel + GEO). Keep
// in sync with the legal pages.
// ORG_ADDRESS is the Eureka CoWorking office in Nagpur (owner request
// 2026-10-31; same address as the legal pages). It is still left OUT of the
// Organization JSON-LD — only the /contact map reads it.
export const ORG_LEGAL_NAME = 'Rajmudra Media LLP';
export const ORG_ADDRESS = {
  '@type': 'PostalAddress',
  streetAddress: 'Eureka CoWorking, 2nd & 4th floor, 11, Friends Colony, Mate Square, Pratap Nagar Rd, P & T Colony, Kotwal Nagar, Pratap Nagar',
  addressLocality: 'Nagpur',
  addressRegion: 'Maharashtra',
  postalCode: '440022',
  addressCountry: 'IN',
};
export const ORG_CONTACT_POINT = {
  '@type': 'ContactPoint',
  contactType: 'customer support',
  email: 'team@meeticulous.com',
  availableLanguage: ['en', 'hi'],
};

// Canonical Organization node. Pages that need it inline it into their JSON-LD
// so the brand entity is consistent everywhere (never hand-roll a second one).
export const organizationJsonLd = ({ siteUrl = SITE_URL } = {}) => {
  const site = trimSlash(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Meeticulous',
    legalName: ORG_LEGAL_NAME,
    url: `${site}/`,
    // On-domain 512x512 brand mark. Was /logo-512.png — a file that does not
    // exist in client/public (dead 404 on every page that inlines this node),
    // so Google silently dropped the Organization logo. web-app-manifest-512x512.png
    // is a real, shipped, genuinely-512px asset.
    logo: `${site}/web-app-manifest-512x512.png`,
    description: 'Online booking and appointment scheduling platform for coaches, consultants, therapists, and small businesses.',
    contactPoint: ORG_CONTACT_POINT,
    ...(ORG_SAME_AS.length ? { sameAs: ORG_SAME_AS } : {}),
  };
};

// BreadcrumbList from an ordered [{ name, path }] trail. Paths are site-relative
// ('/x') or absolute; the crawler shows the trail and can render breadcrumb rich
// results. Home is the caller's responsibility (pass it first).
export const breadcrumbJsonLd = ({ items = [], siteUrl = SITE_URL } = {}) => {
  const site = trimSlash(siteUrl);
  const abs = (p) => (/^https?:/i.test(p) ? p : `${site}${p.startsWith('/') ? '' : '/'}${p}`);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: (items || [])
      .filter((it) => it && it.name && it.path)
      .map((it, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: it.name,
        item: abs(it.path),
      })),
  };
};

// CollectionPage for a public list/index page. `items` (optional [{ url, name }])
// becomes an embedded ItemList so the crawler sees the page's members; omit it
// and no mainEntity is emitted.
export const collectionPageJsonLd = ({ name, description, url, siteUrl = SITE_URL, items = [] } = {}) => {
  const site = trimSlash(siteUrl);
  const abs = (p) => (/^https?:/i.test(p) ? p : `${site}${String(p || '').startsWith('/') ? '' : '/'}${p || ''}`);
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name,
    description,
    url: url ? abs(url) : `${site}/`,
  };
  if (Array.isArray(items) && items.length) {
    ld.mainEntity = {
      '@type': 'ItemList',
      itemListElement: items
        .filter((it) => it && it.url && it.name)
        .map((it, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(it.url), name: it.name })),
    };
  }
  return ld;
};

// FAQPage from [{ q, a }]. `a` may contain plain text; strip to a safe string.
export const faqJsonLd = ({ faqs = [] } = {}) => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: (faqs || [])
    .filter((f) => f && f.q && f.a)
    .map((f) => ({
      '@type': 'Question',
      name: String(f.q),
      acceptedAnswer: { '@type': 'Answer', text: String(f.a) },
    })),
});

// Organization as a @graph node (with a stable @id and an ImageObject logo), for
// pages that build a single @graph and reference the org by @id. The standalone
// organizationJsonLd above stays as-is for pages that inline the org directly.
// On-domain, real 512x512 asset (see organizationJsonLd note) — /logo-512.png
// never existed, so the @graph logo ImageObject 404'd everywhere it was used.
const LOGO_URL = (site) => `${site}/web-app-manifest-512x512.png`;
const orgNode = (site) => ({
  '@type': 'Organization',
  '@id': `${site}/#organization`,
  name: 'Meeticulous',
  legalName: ORG_LEGAL_NAME,
  url: `${site}/`,
  logo: { '@type': 'ImageObject', '@id': `${site}/#logo`, url: LOGO_URL(site), contentUrl: LOGO_URL(site), width: 512, height: 512 },
  description: 'Online booking and appointment scheduling platform for coaches, consultants, therapists, and small businesses.',
  contactPoint: ORG_CONTACT_POINT,
  ...(ORG_SAME_AS.length ? { sameAs: ORG_SAME_AS } : {}),
});

/**
 * articleGraphJsonLd — the ONE structured-data object an article page emits.
 *
 * Returns a single `@graph` whose nodes cross-reference by stable `@id`, so the
 * page renders exactly one <script type="application/ld+json">. Nodes: WebSite,
 * Organization (+ logo ImageObject), a primary-image ImageObject, the author
 * Person, a WebPage, the article (BlogPosting/Article) and a BreadcrumbList —
 * plus a FAQPage ONLY when the caller passes FAQs the page actually shows.
 *
 * The caller passes already-resolved headline/description/url/image/dates so the
 * meta tags and the schema come from one source (see resolveBlogSeo) and the meta
 * description equals the schema description. `mainEntityOfPage` points at the
 * article's own WebPage (never the homepage); the author is a real Person when a
 * byline exists, and only falls back to the Organization when there is none.
 *
 * Nothing is invented: width/height, dates and the author URL are emitted only
 * when the caller supplies them.
 */
export const articleGraphJsonLd = ({
  siteUrl = SITE_URL,
  url,
  type = 'BlogPosting',
  headline,
  description,
  image,
  imageWidth,
  imageHeight,
  datePublished,
  dateModified,
  author,            // { name, url, jobTitle?, image?, sameAs? } — Person node emitted only when name is set
  breadcrumb = [],   // ordered [{ name, path }]
  faqs = [],
} = {}) => {
  const site = trimSlash(siteUrl);
  const pageUrl = url || `${site}/`;
  const abs = (p) => (/^https?:/i.test(p) ? p : `${site}${String(p || '').startsWith('/') ? '' : '/'}${p || ''}`);

  const id = {
    website: `${site}/#website`,
    org: `${site}/#organization`,
    webpage: `${pageUrl}#webpage`,
    article: `${pageUrl}#article`,
    image: `${pageUrl}#primaryimage`,
    breadcrumb: `${pageUrl}#breadcrumb`,
    faq: `${pageUrl}#faq`,
    person: author && author.name ? `${author.url || pageUrl}#author` : undefined,
  };

  const graph = [
    { '@type': 'WebSite', '@id': id.website, url: `${site}/`, name: 'Meeticulous', publisher: { '@id': id.org }, inLanguage: 'en-IN' },
    orgNode(site),
  ];

  if (image) {
    const img = { '@type': 'ImageObject', '@id': id.image, url: image, contentUrl: image };
    if (imageWidth) img.width = imageWidth;
    if (imageHeight) img.height = imageHeight;
    graph.push(img);
  }

  if (id.person) {
    const person = { '@type': 'Person', '@id': id.person, name: author.name, url: author.url || undefined };
    if (author.jobTitle) person.jobTitle = author.jobTitle;
    if (author.image) person.image = author.image;
    if (Array.isArray(author.sameAs) && author.sameAs.length) person.sameAs = author.sameAs;
    graph.push(person);
  }

  graph.push({
    '@type': 'BreadcrumbList',
    '@id': id.breadcrumb,
    itemListElement: (breadcrumb || [])
      .filter((it) => it && it.name && it.path)
      .map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  });

  const webpage = {
    '@type': 'WebPage',
    '@id': id.webpage,
    url: pageUrl,
    name: headline,
    description: description || undefined,
    isPartOf: { '@id': id.website },
    breadcrumb: { '@id': id.breadcrumb },
    datePublished: datePublished || undefined,
    dateModified: dateModified || datePublished || undefined,
    inLanguage: 'en-IN',
  };
  if (image) webpage.primaryImageOfPage = { '@id': id.image };
  graph.push(webpage);

  const article = {
    '@type': type,
    '@id': id.article,
    headline,
    description: description || undefined,
    url: pageUrl,
    mainEntityOfPage: { '@id': id.webpage },
    isPartOf: { '@id': id.webpage },
    datePublished: datePublished || undefined,
    dateModified: dateModified || datePublished || undefined,
    author: id.person ? { '@id': id.person } : { '@id': id.org },
    publisher: { '@id': id.org },
    inLanguage: 'en-IN',
  };
  if (image) article.image = { '@id': id.image };
  graph.push(article);

  if (Array.isArray(faqs) && faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': id.faq,
      mainEntity: faqs
        .filter((f) => f && f.q && f.a)
        .map((f) => ({ '@type': 'Question', name: String(f.q), acceptedAnswer: { '@type': 'Answer', text: String(f.a) } })),
    });
  }

  return { '@context': 'https://schema.org', '@graph': graph };
};

/**
 * professionGraphJsonLd — the ONE structured-data object a bespoke /for/<profession>
 * landing page emits. Mirrors articleGraphJsonLd: a single `@graph` whose nodes
 * cross-reference by stable `@id`, so the page renders exactly one JSON-LD script.
 *
 * Replaces the hand-rolled 4-orphan-block array (SoftwareApplication + Service +
 * FAQPage + BreadcrumbList with a bare `{name,url}` org stub) that every /for page
 * duplicated. Here the brand is the canonical Organization (ORG_SAME_AS + logo), a
 * WebPage ties the page to the WebSite, and a HowTo (from the page's own steps)
 * is added — none of the pages emitted HowTo before.
 *
 * Honesty rules unchanged: NO aggregateRating (a profession page has no reviews of
 * its own — that would be the self-serving markup search engines flag). Nothing is
 * invented; HowTo/FAQ nodes appear only when the page passes real steps/faqs.
 */
export const professionGraphJsonLd = ({
  siteUrl = SITE_URL,
  canonical,
  name,                 // the product-for-profession headline, e.g. 'Appointment Booking Software for Consultants'
  description,
  breadcrumbName,       // the page's breadcrumb label, e.g. 'For Business & Management Consultants'
  serviceType,          // the Service node's serviceType sentence
  image,
  steps = [],           // [{ title, desc }] → HowTo
  faqs = [],            // [{ q, a }] → FAQPage
  appOffers = [],       // [{ price, name }] → SoftwareApplication.offers
} = {}) => {
  const site = trimSlash(siteUrl);
  const pageUrl = canonical || `${site}/`;
  const abs = (p) => (/^https?:/i.test(p) ? p : `${site}${String(p || '').startsWith('/') ? '' : '/'}${p || ''}`);

  const id = {
    website: `${site}/#website`,
    org: `${site}/#organization`,
    webpage: `${pageUrl}#webpage`,
    software: `${pageUrl}#software`,
    service: `${pageUrl}#service`,
    howto: `${pageUrl}#howto`,
    faq: `${pageUrl}#faq`,
    breadcrumb: `${pageUrl}#breadcrumb`,
  };

  const graph = [
    { '@type': 'WebSite', '@id': id.website, url: `${site}/`, name: 'Meeticulous', publisher: { '@id': id.org }, inLanguage: 'en-IN' },
    orgNode(site),
    {
      '@type': 'WebPage',
      '@id': id.webpage,
      url: pageUrl,
      name,
      description: description || undefined,
      isPartOf: { '@id': id.website },
      breadcrumb: { '@id': id.breadcrumb },
      primaryImageOfPage: image ? { '@type': 'ImageObject', url: image } : undefined,
      inLanguage: 'en-IN',
      // Answer-engine hint: the headline + FAQ are the spoken-answer candidates.
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '#faq'] },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': id.software,
      name: 'Meeticulous',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Appointment Scheduling Software',
      operatingSystem: 'Web',
      url: pageUrl,
      description: description || undefined,
      publisher: { '@id': id.org },
      offers: (appOffers || [])
        .filter((o) => o && o.price != null)
        .map((o) => ({ '@type': 'Offer', price: String(o.price), priceCurrency: 'INR', name: o.name })),
      // No aggregateRating — platform rating lives only on the homepage node.
    },
    {
      '@type': 'Service',
      '@id': id.service,
      serviceType: serviceType || name,
      provider: { '@id': id.org },
      areaServed: 'IN',
      description: description || undefined,
      url: pageUrl,
    },
  ];

  if (Array.isArray(steps) && steps.length) {
    graph.push({
      '@type': 'HowTo',
      '@id': id.howto,
      name: `How to use Meeticulous${breadcrumbName ? ` ${breadcrumbName.replace(/^For\s+/i, 'for ')}` : ''}`,
      step: steps
        .filter((s) => s && s.title)
        .map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.desc || s.title })),
    });
  }

  if (Array.isArray(faqs) && faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': id.faq,
      mainEntity: faqs
        .filter((f) => f && f.q && f.a)
        .map((f) => ({ '@type': 'Question', name: String(f.q), acceptedAnswer: { '@type': 'Answer', text: String(f.a) } })),
    });
  }

  graph.push({
    '@type': 'BreadcrumbList',
    '@id': id.breadcrumb,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
      { '@type': 'ListItem', position: 2, name: breadcrumbName || name, item: pageUrl },
    ],
  });

  return { '@context': 'https://schema.org', '@graph': graph };
};

/**
 * comparisonGraphJsonLd — the ONE structured-data object a /lp competitor page
 * emits ("<competitor> alternative" / "vs <competitor>"). A single `@graph`:
 * WebSite, Organization (canonical orgNode + logo + sameAs + address), WebPage
 * (+ speakable h1/#faq), SoftwareApplication (Meeticulous, free-tier Offer), an
 * optional FAQPage (only when the page actually shows the Q&A it's built from),
 * and a BreadcrumbList under the /compare hub.
 *
 * These pages hid the global nav and emitted NO JSON-LD at all despite being the
 * highest commercial-intent pages on the site. Honesty rules mirror
 * professionGraphJsonLd: NO aggregateRating (platform rating lives only on the
 * homepage node), and the FAQPage appears only when real faqs are passed.
 */
export const comparisonGraphJsonLd = ({
  siteUrl = SITE_URL,
  canonical,
  name,              // page headline / meta title
  description,
  breadcrumbName,    // e.g. 'Calendly Alternative'
  faqs = [],         // [{ q, a }] → FAQPage (only when the page shows them)
} = {}) => {
  const site = trimSlash(siteUrl);
  const pageUrl = canonical || `${site}/`;

  const id = {
    website: `${site}/#website`,
    org: `${site}/#organization`,
    webpage: `${pageUrl}#webpage`,
    software: `${pageUrl}#software`,
    faq: `${pageUrl}#faq`,
    breadcrumb: `${pageUrl}#breadcrumb`,
  };

  const graph = [
    { '@type': 'WebSite', '@id': id.website, url: `${site}/`, name: 'Meeticulous', publisher: { '@id': id.org }, inLanguage: 'en-IN' },
    orgNode(site),
    {
      '@type': 'WebPage',
      '@id': id.webpage,
      url: pageUrl,
      name,
      description: description || undefined,
      isPartOf: { '@id': id.website },
      breadcrumb: { '@id': id.breadcrumb },
      inLanguage: 'en-IN',
      // Answer-engine hint: the headline + FAQ are the spoken-answer candidates.
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '#faq'] },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': id.software,
      name: 'Meeticulous',
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Appointment Scheduling Software',
      operatingSystem: 'Web',
      url: pageUrl,
      description: description || undefined,
      publisher: { '@id': id.org },
      // Free Starter plan — mirrors the homepage SoftwareApplication Offer.
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      // No aggregateRating — platform rating lives only on the homepage node.
    },
  ];

  if (Array.isArray(faqs) && faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': id.faq,
      mainEntity: faqs
        .filter((f) => f && f.q && f.a)
        .map((f) => ({ '@type': 'Question', name: String(f.q), acceptedAnswer: { '@type': 'Answer', text: String(f.a) } })),
    });
  }

  graph.push({
    '@type': 'BreadcrumbList',
    '@id': id.breadcrumb,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
      { '@type': 'ListItem', position: 2, name: 'Compare', item: `${site}/compare` },
      { '@type': 'ListItem', position: 3, name: breadcrumbName || name, item: pageUrl },
    ],
  });

  return { '@context': 'https://schema.org', '@graph': graph };
};

/**
 * toolAppJsonLd — the ONE structured-data object a /tools/<calculator> page emits.
 * A single `@graph`: WebSite, canonical Organization (orgNode), WebPage (+speakable
 * h1/#faq), a WebApplication for the free calculator itself (isAccessibleForFree,
 * ₹0 Offer, publisher = org), an optional FAQPage (only when the page shows the Q&A),
 * and a BreadcrumbList under the /tools hub.
 *
 * WebApplication (not SoftwareApplication) is the right type for an in-page tool.
 * No aggregateRating — a utility page has no reviews of its own.
 */
export const toolAppJsonLd = ({
  siteUrl = SITE_URL,
  canonical,
  name,                 // the tool's name, e.g. 'No-Show Cost Calculator'
  description,
  category = 'FinanceApplication',
  breadcrumbName,       // breadcrumb label for the tool
  faqs = [],            // [{ q, a }] → FAQPage (only when the page shows them)
} = {}) => {
  const site = trimSlash(siteUrl);
  const pageUrl = canonical || `${site}/`;

  const id = {
    website: `${site}/#website`,
    org: `${site}/#organization`,
    webpage: `${pageUrl}#webpage`,
    app: `${pageUrl}#app`,
    faq: `${pageUrl}#faq`,
    breadcrumb: `${pageUrl}#breadcrumb`,
  };

  const graph = [
    { '@type': 'WebSite', '@id': id.website, url: `${site}/`, name: 'Meeticulous', publisher: { '@id': id.org }, inLanguage: 'en-IN' },
    orgNode(site),
    {
      '@type': 'WebPage',
      '@id': id.webpage,
      url: pageUrl,
      name,
      description: description || undefined,
      isPartOf: { '@id': id.website },
      breadcrumb: { '@id': id.breadcrumb },
      inLanguage: 'en-IN',
      speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '#faq'] },
    },
    {
      '@type': 'WebApplication',
      '@id': id.app,
      name,
      applicationCategory: category,
      operatingSystem: 'Web',
      url: pageUrl,
      description: description || undefined,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
      publisher: { '@id': id.org },
    },
  ];

  if (Array.isArray(faqs) && faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': id.faq,
      mainEntity: faqs
        .filter((f) => f && f.q && f.a)
        .map((f) => ({ '@type': 'Question', name: String(f.q), acceptedAnswer: { '@type': 'Answer', text: String(f.a) } })),
    });
  }

  graph.push({
    '@type': 'BreadcrumbList',
    '@id': id.breadcrumb,
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
      { '@type': 'ListItem', position: 2, name: 'Tools', item: `${site}/tools` },
      { '@type': 'ListItem', position: 3, name: breadcrumbName || name, item: pageUrl },
    ],
  });

  return { '@context': 'https://schema.org', '@graph': graph };
};

// Glossary index → DefinedTermSet with each entry as a DefinedTerm. `terms` is
// [{ slug, term, short }]; the set and every term carry a stable @id so the
// per-term pages (glossaryTermJsonLd) reference the same set.
export const definedTermSetJsonLd = ({ siteUrl = SITE_URL, url = '/glossary', name, description, terms = [] } = {}) => {
  const site = trimSlash(siteUrl);
  const setUrl = /^https?:/i.test(url) ? url : `${site}${url.startsWith('/') ? '' : '/'}${url}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'DefinedTermSet',
    '@id': `${setUrl}#termset`,
    name,
    description: description || undefined,
    url: setUrl,
    hasDefinedTerm: (terms || [])
      .filter((t) => t && t.slug && t.term)
      .map((t) => ({
        '@type': 'DefinedTerm',
        '@id': `${site}/glossary/${t.slug}#term`,
        name: t.term,
        description: t.short || undefined,
        url: `${site}/glossary/${t.slug}`,
        inDefinedTermSet: `${setUrl}#termset`,
      })),
  };
};

// Single glossary term page → one @graph: WebSite, Organization, WebPage
// (+speakable), the DefinedTerm itself (in the glossary DefinedTermSet), and a
// BreadcrumbList Home → Glossary → term.
export const glossaryTermJsonLd = ({ siteUrl = SITE_URL, slug, term, definition, breadcrumbName } = {}) => {
  const site = trimSlash(siteUrl);
  const pageUrl = `${site}/glossary/${slug}`;
  const id = {
    website: `${site}/#website`,
    org: `${site}/#organization`,
    webpage: `${pageUrl}#webpage`,
    term: `${pageUrl}#term`,
    breadcrumb: `${pageUrl}#breadcrumb`,
  };
  return {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebSite', '@id': id.website, url: `${site}/`, name: 'Meeticulous', publisher: { '@id': id.org }, inLanguage: 'en-IN' },
      orgNode(site),
      {
        '@type': 'WebPage',
        '@id': id.webpage,
        url: pageUrl,
        name: `${term} — booking glossary`,
        description: definition || undefined,
        isPartOf: { '@id': id.website },
        breadcrumb: { '@id': id.breadcrumb },
        inLanguage: 'en-IN',
        speakable: { '@type': 'SpeakableSpecification', cssSelector: ['h1', '#definition'] },
        mainEntity: { '@id': id.term },
      },
      {
        '@type': 'DefinedTerm',
        '@id': id.term,
        name: term,
        description: definition,
        url: pageUrl,
        inDefinedTermSet: {
          '@type': 'DefinedTermSet',
          '@id': `${site}/glossary#termset`,
          name: 'Meeticulous booking & scheduling glossary',
          url: `${site}/glossary`,
        },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': id.breadcrumb,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${site}/` },
          { '@type': 'ListItem', position: 2, name: 'Glossary', item: `${site}/glossary` },
          { '@type': 'ListItem', position: 3, name: breadcrumbName || term, item: pageUrl },
        ],
      },
    ],
  };
};

// ContactPage node with the support contact point.
export const contactPageJsonLd = ({ siteUrl = SITE_URL, email = 'team@meeticulous.com' } = {}) => {
  const site = trimSlash(siteUrl);
  return {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    url: `${site}/contact`,
    mainEntity: {
      '@type': 'Organization',
      name: 'Meeticulous',
      url: `${site}/`,
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email,
        availableLanguage: ['en', 'hi'],
      },
    },
  };
};
