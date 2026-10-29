// PostHog adapter — first-party product analytics, always-on (not consent-gated).
//
// posthog-js (~67 kB gzip) is DYNAMICALLY imported here so it stays OUT of the
// initial bundle that loads on every page. init() is triggered on first interaction / 4s after load by
// the analytics bus (AnalyticsBridge), so the SDK never competes with first paint.
// Calls made before the SDK finishes loading are queued and flushed on load, so no
// events are dropped during the gap.
//
// Identity is driven through the bus (AuthContext → analytics.identify/reset),
// matching the "never call posthog directly in a component" rule.
let ph = null;        // posthog-js singleton, once loaded
let loading = null;   // in-flight import promise — makes init() idempotent
const queue = [];     // calls made before the SDK is ready

// Conversion events the SERVER emits authoritatively into PostHog (server/utils/
// trackServer → posthog-node). The client fires its own copy of these ONLY for the
// browser retargeting pixels (Meta/GA4 de-dupe against the server on event_id), but
// the analytics bus fans every track() to PostHog too — so PostHog counted each of
// these twice (measured: booking_paid = 15 web + 22 server hits). PostHog has no
// event_id de-dup, so drop the client copy here and let the server own the count.
const SERVER_OWNED_EVENTS = new Set([
  'booking_created',
  'booking_paid',
  'product_purchased',
  'subscription_started',
  'user_registered',
]);

function flush() {
  while (queue.length) {
    const { fn, args } = queue.shift();
    try { ph?.[fn]?.(...args); } catch (_) { /* analytics never breaks the app */ }
  }
}

function call(fn, args) {
  if (ph) { try { ph[fn](...args); } catch (_) {} }
  else queue.push({ fn, args });
}

export default {
  name: 'posthog',
  needsConsent: false, // always-on, first-party

  init() {
    if (loading) return loading;
    const token = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN;
    if (!token || typeof window === 'undefined') { loading = Promise.resolve(); return loading; }
    loading = import('posthog-js')
      .then(({ default: posthog }) => {
        posthog.init(token, {
          api_host: import.meta.env.VITE_POSTHOG_HOST,
          defaults: '2026-01-30',
          // Remote config auto-loads four extra bundles from
          // us-assets.i.posthog.com on EVERY page: session recorder (53 KiB),
          // surveys (33 KiB), web-vitals (3 KiB) and dead-click autocapture
          // (7 KiB) — 98 KiB of third-party JS and ~150ms of main-thread work
          // for features we do not use. Events, pageviews, funnels and
          // identify() are unaffected; flip any of these back on the day the
          // corresponding PostHog feature is actually wanted.
          //
          // NOTE: capture_dead_clicks stops dead-click EVENTS, but the 7 KiB
          // extension still downloads because heatmaps lazy-loads it with a
          // hard-coded isEnabled. Add `capture_heatmaps: false` to drop that
          // last request (and its capture-phase click/mousemove listeners) —
          // left on because heatmaps are a separate product decision.
          disable_session_recording: true,
          disable_surveys: true,
          capture_dead_clicks: false,
          capture_performance: { web_vitals: false },
          // Autocapture fires its OWN $pageview on load AND on every SPA history
          // change, and AnalyticsBridge ALSO fires a deliberate $pageview via
          // analytics.page() on each route change — so every navigation was logged
          // as two $pageview events (measured: 33k $pageview vs 18k route changes).
          // Keep the deliberate, prop-carrying page() call as the single source and
          // turn off the autocapture duplicate.
          capture_pageview: false,
        });
        ph = posthog;
        flush();
      })
      .catch(() => { /* offline / blocked — never break the app for analytics */ });
    return loading;
  },

  identify(id, props) { call('identify', [String(id), props]); },
  track(event, props) {
    // Server owns these in PostHog (see SERVER_OWNED_EVENTS) — skip the client copy
    // so paid bookings / registrations aren't double-counted.
    if (SERVER_OWNED_EVENTS.has(event)) return;
    call('capture', [event, props]);
  },
  page(props) { call('capture', ['$pageview', props]); },
  reset() { call('reset', []); },
};
