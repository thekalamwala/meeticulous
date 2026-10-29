// /features/online-scheduling — bespoke feature page (Oct feature-page rebuild).
//
// STANDALONE page, not the data-driven FeaturePage template. Its static route
// precedes /features/:slug in App.jsx; the featureData.js "online-scheduling"
// entry stays for prerender's slug list and the other pages' "related" cards.
//
// Section order (shared by all 10 bespoke feature pages, each its own design):
//   1 Hero + live demo · 2 Proof strip · 3 Without vs with · 4 How it works ·
//   5 Capabilities · 6 The difference · 7 Testimonials · 8 FAQ · 9 Final CTA
//
// Design system A "Trust-Blue": white and pale-blue sections, one crisp blue
// accent, a subtle dotted-grid motif, calm fact cards. Mechanics unique to this
// page: clickable slot picker (hero) · icon fact cards · chat thread vs one link ·
// horizontal numbered stepper · 3×2 icon grid · interactive slot planner
// (session length + buffer) · 3-card testimonial row · two-column accordion FAQ.
//
// HONESTY: every claim is checked against the code.
//   - Slots = weekly hours − blocked dates − bookings − Google busy − buffer
//     (server/services/availabilityService.js). slotStarts() below mirrors its loop.
//   - Buffer options = Availability.jsx select (0/5/10/15/30/60). Durations =
//     ServiceForm DURATIONS (15–120 or custom; server clamps 5–480).
//   - Double-booking guard = bookings_no_overlap DB constraint (migration v2.5).
//   - Guests verify with a WhatsApp OTP (ServiceBooking.jsx, /auth/send-otp).
//   - Slots are shown in the HOST's time zone with a label (tzAbbr), NOT converted
//     to the guest's, so this page makes no time-zone-conversion claim.
//   - No group sessions / seat caps exist in code, so none are claimed.
// No usage stats, no ratings. Testimonials are real, from data/testimonials.js.
//
// IMAGES: empty ImgSlot placeholders (data-img-slot names the photo to supply).
// Global Navbar + Footer come from App.jsx. No hover uplift anywhere.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, CheckCircle2, CalendarCheck, Clock, ShieldCheck, Smartphone,
  Layers, Timer, Video, ImageIcon, Link2, PenLine, CalendarDays, Share2, CheckCheck,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN } from '../../data/plans';
import { TESTIMONIALS as ALL_TESTIMONIALS } from '../../data/testimonials';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';
const BLUE = '#2E1065';       // accent for text + fills on white (AA, ~6.7:1)
const BLUE_DEEP = '#0B2559';  // dark section background
const BLUE_SKY = '#93C5FD';   // decorative / text on BLUE_DEEP only (AA)
const PALE = '#F2F6FF';       // tinted section background
const INK = '#0F172A';
const DOTS = { backgroundImage: 'radial-gradient(rgba(29,78,216,0.13) 1px, transparent 1px)', backgroundSize: '22px 22px' };

/* ─────────────────────────────  SLOT MATH  ────────────────────────────── */

/**
 * Slot start times (minutes from midnight) inside one working window. Mirrors the
 * loop in server/services/availabilityService.js: step = duration + buffer, and a
 * slot is offered only if it ends by the window's end. Real days also remove
 * existing bookings, blocked dates and Google Calendar busy time.
 */
export function slotStarts(startMin, endMin, duration, buffer) {
  const out = [];
  for (let cur = startMin; cur + duration <= endMin; cur += duration + buffer) out.push(cur);
  return out;
}

const fmtMin = (m) => {
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const HERO_TRUST = [`${FREE_PLAN.name} plan is ₹0`, 'No app or password for clients', 'Syncs with Google Calendar'];

const PROOF = [
  { icon: Clock, k: 'Live slots', v: 'Your hours, minus bookings, blocked dates and Google Calendar busy time' },
  { icon: ShieldCheck, k: 'Overlap guard', v: 'Double-bookings are rejected by the database itself' },
  { icon: Smartphone, k: 'Guest sign-in', v: 'A phone number and a WhatsApp code. No password, no app' },
  { icon: CalendarCheck, k: 'Confirmation', v: 'Your client gets it on email and WhatsApp' },
];

const THREAD = [
  { me: false, t: 'Hi! Are you free Tuesday?' },
  { me: true, t: 'Tuesday is full. Wednesday at 4?' },
  { me: false, t: '4 is tough. 5:30 maybe?' },
  { me: true, t: '5:30 works. Sending my UPI.' },
  { me: false, t: 'Actually, can we do Thursday instead?' },
];

const STEPS = [
  { icon: PenLine, title: 'Add your services', desc: 'Each one gets its own length and price, from a 15 minute call to a two hour session.' },
  { icon: CalendarDays, title: 'Set your hours', desc: 'Weekly working hours, days off, a buffer between bookings and your time zone.' },
  { icon: Share2, title: 'Share one link', desc: 'Your meeticulous.com page goes in your Instagram bio, WhatsApp status or email signature.' },
  { icon: CheckCheck, title: 'Clients book themselves', desc: 'They pick a live slot, confirm with a WhatsApp code and pay if the session is paid. Done.' },
];

const CAPS = [
  { icon: Clock, title: 'Live availability', body: 'Clients only see times you are actually free: your weekly hours, minus existing bookings, blocked dates and busy time on your Google Calendar.' },
  { icon: Layers, title: 'A length for every service', body: 'A 15 minute discovery call and a 90 minute deep-dive on the same page. Pick 15 to 120 minutes, or set a custom length.' },
  { icon: Timer, title: 'Buffers between bookings', body: 'Leave no gap, or 5, 10, 15, 30 minutes or an hour after each session so back-to-back calls never crowd you.' },
  { icon: ShieldCheck, title: 'No double-bookings', body: 'Two bookings for the same time are blocked at the database level, and a paid slot only confirms once its payment verifies.' },
  { icon: CalendarCheck, title: 'Instant confirmation', body: 'Free sessions confirm the moment they are booked, paid ones the moment payment clears. No approval queue.' },
  { icon: Video, title: 'Online or in person', body: 'Connect Google Calendar and online bookings get a Google Meet link. In-person services show your location instead.' },
];

const LENGTHS = [15, 30, 45, 60, 90];
const BUFFERS = [0, 5, 10, 15, 30, 60];
const WINDOW = { start: 10 * 60, end: 13 * 60 }; // 10:00 AM to 1:00 PM

const PICKED = ['Mukesh Tidke', 'Ar. Pranav Kadoo', 'Vishal Chaware'];
const QUOTES = PICKED.map((n) => ALL_TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);

const FAQ = [
  { q: 'Is the scheduling software really free?', a: `Yes. ${FREE_PLAN.name} costs ₹0 a month with unlimited services and bookings. Paid bookings carry a 5% commission. ${PREMIUM_PLAN.name} is ₹${PREMIUM_PLAN.monthly} a month or ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')} a year with 0% commission.` },
  { q: 'Do my clients need an account or an app?', a: 'No. They enter their phone number and type the 6-digit code we send them on WhatsApp. No password and nothing to download.' },
  { q: 'Can two people book the same slot?', a: 'No. Booked times disappear from your page, and the database itself rejects any overlapping booking for you. A paid slot is only confirmed once its payment is verified.' },
  { q: 'Does it work with Google Calendar?', a: 'Yes. Busy time on your connected Google Calendar is removed from your booking page, and online bookings get a Google Meet link. If Google is ever unreachable, booking keeps working on your Meeticulous availability.' },
  { q: 'Can I keep a gap between sessions?', a: 'Yes. Set a buffer of 5, 10, 15 or 30 minutes, or an hour, in your availability settings. It is added after every booking before the next slot opens.' },
  { q: 'Can I offer sessions of different lengths?', a: 'Yes. Every service has its own duration: 15, 30, 45, 60, 90 or 120 minutes, or a custom length. Your page works out the slots for each one.' },
  { q: 'What time zone do clients see?', a: 'Slots are shown in the time zone you set in your availability settings, and the zone (for example IST) is labelled on every time, at every step of booking.' },
  { q: 'Do clients get reminders?', a: `Yes. On ${FREE_PLAN.name}, clients get a reminder 24 hours before. ${PREMIUM_PLAN.name} adds 1-hour reminders and reschedule alerts.` },
];

const RELATED = [
  { to: '/features/booking-pages', label: 'Booking pages' },
  { to: '/features/availability', label: 'Availability' },
  { to: '/features/google-calendar', label: 'Google Calendar' },
  { to: '/features/payments', label: 'Payments' },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function PrimaryCta({ to = START, children, light = false }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-semibold shadow-[0_8px_30px_rgba(29,78,216,0.18)] transition-opacity hover:no-underline hover:opacity-90"
      style={light ? { background: '#FFFFFF', color: BLUE_DEEP } : { background: BLUE, color: '#FFFFFF' }}
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
      style={{ background: 'repeating-linear-gradient(135deg, rgba(29,78,216,0.04) 0 10px, rgba(29,78,216,0.08) 10px 20px)' }}
    >
      <ImageIcon size={28} style={{ color: 'rgba(29,78,216,0.3)' }} aria-hidden />
    </div>
  );
}

const SectionHead = ({ title, accent, lead, center = false }) => (
  <div className={center ? 'mx-auto max-w-3xl text-center' : 'max-w-3xl'}>
    <Reveal as="h2" className="font-heading text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
      {title} <span style={{ color: BLUE }}>{accent}</span>
    </Reveal>
    {lead && <Reveal as="p" delay={0.05} className="mt-5 text-base leading-relaxed text-slate-600">{lead}</Reveal>}
  </div>
);

/* Hero demo: pick a day, pick a free slot, see the confirmation. */
const DAYS = [
  { d: 'Mon', n: 13, slots: [['10:00 AM', 1], ['11:30 AM', 1], ['2:00 PM', 0], ['3:30 PM', 1], ['4:30 PM', 0], ['6:00 PM', 0]] },
  { d: 'Tue', n: 14, slots: [['10:00 AM', 0], ['11:30 AM', 0], ['2:00 PM', 1], ['3:30 PM', 0], ['4:30 PM', 1], ['6:00 PM', 0]] },
  { d: 'Wed', n: 15, slots: [['10:00 AM', 1], ['11:30 AM', 1], ['2:00 PM', 1], ['3:30 PM', 0], ['4:30 PM', 0], ['6:00 PM', 1]] },
  { d: 'Thu', n: 16, slots: [['10:00 AM', 0], ['11:30 AM', 1], ['2:00 PM', 0], ['3:30 PM', 0], ['4:30 PM', 0], ['6:00 PM', 0]] },
  { d: 'Fri', n: 17, slots: [['10:00 AM', 0], ['11:30 AM', 0], ['2:00 PM', 0], ['3:30 PM', 1], ['4:30 PM', 1], ['6:00 PM', 1]] },
];
const FULL_DAY = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' };

function SlotPicker() {
  const reduce = useReducedMotion();
  const [day, setDay] = useState(1);
  const [picked, setPicked] = useState(null);
  const d = DAYS[day];
  const fade = reduce
    ? {}
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] } };

  return (
    <div className="mx-auto w-full max-w-[28rem]">
      <div className="overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_30px_70px_-30px_rgba(11,37,89,0.35)]">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Discovery call · 30 min</div>
            <div className="font-heading text-sm font-bold" style={{ color: INK }}>with Priya Nair</div>
          </div>
          <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: PALE, color: BLUE }}>IST</span>
        </div>

        <div className="min-h-[17rem] px-5 py-5" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            {picked ? (
              <motion.div key="done" {...fade} className="flex flex-col items-center pt-2 text-center">
                <CheckCircle2 size={44} style={{ color: BLUE }} aria-hidden />
                <div className="mt-3 font-heading text-lg font-extrabold" style={{ color: INK }}>Booking confirmed</div>
                <dl className="mt-4 w-full space-y-2 rounded-[6px] p-4 text-left text-sm" style={{ background: PALE }}>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Service</dt><dd className="font-semibold">Discovery call, 30 min</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Date</dt><dd className="font-semibold">{FULL_DAY[picked.d]}, {picked.n} Oct</dd></div>
                  <div className="flex justify-between gap-3"><dt className="text-slate-500">Time</dt><dd className="font-semibold">{picked.t} (IST)</dd></div>
                </dl>
                <p className="mt-3 text-xs text-slate-500">Confirmation sent on WhatsApp and email</p>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="mt-4 text-xs font-semibold underline underline-offset-4 transition-opacity hover:opacity-80"
                  style={{ color: BLUE }}
                >
                  Pick another time
                </button>
              </motion.div>
            ) : (
              <motion.div key="pick" {...fade}>
                <div role="group" aria-label="Choose a day" className="grid grid-cols-5 gap-1.5">
                  {DAYS.map((x, i) => (
                    <button
                      key={x.d}
                      type="button"
                      aria-pressed={day === i}
                      onClick={() => setDay(i)}
                      className="rounded-[6px] border py-2 text-center transition-colors"
                      style={day === i ? { background: BLUE, borderColor: BLUE, color: '#FFFFFF' } : { borderColor: 'rgba(15,23,42,0.08)', color: INK }}
                    >
                      <span className="block text-[10px] font-semibold uppercase tracking-wider opacity-80">{x.d}</span>
                      <span className="block font-heading text-base font-bold">{x.n}</span>
                    </button>
                  ))}
                </div>
                <div role="group" aria-label={`Times on ${FULL_DAY[d.d]}`} className="mt-4 grid grid-cols-2 gap-2">
                  {d.slots.map(([t, booked]) => (
                    <button
                      key={t}
                      type="button"
                      disabled={!!booked}
                      onClick={() => setPicked({ d: d.d, n: d.n, t })}
                      aria-label={booked ? `${t}, booked` : t}
                      className={`rounded-[6px] border px-3 py-2.5 text-sm font-semibold transition-colors ${booked ? 'cursor-not-allowed border-transparent bg-slate-50 text-slate-400' : 'border-[#2E1065]/30 text-[#2E1065] hover:border-[#2E1065] hover:bg-[#F2F6FF]'}`}
                    >
                      {booked ? <span className="flex items-center justify-between"><span className="line-through">{t}</span><span className="text-[10px] font-medium uppercase tracking-wider no-underline">Booked</span></span> : t}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-slate-500">Illustration of a client booking page. Pick a time to try it.</p>
    </div>
  );
}

function Chips({ label, values, value, onPick, fmt }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div role="group" aria-label={label} className="mt-3 flex flex-wrap gap-2">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onPick(v)}
            className="rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors"
            style={value === v ? { background: BLUE, borderColor: BLUE, color: '#FFFFFF' } : { background: '#FFFFFF', borderColor: 'rgba(15,23,42,0.1)', color: INK }}
          >
            {fmt(v)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* The difference: how a session length + buffer carves a morning into slots. */
function SlotPlanner() {
  const [len, setLen] = useState(30);
  const [buf, setBuf] = useState(15);
  const starts = slotStarts(WINDOW.start, WINDOW.end, len, buf);
  const span = WINDOW.end - WINDOW.start;
  const pct = (m) => `${((m - WINDOW.start) / span) * 100}%`;

  return (
    <div className="mt-14 rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-9">
      <div className="grid gap-8 md:grid-cols-2">
        <Chips label="Session length" values={LENGTHS} value={len} onPick={setLen} fmt={(v) => `${v} min`} />
        <Chips label="Buffer after each booking" values={BUFFERS} value={buf} onPick={setBuf} fmt={(v) => (v === 0 ? 'None' : v === 60 ? '1 hour' : `${v} min`)} />
      </div>

      <div className="mt-10">
        <div className="flex items-baseline justify-between text-xs text-slate-500">
          <span>{fmtMin(WINDOW.start)}</span>
          <span className="font-heading text-sm font-bold" style={{ color: INK }} aria-live="polite">
            {starts.length} {starts.length === 1 ? 'slot' : 'slots'} this morning
          </span>
          <span>{fmtMin(WINDOW.end)}</span>
        </div>
        <div className="relative mt-2 h-12 overflow-hidden rounded-[6px] border border-black/5" style={{ background: PALE }} aria-hidden>
          {starts.map((s) => (
            <div key={s}>
              <div className="absolute inset-y-1 rounded-[4px]" style={{ left: pct(s), width: `calc(${(len / span) * 100}% - 2px)`, background: BLUE }} />
              {buf > 0 && s + len < WINDOW.end && (
                <div
                  className="absolute inset-y-1"
                  style={{ left: pct(s + len), width: `${(Math.min(buf, WINDOW.end - s - len) / span) * 100}%`, background: 'repeating-linear-gradient(135deg, rgba(29,78,216,0.10) 0 5px, rgba(29,78,216,0.22) 5px 10px)' }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: BLUE }} /> Bookable session</span>
          {buf > 0 && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(29,78,216,0.25)' }} /> Buffer</span>}
        </div>
      </div>

      <ul className="mt-8 flex flex-wrap gap-2" aria-label="Times your clients would see">
        {starts.map((s) => (
          <li key={s} className="rounded-[6px] border border-[#2E1065]/30 px-3 py-1.5 text-sm font-semibold tabular-nums" style={{ color: BLUE }}>{fmtMin(s)}</li>
        ))}
      </ul>
      <p className="mt-6 text-sm leading-relaxed text-slate-600">
        A sample window of {fmtMin(WINDOW.start)} to {fmtMin(WINDOW.end)}. On a real day, times that are already booked, blocked or busy on your Google Calendar come out too.
      </p>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function SchedulingFeature() {
  const canonical = `${SITE_URL}/features/online-scheduling`;
  const seo = {
    title: 'Free Online Appointment Scheduling Software | Meeticulous',
    description: 'Free online appointment scheduling for coaches, consultants and creators in India. Share one link, clients book your live slots with a WhatsApp code, with no double-bookings.',
  };
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'Online Scheduling',
    serviceType: 'Online appointment scheduling software',
    image: ogCard('features-online-scheduling'),
    steps: STEPS.map((s) => ({ title: s.title, desc: s.desc })),
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });
  const half = Math.ceil(FAQ.length / 2);

  return (
    <main className="overflow-x-clip bg-white" style={{ color: INK }}>
      <Seo
        title={seo.title}
        description={seo.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor={BLUE}
        ogTitle="Free online appointment scheduling, minus the back and forth."
        ogDescription={seo.description}
        image={ogCard('features-online-scheduling')}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · HERO (dotted grid + slot picker demo) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-20 pt-8 sm:px-8 lg:pb-28 lg:pt-6 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center" style={{ background: `linear-gradient(180deg, #FFFFFF 0%, ${PALE} 100%)` }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(180deg,transparent,black_30%,black_70%,transparent)]" style={DOTS} />
        <div className="relative mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:gap-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
              <Link to="/" className="text-slate-500 hover:text-slate-800 hover:no-underline">Home</Link>
              <span aria-hidden className="mx-2">/</span>
              <span>Features</span>
              <span aria-hidden className="mx-2">/</span>
              <span aria-current="page" className="text-slate-700">Online scheduling</span>
            </nav>
            <Reveal as="h1" instant className="mt-4 font-heading text-[clamp(2.3rem,4vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
              Free online appointment scheduling, <span style={{ color: BLUE }}>minus the back and forth.</span>
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 lg:text-[17px]">
              Scheduling software for coaches, consultants and creators in India. Share one link, clients pick a time you are actually free, confirm with a WhatsApp code, and it is booked.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta>Start free <ArrowRight size={16} /></PrimaryCta>
              <Link to="/demo" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:no-underline hover:opacity-80" style={{ color: BLUE }}>
                See a live booking page <ArrowRight size={15} />
              </Link>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] text-slate-600">
                  <Check size={14} style={{ color: BLUE }} aria-hidden /> {t}
                </span>
              ))}
            </Reveal>
          </div>
          <Reveal instant delay={0.12}>
            <SlotPicker />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 2 · PROOF (icon fact cards) ═══════════════ */}
      <section className="px-5 py-14 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map((p, i) => (
            <Reveal key={p.k} delay={i * 0.04} className="flex gap-4 rounded-[6px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px]" style={{ background: PALE, color: BLUE }}><p.icon size={19} aria-hidden /></span>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: BLUE }}>{p.k}</div>
                <div className="mt-1 text-sm leading-snug text-slate-700">{p.v}</div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 3 · WITHOUT vs WITH (chat thread vs one link) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: PALE }}>
        <div className="mx-auto max-w-6xl">
          <SectionHead
            title="“Are you free Tuesday?” is"
            accent="not a calendar."
            lead="Booking over WhatsApp works until it doesn’t. Here is the same booking, both ways."
          />
          <div className="mt-14 grid gap-6 md:grid-cols-2">
            <Reveal className="rounded-[10px] border border-black/5 bg-white p-6 sm:p-7">
              <div className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Without: the chat</div>
              <div className="mt-5 space-y-2.5" aria-label="A WhatsApp conversation trying to fix a time">
                {THREAD.map((m, i) => (
                  <div key={i} className={`flex ${m.me ? 'justify-end' : 'justify-start'}`}>
                    <span className={`max-w-[80%] rounded-[6px] px-3.5 py-2 text-sm ${m.me ? 'bg-slate-100 text-slate-700' : 'border border-black/5 bg-white text-slate-700'}`}>{m.t}</span>
                  </div>
                ))}
              </div>
              <p className="mt-5 border-t border-black/5 pt-4 text-sm text-slate-500">Five messages in, still nothing on the calendar.</p>
            </Reveal>

            <Reveal delay={0.06} className="flex flex-col rounded-[10px] border border-[#2E1065]/20 bg-white p-6 shadow-[0_8px_30px_rgba(29,78,216,0.06)] sm:p-7">
              <div className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: BLUE }}>With Meeticulous: one link</div>
              <div className="mt-5 flex justify-end">
                <span className="flex items-center gap-2 rounded-[6px] px-3.5 py-2 text-sm font-semibold text-white" style={{ background: BLUE }}>
                  <Link2 size={15} aria-hidden /> meeticulous.com/priya
                </span>
              </div>
              <div className="mt-4 flex items-start gap-3 rounded-[6px] p-4" style={{ background: PALE }}>
                <CheckCircle2 size={20} className="mt-0.5 shrink-0" style={{ color: BLUE }} aria-hidden />
                <div className="text-sm">
                  <div className="font-heading font-bold">Booked: Thursday, 4:30 PM (IST)</div>
                  <div className="mt-0.5 text-slate-600">Picked from your live slots. Confirmation on WhatsApp and email.</div>
                </div>
              </div>
              <ImgSlot slot="scheduling-booking-page-phone" alt="A Meeticulous booking page open on a phone, showing open time slots" className="mt-5 aspect-[16/9] w-full flex-1" />
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (horizontal numbered stepper) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead center title="Set it up once." accent="Then stop scheduling." lead="Four steps, most of them done the evening you sign up." />
          <ol className="relative mt-16 grid gap-10 lg:grid-cols-4 lg:gap-6">
            <span aria-hidden className="absolute left-[12.5%] right-[12.5%] top-5 hidden h-px lg:block" style={{ background: 'rgba(29,78,216,0.25)' }} />
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.06} className="relative flex gap-4 lg:flex-col lg:items-center lg:text-center">
                <span className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-white font-heading text-sm font-extrabold" style={{ borderColor: 'rgba(29,78,216,0.35)', color: BLUE }}>
                  {i + 1}
                </span>
                <div>
                  <h3 className="flex items-center gap-2 font-heading text-lg font-bold lg:mt-4 lg:justify-center">
                    <s.icon size={17} style={{ color: BLUE }} aria-hidden /> {s.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-slate-600">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={0.1} className="mt-16">
            <ImgSlot slot="scheduling-availability-settings" alt="The Meeticulous availability settings with weekly hours, time zone and buffer" className="mx-auto aspect-[21/9] w-full max-w-4xl" />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 5 · CAPABILITIES (3×2 icon grid) ═══════════════ */}
      <section className="relative px-5 py-20 sm:px-8 lg:py-28" style={{ background: PALE }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60" style={DOTS} />
        <div className="relative mx-auto max-w-6xl">
          <SectionHead title="Everything a booking calendar" accent="should just do." />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {CAPS.map((c, i) => (
              <Reveal key={c.title} delay={(i % 3) * 0.05} className="rounded-[10px] border border-black/5 bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                <span className="flex h-11 w-11 items-center justify-center rounded-[6px] text-white" style={{ background: BLUE }}><c.icon size={20} aria-hidden /></span>
                <h3 className="mt-5 font-heading text-lg font-bold">{c.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{c.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 6 · THE DIFFERENCE (interactive slot planner) ═══════════════ */}
      <section id="slots" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <SectionHead
            center
            title="See your morning"
            accent="turn into slots."
            lead="Pick a session length and a buffer. Your booking page follows the same rule: the next slot opens when the last one ends plus your buffer, and only slots that fit inside your hours are offered."
          />
          <SlotPlanner />
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (3-card row with avatars) ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: PALE }}>
          <div className="mx-auto max-w-6xl">
            <SectionHead center title="Fewer “is 4 okay?” messages," accent="in their words." />
            <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-3">
              {QUOTES.map((t, i) => (
                <Reveal as="figure" key={t.name} delay={i * 0.05} className="flex flex-col rounded-[10px] border border-black/5 bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                  <blockquote className="flex-1 text-[15px] leading-relaxed text-slate-700">&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-black/5 pt-5">
                    <img src={t.avatar} alt="" loading="lazy" className="h-11 w-11 rounded-full object-cover" />
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.role}</div>
                    </div>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ 8 · FAQ (two-column accordion) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead center title="Scheduling questions," accent="answered." />
          <div className="mt-14 grid gap-4 md:grid-cols-2 md:gap-6">
            {[FAQ.slice(0, half), FAQ.slice(half)].map((col, c) => (
              <div key={c} className="space-y-4">
                {col.map((f, i) => (
                  <details key={f.q} className="group rounded-[6px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)] open:border-[#2E1065]/25" open={c === 0 && i === 0}>
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                      <span className="font-heading text-[16px] font-bold">{f.q}</span>
                      <span aria-hidden className="text-xl leading-none transition-transform group-open:rotate-45" style={{ color: BLUE }}>+</span>
                    </summary>
                    <p className="px-5 pb-5 text-[15px] leading-relaxed text-slate-600">{f.a}</p>
                  </details>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · FINAL CTA ═══════════════ */}
      <section className="relative overflow-hidden px-5 py-20 text-white sm:px-8 lg:py-28" style={{ background: BLUE_DEEP }}>
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(147,197,253,0.14) 1px, transparent 1px)', backgroundSize: '22px 22px' }} />
        <div className="relative mx-auto max-w-4xl text-center">
          <Reveal as="h2" className="font-heading text-[clamp(2.2rem,5.4vw,3.8rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-white">
            One link. <span style={{ color: BLUE_SKY }}>Zero back and forth.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-white/75">
            Set your hours tonight on the free {FREE_PLAN.name} plan. Tomorrow, clients book themselves.
          </Reveal>
          <Reveal delay={0.1} className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <PrimaryCta light>Start free <ArrowRight size={16} /></PrimaryCta>
            <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white hover:no-underline hover:opacity-80">
              See pricing <ArrowRight size={15} />
            </Link>
          </Reveal>
          <nav aria-label="Related features" className="mt-14 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-8 text-sm text-white/60">
            <span className="flex items-center gap-1.5"><CalendarDays size={14} aria-hidden /> Works with</span>
            {RELATED.map((r) => (
              <Link key={r.to} to={r.to} className="text-white/85 underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white">{r.label}</Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
