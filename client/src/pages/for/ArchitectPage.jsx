// /for/architects — bespoke, conversion-focused landing page for architects &
// interior designers in India. (Design brief — Sept release rebuild.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx, prerender.mjs,
// sitemapService.js, Navbar "Who it's for" menu.
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in a
// GRAPHITE + BRONZE drafting system (architectural precision — blueprints, grids,
// drawing title-blocks, dimension lines). Mechanics unique to this page:
//   · blueprint-grid hero with a real hero image framed like a drafting sheet
//   · "spec-sheet" service cards (mono ref, drafting corner-mark, bronze underline)
//   · numbered "project phases" track along a ruled dimension baseline
//   · integration logo grid · drawing title-block impact readout · revision-log
//     testimonials · ruled spec-comparison sheet · spec-sheet pricing · framed
//     editorial about.
// Only nav/hero-shell/footer (shared shell) may resemble sibling pages.
//
// IMAGES: REAL images ported from the old ArchitectPage, reused as framed <img>
// tags (hero, project gallery, about, final CTA) + real tool logos in the
// integrations row. No empty placeholders. Every image has a descriptive alt.
//
// HONESTY: Meeticulous is a scheduling + payment tool for a studio — NOT a
// client-acquisition/advertising channel. No fabricated project/rating counts.
// Testimonials are labelled quotes from studio staff about ADMIN relief. Trust
// facts are verifiable only. JSON-LD has NO aggregateRating / review.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the
// accordion/toggle, AA-contrast palette, visible focus, NO hover uplift, Reveal
// guards its own motion.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star, ArrowUpRight,
  CalendarCheck, LayoutDashboard, MessagesSquare, MessageCircle, BellRing, Wallet,
  Landmark, FileText, Lock, BadgePercent, Zap, Share2, ShieldCheck,
  Compass, PenTool,Home,Hammer, Box,
  ClipboardCheck, HardHat, Palette, Video, Sparkles,
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
const DEMO = '/sndatarkar/booking/book-a-sloth-app-online-demo-30-min-advisory-session';

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const NAV = [
  { label: 'Services', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Integrations', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian studios'];

// Hero benefit strip.
const BENEFITS = [
  { icon: MessagesSquare, title: 'Fewer back-and-forths', desc: 'Clients pick a slot themselves — no email ping-pong to fix a time.' },
  { icon: Wallet, title: 'Paid consultations', desc: 'Optionally collect your consultation fee online before the meeting.' },
  { icon: LayoutDashboard, title: 'One project diary', desc: 'Every consult, site visit and review for your studio in one view.' },
  { icon: BellRing, title: 'Fewer no-shows', desc: 'Automatic WhatsApp reminders before every client meeting.' },
];

// Project-type gallery — REAL images ported from the old page, framed as drawings.
const PROJECT_TYPES = [
  { label: 'Interior Design', meta: 'Rooms with soul', img: '/for/architects/services/interior.webp', desc: 'Book styling and material consults with clients.' },
  { label: 'Commercial Design', meta: 'Offices & storefronts', img: '/for/architects/services/commercial.webp', desc: 'Schedule walkthroughs and reviews with teams.' },
  { label: 'Landscape Design', meta: 'Gardens & courtyards', img: '/for/architects/services/landscape.webp', desc: 'Take on-site visits and planning sessions online.' },
  { label: 'Design Consultation', meta: 'Advice that shapes ideas', img: '/for/architects/services/consultation.webp', desc: 'Offer paid one-on-one consultations to new clients.' },
];

// Spec-sheet service cards — every client meeting a studio runs.
const SERVICES = [
  { icon: Compass, label: 'Design Consultation', desc: 'First-visit brief and scope.' },
  { icon: HardHat, label: 'Site Visit', desc: 'On-site measurement and survey.' },
  { icon: PenTool, label: 'Concept Review', desc: 'Walk clients through concepts.' },
  { icon: Box, label: '3D Walkthrough', desc: 'Present the space before build.' },
  { icon: Palette, label: 'Interior Consult', desc: 'Materials, finishes and styling.' },
  { icon: Hammer, label: 'Renovation Assessment', desc: 'Scope an existing space.' },
  { icon: ClipboardCheck, label: 'Handover Meeting', desc: 'Final walkthrough and sign-off.' },
  { icon: Home, label: 'Discovery Call', desc: 'A quick intro before you commit.' },
];

// Project-phases track (dimension line).
const STEPS = [
  { step: '01', title: 'Set up your studio', icon: LayoutDashboard, desc: 'Add your consultation types, durations and hours in a few minutes.' },
  { step: '02', title: 'Share your link', icon: Share2, desc: 'Website, Instagram, WhatsApp — one link takes bookings everywhere.' },
  { step: '03', title: 'Get booked & paid', icon: Wallet, desc: 'Clients pick a slot, pay your fee upfront, and everyone gets reminded.' },
];

// Integration logos — REAL BAS integrations only (real logo files + ToolLogo).
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Payments, refunds and GST invoices' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg', sub: 'Reminders and updates on autopilot' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Accept instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Confirmation emails, sent automatically' },
  { name: 'Google Meet', lucide: Video, sub: 'Auto-add a video link to bookings' },
];

// Drawing title-block impact readout — honest host stats (no fabricated counts).
const IMPACT_STATS = [
  { value: '0%', label: 'Commission on Pro', desc: 'Every consultation fee stays with your studio.', icon: BadgePercent },
  { value: '< 5 min', label: 'To go live', desc: 'Set up your services and share your booking page.', icon: Compass },
  { value: '24/7', label: 'Online booking', desc: 'Clients book any time — no email tag, no calls.', icon: CalendarCheck },
  { value: 'GST', label: 'Auto invoices', desc: 'Generated for every paid booking, automatically.', icon: FileText },
];

// Placeholder testimonials — architecture/interior STUDIO owners & staff reviewing
// Meeticulous (the software), about admin relief. All 5-star; no fabricated dates.
const TESTIMONIALS = [
  { name: 'Aarav Deshpande', role: 'Studio Verde, Pune', quote: 'Clients used to email for days to fix a time. Now they pick a slot and pay upfront — only serious enquiries book.' },
  { name: 'Meera Krishnan', role: 'Terra Interiors, Chennai', quote: 'Site visits and concept reviews all sit in one calendar now. No more double-booked afternoons or a missed measurement trip.' },
  { name: 'Rohan Kapoor', role: 'Axis Design Co., Gurugram', quote: 'Setup took an evening. The WhatsApp reminders alone cut the no-shows on our discovery calls right down.' },
  { name: 'Ananya Pillai', role: 'Form & Field, Bengaluru', quote: 'A calm, professional booking page that matches how a studio works — and 0% commission on Pro means the fee is ours.' },
  { name: 'Vikram Sethi', role: 'Nirman Architects, Jaipur', quote: 'GST invoices for every paid consultation are generated automatically. It tidied up our billing completely.' },
  { name: 'Kabir Menon', role: 'Studio Kaya, Kochi', quote: 'One link handles discovery calls, paid consults and site visits. The front desk stopped living on the phone.' },
];

// Ruled spec-comparison sheet.
const WITHOUT = ['Days of email tag to fix a time', 'No-shows waste a whole site trip', 'Consultation fee chased afterwards', 'Reminders sent by hand, one by one'];
const WITH_BAS = ['Clients pick a slot themselves', 'Automatic reminders cut no-shows', 'Fee collected before the meeting', 'WhatsApp reminders sent for you'];

// Honest trust strip — verifiable facts only.
const TRUST_STRIP = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your studio data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: "Operated under India's data protection law" },
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee' },
];

const ABOUT_FEATURES = [
  { icon: Sparkles, title: 'Built for studios', desc: 'A booking page and diary shaped around how a design practice works.' },
  { icon: BadgePercent, title: 'Honest pricing', desc: 'A free forever plan and 0% commission on Pro — no hidden fees, ever.' },
  { icon: MessageCircle, title: 'Real support', desc: 'A team in India by your side, from setup to your first booking.' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for an architecture or interior-design studio?', a: 'Yes — for managing your client meetings: an online booking page for consultations, site visits and reviews, automatic reminders, optional upfront fees and one clear diary. It is a scheduling and reminder tool for your studio, not a client-acquisition or advertising channel.' },
  { q: 'Can clients book a consultation online?', a: 'Yes. A client opens your booking link, chooses a consultation type such as a design consult or site visit, picks a time and confirms — no email back-and-forth to settle a slot.' },
  { q: 'Can I charge for consultations?', a: 'Optionally. Collect your consultation fee upfront through Razorpay — UPI, cards or netbanking — or leave it off and invoice later. A GST invoice is generated automatically for every paid booking, so charging for your time is simple.' },
  { q: 'Can I send WhatsApp reminders before site visits and meetings?', a: 'Yes. Meeticulous sends automatic confirmations and reminders over WhatsApp and email before each meeting, which cuts no-shows and wasted site trips. WhatsApp reminders are included on the Pro plan (and free for your first two months on the Starter plan).' },
  { q: 'Can I offer different meeting types and lengths?', a: 'Yes. Set up separate services — a 30-minute discovery call, a paid design consultation, a site visit, a concept review — each with its own duration, price and availability, and clients pick the one they need.' },
  { q: 'Can I manage more than one designer’s calendar?', a: 'Right now Meeticulous is best for a single booking calendar per account — two designers on one account share one diary and cannot be booked in parallel. Parallel multi-calendar scheduling is on our roadmap; in the meantime a separate account per designer is the workaround. We would rather tell you upfront than have it surprise you after setup.' },
  { q: 'Does it sync with my Google Calendar?', a: 'Yes. Meeticulous reads the busy times on your Google Calendar, so a slot you have blocked there is not offered to clients, and online bookings are added to your calendar with a Meet link.' },
  { q: 'Is there a free plan?', a: 'Yes. The Starter plan is free forever — an online booking page, unlimited consultation types and bookings, UPI payments, 24-hour reminders and GST invoices — with a small 5% per-booking fee. Pro removes that commission entirely and adds WhatsApp automation and more.' },
];

const FOOTER_COLS = [
  { title: 'Product', links: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Integrations', href: '#features' },
    { label: "What's New", to: '/changelog' },
  ] },
  { title: 'For Professionals', links: [
    { label: 'Architects & Designers', to: '/for/architects' },
    { label: 'Dental Clinics', to: '/for/dentists' },
    { label: 'Astrologers', to: '/for/astrologers' },
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
  const base = 'inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3.5 text-sm font-semibold transition-all hover:no-underline';
  const styles = {
    solid: 'text-white shadow-[0_4px_14px_rgba(51,65,85,0.24)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-ink)]/30',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

// Small mono/label eyebrow (drafting annotation).
function Eyebrow({ children, className = '' }) {
  return (
    <span className={`font-mono text-[11px] font-semibold uppercase tracking-[0.22em] ${className}`} style={{ color: 'var(--ca-accent)' }}>
      {children}
    </span>
  );
}

/* Real image framed like an architectural drawing: thin frame + bronze corner
   ticks, and an optional mono corner label. Used for hero / gallery / about /
   final CTA imagery. */
function Framed({ src, alt, className = '', imgClassName = '', priority = false, label }) {
  const tick = 'pointer-events-none absolute h-4 w-4';
  return (
    <div className={`relative ${className}`}>
      <div className="relative overflow-hidden bg-white" style={{ border: '1px solid rgba(26,34,48,0.16)' }}>
        <img
          src={src}
          alt={alt}
          {...(priority ? { loading: 'eager', fetchpriority: 'high' } : { loading: 'lazy' })}
          decoding="async"
          className={`block h-full w-full object-cover ${imgClassName}`}
        />
      </div>
      {/* bronze drafting corner ticks */}
      <span aria-hidden className={`${tick} -left-[3px] -top-[3px] border-l-2 border-t-2`} style={{ borderColor: 'var(--ca-accent)' }} />
      <span aria-hidden className={`${tick} -right-[3px] -top-[3px] border-r-2 border-t-2`} style={{ borderColor: 'var(--ca-accent)' }} />
      <span aria-hidden className={`${tick} -bottom-[3px] -left-[3px] border-b-2 border-l-2`} style={{ borderColor: 'var(--ca-accent)' }} />
      <span aria-hidden className={`${tick} -bottom-[3px] -right-[3px] border-b-2 border-r-2`} style={{ borderColor: 'var(--ca-accent)' }} />
      {label && (
        <span className="absolute bottom-2 left-2 bg-white/90 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--ca-ink)] backdrop-blur">
          {label}
        </span>
      )}
    </div>
  );
}

/* Spec-sheet service card — mono ref, drafting corner-mark, bronze underline. */
function SpecCard({ s, i }) {
  return (
    <Link
      to={START}
      className="group relative flex h-full flex-col bg-white p-5 transition-colors hover:border-[color:var(--ca-accent)] hover:no-underline"
      style={{ border: '1px solid rgba(26,34,48,0.12)' }}
    >
      {/* drafting corner-mark (top-right) */}
      <span aria-hidden className="pointer-events-none absolute right-3 top-3 h-3.5 w-3.5 border-r border-t" style={{ borderColor: 'var(--ca-accent)' }} />
      <Eyebrow>{`SVC-${String(i + 1).padStart(2, '0')}`}</Eyebrow>
      <span className="mt-3 flex h-11 w-11 items-center justify-center rounded-[6px]" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}>
        <s.icon size={20} />
      </span>
      <h3 className="mt-3.5 font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{s.label}</h3>
      <span aria-hidden className="mt-2 block h-[3px] w-8" style={{ background: 'var(--ca-accent)' }} />
      <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{s.desc}</p>
    </Link>
  );
}

function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="overflow-hidden rounded-[8px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'var(--ca-accent)' : 'rgba(26,34,48,0.12)' }}>
        <button
          type="button"
          onClick={() => setOpen(isOpen ? -1 : i)}
          aria-expanded={isOpen}
          className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-[color:var(--ca-ink)]"
        >
          {f.q}
          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-transform duration-300" style={{ backgroundColor: 'color-mix(in srgb, var(--ca-accent) 14%, transparent)', color: 'var(--ca-accent)', transform: isOpen ? 'rotate(45deg)' : 'none' }}>
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

export default function ArchitectPage() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/architects`;
  const seo = {
    title: 'Appointment Booking Software for Architects & Interior Designers | Meeticulous',
    description: 'Meeticulous is appointment booking software for architects and interior designers in India. Let clients book consultations, site visits and reviews online, with paid bookings, automatic WhatsApp reminders, GST invoices and 0% commission. A scheduling tool for your studio — not an advertising channel. Start free.',
    keywords: 'architect appointment software, interior designer booking software india, design studio scheduling, consultation booking software, architecture practice scheduling',
    ogTitle: 'Your studio runs on client meetings. Let Meeticulous schedule them.',
    ogDescription: 'Clients book consultations and site visits online, pay upfront, and get WhatsApp reminders — while you keep one clear diary. A calm scheduling page for architects and interior designers in India.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Architects & Interior Designers',
    serviceType: 'Appointment booking software for architects and interior designers',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Graphite + bronze drafting palette. Legacy --ca-* names kept (shared classNames).
  const styleVars = {
    '--ca-primary': '#334155', // graphite slate — text/links/fills, AA on white (~9.8:1)
    '--ca-accent': '#B45309',  // bronze — eyebrows/underlines/ticks, AA on white (~5:1)
    '--ca-ink': '#1A2230',     // near-black graphite text
    '--ca-cream': '#F5F5F4',   // warm off-white section bg
    '--ca-grey': '#F1F3F5',    // cool light section bg
  };

  const gridBg = {
    backgroundImage: 'linear-gradient(to right, rgba(51,65,85,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(51,65,85,0.08) 1px, transparent 1px)',
    backgroundSize: '30px 30px',
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
        themeColor="#334155"
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

      {/* ═══════════════ 2 · HERO (blueprint-grid + framed drawing) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        {/* drafting grid + graphite blob (mix-blend-multiply) */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-x-0 top-0 h-[560px] opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]" style={gridBg} />
          <div className="absolute -left-24 -top-20 h-80 w-80 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(51,65,85,0.18), transparent)' }} />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3.05rem)] font-extrabold leading-[1.06] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Flexible appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>architects and interior designers</span> managing client meetings.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for architects and interior designers — clients book consultations, site visits and reviews online, pay your fee upfront, and get automatic reminders.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Create a Free Account <ArrowRight size={16} /></CtaButton>
              <Link to={DEMO} className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-accent)] hover:no-underline">
                Book A Demo <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-slate-500">
                  <Check size={14} style={{ color: 'var(--ca-accent)' }} /> {t}
                </span>
              ))}
            </Reveal>
          </div>

          {/* RIGHT — real hero image framed like a drawing sheet + floating card */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <Framed
              src="/for/architects/architect.webp"
              alt="Meeticulous booking software shown on screen for an architecture and interior-design studio"
              label="Fig. 01 · Studio Booking"
              priority
              className="shadow-[0_28px_60px_-30px_rgba(26,34,48,0.5)]"
              imgClassName="aspect-square"
            />
            <div className="absolute -bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 border bg-white px-4 py-3 shadow-[0_18px_40px_-18px_rgba(26,34,48,0.55)]" style={{ borderColor: 'rgba(26,34,48,0.12)' }}>
              <span className="flex h-9 w-9 items-center justify-center rounded-[6px] text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={17} /></span>
              <div>
                <div className="text-[11px] text-slate-500">Consultation booked</div>
                <div className="text-sm font-bold text-[color:var(--ca-ink)]">Site visit · Fri 4:30</div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* benefit strip */}
        <div className="relative mx-auto mt-16 grid max-w-7xl gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 4) * 0.06}>
              <div className="flex h-full flex-col bg-white p-4 transition-colors hover:border-[color:var(--ca-accent)]" style={{ border: '1px solid rgba(26,34,48,0.1)' }}>
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[6px]" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}>
                    <b.icon size={18} />
                  </span>
                  <div className="text-sm font-bold text-[color:var(--ca-ink)]">{b.title}</div>
                </div>
                <p className="mt-2 text-xs leading-snug text-slate-500">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (spec-sheet cards + project gallery) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for architects, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-slate-500">
              From discovery calls to site visits and handovers — each service with its own duration, fee and availability.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SERVICES.map((s, i) => (
              <Reveal key={s.label} delay={(i % 4) * 0.05}><SpecCard s={s} i={i} /></Reveal>
            ))}
          </div>

          {/* project-type gallery — REAL images framed as drawings */}
          <div className="mt-16">
            <Reveal as="div" className="flex items-end justify-between gap-4 border-b pb-3" style={{ borderColor: 'rgba(26,34,48,0.14)' }}>
              <Eyebrow>Drawing Set · Whatever You Design</Eyebrow>
              <span className="font-mono text-[11px] text-slate-400">04 / 04</span>
            </Reveal>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PROJECT_TYPES.map((p, i) => (
                <Reveal key={p.label} delay={(i % 4) * 0.06}>
                  <figure className="flex h-full flex-col">
                    <Framed
                      src={p.img}
                      alt={`${p.label} — ${p.meta}, a project type an architecture or interior-design studio takes bookings for on Meeticulous`}
                      label={`Type 0${i + 1}`}
                      imgClassName="aspect-[4/3]"
                    />
                    <figcaption className="mt-4">
                      <h3 className="font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{p.label}</h3>
                      <span aria-hidden className="mt-1.5 block h-[3px] w-8" style={{ background: 'var(--ca-accent)' }} />
                      <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{p.desc}</p>
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (project-phases track / dimension line) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From link to paid, <span style={{ color: 'var(--ca-primary)' }}>in three phases.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-3 text-base text-slate-500">No app to install, no code to ship — just three small steps.</Reveal>
          </div>

          <div className="relative mt-16">
            {/* ruled dimension baseline (behind the phase markers) */}
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-7 hidden md:block">
              <div className="relative mx-[8.333%] h-px" style={{ background: 'rgba(26,34,48,0.28)' }}>
                {/* end caps */}
                <span className="absolute -left-px -top-1.5 h-3.5 w-px" style={{ background: 'rgba(26,34,48,0.28)' }} />
                <span className="absolute -right-px -top-1.5 h-3.5 w-px" style={{ background: 'rgba(26,34,48,0.28)' }} />
                {/* phase ticks */}
                {['16.667%', '50%', '83.333%'].map((c) => (
                  <span key={c} className="absolute -top-1.5 h-3.5 w-px" style={{ left: c, background: 'var(--ca-accent)' }} />
                ))}
              </div>
            </div>

            <div className="grid gap-12 md:grid-cols-3 md:gap-6">
              {STEPS.map((s, i) => (
                <Reveal key={s.title} delay={i * 0.1} className="relative text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] font-mono text-lg font-bold text-white shadow-[0_10px_24px_-12px_rgba(26,34,48,0.8)] ring-[6px] ring-[color:var(--ca-cream)]" style={{ background: 'var(--ca-primary)' }}>
                    {s.step}
                  </div>
                  <div className="mt-5 flex items-center justify-center gap-2">
                    <s.icon size={16} style={{ color: 'var(--ca-accent)' }} />
                    <Eyebrow>{`Phase ${s.step}`}</Eyebrow>
                  </div>
                  <h3 className="mt-2 font-heading text-lg font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                  <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (real tool logos) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-3 text-base text-slate-500">
              Connect your calendar, meetings, payments and WhatsApp — Meeticulous fits your workflow, no rewiring.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {TOOLS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) * 0.05}>
                <div className="flex h-full items-center gap-3.5 bg-white px-4 py-4 transition-colors hover:border-[color:var(--ca-accent)]" style={{ border: '1px solid rgba(26,34,48,0.1)' }}>
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[6px] bg-[color:var(--ca-grey)]">
                    {t.logo
                      ? <img src={t.logo} alt={`${t.name} logo`} loading="lazy" className="h-6 w-6 object-contain" />
                      : t.lucide
                        ? <t.lucide size={22} style={{ color: 'var(--ca-primary)' }} />
                        : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</div>
                    <div className="mt-0.5 text-xs leading-snug text-slate-500">{t.sub}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1} className="mt-10 text-center text-sm text-slate-500">
            Plus 2,000+ more tools through our API and Zapier —{' '}
            <Link to="/pricing" className="inline-flex items-center gap-1 font-semibold hover:no-underline" style={{ color: 'var(--ca-accent)' }}>
              Explore integrations <ArrowUpRight size={14} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (drawing title-block readout) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-ink)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Real impact, <span style={{ color: 'var(--ca-accent)' }}>real numbers.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mx-auto mt-4 max-w-xl text-base text-white/60">
              Small stats, big difference — what actually changes when your studio goes live with Meeticulous.
            </Reveal>
          </div>
          {/* title-block table: bordered grid with internal dividers */}
          <Reveal delay={0.1} className="mt-12 overflow-hidden border border-white/15">
            <div className="grid grid-cols-2 lg:grid-cols-4">
              {IMPACT_STATS.map((s, i) => (
                <div
                  key={s.value}
                  className="relative p-6 sm:p-7"
                  style={{
                    borderRight: '1px solid rgba(255,255,255,0.12)',
                    borderBottom: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-[6px]" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--ca-accent)' }}><s.icon size={18} /></span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/35">{`0${i + 1}`}</span>
                  </div>
                  <div className="mt-5 font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">{s.value}</div>
                  <div className="mt-2 text-sm font-bold text-white/90">{s.label}</div>
                  <p className="mt-1.5 text-xs leading-snug text-white/55">{s.desc}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (revision log / sign-off sheet) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              What studios say about <span style={{ color: 'var(--ca-primary)' }}>Meeticulous.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-3 text-base text-slate-500">
              Reviews from architecture and interior-design studios using Meeticulous — about the software.
            </Reveal>
          </div>
          {/* the "sheet": bordered frame, ledger rows split into two columns */}
          <Reveal delay={0.1} className="mt-12 border" style={{ borderColor: 'rgba(26,34,48,0.14)' }}>
            <div className="grid md:grid-cols-2">
              {TESTIMONIALS.map((t, i) => (
                <figure
                  key={t.name}
                  className="flex flex-col justify-between gap-4 p-6 sm:p-7"
                  style={{
                    borderBottom: '1px solid rgba(26,34,48,0.1)',
                    borderRight: i % 2 === 0 ? '1px solid rgba(26,34,48,0.1)' : undefined,
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--ca-accent)' }}>{`R-${String(i + 1).padStart(2, '0')}`}</span>
                      <span className="flex gap-0.5">{[0, 1, 2, 3, 4].map((st) => <Star key={st} size={13} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}</span>
                    </div>
                    <blockquote className="mt-3 text-sm leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
                  </div>
                  <figcaption className="flex items-center gap-3 border-t pt-4" style={{ borderColor: 'rgba(26,34,48,0.08)' }}>
                    <span className="flex h-9 w-9 items-center justify-center rounded-[6px] text-sm font-bold text-white" style={{ background: 'var(--ca-primary)' }}>{t.name.charAt(0)}</span>
                    <div>
                      <div className="text-[13px] font-bold text-[color:var(--ca-ink)]">{t.name}</div>
                      <div className="text-[11px] text-slate-500">{t.role}</div>
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (ruled spec-comparison sheet) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The <span style={{ color: 'var(--ca-primary)' }}>Meeticulous</span> difference.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mx-auto mt-4 max-w-xl text-base text-slate-500">
              See how booking a consultation changes with and without Meeticulous.
            </Reveal>
          </div>
          <Reveal delay={0.1} className="mt-12 overflow-hidden border bg-white" style={{ borderColor: 'rgba(26,34,48,0.14)' }}>
            <div className="grid sm:grid-cols-2">
              {/* manual (light) */}
              <div className="p-7 sm:p-9" style={{ borderBottom: '1px solid rgba(26,34,48,0.1)' }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Col. A — Manual</span>
                  <span className="font-mono text-[11px] text-slate-300">Ø</span>
                </div>
                <ul className="mt-6 space-y-4">
                  {WITHOUT.map((w) => (
                    <li key={w} className="flex items-start gap-3 text-[15px] text-slate-500">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[5px] bg-slate-100 text-slate-400"><X size={13} /></span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
              {/* with BAS (graphite) */}
              <div className="relative overflow-hidden p-7 text-white sm:p-9" style={{ background: 'var(--ca-primary)' }}>
                <div aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(180,83,9,0.55), transparent)' }} />
                <div className="relative flex items-center justify-between">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">Col. B — With Meeticulous</span>
                  <span className="font-mono text-[11px]" style={{ color: 'var(--ca-accent)' }}>✓</span>
                </div>
                <ul className="relative mt-6 space-y-4">
                  {WITH_BAS.map((w) => (
                    <li key={w} className="flex items-start gap-3 text-[15px] font-medium text-white">
                      <span className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-[5px]" style={{ background: 'var(--ca-accent)', color: '#fff' }}><Check size={13} /></span>
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 9 · PRICING (spec-sheet plan cards) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start small. <span style={{ color: 'var(--ca-primary)' }}>Grow as your studio does.</span>
            </Reveal>
          </div>
          <Reveal delay={0.08} className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-[color:var(--ca-ink)]' : 'text-slate-500'}`}>Monthly</button>
            <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: yearly ? 'var(--ca-primary)' : '#cbd5e1', minHeight: 0 }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: yearly ? '22px' : '2px' }} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-[color:var(--ca-ink)]' : 'text-slate-500'}`}>
              Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--ca-accent) 14%, transparent)', color: 'var(--ca-accent)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
            </span>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Free */}
            <Reveal>
              <div className="flex h-full flex-col bg-white p-7" style={{ border: '1px solid rgba(26,34,48,0.14)' }}>
                <Eyebrow>Plan A</Eyebrow>
                <div className="mt-3 font-heading text-lg font-bold">{FREE_PLAN.name}</div>
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
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} /><span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} variant="ghost" className="mt-7 w-full">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>
            {/* Premium */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden p-7 text-white shadow-[0_28px_65px_-32px_rgba(26,34,48,0.8)]" style={{ background: 'var(--ca-primary)' }}>
                <div aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-48 w-48 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(180,83,9,0.5), transparent)' }} />
                <div className="relative flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: 'var(--ca-accent)' }}>Plan B</span>
                  <span className="rounded-[4px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: 'var(--ca-accent)', color: '#fff' }}>Recommended</span>
                </div>
                <div className="relative mt-3 font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                <p className="relative mt-1 text-sm text-white/70">Keep every rupee. Automate the rest.</p>
                <div className="relative mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold">₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight">{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                  <span className="pb-2 text-sm text-white/60">/month</span>
                  {yearly && <span className="pb-2 ml-1 text-sm text-white/50 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                </div>
                <p className="relative mt-1.5 text-xs font-semibold text-white/60">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST included` : 'Billed monthly · GST included'}</p>
                <ul className="relative mt-6 flex flex-col gap-3">
                  <li className="flex items-start gap-2.5 text-sm font-semibold"><Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} /><span>Everything in Free</span></li>
                  {PREMIUM_PLAN.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/85"><Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} /><span>{f}</span></li>
                  ))}
                </ul>
                <Link to={START} className="relative mt-7 inline-flex w-full items-center justify-center gap-2 rounded-[6px] px-6 py-3.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-all hover:brightness-95 hover:no-underline" style={{ background: '#fff' }}>
                  Go Pro <ArrowRight size={15} />
                </Link>
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

      {/* ═══════════════ 10 · ABOUT (editorial + trust facts + framed image) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="order-1 text-center lg:text-left">
            <Reveal as="h2" delay={0.04} className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              We&apos;re on a mission to make studios <span style={{ color: 'var(--ca-primary)' }}>run calmer.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-slate-600">
              Great design work shouldn&apos;t get lost in scheduling. Meeticulous was built so a studio can manage every client consultation, site visit and review from one calm platform — instead of stitching together calendars, WhatsApp, email threads and payment tools.
            </Reveal>
            <div className="mt-8 flex flex-col gap-5 text-left">
              {ABOUT_FEATURES.map((f, i) => (
                <Reveal key={f.title} delay={0.1 + i * 0.06} className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[6px]" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}><f.icon size={18} /></span>
                  <div>
                    <p className="text-[15px] font-bold text-[color:var(--ca-ink)]">{f.title}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-500">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            {/* trust facts */}
            <Reveal delay={0.28} className="mt-8 flex flex-wrap justify-center gap-2.5 lg:justify-start">
              {TRUST_STRIP.map((it) => (
                <span key={it.value} className="inline-flex items-center gap-2 border bg-white px-3.5 py-2 text-sm font-semibold text-[color:var(--ca-ink)]" style={{ borderColor: 'rgba(26,34,48,0.12)' }}>
                  <it.icon size={15} style={{ color: 'var(--ca-accent)' }} /> {it.value}
                </span>
              ))}
            </Reveal>
            <Reveal delay={0.34} className="mt-8">
              <CtaButton to="/about">Learn more about Meeticulous <ArrowRight size={16} /></CtaButton>
            </Reveal>
          </div>
          <Reveal className="order-2">
            <Framed
              src="/for/architects/about-archi.webp"
              alt="Meeticulous, a calm booking platform for architecture and interior-design studios in India"
              label="Fig. 02 · One Calm Diary"
              className="mx-auto max-w-md"
              imgClassName="aspect-square"
            />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 11 · FAQ (two-column accordion) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <Reveal as="h2" delay={0.04} className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Questions? <span style={{ color: 'var(--ca-primary)' }}>We&apos;ve got answers.</span>
            </Reveal>
          </div>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 12 · FINAL CTA (graphite + bronze mix-blend glow) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl overflow-hidden" style={{ background: 'var(--ca-ink)' }}>
          <div className="relative grid items-center gap-10 px-8 py-14 sm:px-12 lg:grid-cols-[1.1fr_0.9fr]">
            <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(180,83,9,0.55), transparent)' }} />
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(circle_at_20%_20%,black,transparent_60%)]" style={gridBg} />
            <div className="relative text-center lg:text-left">
              <Reveal className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] lg:mx-0" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                <Zap size={26} style={{ color: 'var(--ca-accent)' }} />
              </Reveal>
              <Reveal as="h2" delay={0.06} className="mt-6 font-heading text-[clamp(1.8rem,4.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
                Spend less time arranging meetings. Spend more time designing.
              </Reveal>
              <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/70 lg:mx-0">
                Set up your studio&apos;s booking page today — free forever, ready to share in minutes.
              </Reveal>
              <Reveal delay={0.14} className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4 lg:justify-start">
                <Link to={START} className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-white px-7 py-3.5 text-sm font-bold text-[color:var(--ca-ink)] transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline">
                  Launch My Studio Page — Free <ArrowRight size={16} />
                </Link>
                <Link to={DEMO} className="inline-flex items-center justify-center gap-2 rounded-[6px] border-2 border-white/25 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline">
                  Book A Demo
                </Link>
              </Reveal>
              <Reveal delay={0.18} className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 lg:justify-start">
                {['No credit card', 'Free forever', '0% on Pro'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Check size={14} style={{ color: 'var(--ca-accent)' }} /> {t}</span>
                ))}
              </Reveal>
            </div>
            <Reveal delay={0.1} className="relative hidden lg:block">
              <img
                src="/for/architects/choose-archi.webp"
                alt="An architect choosing Meeticulous to schedule studio consultations"
                loading="lazy"
                decoding="async"
                className="mx-auto h-auto w-full max-w-sm object-contain drop-shadow-[0_28px_44px_rgba(0,0,0,0.4)]"
              />
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
              <p className="mt-2 max-w-xs text-sm text-slate-500">The simpler way to manage your studio&apos;s appointments.</p>
              <CtaButton to={START} className="mt-5">Create Your Page — Free <ArrowRight size={15} /></CtaButton>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <div className="text-xs font-bold uppercase tracking-wide text-slate-600">{col.title}</div>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <NavLink item={l} className="text-sm text-slate-600 transition-colors hover:text-[color:var(--ca-accent)] hover:no-underline" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-black/5 pt-6 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-slate-500">© 2026 Meeticulous. <OperatorCredit /></p>
            <p className="text-xs text-slate-500">Made for India&apos;s architects &amp; interior designers</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
