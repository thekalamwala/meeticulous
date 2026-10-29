// GA4 adapter (gtag.js). Loads the gtag script on init (only called after consent).
// Browser-side GA4 covers acquisition/channel attribution + Google Ads audiences.
// Server-side conversions ALSO go to GA4 via Measurement Protocol (server/utils/
// trackServer) so paid events survive ad-blockers/ITP — the browser hit here is
// the best-effort counterpart, GA4 de-dupes on the shared event + client params.
const MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID;

let loaded = false;

export default {
  name: 'ga4',
  needsConsent: true,
  init() {
    if (loaded || !MEASUREMENT_ID || typeof document === 'undefined') return;
    loaded = true;
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    // send_page_view:false — we drive page views explicitly via page() so SPA
    // route changes are counted (gtag's auto pageview only fires once on load).
    window.gtag('config', MEASUREMENT_ID, { send_page_view: false });
  },
  identify(id) {
    if (!window.gtag || !MEASUREMENT_ID) return;
    window.gtag('config', MEASUREMENT_ID, { user_id: String(id) });
  },
  track(event, props) {
    if (!window.gtag) return;
    window.gtag('event', event, props);
  },
  page(props) {
    if (!window.gtag) return;
    window.gtag('event', 'page_view', props);
  },
};
