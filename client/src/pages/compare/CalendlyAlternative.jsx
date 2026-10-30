// /compare/calendly-alternative — Meeticulous vs Calendly, for hosts in India.
//
// HONESTY: every Calendly claim comes from data/competitors.js (COMPETITORS.calendly,
// checked against calendly.com/pricing). `null` there renders "Not listed", never
// "No". Meeticulous prices/commission come from data/plans.js. The ₹10 + GST
// booking fee, ~2% gateway pass-through, TDS 1% + TCS 1% and the ₹959.76-on-₹1,000
// payout are the published /host-fees figures. Quotes are real (data/testimonials.js).
//
// Design system "Ledger": warm paper + deep navy ink, ruled lines, one orange
// accent. Page mechanic: "Same booking, two checkouts" (Calendly free / Standard
// toggle vs Meeticulous). Global Navbar + Footer come from App.jsx. No images
// except competitor favicons, no scroll animations, no hover uplift.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X, Minus, Receipt, Landmark, MessageCircle, IndianRupee } from 'lucide-react';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, comparisonGraphJsonLd } from '../../utils/seo';
import useUtm from '../../hooks/useUtm';
import { analytics, EVENTS } from '../../services/analytics';
import { COMPETITORS, COMPETITOR_LIST, CHECKED_LABEL } from '../../data/competitors';
import { FREE_PLAN, PREMIUM_PLAN, PLAN_MATRIX } from '../../data/plans';
import { TESTIMONIALS } from '../../data/testimonials';

const SLUG = 'calendly-alternative';
const START = '/become-a-host';
const C = COMPETITORS.calendly;

/* ─────────────────────────────  FACTS  ────────────────────────────── */

const inr = (n, dp = 0) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;
const COMMISSION = PLAN_MATRIX.flatMap((g) => g.rows).find((r) => r.label === 'Commission on your bookings');
const CAL_FREE = C.freePlan.replace(/^Yes:\s*/, ''); // "1 event type, 1 calendar"
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

// /host-fees: client pays price + ₹10 booking fee + 18% GST on that fee; on
// Pro (0%) a ₹1,000 booking pays out ₹959.76 after ~2% gateway + TDS 1% + TCS 1%.
const BOOKING_FEE = 10;
const BOOKING_FEE_GST = 1.8;
const EXAMPLE_PRICE = 1000;
const EXAMPLE_TOTAL = EXAMPLE_PRICE + BOOKING_FEE + BOOKING_FEE_GST;
const EXAMPLE_PAYOUT = '₹959.76';

const PALETTE = {
  '--lg-paper': '#FBF8F2',
  '--lg-ink': '#14213D',
  '--lg-muted': '#4D5873',
  '--lg-faint': '#626C86',
  '--lg-rule': 'rgba(20,33,61,0.12)',
};
const INK = 'text-[color:var(--lg-ink)]';
const MUTED = 'text-[color:var(--lg-muted)]';
const FAINT = 'text-[color:var(--lg-faint)]';
const RULE = 'border-[color:var(--lg-rule)]';
const PAPER_TXT = 'text-[#FBF8F2]';
const H2 = 'font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl';
const KICKER = 'text-[11px] font-bold uppercase tracking-[0.18em]';

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const SEO_TITLE = 'Calendly Alternative for India (UPI + GST) | Meeticulous';
const SEO_DESC = 'Meeticulous is a Calendly alternative for India: clients pay by UPI or card when they book, every paid booking gets a GST invoice, and plans bill in rupees.';

// One-line verdict + 3 short reasons per side. Detail lives in the table and FAQ below.
const SHORT_ANSWER = `Clients pay by UPI? Pick Meeticulous. Only need free scheduling, or clients pay by international card? Pick ${C.name}.`;

const PICK_CAL = [
  "You only need free scheduling",
  "Clients pay by international card or PayPal",
  "You book as a team",
];
const PICK_BAS = [
  "Clients pay by UPI when they book",
  "You want a GST invoice per booking",
  "No payment gateway account to set up",
];

// [label, Calendly value (competitors.js), Meeticulous value (plans.js / host-fees)]
const ROWS = [
  ['Free plan', C.freePlan, `Yes: unlimited services & bookings, ${COMMISSION.free} commission`],
  ['Paid plan from', C.paidFrom, `${inr(PREMIUM_PLAN.monthly)} / month or ${inr(PREMIUM_PLAN.yearly)} / year (${PREMIUM_PLAN.name})`],
  ['Priced per', 'Seat', 'Account, one flat price'],
  ['Billing currency', C.currency, 'INR, GST included'],
  ['Commission', C.commission, `${COMMISSION.free} on ${FREE_PLAN.name}, ${COMMISSION.premium} on ${PREMIUM_PLAN.name}`],
  ['Taking payments', C.payments, 'UPI and cards through Razorpay, on both plans'],
  ['UPI at booking', C.upi, true],
  ['GST invoice for your client', null, 'Yes, on both plans'],
  ['Fee your client pays', null, `${inr(BOOKING_FEE)} + GST per paid booking`],
  ['WhatsApp reminders', C.whatsapp, `Yes on ${PREMIUM_PLAN.name}; first 2 months on ${FREE_PLAN.name}, then email`],
];

const DIFFERENT = [
  { icon: IndianRupee, title: 'UPI at checkout, on both plans', body: `Your client pays by UPI or card through Razorpay while booking, on ${FREE_PLAN.name} and ${PREMIUM_PLAN.name}. Calendly lists ${C.payments}, and UPI isn't one of them.` },
  { icon: Receipt, title: 'A GST invoice with every paid booking', body: "Each paid booking generates a GST invoice for your client, with nothing for you to type. Calendly's pricing page doesn't list GST invoicing." },
  { icon: Landmark, title: 'Paid out to your Indian bank', body: "Meeticulous collects the payment and settles it to your bank account after a one-time KYC. You don't need a payment gateway account of your own." },
  { icon: MessageCircle, title: 'Reminders on WhatsApp', body: `Clients get WhatsApp reminders on ${PREMIUM_PLAN.name}. On ${FREE_PLAN.name} they're included for your first 2 months, then reminders go by email. Calendly's pricing page doesn't list WhatsApp reminders.` },
];

const BETTER = [
  { title: 'You only need free scheduling', body: `Calendly's free plan (${CAL_FREE}) has no payment step and charges no commission. If you never charge for sessions, it may be all you need. Meeticulous's ${FREE_PLAN.name} plan allows 2 free (₹0) services.` },
  { title: 'Your clients pay by international card', body: "Calendly's paid plans take payment through Stripe or PayPal, which suits clients abroad who already pay that way." },
  { title: 'You book for a team', body: 'Calendly prices per seat and also lists a Teams plan for groups. Meeticulous is built for one host per account and has no multi-staff team accounts.' },
];

const STEPS = [
  { title: 'Sign in with Google', body: 'Create your host account with Google. Google Calendar and Meet work on both plans.' },
  { title: 'Add your services and availability', body: 'Set up each Calendly event type as a service, with its price and your weekly hours. Paid services start at ₹100.' },
  { title: 'Share your link', body: 'Put your Meeticulous link wherever your Calendly link was. Complete a one-time KYC to receive payouts.' },
];

const QUOTES = ['Vishal Chaware', 'Ar. Pranav Kadoo', 'Happy Singh']
  .map((n) => TESTIMONIALS.find((t) => t.name === n))
  .filter(Boolean);

export const FAQ = [
  { q: 'Is Calendly free?', a: `Yes. Calendly has a free plan with ${CAL_FREE}, according to its pricing page (checked ${CHECKED_LABEL}). Taking payments isn't part of it: Calendly lists payments through Stripe or PayPal on paid plans. Meeticulous's ${FREE_PLAN.name} plan is also free, with unlimited services and bookings and UPI payments, and a ${COMMISSION.free} commission on paid bookings.` },
  { q: 'Does Calendly support UPI payments?', a: `No. Calendly's pricing page lists ${C.payments}, and UPI isn't one of the options. Meeticulous takes UPI and cards through Razorpay inside the booking flow on both of its plans, so your client pays when they book and gets a GST invoice for the payment.` },
  { q: 'How much does Calendly cost in India?', a: `Calendly's paid plans start at ${C.paidFrom}, and it publishes prices in ${C.currency}, not rupees. There is also a free plan with ${CAL_FREE}. Meeticulous is priced in rupees with GST included: ${FREE_PLAN.name} is ₹0 and ${PREMIUM_PLAN.name} is ${inr(PREMIUM_PLAN.monthly)} a month or ${inr(PREMIUM_PLAN.yearly)} a year.` },
  { q: "What's the cheapest Calendly alternative for India?", a: `Meeticulous starts at ₹0 a month. Its ${FREE_PLAN.name} plan includes unlimited services and bookings, UPI payments and GST invoices, with a ${COMMISSION.free} commission on paid bookings. ${PREMIUM_PLAN.name} costs ${inr(PREMIUM_PLAN.monthly)} a month and takes ${COMMISSION.premium} commission. On both plans your client pays a flat ${inr(BOOKING_FEE)} + GST booking fee per paid booking.` },
  { q: 'Can I move from Calendly to Meeticulous?', a: 'Yes. Sign in with Google, set up each Calendly event type as a service with its price and your weekly availability, then share your new booking link wherever your Calendly link was. Paid services start at ₹100. To receive payments, complete a one-time KYC so payouts reach your Indian bank account.' },
  { q: 'Does Meeticulous send GST invoices?', a: `Yes, on both plans. Every paid booking generates a GST invoice for your client automatically, so you don't type receipts or collect payment screenshots. It comes with ${FREE_PLAN.name} and ${PREMIUM_PLAN.name} alike, with nothing extra to buy. Calendly's pricing page doesn't list GST invoicing (checked ${CHECKED_LABEL}).` },
  { q: 'Does Meeticulous take a commission?', a: `Only on the free plan. ${FREE_PLAN.name} takes ${COMMISSION.free} per paid booking and ${PREMIUM_PLAN.name} takes ${COMMISSION.premium}. On every paid booking the client pays a ${inr(BOOKING_FEE)} + GST booking fee, the gateway charge (about 2%) is passed through at cost, and TDS 1% + TCS 1% are deducted on payout. On ${inr(EXAMPLE_PRICE)} at ${COMMISSION.premium} commission you receive ${EXAMPLE_PAYOUT}.` },
  { q: 'Does Calendly send WhatsApp reminders?', a: `Calendly's pricing page doesn't list WhatsApp reminders (checked ${CHECKED_LABEL}). Meeticulous sends WhatsApp reminders on ${PREMIUM_PLAN.name}. On the free ${FREE_PLAN.name} plan they're included for your first 2 months, then reminders go by email. Booking confirmations go out by email and WhatsApp on both plans.` },
];

const GUIDES = [
  { to: '/blog/calendly-pricing-india', label: 'Calendly pricing in India, in rupees with GST' },
  { to: '/blog/calendly-upi-payments', label: 'Can you take UPI payments on Calendly?' },
  { to: '/blog/best-appointment-booking-apps-india', label: 'Appointment booking apps in India, compared' },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function Cta({ slot, children = 'Start free', className = '' }) {
  const utm = useUtm();
  return (
    <Link
      to={START}
      onClick={() => analytics.track(EVENTS.LP_CTA_CLICKED, { slug: SLUG, slot, ...utm })}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[6px] bg-primary px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(194,61,0,0.2)] transition-opacity hover:no-underline hover:opacity-90 ${className}`}
    >
      {children} <ArrowRight size={16} aria-hidden />
    </Link>
  );
}

function Cell({ value }) {
  if (value === true) return <span className="inline-flex items-center gap-1.5 font-semibold"><Check size={15} className="text-emerald-700" aria-hidden />Yes</span>;
  if (value === false) return <span className="inline-flex items-center gap-1.5"><X size={15} aria-hidden />No</span>;
  if (value == null) return <span className={FAINT}>Not listed</span>;
  return <span>{value}</span>;
}

/* Hero visual: a ledger slip, four rows from the data files. */
function HeroLedger() {
  const rows = [
    ['Billed in', C.currency, 'INR (₹)'],
    ['UPI at booking', C.upi ? 'Yes' : 'No', 'Yes'],
    ['Free plan', CAL_FREE, 'Unlimited bookings'],
    ['Commission', C.commission, `${COMMISSION.free} or ${COMMISSION.premium}`],
  ];
  return (
    <figure className={`relative mx-auto w-full max-w-md rounded-[6px] border ${RULE} bg-white py-5 pl-12 pr-5 shadow-[0_8px_30px_rgba(20,33,61,0.06)]`}>
      <span aria-hidden className="absolute inset-y-0 left-8 w-px bg-primary/40" />
      <div className={`flex items-baseline justify-between border-b ${RULE} pb-3 ${KICKER} ${FAINT}`}>
        <span>At a glance</span>
        <span>Checked {CHECKED_LABEL}</span>
      </div>
      <div aria-hidden className={`grid grid-cols-[1fr_1fr_1fr] gap-3 pt-3 ${KICKER} ${FAINT}`}>
        <span />
        <span>Calendly</span>
        <span className="text-primary-cta">Meeticulous</span>
      </div>
      <dl>
        {rows.map(([label, cal, bas]) => (
          <div key={label} className={`grid grid-cols-[1fr_1fr_1fr] gap-3 border-b ${RULE} py-3 text-[13px] last:border-0`}>
            <dt className={`font-semibold ${INK}`}>{label}</dt>
            <dd className={MUTED}><span className="sr-only">Calendly: </span>{cal}</dd>
            <dd className={`font-semibold ${INK}`}><span className="sr-only">Meeticulous: </span>{bas}</dd>
          </div>
        ))}
      </dl>
      <figcaption className={`mt-3 text-[11px] ${FAINT}`}>From each pricing page, as published.</figcaption>
    </figure>
  );
}

/* Mechanic: one 30-minute booking, checked out on Calendly and on Meeticulous. */
function StepRow({ n, title, state = 'done', children }) {
  const mark = {
    done: <Check size={13} aria-hidden />,
    skip: <Minus size={13} aria-hidden />,
    pay: <span className="text-[11px] font-bold">{n}</span>,
  }[state];
  return (
    <li className={`flex gap-3 border-b ${RULE} py-3 last:border-0`}>
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${state === 'skip' ? 'border border-dashed border-[color:var(--lg-faint)] text-[color:var(--lg-faint)]' : 'bg-[color:var(--lg-ink)] text-white'}`}>{mark}</span>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${state === 'skip' ? FAINT : INK}`}>{title}</div>
        {children && <div className={`mt-1 text-[13px] ${MUTED}`}>{children}</div>}
      </div>
    </li>
  );
}

function PayTiles({ options }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {options.map(([label, on]) => (
        <span key={label} className={`rounded-[5px] border px-2.5 py-1 text-xs font-semibold ${on ? 'border-primary-cta bg-primary-light text-primary-cta' : `${RULE} ${INK}`}`}>{label}</span>
      ))}
    </div>
  );
}

const NOTE = `border-t ${RULE} pt-3 pb-1 text-xs ${FAINT}`;

const CAL_PLANS = [
  { key: 'free', label: 'Calendly free plan' },
  { key: 'standard', label: 'Calendly Standard' },
];

function CardHead({ children, note }) {
  return (
    <div className={`flex items-center gap-2 border-b ${RULE} px-5 py-3.5`}>
      {children}
      <span className={`ml-auto text-[11px] ${FAINT}`}>{note}</span>
    </div>
  );
}

function TwoCheckouts() {
  const [plan, setPlan] = useState('standard'); // deterministic first paint (prerender-safe)
  const card = `overflow-hidden rounded-[6px] bg-[color:var(--lg-paper)] ${INK} shadow-[0_30px_70px_-30px_rgba(0,0,0,0.5)]`;
  return (
    <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-6">
      <div>
        <div role="group" aria-label="Which Calendly plan to show" className="mb-3 flex gap-2">
          {CAL_PLANS.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={plan === p.key}
              aria-controls="cal-checkout"
              onClick={() => setPlan(p.key)}
              className={`min-h-[44px] flex-1 rounded-[6px] border px-3 text-xs font-semibold transition-colors sm:text-sm ${plan === p.key ? `border-transparent bg-[#FBF8F2] ${INK}` : `border-white/20 bg-transparent ${PAPER_TXT} hover:bg-white/5`}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div id="cal-checkout" className={card}>
          <CardHead note="30-min consultation · Thu, 4:30 PM">
            <img src={favicon(C.domain)} alt="" width="16" height="16" loading="lazy" className="h-4 w-4" />
            <span className="font-heading text-sm font-bold">Calendly</span>
          </CardHead>
          {/* Both panels share one grid cell, so switching never changes the card height. */}
          <div className="grid px-5 py-2" aria-live="polite">
            <div className={`[grid-area:1/1] ${plan === 'free' ? '' : 'invisible'}`} aria-hidden={plan !== 'free'}>
              <ol>
                <StepRow title="Pick a time">Thu, 4:30 PM</StepRow>
                <StepRow title="Your details">Name and contact details</StepRow>
                <StepRow title="Payment" state="skip">No payment step. Calendly lists payments on paid plans only.</StepRow>
                <StepRow title="Booking confirmed">Unpaid. Any fee has to be collected outside Calendly.</StepRow>
              </ol>
              <p className={NOTE}>Free plan: {CAL_FREE}.</p>
            </div>
            <div className={`[grid-area:1/1] ${plan === 'standard' ? '' : 'invisible'}`} aria-hidden={plan !== 'standard'}>
              <ol>
                <StepRow title="Pick a time">Thu, 4:30 PM</StepRow>
                <StepRow title="Your details">Name and contact details</StepRow>
                <StepRow n={3} title="Pay" state="pay">
                  <PayTiles options={[['Card via Stripe', true], ['PayPal', false]]} />
                  <div className={`mt-2 text-xs ${FAINT}`}>UPI: not an option</div>
                </StepRow>
                <StepRow title="Booking confirmed" />
              </ol>
              <p className={NOTE}>Paid plans from {C.paidFrom}. Billed in {C.currency}.</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className={`mb-3 flex min-h-[44px] items-center text-sm font-semibold ${PAPER_TXT}`}>
          Meeticulous, on {FREE_PLAN.name} or {PREMIUM_PLAN.name}
        </div>
        <div className={card}>
          <CardHead note="30-min consultation · Thu, 4:30 PM">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="font-heading text-sm font-bold">Meeticulous</span>
          </CardHead>
          <div className="px-5 py-2">
            <ol>
              <StepRow title="Pick a time">Thu, 4:30 PM</StepRow>
              <StepRow title="Your details">Name and contact details</StepRow>
              <StepRow n={3} title={`Pay ${inr(EXAMPLE_TOTAL, 2)}`} state="pay">
                <PayTiles options={[['UPI', true], ['Card', false]]} />
                <div className="mt-2 text-xs">{inr(EXAMPLE_PRICE)} session + {inr(BOOKING_FEE + BOOKING_FEE_GST, 2)} booking fee and GST</div>
              </StepRow>
              <StepRow title="GST invoice sent">
                <div className={`mt-1 rounded-[5px] border border-dashed ${RULE} bg-white p-2.5 text-xs`}>
                  <div className={`mb-1 flex items-center gap-1.5 font-semibold ${INK}`}><Receipt size={13} aria-hidden /> Tax invoice</div>
                  <div className="flex justify-between"><span>Session</span><span className="tabular-nums">{inr(EXAMPLE_PRICE, 2)}</span></div>
                  <div className="flex justify-between"><span>Booking fee</span><span className="tabular-nums">{inr(BOOKING_FEE, 2)}</span></div>
                  <div className="flex justify-between"><span>GST on fee (18%)</span><span className="tabular-nums">{inr(BOOKING_FEE_GST, 2)}</span></div>
                  <div className={`mt-1 flex justify-between border-t ${RULE} pt-1 font-semibold ${INK}`}><span>Paid in total</span><span className="tabular-nums">{inr(EXAMPLE_TOTAL, 2)}</span></div>
                </div>
              </StepRow>
            </ol>
            <p className={NOTE}>
              On {PREMIUM_PLAN.name} you receive {EXAMPLE_PAYOUT} of the {inr(EXAMPLE_PRICE)}, after the ~2% gateway charge and TDS 1% + TCS 1%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function CalendlyAlternative() {
  const utm = useUtm();
  const canonical = `${SITE_URL}${C.path}`;
  const others = COMPETITOR_LIST.filter((c) => c.key !== 'calendly');

  useEffect(() => {
    analytics.page({ lp: SLUG });
    analytics.track(EVENTS.LP_VIEWED, { slug: SLUG, ...utm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={`overflow-x-clip bg-[color:var(--lg-paper)] ${INK}`} style={PALETTE}>
      <Seo
        title={SEO_TITLE}
        description={SEO_DESC}
        canonical={canonical}
        image={ogCard('lp-calendly-alternative')}
        jsonLd={comparisonGraphJsonLd({ canonical, name: SEO_TITLE, description: SEO_DESC, breadcrumbName: 'Calendly Alternative', faqs: FAQ })}
      />

      {/* ═══════════ 1 · HERO ═══════════ */}
      <section className="px-5 pb-16 pt-8 sm:px-8 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center lg:py-10">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <nav aria-label="Breadcrumb" className={`text-xs ${FAINT}`}>
              <Link to="/" className={`${FAINT} hover:no-underline hover:opacity-80`}>Home</Link>
              <span aria-hidden className="mx-2">›</span>
              <Link to="/compare" className={`${FAINT} hover:no-underline hover:opacity-80`}>Compare</Link>
              <span aria-hidden className="mx-2">›</span>
              <span aria-current="page" className={INK}>Calendly</span>
            </nav>
            <h1 className={`mt-4 font-heading text-[clamp(2.1rem,3.7vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.03em] ${INK}`}>
              Calendly alternative for India, <span className="text-primary-cta">with UPI</span>
            </h1>
            <p className={`mt-4 max-w-xl text-[15px] leading-relaxed sm:text-base lg:text-[17px] ${MUTED}`}>
              Meeticulous is a Calendly alternative built for India. Clients pay by UPI or card when they book, each paid booking gets a GST invoice, and plans are billed in rupees. Calendly&rsquo;s free plan has no payment step, and its paid plans collect through Stripe or PayPal, priced in {C.currency}.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Cta slot="hero" />
              <a href="#side-by-side" className={`inline-flex min-h-[44px] items-center justify-center rounded-[6px] border ${RULE} bg-white px-6 py-3 text-sm font-semibold ${INK} hover:no-underline hover:opacity-90`}>
                Compare side by side
              </a>
            </div>
            <p className={`mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] ${MUTED}`}>
              {[`${FREE_PLAN.name} plan is ₹0`, 'Sign in with Google', 'UPI + cards via Razorpay'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><Check size={14} className="text-primary-cta" aria-hidden />{t}</span>
              ))}
            </p>
          </div>
          <HeroLedger />
        </div>
      </section>

      {/* ═══════════ 2 · THE SHORT ANSWER ═══════════ */}
      <section id="short-answer" aria-labelledby="short-answer-title" className="px-5 pb-20 sm:px-8 lg:pb-28">
        <div className={`relative mx-auto max-w-3xl rounded-[6px] border ${RULE} bg-white py-8 pl-10 pr-6 shadow-[0_8px_30px_rgba(20,33,61,0.04)] sm:py-10 sm:pl-14 sm:pr-10`}>
          <span aria-hidden className="absolute inset-y-0 left-6 w-px bg-primary/40 sm:left-9" />
          <h2 id="short-answer-title" className={`font-heading text-2xl font-extrabold sm:text-3xl ${INK}`}>The short <span className="text-primary-cta">answer</span></h2>
          <p className={`mt-4 font-heading text-lg font-bold leading-snug sm:text-xl ${INK}`}>{SHORT_ANSWER}</p>
          <div className={`mt-8 grid gap-8 border-t ${RULE} pt-6 sm:grid-cols-2`}>
            {[[`Pick ${C.name} if…`, PICK_CAL, false], ['Pick Meeticulous if…', PICK_BAS, true]].map(([title, items, ours]) => (
              <div key={title}>
                <h3 className={`font-heading text-base font-bold ${INK}`}>{title}</h3>
                <ul className={`mt-3 space-y-2 text-sm ${MUTED}`}>
                  {items.map((t) => (
                    <li key={t} className="flex gap-2"><Check size={15} className={`mt-0.5 shrink-0 ${ours ? 'text-primary-cta' : FAINT}`} aria-hidden />{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 3 · SIDE BY SIDE ═══════════ */}
      <section id="side-by-side" aria-labelledby="table-title" className={`scroll-mt-20 border-y ${RULE} bg-white px-5 py-20 sm:px-8 lg:py-28`}>
        <div className="mx-auto max-w-5xl">
          <h2 id="table-title" className={`${H2} ${INK}`}>How much does Calendly cost <span className="text-primary-cta">in India?</span></h2>
          <p className={`mt-5 max-w-2xl text-base leading-relaxed ${MUTED}`}>
            Calendly publishes its prices in {C.currency}. Paid plans start at {C.paidFrom}, and the free plan covers {CAL_FREE}. Here it is line by line against Meeticulous, which bills in rupees.
            {' '}<Link to="/blog/calendly-pricing-india" className="font-semibold text-primary-cta underline underline-offset-4">Calendly pricing in India, worked out in rupees</Link>.
          </p>
          <p className={`mt-8 ${KICKER} ${FAINT}`}>Last checked {CHECKED_LABEL}</p>
          <div className={`mt-3 overflow-x-auto rounded-[6px] border ${RULE}`}>
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <caption className="sr-only">Calendly compared with Meeticulous, checked {CHECKED_LABEL}</caption>
              <thead>
                <tr className={`border-b ${RULE}`}>
                  <th scope="col" className="w-[28%] p-4"><span className="sr-only">Feature</span></th>
                  <th scope="col" className={`p-4 font-heading font-bold ${INK}`}>
                    <span className="inline-flex items-center gap-2">
                      <img src={favicon(C.domain)} alt="" width="16" height="16" loading="lazy" className="h-4 w-4" />
                      {C.name}
                    </span>
                  </th>
                  <th scope="col" className={`bg-primary-light p-4 font-heading font-bold ${INK}`}>Meeticulous</th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, cal, bas]) => (
                  <tr key={label} className={`border-b ${RULE} align-top last:border-0`}>
                    <th scope="row" className={`p-4 font-semibold ${INK}`}>{label}</th>
                    <td className={`p-4 ${MUTED}`}><Cell value={cal} /></td>
                    <td className={`bg-primary-light/50 p-4 ${INK}`}><Cell value={bas} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`mt-5 text-xs leading-relaxed ${FAINT}`}>
            Checked against {C.name}&rsquo;s pricing page in {CHECKED_LABEL}. Prices as published, in their currency.
            {' '}&ldquo;Not listed&rdquo; means their pricing page doesn&rsquo;t say.{' '}
            <a href={C.source} target="_blank" rel="noopener noreferrer nofollow" className={`${FAINT} underline underline-offset-2`}>View {C.name}&rsquo;s pricing page</a>.
            {' '}{C.name} is a trademark of its owner. Meeticulous isn&rsquo;t affiliated with {C.name}.
            {' '}Meeticulous&rsquo;s plans are on our <Link to="/pricing" className={`${FAINT} underline underline-offset-2`}>pricing page</Link>.
          </p>
        </div>
      </section>

      {/* ═══════════ 4 · WHAT'S DIFFERENT ═══════════ */}
      <section aria-labelledby="different-title" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 id="different-title" className={`${H2} ${INK}`}>What&rsquo;s different for hosts <span className="text-primary-cta">in India?</span></h2>
          <ol className={`mt-12 border-t ${RULE}`}>
            {DIFFERENT.map((d, i) => (
              <li key={d.title} className={`grid gap-3 border-b ${RULE} py-7 sm:grid-cols-[4rem_1fr_1.4fr] sm:gap-8`}>
                <span className="font-heading text-sm font-extrabold tabular-nums text-primary-cta">No. {String(i + 1).padStart(2, '0')}</span>
                <h3 className={`flex items-start gap-2 font-heading text-lg font-bold ${INK}`}><d.icon size={19} className="mt-1 shrink-0 text-primary-cta" aria-hidden />{d.title}</h3>
                <p className={`text-[15px] leading-relaxed ${MUTED}`}>{d.body}</p>
              </li>
            ))}
          </ol>
          <p className={`mt-8 max-w-3xl text-sm leading-relaxed ${MUTED}`}>
            <span className={`font-semibold ${INK}`}>Every fee, in plain numbers:</span> clients pay {inr(BOOKING_FEE)} + GST per paid booking, the gateway charge (about 2%) is passed through at cost, and TDS 1% + TCS 1% are deducted on payout. On {inr(EXAMPLE_PRICE)} at {COMMISSION.premium} commission you receive {EXAMPLE_PAYOUT}.
            {' '}<Link to="/host-fees" className="font-semibold text-primary-cta underline underline-offset-4">See every host fee</Link> or read <Link to="/features/payments" className="font-semibold text-primary-cta underline underline-offset-4">how payments work</Link>.
          </p>
        </div>
      </section>

      {/* ═══════════ 5 · WHERE CALENDLY IS THE BETTER CHOICE ═══════════ */}
      <section aria-labelledby="better-title" className={`border-t ${RULE} bg-white px-5 py-20 sm:px-8 lg:py-28`}>
        <div className="mx-auto max-w-5xl">
          <h2 id="better-title" className={`${H2} ${INK}`}>When is Calendly <span className="text-primary-cta">the better choice?</span></h2>
          <p className={`mt-5 max-w-2xl text-base leading-relaxed ${MUTED}`}>No tool fits everyone. Calendly is the better pick when:</p>
          <div className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
            {BETTER.map((b) => (
              <div key={b.title} className={`rounded-[6px] border ${RULE} bg-[color:var(--lg-paper)] p-6`}>
                <h3 className={`font-heading text-lg font-bold ${INK}`}>{b.title}</h3>
                <p className={`mt-2 text-[15px] leading-relaxed ${MUTED}`}>{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 6 · SAME BOOKING, TWO CHECKOUTS ═══════════ */}
      <section aria-labelledby="checkouts-title" className={`bg-[color:var(--lg-ink)] px-5 py-20 sm:px-8 lg:py-28 ${PAPER_TXT}`}>
        <div className="mx-auto max-w-5xl">
          <p className={`${KICKER} text-primary`}>Same booking, two checkouts</p>
          <h2 id="checkouts-title" className={`mt-3 ${H2} ${PAPER_TXT}`}>Can clients pay by UPI <span className="text-primary">on Calendly?</span></h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#FBF8F2]/75">
            No, not with the options Calendly lists. On Calendly Standard your client pays through Stripe or PayPal, and on the free plan there&rsquo;s no payment step. On Meeticulous they pay by UPI or card while booking and get a GST invoice. Here&rsquo;s one 30-minute booking on each.
            {' '}<Link to="/blog/calendly-upi-payments" className="font-semibold text-[#FBF8F2] underline decoration-white/30 underline-offset-4 hover:decoration-white">Calendly UPI workarounds, compared</Link>.
          </p>
          <TwoCheckouts />
          <p className="mt-6 text-xs text-[#FBF8F2]/60">Illustration of what a client sees. Calendly steps are based on its pricing page; amounts are an example.</p>
        </div>
      </section>

      {/* ═══════════ 7 · SWITCH IN 3 STEPS ═══════════ */}
      <section aria-labelledby="switch-title" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 id="switch-title" className={`${H2} ${INK}`}>How do you switch <span className="text-primary-cta">from Calendly?</span></h2>
          <ol className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className={`border-t ${RULE} pt-5`}>
                <span className="font-heading text-sm font-extrabold tabular-nums text-primary-cta">Step {String(i + 1).padStart(2, '0')}</span>
                <h3 className={`mt-2 font-heading text-xl font-bold ${INK}`}>{s.title}</h3>
                <p className={`mt-2 text-[15px] leading-relaxed ${MUTED}`}>{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10"><Cta slot="switch">Start free with Google</Cta></div>
        </div>
      </section>

      {/* ═══════════ 8 · TESTIMONIALS ═══════════ */}
      {QUOTES.length > 0 && (
        <section aria-labelledby="quotes-title" className={`border-y ${RULE} bg-white px-5 py-20 sm:px-8 lg:py-28`}>
          <div className="mx-auto max-w-6xl">
            <h2 id="quotes-title" className={`${H2} ${INK}`}>What hosts say about <span className="text-primary-cta">getting paid</span></h2>
            <div className="mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
              {QUOTES.map((t) => (
                <figure key={t.name} className={`flex flex-col border-t ${RULE} pt-6`}>
                  <blockquote className={`flex-1 font-heading text-lg font-semibold leading-snug ${INK}`}>&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-light font-heading text-sm font-bold text-primary-cta">
                      {t.name.replace(/^(Ar|Dr)\.\s*/, '').charAt(0)}
                    </span>
                    <span>
                      <span className={`block text-sm font-semibold ${INK}`}>{t.name}</span>
                      <span className={`block text-xs ${FAINT}`}>{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ 9 · FAQ ═══════════ */}
      <section id="faq" aria-labelledby="faq-title" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className={`${H2} ${INK}`}>Calendly alternative <span className="text-primary-cta">questions</span></h2>
          <div className={`mt-10 border-t ${RULE}`}>
            {FAQ.map((f, i) => (
              <details key={f.q} className={`group border-b ${RULE}`} open={i === 0}>
                <summary className="flex min-h-[44px] cursor-pointer list-none items-start gap-4 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="pt-0.5 font-heading text-sm font-extrabold tabular-nums text-primary-cta">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className={`flex-1 font-heading text-[17px] font-bold ${INK}`}>{f.q}</h3>
                  <span aria-hidden className={`pt-0.5 text-xl leading-none ${FAINT} transition-transform group-open:rotate-45`}>+</span>
                </summary>
                <p className={`pb-6 pl-9 pr-6 text-[15px] leading-relaxed ${MUTED}`}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 10 · RELATED + FINAL CTA ═══════════ */}
      <section aria-labelledby="related-title" className={`border-t ${RULE} px-5 py-16 sm:px-8`}>
        <div className="mx-auto grid max-w-6xl gap-10 md:grid-cols-[1.4fr_1fr]">
          <div>
            <h2 id="related-title" className={`font-heading text-2xl font-extrabold ${INK}`}>More comparisons</h2>
            <ul className="mt-5 grid gap-x-6 sm:grid-cols-2">
              {others.map((c) => (
                <li key={c.key}>
                  <Link to={c.path} className={`flex min-h-[44px] items-center gap-2.5 border-b ${RULE} py-2 text-sm font-semibold ${INK} hover:text-primary-cta hover:no-underline`}>
                    <img src={favicon(c.domain)} alt="" width="16" height="16" loading="lazy" className="h-4 w-4" />
                    Meeticulous vs {c.name}
                  </Link>
                </li>
              ))}
              <li>
                <Link to="/compare" className={`flex min-h-[44px] items-center gap-2 border-b ${RULE} py-2 text-sm font-semibold text-primary-cta hover:no-underline`}>
                  All comparisons <ArrowRight size={14} aria-hidden />
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h2 className={`font-heading text-2xl font-extrabold ${INK}`}>Guides</h2>
            <ul className="mt-5">
              {GUIDES.map((g) => (
                <li key={g.to}>
                  <Link to={g.to} className={`flex min-h-[44px] items-center border-b ${RULE} py-2 text-sm font-semibold ${INK} hover:text-primary-cta hover:no-underline`}>{g.label}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section aria-labelledby="final-title" className={`bg-[color:var(--lg-ink)] px-5 py-20 text-center sm:px-8 lg:py-28 ${PAPER_TXT}`}>
        <div className="mx-auto max-w-3xl">
          <h2 id="final-title" className={`${H2} ${PAPER_TXT}`}>One link for the booking <span className="text-primary">and the payment.</span></h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[#FBF8F2]/75">
            Start on {FREE_PLAN.name} for ₹0 and take UPI from your first booking. Move to {PREMIUM_PLAN.name} when you want {COMMISSION.premium} commission.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Cta slot="final" />
            <Link to="/pricing" className={`inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold ${PAPER_TXT} hover:no-underline hover:opacity-80`}>
              See pricing <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
