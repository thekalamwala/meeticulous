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

const SITE_URL = (process.env.SITE_URL || 'https://meeticulous.com').replace(/\/$/, '');

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
// summary: profileMeta().description (optional) — MIRRORS the client.
function profileFaqs(host = {}, services = [], summary = '') {
  const name = clean(host.name) || 'this host';
  const priced = (services || []).map((s) => Number(s && s.price)).filter((p) => p > 0);
  // "What is {name} all about?" carries the data-built profile summary (who they
  // are, what they offer, real rating). It used to sit as a line at the top of the
  // profile; founder 2026-11-28 moved it here. It says everything "What does {name}
  // do?" said, so that question is only asked when there is no summary.
  const faqs = summary ? [{ q: `What is ${name} all about?`, a: summary }] : [];
  faqs.push({
    q: `How do I book ${name}?`,
    a: `Pick a service on ${name}'s page, choose a time that suits you and pay securely online. Your booking is confirmed instantly and you get reminders before the session.`,
  });
  if (services && services.length) {
    faqs.push(priced.length ? {
      q: `How much does ${name} charge?`,
      a: `${name} has ${services.length} bookable service${services.length > 1 ? 's' : ''}, starting from ₹${Math.min(...priced).toLocaleString('en-IN')}.`,
    } : {
      q: `What can I book with ${name}?`,
      a: `${name} offers ${services.length} bookable service${services.length > 1 ? 's' : ''} you can schedule directly on this page.`,
    });
  }
  if (host.profession && !summary) {
    faqs.push({
      q: `What does ${name} do?`,
      a: `${name} is a ${clean(host.profession)}${host.location ? ` based in ${clean(host.location)}` : ''} taking bookings on Meeticulous.`,
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
    faqs.push({ q: `Is ${name} free?`, a: `Yes — ${name} is free to book on Meeticulous.` });
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

// ── Catalog FAQ (products / courses / membership tabs, product + course pages) ──
// Visible 3–4 question FAQ built ONLY from real catalog data and how the purchase
// flow actually works (download link rules, course unlock, monthly billing and
// cancel-at-period-end). No refund question: there is no refund policy field to
// answer it from, and policy is never invented. MIRRORS catalogFaqs in
// client/src/utils/profileFaqs.js VERBATIM (bot shell renders the same Q&A).
const DOWNLOAD_A = 'Right after payment you get a secure download link on screen and by email. Each link works for 24 hours and up to 3 downloads, and you can request a fresh one from the product page.';
const COURSE_A = 'Log in and buy the course once. It unlocks on the course page straight away and stays in your account under My courses, so you can watch anytime.';
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const priceOf = (n) => (Number(n) > 0 ? inr(n) : 'free');
const listOf = (items, fmt) => items.slice(0, 5).map(fmt).join('; ');

// kind: 'products' | 'courses' | 'membership' | 'product' | 'course'
function catalogFaqs({ kind, host = {}, items = [], item = null, program = null } = {}) {
  const name = host.name || 'this host';
  const list = (items || []).filter((i) => i && (i.title || i.name));
  const paid = (arr, key = 'price') => arr.map((i) => Number(i[key])).filter((p) => p > 0);

  if (kind === 'products') {
    const p = paid(list);
    return [
      { q: `What digital products does ${name} sell?`, a: `${name} sells ${list.length} digital product${list.length === 1 ? '' : 's'}: ${listOf(list, (i) => `${i.title} (${priceOf(i.price)})`)}.` },
      { q: 'How do I get my download after paying?', a: DOWNLOAD_A },
      { q: 'How do I pay?', a: `Pay securely online with UPI, card or wallet${p.length ? `; prices start at ${inr(Math.min(...p))}` : ''}. Free products only need a one-time code sent to your WhatsApp.` },
    ];
  }
  if (kind === 'courses') {
    const p = paid(list);
    return [
      { q: `What courses does ${name} offer?`, a: `${name} offers ${list.length} online course${list.length === 1 ? '' : 's'}: ${listOf(list, (c) => `${c.title} (${Number(c.lesson_count) || 0} lessons, ${priceOf(c.price)})`)}.` },
      { q: 'How do I get access after paying?', a: COURSE_A },
      { q: 'How much do the courses cost?', a: p.length ? `Courses start at ${inr(Math.min(...p))}. You pay once and keep lifetime access, with no subscription.` : 'These courses are free. Log in to unlock them.' },
    ];
  }
  if (kind === 'membership') {
    const prog = (program && program.name) || `${name}'s membership`;
    const perks = (t) => (Array.isArray(t.perks) && t.perks.length ? `: ${t.perks.join(', ')}` : '');
    const tierPrice = (t) => (t.type === 'free' || !(Number(t.price_inr) > 0) ? 'free' : `${inr(t.price_inr)}/month`);
    const anyPaid = list.some((t) => t.type !== 'free' && Number(t.price_inr) > 0);
    return [
      { q: `What do ${prog} members get?`, a: `${listOf(list, (t) => `${t.name} (${tierPrice(t)})${perks(t)}`)}.` },
      { q: 'How much does it cost?', a: anyPaid ? `${listOf(list, (t) => `${t.name}: ${tierPrice(t)}`)}. Paid tiers are billed monthly.` : 'Joining is free.' },
      ...(anyPaid ? [{ q: 'Can I cancel?', a: 'Yes. Cancel anytime from My memberships in your account; your access stays on until the end of the month you have paid for.' }] : []),
      { q: 'How do I get access after joining?', a: 'Log in and pick a tier. Free tiers open instantly and paid tiers right after secure payment; member posts then unlock on this page.' },
    ];
  }
  if (kind === 'product' && item) {
    const t = item.title || 'This product';
    return [
      { q: `What's included in ${t}?`, a: `${t} is a ${String(item.type || 'digital product').replace(/_/g, ' ')} by ${name}.${item.description ? ` ${String(item.description).trim()}` : ''}` },
      { q: 'How do I get access after paying?', a: DOWNLOAD_A },
      { q: `How much does ${t} cost?`, a: Number(item.price) > 0 ? `${t} costs ${inr(item.price)}. Any platform fee and GST are shown before you pay.` : `${t} is free. Verify with a one-time code sent to your WhatsApp to download it.` },
    ];
  }
  if (kind === 'course' && item) {
    const t = item.title || 'This course';
    const lessons = (item.course_lessons || []).map((l) => l && l.title).filter(Boolean);
    const n = Number(item.lesson_count ?? lessons.length) || 0;
    return [
      { q: `What's included in ${t}?`, a: `${n} video lesson${n === 1 ? '' : 's'}${lessons.length ? `: ${lessons.slice(0, 5).join(', ')}${lessons.length > 5 ? ' and more' : ''}` : ''}.` },
      { q: 'How do I get access after paying?', a: COURSE_A },
      { q: `How much does ${t} cost?`, a: Number(item.price) > 0 ? `${t} costs ${inr(item.price)}, paid once for lifetime access. Any platform fee and GST are shown before you pay.` : `${t} is free. Log in to unlock it.` },
    ];
  }
  return [];
}

// ── Catalog + profile sections (answer-first, self-contained, real data only) ──
// Clearly headed blocks a reader or an answer engine can lift on their own: what
// the item is, who made it, how you get it (the real purchase flow), and on the
// profile an "About" block of real stats. A section is omitted when its data is
// missing; nothing is invented. MIRRORS catalogSections + updatedLabel in
// client/src/utils/profileFaqs.js VERBATIM (the bot shell renders the same blocks);
// the parity fixture asserts both.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "Updated 27 Nov 2026" from an ISO timestamp (UTC date, so build box and browser agree).
function updatedLabel(ts) {
  const d = new Date(ts || '');
  if (!ts || Number.isNaN(d.getTime())) return '';
  return `Updated ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
// Newest updated_at among rows (ISO string) or ''.
function latestUpdate(rows = []) {
  return (rows || []).map((r) => r && r.updated_at).filter(Boolean).sort().pop() || '';
}

const an = (w) => (/^[aeiou]/i.test(String(w || '')) ? 'an' : 'a');
const TYPE_WORD = { pdf: 'PDF', template: 'template', ebook: 'eBook', prompt_pack: 'prompt pack', resource: 'resource', other: 'digital product' };
const DOWNLOAD_STEPS = (paid) => [
  'Enter your name, email and WhatsApp number.',
  'Verify with the one-time code sent to your WhatsApp.',
  ...(paid ? ['Pay securely with UPI, card or wallet through Razorpay.'] : []),
  'Download straight away: the secure link shows on screen and arrives by email.',
  'Each link works for 24 hours and up to 3 downloads, and you can request a fresh one from the product page.',
];
const COURSE_STEPS = (paid) => [
  'Log in to your Meeticulous account.',
  paid ? 'Buy the course once, paying securely through Razorpay.' : 'Unlock the course for free.',
  'Every lesson unlocks on the course page straight away.',
  'The course stays in your account under My courses, so you can watch it anytime.',
];
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const rupee = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Who made it: only when there is something beyond a bare name to say.
function creatorSection(host = {}) {
  const name = host.name || 'The host';
  const prof = String(host.profession || '').trim();
  if (!prof && !host.tagline) return null;
  return {
    key: 'creator',
    heading: 'Who made it',
    paras: [
      `${name}${prof ? ` is ${an(prof)} ${prof}` : ''}${host.location ? ` based in ${host.location}` : ''}, selling on Meeticulous.`,
      ...(host.tagline ? [String(host.tagline).trim()] : []),
    ],
  };
}

// kind: 'profile' | 'products' | 'courses' | 'membership' | 'product' | 'course'
// Section shape: { key, heading, paras?: string[], list?: string[], steps?: string[] }
function catalogSections({ kind, host = {}, items = [], item = null, services = [], rating = null } = {}) {
  const name = host.name || 'this host';
  const list = (items || []).filter((i) => i && (i.title || i.name));
  const paidPrices = list.map((i) => Number(i.price)).filter((p) => p > 0);

  if (kind === 'profile') {
    const facts = [];
    const svc = (services || []).filter((s) => s && s.title);
    if (svc.length) facts.push(plural(svc.length, 'bookable service'));
    if (Number(host.booking_count) > 0) facts.push(`${plural(Number(host.booking_count), 'booking')} on Meeticulous`);
    if (rating && rating.count > 0 && rating.avg > 0) facts.push(`Rated ${Number(rating.avg).toFixed(1)} out of 5 from ${plural(rating.count, 'review')}`);
    if (Number(host.product_count) > 0) facts.push(plural(Number(host.product_count), 'digital product'));
    if (Number(host.course_count) > 0) facts.push(plural(Number(host.course_count), 'online course'));
    const since = host.created_at && !Number.isNaN(new Date(host.created_at).getTime()) ? new Date(host.created_at).getUTCFullYear() : null;
    if (since) facts.push(`On Meeticulous since ${since}`);
    if (!facts.length) return [];
    const prof = String(host.profession || '').trim();
    return [{
      key: 'about',
      heading: `About ${name}`,
      paras: [`${name}${prof ? ` is ${an(prof)} ${prof}` : ' takes bookings on Meeticulous'}${host.location ? ` based in ${host.location}` : ''}.`],
      list: facts.map((f) => f.charAt(0).toUpperCase() + f.slice(1)),
    }];
  }

  if (kind === 'products' || kind === 'courses') {
    if (!list.length) return [];
    const products = kind === 'products';
    const from = paidPrices.length ? `, from ${rupee(Math.min(...paidPrices))}` : '';
    return [
      {
        key: 'intro',
        heading: products ? `About ${name}'s digital products` : `About ${name}'s online courses`,
        paras: [
          `${name} sells ${plural(list.length, products ? 'digital product' : 'online course')} on Meeticulous${from}.`,
          products
            ? 'Every product is a download: pay once and the link is yours, with nothing to subscribe to.'
            : 'Every course is a set of video lessons you buy once and keep, with nothing to subscribe to.',
        ],
      },
      products
        ? { key: 'access', heading: 'How buying works', steps: DOWNLOAD_STEPS(paidPrices.length > 0) }
        : { key: 'access', heading: 'How access works', steps: COURSE_STEPS(paidPrices.length > 0) },
    ];
  }

  if (kind === 'membership') {
    if (!list.length) return [];
    const anyPaid = list.some((t) => t.type !== 'free' && Number(t.price_inr) > 0);
    const anyFree = list.some((t) => t.type === 'free' || !(Number(t.price_inr) > 0));
    return [{
      key: 'how',
      heading: 'How membership works',
      steps: [
        'Log in and pick a tier.',
        ...(anyFree ? ['Free tiers open instantly.'] : []),
        ...(anyPaid ? ['Paid tiers are billed monthly through Razorpay and open as soon as the payment goes through.'] : []),
        `Member posts from ${name} unlock on this page as soon as you join.`,
        ...(anyPaid ? [
          'Move up a tier any time: you pay only the difference for the days left on your current one.',
          'Cancel anytime from My memberships; your access stays on until the end of the month you have paid for.',
        ] : []),
      ],
    }];
  }

  if (kind === 'product' && item) {
    const t = item.title || 'This product';
    const type = TYPE_WORD[item.type] || TYPE_WORD.other;
    const paid = Number(item.price) > 0;
    const creator = creatorSection(host);
    return [
      {
        key: 'included',
        heading: "What's included",
        paras: [`${t} is ${an(type)} ${type} by ${name}.`, ...(item.description ? [String(item.description).trim()] : [])],
        list: [`Format: ${type.charAt(0).toUpperCase()}${type.slice(1)}`, `Price: ${paid ? rupee(item.price) : 'Free'}`, 'Delivery: instant download'],
      },
      ...(creator ? [creator] : []),
      { key: 'access', heading: 'How you get it', steps: DOWNLOAD_STEPS(paid) },
    ];
  }

  if (kind === 'course' && item) {
    const lessons = (item.course_lessons || []).map((l) => l && l.title).filter(Boolean);
    const paid = Number(item.price) > 0;
    const creator = creatorSection(host);
    return [
      ...(lessons.length || item.description ? [{
        key: 'learn',
        heading: "What you'll learn",
        paras: item.description ? [String(item.description).trim()] : [],
        steps: lessons,
      }] : []),
      ...(creator ? [creator] : []),
      { key: 'access', heading: 'How access works', steps: COURSE_STEPS(paid) },
    ];
  }
  return [];
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
  const reviewsForMeta = payload?.reviews || [];
  const { description: summary } = require('./catalogSeo').profileMeta({
    host, services, rating: { avg: Number(payload?.avgRating) || 0, count: reviewsForMeta.length },
  });
  const faqs = profileFaqs(host, services, summary);
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

module.exports = { build, sameAsFrom, profileFaqs, serviceFaqs, catalogFaqs, catalogSections, updatedLabel, latestUpdate };
