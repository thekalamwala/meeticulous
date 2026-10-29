import { useSearchParams } from 'react-router-dom';
import { useHideChrome } from '../context/ChromeContext';
import Seo from '../components/common/Seo';

// /og/host/:username?name=&profession=&bio=&rating=&reviews=&bookings=&since=&avatar=&verified=&online=&meet=
//
// A render target for scripts/generateHostOgImages.mjs — NOT a page for humans.
// Draws a host's 1200x630 social card so puppeteer can screenshot it, exactly as
// /og/blog/:slug does for posts. All data arrives via the query string (the
// generator has DB access; a localhost page fetching the prod API is CORS-blocked
// — the same lesson the blog generator learned).
//
// noindex (Seo below + robots.txt /og/ disallow + absent from sitemap/prerender).

const OG_W = 1200;
const OG_H = 630;

// Design tokens — kept in sync with the OG family (see the founder card spec).
const C = {
  orange: '#2E1065',
  orangeSoft: '#FF9A42',
  ink: '#131317',
  panel: '#1A1A1F',
  panel2: '#2A2A33',
  white: '#F5F5F7',
  grey: '#A1A1AA',
  line: 'rgba(255,255,255,0.08)',
};

// Booking/review counts read nicer rounded: 247 stays 247, 820 -> "820+",
// 1240 -> "1.2k+". Exact reviews, compact bookings.
const compact = (n) => {
  const v = Number(n) || 0;
  if (v >= 1000) return `${(Math.floor(v / 100) / 10).toString().replace(/\.0$/, '')}k+`;
  if (v >= 10) return `${Math.floor(v / 10) * 10}+`;
  return String(v);
};

// A single verified check — one authoritative mark, not a pill repeated elsewhere.
const VerifiedTick = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 38, height: 38, borderRadius: '50%', background: C.orange,
    color: '#fff', fontSize: 21, fontWeight: 700,
  }}>✓</span>
);

// Faint calendar-motif backdrop, inspired by a scheduling grid: a dotted grid
// with a few numbered date cells + connectors, concentrated in the top-right and
// faded diagonally toward the centre. A whisper of product icons (clock, chat,
// rupee, video) sits small and near-invisible on the left. Never competes with
// the content — "there, but not there".
const CAL_CELLS = [
  { x: 726, y: 70, n: '05' }, { x: 862, y: 70, n: '06' }, { x: 998, y: 70, n: '07' },
  { x: 794, y: 168, n: '12' }, { x: 930, y: 168, n: '13' },
  { x: 658, y: 266, n: '18' }, { x: 1066, y: 266, n: '20' },
];
const BrandBackdrop = () => {
  const S = { fill: 'none', stroke: 'rgba(255,255,255,0.05)', strokeWidth: 4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  return (
    <svg width={OG_W} height={OG_H} viewBox={`0 0 ${OG_W} ${OG_H}`} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
      <defs>
        <pattern id="cal-dots" width="30" height="30" patternUnits="userSpaceOnUse">
          <circle cx="1.6" cy="1.6" r="1.6" fill="rgba(255,255,255,0.07)" />
        </pattern>
        {/* opaque top-right → transparent bottom-left, so the calendar fades on the diagonal */}
        <linearGradient id="cal-fade" x1="1" y1="0" x2="0.15" y2="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="cal-mask"><rect width={OG_W} height={OG_H} fill="url(#cal-fade)" /></mask>
      </defs>

      {/* Calendar grid + date cells — masked to the top-right diagonal */}
      <g mask="url(#cal-mask)">
        <rect x="520" y="0" width="680" height="470" fill="url(#cal-dots)" />
        {/* thin connectors between a few cells */}
        <g stroke="rgba(255,255,255,0.06)" strokeWidth="2" fill="none">
          <path d="M749 116 V168" /><path d="M817 116 V168" />
          <path d="M817 214 V266" /><path d="M953 214 V266 H1089" />
          <path d="M681 214 V266" />
        </g>
        {CAL_CELLS.map((c) => (
          <g key={c.n}>
            <rect x={c.x} y={c.y} width="46" height="46" rx="12" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="2" />
            <text x={c.x + 23} y={c.y + 30} textAnchor="middle" fontFamily="Poppins, sans-serif" fontSize="17" fontWeight="600" fill="rgba(255,255,255,0.11)">{c.n}</text>
          </g>
        ))}
      </g>

      {/* Product icons — small, faint, pushed to the left. "There but not there." */}
      <g opacity="0.5">
        <g transform="translate(70 300) scale(0.5)" {...S}>
          <circle cx="40" cy="40" r="38" /><line x1="40" y1="40" x2="40" y2="18" /><line x1="40" y1="40" x2="56" y2="46" />
        </g>
        <g transform="translate(150 430) scale(0.42)" {...S}>
          <path d="M18 20 h64 a12 12 0 0 1 12 12 v30 a12 12 0 0 1 -12 12 h-42 l-18 16 v-16 a12 12 0 0 1 -6 -10 v-32 a12 12 0 0 1 12 -12 z" />
        </g>
        <text x="60" y="510" fontFamily="Poppins, sans-serif" fontSize="52" fontWeight="700" fill="rgba(255,255,255,0.04)">₹</text>
        <g transform="translate(250 250) scale(0.4)" {...S}>
          <rect x="0" y="18" width="70" height="54" rx="10" /><path d="M74 34 L100 18 V72 L74 56 Z" />
        </g>
      </g>
    </svg>
  );
};

export default function HostOgCard() {
  const [params] = useSearchParams();
  useHideChrome();

  const name = params.get('name') || 'Meeticulous Host';
  const profession = params.get('profession') || '';
  const username = params.get('username') || '';
  const avatar = params.get('avatar') || '';
  const verified = params.get('verified') === '1';

  const reviews = Number(params.get('reviews')) || 0;
  const rating = Number(params.get('rating')) || 0;
  const bookings = Number(params.get('bookings')) || 0;
  const since = params.get('since') || '';

  // A brand-new host has no rating/bookings yet — show honest "New" states rather
  // than a hollow "0.0 / 0 bookings" that reads worse than saying nothing.
  const hasRating = reviews > 0 && rating > 0;

  const proofText = [
    hasRating ? `${reviews} review${reviews === 1 ? '' : 's'}` : null,
    bookings > 0 ? `${compact(bookings)} booked` : null,
    (!hasRating && bookings === 0 && since) ? `New host · since ${since}` : null,
  ].filter(Boolean).join('  ·  ');

  return (
    <div
      data-og-ready="true"
      style={{
        width: OG_W, height: OG_H, position: 'relative', overflow: 'hidden',
        background: `radial-gradient(1100px 700px at 78% 8%, rgba(254,81,0,0.16), transparent 60%), linear-gradient(150deg, ${C.ink} 0%, #0E0E12 100%)`,
        fontFamily: "'Poppins', system-ui, sans-serif",
      }}
    >
      <Seo robots="noindex" />
      <BrandBackdrop />

      {/* Brand — logo mark + domain, top-left */}
      <div style={{ position: 'absolute', top: 68, left: 72, display: 'flex', alignItems: 'center', gap: 15 }}>
        <img src="https://company-assets.meeticulous.in/images/email/footer-logo.png" alt=""
             style={{ width: 54, height: 54, borderRadius: '50%', objectFit: 'cover', background: '#fff' }}
             onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <span style={{ fontSize: 25, fontWeight: 700, color: 'rgba(245,245,247,0.9)', letterSpacing: -0.3 }}>www.meeticulous.com</span>
      </div>

      {/* Centre band: identity (left) + portrait stack (right). Bottom-aligned so
          the branding line's last row sits level with the CTA button. */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: '128px 72px 60px', gap: 60 }}>
        {/* ── Left: identity + proof + branding ─────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name — the verified tick flows inline right after the last character,
              no fixed offset, so it always sits at the name's end whatever the length. */}
          <div style={{
            fontSize: name.length > 21 ? 48 : name.length > 14 ? 56 : name.length > 10 ? 66 : 76,
            fontWeight: 800, color: C.white, lineHeight: 1.08, letterSpacing: -2,
          }}>
            {name}
            {verified && <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 16 }}><VerifiedTick /></span>}
          </div>

          {/* Profession + rating chip, one row */}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {profession && (
              <span style={{ fontSize: 31, fontWeight: 600, color: C.orange, letterSpacing: -0.3 }}>{profession}</span>
            )}
            {hasRating && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 14px',
                borderRadius: 999, background: 'rgba(254,81,0,0.14)', color: C.white,
                fontSize: 20, fontWeight: 700,
              }}>
                <span style={{ color: C.orangeSoft }}>★</span> {rating.toFixed(1)}
              </span>
            )}
          </div>

          {/* Proof line — directly under the profession */}
          {proofText && (
            <div style={{ marginTop: 12, fontSize: 20, color: C.grey, fontWeight: 500 }}>{proofText}</div>
          )}

          {/* Branding line — fills the space below */}
          <div style={{ marginTop: 26, maxWidth: 560, fontSize: 22, lineHeight: 1.55, color: 'rgba(245,245,247,0.6)', fontWeight: 400 }}>
            Meet, book, and connect with people worth your time. Powered by{' '}
            <span style={{ color: 'rgba(245,245,247,0.92)', fontWeight: 600 }}>Meeticulous</span>, where great bookings begin.
          </div>
        </div>

        {/* ── Right: portrait → @username → CTA ──────────── */}
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 268, height: 268, borderRadius: '50%', padding: 5,
            background: `conic-gradient(from 140deg, ${C.orange}, ${C.orangeSoft}, ${C.orange})`,
            boxShadow: '0 0 90px -10px rgba(254,81,0,0.25)', // glow halved
          }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: C.panel2 }}>
              {avatar
                ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 100, fontWeight: 800, color: C.grey }}>{name.charAt(0)}</div>}
            </div>
          </div>

          {/* @username */}
          {username && (
            <div style={{ marginTop: 22, fontSize: 24, fontWeight: 700, color: C.white, letterSpacing: -0.2 }}>
              @{username}
            </div>
          )}

          {/* CTA — glow reduced ~90% (a hair of depth, no orange bloom) */}
          <div style={{
            marginTop: 22, padding: '15px 30px', borderRadius: 12, background: C.orange,
            color: '#fff', fontSize: 20, fontWeight: 700, letterSpacing: -0.2,
            boxShadow: '0 3px 8px -5px rgba(0,0,0,0.4)',
          }}>Book an Appointment Now</div>
        </div>
      </div>
    </div>
  );
}
