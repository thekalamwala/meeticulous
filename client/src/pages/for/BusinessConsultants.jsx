// /for/business-consultant — bespoke, conversion-focused landing page for
// business & management consultants and advisory firms in India.
//
// STANDALONE page (not the data-driven ProfessionLanding template). Same shared
// infra as its siblings (Seo, Reveal, useLenis, real plan data, /be-a-sloth
// funnel, prerender + Solutions hub). This bespoke route PRECEDES
// /for/:profession in App.jsx, so it replaces the generic template that
// previously served /for/business-consultant. Navbar, Solutions.jsx,
// useCasesConfig.js, prerender.mjs and sitemapService.js already point here.
//
// Section design (per the profession design brief, #03 Consultants):
//   split business-editorial hero · 3×2 benefits grid · professional service
//   cards · 4-step consulting workflow · integration logo grid · dashboard-style
//   impact metrics · compact mid CTA band · alternating why-us · client quote +
//   company identity testimonials · comparison table · corporate trust strip ·
//   clean SaaS pricing · founder/company editorial about · tabbed FAQ · dark
//   business final CTA.
//
// HONESTY (same rules as the CA/Lawyers pages): pricing mirrors the REAL two-plan
// model from data/plans.js; the brief's "numbers strip" is rendered as a
// verifiable trust strip (no fabricated counts); testimonials are clearly
// labelled placeholders to be swapped for real quotes; JSON-LD carries NO
// self-serving aggregateRating. No investment-advice claims — this is a
// scheduling/payment tool for the advisory work consultants already do.
//
// Legacy --ca-* CSS var names are kept (cosmetic) so shared classNames stay
// valid; values are retuned to a charcoal-slate + amber "corporate" palette.

import { useState, useRef, useLayoutEffect, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star,
  CalendarCheck, LayoutDashboard,
  Wallet, BellRing,
  Users,Landmark,
  FileText, Target, Briefcase, ShieldCheck, LineChart,
  Presentation, Rocket, Lightbulb, ClipboardCheck,
  BadgePercent, Lock, Zap, Share2,
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
const HERO_ART = '/for/business-consultant/hero.webp'; // consulting/analytics illustration
const ABOUT_ART = '/for/business-consultant/hero.webp';
const AMBER = '#F59E0B'; // bright amber — used only on the dark hero/CTA where contrast is high

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const NAV = [
  { label: 'Features', href: '#features' },
  { label: 'For Consultants', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Resources', to: '/blog' },
];

const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian advisory practices'];

// 3×2 structured benefits grid.
const BENEFITS = [
  { icon: CalendarCheck, title: 'Booked & Confirmed', desc: 'Clients pick an advisory slot and it is confirmed — no email tag.' },
  { icon: Wallet, title: 'Paid Upfront', desc: 'Collect your consulting fee online before the session starts.' },
  { icon: BellRing, title: 'Fewer No-Shows', desc: 'Automatic WhatsApp reminders before every engagement.' },
  { icon: FileText, title: 'GST Invoices, Automatic', desc: 'A tax invoice generated for every paid booking.' },
];

// Professional service cards — the advisory engagements a consultant sells.
const SERVICES = [
  { icon: Target, label: 'Strategy Consultation', desc: 'Advice on direction, growth and positioning.' },
  { icon: Briefcase, label: 'Management Consulting', desc: 'Operations, org design and execution support.' },
  { icon: Rocket, label: 'Startup Advisory', desc: 'Fundraising, go-to-market and founder mentoring.' },
  { icon: LineChart, label: 'Financial & Business Advisory', desc: 'Planning, modelling and performance reviews.' },
  { icon: Presentation, label: 'Leadership & Executive Coaching', desc: 'One-on-one coaching sessions, booked and paid.' },
  { icon: Lightbulb, label: 'Discovery & Scoping Calls', desc: 'Qualify new clients with a paid intro call.' },
  { icon: Users, label: 'Team & Board Advisory', desc: 'Group sessions and stakeholder workshops.' },
  { icon: ClipboardCheck, label: 'Audit & Review Sessions', desc: 'Structured reviews with clear deliverables.' },
];

// 4-step consulting workflow.
const STEPS = [
  { title: 'Set up your engagements', icon: LayoutDashboard, desc: 'Add your advisory services, fees and availability in minutes.' },
  { title: 'Share your booking link', icon: Share2, desc: 'Send it in your proposal, email signature or on LinkedIn — one link.' },
  { title: 'Clients book & pay', icon: CalendarCheck, desc: 'A client picks a service and a time, and pays the fee upfront.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'Automatic confirmations and WhatsApp reminders before every call.' },
];

// Integration list — REAL BAS integrations only.
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg', sub: 'Auto-add a video link to every booking' },
  { name: 'Zoom', logo: '/images/logos/zoom.ico', sub: 'Share meeting links automatically' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Online payments, refunds and GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Accept instant UPI payments' },
  { name: 'WhatsApp Automation', logo: '/images/logos/whatsapp.svg', sub: 'Reminders and updates on autopilot' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Booking confirmation emails, automatic' },
  { name: 'Client Records', logo: '/favicon.svg', sub: 'Every client, note and history in one place' },
];

// Dashboard-style impact metrics.
const METRICS = [
  { v: '24/7', l: 'Bookings, day or night', note: 'Your booking page never sleeps — clients reserve calls any time.' },
  { v: '100%', l: 'Kept on Sloth Active', note: '0% commission — every rupee you earn stays yours.' },
  { v: '₹0', l: 'To get started', note: 'Free forever plan — no card, no lock-in.' },
  { v: 'GST', l: 'Invoices, automatic', note: 'A tax invoice generated for every paid booking.' },
];

// Placeholder testimonials — swap for real consultant quotes when available.
// Client quote + company identity. About the SOFTWARE's admin benefit only.
const TESTIMONIALS = [
  { quote: 'Prospects used to disappear in email threads trying to find a time. Now they book a paid discovery call from my link and it is confirmed — my calendar fills itself.', name: 'Arjun Kapoor', role: 'Founder', company: 'Northstar Advisory' },
  { quote: 'Automatic WhatsApp reminders cut our no-shows sharply. Fewer wasted advisory hours across the whole team.', name: 'Meera Iyer', role: 'Managing Partner', company: 'Iyer Consulting Group' },
  { quote: 'Collecting the retainer and session fee upfront over UPI, with a GST invoice every time, cleaned up our billing completely.', name: 'Sanjay Rao', role: 'Principal Consultant', company: 'Rao & Associates' },
  { quote: 'Clients book strategy sessions without waiting for the office to reply. Setup took one evening.', name: 'Nandini Shah', role: 'Business Coach', company: 'Shah Growth Partners' },
  { quote: 'One clear calendar for the whole practice means no two clients penciled into the same slot.', name: 'Vikram Nair', role: 'Director', company: 'Peak Strategy Labs' },
  { quote: 'A professional booking page, 0% commission on Active, and payments straight to the practice account.', name: 'Ritika Sen', role: 'Independent Consultant', company: 'Sen Advisory' },
];

// Before / after — the practice's day without vs with Meeticulous.
const OLD_WAY = [
  { title: 'Email tag for every call', desc: 'Prospects email to find a time; you reply between meetings.' },
  { title: 'No-shows waste billable hours', desc: 'A missed advisory call is time you cannot bill.' },
  { title: 'Chasing consulting fees', desc: 'You follow up for payment after the advice is given.' },
  { title: 'Client details scattered', desc: 'Notes across email, calls, decks and spreadsheets.' },
  { title: 'Double-booked slots', desc: 'Two clients penciled into the same hour by hand.' },
];
const NEW_WAY = [
  { title: 'One professional booking link', desc: 'Share it in proposals and email; clients pick a slot, 24/7.' },
  { title: 'Automatic reminders', desc: 'WhatsApp and email reminders cut no-shows.' },
  { title: 'Fees collected upfront', desc: 'Session fee taken at booking, over UPI or card.' },
  { title: 'Every client in one place', desc: 'Engagements, history and notes in a single dashboard.' },
  { title: 'Conflict-free calendar', desc: 'Availability stays accurate — no double bookings.' },
];

// Honest trust strip — verifiable facts only (maps to real product behaviour).
const FAQ = [
  { q: 'Is Meeticulous suitable for business and management consultants?', a: 'Yes. Whether you are an independent consultant or an advisory firm with a team, Meeticulous manages your services, availability, client bookings and communication from one place — so you can run strategy calls, coaching sessions and advisory engagements without the manual coordination.' },
  { q: 'Can clients book advisory calls online?', a: 'Yes. A client opens your booking link, chooses a service such as a strategy consultation or discovery call, picks a convenient time and confirms — no email threads or waiting for the office to reply.' },
  { q: 'Can I take a paid discovery call?', a: 'Yes. Create a paid intro or discovery call with its own fee and duration. Clients pay upfront through Razorpay when they book, so you only spend time on qualified prospects.' },
  { q: 'Can I share my booking link on LinkedIn and in proposals?', a: 'Yes. Your link works anywhere — put it in your proposal, email signature, website or LinkedIn. One link handles all your booking requests.' },
  { q: 'Can I collect consulting fees online?', a: 'Yes. Collect fees upfront through Razorpay — UPI, cards or netbanking — before the session. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I run virtual consultations?', a: 'Yes. Offer online sessions with automatic Google Meet or Zoom links, or mark a service as in-person — or both. The client picks the mode that suits the engagement.' },
  { q: 'Can I manage multiple services and a team?', a: 'Yes. Create as many services as you need — strategy, coaching, advisory, discovery calls — each with its own duration, fee and availability, and manage every client from one dashboard.' },
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
    { label: 'Business Consultants', to: '/for/business-consultant' },
    { label: 'Chartered Accountants', to: '/for/chartered-accountants' },
    { label: 'Advocates & Law Firms', to: '/for/lawyers' },
    { label: 'Architects & Designers', to: '/for/architects' },
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
  const base = 'inline-flex items-center justify-center gap-2 rounded-[5px] px-6 py-3.5 text-sm font-semibold transition-all hover:no-underline';
  const styles = {
    solid: 'text-white shadow-[0_4px_14px_rgba(16,24,40,0.16)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/25',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

/* Floating glass card over the hero. */
function GlassCard({ icon: Icon, label, value, accent, className = '', float = '' }) {
  return (
    <div className={`sloth-glass ${float} absolute z-20 flex items-center gap-3 rounded-2xl px-4 py-3 ${className}`}>
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

/* Professional service card — clean, corporate, amber-accented icon. */
function ServiceCard({ s }) {
  return (
    <Link to={START} className="group relative flex h-full flex-col items-center rounded-[14px] border border-black/[0.08] bg-white px-5 pb-6 pt-12 text-center transition-colors duration-300 hover:border-[color:var(--ca-primary)]/25 hover:no-underline">
      <span className="absolute left-1/2 top-0 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg text-white shadow-[0_10px_24px_-12px_rgba(15,23,42,0.6)]" style={{ background: 'var(--ca-primary)' }}>
        <s.icon size={28} />
      </span>
      <h3 className="mt-1 font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{s.label}</h3>
      <p className="mb-6 mt-2 text-[13px] leading-relaxed text-neutral-500">{s.desc}</p>
      <span className="mt-auto inline-flex items-center gap-1.5 rounded-[6px] border-2 border-[color:var(--ca-primary)] px-4 py-2 text-[13px] font-semibold text-[color:var(--ca-primary)] transition-colors duration-300 group-hover:bg-[color:var(--ca-primary)] group-hover:text-white">
        Get Started <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

/* 4-step consulting workflow — numbered cards with a connecting rail. */
function HowItWorks({ steps }) {
  return (
    <div className="relative mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <span aria-hidden className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-7 hidden h-px lg:block" style={{ background: 'linear-gradient(90deg, transparent, rgba(180,83,9,0.5), transparent)' }} />
      {steps.map((s, i) => (
        <Reveal key={s.title} delay={i * 0.08} className="relative">
          <div className="relative flex h-full flex-col overflow-hidden rounded-[14px] border border-black/[0.08] bg-white p-6">
            <s.icon aria-hidden className="pointer-events-none absolute -bottom-4 -right-4" size={96} strokeWidth={1.5} style={{ color: 'var(--ca-primary)', opacity: 0.08 }} />
            <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border bg-white font-heading text-lg font-extrabold" style={{ borderColor: 'rgba(180,83,9,0.4)', color: 'var(--ca-primary)' }}>
              {String(i + 1).padStart(2, '0')}
            </span>
            <h3 className="relative z-10 mt-4 font-heading text-base font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
            <p className="relative z-10 mt-1.5 text-sm leading-relaxed text-neutral-500">{s.desc}</p>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

/* One integration row — logo + label + note (rule-separated). */
function ToolRow({ t }) {
  return (
    <div className="flex items-center gap-3.5 rounded-[12px] border border-black/[0.08] bg-white px-4 py-3.5">
      <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[color:var(--ca-grey)]">
        {t.logo
          ? <img src={t.logo} alt="" loading="lazy" className="h-5 w-5 object-contain" />
          : <ToolLogo name={t.icon} size={20} className="h-5 w-5" />}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</div>
        <div className="mt-0.5 text-xs leading-snug text-neutral-500">{t.sub}</div>
      </div>
    </div>
  );
}

/* Integration hub — a BA centre node wired to circular tool icons by dashed,
   row-flowing connectors. Geometry is measured from the real DOM so the curves
   always track the layout (resize / below-the-fold reveal / font settle). */
function IntegrationHub() {
  const wrapRef = useRef(null);
  const centerRef = useRef(null);
  const nodeRefs = useRef({});
  const [conns, setConns] = useState([]);
  const LEFT = TOOLS.slice(0, 4);
  const RIGHT = TOOLS.slice(4);

  useLayoutEffect(() => {
    const compute = () => {
      const wrap = wrapRef.current;
      const center = centerRef.current;
      if (!wrap || !center) return;
      const wb = wrap.getBoundingClientRect();
      const cb = center.getBoundingClientRect();
      const cx = cb.left + cb.width / 2 - wb.left;
      const cy = cb.top + cb.height / 2 - wb.top;
      const Rc = cb.width / 2;
      const next = [];
      TOOLS.forEach((t, idx) => {
        const el = nodeRefs.current[t.name];
        if (!el) return;
        const rb = el.getBoundingClientRect();
        const isLeft = idx < LEFT.length;
        const sx = (isLeft ? rb.right : rb.left) - wb.left;
        const sy = rb.top + rb.height / 2 - wb.top;
        const dx = sx - cx;
        const dy = sy - cy;
        const dist = Math.hypot(dx, dy) || 1;
        const ex = cx + (dx / dist) * (Rc + 2);
        const ey = cy + (dy / dist) * (Rc + 2);
        const midx = (sx + ex) / 2;
        next.push({ name: t.name, sx, sy, d: `M ${sx} ${sy} C ${midx} ${sy}, ${midx} ${ey}, ${ex} ${ey}` });
      });
      setConns(next);
    };
    compute();
    const run = () => requestAnimationFrame(compute);
    const ro = new ResizeObserver(run);
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) run(); }, { threshold: 0.01 });
    if (wrapRef.current) { ro.observe(wrapRef.current); io.observe(wrapRef.current); }
    window.addEventListener('resize', run);
    const t = setTimeout(compute, 400);
    return () => { ro.disconnect(); io.disconnect(); window.removeEventListener('resize', run); clearTimeout(t); };
  }, []);

  const Node = ({ t }) => (
    <div
      ref={(el) => { nodeRefs.current[t.name] = el; }}
      className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-[0_16px_36px_-20px_rgba(15,23,42,0.4)] ring-1 ring-black/5"
    >
      {t.logo
        ? <img src={t.logo} alt={t.name} loading="lazy" className="h-8 w-8 object-contain" />
        : <ToolLogo name={t.icon} size={32} className="h-8 w-8" />}
      <span className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-semibold text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100" style={{ background: 'var(--ca-ink)' }}>
        {t.name}
      </span>
    </div>
  );

  return (
    <>
      {/* mobile / tablet — plain card grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:hidden">
        {TOOLS.map((t) => <Reveal key={t.name}><ToolRow t={t} /></Reveal>)}
      </div>

      {/* desktop — measured hub-and-spoke */}
      <div ref={wrapRef} className="relative mx-auto hidden max-w-5xl px-12 py-10 lg:block">
        <div aria-hidden className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle, rgba(180,83,9,0.10), transparent 68%)' }} />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          <style>{`@keyframes bcFlow{to{stroke-dashoffset:-16}}.bc-dash{stroke-dasharray:2 7;stroke-linecap:round;animation:bcFlow 1.2s linear infinite}@media(prefers-reduced-motion:reduce){.bc-dash{animation:none}}`}</style>
          {conns.map((p, i) => (
            <g key={p.name}>
              <path d={p.d} fill="none" stroke="rgba(15,23,42,0.28)" strokeWidth="2" className="bc-dash" style={{ animationDelay: `${i * 0.08}s` }} />
              <circle cx={p.sx} cy={p.sy} r="3" fill="var(--ca-primary)" />
            </g>
          ))}
        </svg>

        <div className="relative grid grid-cols-[auto_1fr_auto] items-center gap-x-12">
          <div className="flex flex-col items-start gap-9">
            {LEFT.map((t) => <Node key={t.name} t={t} />)}
          </div>
          <div className="flex justify-center">
            <div ref={centerRef} className="relative flex h-40 w-40 items-center justify-center">
              <div aria-hidden className="absolute inset-[-18px] rounded-full border border-dashed border-[color:var(--ca-primary)]/30" />
              <div className="relative flex h-full w-full items-center justify-center rounded-full bg-white shadow-[0_30px_70px_-30px_rgba(15,23,42,0.5)] ring-1 ring-black/5">
                <img src="/favicon.svg" alt="Meeticulous" className="h-24 w-24 object-contain" />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-9">
            {RIGHT.map((t) => <Node key={t.name} t={t} />)}
          </div>
        </div>
      </div>
    </>
  );
}

/* Sliding testimonial carousel — avatar card + charcoal quote card, auto-advancing. */
function TestimonialSlider() {
  const [i, setI] = useState(0);
  const n = TESTIMONIALS.length;
  const go = (d) => setI((p) => (p + d + n) % n);
  useEffect(() => {
    const id = setInterval(() => setI((p) => (p + 1) % n), 6000);
    return () => clearInterval(id);
  }, [n]);
  const t = TESTIMONIALS[i];
  // blur-fade for the inner content only — the card shells stay put.
  const fade = {
    initial: { opacity: 0, filter: 'blur(10px)' },
    animate: { opacity: 1, filter: 'blur(0px)' },
    exit: { opacity: 0, filter: 'blur(10px)' },
    transition: { duration: 0.4, ease: 'easeOut' },
  };
  return (
    <div className="mx-auto mt-12 max-w-5xl">
      {/* static grid + card shells */}
      <div className="grid items-stretch gap-5 lg:grid-cols-[minmax(0,300px)_1fr]">
        {/* left — avatar shell (static); initial + badge blur-swap */}
        <div className="relative overflow-hidden rounded-[18px]">
          <div className="flex aspect-[4/5] items-center justify-center" style={{ background: 'linear-gradient(160deg,#e5e7eb,#cbd5e1)' }}>
            <AnimatePresence mode="wait">
              <motion.span key={i} {...fade} className="flex h-28 w-28 items-center justify-center rounded-full font-heading text-5xl font-extrabold text-white shadow-[0_16px_36px_-16px_rgba(15,23,42,0.6)]" style={{ background: 'var(--ca-primary)' }}>{t.name.charAt(0)}</motion.span>
            </AnimatePresence>
          </div>
          <div className="absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-[0_14px_34px_-18px_rgba(15,23,42,0.5)]">
            <AnimatePresence mode="wait">
              <motion.div key={i} {...fade} className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--ca-primary)' }}>{t.name.charAt(0)}</span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-[color:var(--ca-ink)]">{t.name}</div>
                  <div className="truncate text-xs text-neutral-500">{t.role} · {t.company}</div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* right — charcoal quote shell (static); quote blur-swaps */}
        <div className="relative flex min-h-[280px] flex-col justify-center overflow-hidden rounded-[18px] px-8 py-10 text-white sm:px-10" style={{ background: 'var(--ca-primary)' }}>
          <span aria-hidden className="font-heading text-6xl leading-none" style={{ color: 'var(--ca-accent)' }}>&ldquo;</span>
          <AnimatePresence mode="wait">
            <motion.blockquote key={i} {...fade} className="-mt-3 text-lg leading-relaxed text-white/90">{t.quote}</motion.blockquote>
          </AnimatePresence>
          <div className="mt-6 flex items-center gap-0.5">
            {[0, 1, 2, 3, 4].map((s) => <Star key={s} size={16} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}
          </div>
          <span className="absolute bottom-6 right-8 text-[11px] font-bold uppercase tracking-[0.18em] text-white/40">Meeticulous</span>
        </div>
      </div>

      {/* controls — dots only */}
      <div className="mt-7 flex items-center justify-center gap-1.5">
        {TESTIMONIALS.map((_, d) => (
          <button
            key={d}
            type="button"
            aria-label={`Go to testimonial ${d + 1}`}
            onClick={() => setI(d)}
            className="rounded-full border-0 p-0 transition-all duration-300"
            style={{ height: '8px', minHeight: '8px', width: d === i ? '22px' : '8px', background: d === i ? 'var(--ca-primary)' : 'rgba(15,23,42,0.2)' }}
          />
        ))}
      </div>
    </div>
  );
}

/* Smoothly-animated single-open FAQ accordion, two columns (tabbed feel). */
function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="overflow-hidden rounded-[12px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'rgba(30,41,59,0.35)' : 'rgba(17,17,17,0.08)' }}>
        <button
          type="button"
          onClick={() => setOpen(isOpen ? -1 : i)}
          aria-expanded={isOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-[color:var(--ca-ink)]"
        >
          {f.q}
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-transform duration-300" style={{ backgroundColor: 'rgba(30,41,59,0.1)', color: 'var(--ca-primary)', transform: isOpen ? 'rotate(45deg)' : 'none' }}>
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

export default function BusinessConsultants() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/business-consultant`;
  const seo = {
    title: 'Appointment Booking Software for Consultants & Advisory Firms | Meeticulous',
    description: 'Meeticulous is appointment booking software for business consultants and advisory firms in India. Let clients book advisory calls and paid discovery sessions online — fees collected upfront, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'appointment booking software for consultants, consultant scheduling software india, book advisory call online, management consultant booking page, paid discovery call scheduling, business advisory appointment software',
    ogTitle: 'Make Every Meeting Easier — Booking Software for Consultants',
    ogDescription: 'Let clients book advisory calls, pay upfront over UPI and get WhatsApp reminders — automatically. A professional booking page for consultants & advisory firms in India. Free forever, no card required.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Business & Management Consultants',
    serviceType: 'Appointment booking software for business and management consultants',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Corporate palette — legacy --ca-* var names kept so shared classNames work.
  const styleVars = {
    '--ca-primary': '#1E293B', // slate-800 (AA-safe: white text/links)
    '--ca-accent': '#B45309',  // amber-700 (AA on white ~5.9:1)
    '--ca-ink': '#0F172A',     // slate-900 text
    '--ca-cream': '#F8FAFC',   // slate-50 section bg
    '--ca-grey': '#F1F5F9',    // slate-100 section bg
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
        themeColor="#1E293B"
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · NAV ═══════════════ */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 hover:no-underline" aria-label="Meeticulous — home">
            <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <span className="font-heading text-[15px] font-extrabold tracking-tight text-[color:var(--ca-primary)]">Meeticulous</span>
          </Link>

          <nav className="hidden items-center gap-7 lg:flex">
            {NAV.map((item) => (
              <NavLink key={item.label} item={item} className="text-sm font-medium text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline" />
            ))}
          </nav>

          <div className="hidden items-center gap-4 lg:flex">
            <Link to={LOGIN} className="text-sm font-semibold text-[color:var(--ca-ink)] hover:text-[color:var(--ca-primary)] hover:no-underline">Login</Link>
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
                  <NavLink key={item.label} item={item} onClick={() => setMenuOpen(false)} className="rounded-lg px-2 py-2.5 text-sm font-medium text-[color:var(--ca-ink)] hover:bg-[color:var(--ca-cream)] hover:no-underline" />
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

      {/* ═══════════════ 2 · HERO (split business editorial) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-14 pt-8 sm:px-8 sm:pb-20 sm:pt-14 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(15,23,42,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.035) 1px, transparent 1px)', backgroundSize: '40px 40px', maskImage: 'linear-gradient(180deg, #000, transparent 70%)', WebkitMaskImage: 'linear-gradient(180deg, #000, transparent 70%)' }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 sm:gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          {/* LEFT */}
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="text-[clamp(1.5rem,5vw,2.7rem)] font-semibold leading-[1.1] tracking-[-0.03em] text-[color:var(--ca-ink)] sm:text-[2.7rem] sm:leading-[1.1] lg:text-[3rem]">
              Effortless appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>consultants</span> who sell their expertise.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-neutral-500 sm:mt-7 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for consultants — let clients book advisory calls, pay upfront, and get automatic reminders, so you spend time advising, not chasing calendars.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-6 flex flex-col items-center gap-3 sm:mt-9 sm:flex-row sm:gap-5 lg:justify-start">
              <Link
                to={START}
                className="btn flex w-full items-center justify-center gap-2 rounded-[5px] px-7 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(16,24,40,0.16)] transition-opacity hover:opacity-90 hover:no-underline sm:w-auto"
                style={{ background: 'var(--ca-primary)' }}
              >
                Create a Free Account <ArrowRight size={16} />
              </Link>
              <Link to="/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
                Book A Demo <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:mt-9 lg:justify-start">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-500">
                  <Check size={14} style={{ color: 'var(--ca-accent)' }} /> {t}
                </span>
              ))}
            </Reveal>
          </div>

          {/* RIGHT — illustration + floating glass cards */}
          <Reveal instant delay={0.1} className="relative hidden lg:block">
            <div aria-hidden className="absolute left-1/2 top-1/2 h-[27rem] w-[27rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-[rgba(30,41,59,0.1)] to-[rgba(180,83,9,0.12)] blur-2xl" />
            <img src={HERO_ART} alt="Meeticulous — appointment booking for business and management consultants" loading="eager" className="relative z-30 mx-auto w-full max-w-[27rem] drop-shadow-[0_28px_40px_rgba(15,23,42,0.2)]" />
            <GlassCard icon={CalendarCheck} label="New booking" value="Strategy Call · 4:30 PM" float="sloth-float" className="top-[-26px] -right-[26px]" />
            <GlassCard icon={Wallet} label="Fee received" value="₹5,000" accent float="sloth-float--mid" className="top-[calc(50%-90px)] -left-6" />
            <GlassCard icon={BellRing} label="WhatsApp reminder" value="Sent · 1h before" float="sloth-float--slow" className="bottom-10 -right-2" />
          </Reveal>
        </div>

        {/* Four benefits — compact strip, part of the hero */}
        <div className="mx-auto mt-14 grid max-w-6xl gap-3 sm:mt-16 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 4) * 0.06}>
              <div className="group flex h-full flex-col rounded-[10px] border border-black/[0.06] bg-white p-4 transition-colors hover:border-[color:var(--ca-primary)]/30">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white transition-colors duration-300" style={{ background: 'var(--ca-primary)' }}>
                    <b.icon size={18} />
                  </span>
                  <div className="font-heading text-sm font-bold text-[color:var(--ca-ink)]">{b.title}</div>
                </div>
                <p className="mt-2 text-xs leading-snug text-neutral-500">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 4 · SERVICES (professional service cards) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for <span style={{ color: 'var(--ca-primary)' }}>consultants</span>, built around how you work.
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-neutral-500">
              From strategy calls to coaching and paid discovery sessions, manage every engagement in one place.
            </Reveal>
          </div>
          <div className="mt-16 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 4) * 0.05}>
                <ServiceCard s={s} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · HOW IT WORKS (4-step) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              How Meeticulous helps <span style={{ color: 'var(--ca-primary)' }}>consultants</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">
              From &ldquo;when are you free?&rdquo; to a confirmed, paid advisory call — in four steps.
            </Reveal>
          </div>
          <HowItWorks steps={STEPS} />
        </div>
      </section>

      {/* ═══════════════ 6 · INTEGRATIONS (logo grid) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you already use.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-3 text-base text-neutral-500">
              Connect your calendar, payments and WhatsApp — Meeticulous fits your workflow, no rewiring.
            </Reveal>
          </div>
          <div className="mt-14">
            <IntegrationHub />
          </div>
          <Reveal delay={0.1} className="mt-12 text-center">
            <Link to={START} className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              Explore All Features <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 7 · IMPACT (dashboard-style metrics) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="relative z-10 mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Real impact for <span style={{ color: 'var(--ca-primary)' }}>a modern consulting practice.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-neutral-500">
              A dashboard that does the admin, so you can focus on the advice.
            </Reveal>
          </div>

          {/* dashboard panel */}
          <Reveal delay={0.08} className="mt-12 overflow-hidden rounded-[18px] border border-black/[0.08] bg-white shadow-[0_24px_60px_-34px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between border-b border-black/5 px-6 py-4" style={{ background: 'var(--ca-cream)' }}>
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: 'var(--ca-primary)' }}>BA</span>
                <span className="text-[13px] font-bold text-[color:var(--ca-ink)]">Practice overview</span>
              </div>
              <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold" style={{ background: 'color-mix(in srgb, var(--ca-accent) 14%, transparent)', color: 'var(--ca-accent)' }}>This month</span>
            </div>
            <div className="grid grid-cols-2 gap-px bg-black/[0.06] lg:grid-cols-4">
              {METRICS.map((m) => (
                <div key={m.l} className="bg-white p-6">
                  <div className="font-heading text-4xl font-extrabold tracking-tight sm:text-5xl" style={{ color: 'var(--ca-primary)' }}>{m.v}</div>
                  <div className="mt-2 font-heading text-sm font-bold text-[color:var(--ca-ink)]">{m.l}</div>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">{m.note}</p>
                </div>
              ))}
            </div>
            {/* attached CTA footer — blended into the dashboard panel above */}
            <div className="flex flex-col items-center justify-between gap-5 border-t border-white/10 px-7 py-7 text-white sm:flex-row sm:px-9" style={{ background: 'var(--ca-primary)' }}>
              <div className="text-center sm:text-left">
                <div className="font-heading text-lg font-extrabold sm:text-xl">Ready to fill your calendar with paid calls?</div>
                <p className="mt-1 text-sm text-white/70">Set up your booking page today — free forever, no card required.</p>
              </div>
              <Link to={START} className="inline-flex flex-shrink-0 items-center justify-center gap-2 rounded-[5px] px-6 py-3.5 text-sm font-semibold shadow-lg transition-opacity hover:opacity-90 hover:no-underline" style={{ background: AMBER, color: 'var(--ca-ink)' }}>
                Start for Free <ArrowRight size={16} />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 9 · WHY Meeticulous (alternating text + visual) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl space-y-20 lg:space-y-28">
          {/* row 1 — text left, visual right */}
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="text-center lg:text-left">
              <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Look as professional as your advice.
              </Reveal>
              <Reveal as="p" delay={0.06} className="mt-5 text-base leading-relaxed text-neutral-600">
                A clean, branded booking page tells a prospect you run a serious practice. They pick a slot, pay upfront and receive an automatic confirmation — no chasing, no awkward invoicing after the call.
              </Reveal>
              <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-3 lg:mx-0">
                {['Branded page with your services & fees', 'Upfront payment before every session', 'Automatic GST invoices'].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-neutral-600">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} /> <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Reveal delay={0.08} className="relative mx-auto w-full max-w-md">
              <div aria-hidden className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1E293B]/10 blur-3xl" />
              <img src={ABOUT_ART} alt="" loading="lazy" className="relative z-10 mx-auto w-full max-w-sm object-contain drop-shadow-[0_24px_40px_rgba(15,23,42,0.16)]" />
            </Reveal>
          </div>

          {/* row 2 — visual left, text right */}
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <Reveal delay={0.08} className="relative order-2 mx-auto w-full max-w-md lg:order-1">
              <div aria-hidden className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#B45309]/12 blur-3xl" />
              <img src={HERO_ART} alt="" loading="lazy" className="relative z-10 mx-auto w-full max-w-sm object-contain drop-shadow-[0_24px_40px_rgba(15,23,42,0.16)]" />
            </Reveal>
            <div className="order-1 text-center lg:order-2 lg:text-left">
              <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                Spend your time on clients, not coordination.
              </Reveal>
              <Reveal as="p" delay={0.06} className="mt-5 text-base leading-relaxed text-neutral-600">
                Reminders go out on their own, your calendar stays conflict-free, and every client&apos;s history sits in one dashboard. The admin that used to eat your mornings simply disappears.
              </Reveal>
              <ul className="mx-auto mt-6 flex max-w-sm flex-col gap-3 lg:mx-0">
                {['Automatic WhatsApp & email reminders', 'Conflict-free, calendar-synced availability', 'Client CRM with notes & history'].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-sm text-neutral-600">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} /> <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 10 · TESTIMONIALS (client quote + company identity) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Trusted by <span style={{ color: 'var(--ca-primary)' }}>consultants &amp; advisory firms</span> across India.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-3 text-base text-neutral-500">
              Hear how practices book more paid calls and cut the admin with Meeticulous.
            </Reveal>
          </div>
          <TestimonialSlider />
        </div>
      </section>

      {/* ═══════════════ 11 · DIFFERENCE (comparison table) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The old way vs <span style={{ color: 'var(--ca-primary)' }}>a calmer way to run your practice.</span>
            </Reveal>
          </div>

          <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-[16px] border border-black/[0.08] bg-white shadow-[0_14px_40px_-24px_rgba(15,23,42,0.25)]">
            <div className="grid grid-cols-2 border-b-2" style={{ borderColor: 'var(--ca-primary)' }}>
              <div className="flex items-center gap-2 px-5 py-4 sm:px-6"><X size={16} className="text-[#DC2626]" /><span className="font-heading text-sm font-bold text-neutral-500">The old way</span></div>
              <div className="flex items-center gap-2 border-l border-black/[0.06] px-5 py-4 sm:px-6" style={{ background: 'var(--ca-primary)' }}><Check size={16} style={{ color: AMBER }} /><span className="font-heading text-sm font-bold text-white">With Meeticulous</span></div>
            </div>
            {OLD_WAY.map((o, i) => (
              <Reveal key={o.title} className={`grid grid-cols-2 ${i % 2 ? '' : 'bg-black/[0.015]'}`}>
                <div className="border-t border-black/[0.06] px-5 py-4 sm:px-6">
                  <p className="text-[14px] font-semibold text-neutral-700">{o.title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-neutral-500">{o.desc}</p>
                </div>
                <div className="border-l border-t border-black/[0.06] px-5 py-4 sm:px-6" style={{ background: 'rgba(30,41,59,0.03)' }}>
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--ca-ink)' }}>{NEW_WAY[i]?.title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-neutral-600">{NEW_WAY[i]?.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 13 · PRICING (clean SaaS) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start small. <span style={{ color: 'var(--ca-primary)' }}>Grow as your practice does.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-neutral-500">
              Choose a plan that fits your practice today. Upgrade when you need more.
            </Reveal>
          </div>

          <Reveal delay={0.1} className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>Monthly</button>
            <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: yearly ? 'var(--ca-primary)' : '#d4d4d4', minHeight: 0 }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: yearly ? '22px' : '2px' }} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-[color:var(--ca-ink)]' : 'text-neutral-500'}`}>
              Yearly <span className="ml-1 rounded-full bg-[#1E293B]/12 px-2 py-0.5 text-xs font-bold text-[#1E293B]">Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
            </span>
          </Reveal>

          <div className="relative mx-auto mt-10 max-w-3xl">
            <div className="relative grid gap-5 sm:grid-cols-2 sm:gap-6">
              {/* Sloth (free) */}
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
                        <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <CtaButton to={START} variant="ghost" className="mt-7 w-full">Get Started</CtaButton>
                </div>
              </Reveal>

              {/* Sloth Active (premium) — recommended */}
              <Reveal delay={0.08}>
                <div className="relative flex h-full flex-col overflow-hidden rounded-[18px] border-2 bg-white p-7 shadow-[0_24px_60px_-30px_rgba(16,24,40,0.14)]" style={{ borderColor: 'var(--ca-primary)' }}>
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg, var(--ca-primary), #B45309)' }} />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[color:var(--ca-ink)]" style={{ background: 'color-mix(in srgb, var(--ca-accent) 22%, transparent)' }}>Recommended</span>
                    </div>
                    {yearly && <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: 'var(--ca-accent)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>}
                  </div>
                  <p className="mt-1 text-sm text-neutral-500">Keep every rupee. Automate the rest.</p>
                  <div className="mt-6 flex items-end gap-1">
                    <span className="pb-1.5 text-2xl font-bold" style={{ color: 'var(--ca-primary)' }}>₹</span>
                    <span className="font-heading text-5xl font-extrabold tracking-tight" style={{ color: 'var(--ca-primary)' }}>{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                    <span className="pb-2 text-sm text-neutral-500">/month</span>
                    {yearly && <span className="pb-2 ml-1 text-sm text-neutral-500 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                  </div>
                  <p className="mt-1.5 text-xs font-semibold text-neutral-500">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST included` : 'Billed monthly · GST included'}</p>
                  <ul className="mt-6 flex flex-col gap-3">
                    <li className="flex items-start gap-2.5 text-sm font-semibold" style={{ color: 'var(--ca-ink)' }}>
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
                  <CtaButton to={START} className="mt-7 w-full">Get Started Now</CtaButton>
                </div>
              </Reveal>
            </div>
          </div>

          <Reveal delay={0.12} className="mt-8 flex flex-col items-center gap-2 text-center">
            <span className="flex items-center gap-1.5 text-sm text-neutral-500"><Lock size={14} style={{ color: 'var(--ca-accent)' }} /> Access to all features with no hidden fees</span>
            <Link to="/pricing" className="text-sm font-semibold text-neutral-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">
              Compare every feature on the full pricing page
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 14 · ABOUT (image + overlap card · editorial + trust) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LEFT — framed image + overlapping dark card */}
          <Reveal delay={0.05} className="relative order-2 mx-auto w-full max-w-md lg:order-1 lg:mx-0 lg:max-w-none">
            <div aria-hidden className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1E293B]/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[22px] bg-white shadow-[0_28px_60px_-30px_rgba(15,23,42,0.4)]">
              <img src={ABOUT_ART} alt="Meeticulous — one calm platform for consultants" loading="lazy" className="w-full object-contain" />
            </div>
            <div className="absolute bottom-5 left-5 z-20 max-w-[17rem] rounded-2xl px-5 py-4 text-white shadow-[0_20px_44px_-20px_rgba(15,23,42,0.8)]" style={{ background: 'var(--ca-ink)' }}>
              <div className="font-heading text-lg font-extrabold leading-tight">One calm platform for your whole practice</div>
              <p className="mt-1.5 text-xs leading-relaxed text-white/70">Calendars, payments, WhatsApp and GST invoices — in one place.</p>
            </div>
          </Reveal>

          {/* RIGHT — heading + copy + trust grid + CTA */}
          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Built to make appointment-based practices <span style={{ color: 'var(--ca-primary)' }}>easier to run.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-neutral-600">
              Instead of stitching together calendars, WhatsApp messages, spreadsheets and payment tools, consultants manage every client engagement from one platform — built for the way modern Indian practices actually work.
            </Reveal>

            <Reveal delay={0.12} className="mt-8 grid gap-x-6 gap-y-5 text-left sm:grid-cols-2">
              {[
                { icon: ShieldCheck, title: 'Razorpay', sub: 'Every payment signature-verified on our servers.' },
                { icon: Landmark, title: 'Hosted in India', sub: 'Your practice data runs on servers in Mumbai.' },
                { icon: Lock, title: 'DPDP 2023', sub: "Operated under India's data protection law." },
                { icon: BadgePercent, title: '0% commission', sub: 'On Sloth Active — keep every rupee you earn.' },
              ].map((it) => (
                <div key={it.title} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}>
                    <it.icon size={17} />
                  </span>
                  <div className="min-w-0">
                    <div className="font-heading text-sm font-bold text-[color:var(--ca-ink)]">{it.title}</div>
                    <p className="mt-0.5 text-xs leading-snug text-neutral-500">{it.sub}</p>
                  </div>
                </div>
              ))}
            </Reveal>

            <Reveal delay={0.16} className="mt-9">
              <Link
                to={START}
                className="inline-flex items-center gap-2 rounded-[5px] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(16,24,40,0.16)] transition-opacity hover:opacity-90 hover:no-underline"
                style={{ background: 'var(--ca-primary)' }}
              >
                Start Your Practice on Meeticulous <ArrowRight size={16} />
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 15 · FAQ (tabbed / two-column) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 16 · FINAL CTA (dark business) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-24 text-center sm:px-8" style={{ background: 'radial-gradient(120% 120% at 50% 0%, #334155 0%, #0F172A 60%)' }}>
        <div aria-hidden className="pointer-events-none absolute -top-16 left-1/2 h-56 w-[42rem] -translate-x-1/2 rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(245,158,11,0.16), transparent)' }} />
        <div className="relative mx-auto max-w-2xl">
          <Reveal className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(245,158,11,0.16)' }}>
            <Zap size={26} style={{ color: AMBER }} />
          </Reveal>
          <Reveal as="h2" delay={0.06} className="mt-6 font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
            Spend less time scheduling. <span style={{ color: AMBER }}>Spend more time advising.</span>
          </Reveal>
          <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base text-white/60">
            Set up your booking page today and give your clients a simpler way to work with you.
          </Reveal>
          <Reveal delay={0.14} className="mt-8">
            <Link to={START} className="inline-flex items-center justify-center gap-2 rounded-[5px] px-8 py-4 text-sm font-semibold shadow-[0_10px_30px_-8px_rgba(245,158,11,0.6)] transition-opacity hover:opacity-90 hover:no-underline" style={{ background: AMBER, color: 'var(--ca-ink)' }}>
              Start for Free <ArrowRight size={16} />
            </Link>
          </Reveal>
          <Reveal as="p" delay={0.18} className="mt-4 text-xs text-white/60">No credit card required</Reveal>
        </div>
      </section>

      {/* ═══════════════ 17 · FOOTER ═══════════════ */}
      <footer className="border-t border-black/5 px-5 py-16 sm:px-8" style={{ background: '#ffffff' }}>
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
            <div>
              <div className="font-heading text-lg font-extrabold text-[color:var(--ca-ink)]">Meeticulous</div>
              <p className="mt-2 max-w-xs text-sm text-neutral-500">The simpler way to manage advisory calls.</p>
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
            <p className="text-xs text-neutral-500">Made for India&apos;s consultants &amp; advisory firms</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
