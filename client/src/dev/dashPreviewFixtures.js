// Sample data for the dev-only dashboard preview (see ./dashPreview.js).
// Shapes mirror the real API responses (captured 2026-11-25); every person and
// figure here is made up. No real guest data belongs in this file.
import { catalogFixtures } from './dashPreviewCatalog';
import { buildCrmFixtures } from './dashPreviewCrm';
import { buildMoneyFixtures } from './dashPreviewMoney';
import { catalogUpgradeFixtures } from './dashPreviewCatalog2';
import { profileFixtures } from './dashPreviewProfile';

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

// Insights › Demand: "Where bookings came from" needs 2+ sources to show.
for (const i of [9, 12, 15]) if (BOOKINGS[i]) BOOKINGS[i].source = 'manual_cash';

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
    // Real shape: 24 rows, hour 0–23 (IST), when the booking was made.
    byHour: Array.from({ length: 24 }, (_, hour) => ({ hour, bookings: { 9: 1, 10: 3, 11: 2, 12: 1, 14: 2, 15: 3, 16: 1, 20: 1 }[hour] || 0 })) }
  : { locked: true });

// ?dash_state=empty — a brand-new host: no bookings, nothing paid.
const EMPTY = (pro) => ({
  '/bookings/host': [],
  '/vendor/intelligence/overview': {
    ...OVERVIEW(pro), headline: { netRevenue: 0, paidBookings: 0, profileViews: null, viewToBook: null },
    commissionLeak: { commissionPaid: 0, proCost: 999, stillToBreakEven: 999, aheadBy: 0, projectedYear: null, window: 'trailing_12_months', basis: 'Not enough history yet to project a year.' },
    ...(pro ? { forecast: { confirmedUnpaid: { value: 0, bookings: 0 }, projectedMonth: null, basis: 'Fewer than 5 paid bookings in the window — too little to project from.' }, winBack: { staleDays: 60, atStake: 0, guests: [] } } : {}),
  },
  '/vendor/intelligence/money': {
    ...MONEY, summary: { ...MONEY.summary, bookings: 0, gross: 0, net: 0, aov: 0, netAov: 0, commission: 0 },
    settlement: { settled: 0, pending: 0 }, upcoming: { bookings: 0, value: 0 }, byMonth: [], byService: [], concentration: { guests: 0, share: null, topN: 0 },
    withholding: { ...MONEY.withholding, bookingsMeasured: 0 },
  },
  '/vendor/intelligence/audience': pro ? { newGuests: 0, returningGuests: 0, repeatRate: 0, topGuests: [], funnel: { bookings: 0, paidBookings: 0, paidPct: 0 } } : { locked: true },
  '/vendor/intelligence/demand': pro ? { retention: { repeatGuestPct: 0, avgBookingsPerGuest: 0 }, byWeekday: DEMAND(true).byWeekday.map((d) => ({ ...d, bookings: 0 })), byHour: DEMAND(true).byHour.map((h) => ({ ...h, bookings: 0 })) } : { locked: true },
});
export const buildEmptyFixtures = ({ pro = false } = {}) => EMPTY(pro);

// Grow (Kept) — testimonials, guest reviews, referrals and community activity.
// localStorage `dash_preview_grow` switches the case for screenshots:
//   'empty' = a brand-new host (nothing yet) · 'worst' = long names, long text ·
//   'error' = every Grow read fails. Unset = a typical host.
const growCase = () => { try { return localStorage.getItem('dash_preview_grow') || ''; } catch { return ''; } };
const LONG = 'Kavyalakshmi Venkataraghavan-Subramaniam';
const GROW = (c) => {
  if (c === 'error') {
    const fail = new Error('preview: simulated failure');
    return { '/host/testimonials': fail, '/reviews/received': fail, '/referrals/mine': fail,
      '/community/users/host-preview/activity': fail, '/community/mentions': fail, '/community/spaces': fail, '/community/feed': fail };
  }
  const empty = c === 'empty';
  const worst = c === 'worst';
  const q = (i, quote, name, role) => ({ id: `t${i}`, quote: worst ? `${quote} `.repeat(6).trim() : quote, author_name: worst ? LONG : name, author_role: worst ? 'Founder and chief everything officer, a very long company name' : role, author_image_url: null });
  const rv = (i, rating, comment, name, svc, days) => ({ id: `r${i}`, rating, comment: worst ? `${comment} `.repeat(5).trim() : comment, created_at: at(-days), direction: 'guest_to_host',
    profiles: { name: worst ? LONG : name, profile_image: '' }, bookings: { services: { title: worst ? 'Growth Sprint Workshop for founders who are stuck at the same plateau' : svc } } });
  const reviews = empty ? [] : [
    rv(1, 5, 'Riya found the leak in our signup flow in twenty minutes. Worth every rupee.', 'Aarav Shah', 'Funnel Teardown', 3),
    rv(2, 5, 'Calm, sharp and practical. We shipped two fixes the same week.', 'Meera Iyer', 'Growth Sprint Workshop', 9),
    rv(3, 4, 'Good session. I wanted a bit more time on pricing.', 'Kabir Rao', 'Funnel Teardown', 21),
  ];
  const post = (i, title, body, likes, comments, days) => ({ id: `p${i}`, title: worst ? `${title} — and a much longer title that keeps going past one line` : title, body, like_count: likes, comment_count: comments, created_at: at(-days), url: `/community/p/post-${i}`, space: { key: 'growth', name: 'Growth' } });
  return {
    '/host/testimonials': empty ? [] : [
      q(1, 'The clearest hour I have spent on our product all year.', 'Divya Pillai', 'Product designer'),
      q(2, 'Riya made our onboarding feel obvious.', 'Sameer Khan', 'Founder, Tapri'),
    ],
    '/reviews/received': { reviews, count: reviews.length, avg: reviews.length ? Math.round((reviews.reduce((n, r) => n + r.rating, 0) / reviews.length) * 10) / 10 : 0 },
    '/referrals/mine': {
      username: 'riyakapoor',
      stats: empty ? { total: 0, earned: 0, pendingValue: 0 } : { total: 3, earned: 1000, pendingValue: 500 },
      referrals: empty ? [] : [
        { id: 'rf1', status: 'rewarded', referred_plan: 'premium', cadence: 'monthly', reward_type: 'cash', reward_value: 500, created_at: at(-40) },
        { id: 'rf2', status: 'rewarded', referred_plan: 'premium', cadence: 'annual', reward_type: 'cash', reward_value: 500, created_at: at(-25) },
        { id: 'rf3', status: 'qualified', referred_plan: 'premium', cadence: 'monthly', reward_type: 'cash', reward_value: 500, created_at: at(-6) },
        { id: 'rf4', status: 'pending', referred_plan: null, cadence: null, reward_type: 'cash', reward_value: 0, created_at: at(-2) },
      ],
    },
    '/community/users/host-preview/activity': empty ? { posts: [], comments: [] } : {
      posts: [
        post(1, 'What finally fixed my no-shows', 'A reminder the evening before, and a ₹99 deposit. That was it.', 14, 6, 2),
        post(2, 'Pricing a first workshop', 'I priced too low and filled in a day. Here is what I changed.', 9, 3, 12),
      ],
      comments: [
        { id: 'c1', body: 'Same here. The deposit changed everything.', like_count: 2, created_at: at(-1), parent: { title: 'Do deposits scare guests off?', url: '/community/t/deposits' } },
      ],
    },
    '/community/mentions': { items: empty ? [] : [
      { id: 'm1', author: { display_name: 'Ishita Menon' }, post: { title: 'Who helped you with your funnel?', url: '/community/t/funnel-help' }, snippet: '@riyakapoor walked me through mine.', created_at: at(-4) },
    ], next_cursor: null },
    '/community/spaces': { spaces: [
      { key: 'growth', name: 'Growth', description: 'Getting found, getting booked.', post_policy: 'everyone' },
      { key: 'money', name: 'Money and pricing', description: 'What to charge and how to get paid.', post_policy: 'hosts' },
      { key: 'news', name: 'Meeticulous news', description: 'Releases and notes from the team.', post_policy: 'official' },
    ] },
    '/community/feed': { items: empty ? [] : [
      { id: 'f1', format: 'question', status: 'visible', locked: false, accepted_comment_id: null, title: 'How do you handle guests who reschedule three times?', body: 'Third reschedule this week from the same guest.', author: { display_name: 'Nikhil Joshi' }, comment_count: 0, created_at: at(-1), url: '/community/t/reschedules', space: { name: 'Growth' } },
      { id: 'f2', format: 'question', status: 'visible', locked: false, accepted_comment_id: null, title: 'Is a free intro call worth it?', body: 'Thinking of adding a 15-minute free call.', author: { display_name: 'Ananya Rao' }, comment_count: 4, created_at: at(-3), url: '/community/t/free-intro', space: { name: 'Money and pricing' } },
    ], next_cursor: null },
  };
};

// Keyed by path relative to the API base, without the query string.
export const buildFixtures = ({ pro = false } = {}) => ({
  '/auth/me': { ...ME, plan: pro ? 'premium' : 'starter' },
  '/feature-flags': {
    dashboard_v2: true, dashboard_sections_v2: true, console_v2: true, payouts: true, earnings: true,
    transactions: true, services: true, coupons: true, digital_products: true, community: true,
    community_v2: true, community_memberships: true, availability_editor: true, google_calendar: true,
    course_purchase: true,
  },
  '/notifications': { notifications: [
    { id: 'n1', type: 'booking_new', title: 'New booking', body: 'Aarav Shah booked Funnel Teardown', link: '/dashboard/bookings', created_at: at(0, 9, 12), read_at: null, data: {} },
    { id: 'n2', type: 'payment', title: 'Payment received', body: '₹1,499 from Meera Iyer for Funnel Teardown', link: '/dashboard/earnings', created_at: at(-1, 18, 40), read_at: null, data: {} },
    { id: 'n3', type: 'booking_rescheduled', title: 'Booking moved', body: 'Kabir Rao moved Growth Sprint Workshop to Friday, 4:00pm', link: '/dashboard/bookings', created_at: at(-1, 10, 5), read_at: at(-1, 12), data: {} },
    { id: 'n4', type: 'payout', title: 'Payout sent', body: '₹2,840 is on its way to your bank', link: '/dashboard/payments/payouts', created_at: at(-4, 9, 0), read_at: at(-4, 10), data: {} },
  ], unreadCount: 2 },
  '/notifications/channel': {},
  '/kyc/me': { status: 'not_started', pending_earnings: 1424.05, payouts_ready: false },
  '/host/services': SERVICES,
  '/vendor/payout/balance': { available: 0, clearing: 0, pendingCompletion: 1424.05, inflight: 0, paidOut: 10441.45, lifetimeEarned: 11865.5, heldForKyc: 0, payoutsBlocked: true },
  '/bookings/host': BOOKINGS,
  '/host/profile-views': { views: 465 },
  '/plans': [
    { slug: 'starter', name: 'Starter', monthly_price: 0, annual_price: 0, sort_order: 1, commission_percentage: 5,
      limits: { services: -1, bookings_per_year: -1, digital_products: 3 }, support_type: 'email' },
    { slug: 'premium', name: 'Pro', monthly_price: 999, annual_price: 9990, sort_order: 2, commission_percentage: 0,
      limits: { services: -1, bookings_per_year: -1, digital_products: -1 }, integrations: { calendar_apps: ['google_calendar'] }, support_type: 'priority' },
  ],
  '/host/availability': { host_id: 'host-preview', timezone: 'Asia/Kolkata', weekly: { mon: [['10:00', '18:00']], tue: [['10:00', '18:00']], wed: [['10:00', '18:00']] },
    // The real row's shape (Schedule page reads these): Mon–Fri, a split Friday, Saturday mornings.
    weekly_schedule: {
      monday: [{ start: '10:00', end: '18:00' }], tuesday: [{ start: '10:00', end: '18:00' }],
      wednesday: [{ start: '10:00', end: '18:00' }], thursday: [{ start: '10:00', end: '18:00' }],
      friday: [{ start: '10:00', end: '13:00' }, { start: '15:00', end: '18:00' }],
      saturday: [{ start: '09:00', end: '12:00' }], sunday: [],
    },
    buffer_minutes: 15, blocked_dates: [{ date: '2026-12-02', from: '14:00', to: '16:00', reason: 'Doctor' }, '2026-12-25', { date: '2027-01-01', reason: 'New year' }],
    cap_per_day: pro ? 6 : null, cap_per_week: null, cap_per_guest: null },
  '/support/unread': { unread: 0 },
  // Kept Settings/Help preview (dev-only, made-up): support chat, hours and feedback.
  '/support/thread': { thread: { id: 'th-1', status: 'bot', reference: 'MT-1042' }, messages: [
    { id: 'm1', sender: 'user', body: 'How long does a payout take after a booking?', created_at: at(-2, 11, 2) },
    { id: 'm2', sender: 'bot', sender_name: 'Tithi', body: 'Payouts reach your bank 3 working days after the session, once your PAN and bank are verified. Yours are not verified yet, so the money waits until then.', created_at: at(-2, 11, 3) },
  ] },
  '/support/threads': { threads: [{ id: 'th-1', status: 'bot', reference: 'MT-1042', last_message_at: at(-2, 11, 3) }] },
  '/support/hours': { open: true },
  '/feedback/mine': { feedback: [
    { id: 'fb-1', type: 'idea', subject: 'Let guests pick a time zone', body: 'Some of my clients are in Dubai and get confused by IST slots.', status: 'planned', admin_response: 'Good call. It is on the list for December.', created_at: at(-9) },
  ] },
  '/onboarding/status': { slug: 'riyakapoor', stepCompleted: 6, isComplete: true, name: 'Riya Kapoor', profileImage: '', primaryCategory: 'business-coach', calendarConnected: true, calendarSkipped: false },
  '/vendor/intelligence/overview': OVERVIEW(pro),
  '/vendor/intelligence/money': MONEY,
  '/vendor/intelligence/audience': AUDIENCE(pro),
  '/vendor/intelligence/demand': DEMAND(pro),
  ...buildCrmFixtures(),
  ...GROW(growCase()),
  ...buildMoneyFixtures(),
  // Catalog (kept-catalog): services/products/courses/discounts/memberships.
  // Last on purpose: its '/services' rows are a superset of the CRM picker's.
  ...catalogFixtures(),
  ...catalogUpgradeFixtures(),
  ...profileFixtures(),
});
