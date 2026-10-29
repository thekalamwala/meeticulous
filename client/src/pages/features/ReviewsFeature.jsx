// /features/reviews — bespoke feature page (Oct feature-page rebuild).
//
// STANDALONE page, not the data-driven FeaturePage template. Its static route
// precedes /features/:slug in App.jsx; the featureData.js "reviews" entry stays
// for prerender's slug list and the other pages' "related" cards.
//
// Section order (shared by all 10 bespoke feature pages, each its own design):
//   1 Hero + live demo · 2 Proof strip · 3 Without vs with · 4 How it works ·
//   5 Capabilities · 6 The difference · 7 Testimonials · 8 FAQ · 9 Final CTA
//
// Design system A′ "Photo-overlay, pink": the hero and proof row sit on one
// full-bleed photo with a dark plum/pink tint and white type; everything else is
// white and very light pink. Mechanics unique to this page: tap-the-stars review
// card (hero) · white fact row over the photo · DM screenshot vs booked review
// side-by-side · photo-topped step cards · two-column icon list · clickable
// "how a review becomes verified" track · masonry quote wall · card accordion FAQ.
//
// HONESTY: every claim is checked against server/controllers/reviewController.js
// (completed booking only, the booking's own guest only, one review per booking,
// author-only edits), bookingController.markBookingCompleted (review email +
// in-app prompt on completion; no-shows never complete), reviewAdminController
// (admin moderation hides from public reads) and HostProfile/ServiceDetail
// (where reviews render). NO aggregate rating, average or review count for Book
// A Sloth or any host, on the page or in JSON-LD. The hero card is a sample.
// Testimonials are the real, consented quotes from data/testimonials.js; they
// are hosts on Meeticulous in general, and the section says so.
//
// IMAGES: empty ImgSlot placeholders (data-img-slot names the photo to supply).
// Global Navbar + Footer come from App.jsx. No hover uplift anywhere.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, X, Star, ShieldCheck, BadgeCheck, MailCheck, PencilLine,
  Users, Bell, EyeOff, Heart, ChevronDown, ImageIcon, CalendarCheck,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN } from '../../data/plans';
import { TESTIMONIALS as ALL_TESTIMONIALS } from '../../data/testimonials';
import PageGuides from '../../components/common/PageGuides';

const START = '/be-a-sloth';
const PINK = '#FF4D93';      // decorative accent; text use only on the dark overlay
const PINK_INK = '#BE185D';  // pink for text / fills on white and light pink (AA)
const BLUSH = '#FFF4F8';     // very light pink surface
const PLUM = '#1F0F17';      // dark base under the photo tint and final CTA
const INK = '#191919';

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const HERO_TRUST = ['Free plan, no card needed', 'No public review form to spam', 'Built for India'];

const PROOF = [
  { k: 'Who can review', v: 'Only the guest who booked the session' },
  { k: 'When we ask', v: 'As soon as the booking is marked complete' },
  { k: 'Where it shows', v: 'Your profile and the service they booked' },
  { k: 'Plans', v: `Included on ${FREE_PLAN.name} and ${PREMIUM_PLAN.name}` },
];

// Sample copy for the hero card, one per star rating. Illustration only.
export const SAMPLE_REVIEWS = {
  1: 'Started late and felt rushed. Not what I expected.',
  2: 'Useful in parts, but we ran out of time on my questions.',
  3: 'Good session. I would have liked a little more depth.',
  4: 'Clear, practical advice. I would book again.',
  5: 'Exactly what I needed. Already booked my next one.',
};

const WITHOUT = [
  'Anyone could have typed it. A screenshot proves nothing.',
  'It lives in your phone, not where new clients are deciding.',
  'You remember to ask some weeks, and forget the rest.',
  'Cropped, unnamed and undated by the time it is posted.',
];
const WITH = [
  'Written by the guest who booked, after the session was completed.',
  'Shown on your profile and on the service they booked.',
  'Asked for automatically, every time a booking completes.',
  'With their name, their rating and the date, on your page.',
];

const STEPS = [
  {
    title: 'Run the session',
    desc: 'Your guest books through your page and the session happens. Mark it complete in your dashboard, or it completes on its own shortly after the end time.',
    slot: 'reviews-step-session',
    alt: 'A coach and a client in a one-to-one session',
  },
  {
    title: 'Your guest gets the ask',
    desc: 'The moment it completes, we email them a link to review that exact booking, and it appears in their Meeticulous notifications. They sign in with their phone number and tap a rating.',
    slot: 'reviews-step-phone',
    alt: 'A client tapping a star rating on their phone',
  },
  {
    title: 'It shows on your page',
    desc: 'The review appears on your public profile and on the page of the service they booked, with their name and the date.',
  },
];

const CAPS = [
  { icon: ShieldCheck, title: 'Only real guests', body: 'A review needs a completed booking, and only the guest on that booking can write it. There is no open review form on your page.' },
  { icon: BadgeCheck, title: 'One review per booking', body: 'Each guest can review each booking once. Ten bookings from one person cannot turn into ten reviews of the same session.' },
  { icon: MailCheck, title: 'Asked for automatically', body: 'The review link goes out by email when a booking completes, plus a prompt in the guest’s account. Nothing for you to remember.' },
  { icon: Star, title: 'On your profile and service pages', body: 'Reviews show on your public profile and on the page of the service that was booked, where people decide.' },
  { icon: PencilLine, title: 'Guests can update theirs', body: 'The guest who wrote a review can come back and edit it. Nobody else can, including you.' },
  { icon: Users, title: 'Rate your guests too', body: 'After a completed session you can review the guest from your bookings. They see it in their account.' },
  { icon: Bell, title: 'A heads-up for every review', body: 'You get a notification in your dashboard each time a new review comes in.' },
  { icon: EyeOff, title: 'Moderated by our team', body: 'Our team can hide a review, which removes it from every public page.' },
];

const VERIFY = [
  {
    stage: 'Booked',
    icon: CalendarCheck,
    check: 'The review starts from a booking on your page, tied to the guest who made it.',
    stops: 'Anyone without a booking. There is no review form for strangers to fill in.',
  },
  {
    stage: 'Completed',
    icon: Check,
    check: 'The booking has to reach completed, either because you marked it done or it completed after the session ended.',
    stops: 'Cancelled bookings, and anyone you mark as a no-show. Those never get a review request.',
  },
  {
    stage: 'Requested',
    icon: MailCheck,
    check: 'The guest gets a link to review that one booking, and signs in with the phone number they booked with.',
    stops: 'Someone else’s account. Our server refuses a review from anyone who is not the guest on the booking.',
  },
  {
    stage: 'Shown',
    icon: Star,
    check: 'One review per guest per booking goes onto your profile and the service page, with their name and date.',
    stops: 'Duplicates of the same booking, and any review our team has hidden.',
  },
];

const PICKED = ['Happy Singh', 'Ar. Pranav Kadoo', 'Mukesh Tidke', 'Sangharata Somkuvar', 'Vishal Chaware', 'Dr. Yukta Bawankar'];
const QUOTES = PICKED.map((n) => ALL_TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);

const FAQ = [
  { q: 'Can anyone leave a review on my page?', a: 'No. Only the guest who booked can review, and only after that booking is marked complete. There is no public review form.' },
  { q: 'When is the review request sent?', a: 'As soon as the booking completes. That happens when you mark it complete, or automatically shortly after the session ends. The guest gets an email with a link to review that booking, plus a prompt in their account.' },
  { q: 'What if the guest did not show up?', a: 'Mark the booking as a no-show. A no-show is never completed, so no review request goes out for a session that did not happen.' },
  { q: 'Can I delete or edit a review?', a: 'No. Only the guest who wrote a review can edit it. If a review looks abusive or about the wrong session, contact our support team. Moderators can hide a review from every public page.' },
  { q: 'Where do reviews show up?', a: 'On your public profile once you have your first review, and on the page of the service that was booked. Each one shows the guest’s name, their star rating, any comment and the date.' },
  { q: 'Do my guests need an account or password?', a: 'No password. They sign in with their phone number and a one-time code, the same way they booked.' },
  { q: 'Can I review my guests?', a: 'Yes. After a completed session you can rate the guest from your bookings. They see it in their account. It does not appear on your public profile.' },
  { q: 'Is it on the free plan?', a: `Yes. Guest reviews are included on ${FREE_PLAN.name} and on ${PREMIUM_PLAN.name}.` },
];

const RELATED = [
  { to: '/features/notifications', label: 'Reminders' },
  { to: '/features/booking-pages', label: 'Booking pages' },
  { to: '/features/client-management', label: 'Client management' },
  { to: '/features/online-scheduling', label: 'Online scheduling' },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function PrimaryCta({ to = START, children, onDark = false }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-semibold shadow-[0_8px_30px_rgba(26,26,26,0.12)] transition-opacity hover:no-underline hover:opacity-90"
      style={onDark ? { background: '#FFFFFF', color: PINK_INK } : { background: PINK_INK, color: '#FFFFFF' }}
    >
      {children}
    </Link>
  );
}

/* Empty image placeholder; the founder supplies the real photo later. */
function ImgSlot({ alt, slot, className = '', dark = false }) {
  const ink = dark ? '255,255,255' : '190,24,93';
  return (
    <div
      role="img"
      aria-label={alt}
      data-img-slot={slot}
      className={`flex items-center justify-center ${className}`}
      style={{ background: `repeating-linear-gradient(135deg, rgba(${ink},0.04) 0 10px, rgba(${ink},0.08) 10px 20px)` }}
    >
      <ImageIcon size={28} style={{ color: `rgba(${ink},0.3)` }} aria-hidden />
    </div>
  );
}

function Stars({ n, size = 14 }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} aria-hidden style={i <= n ? { color: PINK, fill: PINK } : { color: '#D4D4D4' }} />
      ))}
    </span>
  );
}

/* Hero demo — tap 1–5 stars, the sample review card updates. No autoplay. */
function ReviewDemo() {
  const reduce = useReducedMotion();
  const [rating, setRating] = useState(5);
  const fade = reduce
    ? {}
    : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 }, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } };

  return (
    <div className="relative mx-auto w-full max-w-[23rem]">
      <div className="rounded-[10px] bg-white p-5 text-[#191919] shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] sm:p-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">How was your session?</div>
        <div className="mt-3 flex gap-1.5" role="group" aria-label="Pick a rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
              aria-pressed={n === rating}
              onClick={() => setRating(n)}
              className="rounded-[6px] p-1.5 transition-colors hover:bg-[#FFF4F8]"
            >
              <Star size={26} aria-hidden style={n <= rating ? { color: PINK, fill: PINK } : { color: '#D4D4D4' }} />
            </button>
          ))}
        </div>

        <div className="mt-5 min-h-[9.5rem] rounded-[6px] border border-black/5 p-4" style={{ background: BLUSH }} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={rating} {...fade}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full font-heading text-sm font-bold text-white" style={{ background: PINK_INK }} aria-hidden>P</span>
                  <div>
                    <div className="text-sm font-semibold">Priya N.</div>
                    <div className="text-[11px] text-neutral-500">Career coaching · 45 min</div>
                  </div>
                </div>
                <Stars n={rating} size={13} />
              </div>
              <p className="mt-3 text-[14px] leading-relaxed">{SAMPLE_REVIEWS[rating]}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold" style={{ color: PINK_INK }}>
                  <ShieldCheck size={12} aria-hidden /> Verified booking
                </span>
                <span className="text-[11px] text-neutral-500">12 Oct 2026</span>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
        <p className="mt-4 text-center text-xs text-neutral-500">Low ratings show too. Hosts cannot delete reviews.</p>
      </div>
      <p className="mt-3 text-center text-[11px] text-white/55">Illustration, a sample review. Tap the stars.</p>
    </div>
  );
}

/* The difference — tap a stage to see what is checked and what stops there. */
function VerifyTrack() {
  const [active, setActive] = useState(0);
  const s = VERIFY[active];
  return (
    <div className="mt-14">
      <ol className="relative grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="How a review becomes verified">
        <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-6 hidden h-px bg-black/10 sm:block" />
        {VERIFY.map((v, i) => (
          <li key={v.stage} className="relative">
            <button
              type="button"
              aria-pressed={i === active}
              onClick={() => setActive(i)}
              className="flex w-full flex-col items-center gap-2.5 rounded-[6px] py-2 text-center transition-colors"
            >
              <span
                className="relative flex h-12 w-12 items-center justify-center rounded-full border transition-colors"
                style={i <= active
                  ? { background: PINK_INK, borderColor: PINK_INK, color: '#FFFFFF' }
                  : { background: '#FFFFFF', borderColor: 'rgba(0,0,0,0.1)', color: '#737373' }}
              >
                <v.icon size={19} aria-hidden />
              </span>
              <span className="font-heading text-[15px] font-bold" style={i === active ? { color: PINK_INK } : { color: INK }}>
                {i + 1}. {v.stage}
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-5 md:grid-cols-2" aria-live="polite">
        <div className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-7">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: PINK_INK }}>
            <ShieldCheck size={14} aria-hidden /> What we check at {s.stage.toLowerCase()}
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-700">{s.check}</p>
        </div>
        <div className="rounded-[10px] border border-black/5 p-6 sm:p-7" style={{ background: BLUSH }}>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-500">
            <X size={14} aria-hidden /> What stops here
          </div>
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-700">{s.stops}</p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function ReviewsFeature() {
  const canonical = `${SITE_URL}/features/reviews`;
  const seo = {
    title: 'Collect Reviews from Clients After Bookings | Meeticulous',
    description: 'Collect reviews from clients automatically after every completed booking. Only the guest who booked can review, and reviews show on your profile. Free to start.',
  };
  // No aggregateRating / Review nodes: this page has no reviews of its own.
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'Reviews & Ratings',
    serviceType: 'Collecting verified client reviews after appointment bookings',
    image: ogCard('features-reviews'),
    steps: STEPS.map((s) => ({ title: s.title, desc: s.desc })),
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  return (
    <main className="overflow-x-clip bg-white text-[#191919]">
      <Seo
        title={seo.title}
        description={seo.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor={PLUM}
        ogTitle="Reviews from clients who actually booked you."
        ogDescription={seo.description}
        image={ogCard('features-reviews')}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 + 2 · HERO + PROOF ROW, on one full-bleed photo ═══════════════ */}
      <div className="relative overflow-hidden text-white" style={{ background: PLUM }}>
        <ImgSlot slot="reviews-hero" alt="A smiling client leaving a review on their phone after a session" className="absolute inset-0" dark />
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(31,15,23,0.80) 0%, rgba(31,15,23,0.72) 45%, rgba(31,15,23,0.92) 100%)' }} />
        <div aria-hidden className="pointer-events-none absolute -left-40 top-10 h-[34rem] w-[34rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(255,77,147,0.28), transparent)' }} />

        <section className="relative px-5 pb-16 pt-8 sm:px-8 lg:pb-20 lg:pt-6 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center">
          <div className="mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:gap-14 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <nav aria-label="Breadcrumb" className="text-xs text-white/60">
                <Link to="/" className="text-white/60 hover:text-white hover:no-underline">Home</Link>
                <span aria-hidden className="mx-2">/</span>
                <span>Features</span>
                <span aria-hidden className="mx-2">/</span>
                <span aria-current="page" className="text-white/85">Reviews</span>
              </nav>
              <Reveal as="h1" instant className="mt-4 font-heading text-[clamp(2.1rem,3.7vw,3.2rem)] font-extrabold leading-[1.0] tracking-[-0.03em] text-white">
                Reviews from clients who <span style={{ color: PINK }}>actually booked you.</span>
              </Reveal>
              <Reveal as="p" instant delay={0.05} className="mt-4 max-w-xl text-base leading-relaxed text-white/80 lg:text-[17px]">
                After every completed session we ask the client for a review. Only real bookings can leave one, and it shows on your page where new clients decide.
              </Reveal>
              <Reveal instant delay={0.1} className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                <PrimaryCta onDark>Start free <ArrowRight size={16} /></PrimaryCta>
                <a href="#verified" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:no-underline hover:opacity-80">
                  How reviews get verified <ArrowRight size={15} />
                </a>
              </Reveal>
              <Reveal instant delay={0.14} className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
                {HERO_TRUST.map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-[13px] text-white/70">
                    <Check size={14} style={{ color: PINK }} aria-hidden /> {t}
                  </span>
                ))}
              </Reveal>
            </div>
            <Reveal instant delay={0.12}>
              <ReviewDemo />
            </Reveal>
          </div>
        </section>

        {/* 2 · PROOF — a white fact row over the same photo */}
        <section aria-label="Review facts" className="relative px-5 pb-14 sm:px-8 lg:pb-16">
          <dl className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-[10px] border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-4">
            {PROOF.map((p) => (
              <div key={p.k} className="px-6 py-6 backdrop-blur-sm" style={{ background: 'rgba(31,15,23,0.55)' }}>
                <dt className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: PINK }}>{p.k}</dt>
                <dd className="mt-2 font-heading text-[15px] font-bold leading-snug text-white">{p.v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {/* ═══════════════ 3 · WITHOUT vs WITH (DM screenshot vs booked review) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            A screenshot of a DM is not <span style={{ color: PINK_INK }}>a review.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-500">
            Kind words in your WhatsApp are lovely. To a stranger looking at your page, they are just a picture. Here is the same happy client, both ways.
          </Reveal>

          <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-2">
            <Reveal className="rounded-[10px] border border-black/5 bg-neutral-50 p-6 sm:p-8">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">Testimonial screenshots</div>
              <div aria-hidden className="mt-5 space-y-2 rounded-[6px] border border-black/5 bg-neutral-100 p-4">
                <div className="h-2 w-24 rounded-full bg-neutral-300" />
                <div className="max-w-[80%] rounded-[6px] bg-white px-3 py-2 text-[13px] text-neutral-600">thank you so much, the session was great!!</div>
                <div className="max-w-[60%] rounded-[6px] bg-white px-3 py-2 text-[13px] text-neutral-600">will recommend you to my friends</div>
                <div className="ml-auto max-w-[45%] rounded-[6px] bg-neutral-200 px-3 py-2 text-right text-[13px] text-neutral-500">can I post this?</div>
              </div>
              <ul className="mt-6 space-y-3">
                {WITHOUT.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[15px] text-neutral-500">
                    <X size={16} className="mt-1 shrink-0 text-neutral-400" aria-hidden /><span><span className="sr-only">Without: </span>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.06} className="rounded-[10px] border bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-8" style={{ borderColor: `${PINK}4d` }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: PINK_INK }}>Reviews tied to real bookings</div>
              <div aria-hidden className="mt-5 rounded-[6px] border border-black/5 p-4" style={{ background: BLUSH }}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">Rohan M.</span>
                  <Stars n={5} size={12} />
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-neutral-700">Thank you so much, the session was great. Will recommend you to my friends.</p>
                <div className="mt-2 flex items-center justify-between text-[11px]">
                  <span className="inline-flex items-center gap-1 font-semibold" style={{ color: PINK_INK }}><ShieldCheck size={12} /> Verified booking</span>
                  <span className="text-neutral-500">3 Oct 2026</span>
                </div>
              </div>
              <ul className="mt-6 space-y-3">
                {WITH.map((t) => (
                  <li key={t} className="flex items-start gap-2.5 text-[15px] font-medium text-[#191919]">
                    <Check size={16} className="mt-1 shrink-0" style={{ color: PINK_INK }} aria-hidden /><span><span className="sr-only">With Meeticulous: </span>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <p className="mt-4 text-center text-[11px] text-neutral-500">Both cards are illustrations.</p>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (photo-topped step cards) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: BLUSH }}>
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            From finished session to <span style={{ color: PINK_INK }}>public proof.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-500">
            Three steps, and you only do the first one.
          </Reveal>
          <ol className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.06} className="flex flex-col overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                {s.slot ? (
                  <ImgSlot slot={s.slot} alt={s.alt} className="aspect-[4/3] w-full border-b border-black/5" />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center border-b border-black/5 p-6" style={{ background: `linear-gradient(160deg, ${BLUSH}, #FFFFFF)` }} aria-hidden>
                    <div className="w-full max-w-[15rem] rounded-[6px] border border-black/5 bg-white p-3.5 shadow-[0_8px_30px_rgba(26,26,26,0.06)]">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold">Reviews</span>
                        <Star size={13} style={{ color: PINK, fill: PINK }} />
                      </div>
                      {[5, 4].map((n, j) => (
                        <div key={n} className="mt-2.5 flex items-start gap-2 border-t border-black/5 pt-2.5">
                          <span className="h-6 w-6 shrink-0 rounded-full" style={{ background: j ? '#FBCFE8' : PINK_INK }} />
                          <div className="flex-1">
                            <Stars n={n} size={10} />
                            <div className="mt-1 h-1.5 w-full rounded-full bg-neutral-200" />
                            <div className="mt-1 h-1.5 w-2/3 rounded-full bg-neutral-200" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex-1 p-6 sm:p-7">
                  <span className="font-heading text-sm font-extrabold tabular-nums" style={{ color: PINK_INK }}>Step {i + 1}</span>
                  <h3 className="mt-2 font-heading text-xl font-bold">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════════ 5 · CAPABILITIES (two-column icon list) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          {/* Left intro stays pinned while the list scrolls past it. */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <Reveal as="h2" className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Built so reviews <span style={{ color: PINK_INK }}>can be trusted.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mt-5 max-w-md text-base leading-relaxed text-neutral-500">
              A review only means something if the person reading it believes it. Every rule below is there for that reader.
            </Reveal>
            <Reveal delay={0.1} className="mt-8 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-semibold" style={{ background: BLUSH, color: PINK_INK }}>
              <Heart size={14} aria-hidden /> Included on every plan
            </Reveal>
          </div>
          <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-1">
            {CAPS.map((c, i) => (
              <Reveal as="li" key={c.title} delay={(i % 2) * 0.05} className="flex gap-4 border-t border-black/5 py-6">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px]" style={{ background: BLUSH, color: PINK_INK }}>
                  <c.icon size={19} aria-hidden />
                </span>
                <div>
                  <h3 className="font-heading text-[17px] font-bold">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-neutral-500">{c.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══════════════ 6 · THE DIFFERENCE (how a review becomes verified) ═══════════════ */}
      <section id="verified" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28" style={{ background: BLUSH }}>
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <Reveal as="h2" className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              How a review becomes <span style={{ color: PINK_INK }}>verified.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-500">
              Four checkpoints sit between a booking and a review on your page. Tap each one to see what it checks, and what it keeps out.
            </Reveal>
          </div>
          <VerifyTrack />
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (masonry wall) ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Hosts who moved their clients <span style={{ color: PINK_INK }}>out of the DMs.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-500">
              Real hosts on Meeticulous, talking about running their bookings here.
            </Reveal>
            <div className="mt-14 gap-5 sm:columns-2 sm:gap-6 lg:columns-3">
              {QUOTES.map((t, i) => (
                <Reveal
                  as="figure"
                  key={t.name}
                  delay={i * 0.05}
                  className="mb-5 break-inside-avoid rounded-[10px] border border-black/5 p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:mb-6 sm:p-7"
                  style={{ background: i % 3 === 0 ? BLUSH : '#FFFFFF' }}
                >
                  <span aria-hidden className="block font-heading text-5xl leading-[0.6]" style={{ color: PINK }}>&ldquo;</span>
                  <blockquote className={`mt-3 leading-relaxed text-[#191919] ${i === 0 ? 'font-heading text-xl font-bold' : 'text-[15px]'}`}>{t.quote}</blockquote>
                  <figcaption className="mt-5 flex items-center gap-3">
                    <img src={t.avatar} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-neutral-500">{t.role}</div>
                    </div>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ 8 · FAQ (card accordion) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: BLUSH }}>
        <div className="mx-auto max-w-3xl">
          <Reveal as="h2" className="text-center font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Review questions, <span style={{ color: PINK_INK }}>answered.</span>
          </Reveal>
          <div className="mt-12 space-y-3">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group rounded-[6px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6 [&::-webkit-details-marker]:hidden">
                  <span className="font-heading text-[16px] font-bold">{f.q}</span>
                  <ChevronDown size={18} aria-hidden className="shrink-0 text-neutral-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="px-5 pb-5 text-[15px] leading-relaxed text-neutral-600 sm:px-6">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · FINAL CTA ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-20 text-white sm:px-8 lg:py-28" style={{ background: PLUM }}>
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-[30rem] w-[30rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(255,77,147,0.22), transparent)' }} />
        <div className="relative mx-auto max-w-5xl text-center">
          <Reveal as="h2" className="font-heading text-[clamp(2.4rem,6vw,4.2rem)] font-extrabold leading-[1.0] tracking-[-0.03em] text-white">
            Let your last client <span style={{ color: PINK }}>introduce your next one.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/75">
            Set up your booking page free. Every completed session asks for a review on its own.
          </Reveal>
          <Reveal delay={0.1} className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <PrimaryCta onDark>Start free <ArrowRight size={16} /></PrimaryCta>
            <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:no-underline hover:opacity-80">
              See pricing <ArrowRight size={15} />
            </Link>
          </Reveal>
          <nav aria-label="Related features" className="mt-14 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-8 text-sm text-white/60">
            <span className="flex items-center gap-1.5"><Star size={14} aria-hidden /> Works with</span>
            {RELATED.map((r) => (
              <Link key={r.to} to={r.to} className="text-white/85 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white">{r.label}</Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
