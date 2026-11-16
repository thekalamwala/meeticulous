// ─────────────────────────────────────────────────────────────────────────────
// Host Lab — PROTOTYPE fixtures.
//
// This is a design prototype for the redesigned host dashboard. Everything here
// is invented sample data. It is NEVER sent to an API, NEVER written to Supabase
// and NEVER read by a production page. The whole /host-lab route tree is isolated
// from the real /dashboard tree: no auth, no API client, no shared state.
//
// Shapes deliberately mirror the real API payloads (bookings, services,
// crm customers, transactions) so a screen that graduates from the lab can swap
// `mock.*` for the real `getHostBookings()` / `crmGetCustomers()` call without a
// rewrite of the view.
// ─────────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const at = (dayOffset, h, m = 0) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return new Date(d.getTime() + dayOffset * DAY + h * 3_600_000 + m * 60_000).toISOString();
};

export const host = {
  name: 'Ananya Rao',
  username: 'ananyarao',
  profession: 'Nutritionist',
  plan: 'premium',
  kyc_status: 'approved',
  city: 'Pune',
  timezone: 'Asia/Kolkata',
  avatar_initials: 'AR',
  member_since: '2026-03-14',
};

export const services = [
  { id: 's1', title: 'Discovery call', duration: 20, price: 0, active: true, bookings_30d: 31, revenue_30d: 0, conversion: 0.41, kind: 'session', description: 'A short, free intro call to see if we are a fit.' },
  { id: 's2', title: 'Nutrition deep-dive', duration: 60, price: 2400, active: true, bookings_30d: 18, revenue_30d: 43_200, conversion: 0.27, kind: 'session', description: 'Full diet history, bloodwork review and a 4-week plan.' },
  { id: 's3', title: 'Follow-up consult', duration: 30, price: 1200, active: true, bookings_30d: 24, revenue_30d: 28_800, conversion: 0.52, kind: 'session', description: 'Check-in, adjust the plan, answer what came up.' },
  { id: 's4', title: 'Sports nutrition audit', duration: 90, price: 4500, active: true, bookings_30d: 6, revenue_30d: 27_000, conversion: 0.19, kind: 'session', description: 'For athletes in training blocks. Includes a fuelling calendar.' },
  { id: 's5', title: 'Corporate wellness talk', duration: 45, price: 0, active: false, bookings_30d: 0, revenue_30d: 0, conversion: 0, kind: 'session', price_on_request: true, description: 'On-site or remote session for teams. Priced per audience size.' },
];

export const products = [
  { id: 'p1', title: '7-day reset meal plan (PDF)', price: 499, sales_30d: 42, revenue_30d: 20_958, kind: 'download', active: true },
  { id: 'p2', title: 'Grocery swap cheat sheet', price: 199, sales_30d: 67, revenue_30d: 13_333, kind: 'download', active: true },
  { id: 'p3', title: 'Macro calculator template', price: 0, sales_30d: 180, revenue_30d: 0, kind: 'download', active: true },
];

export const courses = [
  { id: 'c1', title: 'Eat for your cycle — 6 weeks', price: 6999, enrolled: 23, revenue_30d: 48_993, lessons: 18, active: true },
];

export const offers = [
  { id: 'o1', code: 'FIRST20', discount_type: 'percent', discount_value: 20, times_redeemed: 38, max_redemptions: 100, expires_at: at(42, 0), active: true },
  { id: 'o2', code: 'DIWALI500', discount_type: 'flat', discount_value: 500, times_redeemed: 100, max_redemptions: 100, expires_at: at(-9, 0), active: true },
  { id: 'o3', code: 'TEAM10', discount_type: 'percent', discount_value: 10, times_redeemed: 4, max_redemptions: null, expires_at: null, active: false },
];

const CLIENT_SEED = [
  ['Meera Iyer', 'meera.iyer@gmail.com', '+91 98200 11234', 9, 21_600, -3, 'repeat'],
  ['Rohan Deshpande', 'rohan.d@outlook.com', '+91 99870 44512', 6, 14_400, -11, 'repeat'],
  ['Kavya Nair', 'kavya.nair@gmail.com', '+91 90045 77810', 4, 9_600, -5, 'repeat'],
  ['Arjun Malhotra', 'arjun.m@zoho.com', '+91 98112 90043', 3, 8_100, -31, 'lapsing'],
  ['Sneha Kulkarni', 'sneha.k@gmail.com', '+91 94220 33190', 2, 3_600, -2, 'new'],
  ['Vikram Shetty', 'vikram.shetty@gmail.com', '+91 98450 61277', 7, 19_800, -44, 'lapsing'],
  ['Priya Menon', 'priya.menon@gmail.com', '+91 97890 12003', 1, 2_400, -1, 'new'],
  ['Aditya Bose', 'aditya.bose@gmail.com', '+91 98300 55471', 5, 12_000, -18, 'repeat'],
  ['Farah Khan', 'farah.khan@gmail.com', '+91 99200 88102', 2, 4_800, -62, 'lapsing'],
  ['Nikhil Jain', 'nikhil.jain@gmail.com', '+91 98250 71466', 12, 31_200, -4, 'vip'],
  ['Tanvi Rege', 'tanvi.rege@gmail.com', '+91 70301 22890', 1, 0, -1, 'new'],
  ['Sameer Qureshi', 'sameer.q@gmail.com', '+91 98190 40027', 3, 7_200, -33, 'lapsing'],
  ['Divya Pillai', 'divya.pillai@gmail.com', '+91 90350 60018', 8, 20_400, -7, 'repeat'],
  ['Harsh Agarwal', 'harsh.a@gmail.com', '+91 98710 30092', 2, 4_800, -14, 'repeat'],
  ['Ishita Sen', 'ishita.sen@gmail.com', '+91 98310 77205', 1, 1_200, -9, 'new'],
];

export const clients = CLIENT_SEED.map(([name, email, phone, count, spent, lastOffset, segment], i) => ({
  id: `cl${i + 1}`,
  name,
  email,
  phone,
  bookings_count: count,
  total_spent: spent,
  last_booking_at: at(lastOffset, 11),
  first_booking_at: at(lastOffset - count * 21, 11),
  segment,
  is_recurring: count >= 3,
  no_shows: name === 'Farah Khan' ? 2 : name === 'Sameer Qureshi' ? 1 : 0,
  notes:
    name === 'Meera Iyer'
      ? [{ id: 'n1', at: at(-3, 12), body: 'Training for the Mumbai half. Wants a race-week fuelling plan next.' }]
      : name === 'Nikhil Jain'
      ? [{ id: 'n2', at: at(-4, 10), body: 'Prefers 7am slots. Lactose intolerant — keep dairy out of plans.' }]
      : [],
  tags: segment === 'vip' ? ['Top spender'] : segment === 'lapsing' ? ['Needs a nudge'] : [],
}));

const BK = [
  // [dayOffset, hour, min, clientIdx, serviceIdx, status, payment]
  [0, 7, 30, 9, 2, 'confirmed', 'paid'],
  [0, 9, 0, 0, 1, 'confirmed', 'paid'],
  [0, 11, 30, 4, 0, 'pending', 'unpaid'],
  [0, 14, 0, 2, 2, 'confirmed', 'paid'],
  [0, 16, 30, 6, 2, 'confirmed', 'unpaid'],
  [1, 8, 0, 12, 2, 'confirmed', 'paid'],
  [1, 10, 0, 1, 3, 'confirmed', 'paid'],
  [1, 15, 0, 10, 0, 'pending', 'unpaid'],
  [2, 9, 30, 7, 1, 'confirmed', 'paid'],
  [2, 12, 0, 13, 2, 'confirmed', 'paid'],
  [3, 7, 30, 9, 2, 'confirmed', 'paid'],
  [3, 11, 0, 3, 1, 'confirmed', 'paid'],
  [4, 10, 30, 14, 1, 'confirmed', 'unpaid'],
  [4, 17, 0, 0, 2, 'confirmed', 'paid'],
  [5, 9, 0, 5, 3, 'confirmed', 'paid'],
  [7, 10, 0, 2, 1, 'confirmed', 'paid'],
  [8, 16, 0, 12, 2, 'confirmed', 'paid'],
  [-1, 9, 0, 0, 2, 'completed', 'paid'],
  [-1, 11, 30, 11, 1, 'completed', 'paid'],
  [-2, 10, 0, 8, 2, 'no_show', 'paid'],
  [-2, 15, 0, 7, 1, 'completed', 'paid'],
  [-3, 7, 30, 9, 2, 'completed', 'paid'],
  [-3, 13, 0, 1, 3, 'completed', 'paid'],
  [-4, 9, 30, 13, 2, 'completed', 'paid'],
  [-5, 11, 0, 2, 1, 'completed', 'paid'],
  [-5, 16, 30, 4, 0, 'cancelled', 'refunded'],
  [-6, 10, 0, 0, 2, 'completed', 'paid'],
  [-8, 9, 0, 3, 1, 'completed', 'paid'],
  [-9, 14, 0, 5, 2, 'completed', 'paid'],
  [-11, 10, 30, 1, 1, 'completed', 'paid'],
  [-12, 9, 0, 12, 2, 'completed', 'paid'],
  [-14, 11, 0, 7, 3, 'completed', 'paid'],
  [-15, 16, 0, 13, 2, 'cancelled', 'refunded'],
  [-18, 9, 30, 8, 1, 'completed', 'paid'],
  [-21, 10, 0, 2, 2, 'completed', 'paid'],
  [-24, 11, 30, 0, 1, 'completed', 'paid'],
  [-27, 9, 0, 3, 2, 'completed', 'paid'],
  [-30, 15, 0, 5, 1, 'completed', 'paid'],
];

export const bookings = BK.map(([d, h, m, ci, si, status, payment], i) => {
  const client = clients[ci];
  const service = services[si];
  return {
    id: `bk${String(i + 1).padStart(3, '0')}`,
    ref: `MT-${4821 + i}`,
    scheduled_at: at(d, h, m),
    created_at: at(d - 4, 10, 15),
    status,
    payment_status: payment,
    guest_name: client.name,
    guest_email: client.email,
    guest_phone: client.phone,
    client_id: client.id,
    services: { id: service.id, title: service.title, duration: service.duration, price: service.price },
    amount: payment === 'refunded' ? 0 : service.price,
    platform_fee: service.price ? Math.round(service.price * 0.05) : 0,
    location: 'Google Meet',
    source: i % 5 === 0 ? 'Instagram bio' : i % 3 === 0 ? 'Direct link' : i % 7 === 0 ? 'Explore' : 'WhatsApp',
    guest_note:
      i === 2 ? 'First time — mostly want to understand how you work before paying.' : i === 4 ? 'Can we talk about PCOS-friendly swaps?' : '',
    host_note: i === 0 ? 'Bring the race-week plan draft.' : '',
    joined_at: status === 'completed' ? at(d, h, m + 2) : null,
  };
});

export const availability = {
  timezone: 'Asia/Kolkata',
  buffer_minutes: 10,
  min_notice_hours: 4,
  booking_window_days: 60,
  weekly_schedule: {
    monday: [{ start: '07:00', end: '12:00' }, { start: '15:00', end: '18:30' }],
    tuesday: [{ start: '07:00', end: '12:00' }, { start: '15:00', end: '18:30' }],
    wednesday: [{ start: '09:00', end: '13:00' }],
    thursday: [{ start: '07:00', end: '12:00' }, { start: '15:00', end: '18:30' }],
    friday: [{ start: '07:00', end: '12:00' }],
    saturday: [{ start: '08:00', end: '11:00' }],
    sunday: [],
  },
  date_overrides: [
    { date: at(6, 0).slice(0, 10), slots: [{ start: '10:00', end: '13:00' }], label: 'Half day — clinic visit' },
    { date: at(19, 0).slice(0, 10), slots: [], label: 'Travelling' },
  ],
  blocked_dates: [at(12, 0).slice(0, 10), at(13, 0).slice(0, 10)],
  caps: { per_day: 6, per_week: 24, per_guest: 2 },
  calendars: [
    { id: 'gcal', name: 'Google Calendar', account: 'ananya@gmail.com', status: 'connected', mode: 'two-way' },
    { id: 'ical', name: 'Apple Calendar', account: null, status: 'available', mode: null },
  ],
};

export const payouts = {
  available: 38_400,
  clearing: 12_600,
  pending_completion: 7_200,
  next_payout_on: at(2, 11),
  bank: { label: 'HDFC Bank ••4471', verified: true },
  history: [
    { id: 'po1', amount: 44_280, status: 'processed', requested_at: at(-9, 11), settled_at: at(-7, 14), utr: 'HDFCN2298104' },
    { id: 'po2', amount: 31_560, status: 'processed', requested_at: at(-23, 11), settled_at: at(-21, 15), utr: 'HDFCN2271553' },
    { id: 'po3', amount: 18_900, status: 'in_transit', requested_at: at(-1, 17), settled_at: null, utr: null },
  ],
};

export const invoices = [
  { id: 'iv1', invoice_number: 'MT-SUB-00318', source_type: 'subscription', total: 1178.82, issued_at: at(-12, 9) },
  { id: 'iv2', invoice_number: 'MT-BKG-02241', source_type: 'booking', total: 2832, issued_at: at(-18, 16) },
  { id: 'iv3', invoice_number: 'MT-SUB-00281', source_type: 'subscription', total: 1178.82, issued_at: at(-42, 9) },
];

// 12 months of revenue, oldest first. Shaped like a business that is growing.
export const revenueByMonth = [
  { month: 'Dec', revenue: 18_400, bookings: 11 },
  { month: 'Jan', revenue: 26_800, bookings: 16 },
  { month: 'Feb', revenue: 24_200, bookings: 15 },
  { month: 'Mar', revenue: 35_600, bookings: 22 },
  { month: 'Apr', revenue: 41_100, bookings: 25 },
  { month: 'May', revenue: 38_900, bookings: 24 },
  { month: 'Jun', revenue: 52_300, bookings: 31 },
  { month: 'Jul', revenue: 48_700, bookings: 29 },
  { month: 'Aug', revenue: 61_200, bookings: 36 },
  { month: 'Sep', revenue: 71_800, bookings: 42 },
  { month: 'Oct', revenue: 68_400, bookings: 40 },
  { month: 'Nov', revenue: 84_950, bookings: 48 },
];

export const funnel = {
  views: 1_842,
  started: 496,
  completed: 203,
  paid: 181,
  views_prev: 1_510,
  completed_prev: 164,
};

export const trafficSources = [
  { label: 'Instagram bio', views: 812, bookings: 71 },
  { label: 'WhatsApp share', views: 433, bookings: 58 },
  { label: 'Meeticulous Explore', views: 311, bookings: 29 },
  { label: 'Direct / typed', views: 186, bookings: 34 },
  { label: 'Google', views: 100, bookings: 11 },
];

export const reviews = [
  { id: 'r1', author: 'Meera Iyer', rating: 5, body: 'Ananya actually read my bloodwork before the call. The plan was specific, not generic.', at: at(-3, 18), service: 'Follow-up consult', replied: true },
  { id: 'r2', author: 'Aditya Bose', rating: 5, body: 'Two months in and my energy through afternoons is completely different.', at: at(-11, 20), service: 'Nutrition deep-dive', replied: false },
  { id: 'r3', author: 'Kavya Nair', rating: 4, body: 'Great session. Would have liked a written summary sooner.', at: at(-19, 9), service: 'Follow-up consult', replied: false },
];

export const testimonials = [
  { id: 't1', quote: 'The only plan I have ever actually stuck to.', author_name: 'Divya P.', author_role: 'Product designer' },
  { id: 't2', quote: 'She fixed in six weeks what three years of guessing could not.', author_name: 'Nikhil J.', author_role: 'Marathoner' },
];

export const referrals = {
  link: 'meeticulous.com/invite/ananyarao',
  invited: 7,
  joined: 3,
  earned: 1_500,
  pending: 500,
};

// What the host must act on. The Today page is built from this, not from a
// generic widget grid — each item names the thing and the one action that clears it.
export const actionQueue = [
  { id: 'a1', kind: 'confirm', urgency: 'now', title: '2 bookings waiting on your confirmation', detail: 'Sneha Kulkarni (today 11:30) and Tanvi Rege (tomorrow 15:00)', cta: 'Review requests', target: 'bookings' },
  { id: 'a2', kind: 'unpaid', urgency: 'today', title: '2 confirmed bookings are unpaid', detail: 'Priya Menon owes ₹1,200 and Ishita Sen owes ₹2,400.', cta: 'See unpaid', target: 'bookings' },
  { id: 'a3', kind: 'lapsing', urgency: 'this_week', title: '4 regulars have not booked in 30+ days', detail: 'Vikram, Farah, Sameer and Arjun used to come monthly.', cta: 'Open the list', target: 'clients' },
  { id: 'a4', kind: 'review', urgency: 'this_week', title: '2 reviews have no reply', detail: 'Replying publicly lifts booking-page conversion.', cta: 'Reply now', target: 'grow' },
  { id: 'a5', kind: 'gap', urgency: 'this_week', title: 'Friday afternoon is empty every week', detail: 'You close Fridays at 12. Your busiest requested slot is Fri 16:00.', cta: 'Open hours', target: 'schedule' },
];

export const activity = [
  { id: 'ac1', at: at(0, 8, 12), text: 'Nikhil Jain booked Follow-up consult for Thu 07:30', kind: 'booking' },
  { id: 'ac2', at: at(0, 7, 55), text: '₹1,200 captured from Meera Iyer', kind: 'money' },
  { id: 'ac3', at: at(-1, 19, 40), text: 'Aditya Bose left a 5★ review', kind: 'review' },
  { id: 'ac4', at: at(-1, 16, 2), text: 'Payout of ₹18,900 sent to HDFC ••4471', kind: 'money' },
  { id: 'ac5', at: at(-1, 11, 18), text: '7-day reset meal plan sold ×3', kind: 'product' },
  { id: 'ac6', at: at(-2, 10, 5), text: 'Farah Khan did not show up for Nutrition deep-dive', kind: 'alert' },
];

export default {
  host, services, products, courses, offers, clients, bookings, availability,
  payouts, invoices, revenueByMonth, funnel, trafficSources, reviews,
  testimonials, referrals, actionQueue, activity,
};
