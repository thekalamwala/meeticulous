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
