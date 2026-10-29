/**
 * opsAdminController.js — Operations Center summary (the admin homepage).
 *
 * Returns the "what needs attention right now" queue, computed from REAL data:
 * pending payouts, failed emails, failed notifications (WhatsApp), abandoned
 * (stale unpaid) bookings, plus headline platform counts. Every sub-count is
 * isolated in its own try/catch with a 0 fallback, so a single missing column
 * or empty table can never 500 the dashboard.
 */

const { supabaseAdmin } = require('../config/supabase');
const { safeError } = require('../utils/httpError');

// Each metric builds its own table-bound COUNT query; returns 0 on any error
// (missing column, empty table) so the dashboard never 500s.
const countWhere = async (table, apply) => {
  try {
    let q = supabaseAdmin.from(table).select('id', { count: 'exact', head: true });
    q = apply ? apply(q) : q;
    const { count, error } = await q;
    if (error) return 0;
    return count || 0;
  } catch (_) { return 0; }
};

// GET /api/admin/ops/summary
const getSummary = async (req, res) => {
  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    // Failed-delivery logs are historical: a failed email/WhatsApp from weeks ago
    // isn't actionable (you can't meaningfully retry an old booking confirmation),
    // but counting them all-time pinned the "needs attention" badge on forever with
    // no way to clear it. Only surface RECENT failures — the actionable window.
    const failWindow = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [
      pendingPayouts,
      failedEmails,
      failedNotifications,
      staleUnpaidBookings,
      pendingReviews,
      pendingVerifications,
      totalUsers,
      totalVendors,
      totalBookings,
      totalServices,
    ] = await Promise.all([
      countWhere('payout_requests', q => q.eq('status', 'pending')),
      countWhere('email_logs',      q => q.eq('status', 'failed').gt('created_at', failWindow)),
      countWhere('notification_logs', q => q.eq('status', 'failed').gt('created_at', failWindow)),
      countWhere('bookings',        q => q.eq('status', 'pending').eq('payment_status', 'unpaid').lt('created_at', oneHourAgo)),
      // "Reviews to moderate" = reviews an admin has flagged (v3.64 reviews.status).
      // 'flagged' is the only actionable state; visible/hidden are resolved.
      countWhere('reviews',         q => q.eq('status', 'flagged')),
      // Pending hosts = unverified, non-banned hosts who FINISHED onboarding — i.e.
      // real profiles awaiting the admin's is_verified toggle to go live in Explore +
      // the sitemap. Scoped to onboarding_completed so abandoned/incomplete signups
      // (empty profiles that will never be verified) don't inflate the attention badge.
      countWhere('profiles',        q => q.eq('role', 'host').eq('is_verified', false).eq('is_banned', false).eq('onboarding_completed', true)),
      countWhere('profiles',        q => q.eq('role', 'guest')),
      countWhere('profiles',        q => q.eq('role', 'host')),
      countWhere('bookings',        null),
      countWhere('services',        null),
    ]);

    const attention = [
      { key: 'pending_payouts',       label: 'Pending payouts',        count: pendingPayouts,       to: '/admin/finance/payouts?status=pending',     severity: pendingPayouts ? 'warning' : 'ok' },
      { key: 'failed_emails',         label: 'Failed emails',          count: failedEmails,         to: '/admin/platform/communication?tab=logs&status=failed', severity: failedEmails ? 'danger' : 'ok' },
      { key: 'failed_notifications',  label: 'Failed WhatsApp/notifs', count: failedNotifications,  to: '/admin/notifications?tab=logs&status=failed', severity: failedNotifications ? 'danger' : 'ok' },
      { key: 'stale_unpaid_bookings', label: 'Abandoned bookings',     count: staleUnpaidBookings,  to: '/admin/bookings/abandoned',                 severity: staleUnpaidBookings ? 'warning' : 'ok' },
      { key: 'pending_reviews',       label: 'Reviews to moderate',    count: pendingReviews,       to: '/admin/support/reviews?status=flagged',     severity: pendingReviews ? 'warning' : 'ok' },
      { key: 'pending_verifications', label: 'Pending verifications',  count: pendingVerifications, to: '/admin/providers/pending',       severity: pendingVerifications ? 'warning' : 'ok' },
    ];

    const totalAttention = attention.reduce((s, a) => s + a.count, 0);

    res.json({
      attention,
      totalAttention,
      stats: {
        users: totalUsers,
        vendors: totalVendors,
        bookings: totalBookings,
        services: totalServices,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    safeError(res, e);
  }
};

module.exports = { getSummary };
