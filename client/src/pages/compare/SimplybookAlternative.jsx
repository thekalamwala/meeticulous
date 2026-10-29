// /compare/simplybook-alternative — SimplyBook.me vs Meeticulous (Oct 2026 rebuild).
//
// Design system "Sky & Ink": pale sky + deep navy ink, Meeticulous orange on CTAs,
// a meter/gauge motif. Mechanics unique to this page: hero free-plan gauge ·
// interactive booking-cap meter (range slider, deterministic default) · stepped
// progress rail for the switch.
//
// HONESTY: every SimplyBook.me fact reads from data/competitors.js (checked against
// their pricing page; null renders "Not listed", never "No"). Their prices stay as
// published, in euros: never converted to ₹. Every Meeticulous price and commission
// reads from data/plans.js. Testimonials are the real, consented TESTIMONIALS.
//
// Global Navbar + Footer come from App.jsx. No images except the competitor favicon.
// No scroll-reveal, no hover uplift; the h1 paints on first frame (LCP).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, X, Gauge as GaugeIcon, IndianRupee, Receipt, Wallet,
  CreditCard, Layers, CalendarClock, LogIn, Share2, Info, Plus,
} from 'lucide-react';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, comparisonGraphJsonLd } from '../../utils/seo';
import useUtm from '../../hooks/useUtm';
import { analytics, EVENTS } from '../../services/analytics';
import { COMPETITORS, COMPETITOR_LIST, CHECKED_LABEL } from '../../data/competitors';
import { FREE_PLAN, PREMIUM_PLAN, PLAN_MATRIX } from '../../data/plans';
import { TESTIMONIALS } from '../../data/testimonials';

const SLUG = 'simplybook-alternative';
const START = '/be-a-sloth';
const SB = COMPETITORS.simplybook;
const CANONICAL = `${SITE_URL}${SB.path}`;

/* ─────────────────────────────  FACTS (derived, never typed)  ───────────────────────────── */

const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const commission = PLAN_MATRIX.flatMap((g) => g.rows).find((r) => r.label === 'Commission on your bookings');
const FREE = FREE_PLAN.name;
const PREM = PREMIUM_PLAN.name;
const MONTHLY = inr(PREMIUM_PLAN.monthly);
const YEARLY = inr(PREMIUM_PLAN.yearly);

// ponytail: the cap is parsed from the published free-plan line ("Yes: 50 bookings / month, 1 provider")
// so a re-check stays one edit in competitors.js; the page test pins the parsed value.
const SB_FREE = SB.freePlan.replace(/^Yes:\s*/, '');
const CAP = Number(SB.freePlan.match(/(\d+)\s*bookings/)?.[1]);
const TRIAL = SB.trial.replace(/(\d+) days/, '$1-day'); // "14 days" → "14-day"

const METER_MAX = 200;
const METER_DEFAULT = 40;

/* ─────────────────────────────  PALETTE  ───────────────────────────── */

const C = { sky: '#EAF3FB', skyDeep: '#CFE2F3', navy: '#12233F', navySoft: '#46587A', steel: '#3B6EA8', orange: '#0079C1', onDark: '#FF9A66' };
const THEME = { '--sky': C.sky, '--sky-deep': C.skyDeep, '--navy': C.navy, '--navy-soft': C.navySoft, '--steel': C.steel };
const CARD = 'rounded-[6px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(18,35,63,0.05)]';
const H2 = 'font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-[color:var(--navy)] sm:text-5xl';
const LINK = 'font-semibold text-[color:var(--navy)] underline underline-offset-2 hover:text-primary-cta';

/* ─────────────────────────────  CONTENT  ───────────────────────────── */

const SEO = {
  title: 'SimplyBook.me Alternative for India (UPI, ₹) | Meeticulous',
  description: `SimplyBook.me's free plan stops at ${CAP} bookings a month. Meeticulous's free plan has no booking cap, takes UPI at booking and bills in rupees with GST invoices.`,
};

// One-line verdict + 3 short reasons per side. Detail lives in the table and FAQ below.
const SHORT_ANSWER = `Over ${CAP} bookings a month, or clients pay by UPI? Pick Meeticulous. Under ${CAP} and want no commission? Pick ${SB.name}.`;

const PICK_SB = [
  `You stay under ${CAP} bookings a month`,
  "You need a specific international gateway",
  "You want no commission on bookings",
];
const PICK_BAS = [
  `You get more than ${CAP} bookings a month`,
  "Clients pay by UPI at booking",
  "You want rupee billing with GST invoices",
];

// Table rows: [label, Meeticulous (plans.js / verified facts), SimplyBook.me (competitors.js)].
const ROWS = [
  ['Free plan', `Yes: unlimited bookings, ${commission.free} commission`, SB.freePlan],
  ['Bookings a month on the free plan', 'No cap', `Up to ${CAP}`],
  ['Paid plan from', `${MONTHLY} / month (${YEARLY} / year)`, SB.paidFrom],
  ['Billing currency', 'INR, GST included', SB.currency],
  ['Commission on bookings', `${commission.free} on ${FREE}, ${commission.premium} on ${PREM}`, SB.commission],
  ['Taking payments', 'UPI and cards, through Razorpay', SB.payments],
  ['UPI at booking', true, SB.upi],
  ['WhatsApp reminders', `Yes, on ${PREM} (first 2 months on ${FREE})`, SB.whatsapp],
  ['Free trial', `Not needed: ${FREE} is free`, SB.trial],
];

const DIFFERENT = [
  {
    icon: IndianRupee, title: 'UPI at checkout, no gateway of your own',
    body: 'Clients pay by UPI or card through Razorpay when they book, on both plans. Meeticulous collects the payment and settles it to your Indian bank account after a one-time KYC.',
    link: { to: '/features/payments', label: 'How payments work' },
  },
  {
    icon: Receipt, title: 'Rupee pricing and GST invoices',
    body: `${PREM} is ${MONTHLY} a month or ${YEARLY} a year, GST included. Every paid booking gets a GST invoice, on both plans.`,
    link: { to: '/pricing', label: 'See both plans' },
  },
  {
    icon: GaugeIcon, title: 'No booking cap on either plan',
    body: `Unlimited services and bookings on ${FREE} and ${PREM}. ${FREE} is free with ${commission.free} commission per paid booking; ${PREM} takes ${commission.premium}.`,
  },
  {
    icon: Wallet, title: 'Every fee, written down',
    body: `Clients pay a flat ₹10 + GST booking fee on top of your price. The gateway charge (about 2%) is passed through at cost, and TDS 1% + TCS 1% are deducted on payout. On ₹1,000 at ${commission.premium} commission you receive ₹959.76.`,
    link: { to: '/host-fees', label: 'Read the host fees' },
  },
];

const BETTER = [
  { icon: Check, title: 'A free plan, with no commission', body: `SimplyBook.me's free plan covers ${SB_FREE}, and SimplyBook.me takes no commission on bookings. If you stay under ${CAP} bookings a month, the free plan may be all you need.` },
  { icon: CreditCard, title: 'More payment gateways', body: `It connects to ${SB.payments}. That helps if you already have one of those accounts, or take clients outside India.` },
  { icon: Layers, title: `A ${TRIAL} trial of paid features`, body: `You can try its paid plans for ${SB.trial} before deciding. Paid plans start at ${SB.paidFrom}.` },
];

const STEPS = [
  { icon: LogIn, title: 'Sign in with Google', body: 'Hosts sign in with their Google account. There is no separate password to set up.' },
  { icon: CalendarClock, title: 'Add your services and availability', body: 'Set your prices (paid services start at ₹100), durations and the hours you take bookings. Google Calendar and Meet work on both plans.' },
  { icon: Share2, title: 'Share your link', body: 'Put your booking page link in your bio, on WhatsApp or in email. Clients pick a slot and pay by UPI or card.' },
];

const QUOTES = ['Arjun Ravikumar', 'Vishal Chaware', 'Dr. Yukta Bawankar']
  .map((n) => TESTIMONIALS.find((t) => t.name === n))
  .filter(Boolean);

export const FAQ = [
  {
    q: 'Is SimplyBook.me free?',
    a: `Yes. SimplyBook.me's pricing page lists a free plan: ${SB_FREE}. Above that you need a paid plan, from ${SB.paidFrom}, and it offers a ${TRIAL} trial of paid features. Meeticulous's free ${FREE} plan has no booking cap and takes ${commission.free} commission per paid booking.`,
  },
  {
    q: "What is SimplyBook.me's free plan limit?",
    a: `SimplyBook.me's free plan is limited to ${SB_FREE}. Once you go past ${CAP} bookings in a month you would need a paid plan, which starts at ${SB.paidFrom}. Meeticulous has no monthly booking cap on either plan: ${FREE} is free with ${commission.free} commission, and ${PREM} costs ${MONTHLY} a month with ${commission.premium} commission.`,
  },
  {
    q: 'How much does SimplyBook.me cost in India?',
    a: `SimplyBook.me publishes its prices in euros, from ${SB.paidFrom}. SMS and WhatsApp reminders are ${SB.sms.toLowerCase()}. Meeticulous bills in rupees with GST included: ${FREE} is ₹0 a month with ${commission.free} commission per paid booking, and ${PREM} is ${MONTHLY} a month or ${YEARLY} a year with ${commission.premium} commission. Clients pay a ₹10 + GST booking fee on each paid booking.`,
  },
  {
    q: 'Does SimplyBook.me support UPI payments?',
    a: `SimplyBook.me's pricing page doesn't list UPI. It lists ${SB.payments}. Meeticulous takes UPI and cards through Razorpay at the moment of booking, on both plans, and settles the money to your Indian bank account after a one-time KYC, so you don't need a payment gateway account of your own.`,
  },
  {
    q: 'Does SimplyBook.me send WhatsApp reminders?',
    a: `Yes, as an add-on. SimplyBook.me's pricing page lists WhatsApp reminders as ${SB.whatsapp.toLowerCase()} and SMS reminders as ${SB.sms.toLowerCase()}. On Meeticulous, WhatsApp reminders are part of ${PREM}. On the free ${FREE} plan you get WhatsApp reminders for your first 2 months, then reminders go by email.`,
  },
  {
    q: "What's the cheapest SimplyBook.me alternative in India?",
    a: `Meeticulous's ${FREE} plan costs ₹0 a month, with no booking cap and ${commission.free} commission per paid booking. If you take a lot of paid bookings, ${PREM} at ${MONTHLY} a month with ${commission.premium} commission can cost less than the ${commission.free} would. Either way, clients pay a ₹10 + GST booking fee on each paid booking.`,
  },
  {
    q: 'Do I need my own payment gateway account with Meeticulous?',
    a: `No. Meeticulous collects UPI and card payments through Razorpay and settles them to your Indian bank account after a one-time KYC. The gateway charge (about 2%) is passed through at cost, and TDS 1% and TCS 1% are deducted on payout. On a ₹1,000 booking at ${commission.premium} commission, you receive ₹959.76.`,
  },
  {
    q: 'Can I move from SimplyBook.me to Meeticulous?',
    a: `Yes. Sign in with Google, add your services and availability, and share your new booking link with clients. Paid services need a price of ₹100 or more. Both plans include unlimited services and bookings, Google Calendar and Meet, and GST invoices, so you can start on the free ${FREE} plan and move to ${PREM} later.`,
  },
];

const RELATED = COMPETITOR_LIST.filter((c) => c.key !== 'simplybook');
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

/* ─────────────────────────────  PIECES  ───────────────────────────── */

function StartCta({ slot, children = 'Start free' }) {
  const utm = useUtm();
  return (
    <Link
      to={START}
      onClick={() => analytics.track(EVENTS.LP_CTA_CLICKED, { slug: SLUG, slot, ...utm })}
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[6px] bg-primary px-5 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(194,61,0,0.22)] transition-opacity hover:text-white hover:no-underline hover:opacity-90"
    >
      {children} <ArrowRight size={16} aria-hidden="true" />
    </Link>
  );
}

// Semicircle meter, 0 → METER_MAX bookings a month. Thick steel zone = SimplyBook.me's free cap;
// thin orange outer arc = Meeticulous's free plan, which runs the whole dial. Decorative: the
// numbers it shows are always repeated in text next to it.
const CX = 120, CY = 116, R = 92;
const pt = (v, r) => {
  const a = Math.PI * (1 - Math.min(Math.max(v, 0), METER_MAX) / METER_MAX);
  return [+(CX + r * Math.cos(a)).toFixed(2), +(CY - r * Math.sin(a)).toFixed(2)];
};
const arc = (from, to, r) => {
  const [x1, y1] = pt(from, r); const [x2, y2] = pt(to, r);
  return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`;
};

function Gauge({ value, label, sub }) {
  const over = value != null && value > CAP;
  const [px1, py1] = value != null ? pt(value, R - 16) : [];
  const [px2, py2] = value != null ? pt(value, R + 16) : [];
  const [cx, cy] = pt(CAP, R - 30);
  return (
    <svg viewBox="0 0 240 132" className="h-auto w-full" aria-hidden="true" focusable="false">
      <path d={arc(0, METER_MAX, R + 15)} fill="none" stroke={C.orange} strokeWidth="3" strokeLinecap="round" />
      <path d={arc(0, METER_MAX, R)} fill="none" stroke={C.skyDeep} strokeWidth="14" strokeLinecap="round" />
      <path d={arc(0, CAP, R)} fill="none" stroke={C.steel} strokeWidth="14" strokeLinecap="round" />
      {[0, 50, 100, 150, 200].map((t) => {
        const [x1, y1] = pt(t, R - 11); const [x2, y2] = pt(t, R - 17);
        return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.navySoft} strokeWidth="1.5" />;
      })}
      <text x={cx} y={cy} fontSize="10" fontWeight="700" fill={C.steel} textAnchor="middle">{CAP} cap</text>
      {value != null && (
        <>
          <line x1={px1} y1={py1} x2={px2} y2={py2} stroke={over ? C.orange : C.navy} strokeWidth="4" strokeLinecap="round" />
          <circle cx={pt(value, R)[0]} cy={pt(value, R)[1]} r="5" fill="#fff" stroke={over ? C.orange : C.navy} strokeWidth="2.5" />
        </>
      )}
      <text x={CX} y={CY - 14} fontSize="26" fontWeight="800" fill={C.navy} textAnchor="middle" fontFamily="'Plus Jakarta Sans', sans-serif">{label}</text>
      <text x={CX} y={CY + 4} fontSize="10" fill={C.navySoft} textAnchor="middle">{sub}</text>
    </svg>
  );
}

const Swatch = ({ color, thin }) => (
  <span aria-hidden="true" className={`inline-block w-5 shrink-0 rounded-full ${thin ? 'h-[3px]' : 'h-2.5'}`} style={{ background: color }} />
);

function Cell({ value }) {
  if (value === true) return <span className="inline-flex items-center gap-1.5 font-semibold"><Check size={15} className="text-emerald-700" aria-hidden="true" />Yes</span>;
  if (value === false) return <span className="inline-flex items-center gap-1.5"><X size={15} aria-hidden="true" />No</span>;
  if (value == null) return <span className="text-[color:var(--navy-soft)]">Not listed</span>;
  return <span>{value}</span>;
}

function BookingMeter() {
  const [n, setN] = useState(METER_DEFAULT);
  const over = n > CAP;
  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-8">
      <div className={`${CARD} p-6 sm:p-8`}>
        <div className="flex items-end justify-between gap-4">
          <label htmlFor="bookings-per-month" className="text-sm font-semibold text-[color:var(--navy)]">Bookings per month</label>
          <output htmlFor="bookings-per-month" aria-live="off" className="font-heading text-4xl font-extrabold tabular-nums text-[color:var(--navy)]">{n}</output>
        </div>
        <input
          id="bookings-per-month"
          type="range"
          min="0"
          max={METER_MAX}
          step="1"
          value={n}
          onChange={(e) => setN(Number(e.target.value))}
          aria-valuetext={`${n} bookings per month`}
          className="mt-3 h-11 w-full cursor-pointer border-0 bg-transparent p-0 accent-[#12233F]"
        />
        <div className="flex justify-between text-xs text-[color:var(--navy-soft)]" aria-hidden="true"><span>0</span><span>{CAP}</span><span>{METER_MAX}</span></div>
        <div className="mx-auto mt-6 max-w-sm"><Gauge value={n} label={n} sub="bookings a month" /></div>
        <ul className="mt-4 space-y-2 text-sm text-[color:var(--navy-soft)]">
          <li className="flex items-center gap-2"><Swatch color={C.steel} /> SimplyBook.me free plan: up to {CAP}</li>
          <li className="flex items-center gap-2"><Swatch color={C.orange} thin /> Meeticulous free plan: no cap</li>
        </ul>
      </div>

      <div className="grid gap-6">
        <div className={`${CARD} p-6 sm:p-8`}>
          <div className="flex items-center gap-3">
            <img src={favicon(SB.domain)} alt="" width="24" height="24" loading="lazy" className="h-6 w-6 rounded-full border border-black/5 bg-white p-0.5" />
            <h3 className="font-heading text-xl font-bold text-[color:var(--navy)]">{SB.name}</h3>
          </div>
          <p role="status" className={`mt-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${over ? 'bg-primary-light text-[#9A3A0A]' : 'bg-[color:var(--sky)] text-[color:var(--navy)]'}`}>
            {over ? 'Paid plan needed' : 'Free plan covers it'}
          </p>
          <p className="mt-3 min-h-[3.25rem] text-[15px] leading-relaxed text-[color:var(--navy-soft)]">
            {over
              ? `${n} is ${n - CAP} over the free plan's ${CAP}-booking cap. You'd need a paid plan, from ${SB.paidFrom}.`
              : `${n} of the free plan's ${CAP} bookings a month (${SB_FREE}).`}
          </p>
        </div>
        <div className={`${CARD} p-6 sm:p-8`}>
          <h3 className="font-heading text-xl font-bold text-[color:var(--navy)]">Meeticulous</h3>
          <p className="mt-4 inline-flex rounded-full bg-[color:var(--sky)] px-3 py-1 text-xs font-semibold text-[color:var(--navy)]">Free plan covers it</p>
          <p className="mt-3 text-[15px] leading-relaxed text-[color:var(--navy-soft)]">
            {FREE} has no booking cap, so {n} bookings stay on the free plan at {commission.free} commission per paid booking.
            Or move to {PREM} at {MONTHLY} a month for {commission.premium} commission.
          </p>
        </div>
        <p className="flex items-start gap-2 text-xs leading-relaxed text-[color:var(--navy-soft)]">
          <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
          SimplyBook.me prices as published, in euros. See their pricing page for what each paid plan includes.
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ───────────────────────────── */

const SimplybookAlternative = () => {
  const utm = useUtm();

  useEffect(() => {
    analytics.page({ lp: SLUG });
    analytics.track(EVENTS.LP_VIEWED, { slug: SLUG, ...utm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="overflow-x-clip bg-white text-[color:var(--navy)]" style={THEME}>
      <Seo
        title={SEO.title}
        description={SEO.description}
        image={ogCard('lp-simplybook-alternative')}
        canonical={CANONICAL}
        jsonLd={comparisonGraphJsonLd({
          canonical: CANONICAL,
          name: SEO.title,
          description: SEO.description,
          breadcrumbName: 'SimplyBook Alternative',
          faqs: FAQ,
        })}
      />

      {/* ═══════════════ 1 · HERO ═══════════════ */}
      <section className="bg-[linear-gradient(180deg,var(--sky)_0%,#ffffff_100%)] px-5 pb-16 pt-6 sm:px-8 sm:pt-10 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center lg:py-12">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:gap-14">
          <div>
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[color:var(--navy-soft)]">
                <li><Link to="/" className="inline-block py-1 text-[color:var(--navy-soft)] hover:text-[color:var(--navy)] hover:no-underline">Home</Link></li>
                <li aria-hidden="true">›</li>
                <li><Link to="/compare" className="inline-block py-1 text-[color:var(--navy-soft)] hover:text-[color:var(--navy)] hover:no-underline">Compare</Link></li>
                <li aria-hidden="true">›</li>
                <li aria-current="page" className="font-medium text-[color:var(--navy)]">SimplyBook Alternative</li>
              </ol>
            </nav>
            <h1 className="mt-3 font-heading font-extrabold leading-[1.06] tracking-tight text-[color:var(--navy)]" style={{ fontSize: 'clamp(2.1rem,3.7vw,3.2rem)' }}>
              SimplyBook.me alternative with <span className="text-primary-cta">no booking cap</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[color:var(--navy-soft)] sm:text-[17px]">
              Meeticulous is a SimplyBook.me alternative built for India. Its free {FREE} plan has no monthly
              booking cap (SimplyBook.me&rsquo;s free plan covers {CAP}), takes UPI and cards at booking, sends GST
              invoices and bills in rupees. You pay {commission.free} per paid booking, or {MONTHLY} a month
              on {PREM} for {commission.premium} commission.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StartCta slot="hero" />
              <a href="#side-by-side" className="inline-flex min-h-[44px] items-center rounded-[6px] border border-[color:var(--sky-deep)] bg-white px-4 py-3 text-sm font-semibold text-[color:var(--navy)] hover:text-[color:var(--navy)] hover:no-underline hover:opacity-90">
                See the comparison
              </a>
            </div>
            <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[color:var(--navy-soft)]">
              <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[color:var(--steel)]" aria-hidden="true" />Free plan, no booking cap</span>
              <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[color:var(--steel)]" aria-hidden="true" />UPI via Razorpay</span>
              <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[color:var(--steel)]" aria-hidden="true" />Facts checked {CHECKED_LABEL}</span>
            </p>
          </div>

          <div className={`${CARD} mx-auto w-full max-w-md p-6`}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--navy-soft)]">Free-plan booking meter</p>
              <span className="rounded-full bg-[color:var(--sky)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--navy)]">per month</span>
            </div>
            <div className="mt-4"><Gauge label="No cap" sub={`on the free ${FREE} plan`} /></div>
            <ul className="mt-4 space-y-3 border-t border-black/5 pt-4 text-sm">
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[color:var(--navy-soft)]"><Swatch color={C.steel} />SimplyBook.me free plan</span>
                <span className="font-heading font-bold">Up to {CAP}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[color:var(--navy-soft)]"><Swatch color={C.orange} thin />Meeticulous free plan</span>
                <span className="font-heading font-bold">No cap</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* ═══════════════ 2 · THE SHORT ANSWER ═══════════════ */}
      <section id="short-answer" aria-labelledby="short-answer-title" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 id="short-answer-title" className={H2}>The short <span className="text-primary-cta">answer</span></h2>
          <div className={`${CARD} mt-8 p-6 sm:p-8`}>
            <p className="font-heading text-lg font-bold leading-snug text-[color:var(--navy)] sm:text-xl">{SHORT_ANSWER}</p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {[[`Pick ${SB.name} if…`, PICK_SB, C.steel], ['Pick Meeticulous if…', PICK_BAS, C.orange]].map(([title, items, color]) => (
              <div key={title} className="rounded-[6px] bg-[color:var(--sky)] p-6">
                <h3 className="font-heading text-lg font-bold text-[color:var(--navy)]">{title}</h3>
                <ul className="mt-4 space-y-3">
                  {items.map((t) => (
                    <li key={t} className="flex gap-2.5 text-[15px] leading-relaxed text-[color:var(--navy-soft)]">
                      <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />{t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 3 · SIDE BY SIDE ═══════════════ */}
      <section id="side-by-side" aria-labelledby="side-by-side-title" className="bg-[color:var(--sky)] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 id="side-by-side-title" className={`${H2} max-w-3xl`}>How much does SimplyBook.me cost <span className="text-primary-cta">in India?</span></h2>
            <p className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[color:var(--navy)]">Last checked {CHECKED_LABEL}</p>
          </div>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[color:var(--navy-soft)]">
            SimplyBook.me publishes its prices in euros; Meeticulous bills in rupees. &ldquo;Not listed&rdquo; means
            their pricing page doesn&rsquo;t say, not that they can&rsquo;t.
          </p>
          <div className={`${CARD} mt-10 overflow-x-auto`}>
            <table className="w-full min-w-[600px] border-collapse text-left text-sm">
              <caption className="sr-only">SimplyBook.me and Meeticulous compared: plans, prices, payments and reminders</caption>
              <thead>
                <tr className="border-b border-black/5">
                  <th scope="col" className="w-[30%] p-4 text-xs font-semibold uppercase tracking-wide text-[color:var(--navy-soft)]">What you get</th>
                  <th scope="col" className="w-[35%] bg-primary-light p-4 font-heading font-bold">Meeticulous</th>
                  <th scope="col" className="w-[35%] p-4 font-heading font-bold">
                    <span className="inline-flex items-center gap-2">
                      <img src={favicon(SB.domain)} alt="" width="20" height="20" loading="lazy" className="h-5 w-5 rounded-full" style={{ boxShadow: `0 0 0 2px ${SB.color}33` }} />
                      {SB.name}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, bas, sb]) => (
                  <tr key={label} className="border-b border-black/5 align-top last:border-0">
                    <th scope="row" className="p-4 font-semibold">{label}</th>
                    <td className="bg-primary-light/50 p-4"><Cell value={bas} /></td>
                    <td className="p-4 text-[color:var(--navy-soft)]"><Cell value={sb} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 text-xs leading-relaxed text-[color:var(--navy-soft)]">
            Checked against SimplyBook.me&rsquo;s pricing page in {CHECKED_LABEL}. Prices as published, in their currency.{' '}
            <a href={SB.source} target="_blank" rel="noopener noreferrer nofollow" className="text-[color:var(--navy-soft)] underline underline-offset-2 hover:text-[color:var(--navy)]">
              Source: SimplyBook.me pricing page
            </a>
            . SimplyBook.me is a trademark of its owner. Meeticulous isn&rsquo;t affiliated with SimplyBook.me.
          </p>
        </div>
      </section>

      {/* ═══════════════ 4 · WHAT'S DIFFERENT ═══════════════ */}
      <section aria-labelledby="different-title" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 id="different-title" className={`${H2} max-w-3xl`}>What&rsquo;s different for hosts <span className="text-primary-cta">in India?</span></h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {DIFFERENT.map(({ icon: Icon, title, body, link }) => (
              <div key={title} className={`${CARD} flex flex-col p-6 sm:p-7`}>
                <span className="grid h-11 w-11 place-items-center rounded-full border border-[color:var(--sky-deep)] bg-[color:var(--sky)] text-[color:var(--steel)]">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3 className="mt-5 font-heading text-xl font-bold text-[color:var(--navy)]">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--navy-soft)]">{body}</p>
                {link && (
                  <Link to={link.to} className={`mt-4 inline-flex items-center gap-1.5 self-start py-1 text-sm ${LINK}`}>
                    {link.label} <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 5 · WHERE SIMPLYBOOK IS THE BETTER CHOICE ═══════════════ */}
      <section aria-labelledby="better-title" className="bg-[color:var(--navy)] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 id="better-title" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">
            Where SimplyBook.me is the <span style={{ color: C.onDark }}>better choice</span>
          </h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/75">
            For some setups it fits better. Here is where, going by its own pricing page.
          </p>
          <div className="mt-12 grid gap-5 md:grid-cols-3 md:gap-6">
            {BETTER.map(({ icon: Icon, title, body }) => (
              <div key={title} className="rounded-[6px] border border-white/10 bg-white/[0.04] p-6 sm:p-7">
                <Icon size={20} style={{ color: C.onDark }} aria-hidden="true" />
                <h3 className="mt-4 font-heading text-lg font-bold text-white">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/75">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 flex items-start gap-2 text-sm leading-relaxed text-white/75">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            Good to know: on SimplyBook.me, SMS reminders are {SB.sms.toLowerCase()} and WhatsApp reminders are {SB.whatsapp.toLowerCase()}.
          </p>
        </div>
      </section>

      {/* ═══════════════ 6 · BOOKING-CAP METER ═══════════════ */}
      <section aria-labelledby="meter-title" className="bg-[color:var(--sky)] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 id="meter-title" className={`${H2} max-w-3xl`}>How many bookings does SimplyBook.me&rsquo;s free plan <span className="text-primary-cta">cover?</span></h2>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[color:var(--navy-soft)]">
            Up to {CAP} a month. Set the meter to a typical month and see which plan you&rsquo;d need on each.
          </p>
          <BookingMeter />
        </div>
      </section>

      {/* ═══════════════ 7 · SWITCH IN 3 STEPS ═══════════════ */}
      <section aria-labelledby="switch-title" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 id="switch-title" className={`${H2} max-w-3xl`}>How do I switch from <span className="text-primary-cta">SimplyBook.me?</span></h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title}>
                <div className="flex items-center gap-3" aria-hidden="true">
                  <span className="font-heading text-sm font-extrabold tabular-nums text-[color:var(--steel)]">0{i + 1}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[color:var(--sky-deep)]">
                    <span className="block h-full rounded-full bg-[color:var(--steel)]" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
                  </span>
                </div>
                <Icon size={22} className="mt-6 text-[color:var(--navy)]" aria-hidden="true" />
                <h3 className="mt-3 font-heading text-xl font-bold text-[color:var(--navy)]">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--navy-soft)]">{body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-12"><StartCta slot="switch">Start free in 3 steps</StartCta></div>
        </div>
      </section>

      {/* ═══════════════ 8 · TESTIMONIALS ═══════════════ */}
      <section aria-labelledby="quotes-title" className="bg-[color:var(--sky)] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 id="quotes-title" className={H2}>What hosts <span className="text-primary-cta">say</span></h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3 md:gap-6">
            {QUOTES.map((t) => (
              <figure key={t.name} className={`${CARD} flex flex-col p-6 sm:p-7`}>
                <blockquote className="flex-1 text-[15px] leading-relaxed text-[color:var(--navy)]">&ldquo;{t.quote}&rdquo;</blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--sky)] font-heading text-sm font-bold text-[color:var(--navy)]">
                    {t.name.replace(/^(Dr|Ar)\.\s*/, '').split(' ').map((w) => w[0]).join('').slice(0, 2)}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-[color:var(--navy)]">{t.name}</span>
                    <span className="block text-xs text-[color:var(--navy-soft)]">{t.role}</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · FAQ ═══════════════ */}
      <section id="faq" aria-labelledby="faq-title" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className={H2}>SimplyBook.me questions, <span className="text-primary-cta">answered</span></h2>
          <div className="mt-10 space-y-3">
            {FAQ.map((f, i) => (
              <details key={f.q} className={`${CARD} group`} open={i === 0}>
                <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 p-5 [&::-webkit-details-marker]:hidden">
                  <h3 className="font-heading text-base font-bold text-[color:var(--navy)] sm:text-lg">{f.q}</h3>
                  <Plus size={18} className="shrink-0 text-[color:var(--steel)] transition-transform group-open:rotate-45" aria-hidden="true" />
                </summary>
                <p className="px-5 pb-5 text-[15px] leading-relaxed text-[color:var(--navy-soft)]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 10 · RELATED + FINAL CTA ═══════════════ */}
      <section aria-labelledby="related-title" className="border-t border-black/5 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 id="related-title" className="font-heading text-2xl font-extrabold text-[color:var(--navy)]">More comparisons</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RELATED.map((c) => (
              <li key={c.key}>
                <Link to={c.path} className={`${CARD} flex min-h-[56px] items-center gap-3 p-4 text-[color:var(--navy)] transition-colors hover:border-black/15 hover:no-underline`}>
                  <img src={favicon(c.domain)} alt="" width="24" height="24" loading="lazy" className="h-6 w-6 rounded-full border border-black/5 bg-white p-0.5" />
                  <span className="font-heading text-[15px] font-bold">Meeticulous vs {c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-8 text-sm leading-relaxed text-[color:var(--navy-soft)]">
            See <Link to="/compare" className={LINK}>every booking tool compared side by side</Link>, or read{' '}
            <Link to="/blog/best-appointment-booking-apps-india" className={LINK}>our guide to appointment booking apps in India</Link>.
          </p>
        </div>
      </section>

      <section aria-labelledby="final-title" className="bg-[color:var(--navy)] px-5 py-20 sm:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 id="final-title" className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">
            Start free, with <span style={{ color: C.onDark }}>no booking cap</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/75">
            {FREE} is free with {commission.free} commission per paid booking. {PREM} is {MONTHLY} a month for {commission.premium} commission.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <StartCta slot="final" />
            <Link to="/pricing" className="inline-flex min-h-[44px] items-center py-3 text-sm font-semibold text-white underline underline-offset-2 hover:text-white hover:opacity-90">
              Compare {FREE} and {PREM} pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default SimplybookAlternative;
