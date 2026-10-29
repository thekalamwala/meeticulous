'use strict';

const crypto = require('crypto');

// Per-user realtime topic for the in-app notification bell.
//
// The topic is an HMAC of the user id, NOT the raw id — so knowing a victim's
// user id is not enough to subscribe to their channel and observe their
// notification pings (the previous `notif:user:<id>` was guessable). The client
// can't derive this itself; it fetches its own topic from an authed endpoint
// (GET /api/notifications/channel), and the server broadcasts to the same value.
//
// Pings carry no content (just {role,type}); the client refetches the feed
// through the authenticated REST endpoint, which is the real access boundary.
// This just removes the guessable-id metadata side-channel.
const SECRET =
  process.env.NOTIF_CHANNEL_SECRET ||
  process.env.SUPABASE_JWT_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'bas-notif-fallback-secret';

function notifChannelTopic(userId) {
  const h = crypto.createHmac('sha256', SECRET).update(String(userId)).digest('hex').slice(0, 32);
  return `notif:${h}`;
}

module.exports = { notifChannelTopic };
