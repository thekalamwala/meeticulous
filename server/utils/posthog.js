// Server-side PostHog — product analytics for booking/payment events.
//
// distinct_id MUST match the frontend (client/src/context/AuthContext.jsx calls
// posthog.identify(user.id)), so server events for a logged-in user join that
// same person. Anonymous OTP guests have no account id → we key on their email,
// which creates a standalone person (it will not stitch to their browser's
// anonymous session, an accepted limitation).
//
// Disabled (no-op) when POSTHOG_PROJECT_TOKEN is unset, so local/dev and test
// runs without the key never error or send data.
const { PostHog } = require('posthog-node');

const KEY  = process.env.POSTHOG_PROJECT_TOKEN;
const HOST = process.env.POSTHOG_HOST || 'https://us.i.posthog.com';

let client = null;
// Never send during automated tests, even if a token leaks into the env.
if (KEY && process.env.NODE_ENV !== 'test') {
  // flushAt/flushInterval: batch events; the SIGTERM/SIGINT handler in server.js
  // calls shutdown() to flush the tail before the process exits (Render sends
  // SIGTERM on deploy/restart).
  client = new PostHog(KEY, { host: HOST, flushAt: 20, flushInterval: 10000 });
  // SDK never throws for background queue/network failures — surface them here
  // so a misconfigured key or network issue is visible in logs (docs recommend).
  client.on('error', (err) => console.error('posthog background error (non-fatal):', err?.message || err));
}

// Resolve a stable distinct_id from a booking/guest shape. Logged-in user id
// first (joins frontend identity), else the booking email, else null (skip).
const resolveGuestId = ({ guestId, guestEmail } = {}) =>
  guestId || (guestEmail ? String(guestEmail).toLowerCase().trim() : null);

// Fire-and-forget capture. Never throws — analytics must not break a money path.
function capture(distinctId, event, properties = {}) {
  if (!client || !distinctId || !event) return;
  try {
    client.capture({ distinctId: String(distinctId), event, properties });
  } catch (e) {
    console.error('posthog capture error (non-fatal):', e.message);
  }
}

// Flush + close on process exit so buffered events aren't lost.
async function shutdown() {
  if (!client) return;
  try { await client.shutdown(); } catch (_) { /* best-effort */ }
}

module.exports = { client, capture, resolveGuestId, shutdown };
