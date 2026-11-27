// server/services/seo/catalogSeo.js
// Answer-first <title> / meta description templates for host pages and their
// catalog (profile, service, profile tabs, product, course) + the slug-only URL
// helpers. MIRRORS the same block in client/src/utils/seo.js VERBATIM (CJS here,
// ESM there; the server deploys separately so it cannot import the client).
// The committed parity fixture (client/src/utils/__tests__/__fixtures__/
// seoGraphParity.json) is asserted by BOTH suites — drift fails one of them.

const JUNK_LOC = /^(wfh|remote|online|virtual|anywhere|india|worldwide|global|n\/?a|-|\.)$/i;
const cityForSeo = (loc) => {
  const first = String(loc || '').split(',')[0].trim();
  if (!first || first.length > 24 || JUNK_LOC.test(first)) return null;
  return first.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};


const TITLE_MAX = 60;
const DESC_MAX = 160;
const DESC_MIN = 140;
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
// a/an for the word that follows ("an online", "an 8-min", "a PDF", "an SEO …").
// An all-caps acronym is read letter by letter, so F/H/L/M/N/R/S/X take "an".
const article = (w) => {
  const s = String(w || '');
  if (/^[A-Z]{2,}\b/.test(s)) return /^[AEFHILMNORSX]/.test(s) ? 'an' : 'a';
  return /^([aeiou]|8|11\b|18\b)/i.test(s) ? 'an' : 'a';
};
const firstFit = (cands, max = TITLE_MAX) => {
  const list = cands.filter(Boolean);
  return list.find((c) => c.length <= max) || list[list.length - 1];
};
const joinS = (...parts) => parts.filter(Boolean).join(' ');
// Cut at a word boundary with an ellipsis; '' when there is no useful room.
const clip = (s, n) => {
  const str = String(s || '');
  if (str.length <= n) return str;
  if (n < 24) return '';
  const cut = str.slice(0, n - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > 12 ? cut.slice(0, sp) : cut).replace(/[\s,;:.—-]+$/, '')}…`;
};
// First sentence of free text, always ending in terminal punctuation ('' if none).
const firstSentence = (text) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  const m = t.match(/^.+?[.!?](?=\s|$)/);
  const s = (m ? m[0] : t).trim();
  return /[.!?…]$/.test(s) ? s : `${s}.`;
};
// Whole sentences of free text that fit in n chars; if not even the first fits,
// that sentence cut at a word boundary.
const clipSentences = (text, n) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t || n <= 0) return '';
  const sentences = t.match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) || [t];
  let out = '';
  for (const raw of sentences) {
    const next = joinS(out, /[.!?…]$/.test(raw.trim()) ? raw.trim() : `${raw.trim()}.`);
    if (next.length > n) break;
    out = next;
  }
  return out || clip(firstSentence(t), n);
};
// head (always) + flex (whole sentences, clipped to fit) + fillers (only to reach
// DESC_MIN) + tail. A filler may be [long, short] alternatives: the first that
// still fits is used, so one data-true sentence lands the 140–160 window. `flex`
// may be alternatives too (e.g. 3 item names, then 2, then 1): the first that
// fits whole wins, else the last one is clipped.
const fitDescription = ({ head = [], flex = '', tail = '', fillers = [] } = {}) => {
  const base = joinS(...head);
  const build = (mid) => joinS(base, mid, tail);
  const room = DESC_MAX - build('').length - 1;
  const alts = (Array.isArray(flex) ? flex : [flex]).filter(Boolean);
  let mid = alts.slice(0, -1).find((a) => a.length <= room) || clipSentences(alts[alts.length - 1], room);
  for (const f of fillers) {
    if (build(mid).length >= DESC_MIN) break;
    const pick = (Array.isArray(f) ? f : [f]).filter(Boolean).find((alt) => build(joinS(mid, alt)).length <= DESC_MAX);
    if (pick) mid = joinS(mid, pick);
  }
  return clip(build(mid), DESC_MAX);
};
// "from ₹199" (cheapest paid) · "free" (all free) · '' (no prices).
const priceFrom = (prices = []) => {
  const p = prices.map(Number).filter((x) => Number.isFinite(x));
  const paid = p.filter((x) => x > 0);
  if (paid.length) return `from ${inr(Math.min(...paid))}`;
  return p.length ? 'free' : '';
};
const capFirst = (s) => String(s || '').replace(/^\w/, (c) => c.toUpperCase());

// Digital product types → human labels (lower-case for running text).
const PRODUCT_TYPE = { pdf: 'PDF', template: 'template', ebook: 'eBook', prompt_pack: 'prompt pack', resource: 'resource', other: 'digital product' };
const productType = (t) => PRODUCT_TYPE[t] || PRODUCT_TYPE.other;

// Profile: "{Name} — {Profession} in {City} | Meeticulous", parts dropped to fit.
const profileMeta = ({ host = {}, services = [], rating = null } = {}) => {
  const name = host.name || 'Host';
  const prof = String(host.profession || '').trim();
  const city = cityForSeo(host.location);
  const withProf = prof ? `${name} — ${prof}` : name;
  const withCity = city ? `${withProf} in ${city}` : withProf;
  const title = firstFit([`${withCity} | Meeticulous`, withCity, `${withProf} | Meeticulous`, withProf, `${name} | Meeticulous`, name]);
  const who = prof ? `${name} is ${article(prof)} ${prof}${city ? ` in ${city}` : ''}.`
    : city ? `${name} is based in ${city}.` : `${name} takes bookings on Meeticulous.`;
  const list = (services || []).filter((s) => s && s.title);
  const from = priceFrom(list.filter((s) => !s.price_on_request).map((s) => s.price));
  const offer = !list.length ? ''
    : from === 'free' ? `${list.length} free ${list.length === 1 ? 'service' : 'services'}`
    : `${plural(list.length, 'service')}${from ? ` ${from}` : ''}`;
  // Rating clause ONLY for real reviews of this host (never a platform default).
  const stars = rating && rating.count > 0 && rating.avg > 0
    ? `${Number(rating.avg).toFixed(1)}★ (${plural(rating.count, 'review')})` : '';
  const facts = [offer, stars].filter(Boolean).join(' · ');
  return {
    title,
    description: fitDescription({
      head: [who, facts && `${facts}.`],
      flex: firstSentence(host.bio),
      tail: 'Book online.',
      fillers: [['Pick a time that suits you and pay securely online.', 'Pay securely online.'], ['Instant confirmation and reminders.', 'Instant confirmation.']],
    }),
  };
};

// Service: "Book a 30-min online {Service} with {Name} for ₹{price}. {summary}"
const serviceDescription = ({ service = {}, vendor = {} } = {}) => {
  const t = service.title || 'Service';
  const dur = Number(service.duration) > 0 ? `${Number(service.duration)}-min ` : '';
  const lead = `${dur}${service.meeting_mode === 'offline' ? 'in-person' : 'online'}`;
  const price = service.price_on_request ? ''
    : Number(service.price) > 0 ? ` for ${inr(service.price)}`
    : service.price != null && Number(service.price) === 0 ? ' for free' : '';
  return fitDescription({
    head: [`Book ${article(lead)} ${lead} ${t}${vendor.name ? ` with ${vendor.name}` : ''}${price}.`],
    flex: firstSentence(service.short_description || service.description),
    fillers: [
      ['Pick a time that suits you and pay securely online.', 'Pay securely online.'],
      ['Instant confirmation and reminders.', 'Instant confirmation.'],
      service.price_on_request ? 'Price on request.' : '',
    ],
  });
};

// Profile tabs (/:username/products|courses|membership).
const TAB_TITLE = { products: 'Digital products', courses: 'Online courses' };
const profileTabMeta = ({ tab, host = {}, items = [], program = null } = {}) => {
  const name = host.name || 'Host';
  const list = (items || []).filter((i) => i && (i.title || i.name));
  const n = list.length;
  // Top item names, 3 → 2 → 1, whichever fits whole.
  const namesFit = (prefix) => [3, 2, 1].filter((k) => k <= n)
    .map((k) => `${prefix} ${list.slice(0, k).map((i) => i.title || i.name).join(', ')}.`);
  if (tab === 'membership') {
    const prog = (program && program.name) || '';
    const title = prog
      ? firstFit([`${prog} — membership by ${name}`, `${prog} — membership`, prog])
      : firstFit([`Membership by ${name}`, 'Membership']);
    const paid = list.filter((t) => t.type !== 'free').map((t) => t.price_inr);
    const from = priceFrom(paid.length ? paid : list.map(() => 0));
    const fromTxt = from === 'free' ? 'free to join' : from ? `${from}/month` : '';
    return {
      title,
      description: fitDescription({
        head: [`Join ${prog ? `${prog}, ${name}'s membership` : `${name}'s membership`}${n ? ` — ${plural(n, 'tier')}${fromTxt ? ` ${fromTxt}` : ''}` : ''}.`],
        flex: namesFit('Tiers:'),
        tail: 'Cancel anytime.',
        fillers: [
          firstSentence(program && program.blurb),
          ['Members-only posts unlock as soon as you join.', 'Member posts unlock on joining.'],
          paid.length ? 'Billed monthly.' : '',
        ],
      }),
    };
  }
  const label = TAB_TITLE[tab];
  if (!label) return { title: '', description: '' };
  const noun = tab === 'products' ? 'digital product' : 'online course';
  const from = priceFrom(list.map((i) => i.price));
  const fromTxt = from === 'free' ? (n > 1 ? 'all free' : 'free') : from;
  return {
    title: firstFit([`${label} by ${name} (${n})`, `${label} by ${name}`, label]),
    description: fitDescription({
      head: [`${plural(n, noun)} by ${name}${fromTxt ? `, ${fromTxt}` : ''}.`],
      flex: namesFit('Includes'),
      tail: tab === 'products' ? 'Instant download after secure payment.' : 'Buy once, lifetime access.',
      fillers: tab === 'products'
        ? [['Pay with UPI, card or wallet.', 'UPI, card or wallet.'], `More on ${name}'s profile.`]
        : [['Watch every lesson anytime, on any device.', 'Watch anytime.'], 'Pay securely online.'],
    }),
  };
};

// Product: "{Product} — {Type} by {Name}" (type dropped first when it won't fit).
const productMeta = ({ product = {}, host = {} } = {}) => {
  const t = product.title || 'Digital product';
  const name = host.name || 'Host';
  const type = productType(product.type);
  const free = Number(product.price) === 0;
  return {
    title: firstFit([`${t} — ${capFirst(type)} by ${name}`, `${t} — ${name}`, t]),
    description: fitDescription({
      head: [`${capFirst(type)} by ${name}.`],
      flex: product.description,
      tail: free ? 'Free, instant download.' : `${inr(product.price)}, instant download.`,
      fillers: [
        free ? 'Verify with a one-time code to get it.' : ['Pay securely with UPI, card or wallet.', 'UPI, card or wallet.'],
        [`Sold by ${name} on Meeticulous.`, `Sold by ${name}.`],
        [`More digital products on ${name}'s profile.`, `More on ${name}'s profile.`],
      ],
    }),
  };
};

// Course: "{Course} — course by {Name}". Lessons carry no duration today, so
// hours are omitted rather than guessed.
const courseMeta = ({ course = {}, host = {} } = {}) => {
  const t = course.title || 'Course';
  const name = host.name || 'Host';
  const lessons = Number(course.lesson_count ?? (course.course_lessons || []).length) || 0;
  const free = Number(course.price) === 0;
  return {
    title: firstFit([`${t} — course by ${name}`, `${t} — ${name}`, t]),
    description: fitDescription({
      head: [lessons ? `${plural(lessons, 'video lesson')} by ${name}.` : `Online course by ${name}.`],
      flex: course.description,
      tail: free ? 'Free, lifetime access.' : `${inr(course.price)}, lifetime access.`,
      fillers: [['Buy once, watch every lesson anytime, on any device.', 'Buy once, watch anytime.'], 'Pay securely online.'],
    }),
  };
};

// Readable, unique anchors for membership tiers (#<tier-slug>, -2 on a clash).
const tierAnchors = (tiers = []) => {
  const used = new Set();
  return (tiers || []).map((t) => {
    const base = String((t && t.name) || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tier';
    let slug = base;
    for (let n = 2; used.has(slug); n += 1) slug = `${base}-${n}`;
    used.add(slug);
    return slug;
  });
};

// Robots for a catalog item page (product/course): follows the host's listability
// (the same gate as the profile + sitemap); noindex inside the ?preview=1 frame.
const catalogRobots = (host = {}, preview = false) => (preview ? 'noindex'
  : host.is_indexable === false ? 'noindex,nofollow'
  : host.is_verified === true ? 'index,follow' : 'noindex,follow');

// Public catalog item URLs — slug only, never a UUID.
const productPath = (username, slug) => `/${username}/products/${slug}`;
const coursePath = (username, slug) => `/${username}/courses/${slug}`;

module.exports = {
  cityForSeo, firstSentence, fitDescription, profileMeta, serviceDescription, profileTabMeta, productMeta, courseMeta, tierAnchors, catalogRobots, productPath, coursePath, productType, capFirst,
};
