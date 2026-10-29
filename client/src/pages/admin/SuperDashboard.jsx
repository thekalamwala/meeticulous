import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { adminGetStats, adminGetBookings, adminGetUsers, adminOpsSummary, adminGetProviderPlanAnalytics, adminGetProviderOverview, adminGetRevenueTrend, adminGetRevenueBreakdown } from '../../services/api';
import Ic from '../../components/admin/Ic';
import { IC } from '../../components/admin/adminNav';
import AdminInsights from './AdminInsights';
import { PageHeader, Card, Badge } from '../../components/admin/ui';

const TABS = [
  { id: 'overview',   label: 'Overview',        to: '/super-dashboard' },
  { id: 'revenue',    label: 'Revenue',          to: '/super-dashboard/revenue' },
  { id: 'providers',  label: 'Hosts',            to: '/super-dashboard/providers' },
  { id: 'bookings',   label: 'Bookings',         to: '/super-dashboard/bookings' },
  { id: 'pending',    label: 'Pending Actions',  to: '/super-dashboard/pending' },
  { id: 'insights',   label: 'Insights',         to: '/super-dashboard/insights' },
];

const STATUS_DOT = {
  confirmed: 'bg-green-500',
  pending:   'bg-yellow-400',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-400',
};

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

// Host plan → display label. normalizeSlug already collapses explorer/legacy to
// the free tier, so anything not creator/professional/supreme reads as Starter.
const planLabelOf = (p) => ({ creator: 'Host+', professional: 'Studio', supreme: 'Supreme' }[(p || '').toLowerCase()] || 'Starter');

// ── Color-coded stat card ─────────────────────────────────────
// Mini title on top, then a linear icon chip (pastel tint of the hue) beside the
// value. Whole card is a soft tint of the same hue — mode-agnostic via hex+alpha.
const ColorStat = ({ label, value, icon, hex, to }) => {
  const inner = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: hex }}>{label}</p>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${hex}22`, color: hex }}>
          <Ic d={IC[icon]} size={18} />
        </span>
        <span className="text-2xl font-bold adm-t1 tracking-tight tabular-nums">{value}</span>
      </div>
    </>
  );
  const cls = 'rounded-2xl p-5 border transition-all hover:shadow-sm block';
  const style = { background: `${hex}0F`, borderColor: `${hex}2E` };
  return to
    ? <Link to={to} className={`${cls} group`} style={style}>{inner}</Link>
    : <div className={cls} style={style}>{inner}</div>;
};

// ── Empty state ───────────────────────────────────────────────
const Empty = ({ icon, title, desc }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="w-14 h-14 rounded-2xl bg-[var(--adm-hover)] flex items-center justify-center mb-4">
      <Ic d={IC[icon]} size={22} className="adm-t3" />
    </div>
    <p className="text-base font-semibold adm-t2 mb-1">{title}</p>
    <p className="text-sm adm-t3 max-w-xs">{desc}</p>
  </div>
);

// ── Overview Tab ──────────────────────────────────────────────
const OverviewTab = ({ stats, ops }) => {
  const s = stats || {};
  const cards = [
    { label: 'Platform Revenue', value: inr(s.revenue), icon: 'rupee',    hex: '#2E1065', to: '/super-dashboard/revenue' },
    { label: 'Total Bookings',   value: (s.bookings || 0).toLocaleString(), icon: 'calendar', hex: '#1DA1F2', to: '/super-dashboard/bookings' },
    { label: 'Active Hosts',     value: (s.vendors || 0).toLocaleString(),  icon: 'building', hex: '#2E1065', to: '/super-dashboard/providers' },
    { label: 'Total Users',      value: (s.users || 0).toLocaleString(),    icon: 'users',    hex: '#059669' },
    { label: 'Active Services',  value: (s.services || 0).toLocaleString(), icon: 'grid',     hex: '#DB2777', to: '/admin/services' },
    { label: 'Pending Actions',  value: (ops?.totalAttention ?? 0).toLocaleString(), icon: 'alert', hex: ops?.totalAttention ? '#DC2626' : '#D97706', to: '/super-dashboard/pending' },
  ];

  const manage = [
    { title: 'Manage Bookings',  desc: 'View, update status, resolve disputes',    to: '/admin/bookings',        icon: 'calendar', hex: '#1DA1F2' },
    { title: 'Manage Services',  desc: 'Review and moderate provider services',    to: '/admin/services',        icon: 'grid',     hex: '#DB2777' },
    { title: 'Payouts',          desc: 'Approve and release host payout requests', to: '/admin/finance/payouts', icon: 'rupee',    hex: '#2E1065' },
    { title: 'Platform Settings',desc: 'Configure fees, maintenance, branding',    to: '/admin/settings',        icon: 'activity', hex: '#059669' },
    { title: 'Support Tickets',  desc: 'Respond to user issues and disputes',      to: '/admin/support/tickets', icon: 'clock',    hex: '#D97706' },
  ];

  return (
    <div className="space-y-7">
      {/* Stat cards — 4 per row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map(c => <ColorStat key={c.label} {...c} />)}
      </div>

      {/* Quick navigation — 3 columns × 2 rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {manage.map(item => (
          <Link key={item.to} to={item.to}
            className="flex items-center gap-4 adm-card rounded-2xl p-4 hover:shadow-sm transition-all group">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${item.hex}22`, color: item.hex }}>
              <Ic d={IC[item.icon]} size={17} />
            </div>
            <div className="min-w-0">
              <p className="font-semibold adm-t1 text-sm">{item.title}</p>
              <p className="text-[12px] adm-t3 truncate mt-0.5">{item.desc}</p>
            </div>
            <Ic d={IC.arrow} size={14} className="adm-t3 ml-auto group-hover:text-gray-500 transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
};

// ══ Revenue trend chart (dependency-free SVG line/area) ═══════
const TREND_GRAN = [['weekly', 'Weekly'], ['monthly', 'Monthly'], ['quarterly', 'Quarterly']];
const ACCENT = '#047857'; // Gross line = same green as the Gross Revenue card
// Tooltip rows — one per revenue stream, hue-dotted.
const TIP_ROWS = [
  { key: 'gross',        label: 'Gross Revenue',        hex: '#047857' },
  { key: 'total',        label: 'Total Revenue',        hex: '#059669' },
  { key: 'subscription', label: 'Subscription Revenue', hex: '#2E1065' },
  { key: 'platformFee',  label: 'Platform Fee Revenue', hex: '#2E1065' },
  { key: 'tax',          label: 'Govt Tax',             hex: '#DC2626' },
];
// Compact ₹ for axis labels: 1.2k / 3.4L.
const inrShort = (n) => {
  const v = Number(n) || 0;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `₹${(v / 1e3).toFixed(1)}k`;
  return `₹${Math.round(v)}`;
};

const RevenueTrendChart = () => {
  const [data, setData] = useState(null);
  const [gran, setGran] = useState('monthly');
  const [err, setErr]   = useState(false);
  const [hover, setHover]   = useState(null); // transient (mouse)
  const [pinned, setPinned] = useState(null); // sticky (click)

  useEffect(() => {
    adminGetRevenueTrend().then(r => setData(r.data)).catch(() => setErr(true));
  }, []);
  useEffect(() => { setHover(null); setPinned(null); }, [gran]);

  const series = data?.[gran] || [];
  const W = 720, H = 260, padL = 52, padR = 12, padT = 16, padB = 30;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const max = Math.max(1, ...series.map(d => d.value));
  const n = series.length;
  const x = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const y = (v) => padT + plotH - (v / max) * plotH;
  const pts = series.map((d, i) => [x(i), y(d.value)]);
  const linePath = pts.map((p, i) => `${i ? 'L' : 'M'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const areaPath = pts.length
    ? `${linePath} L ${pts[pts.length - 1][0].toFixed(1)} ${padT + plotH} L ${pts[0][0].toFixed(1)} ${padT + plotH} Z`
    : '';
  const total = series.reduce((t, d) => t + d.value, 0);

  const active = hover ?? pinned;
  const ad = active != null ? series[active] : null;
  const ap = active != null ? pts[active] : null;
  // Every Nth x-label so ticks don't collide (12 weekly points).
  const labelEvery = n > 8 ? 2 : 1;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="text-sm font-semibold adm-t1">Gross revenue trend</p>
          <p className="text-xs adm-t3 mt-0.5">Gross = Total + tax, per period · since 30 Jun 2026 · tap a point for the breakdown</p>
        </div>
        <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
          {TREND_GRAN.map(([k, lbl]) => (
            <button key={k} onClick={() => setGran(k)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${gran === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      <p className="text-2xl font-bold adm-t1 tabular-nums mt-2 mb-4">{inr(total)}
        <span className="text-[11px] font-medium adm-t3 ml-2">gross in view</span></p>

      {err ? (
        <div className="py-10 text-center text-[12px] adm-t3">Couldn't load trend data.</div>
      ) : !data ? (
        <div className="py-10 text-center text-[12px] adm-t3">Loading trend…</div>
      ) : total === 0 ? (
        <div className="py-10 text-center text-[12px] adm-t3">No revenue in this window yet.</div>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }}
            onMouseLeave={() => setHover(null)}>
            <defs>
              <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor={ACCENT} stopOpacity="0.20" />
                <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
              </linearGradient>
            </defs>
            {/* gridlines + y-axis value labels */}
            {[0, 0.25, 0.5, 0.75, 1].map(f => (
              <g key={f}>
                <line x1={padL} x2={W - padR} y1={padT + plotH * f} y2={padT + plotH * f}
                  stroke="currentColor" className="adm-t3" strokeOpacity="0.12" strokeWidth="1" />
                <text x={padL - 8} y={padT + plotH * f + 3} textAnchor="end" className="adm-t3"
                  fill="currentColor" style={{ fontSize: 10 }}>{inrShort(max * (1 - f))}</text>
              </g>
            ))}
            <path d={areaPath} fill="url(#revFill)" />
            <path d={linePath} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {/* active guide line */}
            {ap && <line x1={ap[0]} x2={ap[0]} y1={padT} y2={padT + plotH} stroke={ACCENT} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3" />}
            {pts.map((p, i) => (
              <g key={i}>
                {i % labelEvery === 0 && (
                  <text x={p[0]} y={H - 10} textAnchor="middle" className="adm-t3" fill="currentColor" style={{ fontSize: 10 }}>
                    {series[i].label}
                  </text>
                )}
                <circle cx={p[0]} cy={p[1]} r={active === i ? 5 : 3} fill={ACCENT} stroke="#fff" strokeWidth={active === i ? 2 : 0} />
                {/* fat invisible hit target */}
                <circle cx={p[0]} cy={p[1]} r="16" fill="transparent" style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setPinned(pinned === i ? null : i)} />
              </g>
            ))}
          </svg>

          {/* Pretty light tooltip — positioned over the active point */}
          {ad && ap && (
            <div className="absolute z-20 pointer-events-none"
              style={{ left: `${(ap[0] / W) * 100}%`, top: `${(ap[1] / H) * 100}%`,
                transform: `translate(${ap[0] > W * 0.6 ? '-100%' : '0'}, calc(-100% - 12px))` }}>
              <div className="rounded-xl border adm-border bg-[var(--adm-card)] shadow-xl px-3.5 py-3 min-w-[180px]"
                style={{ backdropFilter: 'blur(4px)' }}>
                <p className="text-[11px] font-semibold adm-t2 mb-2">{ad.label}</p>
                <div className="space-y-1.5">
                  {TIP_ROWS.map(r => (
                    <div key={r.key} className="flex items-center gap-2 text-[12px]">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: r.hex }} />
                      <span className="adm-t3 flex-1">{r.label}</span>
                      <span className="font-semibold adm-t1 tabular-nums">{inr(ad[r.key] ?? 0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
};

// ── Revenue stat card ─────────────────────────────────────────
// Title on top; below, a SOLID hue-filled icon box (white glyph) beside the
// hue-matched value. Static — no tooltip.
const RevCard = ({ label, value, hex, icon = 'rupee', to }) => {
  const inner = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-wide adm-t3 leading-tight mb-2">{label}</p>
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-sm"
          style={{ background: hex }}>
          <Ic d={IC[icon] || IC.rupee} size={18} />
        </span>
        <span className="text-2xl font-bold tabular-nums" style={{ color: hex }}>{value}</span>
      </div>
    </>
  );
  return to
    ? <Link to={to} className="block hover:shadow-sm transition-all rounded-2xl"><Card>{inner}</Card></Link>
    : <Card>{inner}</Card>;
};

// ── Revenue Tab ───────────────────────────────────────────────
// 10 cards over 3 rows: revenue streams → lifetime averages → 30-Jun cohort LTV.
const inr0 = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

const RevenueTab = ({ stats }) => {
  const [rb, setRb] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => { adminGetRevenueBreakdown().then(r => setRb(r.data)).catch(() => setErr(true)); }, []);
  const b = rb || {};

  // Loading shows "…", a failed fetch shows "—" — never a misleading ₹0.
  const loading = !rb && !err;
  const money = (v) => (loading ? '…' : err ? '—' : inr(v));
  const money0 = (v) => (loading ? '…' : err ? '—' : inr0(v));

  // Row 1 — revenue streams. Gross = Total + taxes; Total = net income (money kept).
  const revenueCards = [
    { label: 'Gross Revenue',        value: money(b.grossRevenue),        hex: '#047857' },
    { label: 'Total Revenue',        value: money(b.totalRevenue),        hex: '#059669' },
    { label: 'Subscription Revenue', value: money(b.subscriptionRevenue), hex: '#2E1065' },
    { label: 'Platform Fee Revenue', value: money(b.platformFeeRevenue),  hex: '#2E1065' },
  ];
  // Row 2 — average values (rounded to whole ₹).
  const avgCards = [
    { label: 'Avg Revenue / Host',    value: money0(b.ltvPerHost),        hex: '#1DA1F2' },
    { label: 'Avg Revenue / Guest',   value: money0(b.ltvPerGuest),       hex: '#DB2777' },
    { label: 'Avg Revenue / Booking', value: money0(b.revenuePerBooking), hex: '#36D8FF' },
    { label: 'Avg Revenue / Week',    value: money0(b.revenuePerWeek),    hex: '#D97706' },
  ];
  // Row 3 — post-launch registered-user cohort.
  const cohortCards = [
    { label: 'LTV / Registered User', value: money0(b.ltvPerRegisteredUser), hex: '#4F46E5' },
    { label: 'Govt Tax', value: money(b.govtExtorted),                       hex: '#DC2626' },
  ];

  return (
    <div className="space-y-6">
      <p className="text-[12px] adm-t3 -mb-2">
        All figures from <span className="font-semibold adm-t2">30 Jun 2026, 00:00 IST</span> (monetization start). Earlier test payments are excluded.
      </p>
      {err && (
        <p className="text-[12px] text-red-500">Couldn't load revenue — retry in a moment (server may be waking up).</p>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {revenueCards.map(c => <RevCard key={c.label} {...c} />)}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {avgCards.map(c => <RevCard key={c.label} {...c} />)}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cohortCards.map(c => <RevCard key={c.label} {...c} />)}
      </div>

      <RevenueTrendChart />

      <div className="flex gap-3">
        <Link to="/admin/finance/transactions" className="btn btn--outline flex-1 adm-card p-4 hover:shadow-sm transition-all text-center">
          <p className="font-semibold adm-t1 text-sm">All Transactions</p>
          <p className="text-xs adm-t3 mt-0.5">View full transaction ledger</p>
        </Link>
        <Link to="/admin/finance/refunds" className="btn btn--outline flex-1 adm-card p-4 hover:shadow-sm transition-all text-center">
          <p className="font-semibold adm-t1 text-sm">Refunds</p>
          <p className="text-xs adm-t3 mt-0.5">Manage refund requests</p>
        </Link>
        <Link to="/admin/finance/payouts" className="btn btn--outline flex-1 adm-card p-4 hover:shadow-sm transition-all text-center">
          <p className="font-semibold adm-t1 text-sm">Payouts</p>
          <p className="text-xs adm-t3 mt-0.5">Approve &amp; release</p>
        </Link>
      </div>
    </div>
  );
};

// ══ Provider plan charts (dependency-free SVG) ════════════════
// Plan visual identity. Starter = white (needs border), Host+ = grey, Studio = brand orange.
const PLAN_ORDER = ['starter', 'creator', 'professional'];
const PLAN_META = {
  starter:      { label: 'Starter',  color: '#ffffff' },
  creator:      { label: 'Host+',    color: '#9ca3af' },
  professional: { label: 'Studio',   color: '#2E1065' },
};
const PIE_BORDER = '#374151'; // gray-700 — keeps the white slice readable on a white card
const PLAN_NAME = { starter: 'Starter', creator: 'Host+', professional: 'Studio' };

const polar = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
};
const arcPath = (cx, cy, r, start, end) => {
  const [x1, y1] = polar(cx, cy, r, end);
  const [x2, y2] = polar(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2} Z`;
};

// Plan-share pie — slice size = provider headcount. Border on pie + each slice.
const PlanSharePie = ({ distribution }) => {
  const data = PLAN_ORDER.map((k) => ({ key: k, ...PLAN_META[k], value: distribution?.[k] || 0 }));
  const total = data.reduce((s, d) => s + d.value, 0);
  const top = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  const cx = 90, cy = 90, r = 80;

  return (
    <Card>
      <p className="text-sm font-semibold adm-t1 mb-0.5">Plan Share</p>
      <p className="text-[12px] adm-t3 mb-4">Hosts by subscription plan</p>
      {total === 0 ? (
        <div className="py-10 text-center text-[12px] adm-t3">No hosts on any plan yet.</div>
      ) : (
        <>
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <svg width="180" height="180" viewBox="0 0 180 180" className="flex-shrink-0">
            {data.filter((d) => d.value > 0).length === 1 ? (() => {
              const only = data.find((d) => d.value > 0);
              return (
                <circle cx={cx} cy={cy} r={r} fill={only.color} stroke={PIE_BORDER} strokeWidth="2">
                  <title>{PLAN_NAME[only.key]}: {only.value} (100%)</title>
                </circle>
              );
            })() : (() => {
              let acc = 0;
              return data.filter((d) => d.value > 0).map((d) => {
                const start = (acc / total) * 360;
                acc += d.value;
                const end = (acc / total) * 360;
                return (
                  <path key={d.key} d={arcPath(cx, cy, r, start, end)} fill={d.color} stroke={PIE_BORDER} strokeWidth="1.5" strokeLinejoin="round">
                    <title>{PLAN_NAME[d.key]}: {d.value} ({Math.round((d.value / total) * 100)}%)</title>
                  </path>
                );
              });
            })()}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke={PIE_BORDER} strokeWidth="1.5" />
          </svg>
          <ul className="flex-1 w-full space-y-2">
            {data.map((d) => (
              <li key={d.key} className="flex items-center gap-2 text-[12px]">
                <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color, border: `1px solid ${PIE_BORDER}` }} />
                <span className="adm-t2 flex-1">{d.label}</span>
                <span className="font-semibold adm-t1 tabular-nums">{d.value}</span>
                <span className="adm-t3 tabular-nums w-10 text-right">{total ? Math.round((d.value / total) * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-4 pt-3 border-t adm-border text-[11px] adm-t3">
          Largest group: <span className="font-semibold adm-t2">{PLAN_NAME[top.key]}</span> — {top.value} host{top.value !== 1 ? 's' : ''} ({Math.round((top.value / total) * 100)}%).
        </p>
        </>
      )}
    </Card>
  );
};

// Grouped (double) bar — per plan: CONTRACTED plan value (list price × current
// holders — always live) vs COLLECTED (real subscription payments recorded).
const EARN_PERIODS = [['all', 'All'], ['12m', '12m'], ['6m', '6m'], ['3m', '3m'], ['7d', 'Last week']];

const PlanEarningsBars = ({ planContracted, planEarnings, period, onPeriod }) => {
  const groups = [
    { key: 'creator',      label: 'Host+ (₹1,499)' },
    { key: 'professional', label: 'Studio (₹3,650)' },
  ];
  const series = [
    { key: 'contracted', label: 'Contracted (plan × holders)', color: '#2E1065', data: planContracted },
    { key: 'collected',  label: 'Collected (paid to us)',      color: '#191919', data: planEarnings },
  ];
  const valueOf = (g, s) => Number(s.data?.[g.key]) || 0;
  const max = Math.max(1, ...groups.flatMap((g) => series.map((s) => valueOf(g, s))));
  const grand = groups.reduce((t, g) => t + series.reduce((a, s) => a + valueOf(g, s), 0), 0);
  const contractedTotal = groups.reduce((t, g) => t + valueOf(g, series[0]), 0);
  const H = 176;
  const hasData = grand > 0;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold adm-t1 mb-0.5">Earnings by Plan</p>
          <p className="text-[12px] adm-t3">Contracted plan value vs cash actually collected</p>
        </div>
        {onPeriod && (
          <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 flex-shrink-0 flex-wrap">
            {EARN_PERIODS.map(([k, lbl]) => (
              <button key={k} onClick={() => onPeriod(k)}
                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${period === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {lbl}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <p className="text-2xl font-bold adm-t1 tabular-nums">{inr(contractedTotal)}</p>
        <p className="text-[11px] adm-t3">Contracted subscription value (current plan holders)</p>
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center text-center text-[12px] adm-t3" style={{ height: H + 28 }}>
          No hosts on paid plans yet.
        </div>
      ) : (
        <>
          <div className="flex items-end justify-around gap-6" style={{ height: H + 28 }}>
            {groups.map((g) => (
              <div key={g.key} className="flex-1 flex flex-col items-center">
                <div className="flex items-end justify-center gap-3" style={{ height: H }}>
                  {series.map((s) => {
                    const v = valueOf(g, s);
                    const h = Math.max(v > 0 ? 3 : 0, (v / max) * H);
                    return (
                      <div key={s.key} className="group relative flex flex-col items-center justify-end" style={{ height: H }}>
                        <span className="text-[10px] font-semibold adm-t2 tabular-nums mb-1 whitespace-nowrap">{inr(v)}</span>
                        <div className="w-9 rounded-t-md transition-opacity group-hover:opacity-80" style={{ height: h, background: s.color }} />
                        <div className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 z-10">
                          {s.label}: {inr(v)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <span className="mt-2 text-[11px] font-medium adm-t3 text-center">{g.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t adm-border flex-wrap">
            {series.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5 text-[11px] adm-t3">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />{s.label}
              </span>
            ))}
          </div>
        </>
      )}
    </Card>
  );
};

// ── Providers Tab ─────────────────────────────────────────────
const PERIOD_DAYS = { all: null, '12m': 365, '6m': 180, '3m': 90, '7d': 7 };
const periodSince = (key) => {
  const days = PERIOD_DAYS[key];
  if (!days) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
};

const ProvidersTab = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('all');
  const [ov, setOv] = useState(null);
  const [ovErr, setOvErr] = useState(false);

  useEffect(() => {
    adminGetUsers({ page: 1, limit: 10, role: 'host' })
      .then(r => setProviders(r.data.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
    adminGetProviderOverview().then(r => setOv(r.data)).catch(() => setOvErr(true));
  }, []);

  useEffect(() => {
    adminGetProviderPlanAnalytics({ since: periodSince(period) })
      .then(r => setAnalytics(r.data))
      .catch(() => {});
  }, [period]);

  const o = ov || {};
  const ovLoading = !ov && !ovErr;
  const num = (v) => (ovLoading ? '…' : ovErr ? '—' : (Number(v) || 0).toLocaleString('en-IN'));
  const money = (v) => (ovLoading ? '…' : ovErr ? '—' : inr(v));
  const pct = (v) => (ovLoading ? '…' : ovErr ? '—' : `${Number(v) || 0}%`);

  // Row 1 — host overview (all-time; entitlement / verification / suspension independent)
  const row1 = [
    { label: 'Total Hosts',      value: num(o.totalHosts),      icon: 'users',      hex: '#2E1065' },
    { label: 'Premium Hosts',    value: num(o.premiumHosts),    icon: 'card',       hex: '#2E1065' },
    { label: 'Free Hosts',       value: num(o.freeHosts),       icon: 'userCheck',  hex: '#64748B' },
    { label: 'Unverified Hosts', value: num(o.unverifiedHosts), icon: 'alert',      hex: '#D97706', to: '/admin/providers/pending' },
  ];
  // Row 2 — business generated (since 30 Jun 2026)
  const row2 = [
    { label: 'Total Revenue',      value: money(o.completedValue),    icon: 'rupee',    hex: '#059669' },
    { label: 'Completed Bookings', value: num(o.completedBookings),   icon: 'calCheck', hex: '#2E1065' },
    { label: 'Upcoming Bookings',  value: num(o.upcomingBookings),    icon: 'calendar', hex: '#1DA1F2' },
    { label: 'Cancel / No-show Rate', value: pct(o.failRate),         icon: 'ban',      hex: '#DC2626' },
  ];
  // Row 3 — growth
  const row3 = [
    { label: 'New Hosts (30d)',      value: num(o.newHosts30),       icon: 'trendUp',  hex: '#D97706' },
    { label: 'Active Hosts (30d)',   value: num(o.activeHosts30),    icon: 'activity', hex: '#059669' },
    { label: 'Zero-Booking Hosts',   value: num(o.zeroBookingHosts), icon: 'alert',    hex: '#DC2626' },
    { label: 'Avg Revenue / Host',   value: money(o.avgRevenuePerHost), icon: 'rupee', hex: '#1DA1F2' },
  ];
  // Row 4 — revenue breakdown (since 30 Jun 2026)
  const row4 = [
    { label: 'GMV (Booking Value)',  value: money(o.gmv),                icon: 'rupee', hex: '#475569' },
    { label: 'Platform Revenue',     value: money(o.platformRevenue),    icon: 'rupee', hex: '#059669' },
    { label: 'Subscription Revenue', value: money(o.subscriptionRevenue),icon: 'rupee', hex: '#2E1065' },
    { label: 'Booking Fee Revenue',  value: money(o.bookingFeeRevenue),  icon: 'rupee', hex: '#2E1065' },
  ];

  return (
    <div className="space-y-5">
      <p className="text-[12px] adm-t3 -mb-1">
        Host counts are all-time. Business &amp; revenue figures are since <span className="font-semibold adm-t2">30 Jun 2026 IST</span> (pre-launch test data excluded).
      </p>
      {[row1, row2, row3, row4].map((row, i) => (
        <div key={i} className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {row.map(c => <RevCard key={c.label} {...c} />)}
        </div>
      ))}

      {/* Plan analytics — two columns: share pie + earnings bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PlanSharePie distribution={analytics?.distribution} />
        <PlanEarningsBars planContracted={analytics?.planContracted} planEarnings={analytics?.planEarnings} period={period} onPeriod={setPeriod} />
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b adm-border">
          <p className="font-semibold adm-t1 text-sm">Active Hosts</p>
          <Link to="/admin/providers/active" className="text-[12px] text-[#2E1065] hover:underline font-medium">View all</Link>
        </div>
        {loading ? (
          <div className="py-10 text-center adm-t3 text-sm">Loading...</div>
        ) : providers.length === 0 ? (
          <Empty icon="building" title="No hosts yet" desc="Hosts will appear here once they register." />
        ) : (
          <div className="divide-y adm-border">
            {providers.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-5 py-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0 bg-blue-500">
                  {(p.name || p.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium adm-t1 truncate">{p.name || '—'}</p>
                    <Badge tone={p.is_verified ? 'ok' : 'warn'}>{p.is_verified ? 'Verified' : 'Unverified'}</Badge>
                  </div>
                  <p className="text-[11px] adm-t3 truncate">@{p.username || p.email}</p>
                </div>
                <span className="text-[11px] font-semibold flex-shrink-0 px-2 py-0.5 rounded-md bg-[var(--adm-hover)] adm-t2">{planLabelOf(p.plan)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ── Bookings Tab ──────────────────────────────────────────────
const BookingsTab = ({ stats }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminGetBookings({ page: 1, limit: 10 })
      .then(r => setBookings(r.data.bookings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const pending = (stats?.bookings || 0) - (stats?.confirmed || 0) - (stats?.cancelled || 0);
  const cards = [
    { label: 'Total',     value: (stats?.bookings  || 0).toLocaleString(), icon: 'calendar', hex: '#475569' },
    { label: 'Paid',      value: (stats?.confirmed || 0).toLocaleString(), icon: 'calCheck', hex: '#059669' },
    { label: 'Pending',   value: Math.max(0, pending).toLocaleString(),     icon: 'clock',    hex: '#D97706' },
    { label: 'Cancelled', value: (stats?.cancelled || 0).toLocaleString(), icon: 'ban',      hex: '#DC2626' },
    { label: 'Disputed',  value: (stats?.disputed  || 0).toLocaleString(), icon: 'alert',    hex: '#1DA1F2' },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map(c => <ColorStat key={c.label} {...c} />)}
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b adm-border">
          <p className="font-semibold adm-t1 text-sm">Recent Bookings</p>
          <Link to="/admin/bookings" className="text-[12px] text-[#2E1065] hover:underline font-medium">View all</Link>
        </div>
        {loading ? (
          <div className="py-10 text-center adm-t3 text-sm">Loading...</div>
        ) : bookings.length === 0 ? (
          <Empty icon="calendar" title="No bookings yet" desc="Bookings will appear here once guests start booking." />
        ) : (
          <div className="divide-y adm-border">
            {bookings.map(b => {
              const dt = new Date(b.scheduled_at);
              return (
                <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[b.status] || 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium adm-t1 truncate">{b.services?.title || 'Service'}</p>
                    <p className="text-[11px] adm-t3">{b.guest_name || b.guest_email} · {dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold adm-t1">₹{b.services?.price || 0}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium capitalize
                      ${b.status === 'confirmed' ? 'text-green-700 bg-green-50' : b.status === 'cancelled' ? 'text-red-600 bg-red-50' : 'text-amber-700 bg-amber-50'}`}>
                      {b.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};

// ── Pending Tab — Operations Center attention queue (real data) ───────────
// Count badges are dismissible: clicking a card hides its number for 24h (stored
// per-browser in localStorage). The card still navigates; only the badge clears.
const SEVERITY_STYLE = {
  danger:  'bg-red-50 text-red-600',
  warning: 'bg-[#2E1065]/10 text-[#2E1065]',
  ok:      'bg-gray-100 text-gray-400',
};
// Per-category tint so the six queues are scannable at a glance (keyed on the
// stable item.key set server-side in opsAdminController). Falls back to the
// severity tint for any unknown key.
const CATEGORY_STYLE = {
  pending_payouts:       'bg-green-50 text-green-600',
  pending_verifications: 'bg-blue-50 text-blue-600',
  pending_reviews:       'bg-orange-50 text-orange-600',
  failed_emails:         'bg-red-50 text-red-600',
  failed_notifications:  'bg-purple-50 text-purple-600',
  stale_unpaid_bookings: 'bg-yellow-50 text-yellow-700',
};
const DISMISS_KEY = 'sd_pending_dismissed';
const DISMISS_MS = 24 * 60 * 60 * 1000;

const readDismissed = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}');
    const now = Date.now();
    // Drop expired entries so the map self-cleans.
    return Object.fromEntries(Object.entries(raw).filter(([, ts]) => now - ts < DISMISS_MS));
  } catch { return {}; }
};

const PendingTab = ({ ops }) => {
  const items = ops?.attention || [];
  const clear = ops && (ops.totalAttention === 0);
  const [dismissed, setDismissed] = useState(readDismissed);

  const dismiss = (key) => {
    const next = { ...readDismissed(), [key]: Date.now() };
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify(next)); } catch { /* ignore quota */ }
    setDismissed(next);
  };

  return (
    <div className="space-y-4">
      {clear && (
        <Card className="p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-4">
            <Ic d={IC.check} size={22} className="text-green-500" />
          </div>
          <p className="font-semibold adm-t1 mb-1">All clear</p>
          <p className="text-sm adm-t3 max-w-sm mx-auto">Nothing needs attention right now.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map(item => {
          const isDismissed = !!dismissed[item.key];
          const showCount = item.count > 0 && !isDismissed;
          const catStyle = CATEGORY_STYLE[item.key] || SEVERITY_STYLE.ok;
          return (
            <Link key={item.key} to={item.to} onClick={() => item.count > 0 && dismiss(item.key)}
              className="adm-card rounded-2xl p-5 hover:shadow-sm transition-all flex items-center gap-4 group">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${catStyle}`}>
                <Ic d={showCount ? IC.alert : IC.check} size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold adm-t1 text-sm">{item.label}</p>
                <p className="text-[12px] adm-t3 mt-0.5">
                  {showCount ? 'Needs attention' : isDismissed && item.count > 0 ? 'Cleared for today' : 'Nothing pending'}
                </p>
              </div>
              {showCount && (
                <span className={`text-sm font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${catStyle}`}>
                  {item.count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

// ── SuperDashboard ────────────────────────────────────────────
const SuperDashboard = () => {
  const { view } = useParams();
  const navigate  = useNavigate();
  const [stats, setStats]     = useState(null);
  const [ops, setOps]         = useState(null);
  const [loading, setLoading] = useState(true);

  const activeTab = view || 'overview';

  useEffect(() => {
    Promise.all([adminGetStats(), adminOpsSummary()])
      .then(([s, o]) => { setStats(s.data); setOps(o.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Platform overview and key metrics"
        actions={
          <div className="text-[11px] adm-t3 adm-card rounded-lg px-3 py-1.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 adm-card rounded-xl p-1 w-fit flex-wrap">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.to)}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all duration-150
              ${activeTab === tab.id
                ? 'bg-[#2E1065] text-white shadow-sm'
                : 'adm-t2 hover:text-gray-700 hover:bg-gray-50'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#2E1065] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm adm-t3">Loading dashboard...</p>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'overview'  && <OverviewTab  stats={stats} ops={ops} />}
          {activeTab === 'revenue'   && <RevenueTab   stats={stats} />}
          {activeTab === 'providers' && <ProvidersTab />}
          {activeTab === 'bookings'  && <BookingsTab   stats={stats} />}
          {activeTab === 'pending'   && <PendingTab ops={ops} />}
          {activeTab === 'insights'  && <AdminInsights />}
        </>
      )}
    </div>
  );
};

export default SuperDashboard;
