'use strict';

/**
 * upgradeNudge.js — email version of the commission → upgrade nudge (Sujata).
 *
 * The free plan takes 5% commission; Host+/Studio take 0%. So the more a free
 * host earns, the more they pay — the upgrade sells itself once they've felt it.
 * Dashboard already shows an in-app card; this adds the email (higher reach) the
 * first time a free host's total commission crosses a threshold.
 *
 * Guarantees:
 *   • Free-plan hosts only (paid hosts already pay 0% — nothing to nudge).
 *   • One email per host — deduped on email_logs (no migration).
 *   • Never throws — runs as a fire-and-forget side-effect of a paid booking.
 */

const { supabaseAdmin } = require('../config/supabase');
const NotificationEngine = require('./notificationEngine');
const { resolveVendorPlan, isFreeSlug } = require('./planService');

// Rupees of commission a free host must have paid before the email fires.
const THRESHOLD_INR = Number(process.env.UPGRADE_NUDGE_THRESHOLD_INR) || 300;
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

    // Total commission this host has given up across paid bookings.
    const { data: rows, error } = await supabaseAdmin
      .from('bookings')
      .select('commission_applied, vendor_amount')
      .eq('host_id', host.id)
      .eq('payment_status', 'paid');
    if (error) return { sent: false, reason: 'query_error' };

    const list = rows || [];
    const commissionTotal = list.reduce((s, r) => s + Number(r.commission_applied || 0), 0);
    if (commissionTotal < THRESHOLD_INR) return { sent: false, reason: 'below_threshold' };

    // Dedup: already emailed this host? (email_logs is the queue + the record.)
    const { data: prior } = await supabaseAdmin
      .from('email_logs')
      .select('id')
      .eq('event_key', EVENT)
      .eq('recipient', host.email)
      .in('status', ['sent', 'queued'])
      .limit(1)
      .maybeSingle();
    if (prior) return { sent: false, reason: 'already_sent' };

    const bookingsCount = list.length;
    const base = process.env.CLIENT_URL || 'https://bookasloth.com';

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
          upgrade_url: `${base}/dashboard/upgrade`,
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

module.exports = { maybeSendUpgradeNudge, THRESHOLD_INR, EVENT };
