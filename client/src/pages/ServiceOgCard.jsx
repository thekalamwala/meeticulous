import { useSearchParams } from 'react-router-dom';
import { useHideChrome } from '../context/ChromeContext';
import Seo from '../components/common/Seo';

// /og/service/:username/:slug?title=&hostName=&profession=&price=&currency=&rating=&reviews=&avatar=&username=&verified=
//
// A render target for scripts/generateServiceOgImages.mjs — NOT a page for humans.
// The per-SERVICE sibling of HostOgCard: draws a 1200x630 social card for one
// service so puppeteer can screenshot it. Same design family as the host card
// (C tokens, calendar backdrop, brand line, portrait ring, CTA) — only the
// identity block swaps host→service. All data arrives via the query string (the
// generator has DB access; a localhost page fetching the prod API is CORS-blocked
// — the lesson HostOgCard documents).
//
// noindex (Seo below + robots.txt /og/ disallow + absent from sitemap/prerender).

const OG_W = 1200;
const OG_H = 630;

// Design tokens — kept in sync with the OG family (see HostOgCard).
const C = {
  orange: '#960D32',
  orangeSoft: '#FF9A42',
  ink: '#131317',
  panel: '#1A1A1F',
  panel2: '#2A2A33',
  white: '#F5F5F7',
  grey: '#A1A1AA',
  line: 'rgba(255,255,255,0.08)',
};

// A single verified check — one authoritative mark.
const VerifiedTick = () => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34, borderRadius: '50%', background: C.orange,
    color: '#fff', fontSize: 19, fontWeight: 700,
  }}>✓</span>
);

// Faint calendar-motif backdrop (identical to HostOgCard) — a dotted grid with a
// few numbered date cells + connectors, faded diagonally toward the centre, plus
// a whisper of product icons on the left. "There, but not there."
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
        <linearGradient id="cal-fade" x1="1" y1="0" x2="0.15" y2="0.9">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="cal-mask"><rect width={OG_W} height={OG_H} fill="url(#cal-fade)" /></mask>
      </defs>

      <g mask="url(#cal-mask)">
        <rect x="520" y="0" width="680" height="470" fill="url(#cal-dots)" />
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

// ₹1,499 reads better than ₹1499 on the price chip.
const rupees = (n) => Number(n || 0).toLocaleString('en-IN');

export default function ServiceOgCard() {
  const [params] = useSearchParams();
  useHideChrome();

  const title = params.get('title') || 'Book a session';
  const hostName = params.get('hostName') || '';
  const profession = params.get('profession') || '';
  const username = params.get('username') || '';
  const avatar = params.get('avatar') || '';
  const verified = params.get('verified') === '1';
  const currency = params.get('currency') || 'INR';

  const price = Number(params.get('price')) || 0;
  const reviews = Number(params.get('reviews')) || 0;
  const rating = Number(params.get('rating')) || 0;

  // Real reviews only — a brand-new service shows no hollow "0.0".
  const hasRating = reviews > 0 && rating > 0;
  const priceLabel = price > 0 ? `${currency === 'INR' ? '₹' : ''}${rupees(price)}` : 'Free';

  // "with {host} · {profession}" — drop the dot if either half is missing.
  const sub = [hostName ? `with ${hostName}` : '', profession].filter(Boolean).join('  ·  ');

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

      {/* Centre band: service identity (left) + host portrait stack (right). */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', padding: '128px 72px 60px', gap: 60 }}>
        {/* ── Left: service title + host sub + price/rating chips + branding ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Service title — the hero line. Sized down as it grows so a long
              host-authored title still fits without truncation. */}
          <div style={{
            fontSize: title.length > 40 ? 46 : title.length > 28 ? 56 : title.length > 18 ? 66 : 76,
            fontWeight: 800, color: C.white, lineHeight: 1.08, letterSpacing: -1.5,
          }}>
            {title}
          </div>

          {/* "with {host} · {profession}" + inline verified tick */}
          {sub && (
            <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, fontSize: 30, fontWeight: 600, color: C.orange, letterSpacing: -0.3 }}>
              <span>{sub}</span>
              {verified && <span style={{ display: 'inline-flex', verticalAlign: 'middle' }}><VerifiedTick /></span>}
            </div>
          )}

          {/* Price + rating chips, one row */}
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', padding: '9px 20px',
              borderRadius: 999, background: 'rgba(254,81,0,0.16)', color: C.white,
              fontSize: 26, fontWeight: 800, letterSpacing: -0.4,
            }}>{priceLabel}</span>
            {hasRating && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 18px',
                borderRadius: 999, background: 'rgba(255,255,255,0.06)', color: C.white,
                fontSize: 22, fontWeight: 700,
              }}>
                <span style={{ color: C.orangeSoft }}>★</span> {rating.toFixed(1)}
                <span style={{ color: C.grey, fontWeight: 500, fontSize: 18 }}>({reviews})</span>
              </span>
            )}
          </div>

          {/* Branding line — fills the space below */}
          <div style={{ marginTop: 26, maxWidth: 560, fontSize: 22, lineHeight: 1.55, color: 'rgba(245,245,247,0.6)', fontWeight: 400 }}>
            Meet, book, and connect with people worth your time. Powered by{' '}
            <span style={{ color: 'rgba(245,245,247,0.92)', fontWeight: 600 }}>Meeticulous</span>, where great bookings begin.
          </div>
        </div>

        {/* ── Right: host portrait → @username → CTA ──────────── */}
        <div style={{ width: 360, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: 268, height: 268, borderRadius: '50%', padding: 5,
            background: `conic-gradient(from 140deg, ${C.orange}, ${C.orangeSoft}, ${C.orange})`,
            boxShadow: '0 0 90px -10px rgba(254,81,0,0.25)',
          }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: C.panel2 }}>
              {avatar
                ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 100, fontWeight: 800, color: C.grey }}>{(hostName || title).charAt(0)}</div>}
            </div>
          </div>

          {/* @username */}
          {username && (
            <div style={{ marginTop: 22, fontSize: 24, fontWeight: 700, color: C.white, letterSpacing: -0.2 }}>
              @{username}
            </div>
          )}

          {/* CTA */}
          <div style={{
            marginTop: 22, padding: '15px 34px', borderRadius: 12, background: C.orange,
            color: '#fff', fontSize: 21, fontWeight: 700, letterSpacing: -0.2,
            boxShadow: '0 3px 8px -5px rgba(0,0,0,0.4)',
          }}>Book Now</div>
        </div>
      </div>
    </div>
  );
}
