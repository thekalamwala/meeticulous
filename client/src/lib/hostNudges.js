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

export const NUDGE_KEYS = ['kyc', 'legacy', 'upgrade', 'share'];

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;

export function buildNudges(ctx = {}) {
  const {
    isFreePlan = false, plan, subscriptionStatus, hasPaymentMandate,
    pendingEarnings = 0, payoutsReady = false,
    commissionPaid = 0, hasRealEarning = false,
    hasUsername = false, servicesCount = 0, bookingsCount = 0,
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

  // 3. Conversion — free plan with real earnings/commission → the 0% pitch, quoting
  //    the actual rupees paid so it's a calculation, not a generic upsell.
  if (isFreePlan && (commissionPaid > 0 || hasRealEarning)) {
    out.push({ key: 'upgrade', priority: 80, dismissible: true, tone: 'primary', icon: 'IndianRupee',
      title: commissionPaid > 0
        ? `You've paid ${rupees(commissionPaid)} in platform commission`
        : "You're on Sloth — 5% commission applies as you earn",
      body: commissionPaid > 0
        ? 'Sloth Active charges 0% commission — upgrade and keep every rupee.'
        : 'Sloth Active charges 0% commission, for under ₹10 a day.',
      cta: 'See plans', to: '/dashboard/upgrade' });
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
