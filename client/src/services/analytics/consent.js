// Consent state for marketing/tracking tools (GA4, Meta Pixel, Clarity).
//
// India DPDP / GDPR: ad + session-replay tools must not load until the user opts
// in. PostHog (first-party product analytics) is exempt and always-on. This module
// just persists the decision and notifies subscribers; the bus (index.js) reacts
// by lazy-loading the gated adapters.
//
// States: 'granted' | 'denied' | null (undecided → banner shows, nothing loads).
const KEY = 'bas_marketing_consent';

const listeners = new Set();

export function getConsent() {
  try { return localStorage.getItem(KEY); } catch (_) { return null; }
}

export function setConsent(value) {
  // value: true → 'granted', false → 'denied'
  const v = value ? 'granted' : 'denied';
  try { localStorage.setItem(KEY, v); } catch (_) {}
  listeners.forEach((fn) => { try { fn(v); } catch (_) {} });
  return v;
}

export function hasDecided() { return getConsent() !== null; }
export function isGranted() { return getConsent() === 'granted'; }

// Subscribe to consent changes. Returns an unsubscribe fn.
export function onConsentChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
