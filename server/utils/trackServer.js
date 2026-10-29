// Server-side conversion fan-out: PostHog + GA4 Measurement Protocol + Meta CAPI.
//
// WHY server-side: browser pixels degrade (ad-blockers, Safari ITP, third-party
// cookie death). Money events (booking_paid, product_purchased, subscription_started,
// user_registered) MUST be reported server-side so conversion counts survive past
// 1 year of platform changes. The browser-side pixel still fires for retargeting;
// Meta/GA4 de-dupe browser vs server on a shared event_id.
//
// This wraps the existing PostHog capture() so PostHog behaviour is unchanged —
// call sites move from capture() to trackServer() and additionally feed GA4 + Meta
// when configured. Every network path is fire-and-forget and never throws: analytics
// must never break a payment.
//
// Disabled per-tool when its env keys are unset → safe in dev/test/local.
const crypto = require('crypto');
const { capture: phCapture } = require('./posthog');
const { getClientIp } = require('../lib/clientIp');

const GA4_ID     = process.env.GA4_MEASUREMENT_ID;     // G-XXXXXXXXXX
const GA4_SECRET = process.env.GA4_API_SECRET;          // GA4 → Data Streams → MP API secret
const FB_PIXEL   = process.env.FB_PIXEL_ID;             // numeric pixel id
const FB_TOKEN   = process.env.FB_CAPI_ACCESS_TOKEN;    // Events Manager → Conversions API token
const FB_TEST    = process.env.FB_TEST_EVENT_CODE;      // optional: route to Test Events tab
const FB_API_VER = process.env.FB_API_VERSION || 'v19.0';

const isTest = process.env.NODE_ENV === 'test';
const canFetch = typeof fetch === 'function'; // Node 18+ global fetch

// Internal event name → { ga4: GA4 event name, meta: Meta standard event }.
// Only events listed here fan out to ad networks; everything else is PostHog-only.
const CONVERSIONS = {
  booking_paid:          { ga4: 'purchase',       meta: 'Purchase' },
  product_purchased:     { ga4: 'purchase',       meta: 'Purchase' },
  subscription_purchased:{ ga4: 'purchase',       meta: 'Subscribe' },
  subscription_renewed:  { ga4: 'purchase',       meta: 'Subscribe' },
  booking_created:       { ga4: 'begin_checkout', meta: 'InitiateCheckout' },
  user_registered:       { ga4: 'sign_up',        meta: 'CompleteRegistration' },
  lead_captured:         { ga4: 'generate_lead',  meta: 'Lead' },
  // Activation milestone (host received their first paid booking). CUSTOM names,
  // NOT 'purchase'/'Purchase' — the guest's payment already fired booking_paid, so
  // reusing Purchase here would double-count revenue. Sent so Meta/GA4 can build an
  // "activated hosts" audience to exclude from acquisition ads and optimize toward.
  host_first_booking:    { ga4: 'host_first_booking', meta: 'HostFirstBooking' },
};

const sha256 = (v) =>
  v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined;

// Meta phone format before hashing: digits only, country code, no '+'/spaces.
// BAS stores Indian numbers in a few shapes → keep digits, prefix 91 when the
// country code is absent, so em/ph both hash to what Meta expects (raises match).
// ponytail: India-default; widen the prefix rule if international numbers appear.
function normPhone(p) {
  if (!p) return undefined;
  let d = String(p).replace(/\D/g, '');
  if (!d) return undefined;
  if (d.length === 10) d = '91' + d;                         // bare 10-digit mobile
  else if (d.length === 11 && d.startsWith('0')) d = '91' + d.slice(1); // 0-prefixed
  return d;
}

// GA4 Measurement Protocol requires a client_id. The browser's _ga client_id is
// ideal (joins the web session) — pass it via conversion.gaClientId. When absent
// (pure server context like a webhook), we synthesize a stable id from distinctId
// so the same person maps consistently, accepting it won't stitch to their web hits.
function ga4ClientId(distinctId, gaClientId) {
  if (gaClientId) return gaClientId;
  const h = crypto.createHash('md5').update(String(distinctId || 'anon')).digest('hex');
  return `${parseInt(h.slice(0, 8), 16)}.${parseInt(h.slice(8, 16), 16)}`;
}

function sendGA4(distinctId, map, { value, currency = 'INR', gaClientId, eventId }) {
  if (!GA4_ID || !GA4_SECRET || !canFetch) return;
  const body = {
    client_id: ga4ClientId(distinctId, gaClientId),
    user_id: distinctId ? String(distinctId) : undefined,
    events: [{
      name: map.ga4,
      params: {
        currency,
        value: Number(value) || 0,
        transaction_id: eventId,
        engagement_time_msec: 1,
      },
    }],
  };
  fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${GA4_ID}&api_secret=${GA4_SECRET}`,
    { method: 'POST', body: JSON.stringify(body) })
    .catch((e) => console.error('ga4 MP error (non-fatal):', e.message));
}

// Meta Event Match Quality (EMQ) fields pulled from the live browser request.
// More match keys = higher match rate = better attribution/optimization. fbp/fbc
// come from the browser pixel's _fbp/_fbc cookies (sent automatically on same-
// domain requests, so no client change needed); fbc falls back to a value built
// from the fbclid query/body param. IP + user-agent are the visitor's. Pass ONLY
// a genuine browser req here — a webhook's req carries the payment provider's
// IP/UA, which would poison match quality. Returns {} when req is absent.
function readCookie(req, name) {
  const raw = req && req.headers && req.headers.cookie;
  if (!raw) return undefined;
  const m = raw.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : undefined;
}
function metaMatchFromReq(req) {
  if (!req) return {};
  let fbc = readCookie(req, '_fbc');
  const fbclid = (req.query && req.query.fbclid) || (req.body && req.body.fbclid);
  if (!fbc && fbclid) fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${fbclid}`;
  return {
    ip: getClientIp(req) || req.ip,
    userAgent: req.headers && req.headers['user-agent'],
    fbp: readCookie(req, '_fbp'),
    fbc,
  };
}

function sendMetaCapi(map, { value, currency = 'INR', email, phone, eventId,
                             ip, userAgent, fbp, fbc, externalId }) {
  if (!FB_PIXEL || !FB_TOKEN || !canFetch) return;
  const user_data = {};
  if (email) user_data.em = [sha256(email)];
  if (phone) user_data.ph = [sha256(normPhone(phone))];
  if (externalId) user_data.external_id = [sha256(externalId)]; // Meta hashes external_id too
  if (ip) user_data.client_ip_address = ip;          // sent raw (not hashed)
  if (userAgent) user_data.client_user_agent = userAgent;
  if (fbp) user_data.fbp = fbp;                        // Meta cookie ids: raw, never hashed
  if (fbc) user_data.fbc = fbc;
  const payload = {
    data: [{
      event_name: map.meta,
      event_time: Math.floor(Date.now() / 1000),
      action_source: 'website',
      event_id: eventId, // de-dupe vs browser pixel
      user_data,
      custom_data: { value: Number(value) || 0, currency },
    }],
    ...(FB_TEST ? { test_event_code: FB_TEST } : {}),
  };
  fetch(`https://graph.facebook.com/${FB_API_VER}/${FB_PIXEL}/events?access_token=${FB_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .catch((e) => console.error('meta CAPI error (non-fatal):', e.message));
}

// trackServer(distinctId, event, properties, conversion?)
//   - distinctId/event/properties: identical contract to posthog capture()
//   - conversion (optional): { value, currency, email, phone, gaClientId, eventId }
//     supplied for money/acquisition events so GA4 MP + Meta CAPI get amount + match keys.
//     eventId should be stable+unique per conversion (e.g. razorpay_payment_id) so the
//     browser pixel and this server hit de-dupe into one conversion.
function trackServer(distinctId, event, properties = {}, conversion = {}) {
  phCapture(distinctId, event, properties); // PostHog — unchanged behaviour
  if (isTest) return;
  const map = CONVERSIONS[event];
  if (!map) return;
  // Enrich with Meta match keys: IP/UA/fbp/fbc from the browser req (conversion.req,
  // present only on genuine browser call sites) + external_id from the distinctId we
  // already have. GA4/Meta senders destructure named fields, so `req` is never
  // serialized into an outbound body.
  const enriched = {
    ...conversion,
    ...metaMatchFromReq(conversion.req),
    externalId: distinctId ? String(distinctId) : undefined,
  };
  try { sendGA4(distinctId, map, enriched); } catch (e) { console.error('ga4 fanout error:', e.message); }
  try { sendMetaCapi(map, enriched); } catch (e) { console.error('meta fanout error:', e.message); }
}

// ── CRM Lead offline events (Meta "CRM implementation guide") ────────────────
// Distinct from the website money events above: when a lead enters or advances
// in the sales CRM, we report it to Meta with action_source 'system_generated'
// and custom_data.event_source 'crm', matched on hashed em/ph (+ the raw Meta
// lead_id when a Facebook Lead Ad sourced the lead — RAW integer, never hashed).
// This lets Meta attribute CRM pipeline outcomes back to the ad that generated
// the lead and optimize toward leads that actually convert.
// Shape mirrors Meta's documented CRM Lead payload exactly.
function buildCrmLeadPayload({ email, phone, leadId, eventName = 'Lead', eventId, ts, req } = {}) {
  const user_data = {};
  const em = sha256(email);
  const ph = phone ? sha256(normPhone(phone)) : undefined;
  if (em) user_data.em = [em];
  if (ph) user_data.ph = [ph];
  // EMQ keys when a browser request is available (website form): IP/UA/fbp/fbc.
  // Raw, never hashed. Absent on webhook/import paths — em/ph/lead_id still match.
  const match = metaMatchFromReq(req);
  if (match.ip) user_data.client_ip_address = match.ip;
  if (match.userAgent) user_data.client_user_agent = match.userAgent;
  if (match.fbp) user_data.fbp = match.fbp;
  if (match.fbc) user_data.fbc = match.fbc;
  const lid = leadId == null ? '' : String(leadId).trim();
  if (lid) {
    // Raw, never hashed. Send as a Number when it fits a JS safe integer; a longer
    // leadgen id would lose precision as Number, so keep it as the exact string.
    const n = Number(lid);
    user_data.lead_id = /^\d+$/.test(lid) && Number.isSafeInteger(n) ? n : lid;
  }
  const event = {
    event_name: eventName,
    event_time: ts || Math.floor(Date.now() / 1000),
    action_source: 'system_generated',
    custom_data: { event_source: 'crm', lead_event_source: 'Book A Sloth' },
    user_data,
  };
  if (eventId) event.event_id = eventId; // de-dupe re-sends of the same lead stage
  return { data: [event], ...(FB_TEST ? { test_event_code: FB_TEST } : {}) };
}

// Fire-and-forget CRM Lead → Meta CAPI. OFF until FB creds set; never throws.
// Skips the network hit entirely when there's nothing to match on.
function sendMetaCrmLead(opts = {}) {
  if (isTest || !FB_PIXEL || !FB_TOKEN || !canFetch) return;
  const payload = buildCrmLeadPayload(opts);
  const ud = payload.data[0].user_data;
  if (!ud.em && !ud.ph && ud.lead_id == null) return; // no identifiers → un-matchable
  fetch(`https://graph.facebook.com/${FB_API_VER}/${FB_PIXEL}/events?access_token=${FB_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    .catch((e) => console.error('meta CRM lead error (non-fatal):', e.message));
}

module.exports = {
  trackServer, CONVERSIONS, sendMetaCrmLead,
  _internal: { sha256, normPhone, ga4ClientId, metaMatchFromReq, buildCrmLeadPayload },
};
