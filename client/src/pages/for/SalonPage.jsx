// /for/salon — bespoke, conversion-focused landing page for salons, beauticians
// & beauty studios in India. (Sept release rebuild.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). This bespoke
// route PRECEDES /for/:profession in App.jsx. /for/salon is already in
// prerender.mjs and sitemapService.js and linked from Navbar/Solutions, so the
// wiring the main thread owns stays as-is; this file only redesigns the page.
//
// DESIGN — a chic fashion LOOKBOOK: big black display type on warm cream paper,
// with a single electric fuchsia accent. Deliberately unlike every sibling
// (cyan/rose derm, charcoal consultants, blue GP, teal/lime physio). Mechanics
// unique to this page: an oversized fashion-magazine hero with a rotated
// overlapping ImgSlot collage + fuchsia frame · a numbered LOOKBOOK service grid
// (big index numerals, uppercase labels, hover-reveal fuchsia underline) · big
// editorial testimonial quote blocks with ALTERNATING alignment · big-number
// horizontal steps split by fuchsia hairlines · a monochrome tool-logo row that
// colourises on hover · a fuchsia impact band with black numerals · two stacked
// before/after lists · a black+fuchsia two-card pricing · an editorial about with
// ruled trust rows · and a black final CTA with a fuchsia mix-blend-screen glow.
// Only nav/hero shell/footer (shared) may resemble siblings.
//
// IMAGES: intentional EMPTY ImgSlot placeholders with descriptive alt text — swap
// real salon photography in later. (Favicon + tool logos are the only real imgs.)
//
// HONESTY: salons are NOT medical. Meeticulous is a scheduling + payment tool;
// testimonials are labelled placeholder quotes from salon OWNERS/managers about
// ADMIN relief (no-shows, front-desk calls, deposits, billing) — never client
// appearance/results. Trust facts are verifiable only; JSON-LD has NO
// aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// accordion + billing switch, AA-contrast palette (near-black text; fuchsia used
// large/bold on white or as a fill with white text), visible focus, NO hover
// uplift (color/shadow/underline/opacity/width only), Reveal guards its motion.
//
// Legacy --ca-* CSS var names are kept (shared classNames depend on them); only
// the VALUES change to the black + fuchsia editorial palette.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star, Sparkles,
  CalendarCheck, LayoutDashboard, BellRing,
  Lock, Landmark, FileText, BadgePercent,
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

const MASCOT = '/for/salon/hero.webp';
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian salons'];

// LOOKBOOK service grid — number + uppercase label + desc (no icons, by design).
const SERVICES = [
  { label: 'Haircut & Styling', desc: 'Cuts, blow-dry and styling appointments.' },
  { label: 'Hair Colour & Treatment', desc: 'Colour, highlights, keratin and spa.' },
  { label: 'Facials & Skincare', desc: 'Clean-ups, facials and skin treatments.' },
  { label: 'Manicure & Pedicure', desc: 'Nail care, gel and nail art sessions.' },
  { label: 'Makeup & Bridal', desc: 'Party, bridal and occasion makeup.' },
  { label: 'Spa, Waxing & Threading', desc: 'Massage, waxing and grooming.' },
];

// Big-number horizontal steps.
const STEPS = [
  { title: 'Set up your services', icon: LayoutDashboard, desc: 'Add your treatments, prices and slots, then share your booking link.' },
  { title: 'Clients book & pay', icon: CalendarCheck, desc: 'A client picks a service and a time, and pays a booking amount upfront.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'You and your client get automatic confirmations and WhatsApp reminders.' },
];

// Monochrome tool-logo row — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg' },
  { name: 'Razorpay', logo: razorpayLogo },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg' },
  { name: 'Client Records', logo: '/favicon.svg' },
];

// Fuchsia impact band — black numerals.
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night', note: 'Your booking page never sleeps — clients reserve slots any time.' },
  { v: '100%', l: 'Kept on Sloth Active', note: '0% commission — every rupee you earn stays yours.' },
  { v: '₹0', l: 'To get started', note: 'Free forever plan — no card, no lock-in.' },
  { v: 'GST', l: 'Invoices, automatic', note: 'A tax invoice generated for every paid booking.' },
];

// Editorial quote blocks — salon OWNERS/managers about admin relief, never clients about looks.
const TESTIMONIALS = [
  { quote: 'The front desk used to spend all morning on the phone fixing appointment times. Now clients book on our link and it is confirmed — the chaos is gone.', name: 'Priya Sharma', role: 'Owner', company: 'Glow Studio, Mumbai' },
  { quote: 'Taking an advance at booking almost ended our no-shows. Fewer empty chairs, fewer wasted slots for the team.', name: 'Ritu Malhotra', role: 'Salon Manager', company: 'Blush Salon, Delhi' },
  { quote: 'Automatic WhatsApp reminders mean clients actually turn up on time. Our stylists love the calmer day.', name: 'Anjali Nair', role: 'Founder', company: 'Radiance Beauty, Kochi' },
  { quote: 'Clients book their facials and colour without waiting for us to reply on WhatsApp. Setup took one evening.', name: 'Kavya Reddy', role: 'Owner', company: 'Velvet Salon, Hyderabad' },
  { quote: 'One calendar for the whole salon means no two clients booked into the same chair by mistake.', name: 'Neha Kapoor', role: 'Director', company: 'Bloom Studio, Pune' },
  { quote: 'A pretty booking page, 0% commission on Active, and payments straight to our account. It just works.', name: 'Sana Khan', role: 'Owner', company: 'Aura Beauty Bar, Bengaluru' },
];

// Two stacked before/after lists.
const OLD_WAY = [
  { title: 'Phone rings all day', desc: 'The front desk juggles calls to fix appointment times.' },
  { title: 'No-shows leave chairs empty', desc: 'A missed appointment is a slot you cannot fill.' },
  { title: 'Chasing advances', desc: 'You follow up for payment or take the risk of walk-outs.' },
  { title: 'A messy paper diary', desc: 'Appointments scribbled across a book and sticky notes.' },
  { title: 'Double-booked chairs', desc: 'Two clients booked into the same stylist by hand.' },
];
const NEW_WAY = [
  { title: 'A booking link that never rings', desc: 'Clients pick a slot themselves, 24/7 — the desk stays calm.' },
  { title: 'Advance cuts no-shows', desc: 'A deposit at booking keeps your chairs full.' },
  { title: 'Paid upfront', desc: 'Booking amount taken online, over UPI or card.' },
  { title: 'One neat calendar', desc: 'Every appointment and stylist in a single view.' },
  { title: 'Conflict-free chairs', desc: 'Availability stays accurate — no double bookings.' },
];

// Trust facts — verifiable only.
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your salon data runs on servers in Mumbai' },
  { icon: FileText, value: 'DPDP 2023', label: 'Operated under India’s data protection law' },
  { icon: BadgePercent, value: '0% commission', label: 'On Sloth Active — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for salons and beauty studios?', a: 'Yes. Whether you are a solo beautician or a salon with a team of stylists, Meeticulous manages your services, availability, client bookings and communication from one place — so your front desk runs without the constant phone calls.' },
  { q: 'Can clients book appointments online?', a: 'Yes. A client opens your booking link, chooses a service such as a haircut, facial or colour, picks a convenient time and confirms — no calls or waiting for the desk to reply.' },
  { q: 'Can I take an advance payment to cut no-shows?', a: 'Yes. Collect a booking amount or the full price upfront through Razorpay — UPI, cards or netbanking — when the client books. Taking an advance is the simplest way to reduce no-shows.' },
  { q: 'Can I share my booking link on Instagram?', a: 'Yes. Your link works anywhere — put it in your Instagram bio, on WhatsApp, on Google or on your storefront. One link handles all your appointment requests.' },
  { q: 'Can I manage multiple stylists and services?', a: 'Yes. Create as many services as you need — hair, skin, nails, makeup, spa — each with its own duration, price and availability, and manage every appointment from one calendar.' },
  { q: 'Do I need any technical knowledge?', a: 'No. Setup takes minutes and needs no technical skills. You add your services and slots, and your booking page is ready to share — your clients need nothing more than the link.' },
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
    { label: 'Salons & Beauticians', to: '/for/salon' },
    { label: 'Life & Wellness Coaches', to: '/for/life-coaches' },
    { label: 'Fitness Trainers', to: '/for/fitness' },
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
    solid: 'text-white shadow-[0_4px_14px_rgba(17,17,17,0.25)] hover:shadow-[0_8px_22px_rgba(17,17,17,0.34)]',
    ghost: 'border-2 border-[color:var(--ca-ink)]/15 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/35',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

/* Empty image placeholder — warm cream → fuchsia-tint. */
function ImgSlot({ alt, className = '', rounded = 'rounded-[10px]' }) {
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

/* Two-column single-open FAQ accordion (restyled — fuchsia on open). */
function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="overflow-hidden rounded-[12px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'var(--ca-accent)' : 'rgba(17,17,17,0.1)' }}>
        <button
          type="button"
          onClick={() => setOpen(isOpen ? -1 : i)}
          aria-expanded={isOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-[color:var(--ca-ink)]"
        >
          {f.q}
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-transform duration-300" style={{ backgroundColor: 'color-mix(in srgb, var(--ca-accent) 12%, transparent)', color: 'var(--ca-accent)', transform: isOpen ? 'rotate(45deg)' : 'none' }}>
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

export default function SalonPage() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/salon`;
  const seo = {
    title: 'Appointment Booking Software for Salons & Beauticians | Meeticulous',
    description: 'Meeticulous is appointment booking software for salons, spas and beauticians in India. Let clients book haircuts, facials, colour and bridal appointments online — advance payments, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'salon appointment booking software, beauty parlour booking system india, book salon appointment online, spa scheduling software, beautician booking page, salon booking app india, hair salon scheduling',
    ogTitle: 'Your salon runs on appointments. Let Meeticulous book them.',
    ogDescription: 'Clients book haircuts, facials and bridal appointments, pay an advance and get WhatsApp reminders — automatically. The booking page every salon in India should have.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Salons & Beauticians',
    serviceType: 'Appointment booking software for salons and beauticians',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Chic editorial: near-black + electric fuchsia on warm cream. Legacy --ca-* names kept.
  const styleVars = {
    '--ca-primary': '#111111', // near-black — display type + fills with white text (~19:1 on white)
    '--ca-accent': '#D6009A',  // electric fuchsia — AA on white (~4.8:1); as fill uses white text
    '--ca-ink': '#171717',     // near-black body text
    '--ca-cream': '#FBF7F4',   // warm cream section bg
    '--ca-grey': '#F3EEEA',    // soft warm grey section bg
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
        themeColor="#111111"
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

      {/* ═══════════════ 2 · HERO (fashion-magazine headline + rotated collage) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(214,0,154,0.22), transparent)' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          {/* LEFT — oversized display headline */}
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,4rem)] font-black leading-[1.02] tracking-[-0.03em] text-[color:var(--ca-ink)]">
              Smart appointment booking software for{' '}
              <span style={{ color: 'var(--ca-accent)' }}>salons and beauticians</span> managing busy schedules.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-6 max-w-md text-base leading-relaxed text-neutral-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for salons — clients book haircuts, facials and bridal appointments, pay an advance, and get reminders, so your chairs stay booked and no-shows drop.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Create Your Booking Page <ArrowRight size={16} /></CtaButton>
              <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-accent)] hover:no-underline">
                Book A Demo <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
                  <Check size={14} style={{ color: 'var(--ca-accent)' }} /> {t}
                </span>
              ))}
            </Reveal>
          </div>

          {/* RIGHT — rotated overlapping collage + fuchsia frame + floating card */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-md">
            <div className="relative aspect-[5/6] w-full">
              <div aria-hidden className="absolute inset-x-8 inset-y-10 rotate-[7deg] rounded-[8px] border-2" style={{ borderColor: 'var(--ca-accent)' }} />
              <ImgSlot alt="A stylist finishing a client's blow-dry at the salon chair" className="absolute inset-0 h-full w-full" />
              <div className="absolute -bottom-3 left-[6%] z-20 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-[0_18px_40px_-18px_rgba(17,17,17,0.5)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-accent)' }}><Star size={17} /></span>
                <div><div className="text-[11px] text-neutral-500">This week</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">Fully booked</div></div>
              </div>
              <div className="absolute -top-4 -left-4 z-20 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-[0_18px_40px_-18px_rgba(17,17,17,0.5)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-accent)' }}><CalendarCheck size={17} /></span>
                <div><div className="text-[11px] text-neutral-500">New booking</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">Haircut · 2:00 PM</div></div>
              </div>
              <div className="absolute -top-4 -right-4 z-20 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-[0_18px_40px_-18px_rgba(17,17,17,0.5)]">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-accent)' }}><BellRing size={17} /></span>
                <div><div className="text-[11px] text-neutral-500">Reminder sent</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">1h before</div></div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (numbered LOOKBOOK grid) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-2xl">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              Appointment booking software for salons, <span style={{ color: 'var(--ca-accent)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-neutral-500">
              From haircuts to facials, colour, nails and bridal makeup — let clients book any treatment in seconds.
            </Reveal>
          </div>
          <div className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.05}>
                <Link to={START} className="group block h-full border-t pt-6 transition-colors hover:no-underline border-black/10 hover:border-[color:var(--ca-accent)]">
                  <div aria-hidden className="font-heading text-5xl font-black leading-none" style={{ color: 'rgba(17,17,17,0.14)' }}>{String(i + 1).padStart(2, '0')}</div>
                  <h3 className="mt-5 font-heading text-[13px] font-bold uppercase tracking-[0.18em] text-[color:var(--ca-ink)]">{s.label}</h3>
                  <span aria-hidden className="mt-3 block h-[3px] w-0 rounded-full transition-all duration-300 group-hover:w-16" style={{ background: 'var(--ca-accent)' }} />
                  <p className="mt-4 text-sm leading-relaxed text-neutral-500">{s.desc}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (big-number horizontal steps) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              From a ringing phone to a <span style={{ color: 'var(--ca-accent)' }}>confirmed appointment.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">
              How Meeticulous helps salons — in three simple steps.
            </Reveal>
          </div>
          <div className="mt-14 grid gap-10 md:grid-cols-3 md:gap-0">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className={`h-full ${i > 0 ? 'md:border-l md:pl-10' : 'md:pr-10'}`} style={i > 0 ? { borderColor: 'color-mix(in srgb, var(--ca-accent) 35%, transparent)' } : undefined}>
                  <div className="font-heading text-6xl font-black leading-none" style={{ color: 'var(--ca-accent)' }}>{String(i + 1).padStart(2, '0')}</div>
                  <div className="mt-5 flex items-center gap-2">
                    <s.icon size={18} className="text-[color:var(--ca-ink)]" />
                    <h3 className="font-heading text-lg font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                  </div>
                  <p className="mt-2 max-w-xs text-sm leading-relaxed text-neutral-500">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (monochrome logo row) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal as="h2" className="font-heading text-3xl font-black leading-tight tracking-tight sm:text-4xl">
            Works with the tools you <span style={{ color: 'var(--ca-accent)' }}>already use.</span>
          </Reveal>
          <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">
            Connect your calendar, payments and WhatsApp — Meeticulous fits your salon, no rewiring.
          </Reveal>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-7">
            {TOOLS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 6) * 0.04}>
                <span className="inline-flex items-center gap-2.5 opacity-55 grayscale transition-all duration-300 hover:opacity-100 hover:grayscale-0">
                  <span className="flex h-9 w-9 items-center justify-center">
                    {t.logo ? <img src={t.logo} alt={t.name} loading="lazy" className="h-6 w-6 object-contain" /> : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
                  </span>
                  <span className="text-sm font-bold text-[color:var(--ca-ink)]">{t.name}</span>
                </span>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1} className="mt-12">
            <Link to="/pricing" className="group inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-accent)' }}>
              Explore All Features <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (fuchsia band, black numerals) ═══════════════ */}
      <section className="px-5 py-16 sm:px-8" style={{ background: 'var(--ca-accent)' }}>
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m, i) => (
            <Reveal key={m.l} delay={i * 0.06} className="text-center">
              <div className="font-heading text-5xl font-black tracking-tight text-black sm:text-6xl">{m.v}</div>
              <div className="mt-2 text-sm font-bold uppercase tracking-wide text-white">{m.l}</div>
              <p className="mx-auto mt-2 max-w-[15rem] text-xs leading-snug text-white">{m.note}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (editorial quote blocks, alternating) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              Salons that swapped the <span style={{ color: 'var(--ca-accent)' }}>phone for a link.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">
              How salons book more appointments and cut the admin with Meeticulous.
            </Reveal>
          </div>
          <div className="mx-auto mt-8 max-w-4xl divide-y divide-black/10">
            {TESTIMONIALS.map((t, i) => {
              const right = i % 2 === 1;
              return (
                <Reveal key={t.name} delay={(i % 2) * 0.05} className={`py-10 sm:py-12 ${right ? 'text-right' : ''}`}>
                  <div className={`max-w-2xl ${right ? 'ml-auto' : ''}`}>
                    <span aria-hidden className="font-heading text-6xl font-black leading-[0.6]" style={{ color: 'var(--ca-accent)' }}>&ldquo;</span>
                    <blockquote className="mt-2 font-heading text-xl font-semibold leading-snug tracking-tight text-[color:var(--ca-ink)] sm:text-[1.7rem] sm:leading-[1.25]">
                      {t.quote}
                    </blockquote>
                    <figcaption className="mt-5">
                      <div className="text-xs font-bold uppercase tracking-[0.2em] text-[color:var(--ca-ink)]">{t.name}</div>
                      <div className="mt-1 text-[13px] text-neutral-500">{t.role} · {t.company}</div>
                    </figcaption>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (two stacked lists) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              The old front desk vs <span style={{ color: 'var(--ca-accent)' }}>a calmer salon day.</span>
            </Reveal>
          </div>
          <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Before */}
            <Reveal>
              <h3 className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-400">The manual way</h3>
              <ul className="mt-5 divide-y divide-black/10 border-t border-black/10">
                {OLD_WAY.map((o) => (
                  <li key={o.title} className="flex items-start gap-3.5 py-4">
                    <X size={18} className="mt-0.5 flex-shrink-0 text-neutral-300" />
                    <div>
                      <p className="text-[15px] font-semibold text-neutral-500 line-through decoration-neutral-300">{o.title}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-neutral-400">{o.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
            {/* With Meeticulous */}
            <Reveal delay={0.08}>
              <h3 className="text-xs font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--ca-accent)' }}>With Meeticulous</h3>
              <ul className="mt-5 divide-y border-t" style={{ borderColor: 'color-mix(in srgb, var(--ca-accent) 22%, transparent)' }}>
                {NEW_WAY.map((n) => (
                  <li key={n.title} className="flex items-start gap-3.5 py-4" style={{ borderColor: 'color-mix(in srgb, var(--ca-accent) 22%, transparent)' }}>
                    <span className="mt-0.5 flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-white" style={{ background: 'var(--ca-accent)' }}><Check size={12} /></span>
                    <div>
                      <p className="text-[15px] font-bold text-[color:var(--ca-ink)]">{n.title}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-neutral-500">{n.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · PRICING (black + fuchsia two-card) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-black leading-tight tracking-tight sm:text-5xl">
              Start small. <span style={{ color: 'var(--ca-accent)' }}>Grow as your salon does.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-neutral-500">
              Choose a plan that fits your salon today. Upgrade when you need more.
            </Reveal>
          </div>

          <Reveal delay={0.1} className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>Monthly</button>
            <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: yearly ? 'var(--ca-accent)' : '#d4cfca', minHeight: 0 }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: yearly ? '22px' : '2px' }} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>
              Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: 'var(--ca-accent)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
            </span>
          </Reveal>

          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Sloth (free) */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[20px] border-2 border-black/10 bg-white p-7">
                <div className="font-heading text-lg font-bold">{FREE_PLAN.name}</div>
                <p className="mt-1 text-sm text-neutral-500">Everything you need to get booked.</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold">₹</span>
                  <span className="font-heading text-5xl font-black tracking-tight">0</span>
                  <span className="pb-2 text-sm text-neutral-500">/month</span>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-neutral-500">Free forever · 5% per booking</p>
                <ul className="mt-6 flex flex-col gap-3">
                  {FREE_PLAN.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-600">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex-1" />
                <CtaButton to={START} variant="ghost" className="w-full">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>

            {/* Sloth Active (premium) — black, recommended */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[20px] p-7 text-white shadow-[0_28px_64px_-30px_rgba(17,17,17,0.55)]" style={{ background: 'var(--ca-primary)' }}>
                <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(214,0,154,0.6), transparent)' }} />
                <div className="relative flex items-center gap-2">
                  <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-accent)' }}>Recommended</span>
                </div>
                <p className="relative mt-1 text-sm text-white/60">Keep every rupee. Automate the rest.</p>
                <div className="relative mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold" style={{ color: 'var(--ca-accent)' }}>₹</span>
                  <span className="font-heading text-5xl font-black tracking-tight" style={{ color: 'var(--ca-accent)' }}>{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                  <span className="pb-2 text-sm text-white/60">/month</span>
                  {yearly && <span className="relative pb-2 ml-1 text-sm text-white/40 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                </div>
                <p className="relative mt-1.5 text-xs font-semibold text-white/60">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST included` : 'Billed monthly · GST included'}</p>
                <ul className="relative mt-6 flex flex-col gap-3">
                  <li className="flex items-start gap-2.5 text-sm font-semibold text-white">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} />
                    <span>Everything in Free</span>
                  </li>
                  {PREMIUM_PLAN.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/75">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <div className="relative mt-7 flex-1" />
                <Link to={START} className="relative inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white transition-all hover:no-underline hover:brightness-110" style={{ background: 'var(--ca-accent)' }}>
                  Go Sloth Active <ArrowRight size={15} />
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="mt-8 flex flex-col items-center gap-2 text-center">
            <span className="flex items-center gap-1.5 text-sm text-neutral-500"><Lock size={14} style={{ color: 'var(--ca-accent)' }} /> Access to all features with no hidden fees</span>
            <Link to="/pricing" className="text-sm font-semibold text-neutral-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 10 · ABOUT (editorial statement + ruled trust rows) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="order-2 lg:order-1">
            <ImgSlot alt="A salon owner reviewing the day's bookings on a tablet" className="aspect-[4/5] w-full shadow-[0_24px_54px_-32px_rgba(17,17,17,0.4)]" />
          </Reveal>
          <div className="order-1 lg:order-2">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-black leading-tight tracking-tight sm:text-4xl">
              Small salons deserve better tools.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-neutral-600">
              Meeticulous was built to make appointment-based businesses easier to run. Instead of a ringing phone, a paper diary and scattered payments, salons can manage their bookings, clients and money from one pretty platform.
            </Reveal>
            <Reveal as="p" delay={0.1} className="mt-4 text-[15px] font-medium text-neutral-500">
              Built for Indian professionals. Designed for the way modern salons actually work.
            </Reveal>
            <Reveal delay={0.14} className="mt-8 border-t border-black/10">
              {TRUST_STRIP.map((it) => (
                <div key={it.value} className="flex items-center gap-4 border-b border-black/10 py-3.5">
                  <it.icon size={18} className="flex-shrink-0" style={{ color: 'var(--ca-accent)' }} />
                  <div className="text-sm">
                    <span className="font-bold text-[color:var(--ca-ink)]">{it.value}</span>
                    <span className="text-neutral-500"> — {it.label}</span>
                  </div>
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
          <Reveal as="h2" className="text-center font-heading text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            Questions? <span style={{ color: 'var(--ca-accent)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 12 · FINAL CTA (black + fuchsia mix-blend-screen glow) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8" style={{ background: 'var(--ca-primary)' }}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[44rem] max-w-[92vw] -translate-x-1/2 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(214,0,154,0.55), transparent)' }} />
        <div className="relative mx-auto max-w-2xl">
          <Reveal className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(214,0,154,0.2)' }}>
            <Sparkles size={26} style={{ color: 'var(--ca-accent)' }} />
          </Reveal>
          <Reveal as="h2" delay={0.06} className="mt-6 font-heading text-3xl font-black leading-tight tracking-tight text-white sm:text-5xl">
            Spend less time on the phone. <span style={{ color: 'var(--ca-accent)' }}>Spend more time on your clients.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base text-white/70">
            Set up your salon booking page today and give your clients a beautiful way to book with you.
          </Reveal>
          <Reveal delay={0.14} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(214,0,154,0.6)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
              Claim Your Booking Link <ArrowRight size={16} />
            </Link>
            <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-4 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
              Book A Demo
            </Link>
          </Reveal>
          <Reveal as="p" delay={0.18} className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {['No credit card', 'Free forever', '0% on Sloth Active'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Check size={14} style={{ color: 'var(--ca-accent)' }} /> {t}</span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 13 · FOOTER (shared shell) ═══════════════ */}
      <footer className="border-t border-black/5 px-5 py-16 sm:px-8" style={{ background: '#ffffff' }}>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <div className="font-heading text-lg font-extrabold text-[color:var(--ca-ink)]">Meeticulous</div>
              <p className="mt-2 max-w-xs text-sm text-neutral-500">The prettier way to manage salon appointments.</p>
              <CtaButton to={START} className="mt-5">Get Started Now <ArrowRight size={15} /></CtaButton>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <div className="text-xs font-bold uppercase tracking-wide text-neutral-600">{col.title}</div>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <NavLink item={l} className="text-sm text-neutral-600 transition-colors hover:text-[color:var(--ca-accent)] hover:no-underline" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-black/5 pt-6 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-neutral-500">© 2026 Meeticulous. <OperatorCredit /></p>
            <p className="text-xs text-neutral-500">Made for India&apos;s salons &amp; beauticians</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
