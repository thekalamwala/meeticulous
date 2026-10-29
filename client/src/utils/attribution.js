// attribution.js — capture marketing attribution once, remember first touch.
//
// On first arrival we snapshot the URL's UTM params + referrer + landing path
// and persist them (first-touch, sticky). getAttribution() returns that snapshot
// so signup / newsletter / enterprise calls can send it to the CRM. localStorage
// is best-effort — a private window or blocked storage just yields no attribution.

const KEY = 'bas_attribution';
const UTM = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

// Instagram/Meta (Advantage+) and Google Ads frequently append ONLY a click id —
// fbclid / gclid — and no utm_* params. Without this, a Reels-ad visitor arrived
// with no stored source and the lead's source column came back null ("which Reel
// converted?" was unanswerable). We infer the source from the click id so the
// reportable column is populated; the raw click id is still preserved verbatim
// inside landing_page below for exact attribution. A real utm_source always wins.
const CLICK_ID_SOURCE = {
  fbclid: { utm_source: 'facebook', utm_medium: 'paid' },
  gclid: { utm_source: 'google', utm_medium: 'cpc' },
};

function readStore() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

// Read attribution from the current URL, or null if none present.
function fromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    const out = {};
    for (const k of UTM) { const v = q.get(k); if (v) out[k] = v.slice(0, 200); }
    // Click-id-only arrival: infer source so the touch isn't dropped.
    if (!UTM.some((k) => out[k])) {
      for (const [id, infer] of Object.entries(CLICK_ID_SOURCE)) {
        if (q.get(id)) { Object.assign(out, infer); break; }
      }
    }
    if (!UTM.some((k) => out[k])) return null; // no utm and no click id → not a real touch
    // Keep the raw click id as its own field (server stores it in a first-class
    // leads column) — the join key back to the exact ad, kept even when a real
    // utm_source is also present.
    for (const id of Object.keys(CLICK_ID_SOURCE)) {
      const v = q.get(id);
      if (v) out[id] = v.slice(0, 255);
    }
    if (document.referrer) out.referrer = document.referrer.slice(0, 500);
    out.landing_page = (window.location.pathname + window.location.search).slice(0, 500);
    return out;
  } catch { return null; }
}

// Call once on app load. Stores the FIRST utm-tagged touch and never overwrites
// it — so the acquisition source survives later untagged navigation.
export function captureAttribution() {
  try {
    if (readStore()) return;            // first touch already recorded
    const att = fromUrl();
    if (att) localStorage.setItem(KEY, JSON.stringify({ ...att, at: new Date().toISOString() }));
  } catch { /* storage blocked — no-op */ }
}

// The stored attribution payload to attach to a lead-creating request, or null.
export function getAttribution() {
  const s = readStore();
  if (!s) return null;
  const { at, ...att } = s; // send the fields; the server stamps its own timestamp
  return Object.keys(att).length ? att : null;
}
