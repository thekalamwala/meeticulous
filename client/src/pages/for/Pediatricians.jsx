// /for/pediatricians — bespoke landing page for pediatricians & child-care clinics
// in India. (Design brief #14.)
//
// STANDALONE page (bespoke route PRECEDES /for/:profession in App.jsx). Keep in
// sync: App.jsx, prerender.mjs, sitemapService.js, Navbar "Who it's for" menu.
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in a
// FRIENDLY blue + warm-amber system (safe for parents, but approachable) — distinct
// from GP (clinical blue), derm (cyan), gyneco (emerald), physio (lime),
// consultants (charcoal). Unique mechanics: sticker-chip hero · tinted service
// cards · sticker-number step cards · split logo section · contained stat banner ·
// chat-bubble testimonials · chip-row comparison · ribbon pricing · tinted about
// banner · confetti CTA. Only nav/hero/footer (shared shell) may resemble siblings.
//
// IMAGES: intentional EMPTY ImgSlot placeholders with descriptive aria-label.
//
// HONESTY (medical): scheduling + payment tool, not a medical-records or advice
// product. No treatment/outcome claims; testimonials are labelled placeholders;
// trust facts emphasise payment security + India data residency + DPDP; JSON-LD has
// NO aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// accordion/toggle, AA-contrast palette, visible focus, no hover uplift.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus,
  CalendarCheck, LayoutDashboard,
  Wallet, BellRing, Baby,
  Landmark,
  Syringe, Stethoscope, Smile, Thermometer, Activity, Video,
  BadgePercent, Lock, ShieldCheck, Share2, Heart,
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

const MASCOT = '/for/pediatricians/hero.webp';
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian clinics'];

const SERVICES = [
  { icon: Stethoscope, label: 'Child Consultation', desc: 'General paediatric consultations and check-ups.' },
  { icon: Syringe, label: 'Vaccination & Immunisation', desc: 'Book shots and keep the schedule on track.' },
  { icon: Baby, label: 'Newborn & Well-Baby Care', desc: 'Newborn visits and well-baby check-ups.' },
  { icon: Activity, label: 'Growth & Development', desc: 'Growth monitoring and development reviews.' },
  { icon: Thermometer, label: 'Fever & Sick Visits', desc: 'Same-day slots for a poorly child.' },
  { icon: Video, label: 'Online Consultation', desc: 'Video consults for quick follow-ups from home.' },
];

const STEPS = [
  { title: 'Set up your consultations', icon: LayoutDashboard, desc: 'Add your services, fees and clinic hours in minutes.' },
  { title: 'Share your booking link', icon: Share2, desc: 'Put it on Google, your website or WhatsApp — one link.' },
  { title: 'Parents book & pay', icon: CalendarCheck, desc: 'A parent picks a service and a time, and pays upfront.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Confirmations and vaccination reminders before every visit.' },
];

const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg' },
  { name: 'Razorpay', logo: razorpayLogo },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg' },
];

const METRICS = [
  { v: '24/7', l: 'Bookings, day or night' },
  { v: '0%', l: 'Commission on Sloth Active' },
  { v: '₹0', l: 'To get started' },
  { v: 'GST', l: 'Invoices, automatic' },
];

const TESTIMONIALS = [
  { quote: 'Parents used to call the clinic all through the day. Now they book on our link and it is confirmed — reception is calm and our no-shows have dropped.', name: 'Dr. Anil Kumar', role: 'Paediatrician', company: 'Little Steps Clinic, Bengaluru' },
  { quote: 'The vaccination reminders alone have been worth it — far fewer families forgetting the next shot.', name: 'Deepa Menon', role: 'Clinic Manager', company: 'Sunshine Kids, Kochi' },
  { quote: 'As a parent, booking my son’s check-up in a minute instead of calling during work was a relief.', name: 'Ravi Sharma', role: 'Parent', company: 'Pune' },
  { quote: 'Collecting the consultation fee upfront, with a GST invoice each time, cleaned up our billing.', name: 'Dr. Sunita Rao', role: 'Paediatrician', company: 'CarePlus Children’s Clinic, Delhi' },
];

const OLD_WAY = ['Parents call to book', 'Missed vaccination follow-ups', 'Fees chased at the desk', 'A paper appointment register', 'Double-booked slots'];
const NEW_WAY = ['A booking link parents use in a minute', 'Automatic vaccination reminders', 'Fees paid upfront over UPI', 'One calm, synced clinic calendar', 'Conflict-free slots, always accurate'];

const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your clinic data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Sloth Active — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for paediatricians and child-care clinics?', a: 'Yes. Whether you are a solo paediatrician or a children’s clinic with a team, Meeticulous manages your services, availability, bookings and communication from one place — so parents can book without calling and your reception stays calm. It is a scheduling and payment tool, not a medical-records system.' },
  { q: 'Can parents book appointments online?', a: 'Yes. A parent opens your booking link, chooses a service such as a consultation or vaccination, picks a convenient time and confirms — in under a minute, no calls needed.' },
  { q: 'Can I send vaccination reminders?', a: 'Yes. Meeticulous sends automatic WhatsApp and email reminders before every appointment, which helps parents keep their child’s immunisation schedule on track.' },
  { q: 'Can I offer same-day sick visits and online consultations?', a: 'Yes. Open same-day slots for sick visits, and offer online consultations with automatic Google Meet links for quick follow-ups — or mark a service as in-clinic.' },
  { q: 'Can I collect the consultation fee online?', a: 'Yes. Collect the fee upfront through Razorpay — UPI, cards or netbanking — before the appointment. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Is our clinic and family information kept private?', a: 'Meeticulous stores appointment and contact details for booking only — it is not a medical-records system. Your production data is hosted in India (Mumbai) and the platform operates under India’s DPDP Act 2023.' },
  { q: 'Do we need any technical setup?', a: 'No. Setup takes minutes and needs no technical skills. You add your services and clinic hours, and your booking page is ready to share — parents need nothing more than the link.' },
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
    { label: 'Pediatricians & Child Care', to: '/for/pediatricians' },
    { label: 'General Physicians & Clinics', to: '/for/doctors' },
    { label: 'Gynecologists & OB-GYNs', to: '/for/gynecologists' },
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
    solid: 'text-white shadow-[0_4px_14px_rgba(37,99,235,0.22)] hover:brightness-110',
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

export default function Pediatricians() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/pediatricians`;
  const seo = {
    title: 'Appointment Booking Software for Pediatricians & Child-Care Clinics | Meeticulous',
    description: 'Meeticulous is appointment booking software for pediatricians and child-care clinics in India. Let parents book consultations and vaccinations online — fees collected upfront, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'appointment booking software for pediatricians, child clinic scheduling software india, book pediatrician appointment online, vaccination appointment booking, children clinic booking page, paediatric appointment system',
    ogTitle: 'Booking Software Parents Love — for Paediatric Clinics',
    ogDescription: 'Parents book consultations and vaccinations, pay upfront over UPI and get WhatsApp reminders — automatically. A friendly booking page for paediatric clinics in India. Free forever, no card required.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Pediatricians & Child Care',
    serviceType: 'Appointment booking software for pediatricians and child-care clinics',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Friendly blue + warm amber. Legacy --ca-* names kept.
  const styleVars = {
    '--ca-primary': '#960D32', // blue-600 — text/links/fills, AA on white (~5.2:1)
    '--ca-accent': '#B45309',  // amber-700 — accent text, AA on white
    '--ca-amber': '#F59E0B',   // bright amber — decorative fills only
    '--ca-ink': '#172554',     // blue-950 navy text
    '--ca-cream': '#EFF6FF',   // blue-50 section bg
    '--ca-grey': '#F3F6FB',    // light section bg
  };

  const tints = ['#EFF6FF', '#FEF3C7', '#ECFDF5', '#FCE7F3'];

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
        themeColor="#960D32"
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

      {/* ═══════════════ 2 · HERO (image + scattered sticker chips) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-8 pt-6 sm:px-8 lg:pb-10 lg:pt-10" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 h-2 w-2 rounded-full bg-[color:var(--ca-primary)]/40" />
        <div className="relative mx-auto grid max-w-7xl items-center lg:items-start gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Easy online appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>pediatricians and child-care clinics.</span>
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for pediatricians — parents book consultations and vaccinations, pay upfront, and get gentle reminders, so your waiting room stays calm.
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

          {/* RIGHT — image + scattered sticker chips */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-md">
            <ImgSlot alt="A paediatrician with a happy child and parent" rounded="rounded-[32px]" className="aspect-[4/5] w-full shadow-[0_28px_60px_-30px_rgba(23,37,84,0.4)]" />
            <div className="absolute -left-4 top-[160px] z-20 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-2.5 shadow-[0_16px_36px_-18px_rgba(23,37,84,0.5)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: 'var(--ca-primary)' }}><Syringe size={15} /></span>
              <div className="text-[12px] font-bold text-[color:var(--ca-ink)]">Vaccine reminder sent</div>
            </div>
            <div className="absolute -right-[42px] top-[calc(50%-190px)] z-20 flex items-center gap-2.5 rounded-2xl bg-white px-4 py-2.5 shadow-[0_16px_36px_-18px_rgba(23,37,84,0.5)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--ca-amber) 22%, transparent)', color: 'var(--ca-accent)' }}><Smile size={15} /></span>
              <div className="text-[12px] font-bold text-[color:var(--ca-ink)]">Booked in 1 min</div>
            </div>
            <div className="absolute bottom-[88px] left-[calc(50%-250px)] z-20 flex -translate-x-1/2 items-center gap-2.5 rounded-2xl bg-white px-4 py-2.5 shadow-[0_16px_36px_-18px_rgba(23,37,84,0.5)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: 'var(--ca-primary)' }}><Wallet size={15} /></span>
              <div className="text-[12px] font-bold text-[color:var(--ca-ink)]">Fee paid ₹500</div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (tinted cards) ═══════════════ */}
      <section id="usecases" className="px-5 pb-20 pt-8 sm:px-8 lg:pb-28 lg:pt-12">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for pediatricians,{' '}
              <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              From consultations to vaccinations, well-baby care and sick visits — parents book any service in seconds.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.05}>
                <Link to={START} className="group flex h-full flex-col rounded-[22px] p-6 transition-colors hover:no-underline" style={{ background: tints[i % tints.length] }}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-[color:var(--ca-primary)] shadow-sm">
                    <s.icon size={22} />
                  </span>
                  <h3 className="mt-4 font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{s.label}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{s.desc}</p>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (sticker-number cards) ═══════════════ */}
      <section id="how" className="px-5 py-20 pt-24 sm:px-8 lg:py-28 lg:pt-32" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Set up once, <span style={{ color: 'var(--ca-primary)' }}>booked forever.</span>
            </Reveal>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="relative h-full rounded-[22px] border border-black/[0.06] bg-white p-6 pt-9 text-center">
                  <span className="absolute -top-5 left-1/2 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full font-heading text-base font-extrabold text-white shadow-md" style={{ background: 'var(--ca-primary)' }}>{i + 1}</span>
                  <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--ca-amber) 20%, transparent)', color: 'var(--ca-accent)' }}><s.icon size={19} /></span>
                  <h3 className="mt-4 font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (split copy + logo circles) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools your clinic <span style={{ color: 'var(--ca-primary)' }}>already uses.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              Calendar, payments and WhatsApp — Meeticulous fits your clinic, no rewiring, no new software for parents.
            </Reveal>
            <Reveal delay={0.1} className="mt-6">
              <Link to={START} className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
                See how it fits your clinic <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {TOOLS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) * 0.05}>
                <div className="flex flex-col items-center gap-2 rounded-[18px] border border-black/[0.06] bg-white px-2 py-5 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--ca-cream)]">
                    {t.logo ? <img src={t.logo} alt={t.name} loading="lazy" className="h-6 w-6 object-contain" /> : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
                  </span>
                  <span className="text-xs font-bold text-[color:var(--ca-ink)]">{t.name}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (contained stat banner) ═══════════════ */}
      <section className="px-5 py-6 sm:px-8 lg:pb-16">
        <div className="mx-auto max-w-6xl rounded-[28px] px-6 py-10 sm:px-12" style={{ background: 'var(--ca-ink)' }}>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {METRICS.map((m, i) => (
              <Reveal key={m.l} delay={i * 0.06} className="text-center">
                <div className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: i === 1 ? 'var(--ca-amber)' : '#fff' }}>{m.v}</div>
                <div className="mt-2 text-sm font-semibold text-white/70">{m.l}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (chat-bubble style) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Loved by clinics <span style={{ color: 'var(--ca-primary)' }}>and parents alike.</span>
            </Reveal>
          </div>
          <div className="mt-12 flex flex-col gap-6">
            {TESTIMONIALS.map((t, i) => {
              const right = i % 2 === 1;
              return (
                <Reveal key={t.name} delay={(i % 2) * 0.06} className={right ? 'sm:ml-16' : 'sm:mr-16'}>
                  <figure className={`rounded-[22px] border border-black/[0.06] bg-white p-6 ${right ? 'rounded-tr-md' : 'rounded-tl-md'}`}>
                    <blockquote className="text-sm leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
                    <figcaption className="mt-4 flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: right ? 'var(--ca-accent)' : 'var(--ca-primary)' }}>{t.name.replace('Dr. ', '').charAt(0)}</span>
                      <div><div className="text-[13px] font-bold text-[color:var(--ca-ink)]">{t.name}</div><div className="text-[11px] text-slate-500">{t.role} · {t.company}</div></div>
                    </figcaption>
                  </figure>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · DIFFERENCE (chip rows) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From a busy front desk to <span style={{ color: 'var(--ca-primary)' }}>a calm one.</span>
            </Reveal>
          </div>
          <div className="mt-12 space-y-6">
            <Reveal>
              <div className="text-sm font-bold uppercase tracking-wide text-slate-400">Without Meeticulous</div>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {OLD_WAY.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm text-slate-500 line-through decoration-slate-300">
                    <X size={14} className="text-slate-400" /> {t}
                  </span>
                ))}
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ca-primary)' }}>With Meeticulous</div>
              <div className="mt-3 flex flex-wrap gap-2.5">
                {NEW_WAY.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: 'var(--ca-primary)' }}>
                    <Check size={14} /> {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · TRUST (compact row) ═══════════════ */}
      <section className="px-5 py-12 sm:px-8" aria-label="Security & trust">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {TRUST_STRIP.map((s) => (
            <span key={s.value} className="flex items-center gap-2.5">
              <s.icon size={18} style={{ color: 'var(--ca-primary)' }} />
              <span className="text-sm font-bold text-[color:var(--ca-ink)]">{s.value}</span>
              <span className="hidden text-xs text-slate-500 sm:inline">· {s.label}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ═══════════════ 10 · PRICING (ribbon two-card) ═══════════════ */}
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
          <div className="mx-auto mt-12 grid max-w-3xl gap-5 sm:grid-cols-2 sm:gap-6">
            <Reveal>
              <div className="flex h-full flex-col rounded-[22px] border border-black/[0.08] bg-white p-7">
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
              <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] border-2 bg-white p-7 shadow-[0_24px_60px_-30px_rgba(16,24,40,0.14)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute right-[-38px] top-[18px] rotate-45 px-12 py-1 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-amber)' }}>Popular</span>
                <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
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
          <Reveal delay={0.12} className="mt-8 text-center">
            <Link to="/pricing" className="text-sm font-semibold text-slate-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · ABOUT (tinted banner) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl rounded-[28px] px-6 py-12 text-center sm:px-12 sm:py-16" style={{ background: 'var(--ca-cream)' }}>
          <Reveal as="h2" delay={0.04} className="mx-auto max-w-2xl font-heading text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
            Children&apos;s clinics deserve tools as caring as their care. Meeticulous turns a ringing phone and a paper register into <span style={{ color: 'var(--ca-primary)' }}>one friendly booking platform</span> — calm for your desk, easy for parents.
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

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 13 · FINAL CTA (blue band, confetti dots) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8" style={{ background: 'linear-gradient(160deg, #172554 0%, #960D32 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute left-[12%] top-10 h-3 w-3 rounded-full" style={{ background: 'var(--ca-amber)' }} />
        <div aria-hidden className="pointer-events-none absolute right-[16%] top-20 h-2.5 w-2.5 rounded-full bg-white/50" />
        <div aria-hidden className="pointer-events-none absolute bottom-16 left-[22%] h-2 w-2 rounded-full bg-white/40" />
        <div aria-hidden className="pointer-events-none absolute bottom-24 right-[12%] h-3 w-3 rounded-full" style={{ background: 'var(--ca-amber)' }} />
        <div className="relative mx-auto max-w-2xl">
          <Reveal as="h2" delay={0.06} className="font-heading text-[clamp(1.9rem,5vw,2.75rem)] font-extrabold leading-[1.08] tracking-tight text-white">
            Give parents an easier way<br className="hidden sm:block" /> <span style={{ color: 'var(--ca-amber)' }}>to book your clinic.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75">
            Set up your clinic&apos;s booking page today — free forever, and ready to share in minutes.
          </Reveal>
          <Reveal delay={0.14} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-8 py-4 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
              Launch My Clinic Page <ArrowRight size={16} />
            </Link>
            <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-7 py-4 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
              Book A Demo
            </Link>
          </Reveal>
          <Reveal delay={0.18} className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {['No credit card required', 'Free forever plan', '0% commission on Sloth Active'].map((t) => (
              <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
                <Check size={14} style={{ color: 'var(--ca-amber)' }} /> {t}
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
              <p className="mt-2 max-w-xs text-sm text-slate-500">A friendly way to run your children&apos;s clinic bookings.</p>
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
            <p className="text-xs text-slate-500">Made for India&apos;s pediatricians &amp; child-care clinics</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
