'use strict';

/**
 * proTasteNudges.js — lifecycle messages for the 60-day Pro taste
 * (docs/host-lifecycle-nurture.md stages 4–7).
 *
 * A free host's taste runs 60 days from their first confirmed booking
 * (services/proTaste.js). This job tells them where they are:
 *
 *   STARTED  day 0–44   email + bell  "WhatsApp reminders are on for 60 days"
 *   DAY45    day 45–54  bell          "15 days left"
 *   ENDING   day 55–59  email + WhatsApp + bell, with their real reminder count
 *                       and the founding spots left
 *   ENDED    day 60–74  email + bell  "WhatsApp reminders are now off"
 *
 * Only the CURRENT stage is sent (a host who first books after deploy never gets
 * a stale "started" after "ending"). Each stage sends once per host, deduped on
 * in_app_notifications (user_id, dedupe_key) — the bell row is written first and
 * IS the record. WhatsApp only fires when the PRO_TASTE_ENDING notification_events
 * row has an approved campaign + whatsapp_enabled (seeded OFF). Never throws.
 */

const { supabaseAdmin } = require('../config/supabase');
const NotificationEngine = require('./notificationEngine');
const planService = require('./planService');
const proTaste = require('./proTaste');
const { getFoundingStatus } = require('./foundingSpots');

const DAY_MS = 86400000;
const BASE = () => process.env.CLIENT_URL || 'https://meeticulous.com';

// [stage, fromDay, toDay (exclusive), event (null = bell only)]
const STAGES = [
  ['started', 0, 45, 'PRO_TASTE_STARTED'],
  ['day45', 45, 55, null],
  ['ending', 55, 60, 'PRO_TASTE_ENDING'],
  ['ended', 60, 75, 'PRO_TASTE_ENDED'],
];

/** Pure: which stage a host is in, given days since their first booking. */
function stageFor(daysSinceFirst) {
  return STAGES.find(([, from, to]) => daysSinceFirst >= from && daysSinceFirst < to) || null;
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

function bellFor(stage, { daysLeft, endsOn, spotsLeft }) {
  const upgrade = '/dashboard/upgrade?src=taste';
  switch (stage) {
    case 'started': return { title: 'WhatsApp reminders are on for 60 days', body: `Your guests get WhatsApp reminders and you both get reschedule alerts until ${endsOn}. That's Pro, on us.`, link: '/dashboard/bookings' };
    case 'day45':   return { title: `${daysLeft} days of WhatsApp reminders left`, body: `On ${endsOn} reminders switch to email. Pro keeps them on.`, link: upgrade };
    case 'ending':  return { title: `${daysLeft} days left of WhatsApp reminders`, body: `Keep them with founding Pro — ₹999/yr, locked for life${spotsLeft != null ? ` (${spotsLeft} of 100 spots left)` : ''}.`, link: upgrade };
    case 'ended':   return { title: 'WhatsApp reminders are now off', body: 'Your guests get email reminders only. Turn WhatsApp back on with Pro.', link: upgrade };
    default: return null;
  }
}

async function alreadySent(userId, dedupeKey) {
  const { data } = await supabaseAdmin
    .from('in_app_notifications').select('id').eq('user_id', userId).eq('dedupe_key', dedupeKey).limit(1);
  return !!(data && data.length);
}

async function remindedCount(hostId, sinceIso) {
  const { count } = await supabaseAdmin
    .from('bookings').select('id', { count: 'exact', head: true })
    .eq('host_id', hostId).eq('reminder_24h_sent', true).gte('scheduled_at', sinceIso);
  return count || 0;
}

async function processProTasteNudges({ now = Date.now() } = {}) {
  const out = { sent: 0, skipped: 0 };
  try {
    // ponytail: scans every host row each run — fine to a few thousand hosts; past
    // that, select only hosts whose first booking falls in the 0–75 day band.
    const { data: hosts, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, phone, whatsapp_number, plan, plan_expires_at')
      .eq('is_host', true).limit(5000);
    if (error) { console.error('pro taste scan:', error.message); return out; }

    const founding = await getFoundingStatus();
    const spotsLeft = founding?.open ? founding.left : null;

    for (const host of hosts || []) {
      try {
        if (!planService.isFreeSlug(planService.resolveVendorPlan(host))) { out.skipped++; continue; }
        const firstAt = await proTaste.firstBookingAt(host.id);
        if (!firstAt) { out.skipped++; continue; }
        const stage = stageFor(Math.floor((now - new Date(firstAt).getTime()) / DAY_MS));
        if (!stage) { out.skipped++; continue; }
        const [key, , , event] = stage;
        const dedupeKey = `pro_taste:${key}`;
        if (await alreadySent(host.id, dedupeKey)) { out.skipped++; continue; }

        const endsOn = fmtDate(proTaste.tasteEndsAt(firstAt));
        const daysLeft = proTaste.daysLeft(firstAt, now);
        const bell = bellFor(key, { daysLeft, endsOn, spotsLeft });
        // Bell first — it is the dedupe record for the whole stage.
        const { error: bellErr } = await supabaseAdmin.from('in_app_notifications').insert({
          user_id: host.id, role: 'host', type: `PRO_TASTE_${key.toUpperCase()}`,
          title: bell.title, body: bell.body, link: bell.link, data: { stage: key }, dedupe_key: dedupeKey,
        });
        // Unique-index race (another instance won) or write failure → don't email twice.
        if (bellErr) { out.skipped++; continue; }

        if (event && host.email) {
          const firstName = (host.name || '').split(' ')[0] || 'there';
          const link = key === 'started' ? `${BASE()}/dashboard/bookings` : `${BASE()}/dashboard/upgrade?src=taste_${key}`;
          const reminded = key === 'ending' ? await remindedCount(host.id, firstAt) : 0;
          const spotsLine = spotsLeft != null ? `${spotsLeft} of 100 founding spots left.` : '';
          await NotificationEngine.send({
            event,
            data: {
              email: host.email, name: host.name, audience: 'vendor',
              // WhatsApp leg only on ENDING, and only once its template is approved + enabled.
              phone: key === 'ending' ? (host.whatsapp_number || host.phone || null) : null,
              templateParams: [firstName, String(reminded), endsOn, spotsLeft != null ? String(spotsLeft) : '', link],
              emailUser: { name: host.name, email: host.email },
              emailData: { first_name: firstName, taste_ends_on: endsOn, days_left: String(daysLeft), reminded_count: String(reminded), spots_line: spotsLine, link },
              recipientUserId: host.id,
            },
          });
        }
        out.sent++;
      } catch (err) {
        console.error(`pro taste nudge ${host.id} (non-fatal):`, err.message);
      }
    }
    if (out.sent) console.log(`Pro taste nudges: ${out.sent} sent, ${out.skipped} skipped`);
  } catch (err) {
    console.error('pro taste nudges (non-fatal):', err.message);
  }
  return out;
}

module.exports = { processProTasteNudges, stageFor, bellFor, STAGES };
