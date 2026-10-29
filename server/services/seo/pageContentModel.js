// server/services/seo/pageContentModel.js
// DB-derived content model for host & service pages (spec: content source).
//
// WHY: Cloudflare 403-blocks the crawler UA, so host/service pages can't be fetched
// as HTML — they were audited meta-only (bodyCrawled:false), leaving our most
// important pages with no content / internal-linking / GEO analysis. We own the
// source data, so we reconstruct the page's *content signals* from the same DB
// payload the public page and prerender route render from. This is more accurate for
// our own content than scraping a JS-rendered SPA; the trade-off (documented in
// docs/seo-scoring-framework.md) is that it won't catch a client-render regression.
//
// Output shape mirrors seoParse.parse() so rules + scoring treat these pages like any
// body page: { headings, links:{internal,external}, images, wordCount, bodyText,
// entity:{type,name,author,sameAs,dates}, evidence:{reviewCount,avgRating} }.

const SITE_URL = (process.env.SITE_URL || 'https://bookasloth.com').replace(/\/$/, '');

const clean = (s) => (s == null ? null : String(s).replace(/\s+/g, ' ').trim() || null);
const wc = (parts) => {
  const t = parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return { bodyText: t, wordCount: t ? t.split(' ').length : 0 };
};

// Identity links backing schema.org sameAs (entity-clarity + evidence signals).
// Host socials live in the profiles.social_links JSONB (keys: instagram/youtube/
// linkedin/facebook/twitter/website/github/email/whatsapp) — NOT flat columns.
// Keep only real http(s) identity URLs (drops email/whatsapp + blank fields).
// ponytail: add a key here if the socials object grows; no other change needed.
const IDENTITY_SOCIALS = ['instagram', 'youtube', 'linkedin', 'facebook', 'twitter', 'website', 'github'];
function sameAsFrom(row = {}) {
  const s = row.social_links || {};
  return [...new Set(
    IDENTITY_SOCIALS
      .map((k) => (typeof s[k] === 'string' ? s[k].trim() : ''))
      .filter((v) => /^https?:\/\//i.test(v)),
  )];
}

// Templated profile FAQ — MIRRORS client/src/utils/profileFaqs.js (kept identical
// so the crawler's answer-coverage/structure score reflects what the page renders).
// Only real profile data → the FAQPage schema always matches visible content.
function profileFaqs(host = {}, services = []) {
  const name = clean(host.name) || 'this host';
  const priced = (services || []).map((s) => Number(s && s.price)).filter((p) => p > 0);
  const faqs = [{
    q: `How do I book ${name}?`,
    a: `Pick a service on ${name}'s page, choose a time that suits you and pay securely online. Your booking is confirmed instantly and you get reminders before the session.`,
  }];
  if (services && services.length) {
    faqs.push(priced.length ? {
      q: `How much does ${name} charge?`,
      a: `${name} has ${services.length} bookable service${services.length > 1 ? 's' : ''}, starting from ₹${Math.min(...priced).toLocaleString('en-IN')}.`,
    } : {
      q: `What can I book with ${name}?`,
      a: `${name} offers ${services.length} bookable service${services.length > 1 ? 's' : ''} you can schedule directly on this page.`,
    });
  }
  if (host.profession) {
    faqs.push({
      q: `What does ${name} do?`,
      a: `${name} is a ${clean(host.profession)}${host.location ? ` based in ${clean(host.location)}` : ''} taking bookings on Book A Sloth.`,
    });
  }
  faqs.push({
    q: 'Is payment secure?',
    a: 'Yes — payments are processed securely online and you receive booking confirmation and reminders automatically.',
  });
  return faqs;
}

// Templated service FAQ — MIRRORS client/src/utils/serviceFaqs.js. Host-authored
// service.faqs ([{question,answer}]) always win; otherwise a data-derived set so the
// bot shell + FAQPage schema always carry real, extractable Q&A. Returns {q,a}.
function serviceFaqs(service = {}, vendor = {}) {
  const authored = (service.faqs || [])
    .filter((f) => f && (f.question || f.q) && (f.answer || f.a))
    .map((f) => ({ q: String(f.question || f.q), a: String(f.answer || f.a) }));
  if (authored.length) return authored;

  const name = clean(service.title) || 'this service';
  const provider = clean(vendor.name);
  const faqs = [{
    q: `How do I book ${name}?`,
    a: `Choose a time that suits you on this page and pay securely online.${provider ? ` Your session with ${provider} is confirmed instantly,` : ` Your booking is confirmed instantly,`} with reminders before it starts.`,
  }];

  const price = Number(service.price);
  if (price > 0) {
    faqs.push({ q: `How much does ${name} cost?`, a: `${name} costs ₹${price.toLocaleString('en-IN')}, paid securely online when you book.` });
  } else if (service.price === 0) {
    faqs.push({ q: `Is ${name} free?`, a: `Yes — ${name} is free to book on Book A Sloth.` });
  }
  if (service.duration) {
    faqs.push({ q: `How long is ${name}?`, a: `${name} runs for about ${service.duration} minutes, held ${service.meeting_mode === 'offline' ? 'in person' : 'online'}.` });
  }
  const inc = (service.included_items || []).filter(Boolean);
  if (inc.length) {
    faqs.push({ q: `What's included in ${name}?`, a: `${name} includes: ${inc.join(', ')}.` });
  }
  faqs.push({
    q: `Is payment secure?`,
    a: `Yes — payments are processed securely online and you receive booking confirmation and reminders automatically.`,
  });
  return faqs;
}

function hostContent(payload) {
  const { host = {}, services = [] } = payload || {};
  const name = clean(host.name) || 'Host';
  const headings = [{ tag: 'h1', text: name }];
  if (host.profession) headings.push({ tag: 'h2', text: clean(host.profession) });
  const internal = [`${SITE_URL}/${host.username}`];
  const images = [];
  if (host.profile_image) images.push({ src: host.profile_image, alt: name });

  for (const s of services) {
    if (!s || !s.title) continue;
    headings.push({ tag: 'h2', text: clean(s.title) });
    if (s.slug) internal.push(`${SITE_URL}/${host.username}/${s.slug}`);
    if (s.thumbnail_url) images.push({ src: s.thumbnail_url, alt: clean(s.title) || '' });
  }

  // FAQ questions become extractable headings; answers feed body text — this is
  // what lifts the crawler's structure + answer-coverage dimensions.
  const faqs = profileFaqs(host, services);
  for (const f of faqs) headings.push({ tag: 'h3', text: f.q });

  const reviews = payload?.reviews || [];
  const { bodyText, wordCount } = wc([
    host.bio, host.profession,
    ...services.flatMap((s) => [s?.title, s?.short_description, s?.description]),
    ...faqs.flatMap((f) => [f.q, f.a]),
    ...reviews.map((r) => r?.comment || r?.text),
  ]);

  return {
    headings, images, wordCount, bodyText, faqs,
    links: { internal: [...new Set(internal)], external: sameAsFrom(host) },
    entity: {
      type: 'Person', name, author: name, sameAs: sameAsFrom(host),
      dates: { published: null, updated: host.updated_at || null },
    },
    evidence: { reviewCount: reviews.length, avgRating: payload?.avgRating || 0 },
  };
}

function serviceContent(payload) {
  const { service = {}, vendor = {}, reviews = [], avgRating = 0 } = payload || {};
  const title = clean(service.title) || 'Service';
  const providerName = clean(vendor.name) || null;
  const headings = [{ tag: 'h1', text: title }];
  if (providerName) headings.push({ tag: 'h2', text: `With ${providerName}` });
  const internal = [];
  if (vendor.username) internal.push(`${SITE_URL}/${vendor.username}`);
  const images = [];
  const thumb = service.seo_image || service.thumbnail_url;
  if (thumb) images.push({ src: thumb, alt: title });

  // FAQ questions become extractable headings; answers feed body text — this is
  // what lifts the crawler's structure + answer-coverage dimensions.
  const faqs = serviceFaqs(service, vendor);
  for (const f of faqs) headings.push({ tag: 'h3', text: f.q });

  const { bodyText, wordCount } = wc([
    service.short_description, service.description, providerName,
    ...faqs.flatMap((f) => [f.q, f.a]),
    ...reviews.map((r) => r?.comment || r?.text),
  ]);

  return {
    headings, images, wordCount, bodyText, faqs,
    links: { internal: [...new Set(internal)], external: [] },
    entity: {
      type: 'Service', name: title, author: providerName,
      sameAs: [], dates: { published: null, updated: service.updated_at || null },
    },
    evidence: { reviewCount: reviews.length, avgRating },
  };
}

// payload is the SAME object the prerender resolver returns (outcome.payload). Fail
// soft: an unknown type or empty payload returns null so the crawler falls back to
// meta-only signals rather than throwing mid-crawl.
function build(pageType, payload) {
  try {
    if (!payload) return null;
    if (pageType === 'host') return hostContent(payload);
    if (pageType === 'service') return serviceContent(payload);
    return null;
  } catch {
    return null;
  }
}

module.exports = { build, sameAsFrom, profileFaqs, serviceFaqs };
