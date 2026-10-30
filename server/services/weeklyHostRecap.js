'use strict';

/**
 * weeklyHostRecap.js — the core host retention loop. Once a week, email each
 * ACTIVE host a short "here's your week" recap: money earned, bookings taken, and
 * what's coming up. Hosts come back for money and their calendar — this is the
 * only honest weekly habit for a booking product, so it's deliberately just those
 * three numbers, no gamification.
 *
 * Guardrails:
 *   • OFF by default. Only runs when WEEKLY_RECAP_ENABLED === 'true', so a deploy
 *     never blasts everyone unexpectedly — the founder flips it on.
 *   • Never spams dead hosts. A host with no bookings this week AND nothing upcoming
 *     gets nothing — silence beats a "you earned ₹0" email.
 *   • Weekly, not per-tick. A platform-level marker in platform_settings blocks a
 *     re-send within 6 days, so the cron can tick daily and still send ~weekly.
 *   • Best-effort per host — one host's email failure never aborts the batch.
 *   • WhatsApp leg is intentionally NOT here: it needs a pre-approved AiSensy
 *     template (external). Wire it in once that campaign exists.
 */

const { supabaseAdmin } = require('../config/supabase');
const sendEmail = require('../utils/sendEmail');
const { inAppNotify } = require('../utils/inAppNotify');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MARKER_KEY = 'weekly_recap_last_sent_at';
const RECAP_TYPE = 'WEEKLY_RECAP';

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const paidAmount = (b) => Number(b?.vendor_amount ?? b?.amount ?? 0);

// Pure: is there anything worth emailing about? (kept pure for tests)
function worthSending(summary) {
  return (summary.bookings > 0) || (summary.upcoming > 0);
}

// Pure: turn a host's raw rows into the three numbers the email shows.
function summarize(recentPaidRows, upcomingCount) {
  const bookings = recentPaidRows.length;
  const earnings = recentPaidRows.reduce((sum, b) => sum + paidAmount(b), 0);
  return { bookings, earnings: Math.round(earnings * 100) / 100, upcoming: upcomingCount };
}

async function readMarker() {
  const { data } = await supabaseAdmin
    .from('platform_settings').select('value').eq('key', MARKER_KEY).maybeSingle();
  return data?.value || null;
}

async function writeMarker(iso) {
  await supabaseAdmin
    .from('platform_settings')
    .upsert({ key: MARKER_KEY, value: iso }, { onConflict: 'key' });
}

// Per-host weekly stats from the bookings table.
async function computeHostWeek(hostId) {
  const now = Date.now();
  const since = new Date(now - WEEK_MS).toISOString();
  const nowIso = new Date(now).toISOString();
  const in7 = new Date(now + WEEK_MS).toISOString();

  const { data: recent } = await supabaseAdmin
    .from('bookings')
    .select('vendor_amount, amount')
    .eq('host_id', hostId)
    .eq('payment_status', 'paid')
    .gte('created_at', since);

  const { count: upcoming } = await supabaseAdmin
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('host_id', hostId)
    .eq('payment_status', 'paid')
    .gte('scheduled_at', nowIso)
    .lte('scheduled_at', in7);

  return summarize(recent || [], upcoming || 0);
}

function recapEmailHtml(host, s, base) {
  const name = (host.name || '').split(' ')[0] || 'there';
  const line = (label, value) =>
    `<tr><td style="padding:6px 0;color:#666">${label}</td>` +
    `<td style="padding:6px 0;text-align:right;font-weight:700;color:#111">${value}</td></tr>`;
  return (
    `<p>Hi ${name},</p>` +
    `<p>Here's your week on Meeticulous:</p>` +
    `<table style="width:100%;max-width:360px;border-collapse:collapse;font-size:15px">` +
    line('Earned this week', inr(s.earnings)) +
    line('Bookings taken', s.bookings) +
    line('Coming up (next 7 days)', s.upcoming) +
    `</table>` +
    `<p style="margin-top:16px"><a href="${base}/dashboard" style="display:inline-block;` +
    `padding:10px 18px;background:#960D32;color:#fff;text-decoration:none;border-radius:10px;` +
    `font-weight:600">Open your dashboard</a></p>` +
    `<p style="color:#888;font-size:12px">You get this because you have activity on Meeticulous.</p>`
  );
}

/**
 * Send the weekly recap to every active host with activity. Idempotent within a
 * week via the platform marker. Pass { force:true } to bypass the enable flag and
 * the 6-day guard (admin/manual trigger, tests).
 */
async function sendWeeklyRecaps({ force = false } = {}) {
  if (!force && process.env.WEEKLY_RECAP_ENABLED !== 'true') return { skipped: 'disabled' };

  if (!force) {
    const last = await readMarker();
    if (last && Date.now() - new Date(last).getTime() < 6 * DAY_MS) return { skipped: 'too_soon' };
  }

  const { data: hosts } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, username')
    .eq('is_host', true)
    .eq('onboarding_completed', true);

  const base = process.env.CLIENT_URL || 'https://meeticulous.com';
  let sent = 0;
  let skipped = 0;
  for (const host of hosts || []) {
    try {
      if (!host.email) { skipped++; continue; }
      const s = await computeHostWeek(host.id);
      if (!worthSending(s)) { skipped++; continue; } // never nag a dead host
      await sendEmail({
        to: host.email,
        subject: `Your week on Meeticulous — ${inr(s.earnings)} earned`,
        html: recapEmailHtml(host, s, base),
      });
      inAppNotify({
        userId: host.id, role: 'host', type: RECAP_TYPE,
        title: 'Your weekly recap',
        body: `${inr(s.earnings)} earned · ${s.bookings} booking(s) · ${s.upcoming} upcoming`,
        link: '/dashboard',
      });
      sent++;
    } catch (err) {
      skipped++;
      console.error('weekly recap (non-fatal) for host', host.id, err.message);
    }
  }

  await writeMarker(new Date().toISOString());
  return { sent, skipped };
}

module.exports = { sendWeeklyRecaps, summarize, worthSending, computeHostWeek, MARKER_KEY };
