// /for/physiotherapists — bespoke, conversion-focused landing page for
// physiotherapists & rehab centres in India.
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke
// route PRECEDES /for/:profession in App.jsx. URL /for/physiotherapists — keep in
// sync: App.jsx route, prerender.mjs, sitemapService.js, and the Navbar
// "Who it's for" menu.
//
// Section ORDER follows the CharteredAccountants page (nav → hero → use-cases →
// how-it-works → integrations → impact → testimonials → difference → trust →
// pricing → about → faq → final-cta → footer). Every section has its OWN bespoke
// design (not a recolour of another /for/ page): numbered treatment index,
// recovery-journey track, two-row logo marquee, asymmetric bento, vertical
// quote wall, split old-vs-new panels, trust ticker, horizontal pricing bars,
// arched about cluster, two-column FAQ, full-bleed CTA. Only nav/hero/footer
// (shared shell) may resemble sibling pages.
//
// IMAGES: every photo slot is an intentional EMPTY placeholder (ImgSlot) with a
// descriptive aria-label — drop real photography in later without touching layout.
//
// HONESTY: scheduling + payment tool, not a medical-records or advice product.
// No treatment/outcome claims; testimonials are labelled placeholders about the
// SOFTWARE's admin benefit, never a patient's recovery; trust facts emphasise
// payment security + India data residency + DPDP; JSON-LD has NO self-serving
// aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// marquees/accordion/toggle, AA-contrast palette (dark text on lime, never lime
// body text on white), visible focus, and prefers-reduced-motion disables every
// marquee + float. Style H (Light + Lime/teal).

import { useState } from 'react';
import { Activity as ActivityIcon } from 'lucide-react';
import IconArt from '../../components/common/IconArt';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star,
  CalendarCheck, Wallet, BellRing, Activity,
  Landmark,TrendingUp, FileText,
  Dumbbell, Bone, PersonStanding, Footprints, Video,
  BadgePercent, Lock, ShieldCheck, Zap,
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
  { label: 'Treatments', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const SLOT_ICON = ActivityIcon; // stands in for the removed mascot art
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian clinics'];

// Treatment index rows.
const SERVICES = [
  { icon: Activity, label: 'Physiotherapy Consultation', desc: 'Assessment and treatment-plan appointments.' },
  { icon: Dumbbell, label: 'Sports Injury Rehab', desc: 'Recovery programmes for sports injuries.' },
  { icon: Bone, label: 'Post-Surgery Rehab', desc: 'Structured rehabilitation after surgery.' },
  { icon: PersonStanding, label: 'Back & Neck Pain', desc: 'Relief and mobility for spine-related pain.' },
  { icon: Footprints, label: 'Posture & Ergonomics', desc: 'Posture correction and movement coaching.' },
  { icon: Video, label: 'Home & Online Sessions', desc: 'Tele-rehab and home-visit bookings.' },
];

// Recovery journey track (4-step).
const STEPS = [
  { title: 'Book an assessment', icon: CalendarCheck, desc: 'The patient picks a service and a time that suits them.' },
  { title: 'Pay upfront', icon: Wallet, desc: 'The session fee is collected securely at booking.' },
  { title: 'Get a reminder', icon: BellRing, desc: 'A WhatsApp reminder goes out before the session.' },
  { title: 'The session', icon: Activity, desc: 'They arrive on time — at the centre or online.' },
];

// Integration logos — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg', sub: 'Video link on every online session' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg', sub: 'Reminders on autopilot' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Payments, refunds & GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Automatic confirmation emails' },
];

// Bento impact metrics.
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night', note: 'Your booking page never sleeps — patients reserve sessions any time.' },
  { v: '100%', l: 'Kept on Pro', note: '0% commission — every rupee you earn stays yours.' },
  { v: '₹0', l: 'To get started', note: 'Free forever plan — no card, no lock-in.' },
  { v: 'GST', l: 'Invoices, automatic', note: 'A tax invoice generated for every paid booking.' },
];

// Placeholder testimonials — swap for real quotes when available.
// About the SOFTWARE's admin benefit, never a patient's recovery.
const TESTIMONIALS = [
  { quote: 'Our reception used to spend the day rescheduling rehab sessions by phone. Patients now book on our link and it is confirmed — the admin has almost vanished, and no-shows dropped noticeably.', name: 'Dr. Rohan Kulkarni', role: 'Physiotherapist', company: 'MoveWell Rehab, Pune' },
  { quote: 'Automatic reminders mean patients actually turn up for their sessions on time. A real relief for the team.', name: 'Divya Nair', role: 'Centre Manager', company: 'Rehab Plus, Kochi' },
  { quote: 'Collecting the session fee upfront, with a GST invoice each time, cleaned up our billing completely.', name: 'Amit Sharma', role: 'Sports Physiotherapist', company: 'PeakForm Physio, Delhi' },
  { quote: 'Package bookings for a recovery programme just work — patients book the whole plan and pay once.', name: 'Sneha Rao', role: 'Rehab Lead', company: 'Stride Physio, Bengaluru' },
];

// Split old-vs-new comparison.
const OLD_WAY = [
  'Phone tag to fix every session time',
  'No-shows waste billable slots',
  'Chasing session fees at the desk',
  'A paper appointment register',
  'Two patients in the same slot',
];
const NEW_WAY = [
  'One booking link, patients self-serve 24/7',
  'Automatic WhatsApp reminders cut no-shows',
  'Fees collected upfront over UPI or card',
  'One clean, calendar-synced clinic view',
  'Conflict-free slots — no double bookings',
];

// Trust facts — verifiable only.
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your clinic data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for physiotherapists and rehab centres?', a: 'Yes. Whether you are a solo physiotherapist or a rehab centre with a team, Meeticulous manages your services, availability, patient bookings and communication from one place — so your reception runs without constant phone calls. It is a scheduling and payment tool, not a medical-records system.' },
  { q: 'Can patients book sessions online?', a: 'Yes. A patient opens your booking link, chooses a service such as a physiotherapy assessment or rehab session, picks a convenient time and confirms — no calls or waiting for the desk to reply.' },
  { q: 'Can I take recurring or package bookings?', a: 'Yes. Offer multi-session rehab packages and recurring bookings, each with its own duration, fee and availability — ideal for a structured recovery programme.' },
  { q: 'Can I offer home visits or online sessions?', a: 'Yes. Offer online tele-rehab with automatic Google Meet links, or mark a service as an in-centre or home visit — the patient picks the mode that suits them.' },
  { q: 'Can I collect the session fee online?', a: 'Yes. Collect the fee upfront through Razorpay — UPI, cards or netbanking — before the session. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Is our clinic and patient information kept private?', a: 'Meeticulous stores appointment and contact details for booking only — it is not a medical-records system. Your production data is hosted in India (Mumbai) and the platform operates under India’s DPDP Act 2023.' },
  { q: 'Do we need any technical setup?', a: 'No. Setup takes minutes and needs no technical skills. You add your services and centre hours, and your booking page is ready to share — your patients need nothing more than the link.' },
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
    { label: 'Physiotherapists & Rehab Centres', to: '/for/physiotherapists' },
    { label: 'Doctors & Clinics', to: '/for/doctors' },
    { label: 'Chartered Accountants', to: '/for/chartered-accountants' },
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
    solid: 'text-white shadow-[0_4px_14px_rgba(15,118,110,0.25)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/25',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

/* Intentional EMPTY image placeholder — layout-final, drop real photos in later.
   Empty alt = decorative (aria-hidden); otherwise exposed as role="img". */
function ImgSlot({ alt, className = '', rounded = 'rounded-[20px]' }) {
  const layout = className
    .replace(/shadow-\[[^\]]*\]/g, '')
    .replace(/shadow-\w+/g, '')
    .replace(/rounded-\[[^\]]*\]/g, '')
    .replace(/\bborder\b(-[^\s]+)?/g, '')
    .replace(/bg-\[[^\]]*\]/g, '');
  const pos = /\b(absolute|fixed)\b/.test(layout) ? '' : 'relative';
  return <IconArt icon={SLOT_ICON} label={alt} rounded={rounded} className={`${pos} z-40 ${layout}`} />;
}

/* Two-column single-open FAQ accordion. */
function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="overflow-hidden rounded-[14px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'var(--ca-primary)' : 'rgba(17,17,17,0.08)' }}>
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
              <p className="px-5 pb-4 text-[14.5px] leading-relaxed text-neutral-500">{f.a}</p>
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

export default function Physiotherapists() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/physiotherapists`;
  const seo = {
    title: 'Appointment Booking Software for Physiotherapists & Rehab Centres | Meeticulous',
    description: 'Meeticulous is appointment booking software for physiotherapists and rehab centres in India. Let patients book sessions online — fees collected upfront, WhatsApp reminders, GST invoices, tele-rehab, 0% commission. Start free.',
    keywords: 'appointment booking software for physiotherapists, physiotherapy clinic scheduling software india, book physio session online, rehab centre appointment booking, physiotherapist booking page, tele-rehab scheduling',
    ogTitle: 'Keep Patients Moving — Booking Software for Physiotherapists',
    ogDescription: 'Patients book physiotherapy sessions, pay upfront over UPI and get WhatsApp reminders — automatically. A clean booking page for physiotherapists and rehab centres in India. Free forever, no card required.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Physiotherapists & Rehab Centres',
    serviceType: 'Appointment booking software for physiotherapists and rehab centres',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Style H — Light + Lime/teal. Legacy --ca-* var names kept so shared classNames
  // stay valid. All text-bearing tokens are AA on white.
  const styleVars = {
    '--ca-primary': '#0F766E', // teal-700 — text/links/fills, AA on white (~5.3:1)
    '--ca-accent': '#4D7C0F',  // lime-700 — secondary accent text, AA on white (~5:1)
    '--ca-lime': '#BEF264',    // lime-300 — bright highlight fill (dark text only)
    '--ca-ink': '#14261F',     // deep green-slate text
    '--ca-cream': '#F7FEE7',   // lime-50 section bg
    '--ca-grey': '#F1F5F3',    // light section bg
  };

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
        themeColor="#0F766E"
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        jsonLd={jsonLd}
      />

      {/* keyframes for the marquees + reduced-motion guard (page-scoped) */}
      <style>{`
        @keyframes physioMarqueeX { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes physioMarqueeXr { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @keyframes physioMarqueeY { from { transform: translateY(0); } to { transform: translateY(-50%); } }
        .physio-mx { animation: physioMarqueeX 34s linear infinite; }
        .physio-mxr { animation: physioMarqueeXr 34s linear infinite; }
        .physio-my { animation: physioMarqueeY 26s linear infinite; }
        .physio-col:hover .physio-my { animation-play-state: paused; }
        @media (prefers-reduced-motion: reduce) {
          .physio-mx, .physio-mxr, .physio-my { animation: none !important; }
        }
      `}</style>

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

      {/* ═══════════════ 2 · HERO (highlight-marker + arched image, mix-blend blob) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Flexible appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>physiotherapists</span>{' '}
              managing recurring sessions.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-neutral-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for physiotherapists — patients book and rebook recurring sessions, pay upfront, and get reminders, so no one drops off mid-recovery.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Create Your Booking Page <ArrowRight size={16} /></CtaButton>
              <Link to="/contact" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
                Book A Demo <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
                  <Check size={14} style={{ color: 'var(--ca-primary)' }} /> {t}
                </span>
              ))}
            </Reveal>
          </div>

          {/* RIGHT — arched empty image + floating session chip; lime blob uses mix-blend */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <div aria-hidden className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-multiply blur-2xl" style={{ background: 'var(--ca-lime)' }} />
            <ImgSlot alt="A physiotherapist guiding a patient through a rehab exercise" rounded="rounded-t-[999px] rounded-b-[28px]" className="relative z-10 aspect-[4/5] w-full" />
            <div className="absolute -left-3 top-10 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(15,23,42,0.5)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={17} /></span>
              <div><div className="text-[11px] text-neutral-500">New session</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">Rehab · 5:00 PM</div></div>
            </div>
            <div className="absolute -right-2 bottom-10 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(15,23,42,0.5)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: 'var(--ca-lime)', color: 'var(--ca-ink)' }}><Wallet size={17} /></span>
              <div><div className="text-[11px] text-neutral-500">Fee received</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">₹800</div></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · TREATMENTS (numbered index rows) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for physiotherapists,{' '}
              <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-neutral-500">
              From assessments to sports rehab, post-surgery recovery and tele-rehab — patients book any service in seconds.
            </Reveal>
          </div>
          <div className="mt-10 divide-y divide-black/[0.08] border-y border-black/[0.08]">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.05}>
                <Link to={START} className="group flex items-center gap-5 py-5 hover:no-underline sm:gap-8">
                  <span className="font-heading text-sm font-extrabold tabular-nums text-neutral-300 transition-colors group-hover:text-[color:var(--ca-primary)]">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl transition-colors" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}>
                    <s.icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-heading text-base font-bold text-[color:var(--ca-ink)] sm:text-lg">{s.label}</span>
                    <span className="mt-0.5 block text-sm text-neutral-500">{s.desc}</span>
                  </span>
                  <span aria-hidden className="hidden h-8 items-center overflow-hidden sm:flex">
                    <span className="h-[3px] w-0 rounded-full transition-all duration-300 group-hover:w-12" style={{ background: 'var(--ca-lime)' }} />
                  </span>
                  <ArrowRight size={18} className="flex-shrink-0 text-neutral-300 transition-all group-hover:translate-x-1 group-hover:text-[color:var(--ca-primary)]" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (recovery-journey track) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From first call to <span style={{ color: 'var(--ca-primary)' }}>booked &amp; paid</span> — in four steps.
            </Reveal>
          </div>
          <div className="relative mt-16">
            <span aria-hidden className="pointer-events-none absolute left-0 right-0 top-6 hidden h-[3px] rounded-full lg:block" style={{ background: 'linear-gradient(90deg, var(--ca-lime), var(--ca-primary))' }} />
            <ol className="grid gap-10 lg:grid-cols-4 lg:gap-8">
              {STEPS.map((s, i) => (
                <Reveal as="li" key={s.title} delay={i * 0.1} className="relative text-center lg:text-left">
                  <span className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full font-heading text-base font-extrabold text-white lg:mx-0" style={{ background: 'var(--ca-primary)' }}>
                    {i + 1}
                  </span>
                  <span className="mt-4 flex items-center justify-center gap-2 lg:justify-start" style={{ color: 'var(--ca-primary)' }}>
                    <s.icon size={18} />
                    <h3 className="font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                  </span>
                  <p className="mx-auto mt-1.5 max-w-[15rem] text-sm leading-relaxed text-neutral-500 lg:mx-0">{s.desc}</p>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (two-row logo marquee) ═══════════════ */}
      <section id="features" className="overflow-hidden py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-5 text-center sm:px-8">
          <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
          </Reveal>
          <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">
            Calendar, payments and WhatsApp — Meeticulous fits your workflow, no rewiring.
          </Reveal>
        </div>
        <div className="relative mt-12" aria-label="Integrations" role="list">
          {/* edge fades */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-white to-transparent sm:w-28" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-white to-transparent sm:w-28" />
          {[0, 1].map((row) => (
            <div key={row} className="flex w-max py-2" >
              <div className={`flex gap-4 pr-4 ${row ? 'physio-mxr' : 'physio-mx'}`}>
                {[...TOOLS, ...TOOLS].map((t, idx) => (
                  <div key={`${row}-${t.name}-${idx}`} role="listitem" className="flex w-64 flex-shrink-0 items-center gap-3 rounded-[14px] border border-black/[0.08] bg-white px-4 py-3.5">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--ca-grey)]">
                      {t.logo ? <img src={t.logo} alt={t.name} loading="lazy" className="h-5 w-5 object-contain" /> : <ToolLogo name={t.icon} size={20} className="h-5 w-5" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-neutral-500">{t.sub}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (asymmetric bento) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Real impact for a <span style={{ color: 'var(--ca-primary)' }}>modern rehab centre.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">Less admin at the desk, more time on recovery.</Reveal>
          </div>
          <div className="mt-12 grid auto-rows-[minmax(0,1fr)] gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* big feature tile */}
            <Reveal className="sm:col-span-2 lg:row-span-2">
              <div className="flex h-full flex-col justify-between rounded-[18px] p-7 text-white" style={{ background: 'var(--ca-primary)' }}>
                <TrendingUp size={26} className="opacity-80" />
                <div className="mt-8">
                  <div className="font-heading text-5xl font-extrabold tracking-tight sm:text-6xl">{METRICS[0].v}</div>
                  <div className="mt-2 font-heading text-base font-bold">{METRICS[0].l}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/70">{METRICS[0].note}</p>
                </div>
              </div>
            </Reveal>
            {/* mini bar-chart tile */}
            <Reveal delay={0.05}>
              <div className="flex h-full flex-col justify-between rounded-[18px] border border-black/[0.08] bg-white p-6">
                <div className="flex items-end gap-1.5" aria-hidden>
                  {[38, 52, 44, 66, 80].map((h, k) => (
                    <span key={k} className="w-full rounded-t" style={{ height: `${h}%`, minHeight: 8, background: k === 4 ? 'var(--ca-primary)' : 'var(--ca-lime)' }} />
                  ))}
                </div>
                <div className="mt-4">
                  <div className="font-heading text-3xl font-extrabold tracking-tight" style={{ color: 'var(--ca-primary)' }}>{METRICS[1].v}</div>
                  <div className="mt-1 font-heading text-sm font-bold text-[color:var(--ca-ink)]">{METRICS[1].l}</div>
                </div>
              </div>
            </Reveal>
            {/* number tile */}
            <Reveal delay={0.1}>
              <div className="flex h-full flex-col justify-between rounded-[18px] border border-black/[0.08] bg-white p-6">
                <Wallet size={22} style={{ color: 'var(--ca-primary)' }} />
                <div className="mt-6">
                  <div className="font-heading text-3xl font-extrabold tracking-tight">{METRICS[2].v}</div>
                  <div className="mt-1 font-heading text-sm font-bold text-[color:var(--ca-ink)]">{METRICS[2].l}</div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">{METRICS[2].note}</p>
                </div>
              </div>
            </Reveal>
            {/* image + GST tile */}
            <Reveal delay={0.12} className="sm:col-span-2">
              <div className="flex h-full items-stretch gap-4 rounded-[18px] border border-black/[0.08] bg-white p-4">
                <ImgSlot alt="A rehab centre reception using the Meeticulous dashboard" className="hidden w-40 flex-shrink-0 sm:block" rounded="rounded-[14px]" />
                <div className="flex flex-col justify-center py-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--ca-lime)', color: 'var(--ca-ink)' }}><FileText size={16} /></span>
                  <div className="mt-3 font-heading text-3xl font-extrabold tracking-tight" style={{ color: 'var(--ca-accent)' }}>{METRICS[3].v}</div>
                  <div className="mt-1 font-heading text-sm font-bold text-[color:var(--ca-ink)]">{METRICS[3].l}</div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">{METRICS[3].note}</p>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (vertical scrolling quote wall) ═══════════════ */}
      <section className="overflow-hidden px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Loved by clinics that were <span style={{ color: 'var(--ca-primary)' }}>drowning in admin.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-neutral-500">
              How rehab centres book more sessions and cut the phone tag with Meeticulous.
            </Reveal>
            <Reveal delay={0.1} className="mt-6 flex items-center justify-center gap-1 lg:justify-start">
              {[0, 1, 2, 3, 4].map((s) => <Star key={s} size={18} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}
              <span className="ml-2 text-sm font-semibold text-neutral-500">Real practices, honest words</span>
            </Reveal>
          </div>
          {/* two masked columns scrolling in opposite feel; pause on hover */}
          <div className="relative h-[26rem] overflow-hidden" style={{ maskImage: 'linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 12%, #000 88%, transparent)' }}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[0, 1].map((col) => (
                <div key={col} className="physio-col">
                  <div className="physio-my flex flex-col gap-4" style={col ? { animationDelay: '-13s' } : undefined}>
                    {[...TESTIMONIALS, ...TESTIMONIALS].map((t, idx) => (
                      <figure key={`${col}-${idx}`} className="rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.4)]">
                        <span aria-hidden className="font-heading text-3xl leading-none" style={{ color: 'var(--ca-lime)' }}>&ldquo;</span>
                        <blockquote className="-mt-2 text-[13.5px] leading-relaxed text-neutral-700">{t.quote}</blockquote>
                        <figcaption className="mt-3 flex items-center gap-2.5 border-t border-black/5 pt-3">
                          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: 'var(--ca-primary)' }}>{t.name.charAt(0)}</span>
                          <span className="min-w-0"><span className="block truncate text-[13px] font-bold text-[color:var(--ca-ink)]">{t.name}</span><span className="block truncate text-[11px] text-neutral-500">{t.role} · {t.company}</span></span>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · DIFFERENCE (split old-vs-new panels) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The old way vs <span style={{ color: 'var(--ca-primary)' }}>a calmer clinic.</span>
            </Reveal>
          </div>
          <div className="relative mt-12 grid gap-4 lg:grid-cols-2 lg:gap-6">
            {/* old */}
            <Reveal className="rounded-[20px] border border-black/[0.08] p-7 sm:p-9" style={{ background: '#f3f4f6' }}>
              <div className="mix-blend-luminosity">
                <span className="inline-flex items-center gap-2 rounded-full bg-neutral-200 px-3 py-1 text-xs font-bold uppercase tracking-wide text-neutral-500">
                  <X size={13} /> Without Meeticulous
                </span>
                <ul className="mt-6 flex flex-col gap-4">
                  {OLD_WAY.map((t) => (
                    <li key={t} className="flex items-start gap-3 text-sm text-neutral-500">
                      <X size={16} className="mt-0.5 shrink-0 text-neutral-400" /> <span className="line-through decoration-neutral-300">{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            {/* new */}
            <Reveal delay={0.08} className="relative rounded-[20px] border-2 p-7 sm:p-9" style={{ borderColor: 'var(--ca-primary)', background: 'var(--ca-cream)' }}>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-primary)' }}>
                <Check size={13} /> With Meeticulous
              </span>
              <ul className="mt-6 flex flex-col gap-4">
                {NEW_WAY.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm font-medium text-[color:var(--ca-ink)]">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            {/* VS medallion */}
            <span aria-hidden className="absolute left-1/2 top-1/2 hidden h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white font-heading text-sm font-extrabold text-white shadow-lg lg:flex" style={{ background: 'var(--ca-ink)' }}>VS</span>
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · TRUST (auto-ticker of verifiable facts) ═══════════════ */}
      <section className="overflow-hidden py-6" style={{ background: 'var(--ca-ink)' }} aria-label="Security & trust">
        <div className="flex w-max">
          <div className="physio-mx flex items-center gap-10 pr-10">
            {[...TRUST_STRIP, ...TRUST_STRIP, ...TRUST_STRIP].map((s, i) => (
              <span key={i} className="flex flex-shrink-0 items-center gap-2.5 text-sm text-white/80">
                <s.icon size={16} style={{ color: 'var(--ca-lime)' }} />
                <span className="font-bold text-white">{s.value}</span>
                <span className="text-white/50">— {s.label}</span>
                <span aria-hidden className="ml-6 h-1 w-1 rounded-full bg-white/25" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 10 · PRICING (horizontal plan bars) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center gap-6 text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start small. <span style={{ color: 'var(--ca-primary)' }}>Grow as your centre does.</span>
            </Reveal>
            <Reveal className="flex items-center gap-3">
              <button type="button" onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>Monthly</button>
              <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: yearly ? 'var(--ca-primary)' : '#d4d4d4', minHeight: 0 }}>
                <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: yearly ? '22px' : '2px' }} />
              </button>
              <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>
                Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--ca-primary) 12%, transparent)', color: 'var(--ca-primary)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
              </span>
            </Reveal>
          </div>

          <div className="mt-10 flex flex-col gap-4">
            {/* Free — horizontal bar */}
            <Reveal>
              <div className="grid items-center gap-6 rounded-[18px] border border-black/[0.08] bg-white p-6 sm:p-7 lg:grid-cols-[1fr_1.4fr_auto]">
                <div>
                  <div className="font-heading text-lg font-bold">{FREE_PLAN.name}</div>
                  <p className="mt-1 text-sm text-neutral-500">Everything you need to get booked.</p>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="pb-1 text-xl font-bold">₹</span>
                    <span className="font-heading text-4xl font-extrabold tracking-tight">0</span>
                    <span className="pb-1.5 text-sm text-neutral-500">/mo · 5% per booking</span>
                  </div>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {FREE_PLAN.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-neutral-600">
                      <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} variant="ghost" className="w-full lg:w-auto">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>
            {/* Premium — horizontal bar, highlighted */}
            <Reveal delay={0.08}>
              <div className="relative grid items-center gap-6 overflow-hidden rounded-[18px] border-2 bg-white p-6 shadow-[0_24px_60px_-30px_rgba(16,24,40,0.14)] sm:p-7 lg:grid-cols-[1fr_1.4fr_auto]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-y-0 left-0 w-1.5" style={{ background: 'linear-gradient(180deg, var(--ca-lime), var(--ca-primary))' }} />
                <div>
                  <div className="flex items-center gap-2">
                    <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--ca-ink)]" style={{ background: 'var(--ca-lime)' }}>Recommended</span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">Keep every rupee. Automate the rest.</p>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="pb-1 text-xl font-bold" style={{ color: 'var(--ca-primary)' }}>₹</span>
                    <span className="font-heading text-4xl font-extrabold tracking-tight" style={{ color: 'var(--ca-primary)' }}>{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                    <span className="pb-1.5 text-sm text-neutral-500">/mo{yearly ? '' : ''}</span>
                    {yearly && <span className="pb-1.5 ml-1 text-sm text-neutral-400 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                  </div>
                  <p className="mt-1 text-xs font-semibold text-neutral-500">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/yr · GST incl.` : 'Billed monthly · GST included'}</p>
                </div>
                <ul className="grid gap-2 sm:grid-cols-2">
                  <li className="flex items-start gap-2 text-[13px] font-semibold text-[color:var(--ca-ink)]">
                    <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>Everything in Free</span>
                  </li>
                  {PREMIUM_PLAN.features.slice(0, 3).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-[13px] text-neutral-600">
                      <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} className="w-full lg:w-auto">Go Pro</CtaButton>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="mt-8 flex flex-col items-center gap-2 text-center">
            <span className="flex items-center gap-1.5 text-sm text-neutral-500"><Lock size={14} style={{ color: 'var(--ca-primary)' }} /> Access to all features with no hidden fees</span>
            <Link to="/pricing" className="text-sm font-semibold text-neutral-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · ABOUT (arched image cluster + trust items) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* arched image cluster (empty placeholders) + years badge */}
          <Reveal className="relative order-2 mx-auto w-full max-w-md lg:order-1 lg:mx-0 lg:max-w-none">
            <div className="grid grid-cols-2 gap-4">
              <ImgSlot alt="A physiotherapist assessing a patient's mobility" rounded="rounded-t-[999px] rounded-b-[20px]" className="aspect-[3/4]" />
              <ImgSlot alt="A patient completing a guided rehab exercise" rounded="rounded-b-[999px] rounded-t-[20px]" className="mt-8 aspect-[3/4]" />
            </div>
            <div className="absolute left-1/2 top-1/2 z-10 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-white text-white shadow-xl" style={{ background: 'var(--ca-primary)' }}>
              <span className="font-heading text-2xl font-extrabold leading-none">0%</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/80">commission</span>
            </div>
          </Reveal>

          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Modern centres deserve <span style={{ color: 'var(--ca-primary)' }}>better tools.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-neutral-600">
              Instead of a ringing phone, a paper register and payments at the desk, rehab centres manage sessions, patients and money from one platform — built for the way modern Indian practices actually work.
            </Reveal>
            <Reveal delay={0.12} className="mt-8 grid gap-x-6 gap-y-5 text-left sm:grid-cols-2">
              {TRUST_STRIP.map((it) => (
                <div key={it.value} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}>
                    <it.icon size={17} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-heading text-sm font-bold text-[color:var(--ca-ink)]">{it.value}</div>
                    <p className="mt-0.5 text-xs leading-snug text-neutral-500">{it.label}</p>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 12 · FAQ (two-column) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 13 · FINAL CTA (full-bleed teal, lime glow + dot grid) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8" style={{ background: 'linear-gradient(160deg, #0B3B33 0%, #0F766E 100%)' }}>
        {/* decorative: faint dot grid + two soft lime glows (mix-blend for lift) */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.12]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(120% 80% at 50% 50%, #000 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(120% 80% at 50% 50%, #000 30%, transparent 75%)' }} />
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(190,242,100,0.5), transparent)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-16 h-72 w-72 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(45,212,191,0.5), transparent)' }} />

        <div className="relative mx-auto max-w-2xl">
          <Reveal as="h2" delay={0.06} className="font-heading text-[clamp(1.9rem,5vw,2.75rem)] font-extrabold leading-[1.08] tracking-tight text-white">
            Spend less time scheduling.<br className="hidden sm:block" /> <span style={{ color: 'var(--ca-lime)' }}>Spend more time on recovery.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/70">
            Set up your centre&apos;s booking page today — free forever, and ready to share in minutes.
          </Reveal>
          <Reveal delay={0.14} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold shadow-[0_12px_34px_-10px_rgba(0,0,0,0.5)] transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.65)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
              Launch My Clinic Page <ArrowRight size={16} />
            </Link>
            <Link to="/contact" className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-7 py-4 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
              Book A Demo
            </Link>
          </Reveal>
          <Reveal delay={0.18} className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {['No credit card required', 'Free forever plan', '0% commission on Pro'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
                <Check size={14} style={{ color: 'var(--ca-lime)' }} /> {t}
              </span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 14 · FOOTER (shared shell) ═══════════════ */}
      <footer className="border-t border-black/5 px-5 py-16 sm:px-8" style={{ background: '#ffffff' }}>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <div className="font-heading text-lg font-extrabold text-[color:var(--ca-ink)]">Meeticulous</div>
              <p className="mt-2 max-w-xs text-sm text-neutral-500">The easier way to manage rehab sessions.</p>
              <CtaButton to={START} className="mt-5">Create Your Page — Free <ArrowRight size={15} /></CtaButton>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <div className="text-xs font-bold uppercase tracking-wide text-neutral-600">{col.title}</div>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <NavLink item={l} className="text-sm text-neutral-600 transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-black/5 pt-6 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-neutral-500">© 2026 Meeticulous. <OperatorCredit /></p>
            <p className="text-xs text-neutral-500">Made for India&apos;s physiotherapists &amp; rehab centres</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
