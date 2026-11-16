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
  CalendarDays, CalendarRange, CreditCard, Home, Lightbulb, LineChart, MessagesSquare,
  Package, Settings, TrendingUp, Users,
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
    { slug: 'agenda', label: 'Agenda', blurb: 'Grouped by day, in order.' },
  ],
  schedule: [
    { slug: 'hours', label: 'Hours', blurb: 'The week a guest can book against.' },
    { slug: 'rules', label: 'Rules', blurb: 'Notice, gaps and limits on every slot you offer.' },
    { slug: 'dates', label: 'Specific dates', blurb: 'One-offs that override the weekly pattern.' },
    { slug: 'calendars', label: 'Calendars', blurb: 'Busy time elsewhere should close the slot here.' },
  ],
  // Creator Intelligence. Four pages, one question each — see
  // docs/superpowers/specs/2026-11-16-creator-intelligence-design.md §8.
  // "Revenue" here is the analysis; Money › Earnings is the ledger behind it.
  intelligence: [
    { slug: 'overview', label: 'Overview', blurb: 'What your business did, and what to do next.' },
    { slug: 'revenue', label: 'Revenue', blurb: 'Every rupee in, every deduction, and what is coming.' },
    { slug: 'audience', label: 'Audience', blurb: 'Who arrives, and where they fall out.' },
    { slug: 'demand', label: 'Demand', blurb: 'When you are wanted, and who keeps coming back.' },
  ],
  money: [
    { slug: 'earnings', label: 'Earnings', blurb: 'What you have made, and what is making it.' },
    { slug: 'payouts', label: 'Payouts', blurb: 'Where your money is, and when it lands.' },
    { slug: 'transactions', label: 'Transactions', blurb: 'Every payment, fee and refund.' },
    { slug: 'invoices', label: 'Invoices', blurb: 'GST invoices, issued and received.' },
  ],
  // Insights — the moves, and whether they worked. Its own destination rather
  // than a card on Intelligence › Overview: a recommendation you scroll past is
  // not a recommendation. "What worked" is what makes the advice honest.
  insights: [
    { slug: 'week', label: 'This week', blurb: 'The moves on the table now, each with its evidence.' },
    { slug: 'history', label: 'History', blurb: 'Every move already surfaced, and what you did with it.' },
    { slug: 'worked', label: 'What worked', blurb: 'The measured result of the ones you acted on.' },
  ],
  // Community. The console's view of /community — the part that is about this
  // host. Reading and posting stay in the community itself; a second feed here
  // would be the Grow › Insights mistake again.
  community: [
    { slug: 'activity', label: 'Activity', blurb: 'What you have posted, and what it earned you.' },
    { slug: 'mentions', label: 'Mentions', blurb: 'Posts that name you, while the thread is still live.' },
    { slug: 'answer', label: 'Answer', blurb: 'Open questions you could answer. The cheapest visibility there is.' },
    { slug: 'spaces', label: 'Spaces', blurb: 'The five rooms, and which ones you may post in.' },
  ],
  grow: [
    { slug: 'page', label: 'Booking page', blurb: 'The one link worth sharing, and how to make it work harder.' },
    // "Insights" used to sit here. It was page views, a drop-off funnel, traffic
    // sources and three written observations — every one of which Intelligence
    // now answers, with real charts and a Pro gate. Two surfaces answering
    // "why are bookings happening or not" is the duplication the IA decision
    // existed to prevent, so this one goes and Intelligence keeps it.
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
      { to: 'intelligence', label: 'Intelligence', icon: LineChart, pages: 'intelligence' },
      { to: 'insights', label: 'Insights', icon: Lightbulb, pages: 'insights', badge: 3 },
      { to: 'money', label: 'Money', icon: CreditCard, pages: 'money' },
      { to: 'grow', label: 'Grow', icon: TrendingUp, pages: 'grow', badge: 2 },
      // Badge = unread mentions. A guest naming you by name is the highest-intent
      // moment in the community, so it earns a count in the rail.
      { to: 'community', label: 'Community', icon: MessagesSquare, pages: 'community', badge: 1 },
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
