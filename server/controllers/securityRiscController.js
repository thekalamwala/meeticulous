/**
 * securityRiscController.js — Google Cross-Account Protection (RISC) receiver.
 *
 * MOUNTED IN PROD (#512): server.js mounts this receiver at /api/security. The
 *    SET (a Google-signed JWT) is the auth — there is no protect/requireHost.
 *    Complete the manual Google Cloud steps below and set RISC_AUDIENCE in prod
 *    so the receiver enforces the token audience (see verifySet / the startup
 *    warning by the RISC_AUDIENCE constant).
 *
 * WHAT THIS IS
 *   Google RISC (Risk & Incident Sharing and Coordination) lets Google push us a
 *   Security Event Token (SET — a signed JWT) when one of OUR hosts' Google
 *   accounts is compromised/disabled. Since hosts authenticate ONLY via Google
 *   (see docs/feature-map.md §8, §15), a compromised Google account = compromised
 *   host account. On such an event we revoke the host's stored Google refresh
 *   token so their calendar/OAuth access is cut immediately.
 *
 * SECURITY (do NOT shortcut this path):
 *   - The SET is verified against Google's RISC signing keys (RS256), fetched
 *     from the JWKS advertised by the RISC discovery document. Unsigned /
 *     wrong-key / expired / wrong-issuer / wrong-audience tokens are rejected.
 *   - Verification uses Node stdlib crypto (JWK→KeyObject) + the already-present
 *     `jsonwebtoken` — no new dependency, no JWK-to-PEM juggling.
 *   - Endpoint takes no Express auth middleware: the signed SET *is* the auth.
 *
 * ── MANUAL GOOGLE CLOUD STEPS (do these before mounting the route) ────────────
 *   1. Enable the "RISC API" on the Meeticulous Google Cloud project.
 *   2. Create a dedicated service account with role
 *      roles/riscconfigs.editor (RISC Configuration Admin).
 *   3. Set RISC_AUDIENCE below to the receiver audience Google assigns
 *      (the service-account issuer / configured audience for the stream).
 *   4. Register this endpoint as the stream delivery URL:
 *        POST https://meeticulous-api.onrender.com/api/security/risc
 *      via the RISC stream config API, using the service account above.
 *   5. Send a verification/test event from Google and confirm 200.
 *   No secrets are stored in code — audience comes from env (RISC_AUDIENCE).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');
const profileSecrets = require('../utils/profileSecrets');

const RISC_DISCOVERY_URL = 'https://accounts.google.com/.well-known/risc_configuration';
const RISC_ISSUER = 'https://accounts.google.com';
// Audience Google is told to stamp on SETs for our stream. Env-driven; the RISC
// receiver rejects any token not addressed to us. Set in server/.env once the
// stream is registered (manual step 3 above).
const RISC_AUDIENCE = process.env.RISC_AUDIENCE || null;
// SECURITY: with no audience configured, verifySet skips the audience check, so a
// valid Google-signed SET minted for a DIFFERENT receiver could be replayed to
// force-logout a host whose google_id/email matches. Warn loudly in prod.
if (process.env.NODE_ENV === 'production' && !RISC_AUDIENCE) {
  console.warn('[security] RISC_AUDIENCE not set — the RISC receiver does NOT enforce the SET audience. Set RISC_AUDIENCE in production to close a SET-replay vector.');
}

// RISC event types we act on (SET `events` claim keys are full URIs).
const ACTIONABLE_EVENTS = new Set([
  'https://schemas.openid.net/secevent/risc/event-type/sessions-revoked',
  'https://schemas.openid.net/secevent/risc/event-type/tokens-revoked',
  'https://schemas.openid.net/secevent/risc/event-type/account-disabled',
  'https://schemas.openid.net/secevent/risc/event-type/account-purged',
]);

// ── JWKS fetch + cache ────────────────────────────────────────────────────────
// Small in-memory cache of Google's RISC signing keys, keyed by `kid`. Google
// rotates keys; a 1h TTL keeps us fresh without refetching per request.
// ponytail: process-local cache, fine for a single receiver; revisit only if we
//           ever run many instances AND key rotation causes verify misses.
let _jwksCache = { keys: null, fetchedAt: 0 };
const JWKS_TTL_MS = 60 * 60 * 1000;

const fetchRiscJwks = async () => {
  const now = Date.now();
  if (_jwksCache.keys && now - _jwksCache.fetchedAt < JWKS_TTL_MS) return _jwksCache.keys;
  const discovery = await (await fetch(RISC_DISCOVERY_URL)).json();
  const jwksUri = discovery?.jwks_uri;
  if (!jwksUri) throw new Error('RISC discovery: no jwks_uri');
  const jwks = await (await fetch(jwksUri)).json();
  if (!Array.isArray(jwks?.keys)) throw new Error('RISC JWKS: no keys');
  _jwksCache = { keys: jwks.keys, fetchedAt: now };
  return jwks.keys;
};

// Verify a SET and return its decoded payload, or throw. RS256 + issuer +
// audience are all enforced. The signing key is selected by the token's `kid`.
const verifySet = async (token) => {
  const header = jwt.decode(token, { complete: true })?.header;
  if (!header?.kid) throw new Error('SET missing kid');
  const keys = await fetchRiscJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('SET kid not in JWKS');
  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  return jwt.verify(token, publicKey, {
    algorithms: ['RS256'],
    issuer: RISC_ISSUER,
    ...(RISC_AUDIENCE ? { audience: RISC_AUDIENCE } : {}),
  });
};

// Map a SET subject to one of our host profiles. Google identifies the account
// via the `iss_sub` subject type → `sub` is the Google account id, which we
// persist as profiles.google_id (see attachGoogleToProfile). Email is used as a
// fallback identifier when present.
//
// ⚠️ DECISION FLAG: confirm profiles.google_id is populated for ALL hosts before
//    relying on it (older hosts connected pre-v2.5 may lack it — see the schema
//    fallback in attachGoogleToProfile). If not, email is the only join key.
const findHostForSubject = async (subject) => {
  if (!subject) return null;
  const sub = subject.sub || null;
  const email = (subject.email || '').toLowerCase().trim() || null;
  let q = supabaseAdmin.from('profiles').select('id, email, is_host');
  if (sub) q = q.eq('google_id', sub);
  else if (email) q = q.eq('email', email);
  else return null;
  const { data } = await q.maybeSingle();
  if (data) return data;
  // Fallback to email if the google_id lookup missed.
  if (sub && email) {
    const { data: byEmail } = await supabaseAdmin
      .from('profiles').select('id, email, is_host').eq('email', email).maybeSingle();
    return byEmail || null;
  }
  return null;
};

// Act on one actionable event for one host: revoke stored Google tokens + mark
// the calendar disconnected. Reuses profileSecrets.setGoogleTokens (the same
// path used to persist tokens) so there is no duplicated revocation logic.
const revokeHostGoogleAccess = async (profileId) => {
  // Null out the encrypted OAuth tokens in profile_private (server-only table).
  await profileSecrets.setGoogleTokens(profileId, {
    google_access_token: null,
    google_refresh_token: null,
  });
  // Global logout of the app's OWN Supabase session. supabase-js (v2) admin API
  // has no "sign out all sessions for a user id" (admin.signOut needs the user's
  // token, which a server→server RISC push lacks), so we stamp a watermark:
  // authMiddleware.protect rejects any access token issued before this instant.
  // Schema-fallback: if v3.79 (sessions_valid_after) isn't applied yet, the
  // google_calendar_connected update still lands and we don't fatal on the stamp.
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ google_calendar_connected: false, sessions_valid_after: now, updated_at: now })
    .eq('id', profileId);
  if (error && /Could not find the|column.*does not exist/i.test(error.message)) {
    // Pre-v3.79 DB — no watermark column. Still cut Google access; the app
    // session then lapses on its next (short-TTL) refresh.
    await supabaseAdmin
      .from('profiles')
      .update({ google_calendar_connected: false, updated_at: now })
      .eq('id', profileId);
  } else if (error) {
    throw error;
  }
};

// Pure helper (unit-tested): which actionable event URIs are present in a SET.
const actionableEventTypes = (events) =>
  Object.keys(events || {}).filter((e) => ACTIONABLE_EVENTS.has(e));

// POST /api/security/risc — body is the raw SET (application/secevent+jwt), a
// signed JWT string. Always respond 200/202 quickly on a well-formed accepted
// token (Google retries on non-2xx); reject bad signatures with 401.
const receiveRiscEvent = async (req, res) => {
  try {
    // The SET arrives as a bare JWT in the request body (content-type
    // application/secevent+jwt). express.text() must be mounted for this route.
    const token = typeof req.body === 'string' ? req.body.trim() : (req.body?.token || '');
    if (!token) return res.status(400).json({ message: 'No security event token' });

    let payload;
    try {
      payload = await verifySet(token);
    } catch (err) {
      // Signature/issuer/audience/expiry failure — do NOT act.
      return res.status(401).json({ message: 'Invalid security event token' });
    }

    const types = actionableEventTypes(payload.events);
    if (types.length === 0) {
      // Verified but nothing we act on (e.g. verification ping) — acknowledge.
      return res.status(202).json({ received: true, acted: false });
    }

    // Google puts the affected account in the event subject. RISC subjects can
    // live at the top-level `sub`/`subject` or per-event; normalise both.
    const eventSubject =
      payload.subject ||
      (types.map((t) => payload.events[t]?.subject).find(Boolean)) ||
      (payload.sub ? { sub: payload.sub } : null);

    const host = await findHostForSubject(eventSubject);
    if (!host) {
      // Unknown subject — acknowledge so Google stops retrying; log for review.
      console.warn('[risc] event for unknown subject', JSON.stringify(eventSubject));
      return res.status(202).json({ received: true, acted: false });
    }

    await revokeHostGoogleAccess(host.id);
    console.warn(`[risc] revoked Google access for host ${host.id} (events: ${types.join(', ')})`);
    return res.status(202).json({ received: true, acted: true });
  } catch (err) {
    console.error('[risc] receiver error:', err.message);
    return res.status(500).json({ message: 'RISC receiver error' });
  }
};

module.exports = {
  receiveRiscEvent,
  // exported for unit tests
  actionableEventTypes,
  ACTIONABLE_EVENTS,
};
