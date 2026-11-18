// dashboard_v2 — in-section sub-nav definitions. Each tab is a REAL route (the
// pages existed as separate rail items before the redesign), so URLs, bookmarks
// and the NAV_V2 rail highlighting all keep working. Fed to the kit's <SubNav/>.
export const MONEY_NAV = [
  { to: '/dashboard/earnings', label: 'Earnings', end: true },
  { to: '/dashboard/payments/payouts', label: 'Payouts' },
  { to: '/dashboard/payments/transactions', label: 'Transactions' },
  { to: '/dashboard/invoices', label: 'Invoices' },
];

export const GROW_NAV = [
  { to: '/dashboard/testimonials', label: 'Social proof', end: true },
  { to: '/dashboard/referrals', label: 'Refer & earn' },
];

export const SETTINGS_NAV = [
  { to: '/dashboard/profile', label: 'Account', end: true },
  { to: '/dashboard/upgrade', label: 'Plan & billing' },
  { to: '/dashboard/kyc', label: 'Verification' },
  { to: '/dashboard/chat', label: 'Help' },
];
