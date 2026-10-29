// Investor pitch deck — /pitch-deck (noindex, unlinked, GATED).
//
// HARD GATE: the confidential figures are NOT in this bundle. A viewer must enter
// a shared passcode + verify a WhatsApp OTP; the server (routes/pitchDeckRoutes)
// then issues a 45-min token and serves the numbers from GET /api/pitch-deck/data.
// Time-bound: the deck also dies on PITCH_DECK_EXPIRES_AT (server 410). Until the
// viewer clears the gate this file renders only the OTP screen + non-secret prose.
//
// Brand: Friendly Brutalism — orange #0079C1, canvas #F8FAFC, ink, hard offset
// shadows, 4px borders/radii. Plus Jakarta Sans headings / Poppins body. Charts
// are hand-rolled SVG and take their data as props (fed from the fetched payload).
//
// Number tags (colour-coded): ACTUAL green · ESTIMATE amber · PROJECTION blue ·
// ASSUMPTION grey. ~45 paying hosts / ₹18k MRR are founder-attested (incl.
// off-platform); 78 hosts / 190 leads are live product data.
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useHideChrome } from '../../context/ChromeContext';
import Seo from '../../components/common/Seo';

// Best-effort browser fullscreen (must be called in a user-gesture task).
const enterFullscreen = () => { try { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.(); } catch { /* ignore */ } };
const toggleFullscreen = () => {
  try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); } catch { /* ignore */ }
};

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'pitch_deck_token'; // sessionStorage — clears on tab close

// Plain fetch (bypasses the shared axios interceptor, which would attach the
// user/admin token instead of the pitch token).
async function pitchApi(path, { body, token } = {}) {
  const res = await fetch(`${API_BASE}/pitch-deck${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Something went wrong. Please try again.');
  return data;
}

// ── EDIT ME: founder details for the Team slide ──────────────────────────────
const FOUNDER = {
  name: 'Shubham Datarkar',
  role: 'Founder & Engineer',
  background: 'Product engineer focused on building simple, scalable SaaS products.',
  why: 'Solo professionals shouldn’t have to chase clients for payments, reminders, and invoices. I built this to make it automatic.',
  handle: 'meeticulous.com',
};
const SHIPPED = [
  'Booking + double-booking-safe calendar',
  'Razorpay payments + UPI autopay',
  'Automated split-payouts (Route)',
  'GST invoicing + TDS/TCS',
  'KYC / identity verification',
  'WhatsApp + email notifications',
  'Admin CRM + analytics',
  'SEO host profiles',
];

// ── Tag palette (semantic colour-coding) ─────────────────────────────────────
const TAGS = {
  actual:     { label: 'ACTUAL',     fg: '#065f46', bg: '#d1fae5', dot: '#059669' },
  estimate:   { label: 'ESTIMATE',   fg: '#92400e', bg: '#fef3c7', dot: '#f59e0b' },
  projection: { label: 'PROJECTION', fg: '#1e3a8a', bg: '#D6ECF8', dot: '#0079C1' },
  assumption: { label: 'ASSUMPTION', fg: '#374151', bg: '#e5e7eb', dot: '#6b7280' },
};
function Tag({ k, className = '' }) {
  const t = TAGS[k];
  return (
    <span className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-bold tracking-wide font-sans ${className}`}
      style={{ color: t.fg, background: t.bg }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />
      {t.label}
    </span>
  );
}
function Legend() {
  return <div className="flex flex-wrap items-center gap-2">{Object.keys(TAGS).map((k) => <Tag key={k} k={k} />)}</div>;
}

// ── Slide shell ──────────────────────────────────────────────────────────────
const SLIDE_META = [
  ['cover', 'Cover'], ['problem', 'Problem'], ['why-now', 'Why now'],
  ['solution', 'Solution'], ['how', 'How it works'], ['proof', 'Proof'],
  ['market', 'Market'], ['model', 'Business model'], ['traction', 'Traction'],
  ['growth', 'Growth'], ['unit', 'Unit economics'], ['competition', 'Competition'],
  ['moat', 'Moat'], ['gtm', 'Go-to-market'], ['roadmap', 'Roadmap'],
  ['ask', 'The ask'], ['use', 'Use of funds'], ['team', 'Team'], ['close', 'Invest'],
];
function Slide({ id, children, className = '', dark = false }) {
  const idx = SLIDE_META.findIndex((m) => m[0] === id);
  const num = idx > 0 ? idx + 1 : null;
  const label = idx >= 0 ? SLIDE_META[idx][1] : '';
  return (
    <section id={id} data-slide={id}
      className={`relative overflow-hidden snap-start min-h-[100dvh] w-full flex flex-col justify-center px-6 py-16 sm:px-10 md:px-16 lg:px-24 ${className}`}
      style={dark ? { background: '#141210', color: '#F8FAFC' } : { background: '#F8FAFC', color: '#191919' }}>
      {dark && (
        <motion.div aria-hidden className="pointer-events-none absolute right-[6%] top-[12%] h-72 w-72 rounded-full"
          style={{ background: 'radial-gradient(circle,#0079C1,transparent 70%)', opacity: 0.1 }}
          animate={{ scale: [1, 1.18, 1], x: [0, 26, 0], y: [0, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
      )}
      <div className="relative z-10 mx-auto w-full max-w-6xl">
        {num != null && (
          <motion.div className="mb-5 flex items-center gap-3"
            initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }}
            viewport={{ amount: 0.6 }} transition={{ duration: 0.4 }}>
            <span className="font-heading text-xs font-extrabold tracking-[0.2em]" style={{ color: '#0079C1' }}>
              {String(num).padStart(2, '0')}
            </span>
            <span className="h-px flex-1 max-w-[64px]" style={{ background: dark ? '#3a352f' : '#e6e1d8' }} />
            <span className="font-sans text-[11px] font-semibold uppercase tracking-widest opacity-50">{label}</span>
          </motion.div>
        )}
        <motion.div
          className={dark ? '[&_h1]:text-[#F8FAFC] [&_h2]:text-[#F8FAFC] [&_h3]:text-[#F8FAFC]' : ''}
          initial={{ opacity: 0, y: 40, scale: 0.98 }} whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ amount: 0.5 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
          {children}
        </motion.div>
      </div>
    </section>
  );
}
function Stat({ value, label, tag, accent = '#0079C1', sub }) {
  return (
    <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      className="rounded-[6px] border-[3px] border-ink bg-white p-5" style={{ boxShadow: '5px 5px 0 rgba(26,26,26,0.9)' }}>
      <div className="font-heading text-4xl font-extrabold leading-none sm:text-5xl" style={{ color: accent }}>{value}</div>
      <div className="mt-2 font-sans text-sm font-semibold text-ink">{label}</div>
      {sub && <div className="mt-1 font-sans text-xs text-ink/60">{sub}</div>}
      {tag && <div className="mt-3"><Tag k={tag} /></div>}
    </motion.div>
  );
}
function Card({ title, body, accent = '#0079C1' }) {
  return (
    <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      className="rounded-[6px] border-[3px] border-ink bg-white p-5" style={{ boxShadow: '4px 4px 0 rgba(26,26,26,0.9)' }}>
      <div className="mb-1 font-heading text-base font-extrabold" style={{ color: accent }}>{title}</div>
      <div className="font-sans text-sm text-ink/75 leading-snug">{body}</div>
    </motion.div>
  );
}

// ── Hand-rolled SVG charts (data via props — nothing sensitive at module scope) ─
function MrrChart({ series }) {
  const W = 640, H = 260, pad = 36, max = 20;
  const x = (i) => pad + (i * (W - pad * 2)) / (series.length - 1);
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const line = series.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.v)}`).join(' ');
  const area = `${line} L${x(series.length - 1)},${H - pad} L${x(0)},${H - pad} Z`;
  const lastV = series[series.length - 1]?.v;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="MRR since launch">
      <defs>
        <linearGradient id="mrrFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0079C1" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0079C1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 5, 10, 15, 20].map((g) => (
        <g key={g}>
          <line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="#e6e1d8" strokeWidth="1" />
          <text x={pad - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="#9a948a" fontFamily="Poppins">₹{g}k</text>
        </g>
      ))}
      <path d={area} fill="url(#mrrFill)" />
      <path d={line} fill="none" stroke="#0079C1" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((d, i) => {
        const last = i === series.length - 1;
        return (
          <g key={d.m}>
            <circle cx={x(i)} cy={y(d.v)} r={last ? 7 : 4.5} fill={last ? '#0079C1' : '#fff'} stroke="#0079C1" strokeWidth="3" />
            <text x={x(i)} y={H - pad + 18} textAnchor="middle" fontSize="11" fill="#6b6459" fontFamily="Poppins">{d.m}</text>
            {last && <text x={x(i)} y={y(d.v) - 14} textAnchor="middle" fontSize="13" fontWeight="700" fill="#0079C1" fontFamily="Plus Jakarta Sans">₹{lastV}k</text>}
          </g>
        );
      })}
    </svg>
  );
}
function FunnelChart({ items, pct }) {
  const max = items[0].v;
  return (
    <div className="space-y-3">
      {items.map((f, i) => {
        const p = Math.round((f.v / max) * 100);
        const accent = f.tag === 'actual' ? '#059669' : '#f59e0b';
        return (
          <div key={f.label}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-sans text-sm font-semibold">{f.label}</span>
              <span className="flex items-center gap-2"><Tag k={f.tag} />
                <span className="font-heading text-lg font-extrabold" style={{ color: accent }}>~{f.v}</span></span>
            </div>
            <div className="h-9 w-full rounded-[4px] border-2 border-ink bg-white overflow-hidden">
              <div className="h-full flex items-center justify-end pr-2 font-sans text-xs font-bold text-white"
                style={{ width: `${Math.max(p, 14)}%`, background: accent }}>
                {i === items.length - 1 ? pct : ''}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
function MarketRings({ rings }) {
  return (
    <svg viewBox="0 0 320 320" className="w-full max-w-[340px]" role="img" aria-label="TAM SAM SOM market sizing">
      {rings.map((m) => <circle key={m.k} cx="160" cy="170" r={m.r} fill={m.fill} stroke="#191919" strokeWidth="2.5" />)}
      <text x="160" y="176" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="Plus Jakarta Sans">SOM</text>
      <text x="160" y="88" textAnchor="middle" fontSize="13" fontWeight="800" fill="#005E99" fontFamily="Plus Jakarta Sans">SAM</text>
      <text x="160" y="42" textAnchor="middle" fontSize="13" fontWeight="800" fill="#1e3a8a" fontFamily="Plus Jakarta Sans">TAM</text>
    </svg>
  );
}
function FundsBar({ funds }) {
  return (
    <div>
      <div className="flex h-14 w-full overflow-hidden rounded-[6px] border-[3px] border-ink" style={{ boxShadow: '5px 5px 0 rgba(26,26,26,0.9)' }}>
        {funds.map((f) => (
          <div key={f.k} className="flex items-center justify-center font-heading text-sm font-extrabold text-white"
            style={{ width: `${f.pct}%`, background: f.c }}>{f.pct}%</div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {funds.map((f) => (
          <div key={f.k} className="flex items-start gap-2">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-[3px] border-2 border-ink" style={{ background: f.c }} />
            <span className="font-sans text-xs font-semibold leading-tight">{f.k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
function GrowthChart({ series }) {
  const W = 640, H = 260, pad = 40, max = 10;
  const x = (i) => pad + (i * (W - pad * 2)) / (series.length - 1);
  const y = (v) => H - pad - (v / max) * (H - pad * 2);
  const line = series.map((d, i) => `${i ? 'L' : 'M'}${x(i)},${y(d.v)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="MRR projection over 18 months">
      {[0, 2, 4, 6, 8, 10].map((g) => (
        <g key={g}>
          <line x1={pad} x2={W - pad} y1={y(g)} y2={y(g)} stroke="#2a2621" strokeWidth="1" />
          <text x={pad - 8} y={y(g) + 4} textAnchor="end" fontSize="11" fill="#8a847a" fontFamily="Poppins">₹{g}L</text>
        </g>
      ))}
      <path d={line} fill="none" stroke="#0079C1" strokeWidth="3.5" strokeLinejoin="round" />
      {series.map((d, i) => {
        const now = i === 0;
        return (
          <g key={d.t}>
            <circle cx={x(i)} cy={y(d.v)} r={now ? 7 : 5} fill={now ? '#059669' : '#0079C1'} stroke="#141210" strokeWidth="2.5" />
            <text x={x(i)} y={H - pad + 18} textAnchor="middle" fontSize="11" fill="#b8b2a8" fontFamily="Poppins">{d.t}</text>
            <text x={x(i)} y={y(d.v) - 12} textAnchor="middle" fontSize="11" fontWeight="700" fill={now ? '#34d399' : '#93c5fd'} fontFamily="Plus Jakarta Sans">₹{d.v}L</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Competition matrix (not confidential — stays client-side) ────────────────
const ICON = {
  calendly: 'M19.655 14.262c.281 0 .557.023.828.064 0 .005-.005.01-.005.014-.105.267-.234.534-.381.786l-1.219 2.106c-1.112 1.936-3.177 3.127-5.411 3.127h-2.432c-2.23 0-4.294-1.191-5.412-3.127l-1.218-2.106a6.251 6.251 0 0 1 0-6.252l1.218-2.106C6.736 4.832 8.8 3.641 11.035 3.641h2.432c2.23 0 4.294 1.191 5.411 3.127l1.219 2.106c.147.252.271.519.381.786 0 .004.005.009.005.014-.267.041-.543.064-.828.064-1.816 0-2.501-.607-3.291-1.306-.764-.676-1.711-1.517-3.44-1.517h-1.029c-1.251 0-2.387.455-3.2 1.278-.796.805-1.233 1.904-1.233 3.099v1.411c0 1.196.437 2.295 1.233 3.099.813.823 1.949 1.278 3.2 1.278h1.034c1.729 0 2.676-.841 3.439-1.517.791-.703 1.471-1.306 3.287-1.301Zm.005-3.237c.399 0 .794-.036 1.179-.11-.002-.004-.002-.01-.002-.014-.073-.414-.193-.823-.349-1.218.731-.12 1.407-.396 1.986-.819 0-.004-.005-.013-.005-.018-.331-1.085-.832-2.101-1.489-3.03-.649-.915-1.435-1.719-2.331-2.395-1.867-1.398-4.088-2.138-6.428-2.138-1.448 0-2.855.28-4.175.841-1.273.543-2.423 1.315-3.407 2.299S2.878 6.552 2.341 7.83c-.557 1.324-.842 2.726-.842 4.175 0 1.448.281 2.855.842 4.174.542 1.274 1.314 2.423 2.298 3.407s2.129 1.761 3.407 2.299c1.324.556 2.727.841 4.175.841 2.34 0 4.561-.74 6.428-2.137a10.815 10.815 0 0 0 2.331-2.396c.652-.929 1.158-1.949 1.489-3.03 0-.004.005-.014.005-.018-.579-.423-1.255-.699-1.986-.819.161-.395.276-.804.349-1.218.005-.009.005-.014.005-.023.869.166 1.692.506 2.404 1.035.685.505.552 1.075.446 1.416C22.184 20.437 17.619 24 12.221 24c-6.625 0-12-5.375-12-12s5.37-12 12-12c5.398 0 9.963 3.563 11.471 8.464.106.341.239.915-.446 1.421-.717.529-1.535.873-2.404 1.034.128.716.128 1.45 0 2.166-.387-.074-.782-.11-1.182-.11-4.184 0-3.968 2.823-6.736 2.823h-1.029c-1.899 0-3.15-1.357-3.15-3.095v-1.411c0-1.738 1.251-3.094 3.15-3.094h1.034c2.768 0 2.552 2.823 6.731 2.827Z',
  whatsapp: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z',
  zoho: 'M8.66 6.897a1.299 1.299 0 0 0-1.205.765l-.642 1.44-.062-.385A1.291 1.291 0 0 0 5.27 7.648l-4.185.678A1.291 1.291 0 0 0 .016 9.807l.678 4.18a1.293 1.293 0 0 0 1.27 1.087c.074 0 .143-.01.216-.017l4.18-.678c.436-.07.784-.351.96-.723l2.933 1.307a1.304 1.304 0 0 0 .988.026c.321-.12.575-.365.716-.678l.28-.629.038.276a1.297 1.297 0 0 0 1.455 1.103l3.712-.501a1.29 1.29 0 0 0 1.03.514h4.236c.713 0 1.29-.58 1.291-1.291V9.545c0-.712-.58-1.291-1.291-1.291h-4.236c-.079 0-.155.008-.23.022a1.309 1.309 0 0 0-.275-.288c-.275-.21-.614-.3-.958-.253l-4.197.571c-.155.021-.3.07-.432.14L9.159 7.01a1.27 1.27 0 0 0-.499-.113z',
  calcom: 'M2.408 14.488C1.035 14.488 0 13.4 0 12.058c0-1.346.982-2.443 2.408-2.443.758 0 1.282.233 1.691.765l-.66.55a1.343 1.343 0 0 0-1.03-.442c-.93 0-1.44.711-1.44 1.57 0 .86.559 1.557 1.44 1.557.413 0 .765-.147 1.043-.443l.651.573c-.391.51-.929.743-1.695.743zM6.948 10.913h.89v3.49h-.89v-.51c-.185.362-.493.604-1.083.604-.943 0-1.695-.82-1.695-1.826 0-1.007.752-1.825 1.695-1.825.585 0 .898.241 1.083.604zm.026 1.758c0-.546-.374-.998-.964-.998-.568 0-.938.457-.938.998 0 .528.37.998.938.998.586 0 .964-.456.964-.998zM8.467 9.503h.89v4.895h-.89zM9.752 13.937a.53.53 0 0 1 .542-.528c.313 0 .533.242.533.528a.527.527 0 0 1-.533.537.534.534 0 0 1-.542-.537zM14.23 13.839c-.33.403-.832.658-1.426.658a1.806 1.806 0 0 1-1.84-1.826c0-1.007.778-1.825 1.84-1.825.572 0 1.07.241 1.4.622l-.687.577c-.172-.215-.396-.376-.713-.376-.568 0-.938.456-.938.998 0 .541.37.997.938.997.343 0 .58-.179.757-.42zM14.305 12.671c0-1.007.78-1.825 1.84-1.825 1.061 0 1.84.818 1.84 1.825 0 1.007-.779 1.826-1.84 1.826-1.06-.005-1.84-.82-1.84-1.826zm2.778 0c0-.546-.37-.998-.938-.998-.568-.004-.937.452-.937.998 0 .542.37.998.937.998.568 0 .938-.456.938-.998zM24 12.269v2.13h-.89v-1.911c0-.604-.281-.864-.704-.864-.396 0-.678.197-.678.864v1.91h-.89v-1.91c0-.604-.285-.864-.704-.864-.396 0-.744.197-.744.864v1.91h-.89v-3.49h.89v.484c.185-.376.52-.564 1.035-.564.489 0 .898.241 1.123.649.224-.417.554-.65 1.153-.65.731.005 1.299.56 1.299 1.442z',
};
function BrandLogo({ brand }) {
  if (brand.img) return <img src={brand.img} alt="" width="22" height="22" className="shrink-0 object-contain" />;
  if (brand.icon) return <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="shrink-0"><path d={ICON[brand.icon]} fill={brand.color} /></svg>;
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] font-heading text-[11px] font-extrabold text-white" style={{ background: brand.color }}>{brand.mono}</span>;
}
const COMP_COLS = ['UPI autopay + payouts', 'GST invoicing', 'Venues + people', 'WhatsApp-native'];
const COMP_ROWS = [
  { name: 'Meeticulous', img: '/sloth.png', color: '#0079C1', us: true, cells: [true, true, true, true] },
  { name: 'Topmate', mono: 'T', color: '#5B4CE0', cells: [true, false, false, false] },
  { name: 'Calendly', icon: 'calendly', color: '#006BFF', cells: [false, false, false, false] },
  { name: 'Cal.com', icon: 'calcom', color: '#292929', cells: [false, false, false, false] },
  { name: 'Zoho Bookings', icon: 'zoho', color: '#E42527', cells: [false, true, false, false] },
  { name: 'Setmore', mono: 'S', color: '#009688', cells: [false, false, false, false] },
  { name: 'Practo', mono: 'P', color: '#14BEF0', cells: [false, false, true, false] },
  { name: 'WhatsApp + manual', icon: 'whatsapp', color: '#25D366', cells: [false, false, true, true] },
];
function CompMatrix() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse font-sans text-sm">
        <thead>
          <tr><th className="p-2 text-left" />{COMP_COLS.map((c) => <th key={c} className="p-2 text-center font-heading text-xs font-bold leading-tight">{c}</th>)}</tr>
        </thead>
        <tbody>
          {COMP_ROWS.map((r) => (
            <tr key={r.name} style={r.us ? { background: '#D6ECF8' } : undefined}>
              <td className={`p-2 ${r.us ? 'text-ink font-extrabold' : 'text-ink/75 font-semibold'}`} style={{ borderTop: '2px solid #191919' }}>
                <span className="flex items-center gap-2 whitespace-nowrap"><BrandLogo brand={r} />{r.name}</span>
              </td>
              {r.cells.map((v, i) => (
                <td key={i} className="p-2 text-center text-lg" style={{ borderTop: '2px solid #191919' }}>
                  {v ? <span style={{ color: '#059669' }}>✓</span> : <span className="text-ink/25">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Nav ──────────────────────────────────────────────────────────────────────
function useDeckNav() {
  const [active, setActive] = useState(0);
  const scrollTo = useCallback((i) => {
    const el = document.querySelector(`[data-slide="${SLIDE_META[i]?.[0]}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => {
    const root = document.getElementById('deck-scroll');
    if (!root) return undefined;
    const secs = Array.from(root.querySelectorAll('[data-slide]'));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { const idx = secs.indexOf(e.target); if (idx >= 0) setActive(idx); } });
    }, { root, threshold: 0.5 });
    secs.forEach((s) => io.observe(s));
    const onKey = (ev) => {
      if (['ArrowDown', 'ArrowRight', 'PageDown', ' '].includes(ev.key)) {
        ev.preventDefault(); setActive((i) => { const n = Math.min(i + 1, SLIDE_META.length - 1); scrollTo(n); return n; });
      } else if (['ArrowUp', 'ArrowLeft', 'PageUp'].includes(ev.key)) {
        ev.preventDefault(); setActive((i) => { const n = Math.max(i - 1, 0); scrollTo(n); return n; });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => { io.disconnect(); window.removeEventListener('keydown', onKey); };
  }, [scrollTo]);
  return { active, scrollTo };
}
// ── OTP + passcode gate ──────────────────────────────────────────────────────
function Gate({ onUnlock }) {
  const [step, setStep] = useState('code'); // 'code' | 'phone' | 'otp'
  const [passcode, setPasscode] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submitCode = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { await pitchApi('/check-passcode', { body: { passcode: passcode.trim() } }); setStep('phone'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const sendCode = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { await pitchApi('/request-otp', { body: { passcode: passcode.trim(), phone: phone.trim() } }); setStep('otp'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const verify = async (e) => {
    e.preventDefault(); enterFullscreen(); setError(''); setBusy(true);
    try {
      const { token } = await pitchApi('/verify-otp', { body: { passcode: passcode.trim(), phone: phone.trim(), otp: otp.trim() } });
      const data = await pitchApi('/data', { token });
      onUnlock(token, data);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const back = (to) => { setStep(to); setError(''); };

  const field = 'w-full rounded-[4px] border-[3px] border-white/20 bg-[#1c1a17] px-4 py-3 font-sans text-base text-white outline-none focus:border-[#0079C1]';
  const btn = 'w-full rounded-[4px] border-[3px] border-[#0079C1] bg-[#0079C1] px-6 py-3 font-heading text-base font-extrabold text-white transition hover:brightness-110 disabled:opacity-50';
  const backBtn = 'w-full font-sans text-xs opacity-60 hover:opacity-100';
  const subtitle = { code: 'Enter your access code to continue.', phone: 'Enter your phone — we’ll send a one-time code on WhatsApp.', otp: `Enter the code we sent on WhatsApp to ${phone}.` }[step];
  const anim = { initial: { opacity: 0, x: 24 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -24 }, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } };

  return (
    <main className="fixed inset-0 flex items-center justify-center overflow-hidden px-6 py-10 font-sans" style={{ background: '#141210', color: '#F8FAFC' }}>
      <motion.div aria-hidden className="pointer-events-none absolute right-[-6rem] top-[-6rem] h-96 w-96 rounded-full"
        style={{ background: 'radial-gradient(circle,#0079C1,transparent 70%)', opacity: 0.2 }}
        animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2 font-heading text-lg font-extrabold">
          <img src="/sloth.png" alt="Meeticulous" width="32" height="32" className="object-contain" /> Meeticulous
        </div>
        <h1 className="font-heading text-3xl font-extrabold leading-tight text-[#F8FAFC]">Investor access</h1>
        <div className="mt-3 flex gap-1.5">
          {['code', 'phone', 'otp'].map((s, i) => (
            <span key={s} className="h-1.5 w-6 rounded-full transition"
              style={{ background: ['code', 'phone', 'otp'].indexOf(step) >= i ? '#0079C1' : '#3a352f' }} />
          ))}
        </div>
        <p className="mt-3 min-h-[2.5rem] font-sans text-sm opacity-70">{subtitle}</p>

        <div className="overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 'code' && (
              <motion.form key="code" {...anim} onSubmit={submitCode} className="space-y-3">
                <input className={field} type="text" placeholder="Access code" value={passcode}
                  onChange={(e) => setPasscode(e.target.value)} autoFocus autoComplete="off" />
                {error && <p className="font-sans text-sm text-[#fca5a5]">{error}</p>}
                <button className={btn} type="submit" disabled={busy || !passcode}>{busy ? 'Checking…' : 'Continue'}</button>
              </motion.form>
            )}
            {step === 'phone' && (
              <motion.form key="phone" {...anim} onSubmit={sendCode} className="space-y-3">
                <input className={field} type="tel" placeholder="Phone (e.g. +91 98765 43210)" value={phone}
                  onChange={(e) => setPhone(e.target.value)} autoFocus autoComplete="tel" />
                {error && <p className="font-sans text-sm text-[#fca5a5]">{error}</p>}
                <button className={btn} type="submit" disabled={busy || !phone}>{busy ? 'Sending…' : 'Send code on WhatsApp'}</button>
                <button type="button" className={backBtn} onClick={() => back('code')}>← Back</button>
              </motion.form>
            )}
            {step === 'otp' && (
              <motion.form key="otp" {...anim} onSubmit={verify} className="space-y-3">
                <input className={`${field} tracking-[0.4em]`} type="text" inputMode="numeric" placeholder="000000" value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus autoComplete="one-time-code" />
                {error && <p className="font-sans text-sm text-[#fca5a5]">{error}</p>}
                <button className={btn} type="submit" disabled={busy || otp.length < 4}>{busy ? 'Verifying…' : 'Verify & open deck'}</button>
                <button type="button" className={backBtn} onClick={() => back('phone')}>← Change number</button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
        <p className="mt-8 font-sans text-[11px] opacity-40">Confidential · time-limited access · {FOUNDER.handle}</p>
      </div>
    </main>
  );
}

function Splash({ text = 'Loading…' }) {
  return (
    <main className="fixed inset-0 flex items-center justify-center font-sans" style={{ background: '#141210', color: '#F8FAFC' }}>
      <div className="flex flex-col items-center gap-3">
        <img src="/sloth.png" alt="" width="48" height="48" className="animate-pulse object-contain" />
        <span className="font-sans text-sm opacity-60">{text}</span>
      </div>
    </main>
  );
}

// ── The deck body (mounted only once figures are fetched; d = payload) ────────
function DeckBody({ d }) {
  const { active } = useDeckNav();
  const paidPct = Math.round((d.funnel[2].v / d.funnel[0].v) * 100);
  return (
    <main id="deck-scroll" className="fixed inset-0 overflow-x-hidden overflow-y-auto snap-y snap-mandatory scroll-smooth font-sans text-ink">
      <div className="fixed left-0 top-0 z-30 h-1 bg-[#0079C1] transition-all" style={{ width: `${((active + 1) / SLIDE_META.length) * 100}%` }} />
      <div className="fixed left-4 top-4 z-30 font-heading text-xs font-extrabold tracking-widest">
        <span style={{ color: '#0079C1' }}>{String(active + 1).padStart(2, '0')}</span>
        <span className="opacity-40"> / {String(SLIDE_META.length).padStart(2, '0')}</span>
      </div>
      <button onClick={toggleFullscreen} aria-label="Toggle fullscreen" title="Toggle fullscreen"
        className="fixed right-4 top-4 z-30 rounded-[4px] border-2 border-ink/20 bg-white/70 px-2 py-1 font-sans text-xs font-bold text-ink backdrop-blur transition hover:border-ink">⛶</button>

      {/* COVER */}
      <Slide id="cover" dark className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-20" style={{ background: 'radial-gradient(circle,#0079C1,transparent 70%)' }} />
        <div className="mb-6 inline-flex items-center gap-2 font-heading text-lg font-extrabold">
          <img src="/sloth.png" alt="Meeticulous" width="36" height="36" className="object-contain" /> Meeticulous
        </div>
        <h1 className="font-heading text-4xl font-extrabold leading-[1.05] sm:text-6xl md:text-7xl">
          The booking + payments<br />OS for India's<br /><span style={{ color: '#0079C1' }}>hourly economy.</span>
        </h1>
        <p className="mt-6 max-w-2xl font-sans text-lg opacity-75 sm:text-xl">
          Studios, turfs, coaches, salons, creators — anyone who sells time or space by the slot.
          One calm place to get booked, get paid, and never chase a payment again.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Stat value={d.cover.hosts} label="paying hosts" tag="actual" sub="live subscriptions" />
          <Stat value={d.cover.mrr} label="MRR" tag="actual" sub="Sep 2026 run-rate" />
          <Stat value={d.cover.raise} label="raising" accent="#0079C1" sub="angel / pre-seed" />
        </div>
        <p className="mt-6 font-sans text-sm opacity-70">{d.cover.subline}</p>
        <p className="mt-6 font-sans text-xs opacity-50">Confidential · not for distribution · {FOUNDER.handle}</p>
        <div className="mt-2 font-sans text-xs opacity-40">↓ scroll or use arrow keys</div>
      </Slide>

      {/* PROBLEM */}
      <Slide id="problem">
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Selling your time in India is death by admin.</h2>
        <p className="mt-4 max-w-3xl font-sans text-lg text-ink/70">
          Millions of solo pros and small venues run on WhatsApp, a paper diary, and manual UPI. The tool exists to make money — instead it makes them the receptionist.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card title="Chasing payments" body="“Sir, payment?” DMs. No-shows. Cash at the door. Money leaks everywhere." />
          <Card title="Double-bookings" body="A diary and three WhatsApp chats can't hold a live calendar. Slots clash." accent="#0079C1" />
          <Card title="No system of record" body="No invoices, no GST, no payout trail. Global tools don't speak India's rails." accent="#059669" />
        </div>
        <p className="mt-8 font-sans text-base font-semibold">The enemy isn't a competitor. It's <span style={{ color: '#0079C1' }}>becoming the admin of your own hustle.</span></p>
      </Slide>

      {/* WHY NOW */}
      <Slide id="why-now" dark>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Three curves just crossed.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          <Card title="UPI autopay matured" body="Recurring UPI mandates (2024–26) finally make subscriptions + auto-collect work for tiny businesses." />
          <Card title="Solo economy boom" body="India's coaches, creators and micro-studios are going independent at scale — each one needs to get paid." accent="#0079C1" />
          <Card title="SMB SaaS moment" body="Sub-₹600/mo tools are now a normal purchase for a solo pro. The willingness-to-pay arrived." accent="#059669" />
        </div>
        <p className="mt-8 max-w-3xl font-sans text-lg opacity-75">The payment rails, the audience, and the buying behaviour are all live at the same time — for the first time.</p>
        <p className="mt-4 max-w-3xl rounded-[6px] border-l-4 border-[#0079C1] bg-white/5 px-4 py-2 font-sans text-sm italic opacity-80">
          What we've learned from our first {d.proof.hosts} hosts: [add your #1 proprietary insight — the non-obvious thing you now know about why they pay or churn].
        </p>
      </Slide>

      {/* SOLUTION */}
      <Slide id="solution">
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">One calm link that runs the whole thing.</h2>
        <p className="mt-4 max-w-3xl font-sans text-lg text-ink/70">A host publishes services or bookable slots. Guests book and pay in one flow. Money lands, invoice generates, host gets paid out. No chasing.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card title="Get booked" body="A shareable profile + live calendar. No clashes, no back-and-forth." />
          <Card title="Get paid upfront" body="Razorpay checkout at booking. UPI, cards, autopay mandates." accent="#0079C1" />
          <Card title="Stay compliant" body="GST-ready invoices, TDS/TCS handled, KYC built in." accent="#059669" />
          <Card title="Get paid out" body="Automated Route payouts to the host's bank. Fully reconciled." accent="#f59e0b" />
        </div>
      </Slide>

      {/* HOW IT WORKS */}
      <Slide id="how" dark>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Four steps. Zero admin.</h2>
        <div className="mt-12 grid gap-6 sm:grid-cols-4">
          {[
            ['1', 'Publish', 'Host lists a service or venue slot with price + availability.'],
            ['2', 'Book', 'Guest picks a slot, verifies by WhatsApp OTP — no account friction.'],
            ['3', 'Pay', 'Razorpay collects upfront. Slot locks. Invoice issues automatically.'],
            ['4', 'Payout', 'Money is split and settled to the host. Fully reconciled.'],
          ].map(([n, t, b]) => (
            <div key={n} className="relative">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-[#0079C1] font-heading text-xl font-extrabold" style={{ color: '#0079C1' }}>{n}</div>
              <div className="font-heading text-lg font-extrabold">{t}</div>
              <div className="mt-1 font-sans text-sm opacity-70">{b}</div>
            </div>
          ))}
        </div>
        <p className="mt-10 font-sans text-sm opacity-60">Built on React + Node + Supabase + Razorpay. Live in production today.</p>
      </Slide>

      {/* PROOF */}
      <Slide id="proof">
        <div className="mb-3"><Legend /></div>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Real, and already in use.</h2>
        <p className="mt-4 max-w-3xl font-sans text-lg text-ink/70">Live in production since June 2026 — not a prototype. Hosts are onboarding, publishing services, and getting paid today.</p>
        <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat value={d.proof.hosts} label="hosts onboarded" tag="actual" accent="#059669" sub="since Jun 2026" />
          <Stat value={d.proof.paid} label="on a paid plan" tag="actual" sub="paying hosts" />
          <Stat value={d.proof.leads} label="leads in pipeline" tag="actual" accent="#0079C1" sub={`${d.proof.leads30d} in last 30 days`} />
          <Stat value="Live" label="payments · GST · payouts" tag="actual" accent="#f59e0b" sub="in production" />
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card title="[Host name] · [category]" body="[One line on what they use Meeticulous for + a short real quote. Replace with a consented host story before sending.]" accent="#0079C1" />
          <Card title="[Host name] · [category]" body="[Second real host story — ideally a different category, e.g. a turf/studio vs a coach — to show breadth.]" accent="#059669" />
        </div>
        <p className="mt-4 font-sans text-[11px] text-ink/40">Host counts and pipeline are live production data; paid-plan count includes founder-attested off-platform activations. Swap the placeholder cards for consented, named host stories.</p>
      </Slide>

      {/* MARKET */}
      <Slide id="market">
        <div className="mb-3"><Legend /></div>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Every slot-based business in India.</h2>
        <div className="mt-5 inline-flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[6px] border-[3px] border-ink bg-white px-4 py-2 font-sans text-sm" style={{ boxShadow: '4px 4px 0 rgba(26,26,26,0.9)' }}>
          <span className="font-semibold">India's creator economy:</span>
          <span className="font-heading text-lg font-extrabold" style={{ color: '#0079C1' }}>{d.market.band.from}</span>
          <span className="text-ink/50">→</span>
          <span className="font-heading text-lg font-extrabold" style={{ color: '#0079C1' }}>{d.market.band.to}</span>
          <span className="rounded-[4px] bg-[#d1fae5] px-2 py-0.5 text-xs font-bold" style={{ color: '#065f46' }}>{d.market.band.cagr}</span>
        </div>
        <div className="mt-8 grid items-center gap-8 md:grid-cols-2">
          <div className="flex justify-center"><MarketRings rings={d.market.rings} /></div>
          <div className="space-y-4">
            {d.market.rings.map((m) => (
              <div key={m.k} className="rounded-[6px] border-[3px] border-ink bg-white p-4" style={{ boxShadow: '4px 4px 0 rgba(26,26,26,0.9)' }}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-heading text-sm font-extrabold" style={{ color: m.fg === '#fff' ? '#0079C1' : m.fg }}>{m.k}</span>
                  <Tag k={m.tag} />
                </div>
                <div className="mt-1 font-heading text-2xl font-extrabold">{m.v} <span className="text-sm font-semibold text-ink/50">{m.usd}</span></div>
                <div className="mt-1 font-sans text-xs text-ink/60">{m.note}</div>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-6 font-sans text-xs text-ink/50">Bottom-up. ARPU anchored to today's ₹229–₹555/mo plans. TAM/SAM are stated assumptions, not measured actuals.</p>
        <p className="mt-2 font-sans text-[11px] leading-snug text-ink/40">{d.market.sources}</p>
      </Slide>

      {/* BUSINESS MODEL */}
      <Slide id="model" dark>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">SaaS-first. Not a take-rate marketplace.</h2>
        <p className="mt-3 max-w-3xl font-sans text-lg opacity-75">Predictable subscription revenue is the core. A tiny per-booking fee rides along.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {d.model.tiers.map((t) => (
            <div key={t.n} className="rounded-[6px] border-[3px] p-5" style={{ borderColor: t.c, background: '#1c1a17' }}>
              <div className="font-heading text-lg font-extrabold" style={{ color: t.c }}>{t.n}</div>
              <div className="mt-2 font-heading text-3xl font-extrabold">{t.p}</div>
              <div className="mt-1 font-sans text-xs opacity-70">{t.s}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="rounded-[4px] border-2 border-white/20 px-3 py-1 font-sans text-sm">{d.model.fee} <Tag k="actual" className="ml-1" /></span>
          <span className="rounded-[4px] border-2 border-white/20 px-3 py-1 font-sans text-sm">{d.model.arpu} <Tag k="estimate" className="ml-1" /></span>
        </div>
      </Slide>

      {/* TRACTION */}
      <Slide id="traction">
        <div className="mb-3"><Legend /></div>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Small base, steep slope.</h2>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="mb-2 font-sans text-sm font-semibold text-ink/60">MRR — first 4 months (Jun → Sep 2026)</div>
            <MrrChart series={d.mrr} />
            <div className="mt-1 flex items-center gap-2 font-sans text-xs text-ink/50"><Tag k="estimate" /> trend to <Tag k="actual" /> current month</div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-center">
            <Stat value={d.traction.hosts} label="paying hosts" tag="actual" accent="#059669" />
            <Stat value={d.traction.mrr} label="MRR" tag="actual" />
            <Stat value={d.traction.arr} label="ARR run-rate" tag="actual" accent="#1DA1F2" sub="MRR × 12" />
            <Stat value="Live" label="payments · GST · payouts" tag="actual" accent="#0079C1" sub="in production" />
          </div>
        </div>
      </Slide>

      {/* GROWTH / FUNNEL */}
      <Slide id="growth" dark>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">The funnel already converts.</h2>
        <div className="mt-8 grid gap-10 lg:grid-cols-2">
          <div><div className="rounded-[6px] border-[3px] border-white/15 bg-[#1c1a17] p-5"><FunnelChart items={d.funnel} pct={d.funnelPct} /></div></div>
          <div className="self-center space-y-4 font-sans">
            <p className="text-lg opacity-80">~<span className="font-heading font-extrabold text-white">{paidPct}%</span> of onboarded hosts are on a paid plan <Tag k="actual" className="ml-1" /> — strong for self-serve SMB SaaS.</p>
            <p className="text-lg opacity-80">Acquisition is <span className="font-semibold text-white">organic-led</span>: SEO host profiles + word-of-mouth referral, near-zero paid spend today.</p>
            <p className="text-lg opacity-80">That keeps blended CAC low — the raise is about <span style={{ color: '#0079C1' }}>pouring fuel on a funnel that already works.</span></p>
          </div>
        </div>
      </Slide>

      {/* UNIT ECONOMICS */}
      <Slide id="unit">
        <div className="mb-3"><Legend /></div>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">The maths wants to scale.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.unit.map((u) => <Stat key={u.label} value={u.value} label={u.label} tag={u.tag} accent={u.accent} sub={u.sub} />)}
        </div>
        <p className="mt-6 max-w-3xl font-sans text-base text-ink/70">
          Retention data is still forming on a young base — we're targeting <span className="font-semibold">&lt;5% monthly logo churn</span> <Tag k="projection" className="mx-1" /> and instrumenting cohorts now. We show this openly rather than quoting a number we can't yet stand behind.
        </p>
      </Slide>

      {/* COMPETITION */}
      <Slide id="competition" dark>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Nobody covers India's rails end-to-end.</h2>
        <div className="mt-8 rounded-[6px] border-[3px] border-white/15 bg-[#F8FAFC] p-4 text-ink"><CompMatrix /></div>
        <p className="mt-5 font-sans text-sm opacity-70">Global schedulers (Calendly ~33%, Acuity ~21% of the category) stop at the calendar. Topmate nails creator 1:1 calls but not venues, GST or offline slots. Practo is health-only. The real incumbent is manual WhatsApp — which can't collect money or invoice.</p>
      </Slide>

      {/* MOAT */}
      <Slide id="moat">
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">The moat is India-shaped.</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Card title="Deep India payment rails" body="UPI autopay, Razorpay Route split-payouts, GST invoicing, TDS/TCS, KYC — months of compliance a global tool won't localise. Even India creator apps like Topmate stop at 1:1 calls." />
          <Card title="People + venues in one" body="Turfs and studios book by the hour; coaches book 1:1. We handle both — most tools do only calls." accent="#0079C1" />
          <Card title="WhatsApp-native" body="OTP login + AiSensy notifications ride India's real channel, not email nobody opens." accent="#059669" />
          <Card title="SEO host profiles" body="Every host is an indexed page that brings its own guests — compounding, owned distribution." accent="#f59e0b" />
        </div>
      </Slide>

      {/* GO TO MARKET */}
      <Slide id="gtm" dark>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Land solo, grow by proof.</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {[
            ['Wedge', 'Solo pros who already sell time and hate chasing payments — coaches, tutors, trainers.', '#0079C1'],
            ['Expand', 'Their category neighbours + local venues (turfs, studios) via referral and SEO profiles.', '#0079C1'],
            ['Compound', 'Each paid booking is a live demo to the guest — some guests become hosts. Built-in loop.', '#059669'],
          ].map(([t, b, c]) => (
            <div key={t}>
              <div className="mb-2 font-heading text-xl font-extrabold" style={{ color: c }}>{t}</div>
              <div className="font-sans text-sm opacity-75">{b}</div>
            </div>
          ))}
        </div>
        <p className="mt-8 font-sans text-base opacity-75">Channels: organic SEO (host profiles), referral, WhatsApp-led onboarding, targeted category outbound. Paid stays a lever, not a crutch.</p>
        <p className="mt-3 font-sans text-base font-semibold" style={{ color: '#0079C1' }}>This round funds one gate: scale the paying base and prove the funnel repeats at ₹60k+ MRR.</p>
      </Slide>

      {/* ROADMAP */}
      <Slide id="roadmap">
        <div className="mb-3"><Legend /></div>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">18 months, four gates.</h2>
        <div className="mt-8 space-y-3">
          {d.roadmap.map(([t, b, c]) => (
            <div key={t} className="flex items-stretch gap-4 rounded-[6px] border-[3px] border-ink bg-white p-4" style={{ boxShadow: '4px 4px 0 rgba(26,26,26,0.9)' }}>
              <div className="flex w-20 shrink-0 items-center justify-center rounded-[4px] font-heading text-sm font-extrabold text-white" style={{ background: c }}>{t}</div>
              <div className="self-center font-sans text-sm font-medium">{b}</div>
            </div>
          ))}
        </div>
        <p className="mt-4"><Tag k="projection" /> <span className="ml-1 font-sans text-xs text-ink/50">milestones the raise is scoped to unlock</span></p>
      </Slide>

      {/* FINANCIAL OUTLOOK / ASK */}
      <Slide id="ask" dark>
        <div className="mb-3"><Legend /></div>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Raising {d.cover.raise} to hit ₹1 Cr ARR.</h2>
        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <div>
            <div className="mb-2 font-sans text-sm font-semibold opacity-60">Projected MRR → 18 months</div>
            <div className="rounded-[6px] border-[3px] border-white/15 bg-[#1c1a17] p-4"><GrowthChart series={d.growth} /></div>
            <div className="mt-2 font-sans text-xs opacity-50"><Tag k="actual" /> now · <Tag k="projection" className="ml-1" /> forward path</div>
          </div>
          <div className="grid grid-cols-2 gap-3 self-center">
            {d.ask.map((s) => <Stat key={s.label} value={s.value} label={s.label} tag={s.tag} accent={s.accent} />)}
          </div>
        </div>
      </Slide>

      {/* USE OF FUNDS */}
      <Slide id="use">
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Where the money goes.</h2>
        <div className="mt-10"><FundsBar funds={d.funds} /></div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Card title="Product / engineering" body="First eng hire. Venue/hourly booking, reliability, moat features. Ship faster." />
          <Card title="Growth / GTM" body="Content + SEO scale, referral engine, targeted category outbound." accent="#0079C1" />
          <Card title="Founder runway" body="Buy ~18 focused months to hit the milestone ladder." accent="#059669" />
          <Card title="Ops / support / infra" body="Payments reliability, KYC, support, compliance." accent="#f59e0b" />
        </div>
      </Slide>

      {/* TEAM */}
      <Slide id="team" dark>
        <h2 className="font-heading text-3xl font-extrabold sm:text-5xl">Solo founder. The whole stack, shipped.</h2>
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[6px] border-[3px] p-6" style={{ borderColor: '#0079C1', background: '#1c1a17' }}>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#0079C1] bg-white">
                <img src="/sloth.png" alt="Meeticulous" width="52" height="52" className="object-contain" />
              </div>
              <div>
                <div className="font-heading text-2xl font-extrabold">{FOUNDER.name}</div>
                <div className="font-sans text-sm" style={{ color: '#0079C1' }}>{FOUNDER.role}</div>
              </div>
            </div>
            <p className="mt-4 font-sans text-sm opacity-80">{FOUNDER.background}</p>
            <p className="mt-2 font-sans text-sm opacity-80">{FOUNDER.why}</p>
          </div>
          <div>
            <div className="mb-3 font-sans text-sm font-semibold opacity-60">Shipped solo, live in production:</div>
            <div className="flex flex-wrap gap-2">
              {SHIPPED.map((s) => <span key={s} className="rounded-[4px] border-2 border-white/20 px-2.5 py-1 font-sans text-xs">{s}</span>)}
            </div>
          </div>
        </div>
        <p className="mt-6 max-w-3xl font-sans text-base opacity-70">
          The entire product — booking, payments, payouts, GST, CRM, notifications — was built and put live in ~3 months, solo. The bet: a founder who can build the machine this fast is who you want scaling it. The raise funds the first hires around it.
        </p>
      </Slide>

      {/* CLOSE */}
      <Slide id="close" className="relative overflow-hidden text-center" dark>
        <div className="pointer-events-none absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 50% 40%,#0079C1,transparent 60%)' }} />
        <div className="relative">
          <img src="/sloth.png" alt="Meeticulous" width="72" height="72" className="mx-auto mb-4 object-contain" />
          <h2 className="font-heading text-4xl font-extrabold leading-tight sm:text-6xl">
            The calm way to sell your time —<br /><span style={{ color: '#0079C1' }}>now raising to scale it.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl font-sans text-lg opacity-75">
            Working product, real early traction, India's rails built in. {d.cover.raise} unlocks the funnel we already have.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a href="mailto:bookasloth@gmail.com" className="rounded-[4px] border-[3px] border-[#0079C1] bg-[#0079C1] px-6 py-3 font-heading text-base font-extrabold text-white transition hover:brightness-110" style={{ boxShadow: '5px 5px 0 rgba(254,81,0,0.35)' }}>Let's talk →</a>
            <a href="https://meeticulous.com" target="_blank" rel="noreferrer" className="rounded-[4px] border-[3px] border-white/30 px-6 py-3 font-heading text-base font-extrabold text-white transition hover:border-white">See it live</a>
          </div>
          <p className="mt-10 font-sans text-xs opacity-40">Confidential · {FOUNDER.handle}</p>
        </div>
      </Slide>
    </main>
  );
}

// ── Entry: gate → fetch figures → deck ───────────────────────────────────────
export default function PitchDeck() {
  useHideChrome();
  const [data, setData] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let token;
    try { token = sessionStorage.getItem(TOKEN_KEY); } catch { token = null; }
    if (!token) { setChecking(false); return; }
    pitchApi('/data', { token })
      .then(setData)
      .catch(() => { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } })
      .finally(() => setChecking(false));
  }, []);

  const onUnlock = (token, deckData) => {
    try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
    setData(deckData);
  };

  return (
    <>
      <Seo title="Meeticulous — Investor Pitch Deck" description="Private investor access." robots="noindex, nofollow" />
      {checking ? <Splash text="Checking access…" /> : data ? <DeckBody d={data} /> : <Gate onUnlock={onUnlock} />}
    </>
  );
}
