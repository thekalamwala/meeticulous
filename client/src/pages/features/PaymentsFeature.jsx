// /features/payments — bespoke feature page (pilot of the Oct feature-page rebuild).
//
// STANDALONE page, not the data-driven FeaturePage template. Its static route
// precedes /features/:slug in App.jsx; the featureData.js "payments" entry stays
// for prerender's slug list and the other pages' "related" cards.
//
// Section order (shared by all 10 bespoke feature pages, each its own design):
//   1 Hero + live demo · 2 Proof strip · 3 Without vs with · 4 How it works ·
//   5 Capabilities · 6 The difference · 7 Testimonials · 8 FAQ · 9 Final CTA
//
// Design system G "Editorial Forest-Green": deep forest + warm paper, oversized
// cream type, one gold accent. Mechanics unique to this page: animated checkout
// sheet (hero) · ruled fact strip · editorial two-column ledger · minute-by-minute
// timeline · bento with a dark cell · interactive "what you keep" calculator ·
// featured pull-quote · sticky-heading FAQ.
//
// HONESTY: every number here is published on /host-fees or /pricing (₹10 + GST
// booking fee, 5% / 0% commission, actual gateway charge ~2%, TDS 1% + TCS 1%,
// payout held until ~24h after the session). No usage stats, no ratings.
// Testimonials are the real, consented quotes from data/testimonials.js.
//
// IMAGES: empty ImgSlot placeholders (data-img-slot names the photo to supply).
// Global Navbar + Footer come from App.jsx. No hover uplift anywhere.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, X, CheckCircle2, Lock, Receipt, CreditCard, Wallet,
  IndianRupee, FileText, RotateCcw, Gift, ImageIcon, Clock,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN } from '../../data/plans';
import { TESTIMONIALS as ALL_TESTIMONIALS } from '../../data/testimonials';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';
const GOLD = '#E9C46A';       // accent on dark forest only (AA on #0E3B2C)
const GOLD_INK = '#7A5C0E';   // gold for text on light paper (AA on #F5EFE3)

/* ─────────────────────────────  MONEY MATH  ────────────────────────────── */

// Mirrors /host-fees §1–5. Booking fee + GST live in platform_settings; if they
// change there, change them here and on HostFees.jsx.
export const BOOKING_FEE = 10;
export const BOOKING_FEE_GST = 1.8;
export const GATEWAY_PCT = 2; // illustrative, the real charge is passed through at cost
const round2 = (n) => Math.round(n * 100) / 100;

/** What a host receives for one paid booking at `price`, on a plan charging `commissionPct`. */
export function payoutBreakdown(price, commissionPct) {
  const guestPays = round2(price + BOOKING_FEE + BOOKING_FEE_GST);
  const commission = round2((price * commissionPct) / 100);
  const gateway = round2((guestPays * GATEWAY_PCT) / 100);
  const tds = round2(price * 0.01);
  const tcs = round2(price * 0.01);
  const keep = round2(price - commission - gateway - tds - tcs);
  return { price, guestPays, commission, gateway, tds, tcs, keep };
}

const inr = (n, dp = 2) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const HERO_TRUST = ['Free plan, no card needed', 'Razorpay-secured checkout', 'Built for India'];

const PROOF = [
  { k: 'Checkout', v: 'UPI, cards, netbanking, wallets' },
  { k: 'Security', v: 'Every payment signature-verified on our servers' },
  { k: 'Paperwork', v: 'A GST invoice on every paid booking' },
  { k: 'Commission', v: `0% on ${PREMIUM_PLAN.name}` },
];

const LEDGER = [
  { row: 'When you get paid', old: 'After the session, if they remember', now: 'Before the slot is even held' },
  { row: 'The receipt', old: 'You type it up, or skip it', now: 'GST invoice generated for the guest' },
  { row: 'A no-show', old: 'An empty hour and nothing earned', now: 'They paid when they booked' },
  { row: 'Tax season', old: 'Scrolling for payment screenshots', now: 'Every booking and deduction in one dashboard' },
  { row: 'TDS and TCS', old: 'Your own spreadsheet', now: 'Deposited to your PAN and shown on your dashboard' },
];

const TIMELINE = [
  { t: '4:02 PM', title: 'Your client picks a slot', desc: 'From your booking page. No message, no "are you free?"' },
  { t: '4:03 PM', title: 'They pay at checkout', desc: 'UPI, card, netbanking or wallet, through Razorpay.' },
  { t: '4:03 PM', title: 'The payment is verified, the slot locks', desc: 'We check the Razorpay signature on our server before the booking is confirmed. Unpaid attempts never hold your time.' },
  { t: '4:03 PM', title: 'Confirmation and invoice go out', desc: 'Your client gets a WhatsApp and email confirmation, and a GST invoice for what they paid.' },
  { t: '+24 hrs', title: 'Your payout is released', desc: 'The transfer to your bank is created at payment and held until about 24 hours after the session ends, then released through Razorpay Route.' },
];

const CAPS = [
  { icon: CreditCard, title: 'Every Indian payment method', body: 'UPI, cards, netbanking and wallets in one Razorpay checkout. No payment link to send by hand.' },
  { icon: Receipt, title: 'A GST invoice, every time', body: `Each paid booking gets an invoice for your guest. On ${FREE_PLAN.name} we also issue you a tax invoice for the commission, so you can claim input credit.` },
  { icon: FileText, title: 'A statement for every payout', body: 'Your price, commission, gateway charge, TDS and TCS, line by line, for each booking.' },
  { icon: RotateCcw, title: 'Clean cancellations', body: 'If you cancel, your guest is refunded in full, booking fee included. No awkward bank transfers.' },
  { icon: Gift, title: 'Free sessions stay free', body: 'A ₹0 service carries no booking fee, no commission and no TDS or TCS.' },
];

const PICKED = ['Vishal Chaware', 'Ar. Pranav Kadoo', 'Happy Singh', 'Arjun Ravikumar'];
const QUOTES = PICKED.map((n) => ALL_TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);

const FAQ = [
  { q: 'Do I need my own Razorpay account?', a: 'No. Meeticulous runs the checkout. You complete KYC in your dashboard, which sets up a Razorpay Linked Account, and your payouts go to the bank account on it.' },
  { q: 'When do I get paid?', a: 'The transfer is created when your client pays and held until about 24 hours after the scheduled end of the session. It is then released to your bank, either when the booking is marked complete or automatically at the end of the hold.' },
  { q: 'What does it cost?', a: `Your client pays your price plus a ₹10 booking fee and GST on that fee (₹11.80). You pay the actual payment-gateway charge (about 2%), TDS of 1% and TCS of 1%, which are credited to your PAN. On ${FREE_PLAN.name} there is a 5% commission; on ${PREMIUM_PLAN.name} it is 0%.` },
  { q: 'Which payment methods can my clients use?', a: 'UPI, credit and debit cards, netbanking and wallets, all through Razorpay.' },
  { q: 'Are GST invoices automatic?', a: 'Yes. Every paid booking generates a GST invoice for your client, with nothing for you to type.' },
  { q: 'What happens if a payment fails?', a: 'The booking is not confirmed and the slot stays open. Nobody can hold your time without paying.' },
  { q: 'What if I have to cancel?', a: 'Your client is refunded in full, including the booking fee, and no payout is made for that booking.' },
  { q: 'Do I need a PAN?', a: 'Yes. A valid PAN is needed before you can accept paid bookings, because TDS and TCS are deposited against it.' },
];

const RELATED = [
  { to: '/features/online-scheduling', label: 'Online scheduling' },
  { to: '/features/booking-pages', label: 'Booking pages' },
  { to: '/features/notifications', label: 'Reminders' },
  { to: '/features/analytics', label: 'Analytics' },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function PrimaryCta({ to = START, children, dark = false }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-semibold shadow-[0_8px_30px_rgba(26,26,26,0.12)] transition-opacity hover:no-underline hover:opacity-90"
      style={dark ? { background: GOLD, color: '#12261D' } : { background: '#0E3B2C', color: '#F5EFE3' }}
    >
      {children}
    </Link>
  );
}

/* Empty image placeholder; the founder supplies the real photo later. */
function ImgSlot({ alt, slot, className = '', dark = false }) {
  const ink = dark ? '245,239,227' : '14,59,44';
  return (
    <div
      role="img"
      aria-label={alt}
      data-img-slot={slot}
      className={`flex items-center justify-center rounded-[10px] border border-black/5 ${className}`}
      style={{ background: `repeating-linear-gradient(135deg, rgba(${ink},0.04) 0 10px, rgba(${ink},0.08) 10px 20px)` }}
    >
      <ImageIcon size={28} style={{ color: `rgba(${ink},0.3)` }} aria-hidden />
    </div>
  );
}

/* Hero demo — a checkout sheet cycling Checkout → Paid → Invoice. */
const DEMO_STEPS = ['Checkout', 'Paid', 'Invoice'];
const DEMO = payoutBreakdown(1500, 0);

function CheckoutDemo() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return undefined;
    const id = setInterval(() => setStep((s) => (s + 1) % DEMO_STEPS.length), 3400);
    return () => clearInterval(id);
  }, [reduce, paused]);

  // All three panels share one grid cell, so the card always keeps the
  // height of the tallest (invoice) step instead of jumping between steps.
  const panel = (i) => `[grid-area:1/1] transition-[opacity,transform] duration-300 ${step === i ? 'opacity-100' : 'pointer-events-none invisible opacity-0'} ${!reduce && step !== i ? 'translate-x-3' : ''}`;

  return (
    <div className="relative mx-auto w-full max-w-[22rem]">
      <div className="overflow-hidden rounded-[10px] bg-[#FFFDF8] text-[#12261D] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-neutral-500">Discovery call · 30 min</div>
            <div className="font-heading text-sm font-bold">with Priya Nair · Thu, 4:30 PM</div>
          </div>
          <Lock size={15} className="text-[#1F6B4A]" aria-hidden />
        </div>

        <div className="grid px-5 py-5" aria-live="polite">
            <div className={panel(0)} aria-hidden={step !== 0}>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between"><dt className="text-neutral-500">Session</dt><dd className="tabular-nums">{inr(1500)}</dd></div>
                  <div className="flex justify-between"><dt className="text-neutral-500">Booking fee + GST</dt><dd className="tabular-nums">{inr(BOOKING_FEE + BOOKING_FEE_GST)}</dd></div>
                  <div className="flex justify-between border-t border-black/10 pt-2.5 font-heading font-bold"><dt>Total</dt><dd className="tabular-nums">{inr(DEMO.guestPays)}</dd></div>
                </dl>
                <div className="mt-4 grid grid-cols-4 gap-1.5 text-center text-[11px] font-semibold">
                  {['UPI', 'Card', 'Netbank', 'Wallet'].map((m, i) => (
                    <span key={m} className={`rounded-[5px] border px-1 py-1.5 ${i === 0 ? 'border-[#1F6B4A] bg-[#1F6B4A]/10 text-[#1F6B4A]' : 'border-black/10 text-neutral-500'}`}>{m}</span>
                  ))}
                </div>
                <div className="mt-4 rounded-[6px] bg-[#0E3B2C] py-2.5 text-center text-sm font-semibold text-[#F5EFE3]">Pay {inr(DEMO.guestPays)}</div>
            </div>
            <div className={`${panel(1)} flex flex-col items-center justify-center text-center`} aria-hidden={step !== 1}>
                <CheckCircle2 size={44} className="text-[#1F6B4A]" aria-hidden />
                <div className="mt-3 font-heading text-lg font-extrabold">Payment successful</div>
                <div className="mt-1 text-sm text-neutral-500">{inr(DEMO.guestPays)} via UPI</div>
                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#1F6B4A]/10 px-3 py-1.5 text-xs font-semibold text-[#1F6B4A]">
                  <Lock size={12} aria-hidden /> Slot locked · Thu 4:30 PM
                </div>
            </div>
            <div className={panel(2)} aria-hidden={step !== 2}>
                <div className="flex items-center gap-2 font-heading text-sm font-bold"><Receipt size={16} className="text-[#1F6B4A]" aria-hidden /> Tax invoice</div>
                <div className="mt-3 space-y-2 rounded-[6px] border border-dashed border-black/15 p-3.5 text-[13px]">
                  <div className="flex justify-between"><span className="text-neutral-500">Billed to</span><span>Priya Nair</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">Discovery call</span><span className="tabular-nums">{inr(1500)}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">Booking fee</span><span className="tabular-nums">{inr(BOOKING_FEE)}</span></div>
                  <div className="flex justify-between"><span className="text-neutral-500">GST on fee (18%)</span><span className="tabular-nums">{inr(BOOKING_FEE_GST)}</span></div>
                  <div className="flex justify-between border-t border-black/10 pt-2 font-semibold"><span>Paid</span><span className="tabular-nums">{inr(DEMO.guestPays)}</span></div>
                </div>
                <div className="mt-3 text-center text-xs text-neutral-500">Confirmation sent on WhatsApp and email</div>
            </div>
        </div>
      </div>

      <div className="mt-5 flex justify-center gap-2" role="group" aria-label="Checkout demo steps">
        {DEMO_STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            aria-pressed={step === i}
            onClick={() => { setStep(i); setPaused(true); }}
            className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${step === i ? 'border-transparent text-[#12261D]' : 'border-white/20 text-[#F5EFE3]/70 hover:text-[#F5EFE3]'}`}
            style={step === i ? { background: GOLD } : undefined}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-[#F5EFE3]/60">Illustration of the client checkout</p>
    </div>
  );
}

/* "What you keep" — one price, both plans, every deduction shown. */
function KeepCalculator() {
  const [price, setPrice] = useState(1000);
  const plans = [
    { name: FREE_PLAN.name, note: '₹0 / month', b: payoutBreakdown(price, 5) },
    { name: PREMIUM_PLAN.name, note: `₹${PREMIUM_PLAN.monthly} / month or ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')} / year`, b: payoutBreakdown(price, 0) },
  ];
  return (
    <div className="mt-12">
      <div className="mx-auto max-w-xl">
        <label htmlFor="pf-price" className="flex items-baseline justify-between text-sm text-[#F5EFE3]/70">
          <span>Your price for one session</span>
          <span className="font-heading text-3xl font-extrabold tabular-nums text-[#F5EFE3]">{inr(price, 0)}</span>
        </label>
        <input
          id="pf-price"
          type="range"
          min={100}
          max={20000}
          step={100}
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="mt-4 w-full"
          style={{ accentColor: GOLD }}
        />
        <div className="mt-1 flex justify-between text-[11px] text-[#F5EFE3]/40"><span>₹100</span><span>₹20,000</span></div>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {plans.map((p, i) => (
          <div key={p.name} className={`rounded-[10px] p-6 sm:p-7 ${i === 1 ? 'bg-[#F5EFE3] text-[#12261D]' : 'border border-white/10 text-[#F5EFE3]'}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className={`font-heading text-lg font-bold ${i === 1 ? 'text-[#12261D]' : 'text-[#F5EFE3]'}`}>{p.name}</h3>
              <span className={`text-xs ${i === 1 ? 'text-neutral-500' : 'text-[#F5EFE3]/50'}`}>{p.note}</span>
            </div>
            <dl className={`mt-5 space-y-2 text-sm ${i === 1 ? 'text-neutral-600' : 'text-[#F5EFE3]/65'}`}>
              <div className="flex justify-between"><dt>Your client pays</dt><dd className="tabular-nums">{inr(p.b.guestPays)}</dd></div>
              <div className="flex justify-between"><dt>Commission ({i === 1 ? '0%' : '5%'})</dt><dd className="tabular-nums">− {inr(p.b.commission)}</dd></div>
              <div className="flex justify-between"><dt>Gateway (~{GATEWAY_PCT}%)</dt><dd className="tabular-nums">− {inr(p.b.gateway)}</dd></div>
              <div className="flex justify-between"><dt>TDS 1% + TCS 1%, to your PAN</dt><dd className="tabular-nums">− {inr(p.b.tds + p.b.tcs)}</dd></div>
            </dl>
            <div className={`mt-5 flex items-baseline justify-between border-t pt-4 ${i === 1 ? 'border-black/10' : 'border-white/10'}`}>
              <span className="text-sm font-semibold">You keep</span>
              <span className="font-heading text-3xl font-extrabold tabular-nums" style={i === 1 ? { color: '#1F6B4A' } : { color: GOLD }}>{inr(p.b.keep)}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#F5EFE3]/70">
        Your client pays the same on both plans. Earning more than about ₹4,700 a month? {PREMIUM_PLAN.name} yearly costs less than the 5% it saves you.
        {' '}<Link to="/host-fees" className="font-semibold underline decoration-white/30 underline-offset-4 hover:decoration-white" style={{ color: GOLD }}>Full fee breakdown</Link>
      </p>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function PaymentsFeature() {
  const canonical = `${SITE_URL}/features/payments`;
  const seo = {
    title: 'Online Payments & GST Invoices for Freelancers in India | Meeticulous',
    description: 'Collect payment before every session over UPI, cards and netbanking, with a GST invoice on every booking and payouts to your bank. 0% commission on Pro. Start free.',
  };
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'Payments & Invoicing',
    serviceType: 'Online payment collection and GST invoicing for appointment bookings',
    image: ogCard('features-payments'),
    steps: TIMELINE.map((s) => ({ title: s.title, desc: s.desc })),
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  return (
    <main className="overflow-x-clip bg-white text-[#12261D]">
      <Seo
        title={seo.title}
        description={seo.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor="#0E3B2C"
        ogTitle="Get paid before the session, not after."
        ogDescription={seo.description}
        image={ogCard('features-payments')}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · HERO (editorial display + checkout demo) ═══════════════ */}
      <section className="relative overflow-hidden bg-[#0E3B2C] px-5 pb-20 pt-8 text-[#F5EFE3] sm:px-8 lg:pb-28 lg:pt-6 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(233,196,106,0.16), transparent)' }} />
        <div className="relative mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:gap-14 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs text-[#F5EFE3]/55">
              <Link to="/" className="text-[#F5EFE3]/55 hover:text-[#F5EFE3] hover:no-underline">Home</Link>
              <span aria-hidden className="mx-2">/</span>
              <span>Features</span>
              <span aria-hidden className="mx-2">/</span>
              <span aria-current="page" className="text-[#F5EFE3]/85">Payments</span>
            </nav>
            <Reveal as="h1" instant className="mt-4 font-heading text-[clamp(2.1rem,3.7vw,3.2rem)] font-extrabold text-[#F5EFE3] leading-[0.98] tracking-[-0.035em]">
              Get paid before the session, <span style={{ color: GOLD }}>not after.</span>
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mt-4 max-w-xl text-base leading-relaxed text-[#F5EFE3]/75 lg:text-[17px]">
              Online payments for freelancers, coaches and consultants in India. Clients pay by UPI, card or netbanking when they book, every booking gets a GST invoice, and your payout lands in your bank.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta dark>Start free <ArrowRight size={16} /></PrimaryCta>
              <a href="#keep" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F5EFE3] hover:no-underline hover:opacity-80">
                See what you keep <ArrowRight size={15} />
              </a>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] text-[#F5EFE3]/65">
                  <Check size={14} style={{ color: GOLD }} aria-hidden /> {t}
                </span>
              ))}
            </Reveal>
          </div>
          <Reveal instant delay={0.12}>
            <CheckoutDemo />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 2 · PROOF STRIP (ruled facts, no invented numbers) ═══════════════ */}
      <section className="border-b border-black/5 bg-[#F5EFE3] px-5 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-px bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map((p) => (
            <div key={p.k} className="bg-[#F5EFE3] py-7 sm:px-6">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: GOLD_INK }}>{p.k}</div>
              <div className="mt-2 font-heading text-[15px] font-bold leading-snug">{p.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ 3 · WITHOUT vs WITH (editorial ledger) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            A UPI QR in the chat is not <span className="text-[#1F6B4A]">a payment system.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-500">
            Sending your GPay number after the call works until someone forgets, or doesn&rsquo;t show up. Here is the same booking, both ways.
          </Reveal>

          <div className="mt-14">
            <div className="hidden grid-cols-[1fr_1.2fr_1.2fr] gap-8 border-b-2 border-[#12261D] pb-3 text-[11px] font-bold uppercase tracking-[0.18em] md:grid">
              <span />
              <span className="text-neutral-500">UPI QR + DMs</span>
              <span className="text-[#1F6B4A]">Meeticulous</span>
            </div>
            {LEDGER.map((r, i) => (
              <Reveal key={r.row} delay={i * 0.04} className="grid gap-2 border-b border-black/10 py-6 md:grid-cols-[1fr_1.2fr_1.2fr] md:gap-8">
                <h3 className="font-heading text-lg font-bold">{r.row}</h3>
                <p className="flex items-start gap-2 text-[15px] text-neutral-500"><X size={16} className="mt-0.5 shrink-0" aria-hidden /><span><span className="sr-only">Without: </span>{r.old}</span></p>
                <p className="flex items-start gap-2 text-[15px] font-medium text-[#12261D]"><Check size={16} className="mt-0.5 shrink-0 text-[#1F6B4A]" aria-hidden /><span><span className="sr-only">With Meeticulous: </span>{r.now}</span></p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (minute-by-minute timeline) ═══════════════ */}
      <section className="bg-[#F5EFE3] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            What happens the minute <span className="text-[#1F6B4A]">a client pays.</span>
          </Reveal>
          <ol className="mt-14">
            {TIMELINE.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.05} className="grid gap-3 border-t border-black/10 py-8 sm:grid-cols-[9rem_1fr] sm:gap-10">
                <span className="flex items-center gap-2 font-heading text-2xl font-extrabold tabular-nums sm:text-3xl" style={{ color: GOLD_INK }}>
                  {i === TIMELINE.length - 1 && <Clock size={20} aria-hidden />}{s.t}
                </span>
                <div>
                  <h3 className="font-heading text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-neutral-600">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════════ 5 · CAPABILITIES (bento with one dark cell) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            The money admin, <span className="text-[#1F6B4A]">already done.</span>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-3">
            <Reveal className="flex flex-col justify-between rounded-[10px] bg-[#0E3B2C] p-7 text-[#F5EFE3] md:col-span-2 md:row-span-2">
              <div>
                <span className="flex h-11 w-11 items-center justify-center rounded-[6px]" style={{ background: 'rgba(233,196,106,0.15)', color: GOLD }}><Wallet size={21} aria-hidden /></span>
                <h3 className="mt-5 font-heading text-2xl font-bold text-[#F5EFE3]">Paid, held, then released</h3>
                <p className="mt-2 max-w-md text-[15px] leading-relaxed text-[#F5EFE3]/70">The transfer is created the moment your client pays, held until about a day after the session, then released to your bank. Each one shows up in your Payouts dashboard.</p>
              </div>
              <ImgSlot slot="payouts-dashboard" alt="The Meeticulous payouts dashboard showing held and released payouts" className="mt-7 aspect-[16/9] w-full" dark />
            </Reveal>
            {CAPS.map((c, i) => (
              <Reveal key={c.title} delay={(i % 3) * 0.05} className="rounded-[10px] border border-black/5 bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-[6px] bg-[#1F6B4A]/10 text-[#1F6B4A]"><c.icon size={19} aria-hidden /></span>
                <h3 className="mt-4 font-heading text-lg font-bold">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{c.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 6 · THE DIFFERENCE (what-you-keep calculator) ═══════════════ */}
      <section id="keep" className="scroll-mt-20 bg-[#0E3B2C] px-5 py-20 text-[#F5EFE3] sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <Reveal as="h2" className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#F5EFE3] sm:text-5xl">
              See exactly <span style={{ color: GOLD }}>what you keep.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#F5EFE3]/70">
              No hidden cuts. Move the slider and every deduction shows up, on both plans.
            </Reveal>
          </div>
          <KeepCalculator />
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (featured pull-quote + ruled list) ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="bg-[#F5EFE3] px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto grid max-w-6xl gap-14 lg:grid-cols-[1.3fr_1fr] lg:gap-20">
            <Reveal as="figure">
              <span aria-hidden className="block font-heading text-[96px] leading-[0.6]" style={{ color: GOLD_INK }}>&ldquo;</span>
              <blockquote className="mt-4 font-heading text-3xl font-bold leading-[1.2] tracking-tight sm:text-[2.6rem]">{QUOTES[0].quote}</blockquote>
              <figcaption className="mt-8 flex items-center gap-4">
                <img src={QUOTES[0].avatar} alt="" loading="lazy" className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <div className="font-semibold">{QUOTES[0].name}</div>
                  <div className="text-sm text-neutral-500">{QUOTES[0].role}</div>
                </div>
              </figcaption>
            </Reveal>
            <div className="lg:pt-6">
              {QUOTES.slice(1).map((t, i) => (
                <Reveal as="figure" key={t.name} delay={i * 0.05} className="border-t border-black/10 py-6 first:border-t-0 first:pt-0">
                  <blockquote className="text-[15px] leading-relaxed text-[#12261D]">&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{t.name} · <span className="font-medium normal-case tracking-normal">{t.role}</span></figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ 8 · FAQ (sticky heading + numbered list) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <Reveal as="h2" className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Money questions, <span className="text-[#1F6B4A]">answered.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mt-5 text-base text-neutral-500">
              Every fee is also listed on our <Link to="/host-fees" className="font-semibold text-[#1F6B4A] underline underline-offset-4">host fees page</Link>.
            </Reveal>
          </div>
          <div className="border-t border-black/10">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group border-b border-black/10" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-start gap-5 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="pt-0.5 font-heading text-sm font-extrabold tabular-nums" style={{ color: GOLD_INK }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 font-heading text-[17px] font-bold">{f.q}</span>
                  <span aria-hidden className="pt-0.5 text-xl leading-none text-neutral-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-6 pl-10 pr-6 text-[15px] leading-relaxed text-neutral-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · FINAL CTA ═══════════════ */}
      <section className="bg-[#0E3B2C] px-5 py-20 text-[#F5EFE3] sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl text-center">
          <Reveal as="h2" className="font-heading text-[clamp(2.4rem,6vw,4.4rem)] font-extrabold text-[#F5EFE3] leading-[0.98] tracking-[-0.035em]">
            Stop chasing payments. <span style={{ color: GOLD }}>Get paid first.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#F5EFE3]/70">
            Set up your booking page free. Your first client pays before they show up.
          </Reveal>
          <Reveal delay={0.1} className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <PrimaryCta dark>Start free <ArrowRight size={16} /></PrimaryCta>
            <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F5EFE3] hover:no-underline hover:opacity-80">
              See pricing <ArrowRight size={15} />
            </Link>
          </Reveal>
          <nav aria-label="Related features" className="mt-14 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-8 text-sm text-[#F5EFE3]/55">
            <span className="flex items-center gap-1.5"><IndianRupee size={14} aria-hidden /> Works with</span>
            {RELATED.map((r) => (
              <Link key={r.to} to={r.to} className="text-[#F5EFE3]/80 underline decoration-white/20 underline-offset-4 hover:text-[#F5EFE3] hover:decoration-white">{r.label}</Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
