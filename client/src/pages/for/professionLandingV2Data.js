/**
 * professionLandingV2Data.js — content + per-page DESIGN config for the v2
 * /for/:profession template (ProfessionLandingV2.jsx).
 *
 * v2 vs v1: a richer, Timewheel-referenced structure (light/dark bands, numbered
 * sections, animated counters, a before/after slider, a "what you get" grid) AND
 * a per-page `design` block so each page can look genuinely DIFFERENT — not just
 * a different accent, but its own palette, hero layout variant, texture and dark
 * band. One engine, distinct skins.
 *
 * Routing: ProfessionLanding.jsx dispatches a slug here first; if a v2 entry
 * exists it renders v2, else it falls back to the v1 template. New v2 slugs must
 * also be added to scripts/prerender.mjs, public/llms.txt and Solutions.jsx.
 *
 * design:
 *   ink / accent / accentInk / accentCta / wash / surfaceDark / canvas — palette
 *   heroVariant — 'split' (copy + product mock) | 'stage' (centered + mock below)
 *   texture     — 'grid' | 'dots' | 'lines' | 'none' (hero background motif)
 */

export const V2_LANDING = {
  'coworking-spaces': {
    slug: 'coworking-spaces',
    label: 'Coworking Spaces',
    madeFor: "India's Coworking Spaces",

    // ── Design — professional indigo, grid texture, split hero ───────────────
    design: {
      ink: '#1E1B3A',
      accent: '#4F46E5',
      accentInk: '#3730A3',
      accentCta: '#4338CA',
      wash: '#EEF0FF',
      surfaceDark: '#17153A',
      canvas: '#FBFBFF',
      heroVariant: 'split',
      texture: 'grid',
    },

    // ── SEO (commercial intent for Google) ───────────────────────────────────
    seo: {
      title: 'Coworking Space Booking Software in India | Meeticulous',
      description:
        'Let members book desks and meeting rooms online. Meeticulous is coworking space booking software for India — hot-desk and meeting-room booking, paid upfront via UPI, GST invoices, Google Calendar sync and automatic reminders. From ₹10/day.',
      keywords:
        'coworking space booking software, meeting room booking system india, hot desk booking app, desk booking software, coworking management software, book a coworking space online, conference room scheduling',
      ogTitle: 'Still booking your coworking space over WhatsApp? Fix it for ₹10/day.',
      ogDescription:
        'Members book a desk or meeting room, pay online, and get reminded — automatically. The booking page every coworking space in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-coworking-spaces-og-1200x630.jpg',
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Coworking Spaces & Managed Offices',
      headline: 'Coworking space booking software',
      headlineAccent: 'that fills every desk.',
      headlineTail: '',
      subline:
        'One link takes every booking. Members pick a hot desk, cabin or meeting room, pay online, and the slot locks instantly — so your front desk stops juggling calls and your space stops sitting empty.',
      ctaText: 'Set up my space',
      microcopy: 'Free to start · No card needed · Live in minutes',
      audiences: ['Hot desks', 'Private cabins', 'Meeting rooms', 'Event space', 'Day passes'],
      mock: {
        brand: 'Eureka Coworking',
        tag: 'Baner, Pune · open now',
        services: [
          { name: 'Hot Desk — Day Pass', meta: 'Per day · open floor', price: '₹399' },
          { name: 'Meeting Room (6)', meta: 'Per hour · screen + whiteboard', price: '₹600' },
          { name: 'Private Cabin', meta: 'Per day · lockable', price: '₹1,200' },
        ],
      },
    },

    // ── Animated stat counters ────────────────────────────────────────────────
    stats: [
      { to: 24, suffix: '/7', label: 'Desks booked, even after the front desk clocks off' },
      { to: 0, suffix: '%', label: 'Commission on Pro — every booking is yours' },
      { to: 5, prefix: '< ', suffix: ' min', label: 'To put your space online' },
      { to: 10, prefix: '~₹', suffix: '/day', label: 'For the top, unlimited plan' },
    ],

    // ── Why it works — numbered principles ────────────────────────────────────
    why: {
      eyebrow: 'Why it works',
      title: 'A booking page should fill the space,',
      titleAccent: 'not just show it.',
      lead: 'Members want to reserve a desk in ten seconds, not wait for a reply. Meeticulous turns your availability into a page that books and bills itself.',
      items: [
        { title: 'Self-serve booking', desc: 'Members pick a desk, cabin or room and a time from your live availability — no calls, no WhatsApp back-and-forth.' },
        { title: 'Paid upfront', desc: 'The fee is collected at booking via UPI, card or netbanking, with a GST invoice. No chasing payments at month-end.' },
        { title: 'Never double-booked', desc: 'Every seat and room locks the moment it is taken. One live calendar across your whole floor.' },
      ],
    },

    // ── The booking flow — numbered steps ─────────────────────────────────────
    flow: {
      eyebrow: 'How it works',
      title: 'A booking in three steps.',
      steps: [
        { title: 'Share your link', desc: 'Put one link on your website, Google profile and WhatsApp. No app for members to install.' },
        { title: 'They book & pay', desc: 'A member picks a desk or meeting room, pays the fee online, and the slot locks instantly.' },
        { title: 'You just host', desc: 'It lands on your Google Calendar, reminders go out automatically, and the money is already in.' },
      ],
    },

    // ── What you get — honest feature grid ────────────────────────────────────
    whatYouGet: {
      eyebrow: 'What you get',
      title: 'Everything the space needs.',
      lead: 'One page runs desks, rooms and day passes — not just a calendar.',
      items: [
        { title: 'Online payments', desc: 'Collect the full fee upfront by UPI, card or netbanking.' },
        { title: 'Meeting-room booking', desc: 'Price rooms by the hour; members book the exact slot they need.' },
        { title: 'Hot desks & day passes', desc: 'Sell single-day access without a membership or a sign-up call.' },
        { title: 'WhatsApp + email reminders', desc: 'Automatic reminders before every booking cut no-shows.' },
        { title: 'Google Calendar sync', desc: 'Busy times blocked, bookings added — never double-booked.' },
        { title: 'GST invoices', desc: 'A proper GST invoice is generated for every payment automatically.' },
        { title: 'Reviews & ratings', desc: 'Collect member reviews that win the next booking.' },
        { title: 'Get discovered', desc: 'List your space on the Meeticulous Explore marketplace.' },
      ],
      addons: ['Recurring desk plans', 'Member accounts', 'Team bookings', 'Custom booking rules'],
    },

    // ── Before / After — the core pitch, as a comparison ──────────────────────
    beforeAfter: {
      eyebrow: 'Before / after',
      title: 'From WhatsApp mess to one clean link.',
      lead: 'Same space, two ways to run it. One of them fills the desks on its own.',
      before: [
        'Bookings scattered across calls, DMs and a paper register',
        'Payments chased at month-end, some never collected',
        'Double-booked meeting rooms and awkward clashes',
        'Front desk tied up confirming slots all day',
      ],
      after: [
        'One link takes every desk and room booking',
        'Fee paid upfront, GST invoice generated automatically',
        'Each seat and room locks the instant it is booked',
        'Front desk freed to actually host members',
      ],
    },

    // ── Why Meeticulous — numbered conviction ─────────────────────────────────
    whyUs: {
      eyebrow: 'Why Meeticulous',
      title: 'Built for how Indian spaces run.',
      items: [
        { title: '0% commission on Pro', desc: 'Keep every rupee of every booking. No cut on your revenue.' },
        { title: 'Your members are yours', desc: 'Member and booking data stays private to your space — encrypted, never sold.' },
        { title: 'UPI, GST & WhatsApp', desc: 'Payments, invoices and reminders built for India, not bolted on.' },
        { title: 'Live in minutes', desc: 'Set up your booking page the same afternoon. No developer, no lock-in.' },
      ],
    },

    // ── Testimonials ──────────────────────────────────────────────────────────
    testimonials: [
      { quote: 'Members book a desk or a room themselves and pay on the spot. Our front desk finally has time to actually run the space.', name: 'Aditya Kulkarni', role: 'Founder, coworking space' },
      { quote: 'Meeting-room clashes used to be a daily headache. Now every room locks the second it is booked — no more double bookings.', name: 'Sneha Rao', role: 'Community Manager' },
      { quote: 'Day passes sell overnight without anyone picking up the phone. The page pays for itself in a couple of bookings.', name: 'Imran Qureshi', role: 'Operations Lead' },
    ],

    // ── FAQ (drives FAQPage schema) ───────────────────────────────────────────
    faq: [
      { q: 'What is the best coworking space booking software in India?', a: 'Meeticulous lets your members book hot desks, private cabins and meeting rooms online, pay the fee upfront via UPI or card, and get automatic WhatsApp and email reminders. It syncs with Google Calendar, generates GST invoices and charges 0% commission on paid plans.' },
      { q: 'Can members book meeting rooms by the hour?', a: 'Yes. Add each meeting room as an hourly service; members pick the exact slot they need and pay for it upfront. The room locks instantly so it can never be double-booked.' },
      { q: 'Can I sell day passes and hot desks without a membership?', a: 'Yes. Offer a day pass or hot-desk service that anyone can book and pay for online — no membership, no sign-up call needed.' },
      { q: 'Do members need an app or account to book?', a: 'No. Members open your link, pick a desk or room, and pay. It works straight from your website, Google profile or WhatsApp.' },
      { q: 'How much does it cost?', a: 'You can start free with a small per-booking fee. Paid plans begin at roughly ₹10 a day and remove all commission, so you keep 100% of every booking.' },
    ],

    // ── Final CTA ─────────────────────────────────────────────────────────────
    finalCta: {
      headline: 'Put your space online today.',
      subline: 'Set up your coworking booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Set up my space',
    },
  },
};

export const getV2Landing = (slug) =>
  (slug && V2_LANDING[slug.toLowerCase()]) || null;

export default V2_LANDING;
