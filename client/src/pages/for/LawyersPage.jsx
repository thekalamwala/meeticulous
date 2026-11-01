// /for/lawyers — bespoke, conversion-focused landing page for advocates &
// law firms in India. (Sept release rebuild to the design system.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Route/nav/prerender/sitemap are wired by
// the main thread — this file is the page component ONLY.
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in an
// AUTHORITATIVE, ESTABLISHED, EDITORIAL-LAW system — oxblood BURGUNDY + warm GOLD
// on warm paper. Distinct from every sibling: this page's mechanics are an
// editorial framed-portrait hero · a "practice areas" contents/ledger index ·
// a statute-style clause-numbered process (§01–§04, gold hairlines) · a schedule
// (table-of-cells) integrations panel · a burgundy case-file impact ledger · an
// interactive advocate-roster testimonial selector · a redlined "amended document"
// comparison · engagement-terms pricing · a framed editorial about. Only nav/hero
// chrome/footer (shared shell) may resemble sibling pages.
//
// IMAGES: real brand logos in the integrations schedule; hero + about use icon
// art (mascot illustrations removed). No empty placeholders.
//
// HONESTY — the BCI advertising constraint (this page's defining rule):
//   Advocates are bound by Bar Council of India Rules on advertising and
//   solicitation (Rule 36). Meeticulous is a SCHEDULING + PAYMENT tool, NOT a
//   legal-advice product and NOT an advertising channel. The page is positioned
//   strictly as PRACTICE SCHEDULING for clients an advocate already works with —
//   no acquisition/solicitation language — and one FAQ item states the BCI
//   position candidly and points advocates to their own Bar Council guidance.
//   Testimonials are labelled placeholder quotes from law-firm STAFF about ADMIN
//   relief (consult booking, no-shows, upfront fees) — never case outcomes.
//   Trust facts are verifiable product facts. JSON-LD has NO aggregateRating.
//
// The legacy --ca-* CSS var names are kept (shared classNames depend on them);
// only their VALUES change to the burgundy/gold palette.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// roster tablist / accordion / billing switch, AA-contrast palette, visible focus,
// NO hover uplift, Reveal guards its own motion.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Minus, Star,
  CalendarCheck, LayoutDashboard, Wallet, BellRing, Share2,
  Scale, FileText, Gavel, Landmark, ShieldCheck, Users, Briefcase, Building2,
  Lock, BadgePercent,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import { Scale as ScaleArt } from 'lucide-react';
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

const START = '/become-a-host';        // real host signup funnel
const LOGIN = '/login-as-vendor';   // host login (Google-only door)
const DEMO = '/contact';               // real demo page
const ART_ICON = ScaleArt; // stands in for the removed mascot art

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const NAV = [
  { label: 'Practice Areas', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian practices'];

// Practice-area contents index (verbatim labels + descriptions from the old page).
const USE_CASES = [
  { icon: Scale, label: 'Legal Consultation', desc: 'Advice on your matter.' },
  { icon: FileText, label: 'Document Review', desc: 'Contracts, deeds and drafting.' },
  { icon: Gavel, label: 'Litigation Strategy', desc: 'Case planning and hearings.' },
  { icon: Landmark, label: 'Corporate & Compliance', desc: 'Company law and filings.' },
  { icon: ShieldCheck, label: 'Property & Conveyancing', desc: 'Title, due diligence, registration.' },
  { icon: Users, label: 'Family & Matrimonial', desc: 'Sensitive matters, handled with care.' },
  { icon: Briefcase, label: 'Employment & Labour', desc: 'Advice for workplaces.' },
  { icon: Building2, label: 'Startup & Contracts', desc: 'Founders, agreements and terms.' },
];

// Statute-style process — 4 clauses (old copy, lightly split to §01–§04; meaning kept).
const STEPS = [
  { title: 'Set up your consultation types', icon: LayoutDashboard, desc: 'Add your services, fees and availability in minutes.' },
  { title: 'Share your private booking link', icon: Share2, desc: 'Send it to your clients over WhatsApp, email or your letterhead — one link handles requests.' },
  { title: 'Clients book & pay', icon: CalendarCheck, desc: 'A client picks a service and a time, and pays the fee upfront — no calls, no back-and-forth.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'You and your client get automatic confirmations and WhatsApp reminders before the consultation.' },
];

// Integration schedule — REAL BAS integrations only (from the old page).
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'WhatsApp Automation', logo: '/images/logos/whatsapp.svg', sub: 'Reminders and updates on autopilot' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Online payments, refunds and GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Accept instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Booking confirmation emails, automatic' },
  { name: 'Client Records', logo: '/favicon.svg', sub: 'Every client, note and history in one place' },
];

// Case-file impact ledger (figures + notes from the old page's stat rows).
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night', note: 'Your booking page never sleeps — clients reserve consultations any time.' },
  { v: '0%', l: 'Commission on Pro', note: 'Keep every rupee you earn — no per-booking cut.' },
  { v: '₹0', l: 'To get started', note: 'Free forever plan — no card, no lock-in.' },
  { v: 'GST', l: 'Invoices, automatic', note: 'A tax invoice generated for every paid booking.' },
];

// Placeholder testimonials — law-firm STAFF about ADMIN relief, never case outcomes.
const TESTIMONIALS = [
  { quote: 'My office used to spend the morning on the phone fixing consultation times. Clients now pick a slot on my booking link and it is confirmed — the admin just disappeared.', name: 'Adv. Rohan Malhotra', role: 'Advocate, Delhi' },
  { quote: 'Automatic WhatsApp reminders cut our no-shows sharply. Fewer wasted consultation hours across the chamber.', name: 'Adv. Meera Krishnan', role: 'Partner, Chennai' },
  { quote: 'Collecting the consultation fee upfront over UPI, with a GST invoice generated automatically, cleaned up our billing.', name: 'Adv. Sameer Joshi', role: 'Advocate, Mumbai' },
  { quote: 'Clients book their appointments without waiting for the office to call back. Setup took an evening.', name: 'Adv. Ananya Bose', role: 'Advocate, Kolkata' },
  { quote: 'One clear diary for the whole practice means no two clients penciled into the same hour.', name: 'Adv. Vikram Rao', role: 'Managing Partner, Hyderabad' },
  { quote: 'A calm, professional booking page for consultations, 0% commission on Pro, and payments straight to the practice account.', name: 'Adv. Neha Gupta', role: 'Advocate, Chandigarh' },
];

// Redlined comparison — the practice's day marked-up (old) vs the clean copy (new).
const OLD_WAY = [
  'Phone tag to fix every appointment',
  'No-shows waste billable hours',
  'Consultation fees chased after the advice',
  'Client details scattered across files',
  'Two clients penciled into one slot',
];
const NEW_WAY = [
  'One private booking link — clients self-serve 24/7',
  'Automatic WhatsApp reminders cut no-shows',
  'Fees collected upfront over UPI or card',
  'Every client, note and history in one diary',
  'A conflict-free diary — no double bookings',
];

// Honest trust strip — verifiable product facts only.
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your practice data runs on servers in Mumbai' },
  { icon: FileText, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for advocates and law firms?', a: 'Yes — for managing consultations with the clients you already work with: an online booking page, upfront fees, automatic reminders and one clear diary. It is a practice-scheduling and payment tool, not an advertising or client-acquisition channel.' },
  { q: 'Does using Meeticulous comply with Bar Council of India rules?', a: 'Advocates are bound by the Bar Council of India’s rules on advertising and solicitation (Rule 36). Meeticulous is a scheduling and payment tool — how you use it is your responsibility. We suggest sharing your booking link privately with clients you already represent or who approach you, rather than as public advertising, and following your Bar Council’s guidance. We do not advertise your services on your behalf.' },
  { q: 'Can clients book consultations online?', a: 'Yes. A client opens your booking link, chooses a consultation type, picks a convenient time and confirms — no calls or waiting for the office to reply.' },
  { q: 'Can I share my booking link on WhatsApp?', a: 'Yes. Your link works anywhere you choose to send it — share it privately with your clients over WhatsApp, email or your letterhead. One link handles your appointment requests.' },
  { q: 'Can I collect consultation fees online?', a: 'Yes. Collect the fee upfront through Razorpay — UPI, cards or netbanking — before the consultation. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I offer virtual consultations?', a: 'Yes. Offer online consultations or mark a service as in-chambers — or both. The client picks the mode that suits the matter.' },
  { q: 'Is my client information kept private?', a: 'Your production data is hosted in India (Mumbai) and the platform operates under India’s DPDP Act 2023. You control what appears on your booking page and what details a client provides when booking.' },
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
    { label: 'Advocates & Law Firms', to: '/for/lawyers' },
    { label: 'Chartered Accountants', to: '/for/chartered-accountants' },
    { label: 'Consultants', to: '/for/business-consultant' },
    { label: 'Doctors', to: '/for/doctors' },
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
  const base = 'inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3.5 text-sm font-semibold transition-all hover:no-underline';
  const styles = {
    solid: 'text-white shadow-[0_4px_14px_rgba(127,29,29,0.24)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/15 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-primary)]/50',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

/* Interactive advocate-roster testimonial selector — a "docket" list on the left
   picks the endorsement shown on the right. (Distinct from cards/marquee/slider.) */
function TestimonialRoster() {
  const [active, setActive] = useState(0);
  const t = TESTIMONIALS[active];
  return (
    <div className="mt-12 grid items-stretch gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      {/* Roster */}
      <div className="rounded-[14px] border border-black/[0.08] bg-white p-2" role="tablist" aria-label="Choose an advocate to read their words">
        {TESTIMONIALS.map((it, i) => {
          const on = i === active;
          return (
            <button
              key={it.name}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(i)}
              className="flex w-full items-center gap-3 rounded-[10px] px-3.5 py-3 text-left transition-colors"
              style={on ? { background: 'var(--ca-primary)' } : undefined}
            >
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                style={on ? { background: 'rgba(255,255,255,0.18)', color: '#fff' } : { background: 'var(--ca-grey)', color: 'var(--ca-primary)' }}
              >
                {it.name.replace('Adv. ', '').charAt(0)}
              </span>
              <span className="min-w-0">
                <span className={`block truncate text-[13px] font-bold ${on ? 'text-white' : 'text-[color:var(--ca-ink)]'}`}>{it.name}</span>
                <span className={`block truncate text-[11px] ${on ? 'text-white/70' : 'text-neutral-500'}`}>{it.role}</span>
              </span>
            </button>
          );
        })}
      </div>
      {/* Endorsement panel */}
      <div role="tabpanel" className="relative flex flex-col justify-center overflow-hidden rounded-[16px] border border-black/[0.08] p-8 sm:p-10" style={{ background: 'var(--ca-cream)' }}>
        <span aria-hidden className="absolute right-7 top-3 font-heading text-[7rem] leading-none" style={{ color: 'rgba(194,137,26,0.18)' }}>&rdquo;</span>
        <AnimatePresence mode="wait">
          <motion.div key={active} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.26 }}>
            <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={15} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}</div>
            <blockquote className="relative mt-4 text-lg font-medium leading-relaxed text-[color:var(--ca-ink)] sm:text-xl">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 border-t border-black/10 pt-4">
              <span className="block text-sm font-bold text-[color:var(--ca-ink)]">{t.name}</span>
              <span className="block text-xs text-neutral-500">{t.role}</span>
            </figcaption>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* Smoothly-animated single-open FAQ accordion, two columns. */
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

export default function LawyersPage() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/lawyers`;
  const seo = {
    title: 'Appointment Booking Software for Advocates & Law Firms | Meeticulous',
    description: 'Meeticulous is appointment booking software for lawyers, advocates and law firms in India. Let the clients you work with book consultations online — fees collected upfront, WhatsApp reminders, GST invoices, 0% commission. A practice-scheduling tool, not an advertising channel. Start free.',
    keywords: 'appointment booking software for advocates, law firm scheduling software india, book legal consultation online, lawyer appointment scheduling, advocate practice management, consultation booking for law firms',
    ogTitle: 'Your practice runs on consultations. Let Meeticulous schedule them.',
    ogDescription: 'Clients book consultations, pay upfront and get WhatsApp reminders — automatically. A calm scheduling page for advocates and law firms in India.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Lawyers & Legal Advisors',
    serviceType: 'Appointment booking software for advocates and law firms',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Authoritative editorial-law palette. Legacy --ca-* var names kept so shared
  // classNames stay valid; only the values change.
  const styleVars = {
    '--ca-primary': '#7F1D1D', // oxblood burgundy — text/links/fills, AA on white (~9:1)
    '--ca-accent': '#C2891A',  // warm gold — decorative rules/numerals/accents only
    '--ca-ink': '#1F1315',     // near-black warm ink text
    '--ca-cream': '#FBF7F4',   // warm paper section bg
    '--ca-grey': '#F4F1EE',    // light warm-grey section bg
  };

  return (
    <main className="overflow-x-clip bg-white text-[color:var(--ca-ink)]" style={styleVars} id="top">
      <Seo
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor="#7F1D1D"
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
                  <Link to={LOGIN} className="flex-1 rounded-[6px] border-2 border-black/10 py-2.5 text-center text-sm font-semibold text-[color:var(--ca-ink)] hover:no-underline">Login</Link>
                  <CtaButton to={START} className="flex-1">Start Free <ArrowRight size={15} /></CtaButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══════════════ 2 · HERO (framed editorial portrait) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        {/* burgundy blob — sits INTO the warm paper via multiply */}
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-20 h-96 w-96 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(127,29,29,0.16), transparent)' }} />
        {/* faint editorial column rules */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(31,19,21,0.03) 0 1px, transparent 1px 104px)', maskImage: 'linear-gradient(180deg, #000, transparent 78%)', WebkitMaskImage: 'linear-gradient(180deg, #000, transparent 78%)' }} />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          {/* LEFT — the editorial statement */}
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3.1rem)] font-extrabold leading-[1.06] tracking-[-0.025em] text-[color:var(--ca-ink)]">
              Streamlined appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>lawyers and law firms</span> managing client consultations.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-neutral-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for lawyers — the clients you work with book consultations online with confirmed slots, upfront fees and reminders, so no case starts with phone tag.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Create Your Booking Page <ArrowRight size={16} /></CtaButton>
              <Link to={DEMO} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
                Book A Demo <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
                  <Check size={14} style={{ color: 'var(--ca-primary)' }} /> {t}
                </span>
              ))}
            </Reveal>
          </div>

          {/* RIGHT — framed portrait (burgundy frame + gold inner rule) + floating card */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <div aria-hidden className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(194,137,26,0.22), transparent)' }} />
            <div className="relative rounded-[20px] border-[3px] p-2.5 shadow-[0_30px_60px_-34px_rgba(31,19,21,0.55)]" style={{ borderColor: 'var(--ca-primary)', background: '#fff' }}>
              <div className="relative overflow-hidden rounded-[13px] border" style={{ borderColor: 'rgba(194,137,26,0.5)', background: 'var(--ca-cream)' }}>
                <div role="img" aria-label="Meeticulous — appointment booking for advocates and law firms" className="mx-auto grid aspect-square w-full max-w-[24rem] place-items-center p-6"><ART_ICON className="h-24 w-24" style={{ color: 'var(--ca-primary)' }} strokeWidth={1.25} aria-hidden="true" /></div>
              </div>
            </div>
            {/* floating "Consultation booked" card */}
            <div className="absolute -bottom-5 left-2 z-20 flex items-center gap-3 rounded-2xl border border-black/[0.05] bg-white px-4 py-3 shadow-[0_18px_38px_-18px_rgba(31,19,21,0.5)] sm:left-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={18} /></span>
              <div>
                <div className="text-[11px] font-medium text-neutral-500">Consultation booked</div>
                <div className="text-sm font-bold text-[color:var(--ca-ink)]">Property matter · 4:30 PM</div>
              </div>
            </div>
            {/* floating fee chip */}
            <div className="absolute -right-2 top-6 z-20 flex items-center gap-2.5 rounded-2xl border border-black/[0.05] bg-white px-3.5 py-2.5 shadow-[0_16px_34px_-18px_rgba(31,19,21,0.45)]">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--ca-accent) 18%, transparent)', color: 'var(--ca-accent)' }}><Wallet size={16} /></span>
              <div>
                <div className="text-[10px] font-medium text-neutral-500">Fee received</div>
                <div className="text-[13px] font-bold text-[color:var(--ca-ink)]">₹3,000</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · PRACTICE AREAS (contents/ledger index) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for lawyers, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-neutral-500">
              From consultations to document review and litigation strategy — every appointment type, in one place.
            </Reveal>
          </div>

          {/* ledger index — full-width rows with a gold numeral + burgundy rule */}
          <div className="mx-auto mt-12 max-w-5xl border-t-2" style={{ borderColor: 'var(--ca-primary)' }}>
            <div className="grid sm:grid-cols-2 sm:gap-x-14">
              {USE_CASES.map((u, i) => (
                <Reveal key={u.label} delay={(i % 2) * 0.05}>
                  <Link to={START} className="group flex items-center gap-5 border-b py-5 hover:no-underline" style={{ borderColor: 'rgba(127,29,29,0.16)' }}>
                    <span aria-hidden className="font-heading text-3xl font-extrabold leading-none tabular-nums" style={{ color: 'rgba(194,137,26,0.55)' }}>{String(i + 1).padStart(2, '0')}</span>
                    <span className="flex-1">
                      <span className="flex items-center gap-2.5">
                        <u.icon size={17} style={{ color: 'var(--ca-primary)' }} />
                        <h3 className="font-heading text-[16px] font-bold text-[color:var(--ca-ink)] transition-colors group-hover:text-[color:var(--ca-primary)]">{u.label}</h3>
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-neutral-500">{u.desc}</span>
                    </span>
                    <ArrowRight size={16} className="shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-[color:var(--ca-primary)]" />
                  </Link>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (statute-style clauses) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From &ldquo;when are you free?&rdquo; to a <span style={{ color: 'var(--ca-primary)' }}>confirmed consultation.</span>
            </Reveal>
          </div>

          {/* clauses — §01–§04, separated by gold hairlines */}
          <div className="mt-12">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.07}>
                <div className="grid grid-cols-[auto_1fr] gap-5 py-7 sm:gap-8" style={i > 0 ? { borderTop: '1px solid rgba(194,137,26,0.45)' } : undefined}>
                  <div className="flex flex-col items-center pt-1">
                    <span aria-hidden className="text-[11px] font-bold tracking-widest" style={{ color: 'var(--ca-accent)' }}>§</span>
                    <span aria-hidden className="font-heading text-4xl font-extrabold leading-none tabular-nums sm:text-5xl" style={{ color: 'var(--ca-primary)' }}>{String(i + 1).padStart(2, '0')}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <s.icon size={18} style={{ color: 'var(--ca-accent)' }} />
                      <h3 className="font-heading text-lg font-bold text-[color:var(--ca-ink)] sm:text-xl">{s.title}</h3>
                    </div>
                    <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-neutral-500">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal delay={0.1} className="mt-8 text-center">
            <CtaButton to={START}>Set Up My Practice Page <ArrowRight size={16} /></CtaButton>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (schedule / table-of-cells) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-neutral-500">
              Connect your calendar, payments and WhatsApp — Meeticulous fits your practice, no rewiring.
            </Reveal>
          </div>

          {/* the schedule — a bordered document panel; gap-px draws clean hairline cells */}
          <Reveal delay={0.08} className="mt-12 overflow-hidden rounded-[16px] border bg-white shadow-[0_20px_50px_-34px_rgba(31,19,21,0.4)]" style={{ borderColor: 'rgba(127,29,29,0.18)' }}>
            <div className="flex items-center justify-between px-6 py-4 text-white" style={{ background: 'var(--ca-primary)' }}>
              <span className="font-heading text-sm font-bold tracking-wide">The Schedule — Connected Tools</span>
              <span className="hidden text-xs text-white/70 sm:inline">Six integrations, no setup fee</span>
            </div>
            <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-3" style={{ background: 'rgba(127,29,29,0.12)' }}>
              {TOOLS.map((t) => (
                <div key={t.name} className="flex items-start gap-3.5 bg-white p-5">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'var(--ca-grey)' }}>
                    {t.logo
                      ? <img src={t.logo} alt={t.name} loading="lazy" className="h-6 w-6 object-contain" />
                      : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</span>
                    <span className="mt-1 block text-xs leading-snug text-neutral-500">{t.sub}</span>
                  </span>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={0.1} className="mt-10 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              Explore All Features <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (burgundy case-file ledger) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="relative overflow-hidden rounded-[24px] p-8 text-white sm:p-12 lg:p-14" style={{ background: 'radial-gradient(120% 120% at 100% 0%, #9B2A2A 0%, #7F1D1D 45%, #5F1414 100%)' }}>
            <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(194,137,26,0.4), transparent)' }} />
            <div className="relative grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
              {/* left — the statement */}
              <div>
                <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                  Real impact for a modern law practice.
                </h2>
                <p className="mt-4 max-w-sm text-base leading-relaxed text-white/70">
                  Less time on admin, more time on your matters — and every rupee you earn stays yours.
                </p>
              </div>
              {/* right — the ledger */}
              <div>
                {METRICS.map((m, i) => (
                  <div key={m.l} className="flex items-baseline gap-5 py-4" style={i > 0 ? { borderTop: '1px solid rgba(194,137,26,0.35)' } : undefined}>
                    <span className="w-24 flex-shrink-0 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: 'var(--ca-accent)' }}>{m.v}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-white">{m.l}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-white/60">{m.note}</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (advocate-roster selector) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Practices that swapped the <span style={{ color: 'var(--ca-primary)' }}>phone for a link.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-neutral-500">
              Select an advocate to read how Meeticulous cut their admin. (Illustrative quotes.)
            </Reveal>
          </div>
          <Reveal delay={0.08}><TestimonialRoster /></Reveal>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (redlined amended document) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The old way, <span style={{ color: 'var(--ca-primary)' }}>redlined.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-neutral-500">
              Strike the manual clauses. Keep the clean copy.
            </Reveal>
          </div>

          <Reveal delay={0.08} className="mt-12 overflow-hidden rounded-[16px] border bg-white shadow-[0_20px_50px_-34px_rgba(31,19,21,0.4)]" style={{ borderColor: 'rgba(127,29,29,0.18)' }}>
            {/* letterhead */}
            <div className="flex items-center justify-between border-b px-6 py-4" style={{ borderColor: 'rgba(31,19,21,0.08)' }}>
              <span className="font-heading text-sm font-bold text-[color:var(--ca-ink)]">Practice Operations — Amended</span>
              <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-primary)' }}>Tracked changes</span>
            </div>
            {/* two internal columns split by a gold rule */}
            <div className="grid sm:grid-cols-2">
              {/* deletions */}
              <div className="p-6 sm:border-r" style={{ borderColor: 'rgba(194,137,26,0.4)' }}>
                <div className="mb-4 flex items-center gap-2">
                  <Minus size={15} className="text-[#B45454]" />
                  <span className="font-heading text-sm font-bold text-neutral-500">Struck — the old way</span>
                </div>
                <ul className="space-y-3">
                  {OLD_WAY.map((o) => (
                    <li key={o} className="flex items-start gap-2.5 text-sm">
                      <span aria-hidden className="mt-0.5 font-bold text-[#B45454]">−</span>
                      <span className="text-neutral-400 line-through decoration-[#B45454]/60">{o}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {/* insertions */}
              <div className="p-6" style={{ background: 'color-mix(in srgb, var(--ca-primary) 4%, transparent)' }}>
                <div className="mb-4 flex items-center gap-2">
                  <Plus size={15} style={{ color: 'var(--ca-primary)' }} />
                  <span className="font-heading text-sm font-bold text-[color:var(--ca-ink)]">Clean copy — with Meeticulous</span>
                </div>
                <ul className="space-y-3">
                  {NEW_WAY.map((n) => (
                    <li key={n} className="flex items-start gap-2.5 text-sm">
                      <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ca-primary)' }} />
                      <span className="font-medium text-[color:var(--ca-ink)]">{n}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 9 · PRICING (engagement terms) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start small. <span style={{ color: 'var(--ca-primary)' }}>Grow as your practice does.</span>
            </Reveal>
          </div>

          {/* billing toggle */}
          <Reveal delay={0.08} className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>Monthly</button>
            <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: yearly ? 'var(--ca-primary)' : '#cbbfb8', minHeight: 0 }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: yearly ? '22px' : '2px' }} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>
              Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--ca-primary) 12%, transparent)', color: 'var(--ca-primary)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
            </span>
          </Reveal>

          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Starter (free) */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[16px] border border-black/[0.08] bg-white p-7">
                <div className="font-heading text-lg font-bold">{FREE_PLAN.name}</div>
                <p className="mt-1 text-sm text-neutral-500">Everything you need to get booked.</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold">₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight">0</span>
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
                <CtaButton to={START} variant="ghost" className="mt-7 w-full">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>

            {/* Pro (premium) — recommended */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[16px] border-2 bg-white p-7 shadow-[0_24px_60px_-30px_rgba(127,29,29,0.28)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
                <div className="flex items-center gap-2">
                  <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-primary)' }}>Recommended</span>
                </div>
                <p className="mt-1 text-sm text-neutral-500">Keep every rupee. Automate the rest.</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold" style={{ color: 'var(--ca-primary)' }}>₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight" style={{ color: 'var(--ca-primary)' }}>{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                  <span className="pb-2 text-sm text-neutral-500">/month</span>
                  {yearly && <span className="pb-2 ml-1 text-sm text-neutral-400 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                </div>
                <p className="mt-1.5 text-xs font-semibold text-neutral-500">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST included` : 'Billed monthly · GST included'}</p>
                <ul className="mt-6 flex flex-col gap-3">
                  <li className="flex items-start gap-2.5 text-sm font-semibold text-[color:var(--ca-ink)]">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} />
                    <span>Everything in Free</span>
                  </li>
                  {PREMIUM_PLAN.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-neutral-600">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} className="mt-7 w-full">Go Pro</CtaButton>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.12} className="mt-8 flex flex-col items-center gap-2 text-center">
            <span className="flex items-center gap-1.5 text-sm text-neutral-500"><Lock size={14} style={{ color: 'var(--ca-primary)' }} /> Access to all features with no hidden fees</span>
            <Link to="/pricing" className="text-sm font-semibold text-neutral-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 10 · ABOUT (framed editorial + trust facts) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LEFT — framed icon art */}
          <Reveal className="relative order-2 mx-auto w-full max-w-sm lg:order-1 lg:mx-0">
            <div aria-hidden className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(127,29,29,0.14), transparent)' }} />
            <div className="relative rounded-[18px] border-2 p-2 shadow-[0_24px_50px_-32px_rgba(31,19,21,0.5)]" style={{ borderColor: 'var(--ca-primary)', background: '#fff' }}>
              <div className="overflow-hidden rounded-[12px] border" style={{ borderColor: 'rgba(194,137,26,0.5)', background: 'var(--ca-cream)' }}>
                <div aria-hidden="true" className="mx-auto grid aspect-square w-full max-w-[20rem] place-items-center p-5"><ART_ICON className="h-20 w-20" style={{ color: 'var(--ca-primary)' }} strokeWidth={1.25} /></div>
              </div>
            </div>
          </Reveal>

          {/* RIGHT — statement + trust facts */}
          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Small practices deserve better tools.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-neutral-600">
              Meeticulous was built to make appointment-based practices easier to run. Instead of stitching together calendars, WhatsApp messages, paper diaries and payment tools, professionals manage their client consultations from one calm platform — built for the way Indian practices actually work.
            </Reveal>
            <Reveal delay={0.12} className="mt-7 flex flex-wrap justify-center gap-2.5 lg:justify-start">
              {TRUST_STRIP.map((it) => (
                <span key={it.value} className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-4 py-2 text-sm font-semibold text-[color:var(--ca-ink)]" title={it.label}>
                  <it.icon size={15} style={{ color: 'var(--ca-primary)' }} /> {it.value}
                </span>
              ))}
            </Reveal>
            <Reveal delay={0.16} className="mt-8">
              <Link to="/about" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
                Learn More About Us <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
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

      {/* ═══════════════ 12 · FINAL CTA (burgundy + gold mix-blend glow) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8" style={{ background: 'radial-gradient(120% 120% at 50% 0%, #9B2A2A 0%, #7F1D1D 45%, #5F1414 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-64 w-[44rem] -translate-x-1/2 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(194,137,26,0.5), transparent)' }} />
        <div className="relative mx-auto max-w-2xl">
          <Reveal className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(194,137,26,0.18)' }}>
            <Gavel size={26} style={{ color: 'var(--ca-accent)' }} />
          </Reveal>
          <Reveal as="h2" delay={0.06} className="mt-6 font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            Spend less time scheduling. <span style={{ color: 'var(--ca-accent)' }}>Spend more time on your matters.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base text-white/70">
            Set up your booking page today and give your clients a simpler way to meet with you.
          </Reveal>
          <Reveal delay={0.14} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link to={START} className="inline-flex items-center justify-center gap-2 rounded-[6px] px-8 py-4 text-sm font-bold transition-all hover:brightness-105 hover:no-underline" style={{ background: 'var(--ca-accent)', color: 'var(--ca-ink)' }}>
              Claim Your Booking Link <ArrowRight size={16} />
            </Link>
            <Link to={DEMO} className="inline-flex items-center justify-center gap-2 rounded-[6px] border-2 border-white/30 px-6 py-4 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline">
              Book A Demo
            </Link>
          </Reveal>
          <Reveal as="p" delay={0.18} className="mt-5 text-xs text-white/60">No credit card required · Free forever · 0% commission on Pro</Reveal>
        </div>
      </section>

      {/* ═══════════════ 13 · FOOTER (shared shell) ═══════════════ */}
      <footer className="border-t border-black/5 px-5 py-16 sm:px-8" style={{ background: '#ffffff' }}>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <div className="font-heading text-lg font-extrabold text-[color:var(--ca-ink)]">Meeticulous</div>
              <p className="mt-2 max-w-xs text-sm text-neutral-500">The simpler way to manage your practice&apos;s consultations.</p>
              <CtaButton to={START} className="mt-5">Create Your Page — Free <ArrowRight size={15} /></CtaButton>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <div className="text-xs font-bold uppercase tracking-wide text-neutral-600">{col.title}</div>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <NavLink item={l} className="text-sm text-neutral-600 transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-black/5 pt-6 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-neutral-500">© 2026 Meeticulous. <OperatorCredit /></p>
            <p className="text-xs text-neutral-500">Made for India&apos;s advocates &amp; law firms</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
