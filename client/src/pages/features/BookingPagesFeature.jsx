// /features/booking-pages · bespoke feature page (Oct feature-page rebuild).
//
// STANDALONE page, not the data-driven FeaturePage template. Its static route
// precedes /features/:slug in App.jsx; the featureData.js "booking-pages" entry
// stays for prerender's slug list and the other pages' "related" cards.
//
// Section order (shared by all 10 bespoke feature pages, each its own design):
//   1 Hero + live demo · 2 Proof strip · 3 Without vs with · 4 How it works ·
//   5 Capabilities · 6 The difference · 7 Testimonials · 8 FAQ · 9 Final CTA
//
// Design system E "Playful Cream": warm cream paper, brand orange + near-black
// ink, hand-drawn doodle SVGs (squiggle underline, curved arrow, sparkle), pill
// chips. Mechanics unique to this page: tappable phone-frame booking page (hero) ·
// pill-chip proof row · link-in-bio list vs booking page mocks · 4-step zig-zag
// joined by doodle arrows · slightly rotated static "sticker" cards · "type your
// name" link previewer across 4 places · sticky-note testimonials · pill-row FAQ.
//
// HONESTY: every claim is checked in code.
//   link format 3 to 30 chars [a-z0-9-]   server/utils/slugFormat.js
//   username change 2 per 365 days, 6 months apart, verified WhatsApp, old link
//   redirects, old names never reused     v3.17/v3.33 change_username + hostController resolve
//   socials list                          HostProfile SOCIAL_ORDER
//   reviews only after a completed booking, shown once count > 0
//                                         reviewController + HostProfile trust row
//   each service has its own URL          App.jsx /:profileSlug/:serviceSlug
//   free_services 2 on free, paid >= ₹100, unlimited services on both plans
//                                         planService limits + MIN_SERVICE_PRICE
//   digital products 3 / unlimited        planService limits.digital_products
// DROPPED (not true today): custom theme colours (current plans resolve to brand
// orange only in themeUtils.getColorsForPlan), "5+ themes", custom domains,
// "4.9 from 120", "60s setup". No usage stats, no ratings.
//
// IMAGES: empty ImgSlot placeholders (data-img-slot names the photo to supply).
// Global Navbar + Footer come from App.jsx. No hover uplift anywhere; the sticker
// and sticky-note rotations are static.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, X, Link2, ImageIcon, Star, Clock, MapPin, Video,
  Layers, Package, AtSign, Globe, Mail, MessageCircle, Phone,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN } from '../../data/plans';
import { TESTIMONIALS as ALL_TESTIMONIALS } from '../../data/testimonials';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';
const DEMO = '/contact';
const CREAM = '#FBF4E6';      // page paper
const PAPER = '#FFFCF5';      // lighter alternate sections
const INK = '#2A1416';
const ORANGE = '#960D32';     // decorative only (doodles, dots, fills behind dark text)
const ORANGE_INK = '#2A1416'; // orange for text + white-on-orange CTAs (AA on cream)
const PEACH = '#FBE3E8';      // primary-light tint

/* ─────────────────────────────  LINK SLUG  ────────────────────────────── */

// Mirrors server/utils/slugNormalize + slugFormat closely enough for a preview:
// lowercase, separators to hyphens, only [a-z0-9-], single hyphens, max 30.
// ponytail: preview only, the real availability + reserved-word check runs at signup.
export const SLUG_MIN = 3;
export const SLUG_MAX = 30;
export function toLinkSlug(raw) {
  return String(raw ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[\s_.·–—•]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-$/, '');
}

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const PROOF = [
  'meeticulous.com/yourname',
  `₹0 a month on ${FREE_PLAN.name}`,
  'Unlimited paid services on both plans',
  'Online and in-person sessions',
  'Guests book with phone + OTP, no app',
  'UPI, cards and netbanking at checkout',
  'Reviews only from completed bookings',
];

const LINK_IN_BIO = ['My portfolio', 'DM me for rates', 'WhatsApp me', 'Payment QR'];
const WITHOUT = [
  'Prices hide in your DMs, so people message just to ask',
  'Picking a time is a back-and-forth chat',
  'Payment happens after the call, if at all',
];
const WITH = [
  'Every service shows its price and length up front',
  'Clients pick a free slot themselves',
  'They pay when they book, and you get the booking',
];

const STEPS = [
  { title: 'Claim your link', desc: 'Pick meeticulous.com/yourname when you sign up. Lowercase letters, numbers and hyphens, 3 to 30 characters.' },
  { title: 'Add your services', desc: 'A title, price, length and a short description for each. Online or in-person. Paid services start at ₹100, or make one free.' },
  { title: 'Add your photo, bio and socials', desc: 'A profile photo, a cover image, a short bio and links to Instagram, YouTube, LinkedIn, WhatsApp or your website.' },
  { title: 'Share it, get booked', desc: 'Put the link in your bio or your email signature. Clients pick a slot, verify their phone with an OTP and pay to confirm a paid session.' },
];

const STICKERS = [
  { icon: Link2, title: 'A link that stays yours', body: 'Change your username up to twice a year, six months apart. Your old link redirects to the new one, and an old name is never handed to anyone else.', tilt: -1.6 },
  { icon: Layers, title: 'Every service gets its own page', body: 'Share one service directly at meeticulous.com/yourname/service-name, with its price, length, mode and description.', tilt: 1.2 },
  { icon: AtSign, title: 'Bio and socials built in', body: 'Instagram, YouTube, LinkedIn, Facebook, X, WhatsApp, GitHub, email and your website, so the page works as your link-in-bio.', tilt: -0.8 },
  { icon: Star, title: 'Reviews you actually earned', body: 'Only a client with a completed booking can leave one. Your rating and review count show on the page once you have them.', tilt: 1.5 },
  { icon: Package, title: 'Sell products on the same page', body: `Guides, templates or recordings next to your services. 3 digital products on ${FREE_PLAN.name}, unlimited on ${PREMIUM_PLAN.name}.`, tilt: -1.2 },
  { icon: Globe, title: 'Readable by search engines', body: 'Host pages are prerendered with structured data for your services, so search engines can read what you offer.', tilt: 0.9 },
];

const PICKED = ['Happy Singh', 'Ar. Pranav Kadoo', 'Vishal Chaware', 'Mukesh Tidke'];
const QUOTES = PICKED.map((n) => ALL_TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);

const FAQ = [
  { q: 'Is the booking page really free?', a: `Yes. On ${FREE_PLAN.name} the page costs ₹0 a month and we take a 5% commission on paid bookings. On ${PREMIUM_PLAN.name} (₹${PREMIUM_PLAN.monthly} a month or ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')} a year, GST included) the commission is 0%.` },
  { q: 'What will my link look like?', a: 'meeticulous.com/yourname. Usernames use lowercase letters, numbers and single hyphens, between 3 and 30 characters.' },
  { q: 'Can I change my username later?', a: 'Yes, up to two times in any 12 months, with at least six months between changes, once your WhatsApp number is verified. Your old link keeps working and redirects to the new one.' },
  { q: 'Can I use my own domain?', a: 'Not today. Your page lives at meeticulous.com/yourname. If you have a website, link a "Book a session" button to it.' },
  { q: 'How many services can I list?', a: `As many paid services as you like, on both plans. ${FREE_PLAN.name} also includes up to 2 free (₹0) services. Paid services start at ₹100.` },
  { q: 'Do my clients need an account or an app?', a: 'No. They open your link in any browser, pick a slot, verify their phone number with a one-time code and pay.' },
  { q: 'Are reviews shown on my page?', a: 'Yes, once you have them. Only a client whose booking was completed can review you, and the rating and count appear near your name.' },
  { q: 'Can I put the link in my Instagram bio?', a: 'Yes, that is what it is built for. One link carries your bio, socials, services and booking.' },
];

const RELATED = [
  { to: '/features/online-scheduling', label: 'Online scheduling' },
  { to: '/features/payments', label: 'Payments' },
  { to: '/features/reviews', label: 'Reviews' },
  { to: '/features/digital-products', label: 'Digital products' },
];

/* ─────────────────────────────  DOODLES  ────────────────────────────── */

function Squiggle({ className = '' }) {
  return (
    <svg aria-hidden viewBox="0 0 200 14" preserveAspectRatio="none" className={className}>
      <path d="M3 9 C 20 2, 34 13, 52 7 S 86 2, 103 8 S 136 13, 153 6 S 186 3, 197 8" fill="none" stroke={ORANGE} strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

function CurvedArrow({ className = '', flip = false }) {
  return (
    <svg aria-hidden viewBox="0 0 120 70" className={className} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path d="M6 12 C 45 0, 92 10, 104 52" fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeDasharray="1 7" />
      <path d="M92 46 L105 56 L111 40" fill="none" stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Sparkle({ className = '', color = ORANGE }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className}>
      <path d="M12 1 C13 8 16 11 23 12 C16 13 13 16 12 23 C11 16 8 13 1 12 C8 11 11 8 12 1Z" fill={color} />
    </svg>
  );
}

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function PrimaryCta({ to = START, children, onDark = false }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(194,61,0,0.22)] transition-opacity hover:no-underline hover:opacity-90"
      style={{ background: onDark ? ORANGE_INK : INK }}
    >
      {children}
    </Link>
  );
}

/* Empty image placeholder; the founder supplies the real photo later. */
function ImgSlot({ alt, slot, className = '' }) {
  return (
    <div
      role="img"
      aria-label={alt}
      data-img-slot={slot}
      className={`flex items-center justify-center rounded-[10px] border border-black/5 ${className}`}
      style={{ background: 'repeating-linear-gradient(135deg, rgba(26,26,26,0.035) 0 10px, rgba(26,26,26,0.07) 10px 20px)' }}
    >
      <ImageIcon size={28} style={{ color: 'rgba(26,26,26,0.28)' }} aria-hidden />
    </div>
  );
}

/* Hero demo: a host's booking page inside a phone frame. Tap a service to open it. */
const DEMO_SERVICES = [
  { title: 'Discovery call', mins: 30, price: '₹1,500', mode: 'Online', desc: 'A first chat about your brand, what you need and whether we are a fit. Google Meet link sent on booking.' },
  { title: 'Brand audit', mins: 60, price: '₹3,000', mode: 'Online', desc: 'I review your logo, colours and socials before the call, then walk you through what to fix first.' },
  { title: 'Portfolio review', mins: 15, price: 'Free', mode: 'In-person', desc: 'Fifteen minutes on your portfolio at my studio in Pune. Bring a laptop or a printout.' },
];

function BookingPageDemo() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return undefined;
    const id = setInterval(() => setActive((a) => (a + 1) % DEMO_SERVICES.length), 3200);
    return () => clearInterval(id);
  }, [reduce, paused]);

  return (
    <div className="relative mx-auto w-full max-w-[27rem]">
      <Sparkle className="absolute -left-6 top-10 h-6 w-6" />
      <Sparkle className="absolute -right-4 top-48 h-4 w-4" />
      <div className="rounded-[10px] border border-black/5 bg-white p-2.5 shadow-[0_30px_70px_-30px_rgba(26,26,26,0.35)]">
        <div className="mx-auto mb-2 h-1.5 w-16 rounded-full bg-black/10" aria-hidden />
        <div className="overflow-hidden rounded-[6px] border border-black/5" style={{ background: PAPER }}>
          <div className="flex items-center gap-1.5 border-b border-black/5 bg-white px-3 py-2 text-[11px] text-neutral-500">
            <Link2 size={11} aria-hidden /> meeticulous.com/priya
          </div>

          <div className="px-4 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <div aria-hidden className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-heading text-base font-extrabold text-white" style={{ background: ORANGE_INK }}>PN</div>
              <div className="min-w-0">
                <div className="font-heading text-base font-extrabold text-[#2A1416]">Priya Nair</div>
                <div className="text-xs font-semibold" style={{ color: ORANGE_INK }}>Brand designer · Pune</div>
              </div>
            </div>
            <p className="mt-2 text-[12.5px] leading-snug text-neutral-600">I help small studios look as good as their work.</p>
            <div className="mt-2 flex gap-1.5 text-[10px] font-semibold text-neutral-600">
              {['Instagram', 'LinkedIn', 'Website'].map((x) => (
                <span key={x} className="rounded-full border border-black/10 bg-white px-2 py-0.5">{x}</span>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 px-3 pb-3" role="group" aria-label="Services on the demo booking page">
            {DEMO_SERVICES.map((svc, i) => {
              const on = i === active;
              return (
                <div key={svc.title} className="overflow-hidden rounded-[6px] border transition-colors" style={{ borderColor: on ? ORANGE : 'rgba(0,0,0,0.06)', background: on ? PEACH : '#fff' }}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => { setActive(i); setPaused(true); }}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                  >
                    <span>
                      <span className="block font-heading text-[13px] font-bold text-[#2A1416]">{svc.title}</span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-500">
                        <Clock size={10} aria-hidden /> {svc.mins} min · {svc.mode}
                      </span>
                    </span>
                    <span className="font-heading text-[13px] font-extrabold tabular-nums text-[#2A1416]">{svc.price}</span>
                  </button>
                  {on && (
                    <div className="px-3 pb-3" aria-live="polite">
                      <p className="flex gap-1.5 text-[12px] leading-snug text-neutral-700">
                        {svc.mode === 'Online' ? <Video size={12} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden /> : <MapPin size={12} className="mt-0.5 shrink-0 text-neutral-500" aria-hidden />}
                        {svc.desc}
                      </p>
                      <div className="mt-2 rounded-[6px] py-2 text-center text-[13px] font-semibold text-white" style={{ background: ORANGE_INK }}>
                        Book · {svc.price}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-neutral-500">Illustration of a host booking page. Tap a service.</p>
    </div>
  );
}

/* Without vs with: a plain link-in-bio list next to the booking page. */
function LinkInBioMock() {
  return (
    <div className="mx-auto w-full max-w-[17rem] rounded-[10px] border border-black/5 bg-white p-5 text-center shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
      <div aria-hidden className="mx-auto h-11 w-11 rounded-full bg-black/10" />
      <div className="mx-auto mt-2 h-2.5 w-24 rounded-full bg-black/10" aria-hidden />
      <div className="mt-4 space-y-2">
        {LINK_IN_BIO.map((l) => (
          <div key={l} className="rounded-[6px] border border-black/10 py-2 text-[12px] font-semibold text-neutral-500">{l}</div>
        ))}
      </div>
    </div>
  );
}

function BookingMiniMock() {
  return (
    <div className="mx-auto w-full max-w-[17rem] rounded-[10px] border bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.06)]" style={{ borderColor: `${ORANGE}4d` }}>
      <div className="flex items-center gap-3">
        <div aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full font-heading text-sm font-extrabold text-white" style={{ background: ORANGE_INK }}>PN</div>
        <div className="text-left">
          <div className="font-heading text-sm font-extrabold">Priya Nair</div>
          <div className="text-[11px] font-semibold" style={{ color: ORANGE_INK }}>Brand designer</div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        {DEMO_SERVICES.map((svc) => (
          <div key={svc.title} className="flex items-center justify-between rounded-[6px] border border-black/5 px-3 py-2 text-[12px]">
            <span className="font-semibold">{svc.title} <span className="font-normal text-neutral-500">· {svc.mins} min</span></span>
            <span className="font-heading font-extrabold tabular-nums">{svc.price}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-[6px] py-2 text-center text-[12px] font-semibold text-white" style={{ background: ORANGE_INK }}>Pick a time</div>
    </div>
  );
}

/* The difference: type a name, see the link wherever you would share it. */
function LinkEverywhere() {
  const [name, setName] = useState('Priya Nair');
  const slug = toLinkSlug(name);
  const ok = slug.length >= SLUG_MIN;
  const link = `meeticulous.com/${ok ? slug : 'yourname'}`;

  const places = [
    {
      label: 'Instagram bio',
      body: (
        <div className="text-[13px] leading-snug text-neutral-700">
          <div className="font-heading font-bold text-[#2A1416]">{name.trim() || 'Your name'}</div>
          Brand designer · Pune
          <div className="mt-1 font-semibold" style={{ color: ORANGE_INK }}>{link}</div>
        </div>
      ),
    },
    {
      label: 'WhatsApp reply',
      icon: MessageCircle,
      body: (
        <div className="ml-auto max-w-[15rem] rounded-[6px] bg-[#F1F5F9] px-3 py-2 text-[13px] leading-snug text-neutral-800">
          Hi! You can see my services and pick a time here: <span className="font-semibold underline" style={{ color: ORANGE_INK }}>{link}</span>
        </div>
      ),
    },
    {
      label: 'Email signature',
      icon: Mail,
      body: (
        <div className="border-l-2 pl-3 text-[13px] leading-snug text-neutral-700" style={{ borderColor: ORANGE }}>
          <div className="font-semibold text-[#2A1416]">{name.trim() || 'Your name'}</div>
          Book a session: <span className="font-semibold" style={{ color: ORANGE_INK }}>{link}</span>
        </div>
      ),
    },
    {
      label: 'Visiting card',
      icon: Phone,
      body: (
        <div className="rounded-[6px] px-4 py-3 text-white" style={{ background: INK }}>
          <div className="font-heading text-sm font-extrabold">{name.trim() || 'Your name'}</div>
          <div className="mt-2 text-[12px] text-white/75">{link}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="mt-12">
      <div className="mx-auto max-w-xl">
        <label htmlFor="bp-name" className="block text-sm font-semibold text-[#2A1416]">Type your name</label>
        <div className="mt-2 flex items-center gap-2 rounded-full border border-black/10 bg-white px-5 py-3 shadow-[0_8px_30px_rgba(26,26,26,0.05)]">
          <input
            id="bp-name"
            type="text"
            value={name}
            maxLength={60}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-transparent text-base text-[#2A1416] outline-none placeholder:text-neutral-400"
            placeholder="Your name or studio"
          />
        </div>
        <p className="mt-3 text-center text-sm text-neutral-600" aria-live="polite">
          Your link: <span className="font-heading font-extrabold" style={{ color: ORANGE_INK }} data-testid="bp-link">{link}</span>
          {!ok && <span className="block text-xs text-neutral-500">Usernames need {SLUG_MIN} to {SLUG_MAX} letters or numbers.</span>}
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 sm:gap-6">
        {places.map((p) => (
          <div key={p.label} className="rounded-[10px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
            <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ background: PEACH, color: ORANGE_INK }}>
              {p.icon && <p.icon size={11} aria-hidden />}{p.label}
            </span>
            <div className="mt-4">{p.body}</div>
          </div>
        ))}
      </div>
      <p className="mt-6 text-center text-[11px] text-neutral-500">Illustration. Whether a name is free is checked when you sign up.</p>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function BookingPagesFeature() {
  const canonical = `${SITE_URL}/features/booking-pages`;
  const seo = {
    title: 'Free Booking Page for Freelancers & Creators | Meeticulous',
    description: 'A free booking page at meeticulous.com/yourname with your photo, bio, socials and every service with its price. Clients pick a time and pay. Works as your link-in-bio.',
  };
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'Booking Pages',
    serviceType: 'Free online booking page for freelancers and creators',
    image: ogCard('features-booking-pages'),
    steps: STEPS.map((s) => ({ title: s.title, desc: s.desc })),
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  return (
    <main className="overflow-x-clip text-[#2A1416]" style={{ background: CREAM }}>
      <Seo
        title={seo.title}
        description={seo.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor={CREAM}
        ogTitle="Your link-in-bio, now it takes bookings."
        ogDescription={seo.description}
        image={ogCard('features-booking-pages')}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · HERO (phone-frame booking page) ═══════════════ */}
      <section className="relative px-5 pb-20 pt-8 sm:px-8 lg:pb-24 lg:pt-6 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center">
        <div className="mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:gap-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs text-neutral-500">
              <Link to="/" className="text-neutral-500 hover:text-[#2A1416] hover:no-underline">Home</Link>
              <span aria-hidden className="mx-2">/</span>
              <span>Features</span>
              <span aria-hidden className="mx-2">/</span>
              <span aria-current="page" className="text-[#2A1416]">Booking pages</span>
            </nav>
            <Reveal instant className="mt-5">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-700 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                <Sparkle className="h-3 w-3" /> For freelancers, coaches and creators
              </span>
            </Reveal>
            <Reveal as="h1" instant delay={0.03} className="mt-4 font-heading text-[clamp(2.5rem,4.8vw,4.1rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#2A1416]">
              A free booking page that{' '}
              <span className="relative inline-block whitespace-nowrap" style={{ color: ORANGE_INK }}>
                feels like you.
                <Squiggle className="absolute -bottom-2 left-0 h-3 w-full" />
              </span>
            </Reveal>
            <Reveal as="p" instant delay={0.06} className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600 lg:text-lg">
              Your photo, bio, socials and every service with its price, at meeticulous.com/yourname. Clients pick a time and pay right there. Put it in your Instagram bio and let it do the asking.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta>Claim your free link <ArrowRight size={16} /></PrimaryCta>
              <Link to={DEMO} className="inline-flex items-center gap-1.5 text-sm font-semibold hover:no-underline hover:opacity-80" style={{ color: ORANGE_INK }}>
                See a live booking page <ArrowRight size={15} />
              </Link>
            </Reveal>
          </div>

          <Reveal instant delay={0.12} className="relative">
            <BookingPageDemo />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 2 · PROOF (row of pill chips, product facts only) ═══════════════ */}
      <section className="border-y border-black/5 px-5 py-8 sm:px-8" style={{ background: PAPER }}>
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2.5">
          {PROOF.map((p, i) => (
            <li key={p} className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-[13px] font-semibold text-neutral-700 shadow-[0_8px_30px_rgba(26,26,26,0.03)]">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: i === 0 ? ORANGE : INK }} />
              {p}
            </li>
          ))}
        </ul>
      </section>

      {/* ═══════════════ 3 · WITHOUT vs WITH (link-in-bio list vs booking page) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <Reveal as="h2" className="mx-auto max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              A list of links is not <span style={{ color: ORANGE_INK }}>a way to book you.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-600">
              A link-in-bio page sends people somewhere else to ask. A booking page lets them see the price, pick a time and pay in one go.
            </Reveal>
          </div>

          <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-12">
            <Reveal>
              <div className="mb-5 text-center">
                <span className="rounded-full border border-black/10 bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">Link-in-bio list</span>
              </div>
              <LinkInBioMock />
              <ul className="mx-auto mt-7 max-w-sm space-y-2.5">
                {WITHOUT.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[15px] text-neutral-500">
                    <X size={16} className="mt-1 shrink-0" aria-hidden /><span><span className="sr-only">Without: </span>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.06}>
              <div className="mb-5 text-center">
                <span className="rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em]" style={{ background: PEACH, color: ORANGE_INK }}>Your booking page</span>
              </div>
              <BookingMiniMock />
              <ul className="mx-auto mt-7 max-w-sm space-y-2.5">
                {WITH.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[15px] font-medium text-[#2A1416]">
                    <Check size={16} className="mt-1 shrink-0" style={{ color: ORANGE_INK }} aria-hidden /><span><span className="sr-only">With Meeticulous: </span>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (zig-zag joined by doodle arrows) ═══════════════ */}
      <section id="how" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28" style={{ background: PAPER }}>
        <div className="mx-auto max-w-4xl">
          <Reveal as="h2" className="text-center font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            From sign-up to <span style={{ color: ORANGE_INK }}>first booking.</span>
          </Reveal>
          <ol className="mt-16">
            {STEPS.map((s, i) => {
              const right = i % 2 === 1;
              return (
                <Reveal as="li" key={s.title} delay={i * 0.04} className="relative">
                  <div className={`flex ${right ? 'md:justify-end' : 'md:justify-start'}`}>
                    <div className="flex w-full items-start gap-5 rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] md:w-[62%]">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-heading text-lg font-extrabold text-[#2A1416]" style={{ background: PEACH }}>{i + 1}</span>
                      <div>
                        <h3 className="font-heading text-xl font-bold">{s.title}</h3>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-neutral-600">{s.desc}</p>
                      </div>
                    </div>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex py-2 ${right ? 'md:justify-start md:pl-[28%]' : 'md:justify-end md:pr-[28%]'} justify-center`}>
                      <CurvedArrow className="h-14 w-24" flip={right} />
                    </div>
                  )}
                </Reveal>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ═══════════════ 5 · CAPABILITIES (static, slightly rotated sticker cards) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Small things that make <span style={{ color: ORANGE_INK }}>a page bookable.</span>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {STICKERS.map((c, i) => (
              <Reveal key={c.title} delay={(i % 3) * 0.05}>
                <div
                  className="h-full rounded-[10px] border border-black/5 bg-white p-7 shadow-[0_12px_34px_-14px_rgba(26,26,26,0.18)]"
                  style={{ transform: `rotate(${c.tilt}deg)` }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: PEACH, color: ORANGE_INK }}><c.icon size={18} aria-hidden /></span>
                  <h3 className="mt-4 font-heading text-lg font-bold">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-12">
            <ImgSlot slot="booking-pages-real-host-page" alt="A real Meeticulous host booking page on a phone, showing photo, bio and services" className="mx-auto aspect-[16/9] w-full max-w-3xl" />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · THE DIFFERENCE (type your name, see your link everywhere) ═══════════════ */}
      <section id="your-link" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28" style={{ background: PEACH }}>
        <div className="mx-auto max-w-4xl">
          <div className="relative text-center">
            <Sparkle className="absolute -top-6 left-[12%] hidden h-6 w-6 sm:block" color={ORANGE_INK} />
            <Reveal as="h2" className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              One link. <span style={{ color: ORANGE_INK }}>Everywhere you already are.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-700">
              The same short link goes in your bio, your replies, your signature and your card, and it always opens the page where people book.
            </Reveal>
          </div>
          <LinkEverywhere />
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (sticky notes) ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal as="h2" className="text-center font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Hosts on <span style={{ color: ORANGE_INK }}>their link.</span>
            </Reveal>
            <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {QUOTES.map((t, i) => (
                <Reveal as="figure" key={t.name} delay={i * 0.05}>
                  <div
                    className="relative flex h-full flex-col rounded-[4px] p-6 pt-8 shadow-[0_14px_30px_-16px_rgba(26,26,26,0.25)]"
                    style={{ background: i % 2 ? '#F7EAD3' : PEACH, transform: `rotate(${i % 2 ? 1.4 : -1.4}deg)` }}
                  >
                    <span aria-hidden className="absolute -top-2.5 left-1/2 h-5 w-16 -translate-x-1/2 rotate-[-3deg] rounded-[2px] bg-white/70 shadow-[0_2px_6px_rgba(26,26,26,0.08)]" />
                    <blockquote className="flex-1 text-[15px] leading-relaxed text-[#2A1416]">&ldquo;{t.quote}&rdquo;</blockquote>
                    <figcaption className="mt-5 flex items-center gap-3">
                      <img src={t.avatar} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
                      <div>
                        <div className="text-sm font-semibold">{t.name}</div>
                        <div className="text-xs text-neutral-600">{t.role}</div>
                      </div>
                    </figcaption>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ 8 · FAQ (accordion of pill rows) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: PAPER }}>
        <div className="mx-auto max-w-3xl">
          <Reveal as="h2" className="text-center font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Booking page <span style={{ color: ORANGE_INK }}>questions.</span>
          </Reveal>
          <div className="mt-12 space-y-3">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-full border border-black/5 bg-white px-6 py-3.5 shadow-[0_8px_30px_rgba(26,26,26,0.04)] transition-colors hover:border-black/15 group-open:border-[#960D32]/30 group-open:bg-[#FBE3E8] [&::-webkit-details-marker]:hidden">
                  <span className="font-heading text-[16px] font-bold">{f.q}</span>
                  <span aria-hidden className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#2A1416] text-base leading-none text-white transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-6 pb-3 pt-4 text-[15px] leading-relaxed text-neutral-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · FINAL CTA ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-20 text-[#FBF4E6] sm:px-8 lg:py-28" style={{ background: INK }}>
        <Sparkle className="absolute left-[8%] top-12 h-7 w-7" />
        <Sparkle className="absolute bottom-16 right-[10%] h-5 w-5" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Reveal as="h2" className="font-heading text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#FBF4E6]">
              Claim meeticulous.com/<span className="relative inline-block" style={{ color: ORANGE }}>yourname<Squiggle className="absolute -bottom-2 left-0 h-3 w-full" /></span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mt-7 max-w-xl text-base leading-relaxed text-[#FBF4E6]/75">
              Set up your page free on {FREE_PLAN.name}. Add a service, share the link, and the next person who asks &ldquo;how do I book you?&rdquo; already has the answer.
            </Reveal>
            <Reveal delay={0.1} className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta onDark>Claim your free link <ArrowRight size={16} /></PrimaryCta>
              <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FBF4E6] hover:no-underline hover:opacity-80">
                See pricing <ArrowRight size={15} />
              </Link>
            </Reveal>
          </div>
          <Reveal delay={0.08}>
            <div className="rounded-[10px] border border-white/10 p-2">
              <ImgSlot slot="booking-pages-creator-sharing" alt="A creator adding their booking link to their Instagram bio on a phone" className="aspect-[4/3] w-full border-white/10" />
            </div>
          </Reveal>
        </div>
        <nav aria-label="Related features" className="relative mx-auto mt-16 flex max-w-6xl flex-wrap items-center gap-2.5 border-t border-white/10 pt-8 text-sm">
          <span className="mr-1 text-[#FBF4E6]/55">Works with</span>
          {RELATED.map((r) => (
            <Link key={r.to} to={r.to} className="rounded-full border border-white/15 px-3.5 py-1.5 text-[#FBF4E6]/85 transition-colors hover:border-white/40 hover:text-[#FBF4E6] hover:no-underline">{r.label}</Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
