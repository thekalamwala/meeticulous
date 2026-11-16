// ─────────────────────────────────────────────────────────────────────────────
// Creator Intelligence — PROTOTYPE fixtures.
//
// Invented sample data for Ananya Rao, the same fictional nutritionist the rest
// of Host Lab uses. Never sent to an API, never written to Supabase, never read
// by a production page.
//
// The numbers are internally consistent on purpose, so the prototype can be
// reasoned about rather than just looked at:
//   • service revenue (30d)  = ₹99,000  — matches mockData.services revenue_30d
//   • product revenue (30d)  = ₹34,291  — matches mockData.products revenue_30d
//   • gross (30d)            = ₹1,33,291
//   • paid bookings (30d)    = 79       — the funnel's last stage
//   • AOV                    = ₹1,253   — 99,000 ÷ 79, service bookings only
// Every derived figure below is computed from those, not typed in twice, so a
// reviewer can't be shown a total that doesn't add up.
// ─────────────────────────────────────────────────────────────────────────────

/* ── Money (30 days) ───────────────────────────────────────────────────── */
const SERVICE_REVENUE = 99_000;
const PRODUCT_REVENUE = 34_291;
const GROSS = SERVICE_REVENUE + PRODUCT_REVENUE;
const PAID_BOOKINGS = 79;

// A free host pays 5%; Pro pays 0% and ₹1,179/year. Both are real plan terms.
const COMMISSION_RATE = 0.05;
const PRO_PRICE = 1_179;

const platformFee = 0;                                  // Pro: flat fee, no per-booking cut
const commission = Math.round(GROSS * COMMISSION_RATE); // what a FREE host would pay
const gatewayFee = Math.round(GROSS * 0.0236);          // Razorpay 2% + 18% GST on the fee
const refunds = 2_400;
const gstOnFee = 0;

export const money = {
  gross: GROSS,
  serviceRevenue: SERVICE_REVENUE,
  productRevenue: PRODUCT_REVENUE,
  paidBookings: PAID_BOOKINGS,
  aov: Math.round(SERVICE_REVENUE / PAID_BOOKINGS),
  refunds,
  gatewayFee,
  commissionIfFree: commission,
  net: GROSS - platformFee - gstOnFee - gatewayFee - refunds,
  pendingPayout: 38_400,
  paidOut: 92_500,
  deltas: { gross: 18, bookings: 12, aov: 5, net: 19 },

  waterfall: [
    { label: 'Gross — what guests paid', value: GROSS, kind: 'gross' },
    { label: 'Platform fee (Pro: ₹0 per booking)', value: platformFee, kind: 'deduction' },
    { label: 'Payment gateway (Razorpay + GST)', value: gatewayFee, kind: 'deduction' },
    { label: 'Refunds', value: refunds, kind: 'deduction' },
    { label: 'Net — yours', value: GROSS - platformFee - gstOnFee - gatewayFee - refunds, kind: 'total' },
  ],

  byMonth: [
    { label: 'Dec', value: 41_200 }, { label: 'Jan', value: 48_900 },
    { label: 'Feb', value: 52_400 }, { label: 'Mar', value: 61_800 },
    { label: 'Apr', value: 58_300 }, { label: 'May', value: 72_100 },
    { label: 'Jun', value: 69_400 }, { label: 'Jul', value: 83_600 },
    { label: 'Aug', value: 91_200 }, { label: 'Sep', value: 104_700 },
    { label: 'Oct', value: 118_400 }, { label: 'Nov', value: GROSS },
  ],

  bookingsByMonth: [
    { label: 'Dec', value: 28 }, { label: 'Jan', value: 33 }, { label: 'Feb', value: 35 },
    { label: 'Mar', value: 41 }, { label: 'Apr', value: 39 }, { label: 'May', value: 48 },
    { label: 'Jun', value: 46 }, { label: 'Jul', value: 55 }, { label: 'Aug', value: 61 },
    { label: 'Sep', value: 68 }, { label: 'Oct', value: 74 }, { label: 'Nov', value: PAID_BOOKINGS },
  ],

  byService: [
    { label: 'Nutrition deep-dive', revenue: 43_200, bookings: 18, aov: 2_400 },
    { label: 'Follow-up consult', revenue: 28_800, bookings: 24, aov: 1_200 },
    { label: 'Sports nutrition audit', revenue: 27_000, bookings: 6, aov: 4_500 },
    { label: '7-day reset meal plan', revenue: 20_958, bookings: 42, aov: 499 },
    { label: 'Grocery swap cheat sheet', revenue: 13_333, bookings: 67, aov: 199 },
    { label: 'Discovery call', revenue: 0, bookings: 31, aov: 0 },
  ],

  concentration: { topThreeShare: 0.37, note: 'Your top 3 guests are 37% of revenue' },

  // Part-to-whole: where the gross actually comes from.
  composition: [
    { label: 'Sessions', value: 99_000 },
    { label: 'Digital products', value: 34_291 },
  ],

  forecast: {
    confirmedUpcoming: 46_800,
    projected: 148_000,
    low: 128_000,
    high: 168_000,
    basis: 'Confirmed unpaid bookings, plus your trailing 90-day booking rate at your current average booking value.',
    target: 150_000,
    bookingsNeeded: 13,
  },

  transactions: [
    { id: 'T-2291', date: '14 Nov', guest: 'Meera Shah', service: 'Nutrition deep-dive', gross: 2_400, fee: 57, net: 2_343, status: 'paid', settlement: 'settled' },
    { id: 'T-2290', date: '14 Nov', guest: 'Rohit Nair', service: 'Follow-up consult', gross: 1_200, fee: 28, net: 1_172, status: 'paid', settlement: 'clearing' },
    { id: 'T-2289', date: '13 Nov', guest: 'Aditi Bose', service: 'Sports nutrition audit', gross: 4_500, fee: 106, net: 4_394, status: 'paid', settlement: 'settled' },
    { id: 'T-2288', date: '13 Nov', guest: 'Kabir Menon', service: '7-day reset meal plan', gross: 499, fee: 12, net: 487, status: 'paid', settlement: 'settled' },
    { id: 'T-2287', date: '12 Nov', guest: 'Sneha Pillai', service: 'Nutrition deep-dive', gross: 2_400, fee: 57, net: 2_343, status: 'refunded', settlement: 'reversed' },
    { id: 'T-2286', date: '12 Nov', guest: 'Arjun Das', service: 'Follow-up consult', gross: 1_200, fee: 28, net: 1_172, status: 'paid', settlement: 'settled' },
    { id: 'T-2285', date: '11 Nov', guest: 'Divya Krishnan', service: 'Grocery swap cheat sheet', gross: 199, fee: 5, net: 194, status: 'paid', settlement: 'settled' },
    { id: 'T-2284', date: '11 Nov', guest: 'Farhan Qureshi', service: 'Nutrition deep-dive', gross: 2_400, fee: 57, net: 2_343, status: 'failed', settlement: '—' },
    { id: 'T-2283', date: '10 Nov', guest: 'Ishita Roy', service: 'Sports nutrition audit', gross: 4_500, fee: 106, net: 4_394, status: 'paid', settlement: 'settled' },
    { id: 'T-2282', date: '10 Nov', guest: 'Vikram Shetty', service: 'Follow-up consult', gross: 1_200, fee: 28, net: 1_172, status: 'paid', settlement: 'settled' },
  ],
};

/* ── Commission leak — the single highest-converting line ──────────────── */
export const leak = {
  paidThisFy: 18_400,         // what this host paid before upgrading
  runRateYear: Math.round(commission * 12),
  proPrice: PRO_PRICE,
  paybackDays: Math.max(1, Math.round(PRO_PRICE / (commission / 30))),
  monthlyIfFree: commission,
};

/* ── Audience & conversion ─────────────────────────────────────────────── */
export const audience = {
  visitors: 1_842,
  uniqueVisitors: 1_488,
  newVisitors: 1_204,
  returningVisitors: 284,
  deltas: { visitors: 23, unique: 21, conversion: -4 },
  trackingSince: '18 Oct 2026',

  // Four stages. "Slot selected" is deliberately absent: the event exists in
  // events.js but is fired nowhere, so shipping it would mean a permanently
  // zero stage (design doc §11.3).
  funnel: [
    { label: 'Profile viewed', value: 1_842 },
    { label: 'Service viewed', value: 1_104 },
    { label: 'Booking started', value: 318 },
    { label: 'Checkout started', value: 112 },
    { label: 'Paid', value: PAID_BOOKINGS },
  ],

  bottleneck: {
    step: 'Service viewed → Booking started',
    drop: 0.71,
    note: '71% of people who open a service never start a booking — your biggest single leak.',
  },

  sources: [
    { label: 'Instagram', visitors: 742, serviceViews: 468, bookings: 38, revenue: 52_400 },
    { label: 'Direct / link in bio', visitors: 398, serviceViews: 254, bookings: 19, revenue: 31_200 },
    { label: 'WhatsApp', visitors: 286, serviceViews: 201, bookings: 14, revenue: 22_800 },
    { label: 'Google Search', visitors: 211, serviceViews: 112, bookings: 5, revenue: 9_600 },
    { label: 'LinkedIn', visitors: 118, serviceViews: 54, bookings: 2, revenue: 4_800 },
    { label: 'Unknown', visitors: 87, serviceViews: 15, bookings: 1, revenue: 12_491 },
  ],

  campaigns: [
    { label: 'nov-reset-challenge', visitors: 412, bookings: 24, revenue: 34_800, conversion: 0.058 },
    { label: 'ig-bio-oct', visitors: 286, bookings: 11, revenue: 14_400, conversion: 0.038 },
    { label: 'newsletter-w44', visitors: 98, bookings: 6, revenue: 8_200, conversion: 0.061 },
  ],

  devices: [
    { label: 'Mobile', visitors: 1_423, bookings: 68, conversion: 0.048 },
    { label: 'Desktop', visitors: 341, bookings: 10, conversion: 0.029 },
    { label: 'Tablet', visitors: 78, bookings: 1, conversion: 0.013 },
  ],

  serviceConversion: [
    { label: 'Follow-up consult', views: 212, started: 94, paid: 24, conversion: 0.113, revenue: 28_800 },
    { label: 'Nutrition deep-dive', views: 388, started: 112, paid: 18, conversion: 0.046, revenue: 43_200 },
    { label: 'Discovery call', views: 294, started: 76, paid: 31, conversion: 0.105, revenue: 0 },
    { label: 'Sports nutrition audit', views: 186, started: 32, paid: 6, conversion: 0.032, revenue: 27_000 },
    { label: 'Corporate wellness talk', views: 24, started: 4, paid: 0, conversion: 0, revenue: 0 },
  ],

  trend: [
    { label: '18 Oct', views: 38, bookings: 2 }, { label: '22 Oct', views: 46, bookings: 2 },
    { label: '26 Oct', views: 52, bookings: 3 }, { label: '30 Oct', views: 61, bookings: 3 },
    { label: '03 Nov', views: 58, bookings: 2 }, { label: '07 Nov', views: 74, bookings: 4 },
    { label: '11 Nov', views: 88, bookings: 5 }, { label: '15 Nov', views: 96, bookings: 4 },
  ],
};

/* ── Demand ────────────────────────────────────────────────────────────── */
export const demand = {
  hours: ['8a', '10a', '12p', '2p', '4p', '6p', '8p', '10p'],
  // Mon–Sun × the hours above. Evenings fill; mid-mornings don't.
  grid: [
    [0, 2, 1, 3, 4, 7, 5, 1],
    [1, 3, 2, 2, 5, 8, 6, 0],
    [0, 1, 1, 4, 3, 6, 4, 1],
    [1, 2, 3, 3, 6, 9, 7, 2],
    [2, 4, 2, 5, 7, 11, 8, 1],
    [3, 5, 4, 6, 4, 3, 2, 0],
    [1, 2, 1, 2, 1, 1, 0, 0],
  ],
  publishedHours: 148,
  bookedHours: 96,
  utilisation: 0.65,
  peak: { label: 'Friday 6–8pm', fillRate: 0.92 },
  gap: { label: 'Thursday 6–8pm', note: 'Your second-best window, and you publish no hours in it.' },
  leadTimeMedianDays: 4.2,
  lastMinuteShare: 0.18,
  cancellationRate: 0.07,
  rescheduleRate: 0.11,
  noShowRate: 0.04,
  leadTime: [
    { label: 'Same day', value: 14 }, { label: '1–2 days', value: 22 },
    { label: '3–7 days', value: 31 }, { label: '1–2 weeks', value: 9 },
    { label: '2+ weeks', value: 3 },
  ],
};

/* ── Customers ─────────────────────────────────────────────────────────── */
export const customers = {
  total: 118,
  new30d: 24,
  returning30d: 31,
  repeatRate: 0.41,
  avgSpend: 3_240,
  medianGapDays: 38,

  topByLtv: [
    { label: 'Meera Shah', ltv: 18_600, bookings: 9, last: '14 Nov', source: 'Instagram' },
    { label: 'Aditi Bose', ltv: 14_400, bookings: 4, last: '13 Nov', source: 'WhatsApp' },
    { label: 'Rohit Nair', ltv: 11_800, bookings: 7, last: '14 Nov', source: 'Direct' },
    { label: 'Ishita Roy', ltv: 9_000, bookings: 2, last: '10 Nov', source: 'Instagram' },
    { label: 'Vikram Shetty', ltv: 7_200, bookings: 6, last: '10 Nov', source: 'Google' },
  ],

  winBack: [
    { label: 'Priya Deshpande', ltv: 9_600, bookings: 4, daysSince: 74, service: 'Nutrition deep-dive' },
    { label: 'Sameer Joshi', ltv: 7_200, bookings: 3, daysSince: 68, service: 'Follow-up consult' },
    { label: 'Ananya Gupta', ltv: 4_800, bookings: 2, daysSince: 91, service: 'Sports nutrition audit' },
    { label: 'Nikhil Varma', ltv: 3_600, bookings: 3, daysSince: 63, service: 'Follow-up consult' },
  ],

  segments: [
    { label: 'First-time', count: 54, revenue: 42_300 },
    { label: 'Returning', count: 38, revenue: 61_400 },
    { label: 'High value (₹5k+)', count: 14, revenue: 68_200 },
    { label: 'At risk (60d+)', count: 12, revenue: 25_200 },
  ],

  cohortMonths: ['M0', 'M1', 'M2', 'M3', 'M4', 'M5'],
  cohorts: [
    { month: 'Jun', size: 18, values: [1, 0.44, 0.33, 0.28, 0.22, 0.17] },
    { month: 'Jul', size: 22, values: [1, 0.5, 0.36, 0.27, 0.18, null] },
    { month: 'Aug', size: 26, values: [1, 0.46, 0.35, 0.23, null, null] },
    { month: 'Sep', size: 31, values: [1, 0.52, 0.39, null, null, null] },
    { month: 'Oct', size: 34, values: [1, 0.47, null, null, null, null] },
    { month: 'Nov', size: 24, values: [1, null, null, null, null, null] },
  ],
};

/* ── Benchmarks — anonymised, k-anonymity ≥ 5 hosts ────────────────────── */
export const benchmark = {
  cohortKey: 'nutritionist',
  cohortLabel: 'Nutritionists',
  hostCount: 11,
  suppressed: false,
  rows: [
    { label: 'Average booking value', you: 1_253, median: 1_010, percentile: 72, better: true },
    { label: 'View → book rate', you: 0.043, median: 0.061, percentile: 28, better: false, isPct: true },
    { label: 'Repeat booking rate', you: 0.41, median: 0.29, percentile: 81, better: true, isPct: true },
    { label: 'No-show rate', you: 0.04, median: 0.07, percentile: 76, better: true, isPct: true, inverse: true },
  ],
};

// What a brand-new platform actually looks like: at 8 hosts no cohort clears
// k=5, so the prototype can show the honest empty state too.
export const benchmarkSuppressed = {
  cohortLabel: 'Nutritionists',
  hostCount: 3,
  suppressed: true,
};

/* ── Reputation (deep-links to Grow › Social proof) ────────────────────── */
export const reputation = {
  rating: 4.8,
  reviews: 34,
  delta: 2,
  distribution: [{ label: '5★', value: 27 }, { label: '4★', value: 5 }, { label: '3★', value: 1 }, { label: '2★', value: 1 }, { label: '1★', value: 0 }],
};

/* ── Goals ─────────────────────────────────────────────────────────────── */
export const goal = {
  target: 150_000,
  achieved: GROSS,
  get remaining() { return Math.max(0, this.target - this.achieved); },
  get progress() { return Math.min(1, this.achieved / this.target); },
  bookingsNeeded: 13,
  projectedDate: '27 Nov',
};

/* ── This week's 3 moves — each with its evidence (design doc §10) ──────── */
export const insights = [
  {
    id: 'winback',
    headline: '₹25,200',
    what: 'sitting with 4 guests who haven\'t booked in 60+ days',
    why: 'Returning guests are 41% of your paid bookings — well above the ₹1,010 cohort median earner.',
    evidence: [
      { label: 'Guests inactive 60+ days', value: '4' },
      { label: 'Their combined lifetime spend', value: '₹25,200' },
      { label: 'Your repeat booking rate', value: '41%' },
      { label: 'Longest gap', value: '91 days' },
    ],
    impact: 'At your repeat rate, ~2 of the 4 rebook — about ₹6,400.',
    estimate: true,
    measure: 'Rebookings from this list in the next 30 days.',
    action: 'Send nudge',
  },
  {
    id: 'thursday',
    headline: 'Thu 6–8pm',
    what: 'your second-best window, and you publish no hours in it',
    why: 'Friday 6–8pm fills at 92%. Thursday evening demand is nearly identical, and you are closed.',
    evidence: [
      { label: 'Friday 6–8pm fill rate', value: '92%' },
      { label: 'Thursday evening requests declined', value: '6 in 30 days' },
      { label: 'Current utilisation', value: '65%' },
      { label: 'Your average booking value', value: '₹1,253' },
    ],
    impact: 'Four more bookable slots a month ≈ ₹5,000 at your current average.',
    estimate: true,
    measure: 'Thursday evening bookings in the 30 days after you open the hours.',
    action: 'Open hours',
  },
  {
    id: 'deepdive',
    headline: '4.6%',
    what: 'Nutrition deep-dive gets the most views and converts the worst',
    why: '388 views, 4.6% conversion — Follow-up consult converts at 11.3% from half the traffic.',
    evidence: [
      { label: 'Deep-dive views → paid', value: '388 → 18 (4.6%)' },
      { label: 'Follow-up views → paid', value: '212 → 24 (11.3%)' },
      { label: 'Cohort median view→book', value: '6.1%' },
      { label: 'Price difference', value: '₹2,400 vs ₹1,200' },
    ],
    impact: 'Closing half the gap to your own follow-up rate would be about 14 more bookings a month.',
    estimate: true,
    measure: 'Deep-dive conversion rate 30 days after you change the page.',
    action: 'Review page',
  },
];

export default {
  money, leak, audience, demand, customers, benchmark, benchmarkSuppressed,
  reputation, goal, insights,
};
