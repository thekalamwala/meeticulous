'use strict';

/**
 * upgradeNudge.js — email version of the commission → upgrade nudge (Sujata).
 *
 * The free plan takes 5% commission; Pro takes 0%. So the more a free host earns,
 * the more they pay — the upgrade sells itself once they've felt it. Dashboard
 * already shows an in-app card; this adds the email (higher reach) when a free
 * host's commission over the LAST 30 DAYS reaches Pro's monthly cost — the point
 * where Pro pays for itself ("this pays for itself", not "you've paid us a lot").
 *
 * Guarantees:
 *   • Free-plan hosts only (paid hosts already pay 0% — nothing to nudge).
 *   • At most one email per host per REPEAT_DAYS — deduped on email_logs (no migration).
 *   • Never throws — runs as a fire-and-forget side-effect of a paid booking.
 */

const { supabaseAdmin } = require('../config/supabase');
const NotificationEngine = require('./notificationEngine');
const { resolveVendorPlan, isFreeSlug } = require('./planService');

// 30-day commission at which Pro pays for itself: Pro yearly ₹1,179 incl. GST / 12.
const THRESHOLD_INR = Number(process.env.UPGRADE_NUDGE_THRESHOLD_INR) || 98;
const WINDOW_DAYS = 30;
const REPEAT_DAYS = 60;
const DAY_MS = 86400000;
const EVENT = 'UPGRADE_COMMISSION_NUDGE';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

/**
 * Send the upgrade email the first time a free host crosses the commission
 * threshold. Safe to call on every paid booking confirmation.
 * @param {object} a
 * @param {object} a.host     host profile row ({ id, email, name, plan? }).
 * @param {object} a.booking  the just-confirmed paid booking.
 */
async function maybeSendUpgradeNudge({ host, booking }) {
  try {
    if (!host?.id || !host?.email) return { sent: false, reason: 'no_host' };

    // Resolve plan (host row may not carry it) → free plans only.
    let plan = host.plan;
    if (plan == null) {
      const { data } = await supabaseAdmin.from('profiles').select('plan, plan_expires_at').eq('id', host.id).maybeSingle();
      plan = resolveVendorPlan(data || {});
    } else {
      plan = resolveVendorPlan({ plan });
    }
    if (!isFreeSlug(plan)) return { sent: false, reason: 'paid_plan' };

    // Commission this host has given up over the last 30 days.
    const since = new Date(Date.now() - WINDOW_DAYS * DAY_MS).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from('bookings')
      .select('commission_applied, vendor_amount')
      .eq('host_id', host.id)
      .eq('payment_status', 'paid')
      .gte('paid_at', since);
    if (error) return { sent: false, reason: 'query_error' };

    const list = rows || [];
    const commissionTotal = list.reduce((s, r) => s + Number(r.commission_applied || 0), 0);
    if (commissionTotal < THRESHOLD_INR) return { sent: false, reason: 'below_threshold' };

    // Dedup: emailed this host recently? (email_logs is the queue + the record.)
    const { data: prior } = await supabaseAdmin
      .from('email_logs')
      .select('id')
      .eq('event_key', EVENT)
      .eq('recipient', host.email)
      .in('status', ['sent', 'queued', 'sending'])
      .gte('created_at', new Date(Date.now() - REPEAT_DAYS * DAY_MS).toISOString())
      .limit(1)
      .maybeSingle();
    if (prior) return { sent: false, reason: 'already_sent' };

    const bookingsCount = list.length;
    const base = process.env.CLIENT_URL || 'https://meeticulous.com';

    await NotificationEngine.send({
      event: EVENT,
      data: {
        email: host.email,
        name: host.name,
        emailUser: { name: host.name, email: host.email },
        emailData: {
          first_name: (host.name || '').split(' ')[0] || 'there',
          commission_total: inr(commissionTotal),
          bookings_count: bookingsCount,
          upgrade_url: `${base}/dashboard/upgrade?src=commission_email`,
        },
        recipientUserId: host.id,
      },
    });
    return { sent: true };
  } catch (err) {
    console.error('upgrade nudge (non-fatal):', err.message);
    return { sent: false, reason: 'error' };
  }
}

// ── Founding spots running low (docs/host-lifecycle-nurture.md stage 12) ────────
const SPOTS_EVENT = 'FOUNDING_SPOTS_LOW';
const SPOTS_LOW_AT = 20;

/**
 * Daily: once founding spots are down to SPOTS_LOW_AT, email each EARNING free
 * host (any commission paid) once — the honest last call before the price rises.
 * One email per host ever, deduped on email_logs. Never throws.
 */
async function sendFoundingSpotsLow() {
  const out = { sent: 0 };
  try {
    const status = await require('./foundingSpots').getFoundingStatus({ fresh: true });
    if (!status?.open || status.left > SPOTS_LOW_AT) return out;

    // Earning free hosts = hosts with commission on a paid booking.
    // ponytail: scans every paid booking — fine for years at this volume; move to
    // a SQL group-by when paid bookings pass ~100k.
    const { data: paid } = await supabaseAdmin
      .from('bookings').select('host_id, commission_applied')
      .eq('payment_status', 'paid').gt('commission_applied', 0);
    const commissionBy = new Map();
    for (const b of paid || []) commissionBy.set(b.host_id, (commissionBy.get(b.host_id) || 0) + Number(b.commission_applied || 0));
    if (!commissionBy.size) return out;

    const { data: hosts } = await supabaseAdmin
      .from('profiles').select('id, name, email, plan, plan_expires_at').in('id', [...commissionBy.keys()]);
    const base = process.env.CLIENT_URL || 'https://meeticulous.com';
    for (const h of hosts || []) {
      if (!h.email || !isFreeSlug(resolveVendorPlan(h))) continue;
      const { data: prior } = await supabaseAdmin
        .from('email_logs').select('id').eq('event_key', SPOTS_EVENT).eq('recipient', h.email).limit(1).maybeSingle();
      if (prior) continue;
      await NotificationEngine.send({
        event: SPOTS_EVENT,
        data: {
          email: h.email, name: h.name, audience: 'vendor',
          emailUser: { name: h.name, email: h.email },
          emailData: {
            first_name: (h.name || '').split(' ')[0] || 'there',
            spots_left: String(status.left),
            commission_total: inr(commissionBy.get(h.id)),
            upgrade_url: `${base}/dashboard/upgrade?src=founding_low`,
          },
          recipientUserId: h.id,
        },
      });
      out.sent++;
    }
  } catch (err) {
    console.error('founding spots low (non-fatal):', err.message);
  }
  return out;
}

module.exports = { maybeSendUpgradeNudge, sendFoundingSpotsLow, THRESHOLD_INR, EVENT, SPOTS_EVENT };
