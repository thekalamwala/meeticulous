// /for/spa — bespoke, conversion-focused landing page for spas & wellness
// centres in India. (Profession design rebuild — Sept release train.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx route, prerender.mjs,
// sitemapService.js, Navbar "Spas & Wellness Centres" entry.
//
// DESIGN: a serene SAGE + STONE "quiet luxury" system with lots of breathing room
// — deliberately distinct from every sibling /for/ page. Mechanics unique here:
// centered overlapping-ImgSlot hero cluster with outline pills · a spa TREATMENT
// MENU (leader-dot price-list rows grouped by quiet section labels — not cards,
// not bento) · a light-weight numeral impact band with hairline separators · four
// soft numbered steps on a thin connecting line · a logo row in one soft panel ·
// a serene hairline-divided 3-up of quotes · two soft before/after columns · two
// soft sage pricing cards · a split about with ImgSlot + trust facts · accordion
// FAQ · a sage final CTA with a stone mix-blend glow. Only nav/hero-shell/footer
// may resemble siblings.
//
// IMAGES: intentional EMPTY ImgSlot placeholders with descriptive aria-label.
//
// HONESTY: Meeticulous is a scheduling + payment tool, not a wellness/medical
// product — no treatment or wellness-outcome claims. Testimonials are labelled
// placeholders from spa OWNERS/MANAGERS about ADMIN relief (no-shows, front-desk,
// deposits). Trust facts are verifiable only; JSON-LD has NO aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// billing switch + accordion, AA-contrast palette (primary ~6:1 on white), visible
// focus, NO hover uplift anywhere, Reveal guards its own motion.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus,
  CalendarCheck, BellRing,LayoutDashboard, Share2,
  Hand, Droplet, Sparkles, Wind, Sun, Leaf,
  Landmark, Lock, ShieldCheck, BadgePercent, Flower2,
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
  { label: 'Treatments', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const MASCOT = '/for/spa/hero.webp';
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian spas'];

// Spa treatment MENU — grouped, leader-dot rows (not cards, not bento).
const SERVICE_GROUPS = [
  {
    label: 'Massage & Bodywork',
    items: [
      { icon: Hand, label: 'Massage Therapy', desc: 'Swedish, deep-tissue and relaxation massages.' },
      { icon: Droplet, label: 'Body Treatments', desc: 'Scrubs, wraps and hydrotherapy.' },
      { icon: Wind, label: 'Aromatherapy', desc: 'Essential-oil and aroma sessions.' },
    ],
  },
  {
    label: 'Face, Heat & Journeys',
    items: [
      { icon: Sparkles, label: 'Facials & Skincare', desc: 'Facials, glow treatments and skincare.' },
      { icon: Sun, label: 'Sauna & Steam', desc: 'Sauna, steam and heat therapy.' },
      { icon: Leaf, label: 'Wellness Packages', desc: 'Half-day and full-day spa journeys.' },
    ],
  },
];

// Four soft numbered steps on a thin connecting line.
const STEPS = [
  { title: 'Set up your treatments', icon: LayoutDashboard, desc: 'Add your services, prices and slots in minutes.' },
  { title: 'Share your booking link', icon: Share2, desc: 'Put it on Instagram, Google or your reception desk — one link.' },
  { title: 'Guests book & pay', icon: CalendarCheck, desc: 'A guest picks a treatment and a time, and pays a booking amount upfront.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Automatic confirmations and WhatsApp reminders before every visit.' },
];

// Integration logo row — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg' },
  { name: 'Razorpay', logo: razorpayLogo },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg' },
];

// Light-weight numeral impact band.
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night' },
  { v: '0%', l: 'Commission on Sloth Active' },
  { v: '₹0', l: 'To get started' },
  { v: 'GST', l: 'Invoices, automatic' },
];

// Placeholder testimonials — spa OWNERS/MANAGERS about admin relief, never guests
// about wellness or appearance outcomes.
const TESTIMONIALS = [
  { quote: 'Our front desk used to spend all day on the phone fixing appointment times. Now guests book on our link and it is confirmed — the calm we sell finally starts at reception.', name: 'Meera Pillai', role: 'Owner', company: 'Serenity Spa, Goa' },
  { quote: 'Taking an advance at booking almost ended our no-shows. Fewer empty treatment rooms for the team.', name: 'Rohit Sharma', role: 'Spa Manager', company: 'Tranquil Wellness, Rishikesh' },
  { quote: 'Automatic WhatsApp reminders mean guests arrive on time and relaxed. Our therapists love the smoother day.', name: 'Anita Rao', role: 'Founder', company: 'Bliss Retreat, Bengaluru' },
];

// Before / after — two soft columns.
const OLD_WAY = [
  'Phone rings all day to fix appointment times',
  'No-shows leave treatment rooms empty',
  'Chasing advances at the front desk',
  'A messy paper diary and sticky notes',
  'Two guests booked into one room by hand',
];
const NEW_WAY = [
  'One booking link — guests self-serve 24/7',
  'Advance at booking keeps rooms full',
  'Fees collected upfront over UPI or card',
  'One calm, calendar-synced spa view',
  'Conflict-free rooms — no double bookings',
];

// Trust facts — verifiable only.
const TRUST = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your spa data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Sloth Active — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for spas and wellness centres?', a: 'Yes. Whether you are a boutique spa or a wellness centre with a team of therapists, Meeticulous manages your services, availability, guest bookings and communication from one place — so your front desk runs without the constant phone calls.' },
  { q: 'Can guests book treatments online?', a: 'Yes. A guest opens your booking link, chooses a treatment such as a massage or facial, picks a convenient time and confirms — no calls or waiting for the desk to reply.' },
  { q: 'Can I take an advance to cut no-shows?', a: 'Yes. Collect a booking amount or the full price upfront through Razorpay — UPI, cards or netbanking — when the guest books. Taking an advance is the simplest way to reduce no-shows.' },
  { q: 'Can I sell spa packages and memberships?', a: 'Yes. Offer half-day and full-day spa journeys, multi-session packages and recurring bookings, each with its own duration, price and availability.' },
  { q: 'Can I share my booking link on Instagram?', a: 'Yes. Your link works anywhere — put it in your Instagram bio, on WhatsApp, on Google or on your reception desk. One link handles all your appointment requests.' },
  { q: 'Can I manage multiple therapists and rooms?', a: 'Yes. Create as many services as you need and manage every appointment from one calm calendar, so no two guests are booked into the same therapist or room.' },
  { q: 'Does every booking get a GST invoice?', a: 'Yes. A GST invoice is generated automatically for every paid booking, and payouts go to your bank once KYC is complete.' },
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
    { label: 'Spas & Wellness Centres', to: '/for/spa' },
    { label: 'Salons & Beauticians', to: '/for/salon' },
    { label: 'Life & Wellness Coaches', to: '/for/life-coaches' },
    { label: 'Nutritionists & Dietitians', to: '/for/nutritionists' },
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
    solid: 'text-white shadow-[0_4px_14px_rgba(63,107,94,0.24)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/28',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

function ImgSlot({ alt, className = '', rounded = 'rounded-[20px]' }) {
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

export default function Spas() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/spa`;
  const seo = {
    title: 'Appointment Booking Software for Spas & Wellness Centres | Meeticulous',
    description: 'Meeticulous is appointment booking software for spas and wellness centres in India. Let guests book massages, facials and spa treatments online — advance payments, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'spa appointment booking software, wellness centre booking system india, book spa treatment online, massage booking software, spa scheduling app india, wellness spa booking page',
    ogTitle: 'The calm you sell — starting at your spa booking page.',
    ogDescription: 'Guests book massages, facials and spa journeys, pay an advance and get WhatsApp reminders — automatically. A serene booking page for spas and wellness centres in India. Free forever, no card required.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Spas & Wellness Centres',
    serviceType: 'Appointment booking software for spas and wellness centres',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Serene sage + stone "quiet luxury" spa palette — legacy --ca-* var names kept.
  const styleVars = {
    '--ca-primary': '#3F6B5E', // deep sage-teal — text/links/fills, AA on white (~6:1)
    '--ca-accent': '#B08968',  // warm stone/tan — decorative only (not AA for text)
    '--ca-ink': '#24322E',     // deep evergreen-slate text
    '--ca-cream': '#F1F5F2',   // soft mint-grey section bg
    '--ca-grey': '#F4F2EE',    // warm stone-grey section bg
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
        themeColor="#3F6B5E"
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

      {/* ═══════════════ 2 · HERO (centered composition + overlapping ImgSlot cluster) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-20 pt-14 text-center sm:px-8 lg:pb-28 lg:pt-20" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 62%)' }}>
        {/* soft blurred blobs — mix-blend-multiply so they sit INTO the page */}
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[-6rem] h-[26rem] w-[40rem] -translate-x-1/2 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(63,107,94,0.14), transparent)' }} />
        <div aria-hidden className="pointer-events-none absolute right-[-4rem] top-24 h-72 w-72 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(176,137,104,0.16), transparent)' }} />

        <div className="relative z-10 mx-auto max-w-3xl">
          <Reveal as="h1" instant className="mx-auto max-w-2xl font-heading text-[clamp(1.5rem,5vw,3.15rem)] font-extrabold leading-[1.06] tracking-[-0.02em] text-[color:var(--ca-ink)]">
            Seamless appointment booking software for{' '}
            <span style={{ color: 'var(--ca-primary)' }}>spas and wellness centres.</span>
          </Reveal>
          <Reveal as="p" instant delay={0.05} className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Meeticulous is appointment booking software for spas — guests book massages, facials and treatments, pay an advance, and get gentle reminders, from one serene booking page.
          </Reveal>
          <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-5">
            <CtaButton to={START} className="w-full sm:w-auto">Create Your Booking Page <ArrowRight size={16} /></CtaButton>
            <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
              Book A Demo <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
          <Reveal instant delay={0.14} className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {HERO_TRUST.map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
                <Check size={14} style={{ color: 'var(--ca-primary)' }} /> {t}
              </span>
            ))}
          </Reveal>
        </div>

        {/* centered cluster of overlapping rounded ImgSlots + thin outline pills */}
        <Reveal instant delay={0.2} className="pointer-events-none absolute bottom-0 right-0 z-0 hidden w-72 opacity-90 lg:block xl:right-8 xl:w-80">
          <ImgSlot alt="A serene spa treatment room with soft lighting" className="aspect-[3/4] w-full" />
        </Reveal>
      </section>

      {/* ═══════════════ 3 · SERVICES (spa treatment menu — leader-dot rows) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for spas, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-xl text-base text-slate-500">
              From massages to facials, body treatments and spa journeys — let guests reserve any treatment in seconds.
            </Reveal>
          </div>

          <div className="mt-14 space-y-14">
            {SERVICE_GROUPS.map((group, gi) => (
              <Reveal key={group.label} delay={gi * 0.06}>
                <div className="mb-6 flex items-center gap-3">
                  <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: 'var(--ca-accent)' }} />
                  <h3 className="font-heading text-[12px] font-bold uppercase tracking-[0.2em]" style={{ color: 'var(--ca-primary)' }}>{group.label}</h3>
                  <span aria-hidden className="h-px flex-1" style={{ background: 'color-mix(in srgb, var(--ca-ink) 12%, transparent)' }} />
                </div>
                <ul className="space-y-5">
                  {group.items.map((item) => (
                    <li key={item.label} className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline">
                      <span className="flex items-center gap-2.5 font-heading text-[15px] font-semibold text-[color:var(--ca-ink)]">
                        <item.icon size={16} style={{ color: 'var(--ca-accent)' }} aria-hidden />
                        {item.label}
                      </span>
                      <span aria-hidden className="mx-3 hidden flex-1 border-b border-dotted sm:block" style={{ borderColor: 'color-mix(in srgb, var(--ca-ink) 22%, transparent)', transform: 'translateY(-0.28em)' }} />
                      <span className="mt-0.5 text-[13.5px] leading-snug text-slate-500 sm:mt-0 sm:max-w-[46%] sm:text-right">{item.desc}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1} className="mt-14 text-center">
            <CtaButton to={START}>Start a Free Page <ArrowRight size={16} /></CtaButton>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (soft numbered steps on a thin line) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From a ringing phone to a <span style={{ color: 'var(--ca-primary)' }}>confirmed treatment.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">Four calm steps — live in minutes, booked in seconds.</Reveal>
          </div>
          <div className="relative mt-16 grid gap-y-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <span aria-hidden className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-6 hidden h-px lg:block" style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--ca-primary) 32%, transparent) 18%, color-mix(in srgb, var(--ca-primary) 32%, transparent) 82%, transparent)' }} />
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08} className="relative text-center">
                <span className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full border bg-white font-heading text-[13px] font-semibold" style={{ borderColor: 'color-mix(in srgb, var(--ca-primary) 32%, transparent)', color: 'var(--ca-primary)' }}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="mt-5 flex items-center justify-center gap-2">
                  <s.icon size={16} style={{ color: 'var(--ca-accent)' }} aria-hidden />
                  <h3 className="font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                </div>
                <p className="mx-auto mt-2 max-w-[15rem] text-[13.5px] leading-relaxed text-slate-500">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (logo row in a soft panel) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Calendar, payments and WhatsApp — Meeticulous fits your spa, no rewiring.
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-12 rounded-[28px] border border-black/[0.06] p-8 sm:p-12" style={{ background: 'var(--ca-cream)' }}>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-8 sm:gap-x-14">
              {TOOLS.map((t) => (
                <div key={t.name} className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_6px_18px_-12px_rgba(36,50,46,0.5)]">
                    {t.logo ? <img src={t.logo} alt="" loading="lazy" className="h-6 w-6 object-contain" /> : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
                  </span>
                  <span className="text-sm font-bold text-[color:var(--ca-ink)]">{t.name}</span>
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

      {/* ═══════════════ 6 · IMPACT (light-weight numeral band + hairline separators) ═══════════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-y-12 lg:grid-cols-4 lg:gap-y-0 lg:divide-x lg:divide-black/[0.09]">
            {METRICS.map((m, i) => (
              <Reveal key={m.l} delay={i * 0.06} className="px-4 text-center sm:px-8">
                <div className="font-heading text-[3.25rem] font-light leading-none tracking-tight text-[color:var(--ca-ink)] sm:text-6xl">{m.v}</div>
                <div className="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-500">{m.l}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (serene hairline-divided 3-up) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Spas that swapped the <span style={{ color: 'var(--ca-primary)' }}>phone for a link.</span>
            </Reveal>
          </div>
          <div className="mt-14 grid gap-y-12 sm:grid-cols-3 sm:gap-0 sm:divide-x sm:divide-black/[0.08]">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 0.08} className="px-0 sm:px-8">
                <figure className="flex h-full flex-col">
                  <span aria-hidden className="font-heading text-5xl leading-none" style={{ color: 'color-mix(in srgb, var(--ca-accent) 60%, transparent)' }}>&ldquo;</span>
                  <blockquote className="mt-1 text-[15px] leading-relaxed text-slate-600">{t.quote}</blockquote>
                  <figcaption className="mt-6">
                    <div className="text-[14px] font-bold text-[color:var(--ca-ink)]">{t.name}</div>
                    <div className="mt-0.5 text-[12.5px] text-slate-500">{t.role} · {t.company}</div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (two soft columns) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The old front desk vs <span style={{ color: 'var(--ca-primary)' }}>a calmer spa day.</span>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2 md:gap-6">
            {/* the manual way — muted */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[22px] border border-black/[0.07] bg-white p-8">
                <h3 className="font-heading text-sm font-bold uppercase tracking-[0.14em] text-slate-400">The manual way</h3>
                <ul className="mt-6 space-y-4">
                  {OLD_WAY.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-[14.5px] text-slate-500">
                      <X size={17} className="mt-0.5 flex-shrink-0 text-slate-300" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            {/* with Meeticulous — sage */}
            <Reveal delay={0.08}>
              <div className="flex h-full flex-col rounded-[22px] border p-8" style={{ background: 'color-mix(in srgb, var(--ca-primary) 6%, white)', borderColor: 'color-mix(in srgb, var(--ca-primary) 24%, transparent)' }}>
                <h3 className="font-heading text-sm font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ca-primary)' }}>With Meeticulous</h3>
                <ul className="mt-6 space-y-4">
                  {NEW_WAY.map((p) => (
                    <li key={p} className="flex items-start gap-3 text-[14.5px] font-medium text-[color:var(--ca-ink)]">
                      <Check size={17} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ca-primary)' }} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · PRICING (two soft sage cards + billing toggle) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start free. <span style={{ color: 'var(--ca-primary)' }}>Grow as your spa does.</span>
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
            {/* Sloth (free) */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[22px] border border-black/[0.08] bg-white p-8 shadow-[0_18px_50px_-32px_rgba(36,50,46,0.3)]">
                <div className="font-heading text-lg font-bold">{FREE_PLAN.name}</div>
                <p className="mt-1 text-sm text-slate-500">Everything you need to get booked.</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold">₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight">0</span>
                  <span className="pb-2 text-sm text-slate-500">/mo · 5% per booking</span>
                </div>
                <ul className="mt-6 flex flex-col gap-3">
                  {FREE_PLAN.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} variant="ghost" className="mt-7 w-full">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>

            {/* Sloth Active (premium) — recommended */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] border-2 p-8 shadow-[0_24px_60px_-32px_rgba(36,50,46,0.35)]" style={{ background: 'color-mix(in srgb, var(--ca-primary) 6%, white)', borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
                <div className="flex items-center gap-2">
                  <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-primary)' }}>Recommended</span>
                </div>
                <p className="mt-1 text-sm text-slate-500">Keep every rupee. Automate the rest.</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold" style={{ color: 'var(--ca-primary)' }}>₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight" style={{ color: 'var(--ca-primary)' }}>{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                  <span className="pb-2 text-sm text-slate-500">/mo</span>
                  {yearly && <span className="ml-1 pb-2 text-sm text-slate-400 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-500">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST incl.` : 'Billed monthly · GST included'}</p>
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
                <CtaButton to={START} className="mt-7 w-full">Go Sloth Active</CtaButton>
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
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
              Wellness businesses deserve tools as calm as the care they give.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-slate-600">
              Meeticulous was built to make appointment-based businesses easier to run. Instead of a ringing phone, a paper diary and scattered payments, spas manage their bookings, guests and money from one serene platform — built for the way Indian practices actually work.
            </Reveal>
            <Reveal delay={0.12} className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {TRUST.map((f) => (
                <div key={f.value} className="flex items-start gap-3 text-left">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--ca-primary) 9%, transparent)', color: 'var(--ca-primary)' }}>
                    <f.icon size={17} />
                  </span>
                  <div>
                    <div className="text-[13.5px] font-bold text-[color:var(--ca-ink)]">{f.value}</div>
                    <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{f.label}</div>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
          <Reveal delay={0.06} className="relative order-1 mx-auto w-full max-w-md lg:order-2 lg:mx-0">
            <div aria-hidden className="pointer-events-none absolute -inset-4 rounded-[32px] blur-2xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(176,137,104,0.16), transparent)' }} />
            <ImgSlot alt="A therapist preparing a serene spa treatment room" className="relative aspect-[4/5] w-full shadow-[0_28px_60px_-34px_rgba(36,50,46,0.5)]" />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · FAQ (accordion) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 12 · FINAL CTA (sage + stone mix-blend glow) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] px-8 py-16 text-center sm:px-12 lg:py-20" style={{ background: 'linear-gradient(150deg, #2E5247 0%, #3F6B5E 100%)' }}>
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(176,137,104,0.55), transparent)' }} />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(176,137,104,0.3), transparent)' }} />
          <div className="relative mx-auto max-w-2xl">
            <Reveal className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(176,137,104,0.2)' }}>
              <Flower2 size={26} style={{ color: '#E7D3BE' }} />
            </Reveal>
            <Reveal as="h2" delay={0.06} className="mt-6 font-heading text-[clamp(1.8rem,4.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Spend less time on the phone. Spend more time creating calm.
            </Reveal>
            <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75">
              Set up your spa&apos;s booking page today — free forever, ready to share in minutes.
            </Reveal>
            <Reveal delay={0.14} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.45)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
                Launch My Page — Free <ArrowRight size={16} />
              </Link>
              <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
                Book A Demo
              </Link>
            </Reveal>
            <Reveal delay={0.18} className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {['No credit card', 'Free forever', '0% on Sloth Active'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Check size={14} style={{ color: '#E7D3BE' }} /> {t}</span>
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
              <p className="mt-2 max-w-xs text-sm text-slate-500">The serene way to run your spa&apos;s bookings.</p>
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
            <p className="text-xs text-slate-500">Made for India&apos;s spas &amp; wellness centres</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
