// /for/ent-specialists — bespoke, conversion-focused landing page for ENT
// specialists & surgeons in India.
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx route, prerender.mjs,
// sitemapService.js, Navbar "For professionals" menu.
//
// THEME: a precise clinical instrument panel — indigo + cyan, exact, technical,
// trustworthy. Every content section is its OWN design, distinct from sibling /for/
// pages. Mechanics unique to this page: audiogram/frequency SVG hero motif ·
// segmented-tab service switcher · horizontal connected node rail (steps) ·
// bordered logo-strip integrations · single indigo stat band with vertical rules ·
// single spotlight testimonial with avatar-thumbnail switcher · row-by-row
// comparison table · two-card SaaS pricing · split about with stacked ImgSlot +
// trust facts · two-column FAQ · indigo final CTA with cyan glow + grid lines.
// Only nav/hero shell/footer may resemble sibling pages.
//
// IMAGES: intentional EMPTY ImgSlot placeholders with descriptive alt.
//
// HONESTY (medical, strict): scheduling + payment tool, NOT medical records / advice
// / treatment. No clinical outcome claims. Testimonials are labelled placeholder
// quotes from clinic STAFF about ADMIN relief (no-shows, front-desk, billing) — never
// patients about treatment. Trust facts emphasise payment security + India data
// residency + DPDP. JSON-LD has NO aggregateRating.
//
// Legacy --ca-* CSS var names are kept (shared classNames depend on them); only the
// VALUES change per palette.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star,
  CalendarCheck, LayoutDashboard, BellRing, Share2,
  Ear, Stethoscope, Wind, Volume2, Mic, Activity,
  Landmark, Lock, ShieldCheck, BadgePercent, Zap,
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

const MASCOT = '/for/ent-specialists/hero.webp';
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian clinics'];

// Services grouped for the segmented-tab switcher (Ear / Nose & Throat / Consult & Surgery).
const SERVICE_GROUPS = [
  {
    id: 'ear', label: 'Ear & Hearing', icon: Ear,
    items: [
      { icon: Volume2, label: 'Hearing & Audiology', desc: 'Hearing tests and audiology appointments.' },
      { icon: Ear, label: 'Ear & Snoring Care', desc: 'Ear infections, snoring and sleep consults.' },
    ],
  },
  {
    id: 'nose', label: 'Nose & Throat', icon: Wind,
    items: [
      { icon: Wind, label: 'Sinus & Allergy Care', desc: 'Sinus, allergy and nasal consultations.' },
      { icon: Mic, label: 'Voice & Throat', desc: 'Voice, throat and swallowing consultations.' },
    ],
  },
  {
    id: 'consult', label: 'Consult & Surgery', icon: Stethoscope,
    items: [
      { icon: Stethoscope, label: 'ENT Consultation', desc: 'General ear, nose and throat consultations and reviews.' },
      { icon: Activity, label: 'Surgery Consultation', desc: 'Pre- and post-operative surgical consultations.' },
    ],
  },
];

// Node-rail steps (4).
const STEPS = [
  { title: 'Set up your consultations', icon: LayoutDashboard, desc: 'Add your services, fees and clinic hours in minutes.' },
  { title: 'Share your booking link', icon: Share2, desc: 'Put it on Google, your website or WhatsApp — one link.' },
  { title: 'Patients book & pay', icon: CalendarCheck, desc: 'A patient picks a service and a time, and pays upfront.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Confirmations and reminders before every consultation.' },
];

// Integration logo strip — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg', sub: 'Auto-add a video link to every tele-consult' },
  { name: 'WhatsApp Automation', logo: '/images/logos/whatsapp.svg', sub: 'Reminders and updates on autopilot' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Secure payments, refunds and GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Accept instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Booking confirmation emails, automatic' },
];

// Indigo stat band.
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night', note: 'Your booking page never sleeps.' },
  { v: '100%', l: 'Kept on Sloth Active', note: '0% commission — every rupee is yours.' },
  { v: '₹0', l: 'To get started', note: 'Free forever plan — no card, no lock-in.' },
  { v: 'GST', l: 'Invoices, automatic', note: 'A tax invoice for every paid booking.' },
];

// Placeholder testimonials — clinic STAFF about ADMIN, never patients about treatment.
const TESTIMONIALS = [
  { quote: 'Our reception used to be buried in calls. Patients now book ENT consultations on our link and it is confirmed — the desk is calm, and no-shows have dropped noticeably across the week.', name: 'Dr. Suresh Iyer', role: 'ENT Surgeon', company: 'ClearHear ENT Clinic, Chennai' },
  { quote: 'Automatic reminders cut our missed appointments sharply. Fewer wasted consultation slots for the surgeons.', name: 'Anita Desai', role: 'Clinic Manager', company: 'Metro ENT, Mumbai' },
  { quote: 'Collecting the consultation fee upfront, with a GST invoice each time, tidied up our billing completely.', name: 'Dr. Rahul Nair', role: 'ENT Specialist', company: 'Nair ENT Care, Kochi' },
];

// Row-by-row comparison.
const COMPARE_ROWS = [
  { old: { t: 'Phone tag for every appointment', d: 'The desk calls patients back to fix consultation times.' }, now: { t: 'One booking link', d: 'Patients pick a slot themselves, 24/7 — no calls needed.' } },
  { old: { t: 'No-shows waste clinic hours', d: 'A missed appointment is a slot the surgeon cannot bill.' }, now: { t: 'Automatic reminders', d: 'WhatsApp and email reminders cut no-shows.' } },
  { old: { t: 'Chasing consultation fees', d: 'Payment is collected at the desk, or not at all.' }, now: { t: 'Fees collected upfront', d: 'Consultation fee taken at booking, over UPI or card.' } },
  { old: { t: 'A paper appointment register', d: 'Visits scattered across a book and phone notes.' }, now: { t: 'One clean clinic calendar', d: 'Every appointment and surgeon in a single view.' } },
  { old: { t: 'Double-booked slots', d: 'Two patients booked into the same slot by hand.' }, now: { t: 'Conflict-free slots', d: 'Availability stays accurate — no double bookings.' } },
];

// Trust facts — verifiable only.
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your clinic data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Sloth Active — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for ENT specialists and surgeons?', a: 'Yes. Whether you are a solo ENT specialist or a clinic with a team of surgeons, Meeticulous manages your services, availability, patient bookings and communication from one place — so your reception runs without constant phone calls. It is a scheduling and payment tool, not a medical-records system.' },
  { q: 'Can patients book consultations online?', a: 'Yes. A patient opens your booking link, chooses a service such as an ENT consultation or hearing test, picks a convenient time and confirms — no calls or waiting for the desk to reply.' },
  { q: 'Can I offer online (tele-ENT) consultations?', a: 'Yes. Offer online consults with automatic Google Meet links, or mark a service as in-clinic — or both. The patient picks the mode that suits them.' },
  { q: 'Can I collect the consultation fee online?', a: 'Yes. Collect the fee upfront through Razorpay — UPI, cards or netbanking — before the appointment. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I manage multiple surgeons and services?', a: 'Yes. Create as many services as you need — consultation, audiology, sinus care, surgical reviews — each with its own duration, fee and availability, and manage every appointment from one clinic calendar.' },
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
    { label: 'ENT Specialists & Surgeons', to: '/for/ent-specialists' },
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
  const base = 'inline-flex items-center justify-center gap-2 rounded-[10px] px-6 py-3.5 text-sm font-semibold transition-all hover:no-underline';
  const styles = {
    solid: 'text-white shadow-[0_4px_14px_rgba(67,56,202,0.24)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/25',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

function ImgSlot({ alt, className = '', rounded = 'rounded-[16px]' }) {
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

/* Decorative audiogram / frequency readout — the hero's "instrument panel" motif. */

/* Bento-free service tile (no hover uplift). */
function ServiceCard({ s }) {
  return (
    <Link to={START} className="group flex h-full flex-col rounded-[14px] border border-black/[0.08] bg-white p-6 transition-all hover:border-[color:var(--ca-primary)]/40 hover:shadow-[0_18px_40px_-28px_rgba(67,56,202,0.4)] hover:no-underline">
      <div className="flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-[10px]" style={{ background: 'color-mix(in srgb, var(--ca-primary) 9%, transparent)', color: 'var(--ca-primary)' }}>
          <s.icon size={22} />
        </span>
        <ArrowRight size={16} className="mt-1 text-slate-300 transition-colors group-hover:text-[color:var(--ca-primary)]" />
      </div>
      <h3 className="mt-4 font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{s.label}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
    </Link>
  );
}

/* Segmented-tab service switcher. */
function ServicesTabs() {
  const [tab, setTab] = useState(0);
  const group = SERVICE_GROUPS[tab];
  return (
    <div className="mt-10">
      <div role="tablist" aria-label="ENT service categories" className="mx-auto flex max-w-xl flex-col gap-1.5 rounded-[14px] border border-black/[0.08] bg-white p-1.5 sm:flex-row">
        {SERVICE_GROUPS.map((g, i) => {
          const active = tab === i;
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              id={`svtab-${g.id}`}
              aria-selected={active}
              aria-controls={`svpanel-${g.id}`}
              onClick={() => setTab(i)}
              className="flex flex-1 items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-[13px] font-bold transition-colors"
              style={active ? { background: 'var(--ca-primary)', color: '#fff' } : { color: '#64748b' }}
            >
              <g.icon size={16} /> {g.label}
            </button>
          );
        })}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={group.id}
          role="tabpanel"
          id={`svpanel-${group.id}`}
          aria-labelledby={`svtab-${group.id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.28 }}
          className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2"
        >
          {group.items.map((s) => <ServiceCard key={s.label} s={s} />)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* Horizontal connected node rail — numbered nodes joined by a line, cards hanging below. */
function StepsRail() {
  return (
    <div className="relative mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      <span aria-hidden className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-6 hidden h-[2px] lg:block" style={{ background: 'linear-gradient(90deg, transparent, var(--ca-primary) 14%, var(--ca-accent) 86%, transparent)' }} />
      {STEPS.map((s, i) => (
        <Reveal key={s.title} delay={i * 0.08} className="relative flex flex-col items-center text-center">
          <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full font-heading text-base font-extrabold text-white shadow-[0_10px_22px_-10px_rgba(67,56,202,0.7)]" style={{ background: 'var(--ca-primary)' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <div className="mt-5 flex w-full flex-col items-center rounded-[14px] border border-black/[0.08] bg-white p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-[10px]" style={{ background: 'color-mix(in srgb, var(--ca-accent) 12%, transparent)', color: 'var(--ca-accent)' }}>
              <s.icon size={18} />
            </span>
            <h3 className="mt-3 font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* One bordered-panel integration item. */
function ToolItem({ t }) {
  return (
    <div className="flex items-center gap-3 rounded-[12px] border border-black/[0.07] bg-white px-4 py-3.5 transition-colors hover:border-[color:var(--ca-primary)]/30">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--ca-grey)]">
        {t.logo
          ? <img src={t.logo} alt="" loading="lazy" className="h-5 w-5 object-contain" />
          : <ToolLogo name={t.icon} size={20} className="h-5 w-5" />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</div>
        <div className="mt-0.5 truncate text-xs leading-snug text-slate-500">{t.sub}</div>
      </div>
    </div>
  );
}

/* Single spotlight testimonial with an avatar-thumbnail switcher. */
function TestimonialSpotlight() {
  const [i, setI] = useState(0);
  const t = TESTIMONIALS[i];
  return (
    <div className="mx-auto mt-12 max-w-3xl">
      <AnimatePresence mode="wait">
        <motion.figure
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="rounded-[20px] border border-black/[0.08] bg-white p-8 text-center shadow-[0_24px_60px_-40px_rgba(30,27,58,0.4)] sm:p-10"
        >
          <div className="flex justify-center gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={16} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}</div>
          <blockquote className="mt-5 font-heading text-xl font-semibold leading-snug text-[color:var(--ca-ink)] sm:text-2xl">&ldquo;{t.quote}&rdquo;</blockquote>
          <figcaption className="mt-6 text-sm">
            <span className="font-bold text-[color:var(--ca-ink)]">{t.name}</span>
            <span className="text-slate-500"> · {t.role} · {t.company}</span>
          </figcaption>
        </motion.figure>
      </AnimatePresence>
      <div className="mt-6 flex items-center justify-center gap-3">
        {TESTIMONIALS.map((tt, idx) => {
          const active = i === idx;
          return (
            <button
              key={tt.name}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Show quote from ${tt.name}`}
              aria-pressed={active}
              className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold transition-all"
              style={active
                ? { background: 'var(--ca-primary)', color: '#fff', boxShadow: '0 0 0 3px color-mix(in srgb, var(--ca-primary) 25%, transparent)' }
                : { background: 'var(--ca-grey)', color: 'var(--ca-ink)' }}
            >
              {tt.name.replace('Dr. ', '').charAt(0)}
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-center text-xs text-slate-400">Placeholder quotes from clinic staff about scheduling and front-desk admin — not patients, and not about treatment.</p>
    </div>
  );
}

/* Editorial two-column single-open FAQ accordion. */
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

export default function EntSpecialists() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/ent-specialists`;
  const seo = {
    title: 'Appointment Booking Software for ENT Specialists & Surgeons | Meeticulous',
    description: 'Meeticulous is appointment booking software for ENT specialists and surgeons in India. Let patients book ENT consultations and hearing tests online — fees collected upfront, WhatsApp reminders, GST invoices, tele-ENT, 0% commission. Start free.',
    keywords: 'appointment booking software for ENT specialists, ENT clinic scheduling software india, book ENT consultation online, ear nose throat appointment booking, ENT surgeon booking page, audiology appointment system',
    ogTitle: 'Your clinic runs on appointments. Let Meeticulous schedule them.',
    ogDescription: 'Patients book ENT consultations, pay upfront and get WhatsApp reminders — automatically. A professional booking page for ENT clinics in India.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For ENT Specialists & Surgeons',
    serviceType: 'Appointment booking software for ENT specialists and surgeons',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Precise clinical instrument palette — indigo + cyan. Legacy --ca-* names kept.
  const styleVars = {
    '--ca-primary': '#4338CA', // indigo-700 — text/links/fills, AA on white (~8.6:1)
    '--ca-accent': '#0891B2',  // cyan-600 — technical accent, AA on white (~4.6:1)
    '--ca-ink': '#1E1B3A',     // deep indigo-charcoal text
    '--ca-cream': '#EEF2FF',   // indigo-50 section bg
    '--ca-grey': '#F1F3FA',    // cool light-grey section bg
  };

  return (
    <main className="overflow-x-clip bg-white text-[color:var(--ca-ink)]" style={styleVars}>
      <style>{`
        @keyframes ent-eqpulse { 0%,100%{transform:scaleY(0.78)} 50%{transform:scaleY(1)} }
        .eq-bar { transform-box: fill-box; transform-origin: bottom; animation: ent-eqpulse 1.8s ease-in-out infinite; }
        @keyframes ent-livedot { 0%{transform:scale(1);opacity:.55} 70%,100%{transform:scale(2.4);opacity:0} }
        .live-dot { animation: ent-livedot 1.8s cubic-bezier(0,0,0.2,1) infinite; }
        @media (prefers-reduced-motion: reduce){ .eq-bar,.live-dot{ animation:none!important } }
      `}</style>

      <Seo
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor="#4338CA"
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
                  <Link to={LOGIN} className="flex-1 rounded-[10px] border-2 border-black/10 py-2.5 text-center text-sm font-semibold text-[color:var(--ca-ink)] hover:no-underline">Login</Link>
                  <CtaButton to={START} className="flex-1">Start Free <ArrowRight size={15} /></CtaButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══════════════ 2 · HERO (audiogram instrument-panel motif) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-28 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(67,56,202,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(67,56,202,0.045) 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'linear-gradient(180deg, #000, transparent 72%)', WebkitMaskImage: 'linear-gradient(180deg, #000, transparent 72%)' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* LEFT — copy */}
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.06] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Reliable appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>ENT specialists</span> managing busy clinics.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for ENT specialists — patients book consultations and hearing tests, pay upfront, and get reminded, so reception stops drowning in calls.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Create Your Booking Page <ArrowRight size={16} /></CtaButton>
              <a href="#how" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
                See How It Works <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </a>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
                  <Check size={14} style={{ color: 'var(--ca-accent)' }} /> {t}
                </span>
              ))}
            </Reveal>
          </div>

          {/* RIGHT — audiogram instrument panel behind an ImgSlot + floating chip */}
          <Reveal instant delay={0.1} className="relative mx-auto mt-6 mb-10 w-full max-w-md lg:mx-0 lg:my-0 lg:max-w-none">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(67,56,202,0.22), transparent)' }} />
            <ImgSlot alt="An ENT specialist reviewing a patient's hearing results" className="aspect-[4/5] w-full" />
            <div className="absolute top-[58%] -left-4 z-20 flex items-center gap-2.5 rounded-[12px] border border-black/[0.06] bg-white px-3.5 py-2.5 shadow-[0_16px_36px_-18px_rgba(30,27,58,0.5)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={16} /></span>
              <div>
                <div className="text-[10px] text-slate-500">Appointment confirmed</div>
                <div className="text-[13px] font-bold text-[color:var(--ca-ink)]">ENT consult · 4:30 PM</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (segmented tab switcher) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for ENT specialists, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              From ENT consultations to audiology, sinus care and surgical reviews — switch a category to see what patients can book in seconds.
            </Reveal>
          </div>
          <Reveal delay={0.08}><ServicesTabs /></Reveal>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (connected node rail) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From a ringing reception to a <span style={{ color: 'var(--ca-primary)' }}>confirmed, paid consult.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Four steps. Live in minutes, booked in seconds.
            </Reveal>
          </div>
          <StepsRail />
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (bordered logo strip) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Connect your calendar, payments and WhatsApp — Meeticulous fits your clinic, no rewiring.
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-10 rounded-[18px] border border-black/[0.08] bg-white p-6 shadow-[0_20px_50px_-40px_rgba(30,27,58,0.4)] sm:p-8">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map((t) => <ToolItem key={t.name} t={t} />)}
            </div>
          </Reveal>
          <Reveal delay={0.1} className="mt-8 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              Explore All Features <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (single indigo band, vertical rules) ═══════════════ */}
      <section className="px-5 py-16 sm:px-8" style={{ background: 'var(--ca-primary)' }}>
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/20">
          {METRICS.map((m, i) => (
            <Reveal key={m.l} delay={i * 0.06} className="text-center lg:px-6">
              <div className="font-heading text-5xl font-extrabold tracking-tight text-white sm:text-6xl">{m.v}</div>
              <div className="mt-2 text-sm font-bold text-white">{m.l}</div>
              <p className="mt-1.5 text-xs leading-relaxed text-white/65">{m.note}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (spotlight + avatar switcher) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Trusted by <span style={{ color: 'var(--ca-primary)' }}>ENT clinics</span> across India.
            </Reveal>
          </div>
          <Reveal delay={0.08}><TestimonialSpotlight /></Reveal>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (row-by-row table) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Manual reception vs <span style={{ color: 'var(--ca-primary)' }}>an automated clinic workflow.</span>
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-[16px] border border-black/[0.08] bg-white shadow-[0_14px_40px_-30px_rgba(30,27,58,0.35)]">
            <div className="grid grid-cols-2 border-b-2" style={{ borderColor: 'var(--ca-primary)' }}>
              <div className="flex items-center gap-2 px-5 py-4 sm:px-6"><X size={16} className="text-slate-400" /><span className="font-heading text-sm font-bold text-slate-500">The manual way</span></div>
              <div className="flex items-center gap-2 border-l border-black/[0.06] px-5 py-4 sm:px-6" style={{ background: 'color-mix(in srgb, var(--ca-primary) 5%, transparent)' }}><Check size={16} style={{ color: 'var(--ca-primary)' }} /><span className="font-heading text-sm font-bold text-[color:var(--ca-ink)]">With Meeticulous</span></div>
            </div>
            {COMPARE_ROWS.map((row, i) => (
              <div key={row.old.t} className={`grid grid-cols-2 ${i % 2 ? '' : 'bg-black/[0.015]'}`}>
                <div className="flex gap-2.5 border-t border-black/[0.06] px-5 py-4 sm:px-6">
                  <X size={16} className="mt-0.5 flex-shrink-0 text-slate-300" />
                  <div>
                    <p className="text-[14px] font-semibold text-slate-600">{row.old.t}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-400">{row.old.d}</p>
                  </div>
                </div>
                <div className="flex gap-2.5 border-l border-t border-black/[0.06] px-5 py-4 sm:px-6" style={{ background: 'color-mix(in srgb, var(--ca-primary) 4%, transparent)' }}>
                  <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ca-primary)' }} />
                  <div>
                    <p className="text-[14px] font-semibold text-[color:var(--ca-ink)]">{row.now.t}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{row.now.d}</p>
                  </div>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 9 · PRICING (two-card SaaS) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start small. <span style={{ color: 'var(--ca-primary)' }}>Grow as your clinic does.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-slate-500">
              Choose a plan that fits your clinic today. Upgrade when you need more.
            </Reveal>
          </div>

          <Reveal delay={0.1} className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-[color:var(--ca-ink)]' : 'text-slate-500'}`}>Monthly</button>
            <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: yearly ? 'var(--ca-primary)' : '#cbd5e1', minHeight: 0 }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: yearly ? '22px' : '2px' }} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-[color:var(--ca-ink)]' : 'text-slate-500'}`}>
              Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--ca-primary) 12%, transparent)', color: 'var(--ca-primary)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
            </span>
          </Reveal>

          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Sloth (free) */}
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
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} variant="ghost" className="mt-7 w-full">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>

            {/* Sloth Active (premium) — recommended */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[18px] border-2 bg-white p-7 shadow-[0_24px_60px_-32px_rgba(30,27,58,0.28)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-primary)' }}>Recommended</span>
                  </div>
                  {yearly && <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: 'var(--ca-accent)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>}
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
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} />
                    <span>Everything in Free</span>
                  </li>
                  {PREMIUM_PLAN.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} className="mt-7 w-full">Go Sloth Active</CtaButton>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="mt-8 flex flex-col items-center gap-2 text-center">
            <span className="flex items-center gap-1.5 text-sm text-slate-500"><Lock size={14} style={{ color: 'var(--ca-accent)' }} /> Access to all features with no hidden fees</span>
            <Link to="/pricing" className="text-sm font-semibold text-slate-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 10 · ABOUT (split text + stacked ImgSlot + trust facts) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Modern clinics deserve <span style={{ color: 'var(--ca-primary)' }}>better tools.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-slate-600">
              Meeticulous was built to make appointment-based practices easier to run. Instead of a ringing phone, a paper register and payments at the desk, clinics can manage their appointments, patients and money from one professional platform — built for Indian professionals, designed for the way modern clinics actually work.
            </Reveal>
            <Reveal delay={0.12} className="mt-8 grid gap-3 sm:grid-cols-2">
              {TRUST_STRIP.map((it) => (
                <div key={it.value} className="flex items-start gap-3 rounded-[12px] border border-black/[0.08] bg-white px-4 py-3.5 text-left">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--ca-primary) 9%, transparent)', color: 'var(--ca-primary)' }}>
                    <it.icon size={17} />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-[color:var(--ca-ink)]">{it.value}</div>
                    <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{it.label}</div>
                  </div>
                </div>
              ))}
            </Reveal>
          </div>
          <Reveal delay={0.1} className="relative mx-auto w-full max-w-md">
            <div aria-hidden className="pointer-events-none absolute -left-8 -top-8 h-40 w-40 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(8,145,178,0.2), transparent)' }} />
            <ImgSlot alt="A calm, organised ENT clinic front desk" className="relative z-10 aspect-[5/4] w-full shadow-[0_24px_50px_-30px_rgba(30,27,58,0.45)]" />
            <ImgSlot alt="An ENT specialist consulting a patient" className="relative z-20 -mt-10 ml-auto aspect-square w-2/3 ring-4 ring-white shadow-[0_22px_44px_-26px_rgba(30,27,58,0.5)]" />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · FAQ (two-column) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 12 · FINAL CTA (indigo + cyan glow + grid lines) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[24px] px-6 py-16 text-center sm:px-12 sm:py-20" style={{ background: 'linear-gradient(150deg, #312E81 0%, #4338CA 100%)' }}>
          <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(8,145,178,0.6), transparent)' }} />
          <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '44px 44px', maskImage: 'radial-gradient(circle at 50% 40%, #000, transparent 75%)', WebkitMaskImage: 'radial-gradient(circle at 50% 40%, #000, transparent 75%)' }} />
          <div className="relative mx-auto max-w-2xl">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[14px]" style={{ background: 'rgba(255,255,255,0.12)' }}><Zap size={26} className="text-white" /></span>
            <Reveal as="h2" delay={0.04} className="mt-6 font-heading text-[clamp(1.8rem,4.5vw,2.6rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Spend less time scheduling. Spend more time with patients.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75">
              Set up your clinic&apos;s booking page today — free forever, ready to share in minutes.
            </Reveal>
            <Reveal delay={0.12} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link to={START} className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
                Launch My Page — Free <ArrowRight size={16} />
              </Link>
              <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="inline-flex items-center justify-center gap-2 rounded-[10px] border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline">
                Book A Demo
              </Link>
            </Reveal>
            <Reveal delay={0.16} className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
              {['No credit card', 'Free forever', '0% on Sloth Active'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Check size={14} style={{ color: '#67E8F9' }} /> {t}</span>
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
              <p className="mt-2 max-w-xs text-sm text-slate-500">The cleaner way to run your ENT clinic&apos;s bookings.</p>
              <CtaButton to={START} className="mt-5">Claim Your Link — Free <ArrowRight size={15} /></CtaButton>
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
            <p className="text-xs text-slate-500">Made for India&apos;s ENT specialists &amp; surgeons</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
