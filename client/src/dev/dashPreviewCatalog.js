// Catalog sample data for the dev-only dashboard preview (see ./dashPreview.js).
// Shapes mirror the host list endpoints, including the server-computed
// guest_total (pricingEngine: price + platform fee + GST on the fee). Every
// figure is made up; the totals here use a ₹50 fee + 18% GST only so the
// preview looks real — the live numbers come from the server.
//
// localStorage `dash-preview-catalog` picks a state for screenshots:
//   (unset) a normal catalog · 'worst' long titles + ₹1 crore · 'empty' nothing
//   'error' every source fails · 'partial' products fail
const day = 86_400_000;
const ago = (d) => new Date(Date.now() - d * day).toISOString();
const fee = (price, chargeFree = false) => (price > 0 || chargeFree ? Math.round((price + 59) * 100) / 100 : 0);
// Local hero images, so screenshots never wait on the network.
const IMG = (name) => `/images/hero/${name}-hero-wide.webp`;

const SERVICES = [
  { id: 'svc-1', title: 'Funnel Teardown', price: 1499, guest_total: fee(1499), duration: 45, meeting_mode: 'online', is_active: true, slug: 'funnel-teardown', total_bookings: 5, thumbnail_url: IMG('consultant'), sort_order: 1, created_at: ago(40) },
  { id: 'svc-2', title: 'Growth Sprint Workshop', price: 999, guest_total: fee(999), duration: 60, meeting_mode: 'online', is_active: true, slug: 'growth-sprint', total_bookings: 5, thumbnail_url: IMG('coach'), sort_order: 2, created_at: ago(38) },
  { id: 'svc-3', title: 'SEO Consultation', price: 0, guest_total: 0, duration: 30, meeting_mode: 'offline', is_active: true, slug: 'seo-consultation', total_bookings: 2, thumbnail_url: null, sort_order: 3, created_at: ago(20) },
  { id: 'svc-4', title: 'Intro call', price: 0, guest_total: 0, duration: 15, meeting_mode: 'phone', is_active: false, slug: 'intro-call', total_bookings: 1, thumbnail_url: null, sort_order: null, created_at: ago(3) },
];
const PRODUCTS = [
  { id: 'prd-1', title: 'Funnel audit checklist', price: 299, guest_total: fee(299), type: 'pdf', purchase_count: 18, is_active: true, thumbnail_url: IMG('creator'), sort_order: null, created_at: ago(30) },
  { id: 'prd-2', title: 'Landing page templates', price: 799, guest_total: fee(799), type: 'template', purchase_count: 0, is_active: false, thumbnail_url: null, sort_order: null, created_at: ago(12) },
];
const COURSES = [
  { id: 'crs-1', title: 'Growth basics in 7 days', price: 2499, guest_total: fee(2499), purchase_count: 4, is_active: true, thumbnail_url: IMG('educator'), course_lessons: [1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: `l${i}`, title: `Day ${i}` })), sort_order: null, created_at: ago(25) },
];
const COUPONS = [
  { id: 'cpn-1', code: 'DIWALI20', discount_type: 'percent', discount_value: 20, active: true, times_redeemed: 3, max_redemptions: 50, expires_at: new Date(Date.now() + 9 * day).toISOString(), created_at: ago(10) },
  { id: 'cpn-2', code: 'WELCOMEBACK', discount_type: 'flat', discount_value: 300, active: false, times_redeemed: 0, max_redemptions: null, expires_at: null, created_at: ago(5) },
];
const MEMBERSHIP = { program: { id: 'mp-1', name: 'Growth circle', blurb: 'Monthly growth clinics and a members-only Q&A.', status: 'live', tiers: [
  { id: 'tier-1', name: 'Circle', type: 'paid', price_inr: 499, status: 'live', position: 0, perks: ['Monthly group clinic', 'Members-only Q&A'], created_at: ago(15) },
  { id: 'tier-2', name: 'Inner circle', type: 'paid', price_inr: 1999, status: 'draft', position: 1, perks: ['Everything in Circle', 'One 1:1 review a month'], created_at: ago(15) },
] } };
const MEMBERS = { member_count: 2, mrr: 998, members: [
  { id: 'mm-1', status: 'active', member: { name: 'Meera Iyer' }, tier: { name: 'Circle' } },
  { id: 'mm-2', status: 'active', member: { name: 'Kabir Rao' }, tier: { name: 'Circle' } },
] };

const LONG = 'Complete 1:1 business strategy deep-dive for founders who want to rebuild their whole go-to-market plan';
const WORST = {
  services: [
    { ...SERVICES[0], title: LONG, price: 10000000, guest_total: fee(10000000), duration: 480 },
    ...SERVICES.slice(1),
    ...Array.from({ length: 6 }, (_, i) => ({ ...SERVICES[2], id: `svc-x${i}`, title: `Extra session ${i + 1} with a rather long name to see it truncate`, sort_order: null, created_at: ago(1 + i) })),
  ],
  products: [{ ...PRODUCTS[0], title: `${LONG} — workbook`, price: 9999999, guest_total: fee(9999999), purchase_count: 123456 }, PRODUCTS[1]],
};

const ERR = { __previewError: 500 };

export function catalogFixtures() {
  let mode = '';
  try { mode = localStorage.getItem('dash-preview-catalog') || ''; } catch { /* storage blocked */ }
  if (mode === 'empty') {
    return { '/services': [], '/products/mine/all': [], '/courses/mine/all': [], '/host/coupons': [], '/memberships/mine': { program: null }, '/memberships/members': { member_count: 0, mrr: 0, members: [] } };
  }
  if (mode === 'error') {
    return { '/services': ERR, '/products/mine/all': ERR, '/courses/mine/all': ERR, '/host/coupons': ERR, '/memberships/mine': ERR };
  }
  return {
    '/services': mode === 'worst' ? WORST.services : SERVICES,
    '/products/mine/all': mode === 'partial' ? ERR : (mode === 'worst' ? WORST.products : PRODUCTS),
    '/courses/mine/all': COURSES,
    '/host/coupons': COUPONS,
    '/memberships/mine': MEMBERSHIP,
    '/memberships/members': MEMBERS,
  };
}
