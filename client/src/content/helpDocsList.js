/**
 * helpDocsList.js — the ordered help-center table of contents.
 *
 * Plain data (no Vite-only imports) so BOTH the browser bundle (helpDocs.js) and
 * the Node prerender script (scripts/prerender.mjs) can import it. The article
 * BODIES live in docs/help/*.md (the same files the support bot is seeded from —
 * single source of truth); this file only fixes their ORDER and CATEGORY for the
 * index page and the prerender route list. Titles/excerpts are read from the
 * markdown itself, not duplicated here.
 *
 * Adding an article = add its .md to docs/help/ AND a line here. A test
 * (helpDocs.test.jsx) fails if the two ever drift.
 */

export const HELP_CATEGORIES = ['Guests', 'Hosts', 'General'];

export const HELP_DOCS = [
  // Guests
  { slug: 'booking-a-service', category: 'Guests' },
  { slug: 'signing-in-with-your-phone', category: 'Guests' },
  { slug: 'otp-problems', category: 'Guests' },
  { slug: 'is-my-booking-confirmed', category: 'Guests' },
  { slug: 'reschedule-or-cancel', category: 'Guests' },
  { slug: 'refunds-and-failed-payments', category: 'Guests' },
  { slug: 'leaving-a-review', category: 'Guests' },
  { slug: 'buying-digital-products', category: 'Guests' },
  { slug: 'your-profile-and-email-preferences', category: 'Guests' },
  // Hosts
  { slug: 'becoming-a-host', category: 'Hosts' },
  { slug: 'creating-and-managing-services', category: 'Hosts' },
  { slug: 'availability-and-google-calendar', category: 'Hosts' },
  { slug: 'getting-paid', category: 'Hosts' },
  { slug: 'plans-and-upgrading', category: 'Hosts' },
  { slug: 'why-am-i-not-getting-bookings', category: 'Hosts' },
  { slug: 'your-username-and-booking-link', category: 'Hosts' },
  { slug: 'branding-and-theme-colours', category: 'Hosts' },
  { slug: 'selling-digital-products', category: 'Hosts' },
  { slug: 'reminders-notifications-and-badges', category: 'Hosts' },
  { slug: 'kyc-and-verification', category: 'Hosts' },
  // General / Trust
  { slug: 'what-is-meeticulous', category: 'General' },
  { slug: 'pricing-and-commission', category: 'General' },
  { slug: 'is-my-payment-and-data-safe', category: 'General' },
  { slug: 'whats-not-supported-yet', category: 'General' },
  { slug: 'troubleshooting-and-errors', category: 'General' },
  { slug: 'contact-support', category: 'General' },
];

export const HELP_SLUGS = HELP_DOCS.map((d) => d.slug);
