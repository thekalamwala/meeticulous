// /features/google-calendar — bespoke feature page (Oct feature-page rebuild).
//
// STANDALONE page, not the data-driven FeaturePage template. Its static route
// precedes /features/:slug in App.jsx; the featureData.js "google-calendar" entry
// stays for prerender's slug list and the other pages' "related" cards.
//
// Section order (shared by all bespoke feature pages, each its own design):
//   1 Hero + live demo · 2 Proof strip · 3 Without vs with · 4 How it works ·
//   5 Capabilities · 6 The difference · 7 Testimonials · 8 FAQ · 9 Final CTA
//
// Design system "Google-white": white + light grey surfaces, charcoal ink, and the
// four calendar hues used ONLY as dots, bars and event chips (blue #1A73E8 is the
// one AA-safe text accent). No Google logo or wordmark artwork, no implied
// endorsement; "Google Calendar" appears in text only. Mechanics unique to this
// page: two-calendar sync demo (hero) · four-dot fact strip · double-booking
// scenario diagram · step-through connect flow with a generic consent mock ·
// two-column dot list · "what syncs which way" matrix · minimal quote cards ·
// dot-marker accordion FAQ.
//
// HONESTY (verified in server/ on 2026-10-07):
//   • busy times: calendar.freebusy on the host's PRIMARY calendar only
//     (config/google.js getFreeBusy), re-checked live at booking time
//     (availabilityService.validateSlot, useCache:false); fail-open with a guest
//     notice when Google can't be reached (ServiceBooking calendarUnverified).
//   • events + Meet: created for ONLINE services only (meeting_mode !== 'offline'),
//     paid bookings after payment (bookingConfirmation.js), guest added as an
//     attendee when they gave an email, sendUpdates:'all'.
//   • reschedule → events.patch (same Meet link); cancel → events.delete.
//   • one-way only: editing/deleting the event in Google does NOT change the booking.
//   • scopes: calendar.events, calendar.freebusy, calendar.settings.readonly
//     (timezone), openid/email/profile. No Gmail/Drive/Contacts.
//   • no in-app disconnect: revoke in Google Account settings or ask support.
//   • "2 calendar integrations" (plans.js) is NOT used: limits.calendar_integrations
//     is not enforced anywhere and no second integration exists yet.
//
// IMAGES: empty ImgSlot placeholders (data-img-slot names the photo to supply).
// Global Navbar + Footer come from App.jsx. No hover uplift anywhere.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, Plus, RotateCcw, Video, ChevronDown, ImageIcon, Lock, Minus,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN } from '../../data/plans';
import { TESTIMONIALS as ALL_TESTIMONIALS } from '../../data/testimonials';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';

// The four calendar hues: dots, bars and chips only, never body text.
const BLUE = '#4285F4';
const RED = '#EA4335';
const YELLOW = '#FBBC05';
const GREEN = '#34A853';
const HUES = [BLUE, RED, YELLOW, GREEN];
// Text-safe tokens (AA on white and on SURFACE).
const LINK = '#1A73E8';   // the one accent for text, links and the CTA fill
const INK = '#202124';
const MUTED = '#5F6368';
const SURFACE = '#F8F9FA';

/* ─────────────────────────────  DEMO MODEL  ────────────────────────────── */

export const DEMO_HOURS = [10, 11, 12, 13, 14, 15, 16];
export const DEMO_START = {
  11: { title: 'Team stand-up', kind: 'google' },
  14: { title: 'Discovery call, Priya', kind: 'booking' },
};
const QUEUE = {
  google: [[13, 'Lunch with Ma'], [16, 'Dentist'], [10, 'Project review'], [12, 'Gym'], [15, 'School pickup']],
  booking: [[15, 'Strategy session, Aarav'], [12, 'Follow-up, Neha'], [10, 'Intro call, Sam'], [16, 'Mock interview, Ria'], [13, 'Review call, Dev']],
};
export const hourLabel = (h) => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;

/** Put the next queued event of `kind` into the first free hour, or null if the day is full. */
export function addToDay(events, kind) {
  const next = QUEUE[kind].find(([h]) => !events[h]);
  if (!next) return null;
  const [hour, title] = next;
  return { events: { ...events, [hour]: { title, kind } }, hour, title };
}

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const HERO_TRUST = [
  `Included on ${FREE_PLAN.name}, the free plan`,
  'We read busy times, not event details',
  'No Gmail or Drive access',
];

const PROOF = [
  { dot: BLUE, k: 'Reads', v: 'Busy times from your primary Google Calendar' },
  { dot: RED, k: 'Re-checks', v: 'Your calendar live, at the moment someone books' },
  { dot: YELLOW, k: 'Writes', v: 'Each online booking as an event, with a Meet link' },
  { dot: GREEN, k: 'Costs', v: `Nothing extra. Google Calendar & Meet are on ${FREE_PLAN.name}` },
];

const WITHOUT = [
  { lane: 'Google Calendar', text: 'Dentist, Thursday 4 PM' },
  { lane: 'Booking page', text: 'Thursday 4 PM still shows as open' },
  { lane: 'Your client', text: 'Books Thursday 4 PM' },
];
const WITH = [
  { lane: 'Google Calendar', text: 'Dentist, Thursday 4 PM' },
  { lane: 'Booking page', text: 'Thursday 4 PM is not offered' },
  { lane: 'Your client', text: 'Books Thursday 5 PM instead' },
];

const STEPS = [
  { title: 'Sign in with Google', desc: 'Create your host account with Google. Calendar access is asked for on that same screen, so there is no separate setup step.' },
  { title: 'Approve calendar access', desc: 'Google lists exactly what Meeticulous may do: manage calendar events, see when you are free or busy, and read your calendar timezone. Nothing from Gmail, Drive or your contacts.' },
  { title: 'You are synced', desc: 'Your timezone is picked up from your calendar, busy time starts hiding slots on your page, and online bookings land on your calendar with a Google Meet link.' },
];

const CAPS = [
  { title: 'Busy time hides your slots', body: 'Anything on your primary Google Calendar removes that time from your booking page, on top of your weekly hours.' },
  { title: 'A live check at booking', body: 'When a client confirms, your calendar is checked again in real time, not from an old copy.' },
  { title: 'Bookings land on your calendar', body: 'Every online booking becomes a Google Calendar event, and your client is invited when they share an email.' },
  { title: 'A Google Meet link, created for you', body: 'The link is made with the event and saved on the booking, so it shows up for you, your client and in reminders.' },
  { title: 'Reschedules move the event', body: 'Same event, same Meet link, new time. Everyone on the invite gets the update from Google.' },
  { title: 'Cancellations clear it', body: 'A cancelled booking removes its event, so no ghost call is left on anyone’s calendar.' },
  { title: 'No events for abandoned checkouts', body: 'For paid sessions the event is created after the payment goes through, never for someone who left at checkout.' },
  { title: 'Your client can save it too', body: 'The confirmation screen offers Add to Google Calendar and an .ics download for Apple, Outlook or any other calendar.' },
  { title: 'Keeps working if Google is slow', body: 'If your calendar cannot be reached, your page still takes bookings and tells the client the times may need confirming.' },
  { title: 'Told if the connection breaks', body: 'If Google access stops working, your dashboard asks you to reconnect, instead of failing quietly.' },
];

const MATRIX = [
  {
    row: 'Busy times',
    g2b: { on: true, text: 'Events on your primary calendar hide those slots.' },
    b2g: { na: true, text: 'Not needed. Your page already knows its own bookings.' },
  },
  {
    row: 'New bookings',
    g2b: { on: false, text: 'An event added in Google blocks the time. It does not become a booking.' },
    b2g: { on: true, text: 'Each online booking becomes an event, with your client invited.' },
  },
  {
    row: 'Google Meet links',
    g2b: { na: true, text: 'Not applicable.' },
    b2g: { on: true, text: 'Created with the event and saved on the booking.' },
  },
  {
    row: 'Reschedules',
    g2b: { on: false, text: 'Moving the event in Google does not move the booking.' },
    b2g: { on: true, text: 'The event moves to the new time and keeps its Meet link.' },
  },
  {
    row: 'Cancellations',
    g2b: { on: false, text: 'Deleting the event in Google does not cancel the booking.' },
    b2g: { on: true, text: 'The event is removed and everyone on the invite is told.' },
  },
];

const PICKED = ['Mukesh Tidke', 'Sangharata Somkuvar', 'Vishal Chaware', 'Tushar Malvi'];
const QUOTES = PICKED.map((n) => ALL_TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);

const FAQ = [
  { q: 'Do I need Google Workspace?', a: 'No. Any Google account with Google Calendar works, including a free Gmail account.' },
  { q: 'Which calendar does Meeticulous check?', a: 'Your primary Google Calendar. Events on other calendars in your account are not checked, so keep anything that should block bookings on your primary calendar.' },
  { q: 'Can Meeticulous see what my events are about?', a: 'To find your free time we only ask Google for busy blocks, not titles, descriptions or guest lists. The permissions are to manage calendar events (so we can add, move and remove booking events), see free and busy times, and read your calendar timezone. We never ask for Gmail, Drive or contacts.' },
  { q: 'Do in-person bookings show up on my Google Calendar?', a: 'No. Calendar events and Meet links are created for online services only. In-person bookings are in your dashboard, and your client can still add theirs to any calendar from the confirmation screen.' },
  { q: 'What if I move or delete the event in Google Calendar?', a: 'The booking does not change. To reschedule or cancel, do it in Meeticulous and the Google event follows, with your client notified.' },
  { q: 'How do I connect it?', a: 'Signing up with Google connects your calendar on the same consent screen. If it is not connected, or the connection breaks, use Connect Google Calendar in your dashboard.' },
  { q: 'How do I disconnect it?', a: 'Remove Meeticulous’s access in your Google Account settings, or ask our support team. Your past bookings stay in your dashboard.' },
  { q: 'What happens if Google Calendar is down?', a: 'Your booking page keeps working. If we cannot reach your calendar, your client sees a short note that the times may need confirming.' },
  { q: 'Does it cost extra?', a: `No. Google Calendar sync and Meet links are included on ${FREE_PLAN.name}, the free plan, and on ${PREMIUM_PLAN.name}.` },
];

const RELATED = [
  { to: '/features/availability', label: 'Availability' },
  { to: '/features/online-scheduling', label: 'Online scheduling' },
  { to: '/features/notifications', label: 'Reminders' },
  { to: '/features/booking-pages', label: 'Booking pages' },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function Dot({ color, size = 8, className = '' }) {
  return <span aria-hidden className={`inline-block shrink-0 rounded-full ${className}`} style={{ width: size, height: size, background: color }} />;
}

function FourDots({ size = 7 }) {
  return (
    <span aria-hidden className="inline-flex items-center gap-1">
      {HUES.map((c) => <Dot key={c} color={c} size={size} />)}
    </span>
  );
}

function Eyebrow({ children }) {
  return (
    <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>
      <FourDots /> {children}
    </div>
  );
}

function PrimaryCta({ to = START, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(26,115,232,0.22)] transition-opacity hover:no-underline hover:opacity-90"
      style={{ background: LINK }}
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
      style={{ background: 'repeating-linear-gradient(135deg, rgba(32,33,36,0.03) 0 10px, rgba(32,33,36,0.06) 10px 20px)' }}
    >
      <ImageIcon size={28} style={{ color: 'rgba(32,33,36,0.3)' }} aria-hidden />
    </div>
  );
}

/* Hero demo — two calendars side by side, kept in step. */
const SCRIPT = ['google', 'booking', 'google', 'booking', 'reset'];

function SyncDemo() {
  const reduce = useReducedMotion();
  const [events, setEvents] = useState(DEMO_START);
  const [last, setLast] = useState(null);
  const [msg, setMsg] = useState('');
  const [tick, setTick] = useState(0);
  const [paused, setPaused] = useState(false);

  const run = (kind) => {
    if (kind === 'reset') {
      setEvents(DEMO_START); setLast(null); setMsg('Day reset to the starting calendar.');
      return;
    }
    const r = addToDay(events, kind);
    if (!r) { setMsg('The day is full. Reset to start again.'); return; }
    setEvents(r.events); setLast(r.hour);
    setMsg(kind === 'google'
      ? `"${r.title}" added in Google Calendar. ${hourLabel(r.hour)} is now unavailable on your page.`
      : `${r.title} booked ${hourLabel(r.hour)} on your page. It is now on your Google Calendar with a Meet link.`);
  };

  useEffect(() => {
    if (reduce || paused) return undefined;
    const id = setTimeout(() => { run(SCRIPT[tick % SCRIPT.length]); setTick((t) => t + 1); }, 2800);
    return () => clearTimeout(id);
    // run reads the current `events`; the effect re-arms on every tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, reduce, paused]);

  const click = (kind) => { setPaused(true); run(kind); };
  const full = (kind) => !QUEUE[kind].some(([h]) => !events[h]);
  const pop = reduce ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.3 } };

  return (
    <div className="mx-auto w-full max-w-[34rem]">
      <div className="overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_24px_60px_-28px_rgba(32,33,36,0.28)]">
        <div className="grid grid-cols-2 border-b border-black/5 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: MUTED }}>
          <div className="flex items-center gap-2 px-3 py-3 sm:px-4"><Dot color={BLUE} size={7} /> Your Google Calendar</div>
          <div className="flex items-center gap-2 border-l border-black/5 px-3 py-3 sm:px-4"><Dot color={GREEN} size={7} /> Your Meeticulous page</div>
        </div>
        <div className="px-3 pt-2 text-[11px] sm:px-4" style={{ color: MUTED }}>Thursday</div>
        <ul className="px-3 pb-3 pt-1 sm:px-4">
          {DEMO_HOURS.map((h) => {
            const ev = events[h];
            const fresh = last === h;
            return (
              <li key={h} className="grid grid-cols-2 gap-3 border-t border-black/[0.04] py-1.5 first:border-t-0">
                {/* Google side */}
                <div className="flex min-h-[2.4rem] items-stretch gap-2">
                  <span className="w-9 shrink-0 pt-1 text-[10px] tabular-nums" style={{ color: MUTED }}>{hourLabel(h)}</span>
                  <AnimatePresence initial={false}>
                    {ev && (
                      <motion.div
                        key={`${h}-${ev.title}`}
                        {...pop}
                        className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-[5px] px-2 py-1 ${fresh ? 'ring-1 ring-black/10' : ''}`}
                        style={{ background: ev.kind === 'booking' ? '#E8F0FE' : '#FEF7E0' }}
                      >
                        <span aria-hidden className="h-full w-[3px] shrink-0 rounded-full" style={{ background: ev.kind === 'booking' ? BLUE : YELLOW }} />
                        <span className="min-w-0">
                          <span className="block truncate text-[11px] font-semibold" style={{ color: INK }}>{ev.title}</span>
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: MUTED }}>
                            {ev.kind === 'booking' ? (<><Video size={10} aria-hidden /> Meet link</>) : 'Busy'}
                          </span>
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                {/* Meeticulous side */}
                <div className="flex items-center">
                  {!ev && (
                    <span className="flex w-full items-center justify-between rounded-[5px] border border-black/10 px-2 py-1.5 text-[11px] font-semibold" style={{ color: INK }}>
                      {hourLabel(h)} <span className="flex items-center gap-1 font-medium" style={{ color: MUTED }}><Dot color={GREEN} size={6} /> Open</span>
                    </span>
                  )}
                  {ev && (
                    <span className={`flex w-full items-center justify-between rounded-[5px] px-2 py-1.5 text-[11px] ${fresh ? 'ring-1 ring-black/10' : ''}`} style={{ background: SURFACE, color: MUTED }}>
                      <span className="line-through">{hourLabel(h)}</span>
                      <span className="flex items-center gap-1">
                        <Dot color={ev.kind === 'booking' ? BLUE : RED} size={6} /> {ev.kind === 'booking' ? 'Booked' : 'Unavailable'}
                      </span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        <p role="status" aria-live="polite" className="min-h-[2.75rem] border-t border-black/5 px-4 py-2.5 text-[12px] leading-snug" style={{ color: MUTED }}>
          {msg || 'Events on your calendar block the same time on your page.'}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => click('google')} disabled={full('google')} className="inline-flex items-center gap-1.5 rounded-[6px] border border-black/10 bg-white px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-[#F1F3F4] disabled:opacity-40" style={{ color: INK }}>
          <Dot color={YELLOW} size={7} /> <Plus size={13} aria-hidden /> Add a meeting in Google
        </button>
        <button type="button" onClick={() => click('booking')} disabled={full('booking')} className="inline-flex items-center gap-1.5 rounded-[6px] border border-black/10 bg-white px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-[#F1F3F4] disabled:opacity-40" style={{ color: INK }}>
          <Dot color={BLUE} size={7} /> <Plus size={13} aria-hidden /> Client books on Meeticulous
        </button>
        <button type="button" onClick={() => click('reset')} className="inline-flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-xs font-semibold transition-colors hover:bg-[#F1F3F4]" style={{ color: MUTED }}>
          <RotateCcw size={13} aria-hidden /> Reset
        </button>
      </div>
      <p className="mt-3 text-center text-[11px]" style={{ color: MUTED }}>Illustration of the calendar sync. Names and times are examples.</p>
    </div>
  );
}

/* Without vs with — the same Thursday, drawn as a three-lane scenario. */
function Scenario({ title, steps, good }) {
  return (
    <div className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-7">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>
        <Dot color={good ? GREEN : RED} /> {title}
      </div>
      <ol className="relative mt-6">
        <span aria-hidden className="absolute bottom-6 left-[5px] top-2 w-px bg-black/10" />
        {steps.map((s, i) => (
          <li key={s.lane} className="relative grid grid-cols-[1.5rem_1fr] pb-5">
            <span aria-hidden className="mt-1.5 h-[11px] w-[11px] rounded-full ring-4 ring-white" style={{ background: i === 0 ? YELLOW : i === 1 ? (good ? GREEN : RED) : BLUE }} />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: MUTED }}>{s.lane}</div>
              <div className="mt-0.5 font-heading text-[15px] font-bold" style={{ color: INK }}>{s.text}</div>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-1 flex items-start gap-2.5 rounded-[6px] px-4 py-3 text-sm leading-relaxed" style={{ background: good ? '#E6F4EA' : '#FCE8E6', color: INK }}>
        {good ? <Check size={16} className="mt-0.5 shrink-0" aria-hidden /> : <Minus size={16} className="mt-0.5 shrink-0" aria-hidden />}
        <span>
          {good
            ? 'No clash. The 5 PM booking lands on your Google Calendar with a Meet link.'
            : 'Two places at 4 PM. Now you message the client to rebook, and maybe refund.'}
        </span>
      </div>
    </div>
  );
}

/* How it works — step through the connect flow; the mock is generic, not Google's UI. */
const SCOPES_PLAIN = [
  { dot: BLUE, t: 'View and edit events on your calendars', why: 'to add, move and remove booking events' },
  { dot: GREEN, t: 'See when you are free or busy', why: 'to hide busy slots from your page' },
  { dot: YELLOW, t: 'See your calendar settings', why: 'to set your timezone' },
  { dot: RED, t: 'See your name, email and photo', why: 'to sign you in' },
];

function ConnectFlow() {
  const [step, setStep] = useState(0);
  return (
    <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1fr] lg:gap-16">
      <ol className="space-y-3">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              aria-pressed={step === i}
              onClick={() => setStep(i)}
              className={`flex w-full items-start gap-4 rounded-[6px] border p-5 text-left transition-colors ${step === i ? 'border-black/10 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.05)]' : 'border-transparent hover:bg-white/70'}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-heading text-sm font-extrabold text-white" style={{ background: step === i ? LINK : '#9AA0A6' }}>{i + 1}</span>
              <span>
                <span className="block font-heading text-lg font-bold" style={{ color: INK }}>{s.title}</span>
                <span className="mt-1 block text-[15px] leading-relaxed" style={{ color: MUTED }}>{s.desc}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>

      <div className="lg:pt-2">
        <div className="mx-auto max-w-sm overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_24px_60px_-28px_rgba(32,33,36,0.28)]" aria-live="polite">
          <div className="flex items-center gap-2 border-b border-black/5 px-5 py-3 text-xs" style={{ color: MUTED }}>
            <Lock size={12} aria-hidden /> {step === 2 ? 'Meeticulous dashboard' : 'Sign-in with your Google account'}
          </div>
          <div className="min-h-[19rem] px-5 py-6">
            {step === 0 && (
              <div className="text-center">
                <FourDots size={9} />
                <div className="mt-4 font-heading text-xl font-bold" style={{ color: INK }}>Become a host</div>
                <p className="mt-1 text-sm" style={{ color: MUTED }}>One Google sign-in sets up your account and your calendar.</p>
                <div className="mt-6 rounded-[6px] border border-black/10 py-2.5 text-sm font-semibold" style={{ color: INK }}>Continue with Google</div>
                <p className="mt-4 text-xs" style={{ color: MUTED }}>Hosts sign in with Google only. No password to remember.</p>
              </div>
            )}
            {step === 1 && (
              <div>
                <div className="font-heading text-base font-bold" style={{ color: INK }}>Meeticulous wants to</div>
                <ul className="mt-4 space-y-3.5">
                  {SCOPES_PLAIN.map((s) => (
                    <li key={s.t} className="flex items-start gap-3">
                      <Dot color={s.dot} className="mt-1.5" />
                      <span className="text-sm leading-snug" style={{ color: INK }}>
                        {s.t}
                        <span className="block text-xs" style={{ color: MUTED }}>Used {s.why}</span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 border-t border-black/5 pt-3 text-xs" style={{ color: MUTED }}>Not requested: Gmail, Drive or contacts.</div>
              </div>
            )}
            {step === 2 && (
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-heading text-base font-bold" style={{ color: INK }}>Google Calendar</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: '#E6F4EA', color: '#137333' }}>
                    <Dot color={GREEN} size={6} /> Connected
                  </span>
                </div>
                <dl className="mt-5 space-y-3 text-sm">
                  {[
                    ['Timezone', 'Taken from your calendar'],
                    ['Busy times', 'Primary calendar, hiding slots'],
                    ['Online bookings', 'Added with a Meet link'],
                    ['Reschedules and cancels', 'Kept in step'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-black/5 pb-3 last:border-b-0">
                      <dt style={{ color: MUTED }}>{k}</dt><dd className="text-right font-medium" style={{ color: INK }}>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
        </div>
        <p className="mt-3 text-center text-[11px]" style={{ color: MUTED }}>Simplified illustration. Google shows its own consent screen.</p>
      </div>
    </div>
  );
}

function Cell({ c, label }) {
  return (
    <div className="flex items-start gap-2.5">
      {c.na
        ? <span aria-hidden className="mt-1.5 inline-block h-[2px] w-2 shrink-0 bg-black/20" />
        : <Dot color={c.on ? GREEN : RED} className="mt-1.5" />}
      <span className="text-sm leading-relaxed">
        <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-[0.12em] md:hidden" style={{ color: MUTED }}>{label}</span>
        <span className="font-semibold" style={{ color: INK }}>{c.na ? 'n/a.' : c.on ? 'Yes.' : 'No.'}</span>{' '}
        <span style={{ color: MUTED }}>{c.text}</span>
      </span>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function GoogleCalendarFeature() {
  const canonical = `${SITE_URL}/features/google-calendar`;
  const seo = {
    title: 'Google Calendar Appointment Scheduler & Sync | Meeticulous',
    description: 'Sync Google Calendar with your booking page. Busy times block your slots, online bookings land on your calendar with a Meet link, and reschedules update the event. Start free.',
  };
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'Google Calendar Sync',
    serviceType: 'Google Calendar appointment scheduling and calendar sync',
    image: ogCard('features-google-calendar'),
    steps: STEPS.map((s) => ({ title: s.title, desc: s.desc })),
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  return (
    <main className="overflow-x-clip bg-white" style={{ color: INK }}>
      <Seo
        title={seo.title}
        description={seo.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor="#FFFFFF"
        ogTitle="Sync Google Calendar with your booking page."
        ogDescription={seo.description}
        image={ogCard('features-google-calendar')}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · HERO (two-calendar sync demo) ═══════════════ */}
      <section
        className="relative px-5 pb-20 pt-8 sm:px-8 lg:pb-28 lg:pt-6 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center"
        style={{ backgroundImage: 'radial-gradient(rgba(32,33,36,0.07) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
      >
        <div className="relative mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:gap-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs" style={{ color: MUTED }}>
              <Link to="/" className="hover:no-underline hover:opacity-80" style={{ color: MUTED }}>Home</Link>
              <span aria-hidden className="mx-2">/</span>
              <span>Features</span>
              <span aria-hidden className="mx-2">/</span>
              <span aria-current="page" style={{ color: INK }}>Google Calendar</span>
            </nav>
            <Reveal instant className="mt-5"><Eyebrow>Google Calendar appointment scheduler &amp; sync</Eyebrow></Reveal>
            <Reveal as="h1" instant className="mt-4 font-heading text-[clamp(2.1rem,3.7vw,3.2rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#202124]">
              Google Calendar sync for <span style={{ color: LINK }}>your booking page.</span>
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mt-4 max-w-xl text-base leading-relaxed lg:text-[17px]" style={{ color: MUTED }}>
              Your busy times hide the slots you can&rsquo;t take. Every online booking lands in your calendar with a Google Meet link, and moves when you reschedule.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta>Connect your calendar free <ArrowRight size={16} /></PrimaryCta>
              <a href="#sync" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:no-underline hover:opacity-80" style={{ color: LINK }}>
                What syncs which way <ArrowRight size={15} />
              </a>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {HERO_TRUST.map((t, i) => (
                <span key={t} className="flex items-center gap-2 text-[13px]" style={{ color: MUTED }}>
                  <Dot color={HUES[i]} size={7} /> {t}
                </span>
              ))}
            </Reveal>
          </div>
          <Reveal instant delay={0.12}>
            <SyncDemo />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 2 · PROOF STRIP (four facts, four dots) ═══════════════ */}
      <section className="border-y border-black/5 px-5 sm:px-8" style={{ background: SURFACE }}>
        <div className="mx-auto grid max-w-6xl sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map((p) => (
            <div key={p.k} className="flex items-start gap-3 py-7 sm:px-5">
              <Dot color={p.dot} size={12} className="mt-1" />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>{p.k}</div>
                <div className="mt-1 font-heading text-[15px] font-bold leading-snug">{p.v}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ 3 · WITHOUT vs WITH (double-booking scenario) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-5xl">
          <Reveal><Eyebrow>Without vs with</Eyebrow></Reveal>
          <Reveal as="h2" className="mt-4 max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Two calendars is how you <span style={{ color: LINK }}>get double-booked.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed" style={{ color: MUTED }}>
            A dentist appointment goes on your Google Calendar. Your booking page has no idea. Here is the same Thursday, both ways.
          </Reveal>
          <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-2">
            <Reveal><Scenario title="Booking page not synced" steps={WITHOUT} /></Reveal>
            <Reveal delay={0.06}><Scenario title="Synced with Meeticulous" steps={WITH} good /></Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (connect flow + consent mock) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: SURFACE }}>
        <div className="mx-auto max-w-6xl">
          <Reveal><Eyebrow>How it works</Eyebrow></Reveal>
          <Reveal as="h2" className="mt-4 max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Connected the moment <span style={{ color: LINK }}>you sign up.</span>
          </Reveal>
          <ConnectFlow />
        </div>
      </section>

      {/* ═══════════════ 5 · CAPABILITIES (two-column dot list) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-end">
            <div>
              <Reveal><Eyebrow>What it does</Eyebrow></Reveal>
              <Reveal as="h2" className="mt-4 font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
                Your calendar, <span style={{ color: LINK }}>kept honest.</span>
              </Reveal>
            </div>
            <Reveal delay={0.05}>
              <ImgSlot slot="google-calendar-booking-event" alt="A Meeticulous booking open in Google Calendar, showing the client as a guest and a Google Meet link" className="aspect-[16/9] w-full" />
            </Reveal>
          </div>
          <ul className="mt-14 grid gap-x-12 md:grid-cols-2">
            {CAPS.map((c, i) => (
              <Reveal as="li" key={c.title} delay={(i % 2) * 0.04} className="flex items-start gap-4 border-t border-black/5 py-6">
                <Dot color={HUES[i % 4]} size={10} className="mt-2" />
                <div>
                  <h3 className="font-heading text-lg font-bold">{c.title}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed" style={{ color: MUTED }}>{c.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══════════════ 6 · THE DIFFERENCE (what syncs which way) ═══════════════ */}
      <section id="sync" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28" style={{ background: SURFACE }}>
        <div className="mx-auto max-w-5xl">
          <Reveal><Eyebrow>The difference</Eyebrow></Reveal>
          <Reveal as="h2" className="mt-4 max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            What syncs <span style={{ color: LINK }}>which way.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed" style={{ color: MUTED }}>
            No fuzzy &ldquo;two-way sync&rdquo; promise. This is exactly what moves between Google Calendar and your bookings.
          </Reveal>

          <Reveal delay={0.08} className="mt-12 overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
            <div className="hidden grid-cols-[0.8fr_1.1fr_1.1fr] gap-8 border-b border-black/5 px-6 py-4 text-[11px] font-bold uppercase tracking-[0.14em] md:grid" style={{ color: MUTED }}>
              <span />
              <span className="flex items-center gap-2"><Dot color={BLUE} size={7} /> Google Calendar &rarr; Meeticulous</span>
              <span className="flex items-center gap-2"><Dot color={GREEN} size={7} /> Meeticulous &rarr; Google Calendar</span>
            </div>
            {MATRIX.map((r) => (
              <div key={r.row} className="grid gap-4 border-b border-black/5 px-6 py-5 last:border-b-0 md:grid-cols-[0.8fr_1.1fr_1.1fr] md:gap-8">
                <h3 className="font-heading text-base font-bold">{r.row}</h3>
                <Cell c={r.g2b} label="Google Calendar to Meeticulous" />
                <Cell c={r.b2g} label="Meeticulous to Google Calendar" />
              </div>
            ))}
          </Reveal>
          <p className="mt-5 flex items-start gap-2 text-sm" style={{ color: MUTED }}>
            <Dot color={YELLOW} className="mt-1.5" />
            <span>Events and Meet links are created for online services. In-person bookings stay in your dashboard, and busy time on Google still blocks in-person slots too.</span>
          </p>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (minimal quote cards) ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal><Eyebrow>From hosts</Eyebrow></Reveal>
            <Reveal as="h2" className="mt-4 max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              Less &ldquo;are you free at 4?&rdquo; <span style={{ color: LINK }}>More booked time.</span>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
              {QUOTES.map((t, i) => (
                <Reveal as="figure" key={t.name} delay={i * 0.05} className="flex flex-col justify-between rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                  <div>
                    <Dot color={HUES[i % 4]} size={10} />
                    <blockquote className="mt-4 text-[15px] leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
                  </div>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-black/5 pt-4">
                    <img src={t.avatar} alt="" loading="lazy" className="h-9 w-9 rounded-full object-cover" />
                    <div>
                      <div className="text-sm font-semibold">{t.name}</div>
                      <div className="text-xs" style={{ color: MUTED }}>{t.role}</div>
                    </div>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ 8 · FAQ (accordion, coloured-dot markers) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="border-t border-black/5 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <Reveal><Eyebrow>FAQ</Eyebrow></Reveal>
          <Reveal as="h2" className="mt-4 font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Calendar questions, <span style={{ color: LINK }}>answered.</span>
          </Reveal>
          <div className="mt-12 space-y-3">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group rounded-[6px] border border-black/5 bg-white open:shadow-[0_8px_30px_rgba(26,26,26,0.05)]" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
                  <Dot color={HUES[i % 4]} size={9} />
                  <span className="flex-1 font-heading text-[16px] font-bold">{f.q}</span>
                  <ChevronDown size={18} aria-hidden className="shrink-0 transition-transform group-open:rotate-180" style={{ color: MUTED }} />
                </summary>
                <p className="px-5 pb-5 pl-[3.1rem] text-[15px] leading-relaxed" style={{ color: MUTED }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · FINAL CTA ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: SURFACE }}>
        <div className="mx-auto max-w-4xl text-center">
          <div aria-hidden className="mx-auto flex w-40 overflow-hidden rounded-full">
            {HUES.map((c) => <span key={c} className="h-1.5 flex-1" style={{ background: c }} />)}
          </div>
          <Reveal as="h2" className="mt-10 font-heading text-[clamp(2.3rem,5.5vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">
            Let your calendar do <span style={{ color: LINK }}>the blocking.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mx-auto mt-6 max-w-xl text-base leading-relaxed" style={{ color: MUTED }}>
            Sign up with Google, and your booking page starts respecting your calendar from the first booking. Free on {FREE_PLAN.name}.
          </Reveal>
          <Reveal delay={0.1} className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <PrimaryCta>Connect your calendar free <ArrowRight size={16} /></PrimaryCta>
            <Link to="/contact" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:no-underline hover:opacity-80" style={{ color: LINK }}>
              See a live booking page <ArrowRight size={15} />
            </Link>
            <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:no-underline hover:opacity-80" style={{ color: INK }}>
              See pricing <ArrowRight size={15} />
            </Link>
          </Reveal>
          <nav aria-label="Related features" className="mt-14 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-black/5 pt-8 text-sm" style={{ color: MUTED }}>
            <span>Works with</span>
            {RELATED.map((r) => (
              <Link key={r.to} to={r.to} className="underline decoration-black/20 underline-offset-4 hover:decoration-black/60" style={{ color: LINK }}>{r.label}</Link>
            ))}
          </nav>
          <p className="mx-auto mt-8 max-w-xl text-[11px] leading-relaxed" style={{ color: MUTED }}>
            Google Calendar and Google Meet are trademarks of Google LLC. Meeticulous is not affiliated with or endorsed by Google.
          </p>
        </div>
      </section>
    </main>
  );
}
