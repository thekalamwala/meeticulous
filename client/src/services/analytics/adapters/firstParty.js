// First-party adapter — the store behind Creator Intelligence.
// Design: docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §11
//
// Posts to our own origin, so an ad-blocker's third-party list cannot silently
// delete a host's financial funnel the way it deletes GA4 and Pixel. That is the
// whole point: this is the only adapter whose numbers a host is shown and
// charged for, so it cannot be the one that quietly under-reports.
//
// ZERO CALL-SITE CHANGES. Every existing analytics.track() already carries
// host_id and service_id where they exist (verified across HostProfile.jsx and
// ServiceBooking.jsx), so adding this file to ADAPTERS is the entire wiring. An
// event with no host_id is dropped rather than guessed at — it is a page we do
// not attribute, not a host we might mis-attribute.
//
// Consent: first-party, no third-party cookie, no cross-site identifier, no PII.
// That puts it in the always-on tier alongside PostHog and Pixel. If a later
// decision says otherwise, flip needsConsent and the rollups simply have a gap
// that the "as of" stamp already shows.

const ENDPOINT = '/api/analytics/collect';
const VISITOR_KEY = 'mt_vid';
const SESSION_KEY = 'mt_sid';
const QUEUE_KEY = 'mt_evq';

const VISITOR_TTL_MS = 400 * 24 * 60 * 60 * 1000; // 400 days, matching the cookie norm
const SESSION_IDLE_MS = 30 * 60 * 1000;
const FLUSH_MS = 5000;
const MAX_BATCH = 20;
// A queue is a buffer, not a database. If flushing has been failing for this
// long the oldest events are stale anyway, and an unbounded localStorage write
// is its own bug.
const MAX_QUEUE = 200;

// Only these reach our store. The rest of the catalog is for PostHog, GA4 and
// Pixel; copying all of it here would fill a 500 MB cap with events no
// Intelligence page reads.
const TRACKED = new Set([
  'host_profile_viewed',
  'service_viewed',
  'booking_started',
  'booking_slot_picked',
  'checkout_started',
  'booking_created',
  'booking_paid',
  'payment_failed',
  'profile_link_clicked',
  'service_shared',
]);

/* ── Storage helpers. Private mode and blocked storage must not throw. ─────── */
const read = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { window.localStorage.setItem(k, v); } catch { /* ignore */ } };

const uuid = () => (
  window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    // Not cryptographically interesting — it is a bucket label, not a secret.
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
);

function visitorId() {
  const raw = read(VISITOR_KEY);
  if (raw) {
    const [id, ts] = raw.split('|');
    if (id && Number(ts) && Date.now() - Number(ts) < VISITOR_TTL_MS) return id;
  }
  const id = uuid();
  write(VISITOR_KEY, `${id}|${Date.now()}`);
  return id;
}

// Rolling 30-minute inactivity window: each event extends it.
function sessionId() {
  const raw = read(SESSION_KEY);
  const now = Date.now();
  if (raw) {
    const [id, ts] = raw.split('|');
    if (id && Number(ts) && now - Number(ts) < SESSION_IDLE_MS) {
      write(SESSION_KEY, `${id}|${now}`);
      return id;
    }
  }
  const id = uuid();
  write(SESSION_KEY, `${id}|${now}`);
  return id;
}

/* ── Envelope ─────────────────────────────────────────────────────────────── */
const deviceType = () => {
  const w = window.innerWidth || 0;
  if (w && w < 768) return 'mobile';
  if (w && w < 1024) return 'tablet';
  return 'desktop';
};

// Host only, never the full URL — a referrer path carries PII.
const referrerHost = () => {
  try { return document.referrer ? new URL(document.referrer).hostname.slice(0, 253) : null; }
  catch { return null; }
};

// The matched route PATTERN, not the live path: '/:username/:serviceSlug' rather
// than '/ananyarao/nutrition-deep-dive'. Smaller, and not a PII risk.
function routePattern(path = window.location.pathname) {
  const seg = path.split('/').filter(Boolean);
  if (seg.length === 0) return '/';
  if (seg.length === 1) return '/:username';
  if (seg.length === 2) return '/:username/:serviceSlug';
  return `/${seg[0]}/*`;
}

// UTM wins when present; otherwise the referrer is the source and nothing is
// invented. An unknown source stays unknown — see the `unknown` bucket in §12.2.
function campaignFields() {
  try {
    const q = new URLSearchParams(window.location.search);
    return {
      source: q.get('utm_source') || referrerHost() || null,
      medium: q.get('utm_medium') || (referrerHost() ? 'referral' : null),
      campaign: q.get('utm_campaign') || null,
    };
  } catch {
    return { source: null, medium: null, campaign: null };
  }
}

/* ── Queue ────────────────────────────────────────────────────────────────── */
const loadQueue = () => { try { return JSON.parse(read(QUEUE_KEY) || '[]'); } catch { return []; } };
const saveQueue = (q) => write(QUEUE_KEY, JSON.stringify(q.slice(-MAX_QUEUE)));

let timer = null;
// The host currently signed in, so a host viewing their own page is not counted
// as a visitor. The server drops it too — both sides, because this is the kind
// of thing every analytics product gets wrong once.
let selfHostId = null;

function flush({ beacon = false } = {}) {
  // Any flush satisfies a pending scheduled one. Without this, a batch that
  // fills to MAX_BATCH flushes immediately but leaves `timer` set, so
  // schedule()'s `if (timer) return` guard blocks every later flush until the
  // stale timeout happens to fire — a queue that stops draining on exactly the
  // busiest pages.
  if (timer) { clearTimeout(timer); timer = null; }

  const queue = loadQueue();
  if (queue.length === 0) return;

  const batch = queue.slice(0, MAX_BATCH);
  const rest = queue.slice(MAX_BATCH);
  const body = JSON.stringify({ events: batch });

  // On pagehide only sendBeacon survives the navigation; fetch is cancelled.
  if (beacon && navigator.sendBeacon) {
    const ok = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    saveQueue(ok ? rest : queue); // keep it for the next page view if the beacon was refused
    return;
  }

  // Optimistically drop the batch: the server dedupes on ingest_id, so a retry
  // that actually did land costs nothing. Losing an event is cheaper than
  // double-counting one on a page a host is paying to read.
  saveQueue(rest);
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
    credentials: 'omit',
  }).catch(() => {
    const q = loadQueue();
    saveQueue([...batch, ...q]);
  });
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => { timer = null; flush(); }, FLUSH_MS);
}

export default {
  name: 'firstParty',
  needsConsent: false,

  init() {
    if (typeof window === 'undefined') return;
    // Anything left from a previous page view goes first.
    flush();
    window.addEventListener('pagehide', () => flush({ beacon: true }));
    // Safari historically did not fire pagehide reliably on tab close.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush({ beacon: true });
    });
  },

  identify(id) {
    selfHostId = id || null;
  },

  reset() {
    selfHostId = null;
  },

  track(event, props = {}) {
    if (!TRACKED.has(event)) return;

    const hostId = props.host_id || null;
    if (!hostId) return;                 // not attributable — drop, never guess
    if (hostId === selfHostId) return;   // the host reading their own page

    const { source, medium, campaign } = campaignFields();
    const queue = loadQueue();
    queue.push({
      event,
      host_id: hostId,
      service_id: props.service_id || null,
      visitor_id: visitorId(),
      session_id: sessionId(),
      occurred_at: new Date().toISOString(),
      source,
      medium,
      campaign,
      referrer_host: referrerHost(),
      device_type: deviceType(),
      route: routePattern(),
      link_type: props.link_type || null,
      channel: props.channel || null,
      ingest_id: uuid(),               // the server's dedupe key
    });
    saveQueue(queue);

    if (queue.length >= MAX_BATCH) flush();
    else schedule();
  },

  // Test seam — the module keeps real state in localStorage on purpose.
  __test: { routePattern, flush, TRACKED, MAX_BATCH },
};
