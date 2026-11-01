// /for/astrologers — bespoke, conversion-focused landing page for astrologers,
// Vedic astrologers, tarot readers & numerologists in India. (Sept-release rebuild.)
//
// STANDALONE page (not the data-driven ProfessionLanding template). Bespoke route
// PRECEDES /for/:profession in App.jsx. Keep in sync: App.jsx, prerender.mjs,
// sitemapService.js, Navbar "Who it's for" menu — the main thread wires those.
//
// Section ORDER follows CharteredAccountants; each section is its OWN design in a
// CELESTIAL cosmic-violet + gold system — mystical but clean, never gaudy. Distinct
// from every sibling page. Signature mechanics unique to this page: a circular
// "celestial" hero image in a thin gold ring with a violet mix-blend-multiply blob
// and an SVG constellation · a ZODIAC-RING radial service layout orbiting a gold
// emblem · a deep night-sky impact band with gold numerals joined by a constellation
// line. Other sections fresh: lunar-phase step path · constellation-of-tools panel ·
// interactive avatar-picker testimonials · night→dawn "sunrise" comparison · two
// starlit pricing cards · editorial about with a real image. Only nav/hero-shell/
// footer (shared shell) resemble sibling pages.
//
// IMAGES: the six real integration logos and the two astrologer avatar SVGs
// (initial-disc fallback for the rest). Hero + about use icon art (no mascot
// illustrations). Descriptive alt on each; no empty placeholders.
//
// HONESTY: Meeticulous is a scheduling + payment tool. NO prediction-accuracy or
// outcome claims. Testimonials are labelled PLACEHOLDER quotes from astrologers /
// consultants about ADMIN relief (bookings, no-shows, upfront fees). Trust facts are
// verifiable only. JSON-LD carries NO aggregateRating / review.
//
// A11Y: single <h1>, ordered headings, real <button>/<a>, aria-labels on icon-only
// controls + the testimonial picker (tablist), accordion aria-expanded, AA-contrast
// palette (violet #4C1D95 ≈ 10:1 on white; gold used as fill / on-dark only), visible
// focus, NO hover uplift, all motion guarded by prefers-reduced-motion, Reveal guards
// its own.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Check, Menu, X, Plus, Star, Moon, Sun, Sparkles,
  CalendarCheck, LayoutDashboard, MessageCircle, TrendingUp,
  Wallet, BellRing, MapPin, Users, Lock, Receipt, BadgePercent,
  Heart, Briefcase, Compass, Hash, Flame, HandHeart,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import IconArt from '../../components/common/IconArt';
import useLenis from '../../hooks/useLenis';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN, PREMIUM_ANNUAL_SAVE_PCT } from '../../data/plans';
import razorpayLogo from '../enterprise-v2/assets/logo/razorpay.png';
import outlookLogo from '../enterprise-v2/assets/logo/outlook.svg';
import meetLogo from '../enterprise-v2/assets/logo/meet.svg';
import zoomLogo from '../enterprise-v2/assets/logo/zoom.svg';
import calendarLogo from '../enterprise-v2/assets/logo/calendar.svg';
import OperatorCredit from '../../components/common/OperatorCredit';
import PageGuides from '../../components/common/PageGuides';

const WHATSAPP_LOGO = '/for/astrologers/whatsapp.svg'; // green WhatsApp mark (public asset)

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

const HERO_TRUST = ['No credit card required', 'Setup in minutes', 'Built for Indian astrologers'];

// Hero benefit strip.
const BENEFITS = [
  { icon: CalendarCheck, title: 'Get Booked', desc: 'Seekers book and pay for a reading, without the DM back-and-forth.' },
  { icon: LayoutDashboard, title: 'Stay Organised', desc: 'Calendar, availability and every consultation in one place.' },
  { icon: MessageCircle, title: 'Automate Follow-Ups', desc: 'Automatic confirmations and reminders, sent over WhatsApp.' },
  { icon: TrendingUp, title: 'Grow Your Practice', desc: 'See bookings, revenue and repeat seekers with clear insights.' },
];

// Zodiac-ring services — the consultations an astrologer sells on Meeticulous.
const SERVICES = [
  { icon: Moon, label: 'Horoscope Reading', desc: 'Birth-chart readings, by slot.' },
  { icon: Heart, label: 'Love & Relationship', desc: 'Compatibility and guidance.' },
  { icon: Briefcase, label: 'Career & Finance', desc: 'Timing and direction calls.' },
  { icon: HandHeart, label: 'Health & Wellness', desc: 'Remedial well-being guidance.' },
  { icon: Compass, label: 'Vastu Consultation', desc: 'Home and workplace alignment.' },
  { icon: Hash, label: 'Numerology', desc: 'Name and number analysis.' },
  { icon: Flame, label: 'Puja & Remedies', desc: 'Ritual guidance and remedies.' },
  { icon: Sparkles, label: 'Life Guidance', desc: "Open sessions for life's questions." },
];

// Lunar-phase step path (3-step).
const STEPS = [
  { title: 'Create & share your page', icon: LayoutDashboard, desc: 'Set up your practice, your services and your available hours, then share your booking link anywhere.' },
  { title: 'Seekers book & pay', icon: CalendarCheck, desc: 'Clients pick a reading and a time, and pay your fee upfront — no DMs, no back-and-forth.' },
  { title: 'Everyone gets reminded', icon: BellRing, desc: 'You and your client get automatic confirmations and WhatsApp reminders before the session.' },
];

// REAL Meeticulous integrations only.
const TOOLS = [
  { name: 'Google Calendar', logo: calendarLogo, sub: 'Busy times blocked, bookings added to your calendar' },
  { name: 'WhatsApp', logo: WHATSAPP_LOGO, sub: 'Send reminders and updates' },
  { name: 'Google Meet', logo: meetLogo, sub: 'Auto-add a video link to every reading' },
  { name: 'Zoom', logo: zoomLogo, sub: 'Share meeting links automatically' },
  { name: 'Outlook', logo: outlookLogo, sub: 'Keep your calendar in sync' },
  { name: 'Razorpay', logo: razorpayLogo, sub: 'Payments, refunds and GST invoices' },
];

// Night-sky impact band — honest, verifiable (no fabricated client counts).
const IMPACT_STATS = [
  { value: '0%', desc: 'Commission on Pro — you keep every rupee you earn.', icon: BadgePercent },
  { value: '< 5 min', desc: 'To set up your services and go live with your own page.', icon: Sparkles },
  { value: '24/7', desc: 'Seekers book a reading any time — no phone, no waiting.', icon: CalendarCheck },
];

// Placeholder testimonials — astrologers / consultants about ADMIN relief. Swap for
// real, approved quotes. NO claims about prediction accuracy or outcomes.
const TESTIMONIALS = [
  { quote: 'The DM chaos is gone. Seekers pick a slot, pay for the reading, and my day is planned before I wake up.', name: 'Priya Sharma', role: 'Vedic Astrologer, Jaipur', avatar: '/for/astrologers/astro-priya.svg' },
  { quote: 'Upfront payment ended the no-shows. People who book a session actually show up for it now.', name: 'Rohit Verma', role: 'Numerologist, Pune', avatar: '/for/astrologers/astro-rohit.svg' },
  { quote: 'One link in my Instagram bio does everything — bookings, reminders, invoices. I just read the charts.', name: 'Anjali Nair', role: 'Tarot Reader, Kochi', avatar: '' },
  { quote: 'Clients love the WhatsApp reminders. My repeat bookings have gone up without me chasing anyone.', name: 'Deepak Rao', role: 'Vedic Astrologer, Hyderabad', avatar: '' },
  { quote: 'Setting up my services took ten minutes. Now every consultation is booked and paid before it starts.', name: 'Meera Iyer', role: 'Vastu Consultant, Chennai', avatar: '' },
  { quote: 'GST invoices are generated automatically — my accountant is happier and so am I.', name: 'Kabir Singh', role: 'Astrologer, Delhi', avatar: '' },
];

// Sunrise comparison — night (without) → dawn (with).
const WITHOUT = ['Endless DMs just to fix a time', 'No-shows quietly waste your day', 'Chasing the fee after the reading', 'Reminders sent by hand, one by one'];
const WITH_BAS = ['Seekers pick a slot themselves', 'Paid upfront — no more no-shows', 'Fee collected before you begin', 'Automatic WhatsApp reminders'];

// Why choose — supporting points in the About section.
const WHY = [
  { icon: MapPin, title: 'Built for India', desc: 'Designed around Indian astrologers, UPI payments, GST and the way seekers already reach you.' },
  { icon: Users, title: 'Easy for Your Seekers', desc: 'No signup or app to install — clients open your link, pick a slot and pay in seconds.' },
  { icon: MessageCircle, title: 'WhatsApp First', desc: 'Confirmations and reminders go out on the channel your clients already live on.' },
  { icon: Lock, title: 'Private & Secure', desc: 'Sessions and client details stay confidential; payments are Razorpay-secured.' },
];

// Honest trust strip — verifiable facts only, NOT fabricated reading counts.
const TRUST_STRIP = [
  { icon: BadgePercent, value: '0% commission', label: 'On Pro — keep every rupee' },
  { icon: Receipt, value: 'GST invoices', label: 'Tax invoices generated automatically' },
  { icon: Lock, value: 'UPI + Cards', label: 'Razorpay signature-verified payments' },
  { icon: MapPin, value: 'Made in India', label: 'Hosted in Mumbai · DPDP Act 2023 aligned' },
];

const FAQ = [
  { q: 'Is Meeticulous suitable for astrologers and tarot readers?', a: 'Yes. Whether you read birth charts, tarot or numbers, Meeticulous manages your services, availability, client bookings, payments and reminders from one place — so solo astrologers and larger practices can run sessions without the manual coordination. It is a scheduling and payment tool.' },
  { q: 'Can seekers book a reading online?', a: 'Yes. Clients open your booking link, choose a service such as a horoscope reading or a Vastu consultation, pick a convenient slot and confirm — no DMs or waiting for a reply.' },
  { q: 'Can I share my booking link on Instagram and WhatsApp?', a: 'Yes. Your booking link works anywhere — put it in your Instagram bio, share it on WhatsApp status, in your email signature or on your website. One link handles every booking request.' },
  { q: 'Can I send WhatsApp reminders?', a: 'Yes. Meeticulous sends automatic booking confirmations and reminders over WhatsApp and email before each session, which cuts no-shows. WhatsApp reminders are included on the Pro plan (and free for your first two months on the Starter plan).' },
  { q: 'Can I collect the consultation fee upfront?', a: 'Yes. Collect your fee before the session through Razorpay — UPI, cards or netbanking. Upfront payment ends no-shows, and a GST invoice is generated automatically for every paid booking.' },
  { q: 'Can I offer readings online and in person?', a: 'Yes. Offer online sessions with automatic Google Meet or Zoom links, or mark a service as in-person at your space — or both. Seekers pick the mode that suits them.' },
  { q: 'Can I manage multiple services?', a: 'Yes. Create as many services as you need — horoscope readings, love and career guidance, Vastu, numerology, puja and remedies — each with its own duration, price and availability.' },
  { q: 'Do I need any technical knowledge?', a: 'No. Setup takes minutes and needs no technical skills. You add your services and hours, and your booking page is ready to share — your clients need nothing more than the link.' },
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
    { label: 'Astrologers & Vedic Consultants', to: '/for/astrologers' },
    { label: 'Dermatologists & Skin Clinics', to: '/for/dermatologists' },
    { label: 'General Physicians & Clinics', to: '/for/doctors' },
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
    solid: 'text-white shadow-[0_6px_20px_-6px_rgba(76,29,149,0.55)] hover:brightness-110',
    ghost: 'border-2 border-[color:var(--ca-ink)]/12 bg-white text-[color:var(--ca-ink)] hover:border-[color:var(--ca-primary)]/40',
  };
  return (
    <Link
      to={to}
      className={`${base} ${styles[variant]} ${className}`}
      style={variant === 'solid' ? { background: 'linear-gradient(120deg, #7A0A28, var(--ca-primary))' } : undefined}
    >
      {children}
    </Link>
  );
}

// A small, decorative SVG constellation — dots joined by faint gold lines.
function Constellation({ className = '', stroke = 'rgba(234,179,8,0.55)', dot = '#EAB308' }) {
  return (
    <svg aria-hidden viewBox="0 0 200 140" className={`pointer-events-none ${className}`}>
      <polyline points="16,120 54,64 96,88 132,34 184,60" fill="none" stroke={stroke} strokeWidth="1" />
      {[[16, 120], [54, 64], [96, 88], [132, 34], [184, 60]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={i === 3 ? 3.4 : 2.2} fill={dot} />
      ))}
    </svg>
  );
}

// Lunar-phase glyph for the step path (crescent → half → full).
function MoonPhase({ i }) {
  const bg = [
    'radial-gradient(circle at 68% 50%, var(--ca-accent) 0 42%, rgba(76,29,149,0.22) 44%)',
    'linear-gradient(90deg, var(--ca-accent) 50%, rgba(76,29,149,0.22) 50%)',
    'var(--ca-accent)',
  ][i] || 'var(--ca-accent)';
  return <span aria-hidden className="h-4 w-4 rounded-full ring-2 ring-white shadow-sm" style={{ background: bg }} />;
}

// One zodiac-ring / grid service card (shared by the desktop ring + mobile grid).
function ServiceCard({ s, compact = false }) {
  const Icon = s.icon;
  return (
    <Link
      to={START}
      className={`group relative flex h-full flex-col rounded-[16px] border border-black/[0.07] bg-white transition-colors hover:border-[color:var(--ca-primary)]/40 hover:shadow-[0_18px_40px_-24px_rgba(76,29,149,0.45)] hover:no-underline ${compact ? 'items-center p-4 text-center' : 'p-5'}`}
    >
      <Star aria-hidden size={13} className="absolute right-3 top-3" style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />
      <span
        className="flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: 'color-mix(in srgb, var(--ca-primary) 9%, transparent)', color: 'var(--ca-primary)' }}
      >
        <Icon size={20} />
      </span>
      <h3 className={`font-heading font-bold text-[color:var(--ca-ink)] ${compact ? 'mt-3 text-[13px] leading-tight' : 'mt-4 text-[15px]'}`}>{s.label}</h3>
      <p className={`text-slate-500 ${compact ? 'mt-1 text-[11px] leading-snug' : 'mt-1.5 text-[13px] leading-relaxed'}`}>{s.desc}</p>
    </Link>
  );
}

// Interactive testimonial "avatar picker" — a constellation of astrologers; click a
// face to reveal that quote. Real avatar image, else an initial disc.
function TestimonialPicker() {
  const [active, setActive] = useState(0);
  const t = TESTIMONIALS[active];
  return (
    <div className="mt-12 grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
      <AnimatePresence mode="wait">
        <motion.figure
          key={active}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="relative rounded-[22px] border border-black/[0.07] bg-white p-8 shadow-[0_24px_60px_-34px_rgba(76,29,149,0.4)] sm:p-10"
        >
          <span aria-hidden className="font-heading text-5xl leading-none" style={{ color: 'color-mix(in srgb, var(--ca-accent) 60%, white)' }}>&ldquo;</span>
          <blockquote className="mt-2 text-lg leading-relaxed text-[color:var(--ca-ink)] sm:text-xl">{t.quote}</blockquote>
          <div className="mt-6 flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((s) => <Star key={s} size={16} style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />)}
          </div>
          <figcaption className="mt-4 border-t border-black/[0.06] pt-4">
            <div className="font-heading text-[15px] font-bold text-[color:var(--ca-ink)]">{t.name}</div>
            <div className="text-[13px] text-slate-500">{t.role}</div>
          </figcaption>
        </motion.figure>
      </AnimatePresence>

      <div role="tablist" aria-label="Choose an astrologer to read their words" className="grid grid-cols-3 gap-4 sm:grid-cols-6 lg:grid-cols-3">
        {TESTIMONIALS.map((p, i) => {
          const on = i === active;
          return (
            <button
              key={p.name}
              type="button"
              role="tab"
              aria-selected={on}
              aria-label={`${p.name}, ${p.role}`}
              onClick={() => setActive(i)}
              className="group flex flex-col items-center gap-2 rounded-2xl p-2 transition-colors hover:bg-[color:var(--ca-cream)]"
            >
              {p.avatar ? (
                <img
                  src={p.avatar}
                  alt={p.name}
                  loading="lazy"
                  width={56}
                  height={56}
                  className="h-14 w-14 rounded-full object-cover ring-2 transition-all"
                  style={{ boxShadow: on ? '0 0 0 3px var(--ca-accent)' : 'none', outlineColor: 'transparent' }}
                />
              ) : (
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white transition-all"
                  style={{ background: 'var(--ca-primary)', boxShadow: on ? '0 0 0 3px var(--ca-accent)' : 'none' }}
                >
                  {p.name.charAt(0)}
                </span>
              )}
              <span className={`text-[11px] font-semibold leading-tight ${on ? 'text-[color:var(--ca-primary)]' : 'text-slate-500'}`}>{p.name.split(' ')[0]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

export default function Astrologers() {
  useLenis();
  const [menuOpen, setMenuOpen] = useState(false);
  const [yearly, setYearly] = useState(true);

  const canonical = `${SITE_URL}/for/astrologers`;
  const seo = {
    title: 'Appointment Booking Software for Astrologers | Meeticulous',
    description: 'Meeticulous is appointment booking software for astrologers, tarot readers, numerologists and Vedic astrologers in India. Let seekers book readings online — fees collected upfront, WhatsApp reminders, GST invoices, 0% commission. Start free.',
    keywords: 'appointment booking software for astrologers, astrology consultation booking, book astrology reading online, tarot booking software, numerology appointment scheduling, Vedic astrologer booking page India, astrologer scheduling software',
    ogTitle: 'Your astrology practice runs on readings. Let Meeticulous run the bookings.',
    ogDescription: 'Seekers book readings, pay upfront and get WhatsApp reminders — automatically. The booking page every astrologer in India should already have.',
  };

  // One @graph (WebSite · Organization · WebPage · SoftwareApplication · Service ·
  // HowTo · FAQPage · BreadcrumbList), cross-linked by @id. See seo.js. No
  // aggregateRating by design — a profession page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'For Astrologers & Vedic Consultants',
    serviceType: 'Appointment booking software for astrologers and Vedic consultants',
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  // Celestial cosmic-violet + gold. Legacy --ca-* names kept (shared classNames depend on them).
  const styleVars = {
    '--ca-primary': '#4C1D95', // cosmic violet — text/links/fills, ~10:1 on white
    '--ca-accent': '#EAB308',  // gold / star — fills & on-dark accents (not body text on white)
    '--ca-ink': '#1E1633',     // deep indigo-slate text
    '--ca-cream': '#FFF1F4',   // violet-50 section bg
    '--ca-grey': '#F3F1F8',    // light section bg
    '--ca-deep': '#170F33',    // night-sky base
  };

  return (
    <main className="astro-cosmic overflow-x-clip bg-white text-[color:var(--ca-ink)]" style={styleVars}>
      <style>{`
        .astro-cosmic .cosmic-stars{position:absolute;inset:0;overflow:hidden;pointer-events:none}
        .astro-cosmic .cosmic-stars::before,.astro-cosmic .cosmic-stars::after{content:'';position:absolute;inset:-12%;background-repeat:no-repeat}
        .astro-cosmic .cosmic-stars::before{
          background-image:
            radial-gradient(1.6px 1.6px at 12% 22%, #fff, transparent),
            radial-gradient(1.4px 1.4px at 78% 14%, #EAB308, transparent),
            radial-gradient(2px 2px at 32% 68%, #fff, transparent),
            radial-gradient(1.2px 1.2px at 60% 40%, #C4B5FD, transparent),
            radial-gradient(1.6px 1.6px at 88% 60%, #fff, transparent),
            radial-gradient(1.2px 1.2px at 46% 86%, #EAB308, transparent);
          animation: cosmic-twinkle 4s ease-in-out infinite, cosmic-drift 9s ease-in-out infinite alternate;
        }
        .astro-cosmic .cosmic-stars::after{
          background-image:
            radial-gradient(1.2px 1.2px at 22% 48%, #C4B5FD, transparent),
            radial-gradient(1.6px 1.6px at 68% 78%, #fff, transparent),
            radial-gradient(1.2px 1.2px at 92% 30%, #fff, transparent),
            radial-gradient(2px 2px at 8% 80%, #EAB308, transparent),
            radial-gradient(1.2px 1.2px at 54% 12%, #fff, transparent);
          animation: cosmic-twinkle 5.5s ease-in-out infinite 1s, cosmic-drift 11s ease-in-out infinite alternate-reverse;
        }
        @keyframes cosmic-twinkle{0%,100%{opacity:.35}50%{opacity:1}}
        @keyframes cosmic-drift{from{transform:translateY(0)}to{transform:translateY(-12px)}}
        .astro-cosmic .zodiac-spin{animation: zodiac-rot 100s linear infinite}
        @keyframes zodiac-rot{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion: reduce){
          .astro-cosmic .cosmic-stars::before,.astro-cosmic .cosmic-stars::after,.astro-cosmic .zodiac-spin{animation:none!important}
        }
      `}</style>

      <Seo
        title={seo.title}
        description={seo.description}
        keywords={seo.keywords}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor="#4C1D95"
        ogTitle={seo.ogTitle}
        ogDescription={seo.ogDescription}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · NAV (shared shell) ═══════════════ */}
      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5 sm:px-8">
          <Link to="/" className="flex items-center gap-2 hover:no-underline" aria-label="Meeticulous — home">
            <img src="/favicon.svg" alt="" width={28} height={28} className="h-7 w-7 rounded-md" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
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

      {/* ═══════════════ 2 · HERO (celestial circular image + constellation) ═══════════════ */}
      <section id="top" className="relative overflow-hidden px-5 pb-16 pt-10 sm:px-8 lg:pb-24 lg:pt-16" style={{ background: 'linear-gradient(180deg, var(--ca-cream) 0%, #ffffff 100%)' }}>
        {/* violet blob — mix-blend-multiply so it sits INTO the light hero */}
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(76,29,149,0.20), transparent)' }} />
        <Constellation aria-hidden className="absolute right-6 top-10 hidden w-52 opacity-70 lg:block" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="text-center lg:text-left">
            <Reveal as="h1" instant className="font-heading text-[clamp(1.5rem,5vw,3rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-[color:var(--ca-ink)]">
              Seamless appointment booking software for{' '}
              <span style={{ color: 'var(--ca-primary)' }}>astrologers</span> managing one-to-one consultations.
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mx-auto mt-5 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg lg:mx-0">
              Meeticulous is appointment booking software for astrologers — seekers book and pay for readings online, while WhatsApp reminders and one calm dashboard handle the rest.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start">
              <CtaButton to={START} className="w-full sm:w-auto">Create Your Free Page <ArrowRight size={16} /></CtaButton>
              <Link to="/demo" className="group inline-flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ca-ink)] transition-colors hover:text-[color:var(--ca-primary)] hover:no-underline">
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

          {/* RIGHT — hero image in a circular "celestial" frame with a thin gold ring */}
          <Reveal instant delay={0.1} className="relative mx-auto w-full max-w-[380px] sm:max-w-[440px] lg:mx-0">
            <div className="relative aspect-square">
              <div aria-hidden className="pointer-events-none absolute -inset-3 rounded-full" style={{ background: 'linear-gradient(135deg, var(--ca-accent), rgba(234,179,8,0.15))' }} />
              <div className="relative h-full w-full rounded-full border-[6px] border-white shadow-[0_30px_70px_-30px_rgba(76,29,149,0.55)]">
                <div className="h-full w-full overflow-hidden rounded-full" style={{ background: 'radial-gradient(120% 100% at 70% 0%, #2c2166 0%, var(--ca-deep) 70%)' }}>
                  <div role="img" aria-label="Meeticulous booking for an astrology practice" className="grid h-full w-full place-items-center"><Moon className="h-1/3 w-1/3 text-white/90" strokeWidth={1} aria-hidden="true" /></div>
                </div>
              </div>
              {/* floating chips */}
              <div className="absolute -left-3 top-6 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_18px_40px_-20px_rgba(76,29,149,0.5)] sm:-left-8">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg text-white" style={{ background: 'var(--ca-primary)' }}><CalendarCheck size={17} /></span>
                <div><div className="text-[11px] text-slate-500">Reading booked</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">Kundli Reading · 5:30 PM</div></div>
              </div>
              <div className="absolute -right-2 bottom-8 z-20 flex items-center gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_18px_40px_-20px_rgba(76,29,149,0.5)] sm:-right-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--ca-accent) 22%, white)', color: '#92610a' }}><Wallet size={17} /></span>
                <div><div className="text-[11px] text-slate-500">Fee received</div><div className="text-sm font-bold text-[color:var(--ca-ink)]">₹1,499 · paid</div></div>
              </div>
            </div>
          </Reveal>
        </div>

        {/* benefit strip */}
        <div className="relative mx-auto mt-16 grid max-w-6xl gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {BENEFITS.map((b, i) => (
            <Reveal key={b.title} delay={(i % 4) * 0.06}>
              <div className="flex h-full flex-col rounded-[14px] border border-black/[0.07] bg-white p-4 transition-colors hover:border-[color:var(--ca-primary)]/30">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--ca-primary) 9%, transparent)', color: 'var(--ca-primary)' }}><b.icon size={18} /></span>
                  <p className="text-sm font-bold text-[color:var(--ca-ink)]">{b.title}</p>
                </div>
                <p className="mt-2 text-xs leading-snug text-slate-500">{b.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 3 · SERVICES (zodiac ring) ═══════════════ */}
      <section id="usecases" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Appointment booking software for astrologers, <span style={{ color: 'var(--ca-primary)' }}>built around how you work.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-4 text-base text-slate-500">
              From birth-chart readings to Vastu, numerology and remedies — set up every service, each with its own price, duration and availability.
            </Reveal>
          </div>

          {/* Desktop — 8 services orbit a gold emblem on a zodiac ring */}
          <div className="relative mx-auto mt-8 hidden lg:block" style={{ width: 720, height: 720 }}>
            <div aria-hidden className="zodiac-spin pointer-events-none absolute left-1/2 top-1/2 rounded-full" style={{ width: 560, height: 560, marginLeft: -280, marginTop: -280, border: '1px dashed color-mix(in srgb, var(--ca-primary) 30%, transparent)' }} />
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 rounded-full" style={{ width: 440, height: 440, marginLeft: -220, marginTop: -220, border: '1px dotted color-mix(in srgb, var(--ca-accent) 45%, transparent)' }} />
            {/* center emblem */}
            <div className="absolute left-1/2 top-1/2 flex h-40 w-40 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-center text-white shadow-[0_24px_60px_-24px_rgba(76,29,149,0.6)]" style={{ background: 'radial-gradient(120% 100% at 50% 0%, #7A0A28, var(--ca-deep))' }}>
              <Sun size={26} style={{ color: 'var(--ca-accent)' }} />
              <div className="mt-1.5 font-heading text-2xl font-extrabold leading-none">8</div>
              <div className="px-4 text-[11px] font-medium leading-tight text-white/75">ways to guide your seekers</div>
            </div>
            {SERVICES.map((s, i) => {
              const angle = (360 / SERVICES.length) * i;
              return (
                <div key={s.label} className="absolute left-1/2 top-1/2" style={{ transform: `rotate(${angle}deg) translateY(-280px) rotate(${-angle}deg)` }}>
                  <div className="w-40" style={{ transform: 'translate(-50%, -50%)' }}>
                    <ServiceCard s={s} compact />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Mobile / tablet — grid fallback of the same cards */}
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:hidden">
            {SERVICES.map((s) => <ServiceCard key={s.label} s={s} />)}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (lunar-phase path) ═══════════════ */}
      <section id="how" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              From &ldquo;when are you free?&rdquo; to <span style={{ color: 'var(--ca-primary)' }}>booked in minutes.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">No DMs, no back-and-forth. Your seekers book themselves.</Reveal>
          </div>
          <div className="relative mt-16 grid gap-8 lg:grid-cols-3 lg:gap-6">
            {/* connecting gold path (desktop) */}
            <div aria-hidden className="pointer-events-none absolute left-0 right-0 top-[26px] hidden h-px lg:block" style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--ca-accent) 60%, transparent), transparent)' }} />
            {STEPS.map((s, i) => (
              <Reveal key={s.title} delay={i * 0.08} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="relative z-10 flex flex-col items-center">
                    <MoonPhase i={i} />
                    <span className="mt-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-[0_12px_28px_-12px_rgba(76,29,149,0.7)]" style={{ background: 'linear-gradient(135deg, #7A0A28, var(--ca-primary))' }}>
                      <s.icon size={22} />
                    </span>
                  </div>
                  <div className="mt-5 rounded-[16px] border border-black/[0.07] bg-white p-6">
                    <div className="font-heading text-xs font-bold uppercase tracking-[0.16em]" style={{ color: 'var(--ca-accent)' }}>Step {i + 1}</div>
                    <h3 className="mt-2 font-heading text-lg font-bold text-[color:var(--ca-ink)]">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={0.1} className="mt-12 text-center">
            <CtaButton to={START}>Claim Your Booking Link <ArrowRight size={16} /></CtaButton>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 5 · INTEGRATIONS (constellation of tools) ═══════════════ */}
      <section id="features" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Works with the tools you <span style={{ color: 'var(--ca-primary)' }}>already use.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">
              Connect your calendar, video meetings, payments and WhatsApp — Meeticulous fits your workflow, no rewiring.
            </Reveal>
          </div>
          <Reveal delay={0.08} className="relative mt-12 overflow-hidden rounded-[24px] p-6 sm:p-8" style={{ background: 'linear-gradient(160deg, var(--ca-cream), #ffffff)', border: '1px solid rgba(76,29,149,0.08)' }}>
            <Constellation aria-hidden className="absolute -right-4 -top-2 w-44 opacity-50" stroke="rgba(76,29,149,0.35)" dot="#4C1D95" />
            <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {TOOLS.map((t, i) => (
                <Reveal key={t.name} delay={(i % 3) * 0.06}>
                  <div className="flex items-center gap-3.5 rounded-2xl border border-black/[0.07] bg-white px-4 py-3.5 transition-colors hover:border-[color:var(--ca-primary)]/30">
                    <img src={t.logo} alt={`${t.name} logo`} loading="lazy" width={36} height={36} className="h-9 w-9 flex-shrink-0 object-contain" />
                    <div className="min-w-0">
                      <div className="text-sm font-bold leading-tight text-[color:var(--ca-ink)]">{t.name}</div>
                      <div className="mt-0.5 text-xs leading-snug text-slate-500">{t.sub}</div>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · IMPACT (night-sky constellation band) ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-24" style={{ background: 'radial-gradient(120% 120% at 50% 0%, #2c2166 0%, var(--ca-deep) 60%)' }}>
        <div className="cosmic-stars" aria-hidden />
        <div className="relative mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl">
              Real impact, <span style={{ color: 'var(--ca-accent)' }}>real numbers.</span>
            </Reveal>
            <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-xl text-base text-white/70">
              Small stats, big difference — what actually changes when you go live with Meeticulous.
            </Reveal>
          </div>
          <div className="relative mt-16 grid gap-10 sm:grid-cols-3">
            {/* constellation line joining the nodes (desktop) */}
            <div aria-hidden className="pointer-events-none absolute left-[16%] right-[16%] top-[6px] hidden h-px sm:block" style={{ background: 'linear-gradient(90deg, transparent, rgba(234,179,8,0.5), transparent)' }} />
            {IMPACT_STATS.map((s, i) => (
              <Reveal key={s.value} delay={i * 0.08} className="relative text-center">
                <span aria-hidden className="mx-auto block h-3 w-3 rounded-full" style={{ background: 'var(--ca-accent)', boxShadow: '0 0 12px 2px rgba(234,179,8,0.6), 0 0 0 6px rgba(234,179,8,0.15)' }} />
                <div className="mt-6 flex items-center justify-center gap-2">
                  <s.icon size={20} style={{ color: 'var(--ca-accent)' }} />
                  <Star size={11} aria-hidden style={{ color: 'var(--ca-accent)', fill: 'var(--ca-accent)' }} />
                </div>
                <div className="mt-3 font-heading text-5xl font-extrabold tracking-tight sm:text-6xl" style={{ color: 'var(--ca-accent)' }}>{s.value}</div>
                <p className="mx-auto mt-3 max-w-[15rem] text-sm leading-relaxed text-white/75">{s.desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (avatar picker) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="p" className="text-sm font-bold uppercase tracking-[0.22em]" style={{ color: 'var(--ca-primary)' }}>Testimonials</Reveal>
            <Reveal as="h2" delay={0.05} className="mt-3 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Astrologers who swapped the <span style={{ color: 'var(--ca-primary)' }}>DMs for a link.</span>
            </Reveal>
            <Reveal as="p" delay={0.08} className="mt-3 text-sm text-slate-400">Placeholder quotes about the admin, not the charts — swapped for real, approved words soon.</Reveal>
          </div>
          <Reveal delay={0.1}><TestimonialPicker /></Reveal>
        </div>
      </section>

      {/* ═══════════════ 8 · COMPARISON (night → dawn) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-grey)' }}>
        <div className="mx-auto max-w-3xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              The <span style={{ color: 'var(--ca-primary)' }}>Meeticulous</span> difference.
            </Reveal>
            <Reveal as="p" delay={0.06} className="mt-3 text-base text-slate-500">See how a consultation changes from the manual night to a booked dawn.</Reveal>
          </div>
          <Reveal delay={0.08} className="mt-12 overflow-hidden rounded-[22px] border border-black/[0.07] shadow-[0_28px_70px_-40px_rgba(76,29,149,0.4)]">
            {/* night band — without */}
            <div className="relative overflow-hidden px-7 py-8 sm:px-10" style={{ background: 'radial-gradient(120% 140% at 50% 0%, #2c2166, var(--ca-deep))' }}>
              <div className="cosmic-stars" aria-hidden />
              <div className="relative">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/55">Without Meeticulous · the long night</div>
                <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                  {WITHOUT.map((w) => (
                    <li key={w} className="flex items-start gap-3 text-sm text-white/70">
                      <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-white/60"><X size={12} /></span>{w}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            {/* horizon — the dawn line */}
            <div aria-hidden className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #7A0A28, var(--ca-accent), #7A0A28)' }} />
            {/* dawn band — with */}
            <div className="bg-white px-7 py-8 sm:px-10">
              <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: 'var(--ca-primary)' }}>With Meeticulous · a booked dawn</div>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {WITH_BAS.map((w) => (
                  <li key={w} className="flex items-start gap-3 text-sm font-medium text-[color:var(--ca-ink)]">
                    <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-white" style={{ background: 'var(--ca-primary)' }}><Check size={12} /></span>{w}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 9 · PRICING (two starlit cards + toggle) ═══════════════ */}
      <section id="pricing" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal as="h2" className="font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
              Start free. Upgrade to <span style={{ color: 'var(--ca-primary)' }}>0% commission</span> when you are ready.
            </Reveal>
            <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-xl text-base text-slate-500">Choose a plan that fits your practice today. Upgrade when you need more.</Reveal>
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
          <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2 sm:gap-6">
            {/* Free — light card */}
            <Reveal>
              <div className="flex h-full flex-col rounded-[20px] border border-black/[0.08] bg-white p-7 sm:p-8">
                <div className="font-heading text-lg font-bold text-[color:var(--ca-ink)]">{FREE_PLAN.name}</div>
                <p className="mt-1 text-sm text-slate-500">Everything you need to get booked.</p>
                <div className="mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold">₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight">0</span>
                  <span className="pb-2 text-sm text-slate-500">/month</span>
                </div>
                <p className="mt-1.5 text-xs font-semibold text-slate-500">Free forever · 5% per booking</p>
                <ul className="mt-6 flex flex-col gap-3">
                  {FREE_PLAN.features.slice(0, 5).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-600"><Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-primary)' }} /><span>{f}</span></li>
                  ))}
                </ul>
                <CtaButton to={START} variant="ghost" className="mt-7 w-full">Start on the Free Plan</CtaButton>
              </div>
            </Reveal>
            {/* Pro — starlit night card */}
            <Reveal delay={0.08}>
              <div className="relative flex h-full flex-col overflow-hidden rounded-[20px] p-7 text-white shadow-[0_28px_70px_-30px_rgba(76,29,149,0.7)] sm:p-8" style={{ background: 'radial-gradient(120% 120% at 80% 0%, #7A0A28 0%, var(--ca-deep) 70%)' }}>
                <div className="cosmic-stars" aria-hidden />
                <div className="relative flex items-center justify-between">
                  <div className="font-heading text-lg font-bold">{PREMIUM_PLAN.name}</div>
                  <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ background: 'var(--ca-accent)', color: '#3d2a00' }}><Star size={10} style={{ fill: '#3d2a00' }} /> Recommended</span>
                </div>
                <p className="relative mt-1 text-sm text-white/75">Keep every rupee. Automate the rest.</p>
                <div className="relative mt-6 flex items-end gap-1">
                  <span className="pb-1.5 text-2xl font-bold" style={{ color: 'var(--ca-accent)' }}>₹</span>
                  <span className="font-heading text-5xl font-extrabold tracking-tight" style={{ color: 'var(--ca-accent)' }}>{yearly ? Math.round(PREMIUM_PLAN.yearly / 12) : PREMIUM_PLAN.monthly}</span>
                  <span className="pb-2 text-sm text-white/70">/month</span>
                  {yearly && <span className="pb-2 ml-1 text-sm text-white/50 line-through">₹{PREMIUM_PLAN.monthly}</span>}
                </div>
                <p className="relative mt-1.5 text-xs font-semibold text-white/70">{yearly ? `Billed ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/year · GST included` : 'Billed monthly · GST included'}</p>
                <ul className="relative mt-6 flex flex-col gap-3">
                  <li className="flex items-start gap-2.5 text-sm font-semibold text-white"><Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} /><span>Everything in Free</span></li>
                  {PREMIUM_PLAN.features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-white/90"><Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--ca-accent)' }} /><span>{f}</span></li>
                  ))}
                </ul>
                <Link to={START} className="relative mt-7 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline" style={{ color: 'var(--ca-primary)' }}>Go Pro <ArrowRight size={16} /></Link>
              </div>
            </Reveal>
          </div>
          <Reveal delay={0.12} className="mt-8 text-center">
            <Link to="/pricing" className="text-sm font-semibold text-slate-500 underline-offset-4 hover:text-[color:var(--ca-ink)] hover:underline">Compare every feature on the full pricing page</Link>
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 10 · ABOUT (editorial + trust facts + real image) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--ca-cream)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* real image */}
            <Reveal className="relative mx-auto w-full max-w-md lg:mx-0">
              <div aria-hidden className="pointer-events-none absolute -inset-6 rounded-[32px] blur-3xl mix-blend-multiply" style={{ background: 'radial-gradient(closest-side, rgba(76,29,149,0.18), transparent)' }} />
              <div className="relative overflow-hidden rounded-[24px] border border-white bg-white p-4 shadow-[0_30px_70px_-34px_rgba(76,29,149,0.5)]">
                <IconArt icon={Sparkles} label="An astrologer running their practice on Meeticulous" rounded="rounded-[6px]" className="aspect-[16/9] w-full" />
              </div>
            </Reveal>
            {/* editorial + facts */}
            <div>
              <Reveal as="h2" delay={0.04} className="font-heading text-2xl font-extrabold leading-snug tracking-tight sm:text-3xl">
                More than a booking link. Meeticulous turns endless DMs, missed calls and chased fees into <span style={{ color: 'var(--ca-primary)' }}>one calm way to practise</span> — built for the way Indian astrologers actually work.
              </Reveal>
              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {WHY.map((w, i) => (
                  <Reveal key={w.title} delay={0.06 + (i % 2) * 0.05}>
                    <div className="flex items-start gap-3 rounded-[14px] border border-black/[0.06] bg-white p-4">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: 'color-mix(in srgb, var(--ca-primary) 9%, transparent)', color: 'var(--ca-primary)' }}><w.icon size={17} /></span>
                      <div>
                        <h3 className="text-sm font-bold text-[color:var(--ca-ink)]">{w.title}</h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{w.desc}</p>
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
              <Reveal delay={0.12} className="mt-6 flex flex-wrap gap-2.5">
                {TRUST_STRIP.map((it) => (
                  <span key={it.value} className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white px-3.5 py-2 text-xs font-semibold text-[color:var(--ca-ink)]">
                    <it.icon size={14} style={{ color: 'var(--ca-primary)' }} /> {it.value}
                  </span>
                ))}
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 11 · FAQ (two-column) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="text-center font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            Questions? <span style={{ color: 'var(--ca-primary)' }}>Answered.</span>
          </Reveal>
          <div className="mt-12"><FaqAccordion /></div>
        </div>
      </section>

      {/* ═══════════════ 12 · FINAL CTA (violet night + gold glow) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px]">
          <div className="relative overflow-hidden px-8 py-16 text-center sm:px-12 sm:py-20" style={{ background: 'radial-gradient(120% 120% at 50% 0%, #2c2166 0%, var(--ca-deep) 65%)' }}>
            <div className="cosmic-stars" aria-hidden />
            {/* gold glow — mix-blend-screen so it lifts off the night sky */}
            <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-72 w-72 -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl mix-blend-screen" style={{ background: 'radial-gradient(closest-side, rgba(234,179,8,0.5), transparent)' }} />
            <div className="relative mx-auto max-w-2xl">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'color-mix(in srgb, var(--ca-accent) 22%, transparent)' }}>
                <Sun size={26} style={{ color: 'var(--ca-accent)' }} />
              </span>
              <Reveal as="h2" className="mt-6 font-heading text-[clamp(1.8rem,4.5vw,2.6rem)] font-extrabold leading-[1.1] tracking-tight text-white">
                Your next seeker is ready to book.
              </Reveal>
              <Reveal as="p" delay={0.06} className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75">
                Set up your page in minutes and start taking paid bookings today — no credit card required.
              </Reveal>
              <Reveal delay={0.1} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                <Link to={START} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-bold transition-shadow hover:shadow-[0_18px_44px_-10px_rgba(0,0,0,0.5)] hover:no-underline sm:w-auto" style={{ color: 'var(--ca-primary)' }}>
                  Launch My Page — Free <ArrowRight size={16} />
                </Link>
                <Link to="/demo" className="inline-flex w-full items-center justify-center gap-2 rounded-full border-2 border-white/30 px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:no-underline sm:w-auto">
                  Book A Demo
                </Link>
              </Reveal>
              <Reveal delay={0.14} className="mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2">
                {['No credit card', 'Free forever', '0% on Pro'].map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-[13px] font-medium text-white/70"><Check size={14} style={{ color: 'var(--ca-accent)' }} /> {t}</span>
                ))}
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 13 · FOOTER (shared shell) ═══════════════ */}
      <footer className="border-t border-white/10 px-5 py-14 sm:px-8" style={{ background: 'var(--ca-deep)' }}>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-1">
              <div className="font-heading text-lg font-extrabold text-white">Meeticulous</div>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/55">
                The calm way for astrologers in India to get booked, paid and reminded.
              </p>
              <CtaButton to={START} className="mt-5">Create Your Page — Free <ArrowRight size={15} /></CtaButton>
            </div>
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/60">{col.title}</div>
                <ul className="mt-4 space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <NavLink item={l} className="text-sm text-white/70 transition-colors hover:text-white hover:no-underline" />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-white/50">© {new Date().getFullYear()} Meeticulous · <OperatorCredit /></p>
            <p className="text-xs uppercase tracking-[0.18em] text-white/60">Made for India&apos;s astrologers &amp; Vedic consultants</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
