// /for/gynecologists — bespoke, conversion-focused landing page for gynecologists
// & OB-GYN clinics in India. (Design brief #13.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx, prerender.mjs,
// sitemapService.js, Navbar "Who it's for" menu.
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in a
// calm, caring EMERALD + rose system (women's health = private + reassuring) —
// distinct from the blue/cyan medical pages, physio (lime) and consultants
// (charcoal). Mechanics unique to this page: organic-blob hero · soft rounded
// service cards · zig-zag step timeline · contained logo panel · pastel-tint stat
// grid · equal-card testimonials · soft checklist-columns comparison · pill trust
// row · soft two-card pricing · promise-editorial about. Only nav/hero/footer
// (shared shell) may resemble sibling pages.
//
// IMAGES: intentional EMPTY ImgSlot placeholders with descriptive aria-label.
//
// HONESTY (medical): scheduling + payment tool, not a medical-records or advice
// product. No treatment/outcome claims; testimonials are labelled placeholders from
// clinic STAFF about admin; trust facts emphasise privacy + payment security + India
// data residency + DPDP; JSON-LD has NO aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// accordion/toggle, AA-contrast palette, visible focus, no hover uplift.

import { useState } from 'react';
import { HeartPulse as HeartPulseIcon } from 'lucide-react';
import IconArt from '../../components/common/IconArt';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus,
  CalendarCheck, LayoutDashboard, BellRing,
  Landmark,
  Baby, Flower2, ShieldCheck, Stethoscope, Activity, Video,
  BadgePercent, Lock, Sparkles, Share2, Heart,
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

const SLOT_ICON = HeartPulseIcon; // stands in for the removed mascot art
const HERO_TRUST = ['No credit card required', 'Private by design', 'Built for Indian clinics'];

const SERVICES = [
  { icon: Stethoscope, label: 'Gynaecology Consultation', desc: 'Routine and specialist women’s-health visits.' },
  { icon: Baby, label: 'Pregnancy & Antenatal Care', desc: 'Antenatal check-ups and pregnancy consultations.' },
  { icon: Sparkles, label: 'Fertility Consultation', desc: 'Fertility and family-planning appointments.' },
  { icon: Activity, label: 'Menstrual & Hormonal Health', desc: 'PCOS, hormonal and cycle-related care.' },
  { icon: Flower2, label: 'Menopause Care', desc: 'Support and consultations through menopause.' },
  { icon: Video, label: 'Online Consultation', desc: 'Private video consultations from home.' },
];

const STEPS = [
  { title: 'Set up your consultations', icon: LayoutDashboard, desc: 'Add your services, fees and clinic hours in minutes.' },
  { title: 'Share your booking link', icon: Share2, desc: 'Put it on Google, your website or WhatsApp — one link.' },
  { title: 'Patients book & pay', icon: CalendarCheck, desc: 'A patient picks a service and a time, and pays upfront — privately.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Gentle confirmations and reminders before every visit.' },
];

const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg', sub: 'Private video link per consult' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg', sub: 'Gentle reminders on autopilot' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Payments, refunds & GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Automatic confirmation emails' },
];

const METRICS = [
  { v: '24/7', l: 'Bookings, day or night', note: 'Patients book privately, any time — no call to the desk.' },
  { v: '0%', l: 'Commission on Pro', note: 'Keep every rupee you earn.' },
  { v: '₹0', l: 'To get started', note: 'Free forever plan — no card, no lock-in.' },
  { v: 'GST', l: 'Invoices, automatic', note: 'A tax invoice for every paid booking.' },
];

const TESTIMONIALS = [
  { quote: 'Our patients value privacy, and a calm booking link they can use themselves — instead of calling the desk — made the whole experience feel more considerate. Our no-shows dropped and reception is far quieter.', name: 'Dr. Kavita Menon', role: 'Gynaecologist', company: 'Aarogya Women’s Clinic, Bengaluru' },
  { quote: 'Automatic reminders mean far fewer missed antenatal visits. It has been a real relief for the team.', name: 'Sunita Rao', role: 'Clinic Manager', company: 'Matru Care, Pune' },
  { quote: 'Collecting the consultation fee upfront, with a GST invoice every time, tidied up our billing completely.', name: 'Dr. Anjali Verma', role: 'OB-GYN', company: 'Nova Women’s Health, Delhi' },
];

const OLD_WAY = [
  'Patients call the desk to book',
  'No-shows leave gaps in the day',
  'Fees collected at reception',
  'A paper appointment register',
  'Double-booked slots by hand',
];
const NEW_WAY = [
  'A private booking link, used any time',
  'Gentle reminders cut no-shows',
  'Fees paid upfront, over UPI or card',
  'One calm, calendar-synced view',
  'Conflict-free slots, always accurate',
];

const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your clinic data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for gynecologists and OB-GYN clinics?', a: 'Yes. Whether you are a solo gynaecologist or a women’s-health clinic with a team, Meeticulous manages your services, availability, patient bookings and communication from one place — so your reception runs calmly without constant phone calls. It is a scheduling and payment tool, not a medical-records system.' },
  { q: 'Can patients book appointments online?', a: 'Yes. A patient opens your booking link, chooses a service such as a consultation or antenatal visit, picks a convenient time and confirms — privately, no calls needed.' },
  { q: 'Is patient information kept private?', a: 'Meeticulous stores appointment and contact details for booking only — it is not a medical-records system. Your production data is hosted in India (Mumbai) and the platform operates under India’s DPDP Act 2023, and you control what a patient provides when booking.' },
  { q: 'Can I offer online consultations?', a: 'Yes. Offer private online consultations with automatic Google Meet links, or mark a service as in-clinic — or both. The patient picks the mode she is comfortable with.' },
  { q: 'Can I collect the consultation fee online?', a: 'Yes. Collect the fee upfront through Razorpay — UPI, cards or netbanking — before the appointment. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I manage multiple doctors and services?', a: 'Yes. Create as many services as you need — consultation, antenatal care, fertility, menopause care — each with its own duration, fee and availability, and manage every appointment from one calendar.' },
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
    { label: 'Gynecologists & OB-GYNs', to: '/for/gynecologists' },
    { label: 'General Physicians & Clinics', to: '/for/doctors' },
    { label: 'Dermatologists & Skin Clinics', to: '/for/dermatologists' },
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
    solid: 'text-white shadow-[0_4px_14px_rgba(4,120,87,0.22)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/25',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

function ImgSlot({ alt, className = '', rounded = 'rounded-[24px]' }) {
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
      <div key={f.q} className="overflow-hidden rounded-[16px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'var(--ca-primary)' : 'rgba(17,17,17,0.08)' }}>
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

export default function Gynecologists() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/gynecologists`;
  const seo = {
    title: 'Appointment Booking Software for Gynecologists & OB-GYNs | Meeticulous',
    description: 'Meeticulous is appointment booking software for gynecologists and OB-GYN clinics in India. Let patients book consultations and antenatal visits online — private, fees collected upfront, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'appointment booking software for gynecologists, OB-GYN clinic scheduling software india, book gynaecologist appointment online, antenatal appointment booking, women health clinic booking page, gynecology appointment system',
    ogTitle: 'A Calm, Private Way to Book Your Women’s-Health Clinic',
    ogDescription: 'Patients book gynaecology and antenatal visits, pay upfront over UPI and get gentle WhatsApp reminders — privately and automatically. A calm booking page for OB-GYN clinics in India. Free forever, no card required.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Gynecologists & OB-GYNs',
    serviceType: 'Appointment booking software for gynecologists and OB-GYN clinics',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Calm emerald + rose. Legacy --ca-* names kept.
  const styleVars = {
    '--ca-primary': '#047857', // emerald-700 — text/links/fills, AA on white (~5:1)
    '--ca-accent': '#BE185D',  // rose-700 — sparing women's-health accent, AA on white
    '--ca-ink': '#14342A',     // deep green-slate text
    '--ca-cream': '#F0FDF4',   // green-50 section bg
    '--ca-grey': '#F3F7F4',    // light section bg
  };

  const tints = ['#ECFDF5', '#FDF2F8', '#EFF6FF', '#FEFCE8']; // soft pastel stat tints

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
        themeColor="#047857"
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

      {/* ═══════════════ 2 · HERO (organic-blob image + soft rose glow) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(190,24,93,0.10), transparent)' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Private online appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>gynecologists</span> and women's health clinics.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for gynecologists — patients book consultations and antenatal visits privately, pay upfront, and get gentle reminders, with discretion built in.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Set Up My Clinic Page <ArrowRight size={16} /></CtaButton>
              <Link to="/contact" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
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

          {/* RIGHT — organic blob-masked image + floating gentle card */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <ImgSlot alt="A gynaecologist welcoming a patient in a calm clinic" rounded="rounded-[42%_58%_58%_42%/48%_42%_58%_52%]" className="aspect-square w-full shadow-[0_28px_60px_-30px_rgba(20,52,42,0.4)]" />
            <div className="absolute -bottom-3 left-4 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(20,52,42,0.5)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={17} /></span>
              <div><div className="text-[11px] text-slate-500">Booked privately</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">Consult · 10:30 AM</div></div>
            </div>
            <div className="absolute right-2 top-6 z-20 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-2.5 shadow-[0_16px_36px_-18px_rgba(20,52,42,0.5)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--ca-accent) 12%, transparent)', color: 'var(--ca-accent)' }}><ShieldCheck size={16} /></span>
              <div className="text-[12px] font-bold text-[color:var(--ca-ink)]">Private &amp; secure</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (soft rounded cards) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for gynecologists, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              From consultations to antenatal care, fertility and menopause support — patients book any service privately.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.05}>
                <Link to={START} className="group flex h-full items-start gap-4 rounded-[24px] border border-black/[0.06] bg-white p-6 transition-colors hover:border-[color:var(--ca-primary)]/25 hover:no-underline">
                  <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--ca-primary) 9%, transparent)', color: 'var(--ca-primary)' }}>
                    <s.icon size={21} />
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

      {/* ═══════════════ 4 · HOW IT WORKS (zig-zag timeline) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Gentle to set up, <span style={{ color: 'var(--ca-primary)' }}>gentle to book.</span>
            </Reveal>
          </div>
          <div className="mt-14 flex flex-col gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className={`flex items-center gap-5 ${i % 2 ? 'sm:flex-row-reverse sm:text-right' : ''}`}>
                  <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full font-heading text-lg font-extrabold text-white" style={{ background: 'var(--ca-primary)' }}>{i + 1}</span>
                  <div className={`flex-1 rounded-[20px] border border-black/[0.06] bg-white p-5 ${i % 2 ? 'sm:pr-6' : 'sm:pl-6'}`}>
                    <div className={`flex items-center gap-2 ${i % 2 ? 'sm:justify-end' : ''}`} style={{ color: 'var(--ca-primary)' }}>
                      <s.icon size={17} />
                      <h3 className="font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (contained soft panel) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl rounded-[28px] border border-black/[0.06] p-8 sm:p-12" style={{ background: 'var(--ca-grey)' }}>
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
              Works with the tools your clinic <span style={{ color: 'var(--ca-primary)' }}>already uses.</span>
            </Reveal>
          </div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) * 0.05}>
                <div className="flex items-center gap-3 rounded-[16px] bg-white px-4 py-4">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[color:var(--ca-cream)]">
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
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (pastel-tint stat grid) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              A calmer clinic, <span style={{ color: 'var(--ca-primary)' }}>by the numbers.</span>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m, i) => (
              <Reveal key={m.l} delay={(i % 4) * 0.06}>
                <div className="flex h-full flex-col rounded-[22px] p-6" style={{ background: tints[i % tints.length] }}>
                  <div className="font-heading text-4xl font-extrabold tracking-tight" style={{ color: 'var(--ca-primary)' }}>{m.v}</div>
                  <div className="mt-2 font-heading text-sm font-bold text-[color:var(--ca-ink)]">{m.l}</div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{m.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (equal soft cards) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Clinics that made booking <span style={{ color: 'var(--ca-primary)' }}>feel considerate.</span>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) * 0.06}>
                <figure className="flex h-full flex-col rounded-[22px] border border-black/[0.06] bg-white p-6">
                  <span aria-hidden className="font-heading text-4xl leading-none" style={{ color: 'color-mix(in srgb, var(--ca-accent) 45%, transparent)' }}>&ldquo;</span>
                  <blockquote className="-mt-2 flex-1 text-sm leading-relaxed text-slate-700">{t.quote}</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3 border-t border-black/5 pt-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--ca-primary)' }}>{t.name.replace('Dr. ', '').charAt(0)}</span>
                    <div><div className="text-[13px] font-bold text-[color:var(--ca-ink)]">{t.name}</div><div className="text-[11px] text-slate-500">{t.role} · {t.company}</div></div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · DIFFERENCE (soft checklist columns) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From a busy desk to <span style={{ color: 'var(--ca-primary)' }}>a calm one.</span>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Reveal className="rounded-[24px] border border-black/[0.06] bg-[color:var(--ca-grey)] p-7 sm:p-8">
              <div className="text-sm font-bold uppercase tracking-wide text-slate-500">The manual way</div>
              <ul className="mt-5 flex flex-col gap-3.5">
                {OLD_WAY.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm text-slate-500">
                    <X size={16} className="mt-0.5 shrink-0 text-slate-400" /> <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.08} className="rounded-[24px] border-2 p-7 sm:p-8" style={{ borderColor: 'var(--ca-primary)', background: 'var(--ca-cream)' }}>
              <div className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ca-primary)' }}>With Meeticulous</div>
              <ul className="mt-5 flex flex-col gap-3.5">
                {NEW_WAY.map((t) => (
                  <li key={t} className="flex items-start gap-3 text-sm font-medium text-[color:var(--ca-ink)]">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · TRUST (soft pill row) ═══════════════ */}
      <section className="px-5 pb-8 sm:px-8" aria-label="Security & trust">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-3">
          {TRUST_STRIP.map((s) => (
            <span key={s.value} className="inline-flex items-center gap-2 rounded-full border border-black/[0.07] bg-white px-4 py-2 text-sm">
              <s.icon size={15} style={{ color: 'var(--ca-primary)' }} />
              <span className="font-bold text-[color:var(--ca-ink)]">{s.value}</span>
              <span className="hidden text-slate-500 sm:inline">· {s.label}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════════ 10 · PRICING (soft two-card) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start free. <span style={{ color: 'var(--ca-primary)' }}>Grow gently.</span>
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
              <div className="flex h-full flex-col rounded-[24px] border border-black/[0.06] bg-white p-7">
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
              <div className="relative flex h-full flex-col overflow-hidden rounded-[24px] border-2 bg-white p-7 shadow-[0_24px_60px_-30px_rgba(16,24,40,0.14)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
                <div className="flex items-center gap-2">
                  <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-accent)' }}>Recommended</span>
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
                <CtaButton to={START} className="mt-7 w-full">Go Pro</CtaButton>
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

      {/* ═══════════════ 11 · ABOUT (promise editorial + blob image) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal className="relative order-2 mx-auto w-full max-w-sm lg:order-1 lg:mx-0 lg:max-w-none">
            <div aria-hidden className="pointer-events-none absolute -left-10 -top-8 h-56 w-56 rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(4,120,87,0.12), transparent)' }} />
            <ImgSlot alt="A calm women's-health clinic reception" rounded="rounded-[58%_42%_47%_53%/42%_53%_47%_58%]" className="relative aspect-square w-full shadow-[0_28px_60px_-30px_rgba(20,52,42,0.4)]" />
          </Reveal>
          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Care that feels <span style={{ color: 'var(--ca-primary)' }}>considered — from the first click.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-slate-600">
              Meeticulous turns a ringing phone, a paper register and payments at the desk into one calm, private booking platform — so your patients feel looked after before they even arrive, and your reception stays quiet.
            </Reveal>
            <Reveal delay={0.12} className="mt-8 grid gap-x-6 gap-y-5 text-left sm:grid-cols-2">
              {TRUST_STRIP.map((it) => (
                <div key={it.value} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ background: 'var(--ca-primary)' }}>
                    <it.icon size={16} />
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

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 13 · FINAL CTA (soft emerald band, organic glow) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8" style={{ background: 'linear-gradient(160deg, #06231C 0%, #047857 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(190,24,93,0.4), transparent)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-28 -right-16 h-72 w-72 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(110,231,183,0.4), transparent)' }} />
        <div className="relative mx-auto max-w-2xl">
          <Reveal as="h2" delay={0.06} className="font-heading text-[clamp(1.9rem,5vw,2.75rem)] font-extrabold leading-[1.08] tracking-tight text-white">
            Give patients a calmer,<br className="hidden sm:block" /> <span style={{ color: '#6EE7B7' }}>more private way to book.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75">
            Set up your clinic&apos;s booking page today — free forever, and ready to share in minutes.
          </Reveal>
          <Reveal delay={0.14} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
              Launch My Clinic Page <ArrowRight size={16} />
            </Link>
            <Link to="/contact" className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-7 py-4 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
              Book A Demo
            </Link>
          </Reveal>
          <Reveal delay={0.18} className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {['No credit card required', 'Private by design', '0% commission on Pro'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
                <Check size={14} style={{ color: '#6EE7B7' }} /> {t}
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
              <p className="mt-2 max-w-xs text-sm text-slate-500">A calm, private way to run your clinic&apos;s bookings.</p>
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
            <p className="text-xs text-slate-500">Made for India&apos;s gynecologists &amp; OB-GYNs</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
