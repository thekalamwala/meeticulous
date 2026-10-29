// Meta (Facebook) Pixel adapter. Browser-side pixel = retargeting audiences +
// ad-side conversion signal. The AUTHORITATIVE conversion signal is server-side
// via the Conversions API (server/utils/trackServer); Meta de-dupes browser+server
// on event_id. Browser pixels degrade (ad-blockers, ITP) — never rely on this
// alone for conversion counts, only for audience building.
//
// Event-name mapping: Meta has a fixed standard-event vocabulary. Our internal
// names map to the nearest standard event; unmapped names go as trackCustom.
const PIXEL_ID = import.meta.env.VITE_FB_PIXEL_ID;

const STANDARD = {
  // booking_started (opening the flow) stays a custom event on purpose: only
  // checkout_started maps to InitiateCheckout, and it carries event_id=booking.id
  // so Meta de-dupes it against the server's booking_created InitiateCheckout hit.
  // Mapping booking_started here too fired a second, event_id-less InitiateCheckout
  // that Meta could never merge — inflating the metric. One mapped event, deduped.
  checkout_started:  'InitiateCheckout',
  booking_paid:      'Purchase',
  product_purchased: 'Purchase',
  user_registered:   'CompleteRegistration',
  subscription_started: 'Subscribe',
  service_viewed:    'ViewContent',
  host_profile_viewed: 'ViewContent',
  lead_captured:     'Lead',
};

let loaded = false;

export default {
  name: 'pixel',
  // Fires pre-consent (base pixel + PageView) so retargeting audiences
  // (e.g. "Website Visitors") fill from all prod visitors, not only those who
  // accept the marketing banner. Deliberate business decision — DPDP/GDPR risk
  // accepted by founder. Still prod-host gated in the bus (meeticulous.com only).
  needsConsent: false,
  init() {
    if (loaded || !PIXEL_ID || typeof window === 'undefined') return;
    loaded = true;
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
      document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', PIXEL_ID);
    window.fbq('track', 'PageView');
  },
  identify() { /* Meta matches via cookie/_fbp; advanced matching is server-side (CAPI) */ },
  track(event, props = {}) {
    if (!window.fbq) return;
    const std = STANDARD[event];
    // event_id lets Meta de-dupe this browser hit against the server CAPI hit.
    const opts = props.event_id ? { eventID: props.event_id } : undefined;
    if (std) window.fbq('track', std, props, opts);
    else window.fbq('trackCustom', event, props, opts);
  },
  page() {
    if (!window.fbq) return;
    window.fbq('track', 'PageView');
  },
};
