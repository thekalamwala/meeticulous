// /for/chartered-accountants — bespoke, conversion-focused landing page for
// Chartered Accountants & CA firms in India. (Sept release rebuild.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx, prerender.mjs,
// sitemapService.js, Navbar "Who it's for" menu — the main thread wires those.
//
// Section ORDER follows the CA spec; every content section is its OWN design in a
// TRUSTED-FINANCE system — deep navy + gold, ledgers, ruled hairlines, precise
// numerals. Signature mechanics unique to this page: framed hero image with a
// navy mix-blend-multiply blob + floating GST/fees stat cards · a "ledger
// line-items" services list (account entries, hairline rules, no cards) · a
// balance-sheet impact block (two aligned columns of navy numerals + gold labels).
// Remaining sections (statement steps · integration logo grid · reconciliation
// comparison table · editorial testimonials · two-card pricing · split about ·
// FAQ · navy+gold CTA) are all fresh, none on the shared forbidden-mechanics list.
// Only nav / hero shell chrome / footer may resemble sibling pages.
//
// IMAGES: real tool logos only — every logo path is mined verbatim from the
// previous version. Hero + about use icon art (mascot illustrations removed).
//
// HONESTY: Meeticulous is a scheduling + PAYMENT tool, NOT tax/financial advice or
// an accounting system. No tax-outcome claims. Testimonials are labelled placeholder
// quotes from CA-firm STAFF about ADMIN relief (booking, no-shows, fee collection).
// Trust facts are verifiable only. JSON-LD carries NO self-serving rating markup.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on the mobile
// menu / accordion / pricing toggle, AA-contrast navy+gold palette, visible focus,
// NO hover uplift (shadow/border/tint only), Reveal guards its own motion.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star,
  Calculator, Landmark, Receipt, FileText, LineChart, Briefcase,
  Users, ClipboardCheck, Building2, Folder, Scale, Video,
  LayoutDashboard, CalendarCheck, BellRing,
  MessageCircle, Clock3, IndianRupee,
  Lock, ShieldCheck, BadgePercent, Zap,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import { Calculator as CalculatorArt } from 'lucide-react';
import Seo from '../../components/common/Seo';
import useLenis from '../../hooks/useLenis';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import {
  FREE_PLAN, PREMIUM_PLAN,
  PREMIUM_ANNUAL_SAVE_PCT,
} from '../../data/plans';
import ToolLogo from './toolLogos';
import razorpayLogo from '../enterprise-v2/assets/logo/razorpay.png';
import outlookLogo from '../enterprise-v2/assets/logo/outlook.svg';
import OperatorCredit from '../../components/common/OperatorCredit';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';      // real host signup funnel
const LOGIN = '/login-as-vendor'; // host login (Google-only door)
const ART_ICON = CalculatorArt; // stands in for the removed mascot art

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const NAV = [
  { label: 'Services', href: '#usecases' },
  { label: 'How It Works', href: '#how' },
  { label: 'Integrations', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
];

const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian businesses'];

// SERVICES — rendered as a two-page ledger of account entries (not cards).
const LEDGER = [
  {
    group: 'Advisory & consultations',
    items: [
      { icon: FileText, label: 'Tax Consultation', desc: 'Plan and file with confidence.' },
      { icon: Receipt, label: 'GST Consultation', desc: 'Registration, returns and advice.' },
      { icon: LineChart, label: 'Financial Advisory', desc: 'Grow and protect your wealth.' },
      { icon: Briefcase, label: 'Business Advisory', desc: 'Strategy for your next stage.' },
      { icon: Landmark, label: 'Investment Consultation', desc: 'Make your money work harder.' },
      { icon: Users, label: 'Client Review Meetings', desc: 'Regular check-ins that matter.' },
    ],
  },
  {
    group: 'Filing, audit & compliance',
    items: [
      { icon: Calculator, label: 'Income Tax Filing', desc: 'Returns filed accurately, on time.' },
      { icon: ClipboardCheck, label: 'Audit Meetings', desc: 'Statutory and internal audits.' },
      { icon: Building2, label: 'Company Registration', desc: 'Incorporate your business right.' },
      { icon: Folder, label: 'Accounting Consultation', desc: 'Books, ledgers and reporting.' },
      { icon: Scale, label: 'Compliance Consultation', desc: 'Stay compliant, avoid penalties.' },
      { icon: Video, label: 'Virtual Consultation', desc: 'Meet online, from anywhere.' },
    ],
  },
];

// STEPS — 3 statement-style panels (copy mined verbatim).
const STEPS = [
  { n: '01', icon: LayoutDashboard, title: 'Create & share your page', desc: 'Set up your practice, services and availability, then share your booking link anywhere.' },
  { n: '02', icon: CalendarCheck, title: 'Clients book & pay', desc: 'Clients pick a service and a time, and pay upfront — no calls, no back-and-forth.' },
  { n: '03', icon: BellRing, title: 'Everyone gets reminded', desc: 'You and your client get automatic confirmations and WhatsApp reminders.' },
];

// INTEGRATIONS — REAL BAS integrations only, shown as a logo grid (not a hub/marquee/chips).
const TOOLS = [
  { name: 'Google Calendar', icon: 'google-calendar', sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'Google Meet', logo: '/images/logos/google-meet.svg', sub: 'Auto-add a video link to every booking' },
  { name: 'Zoom', logo: '/images/logos/zoom.ico', sub: 'Share meeting links automatically' },
  { name: 'Outlook', logo: outlookLogo, sub: 'Sync bookings to your Outlook calendar' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Payments, refunds and GST invoices' },
  { name: 'PhonePe', logo: '/images/logos/phonepe.svg', sub: 'Accept instant UPI payments' },
  { name: 'Gmail', logo: '/images/logos/gmail.svg', sub: 'Reminder emails, sent automatically' },
  { name: 'WhatsApp', logo: '/images/logos/whatsapp.svg', sub: 'Reminders and updates on autopilot' },
  { name: 'Client CRM', logo: '/favicon.svg', sub: 'Every client, note and history in one place' },
];

// IMPACT — a balance sheet. Numerals stay navy, labels stay gold, rules hairline.
const BALANCE = {
  left: {
    title: 'What you stop losing',
    rows: [
      { fig: '0%', label: 'Commission on Pro' },
      { fig: '₹0', label: 'To get started — free forever' },
      { fig: 'Zero', label: 'Double bookings or clashes' },
    ],
  },
  right: {
    title: 'What you gain',
    rows: [
      { fig: '24/7', label: 'Client bookings, day or night' },
      { fig: 'GST', label: 'Invoices raised automatically' },
      { fig: '100%', label: 'Of every fee stays yours' },
    ],
  },
};

// Placeholder testimonials — CA-firm STAFF about ADMIN relief, never tax outcomes.
const TESTIMONIALS = [
  { quote: 'Meeticulous ended the endless WhatsApp back-and-forth for booking client consultations — clients now book tax and GST appointments online in seconds.', name: 'CA Rajesh Menon', role: 'Chartered Accountant, Mumbai' },
  { quote: 'Automatic WhatsApp reminders cut our no-shows sharply. The whole practice now runs on one appointment booking platform.', name: 'CA Priya Nair', role: 'Partner, Nair & Associates, Kochi' },
  { quote: 'Collecting consultation fees upfront through Razorpay, with GST invoices generated automatically, transformed our cash flow.', name: 'CA Arjun Shah', role: 'Firm Partner, Ahmedabad' },
  { quote: 'Clients schedule income-tax filing appointments without waiting for the office to reply. Setup took minutes, not weeks.', name: 'CA Sneha Iyer', role: 'Chartered Accountant, Bengaluru' },
  { quote: 'From booking to payment to follow-up, Meeticulous handles the admin so our team can focus on advisory work.', name: 'CA Vikram Desai', role: 'Managing Partner, Pune' },
  { quote: 'A professional booking page our clients love, with 0% commission on Pro — the admin side of the practice finally runs itself.', name: 'CA Ananya Gupta', role: 'Gupta & Co., New Delhi' },
];

// COMPARISON — a reconciliation table (manual way vs Meeticulous), copy mined from old page.
const RECONCILE = [
  { topic: 'Booking', icon: MessageCircle, old: 'Endless WhatsApp back-and-forth to find a slot', now: 'One shareable booking link, self-serve 24/7' },
  { topic: 'No-shows', icon: Clock3, old: 'Missed calls and wasted hours in filing season', now: 'Automatic WhatsApp reminders cut no-shows' },
  { topic: 'Payment', icon: IndianRupee, old: 'Chasing consultation fees days after the advice', now: 'Fees collected upfront over UPI or card' },
  { topic: 'Records', icon: Folder, old: 'Client details scattered across email and chat', now: 'Every client, note and booking in one place' },
  { topic: 'Scheduling', icon: CalendarCheck, old: 'Double bookings slip through at deadlines', now: 'Conflict-free calendar, always accurate' },
];

// Trust facts — verifiable only (Razorpay signatures, Mumbai hosting, DPDP 2023, 0% on Pro).
const TRUST = [
  { icon: Lock, value: 'Razorpay', label: 'Every payment signature-verified on our servers' },
  { icon: Landmark, value: 'Hosted in India', label: 'Your practice data runs on servers in Mumbai' },
  { icon: ShieldCheck, value: 'DPDP 2023', label: 'Operated under India’s data protection law' },
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for CA firms?', a: 'Yes. Whether you are an individual Chartered Accountant or a firm with a team, Meeticulous manages your appointments, services, availability, client bookings and communication from one place — so both solo CAs and larger practices can run client meetings without the manual coordination. It is a scheduling and payment tool, not an accounting or tax-advice system.' },
  { q: 'Can clients book appointments online?', a: 'Yes. Clients open your booking link, choose a service such as a tax or GST consultation, pick a convenient time slot and confirm — no calls or waiting for a reply from your office.' },
  { q: 'Can I share my booking link on WhatsApp?', a: 'Yes. Your booking link works anywhere — share it on WhatsApp, in your email signature, on your website or on social media. One link handles all your appointment requests.' },
  { q: 'Can I send WhatsApp reminders?', a: 'Yes. Meeticulous sends automatic booking confirmations and reminders over WhatsApp and email before each appointment, which cuts no-shows. WhatsApp reminders are included on the Pro plan (and free for your first two months on the Starter plan).' },
  { q: 'Can I accept online payments?', a: 'Yes. Collect your consultation fee upfront through Razorpay — UPI, cards or netbanking — before the meeting. A GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I manage multiple services?', a: 'Yes. Create and manage as many services as you need — tax consultation, GST filing, audit meetings, advisory calls and more — each with its own duration, price and availability.' },
  { q: 'Can I use Meeticulous for virtual consultations?', a: 'Yes. Offer online consultations with automatic Google Meet links, or mark services as in-person at your office — or both. Clients pick the mode that suits them.' },
  { q: 'Do I need technical knowledge?', a: 'No. Setup takes minutes and requires no technical skills. You add your services and availability, and your booking page is ready to share — your clients need nothing more than the link.' },
  { q: 'Can I upgrade my plan later?', a: 'Yes. Start free on the Starter plan and upgrade to Pro whenever your practice needs 0% commission, WhatsApp automation, a full client CRM and advanced tools. You can change plans anytime.' },
  { q: 'Is there a free plan?', a: 'Yes. The Starter plan is free forever — an online booking page, unlimited services and bookings, UPI payments, 24-hour reminders and GST invoices — with a small 5% per-booking fee. Pro removes that commission entirely and adds automation and growth tools.' },
];

const FOOTER_COLS = [
  { title: 'Product', links: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', to: '/pricing' },
    { label: 'Integrations', href: '#features' },
    { label: "What's New", to: '/changelog' },
  ] },
  { title: 'For Professionals', links: [
    { label: 'Chartered Accountants', to: '/for/chartered-accountants' },
    { label: 'Consultants', to: '/for/business-consultant' },
    { label: 'Doctors', to: '/for/doctors' },
    { label: 'Salons', to: '/for/salon' },
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
  const base = 'inline-flex items-center justify-center gap-2 rounded-[8px] px-6 py-3.5 text-sm font-semibold transition-all hover:no-underline';
  const styles = {
    solid: 'text-white shadow-[0_4px_14px_rgba(30,58,95,0.24)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-primary)]/40',
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`} style={variant === 'solid' ? { background: 'var(--ca-primary)' } : undefined}>
      {children}
    </Link>
  );
}

/* Small floating "ledger" stat card that sits over the hero image. */
function StatCard({ icon: Icon, label, value, className = '' }) {
  return (
    <div className={`absolute z-20 flex items-center gap-3 rounded-[12px] border border-black/[0.06] bg-white px-4 py-3 shadow-[0_18px_40px_-20px_rgba(16,26,41,0.55)] ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-[8px] text-white" style={{ background: 'var(--ca-primary)' }}>
        <Icon size={17} />
      </span>
      <div>
        <div className="text-[11px] font-medium text-slate-500">{label}</div>
        <div className="text-sm font-bold text-[color:var(--ca-ink)]">{value}</div>
      </div>
    </div>
  );
}

/* Two-column FAQ accordion (single open). */
function FaqAccordion() {
  const [open, setOpen] = useState(0);
  const renderItem = (f, i) => {
    const isOpen = open === i;
    return (
      <div key={f.q} className="overflow-hidden rounded-[12px] border bg-white transition-colors" style={{ borderColor: isOpen ? 'var(--ca-primary)' : 'rgba(16,26,41,0.08)' }}>
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

/* One ledger panel — account entries with hairline rules and a gold-marker column. */
function LedgerPanel({ group, items }) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-black/[0.08] bg-white shadow-[0_18px_50px_-36px_rgba(16,26,41,0.5)]">
      <div className="flex items-center justify-between px-5 py-3.5" style={{ background: 'var(--ca-primary)' }}>
        <span className="font-heading text-[13px] font-bold text-white">{group}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-white/60">Bookable</span>
      </div>
      <ul className="divide-y divide-black/[0.07]">
        {items.map((s, i) => (
          <li key={s.label}>
            <Link
              to={START}
              className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[color:var(--ca-grey)] hover:no-underline"
            >
              <span aria-hidden className="w-6 text-right font-heading text-[13px] font-bold tabular-nums" style={{ color: 'var(--ca-accent)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[8px]" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}>
                <s.icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-[14.5px] font-bold text-[color:var(--ca-ink)]">{s.label}</span>
                <span className="block text-[12.5px] leading-snug text-slate-500">{s.desc}</span>
              </span>
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-colors" style={{ backgroundColor: 'color-mix(in srgb, var(--ca-accent) 14%, transparent)', color: 'var(--ca-accent)' }}>
                <ArrowRight size={14} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function CharteredAccountants() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/chartered-accountants`;
  const seo = {
    title: 'Appointment Booking Software for Chartered Accountants (CAs) | Meeticulous',
    description: 'Meeticulous is appointment booking software for Chartered Accountants and CA firms in India. Let clients book tax, GST and advisory consultations online — fees collected upfront, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'appointment booking software for chartered accountants, CA appointment software, book CA consultation online, tax consultation booking, GST consultation scheduling, CA firm scheduling software India, accountant booking page',
    ogTitle: 'Your CA practice runs on client meetings. Let Meeticulous run them.',
    ogDescription: 'Clients book tax & GST consultations, pay upfront, and get WhatsApp reminders — automatically. The booking page every CA practice in India should already have.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Chartered Accountants & CA Firms',
    serviceType: 'Appointment booking software for chartered accountants and CA firms',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Trusted-finance palette. Legacy --ca-* names kept (shared classNames depend on them).
  const styleVars = {
    '--ca-primary': '#1E3A5F', // deep navy — text/links/fills, AA on white (~10:1)
    '--ca-accent': '#A16207',  // gold — labels, markers, rules; AA on white (~4.9:1)
    '--ca-ink': '#101A29',     // near-black navy text
    '--ca-cream': '#F1F5F9',   // cool slate-50 section bg
    '--ca-grey': '#F4F6F8',    // light section bg
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
        themeColor="#1E3A5F"
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
                  <Link to={LOGIN} className="flex-1 rounded-[8px] border-2 border-black/10 py-2.5 text-center text-sm font-semibold text-[color:var(--ca-ink)] hover:no-underline">Login</Link>
                  <CtaButton to={START} className="flex-1">Start Free <ArrowRight size={15} /></CtaButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ═══════════════ 2 · HERO (framed image + navy mix-blend blob + floating stat cards) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        {/* navy blurred blob, blended INTO the surface */}
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-20 h-96 w-96 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(30,58,95,0.22), transparent)' }} />
        {/* faint ruled-ledger lines */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(16,26,41,0.035) 1px, transparent 1px)', backgroundSize: '100% 34px', maskImage: 'linear-gradient(180deg, transparent, #000 40%, transparent)', WebkitMaskImage: 'linear-gradient(180deg, transparent, #000 40%, transparent)' }} />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Professional appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>Chartered Accountants</span> running modern practices.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for chartered accountants — clients book tax, GST and advisory consultations, pay upfront, and get reminded, so your practice runs without the back-and-forth.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Create a Free Account <ArrowRight size={16} /></CtaButton>
              <Link to="/demo" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
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

          {/* RIGHT — icon art, framed like a ledger card + floating stat cards */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
            <div aria-hidden className="pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 rounded-[16px]" style={{ background: 'color-mix(in srgb, var(--ca-accent) 16%, transparent)' }} />
            <div className="relative rounded-[20px] border border-black/[0.08] bg-white p-4 shadow-[0_34px_80px_-40px_rgba(16,26,41,0.6)]">
              <div className="mb-3 flex items-center justify-between border-b border-dashed border-black/10 pb-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Booking ledger</span>
                <span className="flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--ca-accent)' }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--ca-accent)' }} /> Live
                </span>
              </div>
              <div className="relative flex items-center justify-center overflow-hidden rounded-[14px] py-4" style={{ background: 'radial-gradient(circle at 50% 40%, color-mix(in srgb, var(--ca-primary) 8%, transparent), transparent 70%)' }}>
                <div role="img" aria-label="Meeticulous — appointment booking for chartered accountants" className="mx-auto grid aspect-square w-full max-w-[20rem] place-items-center">
                  <ART_ICON className="h-24 w-24" style={{ color: 'var(--ca-primary)' }} strokeWidth={1.25} aria-hidden="true" />
                </div>
              </div>
            </div>
            <StatCard icon={Receipt} label="GST filed" value="Invoice sent" className="-left-3 top-8 hidden sm:flex" />
            <StatCard icon={IndianRupee} label="Fees collected" value="₹2,500 · UPI" className="-right-3 bottom-10 hidden sm:flex" />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (ledger line-items) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for chartered accountants, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-slate-500">
              From tax consultations to audits, registrations and financial advisory — every service is a bookable line item.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-2 lg:gap-6">
            {LEDGER.map((col, i) => (
              <Reveal key={col.group} delay={i * 0.08}>
                <LedgerPanel group={col.group} items={col.items} />
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1} className="mt-10 text-center">
            <CtaButton to={START}>Create Your Booking Page <ArrowRight size={16} /></CtaButton>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (statement steps) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From &ldquo;when are you free?&rdquo; to <span style={{ color: 'var(--ca-primary)' }}>booked in minutes.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Three steps. No back-and-forth.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-5 sm:grid-cols-3 sm:gap-6">
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08}>
                <div className="h-full rounded-[16px] border border-black/[0.08] bg-white p-6 transition-shadow hover:shadow-[0_18px_44px_-28px_rgba(16,26,41,0.45)]" style={{ borderTop: '3px solid var(--ca-accent)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-heading text-[13px] font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--ca-accent)' }}>Step {s.n}</span>
                    <span className="flex h-11 w-11 items-center justify-center rounded-[10px] text-white" style={{ background: 'var(--ca-primary)' }}>
                      <s.icon size={19} />
                    </span>
                  </div>
                  <h3 className="mt-5 font-heading text-lg font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (real-tool logo grid) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Connect your calendar, meetings, payments and WhatsApp — Meeticulous fits your practice, no rewiring.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((t, i) => (
              <Reveal key={t.name} delay={(i % 3) * 0.05}>
                <div className="flex h-full flex-col rounded-[14px] border border-black/[0.08] bg-white p-5 transition-all hover:border-[color:var(--ca-primary)]/30 hover:shadow-[0_14px_34px_-24px_rgba(16,26,41,0.45)]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[10px] bg-[color:var(--ca-grey)]">
                    {t.logo
                      ? <img src={t.logo} alt={`${t.name} logo`} loading="lazy" className="h-6 w-6 object-contain" />
                      : <ToolLogo name={t.icon} size={24} className="h-6 w-6" />}
                  </span>
                  <h3 className="mt-3.5 font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{t.name}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{t.sub}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1} className="mt-12 text-center">
            <Link to="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold hover:no-underline" style={{ color: 'var(--ca-primary)' }}>
              Explore All Features <ArrowRight size={16} />
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (balance sheet) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Your practice, <span style={{ color: 'var(--ca-primary)' }}>balanced.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-4 text-base text-slate-500">
              Less time on admin, more time with clients — and every rupee you earn stays yours.
            </Reveal>
          </div>

          <Reveal delay={0.1} className="mt-12 overflow-hidden rounded-[20px] border border-black/[0.08] bg-white shadow-[0_28px_70px_-40px_rgba(16,26,41,0.5)]">
            <div className="flex items-center justify-between px-6 py-4" style={{ background: 'var(--ca-primary)' }}>
              <span className="font-heading text-sm font-bold text-white">Statement of value</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">Meeticulous</span>
            </div>
            <div className="grid sm:grid-cols-2 sm:divide-x sm:divide-black/[0.08]">
              {[BALANCE.left, BALANCE.right].map((col) => (
                <div key={col.title} className="p-6 sm:p-8">
                  <div className="border-b-2 pb-3" style={{ borderColor: 'color-mix(in srgb, var(--ca-accent) 45%, transparent)' }}>
                    <span className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: 'var(--ca-accent)' }}>{col.title}</span>
                  </div>
                  <ul className="divide-y divide-black/[0.07]">
                    {col.rows.map((r) => (
                      <li key={r.label} className="flex items-baseline justify-between gap-4 py-4">
                        <span className="font-heading text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl" style={{ color: 'var(--ca-primary)' }}>{r.fig}</span>
                        <span className="text-right text-sm font-semibold" style={{ color: 'var(--ca-accent)' }}>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1 border-t-2 border-black/[0.08] px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:gap-4" style={{ background: 'var(--ca-grey)' }}>
              <span className="font-heading text-sm font-bold text-[color:var(--ca-ink)]">Net result</span>
              <span className="text-sm font-medium text-slate-600">More booked time, less admin, zero commission on Pro.</span>
            </div>
          </Reveal>

          <Reveal delay={0.14} className="mt-8 text-center">
            <CtaButton to={START}>Claim Your Link <ArrowRight size={16} /></CtaButton>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (editorial columns) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              What CA teams say about the <span style={{ color: 'var(--ca-primary)' }}>admin they got back.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              How practices cut the coordination — booking, no-shows and fee collection — with Meeticulous.
            </Reveal>
          </div>
          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <Reveal key={t.name} className="pt-5" style={{ borderTop: '2px solid var(--ca-accent)' }}>
                <figure>
                  <div className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((s) => <Star key={s} size={15} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}
                  </div>
                  <blockquote className="mt-4 font-heading text-[16px] font-semibold leading-relaxed text-[color:var(--ca-ink)]">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: 'var(--ca-primary)' }}>
                      {t.name.replace('CA ', '').charAt(0)}
                    </span>
                    <div>
                      <div className="text-sm font-bold text-[color:var(--ca-ink)]">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.role}</div>
                    </div>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
          <p className="mt-10 text-center text-xs text-slate-400">Illustrative quotes from CA-firm staff, shown as examples of the admin relief the tool provides.</p>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (reconciliation table) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" delay={0.04} className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The manual way vs <span style={{ color: 'var(--ca-primary)' }}>a better-run practice.</span>
            </Reveal>
          </div>

          <Reveal delay={0.08} className="mt-12 overflow-hidden rounded-[18px] border border-black/[0.08] bg-white shadow-[0_24px_60px_-40px_rgba(16,26,41,0.45)]">
            {/* header row — desktop */}
            <div className="hidden grid-cols-[0.9fr_1.3fr_1.3fr] items-center gap-4 border-b-2 border-black/[0.08] px-6 py-4 sm:grid" style={{ background: 'var(--ca-primary)' }}>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">Ledger item</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">The manual way</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white">With Meeticulous</span>
            </div>
            <ul className="divide-y divide-black/[0.07]">
              {RECONCILE.map((r) => (
                <li key={r.topic} className="grid gap-3 px-6 py-5 sm:grid-cols-[0.9fr_1.3fr_1.3fr] sm:items-center sm:gap-4">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px]" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}>
                      <r.icon size={17} />
                    </span>
                    <span className="font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{r.topic}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <X size={16} className="mt-0.5 flex-shrink-0 text-slate-300" />
                    <span className="text-sm text-slate-500 line-through decoration-slate-300/70">
                      <span className="mr-1 font-semibold text-slate-400 sm:hidden">Manual:</span>{r.old}
                    </span>
                  </div>
                  <div className="flex items-start gap-2 rounded-[10px] px-3 py-2.5 sm:bg-[color:var(--ca-grey)]">
                    <Check size={16} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--ca-accent)' }} />
                    <span className="text-sm font-medium text-[color:var(--ca-ink)]">
                      <span className="mr-1 font-semibold" style={{ color: 'var(--ca-accent)' }}>Meeticulous:</span>{r.now}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 9 · PRICING (two cards + billing toggle) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start small. <span style={{ color: 'var(--ca-primary)' }}>Grow when your practice does.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              Choose a plan that fits your practice today. Upgrade when you need more.
            </Reveal>
          </div>

          <Reveal delay={0.08} className="mt-8 flex items-center justify-center gap-3">
            <button type="button" onClick={() => setYearly(false)} className={`text-sm font-semibold transition-colors ${!yearly ? 'text-[color:var(--ca-ink)]' : 'text-slate-500'}`}>Monthly</button>
            <button type="button" role="switch" aria-checked={yearly} aria-label="Toggle monthly or yearly billing" onClick={() => setYearly((v) => !v)} className="relative h-6 w-11 rounded-full transition-colors" style={{ background: yearly ? 'var(--ca-primary)' : '#cbd5e1', minHeight: 0 }}>
              <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ left: yearly ? '22px' : '2px' }} />
            </button>
            <span className={`text-sm font-semibold transition-colors ${yearly ? 'text-[color:var(--ca-ink)]' : 'text-slate-500'}`}>
              Yearly <span className="ml-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: 'color-mix(in srgb, var(--ca-accent) 16%, transparent)', color: 'var(--ca-accent)' }}>Save {PREMIUM_ANNUAL_SAVE_PCT}%</span>
            </span>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Starter (free) */}
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
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} variant="ghost" className="mt-7 w-full">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>

            {/* Pro (premium) */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col rounded-[18px] border-2 bg-white p-7 shadow-[0_28px_70px_-40px_rgba(16,26,41,0.4)]" style={{ borderColor: 'var(--ca-primary)' }}>
                <div className="flex items-center justify-between">
                  <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                  <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ background: 'var(--ca-primary)' }}>Recommended</span>
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
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} /> <span>Everything in Free</span>
                  </li>
                  {PREMIUM_PLAN.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} /> <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <CtaButton to={START} className="mt-7 w-full">Go Pro</CtaButton>
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

      {/* ═══════════════ 10 · ABOUT (split — real image + trust facts) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* LEFT — framed icon art */}
          <Reveal className="relative order-2 mx-auto w-full max-w-sm lg:order-1 lg:mx-0">
            <div aria-hidden className="pointer-events-none absolute -left-5 -top-5 h-28 w-28 rounded-[16px]" style={{ background: 'color-mix(in srgb, var(--ca-accent) 16%, transparent)' }} />
            <div className="relative rounded-[20px] border border-black/[0.08] bg-white p-5 shadow-[0_30px_70px_-42px_rgba(16,26,41,0.55)]">
              <div aria-hidden="true" className="mx-auto grid aspect-square w-full max-w-[18rem] place-items-center">
                <ART_ICON className="h-20 w-20" style={{ color: 'var(--ca-primary)' }} strokeWidth={1.25} />
              </div>
            </div>
          </Reveal>

          {/* RIGHT — statement + trust facts */}
          <div className="order-1 text-center lg:order-2 lg:text-left">
            <Reveal as="h2" delay={0.04} className="font-heading text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
              Small businesses deserve better tools.
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-5 text-base leading-relaxed text-slate-600">
              Meeticulous was built to make appointment-based businesses easier to run. Instead of stitching together calendars, WhatsApp messages, spreadsheets and payment tools, professionals manage their client appointments from one clean platform. It is a scheduling and payment tool — not an accounting or tax-advice system.
            </Reveal>
            <Reveal delay={0.12} className="mt-8 grid gap-3 sm:grid-cols-2">
              {TRUST.map((it) => (
                <div key={it.value} className="flex items-start gap-3 rounded-[12px] border border-black/[0.08] bg-white p-4 text-left">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[8px]" style={{ background: 'color-mix(in srgb, var(--ca-primary) 8%, transparent)', color: 'var(--ca-primary)' }}>
                    <it.icon size={17} />
                  </span>
                  <div>
                    <div className="text-sm font-bold text-[color:var(--ca-ink)]">{it.value}</div>
                    <div className="mt-0.5 text-xs leading-snug text-slate-500">{it.label}</div>
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

      {/* ═══════════════ 12 · FINAL CTA (navy + gold mix-blend glow) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[24px] px-8 py-16 text-center sm:px-12 lg:py-20" style={{ background: 'linear-gradient(150deg, var(--ca-ink) 0%, var(--ca-primary) 100%)' }}>
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(161,98,7,0.7), transparent)' }} />
          <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-10 h-72 w-72 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(161,98,7,0.4), transparent)' }} />
          <div className="relative mx-auto max-w-2xl">
            <Reveal className="mx-auto flex h-14 w-14 items-center justify-center rounded-[14px]" style={{ background: 'color-mix(in srgb, var(--ca-accent) 30%, transparent)' }}>
              <Zap size={26} style={{ color: '#FBBF24' }} />
            </Reveal>
            <Reveal as="h2" delay={0.06} className="mt-6 font-heading text-[clamp(1.8rem,4.5vw,2.5rem)] font-extrabold leading-[1.1] tracking-tight text-white">
              Spend less time managing appointments. Spend more time growing your practice.
            </Reveal>
            <Reveal as="p" delay={0.1} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75">
              Set up your booking page today and give your clients a simpler way to meet with you.
            </Reveal>
            <Reveal delay={0.14} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
                Launch My Practice Page <ArrowRight size={16} />
              </Link>
              <Link to="/demo" className="inline-flex w-full items-center justify-center gap-2 rounded-[8px] border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
                Book A Demo
              </Link>
            </Reveal>
            <Reveal delay={0.18} className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {['No credit card', 'Free forever', '0% on Pro'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Check size={14} style={{ color: '#FBBF24' }} /> {t}</span>
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
              <p className="mt-2 max-w-xs text-sm text-slate-500">The simpler way to run your CA practice&apos;s bookings.</p>
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
            <p className="text-xs text-slate-500">Made for India&apos;s Chartered Accountants &amp; CA firms</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
