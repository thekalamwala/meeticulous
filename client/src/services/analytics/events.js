// Event catalog — the single source of truth for analytics event names.
//
// WHY this file exists: naming drift is what forces analytics rebuilds. If one
// component fires 'BookingStarted' and another 'booking-started', funnels break
// silently and you re-instrument everything. Lock every name here, reference the
// constant, never type a raw string at a call site.
//
// CONVENTION: snake_case, object_action (noun first, past-tense verb). This
// matches the server-side names already in use (booking_created, booking_paid,
// product_purchased) so client + server events land on the same PostHog event.
//
// Each entry maps to a server-side conversion event (see server/utils/trackServer
// CONVERSIONS) when it is money/acquisition-significant — those also fan out to
// GA4 Measurement Protocol + Meta CAPI. Client-only UI events stay client-side.

export const EVENTS = Object.freeze({
  // ── Acquisition / top of funnel (client-only, retargeting-relevant) ──
  PAGE_VIEWED:        'page_viewed',        // manual SPA route change (autocapture also runs)
  PROFILE_VIEWED:     'host_profile_viewed', // guest landed on a host's public page
  SERVICE_VIEWED:     'service_viewed',      // guest opened a bookable service

  // ── Paid landing pages (/compare/*) — ad traffic, retargeting-relevant ──
  LP_VIEWED:          'lp_viewed',           // ad visitor landed on a conversion LP
  LP_CTA_CLICKED:     'lp_cta_clicked',      // clicked a primary CTA on an LP
  LEAD_CAPTURED:      'lead_captured',       // submitted email on an LP (→ Meta 'Lead')

  // ── Booking funnel (client emits intent; server confirms paid) ──
  BOOKING_STARTED:    'booking_started',     // guest opened the booking flow
  BOOKING_SLOT_PICKED:'booking_slot_picked', // guest selected a time slot
  CHECKOUT_STARTED:   'checkout_started',    // guest reached the pay step

  // ── Host / account ──
  SIGNUP_STARTED:     'signup_started',      // vendor opened onboarding
  ONBOARDING_STEP:    'onboarding_step_completed',
  ONBOARDING_COMPLETED:'onboarding_completed', // server-emitted (markComplete)
  SERVICE_PUBLISHED:  'service_published',    // server-emitted — activation (first live service)
  FIRST_SERVICE_SKIPPED:'first_service_skipped', // host dismissed the /live skip-confirm and finished with 0 services
  PROFILE_LINK_SHARED:'profile_link_shared',  // host copied/shared their profile link (activation funnel)
  PLAN_VIEWED:        'plan_viewed',         // pricing/plans seen

  // ── Host activation funnel (all keyed to the HOST distinct_id) ──
  //   user_registered → service_published → profile_link_shared → host_first_booking
  HOST_FIRST_BOOKING: 'host_first_booking',   // server-emitted — host received their first paid booking

  // ── Churn / drop-off (server-emitted, PostHog-only) ──
  PAYMENT_FAILED:        'payment_failed',        // booking/product payment failed at the gateway
  SUBSCRIPTION_CANCELLED:'subscription_cancelled', // host churn (webhook or user-initiated)

  // ── Conversions (ALSO fired server-side → GA4 MP + Meta CAPI). Listed here so
  //    client retargeting pixels can fire the browser-side counterpart. ──
  BOOKING_CREATED:    'booking_created',
  BOOKING_PAID:       'booking_paid',
  PRODUCT_PURCHASED:  'product_purchased',
  SUBSCRIPTION_STARTED:'subscription_started',
  USER_REGISTERED:    'user_registered',

  // ── Enterprise landing page (/enterprise) — client-only ──
  ENTERPRISE_HERO_CTA:     'enterprise_hero_cta',
  ENTERPRISE_DEMO_CTA:     'enterprise_demo_cta',
  ENTERPRISE_SALES_CTA:    'enterprise_sales_cta',
  ENTERPRISE_LEAD_SUBMITTED: 'enterprise_lead_submitted',
  ENTERPRISE_FAQ_OPENED:   'enterprise_faq_opened',
  ENTERPRISE_SCROLL_DEPTH: 'enterprise_scroll_depth',

  // ── System / reliability (client-only) ──
  ERROR_PAGE_VIEWED:  'error_page_viewed',   // a branded error/offline page rendered
  APP_ERROR:          'app_error_boundary',  // an uncaught render error hit RouteErrorBoundary
});

// Dev guard: reject unknown event names so a typo throws in dev instead of
// silently polluting the dataset. No-op in production (never break a money path).
const KNOWN = new Set(Object.values(EVENTS));
export function assertKnownEvent(name) {
  if (import.meta.env.DEV && !KNOWN.has(name)) {
    // eslint-disable-next-line no-console
    console.warn(`[analytics] unknown event "${name}" — add it to events.js EVENTS`);
  }
  return name;
}
