// /features/client-management — bespoke feature page (Oct feature-page rebuild).
//
// STANDALONE page, not the data-driven FeaturePage template. Its static route
// precedes /features/:slug in App.jsx; the featureData.js "client-management"
// entry stays for prerender's slug list and the other pages' "related" cards.
//
// Section order (shared by all 10 bespoke feature pages, each its own design):
//   1 Hero + live demo · 2 Proof strip · 3 Without vs with · 4 How it works ·
//   5 Capabilities · 6 The difference · 7 Testimonials · 8 FAQ · 9 Final CTA
//
// Design system B "Calm cream": soft cream grounds, warm orange accent (#191919
// for text and CTA fills, peach tints for surfaces), pill chips, an avatar-count
// pill motif. Gentle and human, not dashboardy. Mechanics unique to this page:
// clickable client list + client card (hero) · avatar-stack pill with fact chips ·
// scattered-sources pile vs one client profile · three soft "builds itself" cards ·
// alternating text and image rows · plan toggle over an avatar grid ·
// round-avatar quote cards · single-card accordion FAQ.
//
// HONESTY: every claim maps to server/services/crmService.js +
// server/controllers/crmController.js + client/src/pages/ClientsList.jsx /
// ClientDetail.jsx. Clients are derived from bookings (keyed by phone, else
// email; only clients with a confirmed booking, free ₹0 sessions included).
// Free plan view = 10 most recent clients (planService limits.crm = 10, capped
// in crmService.listClients, CSV export capped the same); Pro = all
// (-1). Notes max 5,000 chars. Lapsed = 2+ bookings, none upcoming, last one
// over 60 days ago (LAPSE_DAYS). Host-scoped: hostId always from the auth token.
// Tags are NOT claimed (no UI to add them yet). No usage stats, no ratings.
// Testimonials are the real, consented quotes from data/testimonials.js.
//
// IMAGES: empty ImgSlot placeholders (data-img-slot names the photo to supply).
// Global Navbar + Footer come from App.jsx. No hover uplift anywhere.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, Repeat, UserPlus, CalendarCheck, NotebookPen, Search,
  Download, Lock, MessageCircle, Notebook, FileSpreadsheet, StickyNote, Mail,
  ImageIcon, UserX, Star, ChevronDown, Users,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN } from '../../data/plans';
import { TESTIMONIALS as ALL_TESTIMONIALS } from '../../data/testimonials';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';
const CREAM = '#FBF6EE';      // page ground
const CREAM_DEEP = '#F4EBDD'; // alternate section ground
const PEACH = '#FCE7DA';      // soft accent surface
const ACCENT = '#191919';     // text + CTA fill (AA on cream and with white text)
const INK = '#2A211B';        // warm ink
const MUTED = '#6B5D52';      // body copy on cream (AA)
const TINTS = ['#FCE3D3', '#F7E6C4', '#F9D9CF', '#EFE4D6']; // avatar backgrounds

// Same cap the server applies on the free plan (planService limits.crm).
export const FREE_CRM_CLIENTS = 10;

const inr = (n) => `₹${n.toLocaleString('en-IN')}`;
const initials = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase();

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

// Obviously sample people. Newest booking first.
export const SAMPLE_CLIENTS = [
  {
    name: 'Asha Example',
    note: 'Prefers evening calls. Working on her portfolio, review the draft next time.',
    bookings: [
      { service: '1:1 coaching · 45 min', date: '18 Sep', amount: 1200 },
      { service: '1:1 coaching · 45 min', date: '28 Aug', amount: 1200 },
      { service: 'Discovery call · 20 min', date: '9 Aug', amount: 0 },
    ],
  },
  {
    name: 'Rohan Sample',
    note: '',
    bookings: [{ service: 'Discovery call · 20 min', date: '22 Sep', amount: 0 }],
  },
  {
    name: 'Meera Demo',
    note: 'Two kids, mornings only. Asked about the monthly package.',
    bookings: [
      { service: 'Monthly check-in · 60 min', date: '15 Sep', amount: 2000 },
      { service: 'Monthly check-in · 60 min', date: '14 Aug', amount: 2000 },
    ],
  },
  {
    name: 'Kabir Test',
    note: 'Rescheduled once. Sends questions on WhatsApp before each call.',
    bookings: [
      { service: 'Portfolio review · 30 min', date: '2 Sep', amount: 900 },
      { service: 'Portfolio review · 30 min', date: '5 Aug', amount: 900 },
      { service: 'Portfolio review · 30 min', date: '8 Jul', amount: 900 },
      { service: 'Discovery call · 20 min', date: '20 Jun', amount: 0 },
    ],
  },
];

export const totalSpent = (c) => c.bookings.reduce((s, b) => s + b.amount, 0);

const HERO_TRUST = [`Free on ${FREE_PLAN.name}`, 'No data entry', 'Your clients stay yours'];

// Hero checklist (above the CTA) — every item verified in crmService / ClientsList.
const FACTS = ['Built from your bookings', 'Search by name, phone or email', 'Export to CSV', 'Private notes', 'Booking history and total spent', 'Recurring and lapsed filters'];

const SCATTERED = [
  { icon: MessageCircle, label: 'WhatsApp', text: '"who was the 4 pm on Tuesday?"', rot: '-4deg', pos: 'left-[2%] top-0' },
  { icon: Notebook, label: 'Notebook', text: 'Asha, 3 sessions? or 4?', rot: '3deg', pos: 'right-[4%] top-[19%]' },
  { icon: FileSpreadsheet, label: 'Spreadsheet', text: 'clients_final_v3.xlsx', rot: '-2deg', pos: 'left-[10%] top-[39%]' },
  { icon: StickyNote, label: 'Notes app', text: 'Meera: mornings only', rot: '4deg', pos: 'right-[8%] top-[59%]' },
  { icon: Mail, label: 'Inbox', text: 'Re: Re: payment screenshot', rot: '-3deg', pos: 'left-[4%] top-[79%]' },
];

const STEPS = [
  { icon: CalendarCheck, title: 'A client books', desc: 'Someone books a paid or free session on your booking page. That is the only step you see.' },
  { icon: UserPlus, title: 'They join your client list', desc: 'They are added on their own, matched by phone number (or email), so the same person never shows up twice.' },
  { icon: NotebookPen, title: 'Their story builds up', desc: 'Every booking, the total they have spent and their last visit line up under their name, with room for your private notes.' },
];

const ROWS = [
  {
    icon: Repeat,
    title: 'Every booking, under one name',
    body: 'Open a client and see each past and upcoming session, how much they have spent with you, when they last came, and any no-shows. Anyone who books more than once gets a Recurring badge, and their reviews sit right there too.',
    slot: 'client-management-detail',
    alt: 'A client card in the Meeticulous dashboard with booking history, total spent and a Recurring badge',
  },
  {
    icon: NotebookPen,
    title: 'Notes only you can read',
    body: 'Jot down what matters before the next call: goals, preferences, where you left off. Notes stay in your dashboard and are never shown to your client.',
    slot: 'client-management-notes',
    alt: 'A host typing a private note on a client profile before a session',
  },
  {
    icon: Search,
    title: 'Find anyone, take everything with you',
    body: 'Search by name, phone or email. Sort by most recent or top spend, or filter to lapsed regulars: people with two or more bookings, nothing upcoming, and no visit in 60 days. Download your list as a CSV whenever you like.',
    slot: 'client-management-list',
    alt: 'The client list with search, top-spend sort, the Lapsed filter and the Export CSV button',
  },
];

const PICKED = ['Mukesh Tidke', 'Tushar Malvi', 'Sangharata Somkuvar'];
const QUOTES = PICKED.map((n) => ALL_TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);

const FAQ = [
  { q: 'Is the client management really free?', a: `Yes. On ${FREE_PLAN.name}, which costs ₹0 a month, your client list shows your ${FREE_CRM_CLIENTS} most recent clients with their booking history, total spent and your notes. ${PREMIUM_PLAN.name} (₹${PREMIUM_PLAN.monthly} a month or ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')} a year) shows every client you have ever had.` },
  { q: 'Do I have to add clients myself?', a: 'No. Anyone who makes a confirmed booking with you, paid or a free ₹0 session, is added to your list automatically. There is nothing to type in.' },
  { q: 'What if the same person books again?', a: 'Clients are matched by phone number (or email when there is no phone), so a second booking lands under the same name and they get a Recurring badge.' },
  { q: 'Who can see my notes?', a: 'Notes live in your dashboard and are never shown to your client. Each note can be up to 5,000 characters, and you can delete any of them.' },
  { q: 'Can I export my client list?', a: `Yes. Export a CSV with each client's name, phone, email, number of bookings, total spent, first and last booking, and whether they are recurring. On ${FREE_PLAN.name} the export covers the same ${FREE_CRM_CLIENTS} most recent clients.` },
  { q: 'Can anyone else see my clients?', a: 'No. Your client list is built only from your own bookings and every request is tied to your account, so other hosts never see your clients.' },
  { q: 'Do abandoned checkouts show up as clients?', a: 'No. Someone who started a booking but never paid is not added. Only confirmed bookings count.' },
];

const RELATED = [
  { to: '/features/online-scheduling', label: 'Online scheduling' },
  { to: '/features/notifications', label: 'Reminders' },
  { to: '/features/reviews', label: 'Reviews' },
  { to: '/features/analytics', label: 'Analytics' },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function PrimaryCta({ to = START, children }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(194,61,0,0.45)] transition-opacity hover:no-underline hover:opacity-90"
      style={{ background: ACCENT }}
    >
      {children}
    </Link>
  );
}

function Avatar({ name, i = 0, size = 'h-9 w-9 text-xs', ring = false }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-heading font-bold ${size} ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ background: TINTS[i % TINTS.length], color: INK }}
    >
      {initials(name)}
    </span>
  );
}

/* The page's motif: overlapping initials + a count. */
function AvatarStackPill({ names, label }) {
  return (
    <span className="inline-flex items-center gap-3 rounded-full border border-black/5 bg-white py-1.5 pl-1.5 pr-4 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
      <span className="flex -space-x-1.5">
        {names.map((n, i) => <Avatar key={n} name={n} i={i} size="h-8 w-8 text-[10px] tracking-tight" ring />)}
      </span>
      <span className="text-sm font-semibold" style={{ color: INK }}>{label}</span>
    </span>
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
      style={{ background: 'repeating-linear-gradient(135deg, rgba(194,61,0,0.04) 0 10px, rgba(194,61,0,0.08) 10px 20px)' }}
    >
      <ImageIcon size={28} style={{ color: 'rgba(194,61,0,0.35)' }} aria-hidden />
    </div>
  );
}

/* Hero demo — pick a client, see their card. Auto-cycles until touched. */
function ClientCardDemo() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [notes, setNotes] = useState(() => SAMPLE_CLIENTS.map((c) => c.note));

  useEffect(() => {
    if (reduce || paused) return undefined;
    const id = setInterval(() => setActive((a) => (a + 1) % SAMPLE_CLIENTS.length), 4200);
    return () => clearInterval(id);
  }, [reduce, paused]);

  const c = SAMPLE_CLIENTS[active];
  const fade = reduce
    ? {}
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } };

  return (
    <div className="mx-auto w-full max-w-[34rem]">
      <div className="overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_30px_70px_-35px_rgba(122,60,20,0.35)]">
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
          <span className="font-heading text-sm font-bold" style={{ color: INK }}>Clients</span>
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: PEACH, color: ACCENT }}>
            <Users size={12} aria-hidden /> {SAMPLE_CLIENTS.length} saved from bookings
          </span>
        </div>

        <div className="grid sm:grid-cols-[11.5rem_1fr]">
          <div className="flex gap-1.5 overflow-x-auto border-b border-black/5 p-3 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r" role="group" aria-label="Sample clients">
            {SAMPLE_CLIENTS.map((cl, i) => (
              <button
                key={cl.name}
                type="button"
                aria-pressed={active === i}
                onClick={() => { setActive(i); setPaused(true); }}
                className={`flex shrink-0 items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-3 text-left text-[13px] transition-colors ${active === i ? 'font-semibold' : 'hover:bg-black/[0.03]'}`}
                style={active === i ? { background: PEACH, color: INK } : { color: MUTED }}
              >
                <Avatar name={cl.name} i={i} size="h-7 w-7 text-[10px]" />
                <span className="whitespace-nowrap">{cl.name}</span>
              </button>
            ))}
          </div>

          <div className="min-h-[22rem] p-5" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={c.name} {...fade}>
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} i={active} size="h-11 w-11 text-sm" />
                  <div className="min-w-0">
                    <div className="font-heading text-base font-bold" style={{ color: INK }} data-testid="demo-client-name">{c.name}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {c.bookings.length > 1 ? (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: PEACH, color: ACCENT }}><Repeat size={11} aria-hidden /> Recurring</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] px-2 py-0.5 text-[11px] font-semibold" style={{ color: MUTED }}><UserPlus size={11} aria-hidden /> First booking</span>
                      )}
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  {[
                    ['Total spent', inr(totalSpent(c))],
                    ['Last visit', c.bookings[0].date],
                    ['Bookings', String(c.bookings.length)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-[6px] px-2 py-2.5" style={{ background: CREAM }}>
                      <dt className="text-[10px] uppercase tracking-[0.12em]" style={{ color: MUTED }}>{k}</dt>
                      <dd className="mt-0.5 font-heading text-[15px] font-bold tabular-nums" style={{ color: INK }}>{v}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: MUTED }}>Past bookings</div>
                <ul className="mt-1.5 divide-y divide-black/5 text-[13px]">
                  {c.bookings.slice(0, 3).map((b) => (
                    <li key={`${b.date}-${b.service}`} className="flex items-center justify-between gap-3 py-1.5">
                      <span style={{ color: INK }}>{b.service}<span className="ml-2" style={{ color: MUTED }}>{b.date}</span></span>
                      <span className="tabular-nums" style={{ color: MUTED }}>{b.amount ? inr(b.amount) : 'Free'}</span>
                    </li>
                  ))}
                </ul>

                <label htmlFor="cm-note" className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: MUTED }}>
                  <Lock size={11} aria-hidden /> Private note
                </label>
                <textarea
                  id="cm-note"
                  rows={2}
                  value={notes[active]}
                  placeholder="Add a private note about this client"
                  onFocus={() => setPaused(true)}
                  onChange={(e) => { const v = e.target.value; setNotes((n) => n.map((x, i) => (i === active ? v : x))); }}
                  className="mt-1.5 w-full resize-none rounded-[6px] border border-black/10 bg-white px-3 py-2 text-[13px] focus:outline-none focus:ring-2"
                  style={{ color: INK, '--tw-ring-color': 'rgba(194,61,0,0.3)' }}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px]" style={{ color: MUTED }}>Illustration with sample clients. Tap a name, or type a note.</p>
    </div>
  );
}

/* The difference — what the client list shows on each plan. */
const GRID_NAMES = [
  'Asha Example', 'Rohan Sample', 'Meera Demo', 'Kabir Test', 'Nisha Sample', 'Dev Example', 'Tara Demo',
  'Omar Test', 'Lina Sample', 'Vik Example', 'Ira Demo', 'Sam Test', 'Zoya Sample', 'Neel Example',
];

function PlanLens() {
  const [plan, setPlan] = useState('free');
  const free = plan === 'free';
  const rows = [
    ['Who appears in your list', `Your ${FREE_CRM_CLIENTS} most recent clients`, 'Every client, ever'],
    ['History, total spent and notes', `For those ${FREE_CRM_CLIENTS}`, 'For everyone'],
    ['CSV export', `Those ${FREE_CRM_CLIENTS}`, 'Your whole list'],
    ['Search, sort and Lapsed filter', 'Included', 'Included'],
    ['Commission on bookings', '5%', '0%'],
    ['Price', '₹0', `₹${PREMIUM_PLAN.monthly}/mo or ₹${PREMIUM_PLAN.yearly.toLocaleString('en-IN')}/yr`],
  ];

  return (
    <div className="mt-12 grid items-start gap-8 lg:grid-cols-[1fr_1.1fr]">
      <div className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)] sm:p-7">
        <div className="inline-flex rounded-full p-1" style={{ background: CREAM_DEEP }} role="group" aria-label="Compare plans">
          {[['free', FREE_PLAN.name], ['premium', PREMIUM_PLAN.name]].map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={plan === k}
              onClick={() => setPlan(k)}
              className="rounded-full px-4 py-1.5 text-sm font-semibold transition-colors"
              style={plan === k ? { background: ACCENT, color: '#fff' } : { color: MUTED }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-7 gap-2.5">
          {GRID_NAMES.map((n, i) => {
            const shown = !free || i < FREE_CRM_CLIENTS;
            return (
              <span key={n} className="flex justify-center transition-opacity duration-300" style={{ opacity: shown ? 1 : 0.22 }} title={n}>
                <Avatar name={n} i={i} size="h-10 w-10 text-[11px]" />
              </span>
            );
          })}
        </div>
        <p className="mt-6 text-sm leading-relaxed" style={{ color: INK }} aria-live="polite" data-testid="plan-lens-note">
          {free
            ? `On ${FREE_PLAN.name}, your list shows your ${FREE_CRM_CLIENTS} most recent clients. Older ones are still in your bookings, they just leave the list.`
            : `On ${PREMIUM_PLAN.name}, every client who has ever booked with you stays in your list.`}
        </p>
        <p className="mt-2 text-[11px]" style={{ color: MUTED }}>Illustration: a host with 14 sample clients</p>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ background: CREAM }}>
              <th scope="col" className="px-4 py-3 font-semibold sm:px-5" style={{ color: MUTED }}><span className="sr-only">Feature</span></th>
              <th scope="col" className="px-3 py-3 font-heading font-bold" style={{ color: free ? ACCENT : INK }}>{FREE_PLAN.name}</th>
              <th scope="col" className="px-3 py-3 font-heading font-bold sm:pr-5" style={{ color: free ? INK : ACCENT }}>{PREMIUM_PLAN.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {rows.map(([k, a, b]) => (
              <tr key={k}>
                <th scope="row" className="px-4 py-3.5 font-medium sm:px-5" style={{ color: INK }}>{k}</th>
                <td className="px-3 py-3.5 transition-colors" style={{ color: free ? INK : MUTED, background: free ? 'rgba(252,231,218,0.45)' : undefined }}>{a}</td>
                <td className="px-3 py-3.5 transition-colors sm:pr-5" style={{ color: free ? MUTED : INK, background: free ? undefined : 'rgba(252,231,218,0.45)' }}>{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function ClientManagementFeature() {
  const canonical = `${SITE_URL}/features/client-management`;
  const seo = {
    title: 'Free Client Management for Coaches & Creators | Meeticulous',
    description: 'Every client who books is saved automatically with their booking history, total spent and your private notes. Search, export to CSV, and start free.',
  };
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'Client Management',
    serviceType: 'Client management and booking history for coaches and creators',
    image: ogCard('features-client-management'),
    steps: STEPS.map((s) => ({ title: s.title, desc: s.desc })),
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  const h2 = 'font-heading text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl';

  return (
    <main className="overflow-x-clip" style={{ background: CREAM, color: INK }}>
      <Seo
        title={seo.title}
        description={seo.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor={CREAM}
        ogTitle="Every client who books, remembered."
        ogDescription={seo.description}
        image={ogCard('features-client-management')}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · HERO (client list + client card demo) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-20 pt-8 sm:px-8 lg:pb-28 lg:pt-6 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center">
        <div aria-hidden className="pointer-events-none absolute -left-40 top-10 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(closest-side, rgba(252,231,218,0.9), transparent)' }} />
        <div className="relative mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:gap-14 lg:grid-cols-[0.95fr_1.05fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs" style={{ color: MUTED }}>
              <Link to="/" className="hover:no-underline hover:opacity-70" style={{ color: MUTED }}>Home</Link>
              <span aria-hidden className="mx-2">/</span>
              <span>Features</span>
              <span aria-hidden className="mx-2">/</span>
              <span aria-current="page" style={{ color: INK }}>Client management</span>
            </nav>
            <Reveal instant className="mt-5 hidden sm:block">
              <AvatarStackPill names={SAMPLE_CLIENTS.map((c) => c.name)} label="Your clients, in one place" />
            </Reveal>
            <Reveal as="h1" instant delay={0.03} className="mt-4 font-heading text-[clamp(2.1rem,3.5vw,3rem)] font-extrabold leading-[1.02] tracking-[-0.03em]" style={{ color: INK }}>
              Free client management <span style={{ color: ACCENT }}>that fills itself in.</span>
            </Reveal>
            <Reveal as="p" instant delay={0.06} className="mt-4 max-w-xl text-base leading-relaxed lg:text-[17px]" style={{ color: MUTED }}>
              Everyone who books you is saved automatically, with every session, what they have spent and your private notes. No CRM to maintain.
            </Reveal>
            <Reveal as="ul" instant delay={0.08} className="mt-4 grid max-w-xl gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {FACTS.map((f) => (
                <li key={f} className="flex items-center gap-2 text-[14.5px] font-medium" style={{ color: INK }}>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: PEACH }}><Check size={12} style={{ color: ACCENT }} aria-hidden /></span>
                  {f}
                </li>
              ))}
            </Reveal>
            <Reveal instant delay={0.1} className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta>Start free <ArrowRight size={16} /></PrimaryCta>
              <a href="#plans" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:no-underline hover:opacity-80" style={{ color: ACCENT }}>
                What is free, what is not <ArrowRight size={15} />
              </a>
            </Reveal>
          </div>
          <Reveal instant delay={0.12}>
            <ClientCardDemo />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 2 · PROOF (avatar-stack pill + fact chips) ═══════════════ */}
      <section className="px-5 pb-6 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 rounded-[10px] px-6 py-8 text-center sm:px-10 lg:flex-row lg:justify-between lg:text-left" style={{ background: PEACH }}>
          <AvatarStackPill names={['Asha Example', 'Rohan Sample', 'Meera Demo']} label="Every client who books, saved" />
          <ul className="flex flex-wrap justify-center gap-2 lg:justify-end">
            {HERO_TRUST.map((f) => (
              <li key={f} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold" style={{ color: INK }}>
                <Check size={13} style={{ color: ACCENT }} aria-hidden /> {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══════════════ 3 · WITHOUT vs WITH (scattered sources vs one profile) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className={`max-w-3xl ${h2}`}>
            Your clients are in five apps. <span style={{ color: ACCENT }}>They should be in one.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed" style={{ color: MUTED }}>
            A notebook for sessions, WhatsApp for questions, a spreadsheet you stopped updating in March. Here is the same client, both ways.
          </Reveal>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <Reveal className="rounded-[10px] border border-dashed border-black/10 p-6" style={{ background: 'rgba(255,255,255,0.45)' }}>
              <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: MUTED }}>Without</div>
              <div className="relative mt-4 h-[22rem]">
                {SCATTERED.map((s) => (
                  <div
                    key={s.label}
                    className={`absolute ${s.pos} flex max-w-[15rem] items-start gap-2.5 rounded-[6px] border border-black/5 bg-white px-3.5 py-2.5 shadow-[0_8px_24px_-12px_rgba(26,26,26,0.18)]`}
                    style={{ transform: `rotate(${s.rot})` }}
                  >
                    <s.icon size={16} className="mt-0.5 shrink-0" style={{ color: MUTED }} aria-hidden />
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: MUTED }}>{s.label}</div>
                      <div className="text-[13px]" style={{ color: INK }}>{s.text}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.06} className="rounded-[10px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: ACCENT }}>With Meeticulous</div>
              <div className="mt-5 flex items-center gap-3.5">
                <Avatar name="Asha Example" size="h-14 w-14 text-base" />
                <div>
                  <h3 className="font-heading text-xl font-bold" style={{ color: INK }}>Asha Example</h3>
                  <span className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: PEACH, color: ACCENT }}><Repeat size={11} aria-hidden /> Recurring</span>
                </div>
              </div>
              <ul className="mt-6 space-y-3 text-[15px]">
                {[
                  'Three sessions, newest first, with what each one cost',
                  `${inr(totalSpent(SAMPLE_CLIENTS[0]))} spent, last visit 18 Sep`,
                  'Your note: prefers evening calls',
                  'Her review of your last session, right on her profile',
                ].map((t) => (
                  <li key={t} className="flex items-start gap-2.5" style={{ color: INK }}>
                    <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: PEACH }}><Check size={10} style={{ color: ACCENT }} aria-hidden /></span>
                    {t}
                  </li>
                ))}
              </ul>
              <p className="mt-6 border-t border-black/5 pt-4 text-sm" style={{ color: MUTED }}>Sample client. Nothing here was typed in by the host except the note.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (three soft cards) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: CREAM_DEEP }}>
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <Reveal as="h2" className={h2}>
              The list <span style={{ color: ACCENT }}>builds itself.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: MUTED }}>
              You take bookings. The client records appear on their own.
            </Reveal>
          </div>
          <ol className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 0.06} className="relative rounded-[10px] bg-white p-7 shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: PEACH, color: ACCENT }}><s.icon size={21} aria-hidden /></span>
                  <span className="rounded-full px-2.5 py-1 font-heading text-xs font-bold" style={{ background: CREAM, color: MUTED }}>Step {i + 1}</span>
                </div>
                <h3 className="mt-6 font-heading text-xl font-bold" style={{ color: INK }}>{s.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: MUTED }}>{s.desc}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════════ 5 · CAPABILITIES (alternating text and image rows) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className={`max-w-3xl ${h2}`}>
            Know who you are talking to <span style={{ color: ACCENT }}>before you say hello.</span>
          </Reveal>
          <div className="mt-16 space-y-20 lg:space-y-24">
            {ROWS.map((r, i) => (
              <div key={r.title} className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
                <Reveal className={i % 2 ? 'lg:order-2' : ''}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ background: PEACH, color: ACCENT }}><r.icon size={20} aria-hidden /></span>
                  <h3 className="mt-5 font-heading text-2xl font-bold sm:text-3xl" style={{ color: INK }}>{r.title}</h3>
                  <p className="mt-3 max-w-lg text-base leading-relaxed" style={{ color: MUTED }}>{r.body}</p>
                </Reveal>
                <Reveal delay={0.06} className={i % 2 ? 'lg:order-1' : ''}>
                  <ImgSlot slot={r.slot} alt={r.alt} className="aspect-[4/3] w-full" />
                </Reveal>
              </div>
            ))}
          </div>
          <Reveal className="mt-16 flex flex-wrap justify-center gap-2">
            {[
              [Repeat, 'Recurring badge'], [UserX, 'Lapsed filter'], [Star, 'Reviews per client'],
              [Download, 'CSV export'], [Lock, 'Only you see your clients'],
            ].map(([Icon, t]) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-black/5 bg-white px-3.5 py-1.5 text-[13px] font-semibold" style={{ color: INK }}>
                <Icon size={13} style={{ color: ACCENT }} aria-hidden /> {t}
              </span>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · THE DIFFERENCE (plan toggle over an avatar grid) ═══════════════ */}
      <section id="plans" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28" style={{ background: CREAM_DEEP }}>
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className={`max-w-3xl ${h2}`}>
            Free to start. <span style={{ color: ACCENT }}>Everyone, when you grow.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed" style={{ color: MUTED }}>
            Both plans build your client list from bookings. The difference is how far back it remembers. Flip between them.
          </Reveal>
          <PlanLens />
          <p className="mt-8 text-sm" style={{ color: MUTED }}>
            Full plan details on the{' '}
            <Link to="/pricing" className="font-semibold underline underline-offset-4" style={{ color: ACCENT }}>pricing page</Link>.
          </p>
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (round-avatar quote cards) ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal as="h2" className={`mx-auto max-w-3xl text-center ${h2}`}>
              Less admin, <span style={{ color: ACCENT }}>more people.</span>
            </Reveal>
            <div className="mt-14 grid gap-5 sm:gap-6 md:grid-cols-3">
              {QUOTES.map((t, i) => (
                <Reveal as="figure" key={t.name} delay={i * 0.06} className="flex flex-col items-center rounded-[10px] border border-black/5 bg-white px-7 pb-8 pt-9 text-center shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
                  <img src={t.avatar} alt="" loading="lazy" className="h-20 w-20 rounded-full object-cover ring-4" style={{ '--tw-ring-color': PEACH }} />
                  <blockquote className="mt-6 text-[15px] leading-relaxed" style={{ color: INK }}>&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-5">
                    <div className="font-heading font-bold" style={{ color: INK }}>{t.name}</div>
                    <div className="text-sm" style={{ color: MUTED }}>{t.role}</div>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ 8 · FAQ (single-card accordion) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: CREAM_DEEP }}>
        <div className="mx-auto max-w-3xl">
          <Reveal as="h2" className={`text-center ${h2}`}>
            Questions, <span style={{ color: ACCENT }}>gently answered.</span>
          </Reveal>
          <div className="mt-12 divide-y divide-black/5 overflow-hidden rounded-[10px] border border-black/5 bg-white shadow-[0_8px_30px_rgba(26,26,26,0.04)]">
            {FAQ.map((f, i) => (
              <details key={f.q} className="group open:bg-[#FFF8F2]" open={i === 0}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 [&::-webkit-details-marker]:hidden">
                  <span className="font-heading text-[16px] font-bold" style={{ color: INK }}>{f.q}</span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-transform group-open:rotate-180" style={{ background: PEACH, color: ACCENT }}>
                    <ChevronDown size={15} aria-hidden />
                  </span>
                </summary>
                <p className="px-6 pb-6 text-[15px] leading-relaxed" style={{ color: MUTED }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 9 · FINAL CTA ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl rounded-[10px] px-6 py-14 text-center sm:px-12" style={{ background: PEACH }}>
          <Reveal className="flex justify-center">
            <AvatarStackPill names={SAMPLE_CLIENTS.map((c) => c.name)} label="Your next client, already remembered" />
          </Reveal>
          <Reveal as="h2" delay={0.04} className="mt-7 font-heading text-[clamp(2.2rem,5vw,3.6rem)] font-extrabold leading-[1.02] tracking-[-0.03em]" style={{ color: INK }}>
            Remember every client. <span style={{ color: ACCENT }}>Type nothing.</span>
          </Reveal>
          <Reveal as="p" delay={0.08} className="mx-auto mt-5 max-w-xl text-base leading-relaxed" style={{ color: MUTED }}>
            Set up your booking page free. Your client list starts with your first booking.
          </Reveal>
          <Reveal delay={0.1} className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-6">
            <PrimaryCta>Start free <ArrowRight size={16} /></PrimaryCta>
            <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:no-underline hover:opacity-80" style={{ color: ACCENT }}>
              See pricing <ArrowRight size={15} />
            </Link>
          </Reveal>
          <nav aria-label="Related features" className="mt-12 flex flex-wrap justify-center gap-2 border-t border-black/5 pt-8">
            {RELATED.map((r) => (
              <Link key={r.to} to={r.to} className="rounded-full border border-black/5 bg-white px-3.5 py-1.5 text-[13px] font-semibold transition-colors hover:no-underline hover:border-[#191919]/40" style={{ color: INK }}>
                {r.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>
    </main>
  );
}
