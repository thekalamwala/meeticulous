// /for/dermatologists — bespoke, conversion-focused landing page for
// dermatologists & skin clinics in India. (Design brief #12.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx, prerender.mjs,
// sitemapService.js, Navbar "Who it's for" menu.
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in a
// clinical CYAN + rose system (skin = clinical meets beauty) — distinct from GP
// (blue, single-image hero, vertical timeline), physio (lime, arched, marquees)
// and consultants (charcoal). Mechanics unique to this page: 2-tile hero collage ·
// asymmetric service bento · watermark-number step cards · chip-cloud integrations ·
// big-number impact row · masonry testimonials · interactive before/after TOGGLE ·
// unified split pricing card · editorial about. Only nav/hero/footer (shared shell)
// may resemble sibling pages.
//
// IMAGES: intentional EMPTY ImgSlot placeholders with descriptive aria-label.
//
// HONESTY (medical): scheduling + payment tool, not a medical-records or advice
// product. No treatment/outcome claims; testimonials are labelled placeholders from
// clinic STAFF about admin; trust facts emphasise payment security + India data
// residency + DPDP; JSON-LD has NO aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// accordion/toggle/segmented control, AA-contrast palette, visible focus, no hover
// uplift, Reveal guards motion.

import { useState } from 'react';
import { Sparkles as SparklesIcon } from 'lucide-react';
import IconArt from '../../components/common/IconArt';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star,
  CalendarCheck, LayoutDashboard, BellRing, Stethoscope,
  Landmark,Droplet, Syringe, Zap, Sparkles, Video,
  BadgePercent, Lock, ShieldCheck, Share2,
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

const START = '/become-a-host';
const LOGIN = '/login-as-vendor';

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const NAV = [
  { label: 'Services', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const SLOT_ICON = SparklesIcon; // stands in for the removed mascot art
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian clinics'];

// Service bento (asymmetric). `wide` tiles span two columns.
const SERVICES = [
  { icon: Stethoscope, label: 'Skin Consultation', desc: 'General dermatology and diagnosis appointments.', wide: true },
  { icon: Droplet, label: 'Acne & Pigmentation', desc: 'Acne, scars, melasma and pigmentation care.' },
  { icon: Syringe, label: 'Anti-Ageing & Injectables', desc: 'Consults for injectables and skin rejuvenation.' },
  { icon: Zap, label: 'Laser & Hair Removal', desc: 'Book laser sessions and follow-ups.' },
  { icon: Sparkles, label: 'Cosmetic Dermatology', desc: 'Aesthetic and cosmetic skin procedures.' },
  { icon: Video, label: 'Teledermatology', desc: 'Online skin consultations from anywhere.', wide: true },
];

// Watermark-number step cards (4-step).
const STEPS = [
  { title: 'Set up your consultations', icon: LayoutDashboard, desc: 'Add your services, fees and clinic hours in minutes.' },
  { title: 'Share your booking link', icon: Share2, desc: 'Put it on Google, your website or WhatsApp — one link.' },
  { title: 'Patients book & pay', icon: CalendarCheck, desc: 'A patient picks a service and a time, and pays upfront.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Automatic confirmations and reminders before every visit.' },
];

// Integration chips — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg' },
  { name: 'Razorpay', logo: razorpayLogo },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg' },
];

// Big-number impact row.
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night' },
  { v: '0%', l: 'Commission on Pro' },
  { v: '₹0', l: 'To get started' },
  { v: 'GST', l: 'Invoices, automatic' },
];

// Placeholder testimonials — clinic STAFF about admin, never patients about treatment.
const TESTIMONIALS = [
  { quote: 'Our front desk used to spend the day on the phone rescheduling. Patients now book skin consults on our link and it is confirmed — the admin load dropped sharply.', name: 'Dr. Ananya Sharma', role: 'Dermatologist', company: 'Clear Skin Clinic, Mumbai' },
  { quote: 'Automatic WhatsApp reminders cut our no-shows noticeably. Fewer empty consultation slots across the week.', name: 'Rahul Verma', role: 'Clinic Manager', company: 'DermaCare, Delhi' },
  { quote: 'Collecting the consultation fee upfront, with a GST invoice each time, cleaned up our billing completely.', name: 'Dr. Meera Nair', role: 'Consultant Dermatologist', company: 'SkinWorks, Kochi' },
  { quote: 'Patients book laser follow-ups without calling the desk. Setup took an afternoon for the whole clinic.', name: 'Priya Reddy', role: 'Practice Coordinator', company: 'Glow Skin, Hyderabad' },
];

// Before/after toggle content.
const COMPARE = {
  old: {
    label: 'The manual way',
    points: [
      'Phone tag to fix every appointment',
      'No-shows waste clinic hours',
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
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your clinic data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for dermatologists and skin clinics?', a: 'Yes. Whether you are a solo dermatologist or a skin clinic with a team, Meeticulous manages your services, availability, patient bookings and communication from one place — so your front desk runs without constant phone calls. It is a scheduling and payment tool, not a medical-records system.' },
  { q: 'Can patients book consultations online?', a: 'Yes. A patient opens your booking link, chooses a service such as a skin consultation or laser follow-up, picks a convenient time and confirms — no calls or waiting for the desk to reply.' },
  { q: 'Can I offer online (teledermatology) consultations?', a: 'Yes. Offer online consults with automatic Google Meet links, or mark a service as in-clinic — or both. The patient picks the mode that suits them.' },
  { q: 'Can I collect the consultation fee online?', a: 'Yes. Collect the fee upfront through Razorpay — UPI, cards or netbanking — before the appointment. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I manage multiple doctors and services?', a: 'Yes. Create as many services as you need — consultation, acne care, laser, cosmetic procedures — each with its own duration, fee and availability, and manage every appointment from one clinic calendar.' },
  { q: 'Is our clinic and patient information kept private?', a: 'Your production data is hosted in India (Mumbai) and the platform operates under India’s DPDP Act 2023. Meeticulous stores appointment and contact details for booking — it is not a medical-records system, and you control what a patient provides when booking.' },
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
    { label: 'Dermatologists & Skin Clinics', to: '/for/dermatologists' },
    { label: 'General Physicians & Clinics', to: '/for/doctors' },
    { label: 'Physiotherapists & Rehab', to: '/for/physiotherapists' },
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
    solid: 'text-white shadow-[0_4px_14px_rgba(14,116,144,0.22)] hover:brightness-110',
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
  return <IconArt icon={SLOT_ICON} label={alt} rounded={rounded} className={`${pos} z-40 ${layout}`} />;
}

function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="overflow-hidden rounded-[12px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'var(--ca-primary)' : 'rgba(17,17,17,0.08)' }}>
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

/* Before/after segmented toggle for the difference section. */
function BeforeAfter() {
  const [view, setView] = useState('now');
  const data = COMPARE[view];
  const isNow = view === 'now';
  return (
    <div className="mx-auto mt-10 max-w-2xl">
      <div className="mx-auto flex w-full max-w-xs rounded-full border border-black/10 bg-white p-1" role="tablist" aria-label="Compare the manual way and Meeticulous">
        {['old', 'now'].map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className="flex-1 rounded-full px-4 py-2 text-[13px] font-bold transition-colors"
            style={view === k ? { background: k === 'now' ? 'var(--ca-primary)' : 'var(--ca-ink)', color: '#fff' } : { color: '#64748b' }}
          >
            {COMPARE[k].label}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.ul
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28 }}
          className="mt-8 grid gap-3 sm:grid-cols-2"
        >
          {data.points.map((p) => (
            <li key={p} className="flex items-start gap-3 rounded-[12px] border border-black/[0.07] bg-white px-4 py-3.5 text-sm">
              {isNow
                ? <Check size={17} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ca-primary)' }} />
                : <X size={17} className="mt-0.5 flex-shrink-0 text-slate-300" />}
              <span className={isNow ? 'font-medium text-[color:var(--ca-ink)]' : 'text-slate-500 line-through decoration-slate-300'}>{p}</span>
            </li>
          ))}
        </motion.ul>
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function Dermatologists() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/dermatologists`;
  const seo = {
    title: 'Appointment Booking Software for Dermatologists & Skin Clinics | Meeticulous',
    description: 'Meeticulous is appointment booking software for dermatologists and skin clinics in India. Let patients book skin consultations and laser appointments online — fees collected upfront, WhatsApp reminders, GST invoices, teledermatology, 0% commission. Start free.',
    keywords: 'appointment booking software for dermatologists, skin clinic scheduling software india, book dermatology consultation online, teledermatology booking, skin clinic appointment system, dermatologist booking page',
    ogTitle: 'Fill Your Skin Clinic — Booking Software for Dermatologists',
    ogDescription: 'Patients book skin consultations, pay upfront over UPI and get WhatsApp reminders — automatically. A clean booking page for dermatologists and skin clinics in India. Free forever, no card required.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Dermatologists & Skin Clinics',
    serviceType: 'Appointment booking software for dermatologists and skin clinics',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Clinical cyan + rose. Legacy --ca-* names kept.
  const styleVars = {
    '--ca-primary': '#0E7490', // cyan-700 — text/links/fills, AA on white (~4.7:1)
    '--ca-accent': '#DB2777',  // pink-600 — sparing beauty accent, AA on white
    '--ca-ink': '#12232B',     // dark teal-slate text
    '--ca-cream': '#ECFEFF',   // cyan-50 section bg
    '--ca-grey': '#F1F6F7',    // light section bg
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
        themeColor="#0E7490"
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

      {/* ═══════════════ 2 · HERO (2-tile image collage + rose glow) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-16 h-80 w-80 rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(219,39,119,0.14), transparent)' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Modern appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>dermatologists</span> managing busy skin clinics.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for dermatologists — patients book skin consultations and laser follow-ups, pay upfront, and get reminded, so your clinic fills without the call log.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Set Up My Clinic Page <ArrowRight size={16} /></CtaButton>
              <Link to="/demo" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
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

          {/* RIGHT — 2-tile stacked image collage + floating chip */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <ImgSlot alt="A dermatologist examining a patient's skin" className="aspect-[4/5] w-full" />
            <div className="absolute bottom-8 left-0 z-50 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(18,35,43,0.5)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={17} /></span>
              <div><div className="text-[11px] text-slate-500">Booked &amp; paid</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">Skin consult · 4:00 PM</div></div>
            </div>
            <div className="absolute top-12 left-6 z-50 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(18,35,43,0.5)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}><BellRing size={17} /></span>
              <div><div className="text-[11px] text-slate-500">Reminder sent</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">1h before</div></div>
            </div>
            <div className="absolute top-12 right-6 z-50 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(18,35,43,0.5)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}><Video size={17} /></span>
              <div><div className="text-[11px] text-slate-500">Teledermatology</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">Online consult</div></div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (asymmetric bento) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for dermatologists, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              From consultations to acne care, laser and teledermatology — patients book any service in seconds.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.05} className={s.wide ? 'sm:col-span-2 lg:col-span-1' : ''}>
                <Link to={START} className="group flex h-full flex-col rounded-[16px] border border-black/[0.08] bg-white p-6 transition-colors hover:border-[color:var(--ca-primary)]/30 hover:no-underline">
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

      {/* ═══════════════ 4 · HOW IT WORKS (watermark-number cards) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Live in minutes, <span style={{ color: 'var(--ca-primary)' }}>booked in seconds.</span>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="relative h-full overflow-hidden rounded-[16px] border border-black/[0.08] bg-white p-6">
                  <span aria-hidden className="pointer-events-none absolute -right-2 -top-4 font-heading text-7xl font-extrabold leading-none" style={{ color: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)' }}>{i + 1}</span>
                  <span className="relative flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ background: 'var(--ca-primary)' }}><s.icon size={19} /></span>
                  <h3 className="relative mt-4 font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                  <p className="relative mt-1.5 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (chip cloud) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
          </Reveal>
          <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
            Calendar, payments and WhatsApp — Meeticulous fits your clinic, no rewiring.
          </Reveal>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            {TOOLS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 6) * 0.04}>
                <span className="inline-flex items-center gap-2.5 rounded-full border border-black/[0.08] bg-white py-2.5 pl-2.5 pr-5 shadow-[0_8px_24px_-18px_rgba(18,35,43,0.5)]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--ca-grey)]">
                    {t.logo ? <img src={t.logo} alt={t.name} loading="lazy" className="h-5 w-5 object-contain" /> : <ToolLogo name={t.icon} size={20} className="h-5 w-5" />}
                  </span>
                  <span className="text-sm font-bold text-[color:var(--ca-ink)]">{t.name}</span>
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (big-number row) ═══════════════ */}
      <section className="px-5 py-16 sm:px-8" style={{ background: 'var(--ca-ink)' }}>
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/10">
          {METRICS.map((m, i) => (
            <Reveal key={m.l} delay={i * 0.06} className="text-center lg:px-4">
              <div className="font-heading text-5xl font-extrabold tracking-tight text-white sm:text-6xl">{m.v}</div>
              <div className="mt-2 text-sm font-semibold text-white/70">{m.l}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (masonry cards) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Skin clinics that swapped the <span style={{ color: 'var(--ca-primary)' }}>phone for a link.</span>
            </Reveal>
          </div>
          <div className="mt-12 columns-1 gap-5 sm:columns-2">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 2) * 0.06} className="mb-5 break-inside-avoid">
                <figure className={`rounded-[16px] border p-6 ${i === 0 ? 'border-transparent text-white' : 'border-black/[0.08] bg-white'}`} style={i === 0 ? { background: 'var(--ca-primary)' } : undefined}>
                  <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={15} style={{ color: i === 0 ? '#fff' : 'var(--ca-accent)', fill: i === 0 ? '#fff' : 'var(--ca-accent)' }} />)}</div>
                  <blockquote className={`mt-3 text-sm leading-relaxed ${i === 0 ? 'text-white/95' : 'text-slate-700'}`}>&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className={`mt-4 flex items-center gap-3 border-t pt-4 ${i === 0 ? 'border-white/20' : 'border-black/5'}`}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold" style={i === 0 ? { background: 'rgba(255,255,255,0.18)', color: '#fff' } : { background: 'var(--ca-accent)', color: '#fff' }}>{t.name.replace('Dr. ', '').charAt(0)}</span>
                    <div><div className={`text-[13px] font-bold ${i === 0 ? 'text-white' : 'text-[color:var(--ca-ink)]'}`}>{t.name}</div><div className={`text-[11px] ${i === 0 ? 'text-white/70' : 'text-slate-500'}`}>{t.role} · {t.company}</div></div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · DIFFERENCE (before/after toggle) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              See the difference for <span style={{ color: 'var(--ca-primary)' }}>your front desk.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">Toggle to compare a manual clinic day with Meeticulous.</Reveal>
          </div>
          <Reveal delay={0.08}><BeforeAfter /></Reveal>
        </div>
      </section>

      {/* ═══════════════ 9 · TRUST (compact icon row) ═══════════════ */}
      <section className="px-5 py-12 sm:px-8" aria-label="Security & trust">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-5">
          {TRUST_STRIP.map((s) => (
            <span key={s.value} className="flex items-center gap-2.5">
              <s.icon size={18} style={{ color: 'var(--ca-primary)' }} />
              <span className="text-sm font-bold text-[color:var(--ca-ink)]">{s.value}</span>
              <span className="hidden text-xs text-slate-500 sm:inline">· {s.label}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════════ 10 · PRICING (unified split card) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start free. <span style={{ color: 'var(--ca-primary)' }}>Upgrade as your clinic grows.</span>
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
          <Reveal delay={0.1} className="mt-10 overflow-hidden rounded-[20px] border border-black/[0.08] bg-white shadow-[0_24px_60px_-34px_rgba(18,35,43,0.35)]">
            <div className="grid md:grid-cols-2">
              {/* Free */}
              <div className="border-b border-black/[0.06] p-8 md:border-b-0 md:border-r">
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
              {/* Pro */}
              <div className="relative p-8" style={{ background: 'var(--ca-cream)' }}>
                <div className="flex items-center gap-2">
                  <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-primary)' }}>Recommended</span>
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
            </div>
          </Reveal>
          <Reveal delay={0.12} className="mt-6 text-center">
            <Link to="/pricing" className="text-sm font-semibold text-slate-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · ABOUT (editorial statement + trust pills) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-3xl text-center">
          <Reveal as="h2" delay={0.04} className="font-heading text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
            Modern skin clinics deserve tools that feel as considered as their care. Meeticulous turns a ringing phone, a paper register and desk payments into <span style={{ color: 'var(--ca-primary)' }}>one calm booking platform</span> — built for the way Indian practices actually work.
          </Reveal>
          <Reveal delay={0.1} className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {TRUST_STRIP.map((it) => (
              <span key={it.value} className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--ca-ink)]">
                <it.icon size={15} style={{ color: 'var(--ca-primary)' }} /> {it.value}
              </span>
            ))}
          </Reveal>
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

      {/* ═══════════════ 13 · FINAL CTA (split panel + image) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto grid max-w-6xl items-stretch overflow-hidden rounded-[24px] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="relative overflow-hidden px-8 py-14 sm:px-12" style={{ background: 'linear-gradient(150deg, #0B3A45 0%, #0E7490 100%)' }}>
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(219,39,119,0.5), transparent)' }} />
            <div className="relative">
              <Reveal as="h2" className="font-heading text-[clamp(1.8rem,4.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
                Give patients an easier way to book your skin clinic.
              </Reveal>
              <Reveal as="p" delay={0.06} className="mt-4 max-w-md text-base leading-relaxed text-white/75">
                Set up your clinic&apos;s booking page today — free forever, ready to share in minutes.
              </Reveal>
              <Reveal delay={0.1} className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
                <Link to={START} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
                  Launch My Clinic Page <ArrowRight size={16} />
                </Link>
                <Link to="/demo" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline">
                  Book A Demo
                </Link>
              </Reveal>
              <Reveal delay={0.14} className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
                {['No credit card', 'Free forever', '0% on Pro'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Check size={14} style={{ color: '#F9A8D4' }} /> {t}</span>
                ))}
              </Reveal>
            </div>
          </div>
          <ImgSlot alt="A dermatologist welcoming a patient to the clinic" rounded="rounded-none" className="min-h-[240px]" />
        </div>
      </section>

      {/* ═══════════════ 14 · FOOTER (shared shell) ═══════════════ */}
      <footer className="border-t border-black/5 px-5 py-16 sm:px-8" style={{ background: '#ffffff' }}>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <div className="font-heading text-lg font-extrabold text-[color:var(--ca-ink)]">Meeticulous</div>
              <p className="mt-2 max-w-xs text-sm text-slate-500">The easier way to run your skin clinic&apos;s bookings.</p>
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
            <p className="text-xs text-slate-500">Made for India&apos;s dermatologists &amp; skin clinics</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
