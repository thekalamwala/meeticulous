// Guest space (/user/*) navigation model for the shared Kept shell
// (DashboardLayoutV2 + KeptTabBar). Sections use the host NAV_V2 shape, so
// resolveActive / firstItemTo / isLeafSection work on them unchanged.
//
// Spec: docs/superpowers/specs/2026-11-27-guest-dashboard-kept-design.md §4.
// Library is ONE item with matchPrefix over both pages, so the rail shows a leaf
// row (no chevron) that stays lit on Courses and Memberships alike; the page
// itself carries the Courses | Memberships tabs.
import {
  House, CalendarDays, Library, ReceiptText, Star, Gift, User, LifeBuoy,
} from 'lucide-react';

export const GUEST_HOME = '/user';
export const GUEST_HELP = '/user/chat';

export const GUEST_SECTIONS = [
  { id: 'home', label: 'Home', items: [{ to: '/user', label: 'Home', exact: true }] },
  { id: 'bookings', label: 'Bookings', items: [{ to: '/user/my-bookings', label: 'Bookings' }] },
  { id: 'library', label: 'Library', items: [{ to: '/user/courses', label: 'Library', matchPrefix: ['/user/courses', '/user/memberships'] }] },
  { id: 'invoices', label: 'Invoices', items: [{ to: '/user/invoices', label: 'Invoices' }] },
  { id: 'reviews', label: 'Reviews', items: [{ to: '/user/reviews', label: 'Reviews' }] },
  { id: 'rewards', label: 'Rewards', items: [{ to: '/user/loyalty', label: 'Rewards' }] },
];

export const GUEST_GROUPS = [
  { label: 'Your space', ids: ['home', 'bookings', 'library', 'invoices', 'reviews', 'rewards'] },
];

export const GUEST_ICONS = {
  home: House, bookings: CalendarDays, library: Library, invoices: ReceiptText,
  reviews: Star, rewards: Gift, profile: User, help: LifeBuoy,
};

// Phone: Home · Library · Bookings · Invoices · More (flat: the raised centre is for
// create actions only, founder 2026-11-27). Sheet = the rest.
export const GUEST_TAB_BAR = {
  sections: GUEST_SECTIONS,
  order: ['home', 'library', 'bookings', 'invoices'],
  sheet: [
    'reviews',
    'rewards',
    { id: 'profile', label: 'Profile', to: '/user/profile' },
    { id: 'help', label: 'Help', to: GUEST_HELP },
  ],
  icons: GUEST_ICONS,
  sub: {
    reviews: 'What hosts say', rewards: 'Your tier', profile: 'Your details', help: 'Chat with us',
  },
};

// Every guest page and where it is reached from (rail, sheet or account menu).
// guestNav.test pins that nothing under /user is stranded.
export const GUEST_MENU_LINKS = ['/user/profile', GUEST_HELP];
