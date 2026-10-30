// /for/dentists — bespoke, conversion-focused landing page for dental clinics &
// dental practices in India. (Sept release rebuild — design brief: Dentists.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Route/nav/prerender/sitemap are wired by
// the main thread — this file is the page component only.
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in a
// clean CLINICAL SKY-BLUE + MINT system (bright, hygienic, trustworthy) — distinct
// from dermatologists (cyan+rose, 2-tile hero, masonry, before/after toggle), GP
// (blue, vertical timeline), physio (lime, marquees). Mechanics unique to this page:
//   · HERO      — clean split: one image + floating "Appointment confirmed" card +
//                 mint "reminder sent" chip + sky blob (mix-blend-multiply)
//   · SERVICES  — "treatment grid": crisp checklist cards, sky icon chip + mint tick
//   · STEPS     — a gentle 4-step ARC/dome, sky markers + mint connector (no rail)
//   · INTEGRATIONS — a "Connected apps" panel (rows + mint status pills)
//   · IMPACT    — frosted stat tiles on a sky→ink gradient band
//   · TESTIMONIALS — manual scroll-snap review carousel (arrow controls, no dots)
//   · COMPARISON — a 3-column aspect matrix (task · manual · Meeticulous)
//   · PRICING   — two clean cards, sky header strip, monthly/yearly toggle
//   · ABOUT     — editorial + a real photo gallery (main + thumbnail rail)
// Only nav/hero-shell/footer (shared shell) may resemble sibling pages.
//
// IMAGES: REAL clinic photos reused from the previous page — hero, about gallery
// and the tool-logo row. Each has a descriptive alt. No empty placeholders.
//
// HONESTY (medical): a scheduling + payment tool, NOT a dental-records or treatment
// system. No treatment/outcome claims. Testimonials are labelled placeholder quotes
// from clinic STAFF about ADMIN relief (no-shows, front desk, fee collection) — never
// patients about treatment. Trust facts emphasise payment security + India data
// residency + DPDP. JSON-LD has NO aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on icon-only
// controls / tablists / accordion, AA-contrast palette, visible focus, NO hover
// uplift anywhere, Reveal guards its own motion.

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star, ChevronLeft, ChevronRight,
  CalendarCheck, LayoutDashboard, BellRing, Share2, MessageCircle,
  Smile, Sparkles, Stethoscope, Activity, ShieldCheck, Baby, Syringe, Clock3,
  Lock, Landmark, BadgePercent, Zap,
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

const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian clinics'];

// Treatment grid — every appointment a dental clinic runs, bookable online.
const SERVICES = [
  { icon: Smile, label: 'Routine Check-up', desc: 'Regular dental exams and reviews.' },
  { icon: Sparkles, label: 'Cleaning & Whitening', desc: 'Scaling, polishing and whitening.' },
  { icon: Stethoscope, label: 'Consultation', desc: 'First-visit assessments.' },
  { icon: Activity, label: 'Root Canal Consult', desc: 'Endodontic planning appointments.' },
  { icon: ShieldCheck, label: 'Implant Consult', desc: 'Implant assessment bookings.' },
  { icon: Syringe, label: 'Orthodontic Consult', desc: 'Braces and aligner consults.' },
  { icon: Baby, label: 'Kids Dentistry', desc: 'Gentle care for children.' },
  { icon: Clock3, label: 'Emergency Slot', desc: 'Same-day urgent appointments.' },
];

// Four gentle steps, traced along an arc (sky markers, mint connector).
const STEPS = [
  { title: 'Set up your clinic & slots', icon: LayoutDashboard, desc: 'Add your appointment types, chairs and hours in minutes.' },
  { title: 'Share your booking link', icon: Share2, desc: 'Put one link on Google, WhatsApp or your website.' },
  { title: 'Patients book & pay', icon: CalendarCheck, desc: 'A patient picks an appointment type and time — and can pay upfront.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Automatic confirmations and WhatsApp reminders before each visit.' },
];

// Integration rows — REAL Meeticulous integrations only. Reuses the same tool
// logos the previous page shipped (favicon + brand logos are excepted from the
// image rule; these are the tool-logo row).
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg', sub: 'Auto Meet links for online consults' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg', sub: 'Appointment reminders on autopilot' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Online payments, refunds & GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Accept instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Confirmation emails, sent automatically' },
];

// Impact — verifiable, admin-focused. No clinical/outcome claims.
const METRICS = [
  { value: '0%', label: 'Commission on Pro', desc: 'Every consult fee stays with the practice.', icon: BadgePercent },
  { value: '< 5 min', label: 'To go live', desc: 'Set up your services and share a booking page.', icon: Sparkles },
  { value: '24/7', label: 'Always open to book', desc: 'Patients book or reschedule any time — no calls.', icon: CalendarCheck },
];

// Placeholder testimonials — clinic STAFF about ADMIN relief (front desk, no-shows,
// fee collection). NOT patients about treatment. Swap for real clinic quotes later.
const TESTIMONIALS = [
  { quote: 'Our front desk used to spend the whole morning on the phone. Patients now book their own slots and the reminders have cut our no-shows right down.', name: 'Kavya Nair', role: 'Practice Manager', company: 'Nair Dental Care, Kochi' },
  { quote: 'Setup took an evening. One clear diary means no more double-booked chairs — exactly what a busy front desk needs.', name: 'Arjun Mehta', role: 'Clinic Owner', company: 'Smile Studio, Pune' },
  { quote: 'Collecting the consult fee online before the visit tidied up our billing, and the GST invoices are generated for us automatically.', name: 'Sneha Rao', role: 'Front Desk Lead', company: 'DentaCare, Bengaluru' },
  { quote: 'A calm, professional booking page — and 0% commission on Pro means every rupee stays with the practice.', name: 'Imran Sheikh', role: 'Practice Owner', company: 'City Dental, Hyderabad' },
  { quote: 'The WhatsApp reminders alone save the reception hours every week that we used to spend chasing confirmations.', name: 'Ananya Gupta', role: 'Clinic Coordinator', company: 'Bright Smile, Delhi' },
];

// Comparison matrix — the front-desk task, the manual way, the Meeticulous way.
const COMPARE = [
  { aspect: 'Filling the diary', manual: 'Phone ringing all day to book a slot', bas: 'Patients pick a slot themselves, 24/7' },
  { aspect: 'No-shows', manual: 'Empty chairs when patients forget', bas: 'Automatic reminders cut no-shows' },
  { aspect: 'Collecting fees', manual: 'Consult fees chased at the counter', bas: 'Fee collected upfront over UPI or card' },
  { aspect: 'Reminders', manual: 'Sent by hand, one message at a time', bas: 'WhatsApp reminders sent for you' },
  { aspect: 'The clinic diary', manual: 'A paper register, easy to double-book', bas: 'One live, conflict-free calendar' },
];

// Trust facts — verifiable only, health-data tuned.
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your clinic data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for a dental clinic?', a: 'Yes — for managing appointments with your patients: an online booking page, automatic reminders, optional upfront fees and one clear diary. It is a scheduling and reminder tool for your practice, not a dental-records or advertising channel.' },
  { q: 'Does using Meeticulous comply with dental council / NMC advertising norms?', a: 'Medical and dental practitioners are restricted from advertising or soliciting patients (NMC Code of Ethics, Reg. 6–7). Meeticulous is a scheduling and reminder tool — how you use it is your responsibility. We suggest sharing your booking link with your existing patients rather than as public advertising, and following your council’s guidance. We do not advertise your practice, and we never publish patient reviews, ratings or testimonials.' },
  { q: 'Can patients book appointments online?', a: 'Yes. A patient opens your booking link, chooses an appointment type such as a check-up or consultation, picks a time and confirms — no calls to your front desk.' },
  { q: 'Can I send WhatsApp reminders?', a: 'Yes. Meeticulous sends automatic confirmations and reminders over WhatsApp and email before each appointment, which cuts no-shows. WhatsApp reminders are included on the Pro plan (and free for your first two months on the Starter plan).' },
  { q: 'Can I collect fees online?', a: 'Optionally. Collect a consultation fee upfront through Razorpay — UPI, cards or netbanking — or leave it off and collect at the clinic. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I manage multiple dentists or chairs?', a: 'Right now Meeticulous is best for a single appointment calendar per account — two dentists or chairs on one account share one diary and cannot be booked in parallel. Parallel multi-chair scheduling is on our roadmap; in the meantime a separate account per dentist is the workaround. We would rather tell you upfront than have it surprise you after setup.' },
  { q: 'Is patient information kept private?', a: 'Your production data is hosted in India (Mumbai) and the platform operates under India’s DPDP Act 2023. Meeticulous stores appointment and contact details for booking — it is not a dental-records system, and you control what a patient provides when booking. We never display patient reviews or ratings publicly.' },
  { q: 'Is there a free plan?', a: 'Yes. The Starter plan is free forever — an online booking page, unlimited appointment types and bookings, UPI payments, 24-hour reminders and GST invoices — with a small 5% per-booking fee. Pro removes that commission entirely and adds WhatsApp automation and more.' },
];

const FOOTER_COLS = [
  { title: 'Product', links: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Integrations', href: '#features' },
    { label: "What's New", to: '/changelog' },
  ] },
  { title: 'For Professionals', links: [
    { label: 'Dental Clinics', to: '/for/dentists' },
    { label: 'Dermatologists & Skin Clinics', to: '/for/dermatologists' },
    { label: 'General Physicians', to: '/for/doctors' },
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
    solid: 'text-white shadow-[0_4px_14px_rgba(3,105,161,0.24)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/25',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

/* Mint confirmation tick — mint on a light-mint disc, deepened so the glyph reads
   at AA even though pure #14B8A6 on white would be too light. */
function MintTick({ size = 13 }) {
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-full"
      style={{ height: size + 11, width: size + 11, background: 'color-mix(in srgb, var(--ca-accent) 16%, white)', color: 'color-mix(in srgb, var(--ca-accent) 72%, var(--ca-ink))' }}
    >
      <Check size={size} strokeWidth={3} />
    </span>
  );
}

function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="overflow-hidden rounded-[12px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'var(--ca-primary)' : 'rgba(12,34,49,0.08)' }}>
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

/* Manual scroll-snap testimonial carousel — arrow controls, no auto-scroll (so no
   reduced-motion concern), no dots. Clinic STAFF quotes about admin relief. */
function ReviewCarousel() {
  const ref = useRef(null);
  const scrollByCard = (dir) => {
    const el = ref.current;
    if (!el) return;
    const card = el.querySelector('[data-card]');
    const amount = card ? card.offsetWidth + 20 : el.clientWidth * 0.85;
    el.scrollBy({ left: dir * amount, behavior: 'smooth' });
  };
  return (
    <div className="relative">
      <div
        ref={ref}
        className="dent-rail flex snap-x snap-mandatory gap-5 overflow-x-auto pb-3"
        style={{ scrollbarWidth: 'none' }}
      >
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            data-card
            className="flex w-[86%] flex-shrink-0 snap-start flex-col rounded-[18px] border border-black/[0.07] bg-white p-6 shadow-[0_18px_44px_-30px_rgba(12,34,49,0.5)] sm:w-[47%] lg:w-[31.5%]"
          >
            <div className="flex items-center justify-between">
              <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={15} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}</div>
              <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: 'color-mix(in srgb, var(--ca-primary) 10%, transparent)', color: 'var(--ca-primary)' }}>Clinic staff</span>
            </div>
            <blockquote className="mt-3 flex-1 text-[14.5px] leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-black/5 pt-4">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--ca-primary)' }}>{t.name.charAt(0)}</span>
              <div>
                <div className="text-[13px] font-bold text-[color:var(--ca-ink)]">{t.name}</div>
                <div className="text-[11px] text-slate-500">{t.role} · {t.company}</div>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button type="button" onClick={() => scrollByCard(-1)} aria-label="Previous reviews" className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-[color:var(--ca-ink)] transition-colors hover:border-[color:var(--ca-primary)]/40 hover:bg-[color:var(--ca-cream)]">
          <ChevronLeft size={18} />
        </button>
        <button type="button" onClick={() => scrollByCard(1)} aria-label="More reviews" className="flex h-11 w-11 items-center justify-center rounded-full border border-black/10 bg-white text-[color:var(--ca-ink)] transition-colors hover:border-[color:var(--ca-primary)]/40 hover:bg-[color:var(--ca-cream)]">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function DentistPage() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/dentists`;
  const seo = {
    title: 'Appointment Booking Software for Dental Clinics | Meeticulous',
    description: 'Meeticulous is appointment booking software for dentists and dental clinics in India. Let your patients book and reschedule appointments online, with automatic WhatsApp reminders, GST invoices and 0% commission. A scheduling tool for your practice — not an advertising channel. Start free.',
    keywords: 'dental clinic appointment software, dentist booking software india, dental practice scheduling, patient appointment booking, dental clinic management booking',
    ogTitle: 'Your clinic runs on appointments. Let Meeticulous schedule them.',
    ogDescription: 'Patients book and reschedule online, get WhatsApp reminders, and your front desk spends less time on the phone. A calm scheduling page for dental clinics in India.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Dentists & Dental Clinics',
    serviceType: 'Appointment booking software for dental clinics',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Clean clinical sky-blue + mint. Legacy --ca-* names kept (shared classNames).
  const styleVars = {
    '--ca-primary': '#0369A1', // sky-700 — text/links/fills, AA on white (~5.9:1)
    '--ca-accent': '#14B8A6',  // mint/teal — decorative fills, deepened for glyphs
    '--ca-ink': '#0C2231',     // deep slate-blue text
    '--ca-cream': '#F0F9FF',   // sky-50 section bg
    '--ca-grey': '#F1F5F8',    // light section bg
  };

  return (
    <main className="overflow-x-clip bg-white text-[color:var(--ca-ink)]" style={styleVars}>
      <style>{`
        .dent-rail::-webkit-scrollbar{display:none;}
      `}</style>
      <Seo
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor="#0369A1"
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

      {/* ═══════════════ 2 · HERO (clean split + confirmation card + reminder chip) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        {/* sky blob — sits INTO the page via mix-blend-multiply */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-20 h-[26rem] w-[26rem] rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(3,105,161,0.18), transparent)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(20,184,166,0.14), transparent)' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Simple appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>dentists</span> who want fewer calls and fuller chairs.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for dentists — patients book and reschedule online, pay upfront, and get WhatsApp reminders, so your front desk stays off the phone and your chairs stay full.
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

          {/* RIGHT — single real hero image + floating confirmation card + mint reminder chip */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <div className="relative overflow-hidden rounded-[24px] border border-black/[0.06] bg-white shadow-[0_30px_60px_-32px_rgba(12,34,49,0.45)]">
              <img
                src="/for/dentists/dentist-sloth.webp"
                alt="Meeticulous appointment booking for a dental clinic"
                loading="eager"
                fetchpriority="high"
                decoding="async"
                width="1100"
                height="852"
                className="h-auto w-full object-cover"
              />
            </div>
            {/* floating "Appointment confirmed" card */}
            <div className="absolute -bottom-5 left-4 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_16px_36px_-18px_rgba(12,34,49,0.5)] ring-1 ring-black/5 sm:left-6">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={17} /></span>
              <div>
                <div className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'color-mix(in srgb, var(--ca-accent) 72%, var(--ca-ink))' }}><Check size={11} strokeWidth={3} /> Appointment confirmed</div>
                <div className="text-sm font-bold text-[color:var(--ca-ink)]">Dental check-up · 10:30 AM</div>
              </div>
            </div>
            {/* mint "reminder sent" chip */}
            <div className="absolute -top-3 right-3 z-20 hidden items-center gap-2 rounded-full px-3.5 py-2 shadow-[0_12px_30px_-14px_rgba(20,184,166,0.6)] ring-1 ring-black/5 sm:flex" style={{ background: 'color-mix(in srgb, var(--ca-accent) 12%, white)' }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-white" style={{ background: 'var(--ca-accent)' }}><MessageCircle size={13} /></span>
              <span className="text-[12px] font-bold text-[color:var(--ca-ink)]">WhatsApp reminder sent</span>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (treatment grid) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for dentists, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              From check-ups to consultations and emergency slots — patients pick a service and a time in seconds.
            </Reveal>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 4) * 0.05}>
                <div className="group relative flex h-full flex-col rounded-[16px] border border-black/[0.08] bg-white p-6 transition-colors hover:border-[color:var(--ca-primary)]/35">
                  <span aria-hidden className="absolute right-4 top-4"><MintTick /></span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--ca-primary) 9%, transparent)', color: 'var(--ca-primary)' }}>
                    <s.icon size={22} />
                  </span>
                  <h3 className="mt-5 font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{s.label}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1} className="mt-10 text-center">
            <CtaButton to={START}>Start a Free Page <ArrowRight size={15} /></CtaButton>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (gentle 4-step arc) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Live in minutes, <span style={{ color: 'var(--ca-primary)' }}>booked in seconds.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              Four gentle steps from &ldquo;is the dentist free?&rdquo; to a confirmed, paid appointment.
            </Reveal>
          </div>

          {/* Arc band (lg only) — dome curve with sky markers + mint connector. */}
          <div aria-hidden className="relative mx-auto mt-14 hidden h-32 max-w-5xl lg:block">
            <svg viewBox="0 0 1000 128" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="dentArc" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="var(--ca-accent)" stopOpacity="0.25" />
                  <stop offset="0.5" stopColor="var(--ca-accent)" stopOpacity="0.9" />
                  <stop offset="1" stopColor="var(--ca-accent)" stopOpacity="0.25" />
                </linearGradient>
              </defs>
              <path d="M 125 104 C 240 40, 330 40, 500 40 C 670 40, 760 40, 875 104" fill="none" stroke="url(#dentArc)" strokeWidth="2.5" strokeDasharray="2 8" strokeLinecap="round" />
            </svg>
            {STEPS.map((s, i) => {
              const left = ['12.5%', '37.5%', '62.5%', '87.5%'][i];
              const top = [80, 20, 20, 80][i];
              return (
                <div key={s.title} className="absolute -translate-x-1/2" style={{ left, top }}>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full font-heading text-lg font-extrabold text-white" style={{ background: 'var(--ca-primary)', boxShadow: '0 0 0 6px color-mix(in srgb, var(--ca-primary) 12%, transparent), 0 12px 26px -12px rgba(3,105,161,0.9)' }}>
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Step cards */}
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:mt-6 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="flex h-full flex-col rounded-[16px] border border-black/[0.07] bg-white p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-heading text-sm font-extrabold text-white lg:hidden" style={{ background: 'var(--ca-primary)' }}>{i + 1}</span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--ca-accent) 14%, white)', color: 'color-mix(in srgb, var(--ca-accent) 72%, var(--ca-ink))' }}><s.icon size={20} /></span>
                  </div>
                  <h3 className="mt-4 font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1} className="mt-12 text-center">
            <CtaButton to={START}>Launch My Page — Free <ArrowRight size={15} /></CtaButton>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS ("Connected apps" panel) ═══════════════ */}
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
          <Reveal delay={0.08} className="mt-12 overflow-hidden rounded-[20px] border border-black/[0.08] bg-white shadow-[0_24px_60px_-40px_rgba(12,34,49,0.4)]">
            <div className="flex items-center justify-between border-b border-black/5 px-6 py-4" style={{ background: 'var(--ca-grey)' }}>
              <span className="font-heading text-sm font-extrabold uppercase tracking-wide text-[color:var(--ca-ink)]">Connected apps</span>
              <span className="text-xs font-semibold text-slate-500">Included on every plan</span>
            </div>
            <ul className="divide-y divide-black/5">
              {TOOLS.map((t) => (
                <li key={t.name} className="flex items-center gap-4 px-6 py-4">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[color:var(--ca-grey)]">
                    {t.logo ? <img src={t.logo} alt={`${t.name} logo`} loading="lazy" className="h-6 w-6 object-contain" /> : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</div>
                    <div className="mt-0.5 text-xs leading-snug text-slate-500">{t.sub}</div>
                  </div>
                  <span className="hidden items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold sm:inline-flex" style={{ background: 'color-mix(in srgb, var(--ca-accent) 14%, white)', color: 'color-mix(in srgb, var(--ca-accent) 72%, var(--ca-ink))' }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ca-accent)' }} /> Connected
                  </span>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="mt-10 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>Explore All Features <ArrowRight size={16} /></Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (frosted tiles on sky→ink band) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-24" style={{ background: 'linear-gradient(140deg, var(--ca-primary) 0%, var(--ca-ink) 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(20,184,166,0.5), transparent)' }} />
        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Small stats, <span style={{ color: 'color-mix(in srgb, var(--ca-accent) 60%, white)' }}>big difference.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-xl text-base text-white/70">
              What actually changes for your front desk when your clinic goes live with Meeticulous.
            </Reveal>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {METRICS.map((m, i) => (
              <Reveal key={m.label} delay={i * 0.08}>
                <div className="flex h-full flex-col rounded-[18px] border border-white/15 p-7 backdrop-blur-sm" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full" style={{ background: 'color-mix(in srgb, var(--ca-accent) 30%, transparent)', color: 'color-mix(in srgb, var(--ca-accent) 55%, white)' }}><m.icon size={20} /></span>
                    <span aria-hidden className="h-1 w-10 rounded-full" style={{ background: 'var(--ca-accent)' }} />
                  </div>
                  <div className="mt-6 font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{m.value}</div>
                  <div className="mt-2 text-sm font-bold text-white">{m.label}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-white/65">{m.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.12} className="mt-10 text-center">
            <Link to={START} className="inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-12px_rgba(0,0,0,0.5)] hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              Get Started Now <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (scroll-snap review carousel) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Clinics that swapped the <span style={{ color: 'var(--ca-primary)' }}>phone for a link.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Illustrative examples from clinic staff about the admin side — not patient reviews.
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-12"><ReviewCarousel /></Reveal>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (aspect matrix) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The difference for <span style={{ color: 'var(--ca-primary)' }}>your front desk.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">The same clinic day, the manual way and with Meeticulous.</Reveal>
          </div>
          <Reveal delay={0.08} className="mt-12 overflow-hidden rounded-[20px] border border-black/[0.08] bg-white shadow-[0_24px_60px_-40px_rgba(12,34,49,0.4)]">
            {/* header row */}
            <div className="grid grid-cols-[1fr_1fr] sm:grid-cols-[0.9fr_1.1fr_1.1fr]">
              <div className="hidden items-center px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500 sm:flex">Task</div>
              <div className="flex items-center gap-2 border-l border-black/5 px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-400">The manual way</div>
              <div className="flex items-center gap-2 border-l border-black/5 px-5 py-4 text-xs font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-primary)' }}>With Meeticulous</div>
            </div>
            {COMPARE.map((row) => (
              <div key={row.aspect} className="grid grid-cols-[1fr_1fr] border-t border-black/5 sm:grid-cols-[0.9fr_1.1fr_1.1fr]">
                <div className="hidden items-center px-5 py-4 text-sm font-bold text-[color:var(--ca-ink)] sm:flex">{row.aspect}</div>
                <div className="flex items-start gap-2.5 border-l border-black/5 px-5 py-4 text-sm text-slate-500">
                  <X size={16} className="mt-0.5 flex-shrink-0 text-slate-300" />
                  <span className="line-through decoration-slate-300">{row.manual}</span>
                </div>
                <div className="flex items-start gap-2.5 border-l border-black/5 px-5 py-4 text-sm font-medium text-[color:var(--ca-ink)]" style={{ background: 'color-mix(in srgb, var(--ca-primary) 5%, transparent)' }}>
                  <span className="mt-0.5"><MintTick size={12} /></span>
                  <span>{row.bas}</span>
                </div>
              </div>
            ))}
          </Reveal>
          <Reveal delay={0.1} className="mt-10 text-center">
            <CtaButton to={START}>Claim Your Link <ArrowRight size={15} /></CtaButton>
          </Reveal>
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

      {/* ═══════════════ 10 · PRICING (two clean cards, sky header strip) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start small. <span style={{ color: 'var(--ca-primary)' }}>Grow as your clinic does.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">Choose a plan that fits your clinic today. Upgrade when you need more.</Reveal>
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
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {/* Free */}
            <Reveal>
              <div className="flex h-full flex-col overflow-hidden rounded-[20px] border border-black/[0.08] bg-white">
                <div className="border-b border-black/5 px-8 pt-8" style={{ background: 'var(--ca-grey)' }}>
                  <div className="font-heading text-lg font-bold">{FREE_PLAN.name}</div>
                  <p className="mt-1 text-sm text-slate-500">Everything you need to get booked.</p>
                  <div className="mt-5 flex items-end gap-1 pb-6">
                    <span className="pb-1 text-xl font-bold">₹</span>
                    <span className="font-heading text-4xl font-extrabold tracking-tight">0</span>
                    <span className="pb-1.5 text-sm text-slate-500">/mo · 5% per booking</span>
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-8">
                  <ul className="flex flex-col gap-2.5">
                    {FREE_PLAN.features.slice(0, 5).map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                        <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /> <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <CtaButton to={START} variant="ghost" className="mt-7 w-full">Start on the Free Plan</CtaButton>
                </div>
              </div>
            </Reveal>
            {/* Premium */}
            <Reveal delay={0.08}>
              <div className="flex h-full flex-col overflow-hidden rounded-[20px] border-2 bg-white shadow-[0_24px_60px_-34px_rgba(3,105,161,0.4)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <div className="border-b border-black/5 px-8 pt-8 text-white" style={{ background: 'var(--ca-primary)' }}>
                  <div className="flex items-center gap-2">
                    <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">Recommended</span>
                  </div>
                  <p className="mt-1 text-sm text-white/80">Keep every rupee. Automate the rest.</p>
                  <div className="mt-5 flex items-end gap-1 pb-6">
                    <span className="pb-1 text-xl font-bold">₹</span>
                    <span className="font-heading text-4xl font-extrabold tracking-tight">{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                    <span className="pb-1.5 text-sm text-white/80">/mo</span>
                    {yearly && <span className="pb-1.5 ml-1 text-sm text-white/60 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                  </div>
                </div>
                <div className="flex flex-1 flex-col p-8">
                  <p className="text-xs font-semibold text-slate-500">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST incl.` : 'Billed monthly · GST included'}</p>
                  <ul className="mt-5 flex flex-col gap-2.5">
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
          </div>
          <Reveal delay={0.12} className="mt-8 flex flex-col items-center gap-2 text-center">
            <span className="flex items-center gap-1.5 text-sm text-slate-500"><Lock size={14} style={{ color: 'var(--ca-primary)' }} /> Access to all features with no hidden fees</span>
            <Link to="/pricing" className="text-sm font-semibold text-slate-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · ABOUT (editorial + real photo gallery) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* real photo gallery: one main image + a two-up thumbnail rail */}
          <Reveal className="relative order-2 lg:order-1">
            <div aria-hidden className="pointer-events-none absolute -left-8 -top-8 h-56 w-56 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(20,184,166,0.2), transparent)' }} />
            <div className="relative overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_28px_60px_-36px_rgba(12,34,49,0.4)]">
              <img src="/for/dentists/about-dent.webp" alt="Meeticulous booking dashboard for a dental practice" loading="lazy" decoding="async" width="1100" height="825" className="h-auto w-full object-cover" />
            </div>
            <div className="relative mt-4 grid grid-cols-2 gap-4">
              <div className="overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_18px_40px_-30px_rgba(12,34,49,0.4)]">
                <img src="/for/dentists/choose-dent.webp" alt="A dentist choosing Meeticulous for clinic bookings" loading="lazy" decoding="async" width="1100" height="825" className="h-full w-full object-cover" />
              </div>
              <div className="overflow-hidden rounded-[16px] border border-black/[0.06] bg-white shadow-[0_18px_40px_-30px_rgba(12,34,49,0.4)]">
                <img src="/for/dentists/dental-cta.webp" alt="A calm dental clinic front desk running on Meeticulous" loading="lazy" decoding="async" width="1100" height="514" className="h-full w-full object-cover" />
              </div>
            </div>
          </Reveal>
          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal as="h2" delay={0.05} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">Small practices deserve better tools.</Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-slate-600">
              Meeticulous was built to make appointment-based practices easier to run. Instead of stitching together calendars, WhatsApp messages, a paper register and payment tools, your clinic manages patient appointments from one calm platform — a scheduling and payment tool, not a dental-records system.
            </Reveal>
            <Reveal delay={0.12} className="mt-7 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              {TRUST_STRIP.map((it) => (
                <span key={it.value} className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--ca-ink)]">
                  <it.icon size={15} style={{ color: 'var(--ca-primary)' }} /> {it.value}
                </span>
              ))}
            </Reveal>
            <Reveal delay={0.16} className="mt-8">
              <Link to="/about" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>Learn More About Us <ArrowRight size={16} /></Link>
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

      {/* ═══════════════ 13 · FINAL CTA (sky + mint mix-blend glow) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] px-6 py-16 text-center sm:px-12 sm:py-20" style={{ background: 'linear-gradient(150deg, var(--ca-primary) 0%, var(--ca-ink) 100%)' }}>
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(20,184,166,0.55), transparent)' }} />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(56,189,248,0.4), transparent)' }} />
          <div className="relative mx-auto max-w-2xl">
            <Reveal className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'rgba(255,255,255,0.16)' }}><Zap size={26} className="text-white" /></Reveal>
            <Reveal as="h2" delay={0.06} className="mt-6 font-heading text-[clamp(1.8rem,4.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Spend less time on the phone. Spend more time with patients.
            </Reveal>
            <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75">
              Set up your clinic&apos;s booking page today — free forever, ready to share in minutes.
            </Reveal>
            <Reveal delay={0.14} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
                Set Up My Clinic Page <ArrowRight size={16} />
              </Link>
              <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
                Book A Demo
              </Link>
            </Reveal>
            <Reveal delay={0.18} className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {['No credit card', 'Free forever', '0% on Pro'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Check size={14} style={{ color: 'color-mix(in srgb, var(--ca-accent) 55%, white)' }} /> {t}</span>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 14 · FOOTER (shared shell) ═══════════════ */}
      <footer className="border-t border-black/5 px-5 py-16 sm:px-8" style={{ background: '#ffffff' }}>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <div className="font-heading text-lg font-extrabold text-[color:var(--ca-ink)]">Meeticulous</div>
              <p className="mt-2 max-w-xs text-sm text-slate-500">The simpler way to run your dental clinic&apos;s bookings.</p>
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
            <p className="text-xs text-slate-500">Made for India&apos;s dental clinics</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
