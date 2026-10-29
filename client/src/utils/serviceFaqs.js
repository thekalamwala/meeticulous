// serviceFaqs.js — templated, data-derived FAQ for a service page.
//
// WHY: most services carry no host-authored FAQ, so the FAQ tab showed "No FAQs
// provided." and the page offered nothing for AI answer engines to lift — the
// GEO/AEO "answer structure" dimension scored low. These questions are the ones a
// guest (or an AI) actually asks about a bookable service, answered ONLY from real
// service data — no invented claims, so the FAQPage schema always matches what the
// page shows. Host-authored service.faqs always win when present (see caller).
//
// MIRROR: server/services/seo/pageContentModel.js has the same questions (as {q,a})
// for the bot prerender shell + crawler content model. Keep the two in sync.

const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// service: { title, price, duration, meeting_mode, included_items }; vendor: { name }
export function serviceFaqs({ service = {}, vendor = {} } = {}) {
  const name = service.title || 'this service';
  const provider = vendor.name;
  const faqs = [{
    question: `How do I book ${name}?`,
    answer: `Choose a time that suits you on this page and pay securely online.${provider ? ` Your session with ${provider} is confirmed instantly,` : ` Your booking is confirmed instantly,`} with reminders before it starts.`,
  }];

  const price = Number(service.price);
  if (price > 0) {
    faqs.push({ question: `How much does ${name} cost?`, answer: `${name} costs ${inr(price)}, paid securely online when you book.` });
  } else if (service.price === 0) {
    faqs.push({ question: `Is ${name} free?`, answer: `Yes — ${name} is free to book on Meeticulous.` });
  }

  if (service.duration) {
    faqs.push({ question: `How long is ${name}?`, answer: `${name} runs for about ${service.duration} minutes, held ${service.meeting_mode === 'offline' ? 'in person' : 'online'}.` });
  }

  const inc = (service.included_items || []).filter(Boolean);
  if (inc.length) {
    faqs.push({ question: `What's included in ${name}?`, answer: `${name} includes: ${inc.join(', ')}.` });
  }

  faqs.push({
    question: `Is payment secure?`,
    answer: `Yes — payments are processed securely online and you receive booking confirmation and reminders automatically.`,
  });

  return faqs;
}
