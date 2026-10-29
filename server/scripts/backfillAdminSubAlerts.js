/**
 * backfillAdminSubAlerts.js — one-time founder catch-up for subscription
 * purchases that predate the founder-alert wiring (PR #674).
 *
 * Usage:  node scripts/backfillAdminSubAlerts.js --dry-run   (list, send nothing)
 *         node scripts/backfillAdminSubAlerts.js              (send one alert each)
 *
 * Run MANUALLY on prod (Render Shell) — the Resend key lives only in the Render
 * environment, so this can't send from a laptop. Emails go to ADMIN_ALERT_EMAIL
 * (comma-separated supported), same as the live alerts.
 *
 * Uses the SAME adminAlert helper + message shape as the live code
 * (subscriptionService.sendSubscriptionReceiptEmail), so a caught-up inbox looks
 * identical to a real-time ping. adminAlert is throttle-keyed per payment id, so
 * re-running within the cooldown is a no-op for already-alerted charges.
 */
'use strict';
require('dotenv').config();

const DRY = process.argv.includes('--dry-run');
const { supabaseAdmin } = require('../config/supabase');
const { adminAlert } = require('../utils/adminAlert');

const CLIENT = process.env.CLIENT_URL || 'https://bookasloth.com';
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

(async () => {
  // Initial (non-renewal) subscription charges only — the "new purchase" pings.
  const { data: rows, error } = await supabaseAdmin
    .from('subscription_payments')
    .select('vendor_id, plan_type, billing_cadence, kind, total_charged, razorpay_payment_id, created_at')
    .in('kind', ['initial', 'purchase'])
    .order('created_at', { ascending: true });
  if (error) { console.error('query failed:', error.message); process.exit(1); }
  if (!rows?.length) { console.log('no subscription purchases found'); process.exit(0); }

  console.log(`${rows.length} purchase(s) found${DRY ? ' (dry-run — sending nothing)' : ''}:`);
  for (const r of rows) {
    const { data: prof } = await supabaseAdmin
      .from('profiles').select('name, email').eq('id', r.vendor_id).maybeSingle();
    const line = `${(r.created_at || '').slice(0, 10)}  ${prof?.name || 'A host'} (${prof?.email || 'no email'})  ${r.plan_type}/${r.billing_cadence}  ${inr(r.total_charged)}  ${r.razorpay_payment_id}`;
    console.log(' -', line);
    if (DRY) continue;

    const res = await adminAlert({
      key: `sub_charge:${r.razorpay_payment_id || r.vendor_id}`,
      category: 'Payment Receipt',
      subject: `New subscription: ${r.plan_type} (catch-up)`,
      lines: [
        `${prof?.name || 'A host'} (${prof?.email || 'no email'})`,
        `Plan: ${r.plan_type} (${r.billing_cadence})`,
        `Amount: ${inr(r.total_charged)}`,
        `Charged on ${(r.created_at || '').slice(0, 10)}. Catch-up for a purchase made before founder alerts were wired.`,
      ],
      link: `${CLIENT}/admin/host360/${r.vendor_id}`,
    });
    console.log('   sent:', JSON.stringify(res));
  }
  process.exit(0);
})();
