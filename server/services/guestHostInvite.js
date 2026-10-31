'use strict';

/**
 * guestHostInvite.js — invite repeat guests to become hosts (Sujata).
 *
 * A guest with several completed bookings already trusts the transaction from the
 * buyer side — the warmest host prospect on the platform, and conversion is a
 * one-click is_host flip (no new signup). Nothing pitched them before.
 *
 * Trigger: a guest (with an account) crosses >= INVITE_MIN_BOOKINGS completed
 * bookings and isn't already a host. Scans recently-completed bookings to find
 * who just crossed, counts their lifetime completions, and emails once
 * (dedup on email_logs). No migration. Never throws.
 */

const { supabaseAdmin } = require('../config/supabase');
const NotificationEngine = require('./notificationEngine');

const EVENT = 'GUEST_TO_HOST_INVITE';
const MIN_BOOKINGS = Number(process.env.GUEST_HOST_INVITE_MIN) || 2;
const LOOKBACK_DAYS = Number(process.env.GUEST_HOST_INVITE_LOOKBACK_DAYS) || 3;
const DAY_MS = 86400000;

async function alreadyInvited(email) {
  const { data } = await supabaseAdmin
    .from('email_logs').select('id').eq('event_key', EVENT).eq('recipient', email).limit(1).maybeSingle();
  return !!data;
}

async function processGuestHostInvites() {
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * DAY_MS).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('bookings')
      .select('guest_id, guest_email, guest_name')
      .eq('status', 'completed').gt('updated_at', since)
      .not('guest_id', 'is', null)
      .limit(500);
    if (error) { console.error('guest→host scan:', error.message); return { sent: 0 }; }

    // Unique guests from this window.
    const seen = new Map();
    for (const r of rows || []) if (r.guest_id && !seen.has(r.guest_id)) seen.set(r.guest_id, r);

    let sent = 0;
    for (const [guestId, r] of seen) {
      // Must have an account that isn't already a host.
      const { data: prof } = await supabaseAdmin
        .from('profiles').select('is_host, name, email').eq('id', guestId).maybeSingle();
      if (!prof || prof.is_host) continue;
      const email = prof.email || r.guest_email;
      if (!email) continue;

      // Lifetime completed bookings for this guest.
      const { count } = await supabaseAdmin
        .from('bookings').select('id', { count: 'exact', head: true })
        .eq('guest_id', guestId).eq('status', 'completed');
      if ((count || 0) < MIN_BOOKINGS) continue;
      if (await alreadyInvited(email)) continue;

      const base = process.env.CLIENT_URL || 'https://meeticulous.com';
      const name = prof.name || r.guest_name || '';
      await NotificationEngine.send({
        event: EVENT,
        data: {
          email, name,
          emailUser: { name, email },
          emailData: {
            first_name: name.split(' ')[0] || 'there',
            completed_count: count,
            become_host_url: `${base}/become-a-host`,
          },
          recipientUserId: guestId,
        },
      });
      sent++;
    }
    if (sent) console.log(`Guest→host invites: sent ${sent}`);
    return { sent };
  } catch (err) {
    console.error('guest→host invite (non-fatal):', err.message);
    return { sent: 0 };
  }
}

module.exports = { processGuestHostInvites, EVENT, MIN_BOOKINGS };
