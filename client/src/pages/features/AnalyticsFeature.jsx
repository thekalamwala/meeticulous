// /features/analytics — bespoke feature page (Oct feature-page rebuild).
//
// STANDALONE page, not the data-driven FeaturePage template. Its static route
// precedes /features/:slug in App.jsx; the featureData.js "analytics" entry stays
// for prerender's slug list and the other pages' "related" cards.
//
// Section order (shared by all 10 bespoke feature pages, each its own design):
//   1 Hero + live demo · 2 Proof strip · 3 Without vs with · 4 How it works ·
//   5 Capabilities · 6 The difference · 7 Testimonials · 8 FAQ · 9 Final CTA
//
// Design system D "Corporate charcoal + amber": slate/charcoal and white, one
// amber accent, tight grid, dashboard-like, monospace tabular numbers. Mechanics
// unique to this page: tabbed mini dashboard with CSS bar chart (hero) · KPI-tile
// facts with no numbers · spreadsheet grid vs dashboard · left-to-right data-flow
// diagram · dense 4-column spec grid · "questions it answers" metric map ·
// compact quote cards · table-row FAQ accordion.
//
// HONESTY: every metric named here exists in the host console today:
//   Earnings (pages/Earnings.jsx + components/EarningsTrendChart.jsx): net, gross,
//     paid bookings, avg booking; 3/6/12-month trend vs previous period; period
//     filter all time / 30d / 90d / this year; revenue by service (net, gross, count).
//   Overview (pages/Dashboard.jsx): upcoming / completed / cancelled / total /
//     pending requests, lifetime earnings, available / clearing / pending balance.
//   Transactions (pages/Transactions.jsx): per-booking payment advice + payout
//     status, date presets today / 7d / 30d / this month, search.
//   Payouts (pages/Payouts.jsx): paid out / in transit / pending completion + history.
//   Customers (pages/ClientsList.jsx, server crmService): bookings, total spent,
//     last booking, Recurring (2+ bookings), Top Spend sort, Lapsed filter
//     (2+ bookings, nothing upcoming, none in 60 days), CSV export. limits.crm:
//     Sloth = 10 most recent clients (v3.167), Sloth Active = all.
// NOT claimed (no code behind it): visitor/conversion funnel, live auto-refresh,
// "advanced reports", rating trends. Hero values are SAMPLE data, labelled so.
//
// IMAGES: empty ImgSlot placeholders (data-img-slot names the photo to supply).
// Global Navbar + Footer come from App.jsx. No hover uplift anywhere.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Check, X, ImageIcon, BarChart3, CalendarCheck, CreditCard,
  LayoutDashboard, Users, Banknote, ChevronRight, Table2,
} from 'lucide-react';
import Reveal from '../../components/home/Reveal';
import Seo from '../../components/common/Seo';
import { ogCard } from '../../config/ogImages';
import { SITE_URL, professionGraphJsonLd } from '../../utils/seo';
import { FREE_PLAN, PREMIUM_PLAN } from '../../data/plans';
import { TESTIMONIALS as ALL_TESTIMONIALS } from '../../data/testimonials';
import PageGuides from '../../components/common/PageGuides';

const START = '/become-a-host';
const CHARCOAL = '#0F172A';   // darkest surface
const SLATE = '#1E293B';      // panels on dark, final CTA
const AMBER = '#F59E0B';      // accent on dark surfaces only
const AMBER_INK = '#B45309';  // amber for text on white / slate-50 (AA)
const ON_DARK = '#F1F5F9';    // headings + body on dark
const FREE_CRM_CLIENTS = 10;  // limits.crm on the free plan (migration v3.167)

/* ─────────────────────────────  HERO DEMO DATA (sample)  ────────────────────────────── */

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const MONTHS = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

// Sample numbers for the illustration only. Not real host data.
export const DEMO_TABS = [
  {
    key: 'revenue',
    label: 'Revenue',
    icon: BarChart3,
    chartTitle: 'Net earnings by month',
    bars: [18200, 22400, 19800, 27600, 31200, 34800].map((v, i) => ({ label: MONTHS[i], value: v, text: inr(v) })),
    tiles: [
      { label: 'Net earnings', value: inr(154000), delta: '▲ 21% vs prev' },
      { label: 'Gross revenue', value: inr(171500), delta: '▲ 19% vs prev' },
      { label: 'Avg booking', value: inr(1925), delta: '▲ 4% vs prev' },
    ],
  },
  {
    key: 'bookings',
    label: 'Bookings',
    icon: CalendarCheck,
    chartTitle: 'Paid bookings by month',
    bars: [11, 13, 10, 15, 16, 15].map((v, i) => ({ label: MONTHS[i], value: v, text: String(v) })),
    tiles: [
      { label: 'Upcoming', value: '7', delta: 'Next: Thu, 4:30 PM' },
      { label: 'Completed', value: '74', delta: 'All time' },
      { label: 'Cancelled', value: '3', delta: 'All time' },
    ],
  },
  {
    key: 'clients',
    label: 'Clients',
    icon: Users,
    chartTitle: 'Top clients by total spent',
    bars: [
      { label: 'R. Mehta', value: 18400 },
      { label: 'A. Iyer', value: 12600 },
      { label: 'S. Khan', value: 9800 },
      { label: 'P. Das', value: 7200 },
      { label: 'N. Rao', value: 4500 },
    ].map((b) => ({ ...b, text: inr(b.value) })),
    tiles: [
      { label: 'Customers', value: '38', delta: 'Booked at least once' },
      { label: 'Top spend', value: inr(18400), delta: 'R. Mehta · Recurring' },
      { label: 'Bookings', value: '9', delta: 'R. Mehta, all time' },
    ],
  },
];

/* ─────────────────────────────  CONTENT  ────────────────────────────── */

const HERO_TRUST = [`Included on ${FREE_PLAN.name}, ₹0`, 'Nothing to log by hand', 'Built for India'];

// Proof strip: styled like KPI tiles, but the "value" is a fact, not a number.
const PROOF = [
  { k: 'Earnings', v: 'Net and gross, side by side' },
  { k: 'Comparison', v: 'Every trend vs the previous period' },
  { k: 'Per service', v: 'Revenue by service, top earner first' },
  { k: 'Input', v: 'Filled from your bookings automatically' },
];

const SHEET_ROWS = [
  ['02 Sep', 'Ritika', 'Strategy call', '1500', 'yes?'],
  ['05 Sep', 'Arun', '', '800', 'check GPay'],
  ['09 Sep', 'Ritika', 'Follow-up', '', 'pending'],
  ['12 Sep', '', 'Audit', '2500', 'yes'],
  ['18 Sep', 'Sana K', 'Strategy call', '1500', ''],
];

const CONTRAST = [
  { old: 'You type every booking in after the call', now: 'Each paid booking feeds the dashboard itself' },
  { old: 'Price, or what actually reached your bank?', now: 'Net and gross shown next to each other' },
  { old: 'Which service pays? Sort, filter, sum, hope', now: 'Revenue by service, sorted for you' },
  { old: 'Was last month better? Open last month’s file', now: 'Every trend compared with the previous period' },
];

const FLOW = [
  { tag: 'Booking', icon: CalendarCheck, title: 'A client books a slot', desc: 'From your booking page, with their phone number and an OTP.', fields: ['Service', 'Date and time', 'Client'] },
  { tag: 'Payment', icon: CreditCard, title: 'They pay at checkout', desc: 'Razorpay verifies the payment and the booking records what was deducted.', fields: ['Price', 'Commission', 'Gateway', 'TDS + TCS'] },
  { tag: 'Dashboard', icon: LayoutDashboard, title: 'Your numbers update', desc: 'The booking counts toward your earnings, booking counts and that client’s record.', fields: ['Earnings', 'Bookings', 'Customers'] },
  { tag: 'Payout', icon: Banknote, title: 'The money moves', desc: 'Payouts shows each transfer as pending, in transit or paid out to your bank.', fields: ['In transit', 'Paid out'] },
];

const SPECS = [
  { area: 'Earnings', title: 'Net earnings', body: 'What you receive after commission, gateway charge, TDS and TCS.' },
  { area: 'Earnings', title: 'Gross revenue', body: 'Your listed price on every paid booking, before deductions.' },
  { area: 'Earnings', title: 'Paid bookings', body: 'How many paid sessions you ran, month by month.' },
  { area: 'Earnings', title: 'Average booking', body: 'Net earnings divided by paid bookings, per month.' },
  { area: 'Earnings', title: '3, 6 or 12 months', body: 'Switch the trend window with one click.' },
  { area: 'Earnings', title: 'Previous period', body: 'A dashed comparison line and the % change vs before.' },
  { area: 'Earnings', title: 'Period filter', body: 'All time, last 30 days, last 90 days or this year.' },
  { area: 'Earnings', title: 'Revenue by service', body: 'Net, gross and booking count for each service.' },
  { area: 'Overview', title: 'Booking counts', body: 'Upcoming, completed, cancelled, total and pending requests.' },
  { area: 'Overview', title: 'Your balance', body: 'Available, clearing and pending, on your dashboard overview.' },
  { area: 'Transactions', title: 'Payment advice', body: 'Price, commission, gateway, TDS and TCS for each booking.' },
  { area: 'Transactions', title: 'Date presets', body: 'Today, 7 days, 30 days or this month, plus search.' },
  { area: 'Payouts', title: 'Payout status', body: 'Paid out, in transit and pending completion, with history.' },
  { area: 'Customers', title: 'Client spend', body: 'Bookings, total spent and last booking for every client.' },
  { area: 'Customers', title: 'Recurring and lapsed', body: 'Repeat clients tagged; regulars who went quiet one filter away.' },
  { area: 'Customers', title: 'CSV export', body: 'Download your client list with spend and booking dates.' },
];

// "Questions it answers": each question lights up the metric cell(s) that answer it.
const MAP = [
  { screen: 'Overview', cells: [{ id: 'counts', label: 'Booking counts' }, { id: 'pending', label: 'Pending requests' }, { id: 'balance', label: 'Balance' }] },
  { screen: 'Earnings', cells: [{ id: 'net', label: 'Net earnings' }, { id: 'avg', label: 'Avg booking' }, { id: 'prev', label: 'vs previous period' }, { id: 'byService', label: 'Revenue by service' }] },
  { screen: 'Transactions', cells: [{ id: 'advice', label: 'Payment advice' }] },
  { screen: 'Payouts', cells: [{ id: 'payout', label: 'Payout status' }] },
  { screen: 'Customers', cells: [{ id: 'topSpend', label: 'Top spend' }, { id: 'lapsed', label: 'Lapsed filter' }] },
];

const QUESTIONS = [
  { q: 'Which service earns the most?', cells: ['byService'], where: 'Earnings · Revenue by service', a: 'Every service listed with its net, gross and number of paid bookings, top earner first. Change the period to see if that holds this year.' },
  { q: 'Am I earning more than last quarter?', cells: ['net', 'prev'], where: 'Earnings · 3-month trend', a: 'Pick the 3-month window and your net earnings are drawn against the 3 months before, with the % change on the tile.' },
  { q: 'What is a booking worth to me, on average?', cells: ['avg'], where: 'Earnings · Avg booking', a: 'Net earnings divided by paid bookings, month by month, so you can see if raising prices actually stuck.' },
  { q: 'Who are my best clients?', cells: ['topSpend'], where: 'Customers · Sort by Top Spend', a: `Sort your customers by total spent. Repeat clients carry a Recurring tag. On ${FREE_PLAN.name} you see your ${FREE_CRM_CLIENTS} most recent clients, on ${PREMIUM_PLAN.name} all of them.` },
  { q: 'Which regulars have gone quiet?', cells: ['lapsed'], where: 'Customers · Lapsed', a: 'One filter shows clients with 2 or more bookings, nothing upcoming, and no booking in the last 60 days.' },
  { q: 'What did I actually keep from that booking?', cells: ['advice'], where: 'Transactions · Payment advice', a: 'Open any booking for its price, commission, gateway charge, TDS and TCS, line by line, with its payout status.' },
  { q: 'When does my money reach the bank?', cells: ['payout', 'balance'], where: 'Payouts', a: 'Each transfer shows as pending completion, in transit or paid out, with the date it clears or settled.' },
  { q: 'What needs my attention this week?', cells: ['counts', 'pending'], where: 'Overview', a: 'Upcoming and pending-request counts sit on your dashboard overview, alongside your next booking.' },
];

const PICKED = ['Sangharata Somkuvar', 'Vishal Chaware', 'Arjun Ravikumar'];
const QUOTES = PICKED.map((n) => ALL_TESTIMONIALS.find((t) => t.name === n)).filter(Boolean);

const FAQ = [
  { q: 'Is analytics included on the free plan?', a: `Yes. Earnings, booking counts, transactions and payouts are on every plan, including ${FREE_PLAN.name} at ₹0. The Customers list shows your ${FREE_CRM_CLIENTS} most recent clients on ${FREE_PLAN.name} and every client on ${PREMIUM_PLAN.name}.` },
  { q: 'Do I need to enter anything by hand?', a: 'No. Every booking and payment made through your Meeticulous page is counted automatically. There is nothing to log.' },
  { q: 'What is the difference between net and gross?', a: 'Gross is your listed price. Net is what you receive after commission, the payment-gateway charge, TDS and TCS. Both are shown side by side.' },
  { q: 'Which date ranges can I look at?', a: 'Trends cover the last 3, 6 or 12 months, each compared with the period before. Earnings can be filtered to all time, 30 days, 90 days or this year, and transactions to today, 7 days, 30 days or this month.' },
  { q: 'Can I export my data?', a: `You can download your client list as a CSV with bookings, total spent and booking dates. On ${FREE_PLAN.name} the export covers your ${FREE_CRM_CLIENTS} most recent clients.` },
  { q: 'Are free (₹0) sessions counted?', a: 'They count toward your booking totals on the overview. Earnings charts count paid bookings only, so a free session never inflates your revenue.' },
  { q: 'Does it track visitors to my page?', a: 'No. This dashboard is about bookings, payments and clients. If you want page-traffic numbers, a web analytics tool can run alongside it.' },
];

const RELATED = [
  { to: '/features/payments', label: 'Payments' },
  { to: '/features/client-management', label: 'Client management' },
  { to: '/features/online-scheduling', label: 'Online scheduling' },
  { to: '/features/booking-pages', label: 'Booking pages' },
];

/* ─────────────────────────────  PIECES  ────────────────────────────── */

function PrimaryCta({ to = START, children, dark = false }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center justify-center gap-2 rounded-[6px] px-6 py-3 text-sm font-semibold shadow-[0_8px_30px_rgba(15,23,42,0.18)] transition-opacity hover:no-underline hover:opacity-90"
      style={dark ? { background: AMBER, color: CHARCOAL } : { background: CHARCOAL, color: '#FFFFFF' }}
    >
      {children}
    </Link>
  );
}

/* Empty image placeholder; the founder supplies the real photo later. */
function ImgSlot({ alt, slot, className = '', dark = false }) {
  const ink = dark ? '241,245,249' : '15,23,42';
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

/* Hero demo: a mini host dashboard. Tabs switch the bar chart + 3 KPI tiles. */
function DashboardDemo() {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduce || paused) return undefined;
    const id = setInterval(() => setTab((t) => (t + 1) % DEMO_TABS.length), 4200);
    return () => clearInterval(id);
  }, [reduce, paused]);

  const t = DEMO_TABS[tab];
  const max = Math.max(...t.bars.map((b) => b.value));
  const horizontal = t.key === 'clients';

  return (
    <div className="mx-auto w-full max-w-[30rem]">
      <div className="overflow-hidden rounded-[10px] border border-white/10 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)]" style={{ background: SLATE }}>
        {/* window bar */}
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 text-[12px] font-semibold text-[#CBD5E1]">
            <LayoutDashboard size={14} aria-hidden /> Host dashboard
          </div>
          <span className="rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: `${AMBER}66`, color: AMBER }}>
            Sample data
          </span>
        </div>

        {/* tabs */}
        <div role="tablist" aria-label="Dashboard demo views" className="grid grid-cols-3 border-b border-white/10">
          {DEMO_TABS.map((d, i) => (
            <button
              key={d.key}
              type="button"
              role="tab"
              id={`ad-tab-${d.key}`}
              aria-selected={tab === i}
              aria-controls="ad-panel"
              onClick={() => { setTab(i); setPaused(true); }}
              className={`flex items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-semibold transition-colors ${tab === i ? 'text-[#F1F5F9]' : 'border-transparent text-[#94A3B8] hover:text-[#E2E8F0]'}`}
              style={tab === i ? { borderColor: AMBER } : undefined}
            >
              <d.icon size={13} aria-hidden /> {d.label}
            </button>
          ))}
        </div>

        <div id="ad-panel" role="tabpanel" aria-labelledby={`ad-tab-${t.key}`} aria-live="polite" className="p-4">
          {/* KPI tiles */}
          <div className="grid grid-cols-3 gap-2">
            {t.tiles.map((k) => (
              <div key={k.label} className="rounded-[6px] border border-white/10 px-2.5 py-2.5" style={{ background: CHARCOAL }}>
                <div className="truncate text-[10px] uppercase tracking-[0.1em] text-[#94A3B8]">{k.label}</div>
                <div className="mt-1 font-mono text-[15px] font-bold tabular-nums text-[#F1F5F9] sm:text-base">{k.value}</div>
                <div className="mt-0.5 truncate text-[10px] text-[#94A3B8]">{k.delta}</div>
              </div>
            ))}
          </div>

          {/* chart */}
          <div className="mt-4 rounded-[6px] border border-white/10 p-3.5" style={{ background: CHARCOAL }}>
            <div className="flex items-center justify-between text-[11px] text-[#94A3B8]">
              <span className="font-semibold text-[#CBD5E1]">{t.chartTitle}</span>
              <span className="font-mono">{horizontal ? 'Top spend' : '6M'}</span>
            </div>
            {horizontal ? (
              <ul className="mt-3 space-y-2">
                {t.bars.map((b) => (
                  <li key={b.label} className="grid grid-cols-[4.5rem_1fr_4rem] items-center gap-2 text-[11px]">
                    <span className="truncate text-[#CBD5E1]">{b.label}</span>
                    <span className="h-2.5 rounded-[2px] bg-white/5">
                      <span className="block h-full rounded-[2px] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${(b.value / max) * 100}%`, background: AMBER }} />
                    </span>
                    <span className="text-right font-mono tabular-nums text-[#E2E8F0]">{b.text}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="mt-3 grid h-36 grid-cols-6 gap-2 border-b border-white/10">
                {t.bars.map((b, i) => (
                  <div key={b.label} className="flex h-full flex-col justify-end">
                    <span className="mb-1 text-center font-mono text-[9px] tabular-nums text-[#94A3B8]">{b.text}</span>
                    <span
                      className="block rounded-t-[2px] transition-[height] duration-500 motion-reduce:transition-none"
                      style={{ height: `${(b.value / max) * 78}%`, background: i === t.bars.length - 1 ? AMBER : '#475569' }}
                    />
                  </div>
                ))}
              </div>
            )}
            {!horizontal && (
              <div className="mt-1.5 grid grid-cols-6 gap-2 text-center font-mono text-[10px] text-[#94A3B8]">
                {t.bars.map((b) => <span key={b.label}>{b.label}</span>)}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-[11px] text-[#94A3B8]">Illustration of the host dashboard. All figures are sample data.</p>
    </div>
  );
}

/* Without: a hand-kept spreadsheet. */
function SheetMock() {
  return (
    <div className="overflow-hidden rounded-[10px] border border-black/10 bg-white font-mono text-[11px] shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <div className="flex items-center gap-2 border-b border-black/10 bg-[#F8FAFC] px-3 py-2 text-[11px] text-[#64748B]">
        <Table2 size={13} aria-hidden /> bookings_sept_FINAL(2).xlsx
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[22rem] border-collapse text-left">
          <thead>
            <tr className="bg-[#F8FAFC] text-[#64748B]">
              <th className="w-7 border border-black/5 px-1.5 py-1 font-normal" />
              {['A Date', 'B Client', 'C Service', 'D ₹', 'E Paid?'].map((h) => (
                <th key={h} className="border border-black/5 px-2 py-1 font-normal">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="text-[#334155]">
            {SHEET_ROWS.map((r, i) => (
              <tr key={r[0]}>
                <td className="border border-black/5 bg-[#F8FAFC] px-1.5 py-1 text-center text-[#94A3B8]">{i + 2}</td>
                {r.map((c, j) => (
                  <td key={j} className={`border border-black/5 px-2 py-1 ${c === '' ? 'bg-[#FEF3C7]/60' : ''} ${j === 3 ? 'text-right tabular-nums' : ''}`}>{c || ' '}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="border border-black/5 bg-[#F8FAFC] px-1.5 py-1 text-center text-[#94A3B8]">7</td>
              <td colSpan={3} className="border border-black/5 px-2 py-1 text-right text-[#64748B]">total?</td>
              <td className="border border-black/5 px-2 py-1 text-right text-[#B91C1C]">=SUM(D2:D6)</td>
              <td className="border border-black/5 px-2 py-1" />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* With: the same month, read off the dashboard. */
function DashMock() {
  const rows = [['Strategy call', 4, inr(5700)], ['Audit', 1, inr(2380)], ['Follow-up', 1, inr(760)]];
  return (
    <div className="overflow-hidden rounded-[10px] text-[#F1F5F9] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.5)]" style={{ background: CHARCOAL }}>
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[11px] text-[#94A3B8]">
        <span className="flex items-center gap-2"><BarChart3 size={13} aria-hidden /> Earnings · September</span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em]" style={{ color: AMBER }}>Sample</span>
      </div>
      <div className="grid grid-cols-3 gap-px bg-white/10">
        {[['Net', inr(8840)], ['Gross', inr(9800)], ['Paid', '6']].map(([l, v]) => (
          <div key={l} className="px-3 py-3" style={{ background: CHARCOAL }}>
            <div className="text-[10px] uppercase tracking-[0.1em] text-[#94A3B8]">{l}</div>
            <div className="mt-1 font-mono text-base font-bold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 px-3 py-2.5">
        <div className="text-[10px] uppercase tracking-[0.1em] text-[#94A3B8]">Revenue by service</div>
        {rows.map(([s, n, v]) => (
          <div key={s} className="mt-1.5 flex items-center justify-between font-mono text-[11px]">
            <span className="text-[#CBD5E1]">{s} <span className="text-[#64748B]">· {n}</span></span>
            <span className="tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* The difference: click a question, the metric that answers it lights up. */
function QuestionMap() {
  const [active, setActive] = useState(0);
  const q = QUESTIONS[active];
  return (
    <div className="mt-14 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
      <div role="group" aria-label="Questions the dashboard answers" className="flex flex-col gap-1.5">
        {QUESTIONS.map((item, i) => (
          <button
            key={item.q}
            type="button"
            aria-pressed={active === i}
            onClick={() => setActive(i)}
            className={`flex items-center justify-between gap-3 rounded-[6px] border px-4 py-3 text-left text-sm font-semibold transition-colors ${active === i ? 'text-[#0F172A]' : 'border-white/10 text-[#CBD5E1] hover:border-white/25 hover:text-[#F1F5F9]'}`}
            style={active === i ? { background: AMBER, borderColor: AMBER } : undefined}
          >
            <span>{item.q}</span>
            <ChevronRight size={15} className="shrink-0" aria-hidden />
          </button>
        ))}
      </div>

      <div>
        <div className="grid gap-px overflow-hidden rounded-[10px] border border-white/10 bg-white/10 sm:grid-cols-2">
          {MAP.map((group) => (
            <div key={group.screen} className="p-4" style={{ background: SLATE }}>
              <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">{group.screen}</div>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {group.cells.map((c) => {
                  const on = q.cells.includes(c.id);
                  return (
                    <span
                      key={c.id}
                      data-metric={c.id}
                      data-active={on ? 'true' : 'false'}
                      className={`rounded-[5px] border px-2.5 py-1.5 text-xs font-medium transition-colors ${on ? 'text-[#0F172A]' : 'border-white/10 text-[#94A3B8]'}`}
                      style={on ? { background: AMBER, borderColor: AMBER } : undefined}
                    >
                      {c.label}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div aria-live="polite" className="mt-5 rounded-[10px] border border-white/10 p-5" style={{ background: SLATE }}>
          <div className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: AMBER }}>Where: {q.where}</div>
          <p className="mt-2 text-[15px] leading-relaxed text-[#E2E8F0]">{q.a}</p>
        </div>
      </div>
    </div>
  );
}

/* FAQ: table-like rows, one open at a time. */
function FaqRows() {
  const [open, setOpen] = useState(0);
  return (
    <div className="mt-12 overflow-hidden rounded-[10px] border border-black/10">
      <div className="hidden grid-cols-[5rem_1fr_2.5rem] border-b border-black/10 bg-[#F8FAFC] px-5 py-2.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B] sm:grid">
        <span>Ref</span><span>Question</span><span />
      </div>
      {FAQ.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="border-b border-black/10 last:border-b-0">
            <h3 className="m-0">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`af-a-${i}`}
                id={`af-q-${i}`}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className={`grid w-full grid-cols-[3.5rem_1fr_2rem] items-center px-5 py-4 text-left transition-colors sm:grid-cols-[5rem_1fr_2.5rem] ${isOpen ? 'bg-[#F8FAFC]' : 'bg-white hover:bg-[#F8FAFC]'}`}
              >
                <span className="font-mono text-xs font-semibold tabular-nums" style={{ color: AMBER_INK }}>Q.{String(i + 1).padStart(2, '0')}</span>
                <span className="font-heading text-[15px] font-bold text-[#0F172A] sm:text-base">{f.q}</span>
                <span aria-hidden className="justify-self-end font-mono text-lg leading-none text-[#64748B]">{isOpen ? '−' : '+'}</span>
              </button>
            </h3>
            <div id={`af-a-${i}`} role="region" aria-labelledby={`af-q-${i}`} hidden={!isOpen} className="bg-[#F8FAFC] px-5 pb-5 sm:pl-[6.25rem]">
              <p className="pl-[3.5rem] text-[15px] leading-relaxed text-[#475569] sm:pl-0">{f.a}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────  PAGE  ────────────────────────────── */

export default function AnalyticsFeature() {
  const canonical = `${SITE_URL}/features/analytics`;
  const seo = {
    title: 'Booking Analytics for Freelancers & Coaches | Meeticulous',
    description: 'Booking analytics for freelancers and coaches in India. See net and gross earnings, paid bookings, revenue by service and your top clients in one dashboard. Free to start.',
  };
  const jsonLd = professionGraphJsonLd({
    canonical,
    name: seo.title,
    description: seo.description,
    breadcrumbName: 'Analytics',
    serviceType: 'Booking, earnings and client analytics for appointment-based businesses',
    image: ogCard('features-analytics'),
    steps: FLOW.map((s) => ({ title: s.title, desc: s.desc })),
    faqs: FAQ,
    appOffers: [
      { price: 0, name: `${FREE_PLAN.name} plan` },
      { price: PREMIUM_PLAN.yearly, name: `${PREMIUM_PLAN.name} plan (yearly)` },
    ],
  });

  return (
    <main className="overflow-x-clip bg-white text-[#0F172A]">
      <Seo
        title={seo.title}
        description={seo.description}
        canonical={canonical}
        robots="index, follow, max-image-preview:large, max-snippet:-1"
        siteName="Meeticulous"
        locale="en_IN"
        themeColor={CHARCOAL}
        ogTitle="Know which service pays. Without a spreadsheet."
        ogDescription={seo.description}
        image={ogCard('features-analytics')}
        jsonLd={jsonLd}
      />

      {/* ═══════════════ 1 · HERO (tabbed mini dashboard) ═══════════════ */}
      <section className="relative overflow-hidden px-5 pb-20 pt-8 sm:px-8 lg:pb-28 lg:pt-6 lg:flex lg:min-h-[calc(100svh-57px)] lg:flex-col lg:justify-center" style={{ background: CHARCOAL, color: ON_DARK }}>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div className="relative mx-auto grid w-full max-w-6xl items-start gap-10 lg:items-center lg:gap-14 lg:grid-cols-[1fr_1fr]">
          <div>
            <nav aria-label="Breadcrumb" className="text-xs text-[#94A3B8]">
              <Link to="/" className="text-[#94A3B8] hover:text-[#F1F5F9] hover:no-underline">Home</Link>
              <span aria-hidden className="mx-2">/</span>
              <span>Features</span>
              <span aria-hidden className="mx-2">/</span>
              <span aria-current="page" className="text-[#E2E8F0]">Analytics</span>
            </nav>
            <Reveal instant className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-[#CBD5E1]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER }} aria-hidden /> Booking analytics
            </Reveal>
            <Reveal as="h1" instant className="mt-4 font-heading text-[clamp(2.1rem,3.7vw,3.2rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#F1F5F9]">
              Booking analytics, <span style={{ color: AMBER }}>without the spreadsheet.</span>
            </Reveal>
            <Reveal as="p" instant delay={0.05} className="mt-4 max-w-xl text-base leading-relaxed text-[#CBD5E1] lg:text-[17px]">
              Earnings, paid bookings, revenue by service and your top clients, for freelancers and coaches. Every number comes straight from your bookings.
            </Reveal>
            <Reveal instant delay={0.1} className="mt-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta dark>Start free <ArrowRight size={16} /></PrimaryCta>
              <a href="#questions" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F1F5F9] hover:no-underline hover:opacity-80">
                See what it answers <ArrowRight size={15} />
              </a>
            </Reveal>
            <Reveal instant delay={0.14} className="mt-6 flex flex-wrap gap-x-6 gap-y-2">
              {HERO_TRUST.map((t) => (
                <span key={t} className="flex items-center gap-1.5 text-[13px] text-[#94A3B8]">
                  <Check size={14} style={{ color: AMBER }} aria-hidden /> {t}
                </span>
              ))}
            </Reveal>
          </div>
          <Reveal instant delay={0.12}>
            <DashboardDemo />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 2 · PROOF STRIP (KPI-tile facts, no numbers) ═══════════════ */}
      <section className="border-b border-black/5 bg-[#F8FAFC] px-5 py-10 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PROOF.map((p) => (
            <div key={p.k} className="rounded-[6px] border border-black/5 bg-white px-5 py-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">{p.k}</span>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: AMBER_INK }} aria-hidden />
              </div>
              <div className="mt-2 font-heading text-[15px] font-bold leading-snug text-[#0F172A]">{p.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════ 3 · WITHOUT vs WITH (spreadsheet grid vs dashboard) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Your bookings already know <span style={{ color: AMBER_INK }}>which service pays.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed text-[#64748B]">
            Most freelancers keep a sheet, or nothing. Here is the same month of sessions, kept by hand and read off the dashboard.
          </Reveal>

          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <Reveal>
              <div className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]"><X size={14} aria-hidden /> Without</div>
              <SheetMock />
            </Reveal>
            <Reveal delay={0.06}>
              <div className="mb-3 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: AMBER_INK }}><Check size={14} aria-hidden /> With Meeticulous</div>
              <DashMock />
            </Reveal>
          </div>
          <p className="mt-3 text-[11px] text-[#64748B]">Illustration. Figures are sample data.</p>

          <div className="mt-10 grid border-t border-black/10 md:grid-cols-2">
            {CONTRAST.map((c) => (
              <div key={c.now} className="grid grid-cols-1 gap-2 border-b border-black/10 py-4 md:grid-cols-2 md:gap-6 md:pr-6">
                <p className="flex items-start gap-2 text-sm text-[#64748B]"><X size={15} className="mt-0.5 shrink-0" aria-hidden /><span><span className="sr-only">Without: </span>{c.old}</span></p>
                <p className="flex items-start gap-2 text-sm font-medium text-[#0F172A]"><Check size={15} className="mt-0.5 shrink-0" style={{ color: AMBER_INK }} aria-hidden /><span><span className="sr-only">With Meeticulous: </span>{c.now}</span></p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════ 4 · HOW IT WORKS (left-to-right data flow) ═══════════════ */}
      <section className="bg-[#F8FAFC] px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            One booking in, <span style={{ color: AMBER_INK }}>every number updated.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed text-[#64748B]">
            There is no import step. The data travels with the booking, from the slot to the payout.
          </Reveal>

          <ol className="mt-14 grid gap-3 lg:grid-cols-4 lg:gap-0">
            {FLOW.map((s, i) => (
              <Reveal as="li" key={s.tag} delay={i * 0.06} className="relative flex lg:pr-6">
                <div className="flex-1 rounded-[6px] border border-black/5 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: AMBER_INK }}>{String(i + 1).padStart(2, '0')} · {s.tag}</span>
                    <s.icon size={16} className="text-[#64748B]" aria-hidden />
                  </div>
                  <h3 className="mt-3 font-heading text-lg font-bold text-[#0F172A]">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#64748B]">{s.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {s.fields.map((f) => (
                      <span key={f} className="rounded-full border border-black/10 bg-[#F8FAFC] px-2.5 py-0.5 font-mono text-[10px] text-[#334155]">{f}</span>
                    ))}
                  </div>
                </div>
                {i < FLOW.length - 1 && (
                  <span aria-hidden className="absolute right-0 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center text-[#94A3B8] lg:flex">
                    <ChevronRight size={18} />
                  </span>
                )}
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ═══════════════ 5 · CAPABILITIES (dense 4-column spec grid) ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              The full spec, <span style={{ color: AMBER_INK }}>screen by screen.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="max-w-sm text-sm leading-relaxed text-[#64748B]">
              Everything below is on every plan. The Customers list shows your {FREE_CRM_CLIENTS} most recent clients on {FREE_PLAN.name}, and all of them on {PREMIUM_PLAN.name}.
            </Reveal>
          </div>

          <div className="mt-12 grid gap-px overflow-hidden rounded-[10px] border border-black/10 bg-black/10 sm:grid-cols-2 lg:grid-cols-4">
            {SPECS.map((s) => (
              <div key={s.title} className="bg-white p-5">
                <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color: AMBER_INK }}>{s.area}</div>
                <h3 className="mt-2 font-heading text-[15px] font-bold text-[#0F172A]">{s.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[#64748B]">{s.body}</p>
              </div>
            ))}
          </div>

          <Reveal className="mt-10">
            <ImgSlot slot="analytics-earnings-screen" alt="The Meeticulous Earnings screen with the monthly trend chart and revenue by service" className="aspect-[21/9] w-full" />
          </Reveal>
        </div>
      </section>

      {/* ═══════════════ 6 · THE DIFFERENCE (questions it answers) ═══════════════ */}
      <section id="questions" className="scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28" style={{ background: CHARCOAL, color: ON_DARK }}>
        <div className="mx-auto max-w-6xl">
          <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-[#F1F5F9] sm:text-5xl">
            Ask it a question. <span style={{ color: AMBER }}>See where the answer lives.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 max-w-2xl text-base leading-relaxed text-[#CBD5E1]">
            These are the questions freelancers and coaches ask about their own business. Pick one and the metric that answers it lights up.
          </Reveal>
          <QuestionMap />
        </div>
      </section>

      {/* ═══════════════ 7 · TESTIMONIALS (compact cards) ═══════════════ */}
      {QUOTES.length > 0 && (
        <section className="bg-[#F8FAFC] px-5 py-20 sm:px-8 lg:py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal as="h2" className="max-w-3xl font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
              From hosts who stopped <span style={{ color: AMBER_INK }}>chasing the numbers.</span>
            </Reveal>
            <div className="mt-12 grid gap-5 sm:gap-6 md:grid-cols-3">
              {QUOTES.map((t, i) => (
                <Reveal as="figure" key={t.name} delay={i * 0.05} className="flex flex-col justify-between rounded-[6px] border border-black/5 bg-white p-6 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
                  <blockquote className="text-[15px] leading-relaxed text-[#0F172A]">&ldquo;{t.quote}&rdquo;</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-black/5 pt-4">
                    <img src={t.avatar} alt="" loading="lazy" className="h-9 w-9 rounded-full object-cover" />
                    <div>
                      <div className="text-sm font-semibold text-[#0F172A]">{t.name}</div>
                      <div className="font-mono text-[11px] text-[#64748B]">{t.role}</div>
                    </div>
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════ 8 · FAQ (table-row accordion) ═══════════════ */}
      <PageGuides />

      <section id="faq" className="px-5 py-20 sm:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl">
          <Reveal as="h2" className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">
            Analytics questions, <span style={{ color: AMBER_INK }}>answered.</span>
          </Reveal>
          <Reveal as="p" delay={0.05} className="mt-5 text-base text-[#64748B]">
            Plan details are on our <Link to="/pricing" className="font-semibold underline underline-offset-4" style={{ color: AMBER_INK }}>pricing page</Link>.
          </Reveal>
          <FaqRows />
        </div>
      </section>

      {/* ═══════════════ 9 · FINAL CTA ═══════════════ */}
      <section className="px-5 py-20 sm:px-8 lg:py-28" style={{ background: SLATE, color: ON_DARK }}>
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Reveal as="h2" className="font-heading text-[clamp(2.2rem,5vw,3.8rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#F1F5F9]">
              Stop guessing. <span style={{ color: AMBER }}>Read your numbers.</span>
            </Reveal>
            <Reveal as="p" delay={0.05} className="mt-6 max-w-xl text-base leading-relaxed text-[#CBD5E1]">
              Set up your booking page free. Your first paid booking starts the chart.
            </Reveal>
            <Reveal delay={0.1} className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <PrimaryCta dark>Start free <ArrowRight size={16} /></PrimaryCta>
              <Link to="/pricing" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F1F5F9] hover:no-underline hover:opacity-80">
                See pricing <ArrowRight size={15} />
              </Link>
            </Reveal>
          </div>
          <Reveal delay={0.08}>
            <ImgSlot slot="analytics-host-reviewing" alt="A freelancer reviewing their monthly earnings on a laptop" className="aspect-[4/3] w-full" dark />
          </Reveal>
        </div>
        <nav aria-label="Related features" className="mx-auto mt-14 flex max-w-6xl flex-wrap gap-x-6 gap-y-2 border-t border-white/10 pt-8 text-sm text-[#94A3B8]">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em]">Works with</span>
          {RELATED.map((r) => (
            <Link key={r.to} to={r.to} className="text-[#E2E8F0] underline decoration-white/20 underline-offset-4 hover:text-[#F1F5F9] hover:decoration-white">{r.label}</Link>
          ))}
        </nav>
      </section>
    </main>
  );
}
