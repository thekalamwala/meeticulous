// /compare/acuity-alternative: Acuity Scheduling vs Meeticulous (Oct 2026 rebuild).
//
// Shared /compare/* order: hero · short answer · side-by-side table · what's
// different · where Acuity is the better choice · first-year cost · switch in 3
// steps · testimonials · FAQ · related comparisons + final CTA.
//
// Design system "Clinic Teal": deep teal + soft mint tint + warm paper, Book A
// Brand crimson on CTAs only. Mechanics unique to this page: an appointment-slip
// hero visual, and a Monthly / Yearly "first year" ledger with 12-month billing bars.
//
// HONESTY: Acuity facts come ONLY from data/competitors.js (null renders "Not
// listed", never "No"). Meeticulous facts come ONLY from data/plans.js plus the
// verified /host-fees numbers. Prices stay in each product's own currency; we
// never convert USD to ₹. Testimonials are the real, consented quotes.
//
// PERF: no images except favicons, no motion libraries, no reveal-on-scroll.
// The global Navbar (57px) + Footer come from App.jsx.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, X, ChevronRight, IndianRupee, Wallet, Receipt, MessageCircle,
  LogIn, CalendarClock, Share2,
} from 'lucide-react';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, comparisonGraphJsonLd } from '../../utils/seo';
import useUtm from '../../hooks/useUtm';
import { analytics, EVENTS } from '../../services/analytics';
import { COMPETITORS, COMPETITOR_LIST, CHECKED_LABEL } from '../../data/competitors';
import {
  FREE_PLAN, PREMIUM_PLAN, PLAN_MATRIX, PREMIUM_ANNUAL_SAVING, PREMIUM_YEARLY_PER_MONTH,
} from '../../data/plans';
import { TESTIMONIALS } from '../../data/testimonials';

const SLUG = 'acuity-alternative';
const START = '/become-a-host';
const ACU = COMPETITORS.acuity;
const FREE = FREE_PLAN.name;
const PREM = PREMIUM_PLAN.name;
const COMMISSION = PLAN_MATRIX.flatMap((g) => g.rows).find((r) => r.label === 'Commission on your bookings');

const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const usd = (n) => `$${n.toLocaleString('en-US')}`;

// Acuity's cheapest plan, parsed from competitors.js so a re-check there flows
// here: paidFrom = '$16 / month (Starter, billed yearly; $20 monthly)'.
const m = ACU.paidFrom.match(/\$(\d+).*?\((\w+).*?\$(\d+)/) || [];
export const ACUITY_PRICE = { plan: m[2], yearlyPerMonth: Number(m[1]), monthly: Number(m[3]) };
const { plan: ACU_PLAN, yearlyPerMonth: ACU_YR, monthly: ACU_MO } = ACUITY_PRICE;
const ACU_TRIAL = ACU.trial.replace(/ days?$/, '-day');                  // '7 days' → '7-day'
const ACU_PAYMENTS = ACU.payments.replace(/, (?=[^,]+$)/, ' and ');     // '…, PayPal and Venmo'

// Clinic Teal tokens, set on the page root (like /features). Every small-text
// pairing below was checked for AA (≥ 4.5:1).
const THEME = {
  '--ct-deep': '#0D4744',  // deep teal: dark sections, slip header
  '--ct-ink': '#0E5E59',   // teal for small text on paper/mint (6.5:1+)
  '--ct-mid': '#2A8077',   // decorative only (icons, bars)
  '--ct-mint': '#E3F1EC',  // soft mint tint sections
  '--ct-line': '#CFE5DD',  // mint borders
  '--ct-paper': '#FBF8F3', // warm paper
  '--ct-body': '#4A5A58',  // body text on paper/mint
  '--ct-glow': '#9ADBCB',  // accent on deep teal (large text only)
  '--ct-light': '#F3FAF8', // text on deep teal
  '--ct-soft': 'rgba(243,250,248,0.8)', // muted text on deep teal (~7:1)
  '--ct-mint-soft': '#EEF7F3', // Meeticulous column in the table
};
// ponytail: Tailwind 3 can't put /opacity on var() colours, hence the two
// pre-mixed tokens above instead of text-[var(--ct-light)]/80.

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const H2 = 'font-heading text-4xl font-extrabold leading-[1.06] tracking-tight sm:text-5xl';

const HERO_SUB = `Meeticulous is an Acuity Scheduling alternative built for India. Clients pay by UPI or card at booking, and you're billed in rupees with GST included: ${FREE} is free (${COMMISSION.free} per paid booking) and ${PREM} is ${inr(PREMIUM_PLAN.monthly)} a month with ${COMMISSION.premium} commission. Acuity has no free plan and starts at ${usd(ACU_YR)} a month, billed yearly in USD.`;

// One-line verdict + 3 short reasons per side. Detail lives in the table and FAQ below.
const SHORT_ANSWER = `Want a free plan and UPI payments? Pick Meeticulous. Clients mostly pay by US card, PayPal or Venmo? Pick ${ACU.name}.`;

const PICK_ACUITY = [
  "Clients pay by US card, PayPal or Venmo",
  "You want SMS reminders",
  "Paying in USD suits you",
];
const PICK_BAS = [
  "Clients pay by UPI",
  "You want a free plan to start",
  "You want rupee billing with GST invoices",
];

// Table rows: [label, Meeticulous, Acuity]. Acuity cells are competitors.js
// fields verbatim; true/false/null render as Yes / No / Not listed.
const ROWS = [
  ['Free plan', `Yes: ${FREE}, unlimited services and bookings`, ACU.freePlan],
  ['Paid plan from', `${inr(PREMIUM_PLAN.monthly)} / month (${PREM}; ${inr(PREMIUM_PLAN.yearly)} / year)`, ACU.paidFrom],
  ['Billing currency', 'INR, GST included', ACU.currency],
  ['Commission', `${COMMISSION.free} on ${FREE}, ${COMMISSION.premium} on ${PREM}`, ACU.commission],
  ['Taking payments', 'UPI and cards through Razorpay, settled to your Indian bank', ACU.payments],
  ['UPI at booking', true, ACU.upi],
  ['WhatsApp reminders', `On ${PREM}; first 2 months on ${FREE}`, ACU.whatsapp],
  ['SMS reminders', 'Reminders go by WhatsApp and email', ACU.sms],
  ['Free trial', `Not needed: ${FREE} is free`, ACU.trial],
];

const DIFFS = [
  { icon: IndianRupee, title: 'A free plan to start on', body: `${FREE} costs ${inr(FREE_PLAN.monthly)} a month, with unlimited services and bookings. You pay ${COMMISSION.free} only when a paid booking comes in. Acuity has no free plan; it has a ${ACU_TRIAL} trial.` },
  { icon: Wallet, title: 'UPI at booking, no gateway account needed', body: `Clients pay by UPI or card through Razorpay, on both plans. Meeticulous collects the money and settles it to your Indian bank account after a one-time KYC. Acuity takes ${ACU_PAYMENTS}, not UPI.`, link: { to: '/features/payments', label: 'How Meeticulous payments work' } },
  { icon: Receipt, title: 'Rupee prices and GST invoices', body: `${PREM} is ${inr(PREMIUM_PLAN.monthly)} a month or ${inr(PREMIUM_PLAN.yearly)} a year with GST included, and every paid booking gets a GST invoice for your client. Acuity bills in USD with taxes extra.`, link: { to: '/pricing', label: 'See Meeticulous pricing' } },
  { icon: MessageCircle, title: 'WhatsApp reminders', body: `${PREM} sends reminders on WhatsApp. On ${FREE} you get them for your first 2 months, then by email. Acuity's pricing page doesn't list WhatsApp reminders.` },
];

const WINS = [
  { title: 'Your clients are in the US', body: `Acuity takes payments through ${ACU_PAYMENTS} on every plan. If most of your clients pay by US card or Venmo, that checkout fits them better than a UPI-first one.` },
  { title: 'You want SMS reminders', body: `Acuity lists SMS reminders on the ${ACU.sms}. Meeticulous's reminders go by WhatsApp and email instead.` },
  { title: 'You want to trial paid features first', body: `Acuity gives a ${ACU_TRIAL} free trial, so you can try its paid features before the first charge. On Meeticulous you would start on the free ${FREE} plan instead.` },
];

const STEPS = [
  { icon: LogIn, title: 'Sign in with Google', body: 'Hosts sign in with their Google account, so there is no new password to create.' },
  { icon: CalendarClock, title: 'Add your services and availability', body: 'Set your prices (₹100 or more for a paid service) and your weekly hours. Google Calendar and Meet connect on both plans.' },
  { icon: Share2, title: 'Share your link', body: 'Swap your Acuity link for your Meeticulous link on WhatsApp, Instagram or your website. Finish a one-time KYC to receive payouts.' },
];

const PICKED = ['Vishal Chaware', 'Ar. Pranav Kadoo', 'Arjun Ravikumar'];
const QUOTES = PICKED.map((n) => TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);
const initials = (name) => {
  const parts = name.replace(/^(Ar|Dr)\.\s*/, '').split(' ');
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`;
};

// One array feeds the visible FAQ AND the FAQPage JSON-LD. Answers are strings.
export const FAQ = [
  { q: 'Is Acuity Scheduling free?', a: `No. Acuity Scheduling has no free plan; it offers a ${ACU_TRIAL} free trial. Its cheapest plan, ${ACU_PLAN}, costs ${usd(ACU_YR)} a month billed yearly or ${usd(ACU_MO)} billed monthly, in US dollars with taxes extra. Meeticulous's ${FREE} plan is free, with unlimited services and bookings and a ${COMMISSION.free} commission on each paid booking.` },
  { q: 'How much does Acuity Scheduling cost in India?', a: `Acuity Scheduling lists its prices in US dollars, with taxes extra: ${ACU_PLAN} is ${usd(ACU_YR)} a month billed yearly (${usd(ACU_YR * 12)} a year) or ${usd(ACU_MO)} month to month. We don't convert that to rupees because exchange rates change. Meeticulous bills in rupees with GST included: ${FREE} is ${inr(FREE_PLAN.monthly)} and ${PREM} is ${inr(PREMIUM_PLAN.monthly)} a month or ${inr(PREMIUM_PLAN.yearly)} a year.` },
  { q: 'Does Acuity Scheduling support UPI?', a: `No. Acuity Scheduling takes payments through ${ACU_PAYMENTS}, and UPI isn't one of them. On Meeticulous, clients pay by UPI or card through Razorpay when they book, on both plans. Meeticulous collects the payment and settles it to your Indian bank account after a one-time KYC, so you don't need a payment gateway account of your own.` },
  { q: 'Does Acuity Scheduling send WhatsApp reminders?', a: `Acuity's pricing page doesn't list WhatsApp reminders. It lists SMS reminders on the ${ACU.sms}. Meeticulous sends WhatsApp reminders on ${PREM}. On the free ${FREE} plan you get them for your first 2 months, then reminders go by email.` },
  { q: 'Is there a free alternative to Acuity Scheduling?', a: `Yes. Meeticulous's ${FREE} plan costs ${inr(FREE_PLAN.monthly)} a month, with unlimited services and bookings, UPI and card payments, Google Calendar and Meet, and GST invoices. You pay a ${COMMISSION.free} commission only on paid bookings, plus the gateway charge (about 2%) at cost. When that commission adds up to more than ${inr(PREMIUM_YEARLY_PER_MONTH)} a month, ${PREM} at ${inr(PREMIUM_PLAN.yearly)} a year removes it.` },
  { q: 'How much does Meeticulous cost?', a: `${FREE} is free, with a ${COMMISSION.free} commission on each paid booking. ${PREM} is ${inr(PREMIUM_PLAN.monthly)} a month or ${inr(PREMIUM_PLAN.yearly)} a year, GST included, with ${COMMISSION.premium} commission. On both plans your client pays a flat ₹10 + GST booking fee, the gateway charge (about 2%) is passed through at cost, and TDS 1% + TCS 1% are deducted on payout. On ₹1,000 at ${COMMISSION.premium} commission you receive ₹959.76.` },
  { q: 'Can I move from Acuity Scheduling to Meeticulous?', a: 'Yes. Sign in with Google, add your services and weekly availability, and share your new booking link with clients wherever you used your Acuity link. Google Calendar and Meet work on both plans. To receive payouts, complete a one-time KYC so Meeticulous can settle payments to your Indian bank account. Keep Acuity until your existing appointments are done.' },
];

const RELATED = COMPETITOR_LIST.filter((c) => c.key !== 'acuity');
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function StartCta({ onClick, children = 'Start free' }) {
  return (
    <Link
      to={START}
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] bg-primary px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(194,61,0,0.22)] transition-opacity hover:no-underline hover:opacity-90"
    >
      {children} <ArrowRight size={16} aria-hidden />
    </Link>
  );
}

function Cell({ value }) {
  if (value === true) return <span className="inline-flex items-center gap-1.5 font-semibold"><Check size={15} className="text-[var(--ct-mid)]" aria-hidden />Yes</span>;
  if (value === false) return <span className="inline-flex items-center gap-1.5"><X size={15} className="text-neutral-400" aria-hidden />No</span>;
  if (value == null) return <span className="text-neutral-500">Not listed</span>;
  return <span>{value}</span>;
}

/* Hero visual: an appointment slip, pure JSX/CSS. */
const WEEK = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SLIP = ['Paid by UPI at booking', 'GST invoice sent', 'WhatsApp reminder set'];

function AppointmentSlip() {
  return (
    <figure className="mx-auto w-full max-w-[21rem]">
      <div aria-hidden className="overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_24px_60px_-28px_rgba(13,71,68,0.4)]">
        <div className="bg-[var(--ct-deep)] px-5 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ct-soft)]">Follow-up consultation</div>
          <div className="mt-1 font-heading text-base font-bold text-[var(--ct-light)]">45 min · Thu, 10:30 AM</div>
        </div>
        <div className="grid grid-cols-7 gap-1 px-5 pt-4 text-center text-[11px] font-semibold">
          {WEEK.map((d, i) => (
            <span key={i} className={`rounded-[5px] py-1.5 ${i === 3 ? 'bg-[var(--ct-deep)] text-[var(--ct-light)]' : 'bg-[var(--ct-mint)] text-[var(--ct-ink)]'}`}>{d}</span>
          ))}
        </div>
        <ul className="space-y-2.5 px-5 py-4 text-sm text-ink">
          {SLIP.map((t) => (
            <li key={t} className="flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ct-mint)] text-[var(--ct-ink)]"><Check size={14} /></span>
              {t}
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between border-t border-black/5 px-5 py-3 text-xs text-[var(--ct-body)]">
          <span>Billed in ₹, GST included</span>
          <span className="rounded-full bg-primary-light px-2.5 py-1 font-semibold text-primary-cta">UPI</span>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[11px] text-[var(--ct-body)]">Illustration of a client booking on Meeticulous</figcaption>
    </figure>
  );
}

/* "What the first year costs": published prices × 12, no conversion. */
function yearRows(yearly) {
  return [
    {
      name: ACU.name,
      plan: ACU_PLAN,
      bar: yearly ? 'year' : 'month',
      total: usd((yearly ? ACU_YR : ACU_MO) * 12),
      math: `${usd(yearly ? ACU_YR : ACU_MO)} × 12 = ${usd((yearly ? ACU_YR : ACU_MO) * 12)}`,
      note: `Billed ${yearly ? 'yearly' : 'monthly'} in ${ACU.currency}. No free plan; ${ACU_TRIAL} trial.`,
    },
    {
      name: 'Meeticulous',
      plan: `${FREE} (free)`,
      bar: 'none',
      total: inr(FREE_PLAN.monthly * 12),
      math: `${inr(FREE_PLAN.monthly)} × 12 = ${inr(FREE_PLAN.monthly * 12)}`,
      note: `No subscription. ${COMMISSION.free} commission on each paid booking instead.`,
    },
    {
      name: 'Meeticulous',
      plan: PREM,
      bar: yearly ? 'year' : 'month',
      brand: true,
      total: inr(yearly ? PREMIUM_PLAN.yearly : PREMIUM_PLAN.monthly * 12),
      math: yearly
        ? `${inr(PREMIUM_PLAN.yearly)} once a year (about ${inr(PREMIUM_YEARLY_PER_MONTH)} a month)`
        : `${inr(PREMIUM_PLAN.monthly)} × 12 = ${inr(PREMIUM_PLAN.monthly * 12)}`,
      note: `Billed ${yearly ? 'yearly' : 'monthly'} in ₹, GST included. ${COMMISSION.premium} commission.`,
    },
  ];
}

// 12 cells = 12 months. One block per charge: 12 for monthly, 1 wide for yearly.
function BillingBar({ kind, brand }) {
  const fill = brand ? 'bg-primary' : 'bg-white/50';
  if (kind === 'year') return <div aria-hidden className={`h-3 w-full rounded-[3px] ${fill}`} />;
  return (
    <div aria-hidden className="grid h-3 grid-cols-12 gap-1">
      {Array.from({ length: 12 }, (_, i) => (
        <span key={i} className={`rounded-[3px] ${kind === 'none' ? 'border border-dashed border-white/35' : fill}`} />
      ))}
    </div>
  );
}

function FirstYearCost() {
  const [yearly, setYearly] = useState(true); // deterministic: Acuity's headline price is yearly
  const rows = yearRows(yearly);
  const toggle = (on, label) => (
    <button
      type="button"
      aria-pressed={yearly === on}
      onClick={() => setYearly(on)}
      className={`min-h-[44px] rounded-[5px] px-5 text-sm font-semibold transition-colors ${yearly === on ? 'bg-[var(--ct-light)] text-[var(--ct-deep)]' : 'text-[var(--ct-soft)] hover:text-[var(--ct-light)]'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div role="group" aria-label="Billing period" className="inline-flex gap-1 rounded-[6px] border border-white/15 p-1">
          {toggle(false, 'Monthly')}
          {toggle(true, 'Yearly')}
        </div>
        <p className="text-sm text-[var(--ct-soft)]">Each bar is 12 months. One block is one charge.</p>
      </div>

      <ul className="mt-6 space-y-4">
        {rows.map((r) => (
          <li key={r.plan} className={`grid gap-4 rounded-[6px] border p-5 sm:p-6 md:grid-cols-[13rem_1fr_15rem] md:items-center md:gap-8 ${r.brand ? 'border-primary/40 bg-white/[0.07]' : 'border-white/10 bg-white/[0.03]'}`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ct-soft)]">{r.name}</p>
              <h3 className="mt-1 font-heading text-lg font-bold text-[var(--ct-light)]">{r.plan}</h3>
            </div>
            <BillingBar kind={r.bar} brand={r.brand} />
            <div className="md:text-right">
              <p className="font-heading text-3xl font-extrabold tabular-nums text-[var(--ct-light)]">{r.total}<span className="ml-1 text-sm font-semibold text-[var(--ct-soft)]">/ year</span></p>
              <p className="mt-1 text-sm tabular-nums text-[var(--ct-soft)]">{r.math}</p>
            </div>
            <p className="text-sm text-[var(--ct-soft)] md:col-span-3">{r.note}</p>
          </li>
        ))}
      </ul>

      <p className="mt-8 text-sm leading-relaxed text-[var(--ct-soft)]">
        Paying yearly instead of monthly saves {usd((ACU_MO - ACU_YR) * 12)} on Acuity {ACU_PLAN} and {inr(PREMIUM_ANNUAL_SAVING)} on {PREM}.
        These are subscription prices only, as each product publishes them. We don&rsquo;t convert dollars to rupees, because exchange rates change.
        On Meeticulous, your client also pays a flat ₹10 + GST booking fee on each paid booking, the gateway charge (about 2%) is passed through at cost, and TDS 1% + TCS 1% are deducted on payout.{' '}
        <Link to="/host-fees" className="font-semibold text-[var(--ct-light)] underline decoration-white/40 underline-offset-4 hover:decoration-white">See every Meeticulous fee</Link>
      </p>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

const TITLE = 'Acuity Scheduling Alternative for India (UPI) | Meeticulous';
const DESCRIPTION = 'Acuity Scheduling has no free plan and bills in USD. Meeticulous is free to start, takes UPI at booking and bills in rupees with GST included. Compare both.';

export default function AcuityAlternative() {
  const utm = useUtm();
  const canonical = `${SITE_URL}${ACU.path}`;
  const track = (slot) => () => analytics.track(EVENTS.LP_CTA_CLICKED, { slug: SLUG, slot, ...utm });

  useEffect(() => {
    analytics.track(EVENTS.LP_VIEWED, { slug: SLUG, ...utm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="overflow-x-clip bg-[var(--ct-paper)] text-ink" style={THEME}>
      <Seo
        title={TITLE}
        description={DESCRIPTION}
        canonical={canonical}
        image={ogCard('lp-acuity-alternative')}
        jsonLd={comparisonGraphJsonLd({ canonical, name: TITLE, description: DESCRIPTION, breadcrumbName: 'Acuity Alternative', faqs: FAQ })}
      />

      {/* ═══════════ 1 · HERO ═══════════ */}
      <section className="relative overflow-hidden px-5 pb-16 pt-6 sm:px-8 sm:pt-10 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center lg:py-10">
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full" style={{ background: 'radial-gradient(closest-side, rgba(42,128,119,0.16), transparent)' }} />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1 text-xs text-[var(--ct-body)]">
                <li><Link to="/" className="inline-block py-1 text-[var(--ct-body)] hover:text-ink hover:no-underline">Home</Link></li>
                <li aria-hidden><ChevronRight size={13} /></li>
                <li><Link to="/compare" className="inline-block py-1 text-[var(--ct-body)] hover:text-ink hover:no-underline">Compare</Link></li>
                <li aria-hidden><ChevronRight size={13} /></li>
                <li aria-current="page" className="font-semibold text-[var(--ct-ink)]">Acuity Alternative</li>
              </ol>
            </nav>
            <h1 className="mt-3 font-heading text-[clamp(2.1rem,3.7vw,3.2rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-ink">
              Acuity Scheduling alternative <span className="text-[var(--ct-ink)]">for India</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-[var(--ct-body)] sm:text-base lg:text-[17px]">{HERO_SUB}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <StartCta onClick={track('hero')} />
              <a href="#side-by-side" className="inline-flex items-center justify-center gap-2 rounded-[6px] border border-black/10 bg-white px-6 py-3 text-sm font-semibold text-ink transition-opacity hover:no-underline hover:opacity-80">
                See the comparison
              </a>
            </div>
            <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[var(--ct-body)]">
              {[`${FREE} plan is free`, 'Sign in with Google', 'GST invoices on both plans'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><Check size={14} className="text-[var(--ct-mid)]" aria-hidden />{t}</span>
              ))}
            </p>
          </div>
          <AppointmentSlip />
        </div>
      </section>

      {/* ═══════════ 2 · THE SHORT ANSWER ═══════════ */}
      <section id="short-answer" className="scroll-mt-20 px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-[10px] border border-[var(--ct-line)] bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-10">
            <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--ct-mid)]" />
            <h2 className={H2}>The <span className="text-primary-cta">short</span> answer</h2>
            <p className="mt-6 font-heading text-lg font-bold leading-snug text-ink sm:text-xl">{SHORT_ANSWER}</p>
            <div className="mt-8 grid gap-6 border-t border-black/5 pt-7 sm:grid-cols-2">
              {[[`Pick ${ACU.name} if…`, PICK_ACUITY], ['Pick Meeticulous if…', PICK_BAS]].map(([title, items]) => (
                <div key={title}>
                  <h3 className="font-heading text-lg font-bold">{title}</h3>
                  <ul className="mt-3 space-y-2 text-[15px] text-[var(--ct-body)]">
                    {items.map((t) => (
                      <li key={t} className="flex items-start gap-2"><Check size={16} className="mt-1 shrink-0 text-[var(--ct-mid)]" aria-hidden />{t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════ 3 · SIDE BY SIDE ═══════════ */}
      <section id="side-by-side" className="scroll-mt-20 bg-[var(--ct-mint)] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className={`${H2} max-w-3xl`}>Acuity Scheduling vs Meeticulous, <span className="text-primary-cta">side by side</span></h2>
            <span className="rounded-full border border-[var(--ct-line)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--ct-ink)]">Last checked {CHECKED_LABEL}</span>
          </div>
          <div className="mt-10 overflow-hidden rounded-[6px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
            <div className="overflow-x-auto" role="region" aria-labelledby="acu-table-caption" tabIndex={0}>
              <table className="w-full min-w-[640px] text-left text-sm">
                <caption id="acu-table-caption" className="px-5 pt-5 text-left text-xs text-[var(--ct-body)]">
                  Plans, prices and payments: Acuity Scheduling compared with Meeticulous ({CHECKED_LABEL}).
                </caption>
                <thead>
                  <tr className="border-b border-black/5">
                    <th scope="col" className="px-5 py-4 text-xs font-semibold uppercase tracking-wide text-[var(--ct-body)]">Feature</th>
                    <th scope="col" className="bg-[var(--ct-mint-soft)] px-5 py-4 font-heading text-sm font-bold text-ink">
                      <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" />Meeticulous</span>
                    </th>
                    <th scope="col" className="px-5 py-4 font-heading text-sm font-bold text-ink">
                      <span className="inline-flex items-center gap-2">
                        <img src={favicon(ACU.domain)} alt="" width="18" height="18" loading="lazy" className="h-[18px] w-[18px] rounded-[3px]" />
                        {ACU.name}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map(([label, bas, acu]) => (
                    <tr key={label} className="border-t border-black/5 align-top">
                      <th scope="row" className="px-5 py-3.5 font-medium text-ink">{label}</th>
                      <td className="bg-[var(--ct-mint-soft)] px-5 py-3.5 text-ink"><Cell value={bas} /></td>
                      <td className="px-5 py-3.5 text-[var(--ct-body)]"><Cell value={acu} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="mt-5 text-sm leading-relaxed text-[var(--ct-body)]">
            Checked against Acuity Scheduling&rsquo;s pricing page in {CHECKED_LABEL}. Prices as published, in their currency.{' '}
            <a href={ACU.source} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-[var(--ct-ink)] underline underline-offset-4">Acuity Scheduling&rsquo;s pricing page</a>
          </p>
          <p className="mt-2 text-xs text-[var(--ct-body)]">Acuity Scheduling is a trademark of its owner. Meeticulous isn&rsquo;t affiliated with Acuity Scheduling.</p>
        </div>
      </section>

      {/* ═══════════ 4 · WHAT'S DIFFERENT ═══════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className={`${H2} max-w-3xl`}>What&rsquo;s different for a business in <span className="text-primary-cta">India?</span></h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {DIFFS.map((d) => (
              <article key={d.title} className="rounded-[6px] border border-black/5 bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-[6px] bg-[var(--ct-mint)] text-[var(--ct-ink)]"><d.icon size={20} aria-hidden /></span>
                <h3 className="mt-5 font-heading text-xl font-bold">{d.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--ct-body)]">{d.body}</p>
                {d.link && (
                  <Link to={d.link.to} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ct-ink)] hover:no-underline hover:opacity-80">
                    {d.link.label} <ArrowRight size={14} aria-hidden />
                  </Link>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 5 · WHERE ACUITY IS THE BETTER CHOICE ═══════════ */}
      <section className="bg-[var(--ct-mint)] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className={`${H2} max-w-3xl`}>When is Acuity Scheduling the <span className="text-primary-cta">better</span> choice?</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--ct-body)]">It depends on where your clients are and how they pay. Acuity is a good fit when:</p>
          <ol className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
            {WINS.map((w, i) => (
              <li key={w.title} className="rounded-[6px] border border-[var(--ct-line)] bg-white p-7">
                <span className="font-heading text-sm font-extrabold tabular-nums text-[var(--ct-ink)]">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-3 font-heading text-lg font-bold">{w.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--ct-body)]">{w.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════ 6 · WHAT THE FIRST YEAR COSTS ═══════════ */}
      <section id="first-year" className="scroll-mt-20 bg-[var(--ct-deep)] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <h2 className={`${H2} max-w-3xl text-[var(--ct-light)]`}>How much does Acuity Scheduling <span className="text-[var(--ct-glow)]">cost</span> in India?</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--ct-soft)]">
            What the first year costs on each product&rsquo;s entry plans, at the prices they publish. Acuity in US dollars, Meeticulous in rupees, side by side.
          </p>
          <FirstYearCost />
        </div>
      </section>

      {/* ═══════════ 7 · SWITCH IN 3 STEPS ═══════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className={`${H2} max-w-3xl`}>How do I <span className="text-primary-cta">switch</span> from Acuity?</h2>
          <ol className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-[6px] border border-black/5 bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--ct-deep)] font-heading text-sm font-extrabold text-[var(--ct-light)]">{i + 1}</span>
                  <s.icon size={20} className="text-[var(--ct-mid)]" aria-hidden />
                </div>
                <h3 className="mt-5 font-heading text-lg font-bold">{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--ct-body)]">{s.body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10"><StartCta onClick={track('switch')}>Start free with Google</StartCta></div>
        </div>
      </section>

      {/* ═══════════ 8 · TESTIMONIALS ═══════════ */}
      {QUOTES.length > 0 && (
        <section className="bg-[var(--ct-mint)] px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <h2 className={`${H2} max-w-3xl`}>What <span className="text-primary-cta">hosts</span> say</h2>
            <div className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
              {QUOTES.map((t) => (
                <figure key={t.name} className="flex flex-col rounded-[6px] border border-[var(--ct-line)] bg-white p-7">
                  <blockquote className="flex-1 text-[15px] leading-relaxed text-ink">&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3">
                    <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ct-mint)] font-heading text-sm font-bold text-[var(--ct-ink)]">{initials(t.name)}</span>
                    <span>
                      <span className="block text-sm font-semibold text-ink">{t.name}</span>
                      <span className="block text-xs text-[var(--ct-body)]">{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ 9 · FAQ ═══════════ */}
      <section id="faq" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 className={H2}>Acuity Scheduling questions, <span className="text-primary-cta">answered</span></h2>
          <div className="mt-10 border-t border-black/10">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-black/10">
                <summary className="flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-5 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="font-heading text-[17px] font-bold text-ink">{f.q}</span>
                  <span aria-hidden className="pt-0.5 text-xl leading-none text-[var(--ct-mid)] motion-safe:transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-6 pr-8 text-[15px] leading-relaxed text-[var(--ct-body)]">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 10 · RELATED + FINAL CTA ═══════════ */}
      <section className="border-t border-black/5 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className={`${H2} max-w-3xl`}>Compare other <span className="text-primary-cta">booking tools</span></h2>
          <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {RELATED.map((c) => (
              <li key={c.key}>
                <Link to={c.path} className="flex min-h-[56px] items-center gap-3 rounded-[6px] border border-black/5 bg-white px-5 py-3 text-sm font-semibold text-ink hover:no-underline hover:opacity-80">
                  <img src={favicon(c.domain)} alt="" width="20" height="20" loading="lazy" className="h-5 w-5 rounded-[3px]" />
                  <span className="flex-1">Meeticulous vs {c.name}</span>
                  <ArrowRight size={15} className="text-[var(--ct-mid)]" aria-hidden />
                </Link>
              </li>
            ))}
            <li>
              <Link to="/compare" className="flex min-h-[56px] items-center gap-3 rounded-[6px] border border-[var(--ct-line)] bg-[var(--ct-mint)] px-5 py-3 text-sm font-semibold text-[var(--ct-ink)] hover:no-underline hover:opacity-80">
                <span className="flex-1">All booking tool comparisons</span>
                <ArrowRight size={15} aria-hidden />
              </Link>
            </li>
          </ul>
          <p className="mt-6 text-sm text-[var(--ct-body)]">
            Still choosing? Read our guide to the{' '}
            <Link to="/blog/best-appointment-booking-apps-india" className="font-semibold text-[var(--ct-ink)] underline underline-offset-4">appointment booking apps people use in India</Link>.
          </p>
        </div>
      </section>

      <section className="bg-[var(--ct-deep)] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className={`${H2} text-[var(--ct-light)]`}>Start free and get paid <span className="text-[var(--ct-glow)]">by UPI</span></h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-[var(--ct-soft)]">
            Set up your booking page on the free {FREE} plan. Move to {PREM} when the {COMMISSION.free} per booking adds up to more than its price.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <StartCta onClick={track('final')} />
            <Link to="/pricing" className="inline-flex items-center justify-center gap-2 rounded-[6px] border border-white/15 px-6 py-3 text-sm font-semibold text-[var(--ct-light)] hover:no-underline hover:opacity-80">
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
