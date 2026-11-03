// Pure ranking for the dashboard "Next step" card.
//
// The host dashboard used to show up to four separate banners (set up payouts /
// upgrade / legacy auto-renew / share your link), each self-deciding and each
// dismissed via localStorage. This unifies them: given the signals the dashboard
// has already loaded, return the ACTIVE nudges in priority order, and the dashboard
// shows the single top one that isn't snoozed. Ops-critical (money stuck) outranks
// conversion, which outranks activation — one card, never a stack.
//
// Data-only descriptors (icon is a NAME, not a component) so this stays a pure,
// testable function with no React/lucide import.

import { PREMIUM_PLAN } from '../data/plans';

export const NUDGE_KEYS = ['kyc', 'legacy', 'taste', 'upgrade', 'calendar', 'share'];

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export function buildNudges(ctx = {}) {
  const {
    isFreePlan = false, plan, subscriptionStatus, hasPaymentMandate,
    pendingEarnings = 0, payoutsReady = false,
    commissionPaid = 0, hasRealEarning = false,
    isHost = false, calendarConnected = false,
    hasUsername = false, servicesCount = 0, bookingsCount = 0,
    taste = null, // { endsAt, daysLeft, endedDaysAgo } from GET /host/nudges (free hosts only)
  } = ctx;

  const out = [];

  // 1. Money is stuck — earned but payouts not set up. Highest: it's their cash,
  //    and it's not dismissible (keep asking until resolved).
  if (pendingEarnings > 0 && !payoutsReady) {
    out.push({ key: 'kyc', priority: 100, dismissible: false, tone: 'emerald', icon: 'Wallet',
      title: `You've earned ${rupees(pendingEarnings)} — set up payouts to receive it`,
      body: 'Finish a quick one-time verification (PAN + bank). You only need to do this once.',
      cta: 'Set up payouts', to: '/dashboard/kyc' });
  }

  // 2. Paid plan about to lapse — active but no auto-renew mandate (legacy partners).
  if (plan && !isFreePlan && subscriptionStatus === 'active' && !hasPaymentMandate) {
    out.push({ key: 'legacy', priority: 90, dismissible: true, tone: 'amber', icon: 'CreditCard',
      title: "Your plan won't auto-renew",
      body: 'Set up auto-renew so you never lose access when your current period ends.',
      cta: 'Set up auto-renew', to: '/dashboard/upgrade' });
  }

  // 2b. The 60-day Pro taste is ending / just ended (docs/host-lifecycle-nurture.md
  //     stages 5–7). Above the commission pitch: losing WhatsApp reminders is the
  //     moment the host actually feels Pro's value.
  if (isFreePlan && taste) {
    const endsOn = new Date(taste.endsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (taste.daysLeft > 0 && taste.daysLeft <= 15) {
      out.push({ key: 'taste', priority: 85, dismissible: true, tone: 'primary', icon: 'MessageCircle',
        title: `${taste.daysLeft} day${taste.daysLeft === 1 ? '' : 's'} left of WhatsApp reminders`,
        body: `On ${endsOn} your guests' reminders switch to email. Pro keeps WhatsApp on — founding price ${rupees(PREMIUM_PLAN.yearly)}/yr incl. GST, locked for life.`,
        cta: 'Keep WhatsApp reminders', to: '/dashboard/upgrade?src=taste_card' });
    } else if (taste.endedDaysAgo != null && taste.endedDaysAgo <= 30) {
      out.push({ key: 'taste', priority: 85, dismissible: true, tone: 'primary', icon: 'MessageCircle',
        title: 'WhatsApp reminders are off',
        body: 'Your guests get email reminders only, and reschedule alerts are off. Pro turns them back on.',
        cta: 'Turn WhatsApp back on', to: '/dashboard/upgrade?src=taste_ended_card' });
    }
  }

  // 3. Conversion — free plan with real earnings/commission → the 0% pitch, quoting
  //    the actual rupees paid so it's a calculation, not a generic upsell.
  if (isFreePlan && (commissionPaid > 0 || hasRealEarning)) {
    out.push({ key: 'upgrade', priority: 80, dismissible: true, tone: 'primary', icon: 'IndianRupee',
      title: commissionPaid > 0
        ? `You've paid ${rupees(commissionPaid)} in platform commission`
        : "You're on Starter — 5% commission applies as you earn",
      body: commissionPaid > 0
        ? 'Pro charges 0% commission — upgrade and keep every rupee.'
        : 'Pro charges 0% commission, for under ₹4 a day.',
      cta: 'See plans', to: '/dashboard/upgrade' });
  }

  // 3b. Calendar not connected — a double-booking risk, so it outranks the share
  //     nudge (70) but stays under the paid-conversion pitches (80+). Dismissible
  //     (7-day snooze server-side) so a host who skipped it isn't nagged daily.
  //     `action` (not `to`): the card runs the Google OAuth connect, not a route.
  if (isHost && !calendarConnected) {
    out.push({ key: 'calendar', priority: 75, dismissible: true, tone: 'primary', icon: 'CalendarCheck',
      title: "Connect your calendar so guests never book you when you're busy",
      body: 'We check your Google Calendar before offering slots, so you never get double-booked.',
      cta: 'Connect', action: 'connectCalendar', to: null });
  }

  // 4. Activation — live (username + a service) but zero bookings → share the link.
  //    Rendered as the rich share hero in Dashboard, not the generic card.
  if (hasUsername && servicesCount > 0 && bookingsCount === 0) {
    out.push({ key: 'share', priority: 70, dismissible: true, tone: 'primary', icon: 'Share2',
      title: "You're live! 🎉 Now share your link to get your first booking",
      body: 'Bookings come from people who see your link. Send it to your followers, groups and DMs.',
      cta: 'Share', to: null });
  }

  return out.sort((a, b) => b.priority - a.priority);
}

// Top active nudge that isn't currently snoozed. snoozed = { key: isoUntil }.
export function pickNextStep(nudges, snoozed = {}) {
  const now = Date.now();
  return nudges.find((n) => {
    const until = snoozed[n.key];
    return !(until && new Date(until).getTime() > now);
  }) || null;
}
