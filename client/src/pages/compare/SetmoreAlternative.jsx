// /compare/setmore-alternative — Meeticulous vs Setmore.
//
// Design system "Mint Grid": fresh mint tint + deep forest-green ink, a visible
// graph-paper grid and square tiles throughout, Meeticulous orange on CTAs.
// Page mechanic: "free plan vs free plan" receipts + a "how do your clients
// pay?" picker that says honestly which tool fits (international card →
// Setmore is fine; UPI → Meeticulous). Deterministic initial state (UPI).
//
// HONESTY: every Setmore fact comes from data/competitors.js (checked against
// setmore.com/pricing). Every Meeticulous price, plan name and commission comes
// from data/plans.js; the few other platform facts (₹10 + GST booking fee,
// ~2% gateway, TDS/TCS, KYC payouts, ₹100 minimum) are the ones on /host-fees.
// No ratings, no user counts. Testimonials are real, consented quotes.
//
// PERF: no images except competitor favicons, no motion libraries, hero text
// paints first. Global Navbar + Footer come from App.jsx.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, X, Smartphone, CreditCard, Globe, Users, MessageCircle,
  Receipt, Landmark, LogIn, CalendarCheck, Share2,
} from 'lucide-react';
import useUtm from '../../hooks/useUtm';
import { analytics, EVENTS } from '../../services/analytics';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, comparisonGraphJsonLd } from '../../utils/seo';
import { COMPETITORS, COMPETITOR_LIST, CHECKED_LABEL } from '../../data/competitors';
import { FREE_PLAN, PREMIUM_PLAN, PLAN_MATRIX } from '../../data/plans';
import { TESTIMONIALS } from '../../data/testimonials';

const SLUG = 'setmore-alternative';
const START = '/become-a-host';
const S = COMPETITORS.setmore;

/* ─────────────────────────────  DATA HELPERS  ────────────────────────────── */

const MATRIX = PLAN_MATRIX.flatMap((g) => g.rows);
const row = (label) => MATRIX.find((r) => r.label === label);
const commission = row('Commission on your bookings');
const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const orList = (s) => s.replace(/, (?=[^,]*$)/, ' or ');
// ponytail: splits competitors.js freePlan ("Yes: up to 4 users, unlimited
// appointments") into receipt lines, so a re-check there updates this page.
const SET_FREE = S.freePlan.replace(/^Yes:\s*/, '').split(/,\s*/);
const PAY_OR = orList(S.payments);
const favicon = (domain) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

/* ─────────────────────────────  PALETTE  ────────────────────────────── */

const VARS = {
  '--mg-ink': '#0F3B2E',   // deep forest ink (headings, body)
  '--mg-muted': '#3F5F53', // body copy, 6.3:1 on mint
  '--mg-green': '#1D6B4C', // small accent text, 5.8:1 on mint
  '--mg-mint': '#EAF6EF',  // section tint
  '--mg-tile': '#D7EEE2',  // tile fill
  '--mg-line': 'rgba(15,59,46,0.09)',
  '--mg-glow': '#FFB088',  // orange accent on dark forest (7:1)
};
const GRID = {
  backgroundImage: 'linear-gradient(var(--mg-line) 1px, transparent 1px), linear-gradient(90deg, var(--mg-line) 1px, transparent 1px)',
  backgroundSize: '40px 40px',
};
const GRID_DARK = {
  backgroundColor: 'var(--mg-ink)',
  backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
  backgroundSize: '40px 40px',
};
const INK = 'text-[color:var(--mg-ink)]';
const MUTED = 'text-[color:var(--mg-muted)]';
const GREEN = 'text-[color:var(--mg-green)]';
const H2 = `font-heading text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl ${INK}`;
const CARD = 'rounded-[6px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]';
const TEXT_LINK = `font-semibold underline underline-offset-4 ${GREEN} hover:text-[color:var(--mg-ink)]`;

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const TITLE = 'Setmore Alternative for India (UPI + GST) | Meeticulous';
const DESCRIPTION = "Setmore and Meeticulous both have free plans. Meeticulous's takes UPI at booking, sends GST invoices and bills in rupees. Compare both plans side by side.";

const HERO_SUB = `Meeticulous is a ${S.name} alternative for India if your clients pay by UPI. Both have free plans. ${S.name}'s covers ${SET_FREE[0]} and unlimited appointments. Meeticulous's ${FREE_PLAN.name} plan takes UPI and cards at booking and sends GST invoices, for ${commission.free} per paid booking.`;

// One-line verdict + 3 short reasons per side. Detail lives in the table and FAQ below.
const SHORT_ANSWER = `Clients pay by UPI? Pick Meeticulous. A small team sharing one free plan? Pick ${S.name}.`;

const PICK_SETMORE = [
  "Up to 4 people share the free plan",
  "Clients pay by international card",
  "You want SMS reminders on Pro",
];
const PICK_BAS = [
  "Clients pay by UPI at booking",
  "You want a GST invoice per booking",
  "No payment gateway account to set up",
];

// Side-by-side rows: [label, Meeticulous, Setmore]. true/false → Yes/No, null → Not listed.
const ROWS = [
  ['Free plan', `Yes: unlimited bookings, ${commission.free} commission on paid bookings`, S.freePlan],
  ['Paid plan from', `${inr(PREMIUM_PLAN.monthly)} / month (${inr(PREMIUM_PLAN.yearly)} / year), ${PREMIUM_PLAN.name}`, S.paidFrom],
  ['Billing currency', 'INR, GST included', S.currency],
  ['Commission', `${commission.free} on ${FREE_PLAN.name}, ${commission.premium} on ${PREMIUM_PLAN.name}`, S.commission],
  ['Taking payments', 'UPI and cards, through Razorpay', S.payments],
  ['UPI at booking', true, S.upi],
  ['WhatsApp reminders', `On ${PREMIUM_PLAN.name}; ${FREE_PLAN.name} gets them for the first 2 months, then email`, S.whatsapp],
  ['Users on the free plan', 'One host per account (no team seats)', cap(SET_FREE[0])],
  ['SMS reminders', 'WhatsApp and email instead', S.sms],
];

const DIFFERENT = [
  { Icon: Smartphone, title: 'UPI at checkout, on both plans', body: `Clients pay by UPI or card through Razorpay when they book, on the free ${FREE_PLAN.name} plan too.`, link: { to: '/features/payments', label: 'How payments work' } },
  { Icon: Landmark, title: 'No gateway account to set up', body: 'Meeticulous collects the payment and settles it to your Indian bank account after a one-time KYC. You never open a payment gateway account of your own.' },
  { Icon: Receipt, title: 'GST invoices, rupee pricing', body: `Every paid booking gets a GST invoice, on both plans. Plans are priced in rupees with GST included: ${inr(FREE_PLAN.monthly)} or ${inr(PREMIUM_PLAN.monthly)} a month.`, link: { to: '/pricing', label: 'See pricing' } },
  { Icon: MessageCircle, title: 'WhatsApp reminders', body: `${PREMIUM_PLAN.name} sends WhatsApp reminders. ${FREE_PLAN.name} gets them for your first 2 months, then switches to email. Google Calendar and Meet work on both plans.` },
];

const BETTER = [
  { Icon: Users, title: 'A free plan for a small team', body: `${S.name}'s free plan covers ${SET_FREE.join(' and ')}. Meeticulous has no team seats: each account is one host.` },
  { Icon: Globe, title: `Pro from ${S.paidFrom.split(' (')[0]}`, body: `Paid plans start at ${S.paidFrom}, in ${S.currency}. If your clients pay by card from abroad through ${PAY_OR}, that can be all you need.` },
  { Icon: MessageCircle, title: 'SMS reminders on Pro', body: `${S.name} lists SMS reminders on its ${S.sms}. Meeticulous sends reminders by WhatsApp and email, not SMS.` },
];

// Picker: deterministic initial state is 'upi'. `bas` / `setmore` = [badge, fits?].
const PAYS = [
  {
    id: 'upi', label: 'UPI', Icon: Smartphone, verdict: 'Meeticulous fits',
    body: `Clients pay by UPI at checkout, through Razorpay, on both Meeticulous plans. UPI isn't one of ${S.name}'s listed payment options (${S.payments}).`,
    bas: ['Fits', true], setmore: ['No UPI listed', false],
  },
  {
    id: 'card', label: 'Indian card', Icon: CreditCard, verdict: 'Either can work',
    body: `Both take card payments. ${S.name} uses ${PAY_OR}. Meeticulous uses Razorpay and settles to your Indian bank account after a one-time KYC, so there's no gateway account to open.`,
    bas: ['Works', true], setmore: ['Works', true],
  },
  {
    id: 'intl', label: 'International card', Icon: Globe, verdict: `${S.name} works fine`,
    body: `${S.name} takes payments through ${PAY_OR} and bills in ${S.currency}, which suits clients paying by card from abroad. Meeticulous is built around Indian payments: UPI and cards through Razorpay, paid out to an Indian bank.`,
    bas: ['Built for India', false], setmore: ['Fits', true],
  },
];

const RECEIPTS = {
  setmore: {
    name: S.name, plan: 'Free plan', domain: S.domain,
    lines: [
      ...SET_FREE.map((s) => ['Included', cap(s)]),
      ['Billed in', S.currency],
      ['Commission', S.commission],
    ],
    total: ['Monthly price', 'Free'],
    notes: [`Payment tools on its pricing page: ${S.payments} (plan not specified).`, `Paid plans from ${S.paidFrom}.`, `SMS reminders: ${S.sms}. ${cap(S.trial)}.`],
  },
  bas: {
    name: 'Meeticulous', plan: `${FREE_PLAN.name} plan`,
    lines: [
      ['Bookings', row('Bookings').free],
      ['Payments', 'UPI + cards via Razorpay'],
      ['GST invoices', 'Included'],
      ['Payouts', 'To your Indian bank (KYC)'],
      ['Team seats', 'Just you'],
      ['Commission', `${commission.free} per paid booking`],
    ],
    total: ['Monthly price', inr(FREE_PLAN.monthly)],
    notes: [
      'Clients pay a flat ₹10 + GST booking fee per paid booking. The gateway charge (~2%) and TDS 1% + TCS 1% come off your payout.',
      `${PREMIUM_PLAN.name}: ${inr(PREMIUM_PLAN.monthly)} / month, ${commission.premium} commission.`,
    ],
  },
};

const STEPS = [
  { Icon: LogIn, title: 'Sign in with Google', body: 'Your host account uses your Google sign-in. No password to make up.' },
  { Icon: CalendarCheck, title: 'Add your services and availability', body: 'Recreate your Setmore services (paid ones from ₹100) and set your weekly hours.' },
  { Icon: Share2, title: 'Share your link', body: 'Put it in your Instagram bio, WhatsApp or website. Clients pick a slot and pay by UPI or card.' },
];

const QUOTES = ['Ar. Pranav Kadoo', 'Vishal Chaware', 'Mukesh Tidke']
  .map((n) => TESTIMONIALS.find((t) => t.name === n))
  .filter(Boolean);

export const FAQ = [
  {
    q: 'Is Setmore free?',
    a: `Yes. ${S.name}'s pricing page lists a free plan with ${SET_FREE.join(' and ')}, as checked in ${CHECKED_LABEL}. Paid plans start at ${S.paidFrom}, billed in ${S.currency}. Meeticulous's ${FREE_PLAN.name} plan is also free, with unlimited bookings, UPI payments and GST invoices, and a ${commission.free} commission on paid bookings.`,
  },
  {
    q: 'Does Setmore support UPI payments?',
    a: `UPI isn't one of the payment options on ${S.name}'s pricing page, which lists ${S.payments}. If your clients in India pay by UPI, Meeticulous takes UPI and cards at booking through Razorpay on both plans, and pays the money out to your Indian bank account after a one-time KYC.`,
  },
  {
    q: 'How much does Setmore cost in India?',
    a: `${S.name} publishes its prices in ${S.currency}: the free plan covers ${SET_FREE[0]}, and paid plans start at ${S.paidFrom}. We don't convert that to rupees, because exchange rates and taxes change. For comparison, Meeticulous's ${PREMIUM_PLAN.name} plan is ${inr(PREMIUM_PLAN.monthly)} a month or ${inr(PREMIUM_PLAN.yearly)} a year, GST included.`,
  },
  {
    q: 'What is a free Setmore alternative with UPI?',
    a: `Meeticulous's ${FREE_PLAN.name} plan costs ${inr(FREE_PLAN.monthly)} a month and takes UPI at booking. You pay a ${commission.free} commission on paid bookings, plus the gateway charge (about 2%) and TDS 1% + TCS 1% on payouts. Clients pay a ₹10 + GST booking fee. ${PREMIUM_PLAN.name} at ${inr(PREMIUM_PLAN.monthly)} a month drops the commission to ${commission.premium}.`,
  },
  {
    q: 'Can I move from Setmore to Meeticulous?',
    a: 'Yes. Sign in with Google, add your services and weekly availability, then share your new booking link. You can keep using Setmore while you move clients over, then switch fully once your link is live. Paid services need a price of ₹100 or more.',
  },
  {
    q: 'Does Meeticulous work for teams?',
    a: `No. Each Meeticulous account is for one host, with no team seats or staff calendars. If you need ${SET_FREE[0]} on one free account, ${S.name}'s free plan covers that. Meeticulous suits solo professionals, consultants and creators who sell their own time in India.`,
  },
  {
    q: 'Does Setmore send WhatsApp reminders?',
    a: `${S.name}'s pricing page doesn't list WhatsApp reminders. It lists SMS reminders on its ${S.sms}. Meeticulous sends WhatsApp reminders on ${PREMIUM_PLAN.name}; the free ${FREE_PLAN.name} plan gets them for your first 2 months, then email reminders after that.`,
  },
  {
    q: 'How much does Meeticulous cost?',
    a: `${FREE_PLAN.name} is ${inr(FREE_PLAN.monthly)} a month with ${commission.free} commission on paid bookings. ${PREMIUM_PLAN.name} is ${inr(PREMIUM_PLAN.monthly)} a month or ${inr(PREMIUM_PLAN.yearly)} a year, GST included, with ${commission.premium} commission. On each paid booking the client pays a ₹10 + GST booking fee, and the gateway charge (about 2%) plus TDS 1% and TCS 1% come out of your payout.`,
  },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function Cta({ slot, children = 'Start free', className = '' }) {
  const utm = useUtm();
  return (
    <Link
      to={START}
      onClick={() => analytics.track(EVENTS.LP_CTA_CLICKED, { slug: SLUG, slot, ...utm })}
      className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[6px] bg-primary px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(194,61,0,0.22)] transition-opacity hover:text-white hover:no-underline hover:opacity-90 motion-reduce:transition-none ${className}`}
    >
      {children} <ArrowRight size={16} aria-hidden />
    </Link>
  );
}

function Cell({ value }) {
  if (value === true) return <span className="inline-flex items-center gap-1.5 font-semibold"><Check size={15} className={GREEN} aria-hidden />Yes</span>;
  if (value === false) return <span className="inline-flex items-center gap-1.5"><X size={15} className="text-neutral-500" aria-hidden />No</span>;
  if (value == null) return <span className="text-neutral-500">Not listed</span>;
  return <span>{value}</span>;
}

function Favicon({ domain, size = 20 }) {
  return <img src={favicon(domain)} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-full border border-black/5 bg-white p-0.5" style={{ width: size, height: size }} />;
}

/* Hero visual: four tiles on the grid, free plan vs free plan at a glance. */
function HeroTiles() {
  return (
    <figure className="mx-auto w-full max-w-[24rem]">
      <div className="grid grid-cols-2 gap-3">
        <div className={`${CARD} aspect-square p-4 sm:p-5`}>
          <div className={`text-[11px] font-bold uppercase tracking-[0.14em] ${MUTED}`}>{S.name} · Free</div>
          <div className={`mt-3 font-heading text-3xl font-extrabold ${INK}`}>Free</div>
          <div className={`mt-1 text-xs leading-snug ${MUTED}`}>{cap(SET_FREE[0])}, priced in {S.currency}</div>
        </div>
        <div className="aspect-square rounded-[6px] p-4 text-white shadow-[0_8px_30px_rgba(15,59,46,0.18)] sm:p-5" style={{ background: 'var(--mg-ink)' }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">{FREE_PLAN.name} · Free</div>
          <div className="mt-3 font-heading text-3xl font-extrabold text-white">{inr(FREE_PLAN.monthly)}</div>
          <div className="mt-1 text-xs leading-snug text-white/80">UPI at booking, GST invoices</div>
        </div>
        <div className="aspect-square rounded-[6px] border border-black/5 p-4 sm:p-5" style={{ background: 'var(--mg-tile)' }}>
          <Globe size={20} className={GREEN} aria-hidden />
          <div className={`mt-3 text-xs leading-snug ${MUTED}`}>Clients pay by card from abroad?</div>
          <div className={`mt-1 font-heading text-base font-bold ${INK}`}>{S.name} fits</div>
        </div>
        <div className="aspect-square rounded-[6px] border border-primary/20 bg-primary-light p-4 sm:p-5">
          <Smartphone size={20} className="text-primary-cta" aria-hidden />
          <div className="mt-3 text-xs leading-snug text-neutral-700">Clients pay by UPI?</div>
          <div className="mt-1 font-heading text-base font-bold text-ink">Meeticulous fits</div>
        </div>
      </div>
      <figcaption className={`mt-3 text-center text-xs ${MUTED}`}>Free plan vs free plan, at a glance</figcaption>
    </figure>
  );
}

function ReceiptCard({ r, badge }) {
  const [label, fits] = badge;
  return (
    <div className="flex flex-col">
      <div className={`${CARD} overflow-hidden rounded-b-none border-b-0`}>
        <div className="h-1.5 transition-colors motion-reduce:transition-none" style={{ background: fits ? '#191919' : 'var(--mg-tile)' }} aria-hidden />
        <div className="p-6 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {r.domain && <Favicon domain={r.domain} />}
              <div>
                <h3 className={`font-heading text-lg font-bold ${INK}`}>{r.name}</h3>
                <div className={`text-xs ${MUTED}`}>{r.plan}</div>
              </div>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${fits ? 'bg-primary text-white' : `border border-black/10 bg-white ${MUTED}`}`}>{label}</span>
          </div>
          <dl className="mt-5 border-t border-dashed border-black/15 pt-4 text-sm">
            {r.lines.map(([k, v], i) => (
              <div key={`${k}-${i}`} className="flex justify-between gap-4 py-1.5">
                <dt className={MUTED}>{k}</dt>
                <dd className={`text-right font-medium ${INK}`}>{v}</dd>
              </div>
            ))}
            <div className="mt-3 flex items-baseline justify-between gap-4 border-t border-dashed border-black/15 pt-4">
              <dt className={`font-semibold ${INK}`}>{r.total[0]}</dt>
              <dd className={`font-heading text-2xl font-extrabold tabular-nums ${INK}`}>{r.total[1]}</dd>
            </div>
          </dl>
          <ul className={`mt-4 space-y-1.5 text-xs leading-relaxed ${MUTED}`}>
            {r.notes.map((n) => <li key={n}>{n}</li>)}
          </ul>
        </div>
      </div>
      {/* Torn receipt edge. */}
      <div aria-hidden className="h-3" style={{ background: 'radial-gradient(circle at 8px 0, #fff 7px, transparent 7.5px) 0 0 / 16px 12px repeat-x' }} />
    </div>
  );
}

function FreePlanPicker() {
  const [pay, setPay] = useState('upi');
  const cur = PAYS.find((p) => p.id === pay);
  return (
    <div className="mt-12">
      <fieldset className={`${CARD} p-5 sm:p-6`}>
        <legend className="sr-only">How do your clients pay?</legend>
        <p aria-hidden className={`font-heading text-lg font-bold ${INK}`}>How do your clients pay?</p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {PAYS.map(({ id, label, Icon }) => {
            const on = id === pay;
            return (
              <label
                key={id}
                className={`flex min-h-[64px] cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[6px] border px-2 py-3 text-center text-xs font-semibold transition-colors focus-within:ring-2 focus-within:ring-primary-cta focus-within:ring-offset-2 motion-reduce:transition-none sm:text-sm ${on ? 'border-transparent text-white' : `border-black/10 bg-white ${INK} hover:border-black/25`}`}
                style={on ? { background: 'var(--mg-ink)' } : undefined}
              >
                <input type="radio" name="mg-pay" value={id} checked={on} onChange={() => setPay(id)} className="sr-only" />
                <Icon size={18} aria-hidden />
                {label}
              </label>
            );
          })}
        </div>
        {/* All answers share one grid cell, so the box never changes height. */}
        <div className="mt-5 grid" aria-live="polite">
          {PAYS.map((p) => (
            <div key={p.id} className={`[grid-area:1/1] ${p.id === pay ? '' : 'invisible'}`} aria-hidden={p.id !== pay}>
              <div className="font-heading text-xl font-extrabold text-primary-cta">{p.verdict}</div>
              <p className={`mt-1.5 text-sm leading-relaxed ${MUTED}`}>{p.body}</p>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <ReceiptCard r={RECEIPTS.setmore} badge={cur.setmore} />
        <ReceiptCard r={RECEIPTS.bas} badge={cur.bas} />
      </div>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

const SetmoreAlternative = () => {
  const utm = useUtm();
  const canonical = `${SITE_URL}${S.path}`;

  useEffect(() => {
    analytics.page({ lp: SLUG });
    analytics.track(EVENTS.LP_VIEWED, { slug: SLUG, ...utm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className={`overflow-x-clip bg-white ${INK}`} style={VARS}>
      <Seo
        title={TITLE}
        description={DESCRIPTION}
        canonical={canonical}
        image={ogCard('lp-setmore-alternative')}
        jsonLd={comparisonGraphJsonLd({ canonical, name: TITLE, description: DESCRIPTION, breadcrumbName: 'Setmore Alternative', faqs: FAQ })}
      />

      {/* ═══════════════ 1 · HERO ═══════════════ */}
      <section className="relative px-5 pb-16 pt-6 sm:px-8 sm:pt-10 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center lg:py-10" style={{ ...GRID, backgroundColor: 'var(--mg-mint)' }}>
        <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <nav aria-label="Breadcrumb">
              <ol className={`flex flex-wrap items-center gap-1.5 text-xs font-medium ${MUTED}`}>
                <li><Link to="/" className={`${MUTED} hover:text-[color:var(--mg-ink)] hover:no-underline`}>Home</Link></li>
                <li aria-hidden>›</li>
                <li><Link to="/compare" className={`${MUTED} hover:text-[color:var(--mg-ink)] hover:no-underline`}>Compare</Link></li>
                <li aria-hidden>›</li>
                <li aria-current="page" className={INK}>{S.name}</li>
              </ol>
            </nav>
            <h1 className={`mt-4 font-heading text-[clamp(2.1rem,3.7vw,3.2rem)] font-extrabold leading-[1.06] tracking-[-0.03em] ${INK}`}>
              A {S.name} alternative <span className="text-primary-cta">that takes UPI</span>
            </h1>
            <p className={`mt-4 max-w-xl text-[15px] leading-relaxed sm:text-base lg:text-[17px] ${MUTED}`}>{HERO_SUB}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Cta slot="hero" />
              <a href="#side-by-side" className={`inline-flex min-h-[44px] items-center gap-1.5 rounded-[6px] border border-black/10 bg-white px-5 py-3 text-sm font-semibold ${INK} hover:text-[color:var(--mg-ink)] hover:no-underline hover:opacity-90`}>
                See the side-by-side
              </a>
            </div>
            <p className={`mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] ${MUTED}`}>
              {['Free plan', 'UPI + cards', 'GST invoices'].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5"><Check size={14} className={GREEN} aria-hidden />{t}</span>
              ))}
            </p>
          </div>
          <HeroTiles />
        </div>
      </section>

      {/* ═══════════════ 2 · SHORT ANSWER ═══════════════ */}
      <section id="short-answer" aria-labelledby="short-answer-title" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <h2 id="short-answer-title" className={H2}>{S.name} or Meeticulous? <span className="text-primary-cta">The short answer.</span></h2>
          <div>
            <p className={`font-heading text-lg font-bold leading-snug sm:text-xl ${INK}`}>{SHORT_ANSWER}</p>
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {[[`Pick ${S.name} if…`, PICK_SETMORE, 'var(--mg-mint)'], ['Pick Meeticulous if…', PICK_BAS, '#FFF4ED']].map(([h, items, bg]) => (
                <div key={h} className="rounded-[6px] border border-black/5 p-6" style={{ background: bg }}>
                  <h3 className={`font-heading text-lg font-bold ${INK}`}>{h}</h3>
                  <ul className="mt-3 space-y-2.5 text-sm leading-relaxed">
                    {items.map((t) => (
                      <li key={t} className={`flex gap-2 ${MUTED}`}><Check size={15} className={`mt-1 shrink-0 ${GREEN}`} aria-hidden />{t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ 3 · SIDE BY SIDE ═══════════════ */}
      <section id="side-by-side" aria-labelledby="side-by-side-title" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28" style={{ ...GRID, backgroundColor: 'var(--mg-mint)' }}>
        <div className="mx-auto max-w-5xl">
          <span className={`inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3 py-1 text-xs font-semibold ${GREEN}`}>Last checked {CHECKED_LABEL}</span>
          <h2 id="side-by-side-title" className={`mt-4 ${H2}`}>How much does {S.name} cost, <span className="text-primary-cta">side by side?</span></h2>
          <div className={`${CARD} mt-10 overflow-x-auto`}>
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <caption className="sr-only">Meeticulous compared with {S.name}: plans, prices and payments</caption>
              <thead>
                <tr>
                  <th scope="col" className={`w-[26%] border-b border-[color:var(--mg-line)] p-4 text-xs font-semibold uppercase tracking-wide ${MUTED}`}>Feature</th>
                  <th scope="col" className={`border-b border-l border-[color:var(--mg-line)] bg-primary-light p-4 font-heading font-bold ${INK}`}>Meeticulous</th>
                  <th scope="col" className={`border-b border-l border-[color:var(--mg-line)] p-4 font-heading font-bold ${INK}`}>
                    <span className="inline-flex items-center gap-2"><Favicon domain={S.domain} size={18} />{S.name}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map(([label, bas, set]) => (
                  <tr key={label} className="align-top">
                    <th scope="row" className={`border-b border-[color:var(--mg-line)] p-4 font-semibold ${INK}`}>{label}</th>
                    <td className={`border-b border-l border-[color:var(--mg-line)] bg-primary-light/50 p-4 ${INK}`}><Cell value={bas} /></td>
                    <td className="border-b border-l border-[color:var(--mg-line)] p-4 text-neutral-700"><Cell value={set} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={`mt-5 text-xs leading-relaxed ${MUTED}`}>
            Checked against {S.name}&rsquo;s pricing page in {CHECKED_LABEL}. Prices as published, in their currency.{' '}
            <a href={S.source} target="_blank" rel="noopener noreferrer nofollow" className={TEXT_LINK}>Read {S.name}&rsquo;s pricing page</a>.
            {' '}&ldquo;Not listed&rdquo; means their pricing page doesn&rsquo;t say.
          </p>
          <p className={`mt-2 text-xs ${MUTED}`}>{S.name} is a trademark of its owner. Meeticulous isn&rsquo;t affiliated with {S.name}.</p>
        </div>
      </section>

      {/* ═══════════════ 4 · WHAT'S DIFFERENT ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className={`max-w-3xl ${H2}`}>What&rsquo;s different for <span className="text-primary-cta">Indian businesses?</span></h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 sm:gap-6">
            {DIFFERENT.map(({ Icon, title, body, link }) => (
              <div key={title} className={`${CARD} p-7`}>
                <span className={`flex h-11 w-11 items-center justify-center rounded-[6px] ${GREEN}`} style={{ background: 'var(--mg-tile)' }}><Icon size={20} aria-hidden /></span>
                <h3 className={`mt-5 font-heading text-xl font-bold ${INK}`}>{title}</h3>
                <p className={`mt-2 text-[15px] leading-relaxed ${MUTED}`}>{body}</p>
                {link && <Link to={link.to} className={`mt-4 inline-flex min-h-[44px] items-center gap-1.5 text-sm ${TEXT_LINK}`}>{link.label} <ArrowRight size={14} aria-hidden /></Link>}
              </div>
            ))}
          </div>
          <p className={`mt-8 max-w-3xl text-sm leading-relaxed ${MUTED}`}>
            What it costs, in full: clients pay a flat ₹10 + GST booking fee per paid booking. The payment gateway charge (about 2%) is passed through at cost, and TDS 1% + TCS 1% are deducted on payout, so on ₹1,000 at {commission.premium} commission you receive ₹959.76.{' '}
            <Link to="/host-fees" className={TEXT_LINK}>See every fee on the host fees page</Link>.
          </p>
        </div>
      </section>

      {/* ═══════════════ 5 · WHERE SETMORE IS BETTER ═══════════════ */}
      <section className="px-5 py-20 text-white sm:px-8 lg:py-28" style={GRID_DARK}>
        <div className="mx-auto max-w-6xl">
          <h2 className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">
            When is {S.name} <span className="text-[color:var(--mg-glow)]">the better choice?</span>
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/80">Plenty of people should stay on {S.name}. Here&rsquo;s when it&rsquo;s the better fit.</p>
          <div className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
            {BETTER.map(({ Icon, title, body }) => (
              <div key={title} className="rounded-[6px] border border-white/10 bg-white/[0.04] p-7">
                <Icon size={22} className="text-[color:var(--mg-glow)]" aria-hidden />
                <h3 className="mt-5 font-heading text-xl font-bold text-white">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/80">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 6 · FREE PLAN VS FREE PLAN ═══════════════ */}
      <section id="free-plans" aria-labelledby="free-plans-title" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: 'var(--mg-mint)' }}>
        <div className="mx-auto max-w-4xl">
          <h2 id="free-plans-title" className={H2}>What do the <span className="text-primary-cta">free plans</span> include?</h2>
          <p className={`mt-5 max-w-2xl text-base leading-relaxed ${MUTED}`}>Free plan vs free plan, line by line. Pick how your clients pay and we&rsquo;ll tell you, honestly, which one fits.</p>
          <FreePlanPicker />
        </div>
      </section>

      {/* ═══════════════ 7 · SWITCH IN 3 STEPS ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={GRID}>
        <div className="mx-auto max-w-6xl">
          <h2 className={`max-w-3xl ${H2}`}>How do I switch from {S.name}? <span className="text-primary-cta">Three steps.</span></h2>
          <ol className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
            {STEPS.map(({ Icon, title, body }, i) => (
              <li key={title} className={`${CARD} p-7`}>
                <div className="flex items-center justify-between">
                  <span className="font-heading text-4xl font-extrabold tabular-nums text-primary-cta">{String(i + 1).padStart(2, '0')}</span>
                  <span className={`flex h-11 w-11 items-center justify-center rounded-[6px] ${GREEN}`} style={{ background: 'var(--mg-tile)' }}><Icon size={20} aria-hidden /></span>
                </div>
                <h3 className={`mt-6 font-heading text-xl font-bold ${INK}`}>{title}</h3>
                <p className={`mt-2 text-[15px] leading-relaxed ${MUTED}`}>{body}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10"><Cta slot="steps">Start free with Google</Cta></div>
        </div>
      </section>

      {/* ═══════════════ 8 · TESTIMONIALS ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="bg-sand px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <h2 className={H2}>What hosts <span className="text-primary-cta">say</span></h2>
            <div className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
              {QUOTES.map((t) => (
                <figure key={t.name} className={`${CARD} flex flex-col p-7`}>
                  <blockquote className={`flex-1 text-[15px] leading-relaxed ${INK}`}>&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-black/5 pt-5">
                    <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-heading text-sm font-bold ${GREEN}`} style={{ background: 'var(--mg-tile)' }}>
                      {t.name.replace(/^(Ar|Dr)\.\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('')}
                    </span>
                    <span>
                      <span className={`block text-sm font-semibold ${INK}`}>{t.name}</span>
                      <span className={`block text-xs ${MUTED}`}>{t.role}</span>
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ 9 · FAQ ═══════════════ */}
      <section id="faq" aria-labelledby="faq-title" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <h2 id="faq-title" className={H2}>{S.name} alternative: <span className="text-primary-cta">your questions</span></h2>
          <p className={`mt-5 text-base leading-relaxed ${MUTED}`}>
            Weighing more than two tools? Read our guide to{' '}
            <Link to="/blog/best-appointment-booking-apps-india" className={TEXT_LINK}>appointment booking apps in India</Link>.
          </p>
          <div className="mt-10 border-t border-[color:var(--mg-line)]">
            {FAQ.map((f) => (
              <details key={f.q} className="group border-b border-[color:var(--mg-line)]">
                <summary className={`flex min-h-[44px] cursor-pointer list-none items-start justify-between gap-5 py-5 font-heading text-[17px] font-bold ${INK} [&::-webkit-details-marker]:hidden`}>
                  {f.q}
                  <span aria-hidden className={`pt-0.5 text-xl leading-none transition-transform group-open:rotate-45 motion-reduce:transition-none ${GREEN}`}>+</span>
                </summary>
                <p className={`pb-6 pr-8 text-[15px] leading-relaxed ${MUTED}`}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 10 · RELATED + FINAL CTA ═══════════════ */}
      <section aria-labelledby="related-title" className="px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="mx-auto max-w-6xl">
          <h2 id="related-title" className={`font-heading text-2xl font-extrabold ${INK}`}>More comparisons</h2>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {COMPETITOR_LIST.filter((c) => c.key !== 'setmore').map((c) => (
              <li key={c.key}>
                <Link to={c.path} className={`${CARD} flex min-h-[56px] items-center gap-3 p-4 text-sm font-semibold ${INK} transition-colors hover:border-black/15 hover:text-[color:var(--mg-ink)] hover:no-underline motion-reduce:transition-none`}>
                  <Favicon domain={c.domain} />
                  Meeticulous vs {c.name}
                  <ArrowRight size={15} className="ml-auto text-primary-cta" aria-hidden />
                </Link>
              </li>
            ))}
            <li>
              <Link to="/compare" className={`flex min-h-[56px] items-center gap-3 rounded-[6px] border border-dashed border-black/15 p-4 text-sm font-semibold ${INK} hover:text-[color:var(--mg-ink)] hover:no-underline`}>
                All booking tool comparisons
                <ArrowRight size={15} className="ml-auto text-primary-cta" aria-hidden />
              </Link>
            </li>
          </ul>
        </div>
      </section>

      <section className="px-5 py-20 text-white sm:px-8 lg:py-28" style={GRID_DARK}>
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight text-white sm:text-5xl">
            Take UPI at booking. <span className="text-[color:var(--mg-glow)]">Start on the free plan.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/80">
            {FREE_PLAN.name} is {inr(FREE_PLAN.monthly)} a month with {commission.free} on paid bookings. Move to {PREMIUM_PLAN.name} for {commission.premium} commission when it pays off.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Cta slot="final" />
            <Link to="/pricing" className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-white underline decoration-white/30 underline-offset-4 hover:text-white hover:decoration-white">
              Compare Meeticulous plans <ArrowRight size={15} aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default SetmoreAlternative;
