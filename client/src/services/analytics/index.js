// Unified analytics bus — the ONLY analytics surface components may import.
//
// Rule that prevents rebuilds: never call posthog/gtag/fbq/clarity directly in a
// component. Call analytics.track(EVENTS.X, props). Adding/removing a tool next
// year = edit one adapter file; zero call-site churn.
//
//   import { analytics } from '@/services/analytics';
//   import { EVENTS } from '@/services/analytics/events';
//   analytics.track(EVENTS.BOOKING_STARTED, { service_id });
//
// Consent model:
//   - PostHog + Meta Pixel (needsConsent:false) are always-on; their SDKs are
//     dynamically imported and initialised on first interaction / 4s after load
//     (see AnalyticsBridge) so
//     they stay out of the initial bundle and off the first-paint critical path.
//     The Pixel fires pre-consent by deliberate business decision (fills
//     retargeting audiences from all prod visitors — see adapters/pixel.js).
//   - GA4 / Clarity / GTM (needsConsent:true) load ONLY after the user grants
//     marketing consent. Events fired before consent are dropped for those tools
//     (not replayed) — we never backfill pre-consent activity into those tools.
import { assertKnownEvent } from './events';
import { getConsent, onConsentChange, setConsent, isGranted, hasDecided } from './consent';
import posthog from './adapters/posthog';
import ga4 from './adapters/ga4';
import pixel from './adapters/pixel';
import clarity from './adapters/clarity';
import gtm from './adapters/gtm';

const ADAPTERS = [posthog, ga4, pixel, clarity, gtm];

// Only the real production site may send analytics. Vite's import.meta.env.PROD is
// ALSO true on Vercel preview builds, so it can't tell preview from prod — gate on
// the hostname instead. Without this gate every developer localhost session and
// every *.vercel.app preview deploy lands in the ONE production PostHog project:
// measured over 90 days that was ~78 phantom "users" / ~4k events from localhost
// plus a swarm of preview domains, polluting the activation + booking funnels and
// inflating the crash stats (RouteErrorBoundary reports through here too). Set
// VITE_ANALYTICS_DEBUG=true to force-enable while testing analytics off-prod.
const PROD_ANALYTICS_HOSTS = new Set(['meeticulous.com', 'www.meeticulous.com']);
export function analyticsEnabled() {
  if (import.meta.env.VITE_ANALYTICS_DEBUG === 'true') return true;
  if (typeof window === 'undefined' || !window.location) return false;
  return PROD_ANALYTICS_HOSTS.has(window.location.hostname);
}

const ready = new Set();   // adapters that have run init()
let lastIdentify = null;   // re-apply identity to adapters that init after login

function initAdapter(a) {
  if (ready.has(a)) return;
  try { a.init(); ready.add(a); } catch (_) { /* never break the app for analytics */ }
  // If a user already logged in before this (gated) adapter loaded, replay identity.
  if (lastIdentify && a.identify) {
    try { a.identify(lastIdentify.id, lastIdentify.props); } catch (_) {}
  }
}

function activeAdapters() {
  return ADAPTERS.filter((a) => !a.needsConsent || isGranted());
}

// Boot (call on first idle): always-on adapters now; gated adapters when (and if)
// consent is granted.
export function initAnalytics() {
  if (!analyticsEnabled()) return;
  ADAPTERS.filter((a) => !a.needsConsent).forEach(initAdapter);
  if (isGranted()) ADAPTERS.filter((a) => a.needsConsent).forEach(initAdapter);
  onConsentChange((v) => {
    if (v === 'granted') ADAPTERS.filter((a) => a.needsConsent).forEach(initAdapter);
    // 'denied' after a prior 'granted' would need a reload to fully unload SDKs;
    // we simply stop routing new events to them (activeAdapters() drops them).
  });
}

export const analytics = {
  // Link events to a known user, fanning to every active adapter (incl. PostHog).
  // AuthContext's central watcher is the only caller — see its useEffect.
  identify(id, props = {}) {
    if (!id || !analyticsEnabled()) return;
    lastIdentify = { id, props };
    activeAdapters().forEach((a) => { try { a.identify?.(id, props); } catch (_) {} });
  },

  // Unlink on logout. Fires the reset hook on adapters that support it (PostHog).
  reset() {
    lastIdentify = null;
    if (!analyticsEnabled()) return;
    activeAdapters().forEach((a) => { try { a.reset?.(); } catch (_) {} });
  },

  track(event, props = {}) {
    const name = assertKnownEvent(event);
    if (!analyticsEnabled()) return;
    activeAdapters().forEach((a) => { try { a.track?.(name, props); } catch (_) {} });
  },

  page(props = {}) {
    if (!analyticsEnabled()) return;
    activeAdapters().forEach((a) => { try { a.page?.(props); } catch (_) {} });
  },

  // re-exported so UI (consent banner) can drive consent without a second import.
  setConsent, getConsent, isGranted, hasDecided,
};

// Read the GA4 browser client_id from the _ga cookie, to forward to the backend at
// checkout so server-side GA4 Measurement Protocol events join the SAME web session
// (instead of a synthesized id). Returns undefined if GA4 hasn't set the cookie
// (no consent / not loaded) — backend then falls back to a synthesized id.
export function gaClientId() {
  try {
    const m = document.cookie.match(/_ga=GA\d\.\d\.([\d.]+)/);
    return m ? m[1] : undefined;
  } catch (_) { return undefined; }
}

export { EVENTS } from './events';
