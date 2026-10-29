// SEO/AEO content for /services/:profession pages.
//
// Why this file: the /services/:slug pages were thin — a heading plus a
// repeated "Book trusted X professionals for Y" line on every card. Search
// engines saw near-duplicate templates across all 47 professions, and answer
// engines (AI) had no structured Q&A to cite. This adds a unique intro, an
// accurate FAQ (rendered AND emitted as FAQPage JSON-LD), varied card copy, and
// internal cross-links — all client-side so the prerender bakes it for crawlers.
//
// Hybrid model: a generator covers every profession (incl. ones added later),
// with hand-tuned OVERRIDES for the highest-value professions.
//
// FACTUAL GUARDRAILS (keep answers true — MoR platform, see docs):
//   - Guests book via WhatsApp OTP; no account required; phone is identity.
//   - Confirmation goes out over WhatsApp + email.
//   - Prices are host-set and shown upfront before payment.
//   - Payment is online at booking time (Razorpay); slot confirmed instantly.
//   - Hosts verify identity (KYC) to receive payouts.
//   - Do NOT claim "no fees" (platform is merchant-of-record).

// /services slug -> matching /for/:slug marketing landing, where one exists.
// Cross-linking to these both helps the guest AND de-orphans the /for pages.
const FOR_LANDING = {
  photographer: 'photographers',
  videographer: 'photographers',
  'hair-stylist': 'salon',
  'makeup-artist': 'salon',
  'nail-artist': 'salon',
  physiotherapist: 'fitness',
  'language-tutor': 'tutors',
  'ielts-coach': 'tutors',
  'music-teacher': 'tutors',
  'dance-teacher': 'tutors',
};

const lower = (s) => String(s || '').toLowerCase();
const list = (arr, n = 3) => {
  const names = (arr || []).map((s) => s.name).filter(Boolean).slice(0, n);
  if (names.length <= 1) return names[0] || 'a range of sessions';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
};

// Generic, accurate FAQ for any profession.
function genFaqs(label, services) {
  const L = label;
  const l = lower(label);
  return [
    {
      q: `How do I book a ${l} on Meeticulous?`,
      a: `Pick a service below to see verified ${l}s, compare their profiles, prices and reviews, then choose a time that suits you. You confirm with a quick WhatsApp OTP — no account needed — and get instant confirmation by WhatsApp and email.`,
    },
    {
      q: `How much does a ${l} cost?`,
      a: `Each ${L.toLowerCase()} sets their own prices, and you see the exact amount upfront on their profile before you pay — so there are no surprises at checkout.`,
    },
    {
      q: `Are the ${l}s on Meeticulous verified?`,
      a: `Hosts verify their identity (KYC) before they can receive payouts, and every profile shows their services and genuine reviews from past clients, so you can book with confidence.`,
    },
    {
      q: `Can I pay online and get instant confirmation?`,
      a: `Yes. You pay securely online at the time of booking and your slot is confirmed instantly, with the details sent to your WhatsApp and email.`,
    },
    {
      q: `Can I reschedule or cancel my ${l} booking?`,
      a: `Yes — you can manage, reschedule or cancel from your booking confirmation. Each ${l} sets their own cancellation window, shown before you book.`,
    },
  ];
}

function genIntro(label, services) {
  const l = lower(label);
  const count = (services || []).length;
  const examples = list(services, 3);
  return `Looking to book a ${l} online? Meeticulous connects you with verified ${l}s across India offering ${count} bookable ${l} ${count === 1 ? 'service' : 'services'} — from ${examples}. Compare professionals, see real prices and reviews, pick a time, and confirm in minutes. No back-and-forth, no chasing: you book and pay online, and get instant confirmation on WhatsApp and email.`;
}

// Hand-tuned copy for the highest-value professions. `intro` and `faqs` fully
// override the generator; omit either to keep the generated version.
const OVERRIDES = {
  'life-coach': {
    intro:
      'A life coach helps you get unstuck — setting clearer goals, building better habits, and staying accountable week to week. On Meeticulous you can browse verified life coaches, compare their coaching styles, prices and client reviews, and book a session online in minutes. Whether you want a one-off clarity call or ongoing 1:1 coaching, you choose the time, pay securely, and get instant confirmation on WhatsApp and email.',
    faqs: [
      { q: 'What does a life coach actually help with?', a: 'Most life coaches help with goal-setting, confidence, motivation, work-life balance, mindset and building habits that stick. Browse the services below to find the focus that fits you, then pick a coach whose style and reviews you like.' },
      { q: 'How do I book a life coach online?', a: 'Choose a coaching service below, compare verified life coaches by profile, price and reviews, pick a time, and confirm with a quick WhatsApp OTP — no account needed. You get instant confirmation by WhatsApp and email.' },
      { q: 'How much does a life coach cost?', a: 'Each life coach sets their own rates, shown upfront on their profile before you pay. You can compare prices across coaches and start with a single session before committing to a package.' },
      { q: 'Is online life coaching as effective as in person?', a: 'For most goal, mindset and accountability work, online sessions are just as effective — and easier to keep up with. You can book recurring sessions with the same coach to stay on track.' },
      { q: 'Can I reschedule a coaching session?', a: 'Yes. You can reschedule or cancel from your booking confirmation, within each coach’s stated window.' },
    ],
  },
  psychologist: {
    intro:
      'Booking a psychologist should be simple and private. On Meeticulous you can browse verified psychologists, see their areas of focus, session prices and reviews, and book online at a time that works for you — with instant, discreet confirmation on WhatsApp and email. Choose a one-off consultation or a regular slot with the same professional.',
    faqs: [
      { q: 'How do I book a psychologist online?', a: 'Pick a service below, compare verified psychologists by profile, focus area, price and reviews, choose a time, and confirm with a WhatsApp OTP. Your booking details arrive instantly by WhatsApp and email.' },
      { q: 'How much does a session with a psychologist cost?', a: 'Fees are set by each psychologist and shown upfront on their profile before you pay, so you always know the cost in advance.' },
      { q: 'Are the psychologists verified?', a: 'Hosts verify their identity (KYC) before they can receive payouts, and each profile shows their services and real client reviews.' },
      { q: 'Is my booking private?', a: 'Your booking and confirmation are handled directly between you and the psychologist; details go only to your WhatsApp and email.' },
      { q: 'Can I see the same psychologist regularly?', a: 'Yes — once you find a professional you like, you can rebook the same person for ongoing sessions.' },
    ],
  },
  nutritionist: {
    intro:
      'A nutritionist can turn vague goals — more energy, better digestion, a sustainable plan — into a routine that actually fits your life. On Meeticulous you can compare verified nutritionists by their focus, prices and reviews, and book a consultation online in minutes, with instant confirmation on WhatsApp and email.',
    faqs: [
      { q: 'How do I book a nutritionist online?', a: 'Choose a service below, compare verified nutritionists by profile, price and reviews, pick a time and confirm with a WhatsApp OTP — no account needed.' },
      { q: 'How much does a nutritionist consultation cost?', a: 'Each nutritionist sets their own price, shown upfront before you pay. Many offer a first consultation you can book before committing to a plan.' },
      { q: 'What can a nutritionist help me with?', a: 'Common goals include weight management, sports nutrition, gut health, PCOS and diabetes-friendly eating, and building a plan you can stick to. Pick the service that matches your goal.' },
      { q: 'Do I need to travel for the session?', a: 'Most consultations can be done online at a time that suits you; you’ll see the format on each professional’s profile.' },
      { q: 'Can I book follow-up sessions?', a: 'Yes — you can rebook the same nutritionist for follow-ups to track progress and adjust your plan.' },
    ],
  },
  photographer: {
    intro:
      'Whether it’s a portrait shoot, an event, a product catalogue or a wedding, Meeticulous lets you find and book verified photographers online. Compare portfolios, packages, prices and reviews, check availability, and lock in your date in minutes — with instant confirmation on WhatsApp and email, so nothing is left to a missed DM.',
    faqs: [
      { q: 'How do I book a photographer online?', a: 'Pick the type of shoot below, compare verified photographers by their profile, packages, price and reviews, choose your date and confirm with a WhatsApp OTP. Confirmation is instant by WhatsApp and email.' },
      { q: 'How much does a photographer cost?', a: 'Photographers set their own package prices, shown upfront on their profile before you pay, so you can compare shoots and budgets easily.' },
      { q: 'Can I see a photographer’s work before booking?', a: 'Yes — each profile shows the photographer’s services and reviews so you can judge their style and reliability before you book.' },
      { q: 'Can I book a photographer for a specific date?', a: 'Yes, you choose the date and time when you book, and your slot is confirmed instantly online.' },
      { q: 'Can I reschedule the shoot?', a: 'Yes — reschedule or cancel from your booking confirmation, within the photographer’s stated window.' },
    ],
  },
  'makeup-artist': {
    intro:
      'Book a makeup artist for a wedding, party, shoot or a special day — online, without the endless back-and-forth. On Meeticulous you can compare verified makeup artists by their looks, prices and reviews, check availability, and confirm your booking in minutes, with instant confirmation on WhatsApp and email.',
    faqs: [
      { q: 'How do I book a makeup artist online?', a: 'Choose a service below, compare verified makeup artists by profile, price and reviews, pick your date and time, and confirm with a WhatsApp OTP — no account needed.' },
      { q: 'How much does a makeup artist cost?', a: 'Each makeup artist sets their own package prices, shown upfront before you pay, so you can compare looks and budgets in one place.' },
      { q: 'Can the makeup artist travel to my venue?', a: 'Availability and travel are shown on each artist’s profile and services — pick the option that matches your event.' },
      { q: 'Can I book for a specific wedding or event date?', a: 'Yes, you choose the exact date and time, and your booking is confirmed instantly online with details sent to WhatsApp and email.' },
      { q: 'Can I reschedule if my plans change?', a: 'Yes — manage, reschedule or cancel from your booking confirmation, within the artist’s stated window.' },
    ],
  },
  'ielts-coach': {
    intro:
      'Preparing for IELTS is easier with a coach who knows the exam. On Meeticulous you can find verified IELTS coaches, compare their approach, prices and student reviews, and book practice and strategy sessions online — picking times that fit around work or study, with instant confirmation on WhatsApp and email.',
    faqs: [
      { q: 'How do I book an IELTS coach online?', a: 'Pick a service below, compare verified IELTS coaches by profile, price and reviews, choose a time and confirm with a WhatsApp OTP — no account needed.' },
      { q: 'How much does IELTS coaching cost?', a: 'Each coach sets their own rates, shown upfront before you pay. You can start with a single session before booking a full package.' },
      { q: 'Can a coach help with a specific band or module?', a: 'Yes — many coaches focus on speaking, writing, reading or listening, or on hitting a target band. Choose the service that matches your goal.' },
      { q: 'Are sessions online?', a: 'Most IELTS coaching is done online at a time that suits you; the format is shown on each coach’s profile.' },
      { q: 'Can I book regular sessions before my test?', a: 'Yes — rebook the same coach for a run of sessions leading up to your exam date.' },
    ],
  },
};

/**
 * Build the SEO content bundle for a profession page.
 * @param {{slug:string,label:string}} prof
 * @param {Array<{slug:string,name:string,description?:string}>} services
 * @returns {{intro:string, faqs:Array<{q:string,a:string}>, forLanding:string|null}}
 */
export function professionSeo(prof = {}, services = []) {
  const label = prof.label || 'professional';
  const o = OVERRIDES[prof.slug] || {};
  return {
    intro: o.intro || genIntro(label, services),
    faqs: o.faqs || genFaqs(label, services),
    forLanding: FOR_LANDING[prof.slug] || null,
  };
}

// "a"/"an" for a profession label. Acronyms go by letter sound ("an HR Consultant",
// "a UX Designer"); words by first sound, with the u-consonant-consonant rule
// covering "an Umpire" vs "a User". ponytail: heuristic, not a phonetic dictionary.
const AN_LETTERS = 'AEFHILMNORSX';
export const withArticle = (label = '') => {
  const w = String(label).trim().split(/\s+/)[0] || '';
  const acronym = w.length > 1 && w === w.toUpperCase() && /[A-Z]/.test(w);
  const an = acronym ? AN_LETTERS.includes(w[0]) : /^[aeio]/i.test(w) || /^u[^aeiou]{2}/i.test(w);
  return `${an ? 'an' : 'a'} ${label}`;
};

// A few sentence patterns so the per-card copy isn't identical across every
// service and profession (the old text was one repeated line). Deterministic by
// index so prerender output is stable.
const CARD_PATTERNS = [
  (name, l) => `Book ${withArticle(`verified ${l}`)} for ${name} — compare profiles, prices and reviews, then confirm online.`,
  (name, l) => `${name} with trusted ${l}s on Meeticulous. See availability and book in minutes.`,
  (name, l) => `Find and book ${l}s offering ${name}. Real reviews, upfront prices, instant confirmation.`,
  (name, l) => `Need ${name}? Compare verified ${l}s, pick a time, and pay securely online.`,
];

export function cardBlurb(serviceName, label, i = 0) {
  return CARD_PATTERNS[i % CARD_PATTERNS.length](serviceName, lower(label));
}
