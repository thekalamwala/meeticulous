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
  'driving-schools': {
    slug: 'driving-schools',
    label: 'Driving Schools',
    madeFor: "India's Driving Schools",

    // ── Design — warm amber, line texture, mirror hero ───────────────────────
    design: {
      ink: '#2A1A0F',
      accent: '#D97706',
      accentInk: '#B45309',
      accentCta: '#B45309',
      wash: '#FEF3E2',
      surfaceDark: '#2B1A08',
      canvas: '#FFFCF7',
      heroVariant: 'mirror',
      texture: 'lines',
    },

    // ── SEO (commercial intent for Google) ───────────────────────────────────
    seo: {
      title: 'Driving School Booking Software in India | Meeticulous',
      description:
        'Let learners book car and two-wheeler lessons online. Meeticulous is driving school booking software for India — lesson slots paid upfront via UPI, GST invoices, Google Calendar sync and automatic WhatsApp reminders. From ₹10/day.',
      keywords:
        'driving school booking software, driving school management software india, online driving lesson booking, driving school app, book driving lessons online, driving instructor scheduling software, motor training school software',
      ogTitle: 'Still booking driving lessons over phone calls? Fix it for ₹10/day.',
      ogDescription:
        'Learners pick a lesson slot, pay online, and get reminded — automatically. The booking page every driving school in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-driving-schools-og-1200x630.jpg',
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Driving Schools & Motor Training Centres',
      headline: 'Driving school booking software',
      headlineAccent: 'that keeps every car on the road.',
      headlineTail: '',
      subline:
        'One link takes every lesson booking. Learners pick a car or two-wheeler slot, pay online, and the time locks instantly — so your phone stops ringing all day and no instructor hour goes to waste.',
      ctaText: 'Set up my school',
      microcopy: 'Free to start · No card needed · Live in minutes',
      audiences: ['Car lessons', 'Two-wheeler lessons', 'Refresher drives', 'Highway practice', 'Licence test prep'],
      mock: {
        brand: 'Sai Motor Driving School',
        tag: 'Kothrud, Pune · slots open',
        services: [
          { name: 'Car Lesson — 1 hr', meta: 'Per session · dual-control car', price: '₹600' },
          { name: 'Two-Wheeler Lesson', meta: 'Per session · scooter or bike', price: '₹400' },
          { name: 'Refresher Drive', meta: 'Per session · for licence holders', price: '₹800' },
        ],
      },
    },

    // ── Animated stat counters ────────────────────────────────────────────────
    stats: [
      { to: 24, suffix: '/7', label: 'Lesson slots bookable, even after the office shuts' },
      { to: 0, suffix: '%', label: 'Commission on Pro — every lesson fee is yours' },
      { to: 5, prefix: '< ', suffix: ' min', label: 'To put your school online' },
      { to: 10, prefix: '~₹', suffix: '/day', label: 'For the top, unlimited plan' },
    ],

    // ── Why it works — numbered principles ────────────────────────────────────
    why: {
      eyebrow: 'Why it works',
      title: 'A lesson slot is stock that expires,',
      titleAccent: 'so sell it before it does.',
      lead: 'An empty instructor hour cannot be sold tomorrow. Meeticulous turns your timetable into a page learners can book and pay on at any time, so more of your hours get sold.',
      items: [
        { title: 'Learners book themselves', desc: 'Learners choose a car or two-wheeler lesson and a slot from your live availability — no calls, no WhatsApp back-and-forth with the office.' },
        { title: 'Fee paid before the lesson', desc: 'The lesson fee is collected at booking via UPI, card or netbanking, with a GST invoice. No cash to chase after the drive.' },
        { title: 'No clashing slots', desc: 'Every lesson slot locks the moment it is taken, so one car or instructor is never promised to two learners.' },
      ],
    },

    // ── The booking flow — numbered steps ─────────────────────────────────────
    flow: {
      eyebrow: 'How it works',
      title: 'A booking in three steps.',
      steps: [
        { title: 'Share your link', desc: 'Put one link on your website, Google profile, Instagram bio and WhatsApp. Learners need no app.' },
        { title: 'They book & pay', desc: 'A learner picks a lesson and a slot, pays the fee online, and the time locks instantly.' },
        { title: 'You just teach', desc: 'It lands on your Google Calendar, reminders go out automatically, and the money is already in.' },
      ],
    },

    // ── What you get — honest feature grid ────────────────────────────────────
    whatYouGet: {
      eyebrow: 'What you get',
      title: 'Everything a driving school needs.',
      lead: 'One page sells lessons, refreshers and practice drives — not just a calendar.',
      items: [
        { title: 'Online payments', desc: 'Collect the lesson fee upfront by UPI, card or netbanking.' },
        { title: 'Lesson-wise pricing', desc: 'List car, two-wheeler and refresher lessons separately, each with its own duration and price.' },
        { title: 'Live slot availability', desc: 'Learners see only the slots you have opened. Set your hours once and the page does the rest.' },
        { title: 'WhatsApp + email reminders', desc: 'Automatic reminders before every lesson cut no-shows and idle instructor hours.' },
        { title: 'Google Calendar sync', desc: 'Busy times blocked, bookings added — never double-booked.' },
        { title: 'GST invoices', desc: 'A proper GST invoice is generated for every payment automatically.' },
        { title: 'Reviews & ratings', desc: 'Collect learner reviews that win the next enrolment.' },
        { title: 'Get discovered', desc: 'List your school on the Meeticulous Explore marketplace.' },
      ],
      addons: ['Multiple instructors', 'Learner accounts', 'Recurring lesson slots', 'Custom booking rules'],
    },

    // ── Before / After — the core pitch, as a comparison ──────────────────────
    beforeAfter: {
      eyebrow: 'Before / after',
      title: 'From phone calls to one clean link.',
      lead: 'Same school, two ways to run it. One of them keeps every car busy.',
      before: [
        'Lessons booked over calls, WhatsApp and a paper diary',
        'Fees collected in cash on the day, or promised and forgotten',
        'Learners who skip a slot, leaving the car and instructor idle',
        'Office staff on the phone all day confirming timings',
      ],
      after: [
        'One link takes every lesson booking',
        'Fee paid upfront, GST invoice generated automatically',
        'Automatic reminders go out before each lesson',
        'Staff freed to run the school, not the phone',
      ],
    },

    // ── Why Meeticulous — numbered conviction ─────────────────────────────────
    whyUs: {
      eyebrow: 'Why Meeticulous',
      title: 'Built for how Indian driving schools run.',
      items: [
        { title: '0% commission on Pro', desc: 'Keep every rupee of every lesson fee. No cut on your revenue.' },
        { title: 'Your learners are yours', desc: 'Learner and booking data stays private to your school — encrypted, never sold.' },
        { title: 'UPI, GST & WhatsApp', desc: 'Payments, invoices and reminders built for India, not bolted on.' },
        { title: 'Live in minutes', desc: 'Set up your booking page the same afternoon. No developer, no lock-in.' },
      ],
    },

    // ── Testimonials ──────────────────────────────────────────────────────────
    testimonials: [
      { quote: 'Learners book a lesson and pay on their phone. The office is no longer on calls from morning till evening, and our mornings fill up faster.', name: 'Rajesh Patil', role: 'Owner, motor driving school' },
      { quote: 'Earlier a learner would skip a slot and the car just stood there. With the fee paid upfront and a reminder going out, that happens far less now.', name: 'Farhan Sheikh', role: 'Head Instructor' },
      { quote: 'Two-wheeler and car lessons each have their own price and timings on one page. Parents book for their kids at night and we wake up to confirmed slots.', name: 'Divya Nair', role: 'Admin Manager' },
    ],

    // ── FAQ (drives FAQPage schema) ───────────────────────────────────────────
    faq: [
      { q: 'What is the best driving school booking software in India?', a: 'Meeticulous lets learners book car and two-wheeler lessons online, pay the fee upfront via UPI or card, and get automatic WhatsApp and email reminders. It syncs with Google Calendar, generates GST invoices and charges 0% commission on paid plans.' },
      { q: 'Can I list different lesson types with different prices?', a: 'Yes. Add each lesson — car, two-wheeler, refresher, highway practice — as its own service with its own duration and price. Learners pick the one they want and a free slot.' },
      { q: 'Will it stop learners from skipping a booked lesson?', a: 'No tool can stop every no-show, but paying upfront and getting automatic WhatsApp and email reminders makes a missed lesson far less likely. The fee is already collected, so there is nothing to chase.' },
      { q: 'Do learners need an app or account to book?', a: 'No. Learners open your link, pick a lesson and a slot, and pay. It works straight from your website, Google profile, Instagram or WhatsApp.' },
      { q: 'How much does it cost?', a: 'You can start free with a small per-booking fee. The top paid plan is about ₹10 a day and removes all commission, so you keep 100% of every lesson fee.' },
    ],

    // ── Final CTA ─────────────────────────────────────────────────────────────
    finalCta: {
      headline: 'Put your driving school online today.',
      subline: 'Set up your lesson booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Set up my school',
    },
  },

  'conference-halls': {
    slug: 'conference-halls',
    label: 'Conference Halls',
    madeFor: "India's Conference Halls & Venues",

    // ── Design — corporate blue, dot texture, stage hero ─────────────────────
    design: {
      ink: '#121C2E',
      accent: '#2563EB',
      accentInk: '#1E40AF',
      accentCta: '#1D4ED8',
      wash: '#EAF1FE',
      surfaceDark: '#0F1B33',
      canvas: '#FBFCFF',
      heroVariant: 'stage',
      texture: 'dots',
    },

    // ── SEO (commercial intent for Google) ───────────────────────────────────
    seo: {
      title: 'Conference Hall Booking Software in India | Meeticulous',
      description:
        'Let organisers check live availability and book your hall online. Meeticulous is conference hall booking software for India — hourly, half-day and full-day slots paid upfront via UPI, GST invoices and Google Calendar sync. From ₹10/day.',
      keywords:
        'conference hall booking software, seminar hall booking system india, venue booking software, meeting hall booking online, banquet hall booking software, boardroom booking system, book a conference hall online',
      ogTitle: 'Still answering "is the hall free?" all day? Fix it for ₹10/day.',
      ogDescription:
        'Organisers see live availability, book your hall, pay online, and the date locks — automatically. The booking page every conference venue in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-conference-halls-og-1200x630.jpg',
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Conference Halls, Seminar Rooms & Venues',
      headline: 'Conference hall booking software',
      headlineAccent: 'that turns enquiries into confirmed dates.',
      headlineTail: '',
      subline:
        'One link replaces the endless enquiry thread. Organisers check live availability, pick a hall and a slot, pay online, and the date locks — so your sales desk stops answering "is it free on the 14th?" all week.',
      ctaText: 'List my hall',
      microcopy: 'Free to start · No card needed · Live in minutes',
      audiences: ['Conference halls', 'Seminar rooms', 'Training rooms', 'Boardrooms', 'Event venues'],
      mock: {
        brand: 'Lotus Convention Centre',
        tag: 'Andheri East, Mumbai · available today',
        services: [
          { name: 'Boardroom (12 seats)', meta: 'Per hour · projector + screen', price: '₹1,500' },
          { name: 'Seminar Hall (60 seats)', meta: 'Half day · AV + podium', price: '₹12,000' },
          { name: 'Conference Hall (150 seats)', meta: 'Full day · stage + sound', price: '₹35,000' },
        ],
      },
    },

    // ── Animated stat counters ────────────────────────────────────────────────
    stats: [
      { to: 24, suffix: '/7', label: 'Dates held, even when the sales desk is closed' },
      { to: 0, suffix: '%', label: 'Commission on Pro — every booking is yours' },
      { to: 5, prefix: '< ', suffix: ' min', label: 'To put your venue online' },
      { to: 10, prefix: '~₹', suffix: '/day', label: 'For the top, unlimited plan' },
    ],

    // ── Why it works — numbered principles ────────────────────────────────────
    why: {
      eyebrow: 'Why it works',
      title: 'An enquiry should end in a booking,',
      titleAccent: 'not a long thread.',
      lead: 'Organisers compare a few venues in an afternoon and book the one that answers first. Meeticulous gives them live availability and a way to pay on the spot.',
      items: [
        { title: 'Live availability', desc: 'Organisers see which halls and slots are free right now — no "let me check and get back to you".' },
        { title: 'Paid upfront', desc: 'The booking fee is collected online via UPI, card or netbanking, with a GST invoice. A date is held with money behind it, not a verbal yes.' },
        { title: 'No double-booked dates', desc: 'Every hall locks the moment a slot is taken. One live calendar across every room you run.' },
      ],
    },

    // ── The booking flow — numbered steps ─────────────────────────────────────
    flow: {
      eyebrow: 'How it works',
      title: 'A booking in three steps.',
      steps: [
        { title: 'Share your link', desc: 'Put one link on your website, Google profile, venue listings and WhatsApp. Organisers need no app.' },
        { title: 'They book & pay', desc: 'An organiser picks a hall and a slot, pays the fee online, and the date locks instantly.' },
        { title: 'You just host', desc: 'It lands on your Google Calendar, reminders go out automatically, and the money is already in.' },
      ],
    },

    // ── What you get — honest feature grid ────────────────────────────────────
    whatYouGet: {
      eyebrow: 'What you get',
      title: 'Everything the venue needs.',
      lead: 'One page sells boardrooms, seminar halls and full-day events — not just a calendar.',
      items: [
        { title: 'Online payments', desc: 'Collect the booking fee upfront by UPI, card or netbanking.' },
        { title: 'Hourly, half-day & full-day', desc: 'Price each hall by the slot length that suits it, from a one-hour boardroom to a full-day conference.' },
        { title: 'Many halls, one calendar', desc: 'List every hall and room as its own service. Each locks separately when booked.' },
        { title: 'WhatsApp + email reminders', desc: 'Automatic reminders go out before the event so timings and setup stay on track.' },
        { title: 'Google Calendar sync', desc: 'Busy times blocked, bookings added — never double-booked.' },
        { title: 'GST invoices', desc: 'A proper GST invoice for every payment — what corporate accounts teams ask for.' },
        { title: 'Reviews & ratings', desc: 'Collect organiser reviews that win the next booking.' },
        { title: 'Get discovered', desc: 'List your venue on the Meeticulous Explore marketplace.' },
      ],
      addons: ['Recurring bookings', 'Corporate accounts', 'Multiple venues', 'Custom booking rules'],
    },

    // ── Before / After — the core pitch, as a comparison ──────────────────────
    beforeAfter: {
      eyebrow: 'Before / after',
      title: 'From enquiry threads to one clean link.',
      lead: 'Same venue, two ways to run it. One of them confirms dates while you sleep.',
      before: [
        'Availability checked over calls, emails and a shared sheet',
        'Dates held on a verbal yes, then lost to a faster venue',
        'Clashing bookings discovered a day before the event',
        'Sales desk answering the same "is it free?" question all week',
      ],
      after: [
        'Live availability on one link, 24/7',
        'Fee paid upfront, GST invoice generated automatically',
        'Each hall locks the instant a slot is booked',
        'Sales desk freed to handle the big enquiries',
      ],
    },

    // ── Why Meeticulous — numbered conviction ─────────────────────────────────
    whyUs: {
      eyebrow: 'Why Meeticulous',
      title: 'Built for how Indian venues run.',
      items: [
        { title: '0% commission on Pro', desc: 'Keep every rupee of every hall booking. No cut on your revenue.' },
        { title: 'Your clients are yours', desc: 'Organiser and booking data stays private to your venue — encrypted, never sold.' },
        { title: 'UPI, GST & WhatsApp', desc: 'Payments, invoices and reminders built for India, not bolted on.' },
        { title: 'Live in minutes', desc: 'Set up your booking page the same afternoon. No developer, no lock-in.' },
      ],
    },

    // ── Testimonials ──────────────────────────────────────────────────────────
    testimonials: [
      { quote: 'Training companies check the calendar, pick a half-day slot and pay right there. We used to lose those bookings while we were replying to emails.', name: 'Nikhil Deshmukh', role: 'Manager, conference venue' },
      { quote: 'Having every hall on one live calendar ended the clashes. The GST invoice going out on its own also saves our accounts team a lot of back-and-forth.', name: 'Kavita Menon', role: 'Events Coordinator' },
      { quote: 'Fee paid upfront means a date is actually booked, not just promised. That alone changed how seriously organisers treat our calendar.', name: 'Harpreet Singh', role: 'Owner, seminar and banquet hall' },
    ],

    // ── FAQ (drives FAQPage schema) ───────────────────────────────────────────
    faq: [
      { q: 'What is the best conference hall booking software in India?', a: 'Meeticulous lets organisers check live availability and book your conference hall, seminar room or boardroom online, pay the fee upfront via UPI or card, and get automatic reminders. It syncs with Google Calendar, generates GST invoices and charges 0% commission on paid plans.' },
      { q: 'Can I price halls by the hour, half day or full day?', a: 'Yes. Add each hall as a service with the duration and price that suits it — an hourly boardroom, a half-day seminar hall, a full-day conference hall. Organisers book the exact slot and pay upfront.' },
      { q: 'Can I manage several halls on one booking page?', a: 'Yes. Add every hall or room as its own service with its own price. Each one locks separately when booked, and Google Calendar sync keeps your busy times blocked.' },
      { q: 'Do organisers need an app or account to book?', a: 'No. Organisers open your link, pick a hall and a slot, and pay. It works straight from your website, venue listing, Google profile or WhatsApp.' },
      { q: 'How much does it cost?', a: 'You can start free with a small per-booking fee. The top paid plan is about ₹10 a day and removes all commission, so you keep 100% of every booking.' },
    ],

    // ── Final CTA ─────────────────────────────────────────────────────────────
    finalCta: {
      headline: 'Put your hall online today.',
      subline: 'Set up your venue booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'List my hall',
    },
  },

  'photo-studios': {
    slug: 'photo-studios',
    label: 'Photo Studios',
    madeFor: "India's Photo Studios & Photographers",

    // ── Design — creative magenta, dot texture, mirror hero ──────────────────
    design: {
      ink: '#241026',
      accent: '#C026D3',
      accentInk: '#9A1FA8',
      accentCta: '#9A1FA8',
      wash: '#FBEAFB',
      surfaceDark: '#1E0B22',
      canvas: '#FFFBFF',
      heroVariant: 'mirror',
      texture: 'dots',
    },

    // ── SEO (commercial intent for Google) ───────────────────────────────────
    seo: {
      title: 'Photo Studio Booking Software in India | Meeticulous',
      description:
        'Let clients book portrait sessions, product shoots and studio hire online. Meeticulous is photo studio booking software for India — slots paid upfront via UPI, GST invoices, Google Calendar sync and automatic WhatsApp reminders. From ₹10/day.',
      keywords:
        'photo studio booking software, photography studio booking system india, studio rental booking, photographer booking app, book a photoshoot online, photo studio scheduling software, studio hire booking',
      ogTitle: 'Still booking shoots over Instagram DMs? Fix it for ₹10/day.',
      ogDescription:
        'Clients pick a slot, pay online, and the date locks — automatically. The booking link every photo studio in India should already have in its bio.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-photo-studios-og-1200x630.jpg',
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Photo Studios & Photographers',
      headline: 'Photo studio booking software',
      headlineAccent: 'that keeps your calendar shooting.',
      headlineTail: '',
      subline:
        'One link for every session. Clients pick a portrait slot, a product shoot or an hourly studio hire, pay online, and the date locks — so you spend your day behind the lens, not in the DMs.',
      ctaText: 'Book me out',
      microcopy: 'Free to start · No card needed · Live in minutes',
      audiences: ['Portrait sessions', 'Product shoots', 'Studio hire', 'Family & maternity', 'Brand & fashion'],
      mock: {
        brand: 'Lumen Studio',
        tag: 'Indiranagar, Bengaluru · slots open',
        services: [
          { name: 'Portrait Session', meta: 'Per session · 1 hr · edited photos', price: '₹2,500' },
          { name: 'Studio Hire', meta: 'Per hour · lights + backdrops', price: '₹900' },
          { name: 'Product Shoot', meta: 'Half day · up to 20 products', price: '₹6,500' },
        ],
      },
    },

    // ── Animated stat counters ────────────────────────────────────────────────
    stats: [
      { to: 24, suffix: '/7', label: 'Shoots booked, even while you are mid-session' },
      { to: 0, suffix: '%', label: 'Commission on Pro — every booking is yours' },
      { to: 5, prefix: '< ', suffix: ' min', label: 'To put your studio online' },
      { to: 10, prefix: '~₹', suffix: '/day', label: 'For the top, unlimited plan' },
    ],

    // ── Why it works — numbered principles ────────────────────────────────────
    why: {
      eyebrow: 'Why it works',
      title: 'Clients decide on the spot,',
      titleAccent: 'so let them book on the spot.',
      lead: 'Someone loves your portfolio at 11pm and wants a date. Meeticulous turns that moment into a paid booking instead of a DM you answer tomorrow.',
      items: [
        { title: 'Self-serve booking', desc: 'Clients pick a session type and a slot from your live availability — no endless "which dates are free?" messages.' },
        { title: 'Paid upfront', desc: 'The booking fee is collected online via UPI, card or netbanking, with a GST invoice. A booked date is a paid date, not a maybe.' },
        { title: 'No clashing shoots', desc: 'Every slot locks the moment it is taken, so the studio is never promised to two clients.' },
      ],
    },

    // ── The booking flow — numbered steps ─────────────────────────────────────
    flow: {
      eyebrow: 'How it works',
      title: 'A booking in three steps.',
      steps: [
        { title: 'Share your link', desc: 'Put one link in your Instagram bio, website, Google profile and WhatsApp. Clients need no app.' },
        { title: 'They book & pay', desc: 'A client picks a session and a slot, pays the fee online, and the date locks instantly.' },
        { title: 'You just shoot', desc: 'It lands on your Google Calendar, reminders go out automatically, and the money is already in.' },
      ],
    },

    // ── What you get — honest feature grid ────────────────────────────────────
    whatYouGet: {
      eyebrow: 'What you get',
      title: 'Everything the studio needs.',
      lead: 'One page sells sessions, shoots and studio hire — not just a calendar.',
      items: [
        { title: 'Online payments', desc: 'Collect the booking fee upfront by UPI, card or netbanking.' },
        { title: 'Session-wise pricing', desc: 'List portraits, product shoots, family sessions and studio hire separately, each with its own duration and price.' },
        { title: 'Studio hire by the hour', desc: 'Photographers and creators book your space and gear by the hour and pay upfront.' },
        { title: 'WhatsApp + email reminders', desc: 'Automatic reminders before every shoot mean clients arrive on time and ready.' },
        { title: 'Google Calendar sync', desc: 'Busy times blocked, bookings added — never double-booked.' },
        { title: 'GST invoices', desc: 'A proper GST invoice is generated for every payment automatically.' },
        { title: 'Reviews & ratings', desc: 'Collect client reviews that win the next shoot.' },
        { title: 'Get discovered', desc: 'List your studio on the Meeticulous Explore marketplace.' },
      ],
      addons: ['Recurring bookings', 'Client accounts', 'Multiple studios', 'Custom booking rules'],
    },

    // ── Before / After — the core pitch, as a comparison ──────────────────────
    beforeAfter: {
      eyebrow: 'Before / after',
      title: 'From DM chaos to one clean link.',
      lead: 'Same studio, two ways to run it. One of them keeps you shooting.',
      before: [
        'Dates negotiated across Instagram DMs, calls and WhatsApp',
        'Advances promised, then a client ghosts on shoot day',
        'Double-booked studio slots and awkward apologies',
        'Hours lost replying to the same availability question',
      ],
      after: [
        'One link in your bio takes every booking',
        'Fee paid upfront, GST invoice generated automatically',
        'Each slot locks the instant it is booked',
        'More hours behind the lens, fewer in the inbox',
      ],
    },

    // ── Why Meeticulous — numbered conviction ─────────────────────────────────
    whyUs: {
      eyebrow: 'Why Meeticulous',
      title: 'Built for how Indian studios work.',
      items: [
        { title: '0% commission on Pro', desc: 'Keep every rupee of every shoot. No cut on your revenue.' },
        { title: 'Your clients are yours', desc: 'Client and booking data stays private to your studio — encrypted, never sold.' },
        { title: 'UPI, GST & WhatsApp', desc: 'Payments, invoices and reminders built for India, not bolted on.' },
        { title: 'Live in minutes', desc: 'Set up your booking page the same afternoon. No developer, no lock-in.' },
      ],
    },

    // ── Testimonials ──────────────────────────────────────────────────────────
    testimonials: [
      { quote: 'I put the link in my Instagram bio and portrait sessions started getting booked and paid overnight. No more scrolling DMs to find who asked for which date.', name: 'Ananya Bhatt', role: 'Photographer, portrait studio' },
      { quote: 'Studio hire by the hour used to be a mess of calls. Now creators pick a slot, pay, and it is on my calendar. Clashes are gone.', name: 'Rohit Malhotra', role: 'Studio Owner' },
      { quote: 'Brands book a product shoot and the GST invoice goes out automatically. It makes a small studio like mine look properly organised.', name: 'Meera Iyer', role: 'Product photographer' },
    ],

    // ── FAQ (drives FAQPage schema) ───────────────────────────────────────────
    faq: [
      { q: 'What is the best photo studio booking software in India?', a: 'Meeticulous lets clients book portrait sessions, product shoots and studio hire online, pay the fee upfront via UPI or card, and get automatic WhatsApp and email reminders. It syncs with Google Calendar, generates GST invoices and charges 0% commission on paid plans.' },
      { q: 'Can I rent my studio by the hour and sell shoots too?', a: 'Yes. Add studio hire as an hourly service and each shoot type — portraits, products, family sessions — as its own service with its own duration and price. Everything shares one live calendar.' },
      { q: 'Can I take bookings from my Instagram bio?', a: 'Yes. Meeticulous gives you one booking link you can put in your Instagram bio, website, Google profile or WhatsApp. Clients tap it, choose a slot and pay — no app or sign-up call needed.' },
      { q: 'Will it block my calendar when I am already booked?', a: 'Yes. With Google Calendar sync your busy times are blocked automatically and every new booking is added, so a client can never book a slot you are already on.' },
      { q: 'How much does it cost?', a: 'You can start free with a small per-booking fee. The top paid plan is about ₹10 a day and removes all commission, so you keep 100% of every shoot fee.' },
    ],

    // ── Final CTA ─────────────────────────────────────────────────────────────
    finalCta: {
      headline: 'Put your studio online today.',
      subline: 'Set up your shoot booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Book me out',
    },
  },

  'coaches': {
    slug: 'coaches',
    label: 'Coaches & Mentors',
    madeFor: "India's Coaches & Mentors",

    // ── Design — calm green, grid texture, stage hero ────────────────────────
    design: {
      ink: '#0F241C',
      accent: '#10B981',
      accentInk: '#047857',
      accentCta: '#047857',
      wash: '#E7F7F0',
      surfaceDark: '#072019',
      canvas: '#FAFEFC',
      heroVariant: 'stage',
      texture: 'grid',
    },

    // ── SEO (commercial intent for Google) ───────────────────────────────────
    seo: {
      title: 'Booking Software for Coaches in India | Meeticulous',
      description:
        'Let clients book coaching sessions online. Meeticulous is booking software for coaches and mentors in India — session slots paid upfront via UPI, GST invoices, Google Calendar sync and automatic WhatsApp reminders. From ₹10/day.',
      keywords:
        'booking software for coaches, coaching appointment booking software, coach scheduling software india, online session booking for coaches, mentor booking app, life coach booking system, career coach scheduling tool',
      ogTitle: 'Still scheduling coaching sessions over WhatsApp? Fix it for ₹10/day.',
      ogDescription:
        'Clients pick a time, pay before the session, and get reminded — automatically. The booking page every coach in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-coaches-og-1200x630.jpg',
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Coaches, Mentors & Consultants',
      headline: 'Booking software for coaches',
      headlineAccent: 'that fills your calendar, not your inbox.',
      headlineTail: '',
      subline:
        'One link for every session. Clients pick a time that works, pay online, and the slot lands on your calendar — so you spend your energy coaching, not scheduling and chasing fees.',
      ctaText: 'Fill my calendar',
      microcopy: 'Free to start · No card needed · Live in minutes',
      audiences: ['Career coaches', 'Life coaches', 'Business mentors', 'Wellness coaches', 'Interview prep'],
      mock: {
        brand: 'Riya Menon Coaching',
        tag: 'Career & leadership coach · booking open',
        services: [
          { name: 'Intro Session', meta: '30 min · get to know your goals', price: '₹500' },
          { name: 'Career Strategy Session', meta: '60 min · one-to-one', price: '₹2,500' },
          { name: 'Mock Interview', meta: '45 min · with written feedback', price: '₹1,500' },
        ],
      },
    },

    // ── Animated stat counters ────────────────────────────────────────────────
    stats: [
      { to: 24, suffix: '/7', label: 'Sessions booked, even while you are with a client' },
      { to: 0, suffix: '%', label: 'Commission on Pro — every session fee is yours' },
      { to: 5, prefix: '< ', suffix: ' min', label: 'To put your practice online' },
      { to: 10, prefix: '~₹', suffix: '/day', label: 'For the top, unlimited plan' },
    ],

    // ── Why it works — numbered principles ────────────────────────────────────
    why: {
      eyebrow: 'Why it works',
      title: 'Your time is the product,',
      titleAccent: 'so stop spending it on scheduling.',
      lead: 'Every "does Thursday work?" message is time you are not coaching. Meeticulous lets clients choose from your real availability and pay before the session.',
      items: [
        { title: 'Clients book themselves', desc: 'Clients pick a session and a time from your live availability — no back-and-forth to find a slot that works.' },
        { title: 'Paid before the session', desc: 'The fee is collected at booking via UPI, card or netbanking, with a GST invoice. No awkward payment reminders afterwards.' },
        { title: 'No overlaps', desc: 'Sync Google Calendar and your busy times are blocked automatically, so nobody books over your other commitments.' },
      ],
    },

    // ── The booking flow — numbered steps ─────────────────────────────────────
    flow: {
      eyebrow: 'How it works',
      title: 'A booking in three steps.',
      steps: [
        { title: 'Share your link', desc: 'Put one link in your email signature, LinkedIn, Instagram bio and WhatsApp. Clients need no app.' },
        { title: 'They book & pay', desc: 'A client picks a session and a time, pays the fee online, and the slot locks instantly.' },
        { title: 'You just coach', desc: 'It lands on your Google Calendar, reminders go out automatically, and the money is already in.' },
      ],
    },

    // ── What you get — honest feature grid ────────────────────────────────────
    whatYouGet: {
      eyebrow: 'What you get',
      title: 'Everything a coaching practice needs.',
      lead: 'One page sells intro calls, full sessions and mock interviews — not just a calendar.',
      items: [
        { title: 'Online payments', desc: 'Collect the session fee upfront by UPI, card or netbanking.' },
        { title: 'Session types & pricing', desc: 'List intro calls, one-to-one sessions and mock interviews separately, each with its own duration and price.' },
        { title: 'Your hours, your rules', desc: 'Set the days and hours you coach. Clients only see the slots you have opened.' },
        { title: 'WhatsApp + email reminders', desc: 'Automatic reminders before every session cut no-shows.' },
        { title: 'Google Calendar sync', desc: 'Busy times blocked, bookings added — never double-booked.' },
        { title: 'GST invoices', desc: 'A proper GST invoice for every payment, ready for corporate clients.' },
        { title: 'Reviews & ratings', desc: 'Collect client reviews that win the next enquiry.' },
        { title: 'Get discovered', desc: 'List your practice on the Meeticulous Explore marketplace.' },
      ],
      addons: ['Recurring sessions', 'Client accounts', 'Group sessions', 'Custom booking rules'],
    },

    // ── Before / After — the core pitch, as a comparison ──────────────────────
    beforeAfter: {
      eyebrow: 'Before / after',
      title: 'From scheduling back-and-forth to one clean link.',
      lead: 'Same practice, two ways to run it. One of them gives you your evenings back.',
      before: [
        'Sessions scheduled over a dozen WhatsApp and email messages',
        'Fees chased by hand after the session, or quietly waived',
        'Clients who forget, leaving you waiting on the call',
        'Evenings spent managing the calendar instead of resting',
      ],
      after: [
        'One link takes every session booking',
        'Fee paid upfront, GST invoice generated automatically',
        'Automatic reminders go out before every session',
        'Your time spent on coaching, not coordination',
      ],
    },

    // ── Why Meeticulous — numbered conviction ─────────────────────────────────
    whyUs: {
      eyebrow: 'Why Meeticulous',
      title: 'Built for how Indian coaches work.',
      items: [
        { title: '0% commission on Pro', desc: 'Keep every rupee of every session. No cut on your income.' },
        { title: 'Your clients are yours', desc: 'Client and session data stays private to your practice — encrypted, never sold.' },
        { title: 'UPI, GST & WhatsApp', desc: 'Payments, invoices and reminders built for India, not bolted on.' },
        { title: 'Live in minutes', desc: 'Set up your booking page the same afternoon. No developer, no lock-in.' },
      ],
    },

    // ── Testimonials ──────────────────────────────────────────────────────────
    testimonials: [
      { quote: 'I used to lose half an hour a day finding slots and sending payment details. Now clients just book from my LinkedIn link and the session is on my calendar.', name: 'Tanvi Kapoor', role: 'Career coach' },
      { quote: 'Getting paid before the session changed the relationship. Clients show up committed, and I never have to send an uncomfortable reminder.', name: 'Arjun Nambiar', role: 'Business mentor' },
      { quote: 'The WhatsApp reminders alone were worth it. My no-shows dropped, and the GST invoice goes out on its own for my corporate clients.', name: 'Sunita Reddy', role: 'Wellness and life coach' },
    ],

    // ── FAQ (drives FAQPage schema) ───────────────────────────────────────────
    faq: [
      { q: 'What is the best booking software for coaches in India?', a: 'Meeticulous lets clients book coaching and mentoring sessions online, pay the fee upfront via UPI or card, and get automatic WhatsApp and email reminders. It syncs with Google Calendar, generates GST invoices and charges 0% commission on paid plans.' },
      { q: 'Can I offer an intro call and longer paid sessions?', a: 'Yes. Add each offering — an intro session, a one-to-one session, a mock interview — as its own service with its own duration and price. Clients pick the one they want and a free time.' },
      { q: 'Can clients book from LinkedIn or Instagram?', a: 'Yes. You get one booking link to put in your LinkedIn profile, Instagram bio, email signature or WhatsApp. Clients tap it, choose a time and pay — no app or sign-up call needed.' },
      { q: 'Will it stop clients from booking over my other commitments?', a: 'Yes. With Google Calendar sync your busy times are blocked automatically and every new booking is added, so clients only see the times you are really free.' },
      { q: 'How much does it cost?', a: 'You can start free with a small per-booking fee. The top paid plan is about ₹10 a day and removes all commission, so you keep 100% of every session fee.' },
    ],

    // ── Final CTA ─────────────────────────────────────────────────────────────
    finalCta: {
      headline: 'Put your coaching practice online today.',
      subline: 'Set up your session booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Fill my calendar',
    },
  },
  'content-creators': {
    slug: 'content-creators',
    label: 'Content Creators',
    madeFor: "India's Content Creators",

    // ── Design — creator magenta, lines texture, split hero ──────────────────
    design: {
      ink: '#241020',
      accent: '#DB2777',
      accentInk: '#BE185D',
      accentCta: '#BE185D',
      wash: '#FCE9F1',
      surfaceDark: '#1F0A17',
      canvas: '#FFFBFD',
      heroVariant: 'split',
      texture: 'lines',
    },

    // ── SEO (commercial intent for Google) ───────────────────────────────────
    seo: {
      title: 'Booking Software for Content Creators in India | Meeticulous',
      description:
        'Turn followers into paid calls. Meeticulous is booking software for content creators in India — strategy calls, content audits and mentoring sessions, paid upfront via UPI, with GST invoices, Google Calendar sync and automatic reminders. From ₹10/day.',
      keywords:
        'booking software for content creators, paid calls for creators, creator booking page india, monetise instagram followers, 1:1 call booking app, link in bio booking, sell consultation calls online, youtuber appointment booking',
      ogTitle: 'Still negotiating your rate in the DMs? Get paid before the call.',
      ogDescription:
        'One link in your bio: followers and brands pick a slot, pay upfront and book a call with you. The creator booking page that runs itself, from ₹10/day.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-content-creators-og-1200x630.jpg',
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Creators, Coaches & Influencers',
      headline: 'Booking software for content creators',
      headlineAccent: 'that turns DMs into paid calls.',
      headlineTail: '',
      subline:
        'Stop haggling over rates in your inbox. One link lets followers, brands and fellow creators pick a slot, pay upfront and book — strategy calls, content audits, paid Q&As and mentoring, all on autopilot.',
      ctaText: 'Set up my page',
      microcopy: 'Free to start · No card needed · Live in minutes',
      audiences: ['YouTubers', 'Instagram creators', 'Podcasters', 'Newsletter writers', 'Creator coaches'],
      mock: {
        brand: 'Riya Sethi Studio',
        tag: 'Creator coach · Mumbai · online calls',
        services: [
          { name: 'Content Audit Call', meta: '30 min · 1:1 feedback on your channel', price: '₹1,500' },
          { name: 'Brand Strategy Session', meta: '45 min · pricing + pitch help', price: '₹2,500' },
          { name: 'Paid Q&A Call', meta: '20 min · ask me anything', price: '₹800' },
        ],
      },
    },

    // ── Animated stat counters ────────────────────────────────────────────────
    stats: [
      { to: 24, suffix: '/7', label: 'Paid calls booked while you are editing, travelling or asleep' },
      { to: 0, suffix: '%', label: 'Commission on Pro — every rupee of a call is yours' },
      { to: 5, prefix: '< ', suffix: ' min', label: 'To turn your bio link into a bookable page' },
      { to: 10, prefix: '~₹', suffix: '/day', label: 'For the top, unlimited plan' },
    ],

    // ── Why it works — numbered principles ────────────────────────────────────
    why: {
      eyebrow: 'Why it works',
      title: 'Your audience wants a clear next step,',
      titleAccent: 'not a long DM thread.',
      lead: 'Followers who want your time should be able to book it in ten seconds. Meeticulous turns your availability into a page that books, bills and reminds on its own.',
      items: [
        { title: 'One link for your bio', desc: 'Pin it in your Instagram bio, YouTube description or link-in-bio page. People pick a call type and a time — no back-and-forth.' },
        { title: 'Paid before the call', desc: 'The fee is collected at booking via UPI, card or netbanking, with a GST invoice. No "I will pay after" and no chasing.' },
        { title: 'Your shoot days stay safe', desc: 'Google Calendar sync blocks the times you are busy, so nobody books a call over a shoot or a deadline.' },
      ],
    },

    // ── The booking flow — numbered steps ─────────────────────────────────────
    flow: {
      eyebrow: 'How it works',
      title: 'A booking in three steps.',
      steps: [
        { title: 'Share your link', desc: 'Drop one link in your bio, video descriptions and WhatsApp. Nothing for your followers to install.' },
        { title: 'They book & pay', desc: 'A follower or brand picks a call type and slot, pays online, and the time locks instantly.' },
        { title: 'You just show up', desc: 'It lands on your Google Calendar, reminders go out automatically, and the fee is already paid.' },
      ],
    },

    // ── What you get — honest feature grid ────────────────────────────────────
    whatYouGet: {
      eyebrow: 'What you get',
      title: 'Everything a creator business needs.',
      lead: 'One page for every paid way of working with you — not just a calendar.',
      items: [
        { title: 'Online payments', desc: 'Collect the full fee upfront by UPI, card or netbanking.' },
        { title: 'Paid 1:1 calls', desc: 'Price strategy calls, audits and mentoring by the session, each with its own duration.' },
        { title: 'Brand discovery slots', desc: 'Give sponsors a bookable slot instead of a long rate-card thread.' },
        { title: 'WhatsApp + email reminders', desc: 'Automatic reminders before every call cut no-shows.' },
        { title: 'Google Calendar sync', desc: 'Busy times blocked, bookings added — never double-booked.' },
        { title: 'GST invoices', desc: 'A proper GST invoice is generated for every payment automatically.' },
        { title: 'Reviews & ratings', desc: 'Collect reviews from people you have worked with to win the next booking.' },
        { title: 'Get discovered', desc: 'List yourself on the Meeticulous Explore marketplace.' },
      ],
      addons: ['Session packs', 'Recurring mentoring', 'Fan accounts', 'Custom booking rules'],
    },

    // ── Before / After — the core pitch, as a comparison ──────────────────────
    beforeAfter: {
      eyebrow: 'Before / after',
      title: 'From DM chaos to one clean link.',
      lead: 'Same audience, two ways to monetise it. One of them books itself.',
      before: [
        'Rates and slots negotiated across DMs, email and WhatsApp',
        'Calls promised "after the payment" that never quite arrives',
        'Calls clashing with shoot days and edit deadlines',
        'Hours lost answering the same pricing questions',
      ],
      after: [
        'One link takes every call booking',
        'Fee paid upfront, GST invoice generated automatically',
        'Google Calendar blocks your shoot days for you',
        'Your time goes back into making content',
      ],
    },

    // ── Why Meeticulous — numbered conviction ─────────────────────────────────
    whyUs: {
      eyebrow: 'Why Meeticulous',
      title: 'Built for how Indian creators earn.',
      items: [
        { title: '0% commission on Pro', desc: 'Keep every rupee of every paid call. No cut taken from your income.' },
        { title: 'Your audience is yours', desc: 'Client and booking data stays private to you — encrypted, never sold.' },
        { title: 'UPI, GST & WhatsApp', desc: 'Payments, invoices and reminders built for India, not bolted on.' },
        { title: 'Live in minutes', desc: 'Set up your booking page before your next upload. No developer, no lock-in.' },
      ],
    },

    // ── Testimonials ──────────────────────────────────────────────────────────
    testimonials: [
      { quote: 'I used to lose half a day to DMs about rates and timings. Now I put one link in my bio and the calls just appear on my calendar, already paid.', name: 'Ishaan Malhotra', role: 'Finance YouTuber' },
      { quote: 'Brands and followers both book through the same page. I stopped double-booking calls over shoot days, which was honestly my biggest headache.', name: 'Tanvi Deshpande', role: 'Instagram creator & coach' },
      { quote: 'Paid listener Q&As sell out without me posting more than once. The reminders mean people actually show up.', name: 'Rahul Menon', role: 'Podcaster' },
    ],

    // ── FAQ (drives FAQPage schema) ───────────────────────────────────────────
    faq: [
      { q: 'What is the best booking software for content creators in India?', a: 'Meeticulous lets you publish one booking page where followers, brands and clients pick a call type and a time, then pay upfront via UPI, card or netbanking. It sends automatic WhatsApp and email reminders, syncs with Google Calendar, generates GST invoices and charges 0% commission on paid plans.' },
      { q: 'Can I charge for 1:1 calls with my followers?', a: 'Yes. Add each call type — a content audit, a strategy session, a paid Q&A — as its own service with its own price and duration. People pay when they book, so you are paid before the call starts.' },
      { q: 'Can brands book a discovery call with me?', a: 'Yes. Add a brand or collaboration call as a service and share the link in your media kit or bio. Sponsors choose a slot from your live availability instead of going back and forth over email.' },
      { q: 'Where do I put my booking link?', a: 'Anywhere you already share links — your Instagram bio, YouTube video descriptions, link-in-bio page, newsletter or WhatsApp. People open the link, pick a slot and pay; there is no app for them to install.' },
      { q: 'How much does it cost?', a: 'You can start free with a small per-booking fee. The top paid plan is about ₹10 a day, and paid plans take 0% commission, so you keep 100% of every call you sell.' },
    ],

    // ── Final CTA ─────────────────────────────────────────────────────────────
    finalCta: {
      headline: 'Turn your followers into booked calls.',
      subline: 'Set up your creator booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Set up my page',
    },
  },

  'educators': {
    slug: 'educators',
    label: 'Educators',
    madeFor: "India's Tutors & Educators",

    // ── Design — classroom teal-blue, grid texture, mirrored hero ────────────
    design: {
      ink: '#0E2630',
      accent: '#0891B2',
      accentInk: '#0E7490',
      accentCta: '#0E7490',
      wash: '#E4F4F8',
      surfaceDark: '#08202A',
      canvas: '#FAFEFF',
      heroVariant: 'mirror',
      texture: 'grid',
    },

    // ── SEO (commercial intent for Google) ───────────────────────────────────
    seo: {
      title: 'Booking Software for Educators & Tutors in India | Meeticulous',
      description:
        'Let students and parents book classes online. Meeticulous is booking software for educators in India — trial classes, doubt-clearing sessions and coaching slots, paid upfront via UPI, with GST invoices, Google Calendar sync and automatic reminders. From ₹10/day.',
      keywords:
        'booking software for educators, tutor booking software india, class scheduling app, online tutoring booking system, coaching class booking, tuition fee collection online, doubt clearing session booking, tutor appointment app',
      ogTitle: 'Still chasing tuition fees on WhatsApp? Let parents pay before the class.',
      ogDescription:
        'Parents and students pick a slot, pay online and get reminded — automatically. The class booking page every Indian tutor should already have, from ₹10/day.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-educators-og-1200x630.jpg',
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Tutors, Coaches & Trainers',
      headline: 'Booking software for educators',
      headlineAccent: 'that fills your timetable.',
      headlineTail: '',
      subline:
        'Parents and students pick a class slot, pay the fee upfront and get reminded automatically — so your evenings go to teaching, not to chasing fees and confirming timings.',
      ctaText: 'Fill my timetable',
      microcopy: 'Free to start · No card needed · Live in minutes',
      audiences: ['School tutors', 'Test-prep coaches', 'Skill trainers', 'Workshop hosts', 'Doubt sessions'],
      mock: {
        brand: 'Iyer Maths Classes',
        tag: 'Class 9–12 · Bengaluru · online + home',
        services: [
          { name: 'Trial Class — Maths', meta: '30 min · meet the teacher', price: '₹250' },
          { name: 'Doubt-Clearing Session', meta: '45 min · 1:1', price: '₹500' },
          { name: 'Board Exam Prep', meta: '60 min · focused revision', price: '₹900' },
        ],
      },
    },

    // ── Animated stat counters ────────────────────────────────────────────────
    stats: [
      { to: 24, suffix: '/7', label: 'Class slots booked, even while you are mid-lesson' },
      { to: 0, suffix: '%', label: 'Commission on Pro — every fee is yours' },
      { to: 5, prefix: '< ', suffix: ' min', label: 'To put your classes online' },
      { to: 10, prefix: '~₹', suffix: '/day', label: 'For the top, unlimited plan' },
    ],

    // ── Why it works — numbered principles ────────────────────────────────────
    why: {
      eyebrow: 'Why it works',
      title: 'A timetable should fill itself,',
      titleAccent: 'and bill itself.',
      lead: 'Parents want to reserve a slot in seconds, not wait for a reply between classes. Meeticulous turns your free hours into a page that books and collects the fee on its own.',
      items: [
        { title: 'Parents book in seconds', desc: 'Students and parents choose a class type and a time from your live availability — no calls, no WhatsApp ping-pong.' },
        { title: 'Fee in before the class', desc: 'The fee is collected at booking via UPI, card or netbanking, with a GST invoice. No month-end chasing.' },
        { title: 'No clashing slots', desc: 'Each slot locks the moment it is taken, and Google Calendar sync keeps your day free of surprises.' },
      ],
    },

    // ── The booking flow — numbered steps ─────────────────────────────────────
    flow: {
      eyebrow: 'How it works',
      title: 'A booking in three steps.',
      steps: [
        { title: 'Share your link', desc: 'Put one link on your website, Google profile and WhatsApp status. Nothing for parents to install.' },
        { title: 'They book & pay', desc: 'A parent or student picks a class and a time, pays online, and the slot locks instantly.' },
        { title: 'You just teach', desc: 'It lands on your Google Calendar, reminders go out automatically, and the fee is already in.' },
      ],
    },

    // ── What you get — honest feature grid ────────────────────────────────────
    whatYouGet: {
      eyebrow: 'What you get',
      title: 'Everything a teaching practice needs.',
      lead: 'One page runs trial classes, 1:1 sessions and workshops — not just a calendar.',
      items: [
        { title: 'Online payments', desc: 'Collect the full fee upfront by UPI, card or netbanking.' },
        { title: 'Slot-based classes', desc: 'Offer 1:1 classes and doubt sessions, each with its own duration and price.' },
        { title: 'Trial & demo classes', desc: 'Let new students book a low-priced trial class without a phone call.' },
        { title: 'WhatsApp + email reminders', desc: 'Automatic reminders before every class cut no-shows.' },
        { title: 'Google Calendar sync', desc: 'Busy times blocked, bookings added — never double-booked.' },
        { title: 'GST invoices', desc: 'A proper GST invoice is generated for every payment automatically.' },
        { title: 'Reviews & ratings', desc: 'Collect parent and student reviews that bring in the next enquiry.' },
        { title: 'Get discovered', desc: 'List your classes on the Meeticulous Explore marketplace.' },
      ],
      addons: ['Recurring weekly classes', 'Student accounts', 'Batch bookings', 'Custom booking rules'],
    },

    // ── Before / After — the core pitch, as a comparison ──────────────────────
    beforeAfter: {
      eyebrow: 'Before / after',
      title: 'From WhatsApp chaos to one clean link.',
      lead: 'Same classes, two ways to run them. One of them fills the timetable on its own.',
      before: [
        'Timings agreed over WhatsApp and forgotten by Friday',
        'Fees chased at the start of every month, some never paid',
        'Students skipping classes without a word',
        'Evenings lost to scheduling instead of teaching',
      ],
      after: [
        'One link shows your open slots to every parent',
        'Fee paid upfront, GST invoice generated automatically',
        'Reminders go out on WhatsApp and email before each class',
        'Your evenings back for lesson prep',
      ],
    },

    // ── Why Meeticulous — numbered conviction ─────────────────────────────────
    whyUs: {
      eyebrow: 'Why Meeticulous',
      title: 'Built for how Indian educators teach.',
      items: [
        { title: '0% commission on Pro', desc: 'Keep every rupee of every class fee. No cut on your teaching income.' },
        { title: 'Your students are yours', desc: 'Student and booking data stays private to you — encrypted, never sold.' },
        { title: 'UPI, GST & WhatsApp', desc: 'Payments, invoices and reminders built for India, not bolted on.' },
        { title: 'Live in minutes', desc: 'Set up your class page the same evening. No developer, no lock-in.' },
      ],
    },

    // ── Testimonials ──────────────────────────────────────────────────────────
    testimonials: [
      { quote: 'Parents book a slot and pay on the spot. I no longer spend the first week of every month reminding people about fees.', name: 'Deepa Narayanan', role: 'Maths tutor' },
      { quote: 'The WhatsApp reminders alone cut my last-minute cancellations. I can plan my evenings around classes that will actually happen.', name: 'Arjun Bhatt', role: 'Physics coach' },
      { quote: 'Trial classes used to need three messages each to schedule. Now new students book one themselves and I just get a calendar entry.', name: 'Farah Siddiqui', role: 'Spoken English trainer' },
    ],

    // ── FAQ (drives FAQPage schema) ───────────────────────────────────────────
    faq: [
      { q: 'What is the best booking software for educators in India?', a: 'Meeticulous lets students and parents book trial classes, 1:1 sessions and coaching slots online, pay the fee upfront via UPI or card, and get automatic WhatsApp and email reminders. It syncs with Google Calendar, generates GST invoices and charges 0% commission on paid plans.' },
      { q: 'Can parents pay for a class before it starts?', a: 'Yes. The fee is collected when the slot is booked, via UPI, card or netbanking, and a GST invoice is generated automatically. You are paid before the class, not after a reminder.' },
      { q: 'Can I offer a trial class for new students?', a: 'Yes. Add a trial or demo class as its own service with a shorter duration and a lower price. New students book it themselves, with no phone call needed.' },
      { q: 'Does it work for online and in-person classes?', a: 'Yes. Add each class type as a service. You teach it online or in person as you prefer — the booking page handles the slot, the payment and the reminders either way.' },
      { q: 'How much does it cost?', a: 'You can start free with a small per-booking fee. The top paid plan is about ₹10 a day, and paid plans take 0% commission, so you keep 100% of every class fee.' },
    ],

    // ── Final CTA ─────────────────────────────────────────────────────────────
    finalCta: {
      headline: 'Put your classes online today.',
      subline: 'Set up your class booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Fill my timetable',
    },
  },

  'musicians': {
    slug: 'musicians',
    label: 'Musicians',
    madeFor: "India's Musicians & Music Teachers",

    // ── Design — stage violet, lines texture, stage hero ─────────────────────
    design: {
      ink: '#1C1433',
      accent: '#7C3AED',
      accentInk: '#6D28D9',
      accentCta: '#6D28D9',
      wash: '#EFE9FC',
      surfaceDark: '#16102A',
      canvas: '#FDFBFF',
      heroVariant: 'stage',
      texture: 'lines',
    },

    // ── SEO (commercial intent for Google) ───────────────────────────────────
    seo: {
      title: 'Booking Software for Musicians in India | Meeticulous',
      description:
        'Take music lesson and gig bookings online. Meeticulous is booking software for musicians in India — lessons, studio hours and gig advances paid upfront via UPI, with GST invoices, Google Calendar sync and automatic reminders. From ₹10/day.',
      keywords:
        'booking software for musicians, music lesson booking app india, music teacher scheduling software, gig booking software, band booking page, studio hour booking, guitar class booking, vocal coaching booking',
      ogTitle: 'Your calendar should keep time. Take lesson and gig bookings for ₹10/day.',
      ogDescription:
        'Students and organisers pick a slot, pay upfront and get reminded — automatically. The booking page every Indian musician should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-musicians-og-1200x630.jpg',
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Music Teachers, Performers & Producers',
      headline: 'Booking software for musicians',
      headlineAccent: 'that keeps your calendar in tune.',
      headlineTail: '',
      subline:
        'Lessons, rehearsals, studio hours and gig enquiries, all on one link. Students and organisers pick a slot, pay upfront, and you get back to the music instead of the back-and-forth.',
      ctaText: 'Get booked',
      microcopy: 'Free to start · No card needed · Live in minutes',
      audiences: ['Music teachers', 'Vocal coaches', 'Session players', 'Wedding bands', 'Producers'],
      mock: {
        brand: 'Karan Mehta Music',
        tag: 'Guitar & vocals · Delhi NCR · lessons + gigs',
        services: [
          { name: 'Guitar Lesson — 1:1', meta: '45 min · beginner to advanced', price: '₹800' },
          { name: 'Vocal Coaching', meta: '60 min · online or in studio', price: '₹1,000' },
          { name: 'Acoustic Gig — Booking Advance', meta: 'Weddings · cafes · private events', price: '₹5,000' },
        ],
      },
    },

    // ── Animated stat counters ────────────────────────────────────────────────
    stats: [
      { to: 24, suffix: '/7', label: 'Lessons and gigs booked, even mid-soundcheck' },
      { to: 0, suffix: '%', label: 'Commission on Pro — every fee and advance is yours' },
      { to: 5, prefix: '< ', suffix: ' min', label: 'To put your music online' },
      { to: 10, prefix: '~₹', suffix: '/day', label: 'For the top, unlimited plan' },
    ],

    // ── Why it works — numbered principles ────────────────────────────────────
    why: {
      eyebrow: 'Why it works',
      title: 'Your calendar should keep time,',
      titleAccent: 'so you can keep the beat.',
      lead: 'Students want a lesson slot in ten seconds and organisers want a date locked. Meeticulous turns your availability into a page that books, bills and reminds on its own.',
      items: [
        { title: 'Lessons, studio and gigs on one link', desc: 'Offer lesson slots, rehearsal hours and gig bookings together — each with its own price and duration.' },
        { title: 'Paid before the downbeat', desc: 'Students pay for the lesson and organisers pay a booking amount upfront, by UPI, card or netbanking, with a GST invoice.' },
        { title: 'No clashing gigs', desc: 'Google Calendar sync blocks busy times, so a lesson never lands on top of a soundcheck.' },
      ],
    },

    // ── The booking flow — numbered steps ─────────────────────────────────────
    flow: {
      eyebrow: 'How it works',
      title: 'A booking in three steps.',
      steps: [
        { title: 'Share your link', desc: 'Put one link on your Instagram, website and WhatsApp. Nothing for students or organisers to install.' },
        { title: 'They book & pay', desc: 'A student picks a lesson, or an organiser a gig date, pays online, and the slot locks instantly.' },
        { title: 'You just play', desc: 'It lands on your Google Calendar, reminders go out automatically, and the money is already in.' },
      ],
    },

    // ── What you get — honest feature grid ────────────────────────────────────
    whatYouGet: {
      eyebrow: 'What you get',
      title: 'Everything a working musician needs.',
      lead: 'One page runs lessons, studio hours and gigs — not just a calendar.',
      items: [
        { title: 'Online payments', desc: 'Collect the full fee upfront by UPI, card or netbanking.' },
        { title: 'Lessons by the hour', desc: 'Set a price and duration for each lesson type; students book the exact slot.' },
        { title: 'Studio & rehearsal slots', desc: 'Price jam-room or studio time by the hour and let people book it themselves.' },
        { title: 'Gig booking advance', desc: 'Collect an upfront amount from organisers to lock your date.' },
        { title: 'WhatsApp + email reminders', desc: 'Automatic reminders before every booking cut no-shows.' },
        { title: 'Google Calendar sync', desc: 'Busy times blocked, bookings added — never double-booked.' },
        { title: 'GST invoices', desc: 'A proper GST invoice is generated for every payment automatically.' },
        { title: 'Reviews & discovery', desc: 'Collect student reviews and get listed on the Meeticulous Explore marketplace.' },
      ],
      addons: ['Recurring weekly lessons', 'Student accounts', 'Lesson packs', 'Custom booking rules'],
    },

    // ── Before / After — the core pitch, as a comparison ──────────────────────
    beforeAfter: {
      eyebrow: 'Before / after',
      title: 'From scattered DMs to one clean link.',
      lead: 'Same music, two ways to run the business. One of them books itself.',
      before: [
        'Lesson timings sorted over WhatsApp and forgotten by the weekend',
        'Gig dates held on a verbal "confirmed" that never turns into money',
        'Studio hours clashing with a gig or a class',
        'Students ghosting after you reserved their slot',
      ],
      after: [
        'One link shows your lesson, studio and gig slots',
        'Fee or booking advance paid upfront, GST invoice automatic',
        'Google Calendar blocks every gig and rehearsal for you',
        'Reminders cut no-shows and protect your practice time',
      ],
    },

    // ── Why Meeticulous — numbered conviction ─────────────────────────────────
    whyUs: {
      eyebrow: 'Why Meeticulous',
      title: 'Built for how Indian musicians work.',
      items: [
        { title: '0% commission on Pro', desc: 'Keep every rupee of every lesson and gig advance. No cut taken from your earnings.' },
        { title: 'Your students are yours', desc: 'Student, organiser and booking data stays private to you — encrypted, never sold.' },
        { title: 'UPI, GST & WhatsApp', desc: 'Payments, invoices and reminders built for India, not bolted on.' },
        { title: 'Live in minutes', desc: 'Set up your booking page before your next rehearsal. No developer, no lock-in.' },
      ],
    },

    // ── Testimonials ──────────────────────────────────────────────────────────
    testimonials: [
      { quote: 'My students book and pay for their own slots now. I stopped spending my Sundays sorting out next week timings on WhatsApp.', name: 'Sahil Bhandari', role: 'Guitar teacher' },
      { quote: 'The reminders have noticeably cut missed classes. Parents get the message, the child shows up, and I do not lose the hour.', name: 'Nandini Rao', role: 'Hindustani vocal teacher' },
      { quote: 'Taking an advance through the booking page makes organisers serious. A date is only blocked once the amount is paid.', name: 'Joel Fernandes', role: 'Session drummer' },
    ],

    // ── FAQ (drives FAQPage schema) ───────────────────────────────────────────
    faq: [
      { q: 'What is the best booking software for musicians in India?', a: 'Meeticulous lets students book music lessons and organisers book gigs online, paying the fee or booking advance upfront via UPI or card. It sends automatic WhatsApp and email reminders, syncs with Google Calendar, generates GST invoices and charges 0% commission on paid plans.' },
      { q: 'Can I take lesson bookings and gig advances on the same page?', a: 'Yes. Add each as its own service — a 45-minute guitar lesson, a vocal coaching hour, a gig booking advance — each with its own price and duration. One link covers all of them.' },
      { q: 'Can I rent out my studio or rehearsal room by the hour?', a: 'Yes. Add studio or jam-room time as an hourly service; people pick the exact slot and pay upfront. The slot locks instantly so it can never be double-booked.' },
      { q: 'Do students need an app to book?', a: 'No. Students and organisers open your link, pick a slot and pay. It works straight from your Instagram bio, website or WhatsApp.' },
      { q: 'How much does it cost?', a: 'You can start free with a small per-booking fee. The top paid plan is about ₹10 a day, and paid plans take 0% commission, so you keep 100% of every lesson and advance.' },
    ],

    // ── Final CTA ─────────────────────────────────────────────────────────────
    finalCta: {
      headline: 'Get booked, on beat.',
      subline: 'Set up your music booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Get booked',
    },
  },

  'language-teachers': {
    slug: 'language-teachers',
    label: 'Language Teachers',
    madeFor: "India's Language Teachers",

    // ── Design — fresh teal, dots texture, split hero ─────────────────────────
    design: {
      ink: '#0C2622',
      accent: '#0D9488',
      accentInk: '#0F766E',
      accentCta: '#0F766E',
      wash: '#E3F5F2',
      surfaceDark: '#07211D',
      canvas: '#FAFFFE',
      heroVariant: 'split',
      texture: 'dots',
    },

    // ── SEO (commercial intent for Google) ───────────────────────────────────
    seo: {
      title: 'Booking Software for Language Teachers in India | Meeticulous',
      description:
        'Let learners book lessons online. Meeticulous is booking software for language teachers in India — trial lessons, 1:1 classes and exam-prep sessions, paid upfront via UPI, with GST invoices, Google Calendar sync and automatic reminders. From ₹10/day.',
      keywords:
        'booking software for language teachers, language tutor booking app india, online language class scheduling, french tutor booking, spoken english class booking, german tutor scheduling, trial lesson booking, language teacher payment collection',
      ogTitle: 'Teaching a language, not chasing payments. Fix your lesson bookings for ₹10/day.',
      ogDescription:
        'Learners pick a time, pay for the lesson upfront and show up. The booking page every language tutor in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-language-teachers-og-1200x630.jpg',
    },

    // ── Hero ──────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Language Tutors & Coaches',
      headline: 'Booking software for language teachers',
      headlineAccent: 'that fills every lesson slot.',
      headlineTail: '',
      subline:
        'Learners pick a time, pay for the lesson upfront and show up — no more rescheduling over WhatsApp or waiting on a transfer. Teach French, German, Japanese or English on a calendar that runs itself.',
      ctaText: 'Book my classes',
      microcopy: 'Free to start · No card needed · Live in minutes',
      audiences: ['French', 'German', 'Japanese', 'Spoken English', 'Exam prep'],
      mock: {
        brand: 'Lingua Lab by Ananya',
        tag: 'French & German · online · evenings + weekends',
        services: [
          { name: 'Trial Lesson', meta: '30 min · online · meet your tutor', price: '₹299' },
          { name: 'Conversation Practice', meta: '60 min · 1:1 speaking', price: '₹900' },
          { name: 'Exam Prep — DELF / Goethe', meta: '60 min · mock speaking + feedback', price: '₹1,200' },
        ],
      },
    },

    // ── Animated stat counters ────────────────────────────────────────────────
    stats: [
      { to: 24, suffix: '/7', label: 'Lessons booked, even while you are mid-class' },
      { to: 0, suffix: '%', label: 'Commission on Pro — every lesson fee is yours' },
      { to: 5, prefix: '< ', suffix: ' min', label: 'To put your lessons online' },
      { to: 10, prefix: '~₹', suffix: '/day', label: 'For the top, unlimited plan' },
    ],

    // ── Why it works — numbered principles ────────────────────────────────────
    why: {
      eyebrow: 'Why it works',
      title: 'Learners should book a lesson in a tap,',
      titleAccent: 'not a long chat.',
      lead: 'A motivated learner who has to wait for a reply often drifts away. Meeticulous turns your free hours into a page that books and collects payment on its own.',
      items: [
        { title: 'Self-serve scheduling', desc: 'Learners choose a lesson type and a time from your live availability — no endless message threads about timings.' },
        { title: 'Paid before the lesson', desc: 'The fee is collected at booking via UPI, card or netbanking, with a GST invoice. No "I will transfer tonight".' },
        { title: 'A calendar that respects your day', desc: 'Google Calendar sync blocks busy times and adds every booking, so lessons never overlap.' },
      ],
    },

    // ── The booking flow — numbered steps ─────────────────────────────────────
    flow: {
      eyebrow: 'How it works',
      title: 'A booking in three steps.',
      steps: [
        { title: 'Share your link', desc: 'Put one link on your Instagram, website and WhatsApp profile. Learners book from their phone.' },
        { title: 'They book & pay', desc: 'A learner picks a lesson type and a time, pays online, and the slot locks instantly.' },
        { title: 'You just teach', desc: 'It lands on your Google Calendar, reminders go out automatically, and the fee is already in.' },
      ],
    },

    // ── What you get — honest feature grid ────────────────────────────────────
    whatYouGet: {
      eyebrow: 'What you get',
      title: 'Everything a language tutor needs.',
      lead: 'One page runs trial lessons, 1:1 classes and exam prep — not just a calendar.',
      items: [
        { title: 'Online payments', desc: 'Collect the full fee upfront by UPI, card or netbanking.' },
        { title: 'Online 1:1 lessons', desc: 'Set a price and duration for each lesson type and teach on the video app you already use.' },
        { title: 'Trial lessons', desc: 'Let new learners book a low-priced first lesson with no back-and-forth.' },
        { title: 'WhatsApp + email reminders', desc: 'Automatic reminders before every lesson cut no-shows.' },
        { title: 'Google Calendar sync', desc: 'Busy times blocked, bookings added — never double-booked.' },
        { title: 'GST invoices', desc: 'A proper GST invoice is generated for every payment automatically.' },
        { title: 'Reviews & ratings', desc: 'Collect learner reviews that build trust with your next student.' },
        { title: 'Get discovered', desc: 'List your lessons on the Meeticulous Explore marketplace.' },
      ],
      addons: ['Lesson packs', 'Recurring weekly slots', 'Learner accounts', 'Custom booking rules'],
    },

    // ── Before / After — the core pitch, as a comparison ──────────────────────
    beforeAfter: {
      eyebrow: 'Before / after',
      title: 'From WhatsApp admin to one clean link.',
      lead: 'Same lessons, two ways to run them. One of them fills your calendar on its own.',
      before: [
        'Lesson times renegotiated over WhatsApp every single week',
        'Fees pending until "I will transfer tonight"',
        'Learners vanishing at the last minute',
        'An hour of admin for every hour taught',
      ],
      after: [
        'One link shows every open lesson slot',
        'Lesson paid upfront, GST invoice generated automatically',
        'WhatsApp and email reminders before every class',
        'More hours for teaching, less for admin',
      ],
    },

    // ── Why Meeticulous — numbered conviction ─────────────────────────────────
    whyUs: {
      eyebrow: 'Why Meeticulous',
      title: 'Built for how Indian tutors teach.',
      items: [
        { title: '0% commission on Pro', desc: 'Keep every rupee of every lesson. No cut taken from your teaching income.' },
        { title: 'Your learners are yours', desc: 'Learner and booking data stays private to you — encrypted, never sold.' },
        { title: 'UPI, GST & WhatsApp', desc: 'Payments, invoices and reminders built for India, not bolted on.' },
        { title: 'Live in minutes', desc: 'Set up your lesson page the same evening. No developer, no lock-in.' },
      ],
    },

    // ── Testimonials ──────────────────────────────────────────────────────────
    testimonials: [
      { quote: 'Learners book a trial lesson and pay for it before they even message me. That alone saved me an hour of scheduling every day.', name: 'Priyanka Joshi', role: 'German tutor' },
      { quote: 'No more "sir, can we shift to 8?" on repeat. Learners pick a free slot, and my calendar always matches reality.', name: 'Varun Chopra', role: 'Spoken English coach' },
      { quote: 'The reminders reduced my last-minute cancellations noticeably. Payment comes in before the class, which is a relief for a solo tutor.', name: 'Mitali Banerjee', role: 'French tutor' },
    ],

    // ── FAQ (drives FAQPage schema) ───────────────────────────────────────────
    faq: [
      { q: 'What is the best booking software for language teachers in India?', a: 'Meeticulous lets learners book trial lessons, 1:1 classes and exam-prep sessions online, pay the fee upfront via UPI or card, and get automatic WhatsApp and email reminders. It syncs with Google Calendar, generates GST invoices and charges 0% commission on paid plans.' },
      { q: 'Can learners book a trial lesson?', a: 'Yes. Add a trial lesson as its own service with a shorter duration and a lower price. New learners book and pay for it online, with no messaging needed to find a time.' },
      { q: 'Does it work for online lessons?', a: 'Yes. Add each lesson type as a service with its own price and duration. You teach on whichever video app you already use — the booking page handles the slot, the payment and the reminders.' },
      { q: 'Can I teach more than one language from the same page?', a: 'Yes. Add each language or level — French beginner, German A1, spoken English — as a separate service with its own price, all under one link.' },
      { q: 'How much does it cost?', a: 'You can start free with a small per-booking fee. The top paid plan is about ₹10 a day, and paid plans take 0% commission, so you keep 100% of every lesson fee.' },
    ],

    // ── Final CTA ─────────────────────────────────────────────────────────────
    finalCta: {
      headline: 'Put your lessons online today.',
      subline: 'Set up your lesson booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Book my classes',
    },
  },
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
