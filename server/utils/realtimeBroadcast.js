'use strict';

// Fire-and-forget Supabase Realtime BROADCAST. Never throws.
//
// Same mechanism the support chat uses (supportChatService.broadcastTopic): a
// service-role POST to the realtime broadcast endpoint. Broadcast is DISPLAY-ONLY
// — the DB row is the source of truth and clients reconcile via a REST refetch —
// so no RLS / Supabase-auth session is involved.
async function broadcastTopic(topic, event, payload = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !topic) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ messages: [{ topic, event, payload }] }),
    });
  } catch (e) {
    console.error('broadcastTopic failed', topic, e.message);
  }
}

module.exports = { broadcastTopic };
