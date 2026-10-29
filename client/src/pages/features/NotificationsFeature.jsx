// /features/notifications — bespoke feature page (Oct feature-page rebuild).
//
// STANDALONE page, not the data-driven FeaturePage template. Its static route
// precedes /features/:slug in App.jsx; the featureData.js "notifications" entry
// stays for prerender's slug list and the other pages' "related" cards.
//
// Section order (shared by all 10 bespoke feature pages, each its own design):
//   1 Hero + live demo · 2 Proof strip · 3 Without vs with · 4 How it works ·
//   5 Capabilities · 6 The difference · 7 Testimonials · 8 FAQ · 9 Final CTA
//
// Design system C "Dark-Bold": near-black dominant, WhatsApp-style green accent,
// big numbered cards, squared icon tiles, two light sections for rhythm.
// Mechanics unique to this page: phone chat with time markers (hero) · big
// numbered fact squares · hand-typed chat bubbles vs automated log · dark
// numbered step cards · channel × event matrix · plan toggle that lights up
// which messages fire · featured big quote + side quotes · dark accordion FAQ.
//
// HONESTY (verified in server/ on 2026-10-07):
//   - Events + channels: NotificationEngine (services/notificationEngine.js) sends
//     WhatsApp + email per notification_events; prod rows for BOOKING_CONFIRMED,
//     _REMINDER, _RESCHEDULED, _CANCELLED, _COMPLETED and REBOOK_NUDGE all have
//     whatsapp_enabled + email_enabled = true. Each event has a _CUSTOMER and a
//     _VENDOR send, so client AND host are notified.
//   - Reminder windows: planService.reminderWindowsForPlan (reminder_flows):
//     Sloth = 24h, Sloth Active = 24h + 1h. Catch-up send for last-minute
//     bookings: bookingController.fireDueReminders.
//   - Free WhatsApp reminders: bookingController.whatsappRemindersAllowed, 60 days
//     from signup (anchored no earlier than 1 Oct 2026), then email-only.
//     Confirmations/cancellations are NOT gated by it.
//   - Reschedule email/WhatsApp: planService.rescheduleNotifyForPlan (Sloth Active
//     only); Sloth still gets the in-app notice.
//   - Cancellation notices are NOT plan-gated in code (bookingController cancel path).
//   - Rebook nudge: followups/flowRegistry, days 3 + 21, followup_flows (Sloth Active).
//   - STOP opt-out: notificationEngine honours contacts.whatsapp_suppressed.
// No usage stats, no open rates, no no-show percentages.
//
// IMAGES: empty ImgSlot placeholders (data-img-slot names the photo to supply).
// Global Navbar + Footer come from App.jsx. No hover uplift anywhere.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, X, Lock, ImageIcon, MessageCircle, Mail, BellRing, Bell,
  CalendarCheck, CalendarX2, RefreshCw, Star, Repeat, MapPin, Video, BellOff, CheckCheck,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN } from '../../data/plans';
import { TESTIMONIALS as ALL_TESTIMONIALS } from '../../data/testimonials';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';
const INK = '#0F1111';        // dominant near-black
const INK_2 = '#171A1A';      // raised cards on dark
const PAPER = '#F2F5F3';      // light text on dark + light section bg
const GREEN = '#25D366';      // decorative / text on dark only (AA on INK)
const GREEN_INK = '#15803D';  // green for text on light (AA on white + PAPER)
const CHAT_BG = '#0B141A';    // phone mock: chat wallpaper
const CHAT_BUBBLE = '#1F2C33'; // phone mock: header + bubbles
const CHAT_TEXT = '#E9EDEF';  // phone mock: text
const CHAT_TICK = '#53BDEB';  // phone mock: read ticks

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const HERO_TRUST = ['Free plan, no card needed', 'WhatsApp and email', 'Built for India'];

// Hero demo: time markers → the message that fires at that moment.
const MOMENTS = [
  {
    key: 'booked', marker: 'Booked', time: '2:14 PM', active: false,
    text: 'Hi Aarav, your Physio consult with Meera is confirmed for Thu, 10 Oct at 5:00 PM.',
  },
  {
    key: '24h', marker: '24 hours before', time: 'Wed 5:00 PM', active: false,
    text: 'Reminder: your Physio consult with Meera is tomorrow at 5:00 PM. Directions: maps.app/clinic',
  },
  {
    key: '1h', marker: '1 hour before', time: 'Thu 4:00 PM', active: true,
    text: 'Starting in 1 hour: Physio consult with Meera at 5:00 PM. See you soon.',
  },
  {
    key: 'after', marker: 'After the session', time: 'Thu 6:10 PM', active: false,
    text: 'Thanks for coming in, Aarav. How was your session? Leave Meera a review: meeticulous.com/review',
  },
];

const PROOF = [
  { n: '01', big: 'WhatsApp + email', small: 'Every booking confirmation goes out on both channels.' },
  { n: '02', big: '24 hours', small: `A reminder before every session, on ${FREE_PLAN.name} and ${PREMIUM_PLAN.name}.` },
  { n: '03', big: '1 hour', small: `A second, last-call reminder on ${PREMIUM_PLAN.name}.` },
  { n: '04', big: 'Both sides', small: 'Your client gets reminded, and so do you.' },
];

const BY_HAND = [
  'Hi! Just confirming our session tomorrow at 5?',
  'Hey, reminder, we start in an hour.',
  'Did you see my last message?',
  'Here is the Meet link again…',
];

const AUTOMATED = [
  { icon: CalendarCheck, t: 'Confirmation sent the moment they book' },
  { icon: BellRing, t: 'Reminder sent 24 hours before' },
  { icon: Video, t: 'The Meet link or your directions, right in the reminder' },
  { icon: CalendarX2, t: 'Cancellations reach both of you on their own' },
];

const STEPS = [
  { title: 'Your client books', desc: 'They pick a slot on your booking page and verify their phone with an OTP. That number is where WhatsApp messages go.' },
  { title: 'Both of you get a confirmation', desc: 'A WhatsApp message and an email go to your client, and a new-booking notice comes to you. With Google Calendar connected, online sessions get a Meet link.' },
  { title: 'Reminders fire on schedule', desc: `24 hours before the session, for both of you, with the Meet link or your directions. ${PREMIUM_PLAN.name} adds a reminder 1 hour before.` },
  { title: 'The thank-you follows', desc: `After the session your client gets a thank-you with a link to review you. On ${PREMIUM_PLAN.name}, rebook nudges follow on day 3 and day 21.` },
];

// Channel × event matrix. Only cells verified in server/ (see header).
const BOTH = 'Both plans';
const MATRIX = [
  { event: 'Booking confirmation', icon: CalendarCheck, wa: true, email: true, who: 'Client + you', plan: BOTH },
  { event: '24-hour reminder', icon: BellRing, wa: 'note', email: true, who: 'Client + you', plan: BOTH },
  { event: '1-hour reminder', icon: Bell, wa: true, email: true, who: 'Client + you', plan: PREMIUM_PLAN.name },
  { event: 'Reschedule notice', icon: RefreshCw, wa: true, email: true, who: 'Client + you', plan: PREMIUM_PLAN.name },
  { event: 'Cancellation notice', icon: CalendarX2, wa: true, email: true, who: 'Client + you', plan: BOTH },
  { event: 'Thank-you + review link', icon: Star, wa: true, email: true, who: 'Client', plan: BOTH },
  { event: 'Rebook nudge, day 3 + day 21', icon: Repeat, wa: true, email: true, who: 'Client', plan: PREMIUM_PLAN.name },
];

const EXTRAS = [
  { icon: MapPin, title: 'Directions or a join link', body: 'Online sessions carry the Meet link. In-person ones carry your map link once you add it, so nobody asks where to come.' },
  { icon: BellOff, title: 'Clients stay in control', body: 'A client who replies STOP stops getting WhatsApp messages. Their booking codes still arrive.' },
  { icon: Bell, title: 'Alerts in your dashboard', body: 'New bookings, cancellations and reschedules also show up as in-app notices in your dashboard.' },
];

// Plan toggle: which messages fire on each plan.
const FLOW = [
  { k: 'confirm', label: 'Booking confirmation', when: 'The moment they book', free: 'on', note: null },
  { k: '24h', label: '24-hour reminder', when: 'A day before', free: 'on', note: 'WhatsApp for your first 2 months, then by email' },
  { k: '1h', label: '1-hour reminder', when: 'An hour before', free: 'off', note: null },
  { k: 'resched', label: 'Reschedule on WhatsApp + email', when: 'When a time changes', free: 'off', note: 'Sloth shows an in-app notice instead' },
  { k: 'cancel', label: 'Cancellation notice', when: 'When a booking is cancelled', free: 'on', note: null },
  { k: 'thanks', label: 'Thank-you + review link', when: 'After the session', free: 'on', note: null },
  { k: 'rebook', label: 'Rebook nudges', when: 'Day 3 and day 21 after', free: 'off', note: null },
];

const PICKED = ['Dr. Yukta Bawankar', 'Mukesh Tidke', 'Ar. Pranav Kadoo'];
const QUOTES = PICKED.map((n) => ALL_TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);

const FAQ = [
  { q: 'Does Meeticulous send automatic appointment reminders on WhatsApp?', a: `Yes. Every booking gets a reminder 24 hours before the session, sent to your client and to you on WhatsApp and email. ${PREMIUM_PLAN.name} adds a second reminder 1 hour before.` },
  { q: `Are WhatsApp reminders free on ${FREE_PLAN.name}?`, a: `For your first 2 months, yes. After that, ${FREE_PLAN.name} reminders go out by email only. Hosts who joined before 1 October 2026 get their 2 months from that date. On ${PREMIUM_PLAN.name}, reminders stay on WhatsApp for as long as you subscribe. Booking confirmations and cancellations go out on WhatsApp on both plans.` },
  { q: 'What happens if a client books at the last minute?', a: 'If the session is already inside the reminder window when they book, a reminder goes out straight after the confirmation, so no one is skipped.' },
  { q: 'Do I get notified too?', a: 'Yes. You get your own confirmation for every new booking, the same reminders before each session, and notices when a booking is cancelled. They also appear in your dashboard.' },
  { q: 'What happens when a booking is rescheduled or cancelled?', a: `Cancellations notify both of you on WhatsApp and email on every plan. Reschedules go out on WhatsApp and email on ${PREMIUM_PLAN.name}. On ${FREE_PLAN.name}, a reschedule shows up as an in-app notice instead.` },
  { q: 'Can I change when reminders are sent?', a: `Not at the moment. Reminders run at fixed times: 24 hours before on every plan, plus 1 hour before on ${PREMIUM_PLAN.name}. Times are written in your time zone.` },
  { q: 'Will my client get emails as well?', a: 'If they added an email when booking, yes. Clients book with their phone number, so WhatsApp always goes to the number they verified, and email goes wherever one was given.' },
  { q: 'Can a client stop the WhatsApp messages?', a: 'Yes. Replying STOP turns off WhatsApp messages for that number. One-time booking codes still arrive so they can keep booking.' },
];

const RELATED = [
  { to: '/features/online-scheduling', label: 'Online scheduling' },
  { to: '/features/google-calendar', label: 'Google Calendar' },
  { to: '/features/client-management', label: 'Client management' },
  { to: '/features/reviews', label: 'Reviews' },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function PrimaryCta({ to = START, children, onDark = true }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-semibold shadow-[0_8px_30px_rgba(26,26,26,0.12)] transition-opacity hover:no-underline hover:opacity-90"
      style={onDark ? { background: GREEN, color: INK } : { background: INK, color: PAPER }}
    >
      {children}
    </Link>
  );
}

/* Empty image placeholder; the founder supplies the real photo later. */
function ImgSlot({ alt, slot, className = '', dark = false }) {
  const ink = dark ? '242,245,243' : '15,17,17';
  return (
    <div
      role="img"
      aria-label={alt}
      data-img-slot={slot}
      className={`flex items-center justify-center rounded-[10px] border ${dark ? 'border-white/10' : 'border-black/5'} ${className}`}
      style={{ background: `repeating-linear-gradient(135deg, rgba(${ink},0.04) 0 10px, rgba(${ink},0.08) 10px 20px)` }}
    >
      <ImageIcon size={28} style={{ color: `rgba(${ink},0.3)` }} aria-hidden />
    </div>
  );
}

function ActiveTag({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#F2F5F3]/70 ${className}`}>
      <Lock size={9} aria-hidden /> {PREMIUM_PLAN.name}
    </span>
  );
}

/* Hero demo — a phone with a chat; time markers reveal what fires when. */
function ReminderPhone() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return undefined;
    const id = setInterval(() => setStep((s) => (s + 1) % MOMENTS.length), 3200);
    return () => clearInterval(id);
  }, [reduce, paused]);

  const pop = reduce
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } };
  const shown = MOMENTS.slice(0, step + 1);

  return (
    <div className="mx-auto w-full max-w-[30rem]">
      <div className="overflow-hidden rounded-[10px] border border-white/10 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.7)]" style={{ background: CHAT_BG }}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ background: CHAT_BUBBLE }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full font-heading text-xs font-extrabold" style={{ background: GREEN, color: INK }}>BS</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-[#E9EDEF]">Meeticulous</div>
            <div className="text-[11px] text-[#E9EDEF]/55">Business account</div>
          </div>
        </div>
        <div className="flex min-h-[23rem] flex-col justify-end gap-2.5 px-3 py-4" aria-live="polite">
          <AnimatePresence initial={false}>
            {shown.map((m) => (
              <motion.div key={m.key} {...pop} className="max-w-[86%] rounded-[6px] px-3.5 py-2.5 text-[14px] leading-snug" style={{ background: CHAT_BUBBLE, color: CHAT_TEXT }}>
                {m.text}
                <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-[#E9EDEF]/50">
                  {m.time} <CheckCheck size={12} style={{ color: CHAT_TICK }} aria-hidden />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="When each message fires">
        {MOMENTS.map((m, i) => (
          <button
            key={m.key}
            type="button"
            aria-pressed={step === i}
            onClick={() => { setStep(i); setPaused(true); }}
            className={`flex flex-col items-start gap-1 rounded-[6px] border px-3 py-2 text-left text-xs font-semibold transition-colors ${step === i ? 'border-transparent' : 'border-white/10 text-[#F2F5F3]/70 hover:border-white/25 hover:text-[#F2F5F3]'}`}
            style={step === i ? { background: GREEN, color: INK } : undefined}
          >
            {m.marker}
            {m.active && (
              <span className={`text-[10px] font-bold uppercase tracking-[0.06em] ${step === i ? 'text-[#0F1111]/70' : 'text-[#F2F5F3]/50'}`}>
                {PREMIUM_PLAN.name} only
              </span>
            )}
          </button>
        ))}
      </div>
      <p className="mt-3 text-center text-[11px] text-[#F2F5F3]/45">Illustration of the messages a client receives. Real wording may differ.</p>
    </div>
  );
}

function Cell({ v }) {
  if (v === 'note') {
    return (
      <span className="flex items-start gap-1.5">
        <Check size={16} className="mt-0.5 shrink-0 text-[#15803D]" aria-hidden />
        <span className="text-[12px] leading-snug text-neutral-500">{FREE_PLAN.name}: first 2 months, then email</span>
      </span>
    );
  }
  return <Check size={17} className="text-[#15803D]" aria-label="Yes" />;
}

/* The difference — flip the plan, watch which messages fire. */
function PlanToggle() {
  const [plan, setPlan] = useState('free');
  const isActive = plan === 'premium';
  return (
    <div className="mt-12">
      <div className="mx-auto flex w-full max-w-sm rounded-[6px] border border-white/10 p-1" role="group" aria-label="Choose a plan">
        {[{ k: 'free', name: FREE_PLAN.name }, { k: 'premium', name: PREMIUM_PLAN.name }].map((p) => (
          <button
            key={p.k}
            type="button"
            aria-pressed={plan === p.k}
            onClick={() => setPlan(p.k)}
            className={`flex-1 rounded-[5px] px-4 py-2.5 text-sm font-semibold transition-colors ${plan === p.k ? '' : 'text-[#F2F5F3]/65 hover:text-[#F2F5F3]'}`}
            style={plan === p.k ? { background: GREEN, color: INK } : undefined}
          >
            {p.name}
          </button>
        ))}
      </div>

      <ol className="mt-10 grid gap-3">
        {FLOW.map((f, i) => {
          const on = isActive || f.free === 'on';
          const note = !isActive ? f.note : null;
          return (
            <li
              key={f.k}
              data-testid={`flow-${f.k}`}
              data-on={on ? 'true' : 'false'}
              className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-4 rounded-[6px] border px-4 py-4 transition-colors sm:px-5 ${on ? 'border-white/15 bg-[#171A1A]' : 'border-white/5 bg-transparent'}`}
            >
              <span className="font-heading text-sm font-extrabold tabular-nums" style={{ color: on ? GREEN : 'rgba(242,245,243,0.25)' }}>{String(i + 1).padStart(2, '0')}</span>
              <div className="min-w-0">
                <div className={`font-heading text-[15px] font-bold ${on ? 'text-[#F2F5F3]' : 'text-[#F2F5F3]/35'}`}>{f.label}</div>
                <div className={`mt-0.5 text-xs ${on ? 'text-[#F2F5F3]/60' : 'text-[#F2F5F3]/30'}`}>{f.when}{note ? `. ${note}` : ''}</div>
              </div>
              {on ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: 'rgba(37,211,102,0.14)', color: GREEN }}>
                  <Check size={12} aria-hidden /> Fires
                </span>
              ) : (
                <ActiveTag />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#F2F5F3]/65">
        {PREMIUM_PLAN.name} is ₹{PREMIUM_PLAN.monthly} a month or ₹{PREMIUM_PLAN.yearly.toLocaleString('en-IN')} a year, GST included, with 0% commission on your bookings.
        {' '}<Link to="/pricing" className="font-semibold underline decoration-white/30 underline-offset-4 hover:decoration-white" style={{ color: GREEN }}>Compare plans</Link>
      </p>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function NotificationsFeature() {
  const canonical = `${SITE_URL}/features/notifications`;
  const seo = {
    title: 'Automated Appointment Reminder System for India | Meeticulous',
    description: 'Automatic WhatsApp and email booking confirmations and reminders for you and your clients, 24 hours before every session, plus 1 hour before on Sloth Active. Start free.',
  };
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'Notifications & Reminders',
    serviceType: 'Automated WhatsApp and email appointment reminders',
    image: ogCard('features-notifications'),
    steps: STEPS.map((s) => ({ title: s.title, desc: s.desc })),
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  return (
    <main className="overflow-x-clip bg-[#0F1111] text-[#F2F5F3]">
      <Seo
        title={seo.title}
        description={seo.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor={INK}
        ogTitle="Reminders that go out without you."
        ogDescription={seo.description}
        image={ogCard('features-notifications')}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · HERO (bold display + phone chat demo) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-20 pt-8 sm:px-8 lg:pb-28 lg:pt-6 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center">
        <div aria-hidden className="pointer-events-none absolute -left-40 top-10 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(37,211,102,0.12), transparent)' }} />
        <div className="relative mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:gap-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs text-[#F2F5F3]/55">
              <Link to="/" className="text-[#F2F5F3]/55 hover:text-[#F2F5F3] hover:no-underline">Home</Link>
              <span aria-hidden className="mx-2">/</span>
              <span>Features</span>
              <span aria-hidden className="mx-2">/</span>
              <span aria-current="page" className="text-[#F2F5F3]/85">Notifications</span>
            </nav>
            <Reveal as="h1" instant className="mt-4 font-heading text-[clamp(2.1rem,3.7vw,3.2rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-[#F2F5F3]">
              The appointment reminder system that <span style={{ color: GREEN }}>texts clients for you.</span>
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mt-4 max-w-xl text-base leading-relaxed text-[#F2F5F3]/75 lg:text-[17px]">
              Automated WhatsApp and email reminders for coaches, therapists, tutors and consultants in India. Every booking is confirmed, reminded and followed up without you typing a word.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta>Start free <ArrowRight size={16} /></PrimaryCta>
              <a href="#plans" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F2F5F3] hover:no-underline hover:opacity-80">
                See what fires on each plan <ArrowRight size={15} />
              </a>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] text-[#F2F5F3]/65">
                  <Check size={14} style={{ color: GREEN }} aria-hidden /> {t}
                </span>
              ))}
            </Reveal>
          </div>
          <Reveal instant delay={0.12}>
            <ReminderPhone />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 2 · PROOF (big numbered fact squares) ═══════════════ */}
      <section className="px-5 pb-20 sm:px-8 lg:pb-28">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {PROOF.map((p, i) => (
            <Reveal key={p.n} delay={i * 0.05} className="flex min-h-[11rem] flex-col justify-between sm:aspect-square rounded-[6px] border border-white/10 bg-[#171A1A] p-4 sm:p-6">
              <span className="font-heading text-4xl font-extrabold tabular-nums sm:text-6xl" style={{ color: GREEN }}>{p.n}</span>
              <div>
                <div className="font-heading text-lg font-extrabold leading-tight text-[#F2F5F3] sm:text-2xl">{p.big}</div>
                <p className="mt-1.5 text-xs leading-snug text-[#F2F5F3]/60 sm:text-sm">{p.small}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ═══════════════ 3 · WITHOUT vs WITH (light: hand-typed bubbles vs automated log) ═══════════════ */}
      <section className="bg-[#F2F5F3] px-5 py-20 text-[#0F1111] sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0F1111] sm:text-5xl">
            Stop texting every client <span style={{ color: GREEN_INK }}>by hand.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-600">
            Confirming, reminding and resending links is a second job. Here is the same week, both ways.
          </Reveal>

          <div className="mt-14 grid gap-5 sm:gap-6 lg:grid-cols-2">
            <Reveal className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-8">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-400">
                <X size={14} aria-hidden /> You, typing each one
              </div>
              <div className="mt-6 flex flex-col items-end gap-2.5">
                {BY_HAND.map((b) => (
                  <div key={b} className="max-w-[85%] rounded-[6px] bg-neutral-100 px-3.5 py-2.5 text-sm text-neutral-600">{b}</div>
                ))}
              </div>
              <p className="mt-6 border-t border-black/5 pt-5 text-sm leading-relaxed text-neutral-500">
                Now repeat that for every client, every week. The one you forget to send is the one who forgets to show up.
              </p>
            </Reveal>

            <Reveal delay={0.06} className="rounded-[10px] bg-[#0F1111] p-6 text-[#F2F5F3] sm:p-8">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: GREEN }}>
                <Check size={14} aria-hidden /> Meeticulous, automatically
              </div>
              <ul className="mt-6 space-y-3">
                {AUTOMATED.map((a) => (
                  <li key={a.t} className="flex items-center gap-3.5 rounded-[6px] border border-white/10 px-4 py-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px]" style={{ background: 'rgba(37,211,102,0.14)', color: GREEN }}><a.icon size={17} aria-hidden /></span>
                    <span className="text-sm font-medium text-[#F2F5F3]">{a.t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-white/10 pt-5 text-sm leading-relaxed text-[#F2F5F3]/65">
                You set up your booking page once. Every message after that sends itself.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (dark numbered cards) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#F2F5F3] sm:text-5xl">
            One booking. <span style={{ color: GREEN }}>Every message after it.</span>
          </Reveal>
          <ol className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.05} className="flex flex-col rounded-[10px] border border-white/10 bg-[#171A1A] p-6 sm:p-7">
                <span className="font-heading text-6xl font-extrabold leading-none tabular-nums text-[#F2F5F3]/10">{String(i + 1).padStart(2, '0')}</span>
                <span className="mt-5 h-1 w-10 rounded-full" style={{ background: GREEN }} aria-hidden />
                <h3 className="mt-5 font-heading text-xl font-bold text-[#F2F5F3]">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#F2F5F3]/65">{s.desc}</p>
              </Reveal>
            ))}
          </ol>
          <Reveal delay={0.1} className="mt-10">
            <ImgSlot slot="notifications-client-phone" alt="A client reading a Meeticulous appointment reminder on WhatsApp" className="aspect-[21/9] w-full" dark />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 5 · CAPABILITIES (light: channel × event matrix) ═══════════════ */}
      <section className="bg-[#F2F5F3] px-5 py-20 text-[#0F1111] sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#0F1111] sm:text-5xl">
            Every event, <span style={{ color: GREEN_INK }}>every channel.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-600">
            What goes out, where it goes, and who gets it.
          </Reveal>

          <Reveal delay={0.08} className="mt-12 overflow-x-auto rounded-[10px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <caption className="sr-only">Which notifications go out on WhatsApp and email, to whom, and on which plan</caption>
              <thead>
                <tr className="border-b border-black/5 text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                  <th scope="col" className="px-5 py-4">Event</th>
                  <th scope="col" className="px-4 py-4"><span className="inline-flex items-center gap-1.5"><MessageCircle size={14} aria-hidden /> WhatsApp</span></th>
                  <th scope="col" className="px-4 py-4"><span className="inline-flex items-center gap-1.5"><Mail size={14} aria-hidden /> Email</span></th>
                  <th scope="col" className="px-4 py-4">Who gets it</th>
                  <th scope="col" className="px-5 py-4">Plan</th>
                </tr>
              </thead>
              <tbody>
                {MATRIX.map((r) => (
                  <tr key={r.event} className="border-b border-black/5 last:border-b-0">
                    <th scope="row" className="px-5 py-4 font-heading font-bold">
                      <span className="flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[5px] bg-[#0F1111] text-[#25D366]"><r.icon size={15} aria-hidden /></span>
                        {r.event}
                      </span>
                    </th>
                    <td className="px-4 py-4"><Cell v={r.wa} /></td>
                    <td className="px-4 py-4"><Cell v={r.email} /></td>
                    <td className="px-4 py-4 text-neutral-600">{r.who}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${r.plan === BOTH ? 'bg-[#15803D]/10 text-[#15803D]' : 'bg-[#0F1111] text-[#F2F5F3]'}`}>{r.plan}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Reveal>
          <p className="mt-4 text-xs leading-relaxed text-neutral-500">
            WhatsApp goes to the phone number your client verified when booking. Email goes to clients who added one.
          </p>

          <div className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
            {EXTRAS.map((c, i) => (
              <Reveal key={c.title} delay={i * 0.05} className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                <span className="flex h-10 w-10 items-center justify-center rounded-[5px] bg-[#0F1111] text-[#25D366]"><c.icon size={18} aria-hidden /></span>
                <h3 className="mt-4 font-heading text-lg font-bold text-[#0F1111]">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{c.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 6 · THE DIFFERENCE (plan toggle lights up messages) ═══════════════ */}
      <section id="plans" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <Reveal as="h2" className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#F2F5F3] sm:text-5xl">
              Flip the plan. <span style={{ color: GREEN }}>See what fires.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#F2F5F3]/70">
              {FREE_PLAN.name} covers the essentials for free. {PREMIUM_PLAN.name} adds the last-call reminder, reschedule alerts and rebook nudges.
            </Reveal>
          </div>
          <PlanToggle />
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (one big quote + two side quotes) ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="border-t border-white/10 bg-[#171A1A] px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal as="figure" className="max-w-4xl">
              <blockquote className="font-heading text-[clamp(1.9rem,4.4vw,3.4rem)] font-extrabold leading-[1.1] tracking-tight text-[#F2F5F3]">
                <span style={{ color: GREEN }}>&ldquo;</span>{QUOTES[0].quote}<span style={{ color: GREEN }}>&rdquo;</span>
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-4">
                <img src={QUOTES[0].avatar} alt="" loading="lazy" className="h-12 w-12 rounded-full object-cover" />
                <div>
                  <div className="font-semibold text-[#F2F5F3]">{QUOTES[0].name}</div>
                  <div className="text-sm text-[#F2F5F3]/55">{QUOTES[0].role}</div>
                </div>
              </figcaption>
            </Reveal>
            {QUOTES.length > 1 && (
              <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-2">
                {QUOTES.slice(1).map((t, i) => (
                  <Reveal as="figure" key={t.name} delay={i * 0.05} className="rounded-[10px] border border-white/10 p-6 sm:p-7">
                    <blockquote className="text-[15px] leading-relaxed text-[#F2F5F3]/85">&ldquo;{t.quote}&rdquo;</blockquote>
                    <figcaption className="mt-5 flex items-center gap-3">
                      <img src={t.avatar} alt="" loading="lazy" className="h-9 w-9 rounded-full object-cover" />
                      <div className="text-sm">
                        <div className="font-semibold text-[#F2F5F3]">{t.name}</div>
                        <div className="text-[#F2F5F3]/55">{t.role}</div>
                      </div>
                    </figcaption>
                  </Reveal>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ═══════════════ 8 · FAQ (dark accordion) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <Reveal as="h2" className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#F2F5F3] sm:text-5xl">
            Reminder questions, <span style={{ color: GREEN }}>answered.</span>
          </Reveal>
          <div className="mt-12 grid gap-3">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group rounded-[6px] border border-white/10 bg-[#171A1A] open:border-white/20" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-start gap-4 px-5 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[5px] font-heading text-[11px] font-extrabold tabular-nums" style={{ background: 'rgba(37,211,102,0.14)', color: GREEN }}>{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 pt-0.5 font-heading text-[16px] font-bold text-[#F2F5F3]">{f.q}</span>
                  <span aria-hidden className="pt-0.5 text-xl leading-none text-[#F2F5F3]/50 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-5 pb-6 pl-16 text-[15px] leading-relaxed text-[#F2F5F3]/70">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · FINAL CTA ═══════════════ */}
      <section className="border-t border-white/10 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl text-center">
          <Reveal as="h2" className="font-heading text-[clamp(2.4rem,6vw,4.4rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.03em] text-[#F2F5F3]">
            Let the reminders <span style={{ color: GREEN }}>chase them.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-[#F2F5F3]/70">
            Set up your booking page free. Confirmations and reminders start with your first booking.
          </Reveal>
          <Reveal delay={0.1} className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <PrimaryCta>Start free <ArrowRight size={16} /></PrimaryCta>
            <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F2F5F3] hover:no-underline hover:opacity-80">
              See pricing <ArrowRight size={15} />
            </Link>
          </Reveal>
          <nav aria-label="Related features" className="mt-14 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-white/10 pt-8 text-sm text-[#F2F5F3]/55">
            <span className="flex items-center gap-1.5"><BellRing size={14} aria-hidden /> Works with</span>
            {RELATED.map((r) => (
              <Link key={r.to} to={r.to} className="text-[#F2F5F3]/80 underline decoration-white/20 underline-offset-4 hover:text-[#F2F5F3] hover:decoration-white">{r.label}</Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
