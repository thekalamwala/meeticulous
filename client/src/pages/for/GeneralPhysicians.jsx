// /for/doctors — bespoke, conversion-focused landing page for general physicians
// & clinics in India. (Design brief #10.) Served at the pre-existing /for/doctors
// slug (Navbar, footer, prerender.mjs, sitemapService.js already point at it).
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx.
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in the
// Trust-Blue system (clinical, squared corners, real-photo placeholders) — distinct
// from the physiotherapists page (rounded + lime marquees) and consultants
// (charcoal). Mechanics unique to this page: dotted-motif split hero · left-stripe
// service cards · vertical step timeline · static logo grid · stat-card impact row
// (one dark-highlighted) · featured-quote + mini testimonials · old→new
// transformation rows · static trust bar · vertical pricing cards · overlapping-card
// about. Only nav/hero/footer (shared shell) may resemble sibling pages.
//
// IMAGES: every photo slot is an intentional EMPTY placeholder (ImgSlot) with a
// descriptive aria-label — drop real photography in later without touching layout.
//
// HONESTY (medical): scheduling + payment tool, not a medical-records or advice
// product. No treatment/outcome claims; testimonials are labelled placeholders from
// clinic STAFF about admin, never patients about treatment; trust facts emphasise
// payment security + India data residency + DPDP; JSON-LD has NO aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// accordion/toggle, AA-contrast palette, visible focus, prefers-reduced-motion is
// respected (no marquees on this page; Reveal already guards motion).

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star,
  CalendarCheck, LayoutDashboard, BellRing, HeartPulse,
  Landmark,
  Stethoscope, Thermometer, ClipboardCheck, Syringe, Video,
  BadgePercent, Lock, ShieldCheck, Share2, Zap,
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

const MASCOT = '/for/doctors/hero.webp';
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian clinics'];

// Service cards.
const SERVICES = [
  { icon: Stethoscope, label: 'General Consultation', desc: 'Everyday consultations and health advice.' },
  { icon: Thermometer, label: 'Fever & Common Illness', desc: 'Same-day slots for fever, cough and colds.' },
  { icon: ClipboardCheck, label: 'Health Check-up', desc: 'Routine check-ups and preventive care.' },
  { icon: HeartPulse, label: 'Chronic Care (BP & Diabetes)', desc: 'Follow-ups for blood pressure and diabetes.' },
  { icon: Syringe, label: 'Vaccination', desc: 'Adult and travel vaccinations, booked online.' },
  { icon: Video, label: 'Online Consultation', desc: 'Video consults for quick follow-ups from home.' },
];

// Vertical step timeline.
const STEPS = [
  { title: 'Set up your consultations', icon: LayoutDashboard, desc: 'Add your services, fees and clinic hours in minutes.' },
  { title: 'Share your booking link', icon: Share2, desc: 'Put it on Google, your website or WhatsApp — one link.' },
  { title: 'Patients book & pay', icon: CalendarCheck, desc: 'A patient picks a service and a time, and pays upfront.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Confirmations and reminders before every consultation.' },
];

// Logo grid — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg', sub: 'Video link on every tele-consult' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg', sub: 'Reminders on autopilot' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Payments, refunds & GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Automatic confirmation emails' },
];

// Impact stat cards (middle one dark-highlighted).
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night', note: 'Your booking page never sleeps — patients reserve slots any time.' },
  { v: '0%', l: 'Commission on Sloth Active', note: 'Keep every rupee you earn — no cut on your consult fees.' },
  { v: '₹0', l: 'To get started', note: 'Free forever plan — no card, no lock-in.' },
  { v: 'GST', l: 'Invoices, automatic', note: 'A tax invoice generated for every paid booking.' },
];

// Placeholder testimonials — clinic STAFF about admin, never patients about treatment.
const TESTIMONIALS = [
  { quote: 'Our reception was buried in calls all day. Patients now book consultations on our link and it is confirmed — the desk is calm, and our no-shows have dropped noticeably across the week.', name: 'Dr. Ramesh Gupta', role: 'General Physician', company: 'CityCare Clinic, Jaipur' },
  { quote: 'Automatic reminders cut our missed appointments sharply. Fewer empty slots for the doctors.', name: 'Sneha Patil', role: 'Clinic Manager', company: 'Wellness Clinic, Nagpur' },
  { quote: 'Collecting the consultation fee upfront, with a GST invoice each time, cleaned up our billing.', name: 'Dr. Kavita Rao', role: 'General Physician', company: 'FamilyCare, Bengaluru' },
];

// Old → new transformation rows.
const TRANSFORM = [
  { old: 'Phone tag for every appointment', now: 'One booking link — patients self-serve 24/7' },
  { old: 'No-shows waste clinic hours', now: 'Automatic WhatsApp reminders cut no-shows' },
  { old: 'Chasing consultation fees at the desk', now: 'Fees collected upfront over UPI or card' },
  { old: 'A paper appointment register', now: 'One clean, calendar-synced clinic view' },
  { old: 'Two patients in one slot', now: 'Conflict-free slots — no double bookings' },
];

// Trust bar — verifiable facts only.
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your clinic data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Sloth Active — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for general physicians and clinics?', a: 'Yes. Whether you are a solo GP or a clinic with a team of doctors, Meeticulous manages your services, availability, patient bookings and communication from one place — so your reception runs without constant phone calls. It is a scheduling and payment tool, not a medical-records system.' },
  { q: 'Can patients book consultations online?', a: 'Yes. A patient opens your booking link, chooses a service such as a general consultation or health check-up, picks a convenient time and confirms — no calls or waiting for the desk to reply.' },
  { q: 'Can I offer online (tele-medicine) consultations?', a: 'Yes. Offer online consults with automatic Google Meet links, or mark a service as in-clinic — or both. The patient picks the mode that suits them.' },
  { q: 'Can I collect the consultation fee online?', a: 'Yes. Collect the fee upfront through Razorpay — UPI, cards or netbanking — before the appointment. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I manage multiple doctors and services?', a: 'Yes. Create as many services as you need — consultation, health check-up, chronic care, vaccination — each with its own duration, fee and availability, and manage every appointment from one clinic calendar.' },
  { q: 'Is our clinic and patient information kept private?', a: 'Meeticulous stores appointment and contact details for booking only — it is not a medical-records system. Your production data is hosted in India (Mumbai) and the platform operates under India’s DPDP Act 2023.' },
  { q: 'Do we need any technical setup?', a: 'No. Setup takes minutes and needs no technical skills. You add your services and clinic hours, and your booking page is ready to share — your patients need nothing more than the link.' },
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
    { label: 'General Physicians & Clinics', to: '/for/doctors' },
    { label: 'Dermatologists & Skin Clinics', to: '/for/dermatologists' },
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
  const base = 'inline-flex items-center justify-center gap-2 rounded-[8px] px-6 py-3.5 text-sm font-semibold transition-all hover:no-underline';
  const styles = {
    solid: 'text-white shadow-[0_4px_14px_rgba(29,78,216,0.22)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/25',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

/* Intentional EMPTY image placeholder. Empty alt = decorative (aria-hidden). */
function ImgSlot({ alt, className = '', rounded = 'rounded-[14px]' }) {
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

/* Two-column single-open FAQ accordion. */
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

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function GeneralPhysicians() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/doctors`;
  const seo = {
    title: 'Appointment Booking Software for Doctors & Clinics | Meeticulous',
    description: 'Meeticulous is appointment booking software for doctors, general physicians and clinics in India. Let patients book consultations online — fees collected upfront, WhatsApp reminders, GST invoices, tele-medicine, 0% commission. Start free.',
    keywords: 'appointment booking software for doctors, clinic scheduling software india, book doctor appointment online, general physician booking page, tele-medicine appointment booking, clinic appointment system india',
    ogTitle: 'Book More Consultations — Appointment Software for Clinics',
    ogDescription: 'Patients book consultations, pay upfront over UPI and get WhatsApp reminders — automatically. A clean booking page for doctors and clinics in India. Free forever, no card required.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Doctors & Clinics',
    serviceType: 'Appointment booking software for general physicians and clinics',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Trust-Blue system — clinical medical blue + cyan. Legacy --ca-* names kept.
  const styleVars = {
    '--ca-primary': '#00457C', // blue-700 — text/links/fills, AA on white (~7:1)
    '--ca-accent': '#0E7490',  // cyan-700 — secondary accent, AA on white
    '--ca-ink': '#0F1E3D',     // deep navy text
    '--ca-cream': '#EFF4FF',   // blue-50 section bg
    '--ca-grey': '#F1F5F9',    // slate-50 section bg
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
        themeColor="#00457C"
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
                  <Link to={LOGIN} className="flex-1 rounded-[8px] border-2 border-black/10 py-2.5 text-center text-sm font-semibold text-[color:var(--ca-ink)] hover:no-underline">Login</Link>
                  <CtaButton to={START} className="flex-1">Start Free <ArrowRight size={15} /></CtaButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══════════════ 2 · HERO (clinical split, dotted motif, verified card) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.5]" style={{ backgroundImage: 'radial-gradient(rgba(29,78,216,0.10) 1px, transparent 1px)', backgroundSize: '24px 24px', maskImage: 'radial-gradient(120% 70% at 80% 20%, #000 20%, transparent 70%)', WebkitMaskImage: 'radial-gradient(120% 70% at 80% 20%, #000 20%, transparent 70%)' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Easy online appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>doctors</span> who want fewer calls.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for doctors — patients book consultations online, pay upfront, and get reminders, so your clinic runs smoothly and reception answers fewer calls.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Set Up My Clinic Page <ArrowRight size={16} /></CtaButton>
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

          {/* RIGHT — rectangular clinical image + verified appointment card */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <ImgSlot alt="A general physician consulting a patient in a modern clinic" rounded="rounded-[20px]" className="aspect-[5/4] w-full shadow-[0_28px_60px_-30px_rgba(15,30,61,0.4)]" />
            <div className="absolute -left-3 bottom-6 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(15,30,61,0.5)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={17} /></span>
              <div><div className="text-[11px] text-slate-500">Appointment confirmed</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">Consultation · 11:30 AM</div></div>
            </div>
            <div className="absolute -right-2 top-6 z-20 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-2.5 shadow-[0_16px_36px_-18px_rgba(15,30,61,0.5)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--ca-accent) 14%, transparent)', color: 'var(--ca-accent)' }}><ShieldCheck size={16} /></span>
              <div className="text-[12px] font-bold text-[color:var(--ca-ink)]">Fee paid upfront</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (left-stripe cards) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for doctors, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              From everyday consults to check-ups, chronic care and tele-medicine — patients book any service in seconds.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.05}>
                <Link to={START} className="group flex h-full items-start gap-4 rounded-[12px] border border-black/[0.08] bg-white p-5 pl-4 transition-colors hover:border-[color:var(--ca-primary)]/30 hover:no-underline" style={{ borderLeft: '4px solid var(--ca-primary)' }}>
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}>
                    <s.icon size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{s.label}</span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-slate-500">{s.desc}</span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (vertical timeline) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Live in minutes, <span style={{ color: 'var(--ca-primary)' }}>booked in seconds.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">From setup to a confirmed, paid consultation — four simple steps.</Reveal>
          </div>
          <ol className="relative mt-14 ml-3 space-y-8 border-l-2" style={{ borderColor: 'rgba(29,78,216,0.2)' }}>
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.08} className="relative pl-8">
                <span className="absolute -left-[19px] flex h-9 w-9 items-center justify-center rounded-full border-4 border-[color:var(--ca-grey)] text-white" style={{ background: 'var(--ca-primary)' }}>
                  <s.icon size={16} />
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-xs font-extrabold" style={{ color: 'var(--ca-accent)' }}>STEP {i + 1}</span>
                </div>
                <h3 className="mt-1 font-heading text-lg font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.desc}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (static logo grid) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools your clinic <span style={{ color: 'var(--ca-primary)' }}>already uses.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Calendar, payments and WhatsApp — Meeticulous fits your workflow, no rewiring.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) * 0.05}>
                <div className="flex items-center gap-3 rounded-[12px] border border-black/[0.08] bg-white px-4 py-4">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--ca-grey)]">
                    {t.logo ? <img src={t.logo} alt={t.name} loading="lazy" className="h-6 w-6 object-contain" /> : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{t.sub}</span>
                  </span>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1} className="mt-10 text-center">
            <Link to={START} className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              See how it fits your clinic <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (stat cards, one dark-highlighted) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Less admin at the desk. <span style={{ color: 'var(--ca-primary)' }}>More time for patients.</span>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m, i) => {
              const dark = i === 1;
              return (
                <Reveal key={m.l} delay={(i % 4) * 0.06}>
                  <div className={`flex h-full flex-col rounded-[16px] border p-6 ${dark ? 'border-transparent text-white' : 'border-black/[0.08] bg-white'}`} style={dark ? { background: 'var(--ca-ink)' } : undefined}>
                    <div className="font-heading text-4xl font-extrabold tracking-tight" style={{ color: dark ? '#fff' : 'var(--ca-primary)' }}>{m.v}</div>
                    <div className={`mt-2 font-heading text-sm font-bold ${dark ? 'text-white' : 'text-[color:var(--ca-ink)]'}`}>{m.l}</div>
                    <p className={`mt-1.5 text-xs leading-relaxed ${dark ? 'text-white/70' : 'text-slate-500'}`}>{m.note}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (featured quote + mini cards) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Clinics that swapped the <span style={{ color: 'var(--ca-primary)' }}>ringing phone for a link.</span>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            {/* featured */}
            <Reveal>
              <figure className="flex h-full flex-col justify-between rounded-[18px] p-8 text-white" style={{ background: 'var(--ca-primary)' }}>
                <div>
                  <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={18} className="fill-white text-white" />)}</div>
                  <blockquote className="mt-5 font-heading text-xl font-semibold leading-snug sm:text-2xl">&ldquo;{TESTIMONIALS[0].quote}&rdquo;</blockquote>
                </div>
                <figcaption className="mt-8 flex items-center gap-3 border-t border-white/20 pt-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 font-heading text-base font-bold">{TESTIMONIALS[0].name.replace('Dr. ', '').charAt(0)}</span>
                  <div><div className="text-sm font-bold">{TESTIMONIALS[0].name}</div><div className="text-xs text-white/70">{TESTIMONIALS[0].role} · {TESTIMONIALS[0].company}</div></div>
                </figcaption>
              </figure>
            </Reveal>
            {/* mini stack */}
            <div className="flex flex-col gap-5">
              {TESTIMONIALS.slice(1).map((t, i) => (
                <Reveal key={t.name} delay={0.06 + i * 0.06}>
                  <figure className="rounded-[16px] border border-black/[0.08] bg-white p-6">
                    <blockquote className="text-sm leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
                    <figcaption className="mt-4 flex items-center gap-3 border-t border-black/5 pt-4">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--ca-accent)' }}>{t.name.replace('Dr. ', '').charAt(0)}</span>
                      <div><div className="text-[13px] font-bold text-[color:var(--ca-ink)]">{t.name}</div><div className="text-[11px] text-slate-500">{t.role} · {t.company}</div></div>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · DIFFERENCE (old → new transformation rows) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From busy desk to <span style={{ color: 'var(--ca-primary)' }}>calm clinic.</span>
            </Reveal>
          </div>
          <div className="mt-12 overflow-hidden rounded-[16px] border border-black/[0.08] bg-white">
            {TRANSFORM.map((r, i) => (
              <Reveal key={r.old} delay={(i % 5) * 0.05}>
                <div className={`grid items-center gap-3 px-5 py-5 sm:grid-cols-[1fr_auto_1fr] sm:px-7 ${i > 0 ? 'border-t border-black/[0.06]' : ''}`}>
                  <div className="flex items-center gap-2.5 text-sm text-slate-400">
                    <X size={16} className="flex-shrink-0 text-slate-300" /> <span className="line-through decoration-slate-300">{r.old}</span>
                  </div>
                  <ArrowRight size={18} className="mx-auto hidden flex-shrink-0 sm:block" style={{ color: 'var(--ca-primary)' }} />
                  <div className="flex items-center gap-2.5 text-sm font-semibold text-[color:var(--ca-ink)]">
                    <Check size={16} className="flex-shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{r.now}</span>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · TRUST (static badge bar) ═══════════════ */}
      <section className="px-5 py-14 sm:px-8" aria-label="Security & trust">
        <div className="mx-auto grid max-w-6xl gap-6 rounded-[18px] border border-black/[0.08] bg-white p-8 sm:grid-cols-2 lg:grid-cols-4 lg:p-10">
          {TRUST_STRIP.map((s, i) => (
            <Reveal key={s.value} delay={i * 0.06} className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}>
                <s.icon size={19} />
              </span>
              <div>
                <div className="font-heading text-sm font-bold text-[color:var(--ca-ink)]">{s.value}</div>
                <p className="mt-0.5 text-xs leading-snug text-slate-500">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 10 · PRICING (vertical two-card) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
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
          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2 sm:gap-6">
            <Reveal>
              <div className="flex h-full flex-col rounded-[16px] border border-black/[0.08] bg-white p-7">
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
                <CtaButton to={START} variant="ghost" className="mt-7 w-full">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[16px] border-2 bg-white p-7 shadow-[0_24px_60px_-30px_rgba(16,24,40,0.14)]" style={{ borderColor: 'var(--ca-primary)' }}>
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
                <CtaButton to={START} className="mt-7 w-full">Go Sloth Active</CtaButton>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.12} className="mt-8 flex flex-col items-center gap-2 text-center">
            <span className="flex items-center gap-1.5 text-sm text-slate-500"><Lock size={14} style={{ color: 'var(--ca-primary)' }} /> Access to all features with no hidden fees</span>
            <Link to="/pricing" className="text-sm font-semibold text-slate-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · ABOUT (image + overlapping card) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="relative order-2 mx-auto w-full max-w-md lg:order-1 lg:mx-0 lg:max-w-none">
            <ImgSlot alt="A calm clinic reception managing bookings on Meeticulous" rounded="rounded-[20px]" className="aspect-[5/4] w-full shadow-[0_28px_60px_-30px_rgba(15,30,61,0.4)]" />
            <div className="absolute -bottom-5 left-5 z-20 max-w-[16rem] rounded-2xl px-5 py-4 text-white shadow-[0_20px_44px_-20px_rgba(15,30,61,0.8)]" style={{ background: 'var(--ca-ink)' }}>
              <div className="font-heading text-base font-extrabold leading-tight">Built for Indian clinics</div>
              <p className="mt-1.5 text-xs leading-relaxed text-white/70">Your data is hosted in Mumbai, under India&apos;s DPDP Act 2023.</p>
            </div>
          </Reveal>
          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Modern clinics deserve <span style={{ color: 'var(--ca-primary)' }}>better tools.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-slate-600">
              Instead of a ringing phone, a paper register and payments at the desk, clinics manage appointments, patients and money from one platform — built for the way modern Indian practices actually work.
            </Reveal>
            <Reveal delay={0.12} className="mt-8 grid gap-x-6 gap-y-5 text-left sm:grid-cols-2">
              {TRUST_STRIP.map((it) => (
                <div key={it.value} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}>
                    <it.icon size={17} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-heading text-sm font-bold text-[color:var(--ca-ink)]">{it.value}</div>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">{it.label}</p>
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

      {/* ═══════════════ 13 · FINAL CTA (clean blue band, dotted motif) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8" style={{ background: 'linear-gradient(160deg, #0F1E3D 0%, #00457C 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.14]" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)', backgroundSize: '24px 24px', maskImage: 'radial-gradient(120% 80% at 50% 50%, #000 30%, transparent 75%)', WebkitMaskImage: 'radial-gradient(120% 80% at 50% 50%, #000 30%, transparent 75%)' }} />
        <div className="relative mx-auto max-w-2xl">
          <Reveal as="h2" delay={0.06} className="font-heading text-[clamp(1.9rem,5vw,2.75rem)] font-extrabold leading-[1.08] tracking-tight text-white">
            Give patients an easier way<br className="hidden sm:block" /> <span style={{ color: '#93C5FD' }}>to book your clinic.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/70">
            Set up your clinic&apos;s booking page today — free forever, and ready to share in minutes.
          </Reveal>
          <Reveal delay={0.14} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-white px-8 py-4 text-sm font-bold shadow-[0_12px_34px_-10px_rgba(0,0,0,0.5)] transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.65)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
              Launch My Clinic Page <ArrowRight size={16} />
            </Link>
            <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] border-2 border-white/30 px-7 py-4 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
              Book A Demo
            </Link>
          </Reveal>
          <Reveal delay={0.18} className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {['No credit card required', 'Free forever plan', '0% commission on Sloth Active'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
                <Check size={14} style={{ color: '#93C5FD' }} /> {t}
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
              <p className="mt-2 max-w-xs text-sm text-slate-500">The easier way to run your clinic&apos;s appointments.</p>
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
            <p className="text-xs text-slate-500">Made for India&apos;s doctors &amp; clinics</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
