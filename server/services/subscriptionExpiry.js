'use strict';

/**
 * subscriptionExpiry.js — renewal nudge before a paid plan lapses (Sujata).
 *
 * No cron scanned expiry dates, so paid hosts could silently drop to Starter
 * (5% commission back) with no heads-up. This fires a renewal email at T-7 and
 * T-1 days before plan_expires_at / current_period_end.
 *
 * Fires on exact day-counts (7 or 1) and dedupes via email_logs (one send per
 * host per 2-day window) so an hourly cron doesn't spam. No migration. Never throws.
 */

const { supabaseAdmin } = require('../config/supabase');
const NotificationEngine = require('./notificationEngine');
const { isFreeSlug, getPlan } = require('./planService');

const EVENT = 'SUBSCRIPTION_EXPIRING';
const SEND_ON_DAYS = new Set([7, 1]);
const DAY_MS = 86400000;

// Read the plan's display name straight from subscription_plans so a rename
// (Host+ → Sloth Active (Partner), etc.) never leaves a stale label in a
// customer-facing email. Falls back to a neutral phrase if the row is gone.
const planLabel = async (slug) => {
  try {
    const { name } = (await getPlan(slug)) || {};
    return name || 'your plan';
  } catch (_) {
    return 'your plan';
  }
};

async function recentlySent(email) {
  const since = new Date(Date.now() - 2 * DAY_MS).toISOString();
  const { data } = await supabaseAdmin
    .from('email_logs').select('id')
    .eq('event_key', EVENT).eq('recipient', email).gt('created_at', since)
    .limit(1).maybeSingle();
  return !!data;
}

async function processSubscriptionExpiry() {
  try {
    const now = Date.now();
    const horizon = new Date(now + 8 * DAY_MS).toISOString();
    const nowIso = new Date(now).toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, plan, plan_expires_at, current_period_end')
      .not('plan_expires_at', 'is', null)
      .gte('plan_expires_at', nowIso).lte('plan_expires_at', horizon)
      .limit(500);
    if (error) {
      // Legacy schema without current_period_end → retry without it.
      if (/current_period_end/.test(error.message)) {
        const retry = await supabaseAdmin
          .from('profiles').select('id, name, email, plan, plan_expires_at')
          .not('plan_expires_at', 'is', null).gte('plan_expires_at', nowIso).lte('plan_expires_at', horizon).limit(500);
        if (retry.error) { console.error('sub expiry scan:', retry.error.message); return { sent: 0 }; }
        return await fanOut(retry.data || [], now);
      }
      console.error('sub expiry scan:', error.message);
      return { sent: 0 };
    }
    return await fanOut(rows || [], now);
  } catch (err) {
    console.error('subscription expiry (non-fatal):', err.message);
    return { sent: 0 };
  }
}

async function fanOut(rows, now) {
  let sent = 0;
  for (const p of rows) {
    if (!p.email || isFreeSlug(p.plan)) continue;
    const expiry = new Date(p.current_period_end || p.plan_expires_at);
    const daysLeft = Math.ceil((expiry.getTime() - now) / DAY_MS);
    if (!SEND_ON_DAYS.has(daysLeft)) continue;
    if (await recentlySent(p.email)) continue;

    const base = process.env.CLIENT_URL || 'https://meeticulous.com';
    await NotificationEngine.send({
      event: EVENT,
      data: {
        email: p.email, name: p.name,
        emailUser: { name: p.name, email: p.email },
        emailData: {
          first_name: (p.name || '').split(' ')[0] || 'there',
          plan_name: await planLabel(p.plan),
          days_left: daysLeft,
          expiry_date: expiry.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' }),
          renew_url: `${base}/dashboard/upgrade`,
        },
        recipientUserId: p.id,
      },
    });
    sent++;
  }
  if (sent) console.log(`Subscription expiry: sent ${sent} renewal nudge(s)`);
  return { sent };
}

module.exports = { processSubscriptionExpiry, EVENT, SEND_ON_DAYS };
