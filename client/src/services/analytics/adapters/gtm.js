// Google Tag Manager adapter. Loads the GTM container loader on init — and init is
// only called after the user grants marketing consent (same gate as ga4/pixel/
// clarity), so no GTM-managed tag fires before consent.
//
// Unlike the other adapters, which each load ONE tool, GTM is a *container*: tags
// you add in the GTM dashboard fire through it. GA4 / Meta Pixel / Clarity stay as
// their own first-class adapters here — do NOT also configure them inside the GTM
// container, or they double-fire. Use GTM for *additional* tags only.
//
// Events are forwarded to the GTM dataLayer via window.dataLayer.push. That
// dataLayer is shared with ga4's gtag(); harmless — GTM consumes {event,...} object
// pushes while gtag consumes its own arguments-shaped pushes, neither reads the
// other's.
const CONTAINER_ID = import.meta.env.VITE_GTM_CONTAINER_ID;

let loaded = false;

export default {
  name: 'gtm',
  needsConsent: true,
  init() {
    if (loaded || !CONTAINER_ID || typeof document === 'undefined') return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });
    const s = document.createElement('script');
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtm.js?id=${CONTAINER_ID}`;
    document.head.appendChild(s);
  },
  identify(id, props = {}) {
    if (!loaded || typeof window === 'undefined' || !window.dataLayer) return;
    // Expose user_id as a dataLayer variable any GTM tag can reference.
    window.dataLayer.push({ user_id: String(id), ...props });
  },
  track(event, props = {}) {
    if (!loaded || typeof window === 'undefined' || !window.dataLayer) return;
    window.dataLayer.push({ event, ...props });
  },
  page(props = {}) {
    if (!loaded || typeof window === 'undefined' || !window.dataLayer) return;
    window.dataLayer.push({ event: 'page_view', ...props });
  },
};
