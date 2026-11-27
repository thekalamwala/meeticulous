// profileFaqs.js — templated, data-derived FAQ for a host profile.
//
// WHY: profile pages had no Q&A structure, so the GEO/AEO "answer coverage" and
// "structure" dimensions scored low and the page offered nothing for AI answer
// engines to lift. These questions are the ones a guest (or an AI) actually asks
// about a bookable host, answered ONLY from real profile data — no invented
// claims, so the FAQPage schema always matches what the page shows.
//
// MIRROR: server/services/seo/pageContentModel.js builds the same questions into
// the crawler's content model (headings + text) so the /admin/seo drawer score
// reflects what this renders. Keep the two in sync.

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// host: { name, profession, location, social_links, ... }; services: [{ title, price }]
export function profileFaqs({ host = {}, services = [] } = {}) {
  const name = host.name || 'this host';
  const priced = (services || []).map((s) => Number(s?.price)).filter((p) => p > 0);
  const faqs = [];

  faqs.push({
    q: `How do I book ${name}?`,
    a: `Pick a service on ${name}'s page, choose a time that suits you and pay securely online. Your booking is confirmed instantly and you get reminders before the session.`,
  });

  if (services && services.length) {
    faqs.push(priced.length ? {
      q: `How much does ${name} charge?`,
      a: `${name} has ${services.length} bookable service${services.length > 1 ? 's' : ''}, starting from ${inr(Math.min(...priced))}. Full pricing is shown on each service above.`,
    } : {
      q: `What can I book with ${name}?`,
      a: `${name} offers ${services.length} bookable service${services.length > 1 ? 's' : ''} you can schedule directly on this page.`,
    });
  }

  if (host.profession) {
    faqs.push({
      q: `What does ${name} do?`,
      a: `${name} is a ${host.profession}${host.location ? ` based in ${host.location}` : ''} taking bookings on Meeticulous.`,
    });
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
// answer it from, and policy is never invented. MIRROR: catalogFaqs in
// server/services/seo/pageContentModel.js (bot shell renders the same Q&A).
const DOWNLOAD_A = 'Right after payment you get a secure download link on screen and by email. Each link works for 24 hours and up to 3 downloads, and you can request a fresh one from the product page.';
const COURSE_A = 'Log in and buy the course once. It unlocks on the course page straight away and stays in your account under My courses, so you can watch anytime.';
const priceOf = (n) => (Number(n) > 0 ? inr(n) : 'free');
const listOf = (items, fmt) => items.slice(0, 5).map(fmt).join('; ');

// kind: 'products' | 'courses' | 'membership' | 'product' | 'course'
export function catalogFaqs({ kind, host = {}, items = [], item = null, program = null } = {}) {
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
// missing; nothing is invented. MIRROR: catalogSections + updatedLabel in
// server/services/seo/pageContentModel.js (the bot shell renders the same blocks);
// the parity fixture asserts both.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "Updated 27 Nov 2026" from an ISO timestamp (UTC date, so build box and browser agree).
export function updatedLabel(ts) {
  const d = new Date(ts || '');
  if (!ts || Number.isNaN(d.getTime())) return '';
  return `Updated ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
// Newest updated_at among rows (ISO string) or ''.
export function latestUpdate(rows = []) {
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
export function catalogSections({ kind, host = {}, items = [], item = null, services = [], rating = null } = {}) {
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
