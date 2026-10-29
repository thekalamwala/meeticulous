// /compare/zoho-bookings-alternative — Meeticulous vs Zoho Bookings.
//
// Design system "Crimson & Cream": warm cream paper, charcoal ink, a deep
// crimson used sparingly, Meeticulous orange for CTAs. Motif: flow diagrams
// joined by dashed connector lines. Page mechanic: "Who handles the payment?",
// a two-lane flow (Zoho Bookings vs Meeticulous) with a toggle.
//
// HONESTY: every Zoho Bookings fact reads from data/competitors.js
// (COMPETITORS.zoho); every Meeticulous price / commission reads from
// data/plans.js. Fee facts (₹10 + GST booking fee, ~2% gateway at cost,
// TDS 1% + TCS 1%, ₹100 minimum) are the published /host-fees numbers.
// Testimonials are verbatim from data/testimonials.js. No images except a
// competitor favicon. No scroll animation: the h1 is the LCP element.
//
// Global Navbar (57px) + Footer come from App.jsx.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, CalendarPlus, Smartphone, Receipt, Landmark, LogIn, Share2,
  MessageCircle, Gift, Plug, Users, Check,
} from 'lucide-react';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, comparisonGraphJsonLd } from '../../utils/seo';
import useUtm from '../../hooks/useUtm';
import { analytics, EVENTS } from '../../services/analytics';
import { COMPETITORS, COMPETITOR_LIST, CHECKED_LABEL } from '../../data/competitors';
import { FREE_PLAN, PREMIUM_PLAN, PLAN_MATRIX } from '../../data/plans';
import { TESTIMONIALS } from '../../data/testimonials';

const SLUG = 'zoho-bookings-alternative';
const START = '/be-a-sloth';
const Z = COMPETITORS.zoho;

const THEME = {
  '--zb-paper': '#FBF6EE',   // warm cream page
  '--zb-cream': '#F2E8D8',   // alt section
  '--zb-ink': '#2A2523',     // charcoal
  '--zb-muted': '#5E5651',   // body text, 5.9:1 on cream
  '--zb-crimson': '#9B1B30', // sparing accent, 6.5:1 on cream
  '--zb-line': 'rgba(155,27,48,0.3)',
};

/* ─────────────────────────────  FACTS  ────────────────────────────── */

const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const lc1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const commission = PLAN_MATRIX.flatMap((g) => g.rows).find((r) => r.label === 'Commission on your bookings');
const Z_FREE = Z.freePlan.replace(/^Yes:\s*/, ''); // "1 user (Forever Free)"
const FREE_MO = inr(FREE_PLAN.monthly);
const PAID_MO = inr(PREMIUM_PLAN.monthly);
const PAID_YR = inr(PREMIUM_PLAN.yearly);
// ponytail: /host-fees worked example (₹1,000 at 0%: ~2% gateway on ₹1,011.80, TDS 1%, TCS 1%). Update if fees change.
const PAYOUT_ON_1000 = '₹959.76';
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

const TITLE = 'Zoho Bookings Alternative in India (UPI, GST) | Meeticulous';
const DESCRIPTION =
  'Compare Zoho Bookings with Meeticulous for India: USD vs rupee pricing, UPI via Razorpay, WhatsApp reminders, GST invoices and payouts to your own bank.';

// One-line verdict + 3 short reasons per side. Detail lives in the table and FAQ below.
const SHORT_ANSWER = `Working solo and want UPI without running a gateway? Pick Meeticulous. Already on Zoho apps, or need several users? Pick ${Z.name}.`;

const PICK_ZOHO = [
  "You already use Zoho apps",
  "Several people take bookings",
  "You already have a gateway account",
];
const PICK_BAS = [
  "You work on your own",
  "Clients pay by UPI at booking",
  "No payment gateway account to manage",
];

// [label, Meeticulous (plans.js / verified fees), Zoho Bookings (competitors.js)]
const ROWS = [
  ['Free plan', `Yes: unlimited services and bookings, ${commission.free} commission`, Z.freePlan],
  ['Paid plans from', `${PAID_MO} / month or ${PAID_YR} / year (${PREMIUM_PLAN.name})`, Z.paidFrom],
  ['Billing currency', 'INR, GST included', Z.currency],
  ['Commission on bookings', `${commission.free} on ${FREE_PLAN.name}, ${commission.premium} on ${PREMIUM_PLAN.name}`, Z.commission],
  ['Taking payments', 'UPI and cards through Razorpay, on both plans', Z.payments],
  ['UPI at booking', 'Yes, on both plans', Z.upi],
  ['Who collects the payment', 'Meeticulous, then settles to your Indian bank after a one-time KYC', 'Your own account with one of its payment integrations'],
  ['WhatsApp reminders', `Yes on ${PREMIUM_PLAN.name}. ${FREE_PLAN.name}: first 2 months, then email`, Z.whatsapp],
  ['Free trial', `Not needed: ${FREE_PLAN.name} is ${FREE_MO} a month`, Z.trial],
];

const DIFFERENT = [
  {
    title: 'UPI at booking, no gateway of your own',
    body: 'Clients pay by UPI or card through Razorpay on both plans. Meeticulous collects the money and settles it to your Indian bank account after a one-time KYC, so there is no payment gateway account for you to open or run.',
    link: { to: '/features/payments', label: 'How payments work on Meeticulous' },
  },
  {
    title: 'A GST invoice on every paid booking',
    body: 'Invoices are generated automatically on both plans, so you don’t have to type up receipts for clients.',
  },
  {
    title: 'Priced in rupees, GST included',
    body: `${FREE_PLAN.name} is ${FREE_MO} a month with ${commission.free} commission. ${PREMIUM_PLAN.name} is ${PAID_MO} a month or ${PAID_YR} a year with ${commission.premium} commission. Unlimited services and bookings on both.`,
    link: { to: '/pricing', label: 'See Meeticulous pricing' },
  },
  {
    title: 'Fees you can see up front',
    body: `Your client pays a flat ₹10 + GST booking fee per paid booking. The gateway charge (about 2%) is passed through at cost, and TDS 1% + TCS 1% are deducted on payout. On a ₹1,000 booking at ${commission.premium} commission you receive ${PAYOUT_ON_1000}. Paid services start at ₹100.`,
    link: { to: '/host-fees', label: 'Read the full host fee breakdown' },
  },
];

const ZOHO_WINS = [
  { icon: MessageCircle, title: 'WhatsApp reminders, built in', body: `Its pricing page lists WhatsApp reminders. On Meeticulous they come with ${PREMIUM_PLAN.name}; on ${FREE_PLAN.name} you get them for your first 2 months, then reminders go by email.` },
  { icon: Gift, title: 'A Forever Free plan for 1 user', body: `${Z.name} has a free plan for ${Z_FREE}${Z.commission === 'None' ? ', with no commission on bookings' : ''}. Meeticulous's free plan takes ${commission.free} of each paid booking instead.` },
  { icon: Plug, title: 'Many payment integrations', body: `It connects to ${Z.payments}. If you already run an account with one of them, you can keep using it.` },
  { icon: Users, title: 'If you already use Zoho apps', body: 'Your scheduling stays with the same company as the rest of your tools, and plans are priced per user for teams. Meeticulous is for one person taking bookings and has no multi-staff team accounts.' },
];

// "Who handles the payment?" — each step tagged with who does it.
const LANES = {
  zoho: {
    name: Z.name,
    summary: `On ${Z.name}, you handle the payment: you choose, open and run the gateway account the money goes into.`,
    steps: [
      { who: 'You', title: 'Pick a payment integration', body: `${Z.payments}.` },
      { who: 'You', title: 'Open an account with that gateway', body: 'You sign up with it directly and manage the account yourself.' },
      { who: 'You', title: `Connect it to ${Z.name}`, body: 'So clients can pay when they book.' },
      { who: 'Your client', title: 'Client pays at booking', body: `UPI works ${lc1(Z.upi)}.` },
      { who: 'Your gateway', title: 'Money lands in your gateway account', body: 'Settlements happen in the account you run.' },
    ],
  },
  bas: {
    name: 'Meeticulous',
    summary: 'On Meeticulous, we handle the payment: we collect it, send the GST invoice and settle it to your bank. Your part is a one-time KYC.',
    steps: [
      { who: 'You', title: 'Sign in with Google, finish a one-time KYC', body: 'No payment gateway account to open.' },
      { who: 'Your client', title: 'Client pays by UPI or card at booking', body: 'Through Razorpay, on both plans.' },
      { who: 'Meeticulous', title: 'Meeticulous collects the payment', body: 'It never passes through an account you run.' },
      { who: 'Meeticulous', title: 'A GST invoice goes out automatically', body: 'On both plans.' },
      { who: 'Meeticulous', title: 'Settled to your Indian bank account', body: `Minus the gateway charge (about 2%, at cost), TDS 1% + TCS 1%, and ${commission.free} commission on ${FREE_PLAN.name} (${commission.premium} on ${PREMIUM_PLAN.name}).` },
    ],
  },
};

const HERO_FLOW = [
  { icon: CalendarPlus, t: 'Client picks a slot', s: 'On your booking page' },
  { icon: Smartphone, t: 'Pays by UPI or card', s: 'Through Razorpay' },
  { icon: Receipt, t: 'Meeticulous collects it', s: 'GST invoice sent automatically' },
  { icon: Landmark, t: 'Settled to your bank', s: 'After a one-time KYC' },
];

const SWITCH = [
  { icon: LogIn, title: 'Sign in with Google', body: 'Your Meeticulous account is ready in one step. No gateway account to set up.' },
  { icon: CalendarPlus, title: 'Add your services and availability', body: 'Recreate each service with its price (paid services start at ₹100) and set the hours you take bookings.' },
  { icon: Share2, title: 'Share your link', body: 'Put your booking link where clients find you, and complete the one-time KYC so payouts reach your bank.' },
];

const QUOTES = ['Vishal Chaware', 'Ar. Pranav Kadoo', 'Happy Singh']
  .map((n) => TESTIMONIALS.find((t) => t.name === n))
  .filter(Boolean);

export const FAQ = [
  {
    q: 'Is Zoho Bookings free?',
    a: `Yes. ${Z.name} has a free plan for ${Z_FREE}, according to its pricing page, checked in ${CHECKED_LABEL}. Paid plans start at ${Z.paidFrom}, billed in ${Z.currency}. Meeticulous's ${FREE_PLAN.name} plan is also ${FREE_MO} a month, with unlimited services and bookings and a ${commission.free} commission on paid bookings.`,
  },
  {
    q: 'How much does Zoho Bookings cost in India?',
    a: `${Z.name} lists its prices in ${Z.currency}: paid plans start at ${Z.paidFrom}, and there is a free plan for ${Z_FREE}. Because pricing is per user, the bill grows with each person you add. Meeticulous is priced in rupees with GST included: ${FREE_MO} a month on ${FREE_PLAN.name}, or ${PAID_MO} a month (${PAID_YR} a year) on ${PREMIUM_PLAN.name}.`,
  },
  {
    q: 'Does Zoho Bookings support Razorpay and UPI?',
    a: `Yes. ${Z.name} lists ${Z.payments} as payment integrations, and UPI works ${lc1(Z.upi)}. You connect your own account with the gateway you choose. On Meeticulous, UPI and cards work on both plans without a gateway account of your own: we collect the payment through Razorpay and settle it to your bank after a one-time KYC.`,
  },
  {
    q: 'Does Zoho Bookings send WhatsApp reminders?',
    a: `Yes. Its pricing page lists WhatsApp reminders, and SMS reminders ${lc1(Z.sms)}. Meeticulous sends WhatsApp reminders on ${PREMIUM_PLAN.name}. On the free ${FREE_PLAN.name} plan you get WhatsApp reminders for your first 2 months, then reminders go by email. Booking confirmations go out by email and WhatsApp on both plans.`,
  },
  {
    q: "What's the cheapest Zoho Bookings alternative in India?",
    a: `It depends on what you earn from bookings. Meeticulous's ${FREE_PLAN.name} plan costs ${FREE_MO} a month and takes ${commission.free} of each paid booking. ${PREMIUM_PLAN.name} costs ${PAID_MO} a month or ${PAID_YR} a year and takes ${commission.premium}. On both, clients pay a flat ₹10 + GST booking fee, and the gateway charge (about 2%) is passed through at cost.`,
  },
  {
    q: 'Can I move from Zoho Bookings to Meeticulous?',
    a: `Yes. Sign in with Google, add your services and availability, then share your new booking link. Complete the one-time KYC so payouts can reach your Indian bank account. Paid services need a price of ₹100 or more. You can keep your ${Z.name} account running until the bookings already made there are done.`,
  },
  {
    q: 'Do I need my own Razorpay account on Meeticulous?',
    a: `No. Meeticulous collects your clients' payments through Razorpay and settles them to your Indian bank account after a one-time KYC. You pay the gateway charge (about 2%) at cost, and TDS 1% + TCS 1% are deducted on payout. On a ₹1,000 booking at ${commission.premium} commission, you receive ${PAYOUT_ON_1000}.`,
  },
  {
    q: 'Can my whole team use Meeticulous?',
    a: `No. Meeticulous is built for one person taking their own bookings and doesn't have multi-staff team accounts. If several people need to take bookings under one account, ${Z.name}, which prices its plans per user, is the better fit. Meeticulous suits solo coaches, consultants and freelancers who want UPI payments handled for them.`,
  },
];

const RELATED = COMPETITOR_LIST.filter((c) => c.key !== 'zoho');

/* ─────────────────────────────  PIECES  ────────────────────────────── */

const H2 = 'font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-[color:var(--zb-ink)] sm:text-5xl';
const SECTION = 'px-5 py-20 sm:px-8 lg:py-28';
const CARD = 'rounded-[6px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]';
const INLINE_LINK = 'font-semibold text-[color:var(--zb-crimson)] underline decoration-[color:var(--zb-line)] underline-offset-4 hover:decoration-[color:var(--zb-crimson)]';

function StartCta({ slot, track }) {
  return (
    <Link
      to={START}
      onClick={() => track(slot)}
      className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[6px] bg-primary px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(194,61,0,0.22)] transition-opacity hover:no-underline hover:opacity-90"
    >
      Start free <ArrowRight size={16} aria-hidden />
    </Link>
  );
}

function Cell({ value }) {
  if (value == null) return <span className="text-[color:var(--zb-muted)]">Not listed</span>;
  return <span>{value}</span>;
}

/* Hero visual: one paid booking, start to payout, on a dashed connector. */
function HeroFlow() {
  return (
    <div className={`${CARD} mx-auto w-full max-w-[22rem] p-6`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-sm font-bold text-[color:var(--zb-ink)]">How a paid booking flows</p>
        <span className="rounded-full bg-[var(--zb-paper)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--zb-crimson)]">Meeticulous</span>
      </div>
      <ol className="mt-5" aria-label="How a paid booking flows on Meeticulous">
        {HERO_FLOW.map((f, i) => (
          <li key={f.t} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < HERO_FLOW.length - 1 && (
              <span aria-hidden className="absolute bottom-0 left-[17px] top-9 border-l border-dashed border-[color:var(--zb-line)]" />
            )}
            <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color:var(--zb-line)] bg-[var(--zb-paper)] text-[color:var(--zb-crimson)]">
              <f.icon size={16} />
            </span>
            <span className="pt-0.5">
              <span className="block text-sm font-semibold text-[color:var(--zb-ink)]">{f.t}</span>
              <span className="block text-xs text-[color:var(--zb-muted)]">{f.s}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-5 border-t border-black/5 pt-4 text-xs text-[color:var(--zb-muted)]">No payment gateway account of your own.</p>
    </div>
  );
}

function Lane({ id, lane, on }) {
  const mine = lane.steps.filter((s) => s.who === 'You').length;
  return (
    <div className={`rounded-[6px] border p-6 transition-colors sm:p-7 ${on ? 'border-[color:var(--zb-line)] bg-white shadow-[0_8px_30px_rgba(26,26,26,0.06)]' : 'border-black/10 bg-transparent'}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2.5 font-heading text-xl font-bold text-[color:var(--zb-ink)]">
          {id === 'zoho' && <img src={favicon(Z.domain)} alt="" width="20" height="20" loading="lazy" className="h-5 w-5" />}
          {lane.name}
        </h3>
        <span className="flex items-center gap-2 text-xs font-semibold text-[color:var(--zb-muted)]">
          <span aria-hidden className="flex gap-1">
            {lane.steps.map((s) => (
              <span key={s.title} className={`h-2 w-4 rounded-full ${s.who === 'You' ? 'bg-[var(--zb-crimson)]' : 'bg-black/10'}`} />
            ))}
          </span>
          {mine} of {lane.steps.length} steps on you
        </span>
      </div>
      <ol className="mt-6">
        {lane.steps.map((s, i) => (
          <li key={s.title} className="relative flex gap-4 pb-6 last:pb-0">
            {i < lane.steps.length - 1 && (
              <span aria-hidden className="absolute bottom-0 left-[15px] top-8 border-l border-dashed border-[color:var(--zb-line)]" />
            )}
            <span aria-hidden className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${s.who === 'You' ? 'bg-[var(--zb-crimson)] text-white' : 'border border-black/10 bg-[var(--zb-paper)] text-[color:var(--zb-ink)]'}`}>
              {i + 1}
            </span>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--zb-crimson)]">{s.who}</span>
              <p className="font-semibold leading-snug text-[color:var(--zb-ink)]">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-[color:var(--zb-muted)]">{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* Page mechanic. Initial state is fixed ('zoho'), so prerender = first paint. */
function PaymentLanes() {
  const [active, setActive] = useState('zoho');
  const keys = Object.keys(LANES);
  return (
    <>
      <div role="group" aria-label="Choose a product" className="mt-8 inline-flex rounded-[6px] border border-black/10 bg-white p-1">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={active === k}
            onClick={() => setActive(k)}
            className={`min-h-[44px] rounded-[5px] px-4 text-sm font-semibold transition-colors sm:px-5 ${active === k ? 'bg-[var(--zb-ink)] text-white' : 'text-[color:var(--zb-muted)] hover:text-[color:var(--zb-ink)]'}`}
          >
            {LANES[k].name}
          </button>
        ))}
      </div>
      {/* Both summaries share one grid cell, so the box keeps the taller height: no layout shift. */}
      <div className="mt-5 grid max-w-2xl" aria-live="polite">
        {keys.map((k) => (
          <p key={k} aria-hidden={active !== k} className={`[grid-area:1/1] text-base leading-relaxed text-[color:var(--zb-ink)] ${active === k ? '' : 'invisible'}`}>
            {LANES[k].summary}
          </p>
        ))}
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-2 lg:gap-6">
        {keys.map((k) => <Lane key={k} id={k} lane={LANES[k]} on={active === k} />)}
      </div>
    </>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function ZohoBookingsAlternative() {
  const utm = useUtm();
  const track = (slot) => analytics.track(EVENTS.LP_CTA_CLICKED, { slug: SLUG, slot, ...utm });
  const canonical = `${SITE_URL}${Z.path}`;

  useEffect(() => {
    analytics.page({ lp: SLUG });
    analytics.track(EVENTS.LP_VIEWED, { slug: SLUG, ...utm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="overflow-x-clip bg-[var(--zb-paper)] text-[color:var(--zb-ink)]" style={THEME}>
      <Seo
        title={TITLE}
        description={DESCRIPTION}
        canonical={canonical}
        image={ogCard('lp-zoho-bookings-alternative')}
        jsonLd={comparisonGraphJsonLd({ canonical, name: TITLE, description: DESCRIPTION, breadcrumbName: 'Zoho Bookings Alternative', faqs: FAQ })}
      />

      {/* ═══════════ 1 · HERO ═══════════ */}
      <section className="px-5 pb-16 pt-4 sm:px-8 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center lg:py-10">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs text-[color:var(--zb-muted)]">
              <ol className="flex flex-wrap items-center gap-x-2">
                <li><Link to="/" className="inline-flex min-h-[44px] items-center text-[color:var(--zb-muted)] hover:text-[color:var(--zb-ink)] hover:no-underline">Home</Link></li>
                <li aria-hidden>›</li>
                <li><Link to="/compare" className="inline-flex min-h-[44px] items-center text-[color:var(--zb-muted)] hover:text-[color:var(--zb-ink)] hover:no-underline">Compare</Link></li>
                <li aria-hidden>›</li>
                <li><span aria-current="page" className="font-medium text-[color:var(--zb-ink)]">{Z.name}</span></li>
              </ol>
            </nav>
            <h1 className="mt-2 max-w-2xl font-heading text-[clamp(2.1rem,3.7vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[color:var(--zb-ink)]">
              Zoho Bookings alternative with UPI <span className="text-primary-cta">built in</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[color:var(--zb-muted)] sm:text-[17px]">
              Meeticulous is a Zoho Bookings alternative built for India. Clients pay by UPI or card when they book, and we
              collect the money and settle it to your bank after a one-time KYC, so you don&rsquo;t need your own payment
              gateway. Every paid booking gets a GST invoice, and the {FREE_PLAN.name} plan costs {FREE_MO} a month.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StartCta slot="hero" track={track} />
              <a href="#side-by-side" className="inline-flex min-h-[44px] items-center justify-center rounded-[6px] border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-[color:var(--zb-ink)] transition-opacity hover:no-underline hover:opacity-90">
                See the side-by-side
              </a>
            </div>
            <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[color:var(--zb-muted)]">
              {[`${FREE_PLAN.name} plan: ${FREE_MO} a month`, 'UPI + cards via Razorpay', 'GST invoices on both plans'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><Check size={14} className="text-[color:var(--zb-crimson)]" aria-hidden />{t}</span>
              ))}
            </p>
          </div>
          <HeroFlow />
        </div>
      </section>

      {/* ═══════════ 2 · THE SHORT ANSWER ═══════════ */}
      <section id="short-answer" className="scroll-mt-20 px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="mx-auto max-w-3xl">
          <h2 className={H2}>The short <span className="text-primary-cta">answer</span></h2>
          <div className={`${CARD} mt-8 border-[color:var(--zb-line)] p-6 sm:p-8`}>
            <p className="font-heading text-lg font-bold leading-snug text-[color:var(--zb-ink)] sm:text-xl">{SHORT_ANSWER}</p>
          </div>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {[[`Pick ${Z.name} if…`, PICK_ZOHO], ['Pick Meeticulous if…', PICK_BAS]].map(([h, items]) => (
              <div key={h} className="rounded-[6px] border border-black/10 p-6">
                <h3 className="font-heading text-lg font-bold text-[color:var(--zb-ink)]">{h}</h3>
                <ul className="mt-4 space-y-2.5">
                  {items.map((t) => (
                    <li key={t} className="flex gap-2.5 text-sm leading-relaxed text-[color:var(--zb-muted)]">
                      <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--zb-crimson)]" />{t}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 3 · SIDE-BY-SIDE TABLE ═══════════ */}
      <section id="side-by-side" className={`scroll-mt-20 bg-[var(--zb-cream)] ${SECTION}`}>
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className={`${H2} max-w-3xl`}>How much does Zoho Bookings <span className="text-primary-cta">cost</span> in India?</h2>
            <span className="rounded-full border border-[color:var(--zb-line)] bg-white px-3 py-1 text-xs font-semibold text-[color:var(--zb-crimson)]">Last checked {CHECKED_LABEL}</span>
          </div>
          <p className="mt-4 max-w-2xl text-[color:var(--zb-muted)]">
            &ldquo;Not listed&rdquo; means their pricing page doesn&rsquo;t say. It doesn&rsquo;t mean they can&rsquo;t.
          </p>
          <div className={`${CARD} mt-10 overflow-x-auto`}>
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <caption className="sr-only">Meeticulous compared with {Z.name}: pricing, commission, payments and reminders</caption>
              <thead>
                <tr className="border-b border-black/5">
                  <th scope="col" className="sticky left-0 z-10 w-[22%] bg-white p-4 text-xs font-semibold uppercase tracking-wide text-[color:var(--zb-muted)]">Feature</th>
                  <th scope="col" className="bg-primary-light p-4 font-heading font-bold text-ink">Meeticulous</th>
                  <th scope="col" className="p-4 font-heading font-bold text-[color:var(--zb-ink)]">
                    <span className="inline-flex items-center gap-2">
                      <img src={favicon(Z.domain)} alt="" width="16" height="16" loading="lazy" className="h-4 w-4" />{Z.name}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, bas, zoho]) => (
                  <tr key={label} className="border-b border-black/5 align-top last:border-0">
                    <th scope="row" className="sticky left-0 z-10 bg-white p-4 font-semibold text-[color:var(--zb-ink)]">{label}</th>
                    <td className="bg-primary-light/50 p-4 text-ink"><Cell value={bas} /></td>
                    <td className="p-4 text-[color:var(--zb-ink)]"><Cell value={zoho} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-5 max-w-3xl text-xs leading-relaxed text-[color:var(--zb-muted)]">
            Checked against the {Z.name} pricing page in {CHECKED_LABEL}. Prices as published, in their currency, and they may
            have changed since. Source:{' '}
            <a href={Z.source} target="_blank" rel="noopener noreferrer nofollow" className="text-[color:var(--zb-muted)] underline underline-offset-2 hover:text-[color:var(--zb-ink)]">{Z.name} pricing page</a>.{' '}
            {Z.name} is a trademark of its owner. Meeticulous isn&rsquo;t affiliated with {Z.name}.
          </p>
        </div>
      </section>

      {/* ═══════════ 4 · WHAT'S DIFFERENT (connector ledger) ═══════════ */}
      <section className={SECTION}>
        <div className="mx-auto max-w-3xl">
          <h2 className={H2}>What&rsquo;s different for hosts <span className="text-primary-cta">in India</span>?</h2>
          <ol className="mt-12">
            {DIFFERENT.map((d, i) => (
              <li key={d.title} className="relative flex gap-5 pb-10 last:pb-0">
                {i < DIFFERENT.length - 1 && (
                  <span aria-hidden className="absolute bottom-0 left-[19px] top-10 border-l border-dashed border-[color:var(--zb-line)]" />
                )}
                <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--zb-line)] bg-white font-heading text-sm font-extrabold text-[color:var(--zb-crimson)]">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="pt-1.5">
                  <h3 className="font-heading text-xl font-bold text-[color:var(--zb-ink)]">{d.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-[color:var(--zb-muted)]">{d.body}</p>
                  {d.link && (
                    <Link to={d.link.to} className={`mt-3 inline-flex min-h-[44px] items-center gap-1.5 text-sm ${INLINE_LINK}`}>
                      {d.link.label} <ArrowRight size={14} aria-hidden />
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════ 5 · WHERE ZOHO BOOKINGS IS THE BETTER CHOICE ═══════════ */}
      <section className={`bg-[var(--zb-cream)] ${SECTION}`}>
        <div className="mx-auto max-w-6xl">
          <h2 className={`${H2} max-w-3xl`}>When is Zoho Bookings the <span className="text-primary-cta">better choice</span>?</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--zb-muted)]">
            It isn&rsquo;t the right pick for everyone, and neither are we. Here is where {Z.name} has the edge.
          </p>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {ZOHO_WINS.map((w) => (
              <div key={w.title} className={`${CARD} p-7`}>
                <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-[var(--zb-paper)] text-[color:var(--zb-crimson)]">
                  <w.icon size={19} />
                </span>
                <h3 className="mt-4 font-heading text-lg font-bold text-[color:var(--zb-ink)]">{w.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--zb-muted)]">{w.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 6 · MECHANIC: WHO HANDLES THE PAYMENT? ═══════════ */}
      <section id="who-handles-payment" className={`scroll-mt-20 ${SECTION}`}>
        <div className="mx-auto max-w-6xl">
          <h2 className={`${H2} max-w-3xl`}>Who handles the <span className="text-primary-cta">payment</span>?</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[color:var(--zb-muted)]">
            The same paid booking, traced on both. Switch between them to see whose job each step is.
          </p>
          <PaymentLanes />
        </div>
      </section>

      {/* ═══════════ 7 · SWITCH IN 3 STEPS ═══════════ */}
      <section className={`bg-[var(--zb-cream)] ${SECTION}`}>
        <div className="mx-auto max-w-6xl">
          <h2 className={`${H2} max-w-3xl`}>How do I <span className="text-primary-cta">switch</span> from Zoho Bookings?</h2>
          <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-6">
            {SWITCH.map((s, i) => (
              <li key={s.title} className="relative flex gap-5 md:block">
                {i < SWITCH.length - 1 && (
                  <>
                    <span aria-hidden className="absolute -bottom-10 left-[21px] top-12 border-l border-dashed border-[color:var(--zb-line)] md:hidden" />
                    <span aria-hidden className="absolute -right-6 left-14 top-[21px] hidden border-t border-dashed border-[color:var(--zb-line)] md:block" />
                  </>
                )}
                <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--zb-line)] bg-white text-[color:var(--zb-crimson)]">
                  <s.icon size={19} />
                </span>
                <div className="pt-1 md:mt-5 md:pt-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--zb-crimson)]">Step {i + 1}</p>
                  <h3 className="mt-1 font-heading text-lg font-bold text-[color:var(--zb-ink)]">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--zb-muted)]">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-12"><StartCta slot="switch" track={track} /></div>
        </div>
      </section>

      {/* ═══════════ 8 · TESTIMONIALS ═══════════ */}
      {QUOTES.length > 0 && (
        <section className={SECTION}>
          <div className="mx-auto max-w-6xl">
            <h2 className={H2}>What hosts <span className="text-primary-cta">say</span></h2>
            <div className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
              {QUOTES.map((t) => (
                <figure key={t.name} className={`${CARD} flex flex-col p-7`}>
                  <blockquote className="flex-1 text-[15px] leading-relaxed text-[color:var(--zb-ink)]">&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--zb-cream)] font-heading text-sm font-bold text-[color:var(--zb-crimson)]">
                      {t.name.replace(/^(Ar|Dr)\.\s*/, '').split(' ').map((p) => p[0]).slice(0, 2).join('')}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-[color:var(--zb-ink)]">{t.name}</span>
                      <span className="block text-xs text-[color:var(--zb-muted)]">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ 9 · FAQ ═══════════ */}
      <section id="faq" className={`scroll-mt-20 bg-[var(--zb-cream)] ${SECTION}`}>
        <div className="mx-auto max-w-3xl">
          <h2 className={H2}>Zoho Bookings alternative: your <span className="text-primary-cta">questions</span></h2>
          <p className="mt-5 text-base text-[color:var(--zb-muted)]">
            Every fee is listed on our <Link to="/host-fees" className={INLINE_LINK}>host fees page</Link>. Comparing more tools? Read our guide to{' '}
            <Link to="/blog/best-appointment-booking-apps-india" className={INLINE_LINK}>appointment booking apps in India</Link>.
          </p>
          <div className="mt-10 border-t border-black/10">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group border-b border-black/10" open={i === 0}>
                <summary className="flex min-h-[44px] cursor-pointer list-none items-start gap-4 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="flex-1 font-heading text-[17px] font-bold text-[color:var(--zb-ink)]">{f.q}</span>
                  <span aria-hidden className="text-xl leading-none text-[color:var(--zb-crimson)] transition-transform group-open:rotate-45 motion-reduce:transition-none">+</span>
                </summary>
                <p className="pb-6 pr-8 text-[15px] leading-relaxed text-[color:var(--zb-muted)]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 10 · RELATED + FINAL CTA ═══════════ */}
      <section className="px-5 py-16 sm:px-8 lg:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-heading text-2xl font-extrabold text-[color:var(--zb-ink)]">More <span className="text-primary-cta">comparisons</span></h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RELATED.map((c) => (
              <li key={c.key}>
                <Link to={c.path} className="flex min-h-[44px] items-center gap-3 rounded-[6px] border border-black/5 bg-white px-4 py-3 text-sm font-semibold text-[color:var(--zb-ink)] transition-colors hover:border-[color:var(--zb-line)] hover:no-underline">
                  <img src={favicon(c.domain)} alt="" width="20" height="20" loading="lazy" className="h-5 w-5" />
                  Meeticulous vs {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/compare" className="flex min-h-[44px] items-center gap-2 rounded-[6px] border border-black/5 bg-white px-4 py-3 text-sm font-semibold text-[color:var(--zb-crimson)] transition-colors hover:border-[color:var(--zb-line)] hover:no-underline">
                All booking tool comparisons <ArrowRight size={14} aria-hidden />
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="bg-[var(--zb-ink)] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-[#FBF6EE] sm:text-5xl">
            Let clients pay when they book. <span className="text-primary">Start free.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#FBF6EE]/75">
            UPI and cards at checkout, a GST invoice on every paid booking, and payouts to your bank. {FREE_PLAN.name} costs {FREE_MO} a month.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <StartCta slot="final" track={track} />
            <Link to="/pricing" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-[#FBF6EE] hover:no-underline hover:opacity-80">
              Compare plans and pricing <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
