// /for/veterinarians — bespoke, conversion-focused landing page for
// veterinarians & pet clinics in India. (Design brief #15.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx, prerender.mjs,
// sitemapService.js, Navbar "Who it's for" menu.
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in a
// friendly TEAL + warm CORAL system (calm, caring, rounded — for pets & their
// people) — distinct from derm (cyan/rose bento), GP (blue, timeline) and physio
// (lime, marquees). Mechanics unique to this page: paw-dot rounded hero with a
// floating "appointment confirmed" card · white service cards with a filled-teal
// icon circle + coral tag · winding dotted SVG paw-trail steps · single-shelf
// logo row · teal impact band with paw accents · two-row friendly quote cards ·
// two-card manual-vs-Sloth comparison · two-card pricing · split about + trust
// grid · paw-textured teal final CTA. Only nav/hero shell/footer may resemble
// sibling pages.
//
// IMAGES: intentional EMPTY ImgSlot placeholders with descriptive alt.
//
// HONESTY (medical-adjacent): scheduling + payment tool, NOT a medical-records or
// advice product. No treatment/outcome claims; testimonials are labelled
// placeholders from clinic STAFF / vets about ADMIN relief (phone tag, no-shows,
// reminders, getting paid up front) — never pet parents about an animal's care.
// Trust facts emphasise payment security + India data residency + DPDP; JSON-LD
// has NO aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// accordion + billing toggle, AA-contrast palette, visible focus, NO hover uplift,
// Reveal guards its own motion.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star, PawPrint,
  CalendarCheck, LayoutDashboard, BellRing,
  Stethoscope, Syringe, Scissors, Bone, Heart, Video,
  ShieldCheck, Lock, Landmark, BadgePercent,
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

const MASCOT = '/for/veterinarians/hero.webp';
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Loved by pet parents'];

// Signature #2 — white service cards, filled-teal icon circle + coral tag.
const SERVICES = [
  { icon: Stethoscope, label: 'Vet Consultation', desc: 'General check-ups and health consultations.', tag: 'Consult' },
  { icon: Syringe, label: 'Vaccination', desc: 'Book shots and keep the schedule on track.', tag: 'Preventive' },
  { icon: Scissors, label: 'Grooming', desc: 'Grooming, bathing and nail-care sessions.', tag: 'Care' },
  { icon: Bone, label: 'Dental & Nutrition', desc: 'Dental care and diet consultations.', tag: 'Wellness' },
  { icon: Heart, label: 'Surgery Consultation', desc: 'Pre- and post-operative consultations.', tag: 'Consult' },
  { icon: Video, label: 'Online Consultation', desc: 'Video consults for quick follow-ups from home.', tag: 'Remote' },
];

// Signature #3 — winding dotted paw-trail steps.
const STEPS = [
  { title: 'Set up your clinic', icon: LayoutDashboard, desc: 'Add your services, fees and clinic hours, then share your link.' },
  { title: 'Pet parents book & pay', icon: CalendarCheck, desc: 'They pick a slot and pay the fee upfront — in under a minute.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Confirmations and WhatsApp reminders go out before every visit.' },
  { title: 'A calmer clinic', icon: PawPrint, desc: 'Your reception runs without the constant phone calls.' },
];
// Desktop offsets so markers sit along the winding trail (gentle wave, not zig-zag).
const STEP_OFFSET = ['lg:mt-2', 'lg:mt-20', 'lg:mt-0', 'lg:mt-14'];

// Logo row — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg' },
  { name: 'Razorpay', logo: razorpayLogo },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg' },
];

// Teal impact band.
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night' },
  { v: '100%', l: 'Kept on Sloth Active' },
  { v: '₹0', l: 'To get started' },
  { v: 'GST', l: 'Invoices, automatic' },
];

// Placeholder testimonials — clinic STAFF / vets about ADMIN relief, never pet
// parents about an animal's care. Swap for real quotes when available.
const TESTIMONIALS = [
  { quote: 'Pet parents used to call the clinic all day. Now they book on our link and it is confirmed — reception is calm, our no-shows have dropped, and the vaccination reminders keep every pet on schedule.', name: 'Dr. Kabir Sethi', role: 'Veterinarian', company: 'Happy Paws Clinic, Bengaluru' },
  { quote: 'The vaccination reminders alone have been worth it — far fewer families forgetting the next shot, so our schedule stays full.', name: 'Anjali Desai', role: 'Clinic Manager', company: 'PetCare, Pune' },
  { quote: 'The front desk isn’t glued to the phone any more — pet parents book on the link themselves, in under a minute, and our no-shows have dropped.', name: 'Meera Iyer', role: 'Front Desk', company: 'Tails & Whiskers, Chennai' },
  { quote: 'Collecting the consultation fee upfront, with a GST invoice each time, cleaned up our billing completely.', name: 'Dr. Priya Nair', role: 'Veterinarian', company: 'Whiskers Vet, Kochi' },
];

// Two-card comparison — manual reception vs an automated clinic workflow.
const OLD_WAY = [
  { title: 'Phone tag for every appointment', desc: 'The desk calls pet parents back to fix visit times.' },
  { title: 'Missed vaccinations', desc: 'No reminders means the next shot slips through.' },
  { title: 'Chasing consultation fees', desc: 'Payment is collected at the desk, or not at all.' },
  { title: 'A paper appointment book', desc: 'Visits scattered across a register and phone notes.' },
  { title: 'Double-booked slots', desc: 'Two pets booked into the same slot by hand.' },
];
const NEW_WAY = [
  { title: 'One friendly booking link', desc: 'Pet parents pick a slot themselves, 24/7 — no calls needed.' },
  { title: 'Automatic vaccine reminders', desc: 'WhatsApp reminders keep vaccinations on schedule.' },
  { title: 'Fees collected upfront', desc: 'Consultation fee taken at booking, over UPI or card.' },
  { title: 'One clean clinic calendar', desc: 'Every appointment and vet in a single view.' },
  { title: 'Conflict-free slots', desc: 'Availability stays accurate — no double bookings.' },
];

// Trust facts — verifiable only.
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your clinic data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: 'Operated under India’s data protection law' },
  { icon: BadgePercent, value: '0% commission', label: 'On Sloth Active — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for veterinarians and pet clinics?', a: 'Yes. Whether you are a solo vet or a pet clinic with a team, Meeticulous manages your services, availability, bookings and communication from one place — so pet parents can book without calling and your reception stays calm. It is a scheduling and payment tool, not a medical-records system.' },
  { q: 'Can pet parents book appointments online?', a: 'Yes. A pet parent opens your booking link, chooses a service such as a consultation or vaccination, picks a convenient time and confirms — in under a minute, no calls needed.' },
  { q: 'Can I send vaccination reminders?', a: 'Yes. Meeticulous sends automatic WhatsApp and email reminders before every appointment, which helps pet parents keep their pet’s vaccination schedule on track.' },
  { q: 'Can I offer grooming, dental and online consultations?', a: 'Yes. Create as many services as you need — consultation, vaccination, grooming, dental care — and offer online consults with automatic Google Meet links for quick follow-ups.' },
  { q: 'Can I collect the consultation fee online?', a: 'Yes. Collect the fee upfront through Razorpay — UPI, cards or netbanking — before the appointment. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Is our clinic and client information kept private?', a: 'Meeticulous stores appointment and contact details for booking only — it is not a medical-records system. Your production data is hosted in India (Mumbai) and the platform operates under India’s DPDP Act 2023.' },
  { q: 'Do we need any technical setup?', a: 'No. Setup takes minutes and needs no technical skills. You add your services and clinic hours, and your booking page is ready to share — pet parents need nothing more than the link.' },
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
    { label: 'Veterinarians & Pet Clinics', to: '/for/veterinarians' },
    { label: 'Doctors & Clinics', to: '/for/doctors' },
    { label: 'Dermatologists & Skin Clinics', to: '/for/dermatologists' },
    { label: 'Pediatricians & Child Care', to: '/for/pediatricians' },
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

// Decorative paw + dot scatter positions (signature paw-dot motif).
const PAW_LAYOUT = [
  { x: '5%', y: '20%', size: 30, rot: -18, op: 0.11 },
  { x: '15%', y: '70%', size: 22, rot: 14, op: 0.09 },
  { x: '39%', y: '10%', size: 18, rot: 26, op: 0.08 },
  { x: '74%', y: '74%', size: 34, rot: -12, op: 0.10 },
  { x: '89%', y: '24%', size: 24, rot: 18, op: 0.11 },
  { x: '60%', y: '86%', size: 20, rot: -24, op: 0.08 },
];
const PAW_DOTS = [
  { x: '24%', y: '32%', s: 8, op: 0.14 },
  { x: '48%', y: '66%', s: 6, op: 0.12 },
  { x: '82%', y: '54%', s: 9, op: 0.13 },
  { x: '11%', y: '46%', s: 6, op: 0.12 },
];

/* ─────────────────────────────  PRIMITIVES  ────────────────────────────── */

function NavLink({ item, className, onClick }) {
  if (item.to) return <Link to={item.to} className={className} onClick={onClick}>{item.label}</Link>;
  return <a href={item.href} className={className} onClick={onClick}>{item.label}</a>;
}

function CtaButton({ to, children, variant = 'solid', className = '' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-all hover:no-underline';
  const styles = {
    solid: 'text-white shadow-[0_4px_14px_rgba(21,127,118,0.24)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/25',
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

/* Scattered paw + dot texture — purely decorative. `color` tints paws & dots. */
function PawField({ color = 'var(--ca-primary)', className = '' }) {
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {PAW_LAYOUT.map((p, i) => (
        <PawPrint
          key={`p${i}`}
          size={p.size}
          strokeWidth={1.6}
          className="absolute"
          style={{ left: p.x, top: p.y, color, opacity: p.op, transform: `rotate(${p.rot}deg)` }}
        />
      ))}
      {PAW_DOTS.map((d, i) => (
        <span
          key={`d${i}`}
          className="absolute rounded-full"
          style={{ left: d.x, top: d.y, width: d.s, height: d.s, background: color, opacity: d.op }}
        />
      ))}
    </div>
  );
}

/* Single-open accordion FAQ, two columns. */
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

export default function Veterinarians() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/veterinarians`;
  const seo = {
    title: 'Appointment Booking Software for Veterinarians & Pet Clinics | Meeticulous',
    description: 'Meeticulous is appointment booking software for veterinarians and pet clinics in India. Let pet parents book consultations and vaccinations online — fees collected upfront, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'appointment booking software for veterinarians, pet clinic scheduling software india, book vet appointment online, pet vaccination booking, pet vaccination reminder software, veterinary appointment app india, veterinary clinic booking page, animal clinic appointment system',
    ogTitle: 'Your clinic runs on appointments. Let Meeticulous schedule them.',
    ogDescription: 'Pet parents book consultations and vaccinations, pay upfront and get WhatsApp reminders — automatically. A friendly booking page for vets and pet clinics in India.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Veterinarians & Pet Clinics',
    serviceType: 'Appointment booking software for veterinarians and pet clinics',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Friendly teal + warm coral — legacy --ca-* var names kept (shared classNames).
  const styleVars = {
    '--ca-primary': '#157F76', // warm teal — text/links/fills, AA on white (~4.85:1)
    '--ca-accent': '#F97316',  // orange-500 coral — sparing warmth accent
    '--ca-ink': '#1C2B29',     // deep teal-slate text
    '--ca-cream': '#FFF7ED',   // warm orange-50 section bg
    '--ca-grey': '#F1F5F4',    // cool light-grey section bg
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
        themeColor="#157F76"
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

      {/* ═══════════════ 2 · HERO (paw-dot rounded composition + confirmed card) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-20 pt-10 sm:px-8 lg:pb-28 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        {/* warm coral blob — sits INTO the cream via multiply */}
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(249,115,22,0.20), transparent)' }} />
        <div aria-hidden className="pointer-events-none absolute -left-24 top-1/3 h-72 w-72 rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(21,127,118,0.12), transparent)' }} />
        {/* signature paw-dot motif */}
        <PawField color="var(--ca-primary)" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Easy appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>veterinarians</span> managing pet-care appointments.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for veterinarians — pet parents book consultations and vaccinations in a minute, pay upfront, and get reminders, for a calmer clinic and waiting room.
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

          {/* RIGHT — single strongly-rounded image + floating confirmed card + coral reminder chip */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-none">
            <ImgSlot
              alt="A veterinarian with a happy dog at a modern pet clinic"
              rounded="rounded-[32px]"
              className="aspect-[4/5] shadow-[0_30px_70px_-30px_rgba(28,43,41,0.45)]"
            />
            <div className="absolute -bottom-5 -left-4 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(28,43,41,0.5)] sm:-left-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={18} /></span>
              <div>
                <div className="text-[11px] font-medium text-slate-500">Pet appointment confirmed</div>
                <div className="text-sm font-bold text-[color:var(--ca-ink)]">Bruno · Vaccination · 11:00 AM</div>
              </div>
            </div>
            <div className="absolute -right-3 top-8 z-20 flex items-center gap-2 rounded-full bg-white px-3 py-2 shadow-[0_12px_28px_-16px_rgba(28,43,41,0.5)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: 'var(--ca-accent)' }}><BellRing size={13} /></span>
              <span className="text-[12px] font-semibold text-[color:var(--ca-ink)]">Reminder sent</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (white cards · filled-teal icon · coral tag) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for veterinarians, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              From consultations to vaccinations, grooming and dental care, let pet parents book any visit in seconds.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.05}>
                <Link to={START} className="group flex h-full flex-col rounded-[24px] border border-black/[0.07] bg-white p-6 transition-all hover:border-[color:var(--ca-primary)]/35 hover:shadow-[0_18px_40px_-24px_rgba(21,127,118,0.35)] hover:no-underline">
                  <div className="flex items-start justify-between">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_20px_-8px_rgba(21,127,118,0.6)]" style={{ background: 'var(--ca-primary)' }}>
                      <s.icon size={26} />
                    </span>
                    <span className="rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide" style={{ background: 'color-mix(in srgb, var(--ca-accent) 16%, white)', color: 'var(--ca-ink)' }}>{s.tag}</span>
                  </div>
                  <h3 className="mt-5 font-heading text-[16px] font-bold text-[color:var(--ca-ink)]">{s.label}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-500">{s.desc}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold" style={{ color: 'var(--ca-primary)' }}>
                    Set it up <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (winding dotted paw-trail) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              How Meeticulous helps <span style={{ color: 'var(--ca-primary)' }}>pet clinics.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              From a ringing phone to a confirmed, paid visit — in four friendly steps.
            </Reveal>
          </div>

          <div className="relative mt-16">
            {/* the winding dotted trail (desktop) */}
            <svg aria-hidden viewBox="0 0 1200 240" preserveAspectRatio="none" className="pointer-events-none absolute inset-x-0 top-0 hidden h-full w-full lg:block">
              <path d="M 90 60 C 260 210, 400 210, 560 120 S 900 20, 1120 150" fill="none" stroke="var(--ca-primary)" strokeOpacity="0.4" strokeWidth="2.5" strokeDasharray="1 15" strokeLinecap="round" />
            </svg>
            <ol className="relative grid gap-y-12 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className={`relative ${STEP_OFFSET[i]}`}>
                  <Reveal delay={i * 0.08} className="text-center">
                    <span className="relative z-10 mx-auto flex h-16 w-16 items-center justify-center rounded-full text-white shadow-[0_12px_26px_-10px_rgba(21,127,118,0.7)]" style={{ background: 'var(--ca-primary)' }}>
                      <s.icon size={24} />
                    </span>
                    <span className="relative z-10 mx-auto -mt-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white font-heading text-[12px] font-extrabold text-white" style={{ background: 'var(--ca-accent)' }}>{i + 1}</span>
                    <h3 className="mt-3 font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                    <p className="mx-auto mt-1.5 max-w-[15rem] text-sm leading-relaxed text-slate-500">{s.desc}</p>
                  </Reveal>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (single-shelf logo row) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Connect your calendar, payments and WhatsApp — Meeticulous fits your clinic, no rewiring.
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-12">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-6 rounded-[24px] border border-black/[0.07] bg-white px-6 py-8 shadow-[0_18px_50px_-34px_rgba(28,43,41,0.4)] sm:gap-x-10 sm:px-10">
              {TOOLS.map((t) => (
                <span key={t.name} className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--ca-grey)]">
                    {t.logo ? <img src={t.logo} alt="" loading="lazy" className="h-5 w-5 object-contain" /> : <ToolLogo name={t.icon} size={20} className="h-5 w-5" />}
                  </span>
                  <span className="text-sm font-bold text-[color:var(--ca-ink)]">{t.name}</span>
                </span>
              ))}
            </div>
          </Reveal>
          <Reveal delay={0.1} className="mt-6 text-center text-sm text-slate-500">
            Google Calendar busy-time blocking, auto Google Meet links, WhatsApp reminders, and Razorpay payments with automatic GST invoices.
          </Reveal>
          <Reveal delay={0.12} className="mt-8 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              Explore All Features <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (warm teal band + paw accents) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'var(--ca-primary)' }}>
        <PawField color="#ffffff" />
        <div className="relative mx-auto max-w-6xl">
          <Reveal as="h2" className="text-center font-heading text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">
            Real impact for a modern pet clinic.
          </Reveal>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-white/15">
            {METRICS.map((m, i) => (
              <Reveal key={m.l} delay={i * 0.06} className="text-center lg:px-4">
                <PawPrint size={18} className="mx-auto mb-2.5" style={{ color: 'var(--ca-accent)' }} />
                <div className="font-heading text-5xl font-extrabold tracking-tight text-white sm:text-6xl">{m.v}</div>
                <div className="mt-2 text-sm font-semibold text-white">{m.l}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (friendly quote cards · 2 rows) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Clinics that swapped the <span style={{ color: 'var(--ca-primary)' }}>phone for a link.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              What clinic teams say about running reception with Meeticulous.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 2) * 0.06}>
                <figure className="rounded-[24px] border border-black/[0.07] bg-white p-7">
                  <div className="flex items-center justify-between">
                    <span aria-hidden className="font-heading text-5xl leading-none" style={{ color: 'color-mix(in srgb, var(--ca-accent) 55%, white)' }}>&ldquo;</span>
                    <span className="flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={14} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}</span>
                  </div>
                  <blockquote className="mt-2 text-[15px] leading-relaxed text-slate-700">{t.quote}</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-black/[0.06] pt-5">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--ca-primary)' }}>{t.name.replace('Dr. ', '').charAt(0)}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-bold text-[color:var(--ca-ink)]">{t.name}</div>
                      <div className="truncate text-[12px] text-slate-500">{t.role} · {t.company}</div>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (two cards · manual vs Meeticulous) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Manual reception vs <span style={{ color: 'var(--ca-primary)' }}>an automated clinic.</span>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {/* The manual way */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[24px] border border-black/[0.08] p-8" style={{ background: 'var(--ca-grey)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400"><X size={18} /></span>
                  <h3 className="font-heading text-lg font-bold text-slate-500">The manual way</h3>
                </div>
                <ul className="mt-6 flex flex-col gap-4">
                  {OLD_WAY.map((o) => (
                    <li key={o.title} className="flex items-start gap-3">
                      <X size={17} className="mt-0.5 flex-shrink-0 text-slate-300" />
                      <div>
                        <p className="text-[14px] font-semibold text-slate-600">{o.title}</p>
                        <p className="mt-0.5 text-[13px] leading-snug text-slate-400">{o.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
            {/* With Meeticulous */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[24px] border-2 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(21,127,118,0.4)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: 'var(--ca-primary)' }}><Check size={18} /></span>
                  <h3 className="font-heading text-lg font-bold text-[color:var(--ca-ink)]">With Meeticulous</h3>
                </div>
                <ul className="mt-6 flex flex-col gap-4">
                  {NEW_WAY.map((n) => (
                    <li key={n.title} className="flex items-start gap-3">
                      <Check size={17} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ca-primary)' }} />
                      <div>
                        <p className="text-[14px] font-semibold text-[color:var(--ca-ink)]">{n.title}</p>
                        <p className="mt-0.5 text-[13px] leading-snug text-slate-500">{n.desc}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · PRICING (two friendly cards + toggle) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
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
              Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--ca-primary) 12%, white)', color: 'var(--ca-primary)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
            </span>
          </Reveal>

          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Sloth (free) */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[20px] border border-black/[0.08] bg-white p-7">
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
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} variant="ghost" className="mt-7 w-full">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>

            {/* Sloth Active (premium) — recommended */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[20px] border-2 bg-white p-7 shadow-[0_24px_60px_-30px_rgba(21,127,118,0.28)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
                <div className="flex items-center gap-2">
                  <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: 'color-mix(in srgb, var(--ca-accent) 18%, white)', color: 'var(--ca-ink)' }}>Recommended</span>
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
            <span className="flex items-center gap-1.5 text-sm text-slate-500"><Lock size={14} style={{ color: 'var(--ca-primary)' }} /> Access to all features with no hidden fees</span>
            <Link to="/pricing" className="text-sm font-semibold text-slate-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 10 · ABOUT (split text + ImgSlot + trust grid) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-2 text-center lg:order-1 lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Modern clinics deserve <span style={{ color: 'var(--ca-primary)' }}>better tools.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-slate-600">
              Meeticulous was built to make appointment-based practices easier to run. Instead of a ringing phone, a paper register and payments at the desk, pet clinics can manage their appointments, clients and money from one friendly platform.
            </Reveal>
            <Reveal delay={0.12} className="mt-8 grid gap-3 sm:grid-cols-2">
              {TRUST_STRIP.map((it) => (
                <div key={it.value} className="flex items-start gap-3 rounded-[16px] border border-black/[0.08] bg-white p-4 text-left">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--ca-primary) 10%, transparent)', color: 'var(--ca-primary)' }}>
                    <it.icon size={17} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-[color:var(--ca-ink)]">{it.value}</div>
                    <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{it.label}</div>
                  </div>
                </div>
              ))}
            </Reveal>
            <Reveal delay={0.16} className="mt-8">
              <Link to="/about" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
                Learn More About Us <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
          <Reveal className="order-1 lg:order-2">
            <ImgSlot
              alt="A friendly veterinarian welcoming a pet and its owner to the clinic"
              rounded="rounded-[28px]"
              className="aspect-[5/4] w-full shadow-[0_28px_64px_-32px_rgba(28,43,41,0.4)]"
            />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · FAQ (two-column accordion) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 12 · FINAL CTA (teal · coral glow · paw texture) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8" style={{ background: 'linear-gradient(150deg, #0E5B54 0%, #157F76 55%, #0E5B54 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-64 w-[42rem] -translate-x-1/2 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(249,115,22,0.45), transparent)' }} />
        <PawField color="#ffffff" />
        <div className="relative mx-auto max-w-2xl">
          <Reveal className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}>
            <PawPrint size={26} style={{ color: '#FDBA74' }} />
          </Reveal>
          <Reveal as="h2" delay={0.06} className="mt-6 font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            Spend less time on the phone. <span style={{ color: '#FDBA74' }}>Spend more time with pets.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base text-white/80">
            Set up your clinic booking page today and give pet parents a friendly way to book with you.
          </Reveal>
          <Reveal delay={0.14} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link to={START} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              Launch My Page — Free <ArrowRight size={16} />
            </Link>
            <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline">
              Book A Demo
            </Link>
          </Reveal>
          <Reveal as="p" delay={0.18} className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] font-medium text-white/70">
            {['No credit card', 'Free forever', '0% on Sloth Active'].map((t) => (
              <span key={t} className="flex items-center gap-1.5"><Check size={14} style={{ color: '#FDBA74' }} /> {t}</span>
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
              <p className="mt-2 max-w-xs text-sm text-slate-500">The friendlier way to run your pet clinic&apos;s bookings.</p>
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
            <p className="text-xs text-slate-500">Made for India&apos;s veterinarians &amp; pet clinics</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
