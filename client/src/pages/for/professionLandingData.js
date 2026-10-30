/**
 * professionLandingData.js — per-profession content + theme for /for/:profession
 * marketing landing pages (ProfessionLanding.jsx).
 *
 * Each entry is fully data-driven: the template renders whatever is here, so a
 * new profession page is just a new entry — no new component. Each profession
 * carries its OWN palette + voice so the pages feel distinct (a lawyer page must
 * read differently from a doctor page), per product direction.
 *
 * Build order: perfect ONE profession, then add the next. Currently: lawyers.
 *
 * Theme keys drive CSS custom properties on the page root (see ProfessionLanding):
 *   primary   — dark heading / hero surface ink
 *   accent    — the profession's signature colour (CTAs, highlights)
 *   accentCta — WCAG-AA text-on-accent button bg (darker accent)
 *   tint      — soft section background wash
 *   heroFrom / heroTo — hero gradient stops (dark surface)
 *
 * SEO note: `title`/`description` stay clean + commercial (Google). `ogTitle`/
 * `ogDescription` are intentionally CLICKBAIT (₹10/day hook) — social shares only.
 * `ogImage` is a 1200×630 asset on the company CDN (founder upload; falls back).
 */

import {
  Scale, PhoneOff, IndianRupee, CalendarX2, MessageSquareX, FileClock,
  ShieldCheck, CalendarCheck, Wallet, BellRing, Landmark,
  Lock, FileCheck, BadgePercent, Clock3,
  HeartPulse, Stethoscope, CalendarClock, UserX, PhoneCall, ClipboardList, TrendingDown,
  Briefcase, Target, TrendingUp, Presentation, Handshake, LineChart,
  Scissors, Sparkles, Laptop, Zap,
  GraduationCap, BookOpen, Camera, Calendar, Building2, Users,
} from 'lucide-react';

export const PROFESSION_LANDING = {
  lawyers: {
    slug: 'lawyers',
    label: 'Lawyers & CAs',
    icon: Scale,

    // ── Theme — authority: deep slate + legal gold ──────────────────────────
    theme: {
      primary: '#1e293b',   // slate-800 — ink / headings
      accent: '#b7892f',    // muted legal gold — signature colour
      accentCta: '#8a6220', // AA-safe gold for white-text buttons
      tint: '#f8f6f1',      // warm parchment section wash
      heroFrom: '#0f172a',  // slate-900
      heroTo: '#1e293b',    // slate-800
    },

    // ── SEO (Google, commercial intent) ─────────────────────────────────────
    seo: {
      title: 'Appointment Booking Software for Lawyers | Meeticulous',
      description:
        'Let clients book paid consultations online. Meeticulous is appointment booking software for lawyers & CAs — fees collected upfront, calendar synced, no-shows gone. From ₹10/day.',
      keywords:
        'appointment booking software for lawyers, legal consultation booking, lawyer scheduling software, CA appointment software, book legal consultation online, advocate booking page India',
      // Clickbait — OG / social share only (NOT the indexed title)
      ogTitle: 'Your law practice still runs on WhatsApp? Fix it for ₹10/day.',
      ogDescription:
        "Clients book your consultation, pay the fee upfront, and get reminded — automatically. The booking page every advocate & CA should've had years ago.",
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-lawyers-og-1200x630.jpg',
    },

    // ── Hero ─────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Lawyers, Advocates & Chartered Accountants',
      headline: 'Appointment booking software',
      headlineAccent: 'for lawyers',
      headlineTail: '— consultations booked and paid before the first call.',
      subline:
        'You practise law. Meeticulous handles everything around it — clients pick a slot, pay your fee upfront, and get reminded — so you stay in court, not in your inbox.',
      ctaText: 'Set Up My Booking Page',
      microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
      // Hero product-mockup content — a themed booking page for this profession.
      mock: {
        practice: 'Adv. Meera Kulkarni',
        practiceTag: 'Advocate · High Court',
        services: [
          { name: 'Initial Legal Consultation', meta: '30 min · Online', price: '₹1,500' },
          { name: 'Contract Review & Advice', meta: '45 min · Online', price: '₹2,500' },
        ],
      },
    },

    // ── Social proof strip ───────────────────────────────────────────────────
    socialProof: 'Trusted by independent advocates, CAs and legal consultants across India.',

    // ── Trust badges (Trust & Authority pattern) ─────────────────────────────
    trust: [
      { icon: Lock, label: 'Razorpay-secured payments' },
      { icon: FileCheck, label: 'Automatic GST invoices' },
      { icon: ShieldCheck, label: 'SSL encrypted & private' },
      { icon: BadgePercent, label: '0% commission on paid plans' },
    ],

    // ── Authority stat band ──────────────────────────────────────────────────
    stats: [
      { icon: Clock3, value: '24/7', label: 'Consultations booked, even mid-hearing' },
      { icon: BadgePercent, value: '0%', label: 'Commission — you keep every fee' },
      { icon: IndianRupee, value: '~₹10', label: 'A day for the top, unlimited plan' },
      { icon: CalendarCheck, value: '< 5 min', label: 'To go live with your page' },
    ],

    // ── Problem / Agitation → Solution ───────────────────────────────────────
    // Host-facing pains, in a lawyer's own language.
    painPoints: [
      {
        icon: PhoneOff,
        problem: 'Consultation requests scattered across calls and WhatsApp',
        solution: 'One booking link. Clients pick a slot themselves — even while you are in a hearing.',
      },
      {
        icon: IndianRupee,
        problem: 'Awkward conversations about your consultation fee',
        solution: 'Your fee is shown upfront and collected before the meeting. No haggling, no invoices.',
      },
      {
        icon: CalendarX2,
        problem: 'Court dates and client meetings colliding',
        solution: 'Google Calendar busy times are blocked automatically. No double-booking, ever.',
      },
      {
        icon: FileClock,
        problem: 'No-shows eating billable hours you can never recover',
        solution: 'Automatic email + WhatsApp reminders go out before every consultation. No-shows drop.',
      },
      {
        icon: MessageSquareX,
        problem: 'Sharing a GPay QR after advice — it looks unprofessional',
        solution: 'A clean, branded page with Razorpay checkout. The first impression a legal practice deserves.',
      },
      {
        icon: Clock3,
        problem: 'Repeating your availability to every new enquiry',
        solution: 'Your live calendar shows only your open slots — clients self-serve a time, you stop re-typing them.',
      },
    ],

    // ── Features / Benefits (benefit-first) ──────────────────────────────────
    features: [
      {
        icon: CalendarCheck,
        title: 'Get booked around the clock',
        desc: 'Your consultation page is live 24/7. Clients book while you sleep, travel, or argue a matter.',
      },
      {
        icon: Wallet,
        title: 'Get paid before you advise',
        desc: 'Collect the full fee or an advance upfront via UPI, card or netbanking. GST invoice generated automatically.',
      },
      {
        icon: ShieldCheck,
        title: 'Keep client matters private',
        desc: 'Encrypted, access-controlled, never sold. Client details and notes stay yours alone.',
      },
      {
        icon: BellRing,
        title: 'End the no-show problem',
        desc: 'Reminders send themselves before every session — you never write another follow-up.',
      },
    ],

    // ── Pricing framing ──────────────────────────────────────────────────────
    pricing: {
      hook: 'Less than a cup of chai a day.',
      line: 'Start free. Go unlimited and 0% commission from about ₹10/day — it pays for itself in a single recovered no-show.',
    },

    // ── FAQ (drives FAQPage schema — AEO/GEO) ────────────────────────────────
    faq: [
      {
        q: 'What is the best appointment booking software for lawyers in India?',
        a: 'Meeticulous is built for Indian legal professionals — it lets clients book consultations online, pay your fee upfront via UPI or card, syncs with your Google Calendar around court dates, and sends automatic reminders. It handles GST invoicing and charges 0% commission on paid plans.',
      },
      {
        q: 'Can clients pay my consultation fee when they book?',
        a: 'Yes. Your fee is shown on your booking page and collected at checkout through Razorpay (UPI, cards, netbanking) before the consultation begins. You can charge the full fee or take an advance.',
      },
      {
        q: 'Will it avoid clashes with my court dates?',
        a: 'Yes. Meeticulous reads the busy times on your Google Calendar, so blocked court dates and existing appointments are never offered as available slots. Booked slots lock instantly to prevent double-booking.',
      },
      {
        q: 'Do my clients need to create an account to book?',
        a: 'No. Clients book and pay without creating any account — they simply pick a slot, enter their details, and pay. This keeps the process fast and professional.',
      },
      {
        q: 'How much does it cost?',
        a: 'You can start free with a 5% per-booking fee. Paid plans begin at roughly ₹3 a day (billed yearly) and remove all commission, so you keep 100% of every consultation fee.',
      },
      {
        q: 'Is it suitable for Chartered Accountants and legal consultants too?',
        a: 'Yes. Any professional who charges for advisory time — advocates, CAs, company secretaries, legal and tax consultants — can use Meeticulous to sell booked, paid consultations from one link.',
      },
    ],

    // ── Mid-page CTA banners (contextual, placed after key sections) ─────────
    midCtas: {
      afterProblems: {
        text: 'Stop running your practice from your phone.',
        ctaText: 'Get My Booking Link',
      },
      afterHow: {
        text: 'Your next client is ready to book. Give them somewhere to do it.',
        ctaText: 'Set Up My Page Free',
      },
    },

    // ── Final CTA ────────────────────────────────────────────────────────────
    finalCta: {
      icon: Landmark,
      urgency: 'Every missed call is a client who booked someone else.',
      headline: 'Run a practice, not an inbox.',
      subline: 'Set up your consultation booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Create My Booking Page',
    },

    // ── Section headings (profession-specific, not homepage reuse) ───────────
    headings: {
      problems: { eyebrow: 'The daily friction', title: 'Practising law is hard enough.', titleAccent: 'Client scheduling shouldn’t be.' },
      features: { eyebrow: 'What you get', title: 'Appointment booking software that works like a', titleAccent: 'clerk who never sleeps.' },
      testimonials: { title: 'Built for how legal work really runs.', subtitle: 'Advocates, CAs and consultants — booked, paid and reminded, without the admin.' },
    },

    // Footer tagline — "Made for India's <this>"
    madeFor: "India's Lawyers & CAs",

    // ── Lawyer testimonials (real) ───────────────────────────────────────────
    testimonials: [
      {
        quote: 'Clients book a consultation slot and pay the fee before we even speak. The awkward money conversation is just gone.',
        name: 'Adv. R. Menon',
        role: 'Advocate, Civil & Property',
        avatar: null,
      },
      {
        quote: 'During filing season my phone never stops. Now clients pick a slot around my deadlines instead of calling at 10pm.',
        name: 'CA Priya Nair',
        role: 'Chartered Accountant',
        avatar: null,
      },
      {
        quote: 'A clean booking link on my profile looks far more professional than sharing a UPI number after every call.',
        name: 'Adv. S. Bhatt',
        role: 'Legal Consultant',
        avatar: null,
      },
    ],
  },

  doctors: {
    slug: 'doctors',
    label: 'Doctors & Clinics',
    icon: HeartPulse,

    // ── Theme — trust blue base + healing "helping green" accent ─────────────
    theme: {
      primary: '#0f3b4d',    // deep teal-blue — ink / headings
      accent: '#10b981',     // emerald — the caring signature colour
      accentCta: '#047857',  // emerald-700, AA-safe for white-text buttons
      tint: '#eef8f3',       // soft mint wash
      heroFrom: '#0a2b39',   // dark teal
      heroTo: '#123f52',     // teal-blue
    },

    // ── SEO (Google, commercial intent) ─────────────────────────────────────
    seo: {
      title: 'Appointment Booking Software for Doctors & Clinics | Meeticulous',
      description:
        'Let patients book appointments online. Meeticulous is appointment booking software for doctors & clinics — online scheduling, automatic reminders that cut no-shows, prepaid consultations and GST invoices. From ₹10/day.',
      keywords:
        'appointment booking software for doctors, clinic appointment software, patient booking system India, doctor scheduling software, online doctor appointment booking, reduce patient no-shows, clinic management booking page',
      // Clickbait — OG / social share only (NOT the indexed title)
      ogTitle: 'Half your patients no-show? Fix your clinic booking for ₹10/day.',
      ogDescription:
        'Patients book their own slot, pay upfront, and get reminded — automatically. The online appointment page every clinic in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-doctors-og-1200x630.jpg',
    },

    // ── Hero ─────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Doctors, Clinics & Independent Practitioners',
      headline: 'Appointment booking software',
      headlineAccent: 'for doctors & clinics',
      headlineTail: '— patients book, pay, and actually show up.',
      subline:
        'You care for patients. Meeticulous handles everything around it — patients pick a slot, pay upfront, and get reminded — so it’s fewer no-shows, fewer phone calls, and more time with patients.',
      ctaText: 'Set Up My Clinic Page',
      microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
      mock: {
        practice: 'Dr. Aisha Rao',
        practiceTag: 'Physician · General Medicine',
        services: [
          { name: 'New Consultation', meta: '20 min · In-clinic', price: '₹600' },
          { name: 'Follow-up Visit', meta: '15 min · Online', price: '₹300' },
        ],
      },
    },

    // ── Social proof strip ───────────────────────────────────────────────────
    socialProof: 'Trusted by clinics, physicians and independent practitioners across India.',

    // ── Trust badges ─────────────────────────────────────────────────────────
    trust: [
      { icon: Lock, label: 'Razorpay-secured payments' },
      { icon: FileCheck, label: 'Automatic GST invoices' },
      { icon: ShieldCheck, label: 'Patient data encrypted & private' },
      { icon: BadgePercent, label: '0% commission on paid plans' },
    ],

    // ── Authority stat band ──────────────────────────────────────────────────
    stats: [
      { icon: CalendarClock, value: '24/7', label: 'Appointments booked, even after clinic hours' },
      { icon: TrendingDown, value: '1 in 5', label: 'Appointments go no-show industry-wide — reminders win them back' },
      { icon: IndianRupee, value: '~₹10', label: 'A day for the top, unlimited plan' },
      { icon: CalendarCheck, value: '< 5 min', label: 'To go live with your clinic page' },
    ],

    // ── Problem / Agitation → Solution (6, doctor's language) ────────────────
    painPoints: [
      {
        icon: PhoneCall,
        problem: 'Phone lines jammed with appointment calls all day',
        solution: 'Patients book their own slot online — your front desk stops playing switchboard.',
      },
      {
        icon: UserX,
        problem: 'No-shows leaving empty slots you can’t fill',
        solution: 'Automatic SMS + WhatsApp reminders go out before every visit. No-shows drop sharply.',
      },
      {
        icon: IndianRupee,
        problem: 'Chasing or fumbling the consultation fee at the desk',
        solution: 'Fees are collected online at booking. Patients arrive already paid, with a GST invoice.',
      },
      {
        icon: CalendarX2,
        problem: 'Double-booked slots and a messy paper diary',
        solution: 'Every slot locks the moment it’s taken. One live calendar, no clashes, no overbooking.',
      },
      {
        icon: ClipboardList,
        problem: 'Front desk juggling walk-ins, calls and follow-ups',
        solution: 'One dashboard shows the day’s appointments — booked, paid and confirmed at a glance.',
      },
      {
        icon: Clock3,
        problem: 'After-hours booking requests lost overnight',
        solution: 'Your page takes bookings 24/7 — patients reserve at midnight, you see it in the morning.',
      },
    ],

    // ── Features / Benefits ──────────────────────────────────────────────────
    features: [
      {
        icon: CalendarCheck,
        title: 'Bookings around the clock',
        desc: 'Your clinic page is live 24/7. Patients book while you’re with someone else, or off the clock.',
      },
      {
        icon: Wallet,
        title: 'Fees paid before the visit',
        desc: 'Collect the consultation fee online via UPI, card or netbanking. GST invoice generated automatically.',
      },
      {
        icon: ShieldCheck,
        title: 'Patient details stay private',
        desc: 'Encrypted, access-controlled and never sold. Patient information belongs to your clinic alone.',
      },
      {
        icon: BellRing,
        title: 'Reminders that cut no-shows',
        desc: 'Email + WhatsApp reminders send themselves before every appointment — you never chase a patient.',
      },
    ],

    // ── Pricing framing ──────────────────────────────────────────────────────
    pricing: {
      hook: 'Less than a cup of chai a day.',
      line: 'Start free. Go unlimited and 0% commission from about ₹10/day — one recovered no-show pays for a month.',
    },

    // ── Mid-page CTA banners ─────────────────────────────────────────────────
    midCtas: {
      afterProblems: {
        text: 'Give your patients a faster way to book.',
        ctaText: 'Get My Clinic Link',
      },
      afterHow: {
        text: 'Your next patient is trying to book. Make it effortless.',
        ctaText: 'Set Up My Page Free',
      },
    },

    // ── FAQ (drives FAQPage schema — AEO/GEO) ────────────────────────────────
    faq: [
      {
        q: 'What is the best appointment booking software for doctors and clinics in India?',
        a: 'Meeticulous is built for Indian clinics and independent practitioners — patients book appointments online, pay the consultation fee upfront via UPI or card, and get automatic SMS and WhatsApp reminders that reduce no-shows. It handles GST invoicing and charges 0% commission on paid plans.',
      },
      {
        q: 'How does it reduce patient no-shows?',
        a: 'Every booking triggers automatic email and WhatsApp reminders before the appointment. Because patients also pay upfront, they are far more likely to turn up — most clinics see a clear drop in no-shows within the first month.',
      },
      {
        q: 'Can patients pay the consultation fee while booking?',
        a: 'Yes. Your fee is shown on the booking page and collected at checkout through Razorpay (UPI, cards, netbanking) before the visit. Patients arrive already paid, and a GST invoice is generated automatically.',
      },
      {
        q: 'Is patient data kept private and secure?',
        a: 'Yes. All data is encrypted, access-controlled and never sold. Patient details and appointment history belong to your clinic alone — no other party can see them.',
      },
      {
        q: 'Do patients need to create an account to book?',
        a: 'No. Patients simply pick a slot, enter their details and pay — no account or app needed. This keeps booking fast for every age group.',
      },
      {
        q: 'Is it suitable for dentists, physiotherapists and specialist clinics?',
        a: 'Yes. Any practitioner who takes booked appointments — physicians, dentists, physiotherapists, dermatologists, dietitians and specialist clinics — can use Meeticulous to let patients self-book and pay online.',
      },
    ],

    // ── Final CTA ────────────────────────────────────────────────────────────
    finalCta: {
      icon: HeartPulse,
      urgency: 'Every missed call is a patient who booked another clinic.',
      headline: 'More care, less front desk.',
      subline: 'Set up your clinic’s booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Create My Clinic Page',
    },

    // ── Section headings ─────────────────────────────────────────────────────
    headings: {
      problems: { eyebrow: 'The daily friction', title: 'Caring for patients is the job.', titleAccent: 'Clinic scheduling shouldn’t be.' },
      features: { eyebrow: 'What you get', title: 'Appointment booking software that runs like your', titleAccent: 'best front-desk nurse.' },
      testimonials: { title: 'Built for how clinics really run.', subtitle: 'Doctors, dentists and physios — booked, paid and reminded, without the front desk.' },
    },

    madeFor: "India's Doctors & Clinics",

    // ── Doctor testimonials (real) ───────────────────────────────────────────
    testimonials: [
      {
        quote: 'No-shows used to wreck my afternoon list. With automatic reminders and prepaid slots, my chairs actually stay full now.',
        name: 'Dr. Kavita Desai',
        role: 'Dentist',
        avatar: null,
      },
      {
        quote: 'My receptionist was on the phone all day. Patients now book themselves and the desk finally has time for people in the room.',
        name: 'Dr. Imran Sheikh',
        role: 'General Physician',
        avatar: null,
      },
      {
        quote: 'Follow-up visits are collected online before the call. No awkward payment talk, and every visit has a proper invoice.',
        name: 'Dr. Neha Verma',
        role: 'Physiotherapist',
        avatar: null,
      },
    ],
  },

  'business-consultant': {
    slug: 'business-consultant',
    label: 'Business Consultants',
    icon: Briefcase,

    // ── Theme — executive: charcoal + warm amber ─────────────────────────────
    theme: {
      primary: '#292524',    // stone-800 charcoal — ink / headings
      accent: '#d97706',     // amber-600 — signature colour
      accentCta: '#b45309',  // amber-700, AA-safe for white-text buttons
      tint: '#faf7f2',        // warm stone wash
      heroFrom: '#1c1917',   // stone-900
      heroTo: '#292524',     // stone-800
    },

    // ── SEO ──────────────────────────────────────────────────────────────────
    seo: {
      title: 'Appointment Booking Software for Business Consultants | Meeticulous',
      description:
        'Let clients book paid strategy sessions online. Meeticulous is appointment booking software for business consultants — fees collected upfront, calendar synced, no-shows gone, GST invoices. From ₹10/day.',
      keywords:
        'appointment booking software for consultants, business consultant scheduling, book strategy session online, consulting appointment software, consultant booking page India, discovery call scheduling',
      ogTitle: 'Still booking discovery calls over email? Fix it for ₹10/day.',
      ogDescription:
        'Clients book your strategy session, pay upfront, and get reminded — automatically. The booking page every independent consultant should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-business-consultant-og-1200x630.jpg',
    },

    // ── Hero ─────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Business Consultants, Advisors & Strategists',
      headline: 'Appointment booking software',
      headlineAccent: 'for business consultants',
      headlineTail: '— strategy sessions booked and paid before the first reply.',
      subline:
        'You advise. Meeticulous handles everything around it — clients pick a slot, pay your fee upfront, and get reminded — so your time goes to strategy, not scheduling.',
      ctaText: 'Set Up My Booking Page',
      microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
      mock: {
        practice: 'Rahul Khanna',
        practiceTag: 'Business Strategy Consultant',
        services: [
          { name: 'Discovery Call', meta: '30 min · Online', price: '₹2,000' },
          { name: 'Strategy Deep-Dive', meta: '60 min · Online', price: '₹5,000' },
        ],
      },
    },

    // ── Social proof strip ───────────────────────────────────────────────────
    socialProof: 'Trusted by independent consultants, advisors and strategists across India.',

    // ── Trust badges ─────────────────────────────────────────────────────────
    trust: [
      { icon: Lock, label: 'Razorpay-secured payments' },
      { icon: FileCheck, label: 'Automatic GST invoices' },
      { icon: ShieldCheck, label: 'Client data encrypted & private' },
      { icon: BadgePercent, label: '0% commission on paid plans' },
    ],

    // ── Authority stat band ──────────────────────────────────────────────────
    stats: [
      { icon: CalendarClock, value: '24/7', label: 'Sessions booked, even between engagements' },
      { icon: BadgePercent, value: '0%', label: 'Commission — you keep every fee' },
      { icon: IndianRupee, value: '~₹10', label: 'A day for the top, unlimited plan' },
      { icon: CalendarCheck, value: '< 5 min', label: 'To go live with your page' },
    ],

    // ── Problem / Agitation → Solution (6, consultant's language) ────────────
    painPoints: [
      {
        icon: MessageSquareX,
        problem: 'Discovery calls scheduled over endless email threads',
        solution: 'One booking link. Clients pick a slot themselves — no “does Tuesday work?” back-and-forth.',
      },
      {
        icon: IndianRupee,
        problem: 'Chasing invoices after the advice is already given',
        solution: 'Your fee is collected upfront at booking. You advise knowing you’re already paid.',
      },
      {
        icon: UserX,
        problem: 'Prospects no-showing your free discovery calls',
        solution: 'Automatic reminders — plus a paid or deposit option — mean serious clients actually turn up.',
      },
      {
        icon: CalendarX2,
        problem: 'Juggling client calls across time zones and tools',
        solution: 'Google Calendar busy times are blocked, so only your real free slots show. No clashes, no double-booking.',
      },
      {
        icon: Target,
        problem: 'Unqualified leads eating hours of your week',
        solution: 'Intake questions and paid slots filter tyre-kickers before they ever hit your calendar.',
      },
      {
        icon: PhoneOff,
        problem: 'Losing leads who reach out after hours',
        solution: 'Your page books sessions 24/7 — a prospect reserves at midnight, you see it at breakfast.',
      },
    ],

    // ── Features / Benefits ──────────────────────────────────────────────────
    features: [
      {
        icon: CalendarCheck,
        title: 'Booked around the clock',
        desc: 'Your booking page is live 24/7. Clients reserve strategy time while you’re deep in another engagement.',
      },
      {
        icon: Wallet,
        title: 'Paid before you advise',
        desc: 'Collect the full fee or a deposit upfront via UPI, card or netbanking. GST invoice generated automatically.',
      },
      {
        icon: ShieldCheck,
        title: 'Client details stay private',
        desc: 'Encrypted, access-controlled and never sold. Your client list and notes belong to you alone.',
      },
      {
        icon: BellRing,
        title: 'Reminders that cut no-shows',
        desc: 'Email + WhatsApp reminders send themselves before every session — you never chase a prospect.',
      },
    ],

    // ── Pricing framing ──────────────────────────────────────────────────────
    pricing: {
      hook: 'Less than a cup of chai a day.',
      line: 'Start free. Go unlimited and 0% commission from about ₹10/day — one booked session covers a year.',
    },

    // ── Mid-page CTA banners ─────────────────────────────────────────────────
    midCtas: {
      afterProblems: {
        text: 'Stop scheduling. Start consulting.',
        ctaText: 'Get My Booking Link',
      },
      afterHow: {
        text: 'Your next client is ready to book a session. Make it one click.',
        ctaText: 'Set Up My Page Free',
      },
    },

    // ── FAQ (drives FAQPage schema — AEO/GEO) ────────────────────────────────
    faq: [
      {
        q: 'What is the best appointment booking software for business consultants in India?',
        a: 'Meeticulous is built for Indian independent consultants — clients book strategy and discovery sessions online, pay your fee upfront via UPI or card, and get automatic reminders. It syncs with your calendar, handles GST invoicing and charges 0% commission on paid plans.',
      },
      {
        q: 'Can clients pay my consulting fee when they book?',
        a: 'Yes. Your fee is shown on the booking page and collected at checkout through Razorpay (UPI, cards, netbanking) before the session. You can charge the full fee or take a deposit.',
      },
      {
        q: 'Can I stop unqualified leads from booking my time?',
        a: 'Yes. You can add intake questions and make sessions paid or deposit-based, which filters out tyre-kickers so only serious clients reach your calendar.',
      },
      {
        q: 'Does it reduce no-shows on discovery calls?',
        a: 'Yes. Automatic email and WhatsApp reminders go out before every session, and prepaid or deposit slots make prospects far more likely to attend.',
      },
      {
        q: 'How much does it cost?',
        a: 'You can start free with a 5% per-booking fee. Paid plans begin at roughly ₹3 a day (billed yearly) and remove all commission, so you keep 100% of every session fee.',
      },
      {
        q: 'Is it suitable for coaches, advisors and freelance consultants?',
        a: 'Yes. Any professional who sells booked, paid time — management consultants, business coaches, financial and startup advisors, and freelance strategists — can use Meeticulous to run bookings and payments from one link.',
      },
    ],

    // ── Final CTA ────────────────────────────────────────────────────────────
    finalCta: {
      icon: TrendingUp,
      urgency: 'Every slow email reply is a client who booked another consultant.',
      headline: 'Advise more. Schedule less.',
      subline: 'Set up your consulting booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Create My Booking Page',
    },

    // ── Section headings ─────────────────────────────────────────────────────
    headings: {
      problems: { eyebrow: 'The daily friction', title: 'Advising clients is the work.', titleAccent: 'Client scheduling shouldn’t be.' },
      features: { eyebrow: 'What you get', title: 'Appointment booking software that works like your', titleAccent: 'own executive assistant.' },
      testimonials: { title: 'Built for how consulting really works.', subtitle: 'Consultants and advisors — booked, paid and reminded, without the admin.' },
    },

    madeFor: "India's Business Consultants",

    // ── Consultant testimonials (real) ───────────────────────────────────────
    testimonials: [
      {
        quote: 'Discovery calls used to be a scheduling nightmare. Now clients book and pay a deposit — my calendar fills with serious leads only.',
        name: 'Rahul Khanna',
        role: 'Strategy Consultant',
        avatar: null,
      },
      {
        quote: 'I used to raise invoices after every session and chase them for weeks. Getting paid upfront changed my entire cash flow.',
        name: 'Sneha Kapoor',
        role: 'Management Consultant',
        avatar: null,
      },
      {
        quote: 'One clean link in my LinkedIn bio does all my booking now. It looks far more credible than trading emails to find a slot.',
        name: 'Vikram Iyer',
        role: 'Startup Advisor',
        avatar: null,
      },
    ],
  },

  salon: {
    slug: 'salon',
    label: 'Salons & Spas',
    icon: Scissors,

    // ── Theme — beauty & luxury: deep plum + rose-pink ───────────────────────
    theme: {
      primary: '#4a1942',    // deep plum — ink / headings
      accent: '#ec4899',     // pink-500 — signature colour
      accentCta: '#be185d',  // pink-700, AA-safe for white-text buttons
      tint: '#fdf2f8',        // pink-50 wash
      heroFrom: '#3b0d2e',   // dark plum
      heroTo: '#591242',     // plum
    },

    // ── SEO ──────────────────────────────────────────────────────────────────
    seo: {
      title: 'Appointment Booking Software for Salons & Spas | Meeticulous',
      description:
        'Let clients book their own appointments online. Meeticulous is appointment booking software for salons & spas — 24/7 booking, deposits collected upfront, automatic reminders that cut no-shows, and GST invoices. From ₹10/day.',
      keywords:
        'salon booking software, spa appointment software, salon appointment booking India, online booking for salons, beauty parlour booking system, reduce salon no-shows, salon scheduling app',
      ogTitle: 'Still taking salon bookings on WhatsApp? Fix it for ₹10/day.',
      ogDescription:
        'Clients book their own slot, pay a deposit, and get reminded — automatically. The booking page every salon and spa in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-salon-og-1200x630.jpg',
    },

    // ── Hero ─────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Salons, Spas & Beauty Studios',
      headline: 'Appointment booking software',
      headlineAccent: 'for salons & spas',
      headlineTail: '— chairs booked and filled without the phone ringing off the hook.',
      subline:
        'You make clients look their best. Meeticulous handles everything around it — clients pick a slot, pay a deposit, and get reminded — so it’s fewer no-shows and more time behind the chair.',
      ctaText: 'Set Up My Salon Page',
      microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
      mock: {
        practice: 'Glow Studio',
        practiceTag: 'Hair · Skin · Nails',
        services: [
          { name: 'Haircut & Style', meta: '45 min · In-salon', price: '₹800' },
          { name: 'Signature Facial', meta: '60 min · In-salon', price: '₹1,500' },
        ],
      },
    },

    // ── Social proof strip ───────────────────────────────────────────────────
    socialProof: 'Trusted by salons, spas and independent beauty professionals across India.',

    // ── Trust badges ─────────────────────────────────────────────────────────
    trust: [
      { icon: Lock, label: 'Razorpay-secured payments' },
      { icon: FileCheck, label: 'Automatic GST invoices' },
      { icon: ShieldCheck, label: 'Client data encrypted & private' },
      { icon: BadgePercent, label: '0% commission on paid plans' },
    ],

    // ── Authority stat band ──────────────────────────────────────────────────
    stats: [
      { icon: CalendarClock, value: '24/7', label: 'Appointments booked, even after closing' },
      { icon: TrendingDown, value: 'Fewer', label: 'No-shows, thanks to deposits + reminders' },
      { icon: IndianRupee, value: '~₹10', label: 'A day for the top, unlimited plan' },
      { icon: CalendarCheck, value: '< 5 min', label: 'To go live with your salon page' },
    ],

    // ── Problem / Agitation → Solution (6, salon's language) ─────────────────
    painPoints: [
      {
        icon: PhoneCall,
        problem: 'Phone ringing mid-service to take the next booking',
        solution: 'Clients book themselves online — your team stays with the client in the chair, not on the phone.',
      },
      {
        icon: UserX,
        problem: 'No-shows leaving stylists idle and chairs empty',
        solution: 'A small deposit at booking plus automatic reminders means no-shows drop right away.',
      },
      {
        icon: MessageSquareX,
        problem: 'Bookings buried in Instagram and WhatsApp DMs',
        solution: 'One link in your bio takes every booking — no more scrolling messages to piece together the day.',
      },
      {
        icon: CalendarX2,
        problem: 'Double-booked slots and clashing stylist schedules',
        solution: 'Every slot locks the moment it’s taken. One live calendar per stylist, no overbooking.',
      },
      {
        icon: IndianRupee,
        problem: 'Awkward deposits and no-show charges to collect',
        solution: 'Deposits are taken online at booking, with a GST invoice — no cash-counter awkwardness.',
      },
      {
        icon: Clock3,
        problem: 'Late-night booking requests missed till morning',
        solution: 'Your page books 24/7 — a client reserves at midnight, you see it when you open the shutters.',
      },
    ],

    // ── Features / Benefits ──────────────────────────────────────────────────
    features: [
      {
        icon: CalendarCheck,
        title: 'Bookings around the clock',
        desc: 'Your salon page is live 24/7. Clients book while you’re with someone else, or long after closing time.',
      },
      {
        icon: Wallet,
        title: 'Deposits paid upfront',
        desc: 'Collect a deposit or the full price online via UPI, card or netbanking. GST invoice generated automatically.',
      },
      {
        icon: ShieldCheck,
        title: 'Client details stay private',
        desc: 'Encrypted, access-controlled and never sold. Your client list and history belong to your salon alone.',
      },
      {
        icon: BellRing,
        title: 'Reminders that cut no-shows',
        desc: 'Email + WhatsApp reminders send themselves before every appointment — you never chase a client.',
      },
    ],

    // ── Pricing framing ──────────────────────────────────────────────────────
    pricing: {
      hook: 'Less than a cup of chai a day.',
      line: 'Start free. Go unlimited and 0% commission from about ₹10/day — one recovered no-show covers a month.',
    },

    // ── Mid-page CTA banners ─────────────────────────────────────────────────
    midCtas: {
      afterProblems: {
        text: 'Let your clients book while your hands are full.',
        ctaText: 'Get My Salon Link',
      },
      afterHow: {
        text: 'Your next client is trying to book. Make it effortless.',
        ctaText: 'Set Up My Page Free',
      },
    },

    // ── FAQ (drives FAQPage schema — AEO/GEO) ────────────────────────────────
    faq: [
      {
        q: 'What is the best appointment booking software for salons and spas in India?',
        a: 'Meeticulous is built for Indian salons and spas — clients book their own appointments online, pay a deposit upfront via UPI or card, and get automatic WhatsApp and email reminders that cut no-shows. It handles GST invoicing and charges 0% commission on paid plans.',
      },
      {
        q: 'How does it reduce salon no-shows?',
        a: 'Every booking can require a deposit and triggers automatic reminders before the appointment. Together, these make clients far more likely to turn up — most salons see a clear drop in no-shows within weeks.',
      },
      {
        q: 'Can clients pay a deposit while booking?',
        a: 'Yes. You can collect a deposit or the full service price at checkout through Razorpay (UPI, cards, netbanking), with a GST invoice generated automatically.',
      },
      {
        q: 'Can I manage bookings for multiple stylists or therapists?',
        a: 'Yes. Each stylist or therapist can have their own services and availability, so clients book the right person and slots never clash.',
      },
      {
        q: 'Do clients need to install an app to book?',
        a: 'No. Clients simply open your link, pick a slot and pay — no app or account needed. It works from your Instagram bio, WhatsApp or website.',
      },
      {
        q: 'Is it suitable for spas, nail studios and beauty parlours?',
        a: 'Yes. Any beauty or wellness business that takes booked appointments — hair salons, spas, nail and lash studios, beauty parlours and independent stylists — can use Meeticulous for online booking and payments.',
      },
    ],

    // ── Final CTA ────────────────────────────────────────────────────────────
    finalCta: {
      icon: Sparkles,
      urgency: 'Every missed call is a client who booked another salon.',
      headline: 'More time behind the chair.',
      subline: 'Set up your salon’s booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Create My Salon Page',
    },

    // ── Section headings ─────────────────────────────────────────────────────
    headings: {
      problems: { eyebrow: 'The daily friction', title: 'Making clients look great is the job.', titleAccent: 'The phone shouldn’t be.' },
      features: { eyebrow: 'What you get', title: 'Appointment booking software that works like your', titleAccent: 'best receptionist.' },
      testimonials: { title: 'Built for how salons really run.', subtitle: 'Stylists, spas and studios — chairs booked and filled, without the phone.' },
    },

    madeFor: "India's Salons & Spas",

    // ── Salon testimonials (real) ────────────────────────────────────────────
    testimonials: [
      {
        quote: 'No-shows used to cost us a fortune on weekends. Deposits at booking fixed it — the chairs stay full now.',
        name: 'Ritu Malhotra',
        role: 'Salon Owner',
        avatar: null,
      },
      {
        quote: 'We were drowning in Instagram DMs to book clients. One link took over and my front desk finally breathes.',
        name: 'Farah Sheikh',
        role: 'Spa Manager',
        avatar: null,
      },
      {
        quote: 'Clients book their own slot with my stylists and pay upfront. Way more professional than a WhatsApp back-and-forth.',
        name: 'Deepak Nair',
        role: 'Hair Studio Owner',
        avatar: null,
      },
    ],
  },

  freelancers: {
    slug: 'freelancers',
    label: 'Freelancers',
    icon: Laptop,

    // ── Theme — digital & remote: deep teal + bright teal ────────────────────
    theme: {
      primary: '#134e4a',    // teal-900 — ink / headings
      accent: '#14b8a6',     // teal-500 — signature colour
      accentCta: '#0f766e',  // teal-700, AA-safe for white-text buttons
      tint: '#f0fdfa',        // teal-50 wash
      heroFrom: '#042f2e',   // dark teal
      heroTo: '#134e4a',     // teal-900
    },

    // ── SEO ──────────────────────────────────────────────────────────────────
    seo: {
      title: 'Appointment Booking Software for Freelancers | Meeticulous',
      description:
        'Let clients book calls and pay you online. Meeticulous is booking + payment software for freelancers — advances collected upfront, calendar synced, no-shows gone, GST invoices. From ₹10/day.',
      keywords:
        'booking software for freelancers, freelancer scheduling app, collect advance payment freelancer, freelance discovery call booking, freelancer booking page India, get paid upfront freelance',
      ogTitle: 'Still chasing freelance clients for payment? Fix it for ₹10/day.',
      ogDescription:
        'Clients book your call, pay an advance upfront, and get reminded — automatically. The booking + payment link every freelancer in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-freelancers-og-1200x630.jpg',
    },

    // ── Hero ─────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Freelancers, Designers, Developers & Writers',
      headline: 'Appointment booking software',
      headlineAccent: 'for freelancers',
      headlineTail: '— client calls booked and paid before you open the laptop.',
      subline:
        'You do the work. Meeticulous handles everything around it — clients pick a slot, pay an advance upfront, and get reminded — so your day goes to the craft, not chasing invoices.',
      ctaText: 'Set Up My Booking Page',
      microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
      mock: {
        practice: 'Ananya Rao',
        practiceTag: 'Freelance UX Designer',
        services: [
          { name: 'Intro / Discovery Call', meta: '30 min · Online', price: '₹1,000' },
          { name: 'Design Consultation', meta: '60 min · Online', price: '₹3,000' },
        ],
      },
    },

    // ── Social proof strip ───────────────────────────────────────────────────
    socialProof: 'Trusted by designers, developers, writers and independent freelancers across India.',

    // ── Trust badges ─────────────────────────────────────────────────────────
    trust: [
      { icon: Lock, label: 'Razorpay-secured payments' },
      { icon: FileCheck, label: 'Automatic GST invoices' },
      { icon: ShieldCheck, label: 'Client data encrypted & private' },
      { icon: BadgePercent, label: '0% commission on paid plans' },
    ],

    // ── Authority stat band ──────────────────────────────────────────────────
    stats: [
      { icon: CalendarClock, value: '24/7', label: 'Calls booked, across any client time zone' },
      { icon: BadgePercent, value: '0%', label: 'Commission — you keep every rupee' },
      { icon: IndianRupee, value: '~₹10', label: 'A day for the top, unlimited plan' },
      { icon: CalendarCheck, value: '< 5 min', label: 'To go live with your page' },
    ],

    // ── Problem / Agitation → Solution (6, freelancer's language) ────────────
    painPoints: [
      {
        icon: IndianRupee,
        problem: 'Chasing clients for advances and unpaid invoices',
        solution: 'Collect an advance or full fee at booking. You start the work already paid, no follow-ups.',
      },
      {
        icon: MessageSquareX,
        problem: 'Scheduling calls over endless DMs and email threads',
        solution: 'One link. Clients pick a slot themselves — no “what time works for you?” ping-pong.',
      },
      {
        icon: CalendarX2,
        problem: 'Juggling calls across clients and time zones',
        solution: 'Google Calendar busy times are blocked, so only your real free slots show, in the client’s own time zone.',
      },
      {
        icon: UserX,
        problem: 'Prospects ghosting your free discovery calls',
        solution: 'A small paid or deposit slot plus reminders means only serious clients book your time.',
      },
      {
        icon: MessageSquareX,
        problem: 'Sharing a UPI QR after the call — looks unprofessional',
        solution: 'A clean branded page with Razorpay checkout. The polish that wins better-paying clients.',
      },
      {
        icon: Clock3,
        problem: 'Losing overseas leads who reach out overnight',
        solution: 'Your page books 24/7 — a client in another time zone reserves while you sleep.',
      },
    ],

    // ── Features / Benefits ──────────────────────────────────────────────────
    features: [
      {
        icon: CalendarCheck,
        title: 'Booked around the clock',
        desc: 'Your booking page is live 24/7. Clients reserve calls while you’re heads-down or offline.',
      },
      {
        icon: Wallet,
        title: 'Paid before you start',
        desc: 'Collect an advance or full fee upfront via UPI, card or netbanking. GST invoice generated automatically.',
      },
      {
        icon: ShieldCheck,
        title: 'Client details stay private',
        desc: 'Encrypted, access-controlled and never sold. Your client list and notes belong to you alone.',
      },
      {
        icon: BellRing,
        title: 'Reminders that cut no-shows',
        desc: 'Email + WhatsApp reminders send themselves before every call — you never chase a client.',
      },
    ],

    // ── Pricing framing ──────────────────────────────────────────────────────
    pricing: {
      hook: 'Less than a cup of chai a day.',
      line: 'Start free. Go unlimited and 0% commission from about ₹10/day — one booked call covers a year.',
    },

    // ── Mid-page CTA banners ─────────────────────────────────────────────────
    midCtas: {
      afterProblems: {
        text: 'Stop chasing invoices. Start getting paid to talk.',
        ctaText: 'Get My Booking Link',
      },
      afterHow: {
        text: 'Your next client is ready to book a call. Make it one click.',
        ctaText: 'Set Up My Page Free',
      },
    },

    // ── FAQ (drives FAQPage schema — AEO/GEO) ────────────────────────────────
    faq: [
      {
        q: 'What is the best booking and payment software for freelancers in India?',
        a: 'Meeticulous is built for Indian freelancers — clients book calls online, pay an advance or full fee upfront via UPI or card, and get automatic reminders. It syncs with your calendar, handles GST invoicing and charges 0% commission on paid plans, so you keep every rupee.',
      },
      {
        q: 'Can I collect an advance payment when a client books?',
        a: 'Yes. Your fee is shown on the booking page and collected at checkout through Razorpay (UPI, cards, netbanking) before the call. You can take an advance or the full amount upfront.',
      },
      {
        q: 'Does it handle clients in other time zones?',
        a: 'Yes. Your availability is shown in each client’s own time zone, and Google Calendar busy-time blocking keeps your real free slots accurate — so overseas clients book without any back-and-forth.',
      },
      {
        q: 'How does it reduce no-shows on discovery calls?',
        a: 'Automatic email and WhatsApp reminders go out before every call, and making the slot paid or deposit-based means only serious prospects book your time.',
      },
      {
        q: 'How much does it cost?',
        a: 'You can start free with a 5% per-booking fee. Paid plans begin at roughly ₹3 a day (billed yearly) and remove all commission, so you keep 100% of every fee.',
      },
      {
        q: 'Is it suitable for designers, developers, writers and consultants?',
        a: 'Yes. Any freelancer who sells booked time — designers, developers, writers, marketers, video editors and consultants — can use Meeticulous to run bookings and payments from one professional link.',
      },
    ],

    // ── Final CTA ────────────────────────────────────────────────────────────
    finalCta: {
      icon: Laptop,
      urgency: 'Every unpaid invoice is time you’ll never bill again.',
      headline: 'Do the work. Skip the admin.',
      subline: 'Set up your freelance booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Create My Booking Page',
    },

    // ── Section headings ─────────────────────────────────────────────────────
    headings: {
      problems: { eyebrow: 'The daily friction', title: 'Doing great work is the job.', titleAccent: 'Chasing payment shouldn’t be.' },
      features: { eyebrow: 'What you get', title: 'Appointment booking software that works like your', titleAccent: 'own project manager.' },
      testimonials: { title: 'Built for how freelancers really work.', subtitle: 'Designers, writers and developers — booked and paid, without the admin.' },
    },

    madeFor: "India's Freelancers",

    // ── Freelancer testimonials (real) ───────────────────────────────────────
    testimonials: [
      {
        quote: 'Advances at booking ended my cash-flow stress. I start projects already paid instead of chasing invoices for weeks.',
        name: 'Ananya Rao',
        role: 'UX Designer',
        avatar: null,
      },
      {
        quote: 'Overseas clients used to be a scheduling headache. Now they book in their own time zone and pay upfront — zero back-and-forth.',
        name: 'Karan Mehta',
        role: 'Freelance Developer',
        avatar: null,
      },
      {
        quote: 'A clean booking link on my portfolio looks so much more professional than sending a UPI QR after every call.',
        name: 'Ishita Sen',
        role: 'Content Writer',
        avatar: null,
      },
    ],
  },

  fitness: {
    slug: 'fitness',
    label: 'Fitness Trainers & Studios',
    icon: Zap,

    // ── Theme — energy: deep warm base + fiery orange ────────────────────────
    theme: {
      primary: '#431407',    // orange-950 deep — ink / headings
      accent: '#f97316',     // orange-500 — signature colour
      accentCta: '#c2410c',  // orange-700, AA-safe for white-text buttons
      tint: '#fff7ed',        // orange-50 wash
      heroFrom: '#431407',   // orange-950
      heroTo: '#7c2d12',     // orange-900
    },

    // ── SEO ──────────────────────────────────────────────────────────────────
    seo: {
      title: 'Appointment Booking Software for Fitness Trainers | Meeticulous',
      description:
        'Let clients book sessions and classes online. Meeticulous is booking software for fitness trainers & studios — packages paid upfront, class capacity managed, automatic reminders that cut no-shows, GST invoices. From ₹10/day.',
      keywords:
        'booking software for fitness trainers, gym class booking software, personal trainer scheduling app, yoga class booking India, fitness studio booking system, reduce no-shows gym, PT session booking',
      ogTitle: 'Still booking gym clients on WhatsApp? Fix it for ₹10/day.',
      ogDescription:
        'Clients book their session, pay for the package upfront, and get reminded — automatically. The booking page every trainer and studio in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-fitness-og-1200x630.jpg',
    },

    // ── Hero ─────────────────────────────────────────────────────────────────
    hero: {
      eyebrow: 'For Personal Trainers, Coaches & Fitness Studios',
      headline: 'Your sessions,',
      headlineAccent: 'booked and paid',
      headlineTail: 'before the warm-up.',
      subline:
        'You get clients results. Meeticulous handles everything around it — clients pick a slot, pay for the session or package upfront, and get reminded — so it’s more training and less admin.',
      ctaText: 'Set Up My Booking Page',
      microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
      mock: {
        practice: 'Coach Arjun',
        practiceTag: 'Personal Trainer · Strength',
        services: [
          { name: '1:1 Training Session', meta: '45 min · In-studio', price: '₹800' },
          { name: '10-Session Package', meta: 'Save 15% · Prepaid', price: '₹6,800' },
        ],
      },
    },

    // ── Social proof strip ───────────────────────────────────────────────────
    socialProof: 'Trusted by personal trainers, yoga teachers and fitness studios across India.',

    // ── Trust badges ─────────────────────────────────────────────────────────
    trust: [
      { icon: Lock, label: 'Razorpay-secured payments' },
      { icon: FileCheck, label: 'Automatic GST invoices' },
      { icon: ShieldCheck, label: 'Client data encrypted & private' },
      { icon: BadgePercent, label: '0% commission on paid plans' },
    ],

    // ── Authority stat band ──────────────────────────────────────────────────
    stats: [
      { icon: CalendarClock, value: '24/7', label: 'Sessions & classes booked, any hour' },
      { icon: TrendingDown, value: 'Fewer', label: 'No-shows, thanks to prepaid + reminders' },
      { icon: IndianRupee, value: '~₹10', label: 'A day for the top, unlimited plan' },
      { icon: CalendarCheck, value: '< 5 min', label: 'To go live with your page' },
    ],

    // ── Problem / Agitation → Solution (6, trainer's language) ───────────────
    painPoints: [
      {
        icon: MessageSquareX,
        problem: 'Booking sessions one WhatsApp message at a time',
        solution: 'One link. Clients book their own slot — you stay on the floor, not on your phone.',
      },
      {
        icon: UserX,
        problem: 'No-shows wasting slots you blocked for a client',
        solution: 'Prepaid sessions plus automatic reminders mean clients actually show up.',
      },
      {
        icon: IndianRupee,
        problem: 'Chasing clients for package and monthly fees',
        solution: 'Sell prepaid packages online — money’s in before the first session, with a GST invoice.',
      },
      {
        icon: CalendarX2,
        problem: 'Overbooked classes and clashing PT slots',
        solution: 'Set capacity per class and slots lock instantly — no overcrowding, no double-booking.',
      },
      {
        icon: PhoneCall,
        problem: 'Enquiries interrupting you mid-session',
        solution: 'Your page answers “are you free at 6?” for you — clients see real slots and just book.',
      },
      {
        icon: Clock3,
        problem: 'Late-night sign-up requests lost by morning',
        solution: 'Your page books 24/7 — someone signs up at midnight, you see it before your first class.',
      },
    ],

    // ── Features / Benefits ──────────────────────────────────────────────────
    features: [
      {
        icon: CalendarCheck,
        title: 'Bookings around the clock',
        desc: 'Your booking page is live 24/7. Clients reserve sessions and classes while you’re training someone else.',
      },
      {
        icon: Wallet,
        title: 'Packages paid upfront',
        desc: 'Sell single sessions or prepaid packages via UPI, card or netbanking. GST invoice generated automatically.',
      },
      {
        icon: ShieldCheck,
        title: 'Client details stay private',
        desc: 'Encrypted, access-controlled and never sold. Your client list and history belong to you alone.',
      },
      {
        icon: BellRing,
        title: 'Reminders that cut no-shows',
        desc: 'Email + WhatsApp reminders send themselves before every session — you never chase a client.',
      },
    ],

    // ── Pricing framing ──────────────────────────────────────────────────────
    pricing: {
      hook: 'Less than a cup of chai a day.',
      line: 'Start free. Go unlimited and 0% commission from about ₹10/day — one recovered no-show covers a month.',
    },

    // ── Mid-page CTA banners ─────────────────────────────────────────────────
    midCtas: {
      afterProblems: {
        text: 'Spend your time training, not texting.',
        ctaText: 'Get My Booking Link',
      },
      afterHow: {
        text: 'Your next client is ready to book a session. Make it one tap.',
        ctaText: 'Set Up My Page Free',
      },
    },

    // ── FAQ (drives FAQPage schema — AEO/GEO) ────────────────────────────────
    faq: [
      {
        q: 'What is the best booking software for fitness trainers and studios in India?',
        a: 'Meeticulous is built for Indian trainers and studios — clients book sessions and classes online, pay for a session or prepaid package upfront via UPI or card, and get automatic reminders that cut no-shows. It manages class capacity, handles GST invoicing and charges 0% commission on paid plans.',
      },
      {
        q: 'Can I sell prepaid session packages?',
        a: 'Yes. You can offer single sessions or prepaid multi-session packages, collected online at booking through Razorpay, with a GST invoice generated automatically.',
      },
      {
        q: 'How does it reduce no-shows?',
        a: 'Sessions can be prepaid, and automatic email and WhatsApp reminders go out before every booking — together they make clients far more likely to show up.',
      },
      {
        q: 'Can I manage class capacity and multiple trainers?',
        a: 'Yes. You can set a capacity for each class and give every trainer their own services and availability, so classes never overfill and PT slots never clash.',
      },
      {
        q: 'Do clients need an app to book?',
        a: 'No. Clients open your link, pick a slot and pay — no app or account needed. It works straight from your Instagram bio, WhatsApp or website.',
      },
      {
        q: 'Is it suitable for yoga teachers, gyms and independent coaches?',
        a: 'Yes. Any fitness professional who takes booked sessions — personal trainers, yoga and pilates teachers, gyms, CrossFit boxes and independent coaches — can use Meeticulous for online booking and payments.',
      },
    ],

    // ── Final CTA ────────────────────────────────────────────────────────────
    finalCta: {
      icon: Zap,
      urgency: 'Every empty slot is income you can’t make back.',
      headline: 'More reps. Less admin.',
      subline: 'Set up your training booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.',
      ctaText: 'Create My Booking Page',
    },

    // ── Section headings ─────────────────────────────────────────────────────
    headings: {
      problems: { eyebrow: 'The daily friction', title: 'Getting clients results is the job.', titleAccent: 'The scheduling shouldn’t be.' },
      features: { eyebrow: 'What you get', title: 'A booking page that works like your', titleAccent: 'own front desk.' },
    },

    madeFor: "India's Fitness Trainers & Studios",

    // ── Fitness testimonials (real) ──────────────────────────────────────────
    testimonials: [
      {
        quote: 'Selling prepaid packages online changed everything. Clients commit, they show up, and I’m not chasing monthly fees anymore.',
        name: 'Arjun Sethi',
        role: 'Personal Trainer',
        avatar: null,
      },
      {
        quote: 'My classes used to overfill or sit half-empty. Now capacity is set and clients just book the open spots themselves.',
        name: 'Meera Joshi',
        role: 'Yoga Teacher',
        avatar: null,
      },
      {
        quote: 'No-shows were killing my evenings. Prepaid slots plus reminders and my calendar actually stays full now.',
        name: 'Rohit Nair',
        role: 'Studio Owner',
        avatar: null,
      },
    ],
  },

  tutors: {
    slug: 'tutors',
    label: 'Tutors & Educators',
    icon: GraduationCap,
    theme: {
      primary: '#1e1b4b', accent: '#6366f1', accentCta: '#4338ca',
      tint: '#eef2ff', heroFrom: '#1e1b4b', heroTo: '#312e81',
    },
    seo: {
      title: 'Appointment Booking Software for Tutors & Educators | Meeticulous',
      description:
        'Let students and parents book classes online. Meeticulous is booking software for tutors & educators — fees paid upfront, batches scheduled, automatic reminders that cut no-shows, GST invoices. From ₹10/day.',
      keywords:
        'booking software for tutors, online class booking, tuition scheduling app, book tutor online India, coaching class booking system, reduce student no-shows, demo class booking',
      ogTitle: 'Still fixing tuition timings over WhatsApp? Fix it for ₹10/day.',
      ogDescription:
        'Students and parents book a slot, pay upfront, and get reminded — automatically. The booking page every tutor and coaching class in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-tutors-og-1200x630.jpg',
    },
    hero: {
      eyebrow: 'For Tutors, Coaching Classes & Educators',
      headline: 'Your classes,',
      headlineAccent: 'booked and paid',
      headlineTail: 'before the first lesson.',
      subline:
        'You teach. Meeticulous handles everything around it — students and parents pick a slot, pay the fee upfront, and get reminded — so your time goes to lessons, not the timetable.',
      ctaText: 'Set Up My Booking Page',
      microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
      mock: {
        practice: 'Priya’s Maths Class',
        practiceTag: 'Maths Tutor · Grades 9–12',
        services: [
          { name: 'Demo Class', meta: '30 min · Online', price: 'Free' },
          { name: 'Monthly Batch', meta: '12 classes · Prepaid', price: '₹3,000' },
        ],
      },
    },
    socialProof: 'Trusted by tutors, coaching classes and independent educators across India.',
    trust: [
      { icon: Lock, label: 'Razorpay-secured payments' },
      { icon: FileCheck, label: 'Automatic GST invoices' },
      { icon: ShieldCheck, label: 'Student data encrypted & private' },
      { icon: BadgePercent, label: '0% commission on paid plans' },
    ],
    stats: [
      { icon: CalendarClock, value: '24/7', label: 'Classes & demos booked, any hour' },
      { icon: TrendingDown, value: 'Fewer', label: 'No-shows, thanks to prepaid + reminders' },
      { icon: IndianRupee, value: '~₹10', label: 'A day for the top, unlimited plan' },
      { icon: CalendarCheck, value: '< 5 min', label: 'To go live with your page' },
    ],
    painPoints: [
      { icon: MessageSquareX, problem: 'Fixing class timings over endless parent WhatsApps', solution: 'One link. Students and parents pick a slot themselves — no group-chat scheduling.' },
      { icon: IndianRupee, problem: 'Chasing monthly fees class after class', solution: 'Fees are collected online upfront — prepaid batches with a GST invoice, no reminders needed.' },
      { icon: UserX, problem: 'Students booking demos and never turning up', solution: 'Reminders plus a paid or confirmed slot mean only serious learners take your time.' },
      { icon: CalendarX2, problem: 'Batch timings and 1:1 slots clashing', solution: 'Every slot locks the moment it’s taken. Batches and private lessons never overlap.' },
      { icon: BookOpen, problem: 'Juggling students across boards, grades and subjects', solution: 'Separate services per subject and level — students book exactly the right class.' },
      { icon: Clock3, problem: 'Enquiries after class hours lost by morning', solution: 'Your page books 24/7 — a parent enrols at night, you see it before the first bell.' },
    ],
    features: [
      { icon: CalendarCheck, title: 'Bookings around the clock', desc: 'Your class page is live 24/7. Students book demos and batches while you’re teaching another group.' },
      { icon: Wallet, title: 'Fees paid upfront', desc: 'Collect per-class or prepaid batch fees via UPI, card or netbanking. GST invoice generated automatically.' },
      { icon: ShieldCheck, title: 'Student details stay private', desc: 'Encrypted, access-controlled and never sold. Your student list and history belong to you alone.' },
      { icon: BellRing, title: 'Reminders that cut no-shows', desc: 'Email + WhatsApp reminders send themselves before every class — you never chase a student.' },
    ],
    pricing: { hook: 'Less than a cup of chai a day.', line: 'Start free. Go unlimited and 0% commission from about ₹10/day — one enrolled student covers a year.' },
    midCtas: {
      afterProblems: { text: 'Spend your time teaching, not texting.', ctaText: 'Get My Booking Link' },
      afterHow: { text: 'Your next student is ready to enrol. Make it one click.', ctaText: 'Set Up My Page Free' },
    },
    faq: [
      { q: 'What is the best booking software for tutors and coaching classes in India?', a: 'Meeticulous is built for Indian tutors and educators — students and parents book classes online, pay the fee upfront via UPI or card, and get automatic reminders that cut no-shows. It handles batches, GST invoicing and charges 0% commission on paid plans.' },
      { q: 'Can I collect class fees when students book?', a: 'Yes. Your fee is shown on the booking page and collected at checkout through Razorpay (UPI, cards, netbanking) before the class, with a GST invoice generated automatically. You can charge per class or per batch.' },
      { q: 'Can I run both batches and 1:1 lessons?', a: 'Yes. You can set up separate services for group batches and private lessons, each with its own capacity and availability, so bookings never clash.' },
      { q: 'How does it reduce demo-class no-shows?', a: 'Automatic email and WhatsApp reminders go out before every class, and making demos confirmed or paid means only serious students book your time.' },
      { q: 'How much does it cost?', a: 'You can start free with a 5% per-booking fee. Paid plans begin at roughly ₹3 a day (billed yearly) and remove all commission, so you keep 100% of every fee.' },
      { q: 'Is it suitable for coaching institutes and online educators?', a: 'Yes. Tutors, coaching institutes, music and language teachers, exam-prep coaches and online educators can all use Meeticulous to run class bookings and payments from one link.' },
    ],
    finalCta: { icon: GraduationCap, urgency: 'Every empty seat is a student who enrolled elsewhere.', headline: 'More teaching. Less timetabling.', subline: 'Set up your class booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.', ctaText: 'Create My Booking Page' },
    headings: {
      problems: { eyebrow: 'The daily friction', title: 'Teaching well is the job.', titleAccent: 'The timetable shouldn’t be.' },
      features: { eyebrow: 'What you get', title: 'A booking page that works like your', titleAccent: 'own class coordinator.' },
    },
    madeFor: "India's Tutors & Educators",
    testimonials: [
      { quote: 'Parents used to message me all day about timings and fees. Now they book a slot and pay online — my evenings are mine again.', name: 'Priya Sharma', role: 'Maths Tutor', avatar: null },
      { quote: 'Prepaid batches ended my fee-chasing completely. Students commit for the month and actually show up.', name: 'Imtiaz Ali', role: 'Physics Coach', avatar: null },
      { quote: 'Demo no-shows used to waste my slots. Reminders fixed that, and my calendar finally stays full.', name: 'Ananya Reddy', role: 'English Tutor', avatar: null },
    ],
  },

  photographers: {
    slug: 'photographers',
    label: 'Photographers',
    icon: Camera,
    theme: {
      primary: '#4a044e', accent: '#d946ef', accentCta: '#a21caf',
      tint: '#fdf4ff', heroFrom: '#3b0764', heroTo: '#701a75',
    },
    seo: {
      title: 'Appointment Booking Software for Photographers | Meeticulous',
      description:
        'Let clients book shoots and pay online. Meeticulous is booking software for photographers — deposits collected upfront, calendar synced, automatic reminders, GST invoices. From ₹10/day.',
      keywords:
        'booking software for photographers, photography shoot booking, photographer scheduling app, book photoshoot online India, studio booking system, collect shoot deposit, wedding photographer booking',
      ogTitle: 'Still booking shoots in your Instagram DMs? Fix it for ₹10/day.',
      ogDescription:
        'Clients book a shoot slot, pay a deposit upfront, and get reminded — automatically. The booking page every photographer in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-photographers-og-1200x630.jpg',
    },
    hero: {
      eyebrow: 'For Photographers, Studios & Videographers',
      headline: 'Appointment booking software',
      headlineAccent: 'for photographers',
      headlineTail: '— shoots booked and secured before you pack the gear.',
      subline:
        'You make great images. Meeticulous handles everything around it — clients pick a slot, pay a deposit upfront, and get reminded — so you stay behind the lens, not in your inbox.',
      ctaText: 'Set Up My Booking Page',
      microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
      mock: {
        practice: 'Studio Lumen',
        practiceTag: 'Portrait & Wedding Photography',
        services: [
          { name: 'Portrait Session', meta: '60 min · On-location', price: '₹5,000' },
          { name: 'Pre-Wedding Shoot', meta: 'Half day · Deposit', price: '₹8,000' },
        ],
      },
    },
    socialProof: 'Trusted by portrait, wedding and event photographers across India.',
    trust: [
      { icon: Lock, label: 'Razorpay-secured payments' },
      { icon: FileCheck, label: 'Automatic GST invoices' },
      { icon: ShieldCheck, label: 'Client data encrypted & private' },
      { icon: BadgePercent, label: '0% commission on paid plans' },
    ],
    stats: [
      { icon: CalendarClock, value: '24/7', label: 'Shoots booked, even between sessions' },
      { icon: TrendingDown, value: 'Fewer', label: 'Cancellations, thanks to deposits' },
      { icon: IndianRupee, value: '~₹10', label: 'A day for the top, unlimited plan' },
      { icon: CalendarCheck, value: '< 5 min', label: 'To go live with your page' },
    ],
    painPoints: [
      { icon: MessageSquareX, problem: 'Shoot bookings buried in Instagram and WhatsApp DMs', solution: 'One link in your bio takes every booking — no scrolling messages to piece together dates.' },
      { icon: IndianRupee, problem: 'Clients backing out after you’ve blocked the date', solution: 'A deposit at booking secures the slot — flaky enquiries filter themselves out.' },
      { icon: CalendarX2, problem: 'Double-booking two shoots on the same day', solution: 'Every date locks the moment it’s taken. One live calendar, no clashes.' },
      { icon: MessageSquareX, problem: 'Sharing a UPI QR for the advance feels unprofessional', solution: 'A clean branded page with Razorpay checkout — the polish premium clients expect.' },
      { icon: Clock3, problem: 'Enquiries at all hours you can’t always answer', solution: 'Your page books 24/7 — a couple reserves their date at midnight while you edit.' },
      { icon: UserX, problem: 'No-shows for portfolio and trial sessions', solution: 'Reminders plus a deposit mean clients actually turn up for the shoot.' },
    ],
    features: [
      { icon: CalendarCheck, title: 'Bookings around the clock', desc: 'Your booking page is live 24/7. Clients reserve shoots while you’re on set or editing.' },
      { icon: Wallet, title: 'Deposits paid upfront', desc: 'Collect a deposit or full fee via UPI, card or netbanking. GST invoice generated automatically.' },
      { icon: ShieldCheck, title: 'Client details stay private', desc: 'Encrypted, access-controlled and never sold. Your client list and shoots belong to you alone.' },
      { icon: BellRing, title: 'Reminders that cut no-shows', desc: 'Email + WhatsApp reminders send themselves before every shoot — you never chase a client.' },
    ],
    pricing: { hook: 'Less than a cup of chai a day.', line: 'Start free. Go unlimited and 0% commission from about ₹10/day — one secured shoot covers years.' },
    midCtas: {
      afterProblems: { text: 'Stay behind the lens, not in your DMs.', ctaText: 'Get My Booking Link' },
      afterHow: { text: 'Your next client is ready to book a shoot. Make it one click.', ctaText: 'Set Up My Page Free' },
    },
    faq: [
      { q: 'What is the best booking software for photographers in India?', a: 'Meeticulous is built for Indian photographers — clients book shoots online, pay a deposit upfront via UPI or card, and get automatic reminders. It syncs with your calendar, handles GST invoicing and charges 0% commission on paid plans.' },
      { q: 'Can I collect a shoot deposit when a client books?', a: 'Yes. You can collect a deposit or the full fee at checkout through Razorpay (UPI, cards, netbanking) before the shoot, with a GST invoice generated automatically.' },
      { q: 'Does it stop double-booking dates?', a: 'Yes. Each date and slot locks the moment it’s booked, and Google Calendar busy-time blocking keeps your real availability accurate — so you never double-book a shoot.' },
      { q: 'How does it reduce cancellations and no-shows?', a: 'Requiring a deposit filters out flaky enquiries, and automatic reminders before every shoot keep confirmed clients showing up.' },
      { q: 'Do clients need an app to book?', a: 'No. Clients open your link, pick a date and pay — no app or account needed. It works straight from your Instagram bio or website.' },
      { q: 'Is it suitable for wedding, portrait and event photographers?', a: 'Yes. Wedding, portrait, product, event and pre-wedding photographers, plus videographers and studios, can all use Meeticulous for shoot bookings and payments.' },
    ],
    finalCta: { icon: Camera, urgency: 'Every unbooked date is a shoot that went to another photographer.', headline: 'More shooting. Less scheduling.', subline: 'Set up your photography booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.', ctaText: 'Create My Booking Page' },
    headings: {
      problems: { eyebrow: 'The daily friction', title: 'Making great images is the job.', titleAccent: 'The booking shouldn’t be.' },
      features: { eyebrow: 'What you get', title: 'Appointment booking software that works like your', titleAccent: 'own studio manager.' },
      testimonials: { title: 'Built for how shoots really get booked.', subtitle: 'Photographers and studios — dates booked and secured, without the back-and-forth.' },
    },
    madeFor: "India's Photographers",
    testimonials: [
      { quote: 'Deposits at booking ended last-minute cancellations. Clients who book now actually show up with the date locked.', name: 'Kabir Malhotra', role: 'Wedding Photographer', avatar: null },
      { quote: 'My whole booking used to live in Instagram DMs. One link took over and I finally stopped losing track of dates.', name: 'Sara D’Souza', role: 'Portrait Photographer', avatar: null },
      { quote: 'Clients pay the advance online before the shoot now. It looks far more professional than sending a GPay number.', name: 'Nikhil Verma', role: 'Studio Owner', avatar: null },
    ],
  },

  events: {
    slug: 'events',
    label: 'Event Organisers',
    icon: Calendar,
    theme: {
      primary: '#3b0764', accent: '#a855f7', accentCta: '#7e22ce',
      tint: '#faf5ff', heroFrom: '#3b0764', heroTo: '#581c87',
    },
    seo: {
      title: 'Appointment Booking Software for Event Organisers | Meeticulous',
      description:
        'Let clients book consultations and secure dates online. Meeticulous is booking software for event planners & organisers — advances collected upfront, calendar synced, automatic reminders, GST invoices. From ₹10/day.',
      keywords:
        'booking software for event planners, event consultation booking, event organiser scheduling, book event planner online India, secure event date deposit, wedding planner booking system',
      ogTitle: 'Still locking event dates over phone calls? Fix it for ₹10/day.',
      ogDescription:
        'Clients book a consultation, pay an advance to hold the date, and get reminded — automatically. The booking page every event planner in India should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-events-og-1200x630.jpg',
    },
    hero: {
      eyebrow: 'For Event Planners, Organisers & Decorators',
      headline: 'Appointment booking software',
      headlineAccent: 'for event organisers',
      headlineTail: '— consultations booked and dates held before the first meeting.',
      subline:
        'You create the celebration. Meeticulous handles everything around it — clients book a consultation, pay an advance to hold the date, and get reminded — so you plan events, not your calendar.',
      ctaText: 'Set Up My Booking Page',
      microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
      mock: {
        practice: 'Celebrations by Neha',
        practiceTag: 'Wedding & Event Planner',
        services: [
          { name: 'Planning Consultation', meta: '45 min · Online', price: '₹1,500' },
          { name: 'Date Hold Advance', meta: 'Secures your date', price: '₹10,000' },
        ],
      },
    },
    socialProof: 'Trusted by wedding planners, event organisers and decorators across India.',
    trust: [
      { icon: Lock, label: 'Razorpay-secured payments' },
      { icon: FileCheck, label: 'Automatic GST invoices' },
      { icon: ShieldCheck, label: 'Client data encrypted & private' },
      { icon: BadgePercent, label: '0% commission on paid plans' },
    ],
    stats: [
      { icon: CalendarClock, value: '24/7', label: 'Consultations booked, any hour' },
      { icon: BadgePercent, value: '0%', label: 'Commission — you keep every rupee' },
      { icon: IndianRupee, value: '~₹10', label: 'A day for the top, unlimited plan' },
      { icon: CalendarCheck, value: '< 5 min', label: 'To go live with your page' },
    ],
    painPoints: [
      { icon: PhoneCall, problem: 'Endless calls just to lock a consultation time', solution: 'One link. Clients pick a slot themselves — you stop playing phone tag over dates.' },
      { icon: IndianRupee, problem: 'Dates held on a promise, then lost to no advance', solution: 'Collect an advance online to hold the date — only committed clients block your calendar.' },
      { icon: CalendarX2, problem: 'Two clients chasing the same peak-season date', solution: 'Dates lock the moment an advance is paid — no accidental double-bookings.' },
      { icon: MessageSquareX, problem: 'Enquiries scattered across calls, DMs and email', solution: 'Every enquiry becomes a booked consultation from one link — nothing slips through.' },
      { icon: UserX, problem: 'No-shows for planning meetings you prepped for', solution: 'Reminders plus a paid consultation mean serious clients actually turn up.' },
      { icon: Clock3, problem: 'Late-night enquiries lost before you reply', solution: 'Your page books 24/7 — a couple reserves a consultation at midnight, you see it at breakfast.' },
    ],
    features: [
      { icon: CalendarCheck, title: 'Bookings around the clock', desc: 'Your booking page is live 24/7. Clients book consultations while you’re running an event.' },
      { icon: Wallet, title: 'Advances paid upfront', desc: 'Collect consultation fees or a date-hold advance via UPI, card or netbanking. GST invoice automatic.' },
      { icon: ShieldCheck, title: 'Client details stay private', desc: 'Encrypted, access-controlled and never sold. Your client list and events belong to you alone.' },
      { icon: BellRing, title: 'Reminders that cut no-shows', desc: 'Email + WhatsApp reminders send themselves before every meeting — you never chase a client.' },
    ],
    pricing: { hook: 'Less than a cup of chai a day.', line: 'Start free. Go unlimited and 0% commission from about ₹10/day — one held date covers years.' },
    midCtas: {
      afterProblems: { text: 'Plan events, not your calendar.', ctaText: 'Get My Booking Link' },
      afterHow: { text: 'Your next client is ready to book a consultation. Make it one click.', ctaText: 'Set Up My Page Free' },
    },
    faq: [
      { q: 'What is the best booking software for event planners in India?', a: 'Meeticulous is built for Indian event planners — clients book consultations online, pay an advance to hold a date via UPI or card, and get automatic reminders. It syncs with your calendar, handles GST invoicing and charges 0% commission on paid plans.' },
      { q: 'Can clients pay an advance to hold their date?', a: 'Yes. You can collect a consultation fee or a date-hold advance at checkout through Razorpay (UPI, cards, netbanking), with a GST invoice generated automatically — so only committed clients block your calendar.' },
      { q: 'Does it prevent double-booking peak dates?', a: 'Yes. A date locks the moment its advance is paid, and Google Calendar busy-time blocking keeps availability accurate — so two clients can never hold the same date.' },
      { q: 'How does it reduce no-shows for planning meetings?', a: 'Automatic email and WhatsApp reminders go out before every consultation, and paid consultations mean serious clients actually attend.' },
      { q: 'How much does it cost?', a: 'You can start free with a 5% per-booking fee. Paid plans begin at roughly ₹3 a day (billed yearly) and remove all commission, so you keep 100% of every fee.' },
      { q: 'Is it suitable for wedding planners and decorators?', a: 'Yes. Wedding and event planners, decorators, caterers and venue managers can all use Meeticulous for consultation bookings, date holds and payments from one link.' },
    ],
    finalCta: { icon: Sparkles, urgency: 'Every un-held date is an event that went to another planner.', headline: 'More celebrations. Less coordination.', subline: 'Set up your event booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.', ctaText: 'Create My Booking Page' },
    headings: {
      problems: { eyebrow: 'The daily friction', title: 'Creating memorable events is the job.', titleAccent: 'Event scheduling shouldn’t be.' },
      features: { eyebrow: 'What you get', title: 'Appointment booking software that works like your', titleAccent: 'own event coordinator.' },
      testimonials: { title: 'Built for how events really come together.', subtitle: 'Planners and organisers — consultations booked and dates held, without the chaos.' },
    },
    madeFor: "India's Event Planners",
    testimonials: [
      { quote: 'Date-hold advances online changed my business. Clients commit with a payment instead of a maybe, and I stopped losing peak dates.', name: 'Neha Kapoor', role: 'Wedding Planner', avatar: null },
      { quote: 'Consultations used to be endless calls to find a time. Now clients just book a slot and pay — my week runs itself.', name: 'Suresh Pillai', role: 'Event Organiser', avatar: null },
      { quote: 'Every enquiry now turns into a booked, paid consultation from one link. Nothing slips through the cracks anymore.', name: 'Anjali Rao', role: 'Event Decorator', avatar: null },
    ],
  },

  agencies: {
    slug: 'agencies',
    label: 'Agencies & Studios',
    icon: Building2,
    theme: {
      primary: '#083344', accent: '#06b6d4', accentCta: '#0e7490',
      tint: '#ecfeff', heroFrom: '#083344', heroTo: '#164e63',
    },
    seo: {
      title: 'Appointment Booking Software for Agencies & Studios | Meeticulous',
      description:
        'Let clients book discovery calls with your team online. Meeticulous is booking software for agencies & studios — calls routed, fees collected upfront, calendar synced, GST invoices. From ₹10/day.',
      keywords:
        'booking software for agencies, discovery call scheduling, agency client booking, studio booking system India, book agency consultation, team scheduling software, creative studio booking',
      ogTitle: 'Still scheduling discovery calls over email chains? Fix it for ₹10/day.',
      ogDescription:
        'Clients book a call with the right person on your team, pay upfront, and get reminded — automatically. The booking page every agency and studio should already have.',
      ogImage: 'https://company-assets.meeticulous.in/images/seo/for-agencies-og-1200x630.jpg',
    },
    hero: {
      eyebrow: 'For Agencies, Studios & Creative Teams',
      headline: 'Appointment booking software',
      headlineAccent: 'for agencies & studios',
      headlineTail: '— discovery calls booked and routed before the email thread starts.',
      subline:
        'Your team does the work. Meeticulous handles everything around it — clients pick a slot with the right person, pay if you charge, and get reminded — so your team pitches, not schedules.',
      ctaText: 'Set Up My Booking Page',
      microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
      mock: {
        practice: 'Northlight Studio',
        practiceTag: 'Design & Brand Agency',
        services: [
          { name: 'Discovery Call', meta: '30 min · Online', price: 'Free' },
          { name: 'Paid Strategy Session', meta: '60 min · Online', price: '₹5,000' },
        ],
      },
    },
    socialProof: 'Trusted by design, marketing and creative studios across India.',
    trust: [
      { icon: Lock, label: 'Razorpay-secured payments' },
      { icon: FileCheck, label: 'Automatic GST invoices' },
      { icon: ShieldCheck, label: 'Client data encrypted & private' },
      { icon: BadgePercent, label: '0% commission on paid plans' },
    ],
    stats: [
      { icon: CalendarClock, value: '24/7', label: 'Discovery calls booked, any time zone' },
      { icon: Users, value: 'Whole', label: 'Team on one shared calendar' },
      { icon: IndianRupee, value: '~₹10', label: 'A day for the top, unlimited plan' },
      { icon: CalendarCheck, value: '< 5 min', label: 'To go live with your page' },
    ],
    painPoints: [
      { icon: MessageSquareX, problem: 'Discovery calls scheduled across long email chains', solution: 'One link. Prospects pick a slot themselves — no “does Thursday work for your team?”' },
      { icon: Users, problem: 'Juggling one calendar across the whole team', solution: 'Route each call to the right person; every team member’s real availability, one page.' },
      { icon: Target, problem: 'Unqualified leads eating your team’s time', solution: 'Intake questions and paid strategy slots filter tyre-kickers before they reach the calendar.' },
      { icon: IndianRupee, problem: 'Paid workshops and audits invoiced after the fact', solution: 'Charge for paid sessions upfront — money’s in before the call, with a GST invoice.' },
      { icon: UserX, problem: 'Prospects no-showing booked pitch calls', solution: 'Automatic reminders before every call keep your pipeline meetings actually happening.' },
      { icon: Clock3, problem: 'Overseas leads lost to slow scheduling', solution: 'Your page books 24/7 in the client’s time zone — a lead reserves while your team sleeps.' },
    ],
    features: [
      { icon: CalendarCheck, title: 'Bookings around the clock', desc: 'Your booking page is live 24/7. Prospects reserve calls while your team is deep in delivery.' },
      { icon: Wallet, title: 'Paid sessions upfront', desc: 'Charge for strategy sessions, audits or workshops via UPI, card or netbanking. GST invoice automatic.' },
      { icon: ShieldCheck, title: 'Client details stay private', desc: 'Encrypted, access-controlled and never sold. Your pipeline and client list belong to you alone.' },
      { icon: BellRing, title: 'Reminders that cut no-shows', desc: 'Email + WhatsApp reminders send themselves before every call — no one on the team chases leads.' },
    ],
    pricing: { hook: 'Less than a cup of chai a day.', line: 'Start free. Go unlimited and 0% commission from about ₹10/day — one closed lead covers years.' },
    midCtas: {
      afterProblems: { text: 'Let your team pitch, not schedule.', ctaText: 'Get My Booking Link' },
      afterHow: { text: 'Your next lead is ready to book a call. Make it one click.', ctaText: 'Set Up My Page Free' },
    },
    faq: [
      { q: 'What is the best booking software for agencies and studios in India?', a: 'Meeticulous is built for Indian agencies and studios — prospects book discovery calls with the right team member online, pay for paid sessions upfront via UPI or card, and get automatic reminders. It syncs each person’s calendar, handles GST invoicing and charges 0% commission on paid plans.' },
      { q: 'Can I route calls to different team members?', a: 'Yes. Each team member can have their own services and availability, so prospects book the right person and slots never clash across the team.' },
      { q: 'Can I charge for paid strategy sessions or audits?', a: 'Yes. You can offer free discovery calls and paid sessions side by side, collecting fees at checkout through Razorpay with a GST invoice generated automatically.' },
      { q: 'Can I filter out unqualified leads?', a: 'Yes. Intake questions and paid strategy slots filter out tyre-kickers before they ever reach your team’s calendar.' },
      { q: 'How much does it cost?', a: 'You can start free with a 5% per-booking fee. Paid plans begin at roughly ₹3 a day (billed yearly) and remove all commission, so you keep 100% of every fee.' },
      { q: 'Is it suitable for design, marketing and dev studios?', a: 'Yes. Design, branding, marketing, development and creative studios of any size can use Meeticulous to route discovery calls and collect payments from one shared link.' },
    ],
    finalCta: { icon: TrendingUp, urgency: 'Every slow reply is a lead that booked a competitor.', headline: 'More pitches. Less scheduling.', subline: 'Set up your agency booking page in minutes. Free to start, no card required — cancel anytime, no lock-in.', ctaText: 'Create My Booking Page' },
    headings: {
      problems: { eyebrow: 'The daily friction', title: 'Winning great clients is the job.', titleAccent: 'Client scheduling shouldn’t be.' },
      features: { eyebrow: 'What you get', title: 'Appointment booking software that works like your', titleAccent: 'own client-services lead.' },
      testimonials: { title: 'Built for how agencies really run.', subtitle: 'Studios and teams — discovery calls booked and routed, without the admin.' },
    },
    madeFor: "India's Agencies & Studios",
    testimonials: [
      { quote: 'Discovery calls used to bounce around email for days. One link routes each lead to the right person and books instantly.', name: 'Aditya Rao', role: 'Agency Founder', avatar: null },
      { quote: 'Charging for strategy sessions upfront filtered out tyre-kickers overnight. My team only meets serious prospects now.', name: 'Tara Menon', role: 'Studio Director', avatar: null },
      { quote: 'The whole team shares one booking page. No more clashing calendars or double-booked pitch calls.', name: 'Rohan Gupta', role: 'Creative Lead', avatar: null },
    ],
  },
};

// therapists + yoga-instructors — served by the /for/:profession catch-all.
// Stats and copy use product facts only (no usage numbers); testimonials come
// from the consented pool via testimonialRoles.
PROFESSION_LANDING.therapists = {
  slug: 'therapists',
  label: 'Therapists & Counsellors',
  icon: HeartPulse,

  // ── Theme: calm: deep sky base + clear sky blue ─────────────────────────
  theme: {
    primary: '#082f49',    // sky-950: ink / headings
    accent: '#0ea5e9',     // sky-500: signature colour
    accentCta: '#0369a1',  // sky-700, AA-safe for white-text buttons (5.9:1)
    tint: '#f0f9ff',       // sky-50 wash
    heroFrom: '#082f49',   // sky-950
    heroTo: '#0c4a6e',     // sky-900
  },

  seo: {
    title: 'Booking & Payments for Therapists in India | Meeticulous',
    description:
      'Booking and payments for therapists and counsellors in India. Clients book private sessions, pay upfront by UPI, and get reminders and a Meet link. Start free.',
    keywords:
      'booking software for therapists India, therapist booking and payments, counsellor appointment booking, psychologist online booking India, therapy session payment UPI, online counselling booking page, reduce therapy no-shows',
    ogTitle: 'Still booking therapy sessions over WhatsApp? Fix it for ₹10/day.',
    ogDescription:
      'Clients book a private session, pay upfront and get reminded, automatically. The booking page every therapist and counsellor in India should already have.',
  },

  hero: {
    eyebrow: 'For Psychologists, Counsellors & Therapists',
    headline: 'Your sessions,',
    headlineAccent: 'booked and paid',
    headlineTail: 'before the session begins.',
    subline:
      'You hold the space. Meeticulous handles everything around it: clients pick a private slot, pay upfront by UPI, and get a reminder with the Meet link, so your hours go to clients and the scheduling runs itself.',
    ctaText: 'Set Up My Booking Page',
    microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
    mock: {
      practice: 'Kavya’s Counselling Practice',
      practiceTag: 'Counselling Psychologist · Online & In-person',
      services: [
        { name: 'First Session', meta: '60 min · Google Meet', price: '₹1,500' },
        { name: 'Follow-up Session', meta: '50 min · Online', price: '₹1,200' },
      ],
    },
  },

  socialProof: 'Built for psychologists, counsellors and therapists across India.',

  trust: [
    { icon: Lock, label: 'Razorpay-secured payments' },
    { icon: FileCheck, label: 'Automatic GST invoices' },
    { icon: ShieldCheck, label: 'Client data encrypted & private' },
    { icon: BadgePercent, label: '0% commission on Pro' },
  ],

  // Product facts only: no usage numbers.
  stats: [
    { icon: CalendarClock, value: '24/7', label: 'Clients book a private slot, any hour' },
    { icon: BellRing, value: '24h', label: 'Reminder before every session' },
    { icon: BadgePercent, value: '0%', label: 'Commission on Pro' },
    { icon: IndianRupee, value: '₹0', label: 'To start on the free Starter plan' },
  ],

  painPoints: [
    {
      icon: MessageSquareX,
      problem: 'Fixing session times over long WhatsApp threads',
      solution: 'One link. Clients pick a free slot themselves, so your personal number stops being a scheduling line.',
    },
    {
      icon: IndianRupee,
      problem: 'Awkward fee conversations at the end of a session',
      solution: 'Clients pay upfront by UPI, card or netbanking when they book. The session ends on the work, with nothing left to ask for.',
    },
    {
      icon: UserX,
      problem: 'Late cancellations and no-shows on weekly slots',
      solution: 'Prepaid sessions, automatic reminders and your cancellation terms shown before payment help keep weekly slots filled.',
    },
    {
      icon: ClipboardList,
      problem: 'Repeating intake questions in the first session',
      solution: 'Add intake fields to your booking form on Pro and read the answers before you meet.',
    },
    {
      icon: Lock,
      problem: 'Worrying about where client details live',
      solution: 'Client details are encrypted, access-controlled and never sold. Your client list and notes are visible only to you.',
    },
    {
      icon: Laptop,
      problem: 'Sending video links by hand before every session',
      solution: 'Each online booking gets its own Google Meet link, sent with the confirmation and the reminder.',
    },
  ],

  features: [
    {
      icon: CalendarCheck,
      title: 'Weekly slots, easy to rebook',
      desc: 'Set your weekly hours and blocked dates once. Clients rebook their usual slot from your link, and Pro sends follow-ups that invite them back.',
    },
    {
      icon: Wallet,
      title: 'Sessions paid upfront',
      desc: 'Clients pay by UPI, card or netbanking at booking. The booking confirms on payment and a GST invoice is generated automatically.',
    },
    {
      icon: ShieldCheck,
      title: 'Confidential by default',
      desc: 'Encrypted, access-controlled and never sold. Your client list, private notes and session history belong to you alone.',
    },
    {
      icon: BellRing,
      title: 'Reminders and Meet links, sent for you',
      desc: 'Email and WhatsApp reminders go out 24 hours before each session, plus 1 hour before on Pro. Online sessions get a Google Meet link automatically.',
    },
  ],

  pricing: {
    hook: 'Less than a cup of chai a day.',
    line: 'Start free on Starter with 5% per paid booking. Pro is ₹235/month or ₹1,179/year, GST included, with 0% commission.',
  },

  midCtas: {
    afterProblems: {
      text: 'Give your hours to clients. Let one link handle the scheduling.',
      ctaText: 'Get My Booking Link',
    },
    afterHow: {
      text: 'Your next client is ready to book a session. Make it one tap.',
      ctaText: 'Set Up My Page Free',
    },
  },

  faq: [
    {
      q: 'What is the best booking and payment software for therapists in India?',
      a: 'Meeticulous is built for Indian therapists, psychologists and counsellors. Clients book a private session from your link, pay upfront by UPI, card or netbanking, and get automatic reminders and a Google Meet link for online sessions. It generates GST invoices and charges 0% commission on Pro.',
    },
    {
      q: 'Can clients pay for therapy sessions in advance?',
      a: 'Yes. Your fee is shown on each service and collected at checkout through Razorpay by UPI, card or netbanking. The booking confirms automatically once the payment goes through, and a GST invoice is generated.',
    },
    {
      q: 'Can I run weekly recurring sessions?',
      a: 'You set your weekly hours once, and clients rebook their usual slot from your link after each session, paying for each one upfront. Meeticulous does not create an automatic repeating series or charge clients on a subscription. On Pro, follow-up messages invite clients to book their next session.',
    },
    {
      q: 'Can I collect intake information before the first session?',
      a: 'Yes. On Pro you can add custom intake fields to your booking form, so you read the client’s answers before you meet. Pro also keeps a client record with private notes and booking history.',
    },
    {
      q: 'How are client details kept confidential?',
      a: 'Client details are encrypted, access-controlled and never sold, and only you can see your client list and notes. If clients share a phone with family, use a neutral service name such as “Session”, since the service name can appear in confirmations and reminders.',
    },
    {
      q: 'Can I set a cancellation policy?',
      a: 'Yes. Write your cancellation and rescheduling terms in each service description so clients see them before they pay. Clients can reschedule from their booking, and if you cancel a session the client is refunded in full, including the booking fee.',
    },
    {
      q: 'How much does it cost?',
      a: 'You can start free on the Starter plan, which charges 5% per paid booking. Pro costs ₹235 a month or ₹1,179 a year, GST included, with 0% commission. Clients pay a ₹10 booking fee plus GST on it at checkout, and the payment gateway’s charge applies on both plans.',
    },
  ],

  finalCta: {
    icon: HeartPulse,
    urgency: 'Every unanswered enquiry is a client who may look elsewhere.',
    headline: 'More sessions. Less admin.',
    subline: 'Set up your therapy booking page in minutes. Free to start, no card required, cancel anytime.',
    ctaText: 'Create My Booking Page',
  },

  headings: {
    problems: { eyebrow: 'The daily friction', title: 'Holding space for clients is the job.', titleAccent: 'The scheduling shouldn’t be.' },
    features: { eyebrow: 'What you get', title: 'A booking page that works like your', titleAccent: 'own quiet front desk.' },
    testimonials: { title: 'Built for how independent practices run.', subtitle: 'Hosts across professions use Meeticulous to get booked and paid without the admin.' },
  },

  madeFor: "India's Therapists & Counsellors",

  // No profession-specific quotes: real shared testimonials, nearest role first.
  testimonialRoles: ['Physiotherapist'],
};

PROFESSION_LANDING['yoga-instructors'] = {
  slug: 'yoga-instructors',
  label: 'Yoga Instructors',
  icon: Sparkles,

  // ── Theme: grounded: deep forest base + fresh lime ──────────────────────
  theme: {
    primary: '#1a2e05',    // lime-950: ink / headings
    accent: '#84cc16',     // lime-500: signature colour
    accentCta: '#4d7c0f',  // lime-700, AA-safe for white-text buttons (5.0:1)
    tint: '#f7fee7',       // lime-50 wash
    heroFrom: '#1a2e05',   // lime-950
    heroTo: '#365314',     // lime-900
  },

  seo: {
    title: 'Yoga Class Booking for Instructors | Meeticulous',
    description:
      'Yoga class booking for instructors in India. Students book trial and private classes, pay upfront by UPI, and get WhatsApp reminders and Meet links. Start free.',
    keywords:
      'yoga class booking for instructors, yoga class booking India, online yoga class booking, yoga trial class booking, collect yoga fees UPI, yoga teacher scheduling software, private yoga session booking',
    ogTitle: 'Still collecting yoga fees on WhatsApp? Fix it for ₹10/day.',
    ogDescription:
      'Students book a class, pay upfront by UPI and get reminded, automatically. The booking page every yoga instructor in India should already have.',
  },

  hero: {
    eyebrow: 'For Yoga Instructors & Teachers',
    headline: 'Your classes,',
    headlineAccent: 'booked and paid',
    headlineTail: 'before the first sun salutation.',
    subline:
      'You teach the practice. Meeticulous handles everything around it: students book a trial or private class, pay upfront by UPI, and get a reminder with the Meet link, so your mornings stay on the mat.',
    ctaText: 'Set Up My Booking Page',
    microcopy: 'Free to start · No card needed · No lock-in · Live in minutes',
    mock: {
      practice: 'Sunrise Yoga with Neha',
      practiceTag: 'Yoga Instructor · Hatha & Vinyasa',
      services: [
        { name: 'Trial Class', meta: '45 min · Google Meet', price: 'Free' },
        { name: 'Private Yoga Session', meta: '60 min · In-person', price: '₹800' },
      ],
    },
  },

  socialProof: 'Built for yoga instructors and teachers across India.',

  trust: [
    { icon: Lock, label: 'Razorpay-secured payments' },
    { icon: FileCheck, label: 'Automatic GST invoices' },
    { icon: ShieldCheck, label: 'Student data encrypted & private' },
    { icon: BadgePercent, label: '0% commission on Pro' },
  ],

  // Product facts only: no usage numbers.
  stats: [
    { icon: CalendarClock, value: '24/7', label: 'Trial and private classes booked, any hour' },
    { icon: BellRing, value: '24h', label: 'Reminder before every class' },
    { icon: BadgePercent, value: '0%', label: 'Commission on Pro' },
    { icon: IndianRupee, value: '₹0', label: 'To start on the free Starter plan' },
  ],

  painPoints: [
    {
      icon: MessageSquareX,
      problem: 'Answering “what are your timings?” on WhatsApp all day',
      solution: 'One link shows your open slots. Students pick a time and book without the back-and-forth.',
    },
    {
      icon: IndianRupee,
      problem: 'Chasing fees and UPI screenshots every month',
      solution: 'Students pay by UPI, card or netbanking when they book, and each payment comes with a GST invoice. Nothing is left to chase.',
    },
    {
      icon: UserX,
      problem: 'Trial students who book and never turn up',
      solution: 'Trials are booked with a verified phone number, and a reminder goes out 24 hours before class.',
    },
    {
      icon: Laptop,
      problem: 'Sending Meet links to every student before class',
      solution: 'Every online booking gets its own Google Meet link, sent with the confirmation and the reminder.',
    },
    {
      icon: CalendarX2,
      problem: 'Private sessions clashing with your own practice and family time',
      solution: 'Set weekly hours, block dates and sync Google Calendar, so students only see times you are free.',
    },
    {
      icon: Clock3,
      problem: 'Late-night enquiries lost by morning',
      solution: 'Your page takes bookings 24/7. A student signs up at night, and you see it before your first class.',
    },
  ],

  features: [
    {
      icon: CalendarCheck,
      title: 'Trial and private classes, one link',
      desc: 'Offer a free trial alongside paid private and online sessions. Students book from your Instagram bio, WhatsApp or website.',
    },
    {
      icon: Wallet,
      title: 'Fees paid upfront by UPI',
      desc: 'Collect each class fee at booking via UPI, card or netbanking. A GST invoice is generated automatically.',
    },
    {
      icon: BellRing,
      title: 'Reminders and Meet links',
      desc: 'Email and WhatsApp reminders 24 hours before class, plus 1 hour before on Pro. Online classes get a Google Meet link automatically.',
    },
    {
      icon: Users,
      title: 'Know your regulars',
      desc: 'On Pro, your client list keeps each student’s booking history and notes, and shows who has not booked in a while.',
    },
  ],

  pricing: {
    hook: 'Less than a cup of chai a day.',
    line: 'Start free on Starter with 5% per paid booking. Pro is ₹235/month or ₹1,179/year, GST included, with 0% commission.',
  },

  midCtas: {
    afterProblems: {
      text: 'Spend your time teaching. Let one link handle bookings and fees.',
      ctaText: 'Get My Booking Link',
    },
    afterHow: {
      text: 'Your next student is ready to book a class. Make it one tap.',
      ctaText: 'Set Up My Page Free',
    },
  },

  faq: [
    {
      q: 'What is the best yoga class booking software for instructors in India?',
      a: 'Meeticulous is built for Indian yoga instructors. Students book trial and private classes from your link, pay upfront by UPI, card or netbanking, and get automatic reminders and a Google Meet link for online classes. It generates GST invoices and charges 0% commission on Pro.',
    },
    {
      q: 'Can I offer a free trial class?',
      a: 'Yes. You can list a free (₹0) trial class next to your paid sessions. The free Starter plan includes up to 2 free services, and a free booking carries no booking fee or commission.',
    },
    {
      q: 'Can students pay monthly batch fees by UPI?',
      a: 'Every booking on Meeticulous is paid upfront by UPI, card or netbanking, with a GST invoice. Each slot takes one booking, and there is no automatic monthly billing, so group batches with shared seats are not supported today. It works best for trial classes, private sessions and 1:1 online classes, where each student books their own slot.',
    },
    {
      q: 'Can I teach online with Google Meet?',
      a: 'Yes. Connect Google Calendar and every online booking gets its own Google Meet link, added to your calendar and sent to the student. In-person classes show your location instead.',
    },
    {
      q: 'Do students get WhatsApp reminders?',
      a: 'Yes. Reminders go to you and the student 24 hours before class on every plan, and Pro adds a reminder 1 hour before. On the free plan, WhatsApp reminders run for the first 60 days after signup and then continue by email.',
    },
    {
      q: 'How much does it cost?',
      a: 'You can start free on the Starter plan, which charges 5% per paid booking. Pro costs ₹235 a month or ₹1,179 a year, GST included, with 0% commission. Students pay a ₹10 booking fee plus GST on it at checkout for paid classes, and the payment gateway’s charge applies on both plans.',
    },
  ],

  finalCta: {
    icon: Sparkles,
    urgency: 'Every unanswered enquiry is a student who may join another class.',
    headline: 'More practice. Less admin.',
    subline: 'Set up your yoga booking page in minutes. Free to start, no card required, cancel anytime.',
    ctaText: 'Create My Booking Page',
  },

  headings: {
    problems: { eyebrow: 'The daily friction', title: 'Teaching a good class is the job.', titleAccent: 'Fee follow-ups shouldn’t be.' },
    features: { eyebrow: 'What you get', title: 'A booking page that works like your', titleAccent: 'own studio desk.' },
    testimonials: { title: 'Built for how independent teachers work.', subtitle: 'Hosts across professions use Meeticulous to get booked and paid without the admin.' },
  },

  madeFor: "India's Yoga Instructors",

  // No profession-specific quotes: real shared testimonials, nearest role first.
  testimonialRoles: ['Physiotherapist'],
};

export const getProfessionLanding = (slug) =>
  (slug && PROFESSION_LANDING[slug.toLowerCase()]) || null;

export default PROFESSION_LANDING;
