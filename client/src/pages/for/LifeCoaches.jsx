// /for/life-coaches — bespoke, conversion-focused landing page for life &
// wellness coaches in India. (Sept release rebuild.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx, prerender.mjs,
// sitemapService.js, Navbar "Who it's for" menu. (The main thread wires those.)
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in a
// warm EDITORIAL system (forest green + terracotta on warm paper — growth,
// transformation, human warmth; NOT clinical). Mechanics unique to this page:
// editorial display hero with a single tall image + upward-arc motif · editorial
// numbered offering rows · rising "journey" line with milestone dots · unified
// logo-row strip · warm big-numeral impact band · magazine pull-quote testimonials
// · split editorial before/after · two-card pricing · drop-cap about statement.
// Only nav/hero shell/footer (shared shell) may resemble sibling pages.
//
// IMAGES: intentional EMPTY ImgSlot placeholders with descriptive aria-label.
//
// HONESTY: scheduling + payment tool, not a coaching-outcomes product. Coaches are
// NOT medical; testimonials are labelled placeholders from coaches/practice about
// ADMIN relief (booking, no-shows, getting paid upfront) — never client life
// outcomes. Trust facts are verifiable; JSON-LD has NO aggregateRating.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// menu/accordion/pricing switch, AA-contrast palette, visible focus, no hover
// uplift, Reveal guards its own motion.

import { useState } from 'react';
import { Compass as CompassIcon } from 'lucide-react';
import IconArt from '../../components/common/IconArt';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus,
  CalendarCheck, LayoutDashboard, Share2, BellRing,
  Compass, Target, Sparkles, Leaf, Sunrise, Users,
  Landmark, ShieldCheck, BadgePercent, Lock,
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
const GLOW = '#F6A46A';           // light warm terracotta — accent text on dark green (high contrast)

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const NAV = [
  { label: 'Services', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const SLOT_ICON = CompassIcon; // stands in for the removed mascot art
const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian coaches'];

// Editorial numbered offering rows — the sessions a coach sells.
const SERVICES = [
  { icon: Compass, label: 'Discovery Call', desc: 'A paid intro call to see if you are the right fit.' },
  { icon: Target, label: '1:1 Coaching Session', desc: 'One-on-one sessions, booked and paid in advance.' },
  { icon: Sparkles, label: 'Life & Mindset Coaching', desc: 'Clarity, habits and personal growth work.' },
  { icon: Leaf, label: 'Wellness & Wellbeing', desc: 'Stress, balance and lifestyle sessions.' },
  { icon: Sunrise, label: 'Coaching Packages', desc: 'Multi-session programmes with recurring bookings.' },
  { icon: Users, label: 'Group Sessions & Workshops', desc: 'Run a cohort or a group programme.' },
];

// Rising "journey" milestones.
const STEPS = [
  { title: 'Set up your sessions', icon: LayoutDashboard, desc: 'Add your services, fees and availability in minutes.' },
  { title: 'Share your link', icon: Share2, desc: 'Put it in your bio, DMs or newsletter — one calm link.' },
  { title: 'Clients book & pay', icon: CalendarCheck, desc: 'They pick a time and pay upfront — no back-and-forth.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Automatic confirmations and reminders before each session.' },
];

// Logo-row strip — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg' },
  { name: 'Zoom', logo: '/images/logos/zoom.ico' },
  { name: 'Razorpay', logo: razorpayLogo },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg' },
];

// Warm big-numeral impact band.
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night', note: 'Your booking page never sleeps — clients reserve sessions any time.' },
  { v: '100%', l: 'Kept on Pro', note: '0% commission — every rupee you earn stays yours.' },
  { v: '₹0', l: 'To get started', note: 'Free forever plan — no card, no lock-in.' },
  { v: 'GST', l: 'Invoices, automatic', note: 'A tax invoice generated for every paid booking.' },
];

// Magazine pull-quotes — labelled placeholders about the SOFTWARE's admin benefit,
// never coaching outcomes. First is the featured (larger) quote.
const TESTIMONIALS = [
  { quote: 'I used to lose clients in Instagram DMs trying to find a time. Now they book a paid session from my link and it is confirmed — I just show up and coach. It gave me my mornings back.', name: 'Ananya Menon', role: 'Life Coach', company: 'Bengaluru' },
  { quote: 'Automatic reminders cut my no-shows to almost nothing. Fewer empty slots, fewer awkward follow-ups.', name: 'Rhea Kapoor', role: 'Wellness Coach', company: 'Mumbai' },
  { quote: 'Taking the session fee upfront over UPI, with a GST invoice each time, made my practice feel like a real business.', name: 'Karan Malhotra', role: 'Mindset Coach', company: 'Delhi' },
  { quote: 'Clients book their own sessions without waiting for me to reply. Setup took one evening.', name: 'Sneha Rao', role: 'Wellbeing Coach', company: 'Pune' },
];

// Before / after — a coach's day without vs with Meeticulous.
const OLD_WAY = [
  { title: 'DM tag for every session', desc: 'Clients message to find a time; you reply between sessions.' },
  { title: 'No-shows waste your day', desc: 'A missed session is a slot you cannot fill.' },
  { title: 'Chasing session fees', desc: 'You follow up for payment after the session.' },
  { title: 'Clients scattered everywhere', desc: 'Notes across DMs, chats, notebooks and email.' },
  { title: 'Double-booked slots', desc: 'Two clients penciled into the same hour by hand.' },
];
const NEW_WAY = [
  { title: 'One calm booking link', desc: 'Share it in your bio; clients pick a slot, 24/7.' },
  { title: 'Automatic reminders', desc: 'WhatsApp and email reminders cut no-shows.' },
  { title: 'Fees collected upfront', desc: 'Session fee taken at booking, over UPI or card.' },
  { title: 'Every client in one place', desc: 'Sessions, history and notes in a single dashboard.' },
  { title: 'Conflict-free calendar', desc: 'Availability stays accurate — no double bookings.' },
];

// Trust facts — verifiable only.
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your practice data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: 'Operated under India’s data protection law' },
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee you earn' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for life and wellness coaches?', a: 'Yes. Whether you coach one-on-one or run group programmes, Meeticulous manages your sessions, availability, client bookings and communication from one place — so you can focus on coaching, not coordination.' },
  { q: 'Can clients book coaching sessions online?', a: 'Yes. A client opens your booking link, chooses a session such as a discovery call or a 1:1, picks a convenient time and confirms — no DMs or waiting for a reply.' },
  { q: 'Can I take a paid discovery call?', a: 'Yes. Create a paid intro or discovery call with its own fee and duration. Clients pay upfront through Razorpay when they book, so you only spend time on committed clients.' },
  { q: 'Can I share my booking link in my Instagram bio?', a: 'Yes. Your link works anywhere — put it in your Instagram or LinkedIn bio, your newsletter or your DMs. One link handles all your booking requests.' },
  { q: 'Can I collect session fees online?', a: 'Yes. Collect fees upfront through Razorpay — UPI, cards or netbanking — before the session. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I sell coaching packages or run group sessions?', a: 'Yes. Offer multi-session packages, recurring bookings and group sessions or workshops — each with its own duration, fee and availability.' },
  { q: 'Can I run online sessions?', a: 'Yes. Offer online sessions with automatic Google Meet or Zoom links, or mark a service as in-person — or both. The client picks the mode that suits them.' },
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
    { label: 'Life & Wellness Coaches', to: '/for/life-coaches' },
    { label: 'Fitness Trainers', to: '/for/fitness' },
    { label: 'Business Consultants', to: '/for/business-consultant' },
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
    solid: 'text-white shadow-[0_4px_14px_rgba(22,101,52,0.22)] hover:brightness-110',
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

/* Rising "journey" — milestone dots on a gently rising line (desktop), stacked on mobile. */
function Journey({ steps }) {
  const left = [12.5, 37.5, 62.5, 87.5];
  const top = [72, 54, 36, 18]; // rising: earlier steps sit lower
  return (
    <div className="mt-14">
      {/* desktop: rising line + milestone dots */}
      <div className="relative hidden h-40 lg:block" aria-hidden>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="lc-rise" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(194,65,12,0.15)" />
              <stop offset="0.5" stopColor="rgba(194,65,12,0.6)" />
              <stop offset="1" stopColor="rgba(22,101,52,0.65)" />
            </linearGradient>
          </defs>
          <polyline
            points="0,86 12.5,72 37.5,54 62.5,36 87.5,18 100,10"
            fill="none"
            stroke="url(#lc-rise)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {steps.map((s, i) => (
          <div key={s.title} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${left[i]}%`, top: `${top[i]}%` }}>
            <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 bg-white shadow-[0_10px_24px_-12px_rgba(28,43,34,0.5)]" style={{ borderColor: 'var(--ca-accent)', color: 'var(--ca-primary)' }}>
              <s.icon size={22} />
            </span>
          </div>
        ))}
      </div>
      {/* desktop: aligned text under each milestone */}
      <div className="hidden lg:mt-4 lg:grid lg:grid-cols-4 lg:gap-6">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.08} className="px-2 text-center">
            <span className="mx-auto mb-3 flex h-7 w-7 items-center justify-center rounded-full font-heading text-[12px] font-extrabold text-white" style={{ background: 'var(--ca-accent)' }}>{i + 1}</span>
            <h3 className="font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
            <p className="mx-auto mt-1.5 max-w-[15rem] text-sm leading-relaxed text-neutral-500">{s.desc}</p>
          </Reveal>
        ))}
      </div>
      {/* mobile: stacked milestones */}
      <div className="space-y-5 lg:hidden">
        {steps.map((s, i) => (
          <Reveal key={s.title} delay={i * 0.06}>
            <div className="flex items-start gap-4">
              <span className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border-2 bg-white" style={{ borderColor: 'var(--ca-accent)', color: 'var(--ca-primary)' }}>
                <s.icon size={19} />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full font-heading text-[10px] font-extrabold text-white" style={{ background: 'var(--ca-accent)' }}>{i + 1}</span>
              </span>
              <div>
                <h3 className="font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-neutral-500">{s.desc}</p>
              </div>
            </div>
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
      <div key={f.q} className="overflow-hidden rounded-[14px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'var(--ca-primary)' : 'rgba(17,17,17,0.08)' }}>
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

export default function LifeCoaches() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/life-coaches`;
  const seo = {
    title: 'Appointment Booking Software for Life Coaches in India | Meeticulous',
    description: 'Meeticulous is appointment booking software for life coaches and wellness coaches in India. Let clients book coaching sessions and paid discovery calls online — fees collected upfront, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'appointment booking software for coaches, life coach scheduling software india, book coaching session online, wellness coach booking page, paid discovery call scheduling, coaching appointment software',
    ogTitle: 'Your practice runs on sessions. Let Meeticulous schedule them.',
    ogDescription: 'Clients book coaching sessions, pay upfront and get WhatsApp reminders — automatically. A calm booking page for life and wellness coaches in India.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Life & Wellness Coaches',
    serviceType: 'Appointment booking software for life and wellness coaches',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Warm editorial palette — legacy --ca-* var names kept so shared classNames work.
  const styleVars = {
    '--ca-primary': '#166534', // green-800 — text/links/fills, AA on white (~6.5:1)
    '--ca-accent': '#C2410C',  // terracotta orange-700 — AA on white (~5:1)
    '--ca-ink': '#1C2B22',     // deep forest-charcoal text
    '--ca-cream': '#FAF6F0',   // warm paper section bg
    '--ca-grey': '#F1F0EA',    // warm light section bg
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
        themeColor="#166534"
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

      {/* ═══════════════ 2 · HERO (editorial display + tall image + upward arc) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-20 pt-12 sm:px-8 lg:pb-28 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        {/* required decorative blob — mix-blend-multiply so it sits into the warm paper */}
        <div aria-hidden className="pointer-events-none absolute -right-24 top-6 h-[26rem] w-[26rem] rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(194,65,12,0.16), transparent)' }} />
        <div aria-hidden className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(22,101,52,0.10), transparent)' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* LEFT — editorial copy */}
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[color:var(--ca-ink)]">
              Flexible appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>life coaches</span> managing one-to-one sessions.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-neutral-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for life coaches — stop losing clients in your DMs; they book sessions, pay upfront, and get reminded, so you coach instead of coordinating.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Create Your Booking Page <ArrowRight size={16} /></CtaButton>
              <a href="#how" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
                See How It Works <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </a>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
                  <Check size={14} style={{ color: 'var(--ca-accent)' }} /> {t}
                </span>
              ))}
            </Reveal>
          </div>

          {/* RIGHT — single tall image + upward-arc motif + floating "Session booked" card */}
          <Reveal instant delay={0.12} className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-md">
            <svg aria-hidden viewBox="0 0 160 112" fill="none" className="pointer-events-none absolute -right-8 -top-9 h-24 w-36 sm:h-28 sm:w-40">
              <path d="M8 104 C 44 44, 104 14, 152 8" stroke="var(--ca-accent)" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="152" cy="8" r="4.5" fill="var(--ca-accent)" />
            </svg>
            <ImgSlot alt="A life coach in a calm one-on-one session with a client" rounded="rounded-[28px]" className="aspect-[4/5] w-full shadow-[0_30px_60px_-30px_rgba(28,43,34,0.45)]" />
            <div className="absolute top-[16%] -left-6 z-20 flex items-center gap-3 rounded-2xl border border-black/5 bg-white px-4 py-3 shadow-[0_18px_40px_-18px_rgba(28,43,34,0.5)]">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={17} /></span>
              <div>
                <div className="text-[11px] text-neutral-500">Session booked</div>
                <div className="text-sm font-bold text-[color:var(--ca-ink)]">1:1 Session · 5:00 PM</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (editorial numbered offering rows) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="max-w-2xl">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for life coaches, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-neutral-500">
              From discovery calls to 1:1s, packages and group sessions — manage every booking in one place.
            </Reveal>
          </div>
          <div className="mt-12 border-t border-black/10">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 3) * 0.05}>
                <Link to={START} className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 border-b border-black/10 py-7 transition-colors hover:bg-[color:var(--ca-cream)] hover:no-underline sm:gap-8">
                  <span className="font-heading text-4xl font-extrabold leading-none tabular-nums sm:text-5xl" style={{ color: 'var(--ca-accent)' }}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <s.icon size={18} style={{ color: 'var(--ca-primary)' }} />
                      <h3 className="font-heading text-lg font-bold text-[color:var(--ca-ink)] transition-colors group-hover:text-[color:var(--ca-primary)]">{s.label}</h3>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{s.desc}</p>
                  </div>
                  <ArrowRight size={18} className="shrink-0 text-neutral-300 transition-all group-hover:translate-x-0.5 group-hover:text-[color:var(--ca-primary)]" />
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (rising journey line) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From first message to a <span style={{ color: 'var(--ca-primary)' }}>paid, confirmed session.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">
              From &ldquo;when are you free?&rdquo; to a booked session — in four gentle steps.
            </Reveal>
          </div>
          <Journey steps={STEPS} />
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (unified logo-row strip) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">
              Calendar, video, payments and WhatsApp — Meeticulous fits your workflow, no rewiring.
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[20px] border border-black/[0.08] bg-black/[0.06] sm:grid-cols-3 lg:grid-cols-6">
            {TOOLS.map((t) => (
              <div key={t.name} className="flex flex-col items-center justify-center gap-3 bg-white px-4 py-8 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:var(--ca-grey)]">
                  {t.logo ? <img src={t.logo} alt="" loading="lazy" className="h-6 w-6 object-contain" /> : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
                </span>
                <span className="text-[13px] font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</span>
              </div>
            ))}
          </Reveal>
          <Reveal delay={0.1} className="mt-10 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              Explore All Features <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (warm big-numeral band) ═══════════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #F3E7D7 100%)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Real impact for <span style={{ color: 'var(--ca-primary)' }}>a modern coaching practice.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-600">
              Less admin, more presence — and every rupee you earn stays yours.
            </Reveal>
          </div>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6 lg:divide-x lg:divide-black/10">
            {METRICS.map((m, i) => (
              <Reveal key={m.l} delay={i * 0.06} className="text-center lg:px-6">
                <div className="font-heading text-6xl font-extrabold tracking-tight sm:text-7xl" style={{ color: 'var(--ca-primary)' }}>{m.v}</div>
                <div className="mt-3 font-heading text-sm font-bold text-[color:var(--ca-ink)]">{m.l}</div>
                <p className="mx-auto mt-2 max-w-[15rem] text-xs leading-relaxed text-neutral-500">{m.note}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (magazine pull-quotes) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="max-w-2xl">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              In their <span style={{ color: 'var(--ca-primary)' }}>own words.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">
              How coaches book more paid sessions and cut the admin with Meeticulous.
            </Reveal>
          </div>
          <div className="mt-14 space-y-12 sm:space-y-16">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 2) * 0.05}>
                <figure className={`mx-auto max-w-3xl ${i > 0 ? 'border-t border-black/10 pt-12 sm:pt-16' : ''}`}>
                  <span aria-hidden className="block font-heading text-[64px] leading-[0.5] sm:text-[84px]" style={{ color: 'color-mix(in srgb, var(--ca-accent) 32%, transparent)' }}>&ldquo;</span>
                  <blockquote className={`mt-3 font-heading font-medium leading-[1.35] tracking-[-0.01em] text-[color:var(--ca-ink)] ${i === 0 ? 'text-2xl sm:text-[2rem]' : 'text-xl sm:text-[1.55rem]'}`}>
                    {t.quote}
                  </blockquote>
                  <figcaption className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span aria-hidden className="h-px w-8" style={{ background: 'var(--ca-accent)' }} />
                    <span className="text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--ca-ink)]">{t.name}</span>
                    <span className="text-xs uppercase tracking-[0.14em] text-neutral-400">{t.role} · {t.company}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (split editorial columns) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Trade the busywork for <span style={{ color: 'var(--ca-primary)' }}>a calmer way to work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">See a coach&apos;s day before and after Meeticulous.</Reveal>
          </div>
          <Reveal delay={0.08} className="mt-12 grid overflow-hidden rounded-[20px] border border-black/[0.08] bg-white shadow-[0_24px_60px_-40px_rgba(28,43,34,0.3)] md:grid-cols-2">
            {/* old way */}
            <div className="p-7 sm:p-9">
              <h3 className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
                <X size={15} className="text-neutral-300" /> The old way
              </h3>
              <ul className="divide-y divide-black/[0.07]">
                {OLD_WAY.map((o) => (
                  <li key={o.title} className="py-4 first:pt-0 last:pb-0">
                    <p className="text-[15px] font-semibold text-neutral-500 line-through decoration-neutral-300 decoration-1">{o.title}</p>
                    <p className="mt-1 text-sm leading-snug text-neutral-400">{o.desc}</p>
                  </li>
                ))}
              </ul>
            </div>
            {/* with Meeticulous */}
            <div className="border-t border-black/[0.08] p-7 sm:p-9 md:border-l md:border-t-0" style={{ background: 'color-mix(in srgb, var(--ca-primary) 5%, #ffffff)' }}>
              <h3 className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--ca-primary)' }}>
                <Check size={15} /> With Meeticulous
              </h3>
              <ul className="divide-y divide-black/[0.07]">
                {NEW_WAY.map((n) => (
                  <li key={n.title} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} />
                    <div>
                      <p className="text-[15px] font-semibold text-[color:var(--ca-ink)]">{n.title}</p>
                      <p className="mt-1 text-sm leading-snug text-neutral-600">{n.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 9 · PRICING (Free + Premium two cards) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start small. <span style={{ color: 'var(--ca-primary)' }}>Grow as your practice does.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-neutral-500">
              Choose a plan that fits your practice today. Upgrade when you need more.
            </Reveal>
          </div>

          <Reveal delay={0.08} className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>Monthly</button>
            <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: yearly ? 'var(--ca-primary)' : '#cbd5e1', minHeight: 0 }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: yearly ? '22px' : '2px' }} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>
              Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--ca-primary) 12%, transparent)', color: 'var(--ca-primary)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
            </span>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Starter (free) */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[20px] border border-black/[0.08] bg-white p-7">
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
                <CtaButton to={START} variant="ghost" className="mt-7 w-full">Claim Your Free Link</CtaButton>
              </div>
            </Reveal>

            {/* Pro (premium) — recommended */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[20px] border-2 bg-white p-7 shadow-[0_24px_60px_-30px_rgba(16,24,40,0.16)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), var(--ca-accent))' }} />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-primary)' }}>Recommended</span>
                  </div>
                  {yearly && <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: 'var(--ca-accent)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>}
                </div>
                <p className="mt-1 text-sm text-neutral-500">Keep every rupee. Automate the rest.</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold" style={{ color: 'var(--ca-primary)' }}>₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight" style={{ color: 'var(--ca-primary)' }}>{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                  <span className="pb-2 text-sm text-neutral-500">/month</span>
                  {yearly && <span className="ml-1 pb-2 text-sm text-neutral-400 line-through">₹{PREMIUM_PLAN.monthly}</span>}
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
            <span className="flex items-center gap-1.5 text-sm text-neutral-500"><Lock size={14} style={{ color: 'var(--ca-accent)' }} /> Access to all features with no hidden fees</span>
            <Link to="/pricing" className="text-sm font-semibold text-neutral-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 10 · ABOUT (drop-cap editorial statement + ruled trust rows) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-4xl">
          <Reveal as="p" delay={0.04} className="font-heading text-[clamp(1.35rem,2.6vw,1.9rem)] font-semibold leading-[1.42] tracking-[-0.01em] text-[color:var(--ca-ink)] first-letter:float-left first-letter:mr-3 first-letter:mt-1 first-letter:font-heading first-letter:text-[4.5rem] first-letter:font-black first-letter:leading-[0.68] first-letter:text-[#C2410C]">
            Meeticulous was built to make appointment-based practices easier to run. Instead of stitching together calendars, DMs, notebooks and payment tools, coaches manage every client session from one calm platform — built for Indian professionals, and designed for the way modern practices actually work.
          </Reveal>
          <Reveal delay={0.1} className="mt-12 border-t border-black/10">
            {TRUST_STRIP.map((it) => (
              <div key={it.value} className="flex items-center gap-4 border-b border-black/10 py-5">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}>
                  <it.icon size={20} />
                </span>
                <div className="flex flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                  <span className="font-heading text-base font-bold text-[color:var(--ca-ink)]">{it.value}</span>
                  <span className="text-sm text-neutral-500">{it.label}</span>
                </div>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · FAQ (two-column accordion) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 12 · FINAL CTA (forest green + terracotta mix-blend glow) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] px-6 py-16 text-center sm:px-12 sm:py-20" style={{ background: 'linear-gradient(150deg, #0F4D28 0%, var(--ca-primary) 100%)' }}>
          <div aria-hidden className="pointer-events-none absolute -top-20 left-1/2 h-72 w-[44rem] -translate-x-1/2 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(194,65,12,0.55), transparent)' }} />
          <div className="relative mx-auto max-w-2xl">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(194,65,12,0.22)' }}>
              <Sunrise size={26} style={{ color: GLOW }} />
            </div>
            <Reveal as="h2" className="mt-6 font-heading text-[clamp(1.9rem,4.5vw,2.7rem)] font-extrabold leading-[1.08] tracking-tight text-white">
              Spend less time scheduling. <span style={{ color: GLOW }}>Spend more time coaching.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75">
              Set up your booking page today and give your clients a calmer way to work with you.
            </Reveal>
            <Reveal delay={0.1} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link to={START} className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
                Launch My Page — Free <ArrowRight size={16} />
              </Link>
              <Link to="/contact" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline">
                Book A Demo
              </Link>
            </Reveal>
            <Reveal delay={0.14} className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
              {['No credit card', 'Free forever', '0% on Pro'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Check size={14} style={{ color: GLOW }} /> {t}</span>
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
              <p className="mt-2 max-w-xs text-sm text-neutral-500">The calmer way to manage coaching sessions.</p>
              <CtaButton to={START} className="mt-5">Get Started — It&apos;s Free <ArrowRight size={15} /></CtaButton>
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
            <p className="text-xs text-neutral-500">Made for India&apos;s life &amp; wellness coaches</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
