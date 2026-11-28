// Cookie consent, per category (India DPDP / GDPR).
//
//   analytics — GA4 + Clarity: which pages get read, session replay.
//   marketing — Meta Pixel + GTM: ad measurement and retargeting audiences.
//
// Nothing in either category loads until the visitor allows it. PostHog and the
// first-party counter (adapters with no `consent` category) are always on — the
// banner says so under "Necessary". This module only persists the decision and
// notifies subscribers; the bus (index.js) lazy-loads the adapters a category unlocks.
//
// Stored as JSON { analytics, marketing } under KEY. null = undecided → banner shows.
const KEY = 'mt_cookie_consent';
// The one-switch banner wrote 'granted' / 'denied' here. A visitor who already chose
// keeps that choice for both categories and is not asked again.
const LEGACY_KEY = 'bas_marketing_consent';

export const CATEGORIES = ['analytics', 'marketing'];

const listeners = new Set();

const normalize = (o) => ({ analytics: !!o?.analytics, marketing: !!o?.marketing });

/** Current choice { analytics, marketing }, or null when the visitor hasn't chosen. */
export function getConsent() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy === 'granted') return { analytics: true, marketing: true };
    if (legacy === 'denied') return { analytics: false, marketing: false };
  } catch (_) { /* storage blocked or bad JSON → undecided */ }
  return null;
}

/** true / false = accept / reject everything; or { analytics, marketing } per category. */
export function setConsent(value) {
  const state = typeof value === 'object' && value !== null
    ? normalize(value)
    : { analytics: !!value, marketing: !!value };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
  listeners.forEach((fn) => { try { fn(state); } catch (_) {} });
  return state;
}

export function hasDecided() { return getConsent() !== null; }

/** Is this category allowed? Undecided = no. */
export function isGranted(category = 'analytics') { return !!getConsent()?.[category]; }

// Subscribe to consent changes (receives the new { analytics, marketing }).
export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
