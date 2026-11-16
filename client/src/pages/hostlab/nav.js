// ─────────────────────────────────────────────────────────────────────────────
// Host Lab — the nav tree.
//
// Three groups, eight destinations, and sub-pages that are the SAME tabs each
// section renders. A section's tab set is declared once, here, and read by both
// the rail (as collapsible children) and the page (as its tab bar), so the two
// can never disagree.
//
// Shape follows the references: group labels like GROWZA's Main / Accounts /
// Support, a chevron on any row with children like Cal.com's Apps and Insights,
// and children indented under a hairline like URBN's Advertisements and Deals.
// ─────────────────────────────────────────────────────────────────────────────
import {
  CalendarDays, CalendarRange, CreditCard, Home, Package, Settings, TrendingUp, Users,
} from 'lucide-react';

export const BASE = '/host-lab';

/** Tab sets, shared between the rail and the page that owns them. */
export const TABS = {
  catalog: [
    { value: 'services', label: 'Services' },
    { value: 'products', label: 'Products' },
    { value: 'courses', label: 'Courses' },
    { value: 'memberships', label: 'Memberships' },
    { value: 'offers', label: 'Offers' },
  ],
  schedule: [
    { value: 'hours', label: 'Hours' },
    { value: 'rules', label: 'Rules' },
    { value: 'dates', label: 'Specific dates' },
    { value: 'calendars', label: 'Calendars' },
  ],
  money: [
    { value: 'earnings', label: 'Earnings' },
    { value: 'payouts', label: 'Payouts' },
    { value: 'transactions', label: 'Transactions' },
    { value: 'invoices', label: 'Invoices' },
  ],
  grow: [
    { value: 'page', label: 'Booking page' },
    { value: 'insights', label: 'Insights' },
    { value: 'proof', label: 'Social proof' },
    { value: 'refer', label: 'Refer & earn' },
  ],
  settings: [
    { value: 'account', label: 'Account' },
    { value: 'plan', label: 'Plan & billing' },
    { value: 'verification', label: 'Verification' },
    { value: 'notifications', label: 'Notifications' },
    { value: 'help', label: 'Help' },
    { value: 'moved', label: 'Where things moved' },
  ],
};

export const NAV = [
  {
    label: 'Main',
    items: [
      { to: '', label: 'Today', icon: Home, end: true },
      { to: 'bookings', label: 'Bookings', icon: CalendarDays, badge: 2 },
      { to: 'clients', label: 'Clients', icon: Users },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: 'catalog', label: 'Catalog', icon: Package, tabs: 'catalog' },
      { to: 'schedule', label: 'Schedule', icon: CalendarRange, tabs: 'schedule' },
      { to: 'money', label: 'Money', icon: CreditCard, tabs: 'money' },
      { to: 'grow', label: 'Grow', icon: TrendingUp, tabs: 'grow', badge: 2 },
    ],
  },
  {
    label: 'Account',
    items: [{ to: 'settings', label: 'Settings', icon: Settings, tabs: 'settings' }],
  },
];

/** Flat list, for the phone tab bar and the command palette. */
export const FLAT = NAV.flatMap((g) => g.items);

/** The five a host touches daily; the rest sit behind More. */
export const TAB_BAR = ['', 'bookings', 'clients', 'money', 'grow'];

export const href = (to) => (to ? `${BASE}/${to}` : BASE);

export default NAV;
