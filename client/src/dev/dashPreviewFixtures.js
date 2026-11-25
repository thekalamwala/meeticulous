// Sample data for the dev-only dashboard preview (see ./dashPreview.js).
// Shapes mirror the real API responses (captured 2026-11-25); every person and
// figure here is made up. No real guest data belongs in this file.
const day = 86_400_000;
const at = (days, h = 10, m = 30) => {
  const d = new Date(Date.now() + days * day);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

const SERVICES = [
  { id: 'svc-1', title: 'Funnel Teardown', price: 1499, duration: 45, type: 'service', is_active: true, slug: 'funnel-teardown', meeting_mode: 'online', total_bookings: 5 },
  { id: 'svc-2', title: 'Growth Sprint Workshop', price: 999, duration: 60, type: 'service', is_active: true, slug: 'growth-sprint', meeting_mode: 'online', total_bookings: 5 },
  { id: 'svc-3', title: 'SEO Consultation', price: 0, duration: 30, type: 'service', is_active: true, slug: 'seo-consultation', meeting_mode: 'online', total_bookings: 2 },
  { id: 'svc-4', title: 'Intro call', price: 0, duration: 15, type: 'service', is_active: false, slug: 'intro-call', meeting_mode: 'online', total_bookings: 1 },
];

const GUESTS = ['Aarav Shah', 'Meera Iyer', 'Kabir Rao', 'Ananya Gupta', 'Rohan Das', 'Ishita Menon', 'Vikram Joshi'];

const booking = (i, days, svc, extra = {}) => {
  const s = SERVICES[svc];
  return {
    id: `bk-${i}`, host_id: 'host-preview', guest_id: `g-${i % 7}`,
    guest_name: GUESTS[i % GUESTS.length], guest_email: `guest${i}@example.com`, guest_phone: '+910000000000',
    scheduled_at: at(days, 9 + (i % 8), i % 2 ? 30 : 0), end_at: at(days, 10 + (i % 8)),
    created_at: at(days - 4), paid_at: s.price ? at(days - 4) : null,
    status: days < 0 ? 'completed' : 'confirmed',
    payment_status: s.price ? 'paid' : 'free',
    customer_total: s.price, amount: s.price, vendor_amount: Math.round(s.price * 0.95),
    commission_applied: Math.round(s.price * 0.05), commission_gst: 0,
    source: 'platform', meeting_link: 'https://meet.google.com/abc-defg-hij', notes: '',
    service_id: s.id, services: { ...s },
    profiles: { id: `g-${i % 7}`, name: GUESTS[i % GUESTS.length], email: `guest${i}@example.com`, phone: '+910000000000', profile_image: '' },
    ...extra,
  };
};

// Today: two done, one on now, two still to come — relative to the clock, so the
// schedule cards always show every state.
const minsFromNow = (m) => new Date(Date.now() + m * 60_000).toISOString();
const today = (i, mins, svc, extra = {}) => booking(i, 0, svc, { scheduled_at: minsFromNow(mins), status: mins < 0 ? 'completed' : 'confirmed', ...extra });

const BOOKINGS = [
  booking(1, 5, 0), booking(2, 0, 1, { status: 'pending' }),
  today(20, -300, 1), today(21, -150, 0), today(22, -15, 2), today(23, 90, 0, { payment_status: 'unpaid' }), today(24, 210, 1),
  booking(3, -4, 2), booking(4, -7, 1), booking(5, -10, 0), booking(6, -11, 2),
  booking(7, -15, 0), booking(8, -18, 1), booking(9, -26, 0), booking(10, -33, 1),
  booking(11, -38, 0), booking(12, -41, 1), booking(13, -43, 3),
];

const ME = {
  id: 'host-preview', _id: 'host-preview', name: 'Riya Kapoor', email: 'riya@example.com',
  username: 'riyakapoor', role: 'vendor', is_host: true, is_verified: true,
  plan: 'starter', profession: 'Growth coach', tagline: 'Growth sprints for small teams',
  bio: 'I help small teams find the one funnel fix that matters.', location: 'Pune',
  profile_image: '/about/mascot-blue.png', cover_image: '', theme_color: '#960D32',
  google_calendar_connected: true, calendar_skipped: false, password_set: false,
  social_links: {}, badges: [], safety_keys: [], fee_only_mode: false,
};

const OVERVIEW = (pro) => ({
  asOf: new Date().toISOString(), freshness: 'live', range: 'all', locked: !pro,
  headline: { netRevenue: 11865.5, paidBookings: 13, profileViews: pro ? 465 : null, viewToBook: pro ? 2.8 : null },
  commissionLeak: {
    commissionPaid: 624.5, proCost: 999, stillToBreakEven: 374.5, aheadBy: 0,
    projectedYear: 5323.62, window: 'trailing_12_months', basis: 'Projected from 43 days of bookings.',
  },
  forecast: pro
    ? { confirmedUnpaid: { value: 1499, bookings: 1 }, projectedMonth: 6400, basis: 'From your last 43 days.' }
    : { locked: true },
  winBack: pro
    ? { staleDays: 30, atStake: 4497, guests: [
      { key: 'g1', name: 'Rohan Das', daysSince: 38, bookings: 2, lifetime: 2498 },
      { key: 'g2', name: 'Ishita Menon', daysSince: 41, bookings: 1, lifetime: 1999 },
    ] }
    : { locked: true },
  benchmarks: pro ? { unavailable: 'Needs more hosts in your category.' } : { locked: true },
  moves: pro ? { unavailable: 'Arrives with weekly digests.' } : { locked: true },
});

const MONEY = {
  asOf: new Date().toISOString(), freshness: 'live', range: 'all', locked: false,
  summary: { bookings: 13, gross: 12490, net: 11865.5, aov: 960.77, netAov: 912.73, commission: 624.5, commissionGst: 0, platformFee: 0, platformFeeGst: 0, razorpayFee: 0, refunded: 0, tds: 0, tcs: 0, derivedLeads: false, derivedRows: 0, derivedValue: 0 },
  settlement: { settled: 10441.45, pending: 1424.05 },
  upcoming: { bookings: 1, value: 1499 },
  byMonth: [
    { month: '2026-09', bookings: 2, gross: 1998, net: 1898 },
    { month: '2026-10', bookings: 5, gross: 5995, net: 5695.25 },
    { month: '2026-11', bookings: 6, gross: 4497, net: 4272.25 },
  ],
  byService: [
    { label: 'Funnel Teardown', bookings: 5, gross: 7495, net: 7120.25 },
    { label: 'Growth Sprint Workshop', bookings: 5, gross: 4995, net: 4745.25 },
    { label: 'SEO Consultation', bookings: 2, gross: 0, net: 0 },
  ],
  concentration: { guests: 7, share: 60, topN: 3 },
  withholding: {
    fy: 2026, fyLabel: 'FY 2026-27 to date', tds: 0, tcs: 0, total: 0,
    bookingsMeasured: 13, bookingsUnknown: 0, unknownGross: 0, unknownLeads: false,
    disclosure: { caveat: 'Payment advice, not a tax invoice or a statutory statement.' },
  },
};

const AUDIENCE = (pro) => (pro
  ? { newGuests: 5, returningGuests: 2, repeatRate: 0.29, funnel: { bookings: 13, paidBookings: 10, paidPct: 0.77 },
    topGuests: [{ name: 'Aarav Shah', lifetime: 2998, bookings: 2 }, { name: 'Meera Iyer', lifetime: 2498, bookings: 2 }, { name: 'Kabir Rao', lifetime: 1499, bookings: 1 }] }
  : { locked: true });

const DEMAND = (pro) => (pro
  ? { retention: { repeatGuestPct: 0.29, avgBookingsPerGuest: 1.9 }, leadTimeDays: 4,
    byWeekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => ({ day: d, bookings: [2, 3, 1, 4, 2, 1, 0][i] })),
    byHour: [9, 10, 11, 12, 14, 15, 16, 17].map((h, i) => ({ hour: `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`, bookings: [1, 3, 2, 1, 2, 3, 1, 0][i] })) }
  : { locked: true });

// Keyed by path relative to the API base, without the query string.
export const buildFixtures = ({ pro = false } = {}) => ({
  '/auth/me': { ...ME, plan: pro ? 'premium' : 'starter' },
  '/feature-flags': {
    dashboard_v2: true, dashboard_sections_v2: true, console_v2: true, payouts: true, earnings: true,
    transactions: true, services: true, coupons: true, digital_products: true, community: true,
    community_v2: true, community_memberships: true, availability_editor: true, google_calendar: true,
  },
  '/notifications': { notifications: [
    { id: 'n1', type: 'booking_new', title: 'New booking', body: 'Aarav Shah booked Funnel Teardown', link: '/dashboard/bookings', created_at: at(-1), read_at: null, data: {} },
  ], unreadCount: 1 },
  '/notifications/channel': {},
  '/kyc/me': { status: 'not_started', pending_earnings: 1424.05, payouts_ready: false },
  '/host/services': SERVICES,
  '/vendor/payout/balance': { available: 0, clearing: 0, pendingCompletion: 1424.05, inflight: 0, paidOut: 10441.45, lifetimeEarned: 11865.5, heldForKyc: 0, payoutsBlocked: true },
  '/bookings/host': BOOKINGS,
  '/host/profile-views': { views: 465 },
  '/host/availability': { host_id: 'host-preview', timezone: 'Asia/Kolkata', weekly: { mon: [['10:00', '18:00']], tue: [['10:00', '18:00']], wed: [['10:00', '18:00']] } },
  '/support/unread': { unread: 0 },
  '/onboarding/status': { slug: 'riyakapoor', stepCompleted: 6, isComplete: true, name: 'Riya Kapoor', profileImage: '', primaryCategory: 'business-coach', calendarConnected: true, calendarSkipped: false },
  '/vendor/intelligence/overview': OVERVIEW(pro),
  '/vendor/intelligence/money': MONEY,
  '/vendor/intelligence/audience': AUDIENCE(pro),
  '/vendor/intelligence/demand': DEMAND(pro),
});
