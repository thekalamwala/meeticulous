'use strict';

/**
 * repeatClientNudge.js — the first time a free host's guest books AGAIN, tell
 * them what Pro's rebook automation would do for clients like that
 * (docs/host-lifecycle-nurture.md stage 10). A repeat client is proof the
 * business compounds — the moment rebook automation makes sense.
 *
 * Bell only, once per host ever (in_app_notifications dedupe_key). Free plans
 * only. Never throws — a side-effect of booking confirmation.
 */

const { supabaseAdmin } = require('../config/supabase');
const planService = require('./planService');
const { inAppNotify } = require('../utils/inAppNotify');

const DEDUPE_KEY = 'repeat_client_first';

async function maybeNudgeRepeatClient({ host, booking }) {
  try {
    if (!booking?.host_id) return { sent: false, reason: 'no_booking' };
    let plan = host?.plan;
    if (plan === undefined) {
      const { data } = await supabaseAdmin
        .from('profiles').select('plan, plan_expires_at').eq('id', booking.host_id).maybeSingle();
      plan = planService.resolveVendorPlan(data || {});
    } else {
      plan = planService.resolveVendorPlan(host);
    }
    if (!planService.isFreeSlug(plan)) return { sent: false, reason: 'paid_plan' };

    const [col, val] = booking.guest_phone ? ['guest_phone', booking.guest_phone]
      : booking.guest_email ? ['guest_email', booking.guest_email] : [null, null];
    if (!col) return { sent: false, reason: 'no_guest_key' };

    const { count } = await supabaseAdmin
      .from('bookings').select('id', { count: 'exact', head: true })
      .eq('host_id', booking.host_id).eq(col, val).neq('id', booking.id)
      .in('status', ['confirmed', 'completed']);
    if (!count) return { sent: false, reason: 'first_visit' };

    const first = (booking.guest_name || 'A client').split(' ')[0];
    inAppNotify({
      userId: booking.host_id, role: 'host', type: 'REPEAT_CLIENT_NUDGE',
      title: `${first} booked again 🎉`,
      body: `Pro asks regulars like ${first} to rebook automatically — 3 and 21 days after each session.`,
      link: '/dashboard/upgrade?src=repeat_client',
      data: { bookingId: booking.id },
      dedupeKey: DEDUPE_KEY,
    });
    return { sent: true };
  } catch (err) {
    console.error('repeat client nudge (non-fatal):', err.message);
    return { sent: false, reason: 'error' };
  }
}

module.exports = { maybeNudgeRepeatClient, DEDUPE_KEY };
