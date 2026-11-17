// ─────────────────────────────────────────────────────────────────────────────
// Host Lab — the nav tree.
//
// Three groups, eight destinations, and sub-pages that are REAL PAGES: each has
// its own path, its own heading, and renders only itself. They were tabs for a
// while, which was a mistake — the rail already lists them and gives each a
// URL, so a tab strip inside the page was a second navigation for the same
// thing, in a second style, that could disagree with the first.
//
// The rule the whole console follows now: if it has a URL in the rail, it is a
// page. If it is a subset of one list, it is a filter. Nothing is a tab.
//
// Shape follows the references: group labels like GROWZA's Main / Accounts /
// Support, a chevron on any row with children like Cal.com's Apps and Insights,
// and children indented under a hairline like URBN's Advertisements and Deals.
// ─────────────────────────────────────────────────────────────────────────────
import {
  CalendarDays, CalendarRange, CreditCard, Home, Package, Settings, TrendingUp, Users,
} from 'lucide-react';

export const BASE = '/host-lab';

/** Sub-pages, keyed by their parent destination. Declared once: the rail reads
 *  this to list them, the router reads it to route them, and each page reads
 *  its own entry for its heading. They cannot drift apart.
 *
 *  Catalog is deliberately absent — it is one list with a Type filter, not a
 *  set of pages. Bookings and Clients are single pages. */
export const SUBPAGES = {
  bookings: [
    { slug: 'list', label: 'List', blurb: 'Every booking, filterable and sortable.' },
    { slug: 'week', label: 'Week', blurb: 'The week ahead, day by day.' },
    { slug: 'month', label: 'Month', blurb: 'The shape of the month at a glance.' },
    // No Agenda: a grouped-by-day list sat between List and Week without
    // being better than either. An unknown slug falls back to the first page,
    // so an old /bookings/agenda link still lands on List.
  ],
  schedule: [
    { slug: 'hours', label: 'Hours', blurb: 'The week a guest can book against.' },
    { slug: 'rules', label: 'Rules', blurb: 'Notice, gaps and limits on every slot you offer.' },
    { slug: 'dates', label: 'Specific dates', blurb: 'One-offs that override the weekly pattern.' },
    { slug: 'calendars', label: 'Calendars', blurb: 'Busy time elsewhere should close the slot here.' },
  ],
  money: [
    { slug: 'earnings', label: 'Earnings', blurb: 'What you have made, and what is making it.' },
    { slug: 'payouts', label: 'Payouts', blurb: 'Where your money is, and when it lands.' },
    { slug: 'transactions', label: 'Transactions', blurb: 'Every payment, fee and refund.' },
    { slug: 'invoices', label: 'Invoices', blurb: 'GST invoices, issued and received.' },
  ],
  grow: [
    { slug: 'page', label: 'Booking page', blurb: 'The one link worth sharing, and how to make it work harder.' },
    { slug: 'insights', label: 'Insights', blurb: 'Why bookings are or are not happening.' },
    { slug: 'proof', label: 'Social proof', blurb: 'Reviews guests left you, and the quotes you added.' },
    { slug: 'refer', label: 'Refer & earn', blurb: 'Invite a host; you both get paid when they go live.' },
  ],
  settings: [
    { slug: 'account', label: 'Account', blurb: 'You, your link, and how you sign in.' },
    { slug: 'plan', label: 'Plan & billing', blurb: 'What you are on, and what it is worth.' },
    { slug: 'verification', label: 'Verification', blurb: 'Required before any money can reach your bank.' },
    { slug: 'notifications', label: 'Notifications', blurb: 'What reaches you, and where.' },
    { slug: 'help', label: 'Help', blurb: 'Talk to us, or find the answer yourself.' },
    { slug: 'moved', label: 'Where things moved', blurb: 'Every page of the old dashboard, and where it lands.' },
  ],
};

export const NAV = [
  {
    label: 'Main',
    items: [
      { to: '', label: 'Today', icon: Home, end: true },
      { to: 'bookings', label: 'Bookings', icon: CalendarDays, pages: 'bookings', badge: 2 },
      { to: 'clients', label: 'Clients', icon: Users },
    ],
  },
  {
    label: 'Business',
    items: [
      { to: 'catalog', label: 'Catalog', icon: Package },
      { to: 'schedule', label: 'Schedule', icon: CalendarRange, pages: 'schedule' },
      { to: 'money', label: 'Money', icon: CreditCard, pages: 'money' },
      { to: 'grow', label: 'Grow', icon: TrendingUp, pages: 'grow', badge: 2 },
    ],
  },
  {
    label: 'Account',
    items: [{ to: 'settings', label: 'Settings', icon: Settings, pages: 'settings' }],
  },
];

/** Flat list, for the phone tab bar and the command palette. */
export const FLAT = NAV.flatMap((g) => g.items);

/** The five a host touches daily; the rest sit behind More. */
export const TAB_BAR = ['', 'bookings', 'clients', 'money', 'grow'];

export const href = (to) => (to ? `${BASE}/${to}` : BASE);

/** Where a destination lands when you click it in the rail: its first page. */
export const landingFor = (item) => (item.pages ? `${item.to}/${SUBPAGES[item.pages][0].slug}` : item.to);

/** One sub-page's entry, for its own heading. */
export const pageMeta = (parent, slug) =>
  SUBPAGES[parent]?.find((p) => p.slug === slug) || SUBPAGES[parent]?.[0];

export default NAV;
