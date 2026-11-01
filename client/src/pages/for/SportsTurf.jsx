// /for/sports-turf — bespoke, conversion-focused landing page for turf &
// sports-arena owners in India (box cricket, football turf, badminton /
// pickleball courts, coaching grounds).
//
// STANDALONE page (not the data-driven ProfessionLanding template) — same
// 14-section structure as its sibling /for/chartered-accountants, re-skinned to a
// "floodlit night" sporty look (dark stadium hero, turf-green + electric-lime
// accents, pitch-line textures). Reuses shared infra: Seo, Reveal, useLenis, real
// plan data, /become-a-host funnel, prerender + Solutions hub.
//
// HONESTY (verified against product code — see agent audit):
//   - Positioned for a SINGLE bookable ground/court per account. The double-book
//     guard is keyed on host_id, so parallel multi-court is NOT supported — the
//     page never claims it; two FAQ items state the multi-court + peak-pricing
//     limits plainly. Deposits/partial advance are NOT built → we say "full fee
//     upfront", never "pay X% to hold".
//   - Hourly slot booking, flat per-service price, full online payment, WhatsApp
//     reminders and 0% on Pro are all real.
//   - Trust strip maps to real behaviour (Razorpay signature verify, Mumbai prod
//     DB, DPDP Privacy policy, 0% on Pro). Testimonials are labelled placeholders.
//
// The legacy --ca-* CSS var names are kept (cosmetic) so shared classNames stay
// valid; only their values are retuned to the floodlit palette.
//
// New URL — keep in sync: App.jsx route (before /for/:profession), prerender.mjs
// list, and Solutions.jsx CATEGORIES.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star,
  CalendarCheck, LayoutDashboard, MessageCircle,
  Wallet, BellRing,
  Users, Clock3, Landmark,
  FileText, Target, Flag, Trophy, Dumbbell, GraduationCap,
  BadgePercent, Lock, Zap, Share2, IndianRupee,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import { Trophy as TrophyArt } from 'lucide-react';
import IconArt from '../../components/common/IconArt';
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
  { label: 'Features', href: '#features' },
  { label: 'For Turf Owners', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Resources', to: '/blog' },
];

const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian venues'];

const BENEFITS = [
  { icon: CalendarCheck, title: 'Fill Your Slots', desc: 'Players book open slots online — no calls, no chasing.' },
  { icon: Wallet, title: 'Paid Upfront', desc: 'Collect the full slot fee online before they arrive.' },
  { icon: BellRing, title: 'Fewer No-Shows', desc: 'Automatic WhatsApp reminders before every slot.' },
  { icon: LayoutDashboard, title: 'One Clear Calendar', desc: 'Every booking for your ground in a single view.' },
];

const USE_CASES = [
  { icon: Target, label: 'Box Cricket', desc: 'Hourly box-cricket and nets slots.' },
  { icon: Flag, label: 'Football Turf', desc: '5-a-side and 7-a-side ground.' },
  { icon: Zap, label: 'Badminton Court', desc: 'Peak-evening court bookings.' },
  { icon: Star, label: 'Pickleball Court', desc: 'The fastest-growing court sport.' },
  { icon: Dumbbell, label: 'Coaching Sessions', desc: 'One-on-one or squad coaching.' },
  { icon: Users, label: 'Group & Corporate', desc: 'Team outings and office events.' },
  { icon: Trophy, label: 'Tournaments', desc: 'Match-day slot bookings.' },
  { icon: GraduationCap, label: 'Skills Clinics', desc: 'Camps and skill sessions.' },
];

const STEPS = [
  { title: 'List your ground & slots', icon: LayoutDashboard, desc: 'Set your operating hours and slot length, then share your booking link anywhere.' },
  { title: 'Players book & pay', icon: CalendarCheck, desc: 'Players pick an open slot and pay the full fee online — no calls, no back-and-forth.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'You and the player get automatic confirmations and WhatsApp reminders before the slot.' },
];

// Integration hub — REAL BAS integrations only. Turf is in-person, so no
// Meet/Zoom video tools (dropped vs the CA page).
const TOOLS_LEFT = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'WhatsApp Automation', logo: '/images/logos/whatsapp.svg', sub: 'Reminders and updates on autopilot' },
  { name: 'Player Records', logo: '/favicon.svg', sub: 'Every regular, note and history in one place' },
];
const TOOLS_RIGHT = [
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Online payments, refunds and GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Accept instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Booking confirmation emails, automatic' },
];
const TOOLS_ALL = [...TOOLS_LEFT, ...TOOLS_RIGHT];

// Placeholder testimonials — swap for real owner quotes/photos when available.
// SEO-friendly copy (turf booking, slots, WhatsApp reminders, no-shows, UPI).
const CA_TESTIMONIALS = [
  { tone: 'white', quote: 'Players used to call all evening asking which slots were free. Now they see live openings and book my box-cricket ground themselves — the phone finally stopped ringing.', name: 'Rohan Patil', role: 'Box Cricket Arena, Pune' },
  { tone: 'ink', quote: 'Automatic WhatsApp reminders cut our no-shows on prime 8 PM slots. Fewer empty grounds, more revenue.', name: 'Imran Shaikh', role: 'Football Turf Owner, Hyderabad' },
  { tone: 'blue', quote: 'Collecting the full slot fee online through UPI before they turn up ended the cash-chasing completely.', name: 'Karthik Reddy', role: 'Sports Arena, Bengaluru' },
  { tone: 'blue', quote: 'Players book badminton courts without waiting for a reply. Setup took an evening, not a week.', name: 'Ananya Rao', role: 'Badminton Court, Chennai' },
  { tone: 'ink', quote: 'One clear calendar for my ground means no more two teams turning up for the same slot.', name: 'Harpreet Singh', role: 'Turf Ground, Ludhiana' },
  { tone: 'white', quote: 'A proper booking page for my turf, 0% commission on Pro, and payments straight to my account — exactly what a small arena needs.', name: 'Vishal Nair', role: 'Multi-Sport Turf, Kochi' },
];

// Before / after — the turf owner's day without vs with Meeticulous.
const OLD_WAY = [
  { icon: MessageCircle, title: 'Slot requests over phone & WhatsApp', desc: 'Players call to ask what is free; you reply mid-game.' },
  { icon: Clock3, title: 'No-shows waste prime slots', desc: 'A missed 8 PM slot is revenue you cannot get back.' },
  { icon: Wallet, title: 'Chasing payment after they play', desc: 'Cash collected late, or sometimes not at all.' },
  { icon: IndianRupee, title: 'Cash-only, no record', desc: 'Hard to track who paid for which slot.' },
  { icon: X, title: 'Double-booked peak hours', desc: 'Two teams turn up for the same 7 PM slot.' },
];

const NEW_WAY = [
  { icon: Share2, title: 'One shareable slot link', desc: 'Players see live openings and book themselves, 24/7.' },
  { icon: BellRing, title: 'Automatic WhatsApp reminders', desc: 'Reminders cut no-shows on your prime slots.' },
  { icon: IndianRupee, title: 'Paid online, upfront', desc: 'Full slot fee collected at booking, over UPI or card.' },
  { icon: CalendarCheck, title: 'One clear calendar', desc: 'Every booked slot in one view — no clashes on your ground.' },
  { icon: LayoutDashboard, title: 'Every booking on record', desc: 'Who booked, when, and whether they paid — all logged.' },
];

// Honest trust strip — verifiable facts only. Every claim maps to real product
// behaviour: Razorpay signature-verified payments (razorpaySignature.js), prod DB
// in Mumbai (CLAUDE.md), DPDP-based Privacy policy (Privacy.jsx), 0% on Pro (plans.js).
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your venue data runs on servers in Mumbai' },
  { icon: FileText, value: 'DPDP 2023', label: 'Operated under India’s data protection law' },
  { icon: BadgePercent, value: '0%', label: 'Commission on Pro — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous good for a turf or sports arena?', a: 'Yes. If you run a bookable ground or court — box cricket, football turf, a badminton or pickleball court — you get an online booking page where players pick an open slot and pay upfront, with automatic WhatsApp reminders. It works best for a single bookable facility per account (see the multi-court question below).' },
  { q: 'Can players book my ground by the hour?', a: 'Yes. Set your operating hours (say 6 AM to 11 PM) and a slot length such as 60 minutes, and players can book back-to-back hourly slots like 7–8 PM or 8–9 PM themselves — no calls or waiting for a reply.' },
  { q: 'Can I take payment online before they play?', a: 'Yes. Collect the full slot fee upfront through Razorpay — UPI, cards or netbanking — at the time of booking. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I send WhatsApp reminders?', a: 'Yes. Meeticulous sends automatic booking confirmations and reminders over WhatsApp and email before each slot, which cuts no-shows. WhatsApp reminders are included on the Pro plan (and free for your first two months on the Starter plan).' },
  { q: 'What if I run more than one turf or court?', a: 'Right now Meeticulous is built for a single bookable ground or court per account — two facilities on one account share the same calendar, so they cannot be booked in parallel. If you run a multi-court arena, true parallel-court booking is on our roadmap; in the meantime a separate account per court is the workaround. We would rather tell you this upfront than have it surprise you after setup.' },
  { q: 'Can I set different prices for peak and off-peak hours?', a: 'Each service has its own fixed price, so automatic time-based (peak vs off-peak) pricing is not built yet. You can create separate listings — for example an off-peak morning slot and an evening slot at different prices — as a manual workaround.' },
  { q: 'Do I need any technical knowledge?', a: 'No. Setup takes minutes and needs no technical skills. You add your ground, slots and availability, and your booking page is ready to share — players need nothing more than the link.' },
  { q: 'Is there a free plan?', a: 'Yes. The Starter plan is free forever — an online booking page, unlimited slots and bookings, UPI payments, 24-hour reminders and GST invoices — with a small 5% per-booking fee. Pro removes that commission entirely and adds WhatsApp automation and growth tools.' },
];

const FOOTER_COLS = [
  { title: 'Product', links: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Integrations', href: '#features' },
    { label: "What's New", to: '/changelog' },
  ] },
  { title: 'For Businesses', links: [
    { label: 'Sports & Turf', to: '/for/sports-turf' },
    { label: 'Chartered Accountants', to: '/for/chartered-accountants' },
    { label: 'Consultants', to: '/for/business-consultant' },
    { label: 'Salons', to: '/for/salon' },
    { label: 'Fitness', to: '/for/fitness' },
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

// Anchor that respects on-page (#) vs route links.
function NavLink({ item, className, onClick }) {
  if (item.to) return <Link to={item.to} className={className} onClick={onClick}>{item.label}</Link>;
  return <a href={item.href} className={className} onClick={onClick}>{item.label}</a>;
}

function CtaButton({ to, children, variant = 'solid', className = '' }) {
  const base = 'inline-flex items-center justify-center gap-2 rounded-[5px] px-6 py-3.5 text-sm font-semibold transition-all hover:no-underline';
  const styles = {
    solid: 'text-white shadow-[0_4px_14px_rgba(16,24,40,0.16)] hover:brightness-105',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/25',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

/* Floating glass card over the hero — mirrors the homepage hero. */
function GlassCard({ icon: Icon, label, value, accent, className = '', float = '' }) {
  return (
    <div className={`brand-glass ${float} absolute flex items-center gap-3 rounded-2xl px-4 py-3 ${className}`}>
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl"
        style={accent
          ? { backgroundColor: 'color-mix(in srgb, var(--ca-accent) 16%, transparent)', color: 'var(--ca-accent)' }
          : { backgroundColor: 'rgba(17,17,17,0.05)', color: '#404040' }}
      >
        <Icon size={18} />
      </span>
      <div>
        <div className="text-[11px] font-medium text-neutral-500">{label}</div>
        <div className="text-sm font-semibold" style={{ color: accent ? 'var(--ca-accent)' : 'var(--ca-ink)' }}>{value}</div>
      </div>
    </div>
  );
}

/* Sport-category "scoreboard tile" — uniform dark floodlit card with a lime
   top-accent bar and a faint diagonal stripe; the icon lights up lime on hover.
   (Distinct from the CA page's alternating checkerboard grid.) */
function UseCaseCard({ u }) {
  return (
    <Link to={START} className="group relative flex h-full flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#0F1613] p-5 transition-colors duration-300 hover:border-[#A3E635]/50 hover:no-underline">
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: 'linear-gradient(90deg, #15803D, #A3E635)' }} />
      <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(163,230,53,0.07) 0 1.5px, transparent 1.5px 12px)', maskImage: 'radial-gradient(circle at 88% 90%, #000, transparent 60%)', WebkitMaskImage: 'radial-gradient(circle at 88% 90%, #000, transparent 60%)' }} />
      <div className="relative flex items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(163,230,53,0.14)] text-[#A3E635] transition-colors duration-300 group-hover:bg-[#A3E635] group-hover:text-[#0F1613]">
          <u.icon size={22} />
        </span>
        <ArrowRight size={16} className="mt-1 text-white/25 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[#A3E635]" />
      </div>
      <h3 className="relative mt-4 font-heading text-[15px] font-bold text-white">{u.label}</h3>
      <p className="relative mt-1 text-[13px] leading-snug text-white/60">{u.desc}</p>
    </Link>
  );
}

/* How-it-works: left image tracks the active step; steps auto-advance every 2.5s
   (looping) and a click selects a step and restarts the timer. */
/* Turf "playbook" — a horizontal 3-step row with big faint numbers, an icon badge
   and a connecting line. (Distinct from the CA page's image + auto-advance timeline.) */
function HowItWorks({ steps }) {
  return (
    <div className="relative mt-16 grid gap-6 md:grid-cols-3">
      <span aria-hidden className="pointer-events-none absolute left-8 right-8 top-[3.4rem] hidden h-px md:block" style={{ background: 'linear-gradient(90deg, transparent, rgba(21,128,61,0.35), transparent)' }} />
      {steps.map((s, i) => (
        <Reveal key={s.title} delay={i * 0.1} className="relative">
          <div className="flex h-full flex-col rounded-[16px] border border-black/[0.06] bg-white p-6 shadow-[0_14px_34px_-24px_rgba(17,17,17,0.3)]">
            <div className="flex items-center justify-between">
              <span className="font-heading text-5xl font-extrabold leading-none tracking-tight" style={{ color: 'rgba(21,128,61,0.18)' }}>{String(i + 1).padStart(2, '0')}</span>
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-[0_8px_20px_-10px_rgba(21,128,61,0.8)]" style={{ background: 'var(--ca-primary)' }}>
                <s.icon size={22} />
              </span>
            </div>
            <h3 className="mt-5 font-heading text-lg font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{s.desc}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* Decorative CSS pattern behind a card — grid / dots / rings / stripes, faded from
   one corner so it adds life without touching the text. */

/* One integration card — logo + title + subtitle. */
function ToolCard({ t }) {
  return (
    <div className="flex h-full w-full items-center gap-3 rounded-2xl border border-black/[0.05] bg-white px-4 py-3.5 shadow-[0_14px_34px_-20px_rgba(17,17,17,0.3)] transition-colors hover:border-[#15803D]/30">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[color:var(--ca-grey)]">
        {t.logo
          ? <img src={t.logo} alt="" loading="lazy" className="h-6 w-6 object-contain" />
          : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</div>
        <div className="mt-0.5 text-xs leading-snug text-neutral-500">{t.sub}</div>
      </div>
    </div>
  );
}

/* Turf integrations — a bold, even logo-card grid (no centre connector hub).
   Distinct from the CA page's DOM-measured connector diagram. */
function IntegrationHub() {
  return (
    <div className="relative mx-auto max-w-5xl">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-[46rem] max-w-full -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(21,128,61,0.10), transparent)' }} />
      <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {TOOLS_ALL.map((t, i) => (
          <Reveal key={t.name} delay={(i % 3) * 0.06}>
            <ToolCard t={t} />
          </Reveal>
        ))}
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
      <div key={f.q} className="overflow-hidden rounded-[12px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'rgba(22,163,74,0.35)' : 'rgba(17,17,17,0.08)' }}>
        <button
          type="button"
          onClick={() => setOpen(isOpen ? -1 : i)}
          aria-expanded={isOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-[color:var(--ca-ink)]"
        >
          {f.q}
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-transform duration-300" style={{ backgroundColor: 'rgba(22,163,74,0.1)', color: 'var(--ca-primary)', transform: isOpen ? 'rotate(45deg)' : 'none' }}>
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

export default function SportsTurf() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/sports-turf`;
  const seo = {
    title: 'Turf Booking Software for Indian Turfs | Meeticulous',
    description: 'Turf booking software for box cricket, football, badminton and pickleball turfs in India. Players book slots and pay upfront by UPI, with WhatsApp reminders.',
    keywords: 'turf booking software, sports arena booking software, box cricket slot booking, football turf booking online india, badminton court booking system, book turf online, sports venue scheduling india',
    ogTitle: 'Your ground runs on slots. Let Meeticulous fill them.',
    ogDescription: 'Players book open slots, pay upfront over UPI, and get WhatsApp reminders — automatically. The booking page every turf and sports arena in India should have.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Sports & Turf',
    serviceType: 'Online slot booking software for sports turf and arenas',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Floodlit-night palette — legacy --ca-* var names kept so shared classNames work.
  const styleVars = {
    '--ca-primary': '#15803D', // turf green (AA-safe: 5:1 with white text/links)
    '--ca-accent': '#22C55E',  // brighter green (readable on light tints)
    '--ca-ink': '#0B0F12',     // stadium night / near-black text
    '--ca-cream': '#F1FBF4',   // faint mint section bg
    '--ca-grey': '#F3F6F4',    // light grey section bg
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
        themeColor="#15803D"
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · NAV ═══════════════ */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 hover:no-underline" aria-label="Meeticulous — home">
            <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="font-heading text-[15px] font-extrabold tracking-tight text-[color:var(--ca-ink)]">Meeticulous</span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV.map((item) => (
              <NavLink key={item.label} item={item} className="text-sm font-medium text-neutral-600 transition-colors hover:text-[color:var(--ca-ink)] hover:no-underline" />
            ))}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <Link to={LOGIN} className="text-sm font-semibold text-neutral-700 hover:text-[color:var(--ca-ink)] hover:no-underline">Login</Link>
            <CtaButton to={START} className="!px-5 !py-2.5">Start for Free <ArrowRight size={15} /></CtaButton>
          </div>

          <button type="button" className="lg:hidden" aria-label="Menu" onClick={() => setMenuOpen((v) => !v)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* mobile menu */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-black/5 bg-white lg:hidden">
              <div className="flex flex-col gap-1 px-5 py-4">
                {NAV.map((item) => (
                  <NavLink key={item.label} item={item} onClick={() => setMenuOpen(false)} className="rounded-lg px-2 py-2.5 text-sm font-medium text-neutral-700 hover:bg-[color:var(--ca-cream)] hover:no-underline" />
                ))}
                <div className="mt-2 flex items-center gap-3 border-t border-black/5 pt-3">
                  <Link to={LOGIN} className="flex-1 rounded-[5px] border-2 border-black/10 py-2.5 text-center text-sm font-semibold text-[color:var(--ca-ink)] hover:no-underline">Login</Link>
                  <CtaButton to={START} className="flex-1">Start for Free <ArrowRight size={15} /></CtaButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══════════════ 2 · HERO (floodlit night) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-14 pt-8 text-white sm:px-8 sm:pb-20 sm:pt-12 lg:pb-28 lg:pt-16" style={{ background: 'radial-gradient(120% 90% at 50% -10%, #123A24 0%, #0B0F12 58%)' }}>
        {/* floodlight glow */}
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[46rem] -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(163,230,53,0.20), transparent)' }} />
        {/* pitch yard-lines */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 72px)', maskImage: 'linear-gradient(180deg, #000, transparent 82%)', WebkitMaskImage: 'linear-gradient(180deg, #000, transparent 82%)' }} />

        <div className="relative mx-auto grid max-w-7xl items-center gap-10 sm:gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* LEFT */}
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="text-[clamp(1.5rem,5vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[2.7rem] sm:leading-[1.1] lg:text-[3rem]">
              Instant online booking software for{' '}
              <span style={{ color: '#A3E635' }}>sports turfs and arenas</span> with open slots.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-white/70 sm:mt-7 sm:text-lg lg:mx-0">
              Meeticulous is booking software for sports turfs and arenas — players see open slots, book and pay online for box cricket, football turf and courts, with reminders and GST invoices.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-6 flex flex-col items-center gap-3 sm:mt-9 sm:flex-row sm:gap-5 lg:justify-start">
              <Link
                to={START}
                className="btn flex w-full items-center justify-center gap-2 rounded-[5px] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_10px_30px_-8px_rgba(22,163,74,0.7)] transition-opacity hover:opacity-90 hover:no-underline sm:w-auto"
                style={{ background: 'var(--ca-primary)' }}
              >
                Create a Free Account <ArrowRight size={16} />
              </Link>
              <Link to="/contact" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-white transition-colors hover:text-[#A3E635] hover:no-underline">
                Book A Demo <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:mt-9 lg:justify-start">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/60">
                  <Check size={14} className="text-[#A3E635]" /> {t}
                </span>
              ))}
            </Reveal>
          </div>

          {/* RIGHT — icon art + floating glass cards */}
          <Reveal instant delay={0.1} className="relative hidden lg:block">
            <div aria-hidden className="absolute left-1/2 top-1/2 h-[27rem] w-[27rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[rgba(22,163,74,0.35)] to-[rgba(163,230,53,0.22)] blur-2xl" />
            <IconArt icon={TrophyArt} label="Meeticulous — slot booking for turf and sports arenas" className="relative z-10 mx-auto aspect-square w-full max-w-[27rem]" iconClassName="h-24 w-24" />
            <GlassCard icon={CalendarCheck} label="New booking" value="7–8 PM · Booked" float="brand-float" className="top-6 -left-4" />
            <GlassCard icon={Wallet} label="Payment received" value="₹1,200" accent float="brand-float--mid" className="top-1/2 -right-6" />
            <GlassCard icon={BellRing} label="WhatsApp reminder" value="Sent · 1h before" float="brand-float--slow" className="bottom-10 left-2" />
          </Reveal>
        </div>

        {/* Four benefits — scoreboard-style tiles, part of the hero */}
        <div className="relative mx-auto mt-12 grid max-w-7xl gap-3 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 4) * 0.06}>
              <div className="group flex h-full flex-col rounded-[10px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition-colors hover:border-[#A3E635]/40">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(163,230,53,0.14)] text-[#A3E635] transition-colors duration-300 group-hover:bg-[#A3E635] group-hover:text-[#12321f]">
                    <b.icon size={18} />
                  </span>
                  <div className="font-heading text-sm font-bold text-white">{b.title}</div>
                </div>
                <p className="mt-2 text-xs leading-snug text-white/70">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 3 · SPORT USE CASES ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Booking software for sports turf, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-neutral-500">
              From box cricket to badminton courts, take every slot booking in one place.
            </Reveal>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {USE_CASES.map((u, i) => (
              <Reveal key={u.label} delay={(i % 4) * 0.05}>
                <UseCaseCard u={u} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS ═══════════════ */}
      <section id="how" className="px-5 pb-10 pt-20 sm:px-8 lg:pb-14 lg:pt-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              How Meeticulous helps <span style={{ color: 'var(--ca-primary)' }}>turf &amp; arena owners</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">
              From &ldquo;is 8 PM free?&rdquo; to booked in seconds — no calls.
            </Reveal>
          </div>

          <HowItWorks steps={STEPS} />
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS HUB ═══════════════ */}
      <section id="features" className="px-5 pb-20 pt-6 sm:px-8 lg:pb-28 lg:pt-8">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you already use.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-3 text-base text-neutral-500">
              Connect your calendar, payments and WhatsApp — Meeticulous fits your workflow, no rewiring.
            </Reveal>
          </div>
          <div className="mt-12"><IntegrationHub /></div>
          <Reveal delay={0.1} className="mt-14 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              Explore All Features <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (scoreboard band) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-20 text-white sm:px-8 lg:py-24" style={{ background: 'var(--ca-ink)' }}>
        <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-64 w-[46rem] max-w-full -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(163,230,53,0.14), transparent)' }} />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 84px)', maskImage: 'linear-gradient(180deg, transparent, #000 40%, transparent)', WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 40%, transparent)' }} />
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Real impact for <span style={{ color: '#A3E635' }}>turf &amp; arena owners.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-white/60">
              Fill more slots, chase fewer payments — and keep every rupee you earn.
            </Reveal>
          </div>

          {/* scoreboard row */}
          <div className="mt-12 grid gap-px overflow-hidden rounded-[20px] border border-white/10 bg-white/10 sm:grid-cols-3">
            {[
              { v: '24/7', l: 'Bookings taken, day or night', note: 'Your page never sleeps' },
              { v: '100%', l: 'Kept on Pro', note: '0% commission — every rupee yours' },
              { v: '₹0', l: 'To get started', note: 'Free forever, no card' },
            ].map((s, i) => (
              <Reveal key={s.l} delay={i * 0.08} className="bg-[#0B0F12] p-8 text-center">
                <div className="font-heading text-5xl font-extrabold tracking-tight sm:text-6xl" style={{ color: '#A3E635' }}>{s.v}</div>
                <div className="mt-3 text-sm font-semibold text-white">{s.l}</div>
                <p className="mt-1 text-xs text-white/55">{s.note}</p>
              </Reveal>
            ))}
          </div>

          {/* community CTA bar */}
          <Reveal delay={0.12} className="mt-4">
            <a href="https://whatsapp.com/channel/0029Vb8ZyHP6GcG6LRA2K81Y" target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-4 rounded-[20px] border border-[#A3E635]/30 bg-[#A3E635]/[0.08] p-6 hover:no-underline sm:p-7">
              <div>
                <div className="font-heading text-lg font-extrabold text-white sm:text-xl">Join the community</div>
                <p className="mt-1 text-sm text-white/60">Connect with fellow turf owners growing on Meeticulous.</p>
              </div>
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full text-[#0B0F12] transition-transform group-hover:translate-x-1" style={{ background: '#A3E635' }}>
                <ArrowRight size={20} />
              </span>
            </a>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.05} className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Trusted by <span style={{ color: 'var(--ca-primary)' }}>turf &amp; sports venues</span> across India.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-3 text-base text-neutral-500">
              Hear how grounds fill more slots and cut the admin with Meeticulous.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-5">
            {/* featured quote */}
            <Reveal className="lg:col-span-2">
              <figure className="relative flex h-full flex-col justify-between overflow-hidden rounded-[20px] p-8 text-white" style={{ background: 'var(--ca-ink)' }}>
                <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(163,230,53,0.06) 0 1.5px, transparent 1.5px 12px)', maskImage: 'radial-gradient(circle at 90% 90%, #000, transparent 60%)', WebkitMaskImage: 'radial-gradient(circle at 90% 90%, #000, transparent 60%)' }} />
                <div className="relative">
                  <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={16} style={{ color: '#A3E635', fill: '#A3E635' }} />)}</div>
                  <blockquote className="mt-5 font-heading text-xl font-semibold leading-snug text-white sm:text-2xl">&ldquo;{CA_TESTIMONIALS[0].quote}&rdquo;</blockquote>
                </div>
                <figcaption className="relative mt-8 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl text-base font-bold" style={{ background: '#A3E635', color: '#0B0F12' }}>{CA_TESTIMONIALS[0].name.charAt(0)}</span>
                  <div>
                    <div className="text-sm font-bold text-white">{CA_TESTIMONIALS[0].name}</div>
                    <div className="text-xs text-white/55">{CA_TESTIMONIALS[0].role}</div>
                  </div>
                </figcaption>
              </figure>
            </Reveal>

            {/* supporting cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:col-span-3">
              {CA_TESTIMONIALS.slice(1).map((t, i) => (
                <Reveal key={t.name} delay={(i % 2) * 0.06}>
                  <figure className="flex h-full flex-col rounded-[16px] border border-black/[0.06] bg-white p-5 shadow-[0_8px_30px_rgba(17,17,17,0.05)]">
                    <div className="flex gap-0.5">{[0, 1, 2, 3, 4].map((s) => <Star key={s} size={13} style={{ color: '#15803D', fill: '#15803D' }} />)}</div>
                    <blockquote className="mt-3 text-[13.5px] leading-relaxed text-neutral-600">&ldquo;{t.quote}&rdquo;</blockquote>
                    <figcaption className="mt-4 flex items-center gap-2.5">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: 'var(--ca-primary)' }}>{t.name.charAt(0)}</span>
                      <div>
                        <div className="text-[13px] font-bold text-[color:var(--ca-ink)]">{t.name}</div>
                        <div className="text-[11px] text-neutral-500">{t.role}</div>
                      </div>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · OLD WAY vs Meeticulous ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.05} className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The old way vs <span style={{ color: 'var(--ca-primary)' }}>a better way to run your ground.</span>
            </Reveal>
          </div>

          <Reveal className="relative mt-14 grid overflow-hidden rounded-[24px] shadow-[0_24px_60px_-30px_rgba(17,17,17,0.4)] lg:grid-cols-2">
            {/* VS badge on the seam */}
            <div aria-hidden className="absolute left-1/2 top-1/2 z-20 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white font-heading text-lg font-extrabold text-white shadow-xl" style={{ background: 'var(--ca-primary)' }}>VS</span>
            </div>

            {/* OLD WAY half */}
            <div className="bg-white p-7 sm:p-9">
              <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-neutral-500"><X size={18} className="text-[#DC2626]" /> The old way</h3>
              <div className="mt-6 flex flex-col gap-4">
                {OLD_WAY.map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <item.icon size={17} className="mt-0.5 shrink-0 text-[#DC2626]" />
                    <div>
                      <p className="text-[14px] font-semibold text-neutral-700">{item.title}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-neutral-500">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* NEW WAY half — dark floodlit */}
            <div className="relative overflow-hidden p-7 text-white sm:p-9" style={{ background: 'var(--ca-ink)' }}>
              <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(163,230,53,0.06) 0 1.5px, transparent 1.5px 12px)', maskImage: 'radial-gradient(circle at 92% 8%, #000, transparent 65%)', WebkitMaskImage: 'radial-gradient(circle at 92% 8%, #000, transparent 65%)' }} />
              <h3 className="relative flex items-center gap-2 font-heading text-lg font-bold text-white"><Check size={18} style={{ color: '#A3E635' }} /> With Meeticulous</h3>
              <div className="relative mt-6 flex flex-col gap-4">
                {NEW_WAY.map((item) => (
                  <div key={item.title} className="flex gap-3">
                    <item.icon size={17} className="mt-0.5 shrink-0" style={{ color: '#A3E635' }} />
                    <div>
                      <p className="text-[14px] font-semibold text-white">{item.title}</p>
                      <p className="mt-0.5 text-[13px] leading-snug text-white/60">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 9 · TRUST STRIP (honest, verifiable) ═══════════════ */}
      <section className="border-y border-black/5 px-5 py-12 sm:px-8" style={{ background: 'var(--ca-ink)' }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 lg:grid-cols-4">
          {TRUST_STRIP.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06} className="text-center">
              <s.icon size={20} className="mx-auto" style={{ color: '#A3E635' }} />
              <div className="mt-2 font-heading text-2xl font-extrabold tracking-tight text-white sm:text-3xl">{s.value}</div>
              <p className="mx-auto mt-1.5 max-w-[14rem] text-xs leading-snug text-white/50">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 10 · PRICING ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.05} className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start small. <span style={{ color: 'var(--ca-primary)' }}>Grow as your bookings do.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-neutral-500">
              Choose a plan that fits your ground today. Upgrade when you need more.
            </Reveal>
          </div>

          {/* billing toggle */}
          <Reveal delay={0.1} className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>Monthly</button>
            <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: yearly ? 'var(--ca-primary)' : '#d4d4d4', minHeight: 0 }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: yearly ? '22px' : '2px' }} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>
              Yearly <span className="ml-1 rounded-full bg-[#15803D]/12 px-2 py-0.5 text-xs font-bold text-[#15803D]">Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
            </span>
          </Reveal>

          <div className="relative mx-auto mt-10 max-w-3xl">
            {/* faint grid backdrop */}
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(17,17,17,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(17,17,17,0.05) 1px, transparent 1px)', backgroundSize: '38px 38px', maskImage: 'radial-gradient(circle at center, black, transparent 78%)', WebkitMaskImage: 'radial-gradient(circle at center, black, transparent 78%)' }} />
            <div className="relative grid gap-5 sm:grid-cols-2 sm:gap-6">
              {/* Starter (free) */}
              <Reveal>
                <div className="flex h-full flex-col rounded-[18px] border border-black/[0.08] bg-white p-7">
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
                        <Check size={16} className="mt-0.5 shrink-0 text-[#15803D]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <CtaButton to={START} variant="ghost" className="mt-7 w-full">Get Started</CtaButton>
                </div>
              </Reveal>

              {/* Pro (premium) — recommended, dark floodlit */}
              <Reveal delay={0.08}>
                <div className="relative flex h-full flex-col overflow-hidden rounded-[18px] border-2 p-7 text-white shadow-[0_24px_60px_-24px_rgba(21,128,61,0.5)]" style={{ background: 'var(--ca-ink)', borderColor: '#A3E635' }}>
                  <span aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(135deg, rgba(163,230,53,0.06) 0 1.5px, transparent 1.5px 12px)', maskImage: 'radial-gradient(circle at 90% 8%, #000, transparent 62%)', WebkitMaskImage: 'radial-gradient(circle at 90% 8%, #000, transparent 62%)' }} />
                  <div className="relative flex items-center justify-between">
                    <div className="font-heading text-lg font-bold text-white">{PREMIUM_PLAN.name}</div>
                    {yearly && <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-[#0B0F12]" style={{ background: '#A3E635' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>}
                  </div>
                  <p className="relative mt-1 text-sm text-white/60">Keep every rupee. Automate the rest.</p>
                  <div className="relative mt-6 flex items-end gap-1">
                    <span className="pb-1.5 text-2xl font-bold" style={{ color: '#A3E635' }}>₹</span>
                    <span className="font-heading text-5xl font-extrabold tracking-tight" style={{ color: '#A3E635' }}>{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                    <span className="pb-2 text-sm text-white/60">/month</span>
                    {yearly && <span className="pb-2 ml-1 text-sm text-white/45 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                  </div>
                  <p className="relative mt-1.5 text-xs font-semibold text-white/60">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST included` : 'Billed monthly · GST included'}</p>
                  <ul className="relative mt-6 flex flex-col gap-3">
                    <li className="flex items-start gap-2.5 text-sm font-semibold text-white">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#A3E635' }} />
                      <span>Everything in Free</span>
                    </li>
                    {PREMIUM_PLAN.features.slice(0, 4).map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-white/80">
                        <Check size={16} className="mt-0.5 shrink-0" style={{ color: '#A3E635' }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to={START} className="relative mt-7 inline-flex w-full items-center justify-center gap-2 rounded-[5px] px-6 py-3.5 text-sm font-semibold text-[#0B0F12] transition-opacity hover:opacity-90 hover:no-underline" style={{ background: '#A3E635' }}>
                    Get Started Now <ArrowRight size={15} />
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>

          <Reveal delay={0.12} className="mt-8 flex flex-col items-center gap-2 text-center">
            <span className="flex items-center gap-1.5 text-sm text-neutral-500"><Lock size={14} className="text-[#15803D]" /> Access to all features with no hidden fees</span>
            <Link to="/pricing" className="text-sm font-semibold text-neutral-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · ABOUT ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LEFT — icon art */}
          <Reveal className="relative order-2 mx-auto w-full max-w-md lg:order-1 lg:mx-0">
            <div aria-hidden className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#15803D]/15 blur-3xl" />
            <IconArt icon={TrophyArt} className="relative z-10 mx-auto aspect-square w-full max-w-[22rem]" />
          </Reveal>

          {/* RIGHT — text */}
          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal as="h2" delay={0.05} className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Small businesses deserve better tools.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-neutral-600">
              Meeticulous was built to make appointment- and slot-based businesses easier to run. Instead of stitching together calendars, WhatsApp messages, cash and payment tools, owners can take every booking from one simple platform.
            </Reveal>
            <Reveal as="p" delay={0.1} className="mt-4 text-[15px] font-medium text-neutral-500">
              Built for Indian businesses. Designed for the way modern venues actually run.
            </Reveal>
            <Reveal delay={0.14} className="mt-8">
              <Link to="/about" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
                Learn More About Us <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 12 · FAQ ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 13 · FINAL CTA (floodlit) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8" style={{ background: 'radial-gradient(120% 120% at 50% 0%, #123A24 0%, #0B0F12 60%)' }}>
        <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-56 w-[42rem] -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(163,230,53,0.18), transparent)' }} />
        <div className="relative mx-auto max-w-2xl">
          <Reveal className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(163,230,53,0.16)' }}>
            <Zap size={26} style={{ color: '#A3E635' }} />
          </Reveal>
          <Reveal as="h2" delay={0.06} className="mt-6 font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            Spend less time on the phone. <span style={{ color: '#A3E635' }}>Spend more time filling your ground.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base text-white/60">
            Set up your booking page today and give players a simpler way to reserve a slot.
          </Reveal>
          <Reveal delay={0.14} className="mt-8">
            <CtaButton to={START} className="!px-8 !py-4">Start for Free <ArrowRight size={16} /></CtaButton>
          </Reveal>
          <Reveal as="p" delay={0.18} className="mt-4 text-xs text-white/60">No credit card required</Reveal>
        </div>
      </section>

      {/* ═══════════════ 14 · FOOTER ═══════════════ */}
      <footer className="border-t border-black/5 px-5 py-16 sm:px-8" style={{ background: '#ffffff' }}>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <div className="font-heading text-lg font-extrabold text-[color:var(--ca-ink)]">Meeticulous</div>
              <p className="mt-2 max-w-xs text-sm text-neutral-500">The simpler way to take slot bookings.</p>
              <CtaButton to={START} className="mt-5">Start for Free <ArrowRight size={15} /></CtaButton>
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
            <p className="text-xs text-neutral-500">Made for India&apos;s turf &amp; sports venues</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
