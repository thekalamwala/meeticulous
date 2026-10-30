// /features/digital-products — bespoke feature page (Oct feature-page rebuild).
//
// STANDALONE page, not the data-driven FeaturePage template. Its static route
// precedes /features/:slug in App.jsx; the featureData.js "digital-products"
// entry stays for prerender's slug list and the other pages' "related" cards.
//
// Section order (shared by all 10 bespoke feature pages, each its own design):
//   1 Hero + live demo · 2 Proof strip · 3 Without vs with · 4 How it works ·
//   5 Capabilities · 6 The difference · 7 Testimonials · 8 FAQ · 9 Final CTA
//
// Design system F "Dark Gradient SaaS": deep navy to purple gradients, violet
// accents, glassy translucent panels, two light lilac sections for contrast.
// Mechanics unique to this page: clickable product shelf with checkout and
// "download ready" states (hero) · glass fact chips · chat-thread vs product-page
// mock pair · horizontal gradient-numbered timeline · glass card grid ·
// interactive plan slot counter · glass quote cards · dark accordion FAQ.
//
// HONESTY: every claim is verified in code (Oct 2026):
//   formats + 2 MB cap ......... server/controllers/uploadController.js (PRODUCT_EXT_ALLOWLIST, MAX_SIZE_BYTES, content sniff)
//   buyer flow ................. client/src/pages/ProductPurchase.jsx (name/email/WhatsApp, 6-digit WhatsApp code, no account)
//   delivery ................... productController + paymentController.materializeProductPurchase (24h token, 3 downloads,
//                                60s signed file URL, emailed via sendProductDownloadEmail, OTP-gated resend-link)
//   fee + GST invoice .......... createProductOrder (price + ₹10 fee + GST on fee; invoice for the fee); free = no fee
//   no commission .............. journalTemplates.productPaymentEntry ("Products carry NO commission"), vendor_amount = price − gateway
//   plan cap ................... subscription_plans.limits.digital_products: free 3 / premium -1 (v3.165), counts ACTIVE products
//   refunds .................... Refund.jsx §5: not refundable once a download link has been issued
//   live flags ................. feature_flags digital_products + product_purchase enabled on prod
// No usage stats, no ratings. Testimonials are the real, consented quotes from data/testimonials.js.
//
// IMAGES: empty ImgSlot placeholders (data-img-slot names the photo to supply).
// Global Navbar + Footer come from App.jsx. No hover uplift anywhere.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, X, CheckCircle2, Lock, Download, FileText, LayoutTemplate,
  ListChecks, Mail, ShieldCheck, Smartphone, Infinity as InfinityIcon, Store, Gift,
  RefreshCw, Plus, Minus, ChevronDown, ImageIcon, QrCode, Link2, Upload, IndianRupee,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN } from '../../data/plans';
import { TESTIMONIALS as ALL_TESTIMONIALS } from '../../data/testimonials';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';
const NAVY = '#0B1026';          // page dark base
const PLUM = '#960D32';          // gradient end
const VIOLET = '#8B5CF6';        // decorative only (glows, lines, fills)
const VIOLET_SOFT = '#C4B5FD';   // accent TEXT on dark (AA on navy/plum)
const VIOLET_INK = '#7A0A28';    // accent text on light + CTA fill (AA with white)
const MIST = '#EEF0FF';          // body text on dark
const LILAC = '#F6F5FF';         // light section background
const GRADIENT = `linear-gradient(140deg, ${NAVY} 0%, #17123F 55%, ${PLUM} 100%)`;

// Mirrors subscription_plans.limits.digital_products for the free plan (v3.165)
// and FREE_PLAN.features "3 digital products". Change both if the DB changes.
export const FREE_PRODUCT_LIMIT = 3;

// Buyer-side money, same basis as bookings: price + flat ₹10 fee + 18% GST on
// the fee. A ₹0 product carries no fee (pricingEngine.calculatePlatformFee).
const FEE = 10;
const FEE_GST = 1.8;
const round2 = (n) => Math.round(n * 100) / 100;
export const buyerTotal = (price) => (price > 0 ? round2(price + FEE + FEE_GST) : 0);
const inr = (n) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const HERO_TRUST = ['Free plan, no card needed', `${FREE_PRODUCT_LIMIT} products on ${FREE_PLAN.name}`, 'Built for India'];

const CHIPS = [
  { icon: FileText, label: '12 file formats, up to 2 MB' },
  { icon: Smartphone, label: 'Buyers need no account' },
  { icon: Mail, label: 'Download link on screen and by email' },
  { icon: IndianRupee, label: 'UPI, card and wallet checkout' },
  { icon: Gift, label: 'Free products allowed' },
  { icon: InfinityIcon, label: `Unlimited on ${PREMIUM_PLAN.name}` },
];

const STEPS = [
  { title: 'Upload your file', desc: 'PDF, DOC, PPT, XLS, ZIP, EPUB, MP3, PNG or JPG, up to 2 MB. We check the file content, not just its name.' },
  { title: 'Set a price, or make it free', desc: 'Give it a title, a type and a cover. It appears in the Digital Products section of your booking page, with its own page.' },
  { title: 'The buyer verifies and pays', desc: 'Name, email and a 6-digit code on WhatsApp. Then a Razorpay checkout by UPI, card or wallet. No password, no app.' },
  { title: 'The download arrives', desc: 'A secure link shows on screen and a copy goes to their email. It works for 24 hours and up to 3 downloads.' },
];

const CAPS = [
  { icon: Store, title: 'On the page you already share', body: 'Products sit beside your services on your booking page, and each one gets its own shareable product page.' },
  { icon: ShieldCheck, title: 'Files checked on upload', body: 'The extension and the actual file content must match, so a renamed file is rejected before it reaches a buyer.' },
  { icon: Lock, title: 'No public file links', body: 'Uploaded files are never handed out as a permanent URL. Each download opens a link that expires within a minute.' },
  { icon: RefreshCw, title: 'Lost links, restored', body: 'If a buyer misses the 24 hour window, they verify their email with a code and get a fresh link on their own.' },
  { icon: Gift, title: 'Free downloads, same delivery', body: 'Set a price of ₹0 for a checklist or a sample chapter. There is no booking fee, and the buyer gets the same secure link.' },
  { icon: Smartphone, title: 'No account to buy', body: 'Buyers give their name, email and WhatsApp number and confirm with a 6-digit WhatsApp code. No password, no app.' },
  { icon: IndianRupee, title: 'UPI, card or wallet', body: 'Paid products use the same Razorpay checkout as your bookings. The buyer pays your price plus a ₹10 booking fee and GST on it.' },
];

const PICKED = ['Happy Singh', 'Vishal Chaware', 'Sangharata Somkuvar'];
const QUOTES = PICKED.map((n) => ALL_TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);

const FAQ = [
  { q: 'What kind of digital products can I sell?', a: 'Downloadable files such as PDF guides, eBooks, templates, prompt packs, worksheets and audio. Uploads can be PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, ZIP, EPUB, MP3, PNG or JPG. You can also point to a file hosted elsewhere, but that link is public and does not expire.' },
  { q: 'How big can a file be?', a: 'Up to 2 MB per uploaded file. For anything bigger, compress it into a ZIP or link to where it is hosted.' },
  { q: 'How does the buyer get the file?', a: 'Right after payment, a download link appears on screen and a copy is emailed to them. The link works for 24 hours and up to 3 downloads. If it lapses, the buyer verifies their email with a code and gets a new one.' },
  { q: 'Do buyers need an account?', a: 'No. They enter their name, email and WhatsApp number, confirm a 6-digit code sent on WhatsApp, and pay. No password and no app.' },
  { q: 'What does the buyer pay?', a: 'Your price, plus a ₹10 booking fee and GST on that fee, ₹11.80 in total. A free product has no fee at all.' },
  { q: 'Do you take a commission on product sales?', a: `No, on either plan. The actual payment gateway charge is deducted from the sale. The 5% commission on ${FREE_PLAN.name} applies to bookings, not products.` },
  { q: 'How many products can I sell?', a: `Up to ${FREE_PRODUCT_LIMIT} live products on ${FREE_PLAN.name} and unlimited on ${PREMIUM_PLAN.name}. The cap counts active products, so you can deactivate one to put another live.` },
  { q: 'Is there a GST invoice?', a: 'Yes. Every paid purchase generates a GST invoice for the booking fee, issued to the buyer.' },
  { q: 'Can a buyer get a refund?', a: 'Digital products are not refundable once a download link has been issued, as set out in our refund policy.' },
];

const RELATED = [
  { to: '/features/booking-pages', label: 'Booking pages' },
  { to: '/features/payments', label: 'Payments' },
  { to: '/features/online-scheduling', label: 'Online scheduling' },
  { to: '/features/client-management', label: 'Client management' },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function PrimaryCta({ to = START, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(109,40,217,0.35)] transition-opacity hover:no-underline hover:opacity-90"
      style={{ background: VIOLET_INK }}
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
      className={`flex items-center justify-center rounded-[10px] border border-white/10 ${className}`}
      style={{ background: 'repeating-linear-gradient(135deg, rgba(238,240,255,0.04) 0 10px, rgba(238,240,255,0.08) 10px 20px)' }}
    >
      <ImageIcon size={28} style={{ color: 'rgba(238,240,255,0.3)' }} aria-hidden />
    </div>
  );
}

const glass = 'border border-white/10 bg-white/5 backdrop-blur';

/* Hero demo — a product shelf. Pick one → checkout → "download ready". */
const SHELF = [
  { title: 'Freelance pricing guide', kind: 'PDF guide', meta: 'PDF · 1.4 MB', price: 499, icon: FileText },
  { title: 'Client onboarding template', kind: 'Template', meta: 'DOCX · 220 KB', price: 299, icon: LayoutTemplate },
  { title: 'Launch week checklist', kind: 'Checklist', meta: 'PDF · 380 KB', price: 0, icon: ListChecks },
];
const nextDemo = ({ k, stage }) => {
  if (stage === 'shelf') return { k, stage: 'checkout' };
  if (stage === 'checkout') return { k, stage: 'done' };
  return { k: (k + 1) % SHELF.length, stage: 'shelf' };
};

function ShelfDemo() {
  const reduce = useReducedMotion();
  const [demo, setDemo] = useState({ k: 0, stage: 'shelf' });
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return undefined;
    const id = setInterval(() => setDemo(nextDemo), 2800);
    return () => clearInterval(id);
  }, [reduce, paused]);

  const go = (d) => { setPaused(true); setDemo(d); };
  const p = SHELF[demo.k];
  const free = p.price === 0;
  const slide = reduce
    ? {}
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } };

  return (
    <div className="relative mx-auto w-full max-w-[26rem]">
      <div className={`overflow-hidden rounded-[10px] ${glass} shadow-[0_40px_90px_-30px_rgba(46,16,101,0.9)]`}>
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
          <div className="font-heading text-sm font-bold text-[#EEF0FF]">Digital products</div>
          <span className="text-[11px] text-[#EEF0FF]/55">meeticulous.com/you</span>
        </div>

        <div className="grid grid-cols-3 gap-2.5 p-4" role="group" aria-label="Sample products">
          {SHELF.map((item, i) => {
            const on = demo.k === i && demo.stage !== 'shelf';
            return (
              <button
                key={item.title}
                type="button"
                aria-pressed={on}
                onClick={() => go({ k: i, stage: 'checkout' })}
                className={`flex flex-col items-start rounded-[6px] border p-2.5 text-left transition-colors ${on ? 'border-[#8B5CF6] bg-[#8B5CF6]/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25'}`}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[5px]" style={{ background: 'rgba(139,92,246,0.18)', color: VIOLET_SOFT }}>
                  <item.icon size={16} aria-hidden />
                </span>
                <span className="mt-2 text-[10px] uppercase tracking-[0.12em] text-[#EEF0FF]/50">{item.kind}</span>
                <span className="mt-0.5 line-clamp-2 text-[12px] font-semibold leading-snug text-[#EEF0FF]">{item.title}</span>
                <span className="mt-1.5 font-heading text-[13px] font-bold" style={{ color: VIOLET_SOFT }}>{item.price ? `₹${item.price}` : 'Free'}</span>
              </button>
            );
          })}
        </div>

        <div className="min-h-[15rem] border-t border-white/10 bg-black/10 px-5 py-5" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {demo.stage === 'shelf' && (
              <motion.div key="shelf" {...slide} className="flex h-[12.5rem] flex-col items-center justify-center text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5"><Download size={18} style={{ color: VIOLET_SOFT }} aria-hidden /></span>
                <p className="mt-3 text-sm text-[#EEF0FF]/70">Pick a product to see the buyer&rsquo;s checkout.</p>
              </motion.div>
            )}
            {demo.stage === 'checkout' && (
              <motion.div key={`checkout-${demo.k}`} {...slide}>
                <div className="font-heading text-[15px] font-bold text-[#EEF0FF]">{p.title}</div>
                <div className="text-xs text-[#EEF0FF]/50">{p.meta}</div>
                <dl className="mt-4 space-y-2 text-sm text-[#EEF0FF]/70">
                  <div className="flex justify-between"><dt>Price</dt><dd className="tabular-nums">{free ? 'Free' : inr(p.price)}</dd></div>
                  {!free && <div className="flex justify-between"><dt>Booking fee + GST</dt><dd className="tabular-nums">{inr(FEE + FEE_GST)}</dd></div>}
                  <div className="flex justify-between border-t border-white/10 pt-2 font-heading font-bold text-[#EEF0FF]"><dt>Total</dt><dd className="tabular-nums">{inr(buyerTotal(p.price))}</dd></div>
                </dl>
                <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#EEF0FF]/55">
                  <Smartphone size={12} aria-hidden /> Verified with a WhatsApp code{free ? '' : ' · UPI, card or wallet'}
                </div>
                <button
                  type="button"
                  onClick={() => go({ k: demo.k, stage: 'done' })}
                  className="mt-4 w-full rounded-[6px] py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: VIOLET_INK }}
                >
                  {free ? 'Get it free' : `Buy for ${inr(buyerTotal(p.price))}`}
                </button>
              </motion.div>
            )}
            {demo.stage === 'done' && (
              <motion.div key={`done-${demo.k}`} {...slide} className="flex flex-col items-center pt-1 text-center">
                <CheckCircle2 size={40} style={{ color: VIOLET_SOFT }} aria-hidden />
                <div className="mt-2.5 font-heading text-lg font-extrabold text-[#EEF0FF]">{free ? 'Done.' : 'Purchased.'} Your download is ready.</div>
                <div className="mt-1 text-xs text-[#EEF0FF]/55">{p.title}</div>
                <span className="mt-4 inline-flex items-center gap-2 rounded-[6px] border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-[#EEF0FF]">
                  <Download size={15} aria-hidden /> Download
                </span>
                <div className="mt-3 text-[11px] text-[#EEF0FF]/50">Link valid 24 hours · up to 3 downloads · a copy sent to email</div>
                <button type="button" onClick={() => go({ k: demo.k, stage: 'shelf' })} className="mt-3 text-[11px] font-semibold underline underline-offset-4 transition-opacity hover:opacity-80" style={{ color: VIOLET_SOFT }}>
                  Back to the shelf
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-[#EEF0FF]/45">Illustration of a buyer&rsquo;s purchase, sample products</p>
    </div>
  );
}

/* The difference — how many products can be live on each plan. */
function PlanCounter() {
  const [n, setN] = useState(5);
  const live = Math.min(n, FREE_PRODUCT_LIMIT);
  const waiting = n - live;
  const Slots = ({ count, filled }) => (
    <div className="mt-5 grid grid-cols-6 gap-2">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`flex aspect-square items-center justify-center rounded-[5px] ${i < filled ? 'text-white' : 'border border-dashed border-black/20 text-neutral-400'}`}
          style={i < filled ? { background: `linear-gradient(140deg, ${VIOLET}, ${VIOLET_INK})` } : undefined}
        >
          {i < filled ? <Check size={14} aria-hidden /> : <Lock size={12} aria-hidden />}
        </span>
      ))}
    </div>
  );

  return (
    <div className="mt-12">
      <div className="mx-auto flex max-w-md items-center justify-between gap-4 rounded-[10px] border border-black/5 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
        <span className="text-sm text-neutral-600" id="dp-count-label">Products you want live</span>
        <div className="flex items-center gap-3" role="group" aria-labelledby="dp-count-label">
          <button type="button" aria-label="Fewer products" onClick={() => setN((v) => Math.max(1, v - 1))} className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-black/10 text-neutral-700 transition-colors hover:border-black/25 disabled:opacity-40" disabled={n <= 1}>
            <Minus size={15} aria-hidden />
          </button>
          <output aria-live="polite" className="w-8 text-center font-heading text-3xl font-extrabold tabular-nums" style={{ color: VIOLET_INK }}>{n}</output>
          <button type="button" aria-label="More products" onClick={() => setN((v) => Math.min(12, v + 1))} className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-black/10 text-neutral-700 transition-colors hover:border-black/25 disabled:opacity-40" disabled={n >= 12}>
            <Plus size={15} aria-hidden />
          </button>
        </div>
      </div>

      <div className="mt-8 grid gap-5 sm:gap-6 md:grid-cols-2">
        <div className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-7">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-heading text-lg font-bold text-[#0B1026]">{FREE_PLAN.name}</h3>
            <span className="text-xs text-neutral-500">₹0 / month</span>
          </div>
          <Slots count={n} filled={live} />
          <p className="mt-5 text-sm leading-relaxed text-neutral-600">
            {waiting > 0
              ? `${live} live, ${waiting} waiting. Deactivate one to swap it in, or upgrade.`
              : n === FREE_PRODUCT_LIMIT
                ? `All ${n} live. That fills the free plan.`
                : `All ${n} live. Room for ${FREE_PRODUCT_LIMIT - n} more.`}
          </p>
        </div>
        <div className="rounded-[10px] p-6 text-[#EEF0FF] shadow-[0_24px_60px_-28px_rgba(46,16,101,0.7)] sm:p-7" style={{ background: GRADIENT }}>
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="font-heading text-lg font-bold text-[#EEF0FF]">{PREMIUM_PLAN.name}</h3>
            <span className="text-xs text-[#EEF0FF]/60">₹{PREMIUM_PLAN.monthly} / month or ₹{PREMIUM_PLAN.yearly.toLocaleString('en-IN')} / year</span>
          </div>
          <div className="mt-5 grid grid-cols-6 gap-2">
            {Array.from({ length: n }, (_, i) => (
              <span key={i} className="flex aspect-square items-center justify-center rounded-[5px] text-white" style={{ background: `linear-gradient(140deg, ${VIOLET}, ${VIOLET_INK})` }}>
                <Check size={14} aria-hidden />
              </span>
            ))}
          </div>
          <p className="mt-5 flex items-center gap-2 text-sm leading-relaxed text-[#EEF0FF]/75">
            <InfinityIcon size={16} style={{ color: VIOLET_SOFT }} aria-hidden /> All {n} live. No product cap.
          </p>
        </div>
      </div>
      <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-neutral-600">
        On both plans, product sales carry no commission and buyers pay the same. {PREMIUM_PLAN.name} also drops the 5% on your bookings.
        {' '}<Link to="/pricing" className="font-semibold underline underline-offset-4" style={{ color: VIOLET_INK }}>Compare plans</Link>
      </p>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function DigitalProductsFeature() {
  const [open, setOpen] = useState(0);
  const canonical = `${SITE_URL}/features/digital-products`;
  const seo = {
    title: 'Sell Digital Products Online in India | Meeticulous',
    description: 'Sell PDFs, eBooks, templates and checklists from your booking page. Buyers pay by UPI or card and get a secure download link by email. 3 products free.',
  };
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'Digital Products',
    serviceType: 'Selling downloadable digital products with secure delivery',
    image: ogCard('features-digital-products'),
    steps: STEPS,
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  return (
    <main className="overflow-x-clip bg-[#0B1026] text-[#EEF0FF]">
      <Seo
        title={seo.title}
        description={seo.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor={NAVY}
        ogTitle="Sell your guides and templates where clients already book you."
        ogDescription={seo.description}
        image={ogCard('features-digital-products')}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · HERO (gradient + product shelf demo) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-16 pt-8 sm:px-8 lg:pb-24 lg:pt-6 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center" style={{ background: GRADIENT }}>
        <div aria-hidden className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(139,92,246,0.28), transparent)' }} />
        <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-32 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(109,40,217,0.22), transparent)' }} />
        <div className="relative mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs text-[#EEF0FF]/55">
              <Link to="/" className="text-[#EEF0FF]/55 hover:text-[#EEF0FF] hover:no-underline">Home</Link>
              <span aria-hidden className="mx-2">/</span>
              <span>Features</span>
              <span aria-hidden className="mx-2">/</span>
              <span aria-current="page" className="text-[#EEF0FF]/85">Digital products</span>
            </nav>
            <Reveal as="h1" instant className="mt-4 font-heading text-[clamp(2.1rem,3.7vw,3.2rem)] font-extrabold leading-[1] tracking-[-0.035em] text-[#EEF0FF]">
              Sell digital products online, <span style={{ color: VIOLET_SOFT }}>right beside your bookings.</span>
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mt-4 max-w-xl text-base leading-relaxed text-[#EEF0FF]/75 lg:text-[17px]">
              Sell PDF guides, templates and checklists from the page clients already book you on. Buyers pay by UPI or card and get a secure download link.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta>Start free <ArrowRight size={16} /></PrimaryCta>
              <a href="#plans" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#EEF0FF] hover:no-underline hover:opacity-80">
                See product limits by plan <ArrowRight size={15} />
              </a>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] text-[#EEF0FF]/65">
                  <Check size={14} style={{ color: VIOLET_SOFT }} aria-hidden /> {t}
                </span>
              ))}
            </Reveal>
          </div>
          <Reveal instant delay={0.12}>
            <ShelfDemo />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 2 · PROOF (glass fact chips) ═══════════════ */}
      <section className="border-y border-white/10 px-5 py-8 sm:px-8" style={{ background: NAVY }}>
        <ul className="mx-auto flex max-w-6xl flex-wrap justify-center gap-2.5">
          {CHIPS.map((c) => (
            <li key={c.label} className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-[#EEF0FF]/85 ${glass}`}>
              <c.icon size={14} style={{ color: VIOLET_SOFT }} aria-hidden /> {c.label}
            </li>
          ))}
        </ul>
      </section>

      {/* ═══════════════ 3 · WITHOUT vs WITH (chat thread vs product page) ═══════════════ */}
      <section className="px-5 py-20 text-[#0B1026] sm:px-8 lg:py-28" style={{ background: LILAC }}>
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0B1026] sm:text-5xl">
            A Drive link and a UPI QR <span style={{ color: VIOLET_INK }}>is not a shop.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-600">
            Selling a guide over DMs works until you are checking screenshots at midnight. Here is the same sale, both ways.
          </Reveal>

          <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-2">
            <Reveal className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-7">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400"><QrCode size={14} aria-hidden /> A Drive link + a UPI QR</div>
              <div className="mt-5 space-y-2.5 rounded-[6px] bg-neutral-50 p-4 text-[13px]" aria-hidden>
                <p className="ml-auto w-fit max-w-[80%] rounded-[6px] bg-neutral-200 px-3 py-2 text-neutral-700">Hi, is the pricing guide still ₹499?</p>
                <p className="w-fit max-w-[80%] rounded-[6px] border border-black/5 bg-white px-3 py-2 text-neutral-600">Yes! Scan this QR and send a screenshot</p>
                <p className="ml-auto w-fit max-w-[80%] rounded-[6px] bg-neutral-200 px-3 py-2 text-neutral-700">Sent. Where do I download?</p>
                <p className="flex w-fit max-w-[85%] items-center gap-1.5 rounded-[6px] border border-black/5 bg-white px-3 py-2 text-neutral-500"><Link2 size={13} /> drive.google.com/… anyone with the link</p>
              </div>
              <ul className="mt-6 space-y-3">
                {['You match every UPI screenshot to a buyer by hand', 'The Drive link works for anyone it is forwarded to', 'Every sale is a chat you have to answer yourself'].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[15px] text-neutral-500"><X size={16} className="mt-0.5 shrink-0" aria-hidden /><span><span className="sr-only">Without: </span>{t}</span></li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.06} className="rounded-[10px] border p-6 shadow-[0_24px_60px_-30px_rgba(109,40,217,0.35)] sm:p-7" style={{ borderColor: `${VIOLET_INK}4d`, background: '#FFFFFF' }}>
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: VIOLET_INK }}><Store size={14} aria-hidden /> A product page with checkout</div>
              <div className="mt-5 overflow-hidden rounded-[6px] border border-black/5" aria-hidden>
                <div className="flex h-20 items-center justify-center" style={{ background: GRADIENT }}><FileText size={26} style={{ color: VIOLET_SOFT }} /></div>
                <div className="p-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">PDF guide</div>
                  <div className="font-heading text-[15px] font-bold">Freelance pricing guide</div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-heading text-lg font-extrabold" style={{ color: VIOLET_INK }}>₹499</span>
                    <span className="rounded-[6px] px-3.5 py-1.5 text-xs font-semibold text-white" style={{ background: VIOLET_INK }}>Buy now</span>
                  </div>
                </div>
              </div>
              <ul className="mt-6 space-y-3">
                {['Buyers pay at a Razorpay checkout, no screenshots', 'The file arrives on its own, on screen and by email', 'Each link expires after 24 hours or 3 downloads'].map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[15px] font-medium text-[#0B1026]"><Check size={16} className="mt-0.5 shrink-0" style={{ color: VIOLET_INK }} aria-hidden /><span><span className="sr-only">With Meeticulous: </span>{t}</span></li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (horizontal gradient-numbered timeline) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: NAVY }}>
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#EEF0FF] sm:text-5xl">
            List it once. <span style={{ color: VIOLET_SOFT }}>Every sale delivers itself.</span>
          </Reveal>
          <ol className="relative mt-16 grid gap-10 md:grid-cols-4 md:gap-6">
            <span aria-hidden className="absolute left-6 right-6 top-6 hidden h-px md:block" style={{ background: `linear-gradient(90deg, ${VIOLET}, ${VIOLET_INK} 60%, rgba(139,92,246,0.15))` }} />
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.06} className="relative flex gap-5 md:block">
                <span
                  className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full font-heading text-lg font-extrabold text-white shadow-[0_10px_30px_rgba(139,92,246,0.45)]"
                  style={{ background: `linear-gradient(140deg, ${VIOLET}, ${VIOLET_INK})` }}
                >
                  {i + 1}
                </span>
                <div className="md:mt-6">
                  <h3 className="font-heading text-lg font-bold text-[#EEF0FF]">{s.title}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed text-[#EEF0FF]/65">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════════ 5 · CAPABILITIES (glass card grid) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: GRADIENT }}>
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#EEF0FF] sm:text-5xl">
            A small shop, <span style={{ color: VIOLET_SOFT }}>built into your page.</span>
          </Reveal>
          <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-3">
            <Reveal className={`rounded-[10px] p-7 md:col-span-2 ${glass}`}>
              <span className="flex h-10 w-10 items-center justify-center rounded-[6px]" style={{ background: 'rgba(139,92,246,0.18)', color: VIOLET_SOFT }}><Upload size={19} aria-hidden /></span>
              <h3 className="mt-4 font-heading text-xl font-bold text-[#EEF0FF]">Your products, on your booking page</h3>
              <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-[#EEF0FF]/65">Visitors see your services and your products together, with how many people have already bought each one.</p>
              <ImgSlot slot="digital-products-profile-shelf" alt="A host's Meeticulous booking page showing the Digital Products section beside their services" className="mt-6 aspect-[16/7] w-full" />
            </Reveal>
            {CAPS.map((c, i) => (
              <Reveal key={c.title} delay={(i % 3) * 0.05} className={`rounded-[10px] p-7 ${glass}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-[6px]" style={{ background: 'rgba(139,92,246,0.18)', color: VIOLET_SOFT }}><c.icon size={19} aria-hidden /></span>
                <h3 className="mt-4 font-heading text-lg font-bold text-[#EEF0FF]">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#EEF0FF]/65">{c.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 6 · THE DIFFERENCE (plan slot counter) ═══════════════ */}
      <section id="plans" className="scroll-mt-20 px-5 py-20 text-[#0B1026] sm:px-8 lg:py-28" style={{ background: LILAC }}>
        <div className="mx-auto max-w-4xl">
          <div className="text-center">
            <Reveal as="h2" className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0B1026] sm:text-5xl">
              Start with {FREE_PRODUCT_LIMIT}. <span style={{ color: VIOLET_INK }}>Grow to unlimited.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-600">
              Choose how many products you want on sale and see what each plan keeps live.
            </Reveal>
          </div>
          <PlanCounter />
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (glass quote cards) ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: GRADIENT }}>
          <div className="mx-auto max-w-6xl">
            <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#EEF0FF] sm:text-5xl">
              From hosts already <span style={{ color: VIOLET_SOFT }}>booked through Meeticulous.</span>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-3">
              {QUOTES.map((t, i) => (
                <Reveal as="figure" key={t.name} delay={i * 0.06} className={`flex flex-col justify-between rounded-[10px] p-7 ${glass}`}>
                  <blockquote className="text-[15px] leading-relaxed text-[#EEF0FF]/85">
                    <span aria-hidden className="mb-3 block font-heading text-4xl leading-none" style={{ color: VIOLET_SOFT }}>&ldquo;</span>
                    {t.quote}
                  </blockquote>
                  <figcaption className="mt-7 flex items-center gap-3 border-t border-white/10 pt-5">
                    <img src={t.avatar} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
                    <div>
                      <div className="text-sm font-semibold text-[#EEF0FF]">{t.name}</div>
                      <div className="text-xs text-[#EEF0FF]/55">{t.role}</div>
                    </div>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ 8 · FAQ (accordion on dark) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: NAVY }}>
        <div className="mx-auto max-w-3xl">
          <Reveal as="h2" className="text-center font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#EEF0FF] sm:text-5xl">
            Selling questions, <span style={{ color: VIOLET_SOFT }}>answered.</span>
          </Reveal>
          <div className="mt-12 space-y-3">
            {FAQ.map((f, i) => {
              const isOpen = open === i;
              return (
                <div key={f.q} className={`rounded-[6px] ${glass} ${isOpen ? 'border-[#8B5CF6]/40' : ''}`}>
                  <h3 className="text-[#EEF0FF]">
                    <button
                      type="button"
                      id={`dp-faq-q${i}`}
                      aria-expanded={isOpen}
                      aria-controls={`dp-faq-a${i}`}
                      onClick={() => setOpen(isOpen ? -1 : i)}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-heading text-[16px] font-bold text-[#EEF0FF] transition-colors hover:text-white"
                    >
                      {f.q}
                      <ChevronDown size={18} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} style={{ color: VIOLET_SOFT }} aria-hidden />
                    </button>
                  </h3>
                  <div id={`dp-faq-a${i}`} role="region" aria-labelledby={`dp-faq-q${i}`} hidden={!isOpen}>
                    <p className="px-5 pb-5 text-[15px] leading-relaxed text-[#EEF0FF]/70">{f.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · FINAL CTA ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-20 sm:px-8 lg:py-28" style={{ background: GRADIENT }}>
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-[26rem] w-[40rem] -translate-x-1/2 rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(139,92,246,0.25), transparent)' }} />
        <div className="relative mx-auto max-w-5xl text-center">
          <Reveal as="h2" className="font-heading text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1] tracking-[-0.035em] text-[#EEF0FF]">
            Turn what you know <span style={{ color: VIOLET_SOFT }}>into a download.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#EEF0FF]/70">
            Set up your booking page free, then add your first product from your dashboard.
          </Reveal>
          <Reveal delay={0.1} className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <PrimaryCta>Start free <ArrowRight size={16} /></PrimaryCta>
            <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#EEF0FF] hover:no-underline hover:opacity-80">
              See pricing <ArrowRight size={15} />
            </Link>
            <Link to="/demo" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#EEF0FF]/80 hover:no-underline hover:opacity-80">
              See a live host page <ArrowRight size={15} />
            </Link>
          </Reveal>
          <nav aria-label="Related features" className="mt-14 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-8 text-sm text-[#EEF0FF]/55">
            <span className="flex items-center gap-1.5"><Download size={14} aria-hidden /> Works with</span>
            {RELATED.map((r) => (
              <Link key={r.to} to={r.to} className="text-[#EEF0FF]/80 underline decoration-white/20 underline-offset-4 hover:text-[#EEF0FF] hover:decoration-white">{r.label}</Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
