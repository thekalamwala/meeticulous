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
