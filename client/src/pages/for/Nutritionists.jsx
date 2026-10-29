// /for/nutritionists — bespoke, conversion-focused landing page for
// nutritionists & dietitians in India. (Sept release rebuild.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx, prerender.mjs,
// sitemapService.js, Navbar "Who it's for" menu.
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in a
// fresh GREEN + citrus system (wholesome, appetizing, editorial nutrition — calm
// green with a citrus pop, not clinical) — distinct from derm (cyan/rose, 2-tile
// hero, bento), GP (blue) and physio (lime, arched). Mechanics unique to this page:
// conic-gradient "balanced plate" hero · editorial ruled service cards with corner
// index · horizontal "week plan" step strip with a progress track · inline tool
// logo row · light-green impact band · offset testimonial grid · two side-by-side
// before/with cards · two-card pricing · about with 2x2 trust grid · dot-texture CTA.
// Only nav/hero shell chrome/footer (shared shell) may resemble sibling pages.
//
// IMAGES: intentional EMPTY ImgSlot placeholders with descriptive aria-label.
//
// HONESTY: scheduling + payment tool, not medical/diet advice. No outcome claims;
// testimonials are labelled placeholders from practitioners/clinic staff about the
// ADMIN benefit (no-shows, DMs, billing), never client weight/health results; trust
// facts are verifiable only; JSON-LD has NO aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// accordion/toggle, AA-contrast palette, visible focus, no hover uplift, Reveal
// guards motion.
//
// Legacy --ca-* CSS var names are kept (shared classNames depend on them); only the
// VALUES change per palette.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star,
  CalendarCheck, LayoutDashboard, BellRing, Share2,
  Salad, Scale, Dumbbell, HeartPulse, Apple, Video,
  Landmark, Lock, ShieldCheck, BadgePercent, Leaf,
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

const START = '/be-a-sloth';      // real host signup funnel
const LOGIN = '/login-as-vendor'; // host login (Google-only door)

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const NAV = [
  { label: 'Services', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const MASCOT = '/for/nutritionists/hero.webp';
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian practices'];

// Balanced-plate wedges (hero). Soft green → citrus tones.
const PLATE_LABELS = [
  { label: 'Veggies', dot: '#22C55E', pos: 'left-[16%] top-[13%]' },
  { label: 'Fruits', dot: '#86EFAC', pos: 'right-[8%] top-[34%]' },
  { label: 'Protein', dot: '#CA8A04', pos: 'bottom-[20%] right-[18%]' },
  { label: 'Grains', dot: '#FDE68A', pos: 'bottom-[26%] left-[10%]' },
];

// Editorial ruled service cards with a faint corner index.
const SERVICES = [
  { icon: Salad, label: 'Diet Consultation', desc: 'Personalised diet plans and follow-ups.' },
  { icon: Scale, label: 'Weight Management', desc: 'Weight-loss and weight-gain programmes.' },
  { icon: Dumbbell, label: 'Sports Nutrition', desc: 'Fuelling plans for athletes and gym-goers.' },
  { icon: HeartPulse, label: 'Clinical & Diabetic Diet', desc: 'Diet support for diabetes and lifestyle conditions.' },
  { icon: Apple, label: 'Pregnancy & Child Nutrition', desc: 'Nutrition for pregnancy and growing children.' },
  { icon: Video, label: 'Online Consultation', desc: 'Video consults and check-ins from anywhere.' },
];

// "Week plan" step strip (4-step).
const STEPS = [
  { title: 'Set up your consults', icon: LayoutDashboard, desc: 'Add your services, fees and availability in minutes.' },
  { title: 'Share your link', icon: Share2, desc: 'Put it in your Instagram bio, DMs or newsletter — one link.' },
  { title: 'Clients book & pay', icon: CalendarCheck, desc: 'They pick a time and pay upfront — no back-and-forth.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Confirmations and reminders before every consultation.' },
];

// Integration logos — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg' },
  { name: 'Zoom', logo: '/images/logos/zoom.ico' },
  { name: 'Razorpay', logo: razorpayLogo },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg' },
];

// Light-green impact band.
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night', note: 'Your booking page never sleeps — clients reserve consults any time.' },
  { v: '100%', l: 'Kept on Sloth Active', note: '0% commission — every rupee you earn stays yours.' },
  { v: '₹0', l: 'To get started', note: 'Free forever plan — no card, no lock-in.' },
  { v: 'GST', l: 'Invoices, automatic', note: 'A tax invoice generated for every paid booking.' },
];

// Placeholder testimonials — practitioners/clinic staff about the ADMIN benefit,
// never clients about diet or health outcomes.
const TESTIMONIALS = [
  { quote: 'I used to lose clients in Instagram DMs trying to fix a time. Now they book a paid consult from my link and it is confirmed — I just show up and coach. It gave me my evenings back.', name: 'Neha Agarwal', role: 'Nutritionist', company: 'Mumbai' },
  { quote: 'Automatic reminders cut my no-shows to almost nothing. Fewer empty slots, fewer awkward follow-ups.', name: 'Ritika Jain', role: 'Dietitian', company: 'Delhi' },
  { quote: 'Taking the consultation fee upfront over UPI, with a GST invoice each time, made my practice feel like a real business.', name: 'Sanjay Menon', role: 'Sports Nutritionist', company: 'Bengaluru' },
  { quote: 'Clients book their diet consults without waiting for me to reply. Setup took one evening.', name: 'Pooja Rao', role: 'Clinical Dietitian', company: 'Hyderabad' },
];

// Two side-by-side cards: the manual way vs Meeticulous.
const COMPARE = {
  old: {
    label: 'The manual way',
    points: [
      'DM tag to fix every consult',
      'No-shows waste your day',
      'Chasing consultation fees after the session',
      'Clients scattered across DMs and spreadsheets',
      'Two clients penciled into one slot',
    ],
  },
  now: {
    label: 'With Meeticulous',
    points: [
      'One booking link — clients self-serve 24/7',
      'Automatic WhatsApp reminders cut no-shows',
      'Fees collected upfront over UPI or card',
      'Every client in one calendar-synced dashboard',
      'Conflict-free slots — no double bookings',
    ],
  },
};

// Trust facts — verifiable only.
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your practice data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Sloth Active — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for nutritionists and dietitians?', a: 'Yes. Whether you consult one-on-one or run diet programmes, Meeticulous manages your services, availability, client bookings and communication from one place — so you can focus on your clients, not coordination. It is a scheduling and payment tool, not a medical-records system.' },
  { q: 'Can clients book consultations online?', a: 'Yes. A client opens your booking link, chooses a service such as a diet consultation or follow-up, picks a convenient time and confirms — no DMs or waiting for a reply.' },
  { q: 'Can I take a paid discovery or intro consult?', a: 'Yes. Create a paid intro consult with its own fee and duration. Clients pay upfront through Razorpay when they book, so you only spend time on committed clients.' },
  { q: 'Can I share my booking link in my Instagram bio?', a: 'Yes. Your link works anywhere — put it in your Instagram or LinkedIn bio, your newsletter or your DMs. One link handles all your booking requests.' },
  { q: 'Can I collect consultation fees online?', a: 'Yes. Collect fees upfront through Razorpay — UPI, cards or netbanking — before the consult. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I sell diet packages or recurring plans?', a: 'Yes. Offer multi-session packages and recurring bookings, each with its own duration, fee and availability — ideal for an ongoing diet programme.' },
  { q: 'Can I run online consultations?', a: 'Yes. Offer online consults with automatic Google Meet or Zoom links, or mark a service as in-person — the client picks the mode that suits them.' },
  { q: 'Is there a free plan?', a: 'Yes. The Sloth plan is free forever — an online booking page, unlimited services and bookings, UPI payments, 24-hour reminders and GST invoices — with a small 5% per-booking fee. Sloth Active removes that commission entirely and adds WhatsApp automation and growth tools.' },
];

const FOOTER_COLS = [
  { title: 'Product', links: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Integrations', href: '#features' },
    { label: "What's New", to: '/changelog' },
  ] },
  { title: 'For Professionals', links: [
    { label: 'Nutritionists & Dietitians', to: '/for/nutritionists' },
    { label: 'Dermatologists & Skin Clinics', to: '/for/dermatologists' },
    { label: 'Physiotherapists & Rehab', to: '/for/physiotherapists' },
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
    solid: 'text-white shadow-[0_4px_14px_rgba(21,128,61,0.22)] hover:brightness-110',
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
      <div key={f.q} className="overflow-hidden rounded-[12px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'var(--ca-primary)' : 'rgba(20,38,26,0.08)' }}>
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

export default function Nutritionists() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/nutritionists`;
  const seo = {
    title: 'Appointment Booking Software for Nutritionists & Dietitians | Meeticulous',
    description: 'Meeticulous is appointment booking software for nutritionists and dietitians in India. Let clients book diet consultations online — fees collected upfront, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'appointment booking software for nutritionists, dietitian scheduling software india, book diet consultation online, nutritionist booking page, online nutrition consultation scheduling, diet clinic appointment system',
    ogTitle: 'Your practice runs on consults. Let Meeticulous schedule them.',
    ogDescription: 'Clients book diet consultations, pay upfront and get WhatsApp reminders — automatically. A clean booking page for nutritionists and dietitians in India.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Nutritionists & Dietitians',
    serviceType: 'Appointment booking software for nutritionists and dietitians',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Fresh green + citrus palette. Legacy --ca-* names kept.
  const styleVars = {
    '--ca-primary': '#15803D', // green-700 — text/links/fills, white text AA (~4.7:1)
    '--ca-accent': '#CA8A04',  // citrus amber-600 — sparing pop, AA on white
    '--ca-ink': '#14261A',     // deep green-slate text
    '--ca-cream': '#F0FDF4',   // green-50 section bg
    '--ca-grey': '#F4F7F2',    // light green-grey section bg
  };

  const plateGradient = 'conic-gradient(from -90deg, #22C55E 0deg 150deg, #86EFAC 150deg 240deg, #CA8A04 240deg 315deg, #FDE68A 315deg 360deg)';

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
        themeColor="#15803D"
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

      {/* ═══════════════ 2 · HERO (balanced-plate composition) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* LEFT — copy */}
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Convenient appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>nutritionists</span> managing client consultations.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for nutritionists — clients book diet consultations, pay upfront, and get reminded, so you keep plans on track without chasing anyone.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Create Your Booking Page <ArrowRight size={16} /></CtaButton>
              <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
                Book A Demo <ArrowRight size={15} />
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

          {/* RIGHT — conic-gradient balanced plate + floating booked card */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-[24rem] lg:mx-0 lg:max-w-none">
            {/* blurred green blob behind (mix-blend-multiply) */}
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-[26rem] w-[26rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(21,128,61,0.22), transparent)' }} />
            <div className="relative mx-auto aspect-square w-full max-w-[22rem]">
              {/* plate rim */}
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-white p-4 shadow-[0_30px_60px_-30px_rgba(20,38,26,0.45)]">
                {/* conic-gradient pie */}
                <div className="relative h-full w-full rounded-full" style={{ background: plateGradient }}>
                  {/* plate centre */}
                  <div className="absolute left-1/2 top-1/2 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full bg-white text-center shadow-[0_10px_24px_-12px_rgba(20,38,26,0.5)]">
                    <Leaf size={22} style={{ color: 'var(--ca-primary)' }} />
                    <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Balanced</span>
                  </div>
                  {/* wedge labels */}
                  {PLATE_LABELS.map((w) => (
                    <span key={w.label} className={`absolute ${w.pos} flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-[color:var(--ca-ink)] shadow-sm backdrop-blur-sm`}>
                      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: w.dot }} />
                      {w.label}
                    </span>
                  ))}
                </div>
              </div>
              {/* floating "consultation booked" card */}
              <div className="absolute -bottom-4 -left-2 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(20,38,26,0.5)] sm:-left-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}><Check size={17} /></span>
                <div>
                  <div className="text-[11px] text-slate-500">Consultation booked</div>
                  <div className="text-sm font-bold text-[color:var(--ca-ink)]">Diet consult · 5:00 PM</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (editorial ruled cards) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for nutritionists, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              From diet plans to weight management, sports and clinical nutrition — clients book any consult in seconds.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.05}>
                <Link to={START} className="group relative flex h-full flex-col overflow-hidden rounded-[14px] border border-black/[0.08] bg-white transition-all hover:border-[color:var(--ca-primary)]/40 hover:shadow-[0_18px_40px_-28px_rgba(20,38,26,0.5)] hover:no-underline">
                  {/* thin ruled top header: icon + faint corner index */}
                  <div className="flex items-center justify-between border-b border-black/[0.06] px-6 py-4">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--ca-primary) 9%, transparent)', color: 'var(--ca-primary)' }}>
                      <s.icon size={21} />
                    </span>
                    <span aria-hidden className="font-heading text-sm font-extrabold tracking-tight" style={{ color: 'color-mix(in srgb, var(--ca-ink) 16%, transparent)' }}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col px-6 py-5">
                    <h3 className="font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{s.label}</h3>
                    {/* citrus underline accent */}
                    <span aria-hidden className="mt-2 block h-[3px] w-9 rounded-full" style={{ background: 'var(--ca-accent)' }} />
                    <p className="mt-3 text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS ("week plan" strip + progress track) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From &ldquo;when are you free?&rdquo; to a <span style={{ color: 'var(--ca-primary)' }}>confirmed, paid consult.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              A simple four-step plan to fill your calendar — no back-and-forth.
            </Reveal>
          </div>
          <div className="relative mt-14">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.08}>
                  <div className="flex h-full flex-col rounded-[16px] border border-black/[0.08] bg-white p-6">
                    <div className="flex items-center justify-between">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: 'var(--ca-primary)' }}><s.icon size={19} /></span>
                      <span className="font-heading text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: 'var(--ca-accent)' }}>Step {String(i + 1).padStart(2, '0')}</span>
                    </div>
                    <h3 className="mt-4 font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            {/* progress track along the bottom */}
            <div aria-hidden className="relative mt-10 hidden lg:block">
              <span className="absolute left-[12%] right-[12%] top-1/2 h-[3px] -translate-y-1/2 rounded-full" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
              <div className="relative grid grid-cols-4">
                {STEPS.map((s, i) => (
                  <div key={s.title} className="flex justify-center">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-[13px] font-extrabold text-white shadow-[0_6px_16px_-6px_rgba(20,38,26,0.5)]" style={{ background: i === STEPS.length - 1 ? 'var(--ca-accent)' : 'var(--ca-primary)' }}>{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (inline tool logo row in a copy card) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <Reveal className="rounded-[22px] border border-black/[0.08] bg-white p-8 shadow-[0_20px_50px_-36px_rgba(20,38,26,0.5)] sm:p-12">
            <div className="mx-auto max-w-2xl text-center">
              <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
              </Reveal>
              <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
                Calendar, video, payments and WhatsApp — Meeticulous fits your practice, no rewiring.
              </Reveal>
            </div>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-6 sm:gap-x-12">
              {TOOLS.map((t) => (
                <span key={t.name} className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--ca-grey)]">
                    {t.logo ? <img src={t.logo} alt={t.name} loading="lazy" className="h-5 w-5 object-contain" /> : <ToolLogo name={t.icon} size={20} className="h-5 w-5" />}
                  </span>
                  <span className="text-sm font-bold text-[color:var(--ca-ink)]">{t.name}</span>
                </span>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (light-green band) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Real impact for a <span style={{ color: 'var(--ca-primary)' }}>modern nutrition practice.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Less admin, more clients — and every rupee you earn stays yours.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:divide-x lg:divide-emerald-900/10">
            {METRICS.map((m, i) => (
              <Reveal key={m.l} delay={i * 0.06} className="text-center lg:px-4">
                <div className="font-heading text-5xl font-extrabold tracking-tight sm:text-6xl" style={{ color: 'var(--ca-primary)' }}>{m.v}</div>
                <div className="mt-3 font-heading text-sm font-bold text-[color:var(--ca-ink)]">{m.l}</div>
                <p className="mx-auto mt-1.5 max-w-[15rem] text-xs leading-relaxed text-slate-500">{m.note}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (offset 3-up grid) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Loved by <span style={{ color: 'var(--ca-primary)' }}>nutritionists &amp; dietitians</span> across India.
            </Reveal>
          </div>
          <div className="mt-12 grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) * 0.06} className={i % 2 === 1 ? 'lg:mt-10' : ''}>
                <figure className="flex h-full flex-col rounded-[16px] border border-black/[0.08] bg-white p-6">
                  <span aria-hidden className="font-heading text-5xl leading-[0.6]" style={{ color: 'var(--ca-accent)' }}>&ldquo;</span>
                  <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">{t.quote}</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-black/5 pt-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--ca-primary)' }}>{t.name.charAt(0)}</span>
                    <div className="min-w-0">
                      <div className="text-[13px] font-bold text-[color:var(--ca-ink)]">{t.name}</div>
                      <div className="text-[11px] text-slate-500">{t.role} · {t.company}</div>
                    </div>
                    <span className="ml-auto flex gap-0.5">{[0, 1, 2, 3, 4].map((n) => <Star key={n} size={12} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (two side-by-side cards) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Old booking vs <span style={{ color: 'var(--ca-primary)' }}>online booking.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              See what changes for your day when clients book themselves.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 md:gap-6">
            {/* muted "Before" card */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[18px] border border-black/[0.08] bg-white/60 p-7 sm:p-8">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400"><X size={16} /></span>
                  <h3 className="font-heading text-base font-bold text-slate-500">{COMPARE.old.label}</h3>
                </div>
                <ul className="mt-6 space-y-3">
                  {COMPARE.old.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm">
                      <X size={17} className="mt-0.5 flex-shrink-0 text-slate-300" />
                      <span className="text-slate-500 line-through decoration-slate-300">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            {/* green "With Meeticulous" card */}
            <Reveal delay={0.08}>
              <div className="flex h-full flex-col rounded-[18px] p-7 text-white shadow-[0_24px_60px_-34px_rgba(21,128,61,0.7)] sm:p-8" style={{ background: 'var(--ca-primary)' }}>
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white"><Check size={16} /></span>
                  <h3 className="font-heading text-base font-bold text-white">{COMPARE.now.label}</h3>
                </div>
                <ul className="mt-6 space-y-3">
                  {COMPARE.now.points.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-sm">
                      <Check size={17} className="mt-0.5 flex-shrink-0" style={{ color: '#FDE68A' }} />
                      <span className="font-medium text-white/95">{p}</span>
                    </li>
                  ))}
                </ul>
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
              Start small. <span style={{ color: 'var(--ca-primary)' }}>Grow as your practice does.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              Choose a plan that fits your practice today. Upgrade when you need more.
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

          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Free */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[18px] border border-black/[0.08] bg-white p-7">
                <div className="font-heading text-lg font-bold">{FREE_PLAN.name}</div>
                <p className="mt-1 text-sm text-slate-500">Everything you need to get booked.</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold">₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight">0</span>
                  <span className="pb-2 text-sm text-slate-500">/month</span>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-500">Free forever · 5% per booking</p>
                <ul className="mt-6 flex flex-col gap-3">
                  {FREE_PLAN.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <CtaButton to={START} variant="ghost" className="w-full">Start on the Free Plan</CtaButton>
                </div>
              </div>
            </Reveal>

            {/* Premium — recommended */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[18px] border-2 bg-white p-7 shadow-[0_24px_60px_-34px_rgba(20,38,26,0.35)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
                <div className="flex items-center gap-2">
                  <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-primary)' }}>Recommended</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Keep every rupee. Automate the rest.</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold" style={{ color: 'var(--ca-primary)' }}>₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight" style={{ color: 'var(--ca-primary)' }}>{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                  <span className="pb-2 text-sm text-slate-500">/month</span>
                  {yearly && <span className="pb-2 ml-1 text-sm text-slate-400 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-500">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST included` : 'Billed monthly · GST included'}</p>
                <ul className="mt-6 flex flex-col gap-3">
                  <li className="flex items-start gap-2.5 text-sm font-semibold text-[color:var(--ca-ink)]">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>Everything in Free</span>
                  </li>
                  {PREMIUM_PLAN.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-7">
                  <CtaButton to={START} className="w-full">Go Sloth Active</CtaButton>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="mt-8 text-center">
            <Link to="/pricing" className="text-sm font-semibold text-slate-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 10 · ABOUT (statement + 2x2 trust grid + ImgSlot cluster) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* ImgSlot cluster */}
          <Reveal className="order-2 grid grid-cols-2 gap-4 lg:order-1">
            <ImgSlot alt="A nutritionist reviewing a client's diet plan" className="col-span-2 aspect-[16/10] shadow-[0_24px_50px_-28px_rgba(20,38,26,0.4)]" />
            <ImgSlot alt="Fresh, colourful whole foods on a plate" className="aspect-square shadow-[0_18px_40px_-24px_rgba(20,38,26,0.4)]" />
            <ImgSlot alt="A calm nutrition consultation in progress" className="aspect-square shadow-[0_18px_40px_-24px_rgba(20,38,26,0.4)]" />
          </Reveal>

          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
              Small practices deserve <span style={{ color: 'var(--ca-primary)' }}>better tools.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-slate-600">
              Meeticulous was built to make appointment-based practices easier to run. Instead of stitching together calendars, DMs, spreadsheets and payment tools, nutritionists can manage their client consults from one clean platform. Built for Indian professionals, designed for the way modern practices actually work.
            </Reveal>
            <Reveal delay={0.12} className="mt-8 grid grid-cols-2 gap-3">
              {TRUST_STRIP.map((it) => (
                <div key={it.value} className="flex flex-col rounded-[14px] border border-black/[0.08] bg-white p-4 text-left">
                  <it.icon size={18} style={{ color: 'var(--ca-primary)' }} />
                  <div className="mt-2 text-sm font-bold text-[color:var(--ca-ink)]">{it.value}</div>
                  <p className="mt-0.5 text-xs leading-snug text-slate-500">{it.label}</p>
                </div>
              ))}
            </Reveal>
          </div>
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

      {/* ═══════════════ 12 · FINAL CTA (green + citrus glow + dot texture) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[24px] px-8 py-16 text-center sm:px-12" style={{ background: 'linear-gradient(150deg, #0F4F27 0%, #15803D 100%)' }}>
          {/* subtle dot texture */}
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
          {/* citrus glow (mix-blend-screen) */}
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(202,138,4,0.6), transparent)' }} />
          <div className="relative mx-auto max-w-2xl">
            <Reveal as="h2" className="font-heading text-[clamp(1.8rem,4.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Spend less time scheduling. Spend more time with clients.
            </Reveal>
            <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/80">
              Set up your booking page today — free forever, ready to share in minutes.
            </Reveal>
            <Reveal delay={0.1} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
                Get Started Now <ArrowRight size={16} />
              </Link>
              <Link to={LOGIN} className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
                Log In
              </Link>
            </Reveal>
            <Reveal delay={0.14} className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
              {['No credit card', 'Free forever', '0% on Sloth Active'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/75"><Check size={14} style={{ color: '#FDE68A' }} /> {t}</span>
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
              <p className="mt-2 max-w-xs text-sm text-slate-500">The fresher way to manage your diet consults.</p>
              <CtaButton to={START} className="mt-5">Launch My Page — Free <ArrowRight size={15} /></CtaButton>
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
            <p className="text-xs text-slate-500">Made for India&apos;s nutritionists &amp; dietitians</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
