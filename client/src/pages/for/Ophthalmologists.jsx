// /for/ophthalmologists — bespoke, conversion-focused landing page for
// ophthalmologists & eye clinics in India.
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx, prerender.mjs,
// sitemapService.js, Navbar "Who it's for" menu. (The main thread wires those.)
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in a
// deep-blue OPTICS system (--ca-primary sky-900 + --ca-accent amber, eye-chart
// theme) — distinct from every sibling. Mechanics unique to this page:
//   HERO         · concentric-RING "lens / focus" motif behind a round ImgSlot
//   SERVICES     · "focus grid" cards that sharpen on hover (border+shadow, NO
//                  transform) with an amber corner tick
//   STEPS        · 4 ring-badge cards joined by a dotted connector line
//   INTEGRATIONS · real-tools logo grid inside one soft panel
//   IMPACT       · a Snellen eye-chart descending TYPE SCALE (metrics big→small,
//                  amber row rules)
//   TESTIMONIALS · two-column "index card" rows — slim meta column | hairline |
//                  quote (NOT a slider / masonry / chat-bubble)
//   COMPARISON   · two cards, manual (muted, X) vs Meeticulous (accent, check)
//   PRICING      · Free + Premium two cards, monthly/yearly toggle
//   ABOUT        · split text + ImgSlot with trust facts
//   FINAL CTA    · deep-blue panel with an amber mix-blend focus-ring glow
// Only nav/hero-shell/footer (shared shell) may resemble sibling pages.
//
// IMAGES: intentional EMPTY ImgSlot placeholders with descriptive aria-label.
//
// HONESTY (medical): scheduling + payment tool, not a medical-records or advice
// product. No treatment/outcome claims; testimonials are labelled placeholders
// from clinic STAFF about ADMIN relief (no-shows, front-desk load, billing) —
// never patients about treatment; trust facts emphasise payment security + India
// data residency + DPDP; JSON-LD has NO aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// accordion + billing toggle, AA-contrast palette (primary is dark → white text
// on it, dark text on amber), visible focus, NO hover uplift, Reveal guards motion.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star,
  Eye, Glasses, Focus, Activity, ScanLine, Video,
  CalendarCheck, Wallet, BellRing,
  Lock, Landmark, ShieldCheck, BadgePercent,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import useLenis from '../../hooks/useLenis';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import {
  FREE_PLAN, PREMIUM_PLAN,
  PREMIUM_ANNUAL_SAVE_PCT,
} from '../../data/plans';
import ToolLogo from './toolLogos';
import razorpayLogo from '../enterprise-v2/assets/logo/razorpay.png';
import OperatorCredit from '../../components/common/OperatorCredit';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';      // real host signup funnel
const LOGIN = '/login-as-vendor'; // host login (Google-only door)

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const NAV = [
  { label: 'Services', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const MASCOT = '/for/ophthalmologists/hero.webp';
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian clinics'];

// Focus-grid services.
const SERVICES = [
  { icon: Eye, label: 'Comprehensive Eye Exam', desc: 'Full eye check-ups and vision assessments.' },
  { icon: Glasses, label: 'Vision & Refraction Test', desc: 'Refraction, spectacles and lens prescriptions.' },
  { icon: Focus, label: 'Cataract Consultation', desc: 'Pre- and post-operative cataract care.' },
  { icon: Activity, label: 'Glaucoma & Retina Care', desc: 'Glaucoma, retina and diabetic-eye reviews.' },
  { icon: ScanLine, label: 'LASIK Consultation', desc: 'Laser vision-correction consultations.' },
  { icon: Video, label: 'Online Eye Consultation', desc: 'Video consults for quick follow-ups.' },
];

// Ring-badge steps (4).
const STEPS = [
  { title: 'Book an eye exam', icon: CalendarCheck, desc: 'The patient picks a service and a time that suits them.' },
  { title: 'Pay upfront', icon: Wallet, desc: 'The consultation fee is collected securely at booking.' },
  { title: 'Get a reminder', icon: BellRing, desc: 'A WhatsApp reminder goes out before the appointment.' },
  { title: 'The consultation', icon: Eye, desc: 'They arrive on time — online or at the clinic.' },
];

// Integration logo grid — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg', sub: 'Auto-add a video link to every online visit' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg', sub: 'Reminders and updates on autopilot' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Secure payments, refunds and GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Accept instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Booking confirmation emails, automatic' },
];

// Snellen-chart impact metrics (rendered big → small).
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night' },
  { v: '0%', l: 'Commission on Pro' },
  { v: '₹0', l: 'To get started' },
  { v: 'GST', l: 'Invoices, automatic' },
];

// Placeholder testimonials — clinic STAFF about admin, never patients about treatment.
const TESTIMONIALS = [
  { quote: 'Our reception was overwhelmed with calls for eye exams. Patients now book on our link and it is confirmed — the desk is calm, and our no-shows have dropped noticeably.', name: 'Dr. Vikram Shah', role: 'Ophthalmologist', company: 'Clear Vision Eye Clinic, Ahmedabad' },
  { quote: 'Automatic reminders cut our missed appointments sharply. Fewer empty slots across the week.', name: 'Priya Menon', role: 'Clinic Manager', company: 'InSight Eye Care, Bengaluru' },
  { quote: 'Collecting the consultation fee upfront, with a GST invoice each time, cleaned up our billing.', name: 'Dr. Anil Rao', role: 'Eye Surgeon', company: 'Netra Eye Hospital, Hyderabad' },
];

// Two-card comparison — matched rows.
const COMPARE = {
  old: {
    label: 'The manual front desk',
    points: [
      'Phone tag to fix every eye exam',
      'No-shows waste clinic chair time',
      'Consultation fees chased at the desk',
      'A paper appointment register',
      'Two patients booked in one slot',
    ],
  },
  now: {
    label: 'With Meeticulous',
    points: [
      'One booking link — patients self-serve 24/7',
      'Automatic WhatsApp reminders cut no-shows',
      'Fees collected upfront over UPI or card',
      'One clean, calendar-synced clinic view',
      'Conflict-free slots — no double bookings',
    ],
  },
};

// Trust facts — verifiable only.
const TRUST_FACTS = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your clinic data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for ophthalmologists and eye clinics?', a: 'Yes. Whether you are a solo ophthalmologist or an eye hospital with a team, Meeticulous manages your services, availability, patient bookings and communication from one place — so your reception runs without constant phone calls. It is a scheduling and payment tool, not a medical-records system.' },
  { q: 'Can patients book eye exams online?', a: 'Yes. A patient opens your booking link, chooses a service such as an eye exam or cataract consultation, picks a convenient time and confirms — no calls or waiting for the desk to reply.' },
  { q: 'Can I offer online eye consultations?', a: 'Yes. Offer online consults with automatic Google Meet links for follow-ups, or mark a service as in-clinic — or both. The patient picks the mode that suits them.' },
  { q: 'Can I collect the consultation fee online?', a: 'Yes. Collect the fee upfront through Razorpay — UPI, cards or netbanking — before the appointment. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I manage multiple doctors and services?', a: 'Yes. Create as many services as you need — eye exam, refraction, cataract, LASIK, retina care — each with its own duration, fee and availability, and manage every appointment from one clinic calendar.' },
  { q: 'Is our clinic and patient information kept private?', a: 'Meeticulous stores appointment and contact details for booking only — it is not a medical-records system. Your production data is hosted in India (Mumbai) and the platform operates under India’s DPDP Act 2023.' },
  { q: 'Do we need any technical setup?', a: 'No. Setup takes minutes and needs no technical skills. You add your services and clinic hours, and your booking page is ready to share — your patients need nothing more than the link.' },
  { q: 'Is there a free plan?', a: 'Yes. The Starter plan is free forever — an online booking page, unlimited services and bookings, UPI payments, 24-hour reminders and GST invoices — with a small 5% per-booking fee. Pro removes that commission entirely and adds WhatsApp automation and growth tools.' },
];

const FOOTER_COLS = [
  { title: 'Product', links: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Integrations', href: '#features' },
    { label: "What's New", to: '/changelog' },
  ] },
  { title: 'For Professionals', links: [
    { label: 'Ophthalmologists & Eye Clinics', to: '/for/ophthalmologists' },
    { label: 'Dermatologists & Skin Clinics', to: '/for/dermatologists' },
    { label: 'General Physicians & Clinics', to: '/for/doctors' },
    { label: 'More professions', to: '/solutions' },
  ] },
  { title: 'Resources', links: [
    { label: 'Blog', to: '/blog' },
    { label: 'Help Centre', to: '/help' },
    { label: 'FAQs', href: '#faq' },
    { label: 'How It Works', href: '#how' },
  ] },
  { title: 'Company', links: [
    { label: 'About', to: '/about' },
    { label: 'Contact', to: '/contact' },
    { label: 'Privacy', to: '/privacy' },
    { label: 'Terms', to: '/terms' },
  ] },
];

/* ─────────────────────────────  PRIMITIVES  ────────────────────────────── */

function NavLink({ item, className, onClick }) {
  if (item.to) return <Link to={item.to} className={className} onClick={onClick}>{item.label}</Link>;
  return <a href={item.href} className={className} onClick={onClick}>{item.label}</a>;
}

function CtaButton({ to, children, variant = 'solid', className = '' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-all hover:no-underline';
  const styles = {
    solid: 'text-white shadow-[0_4px_14px_rgba(12,74,110,0.24)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/25',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

function ImgSlot({ alt, className = '', rounded = 'rounded-[18px]' }) {
  const layout = className
    .replace(/shadow-\[[^\]]*\]/g, '')
    .replace(/shadow-\w+/g, '')
    .replace(/rounded-\[[^\]]*\]/g, '')
    .replace(/\bborder\b(-[^\s]+)?/g, '')
    .replace(/bg-\[[^\]]*\]/g, '');
  const pos = /\b(absolute|fixed)\b/.test(layout) ? '' : 'relative';
  return (
    <div
      {...(alt ? { role: 'img', 'aria-label': alt } : { 'aria-hidden': true })}
      className={`${pos} z-40 flex items-center justify-center ${layout}`}
    >
      <img src={MASCOT} alt={alt || ''} loading="lazy" decoding="async" className="h-full w-full object-contain" />
    </div>
  );
}

function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="overflow-hidden rounded-[12px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'var(--ca-primary)' : 'rgba(11,30,42,0.08)' }}>
        <button
          type="button"
          onClick={() => setOpen(isOpen ? -1 : i)}
          aria-expanded={isOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-[color:var(--ca-ink)]"
        >
          {f.q}
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-transform duration-300" style={{ backgroundColor: 'color-mix(in srgb, var(--ca-primary) 12%, transparent)', color: 'var(--ca-primary)', transform: isOpen ? 'rotate(45deg)' : 'none' }}>
            <Plus size={15} />
          </span>
        </button>
        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="overflow-hidden">
              <p className="px-5 pb-4 text-[14.5px] leading-relaxed text-slate-500">{f.a}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };
  return (
    <div className="grid items-start gap-3 sm:grid-cols-2 sm:gap-4">
      <div className="space-y-3">{FAQ.map((f, i) => (i % 2 === 0 ? renderItem(f, i) : null))}</div>
      <div className="space-y-3">{FAQ.map((f, i) => (i % 2 === 1 ? renderItem(f, i) : null))}</div>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function Ophthalmologists() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/ophthalmologists`;
  const seo = {
    title: 'Appointment Booking Software for Ophthalmologists & Eye Clinics | Meeticulous',
    description: 'Meeticulous is appointment booking software for ophthalmologists and eye clinics in India. Let patients book eye exams and cataract consultations online — fees collected upfront, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'appointment booking software for ophthalmologists, eye clinic scheduling software india, book eye exam online, eye hospital appointment booking, ophthalmology booking page, cataract consultation scheduling',
    ogTitle: 'Your clinic runs on appointments. Let Meeticulous schedule them.',
    ogDescription: 'Patients book eye exams and consultations, pay upfront and get WhatsApp reminders — automatically. A clean booking page for eye clinics in India.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Ophthalmologists & Eye Clinics',
    serviceType: 'Appointment booking software for ophthalmologists and eye clinics',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Deep-blue optics + amber. Legacy --ca-* var names kept (shared classNames).
  const styleVars = {
    '--ca-primary': '#0C4A6E', // sky-900 — text/links/fills, very high contrast on white
    '--ca-accent': '#F59E0B',  // amber-500 — eye-chart accent (rules/ticks/fills, dark text on it)
    '--ca-ink': '#0B1E2A',     // near-black navy text
    '--ca-cream': '#F0F9FF',   // sky-50 section bg
    '--ca-grey': '#F1F5F8',    // light grey section bg
  };

  // Snellen descending sizes — largest row first, smallest last.
  const CHART_SIZES = [
    'clamp(3rem, 10vw, 6rem)',
    'clamp(2.3rem, 7.5vw, 4.4rem)',
    'clamp(1.8rem, 5.5vw, 3.2rem)',
    'clamp(1.4rem, 4vw, 2.3rem)',
  ];

  return (
    <main className="overflow-x-clip bg-white text-[color:var(--ca-ink)]" style={styleVars}>
      <Seo
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor="#0C4A6E"
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · NAV (shared shell) ═══════════════ */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 hover:no-underline" aria-label="Meeticulous — home">
            <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="font-heading text-[15px] font-extrabold tracking-tight text-[color:var(--ca-primary)]">Meeticulous</span>
          </Link>
          <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
            {NAV.map((item) => (
              <NavLink key={item.label} item={item} className="text-sm font-medium text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline" />
            ))}
          </nav>
          <div className="hidden items-center gap-4 lg:flex">
            <Link to={LOGIN} className="text-sm font-semibold text-[color:var(--ca-ink)] hover:text-[color:var(--ca-primary)] hover:no-underline">Login</Link>
            <CtaButton to={START} className="!px-5 !py-2.5">Start Free <ArrowRight size={15} /></CtaButton>
          </div>
          <button type="button" className="lg:hidden" aria-label="Toggle menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-black/5 bg-white lg:hidden">
              <div className="flex flex-col gap-1 px-5 py-4">
                {NAV.map((item) => (
                  <NavLink key={item.label} item={item} onClick={() => setMenuOpen(false)} className="rounded-lg px-2 py-2.5 text-sm font-medium text-[color:var(--ca-ink)] hover:bg-[color:var(--ca-cream)] hover:no-underline" />
                ))}
                <div className="mt-2 flex items-center gap-3 border-t border-black/5 pt-3">
                  <Link to={LOGIN} className="flex-1 rounded-full border-2 border-black/10 py-2.5 text-center text-sm font-semibold text-[color:var(--ca-ink)] hover:no-underline">Login</Link>
                  <CtaButton to={START} className="flex-1">Start Free <ArrowRight size={15} /></CtaButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══════════════ 2 · HERO (concentric-ring lens motif) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-20 h-96 w-96 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(245,158,11,0.22), transparent)' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* LEFT — copy + single h1 */}
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Smart appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>ophthalmologists and eye clinics</span>.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for ophthalmologists — patients book eye exams and consultations in a minute, pay upfront, and get reminders, so your eye clinic runs on time.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Create Your Booking Page <ArrowRight size={16} /></CtaButton>
              <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
                Book A Demo <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
                  <Check size={14} style={{ color: 'var(--ca-primary)' }} /> {t}
                </span>
              ))}
            </Reveal>
          </div>

          {/* RIGHT — concentric-ring "lens / focus" motif behind a round ImgSlot */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-[26rem] lg:mx-0">
            <div className="relative z-30 mx-auto aspect-square w-full">
              <span aria-hidden className="pointer-events-none absolute inset-0 rounded-full border" style={{ borderColor: 'rgba(12,74,110,0.14)' }} />
              <span aria-hidden className="pointer-events-none absolute inset-[8%] rounded-full border" style={{ borderColor: 'rgba(12,74,110,0.22)' }} />
              <span aria-hidden className="pointer-events-none absolute inset-[18%] rounded-full border-2" style={{ borderColor: 'rgba(245,158,11,0.55)' }} />
              {/* focus ticks (N/E/S/W) */}
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-[16%] h-4 w-0.5 -translate-x-1/2" style={{ background: 'var(--ca-accent)' }} />
              <span aria-hidden className="pointer-events-none absolute left-1/2 bottom-[16%] h-4 w-0.5 -translate-x-1/2" style={{ background: 'var(--ca-accent)' }} />
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-[16%] h-0.5 w-4 -translate-y-1/2" style={{ background: 'var(--ca-accent)' }} />
              <span aria-hidden className="pointer-events-none absolute top-1/2 right-[16%] h-0.5 w-4 -translate-y-1/2" style={{ background: 'var(--ca-accent)' }} />
              <ImgSlot alt="An ophthalmologist reviewing a patient's eye exam" rounded="rounded-full" className="absolute inset-x-[2%] top-[2%] -bottom-[18%]" />
            </div>
            {/* floating "Eye exam booked" card */}
            <div className="absolute -bottom-2 -left-4 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(11,30,42,0.5)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={17} /></span>
              <div>
                <div className="text-[11px] text-slate-500">Eye exam booked</div>
                <div className="text-sm font-bold text-[color:var(--ca-ink)]">Confirmed · 10:00 AM</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (focus grid, amber corner tick) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for ophthalmologists, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              From eye exams to cataract, glaucoma and LASIK consultations — patients book any service in seconds.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.05}>
                <Link to={START} className="group relative flex h-full flex-col overflow-hidden rounded-[16px] border border-black/[0.08] bg-white p-6 transition-all hover:border-[color:var(--ca-primary)]/40 hover:shadow-[0_18px_40px_-24px_rgba(11,30,42,0.4)] hover:no-underline">
                  {/* amber corner tick */}
                  <span aria-hidden className="pointer-events-none absolute right-4 top-4 h-3.5 w-3.5 border-r-2 border-t-2 opacity-70 transition-opacity group-hover:opacity-100" style={{ borderColor: 'var(--ca-accent)' }} />
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}>
                    <s.icon size={22} />
                  </span>
                  <h3 className="mt-4 font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{s.label}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (ring-badge cards + dotted connector) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The patient journey, <span style={{ color: 'var(--ca-primary)' }}>made clear.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              From booking an eye exam to the consultation — four simple steps, no phone tag.
            </Reveal>
          </div>
          <div className="relative mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* dotted connector line behind the badges (lg only) */}
            <span aria-hidden className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-9 hidden lg:block" style={{ borderTop: '2px dashed rgba(12,74,110,0.35)' }} />
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="relative h-full rounded-[16px] border border-black/[0.08] bg-white p-6 text-center">
                  <span className="relative z-10 mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-2 bg-white" style={{ borderColor: 'rgba(12,74,110,0.4)', color: 'var(--ca-primary)' }}>
                    <s.icon size={24} />
                    <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full font-heading text-[11px] font-extrabold text-[color:var(--ca-ink)] shadow" style={{ background: 'var(--ca-accent)' }}>{i + 1}</span>
                  </span>
                  <h3 className="mt-4 font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                  <p className="mx-auto mt-1.5 max-w-[15rem] text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (logo grid in a soft panel) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Calendar, payments and WhatsApp — Meeticulous fits your clinic, no rewiring.
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-12 rounded-[24px] border border-black/[0.06] p-4 sm:p-6" style={{ background: 'var(--ca-grey)' }}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map((t) => (
                <div key={t.name} className="flex items-center gap-3 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3.5 shadow-[0_10px_26px_-22px_rgba(11,30,42,0.5)]">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[color:var(--ca-cream)]">
                    {t.logo ? <img src={t.logo} alt="" loading="lazy" className="h-5 w-5 object-contain" /> : <ToolLogo name={t.icon} size={20} className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</div>
                    <div className="mt-0.5 truncate text-xs leading-snug text-slate-500">{t.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.1} className="mt-8 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              Explore All Features <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (Snellen eye-chart descending type scale) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-3xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Real impact, <span style={{ color: 'var(--ca-primary)' }}>in plain sight.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              A dashboard that does the admin, so you can focus on your patients.
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-12 overflow-hidden rounded-[20px] border border-black/[0.08] bg-white shadow-[0_24px_60px_-34px_rgba(11,30,42,0.35)]">
            <div className="flex items-center justify-center gap-2 border-b border-black/5 px-6 py-3" style={{ background: 'var(--ca-cream)' }}>
              <Eye size={15} style={{ color: 'var(--ca-primary)' }} />
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">Clinic acuity chart</span>
            </div>
            <div className="px-6 py-10 sm:px-10 sm:py-12">
              {METRICS.map((m, i) => (
                <Reveal key={m.l} delay={i * 0.06}>
                  <div className={`flex flex-col items-center gap-1 py-5 text-center ${i > 0 ? 'border-t' : ''}`} style={i > 0 ? { borderColor: 'rgba(245,158,11,0.45)' } : undefined}>
                    <div className="font-heading font-extrabold leading-none tracking-tight text-[color:var(--ca-ink)]" style={{ fontSize: CHART_SIZES[i], color: i === 0 ? 'var(--ca-primary)' : undefined }}>
                      {m.v}
                    </div>
                    <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-xs">{m.l}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (two-column index cards) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Eye clinics that swapped the <span style={{ color: 'var(--ca-primary)' }}>phone for a link.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Placeholder quotes from clinic staff about the admin relief — no-shows, front desk and billing.
            </Reveal>
          </div>
          <div className="mt-12 overflow-hidden rounded-[18px] border border-black/[0.08] bg-white">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) * 0.05}>
                <figure className={`grid gap-4 px-6 py-7 sm:grid-cols-[minmax(0,13rem)_1fr] sm:gap-8 sm:px-8 ${i > 0 ? 'border-t border-black/[0.08]' : ''}`}>
                  {/* left meta column */}
                  <figcaption className="flex items-start gap-3 sm:border-r sm:border-black/[0.08] sm:pr-8">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-[color:var(--ca-ink)]" style={{ background: 'color-mix(in srgb, var(--ca-accent) 30%, transparent)' }}>{t.name.replace('Dr. ', '').charAt(0)}</span>
                    <div className="min-w-0">
                      <div className="text-[14px] font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</div>
                      <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{t.role}</div>
                      <div className="text-[12px] leading-snug text-slate-500">{t.company}</div>
                      <div className="mt-2 flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={12} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}</div>
                    </div>
                  </figcaption>
                  {/* right quote */}
                  <blockquote className="text-[15px] leading-relaxed text-slate-700 sm:self-center">&ldquo;{t.quote}&rdquo;</blockquote>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (two cards: manual vs Meeticulous) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The old front desk vs <span style={{ color: 'var(--ca-primary)' }}>an automated clinic.</span>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {/* manual — muted */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[18px] border border-black/[0.08] bg-white p-7">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400"><X size={17} /></span>
                  <h3 className="font-heading text-base font-bold text-slate-500">{COMPARE.old.label}</h3>
                </div>
                <ul className="mt-5 flex flex-col gap-3">
                  {COMPARE.old.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm text-slate-500">
                      <X size={16} className="mt-0.5 flex-shrink-0 text-slate-300" />
                      <span className="line-through decoration-slate-300">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            {/* Meeticulous — accent */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[18px] border-2 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(11,30,42,0.35)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: 'var(--ca-primary)' }}><Check size={17} /></span>
                  <h3 className="font-heading text-base font-bold text-[color:var(--ca-ink)]">{COMPARE.now.label}</h3>
                </div>
                <ul className="mt-5 flex flex-col gap-3">
                  {COMPARE.now.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm font-medium text-[color:var(--ca-ink)]">
                      <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ca-primary)' }} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} className="mt-7 w-full">Claim Your Link — Free</CtaButton>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · PRICING (Free + Premium two cards) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start free. <span style={{ color: 'var(--ca-primary)' }}>Grow as your clinic does.</span>
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-[color:var(--ca-ink)]' : 'text-slate-500'}`}>Monthly</button>
            <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: yearly ? 'var(--ca-primary)' : '#cbd5e1', minHeight: 0 }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: yearly ? '22px' : '2px' }} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-[color:var(--ca-ink)]' : 'text-slate-500'}`}>
              Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--ca-primary) 12%, transparent)', color: 'var(--ca-primary)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
            </span>
          </Reveal>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Free */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[20px] border border-black/[0.08] bg-white p-7">
                <div className="font-heading text-lg font-bold">{FREE_PLAN.name}</div>
                <p className="mt-1 text-sm text-slate-500">Everything you need to get booked.</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="pb-1 text-xl font-bold">₹</span>
                  <span className="font-heading text-4xl font-extrabold tracking-tight">0</span>
                  <span className="pb-1.5 text-sm text-slate-500">/mo · 5% per booking</span>
                </div>
                <ul className="mt-6 flex flex-col gap-2.5">
                  {FREE_PLAN.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} variant="ghost" className="mt-7 w-full">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>
            {/* Premium — recommended */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[20px] border-2 bg-white p-7 shadow-[0_24px_60px_-30px_rgba(11,30,42,0.28)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
                <div className="flex items-center gap-2">
                  <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--ca-ink)]" style={{ background: 'color-mix(in srgb, var(--ca-accent) 24%, transparent)' }}>Recommended</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Keep every rupee. Automate the rest.</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="pb-1 text-xl font-bold" style={{ color: 'var(--ca-primary)' }}>₹</span>
                  <span className="font-heading text-4xl font-extrabold tracking-tight" style={{ color: 'var(--ca-primary)' }}>{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                  <span className="pb-1.5 text-sm text-slate-500">/mo</span>
                  {yearly && <span className="pb-1.5 ml-1 text-sm text-slate-400 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-500">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST incl.` : 'Billed monthly · GST included'}</p>
                <ul className="mt-6 flex flex-col gap-2.5">
                  <li className="flex items-start gap-2.5 text-sm font-semibold text-[color:var(--ca-ink)]">
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>Everything in Free</span>
                  </li>
                  {PREMIUM_PLAN.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} className="mt-7 w-full">Go Pro</CtaButton>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.12} className="mt-6 text-center">
            <Link to="/pricing" className="text-sm font-semibold text-slate-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 10 · ABOUT (split text + ImgSlot + trust facts) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-1 text-center lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
              Modern eye clinics deserve tools that feel as considered as their care.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-slate-600">
              Meeticulous turns a ringing phone, a paper register and payments at the desk into one calm booking platform — built for the way Indian practices actually work. It is a scheduling and payment tool, not a medical-records system.
            </Reveal>
            <Reveal delay={0.12} className="mt-8 grid gap-3 sm:grid-cols-2">
              {TRUST_FACTS.map((it) => (
                <div key={it.value} className="flex items-start gap-3 rounded-[14px] border border-black/[0.06] bg-white px-4 py-3.5 text-left">
                  <it.icon size={18} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ca-primary)' }} />
                  <div>
                    <div className="text-sm font-bold text-[color:var(--ca-ink)]">{it.value}</div>
                    <div className="mt-0.5 text-xs leading-snug text-slate-500">{it.label}</div>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
          <Reveal delay={0.06} className="relative order-2 mx-auto w-full max-w-md lg:mx-0">
            <div aria-hidden className="pointer-events-none absolute -left-6 -top-6 h-40 w-40 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(245,158,11,0.25), transparent)' }} />
            <ImgSlot alt="A calm eye-clinic reception managed from one booking dashboard" className="relative aspect-[4/5] shadow-[0_28px_60px_-30px_rgba(11,30,42,0.4)]" />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · FAQ (two-column accordion) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 12 · FINAL CTA (deep-blue + amber focus-ring glow) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[24px] px-8 py-16 text-center sm:px-12 lg:py-20" style={{ background: 'linear-gradient(150deg, #062B44 0%, #0C4A6E 100%)' }}>
          {/* amber concentric focus-ring glow, blended into the panel */}
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 mix-blend-screen">
            <span className="absolute inset-0 rounded-full border" style={{ borderColor: 'rgba(245,158,11,0.28)' }} />
            <span className="absolute inset-[14%] rounded-full border" style={{ borderColor: 'rgba(245,158,11,0.22)' }} />
            <span className="absolute inset-[30%] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(245,158,11,0.4), transparent)' }} />
          </div>
          <div className="relative mx-auto max-w-2xl">
            <Reveal as="h2" className="font-heading text-[clamp(1.8rem,4.5vw,2.6rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Give patients a clearer way to book your eye clinic.
            </Reveal>
            <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/75">
              Set up your clinic&apos;s booking page today — free forever, ready to share in minutes.
            </Reveal>
            <Reveal delay={0.1} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
                Launch My Page — Free <ArrowRight size={16} />
              </Link>
              <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
                Book A Demo
              </Link>
            </Reveal>
            <Reveal delay={0.14} className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
              {['No credit card', 'Free forever', '0% on Pro'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Check size={14} style={{ color: 'var(--ca-accent)' }} /> {t}</span>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 13 · FOOTER (shared shell) ═══════════════ */}
      <footer className="border-t border-black/5 px-5 py-16 sm:px-8" style={{ background: '#ffffff' }}>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <div className="font-heading text-lg font-extrabold text-[color:var(--ca-ink)]">Meeticulous</div>
              <p className="mt-2 max-w-xs text-sm text-slate-500">The clearer way to run your eye clinic&apos;s bookings.</p>
              <CtaButton to={START} className="mt-5">Create Your Page — Free <ArrowRight size={15} /></CtaButton>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-600">{col.title}</div>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <NavLink item={l} className="text-sm text-slate-600 transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-black/5 pt-6 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-slate-500">© 2026 Meeticulous. <OperatorCredit /></p>
            <p className="text-xs text-slate-500">Made for India&apos;s ophthalmologists &amp; eye clinics</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
