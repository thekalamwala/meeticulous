// /features/availability — bespoke feature page (Oct feature-page rebuild).
//
// STANDALONE page, not the data-driven FeaturePage template. Its static route
// precedes /features/:slug in App.jsx; the featureData.js "availability" entry
// stays for prerender's slug list and the other pages' "related" cards.
//
// Section order (shared by all 10 bespoke feature pages, each its own design):
//   1 Hero + live demo · 2 Proof strip · 3 Without vs with · 4 How it works ·
//   5 Capabilities · 6 The difference · 7 Testimonials · 8 FAQ · 9 Final CTA
//
// Design system H "Light + Lime": white page, a lime highlighter band behind key
// words (ink text ON lime, never lime text on white), one deep-teal accent.
// Mechanics unique to this page: clickable weekly hours grid (hero) · one
// highlighted proof sentence · messy-week vs clean-week visual · vertical steps
// with lime number markers · checklist beside a tall image · duration + buffer
// "how many slots fit" control · horizontally scrolling testimonial cards ·
// accordion FAQ whose open item gets a lime bar.
//
// HONESTY: every claim maps to code. Weekly windows, blocked dates, timezone and
// buffer_minutes (0/5/10/15/30/60) live in pages/Availability.jsx + PUT
// /api/host/availability; slot math, Google FreeBusy blocking and the Mon–Sat
// 10:00–18:00 default live in server/services/availabilityService.js. The DB
// exclusion constraint (migration v2.5) refuses overlapping bookings. NOT claimed
// (not in code): minimum notice, max bookings per day, per-service hours,
// converting slots to the guest's local time (guests see the HOST's zone, labelled).
//
// IMAGES: empty ImgSlot placeholders (data-img-slot names the photo to supply).
// Global Navbar + Footer come from App.jsx. No hover uplift anywhere.

import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, X, ImageIcon, CalendarDays } from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN } from '../../data/plans';
import { TESTIMONIALS as ALL_TESTIMONIALS } from '../../data/testimonials';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';
const INK = '#2A1416';
const LIME = '#D9F99D';      // highlighter band, always under ink text
const LIME_DEEP = '#BEF264'; // markers, open cells, the FAQ bar
const TEAL = '#0F766E';      // accent text/icons on white (AA, ~5.5:1)
const LIME_WASH = '#F7FEE7'; // soft section tint

/* ─────────────────────────────  SLOT MATH  ────────────────────────────── */

/**
 * How many slots fit in one window. Mirrors computeSlots() in
 * server/services/availabilityService.js: a slot starts every
 * (duration + buffer) minutes and must END inside the window.
 */
export function slotStarts(duration, buffer, windowMin = 480) {
  const starts = [];
  for (let cur = 0; cur + duration <= windowMin; cur += duration + buffer) starts.push(cur);
  return starts;
}

/* Hero grid: 7 days × 4 two-hour blocks, each open block = two one-hour slots. */
const DAYS = [
  ['Mon', 'Monday'], ['Tue', 'Tuesday'], ['Wed', 'Wednesday'], ['Thu', 'Thursday'],
  ['Fri', 'Friday'], ['Sat', 'Saturday'], ['Sun', 'Sunday'],
];
const BLOCKS = ['9 AM', '11 AM', '2 PM', '4 PM'];
const SLOTS_PER_BLOCK = 2;
const INITIAL_GRID = DAYS.map((_, d) => BLOCKS.map((_, b) => d < 5 || (d === 5 && b < 2)));

export const countWeekSlots = (grid) => grid.flat().filter(Boolean).length * SLOTS_PER_BLOCK;

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const HERO_TRUST = [`Included on ${FREE_PLAN.name}, ₹0`, 'Repeats every week', 'Respects your Google Calendar'];

const WITHOUT = [
  'Typing "I am free Tuesday after 3" into every chat',
  'A holiday you forgot to mention gets booked anyway',
  'Calls back to back with no time to reset',
  'A personal plan and a client call on the same hour',
];
const WITH = [
  'Weekly hours that repeat on their own',
  'Blocked dates that simply cannot be booked',
  'A buffer you choose after every booking',
  'Busy time on your connected Google Calendar stays off your page',
];

/* Messy week: overlapping, half-remembered blocks. top/h are % of the day column. */
const MESSY = [
  { d: 0, top: 6, h: 26, x: 0, label: 'Call?' },
  { d: 0, top: 22, h: 22, x: 22, label: 'Gym' },
  { d: 1, top: 30, h: 30, x: 0, label: 'DM: free at 4?' },
  { d: 1, top: 44, h: 24, x: 20, label: 'Client' },
  { d: 2, top: 10, h: 40, x: 8, label: 'Holiday??' },
  { d: 3, top: 52, h: 22, x: 0, label: 'Client' },
  { d: 3, top: 58, h: 22, x: 24, label: 'Client', clash: true },
  { d: 4, top: 16, h: 18, x: 12, label: 'Maybe' },
  { d: 4, top: 70, h: 20, x: 0, label: 'Late call' },
];
/* Clean week: open hours, a lunch gap, one day off, a couple of real bookings. */
const CLEAN = [
  [{ top: 8, h: 36, kind: 'open' }, { top: 54, h: 36, kind: 'open' }],
  [{ top: 8, h: 16, kind: 'booked' }, { top: 26, h: 18, kind: 'open' }, { top: 54, h: 36, kind: 'open' }],
  null,
  [{ top: 8, h: 36, kind: 'open' }, { top: 54, h: 16, kind: 'open' }, { top: 72, h: 18, kind: 'booked' }],
  [{ top: 8, h: 36, kind: 'open' }],
];

const STEPS = [
  { title: 'Set your weekly hours', desc: 'Switch each day on or off and pick its hours. Add a second window on the same day for lunch or the school run, then copy Monday to every weekday in one go.' },
  { title: 'Block the dates you are away', desc: 'Pick a holiday, a wedding or a training day. That whole date can no longer be booked on any of your services.' },
  { title: 'Choose a buffer and your time zone', desc: 'Leave no gap, or keep 5 minutes up to an hour free after each booking. Your time zone is shown beside every slot your clients see.' },
  { title: 'Connect Google Calendar, if you like', desc: 'Busy events on your calendar keep those times off your page, and the calendar is checked again, live, the moment a client books.' },
  { title: 'Clients book only what is free', desc: 'Booked times and past times drop out by themselves. Two bookings can never overlap, because the database refuses it.' },
];

const CAPS = [
  'Weekly hours that repeat every week, set once',
  'More than one time window per day, for breaks',
  "Copy Monday's hours to weekdays, the weekend or all days",
  'Blocked dates for holidays and leave',
  'A buffer between bookings: none, 5, 10, 15 or 30 minutes, or 1 hour',
  'Your time zone, labelled beside every slot',
  'Busy time on a connected Google Calendar blocks your page',
  'Booked and past slots disappear on their own',
  'Overlapping bookings refused at the database level',
  'Bookable Mon to Sat, 10 AM to 6 PM, until you set your own hours',
];

const DURATIONS = [30, 45, 60];
const BUFFERS = [0, 10, 15];

const PICKED = ['Mukesh Tidke', 'Sangharata Somkuvar', 'Tushar Malvi', 'Ar. Pranav Kadoo'];
const QUOTES = PICKED.map((n) => ALL_TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);

const FAQ = [
  { q: 'How do I set my availability for online bookings?', a: 'Open Availability in your dashboard, switch on the days you work and pick the hours for each. Save once and the same hours repeat every week until you change them.' },
  { q: 'Can I take a break in the middle of the day?', a: 'Yes. Add more than one time window to a day, for example 9 AM to 1 PM and 2 PM to 6 PM, and the hour between stays closed.' },
  { q: 'How do I block a holiday or a day off?', a: 'Add the date under Blocked dates. Clients cannot book anything on that day, on any of your services, and your weekly hours stay as they were.' },
  { q: 'What is a buffer between bookings?', a: 'It is free time kept after each booking before the next one can start. Choose no buffer, 5, 10, 15 or 30 minutes, or 1 hour. It applies to all your services.' },
  { q: 'Does it check my Google Calendar?', a: 'Yes, once you connect it. Busy events on your Google Calendar block those times on your booking page, and the calendar is checked live again when a client books.' },
  { q: 'Which time zone do clients see?', a: 'Yours. Pick your time zone in Availability settings, and every slot on your booking page is labelled with it, for example IST.' },
  { q: 'What if I never set my hours?', a: 'You stay bookable on a default of Monday to Saturday, 10 AM to 6 PM, with Sunday off. The moment you add hours of your own, your schedule takes over.' },
  { q: 'Can I set different hours for each service?', a: 'Not today. Your hours, blocked dates and buffer are set once for your account and apply to every service you offer.' },
];

const RELATED = [
  { to: '/features/online-scheduling', label: 'Online scheduling' },
  { to: '/features/google-calendar', label: 'Google Calendar sync' },
  { to: '/features/booking-pages', label: 'Booking pages' },
  { to: '/features/notifications', label: 'Reminders' },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

/* The highlighter: a lime band behind ink text. */
function Hl({ children }) {
  return (
    <span
      className="box-decoration-clone rounded-[3px] px-1.5"
      style={{ background: `linear-gradient(180deg, transparent 14%, ${LIME} 14%, ${LIME} 90%, transparent 90%)` }}
    >
      {children}
    </span>
  );
}

function PrimaryCta({ to = START, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(26,26,26,0.14)] transition-opacity hover:no-underline hover:opacity-90"
      style={{ background: INK }}
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
      style={{ background: 'repeating-linear-gradient(135deg, rgba(15,118,110,0.04) 0 10px, rgba(15,118,110,0.08) 10px 20px)' }}
    >
      <ImageIcon size={28} style={{ color: 'rgba(15,118,110,0.35)' }} aria-hidden />
    </div>
  );
}

function SectionHead({ children, sub, center = false }) {
  return (
    <div className={center ? 'text-center' : ''}>
      <Reveal as="h2" className={`font-heading text-4xl font-extrabold leading-[1.1] tracking-tight text-[#2A1416] sm:text-5xl ${center ? 'mx-auto max-w-3xl' : 'max-w-3xl'}`}>
        {children}
      </Reveal>
      {sub && (
        <Reveal as="p" delay={0.05} className={`mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 ${center ? 'mx-auto' : ''}`}>
          {sub}
        </Reveal>
      )}
    </div>
  );
}

/* Hero demo — click a block (or a day) to open or close it. */
function HoursGrid() {
  const [grid, setGrid] = useState(INITIAL_GRID);
  const total = countWeekSlots(grid);

  const toggleCell = (d, b) => setGrid((g) => g.map((row, i) => (i === d ? row.map((v, j) => (j === b ? !v : v)) : row)));
  const toggleDay = (d) => setGrid((g) => g.map((row, i) => (i === d ? row.map(() => !row.some(Boolean)) : row)));

  return (
    <div className="mx-auto w-full max-w-[30rem]">
      <div className="rounded-[10px] border border-black/5 bg-white p-4 shadow-[0_30px_70px_-30px_rgba(15,118,110,0.35)] sm:p-6">
        <div className="flex items-center justify-between">
          <div className="font-heading text-sm font-bold text-[#2A1416]">Your week</div>
          <div className="text-[11px] text-neutral-500">Tap a block or a day</div>
        </div>

        <div className="mt-4 grid grid-cols-[2.6rem_repeat(7,minmax(0,1fr))] gap-1 sm:gap-1.5" role="group" aria-label="Weekly hours">
          <span />
          {DAYS.map(([short, full], d) => (
            <button
              key={short}
              type="button"
              onClick={() => toggleDay(d)}
              aria-label={`${grid[d].some(Boolean) ? 'Close' : 'Open'} all of ${full}`}
              className="rounded-[4px] py-1 text-center text-[11px] font-bold text-[#2A1416] transition-colors hover:bg-black/5"
            >
              {short}
            </button>
          ))}
          {BLOCKS.map((label, b) => (
            <div key={label} className="contents">
              <span className="flex items-center text-[10px] font-medium text-neutral-500 sm:text-[11px]">{label}</span>
              {DAYS.map(([short, full], d) => {
                const open = grid[d][b];
                return (
                  <button
                    key={short}
                    type="button"
                    aria-pressed={open}
                    aria-label={`${full} ${label}`}
                    onClick={() => toggleCell(d, b)}
                    className={`h-10 rounded-[5px] border text-[10px] font-semibold transition-colors sm:h-11 ${open ? 'border-transparent text-[#2A1416]' : 'border-black/5 bg-neutral-50 text-neutral-500 hover:bg-neutral-100'}`}
                    style={open ? { background: LIME_DEEP } : undefined}
                  >
                    {open ? 'Open' : 'Off'}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <p className="mt-5 rounded-[6px] px-4 py-3 text-sm text-[#2A1416]" style={{ background: LIME_WASH }} aria-live="polite">
          Clients can book{' '}
          <span data-testid="week-slots" className="font-heading text-lg font-extrabold tabular-nums" style={{ color: TEAL }}>{total}</span>{' '}
          one-hour slots this week.
        </p>
      </div>
      <p className="mt-3 text-center text-[11px] text-neutral-500">Illustration: two-hour blocks, one-hour sessions, no buffer</p>
    </div>
  );
}

/* Messy week vs clean week — the same Mon to Fri, both ways. */
function WeekPanel({ variant }) {
  const messy = variant === 'messy';
  return (
    <div className="grid grid-cols-5 gap-1.5" aria-hidden>
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, d) => (
        <div key={day}>
          <div className="mb-1.5 text-center text-[11px] font-bold text-neutral-500">{day}</div>
          <div className={`relative h-52 overflow-hidden rounded-[5px] ${messy ? 'bg-neutral-100' : 'bg-white border border-black/5'}`}>
            {messy && MESSY.filter((m) => m.d === d).map((m) => (
              <span
                key={`${m.top}-${m.label}`}
                className={`absolute rounded-[4px] border px-1 py-0.5 text-[9px] font-semibold leading-tight sm:text-[10px] ${m.clash ? 'border-[#2A1416]/30 bg-white text-[#2A1416]' : 'border-dashed border-neutral-400 bg-neutral-200/80 text-neutral-600'}`}
                style={{ top: `${m.top}%`, height: `${m.h}%`, left: `${m.x}%`, width: '78%' }}
              >
                {m.label}
              </span>
            ))}
            {!messy && (CLEAN[d] ? CLEAN[d].map((c) => (
              <span
                key={c.top}
                className="absolute inset-x-1 rounded-[4px] px-1 py-0.5 text-[9px] font-semibold leading-tight sm:text-[10px]"
                style={{ top: `${c.top}%`, height: `${c.h}%`, ...(c.kind === 'booked' ? { background: TEAL, color: '#fff' } : { background: LIME, color: INK }) }}
              >
                {c.kind === 'booked' ? 'Booked' : 'Open'}
              </span>
            )) : (
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-neutral-500" style={{ background: 'repeating-linear-gradient(135deg, rgba(0,0,0,0.03) 0 6px, rgba(0,0,0,0.06) 6px 12px)' }}>Off</span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Choice({ label, options, value, onChange, fmt }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <div className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-500">{label}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${value === o ? 'border-transparent text-[#2A1416]' : 'border-black/10 text-neutral-600 hover:border-black/25'}`}
            style={value === o ? { background: LIME_DEEP } : undefined}
          >
            {fmt(o)}
          </button>
        ))}
      </div>
    </div>
  );
}

/* The difference — duration + buffer, and how many slots fit a 9 AM to 5 PM day. */
function BufferControl() {
  const [duration, setDuration] = useState(60);
  const [buffer, setBuffer] = useState(15);
  const starts = slotStarts(duration, buffer);
  const pct = (m) => `${(m / 480) * 100}%`;

  return (
    <div className="mt-12 rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-9">
      <div className="grid gap-6 sm:grid-cols-2">
        <Choice label="Session length" options={DURATIONS} value={duration} onChange={setDuration} fmt={(o) => `${o} min`} />
        <Choice label="Buffer after each" options={BUFFERS} value={buffer} onChange={setBuffer} fmt={(o) => (o ? `${o} min` : 'None')} />
      </div>

      <div className="mt-9">
        <div className="relative h-14 overflow-hidden rounded-[6px] border border-black/5" style={{ background: 'repeating-linear-gradient(135deg, rgba(15,118,110,0.05) 0 6px, rgba(15,118,110,0.1) 6px 12px)' }} aria-hidden>
          {starts.map((s) => (
            <span key={s} className="absolute inset-y-1.5 rounded-[4px]" style={{ left: pct(s), width: `calc(${pct(duration)} - 2px)`, background: LIME_DEEP }} />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-neutral-500" aria-hidden>
          <span>9 AM</span><span>11 AM</span><span>1 PM</span><span>3 PM</span><span>5 PM</span>
        </div>
      </div>

      <p className="mt-7 text-center text-lg text-[#2A1416]" aria-live="polite">
        <span data-testid="day-slots" className="font-heading text-4xl font-extrabold tabular-nums" style={{ color: TEAL }}>{starts.length}</span>{' '}
        sessions fit between 9 AM and 5 PM{buffer ? `, each followed by ${buffer} free minutes.` : ', back to back.'}
      </p>
      <p className="mt-2 text-center text-[11px] text-neutral-500">Illustration: one sample day with no other bookings. Lime = a bookable slot, stripes = free time.</p>
    </div>
  );
}

function QuoteCard({ t, hidden = false }) {
  return (
    <figure aria-hidden={hidden || undefined} className="flex w-[85%] shrink-0 flex-col justify-between rounded-[10px] border border-black/5 bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:w-[22rem]">
      <blockquote className="text-[16px] leading-relaxed text-[#2A1416]">&ldquo;{t.quote}&rdquo;</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <img src={t.avatar} alt="" loading="lazy" className="h-11 w-11 rounded-full object-cover" />
        <div>
          <div className="text-sm font-semibold text-[#2A1416]">{t.name}</div>
          <div className="text-xs text-neutral-500">{t.role}</div>
        </div>
      </figcaption>
    </figure>
  );
}

/* Testimonials slide one card, pause, slide again ("swoosh, stop"). The list is
   rendered twice so the loop wraps seamlessly: after the last real card the track
   snaps back to the start with the transition off. Pauses on hover/focus; under
   reduced motion it falls back to a plain sideways-scroll row. */
const SWOOSH_EVERY = 3200;
function SwooshCarousel({ items }) {
  const trackRef = useRef(null);
  const pausedRef = useRef(false);
  const [idx, setIdx] = useState(0);
  const [animate, setAnimate] = useState(true);
  const [step, setStep] = useState(0);
  const [reduce] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

  useEffect(() => {
    const el = trackRef.current;
    if (!el || el.children.length < 2) return undefined;
    const measure = () => setStep(el.children[1].offsetLeft - el.children[0].offsetLeft);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduce) return undefined;
    const id = setInterval(() => {
      if (!pausedRef.current) { setAnimate(true); setIdx((i) => i + 1); }
    }, SWOOSH_EVERY);
    return () => clearInterval(id);
  }, [reduce]);

  if (reduce) {
    return (
      <div className="mt-12 flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 sm:gap-6" role="region" aria-label="Host testimonials, scroll sideways for more" tabIndex={0}>
        {items.map((t) => <QuoteCard key={t.name} t={t} />)}
      </div>
    );
  }

  return (
    <div
      className="mt-12 overflow-hidden"
      role="region"
      aria-roledescription="carousel"
      aria-label="Host testimonials"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onFocus={() => { pausedRef.current = true; }}
      onBlur={() => { pausedRef.current = false; }}
    >
      <div
        ref={trackRef}
        className="flex gap-5 pb-4 sm:gap-6"
        style={{ transform: `translate3d(${-idx * step}px,0,0)`, transition: animate ? 'transform 700ms cubic-bezier(0.22,1,0.36,1)' : 'none' }}
        onTransitionEnd={() => { if (idx >= items.length) { setAnimate(false); setIdx(0); } }}
      >
        {[...items, ...items].map((t, i) => <QuoteCard key={`${t.name}-${i}`} t={t} hidden={i >= items.length} />)}
      </div>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function AvailabilityFeature() {
  const canonical = `${SITE_URL}/features/availability`;
  const seo = {
    title: 'Set Availability for Online Bookings | Meeticulous',
    description: 'Set your availability for online bookings once: weekly hours, breaks, blocked dates and a buffer between sessions. Clients only see the time you are free. Start free.',
  };
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'Availability',
    serviceType: 'Availability and working-hours settings for online appointment bookings',
    image: ogCard('features-availability'),
    steps: STEPS.map((s) => ({ title: s.title, desc: s.desc })),
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  return (
    <main className="overflow-x-clip bg-white text-[#2A1416]">
      <Seo
        title={seo.title}
        description={seo.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor="#FFFFFF"
        ogTitle="Set your hours once. Clients book only what is free."
        ogDescription={seo.description}
        image={ogCard('features-availability')}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · HERO (highlighted headline + clickable hours grid) ═══════════════ */}
      <section className="relative px-5 pb-20 pt-8 sm:px-8 lg:pb-28 lg:pt-6 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center">
        <div className="mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:gap-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs text-neutral-500">
              <Link to="/" className="text-neutral-500 hover:text-[#2A1416] hover:no-underline">Home</Link>
              <span aria-hidden className="mx-2">/</span>
              <span>Features</span>
              <span aria-hidden className="mx-2">/</span>
              <span aria-current="page" className="text-[#2A1416]">Availability</span>
            </nav>
            <Reveal as="h1" instant className="mt-4 font-heading text-[clamp(2.4rem,4.4vw,3.9rem)] font-extrabold leading-[1.04] tracking-[-0.03em] text-[#2A1416]">
              Set your availability for online bookings <Hl>once.</Hl>
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mt-4 max-w-xl text-base leading-relaxed text-neutral-600 lg:text-lg">
              Your weekly hours, breaks, days off and a buffer between sessions, set one time. Your booking page only offers the hours you are actually free, every week, without you touching it.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta>Start free <ArrowRight size={16} /></PrimaryCta>
              <a href="#buffer" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:no-underline hover:opacity-80" style={{ color: TEAL }}>
                Try the buffer maths <ArrowRight size={15} />
              </a>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] text-neutral-600">
                  <Check size={14} style={{ color: TEAL }} aria-hidden /> {t}
                </span>
              ))}
            </Reveal>
          </div>
          <Reveal instant delay={0.12}>
            <HoursGrid />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 2 · PROOF (one sentence, facts highlighted) ═══════════════ */}
      <section className="border-y border-black/5 px-5 py-14 sm:px-8 lg:py-16" style={{ background: LIME_WASH }}>
        <Reveal as="p" className="mx-auto max-w-4xl text-center font-heading text-xl font-bold leading-[1.7] text-[#2A1416] sm:text-2xl sm:leading-[1.7]">
          Hours that <Hl>repeat every week</Hl>, <Hl>more than one window a day</Hl>, <Hl>blocked dates</Hl> for leave, a <Hl>buffer up to an hour</Hl> after each session, and <Hl>Google Calendar busy time</Hl> kept off your page.
        </Reveal>
      </section>

      {/* ═══════════════ 3 · WITHOUT vs WITH (messy week vs clean week) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <SectionHead sub="Telling every client when you are free, in every chat, works until two of them pick the same hour. Here is the same week, both ways.">
            Your week, minus the <Hl>guesswork.</Hl>
          </SectionHead>

          <div className="mt-14 grid gap-5 sm:gap-6 lg:grid-cols-2">
            <Reveal className="rounded-[10px] border border-black/5 bg-neutral-50 p-6 sm:p-8">
              <h3 className="font-heading text-lg font-bold text-neutral-500">Hours in your head</h3>
              <div className="mt-5"><WeekPanel variant="messy" /></div>
              <ul className="mt-6 space-y-2.5">
                {WITHOUT.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[15px] text-neutral-500">
                    <X size={16} className="mt-0.5 shrink-0" aria-hidden /><span><span className="sr-only">Without: </span>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={0.06} className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-8">
              <h3 className="font-heading text-lg font-bold text-[#2A1416]">Hours on <Hl>Meeticulous</Hl></h3>
              <div className="mt-5"><WeekPanel variant="clean" /></div>
              <ul className="mt-6 space-y-2.5">
                {WITH.map((t) => (
                  <li key={t} className="flex items-start gap-2 text-[15px] font-medium text-[#2A1416]">
                    <Check size={16} className="mt-0.5 shrink-0" style={{ color: TEAL }} aria-hidden /><span><span className="sr-only">With Meeticulous: </span>{t}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (vertical steps, lime markers) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: LIME_WASH }}>
        <div className="mx-auto max-w-3xl">
          <SectionHead>Five settings, <Hl>then hands off.</Hl></SectionHead>
          <ol className="mt-14">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.05} className="relative grid grid-cols-[3rem_1fr] gap-5 pb-10 last:pb-0">
                {i < STEPS.length - 1 && <span aria-hidden className="absolute bottom-0 left-6 top-12 w-px bg-black/10" />}
                <span className="flex h-12 w-12 items-center justify-center rounded-full font-heading text-lg font-extrabold text-[#2A1416]" style={{ background: LIME_DEEP }}>
                  {i + 1}
                </span>
                <div className="pt-2">
                  <h3 className="font-heading text-xl font-bold text-[#2A1416]">{s.title}</h3>
                  <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════════ 5 · CAPABILITIES (checklist + tall image) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div>
            <SectionHead>Everything your hours <Hl>need to know.</Hl></SectionHead>
            <ul className="mt-10 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {CAPS.map((c, i) => (
                <Reveal as="li" key={c} delay={(i % 4) * 0.04} className="flex items-start gap-3 border-b border-black/5 pb-4 text-[15px] leading-relaxed text-[#2A1416]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: 'rgba(15,118,110,0.1)' }}>
                    <Check size={13} strokeWidth={3} style={{ color: TEAL }} aria-hidden />
                  </span>
                  {c}
                </Reveal>
              ))}
            </ul>
          </div>
          <Reveal delay={0.08} className="lg:pt-4">
            <ImgSlot
              slot="availability-weekly-schedule"
              alt="The Availability screen in the Meeticulous dashboard, with weekly hours, blocked dates and buffer settings"
              className="aspect-[3/4] w-full lg:h-full lg:aspect-auto lg:min-h-[34rem]"
            />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · THE DIFFERENCE (duration + buffer control) ═══════════════ */}
      <section id="buffer" className="scroll-mt-20 border-t border-black/5 px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <SectionHead center sub="A buffer is the free time kept after each booking. Pick a session length and a buffer, and watch how a working day fills.">
            Room to <Hl>breathe</Hl> between calls.
          </SectionHead>
          <BufferControl />
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (auto-advancing "swoosh, stop" carousel) ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: LIME_WASH }}>
          <div className="mx-auto max-w-6xl">
            <SectionHead>Hosts who stopped <Hl>sharing their calendar by text.</Hl></SectionHead>
            <SwooshCarousel items={QUOTES} />
          </div>
        </section>
      )}

      {/* ═══════════════ 8 · FAQ (accordion, lime bar on the open item) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-3xl">
          <SectionHead center>Availability questions, <Hl>answered.</Hl></SectionHead>
          <div className="mt-12 space-y-3">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group relative overflow-hidden rounded-[6px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]" open={i === 0}>
                <span aria-hidden className="absolute inset-y-0 left-0 hidden w-1.5 group-open:block" style={{ background: LIME_DEEP }} />
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-6 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="font-heading text-[17px] font-bold text-[#2A1416]">{f.q}</span>
                  <span aria-hidden className="text-xl leading-none text-neutral-400 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="px-6 pb-6 text-[15px] leading-relaxed text-neutral-600">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · FINAL CTA ═══════════════ */}
      <section className="border-t border-black/5 px-5 py-20 sm:px-8 lg:py-28" style={{ background: LIME_WASH }}>
        <div className="mx-auto max-w-4xl text-center">
          <Reveal as="h2" className="font-heading text-[clamp(2.3rem,5.4vw,4rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-[#2A1416]">
            Set your hours once. <Hl>Let the page do the rest.</Hl>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-neutral-600">
            Availability is included on the free {FREE_PLAN.name} plan. Make your booking page, set your week, share the link.
          </Reveal>
          <Reveal delay={0.1} className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <PrimaryCta>Start free <ArrowRight size={16} /></PrimaryCta>
            <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:no-underline hover:opacity-80" style={{ color: TEAL }}>
              See pricing <ArrowRight size={15} />
            </Link>
          </Reveal>
          <nav aria-label="Related features" className="mt-14 flex flex-wrap justify-center gap-x-6 gap-y-2 border-t border-black/10 pt-8 text-sm text-neutral-500">
            <span className="flex items-center gap-1.5"><CalendarDays size={14} aria-hidden /> Works with</span>
            {RELATED.map((r) => (
              <Link key={r.to} to={r.to} className="font-medium underline decoration-black/20 underline-offset-4 hover:decoration-black/60" style={{ color: TEAL }}>{r.label}</Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
